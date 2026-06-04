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
  return "processing";
};
