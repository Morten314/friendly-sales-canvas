import { ChevronRight, FileText, FolderOpen, Mail } from "lucide-react";

import type { ArtefactItem } from "../types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface FolderGridProps {
  folders: string[];
  activeFolder: string | null;
  onFolderSelect: (folder: string | null) => void;
  artefacts: ArtefactItem[];
}

export const FolderGrid = ({
  folders,
  activeFolder,
  onFolderSelect,
  artefacts,
}: FolderGridProps) => {
  return (
    <>
      {/* Folders */}
      {folders.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={activeFolder === null ? "default" : "outline"}
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => onFolderSelect(null)}
          >
            <FileText className="h-3.5 w-3.5" />
            All Artefacts
          </Button>
          {folders.map((folder) => {
            const count = artefacts.filter((a) => a.folder === folder).length;
            return (
              <Button
                key={folder}
                variant={activeFolder === folder ? "default" : "outline"}
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => onFolderSelect(folder)}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                {folder}
                <Badge variant="secondary" className="text-[10px] ml-1 px-1.5 py-0">
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>
      )}

      {/* Active folder header */}
      {activeFolder && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={() => onFolderSelect(null)}
            className="hover:text-foreground transition-colors"
          >
            Artefacts
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            {activeFolder}
          </span>
        </div>
      )}
    </>
  );
};
