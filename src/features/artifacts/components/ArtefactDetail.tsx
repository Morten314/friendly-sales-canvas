import { ChevronLeft, Download, FileDown, Pencil, Send, Trash2 } from "lucide-react";
import { useState } from "react";

import { ArtefactReport } from "./ArtefactReport";
import { artefactName } from "../lib/artefactName";
import { downloadArtefactSheet } from "../lib/artefactStore";
import { shareArtefactByEmail } from "../lib/artefactShare";
import type { ArtefactItem } from "../types";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ArtefactDetailProps {
  artefact: ArtefactItem;
  onBack: () => void;
  onDelete: (id: string) => void;
  onDownloadPdf: (artefact: ArtefactItem) => void;
  onSheetCellChange?: (id: string, rowIndex: number, colIndex: number, value: string) => void;
}

/** Full-width file view: the editable sheet gets the whole page. */
export const ArtefactDetail = ({
  artefact,
  onBack,
  onDelete,
  onDownloadPdf,
  onSheetCellChange,
}: ArtefactDetailProps) => {
  const [tab, setTab] = useState<"sheet" | "briefing">(artefact.sheet ? "sheet" : "briefing");
  const [editing, setEditing] = useState(false);
  const showSheet = Boolean(artefact.sheet) && tab === "sheet";

  return (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {artefact.folder ?? "Artefacts"}
        </button>
        <h2 className="truncate text-lg font-semibold">{artefactName(artefact)}</h2>
        <p className="text-xs text-muted-foreground">
          {artefact.taskNumber} · {artefact.timestamp}
          {artefact.sheet ? ` · ${artefact.sheet.rows.length} rows` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {artefact.sheet && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => downloadArtefactSheet(artefact)}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download CSV
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onDownloadPdf(artefact)}
        >
          <FileDown className="mr-1.5 h-3.5 w-3.5" />
          Download briefing (PDF)
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-destructive"
          onClick={() => onDelete(artefact.id)}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </div>

    {artefact.sheet && (
      <div className="flex w-fit items-center gap-1 rounded-md border bg-muted/40 p-0.5">
        {(["sheet", "briefing"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded px-3 py-1 text-xs transition-colors ${
              tab === key
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {key === "sheet" ? "Lead sheet" : "Briefing"}
          </button>
        ))}
      </div>
    )}

    {showSheet && artefact.sheet ? (
      <div className="space-y-3">
        {/* Chronological record: signal → blurb → leads table */}
        <div className="rounded-lg border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Signal
          </p>
          <h3 className="mt-1 text-sm font-semibold">{artefact.fullReport.title}</h3>
          {(artefact.contextRationale || artefact.fullReport.executiveSummary) && (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {artefact.contextRationale || artefact.fullReport.executiveSummary}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Leads table
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant={editing ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {editing ? "Done" : "Edit"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Send
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => shareArtefactByEmail("gmail", artefact)}>
                  Gmail
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => shareArtefactByEmail("outlook", artefact)}>
                  Outlook
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
        <table className="w-full table-fixed border-collapse text-[11px]">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {artefact.sheet.columns.map((col) => (
                <th
                  key={col}
                  className={`whitespace-nowrap border-b border-border px-2 py-2 text-left font-semibold ${
                    col === "Why" ? "w-[34%]" : ""
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {artefact.sheet.rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`align-top border-t border-border transition-colors hover:bg-accent/40 ${
                  rowIndex % 2 === 1 ? "bg-muted/30" : ""
                }`}
              >
                {row.map((cell, colIndex) => {
                  const isWhy = artefact.sheet?.columns[colIndex] === "Why";
                  return (
                    <td key={colIndex} className="border-r border-border/60 p-0 last:border-r-0">
                      <textarea
                        value={cell}
                        rows={isWhy ? 3 : 1}
                        readOnly={!editing}
                        onChange={(e) =>
                          onSheetCellChange?.(artefact.id, rowIndex, colIndex, e.target.value)
                        }
                        className={`w-full resize-y bg-transparent px-2 py-2 text-[11px] leading-relaxed outline-none ${
                          editing
                            ? "focus:bg-accent focus:ring-1 focus:ring-primary/40"
                            : "cursor-default"
                        } ${
                          isWhy ? "whitespace-pre-wrap" : ""
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    ) : (
      <ArtefactReport artefact={artefact} />
    )}
  </div>
  );
};
