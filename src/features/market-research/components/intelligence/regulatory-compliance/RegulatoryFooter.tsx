import { ChevronDown, ChevronUp, Clock, FileText, Save, Share, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface RegulatoryFooterProps {
  isEditing: boolean;
  isExpanded: boolean;
  isSplitView: boolean;
  onSave: () => void;
  onCancelEdit: () => void;
  onEditHistoryOpen: () => void;
  onExportPDF: () => void;
  onSaveToWorkspace: () => void;
  onGenerateShareableLink: () => void;
  onExpandToggle: (expanded: boolean) => void;
}

export function RegulatoryFooter({
  isEditing,
  isExpanded,
  isSplitView,
  onSave,
  onCancelEdit,
  onEditHistoryOpen,
  onExportPDF,
  onSaveToWorkspace,
  onGenerateShareableLink,
  onExpandToggle,
}: RegulatoryFooterProps) {
  if (isEditing) {
    return (
      /* Save/Cancel buttons and Edit History - positioned at bottom */
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <div className="flex gap-3">
          <Button onClick={onSave} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
          <Button variant="outline" onClick={onCancelEdit}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>

        {/* Edit History Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onEditHistoryOpen}
          className="flex items-center gap-2 hover:bg-gray-50"
          title="View changes made to this report"
        >
          <Clock className="h-4 w-4" />
          Edit History
        </Button>
      </div>
    );
  }

  if (!isExpanded) {
    return (
      <div className="flex justify-center pt-4">
        <Button
          onClick={() => onExpandToggle(true)}
          variant="outline"
          className="flex items-center space-x-2 text-sm hover:bg-gray-50"
        >
          <span>Read More</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Export Options */}
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

      {/* Show Less Button - Only when not in split view */}
      {!isSplitView && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => onExpandToggle(false)}
            variant="outline"
            className="flex items-center space-x-2 text-sm"
          >
            <span>Show Less</span>
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}
