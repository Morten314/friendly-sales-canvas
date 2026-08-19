import { FileSpreadsheet, FileText, MoreHorizontal } from "lucide-react";

import { artefactName } from "../lib/artefactName";
import { downloadArtefactCsv, downloadArtefactSheet } from "../lib/artefactStore";
import type { ArtefactItem } from "../types";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ArtefactRowProps {
  artefact: ArtefactItem;
  onOpen: (id: string) => void;
  onRename: (artefact: ArtefactItem) => void;
  onDelete: (id: string) => void;
}

/** One line per stored artefact — storage row, not an agent activity card. */
export const ArtefactRow = ({
  artefact,
  onOpen,
  onRename,
  onDelete,
}: ArtefactRowProps) => {
  const Icon = artefact.sheet ? FileSpreadsheet : FileText;
  const rows = artefact.sheet ? `${artefact.sheet.rows.length} rows` : "Document";

  return (
    <div className="group flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-muted/50">
      <button
        type="button"
        onClick={() => onOpen(artefact.id)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm">{artefactName(artefact)}</span>
        <span className="hidden w-28 shrink-0 text-xs text-muted-foreground sm:block">
          {artefact.taskNumber}
        </span>
        <span className="hidden w-20 shrink-0 text-xs text-muted-foreground md:block">{rows}</span>
        <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
          {artefact.timestamp}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => onOpen(artefact.id)}>Open</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRename(artefact)}>Rename</DropdownMenuItem>
          {artefact.sheet && (
            <DropdownMenuItem onClick={() => downloadArtefactSheet(artefact)}>
              Download CSV
            </DropdownMenuItem>
          )}
          {artefact.csv && (
            <DropdownMenuItem onClick={() => downloadArtefactCsv(artefact)}>
              Download source CSV
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(artefact.id)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
