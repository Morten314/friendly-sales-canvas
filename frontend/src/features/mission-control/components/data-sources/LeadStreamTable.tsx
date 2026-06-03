import { FileText, Trash2 } from "lucide-react";

import type { LeadStreamFileApiRow } from "../../types";

import { getStatusBadge } from "./dataSourceBadges";
import { getLeadStreamRowStatus, mapProcessingStatusToSourceStatus } from "./leadStreamStatus";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LeadStreamTableProps {
  /** Visible lead-stream rows (already filtered by the container). */
  files: LeadStreamFileApiRow[];
  /** file_id of the row whose delete is in flight (shows the blocking overlay). */
  deletingFileId: string | null;
  /** When the upload card is open, row deletes are disabled. */
  showLeadUpload: boolean;
  /** Delete handler — the write stays in the container. */
  onDeleteFile: (fileId: string) => void;
}

/**
 * Controlled, presentational table of lead-stream files. Renders nothing when
 * `files` is empty (the container's `leadStreamFiles.length > 0` guard moved
 * here verbatim). No writes/business logic live here — the per-row delete button
 * calls `onDeleteFile(row.file_id)`.
 */
export default function LeadStreamTable({
  files,
  deletingFileId,
  showLeadUpload,
  onDeleteFile,
}: LeadStreamTableProps) {
  if (files.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden relative">
      {deletingFileId && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="flex gap-2">
            <div
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "0ms", animationDuration: "1.4s" }}
            />
            <div
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "200ms", animationDuration: "1.4s" }}
            />
            <div
              className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "400ms", animationDuration: "1.4s" }}
            />
          </div>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[140px]">Type</TableHead>
            <TableHead className="min-w-[180px]">File</TableHead>
            <TableHead className="hidden md:table-cell min-w-[160px]">Import</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[90px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((row) => (
            <TableRow key={row.file_id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Lead stream</span>
                </div>
              </TableCell>
              <TableCell>
                <span
                  className="text-sm font-medium truncate max-w-[min(100vw-12rem,28rem)] block"
                  title={row.filename}
                >
                  {row.filename}
                </span>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="text-xs text-muted-foreground">
                  {typeof row.total_rows === "number"
                    ? `${row.created_count ?? 0} / ${row.total_rows} rows`
                    : `${row.created_count ?? 0} created`}
                  {typeof row.error_count === "number" && row.error_count > 0
                    ? ` · ${row.error_count} error${row.error_count === 1 ? "" : "s"}`
                    : ""}
                </span>
              </TableCell>
              <TableCell>
                {getStatusBadge(mapProcessingStatusToSourceStatus(getLeadStreamRowStatus(row)))}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDeleteFile(row.file_id)}
                  disabled={!!deletingFileId || showLeadUpload}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
