import { Bot, Compass, Satellite, Target } from "lucide-react";
import type { ComponentType } from "react";

import type { ArtefactItem } from "../types";

import { enqueueArtefact } from "./artefactQueue";

/**
 * Persistent artefact library (localStorage). Artefacts saved from Signals must
 * survive reloads and stay until the user deletes them, so they cannot live in
 * the in-memory hand-off queue alone.
 *
 * `agentIcon` is a React component and is not serializable — it is dropped on
 * write and rehydrated from `agentName` on read.
 */
const STORAGE_KEY = "brewra_artefacts_v1";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Scout: Satellite,
  Profiler: Target,
  Strategist: Compass,
};

type StoredArtefact = Omit<ArtefactItem, "agentIcon">;

function readRaw(): StoredArtefact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredArtefact[]) : [];
  } catch (error) {
    console.error("Error reading stored artefacts:", error);
    return [];
  }
}

function writeRaw(items: StoredArtefact[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Error writing stored artefacts:", error);
  }
}

/** Legacy accepted-signal items that must never appear in the Artefacts library. */
function isAcceptedSignal(item: StoredArtefact): boolean {
  return (
    item.taskNumber === "Accepted Signal" ||
    item.id.startsWith("accepted-signal-") ||
    (item.folder ?? "").startsWith("Accepted Signals")
  );
}

/** Columns retired from the lead sheet — stripped from previously stored sheets. */
const DROPPED_SHEET_COLUMNS = ["Email status", "Phone"];

function pruneSheet(item: StoredArtefact): StoredArtefact {
  if (!item.sheet) return item;
  const drop = item.sheet.columns
    .map((c, i) => (DROPPED_SHEET_COLUMNS.includes(c) ? i : -1))
    .filter((i) => i !== -1);
  if (drop.length === 0) return item;
  const keep = (row: string[]) => row.filter((_, i) => !drop.includes(i));
  return {
    ...item,
    sheet: {
      ...item.sheet,
      columns: keep(item.sheet.columns),
      rows: item.sheet.rows.map(keep),
    },
  };
}

/**
 * Newest-first list of persisted artefacts, with icons rehydrated.
 * Accepted signals are excluded: they are a Signals triage collection, not
 * stored work products, and live in the signals feature's own store.
 */
export function loadStoredArtefacts(): ArtefactItem[] {
  const all = readRaw();
  const kept = all.filter((item) => !isAcceptedSignal(item)).map(pruneSheet);
  // Purge legacy accepted signals so they cannot reappear on later loads.
  writeRaw(kept);
  return kept.map((item) => ({
    ...item,
    agentIcon: ICONS[item.agentName] ?? Bot,
  }));
}

/** Persist an artefact (newest first) and hand it to a mounted Artifacts page. */
export function saveArtefact(item: ArtefactItem): void {
  const { agentIcon: _icon, ...rest } = item;
  if (isAcceptedSignal(rest)) return;
  const existing = readRaw().filter((a) => a.id !== item.id);
  writeRaw([rest, ...existing]);
  enqueueArtefact(item);
}

/** Remove one artefact from persistence (manual delete). */
export function deleteStoredArtefact(id: string): void {
  writeRaw(readRaw().filter((a) => a.id !== id));
}

/**
 * Persist an edit to an artefact's editable sheet (cell-level edits from the
 * Artefacts library). No-ops when the artefact is not persisted (e.g. mocks).
 */
export function updateStoredArtefactSheet(id: string, rows: string[][]): void {
  const items = readRaw();
  const index = items.findIndex((a) => a.id === id);
  if (index === -1 || !items[index].sheet) return;
  const next = [...items];
  next[index] = { ...next[index], sheet: { ...next[index].sheet!, rows } };
  writeRaw(next);
}

/** Serialize an editable sheet back to CSV text. */
export function sheetToCsv(columns: string[], rows: string[][]): string {
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [columns, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
}

/** Download an artefact's editable sheet as CSV (reflecting current edits). */
export function downloadArtefactSheet(item: ArtefactItem): void {
  if (!item.sheet) return;
  const csv = sheetToCsv(item.sheet.columns, item.sheet.rows);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = item.sheet.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Download the CSV attached to an artefact, if any. */
export function downloadArtefactCsv(item: ArtefactItem): void {
  if (!item.csv) return;
  const blob = new Blob([`\uFEFF${item.csv.content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = item.csv.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}