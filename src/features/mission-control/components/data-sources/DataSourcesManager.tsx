import { Database, Building2, Users } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";

import type { DataSource, DataSourceType } from "../../types";

import AddDataSourceMenu from "./AddDataSourceMenu";
import ConnectorTable from "./ConnectorTable";
import { rememberDismissedDataSource } from "./dataSourceDismissals";
import { extractFileIdFromFileKey } from "./dataSourceHelpers";
import DataSourceUploader from "./DataSourceUploader";
import LeadStreamTable from "./LeadStreamTable";
import SourceForm from "./SourceForm";
import { useDataSourceForm } from "./useDataSourceForm";
import { useDocumentSync } from "./useDocumentSync";
import { useLeadStream } from "./useLeadStream";

import { useToast } from "@/components/ui/use-toast";
import { ApolloTile } from "@/features/connectors";
import { buildApiUrl } from "@/shared/api/transport";
import { useAuthToken } from "@/shared/auth";
import jwtManager from "@/shared/auth/jwt";

interface CompanyProfile {
  companyName?: string;
  companyUrl?: string;
}

const DataSourcesManager: React.FC = () => {
  const { toast } = useToast();
  const { currentUser, orgId } = useAuthToken();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  // Load company profile from localStorage
  useEffect(() => {
    const loadCompanyProfile = () => {
      if (!currentUser?.uid) return;

      const storageKey = `company_profile_${currentUser.uid}`;
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCompanyProfile({
            companyName: parsed.companyName || "",
            companyUrl: parsed.companyUrl || "",
          });
        } catch (e) {
          console.error("Failed to parse company profile:", e);
          setCompanyProfile(null);
        }
      } else {
        setCompanyProfile(null);
      }
    };

    loadCompanyProfile();

    // Listen for company profile updates
    const handleProfileUpdate = () => loadCompanyProfile();
    window.addEventListener("companyProfileUpdated", handleProfileUpdate);

    return () => {
      window.removeEventListener("companyProfileUpdated", handleProfileUpdate);
    };
  }, [currentUser?.uid]);

  // Helpers for auth + backend integration
  const getAuthHeader = useCallback(async () => {
    try {
      return await jwtManager.getAuthHeader();
    } catch (error) {
      console.warn("DataSourcesManager: No auth header available", error);
      return "";
    }
  }, []);

  // Backend-document read/sync/merge concern — dataSources/isLoading/isSaving state,
  // the useDataSources read, the mapping/merge of backend documents into state, the
  // query→state sync effects, loadDataSourcesFromBackend, and the status helpers.
  const {
    dataSources,
    setDataSources,
    isLoading,
    setIsSaving,
    checkProcessingFilesStatus,
    loadDataSourcesFromBackend,
  } = useDocumentSync({ orgIdToUse, currentUser, getAuthHeader });

  // Upload file to backend (stores in S3 via backend)
  const uploadFileToBackend = async (
    file: File,
    tags?: string[],
    description?: string,
  ): Promise<void> => {
    if (!currentUser?.uid) {
      throw new Error("User not authenticated");
    }

    // Use org_id fetched from login API, fallback to 'brewra' for backward compatibility
    const orgIdToUse = orgId || "brewra";

    const authHeader = await getAuthHeader();
    const url = buildApiUrl("upload-document");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", currentUser.uid);
    formData.append("org_id", orgIdToUse);

    // Add optional fields if provided
    // Backend accepts either comma-separated string or JSON array string
    // Using comma-separated string as it's more standard for form data
    if (tags && tags.length > 0) {
      formData.append("tags", tags.join(","));
    }
    if (description && description.trim()) {
      formData.append("description", description.trim());
    }

    console.log("📤 DataSourcesManager - Uploading file:", {
      url,
      fileName: file.name,
      userId: currentUser.uid,
      orgId: orgIdToUse,
      tags: tags && tags.length > 0 ? tags : "none",
      description: description || "none",
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
      const errorText = await response.text();
      console.error("❌ DataSourcesManager - Upload error:", {
        status: response.status,
        errorText,
        url,
      });
      throw new Error(`Failed to upload file: ${response.status} - ${errorText}`);
    }

    console.log("✅ DataSourcesManager - Upload success");
    // Upload successful - file_key will be retrieved from /api/v2/user-documents
    return;
  };

  // Upload URL to backend
  const uploadUrlToBackend = async (
    url: string,
    name: string,
    tags?: string[],
    description?: string,
  ): Promise<void> => {
    if (!currentUser?.uid) {
      throw new Error("User not authenticated");
    }

    // Use org_id fetched from login API, fallback to 'brewra' for backward compatibility
    const orgIdToUse = orgId || "brewra";

    const authHeader = await getAuthHeader();
    const apiUrl = buildApiUrl("upload-document");

    const formData = new FormData();
    formData.append("url", url);
    formData.append("name", name);
    formData.append("user_id", currentUser.uid);
    formData.append("org_id", orgIdToUse);

    // Add optional fields if provided
    if (tags && tags.length > 0) {
      formData.append("tags", tags.join(","));
    }
    if (description && description.trim()) {
      formData.append("description", description.trim());
    }

    console.log("📤 DataSourcesManager - Uploading URL:", {
      apiUrl,
      url,
      name,
      userId: currentUser.uid,
      orgId: orgIdToUse,
      tags: tags && tags.length > 0 ? tags : "none",
      description: description || "none",
      hasAuth: !!authHeader,
    });

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        ...(authHeader && { Authorization: authHeader }),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ DataSourcesManager - URL upload error:", {
        status: response.status,
        errorText,
        apiUrl,
      });
      throw new Error(`Failed to upload URL: ${response.status} - ${errorText}`);
    }

    console.log("✅ DataSourcesManager - URL upload success");
    // Upload successful - will be retrieved from /api/v2/user-documents
    return;
  };

  // Lead stream concern — files, upload flow, polling, delete
  const {
    leadStreamFiles,
    leadStreamStatusLoading,
    isUploadingLeads,
    deletingLeadStreamFileId,
    showLeadUpload,
    selectedLeadFile,
    isDraggingLead,
    leadFileInputRef,
    setShowLeadUpload,
    setSelectedLeadFile,
    refreshLeadStreamStatus: _refreshLeadStreamStatus,
    handleDeleteLeadStream,
    handleLeadFileSelect: _handleLeadFileSelect,
    handleLeadFileInputChange,
    handleLeadDragOver,
    handleLeadDragLeave,
    handleLeadDrop,
    handleConnectToCRM,
    handleUploadLeadCsv,
  } = useLeadStream({ currentUser, orgIdToUse, getAuthHeader, toast });

  // Form concern — inline add/edit state, refs, and handlers
  const {
    isAddingInline,
    selectedType,
    sourceName,
    sourceUrl,
    selectedFile,
    existingFileName,
    selectedTags,
    customTag,
    sourceDescription,
    editingId,
    canSave,
    fileInputRef,
    formCardRef,
    setSelectedType,
    setSourceName,
    setSourceUrl,
    setCustomTag,
    setSourceDescription,
    resetInlineForm,
    handleStartAdd,
    handleCancelInline,
    handleTypeSelect,
    handleFileChange,
    handleTagToggle,
    handleAddCustomTag,
    handleCustomTagKeyDown,
    handleEditSource,
  } = useDataSourceForm(dataSources);

  const handleSaveSource = async () => {
    if (!sourceName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a source name.",
        variant: "destructive",
      });
      return;
    }

    if (selectedType === "url" && !sourceUrl.trim() && !editingId) {
      toast({
        title: "URL required",
        description: "Please enter a website URL.",
        variant: "destructive",
      });
      return;
    }

    // For file type, only require file if it's a new source (not editing)
    if (selectedType === "file" && !selectedFile && !editingId) {
      toast({
        title: "File required",
        description: "Please upload a file.",
        variant: "destructive",
      });
      return;
    }

    let updateSuccess = false;
    try {
      setIsSaving(true);

      if (selectedType === "file") {
        // If editing and a new file is selected, upload it
        if (selectedFile) {
          // Store metadata (name, description, tags) to apply after reload
          const isEditing = !!editingId;
          const uploadMetadata = {
            name: sourceName.trim(),
            description: sourceDescription.trim() || undefined,
            tags: selectedTags,
            fileName: selectedFile.name, // Store original file name to help identify the file after reload
            oldId: isEditing ? editingId! : null,
          };

          // If editing, get the old file's fileId to delete it after uploading the new one
          let oldFileId: string | undefined = undefined;
          if (isEditing && editingId) {
            const existingSource = dataSources.find((s) => s.id === editingId);
            if (existingSource && existingSource.type === "file") {
              oldFileId = existingSource.fileId || extractFileIdFromFileKey(existingSource.id);
              // Validate oldFileId is a UUID
              const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              if (!oldFileId || !uuidPattern.test(oldFileId)) {
                // Try extracting again
                if (existingSource.fileId) {
                  oldFileId = extractFileIdFromFileKey(existingSource.fileId);
                }
                if (!oldFileId || !uuidPattern.test(oldFileId)) {
                  console.warn(
                    "⚠️ DataSourcesManager - Could not extract valid oldFileId for deletion:",
                    {
                      existingSourceId: existingSource.id,
                      existingFileId: existingSource.fileId,
                    },
                  );
                  oldFileId = undefined; // Will skip deletion if we can't get valid fileId
                }
              }
            }
          }

          // Capture current file IDs and fileIds before any state changes (for identifying new file after reload)
          const fileIdsBeforeReload = dataSources.filter((s) => s.type === "file").map((s) => s.id);
          const fileFileIdsBeforeReload = dataSources
            .filter((s) => s.type === "file" && s.fileId)
            .map((s) => s.fileId!);

          // Upload new file to backend (stored in S3)
          await uploadFileToBackend(
            selectedFile,
            selectedTags,
            sourceDescription.trim() || undefined,
          );

          // If editing, delete the old file from backend to prevent duplicates
          if (isEditing && oldFileId) {
            try {
              console.log(
                "🗑️ DataSourcesManager - Deleting old file after uploading replacement:",
                {
                  oldFileId,
                  oldId: editingId,
                },
              );

              const authHeader = await getAuthHeader();
              const deleteUrl = buildApiUrl(`data-source/${oldFileId}`);

              const deleteResponse = await fetch(deleteUrl, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  accept: "application/json",
                  ...(authHeader && { Authorization: authHeader }),
                },
              });

              if (!deleteResponse.ok) {
                const errorText = await deleteResponse.text();
                console.warn("⚠️ DataSourcesManager - Failed to delete old file (non-critical):", {
                  status: deleteResponse.status,
                  errorText,
                  oldFileId,
                });
                // Don't throw - continue with the update even if old file deletion fails
              } else {
                console.log("✅ DataSourcesManager - Old file deleted successfully");
              }
            } catch (deleteError) {
              console.error(
                "❌ DataSourcesManager - Error deleting old file (non-critical):",
                deleteError,
              );
              // Don't throw - continue with the update even if old file deletion fails
            }
          }

          toast({
            title: isEditing ? "File updated" : "File uploaded",
            description: isEditing
              ? `${sourceName} has been updated.`
              : `${sourceName} is being processed.`,
          });
          updateSuccess = true;

          // Notify MissionControl that a data source was added/updated
          if (!isEditing) {
            window.dispatchEvent(new CustomEvent("dataSourceAdded"));
          }

          // Reload documents from backend to get the new file_key
          // Then apply the custom name, tags, and description to the newly uploaded file
          setTimeout(() => {
            void (async () => {
              try {
                console.log(
                  "🔄 DataSourcesManager - Reloading after upload, applying metadata:",
                  uploadMetadata,
                );
                await loadDataSourcesFromBackend();

                // Apply metadata to the newly uploaded file
                setDataSources((prev) => {
                  console.log(
                    "📋 DataSourcesManager - Current data sources before metadata application:",
                    prev.length,
                  );
                  console.log(
                    "📋 DataSourcesManager - File IDs before reload:",
                    fileIdsBeforeReload,
                  );

                  if (isEditing && uploadMetadata.oldId) {
                    // If editing, remove the old entry by both ID and fileId (in case old file still exists in backend)
                    // Get old fileId from the closure (captured before state changes)
                    const oldFileIdToExclude = oldFileId;

                    const withoutOldEntry = prev.filter((s) => {
                      // Exclude by ID
                      if (s.id === uploadMetadata.oldId) return false;
                      // Also exclude by fileId if it matches the old file's fileId
                      if (oldFileIdToExclude && s.fileId === oldFileIdToExclude) {
                        console.log("🗑️ DataSourcesManager - Excluding old file by fileId:", {
                          oldFileId: oldFileIdToExclude,
                          excludedId: s.id,
                        });
                        return false;
                      }
                      return true;
                    });

                    // Find the new file (the one that wasn't in the list before) and apply metadata
                    // Match by both ID and fileId to be sure
                    const updated = withoutOldEntry.map((s) => {
                      const isNewFile =
                        s.type === "file" &&
                        !fileIdsBeforeReload.includes(s.id) &&
                        (!s.fileId || !fileFileIdsBeforeReload.includes(s.fileId));

                      if (isNewFile) {
                        // This is the newly uploaded file - apply all metadata and update the ID to match old entry
                        console.log("✅ DataSourcesManager - Applying metadata to edited file:", {
                          newId: s.id,
                          oldId: uploadMetadata.oldId,
                          oldName: s.name,
                          newName: uploadMetadata.name,
                          oldTags: s.tags,
                          newTags: uploadMetadata.tags,
                          oldDescription: s.description,
                          newDescription: uploadMetadata.description,
                        });
                        return {
                          ...s,
                          id: uploadMetadata.oldId!, // Keep the old ID to maintain reference (replaces old entry)
                          name: uploadMetadata.name,
                          description: uploadMetadata.description,
                          tags: uploadMetadata.tags,
                        };
                      }
                      return s;
                    });

                    console.log(
                      "✅ DataSourcesManager - Metadata applied to edited file, old entry replaced",
                    );
                    return updated;
                  } else {
                    // For new uploads, find the file that wasn't in the list before
                    // Match by file name to identify the newly uploaded file
                    const newFiles = prev.filter(
                      (s) =>
                        s.type === "file" &&
                        !fileIdsBeforeReload.includes(s.id) &&
                        (s.fileName === uploadMetadata.fileName ||
                          s.name === uploadMetadata.fileName),
                    );

                    console.log(
                      "🔍 DataSourcesManager - New files found:",
                      newFiles.length,
                      newFiles.map((f) => ({ id: f.id, fileName: f.fileName, name: f.name })),
                    );

                    if (newFiles.length > 0) {
                      // Apply metadata to the most recently uploaded file (should be the last one)
                      const fileToUpdate = newFiles[newFiles.length - 1];
                      console.log("✅ DataSourcesManager - Applying metadata to new file:", {
                        id: fileToUpdate.id,
                        fileName: fileToUpdate.fileName,
                        oldName: fileToUpdate.name,
                        newName: uploadMetadata.name,
                        oldTags: fileToUpdate.tags,
                        newTags: uploadMetadata.tags,
                        oldDescription: fileToUpdate.description,
                        newDescription: uploadMetadata.description,
                      });
                      return prev.map((s) => {
                        if (s.id === fileToUpdate.id) {
                          return {
                            ...s,
                            name: uploadMetadata.name,
                            description: uploadMetadata.description,
                            tags: uploadMetadata.tags,
                          };
                        }
                        return s;
                      });
                    } else {
                      console.warn(
                        "⚠️ DataSourcesManager - No new file found to apply metadata to",
                      );
                    }
                  }
                  return prev;
                });

                // Poll status for processing files after a delay
                setTimeout(() => {
                  void checkProcessingFilesStatus();
                }, 2000);
              } catch (err) {
                console.error("Error reloading documents after upload:", err);
              }
            })();
          }, 1000);
        } else if (editingId) {
          // Editing existing file source - update metadata via PUT API
          // IMPORTANT: We are EDITING, not creating a new entry
          console.log(
            "📝 DataSourcesManager - Editing existing source (not creating new):",
            editingId,
          );

          // Find the existing source to preserve its ID and other properties
          const existingSource = dataSources.find((s) => s.id === editingId);
          if (!existingSource) {
            console.error("❌ DataSourcesManager - Source not found for editing:", editingId);
            toast({
              title: "Error",
              description: "Source not found.",
              variant: "destructive",
            });
            setIsSaving(false);
            return;
          }

          // Get fileId for the PUT request
          let fileId = existingSource.fileId || extractFileIdFromFileKey(existingSource.id);

          // Validate that fileId is a UUID
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!fileId || !uuidPattern.test(fileId)) {
            // If fileId is not a valid UUID, try extracting again
            if (existingSource.fileId) {
              fileId = extractFileIdFromFileKey(existingSource.fileId);
            }
            if (!fileId || !uuidPattern.test(fileId)) {
              toast({
                title: "Error",
                description: "Unable to determine file ID for update.",
                variant: "destructive",
              });
              return;
            }
          }

          try {
            // Call PUT API to update the data source
            const authHeader = await getAuthHeader();
            const url = buildApiUrl(`data-source/${fileId}`);

            const updatePayload = {
              user_id: currentUser?.uid,
              org_id: orgIdToUse,
              tags: selectedTags,
              description: sourceDescription.trim() || undefined,
            };

            console.log("📝 DataSourcesManager - Updating data source:", {
              url,
              fileId,
              payload: updatePayload,
              hasAuth: !!authHeader,
            });

            const response = await fetch(url, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                accept: "application/json",
                ...(authHeader && { Authorization: authHeader }),
              },
              body: JSON.stringify(updatePayload),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error("❌ DataSourcesManager - Update error:", {
                status: response.status,
                errorText,
                fileId,
                url,
              });
              throw new Error(`Failed to update data source: ${response.status} - ${errorText}`);
            }

            console.log("✅ DataSourcesManager - Update success");

            // Update local state after successful API call
            // Update the existing entry in place - do NOT add a new entry
            setDataSources((prev) => {
              // First, find the existing entry to ensure it exists
              const existingSourceIndex = prev.findIndex((s) => s.id === editingId);

              if (existingSourceIndex === -1) {
                console.error(
                  "❌ DataSourcesManager - Could not find source to update:",
                  editingId,
                );
                // Return previous state unchanged if source not found
                return prev;
              }

              // Create a new array with the updated entry
              const updated = [...prev];
              const existingSource = updated[existingSourceIndex];

              // Update only the existing entry - replace it in place
              updated[existingSourceIndex] = {
                ...existingSource,
                name: sourceName.trim(),
                description: sourceDescription.trim() || undefined,
                tags: selectedTags,
              };

              // Ensure no duplicates by ID - this is a safety check
              const uniqueMap = new Map<string, DataSource>();
              updated.forEach((source) => {
                // If we already have this ID, keep the one we just updated (if it's the one we're editing)
                if (uniqueMap.has(source.id)) {
                  if (source.id === editingId) {
                    // Replace with our updated version
                    uniqueMap.set(source.id, source);
                  }
                  // Otherwise, keep the existing one in the map
                } else {
                  uniqueMap.set(source.id, source);
                }
              });

              const unique = Array.from(uniqueMap.values());

              console.log("📝 DataSourcesManager - State update:", {
                beforeCount: prev.length,
                afterCount: unique.length,
                updatedId: editingId,
                updatedName: sourceName.trim(),
                foundAtIndex: existingSourceIndex,
              });

              // Verify we didn't accidentally add a new entry
              if (unique.length > prev.length) {
                console.warn(
                  "⚠️ DataSourcesManager - Warning: Entry count increased after update! This should not happen.",
                );
              }

              return unique;
            });

            toast({
              title: "Source updated",
              description: `${sourceName} has been updated.`,
            });
            updateSuccess = true;

            // Reload from backend after a short delay to ensure state is synced
            // This ensures that after refresh, the updated data is properly matched
            setTimeout(() => {
              void (async () => {
                try {
                  console.log("🔄 DataSourcesManager - Reloading after PUT update to sync state");
                  await loadDataSourcesFromBackend();
                } catch (err) {
                  console.error("Error reloading after update:", err);
                  // Don't show error to user - local state is already updated
                }
              })();
            }, 500);
          } catch (error) {
            console.error("Error updating data source:", error);
            toast({
              title: "Update failed",
              description:
                error instanceof Error
                  ? error.message
                  : "Could not update data source. Please try again.",
              variant: "destructive",
            });
            // Don't throw - return early to prevent form reset on error
            setIsSaving(false);
            return;
          }
        }
      } else if (selectedType === "url") {
        // URL sources - use API
        const isEditing = !!editingId;

        if (isEditing) {
          // Editing existing URL source - update metadata via PUT API
          console.log(
            "📝 DataSourcesManager - Editing existing URL source (not creating new):",
            editingId,
          );

          // Find the existing source to preserve its ID and other properties
          const existingSource = dataSources.find((s) => s.id === editingId);
          if (!existingSource) {
            console.error("❌ DataSourcesManager - URL source not found for editing:", editingId);
            toast({
              title: "Error",
              description: "Source not found.",
              variant: "destructive",
            });
            setIsSaving(false);
            return;
          }

          // Get fileId for the PUT request - use fileId or fall back to id (which should be file_id for URLs)
          let fileId = existingSource.fileId;

          // Validate that fileId is a UUID
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!fileId || !uuidPattern.test(fileId)) {
            // For URLs loaded from backend, the id should be the file_id
            if (uuidPattern.test(editingId)) {
              fileId = editingId;
              console.log("📋 DataSourcesManager - Using URL id as fileId for edit:", fileId);
            } else {
              console.error("❌ DataSourcesManager - No valid fileId found for URL edit:", {
                editingId,
                storedFileId: existingSource.fileId,
                source: existingSource,
              });
              toast({
                title: "Error",
                description:
                  "Unable to determine URL file_id for update. URL may not have been saved to backend.",
                variant: "destructive",
              });
              setIsSaving(false);
              return;
            }
          }

          try {
            // Call PUT API to update the URL data source
            const authHeader = await getAuthHeader();
            const url = buildApiUrl(`data-source/${fileId}?org_id=${orgIdToUse}`);

            // Always use the form value, don't fall back to existing URL
            // This ensures the backend receives the updated value even if it's empty
            const updatePayload = {
              user_id: currentUser?.uid,
              org_id: orgIdToUse,
              name: sourceName.trim(),
              url: sourceUrl.trim(), // Send the form value directly, no fallback
              tags: selectedTags,
              description: sourceDescription.trim() || undefined,
            };

            console.log("📝 DataSourcesManager - Updating URL data source:", {
              requestUrl: url,
              fileId,
              payload: updatePayload,
              payloadStringified: JSON.stringify(updatePayload),
              formUrl: sourceUrl,
              trimmedUrl: sourceUrl.trim(),
              existingUrl: existingSource.url,
              hasAuth: !!authHeader,
            });

            const response = await fetch(url, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                accept: "application/json",
                ...(authHeader && { Authorization: authHeader }),
              },
              body: JSON.stringify(updatePayload),
            });

            // Log the raw response for debugging
            const responseClone = response.clone();
            responseClone
              .text()
              .then((text) => {
                console.log("📥 DataSourcesManager - PUT Response (raw):", {
                  status: response.status,
                  statusText: response.statusText,
                  headers: Object.fromEntries(response.headers.entries()),
                  body: text,
                });
              })
              .catch((err) => {
                console.error("Error reading response:", err);
              });

            if (!response.ok) {
              const errorText = await response.text();
              console.error("❌ DataSourcesManager - URL update error:", {
                status: response.status,
                errorText,
                fileId,
                url,
              });
              throw new Error(
                `Failed to update URL data source: ${response.status} - ${errorText}`,
              );
            }

            // Try to get the updated data from the response
            // Backend might return data in different structures: { data: {...} }, { dataSource: {...} }, or directly
            let updatedDataFromBackend = null;
            try {
              const responseData = await response.json();
              // Handle different response structures
              updatedDataFromBackend =
                responseData.data ||
                responseData.dataSource ||
                responseData.document ||
                responseData;
              console.log("✅ DataSourcesManager - URL update success, response data:", {
                rawResponse: responseData,
                extractedData: updatedDataFromBackend,
                responseUrl:
                  updatedDataFromBackend?.url ||
                  updatedDataFromBackend?.source_url ||
                  updatedDataFromBackend?.file_url,
                sentUrl: updatePayload.url,
                urlMatches:
                  (updatedDataFromBackend?.url ||
                    updatedDataFromBackend?.source_url ||
                    updatedDataFromBackend?.file_url) === updatePayload.url,
                allUrlFields: {
                  url: updatedDataFromBackend?.url,
                  source_url: updatedDataFromBackend?.source_url,
                  file_url: updatedDataFromBackend?.file_url,
                  website_url: updatedDataFromBackend?.website_url,
                },
              });

              // Warn if the URL in response doesn't match what we sent
              const responseUrl =
                updatedDataFromBackend?.url ||
                updatedDataFromBackend?.source_url ||
                updatedDataFromBackend?.file_url;
              if (responseUrl && responseUrl !== updatePayload.url) {
                console.warn("⚠️ DataSourcesManager - URL mismatch detected!", {
                  sent: updatePayload.url,
                  received: responseUrl,
                  message:
                    "Backend returned a different URL than what was sent. This may indicate a backend issue.",
                });
              }
            } catch (_e) {
              // Response might not be JSON, that's okay
              console.log(
                "✅ DataSourcesManager - URL update success (no response body or not JSON)",
              );
            }

            // Update local state after successful API call
            // Update the existing entry in place - do NOT add a new entry
            setDataSources((prev) => {
              // First, find the existing entry to ensure it exists
              const existingSourceIndex = prev.findIndex((s) => s.id === editingId);

              if (existingSourceIndex === -1) {
                console.error(
                  "❌ DataSourcesManager - Could not find URL source to update:",
                  editingId,
                );
                // Return previous state unchanged if source not found
                return prev;
              }

              // Create a new array with the updated entry
              const updated = [...prev];
              const existingSource = updated[existingSourceIndex];

              // Use response data if available (most reliable), otherwise use form values
              // For URL: prefer response data, then form value, never fall back to old value
              const responseUrl =
                updatedDataFromBackend?.url ||
                updatedDataFromBackend?.source_url ||
                updatedDataFromBackend?.file_url;
              const finalUrl = responseUrl !== undefined ? responseUrl : sourceUrl.trim(); // Use form value directly, no fallback to old value

              console.log("📝 DataSourcesManager - Updating local state with URL:", {
                responseUrl,
                formUrl: sourceUrl.trim(),
                existingUrl: existingSource.url,
                finalUrl,
                responseData: updatedDataFromBackend,
              });

              // Update only the existing entry - replace it in place
              updated[existingSourceIndex] = {
                ...existingSource,
                name: updatedDataFromBackend?.name || sourceName.trim(),
                url: finalUrl, // Use the determined final URL
                description:
                  updatedDataFromBackend?.description !== undefined
                    ? updatedDataFromBackend.description
                    : sourceDescription.trim() || undefined,
                tags: updatedDataFromBackend?.tags || selectedTags,
              };

              // Ensure no duplicates by ID - this is a safety check
              const uniqueMap = new Map<string, DataSource>();
              updated.forEach((source) => {
                // If we already have this ID, keep the one we just updated (if it's the one we're editing)
                if (uniqueMap.has(source.id)) {
                  if (source.id === editingId) {
                    // Replace with our updated version
                    uniqueMap.set(source.id, source);
                  }
                  // Otherwise, keep the existing one in the map
                } else {
                  uniqueMap.set(source.id, source);
                }
              });

              const unique = Array.from(uniqueMap.values());

              console.log("📝 DataSourcesManager - URL state update:", {
                beforeCount: prev.length,
                afterCount: unique.length,
                updatedId: editingId,
                updatedName: sourceName.trim(),
                foundAtIndex: existingSourceIndex,
              });

              // Verify we didn't accidentally add a new entry
              if (unique.length > prev.length) {
                console.warn(
                  "⚠️ DataSourcesManager - Warning: Entry count increased after URL update! This should not happen.",
                );
              }

              return unique;
            });

            toast({
              title: "Source updated",
              description: `${sourceName} has been updated.`,
            });
            updateSuccess = true;

            // Reload from backend after a short delay to ensure state is synced
            setTimeout(() => {
              void (async () => {
                try {
                  console.log("🔄 DataSourcesManager - Reloading after PUT update to sync state");
                  await loadDataSourcesFromBackend();
                } catch (err) {
                  console.error("Error reloading after URL update:", err);
                  // Don't show error to user - local state is already updated
                }
              })();
            }, 500);
          } catch (error) {
            console.error("Error updating URL data source:", error);
            toast({
              title: "Update failed",
              description:
                error instanceof Error
                  ? error.message
                  : "Could not update URL data source. Please try again.",
              variant: "destructive",
            });
            // Don't throw - return early to prevent form reset on error
            setIsSaving(false);
            return;
          }
        } else {
          // New URL - upload via API
          const uploadMetadata = {
            name: sourceName.trim(),
            url: sourceUrl.trim(),
            description: sourceDescription.trim() || undefined,
            tags: selectedTags,
          };

          // Capture current URL IDs before any state changes
          const urlIdsBeforeReload = dataSources.filter((s) => s.type === "url").map((s) => s.id);
          const urlFileIdsBeforeReload = dataSources
            .filter((s) => s.type === "url" && s.fileId)
            .map((s) => s.fileId!);

          // Upload URL to backend
          await uploadUrlToBackend(
            sourceUrl.trim(),
            sourceName.trim(),
            selectedTags,
            sourceDescription.trim() || undefined,
          );

          toast({
            title: "URL added",
            description: `${sourceName} is being processed.`,
          });
          updateSuccess = true;

          // Notify MissionControl that a data source was added
          window.dispatchEvent(new CustomEvent("dataSourceAdded"));

          // Reload documents from backend to get the new URL entry
          // Then apply the custom name, tags, and description to the newly uploaded URL
          setTimeout(() => {
            void (async () => {
              try {
                console.log(
                  "🔄 DataSourcesManager - Reloading after URL upload, applying metadata:",
                  uploadMetadata,
                );
                await loadDataSourcesFromBackend();

                // Apply metadata to the newly uploaded URL
                setDataSources((prev) => {
                  console.log(
                    "📋 DataSourcesManager - Current data sources before URL metadata application:",
                    prev.length,
                  );
                  console.log("📋 DataSourcesManager - URL IDs before reload:", urlIdsBeforeReload);
                  console.log(
                    "📋 DataSourcesManager - All URLs in current state:",
                    prev
                      .filter((s) => s.type === "url")
                      .map((u) => ({ id: u.id, fileId: u.fileId, name: u.name, url: u.url })),
                  );

                  // For new uploads, find the URL that wasn't in the list before
                  // Match by fileId first (most reliable), then by URL if available, then by name
                  const newUrls = prev.filter((s) => {
                    if (s.type !== "url") return false;

                    // Check if it's a new URL by ID
                    const isNewById = !urlIdsBeforeReload.includes(s.id);

                    // Check if it's a new URL by fileId
                    const isNewByFileId = !s.fileId || !urlFileIdsBeforeReload.includes(s.fileId);

                    // Match by URL if available, otherwise match by name (since backend might not return URL)
                    const urlMatches = s.url ? s.url === uploadMetadata.url : true;
                    const nameMatches =
                      s.name === uploadMetadata.name || !s.name || s.name === "URL Source";

                    return isNewById && isNewByFileId && (urlMatches || nameMatches);
                  });

                  console.log(
                    "🔍 DataSourcesManager - New URLs found:",
                    newUrls.length,
                    newUrls.map((u) => ({ id: u.id, fileId: u.fileId, url: u.url, name: u.name })),
                  );

                  if (newUrls.length > 0) {
                    // Apply metadata to the most recently uploaded URL (should be the last one)
                    const urlToUpdate = newUrls[newUrls.length - 1];
                    console.log("✅ DataSourcesManager - Applying metadata to new URL:", {
                      id: urlToUpdate.id,
                      url: urlToUpdate.url,
                      oldName: urlToUpdate.name,
                      newName: uploadMetadata.name,
                      oldTags: urlToUpdate.tags,
                      newTags: uploadMetadata.tags,
                      oldDescription: urlToUpdate.description,
                      newDescription: uploadMetadata.description,
                    });
                    return prev.map((s) => {
                      if (s.id === urlToUpdate.id) {
                        return {
                          ...s,
                          name: uploadMetadata.name,
                          url: uploadMetadata.url || s.url || "",
                          description: uploadMetadata.description,
                          tags: uploadMetadata.tags,
                        };
                      }
                      return s;
                    });
                  } else {
                    console.warn("⚠️ DataSourcesManager - No new URL found to apply metadata to");
                  }
                  return prev;
                });
              } catch (err) {
                console.error("Error reloading documents after URL upload:", err);
              }
            })();
          }, 1000);
        }
      } else {
        // Other types (system) - stored locally only
        const newSource: DataSource = {
          id: editingId || `source-${Date.now()}`,
          type: selectedType as DataSourceType,
          name: sourceName.trim(),
          url: undefined,
          description: sourceDescription.trim() || undefined,
          tags: selectedTags,
          status: "active",
          createdAt: editingId
            ? dataSources.find((s) => s.id === editingId)?.createdAt || new Date()
            : new Date(),
        };

        setDataSources((prev) => {
          if (editingId) {
            return prev.map((s) => (s.id === editingId ? newSource : s));
          }
          return [...prev, newSource];
        });

        toast({
          title: editingId ? "Source updated" : "Source added",
          description: `${sourceName} ${editingId ? "has been updated" : "saved locally"}.`,
        });
        updateSuccess = true;
      }
    } catch (error) {
      console.error("Error saving data source:", error);
      toast({
        title: "Upload failed",
        description:
          error instanceof Error ? error.message : "Could not upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      // Only reset form if operation was successful
      if (updateSuccess || !editingId) {
        resetInlineForm();
      }
    }
  };

  const rememberRemovedSource = (source: DataSource) => {
    if (currentUser?.uid) {
      rememberDismissedDataSource(currentUser.uid, source);
    }
  };

  const handleDeleteSource = async (id: string) => {
    // Find the source to delete
    const sourceToDelete = dataSources.find((s) => s.id === id);
    if (!sourceToDelete) {
      toast({
        title: "Error",
        description: "Source not found.",
        variant: "destructive",
      });
      return;
    }

    // For file sources, delete from backend
    if (sourceToDelete.type === "file") {
      try {
        const authHeader = await getAuthHeader();
        // Use the stored fileId if available, otherwise extract from file_key
        let fileId = sourceToDelete.fileId || extractFileIdFromFileKey(id);

        // Validate that fileId is a UUID, not a full path
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(fileId)) {
          // If fileId is not a UUID, try extracting again from the id (file_key)
          console.warn(
            "⚠️ DataSourcesManager - fileId is not a valid UUID, re-extracting from id:",
            {
              fileId,
              id,
              storedFileId: sourceToDelete.fileId,
            },
          );
          fileId = extractFileIdFromFileKey(id);

          // If still not a UUID, try extracting from the stored fileId if it exists
          if (!uuidPattern.test(fileId) && sourceToDelete.fileId) {
            fileId = extractFileIdFromFileKey(sourceToDelete.fileId);
          }
        }

        console.log("🗑️ DataSourcesManager - Delete file_id resolution:", {
          sourceId: id,
          storedFileId: sourceToDelete.fileId,
          resolvedFileId: fileId,
          isValidUUID: uuidPattern.test(fileId),
          sourceToDelete: sourceToDelete,
        });

        if (!fileId) {
          throw new Error("Unable to determine file_id for deletion");
        }

        // Final validation - ensure we have a UUID before making the API call
        if (!uuidPattern.test(fileId)) {
          throw new Error(`Invalid file_id format: ${fileId}. Expected UUID format.`);
        }

        // Use singular form /data-source/ to match backend API route
        const url = buildApiUrl(`data-source/${fileId}`);

        console.log("🗑️ DataSourcesManager - Deleting data source:", {
          url,
          fileId,
          sourceId: id,
          hasAuth: !!authHeader,
        });

        const response = await fetch(url, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
            ...(authHeader && { Authorization: authHeader }),
          },
        });

        console.log("📨 DataSourcesManager - Delete response:", {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          ok: response.ok,
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 404) {
            rememberRemovedSource(sourceToDelete);
            setDataSources((prev) => prev.filter((s) => s.id !== id));
            toast({
              title: "Source removed",
              description:
                "This file was no longer on the server and has been cleared from your list.",
            });
            return;
          }
          console.error("❌ DataSourcesManager - Delete error:", {
            status: response.status,
            errorText,
            fileId,
            url,
          });
          throw new Error(`Failed to delete data source: ${response.status} - ${errorText}`);
        }

        // Remove from local state after successful backend deletion
        rememberRemovedSource(sourceToDelete);
        const updatedSources = dataSources.filter((s) => s.id !== id);
        setDataSources(updatedSources);

        console.log("✅ DataSourcesManager - Delete success");
        toast({
          title: "Source deleted",
          description: "The data source has been removed.",
        });
      } catch (error) {
        console.error("Error deleting data source:", error);
        toast({
          title: "Delete failed",
          description:
            error instanceof Error
              ? error.message
              : "Could not delete data source. Please try again.",
          variant: "destructive",
        });
      }
    } else if (sourceToDelete.type === "url") {
      // For URL sources, delete from backend
      try {
        const authHeader = await getAuthHeader();
        // Use the stored fileId - this should be the file_id from backend
        let fileId = sourceToDelete.fileId;

        // Validate that fileId is a UUID
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        // If fileId is not valid, try using the id (which should be file_id for URLs)
        if (!fileId || !uuidPattern.test(fileId)) {
          // For URLs loaded from backend, the id should be the file_id
          if (uuidPattern.test(id)) {
            fileId = id;
            console.log("📋 DataSourcesManager - Using URL id as fileId:", fileId);
          } else {
            console.error("❌ DataSourcesManager - No valid fileId found for URL deletion:", {
              sourceId: id,
              storedFileId: sourceToDelete.fileId,
              source: sourceToDelete,
            });
            throw new Error(
              "Unable to determine URL file_id for deletion. URL may not have been saved to backend.",
            );
          }
        }

        console.log("🗑️ DataSourcesManager - Delete URL file_id resolution:", {
          sourceId: id,
          storedFileId: sourceToDelete.fileId,
          resolvedFileId: fileId,
          isValidUUID: uuidPattern.test(fileId),
          sourceToDelete: sourceToDelete,
        });

        if (!fileId) {
          throw new Error("Unable to determine URL file_id for deletion");
        }

        // Final validation - ensure we have a UUID before making the API call
        if (!uuidPattern.test(fileId)) {
          throw new Error(`Invalid URL file_id format: ${fileId}. Expected UUID format.`);
        }

        // Use singular form /data-source/ to match backend API route
        const url = buildApiUrl(`data-source/${fileId}`);

        console.log("🗑️ DataSourcesManager - Deleting URL data source:", {
          url,
          fileId,
          sourceId: id,
          hasAuth: !!authHeader,
        });

        const response = await fetch(url, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
            ...(authHeader && { Authorization: authHeader }),
          },
        });

        console.log("📨 DataSourcesManager - Delete URL response:", {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          ok: response.ok,
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 404) {
            rememberRemovedSource(sourceToDelete);
            setDataSources((prev) => prev.filter((s) => s.id !== id));
            toast({
              title: "Source removed",
              description:
                "This URL was no longer on the server and has been cleared from your list.",
            });
            return;
          }
          console.error("❌ DataSourcesManager - Delete URL error:", {
            status: response.status,
            errorText,
            fileId,
            url,
          });
          throw new Error(`Failed to delete URL data source: ${response.status} - ${errorText}`);
        }

        // Remove from local state after successful backend deletion
        rememberRemovedSource(sourceToDelete);
        const updatedSources = dataSources.filter((s) => s.id !== id);
        setDataSources(updatedSources);

        console.log("✅ DataSourcesManager - Delete URL success");
        toast({
          title: "Source deleted",
          description: "The data source has been removed.",
        });
      } catch (error) {
        console.error("Error deleting URL data source:", error);
        toast({
          title: "Delete failed",
          description:
            error instanceof Error
              ? error.message
              : "Could not delete data source. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      // For system sources, just remove from local state (no backend deletion needed)
      const updatedSources = dataSources.filter((s) => s.id !== id);
      setDataSources(updatedSources);

      toast({
        title: "Source deleted",
        description: "The data source has been removed.",
      });
    }
  };

  const showTable = dataSources.length > 0;
  const showDataSourcesEmptyState =
    dataSources.length === 0 && leadStreamFiles.length === 0 && !showLeadUpload;
  const showHeaderAddDataSource =
    !isAddingInline && (dataSources.length > 0 || leadStreamFiles.length > 0 || showLeadUpload);

  return (
    <div className="space-y-6 relative">
      {/* Loading Overlay */}
      {(isLoading || leadStreamStatusLoading) && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex gap-2">
            <div
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "0ms", animationDuration: "1.4s" }}
            ></div>
            <div
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "200ms", animationDuration: "1.4s" }}
            ></div>
            <div
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "400ms", animationDuration: "1.4s" }}
            ></div>
          </div>
        </div>
      )}

      {/* Company Context Bar */}
      <div className="flex items-center px-4 py-3 bg-muted/40 border rounded-lg">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Company Context</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-medium">
                {companyProfile?.companyName || "Brewra Ventures"}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">
                {companyProfile?.companyUrl || "www.brewraventures.com"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Data Sources</h2>
          <p className="text-sm text-muted-foreground">
            Manage sources that help agents understand your business context
          </p>
        </div>
        <div className="flex gap-2">
          {showHeaderAddDataSource && (
            <AddDataSourceMenu
              align="end"
              onAddUrl={() => {
                handleStartAdd();
                setSelectedType("url");
              }}
              onAddFile={() => {
                handleStartAdd();
                setSelectedType("file");
              }}
              onConnectCRM={handleConnectToCRM}
              onShowLeadUpload={() => setShowLeadUpload(true)}
            />
          )}
        </div>
      </div>

      {/* Add/Edit Form */}
      {isAddingInline && (
        <SourceForm
          editingId={editingId}
          selectedType={selectedType}
          sourceName={sourceName}
          sourceUrl={sourceUrl}
          selectedFile={selectedFile}
          existingFileName={existingFileName}
          selectedTags={selectedTags}
          customTag={customTag}
          sourceDescription={sourceDescription}
          canSave={!!canSave}
          fileInputRef={fileInputRef}
          formCardRef={formCardRef}
          onTypeSelect={handleTypeSelect}
          onNameChange={setSourceName}
          onUrlChange={setSourceUrl}
          onFileChange={handleFileChange}
          onTagToggle={handleTagToggle}
          onCustomTagChange={setCustomTag}
          onAddCustomTag={handleAddCustomTag}
          onCustomTagKeyDown={handleCustomTagKeyDown}
          onDescriptionChange={setSourceDescription}
          onSave={handleSaveSource}
          onCancel={handleCancelInline}
        />
      )}

      {/* Empty State — only when there are no data sources and no lead stream file */}
      {showDataSourcesEmptyState && (
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed rounded-lg bg-muted/20">
          <Database className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No data sources added yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            Add sources to help agents understand your business context.
          </p>
          <AddDataSourceMenu
            align="center"
            onAddUrl={() => {
              handleStartAdd();
              setSelectedType("url");
            }}
            onAddFile={() => {
              handleStartAdd();
              setSelectedType("file");
            }}
            onConnectCRM={handleConnectToCRM}
            onShowLeadUpload={() => setShowLeadUpload(true)}
          />
        </div>
      )}

      {/* Table (visible only when there are sources) */}
      {showTable && (
        <ConnectorTable
          dataSources={dataSources}
          isAddingInline={isAddingInline}
          onEdit={handleEditSource}
          onDelete={handleDeleteSource}
        />
      )}

      {/* Lead Stream — upload flow + backend status (GET /leads/stream/status) */}
      {(leadStreamFiles.length > 0 || showLeadUpload) && (
        <>
          {dataSources.length > 0 && <div className="my-8 border-t" />}

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                Lead Stream
              </h3>
              <p className="text-sm text-muted-foreground">
                Import leads from a CSV, XLSX, or XLS file. Status and row counts come from the
                server while the file is processed.
              </p>
              {leadStreamStatusLoading && leadStreamFiles.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">Refreshing status…</p>
              )}
            </div>

            {showLeadUpload && (
              <DataSourceUploader
                selectedLeadFile={selectedLeadFile}
                isDraggingLead={isDraggingLead}
                isUploadingLeads={isUploadingLeads}
                leadFileInputRef={leadFileInputRef}
                onClose={() => {
                  setShowLeadUpload(false);
                  setSelectedLeadFile(null);
                }}
                onDragOver={handleLeadDragOver}
                onDragLeave={handleLeadDragLeave}
                onDrop={handleLeadDrop}
                onFileInputChange={handleLeadFileInputChange}
                onUpload={handleUploadLeadCsv}
              />
            )}

            <LeadStreamTable
              files={leadStreamFiles}
              deletingFileId={deletingLeadStreamFileId}
              showLeadUpload={showLeadUpload}
              onDeleteFile={handleDeleteLeadStream}
            />
          </div>
        </>
      )}

      {/* Apollo — ICP-driven lead discovery connector */}
      <ApolloTile />
    </div>
  );
};

export default DataSourcesManager;
