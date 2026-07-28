import { Plus, Link as LinkIcon, Upload, Database, X, Check } from "lucide-react";
import type React from "react";

import type { DataSourceType } from "../../types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Suggested tags (module scope — only the source form consumes them).
export const SUGGESTED_TAGS = [
  "Competitor",
  "Product",
  "Pricing",
  "Messaging",
  "Customer Proof",
  "Sales Enablement",
  "Market Research",
];

interface SourceFormProps {
  // Form-field state (controlled by the container)
  editingId: string | null;
  selectedType: DataSourceType | "";
  sourceName: string;
  sourceUrl: string;
  selectedFile: File | null;
  existingFileName: string | null;
  selectedTags: string[];
  customTag: string;
  sourceDescription: string;
  canSave: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  formCardRef: React.RefObject<HTMLDivElement>;
  // Handlers — all writes stay in the container.
  onTypeSelect: (type: DataSourceType) => void;
  onNameChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTagToggle: (tag: string) => void;
  onCustomTagChange: (value: string) => void;
  onAddCustomTag: () => void;
  onCustomTagKeyDown: (e: React.KeyboardEvent) => void;
  onDescriptionChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * Controlled add/edit form for a data source. All field state + the
 * `handleSaveSource` write live in the container — this child only renders the
 * form and wires the prop callbacks. The container threads `formCardRef` (for
 * scroll-into-view) and `fileInputRef` here.
 */
export default function SourceForm({
  editingId,
  selectedType,
  sourceName,
  sourceUrl,
  selectedFile,
  existingFileName,
  selectedTags,
  customTag,
  sourceDescription,
  canSave,
  fileInputRef,
  formCardRef,
  onTypeSelect,
  onNameChange,
  onUrlChange,
  onFileChange,
  onTagToggle,
  onCustomTagChange,
  onAddCustomTag,
  onCustomTagKeyDown,
  onDescriptionChange,
  onSave,
  onCancel,
}: SourceFormProps) {
  return (
    <div ref={formCardRef}>
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
                  onValueChange={(value) => onTypeSelect(value as DataSourceType)}
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
                        <span>Connect System (Use dropdown)</span>
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
                  onChange={(e) => onNameChange(e.target.value)}
                  disabled={!!editingId && selectedType === "url"}
                  className={
                    editingId && selectedType === "url"
                      ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                      : ""
                  }
                />
              </div>
            </div>

            {/* Row 2: URL or File - full width, more prominent */}
            {selectedType === "url" && (
              <div className="space-y-2">
                <Label htmlFor="source-url" className="text-base font-medium">
                  Website URL *
                </Label>
                <Input
                  id="source-url"
                  type="url"
                  placeholder="https://example.com"
                  value={sourceUrl}
                  onChange={(e) => onUrlChange(e.target.value)}
                  className={`text-base ${editingId ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                  disabled={!!editingId}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the full URL of the website you want to add as a data source
                </p>
              </div>
            )}

            {selectedType === "file" && (
              <div className="space-y-2">
                <Label htmlFor="source-file" className="text-base font-medium">
                  Upload File *
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={onFileChange}
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
                    ) : existingFileName ? (
                      <span className="text-foreground font-medium">{existingFileName}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        Click to browse or drag and drop files here
                      </span>
                    )}
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Supported formats: PDF, DOCX, PPTX, CSV, XLSX
                </p>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="source-description">Description</Label>
              <Textarea
                id="source-description"
                placeholder="Brief description of this data source..."
                value={sourceDescription}
                onChange={(e) => onDescriptionChange(e.target.value)}
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
                      onClick={() => onTagToggle(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add custom tag..."
                    value={customTag}
                    onChange={(e) => onCustomTagChange(e.target.value)}
                    onKeyDown={onCustomTagKeyDown}
                    className="max-w-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onAddCustomTag}
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
                          <X className="h-3 w-3 cursor-pointer" onClick={() => onTagToggle(tag)} />
                        </Badge>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={!canSave}>
              <Check className="h-4 w-4 mr-2" />
              {editingId ? "Update" : "Add"} Data Source
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
