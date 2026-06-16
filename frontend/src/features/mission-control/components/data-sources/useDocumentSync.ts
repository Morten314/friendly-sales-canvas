import type { User } from "firebase/auth";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";

import { useDataSources } from "../../hooks/useDataSources";
import type { DataSource, DataSourceStatus } from "../../types";

import { getDismissedDataSourceKeys, isDataSourceDismissed } from "./dataSourceDismissals";
import {
  encodeFileKeyForStatusUrl,
  extractFileIdFromFileKey,
  isSameDataSourceRow,
  resolveDocumentStatusFileKey,
  isPendingLocalDataSource,
  shouldMergeFileByFileName,
} from "./dataSourceHelpers";
import { mapDocumentListStatus, parseDocumentStatusResponse } from "./leadStreamStatus";

import { buildApiUrl } from "@/shared/api/transport";
import type { UntypedBackendDocument } from "@/shared/types/escape-hatches";

interface UseDocumentSyncOptions {
  orgIdToUse: string;
  currentUser: User | null | undefined;
  getAuthHeader: () => Promise<string>;
}

export interface DocumentSyncApi {
  dataSources: DataSource[];
  setDataSources: React.Dispatch<React.SetStateAction<DataSource[]>>;
  isLoading: boolean;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  checkProcessingFilesStatus: () => Promise<void>;
  loadDataSourcesFromBackend: () => Promise<void>;
}

/**
 * Owns the backend-document read/sync/merge path for DataSourcesManager: the
 * dataSources/isLoading/isSaving state, the useDataSources query read, the
 * mapping/merge of backend documents into component state (applyBackendDocuments),
 * the query→state sync effects, loadDataSourcesFromBackend, and the document-status
 * helpers. Extracted from DataSourcesManager (Phase 13b, Seam 7).
 *
 * The merge algorithm in applyBackendDocuments was moved verbatim — it is relocated,
 * not rewritten.
 */
