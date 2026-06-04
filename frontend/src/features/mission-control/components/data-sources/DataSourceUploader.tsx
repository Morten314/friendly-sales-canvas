import { Upload, X } from "lucide-react";
import type React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface DataSourceUploaderProps {
  /** Currently selected lead file (drives the dropzone label + upload-button enablement). */
  selectedLeadFile: File | null;
  /** Whether a file is being dragged over the dropzone. */
  isDraggingLead: boolean;
  /** Whether an upload is in flight (drives the button label + disabled state). */
  isUploadingLeads: boolean;
  /** Ref for the hidden file input. */
  leadFileInputRef: React.RefObject<HTMLInputElement>;
  /** Close the uploader card (the X and Cancel buttons share this). */
  onClose: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void | Promise<void>;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onUpload: () => void | Promise<void>;
}

/**
 * Controlled, presentational lead-upload card (drag-drop zone, file input,
 * close X, upload button). The entire upload pipeline
 * (validate/convert/POST/refresh) stays in the container — this child only
 * renders JSX and wires the prop callbacks.
 */
export default function DataSourceUploader({
  selectedLeadFile,
  isDraggingLead,
  isUploadingLeads,
  leadFileInputRef,
  onClose,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileInputChange,
  onUpload,
}: DataSourceUploaderProps) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Add leads</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-csv-upload" className="text-base font-medium">
            Lead file (CSV, XLSX, or XLS) *
          </Label>
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className="flex items-center gap-2"
          >
            <input
              ref={leadFileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={onFileInputChange}
              className="hidden"
              id="lead-csv-upload"
            />
            <label
              htmlFor="lead-csv-upload"
              className={`flex-1 inline-flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors bg-muted/20 ${
                isDraggingLead ? "border-primary bg-primary/5" : ""
              }`}
            >
              <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
              {selectedLeadFile ? (
                <span className="text-foreground font-medium truncate">
                  {selectedLeadFile.name}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Click to browse or drag and drop a CSV, XLSX, or XLS file here
                </span>
              )}
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Excel workbooks are parsed on the server. CSV files are checked in the browser before
            upload.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onUpload} disabled={!selectedLeadFile || isUploadingLeads}>
            {isUploadingLeads ? "Uploading..." : "Add leads"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
