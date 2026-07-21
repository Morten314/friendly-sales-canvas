import { CheckCircle, Clock, Edit, FileText, Lightbulb, Trash2 } from "lucide-react";
import type { MouseEvent } from "react";

import { getStatusIcon, getTypeIcon } from "../lib/artefactPresentation";
import type { ArtefactItem } from "../types";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface LibraryCardProps {
  artefact: ArtefactItem;
  expandedArtefact: string | null;
  editingArtefact: string | null;
  editName: string;
  onArtefactClick: (id: string) => void;
  onEditClick: (artefact: ArtefactItem, event: MouseEvent) => void;
  onDeleteClick: (id: string, event: MouseEvent) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDownloadClick: (artefact: ArtefactItem) => void;
  onEditNameChange: (value: string) => void;
}

// Library Card Component (Compact view)
export const LibraryCard = ({
  artefact,
  expandedArtefact,
  editingArtefact,
  editName,
  onArtefactClick,
  onEditClick,
  onDeleteClick,
  onSaveEdit,
  onCancelEdit,
  onDownloadClick,
  onEditNameChange,
}: LibraryCardProps) => {
  const TypeIcon = getTypeIcon(artefact.type);
  const isExpanded = expandedArtefact === artefact.id;
  const isEditing = editingArtefact === artefact.id;

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${isExpanded ? "ring-2 ring-primary/20" : ""}`}
    >
      <CardContent className="p-4">
        {/* Library View - Compact */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className={`text-white text-sm font-medium ${artefact.agentColor}`}>
              <artefact.agentIcon className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">{artefact.agentName}</span>
              <TypeIcon className="h-3 w-3 text-muted-foreground" />
              {getStatusIcon(artefact.status)}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{artefact.taskNumber}</span>
              <span>•</span>
              <Clock className="h-3 w-3" />
              <span>{artefact.timestamp}</span>
            </div>
          </div>
          {/* Edit and Delete Icons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => onEditClick(artefact, e)}
              className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => onDeleteClick(artefact.id, e)}
              className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <Input
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              className="text-sm font-semibold"
              placeholder="Enter report title"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onSaveEdit(artefact.id)}
                className="h-6 px-2 text-xs"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onCancelEdit}
                className="h-6 px-2 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start p-0 h-auto font-normal"
            onClick={() => onArtefactClick(artefact.id)}
          >
            <span className="text-sm text-left truncate">{artefact.actionDelegated}</span>
          </Button>
        )}

        {/* Expanded View */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* Context & Rationale */}
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-700 mb-1">Context & Rationale</p>
                <p className="text-sm text-muted-foreground">{artefact.contextRationale}</p>
              </div>
            </div>

            {/* System Impact */}
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-700 mb-1">System Impact</p>
                <p className="text-sm text-muted-foreground">{artefact.systemImpact}</p>
              </div>
            </div>

            {/* Action Performed - File Preview */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">Action Performed</h4>
              </div>

              <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-sm">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-semibold text-sm mb-1 hover:text-primary transition-colors cursor-pointer truncate"
                      onClick={() => onDownloadClick(artefact)}
                    >
                      {artefact.fullReport.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                      {artefact.outputSummary}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>PDF • 12 pages</span>
                      <span>•</span>
                      <span>{artefact.timestamp}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
