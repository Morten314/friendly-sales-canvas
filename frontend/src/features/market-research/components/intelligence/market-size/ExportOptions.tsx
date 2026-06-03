import { FileText, Save, Share } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface ExportOptionsProps {
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
}

export function ExportOptions({
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
}: ExportOptionsProps) {
  return (
    <div className="border-t pt-6">
      <h4 className="text-sm font-medium text-gray-900 mb-3">Export Options</h4>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onExportPDF}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Save PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onSaveToWorkspace}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          Save to Workspace
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerateShareableLink}
          className="flex items-center gap-2"
        >
          <Share className="h-4 w-4" />
          Shareable Link
        </Button>
      </div>
    </div>
  );
}