export function useDocumentSync({
  orgIdToUse,
  currentUser,
  getAuthHeader,
}: UseDocumentSyncOptions): DocumentSyncApi {
  // Read hooks (TanStack Query). The two GET reads are served by these hooks; the
  // mapping/merge into component state stays here (sync-effects below). Writes
  // still use raw fetch + getAuthHeader (deferred).
  const dataSourcesQuery = useDataSources(orgIdToUse, !!currentUser?.uid);

  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  // The former `_isSaving` state was removed (it was never read anywhere). `setIsSaving`
  // is kept as a no-op shim so DataSourcesManager's existing call sites still type-check
  // against this api object — no saving flag is tracked. Dropping the field + those call
  // sites is deferred (TD-FE-74).
  const setIsSaving: DocumentSyncApi["setIsSaving"] = () => {};
  // Initial load only — background refetches (tab refresh, polling) must not
  // re-show the full-page overlay or production feels like an infinite loop.
  const isLoading = dataSourcesQuery.isLoading;

  // Mirror dataSources into a ref so checkProcessingFilesStatus can read the
  // current rows without abusing setDataSources as a getter (which fired its
  // async side effects inside a state updater — re-running them on every set).
  const dataSourcesRef = useRef<DataSource[]>([]);
  useEffect(() => {
    dataSourcesRef.current = dataSources;
  }, [dataSources]);
  // File ids whose /document-status check is currently in flight — guards against
  // the 4s poll (and rapid back-to-back calls) firing a duplicate fetch for a row
  // that is already being checked.
  const inFlightStatusIds = useRef<Set<string>>(new Set());

  // Check processing status for a specific file
  const checkDocumentStatus = useCallback(
    async (
      fileKey: string,
    ): Promise<{ status: DataSourceStatus; chunks_count?: number; timestamps?: unknown }> => {
      if (!currentUser?.uid) {
        throw new Error("User not authenticated");
      }

      const authHeader = await getAuthHeader();
      const url = buildApiUrl(`document-status/${encodeFileKeyForStatusUrl(fileKey)}`);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader && { Authorization: authHeader }),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to check document status: ${response.status} - ${errorText}`);
      }

      const payload = await response.json();
      return parseDocumentStatusResponse(payload);
    },
    [currentUser?.uid, getAuthHeader],
  );

  // Check status for processing files. Reads the current rows from the ref (not
  // via a setDataSources updater) and guards each file id so a check already in
  // flight is not re-issued by the 4s poll or a rapid second call.
  const checkProcessingFilesStatus = useCallback(async () => {
    const processingFiles = dataSourcesRef.current.filter(
      (s) => s.status === "processing" && s.type === "file",
    );

    processingFiles.forEach((file) => {
      if (inFlightStatusIds.current.has(file.id)) return; // already checking this file
      inFlightStatusIds.current.add(file.id);
      void (async () => {
        try {
          const statusPayload = await checkDocumentStatus(resolveDocumentStatusFileKey(file));
          setDataSources((prev) =>
            prev.map((s) =>
              isSameDataSourceRow(s, file) ? { ...s, status: statusPayload.status } : s,
            ),
          );
        } catch (err) {
          console.error(`Error checking status for file ${file.id}:`, err);
        } finally {
          inFlightStatusIds.current.delete(file.id);
        }
      })();
    });
  }, [checkDocumentStatus]);

  // Map the backend documents (from the useDataSources read) into the merged
  // DataSource[] state. The hook already unwrapped the {documents|files|data}
  // envelope to a raw array; this reproduces the original loadDataSourcesFromBackend
  // mapping/merge verbatim, just sourced from the query instead of a raw fetch.
  const applyBackendDocuments = useCallback(
    (documents: unknown[]) => {
      if (Array.isArray(documents)) {
        {
          const dismissedKeys = getDismissedDataSourceKeys(currentUser?.uid ?? "");
          const loadedSources: DataSource[] = documents
            .map((doc: UntypedBackendDocument): DataSource => {
              // Parse tags - handle both array and string formats
              let parsedTags: string[] = [];
              if (Array.isArray(doc.tags)) {
                parsedTags = doc.tags;
              } else if (typeof doc.tags === "string") {
                // Handle comma-separated string or JSON array string
                try {
                  // Try parsing as JSON first
                  const parsed = JSON.parse(doc.tags);
                  parsedTags = Array.isArray(parsed) ? parsed : [];
                } catch {
                  // If not JSON, treat as comma-separated string
                  parsedTags = doc.tags
                    .split(",")
                    .map((tag: string) => tag.trim())
                    .filter((tag: string) => tag.length > 0);
                }
              }

              // Determine if this is a URL or file source
              // URLs have file_key === null (or undefined), files have file_key with a path
              const hasFileKey =
                doc.file_key !== null && doc.file_key !== undefined && doc.file_key !== "";
              const hasFileKeyAlt =
                doc.fileKey !== null && doc.fileKey !== undefined && doc.fileKey !== "";
              const docType = String(doc.data_source_type || doc.dataSourceType || "")
                .toLowerCase()
                .trim();
              const isUrlSource =
                docType === "url" ||
                (!hasFileKey && !hasFileKeyAlt && docType !== "file" && !!doc.file_id);
              const isFileSource = docType === "file" || hasFileKey || hasFileKeyAlt;

              // Extract file_id/document_id - backend returns file_id for both files and URLs
              // Priority: file_id > _id > extract from file_key (for files only)
              let fileId: string | undefined = undefined;
              if (doc.file_id) {
                // file_id is the primary identifier for both files and URLs
                fileId = doc.file_id;
              } else if (doc._id) {
                // Fallback to _id if file_id is not present
                fileId = doc._id;
              } else if (isFileSource) {
                // For files only, extract UUID from file_key as fallback
                const extracted = extractFileIdFromFileKey(doc.file_key || doc.fileKey);
                // Validate that we got a UUID, not the full path
                const uuidPattern =
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (uuidPattern.test(extracted)) {
                  fileId = extracted;
                } else {
                  // Try one more time with a more aggressive extraction
                  const fileKeyStr = doc.file_key || doc.fileKey;
                  if (fileKeyStr.includes("/")) {
                    const parts = fileKeyStr.split("/");
                    const afterSlash = parts[parts.length - 1];
                    const uuidPart = afterSlash.split("_")[0];
                    if (uuidPattern.test(uuidPart)) {
                      fileId = uuidPart;
                    }
                  }
                }
              }

              if (isUrlSource) {
                // URL source - use file_id as primary identifier (same as files)
                // If file_id exists, use it as both id and fileId
                // Otherwise fall back to _id
                const urlId = fileId || doc._id || doc.id || `url-${Date.now()}-${Math.random()}`;

                // URL might be in doc.url, doc.source_url, or might need to be fetched separately
                // For now, check multiple possible fields
                const urlValue = doc.url || doc.source_url || doc.file_url || undefined;

                return {
                  id: urlId,
                  fileId: fileId || doc._id, // Store the file_id for deletion (required for API calls)
                  type: "url",
                  name: doc.name || doc.file_name || "URL Source",
                  url: urlValue,
                  description: doc.description || undefined,
                  tags: parsedTags,
                  status: mapDocumentListStatus(doc, "url"),
                  createdAt: doc.uploaded_at
                    ? new Date(doc.uploaded_at)
                    : doc.created_at
                      ? new Date(doc.created_at)
                      : new Date(),
                };
              } else {
                // File source
                const fileKeyPath = doc.file_key || doc.fileKey || undefined;
                return {
                  id: fileKeyPath || doc.id || `source-${Date.now()}-${Math.random()}`,
                  fileKey: fileKeyPath || doc.id,
                  fileId: fileId, // Store the file_id for deletion
                  type: "file",
                  name:
                    doc.name ||
                    doc.file_name ||
                    doc.original_filename ||
                    doc.fileKey ||
                    "Uploaded file",
                  fileName: doc.file_name || doc.original_filename || doc.name,
                  url: doc.file_url,
                  description: doc.description || undefined,
                  tags: parsedTags,
                  status: mapDocumentListStatus(doc, "file"),
                  createdAt: doc.uploaded_at
                    ? new Date(doc.uploaded_at)
                    : doc.created_at
                      ? new Date(doc.created_at)
                      : new Date(),
                };
              }
            })
            .filter((source) => !isDataSourceDismissed(source, dismissedKeys));

          // Merge with existing sources: keep system types, update file and URL types from backend
          setDataSources((prev) => {
            const systemSources = prev.filter((s) => s.type === "system");
            const existingFileSources = prev.filter((s) => s.type === "file");
            const existingUrlSources = prev.filter((s) => s.type === "url");

            // Separate loaded sources by type
            const loadedFileSources = loadedSources.filter((s) => s.type === "file");
            const loadedUrlSources = loadedSources.filter((s) => s.type === "url");

            // Create a map of existing files by fileId (UUID) for primary matching - this is the most reliable
            const existingFilesByFileId = new Map(
              existingFileSources.filter((f) => f.fileId).map((f) => [f.fileId!, f]),
            );

            // Create a map by ID (file_key) for fallback matching
            const existingFilesById = new Map(existingFileSources.map((f) => [f.id, f]));

            // Also create a map by fileName for additional fallback matching
            const existingFilesByFileName = new Map(
              existingFileSources.filter((f) => f.fileName).map((f) => [f.fileName!, f]),
            );

            // Create a map of existing URLs by fileId (UUID) for primary matching
            const existingUrlsByFileId = new Map(
              existingUrlSources.filter((u) => u.fileId).map((u) => [u.fileId!, u]),
            );

            // Create a map by ID for URL fallback matching
            const existingUrlsById = new Map(existingUrlSources.map((u) => [u.id, u]));

            // Track which existing files and URLs we've matched (by their IDs)
            const matchedExistingIds = new Set<string>();

            // Merge file sources: use backend data, but preserve any local metadata updates
            const mergedFileSources = loadedFileSources.map((backendFile) => {
              const backendStatusFileKey = backendFile.fileKey ?? backendFile.id;
              let existingFile: DataSource | undefined = undefined;
              let matchedById: string | undefined = undefined;

              // Priority 1: Match by fileId (UUID) - most reliable for updated entries
              if (backendFile.fileId) {
                existingFile = existingFilesByFileId.get(backendFile.fileId);
                if (existingFile) {
                  matchedById = existingFile.id;
                }
              }

              // Priority 2: Match by ID (file_key) if fileId match failed
              if (!existingFile) {
                existingFile = existingFilesById.get(backendFile.id);
                if (existingFile) {
                  matchedById = existingFile.id;
                }
              }

              // Priority 3: Match by fileName only for the same backend file — never a re-upload.
              if (!existingFile && backendFile.fileName) {
                const candidate = existingFilesByFileName.get(backendFile.fileName);
                if (candidate && shouldMergeFileByFileName(candidate, backendFile)) {
                  existingFile = candidate;
                  matchedById = candidate.id;
                }
              }

              if (existingFile && matchedById) {
                matchedExistingIds.add(matchedById);
                // When matched by fileId, use backend data (which has the latest updates from PUT)
                // This ensures that after refresh, we get the updated tags and description
                return {
                  ...backendFile,
                  id: matchedById, // Keep the existing ID to maintain reference
                  fileKey: backendStatusFileKey,
                  fileId: backendFile.fileId || existingFile.fileId, // Use backend fileId (most up-to-date)
                  // Use backend data for all fields since backend is source of truth after PUT update
                  name: backendFile.name || existingFile.name,
                  description:
                    backendFile.description !== undefined
                      ? backendFile.description
                      : existingFile.description,
                  tags: backendFile.tags, // Always use backend tags (even if empty array)
                  fileName: backendFile.fileName || existingFile.fileName,
                  createdAt: existingFile.createdAt, // Preserve original creation date
                };
              }

              // New file from backend - return as is
              return backendFile;
            });

            // Merge URL sources: use backend data, but preserve any local metadata updates
            const mergedUrlSources = loadedUrlSources.map((backendUrl) => {
              let existingUrl: DataSource | undefined = undefined;
              let matchedById: string | undefined = undefined;

              // Priority 1: Match by fileId (UUID) - most reliable for updated entries
              if (backendUrl.fileId) {
                existingUrl = existingUrlsByFileId.get(backendUrl.fileId);
                if (existingUrl) {
                  matchedById = existingUrl.id;
                }
              }

              // Priority 2: Match by ID if fileId match failed
              if (!existingUrl) {
                existingUrl = existingUrlsById.get(backendUrl.id);
                if (existingUrl) {
                  matchedById = existingUrl.id;
                }
              }

              if (existingUrl && matchedById) {
                matchedExistingIds.add(matchedById);
                // When matched by fileId, use backend data (which has the latest updates from PUT)
                // This ensures that after refresh, we get the updated tags and description
                return {
                  ...backendUrl,
                  id: matchedById, // Keep the existing ID to maintain reference
                  fileId: backendUrl.fileId || existingUrl.fileId, // Use backend fileId (most up-to-date)
                  // Use backend data for all fields since backend is source of truth after PUT update
                  name: backendUrl.name || existingUrl.name,
                  description:
                    backendUrl.description !== undefined
                      ? backendUrl.description
                      : existingUrl.description,
                  tags: backendUrl.tags, // Always use backend tags (even if empty array)
                  url: backendUrl.url || existingUrl.url,
                  createdAt: existingUrl.createdAt, // Preserve original creation date
                };
              }

              // New URL from backend - return as is
              return backendUrl;
            });

            // Keep local-only rows only while still processing; completed rows missing
            // from the backend are stale orphans and should not reappear in the UI.
            const unmatchedExistingFiles = existingFileSources.filter(
              (s) =>
                !matchedExistingIds.has(s.id) &&
                isPendingLocalDataSource(s) &&
                !isDataSourceDismissed(s, dismissedKeys),
            );

            const unmatchedExistingUrls = existingUrlSources.filter(
              (s) =>
                !matchedExistingIds.has(s.id) &&
                isPendingLocalDataSource(s) &&
                !isDataSourceDismissed(s, dismissedKeys),
            );

            // Combine all sources and remove duplicates by id
            const allSources = [
              ...systemSources,
              ...mergedFileSources,
              ...mergedUrlSources,
              ...unmatchedExistingFiles,
              ...unmatchedExistingUrls,
            ];
            const uniqueSourcesMap = new Map<string, DataSource>();

            // Process in order: existing sources first (to preserve local edits), then backend sources
            allSources.forEach((source) => {
              if (!uniqueSourcesMap.has(source.id)) {
                uniqueSourcesMap.set(source.id, source);
              } else {
                // If duplicate found, prefer the one with fileId match (from backend)
                const existing = uniqueSourcesMap.get(source.id)!;
                if (source.fileId && existing.fileId && source.fileId === existing.fileId) {
                  // Same fileId - use the backend version (more up-to-date)
                  uniqueSourcesMap.set(source.id, source);
                }
              }
            });

            const result = Array.from(uniqueSourcesMap.values());
            return result;
          });
        }
      }
    },
    [currentUser?.uid],
  );

  // Sync the useDataSources read into component state. Re-runs whenever the query
  // returns fresh documents (initial fetch + every refetch after a mutation),
  // preserving the merge-with-existing behavior of the original load function.
  useEffect(() => {
    if (dataSourcesQuery.data) {
      applyBackendDocuments(dataSourcesQuery.data);
    }
  }, [dataSourcesQuery.data, applyBackendDocuments]);

  const hasProcessingFiles = useMemo(
    () => dataSources.some((s) => s.type === "file" && s.status === "processing"),
    [dataSources],
  );

  // Poll /document-status while any file row is still processing.
  useEffect(() => {
    if (!hasProcessingFiles) return;

    void checkProcessingFilesStatus();
    const id = window.setInterval(() => {
      void checkProcessingFilesStatus();
    }, 4000);
    return () => window.clearInterval(id);
  }, [hasProcessingFiles, checkProcessingFilesStatus]);

  // Load documents from backend (separate storage, not company profile).
  // Thin wrapper over the query refetch. The sync-effect above also re-maps query
  // data into state, but it only fires on a LATER render after the cache updates —
  // so callers that `await loadDataSourcesFromBackend()` and then immediately
  // `setDataSources((prev) => …applyMetadata…)` (the add-with-metadata flows) would
  // see a `prev` WITHOUT the just-refetched doc. To preserve the original inline-
  // setState timing, apply the refetched documents into state synchronously here
  // (inside the awaited fn) so the merge updater is enqueued BEFORE the caller's
  // metadata-apply updater — React then chains the functional updaters in order,
  // exactly as the pre-refactor load did. applyBackendDocuments is idempotent, so
  // the duplicate apply from the sync-effect is a harmless no-op.
  const loadDataSourcesFromBackend = async () => {
    if (!currentUser?.uid) {
      return;
    }
    const { data } = await dataSourcesQuery.refetch();
    if (data) {
      applyBackendDocuments(data);
    }
  };

  return {
    dataSources,
    setDataSources,
    isLoading,
    setIsSaving,
    checkProcessingFilesStatus,
    loadDataSourcesFromBackend,
  };
}
