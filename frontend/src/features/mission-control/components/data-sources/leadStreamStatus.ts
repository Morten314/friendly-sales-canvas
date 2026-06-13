// Pure lead-stream status helpers, lifted from DataSourcesManager so the split
// children (LeadStreamTable) and the container can share them. These are pure
// string→string mappings with no component state/prop closure.

import type { DataSourceStatus, LeadStreamFileApiRow } from "../../types";

/** True once a lead-stream row has reached a terminal processing state. Drives
 *  whether the container keeps polling /leads/stream/status. */
export const isTerminalLeadStreamStatus = (status?: string): boolean => {
  const s = (status || "").toLowerCase().trim();
  return (
    s === "completed" ||
    s === "complete" ||
    s === "failed" ||
    s === "error" ||
    s === "deleted" ||
    s === "success" ||
    s === "succeeded" ||
    s === "done" ||
    s === "finished" ||
    s === "processed" ||
    s === "ready"
  );
};

/** Resolve the effective status string for a lead-stream row, preferring the
 *  tracking_status "deleted" sentinel, then processing_status, then status. */
export const getLeadStreamRowStatus = (row: LeadStreamFileApiRow): string => {
  const ts = (row.tracking_status || "").toLowerCase();
  if (ts === "deleted") return "deleted";
  return row.processing_status ?? row.status ?? "";
};

/** Map a backend processing-status string onto the DataSourceStatus the status
 *  badge renders. */
export const mapProcessingStatusToSourceStatus = (status?: string): DataSourceStatus => {
  const s = (status || "").toLowerCase();
  if (s === "deleted") return "completed";
  if (s === "active") return "active";
  if (
    s === "completed" ||
    s === "complete" ||
    s === "success" ||
    s === "succeeded" ||
    s === "done" ||
    s === "finished" ||
    s === "processed" ||
    s === "ready"
  ) {
    return "completed";
  }
  if (s === "failed" || s === "error") return "failed";
  if (s === "unknown" || s === "processing" || s === "") return "processing";
  return "processing";
};

/** GET /document-status/{file_key} response — unwrap the nested `data.status`
 *  field instead of the API envelope's top-level `status: "success"`. */
export function parseDocumentStatusResponse(payload: {
  status?: string;
  data?: {
    status?: string;
    processing_status?: string;
    chunks_count?: number;
    timestamps?: unknown;
  };
  processing_status?: string;
  chunks_count?: number;
  timestamps?: unknown;
}): { status: DataSourceStatus; chunks_count?: number; timestamps?: unknown } {
  const nested =
    payload.data?.status ?? payload.data?.processing_status ?? payload.processing_status;
  const topLevel =
    payload.status && payload.status !== "success" && payload.status !== "error"
      ? payload.status
      : undefined;
  return {
    status: mapProcessingStatusToSourceStatus(nested ?? topLevel),
    chunks_count: payload.data?.chunks_count ?? payload.chunks_count,
    timestamps: payload.data?.timestamps ?? payload.timestamps,
  };
}

/** Map a user-document list row's status onto DataSourceStatus. */
export function mapDocumentListStatus(
  doc: { status?: string; processing_status?: string; data_source_type?: string },
  type: "file" | "url",
): DataSourceStatus {
  const raw = doc.status ?? doc.processing_status;
  if (type === "url") {
    const mapped = mapProcessingStatusToSourceStatus(raw);
    // URL rows historically render as Active once saved; backend stores "completed".
    return mapped === "completed" ? "active" : mapped;
  }
  return mapProcessingStatusToSourceStatus(raw);
}
