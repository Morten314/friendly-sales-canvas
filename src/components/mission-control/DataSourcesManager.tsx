import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Link as LinkIcon,
  Upload,
  Database,
  Trash2,
  Edit,
  Globe,
  FileText,
  Settings,
  X,
  Check,
  Lock,
  Building2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { buildApiUrl } from "@/lib/api";
import jwtManager from "@/lib/jwt";

// Types
type SourceType = "url" | "file" | "system";
type SourceStatus = "active" | "failed" | "processing" | "completed";

interface DataSource {
  id: string;
  fileId?: string; // The actual file_id that backend expects for deletion (from doc.file_id or doc._id)
  type: SourceType;
  name: string;
  url?: string;
  fileName?: string;
  description?: string;
  tags: string[];
  status: SourceStatus;
  createdAt: Date;
}

interface CompanyProfile {
  companyName?: string;
  companyUrl?: string;
}

// Suggested tags
const SUGGESTED_TAGS = [
  "Competitor",
  "Product",
  "Pricing",
  "Messaging",
  "Customer Proof",
  "Sales Enablement",
  "Market Research",
];


interface DataSourcesManagerProps {
  onNavigateToCompanyProfile?: () => void;
}

const DataSourcesManager: React.FC<DataSourcesManagerProps> = ({ onNavigateToCompanyProfile }) => {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
  const getAuthHeader = async () => {
    try {
      return await jwtManager.getAuthHeader();
    } catch (error) {
      console.warn("DataSourcesManager: No auth header available", error);
      return "";
    }
  };

  // Extract file_id UUID from file_key (which is in format: {user_id}/{uuid}_{filename})
  const extractFileIdFromFileKey = (fileKey: string): string => {
    if (!fileKey) {
      console.warn("⚠️ extractFileIdFromFileKey: fileKey is empty");
      return fileKey;
    }

    console.log("🔍 extractFileIdFromFileKey - Input:", fileKey);

    // If file_key contains a slash, extract the part after it
    if (fileKey.includes('/')) {
      const parts = fileKey.split('/');
      const afterSlash = parts[parts.length - 1]; // Get the last part after the slash
      console.log("🔍 extractFileIdFromFileKey - After slash:", afterSlash);
      
      // Extract UUID (36 characters with hyphens) before the first underscore
      const uuidMatch = afterSlash.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (uuidMatch && uuidMatch[1]) {
        console.log("✅ extractFileIdFromFileKey - Extracted UUID via regex:", uuidMatch[1]);
        return uuidMatch[1];
      }
      
      // If no UUID pattern found, try to extract just the part before the first underscore
      const beforeUnderscore = afterSlash.split('_')[0];
      console.log("🔍 extractFileIdFromFileKey - Before underscore:", beforeUnderscore);
      
      // Check if it looks like a UUID (36 chars with hyphens)
      if (beforeUnderscore.length === 36 && beforeUnderscore.includes('-')) {
        // Validate it's actually a UUID format
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidPattern.test(beforeUnderscore)) {
          console.log("✅ extractFileIdFromFileKey - Extracted UUID before underscore:", beforeUnderscore);
          return beforeUnderscore;
        }
      }
    }
    
    // If no slash, check if the whole string is a UUID
    const uuidMatch = fileKey.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (uuidMatch && uuidMatch[1]) {
      console.log("✅ extractFileIdFromFileKey - Whole string is UUID:", uuidMatch[1]);
      return uuidMatch[1];
    }
    
    // Fallback: return the original fileKey if we can't extract UUID
    console.warn("⚠️ extractFileIdFromFileKey - Could not extract UUID, returning original:", fileKey);
    return fileKey;
  };

  // Upload file to backend (stores in S3 via backend)
  const uploadFileToBackend = async (file: File, tags?: string[], description?: string): Promise<void> => {
    if (!currentUser?.uid) {
      throw new Error("User not authenticated");
    }

    // org_id should be same as user_id
    const orgId = currentUser.uid;

    const authHeader = await getAuthHeader();
    const url = buildApiUrl("upload-document");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", currentUser.uid);
    formData.append("org_id", orgId);
    
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
      orgId,
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
    // Upload successful - file_key will be retrieved from /user-documents
    return;
  };

  // Check processing status for a specific file
  const checkDocumentStatus = async (fileKey: string): Promise<{ status: SourceStatus; chunks_count?: number; timestamps?: any }> => {
    if (!currentUser?.uid) {
      throw new Error("User not authenticated");
    }

    const authHeader = await getAuthHeader();
    const url = buildApiUrl(`document-status/${fileKey}`);

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
    return {
      status: (payload.status || "processing") as SourceStatus,
      chunks_count: payload.chunks_count,
      timestamps: payload.timestamps,
    };
  };

  // Check status for processing files
  const checkProcessingFilesStatus = async () => {
    setDataSources((currentSources) => {
      const processingFiles = currentSources.filter(
        (s) => s.status === "processing" && s.type === "file"
      );
      
      // Check status for each processing file using file_key
      processingFiles.forEach(async (file) => {
        try {
          const statusPayload = await checkDocumentStatus(file.id);
          setDataSources((prev) =>
            prev.map((s) =>
              s.id === file.id ? { ...s, status: statusPayload.status } : s
            )
          );
        } catch (err) {
          console.error(`Error checking status for file ${file.id}:`, err);
        }
      });
      
      return currentSources;
    });
  };

  // Load documents from backend (separate storage, not company profile)
  const loadDataSourcesFromBackend = async () => {
    if (!currentUser?.uid) {
      return;
    }

    setIsLoading(true);
    try {
      const authHeader = await getAuthHeader();
      const url = buildApiUrl(`user-documents?user_id=${currentUser.uid}`);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader && { Authorization: authHeader }),
        },
      });

      if (!response.ok) {
        console.log("DataSourcesManager: No existing documents found in backend");
        return;
      }

      const data = await response.json();
      const documents = Array.isArray(data)
        ? data
        : data.documents || data.files || data.data || [];

      if (Array.isArray(documents)) {
        const loadedFileSources: DataSource[] = documents.map((doc: any) => {
          // Parse tags - handle both array and string formats
          let parsedTags: string[] = [];
          if (Array.isArray(doc.tags)) {
            parsedTags = doc.tags;
          } else if (typeof doc.tags === 'string') {
            // Handle comma-separated string or JSON array string
            try {
              // Try parsing as JSON first
              const parsed = JSON.parse(doc.tags);
              parsedTags = Array.isArray(parsed) ? parsed : [];
            } catch {
              // If not JSON, treat as comma-separated string
              parsedTags = doc.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
            }
          }

          // Extract file_id - backend might use file_id, _id, or we extract from file_key
          let fileId: string | undefined = undefined;
          if (doc.file_id) {
            fileId = doc.file_id;
            console.log("📋 DataSourcesManager - Using doc.file_id:", fileId);
          } else if (doc._id) {
            fileId = doc._id;
            console.log("📋 DataSourcesManager - Using doc._id:", fileId);
          } else if (doc.file_key || doc.fileKey) {
            // Extract UUID from file_key as fallback
            const extracted = extractFileIdFromFileKey(doc.file_key || doc.fileKey);
            // Validate that we got a UUID, not the full path
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidPattern.test(extracted)) {
              fileId = extracted;
              console.log("📋 DataSourcesManager - Extracted valid file_id from file_key:", {
                file_key: doc.file_key || doc.fileKey,
                extracted_fileId: fileId
              });
            } else {
              console.warn("⚠️ DataSourcesManager - Extraction failed, got full path instead of UUID:", {
                file_key: doc.file_key || doc.fileKey,
                extracted: extracted
              });
              // Try one more time with a more aggressive extraction
              const fileKeyStr = doc.file_key || doc.fileKey;
              if (fileKeyStr.includes('/')) {
                const parts = fileKeyStr.split('/');
                const afterSlash = parts[parts.length - 1];
                const uuidPart = afterSlash.split('_')[0];
                if (uuidPattern.test(uuidPart)) {
                  fileId = uuidPart;
                  console.log("✅ DataSourcesManager - Successfully extracted UUID on retry:", fileId);
                }
              }
            }
          } else {
            console.warn("⚠️ DataSourcesManager - No file_id found in document:", doc);
          }

          return {
            id: doc.file_key || doc.fileKey || doc.id || `source-${Date.now()}-${Math.random()}`,
            fileId: fileId, // Store the file_id for deletion
            type: "file",
            name: doc.name || doc.file_name || doc.original_filename || doc.fileKey || "Uploaded file",
            fileName: doc.file_name || doc.original_filename || doc.name,
            url: doc.file_url,
            description: doc.description || undefined,
            tags: parsedTags,
            status: (doc.status || "processing") as SourceStatus,
            createdAt: doc.uploaded_at
              ? new Date(doc.uploaded_at)
              : doc.created_at
              ? new Date(doc.created_at)
              : new Date(),
          };
        });

        // Merge with existing sources: keep URL/system types, update file types from backend
        setDataSources((prev) => {
          const urlAndSystemSources = prev.filter(s => s.type !== "file");
          const existingFileSources = prev.filter(s => s.type === "file");
          
          // Create a map of existing files by fileId (UUID) for primary matching - this is the most reliable
          const existingFilesByFileId = new Map(
            existingFileSources
              .filter(f => f.fileId)
              .map(f => [f.fileId!, f])
          );
          
          // Create a map by ID (file_key) for fallback matching
          const existingFilesById = new Map(existingFileSources.map(f => [f.id, f]));
          
          // Also create a map by fileName for additional fallback matching
          const existingFilesByFileName = new Map(
            existingFileSources
              .filter(f => f.fileName)
              .map(f => [f.fileName!, f])
          );
          
          // Track which existing files we've matched (by their IDs)
          const matchedExistingIds = new Set<string>();
          
          // Merge file sources: use backend data, but preserve any local metadata updates
          const mergedFileSources = loadedFileSources.map(backendFile => {
            let existingFile: DataSource | undefined = undefined;
            let matchedById: string | undefined = undefined;
            
            // Priority 1: Match by fileId (UUID) - most reliable for updated entries
            if (backendFile.fileId) {
              existingFile = existingFilesByFileId.get(backendFile.fileId);
              if (existingFile) {
                matchedById = existingFile.id;
                console.log("✅ DataSourcesManager - Matched by fileId:", {
                  fileId: backendFile.fileId,
                  existingId: existingFile.id,
                  backendId: backendFile.id,
                });
              }
            }
            
            // Priority 2: Match by ID (file_key) if fileId match failed
            if (!existingFile) {
              existingFile = existingFilesById.get(backendFile.id);
              if (existingFile) {
                matchedById = existingFile.id;
                console.log("✅ DataSourcesManager - Matched by ID:", {
                  id: backendFile.id,
                  existingId: existingFile.id,
                });
              }
            }
            
            // Priority 3: Match by fileName if both above failed
            if (!existingFile && backendFile.fileName) {
              existingFile = existingFilesByFileName.get(backendFile.fileName);
              if (existingFile) {
                matchedById = existingFile.id;
                // Update backend file ID to match existing
                backendFile.id = existingFile.id;
                console.log("✅ DataSourcesManager - Matched by fileName:", {
                  fileName: backendFile.fileName,
                  existingId: existingFile.id,
                  backendId: backendFile.id,
                });
              }
            }
            
            if (existingFile && matchedById) {
              matchedExistingIds.add(matchedById);
              // When matched by fileId, use backend data (which has the latest updates from PUT)
              // This ensures that after refresh, we get the updated tags and description
              return {
                ...backendFile,
                id: matchedById, // Keep the existing ID to maintain reference
                fileId: backendFile.fileId || existingFile.fileId, // Use backend fileId (most up-to-date)
                // Use backend data for all fields since backend is source of truth after PUT update
                name: backendFile.name || existingFile.name,
                description: backendFile.description !== undefined ? backendFile.description : existingFile.description,
                tags: backendFile.tags, // Always use backend tags (even if empty array)
                fileName: backendFile.fileName || existingFile.fileName,
                createdAt: existingFile.createdAt, // Preserve original creation date
              };
            }
            
            // New file from backend - return as is
            return backendFile;
          });
          
          // Add any existing file sources that weren't in the backend response (local-only edits or files not yet synced)
          const unmatchedExistingFiles = existingFileSources.filter(s => !matchedExistingIds.has(s.id));
          
          // Combine all sources and remove duplicates by id
          const allSources = [...urlAndSystemSources, ...mergedFileSources, ...unmatchedExistingFiles];
          const uniqueSourcesMap = new Map<string, DataSource>();
          
          // Process in order: existing files first (to preserve local edits), then backend files
          allSources.forEach(source => {
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
          console.log("📋 DataSourcesManager - Merged data sources:", {
            urlAndSystemCount: urlAndSystemSources.length,
            mergedFileCount: mergedFileSources.length,
            unmatchedCount: unmatchedExistingFiles.length,
            totalCount: result.length,
            matchedIds: Array.from(matchedExistingIds),
          });
          
          return result;
        });
        console.log("Data sources loaded from dedicated backend:", loadedFileSources);
      }
    } catch (error) {
      console.error("Error loading data sources:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data sources on mount
  useEffect(() => {
    if (currentUser?.uid) {
      loadDataSourcesFromBackend();
    }
  }, [currentUser?.uid]);
  
  // Form state
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [selectedType, setSelectedType] = useState<SourceType | "">("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [sourceDescription, setSourceDescription] = useState("");
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetInlineForm = () => {
    setIsAddingInline(false);
    setSelectedType("");
    setSourceName("");
    setSourceUrl("");
    setSelectedFile(null);
    setSelectedTags([]);
    setCustomTag("");
    setSourceDescription("");
    setEditingId(null);
  };

  const handleStartAdd = () => {
    resetInlineForm();
    setIsAddingInline(true);
  };

  const handleCancelInline = () => {
    resetInlineForm();
  };

  const handleTypeSelect = (type: SourceType) => {
    setSelectedType(type);
    // Clear URL/file when switching types
    if (type === "url") {
      setSelectedFile(null);
    } else if (type === "file") {
      setSourceUrl("");
    }
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = () => {
    if (customTag.trim() && !selectedTags.includes(customTag.trim())) {
      setSelectedTags((prev) => [...prev, customTag.trim()]);
      setCustomTag("");
    }
  };

  const handleCustomTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomTag();
    }
  };

  const handleSaveSource = async () => {
    if (!sourceName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a source name.",
        variant: "destructive",
      });
      return;
    }

    if (selectedType === "url" && !sourceUrl.trim()) {
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
            const existingSource = dataSources.find(s => s.id === editingId);
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
                  console.warn("⚠️ DataSourcesManager - Could not extract valid oldFileId for deletion:", {
                    existingSourceId: existingSource.id,
                    existingFileId: existingSource.fileId,
                  });
                  oldFileId = undefined; // Will skip deletion if we can't get valid fileId
                }
              }
            }
          }

          // Capture current file IDs and fileIds before any state changes (for identifying new file after reload)
          const fileIdsBeforeReload = dataSources.filter(s => s.type === "file").map(s => s.id);
          const fileFileIdsBeforeReload = dataSources
            .filter(s => s.type === "file" && s.fileId)
            .map(s => s.fileId!);

          // Upload new file to backend (stored in S3)
          await uploadFileToBackend(selectedFile, selectedTags, sourceDescription.trim() || undefined);
          
          // If editing, delete the old file from backend to prevent duplicates
          if (isEditing && oldFileId) {
            try {
              console.log("🗑️ DataSourcesManager - Deleting old file after uploading replacement:", {
                oldFileId,
                oldId: editingId,
              });
              
              const authHeader = await getAuthHeader();
              const deleteUrl = buildApiUrl(`data-source/${oldFileId}`);
              
              const deleteResponse = await fetch(deleteUrl, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  "accept": "application/json",
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
              console.error("❌ DataSourcesManager - Error deleting old file (non-critical):", deleteError);
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
            window.dispatchEvent(new CustomEvent('dataSourceAdded'));
          }

          // Reload documents from backend to get the new file_key
          // Then apply the custom name, tags, and description to the newly uploaded file
          setTimeout(async () => {
            try {
              console.log("🔄 DataSourcesManager - Reloading after upload, applying metadata:", uploadMetadata);
              await loadDataSourcesFromBackend();
              
              // Apply metadata to the newly uploaded file
              setDataSources((prev) => {
                console.log("📋 DataSourcesManager - Current data sources before metadata application:", prev.length);
                console.log("📋 DataSourcesManager - File IDs before reload:", fileIdsBeforeReload);
                
                if (isEditing && uploadMetadata.oldId) {
                  // If editing, remove the old entry by both ID and fileId (in case old file still exists in backend)
                  // Get old fileId from the closure (captured before state changes)
                  const oldFileIdToExclude = oldFileId;
                  
                  const withoutOldEntry = prev.filter(s => {
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
                    const isNewFile = s.type === "file" && 
                      (!fileIdsBeforeReload.includes(s.id)) &&
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
                        id: uploadMetadata.oldId, // Keep the old ID to maintain reference (replaces old entry)
                        name: uploadMetadata.name,
                        description: uploadMetadata.description,
                        tags: uploadMetadata.tags,
                      };
                    }
                    return s;
                  });
                  
                  console.log("✅ DataSourcesManager - Metadata applied to edited file, old entry replaced");
                  return updated;
                } else {
                  // For new uploads, find the file that wasn't in the list before
                  // Match by file name to identify the newly uploaded file
                  const newFiles = prev.filter(s => 
                    s.type === "file" && 
                    !fileIdsBeforeReload.includes(s.id) &&
                    (s.fileName === uploadMetadata.fileName || s.name === uploadMetadata.fileName)
                  );
                  
                  console.log("🔍 DataSourcesManager - New files found:", newFiles.length, newFiles.map(f => ({ id: f.id, fileName: f.fileName, name: f.name })));
                  
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
                    console.warn("⚠️ DataSourcesManager - No new file found to apply metadata to");
                  }
                }
                return prev;
              });
              
              // Poll status for processing files after a delay
              setTimeout(() => {
                checkProcessingFilesStatus();
              }, 2000);
            } catch (err) {
              console.error("Error reloading documents after upload:", err);
            }
          }, 1000);
        } else if (editingId) {
          // Editing existing file source - update metadata via PUT API
          // IMPORTANT: We are EDITING, not creating a new entry
          console.log("📝 DataSourcesManager - Editing existing source (not creating new):", editingId);
          
          // Find the existing source to preserve its ID and other properties
          const existingSource = dataSources.find(s => s.id === editingId);
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
                "accept": "application/json",
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
              const existingSourceIndex = prev.findIndex(s => s.id === editingId);
              
              if (existingSourceIndex === -1) {
                console.error("❌ DataSourcesManager - Could not find source to update:", editingId);
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
              updated.forEach(source => {
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
                console.warn("⚠️ DataSourcesManager - Warning: Entry count increased after update! This should not happen.");
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
            setTimeout(async () => {
              try {
                console.log("🔄 DataSourcesManager - Reloading after PUT update to sync state");
                await loadDataSourcesFromBackend();
              } catch (err) {
                console.error("Error reloading after update:", err);
                // Don't show error to user - local state is already updated
              }
            }, 500);
          } catch (error) {
            console.error("Error updating data source:", error);
            toast({
              title: "Update failed",
              description: error instanceof Error ? error.message : "Could not update data source. Please try again.",
              variant: "destructive",
            });
            // Don't throw - return early to prevent form reset on error
            setIsSaving(false);
            return;
          }
        }
      } else {
        // URL / other types are stored locally only (no backend endpoint provided)
        const newSource: DataSource = {
          id: editingId || `source-${Date.now()}`,
          type: selectedType as SourceType,
          name: sourceName.trim(),
          url: selectedType === "url" ? sourceUrl.trim() : undefined,
          description: sourceDescription.trim() || undefined,
          tags: selectedTags,
          status: "active",
          createdAt: editingId 
            ? (dataSources.find(s => s.id === editingId)?.createdAt || new Date())
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
        description: error instanceof Error ? error.message : "Could not upload file. Please try again.",
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

  const handleEditSource = (source: DataSource) => {
    setEditingId(source.id);
    setSelectedType(source.type);
    setSourceName(source.name);
    setSourceUrl(source.url || "");
    setSourceDescription(source.description || "");
    setSelectedTags(source.tags);
    setIsAddingInline(true);
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
          console.warn("⚠️ DataSourcesManager - fileId is not a valid UUID, re-extracting from id:", {
            fileId,
            id,
            storedFileId: sourceToDelete.fileId
          });
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
          sourceToDelete: sourceToDelete
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
            "accept": "application/json",
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
          console.error("❌ DataSourcesManager - Delete error:", {
            status: response.status,
            errorText,
            fileId,
            url,
          });
          throw new Error(`Failed to delete data source: ${response.status} - ${errorText}`);
        }

        // Remove from local state after successful backend deletion
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
          description: error instanceof Error ? error.message : "Could not delete data source. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      // For URL/system sources, just remove from local state (no backend deletion needed)
      const updatedSources = dataSources.filter((s) => s.id !== id);
      setDataSources(updatedSources);

      toast({
        title: "Source deleted",
        description: "The data source has been removed.",
      });
    }
  };

  const getStatusBadge = (status: SourceStatus) => {
    switch (status) {
      case "active":
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
            🟢 {status === "completed" ? "Completed" : "Active"}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
            🔴 Failed
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800">
            🟡 Processing
          </Badge>
        );
    }
  };

  const getTypeIcon = (type: SourceType) => {
    switch (type) {
      case "url":
        return <Globe className="h-4 w-4 text-muted-foreground" />;
      case "file":
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case "system":
        return <Settings className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeLabel = (type: SourceType) => {
    switch (type) {
      case "url":
        return "URL";
      case "file":
        return "File";
      case "system":
        return "System";
    }
  };

  const canSave = 
    selectedType && 
    selectedType !== "system" && 
    sourceName.trim() && 
    (selectedType === "url" 
      ? sourceUrl.trim() 
      : editingId 
        ? true // When editing, file is optional - can update metadata without new file
        : selectedFile); // When adding new, file is required

  // Render the add/edit form
  const renderAddForm = () => {
    if (!isAddingInline) return null;

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{editingId ? "Edit Data Source" : "Add Data Source"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-6">
            {/* Row 1: Source Type and Name side by side */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Type Selection - smaller, takes 1/3 width */}
              <div className="space-y-2">
                <Label htmlFor="source-type">Source Type *</Label>
                <Select
                  value={selectedType}
                  onValueChange={(value) => handleTypeSelect(value as SourceType)}
                >
                  <SelectTrigger id="source-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        <span>Add URL</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="file">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        <span>Upload File</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="system" disabled>
                      <div className="flex items-center gap-2 opacity-50">
                        <Database className="h-4 w-4" />
                        <span>Connect System (Coming soon)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Name - takes 2/3 width */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="source-name">Name *</Label>
                <Input
                  id="source-name"
                  placeholder="e.g., Competitor Pricing Page"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                />
              </div>
            </div>

            {/* Row 2: URL or File - full width, more prominent */}
            {selectedType === "url" && (
              <div className="space-y-2">
                <Label htmlFor="source-url" className="text-base font-medium">Website URL *</Label>
                <Input
                  id="source-url"
                  type="url"
                  placeholder="https://example.com"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">Enter the full URL of the website you want to add as a data source</p>
              </div>
            )}

            {selectedType === "file" && (
              <div className="space-y-2">
                <Label htmlFor="source-file" className="text-base font-medium">Upload File *</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    id="source-file"
                    accept=".pdf,.docx,.pptx,.csv,.xlsx"
                  />
                  <label
                    htmlFor="source-file"
                    className="flex-1 inline-flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors bg-muted/20"
                  >
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    {selectedFile ? (
                      <span className="text-foreground font-medium">{selectedFile.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Click to browse or drag and drop files here</span>
                    )}
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">Supported formats: PDF, DOCX, PPTX, CSV, XLSX</p>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="source-description">Description</Label>
              <Textarea
                id="source-description"
                placeholder="Brief description of this data source..."
                value={sourceDescription}
                onChange={(e) => setSourceDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_TAGS.map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleTagToggle(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add custom tag..."
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={handleCustomTagKeyDown}
                    className="max-w-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCustomTag}
                    disabled={!customTag.trim()}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                {selectedTags.filter((t) => !SUGGESTED_TAGS.includes(t)).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedTags
                      .filter((tag) => !SUGGESTED_TAGS.includes(tag))
                      .map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => handleTagToggle(tag)}
                          />
                        </Badge>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleCancelInline}>
              Cancel
            </Button>
            <Button onClick={handleSaveSource} disabled={!canSave}>
              <Check className="h-4 w-4 mr-2" />
              {editingId ? "Update" : "Add"} Data Source
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const showTable = dataSources.length > 0;

  return (
    <div className="space-y-6">
      {/* Company Context Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border rounded-lg">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Company Context</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-medium">
                {companyProfile?.companyName || "Brewra"}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">
                {companyProfile?.companyUrl || "www.brewra.com"}
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={onNavigateToCompanyProfile}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          Edit Company Profile
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Data Sources</h2>
          <p className="text-sm text-muted-foreground">
            Manage sources that help agents understand your business context
          </p>
        </div>
        {dataSources.length > 0 && !isAddingInline && (
          <Button 
            onClick={handleStartAdd} 
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Data Source
          </Button>
        )}
      </div>

      {/* Add/Edit Form */}
      {renderAddForm()}

      {/* Empty State */}
      {!showTable && (
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed rounded-lg bg-muted/20">
          <Database className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No data sources added yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            Add sources to help agents understand your business context.
          </p>
          <Button onClick={handleStartAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Data Source
          </Button>
        </div>
      )}

      {/* Table (visible only when there are sources) */}
      {showTable && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[130px]">Type</TableHead>
                <TableHead className="w-[180px]">Name</TableHead>
                <TableHead className="hidden md:table-cell w-[200px]">URL / File</TableHead>
                <TableHead className="hidden lg:table-cell w-[150px]">Description</TableHead>
                <TableHead className="hidden lg:table-cell">Tags</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[90px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Existing Sources */}
              {dataSources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(source.type)}
                      <span className="text-sm">{getTypeLabel(source.type)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {source.type === "url" && source.url ? (
                      <span className="text-sm truncate max-w-[180px] block" title={source.url}>
                        {source.url}
                      </span>
                    ) : source.type === "file" && source.fileName ? (
                      <span className="text-sm">{source.fileName}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {source.description || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {source.tags.length > 0 ? (
                      <div 
                        className="w-[180px] border rounded-md bg-muted/30 px-2 py-1.5 overflow-x-auto"
                        title={source.tags.length > 2 ? "Scroll to view all tags" : undefined}
                      >
                        <div className="flex gap-1 whitespace-nowrap">
                          {source.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs shrink-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(source.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditSource(source)}
                        disabled={isAddingInline}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteSource(source.id)}
                        disabled={isAddingInline}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default DataSourcesManager;