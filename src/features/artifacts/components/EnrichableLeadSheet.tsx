// The editable + agentically enrichable lead table inside an Artefact.
//
// Enrichment lives here and nowhere else: Signals stays a fast triage surface,
// while the slow, per-lead work happens in the case file. Columns are not fixed —
// the user asks for the attribute they need ("Phone number", "Talking point",
// or anything typed in), and each cell is filled on demand. Filling one cell
// offers to apply the same request to every remaining row.

import { AlertTriangle, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";

import { ENRICHMENT_SUGGESTIONS, enrichLeads } from "../lib/enrichment";
import type { ArtefactItem } from "../types";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

type Sheet = NonNullable<ArtefactItem["sheet"]>;

interface EnrichableLeadSheetProps {
  sheet: Sheet;
  /** Signal context handed to the agent so values are signal-aware. */
  context?: string;
  editing: boolean;
  apolloConnected: boolean;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onSheetChange: (sheet: Sheet) => void;
}

const cellKey = (row: number, col: number) => `${row}:${col}`;

const findCol = (columns: string[], name: string) =>
  columns.findIndex((c) => c.toLowerCase() === name);

export const EnrichableLeadSheet = ({
  sheet,
  context,
  editing,
  apolloConnected,
  onCellChange,
  onSheetChange,
}: EnrichableLeadSheetProps) => {
  const [customAttribute, setCustomAttribute] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [busyCells, setBusyCells] = useState<Set<string>>(new Set());
  const [busyColumn, setBusyColumn] = useState<string | null>(null);
  /** Pending "apply to all rows?" confirmation after a single-row enrichment. */
  const [applyAll, setApplyAll] = useState<{ colIndex: number; rowIndex: number } | null>(null);

  const enriched = useMemo(() => new Set(sheet.enriched ?? []), [sheet.enriched]);
  const confidence = sheet.confidence ?? {};

  const iName = findCol(sheet.columns, "name");
  const iTitle = findCol(sheet.columns, "title");
  const iCompany = findCol(sheet.columns, "company");
  const iWhy = findCol(sheet.columns, "why");

  const leadFor = (row: string[]) => ({
    name: iName >= 0 ? row[iName] : "",
    title: iTitle >= 0 ? row[iTitle] : "",
    company: iCompany >= 0 ? row[iCompany] : "",
    extra: iWhy >= 0 ? row[iWhy] : "",
  });

  const instructionFor = (attribute: string) =>
    ENRICHMENT_SUGGESTIONS.find((s) => s.attribute === attribute)?.instruction ?? "";

  const needsConnector = (attribute: string) =>
    Boolean(ENRICHMENT_SUGGESTIONS.find((s) => s.attribute === attribute)?.needsConnector);

  const addColumn = (attribute: string) => {
    const name = attribute.trim();
    if (!name) return;
    if (sheet.columns.some((c) => c.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Column already exists", description: `"${name}" is already on the sheet.` });
      return;
    }
    onSheetChange({
      ...sheet,
      columns: [...sheet.columns, name],
      rows: sheet.rows.map((r) => [...r, ""]),
      enriched: [...(sheet.enriched ?? []), name],
    });
    setCustomAttribute("");
    setAddOpen(false);
  };

  const removeColumn = (colIndex: number) => {
    const name = sheet.columns[colIndex];
    const nextConfidence: Record<string, "high" | "medium" | "low"> = {};
    for (const [key, value] of Object.entries(confidence)) {
      const [r, c] = key.split(":").map(Number);
      if (c === colIndex) continue;
      nextConfidence[cellKey(r, c > colIndex ? c - 1 : c)] = value;
    }
    onSheetChange({
      ...sheet,
      columns: sheet.columns.filter((_, i) => i !== colIndex),
      rows: sheet.rows.map((r) => r.filter((_, i) => i !== colIndex)),
      enriched: (sheet.enriched ?? []).filter((c) => c !== name),
      confidence: nextConfidence,
    });
  };

  const runEnrichment = async (colIndex: number, rowIndexes: number[]) => {
    const attribute = sheet.columns[colIndex];
    const keys = rowIndexes.map((r) => cellKey(r, colIndex));
    setBusyCells((prev) => new Set([...prev, ...keys]));
    try {
      const values = await enrichLeads({
        attribute,
        instruction: instructionFor(attribute),
        leads: rowIndexes.map((r) => leadFor(sheet.rows[r])),
        context,
        apolloConnected,
      });
      const rows = sheet.rows.map((row, r) => {
        const at = rowIndexes.indexOf(r);
        if (at === -1) return row;
        return row.map((cell, c) => (c === colIndex ? values[at]?.value ?? cell : cell));
      });
      const nextConfidence = { ...confidence };
      rowIndexes.forEach((r, i) => {
        nextConfidence[cellKey(r, colIndex)] = values[i]?.confidence ?? "low";
      });
      onSheetChange({ ...sheet, rows, confidence: nextConfidence });
      return true;
    } catch (error) {
      toast({
        title: "Enrichment failed",
        description: error instanceof Error ? error.message : "Could not enrich these leads.",
        variant: "destructive",
      });
      return false;
    } finally {
      setBusyCells((prev) => {
        const next = new Set(prev);
        for (const key of keys) next.delete(key);
        return next;
      });
    }
  };

  const enrichCell = async (rowIndex: number, colIndex: number) => {
    const ok = await runEnrichment(colIndex, [rowIndex]);
    // One row done — offer the same request across the rest of the sheet.
    if (ok && sheet.rows.length > 1) setApplyAll({ colIndex, rowIndex });
  };

  const confirmApplyAll = async () => {
    if (!applyAll) return;
    const { colIndex, rowIndex } = applyAll;
    setApplyAll(null);
    const rest = sheet.rows.map((_, i) => i).filter((i) => i !== rowIndex);
    if (rest.length === 0) return;
    setBusyColumn(sheet.columns[colIndex]);
    await runEnrichment(colIndex, rest);
    setBusyColumn(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Add the columns you actually need — each cell is filled on request.
        </p>
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add enrichment column
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-2">
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Suggested
            </p>
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {ENRICHMENT_SUGGESTIONS.map((s) => (
                <button
                  key={s.attribute}
                  type="button"
                  onClick={() => addColumn(s.attribute)}
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                >
                  <span className="min-w-0 flex-1 truncate">{s.attribute}</span>
                  {s.needsConnector && !apolloConnected && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[220px] text-xs">
                        Apollo is not connected — this will be AI-inferred and marked low
                        confidence.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-2 border-t pt-2">
              <Input
                value={customAttribute}
                onChange={(e) => setCustomAttribute(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addColumn(customAttribute);
                }}
                placeholder="Or ask for anything…"
                className="h-8 text-xs"
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full table-fixed border-collapse text-[11px]">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {sheet.columns.map((col, colIndex) => {
                const isEnriched = enriched.has(col);
                return (
                  <th
                    key={col}
                    className={`whitespace-nowrap border-b border-border px-2 py-2 text-left font-semibold ${
                      col === "Why" ? "w-[30%]" : ""
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <span className="truncate">{col}</span>
                      {isEnriched && needsConnector(col) && !apolloConnected && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[220px] text-xs">
                            Apollo is not connected — values here are AI-inferred, not verified.
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {isEnriched && busyColumn === col && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                      {isEnriched && (
                        <button
                          type="button"
                          aria-label={`Remove ${col} column`}
                          onClick={() => removeColumn(colIndex)}
                          className="ml-auto rounded p-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`border-t border-border align-top transition-colors hover:bg-accent/40 ${
                  rowIndex % 2 === 1 ? "bg-muted/30" : ""
                }`}
              >
                {row.map((cell, colIndex) => {
                  const col = sheet.columns[colIndex];
                  const isWhy = col === "Why";
                  const isEnriched = enriched.has(col);
                  const busy = busyCells.has(cellKey(rowIndex, colIndex));
                  const conf = confidence[cellKey(rowIndex, colIndex)];
                  return (
                    <td key={colIndex} className="border-r border-border/60 p-0 last:border-r-0">
                      <div className="relative">
                        <textarea
                          value={cell}
                          rows={isWhy ? 3 : 1}
                          readOnly={!editing && !isEnriched}
                          onChange={(e) => onCellChange(rowIndex, colIndex, e.target.value)}
                          className={`w-full resize-y bg-transparent px-2 py-2 text-[11px] leading-relaxed outline-none ${
                            isEnriched ? "pr-12" : ""
                          } ${
                            editing || isEnriched
                              ? "focus:bg-accent focus:ring-1 focus:ring-primary/40"
                              : "cursor-default"
                          } ${isWhy ? "whitespace-pre-wrap" : ""}`}
                        />
                        {isEnriched && (
                          <div className="absolute right-1 top-1 flex items-center gap-0.5">
                            {conf === "low" && cell && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  Low confidence — verify before using.
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <button
                              type="button"
                              aria-label={`Enrich ${col} for row ${rowIndex + 1}`}
                              disabled={busy}
                              onClick={() => enrichCell(rowIndex, colIndex)}
                              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                            >
                              {busy ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={Boolean(applyAll)} onOpenChange={(open) => !open && setApplyAll(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply to all rows?</AlertDialogTitle>
            <AlertDialogDescription>
              {applyAll
                ? `Fill "${sheet.columns[applyAll.colIndex]}" for the remaining ${
                    sheet.rows.length - 1
                  } lead${sheet.rows.length - 1 === 1 ? "" : "s"} as well?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Just this row</AlertDialogCancel>
            <AlertDialogAction className="text-xs" onClick={confirmApplyAll}>
              Apply to all rows
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EnrichableLeadSheet;
