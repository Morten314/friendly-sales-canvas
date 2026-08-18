import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Download,
  FileDown,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
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
  onSequenceChange?: (id: string, sequence: NonNullable<ArtefactItem["sequence"]>) => void;
}

/** Full-width file view: the editable sheet gets the whole page. */
export const ArtefactDetail = ({
  artefact,
  onBack,
  onDelete,
  onDownloadPdf,
  onSheetCellChange,
  onSequenceChange,
}: ArtefactDetailProps) => {
  const [tab, setTab] = useState<"sheet" | "sequence" | "briefing">(
    artefact.sheet ? "sheet" : artefact.sequence ? "sequence" : "briefing",
  );
  const [editing, setEditing] = useState(false);
  const showSheet = Boolean(artefact.sheet) && tab === "sheet";
  const showSequence = Boolean(artefact.sequence) && tab === "sequence";
  const sequence = artefact.sequence ?? [];

  const commitSequence = (next: NonNullable<ArtefactItem["sequence"]>) =>
    onSequenceChange?.(artefact.id, next);

  const patchTouch = (index: number, patch: Partial<(typeof sequence)[number]>) =>
    commitSequence(sequence.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  const moveTouch = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= sequence.length) return;
    const next = [...sequence];
    [next[index], next[target]] = [next[target], next[index]];
    commitSequence(next);
  };

  const removeTouch = (index: number) =>
    commitSequence(sequence.filter((_, i) => i !== index));

  const addTouch = () =>
    commitSequence([
      ...sequence,
      {
        day: (sequence[sequence.length - 1]?.day ?? 0) + 2,
        channel: "email",
        action: "New step",
        subject: "",
        body: "",
      },
    ]);

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

    {(artefact.sheet || artefact.sequence) && (
      <div className="flex w-fit items-center gap-1 rounded-md border bg-muted/40 p-0.5">
        {(
          [
            ...(artefact.sheet ? (["sheet"] as const) : []),
            ...(artefact.sequence ? (["sequence"] as const) : []),
            "briefing",
          ] as const
        ).map((key) => (
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
            {key === "sheet" ? "Lead sheet" : key === "sequence" ? "Sequence" : "Briefing"}
          </button>
        ))}
      </div>
    )}

    {showSequence ? (
      <div className="space-y-3">
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
            Outreach sequence
          </p>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={addTouch}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add step
          </Button>
        </div>

        <ol className="space-y-2">
          {sequence.map((touch, index) => (
            <li key={index} className="rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Day
                </label>
                <input
                  type="number"
                  value={touch.day}
                  onChange={(e) => patchTouch(index, { day: Number(e.target.value) || 0 })}
                  className="h-7 w-14 rounded border bg-background px-1.5 text-xs"
                />
                <input
                  value={touch.channel}
                  onChange={(e) => patchTouch(index, { channel: e.target.value })}
                  placeholder="Channel"
                  className="h-7 w-28 rounded border bg-background px-1.5 text-xs"
                />
                <input
                  value={touch.action}
                  onChange={(e) => patchTouch(index, { action: e.target.value })}
                  placeholder="Action"
                  className="h-7 min-w-0 flex-1 rounded border bg-background px-1.5 text-xs"
                />
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    aria-label="Move step up"
                    onClick={() => moveTouch(index, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    aria-label="Move step down"
                    onClick={() => moveTouch(index, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive"
                    aria-label="Remove step"
                    onClick={() => removeTouch(index)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <input
                value={touch.subject ?? ""}
                onChange={(e) => patchTouch(index, { subject: e.target.value })}
                placeholder="Subject"
                className="mt-2 w-full rounded border bg-background px-2 py-1 text-xs font-medium"
              />
              <textarea
                value={touch.body}
                onChange={(e) => patchTouch(index, { body: e.target.value })}
                rows={Math.min(14, Math.max(4, touch.body.split("\n").length + 1))}
                placeholder="Message"
                className="mt-2 w-full resize-y whitespace-pre-wrap rounded border bg-background px-2 py-1 text-xs leading-relaxed"
              />
            </li>
          ))}
        </ol>
      </div>
    ) : showSheet && artefact.sheet ? (
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
