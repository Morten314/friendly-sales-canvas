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

  // Upload file to backend (stores in S3 via backend)
  const uploadFileToBackend = async (file: File): Promise<void> => {
    if (!currentUser?.uid) {
      throw new Error("User not authenticated");
    }

    const authHeader = await getAuthHeader();
    const url = buildApiUrl("upload-document");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", currentUser.uid);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...(authHeader && { Authorization: authHeader }),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload file: ${response.status} - ${errorText}`);
    }

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
        const loadedSources: DataSource[] = documents.map((doc: any) => ({
          id: doc.file_key || doc.fileKey || doc.id || `source-${Date.now()}-${Math.random()}`,
          type: "file",
          name: doc.name || doc.file_name || doc.original_filename || doc.fileKey || "Uploaded file",
          fileName: doc.file_name || doc.original_filename || doc.name,
          url: doc.file_url,
          description: doc.description,
          tags: Array.isArray(doc.tags) ? doc.tags : [],
          status: (doc.status || "processing") as SourceStatus,
          createdAt: doc.uploaded_at
            ? new Date(doc.uploaded_at)
            : doc.created_at
            ? new Date(doc.created_at)
            : new Date(),
        }));

        setDataSources(loadedSources);
        console.log("Data sources loaded from dedicated backend:", loadedSources);
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

    if (selectedType === "file" && !selectedFile) {
      toast({
        title: "File required",
        description: "Please upload a file.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);

      if (selectedType === "file" && selectedFile) {
        // Upload file to backend (stored in S3)
        await uploadFileToBackend(selectedFile);

        toast({
          title: "File uploaded",
          description: `${sourceName} is being processed.`,
        });

        // Notify MissionControl that a new data source was added
        window.dispatchEvent(new CustomEvent('dataSourceAdded'));

        // Reload documents from backend to get the file_key
        // Wait a moment for backend to process the upload and store in S3
        setTimeout(async () => {
          try {
            await loadDataSourcesFromBackend();
            
            // Poll status for processing files after a delay
            setTimeout(() => {
              checkProcessingFilesStatus();
            }, 2000);
          } catch (err) {
            console.error("Error reloading documents after upload:", err);
          }
        }, 1000);
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
          createdAt: new Date(),
        };

        setDataSources((prev) => {
          if (editingId) {
            return prev.map((s) => (s.id === editingId ? newSource : s));
          }
          return [...prev, newSource];
        });

        toast({
          title: "Source added",
          description: `${sourceName} saved locally.`,
        });
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
      resetInlineForm();
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
    const updatedSources = dataSources.filter((s) => s.id !== id);
    setDataSources(updatedSources);

    toast({
      title: "Source deleted",
      description: "The data source has been removed.",
    });
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
    (selectedType === "url" ? sourceUrl.trim() : selectedFile);

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