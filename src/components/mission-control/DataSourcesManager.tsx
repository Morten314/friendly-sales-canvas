import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Check,
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
  description?: string;
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

type InlineStep = "type" | "name" | "url" | "file" | "description" | "tags";

const DataSourcesManager: React.FC = () => {
  const { toast } = useToast();
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  
  // Inline editing state
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [inlineStep, setInlineStep] = useState<InlineStep>("type");
  const [selectedType, setSelectedType] = useState<SourceType | "">("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [sourceDescription, setSourceDescription] = useState("");
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const nameInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus management
  useEffect(() => {
    if (inlineStep === "name" && nameInputRef.current) {
      nameInputRef.current.focus();
    } else if (inlineStep === "url" && urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, [inlineStep]);

  const resetInlineForm = () => {
    setIsAddingInline(false);
    setInlineStep("type");
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
    if (type === "system") {
      // System is disabled - show message but don't proceed
    } else {
      setInlineStep("name");
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && sourceName.trim()) {
      e.preventDefault();
      setInlineStep(selectedType === "url" ? "url" : "file");
    } else if (e.key === "Escape") {
      handleCancelInline();
    }
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && sourceUrl.trim()) {
      e.preventDefault();
      setInlineStep("description");
    } else if (e.key === "Escape") {
      handleCancelInline();
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setInlineStep("tags");
    } else if (e.key === "Escape") {
      handleCancelInline();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setInlineStep("description");
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
    } else if (e.key === "Escape") {
      handleCancelInline();
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
      id: editingId || `source-${Date.now()}`,
      type: selectedType as SourceType,
      name: sourceName.trim(),
      url: selectedType === "url" ? sourceUrl.trim() : undefined,
      fileName: selectedType === "file" ? selectedFile?.name : undefined,
      description: sourceDescription.trim() || undefined,
      tags: selectedTags,
      status: "processing",
      createdAt: new Date(),
    };

    if (editingId) {
      setDataSources((prev) =>
        prev.map((s) => (s.id === editingId ? newSource : s))
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

    resetInlineForm();
  };

  const handleEditSource = (source: DataSource) => {
    setEditingId(source.id);
    setSelectedType(source.type);
    setSourceName(source.name);
    setSourceUrl(source.url || "");
    setSourceDescription(source.description || "");
    setSelectedTags(source.tags);
    setInlineStep("tags");
    setIsAddingInline(true);
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
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
            🟢 Active
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
    (selectedType === "url" ? sourceUrl.trim() : selectedFile) &&
    inlineStep === "tags";

  // Render the inline editing row
  const renderInlineEditRow = () => {
    if (!isAddingInline) return null;

    return (
      <TableRow className="bg-muted/30 border-b-2 border-primary/20">
        {/* Type Cell */}
        <TableCell className="py-3">
          <Select
            value={selectedType}
            onValueChange={(value) => handleTypeSelect(value as SourceType)}
          >
            <SelectTrigger className="w-[130px] h-9 text-sm">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="url">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-3.5 w-3.5" />
                  <span>Add URL</span>
                </div>
              </SelectItem>
              <SelectItem value="file">
                <div className="flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload File</span>
                </div>
              </SelectItem>
              <SelectItem value="system" disabled>
                <div className="flex items-center gap-2 opacity-50">
                  <Database className="h-3.5 w-3.5" />
                  <span>Connect System</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          {selectedType === "system" && (
            <p className="text-xs text-muted-foreground mt-1.5 max-w-[140px]">
              Coming soon
            </p>
          )}
        </TableCell>

        {/* Name Cell */}
        <TableCell className="py-3">
          {inlineStep === "type" && selectedType && selectedType !== "system" ? (
            <span className="text-sm text-muted-foreground italic">
              Select type first...
            </span>
          ) : inlineStep !== "type" ? (
            <div className="space-y-1">
              <Input
                ref={nameInputRef}
                placeholder="e.g., Competitor Pricing Page"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                className="h-9 text-sm"
              />
              {inlineStep === "name" && sourceName.trim() && (
                <p className="text-xs text-muted-foreground">Press Enter to continue</p>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* URL Cell */}
        <TableCell className="py-3 hidden md:table-cell">
          {selectedType === "url" && inlineStep === "url" ? (
            <div className="space-y-1">
              <Input
                ref={urlInputRef}
                type="url"
                placeholder="https://example.com"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                onKeyDown={handleUrlKeyDown}
                className="h-9 text-sm max-w-xs"
              />
              {sourceUrl.trim() && (
                <p className="text-xs text-muted-foreground">Press Enter to continue</p>
              )}
            </div>
          ) : selectedType === "url" && (inlineStep === "description" || inlineStep === "tags") ? (
            <span className="text-sm truncate max-w-[200px] block">{sourceUrl || "—"}</span>
          ) : selectedType === "file" && inlineStep === "file" ? (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="inline-file-upload"
                accept=".pdf,.docx,.pptx,.csv,.xlsx"
              />
              <label
                htmlFor="inline-file-upload"
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors text-sm"
              >
                <Upload className="h-4 w-4 text-muted-foreground" />
                {selectedFile ? (
                  <span className="text-foreground">{selectedFile.name}</span>
                ) : (
                  <span className="text-muted-foreground">Browse files...</span>
                )}
              </label>
              <span className="text-xs text-muted-foreground">PDF, DOCX, PPT, CSV</span>
            </div>
          ) : selectedType === "file" && (inlineStep === "description" || inlineStep === "tags") ? (
            <span className="text-sm">{selectedFile?.name || "—"}</span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Description Cell */}
        <TableCell className="py-3 hidden lg:table-cell">
          {inlineStep === "description" ? (
            <div className="space-y-1">
              <Input
                placeholder="Brief description..."
                value={sourceDescription}
                onChange={(e) => setSourceDescription(e.target.value)}
                onKeyDown={handleDescriptionKeyDown}
                className="h-9 text-sm max-w-xs"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Press Enter to continue</p>
            </div>
          ) : inlineStep === "tags" ? (
            <span className="text-sm">{sourceDescription || "—"}</span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Tags Cell */}
        <TableCell className="py-3 hidden lg:table-cell">
          {inlineStep === "tags" ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_TAGS.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer text-xs h-6"
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Custom tag..."
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={handleCustomTagKeyDown}
                  className="h-8 text-sm w-32"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddCustomTag}
                  disabled={!customTag.trim()}
                  className="h-8 px-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {selectedTags.filter((t) => !SUGGESTED_TAGS.includes(t)).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedTags
                    .filter((tag) => !SUGGESTED_TAGS.includes(tag))
                    .map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs gap-1">
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
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Status Cell */}
        <TableCell className="py-3">
          <span className="text-sm text-muted-foreground italic">Unsaved</span>
        </TableCell>

        {/* Actions Cell */}
        <TableCell className="py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
              onClick={handleSaveSource}
              disabled={!canSave}
              title="Save"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleCancelInline}
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const showTable = dataSources.length > 0 || isAddingInline;

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
        <Button 
          onClick={handleStartAdd} 
          className="gap-2"
          disabled={isAddingInline}
        >
          <Plus className="h-4 w-4" />
          Add Data Source
        </Button>
      </div>

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

      {/* Table (visible only when there are sources OR adding inline) */}
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
              {/* Inline Add Row (at top) */}
              {renderInlineEditRow()}
              
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
