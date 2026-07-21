import type { User } from "firebase/auth";
import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";

import { useLeadStreamStatus } from "../../hooks/useLeadStreamStatus";
import type { LeadStreamFileApiRow } from "../../types";

import {
  getLeadImportKind,
  normalizeCsv,
  parseErrorMessage,
  sniffExcelBinarySignature,
  validateCsvFormat,
} from "./csvHelpers";
import {
  getDismissedLeadStreamFileIds,
  pruneDismissedLeadStreamFileIds,
  rememberDismissedLeadStreamFile,
} from "./dataSourceDismissals";
import { getLeadStreamRowStatus, isTerminalLeadStreamStatus } from "./leadStreamStatus";

import type { toast as toastFnRef } from "@/components/ui/use-toast";
import { buildApiUrl } from "@/shared/api/transport";

/** Convert an arbitrary-encoding CSV file to a UTF-8 File object. */
const convertToUtf8 = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const encodings = ["windows-1252", "iso-8859-1", "utf-8"];
        let text = "";
        let decoded = false;

        for (const encoding of encodings) {
          try {
            const decoder = new TextDecoder(encoding, { fatal: false });
            text = decoder.decode(arrayBuffer);
            decoded = true;
            break;
          } catch {
            continue;
          }
        }

        if (!decoded || !text) {
          text = new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
        }

        text = normalizeCsv(text);
        const utf8Blob = new Blob([text], { type: "text/csv;charset=utf-8" });
        const utf8File = new File([utf8Blob], file.name, {
          type: "text/csv",
          lastModified: file.lastModified,
        });

        resolve(utf8File);
      } catch (error) {
        reject(
          new Error(
            `Failed to convert file encoding: ${error instanceof Error ? error.message : "Unknown error"}`,
          ),
        );
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

export interface LeadStreamApi {
  // State values
  leadStreamFiles: LeadStreamFileApiRow[];
  leadStreamStatusLoading: boolean;
  isUploadingLeads: boolean;
  deletingLeadStreamFileId: string | null;
  showLeadUpload: boolean;
  selectedLeadFile: File | null;
  isDraggingLead: boolean;

  // Refs
  leadFileInputRef: React.RefObject<HTMLInputElement>;

  // Setters the parent / JSX need
  setShowLeadUpload: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedLeadFile: React.Dispatch<React.SetStateAction<File | null>>;

  // Handlers
  refreshLeadStreamStatus: (opts?: { silent?: boolean }) => Promise<void>;
  handleDeleteLeadStream: (fileId: string) => Promise<void>;
  handleLeadFileSelect: (file: File) => Promise<void>;
  handleLeadFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleLeadDragOver: (e: React.DragEvent) => void;
  handleLeadDragLeave: (e: React.DragEvent) => void;
  handleLeadDrop: (e: React.DragEvent) => Promise<void>;
  handleConnectToCRM: (crmSystem: string) => void;
  handleUploadLeadCsv: () => Promise<void>;
}

interface UseLeadStreamOptions {
  currentUser: User | null | undefined;
  orgIdToUse: string;
  getAuthHeader: () => Promise<string>;
  toast: typeof toastFnRef;
}

/**
 * Owns all lead-stream state, effects, and handlers for DataSourcesManager.
 * Extracted from DataSourcesManager (Phase 13b, Seam 6).
 */
export function useLeadStream({
  currentUser,
  orgIdToUse,
  getAuthHeader,
  toast,
}: UseLeadStreamOptions): LeadStreamApi {
  // Lead Stream — files + backend processing status (GET /leads/stream/status)
  const [leadStreamFiles, setLeadStreamFiles] = useState<LeadStreamFileApiRow[]>([]);
  const [leadStreamStatusLoading, setLeadStreamStatusLoading] = useState(false);
  const [isUploadingLeads, setIsUploadingLeads] = useState(false);
  const [deletingLeadStreamFileId, setDeletingLeadStreamFileId] = useState<string | null>(null);
  const [showLeadUpload, setShowLeadUpload] = useState(false);
  const [selectedLeadFile, setSelectedLeadFile] = useState<File | null>(null);
  const [isDraggingLead, setIsDraggingLead] = useState(false);
  const leadFileInputRef = useRef<HTMLInputElement>(null);
  /** file_ids removed via DELETE /leads/by-file — hide if status API still returns a stale row */
  const deletedLeadStreamFileIdsRef = useRef<Set<string>>(new Set());

  const leadStreamQuery = useLeadStreamStatus(currentUser?.uid ?? "", orgIdToUse);
  // React Query refetch fn is stable across renders — destructure once
  const { refetch: refetchLeadStream } = leadStreamQuery;
  const isLeadStreamQueryLoading = leadStreamQuery.isLoading;

  const isLeadStreamRowDeletedInApi = (row: LeadStreamFileApiRow): boolean => {
    const ps = (row.processing_status || "").toLowerCase();
    const ts = (row.tracking_status || "").toLowerCase();
    return ps === "deleted" || ts === "deleted";
  };

  const filterVisibleLeadStreamFiles = (files: LeadStreamFileApiRow[]): LeadStreamFileApiRow[] =>
    files.filter(
      (f) => !deletedLeadStreamFileIdsRef.current.has(f.file_id) && !isLeadStreamRowDeletedInApi(f),
    );

  // Sync the useLeadStreamStatus read into component state. Prunes the
  // optimistic-delete ref to ids that are gone from the backend, then applies the
  // visibility filter (which still hides ids in deletedLeadStreamFileIdsRef +
  // rows the API marks deleted). Re-runs on every query result (initial + refetch).
  useEffect(() => {
    const files = leadStreamQuery.data;
    if (!files || !currentUser?.uid) return;
    deletedLeadStreamFileIdsRef.current = getDismissedLeadStreamFileIds(currentUser.uid);
    const idsInResponse = new Set(files.map((f) => f.file_id));
    for (const id of [...deletedLeadStreamFileIdsRef.current]) {
      if (!idsInResponse.has(id)) deletedLeadStreamFileIdsRef.current.delete(id);
    }
    pruneDismissedLeadStreamFileIds(currentUser.uid, idsInResponse);
    setLeadStreamFiles(filterVisibleLeadStreamFiles(files));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterVisibleLeadStreamFiles is a non-memoized helper reading only refs; re-runs are driven by the query data, not the helper identity
  }, [leadStreamQuery.data, currentUser?.uid]);

  /** GET /leads/stream/status — thin refetch over useLeadStreamStatus. The
   *  sync-effect above re-maps the result into state. `silent` drives only the
   *  loading flag: a non-silent refresh shows the loading state, the poll does not.
   *  Kept (name + `{ silent }` signature + call sites) so refreshes still work. */
  const refreshLeadStreamStatus = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      const userId = currentUser?.uid || "";
      if (!userId) {
        setLeadStreamFiles([]);
        return;
      }

      if (!silent) {
        setLeadStreamStatusLoading(true);
      }
      try {
        await refetchLeadStream();
      } finally {
        if (!silent) {
          setLeadStreamStatusLoading(false);
        }
      }
    },
    // refetchLeadStream is React Query's stable refetch fn (does not change identity)
    [currentUser?.uid, refetchLeadStream],
  );

  /** DELETE /leads/by-file/{file_id} — removes all leads for file (user/org scoped) and updates stream tracking */
  const deleteLeadsByFile = async (fileId: string) => {
    const userId = currentUser?.uid || "";
    const leadOrgId = orgIdToUse;

    if (!userId) {
      throw new Error("User ID is required");
    }
    if (!fileId) {
      throw new Error("File ID is required");
    }

    const authHeader = await getAuthHeader();
    const qs = new URLSearchParams({
      user_id: userId,
      org_id: leadOrgId,
    });
    const url = buildApiUrl(`leads/by-file/${encodeURIComponent(fileId)}?${qs.toString()}`);

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader && { Authorization: authHeader }),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ DataSourcesManager - Delete leads by file error:", {
        status: response.status,
        errorText,
        fileId,
      });
      const err = new Error(`Failed to delete leads for file: ${response.status} - ${errorText}`);
      (err as Error & { httpStatus?: number }).httpStatus = response.status;
      throw err;
    }

    const result = await response.json().catch(() => ({}));
    console.log("✅ DataSourcesManager - Delete leads by file success:", result);
    return result as {
      status?: string;
      message?: string;
      file_id?: string;
      deleted_count?: number;
    };
  };

  const handleDeleteLeadStream = async (fileId: string) => {
    if (!fileId) {
      toast({
        title: "Cannot remove import",
        description: "Missing file id for this upload.",
        variant: "destructive",
      });
      return;
    }
    if (
      !confirm(
        "Remove this lead stream file? All leads imported from this upload will be deleted from the backend.",
      )
    ) {
      return;
    }

    setDeletingLeadStreamFileId(fileId);
    try {
      const result = await deleteLeadsByFile(fileId);
      deletedLeadStreamFileIdsRef.current.add(fileId);
      if (currentUser?.uid) {
        rememberDismissedLeadStreamFile(currentUser.uid, fileId);
      }
      setLeadStreamFiles((prev) => prev.filter((f) => f.file_id !== fileId));
      await refreshLeadStreamStatus();
      const n = result?.deleted_count;
      toast({
        title: "Lead stream removed",
        description:
          typeof n === "number"
            ? `${n} lead${n === 1 ? "" : "s"} removed for this file.`
            : "The file import and associated leads have been removed.",
      });
    } catch (error) {
      console.error("❌ DataSourcesManager - Delete lead stream error:", error);
      const httpStatus =
        error instanceof Error ? (error as Error & { httpStatus?: number }).httpStatus : undefined;
      if (httpStatus === 404) {
        deletedLeadStreamFileIdsRef.current.add(fileId);
        if (currentUser?.uid) {
          rememberDismissedLeadStreamFile(currentUser.uid, fileId);
        }
        setLeadStreamFiles((prev) => prev.filter((f) => f.file_id !== fileId));
        toast({
          title: "Import removed",
          description:
            "This lead import was no longer on the server and has been cleared from your list.",
        });
        return;
      }
      toast({
        title: "Delete failed",
        description:
          error instanceof Error ? error.message : "Could not remove lead stream. Try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingLeadStreamFileId(null);
    }
  };

  // Initial load + polling effects
  useEffect(() => {
    if (!currentUser?.uid) return;
    void refreshLeadStreamStatus();
  }, [currentUser?.uid, refreshLeadStreamStatus]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const needsPoll = leadStreamFiles.some(
      (f) => !isTerminalLeadStreamStatus(getLeadStreamRowStatus(f)),
    );
    if (!needsPoll) return;
    const id = setInterval(() => {
      void refreshLeadStreamStatus({ silent: true });
    }, 3000);
    return () => clearInterval(id);
  }, [leadStreamFiles, currentUser?.uid, refreshLeadStreamStatus]);

  // API: Upload lead file batch (CSV, XLSX, XLS — matches backend)
  const uploadCsvBatch = async (file: File) => {
    const userId = currentUser?.uid || "";
    const leadOrgId = orgIdToUse;

    if (!userId) {
      throw new Error("User ID is required");
    }

    let uploadFile: File;
    if (getLeadImportKind(file) === "excel" || (await sniffExcelBinarySignature(file))) {
      uploadFile = file;
    } else {
      try {
        uploadFile = await convertToUtf8(file);
      } catch (error) {
        throw new Error(
          `Failed to process CSV file encoding: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    const authHeader = await getAuthHeader();
    const url = buildApiUrl("leads/batch-upload");

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("user_id", userId);
    formData.append("org_id", leadOrgId);

    console.log("🚀 DataSourcesManager - Batch Upload Starting:", {
      url,
      userId,
      orgId: leadOrgId,
      fileName: uploadFile.name,
      fileSize: uploadFile.size,
      hasAuth: !!authHeader,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...(authHeader && { Authorization: authHeader }),
      },
      body: formData,
    });

    if (!response.ok) {
      let errorText = await response.text();
      console.error("❌ DataSourcesManager - Batch Upload Error:", {
        status: response.status,
        errorText,
      });

      // Try to parse JSON error response
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.detail) {
          errorText = errorJson.detail;
        } else if (errorJson.message) {
          errorText = errorJson.message;
        } else if (errorJson.error) {
          errorText = errorJson.error;
        }
      } catch {
        // If not JSON, use the text as is
      }

      throw new Error(`Failed to upload file: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ DataSourcesManager - Batch Upload Success:", result);

    return result;
  };

  // Handlers for lead batch upload (CSV / XLSX / XLS — same as backend)
  const handleLeadFileSelect = async (file: File) => {
    if (getLeadImportKind(file) !== null || (await sniffExcelBinarySignature(file))) {
      setSelectedLeadFile(file);
      return;
    }
    toast({
      title: "Invalid file type",
      description: "Please upload a CSV, XLSX, or XLS file.",
      variant: "destructive",
    });
  };

  const handleLeadFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleLeadFileSelect(file);
    }
  };

  const handleLeadDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLead(true);
  };

  const handleLeadDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLead(false);
  };

  const handleLeadDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLead(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      await handleLeadFileSelect(file);
    }
  };

  const handleConnectToCRM = (crmSystem: string) => {
    // CRM system login URLs
    const crmUrls: Record<string, string> = {
      hubspot: "https://app.hubspot.com/login",
      salesforce: "https://login.salesforce.com/",
      pipedrive: "https://www.pipedrive.com/login",
      zoho: "https://accounts.zoho.com/signin",
      monday: "https://auth.monday.com/users/sign_in",
      asana: "https://app.asana.com/-/login",
    };

    const url = crmUrls[crmSystem.toLowerCase()];
    if (url) {
      // Open in new tab
      window.open(url, "_blank", "noopener,noreferrer");
      toast({
        title: "Redirecting to CRM",
        description: `Opening ${crmSystem} login page...`,
      });
    } else {
      toast({
        title: "Error",
        description: `Login URL for ${crmSystem} not configured.`,
        variant: "destructive",
      });
    }
  };

  const handleUploadLeadCsv = async () => {
    if (!selectedLeadFile) {
      toast({
        title: "No file selected",
        description: "Please select a CSV, XLSX, or XLS file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingLeads(true);
    try {
      if (getLeadImportKind(selectedLeadFile) === "csv") {
        const validation = await validateCsvFormat(selectedLeadFile);
        if (!validation.valid) {
          toast({
            title: "CSV validation failed",
            description: validation.error || "Invalid CSV format",
            variant: "destructive",
          });
          setIsUploadingLeads(false);
          return;
        }
      }
    } catch (_validationError) {
      toast({
        title: "Validation error",
        description: "Failed to validate CSV file. Please check the file format.",
        variant: "destructive",
      });
      setIsUploadingLeads(false);
      return;
    }

    try {
      const result = await uploadCsvBatch(selectedLeadFile);

      const fileIdFromUpload =
        result.file_id ??
        result.fileId ??
        result.file_uuid ??
        (typeof result.file === "object" && result.file?.id) ??
        undefined;
      if (!fileIdFromUpload) {
        console.warn("DataSourcesManager: batch-upload response missing file_id", result);
      }
      const createdCount = result.created_count || 0;
      const errorCount = result.error_count || 0;
      const errors = result.errors || [];

      if (errorCount > 0 && errors.length > 0) {
        toast({
          title: "Import completed with errors",
          description: `Created ${createdCount} leads. ${errorCount} errors occurred.`,
          variant: "default",
        });
      } else if (createdCount > 0) {
        toast({
          title: "Import successful",
          description: `Successfully created ${createdCount} lead(s).`,
        });
      } else {
        toast({
          title: "Upload completed",
          description:
            "No leads were created. Check column layout and try again, or see server messages.",
          variant: "default",
        });
      }

      await refreshLeadStreamStatus();
      setSelectedLeadFile(null);
      setShowLeadUpload(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload file. Please try again.";
      const parsedMessage = parseErrorMessage(errorMessage);

      toast({
        title: "Upload failed",
        description: parsedMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploadingLeads(false);
    }
  };

  return {
    // State values
    leadStreamFiles,
    leadStreamStatusLoading: leadStreamStatusLoading || isLeadStreamQueryLoading,
    isUploadingLeads,
    deletingLeadStreamFileId,
    showLeadUpload,
    selectedLeadFile,
    isDraggingLead,

    // Refs
    leadFileInputRef,

    // Setters
    setShowLeadUpload,
    setSelectedLeadFile,

    // Handlers
    refreshLeadStreamStatus,
    handleDeleteLeadStream,
    handleLeadFileSelect,
    handleLeadFileInputChange,
    handleLeadDragOver,
    handleLeadDragLeave,
    handleLeadDrop,
    handleConnectToCRM,
    handleUploadLeadCsv,
  };
}
