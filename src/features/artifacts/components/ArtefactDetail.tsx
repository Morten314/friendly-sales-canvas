import { ChevronLeft, Download, FileDown, Trash2 } from "lucide-react";

import { artefactName } from "../lib/artefactName";
import { downloadArtefactSheet } from "../lib/artefactStore";
import type { ArtefactItem } from "../types";

import { Button } from "@/components/ui/button";

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
}: ArtefactDetailProps) => (
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
          PDF
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

    {artefact.sheet ? (
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full table-fixed text-[11px]">
          <thead className="bg-muted">
            <tr>
              {artefact.sheet.columns.map((col) => (
                <th
                  key={col}
                  className={`whitespace-nowrap px-2 py-2 text-left font-medium ${
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
              <tr key={rowIndex} className="border-t align-top">
                {row.map((cell, colIndex) => {
                  const isWhy = artefact.sheet?.columns[colIndex] === "Why";
                  return (
                    <td key={colIndex} className="p-0">
                      <textarea
                        value={cell}
                        rows={isWhy ? 3 : 1}
                        onChange={(e) =>
                          onSheetCellChange?.(artefact.id, rowIndex, colIndex, e.target.value)
                        }
                        className={`w-full resize-y bg-transparent px-2 py-1.5 text-[11px] leading-snug outline-none focus:bg-accent focus:ring-1 focus:ring-primary/40 ${
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
    ) : (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        {artefact.outputSummary}
      </div>
    )}
  </div>
);
