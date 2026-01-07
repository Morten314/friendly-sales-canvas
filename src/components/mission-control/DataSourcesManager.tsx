import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Types
type SourceType = "url" | "file" | "system";
type SourceStatus = "active" | "failed" | "processing";

interface DataSource {
  id: string;
  type: SourceType;
  name: string;
  url?: string;
  fileName?: string;
  tags: string[];
  status: SourceStatus;
  createdAt: Date;
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

const DataSourcesManager: React.FC = () => {
  const { toast } = useToast();
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<SourceType | "">("");
  
  // Form state
  const [formStep, setFormStep] = useState<"type" | "name" | "url" | "file" | "tags">("type");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");

  // Edit state
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);

  const resetForm = () => {
    setSelectedType("");
    setFormStep("type");
    setSourceName("");
    setSourceUrl("");
    setSelectedFile(null);
    setSelectedTags([]);
    setCustomTag("");
    setEditingSource(null);
  };

  const handleOpenModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleTypeSelect = (type: SourceType) => {
    setSelectedType(type);
    if (type === "system") {
      // System integration is coming soon - don't proceed
    } else {
      setFormStep("name");
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && sourceName.trim()) {
      e.preventDefault();
      setFormStep(selectedType === "url" ? "url" : "file");
    }
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && sourceUrl.trim()) {
      e.preventDefault();
      setFormStep("tags");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFormStep("tags");
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

  const handleSaveSource = () => {
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

    const newSource: DataSource = {
      id: editingSource?.id || `source-${Date.now()}`,
      type: selectedType as SourceType,
      name: sourceName.trim(),
      url: selectedType === "url" ? sourceUrl.trim() : undefined,
      fileName: selectedType === "file" ? selectedFile?.name : undefined,
      tags: selectedTags,
      status: "processing",
      createdAt: editingSource?.createdAt || new Date(),
    };

    if (editingSource) {
      setDataSources((prev) =>
        prev.map((s) => (s.id === editingSource.id ? newSource : s))
      );
      toast({
        title: "Source updated",
        description: `${sourceName} has been updated.`,
      });
    } else {
      setDataSources((prev) => [...prev, newSource]);
      toast({
        title: "Source added",
        description: `${sourceName} is being processed.`,
      });
    }

    // Simulate processing -> active/failed status
    setTimeout(() => {
      setDataSources((prev) =>
        prev.map((s) =>
          s.id === newSource.id
            ? { ...s, status: Math.random() > 0.1 ? "active" : "failed" }
            : s
        )
      );
    }, 2000);

    handleCloseModal();
  };

  const handleEditSource = (source: DataSource) => {
    setEditingSource(source);
    setSelectedType(source.type);
    setSourceName(source.name);
    setSourceUrl(source.url || "");
    setSelectedTags(source.tags);
    setFormStep("tags"); // Go directly to tags for editing
    setIsModalOpen(true);
  };

  const handleDeleteSource = (id: string) => {
    setDataSources((prev) => prev.filter((s) => s.id !== id));
    toast({
      title: "Source deleted",
      description: "The data source has been removed.",
    });
  };

  const getStatusBadge = (status: SourceStatus) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            🟢 Active
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            🔴 Failed
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Data Sources</h2>
          <p className="text-sm text-muted-foreground">
            Manage sources that help agents understand your business context
          </p>
        </div>
        <Button onClick={handleOpenModal} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Source
        </Button>
      </div>

      {/* Empty State or Table */}
      {dataSources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed rounded-lg bg-muted/20">
          <Database className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No data sources added yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            Add sources to help agents understand your business context.
          </p>
          <Button onClick={handleOpenModal} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Source
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[80px]">Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataSources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(source.type)}
                      <span className="text-sm text-muted-foreground">
                        {getTypeLabel(source.type)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {source.tags.length > 0 ? (
                        source.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                      {source.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{source.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(source.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditSource(source)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteSource(source.id)}
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

      {/* Add Source Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSource ? "Edit Source" : "Add Source"}
            </DialogTitle>
            <DialogDescription>
              {formStep === "type" && "Select the type of source you want to add."}
              {formStep === "name" && "Enter a name for this source."}
              {formStep === "url" && "Enter the website URL."}
              {formStep === "file" && "Upload your file."}
              {formStep === "tags" && "Add context tags to help agents understand this source."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Step 1: Type Selection */}
            {formStep === "type" && (
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={selectedType}
                  onValueChange={(value) => handleTypeSelect(value as SourceType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        Add URL
                      </div>
                    </SelectItem>
                    <SelectItem value="file">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Upload a File
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Connect a System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {selectedType === "system" && (
                  <div className="mt-4 p-4 bg-muted rounded-lg text-center">
                    <Database className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      We're building system integrations. You'll be notified when this is available.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Name Field */}
            {formStep === "name" && (
              <div className="space-y-2">
                <Label htmlFor="source-name">Source Name</Label>
                <Input
                  id="source-name"
                  placeholder="e.g., Competitor Pricing Page"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Press Enter to continue
                </p>
              </div>
            )}

            {/* Step 3a: URL Field */}
            {formStep === "url" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Source Name</Label>
                  <div className="text-sm text-muted-foreground">{sourceName}</div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source-url">Website URL</Label>
                  <Input
                    id="source-url"
                    type="url"
                    placeholder="https://example.com"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    onKeyDown={handleUrlKeyDown}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Press Enter to continue
                  </p>
                </div>
              </div>
            )}

            {/* Step 3b: File Upload */}
            {formStep === "file" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Source Name</Label>
                  <div className="text-sm text-muted-foreground">{sourceName}</div>
                </div>
                <div className="space-y-2">
                  <Label>Upload File</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
                    <Input
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                      accept=".pdf,.docx,.pptx,.csv,.xlsx"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      {selectedFile ? (
                        <p className="text-sm font-medium">{selectedFile.name}</p>
                      ) : (
                        <>
                          <p className="text-sm font-medium">
                            Drag & drop or click to browse
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            PDF, DOCX, PPT, CSV accepted
                          </p>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Tags */}
            {formStep === "tags" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Source Name</Label>
                  <div className="text-sm text-muted-foreground">{sourceName}</div>
                </div>
                {selectedType === "url" && sourceUrl && (
                  <div className="space-y-2">
                    <Label>URL</Label>
                    <div className="text-sm text-muted-foreground break-all">
                      {sourceUrl}
                    </div>
                  </div>
                )}
                {selectedType === "file" && selectedFile && (
                  <div className="space-y-2">
                    <Label>File</Label>
                    <div className="text-sm text-muted-foreground">
                      {selectedFile.name}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Context Tags</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
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
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add custom tag..."
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      onKeyDown={handleCustomTagKeyDown}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddCustomTag}
                      disabled={!customTag.trim()}
                    >
                      Add
                    </Button>
                  </div>
                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedTags
                        .filter((tag) => !SUGGESTED_TAGS.includes(tag))
                        .map((tag) => (
                          <Badge
                            key={tag}
                            variant="default"
                            className="gap-1"
                          >
                            {tag}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => handleTagToggle(tag)}
                            />
                          </Badge>
                        ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Tags help agents understand how to use this source.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex justify-between">
            <div>
              {formStep !== "type" && !editingSource && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (formStep === "name") setFormStep("type");
                    else if (formStep === "url" || formStep === "file") setFormStep("name");
                    else if (formStep === "tags") setFormStep(selectedType === "url" ? "url" : "file");
                  }}
                >
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCloseModal}>
                Cancel
              </Button>
              {formStep === "tags" && (
                <Button onClick={handleSaveSource}>
                  Save Source
                </Button>
              )}
              {(formStep === "name" || formStep === "url") && (
                <Button
                  onClick={() => {
                    if (formStep === "name" && sourceName.trim()) {
                      setFormStep(selectedType === "url" ? "url" : "file");
                    } else if (formStep === "url" && sourceUrl.trim()) {
                      setFormStep("tags");
                    }
                  }}
                  disabled={
                    (formStep === "name" && !sourceName.trim()) ||
                    (formStep === "url" && !sourceUrl.trim())
                  }
                >
                  Continue
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DataSourcesManager;
