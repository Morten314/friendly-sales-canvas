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

/** Newest-first list of persisted artefacts, with icons rehydrated. */
export function loadStoredArtefacts(): ArtefactItem[] {
  return readRaw().map((item) => ({
    ...item,
    agentIcon: ICONS[item.agentName] ?? Bot,
  }));
}

/** Persist an artefact (newest first) and hand it to a mounted Artifacts page. */
export function saveArtefact(item: ArtefactItem): void {
  const { agentIcon: _icon, ...rest } = item;
  const existing = readRaw().filter((a) => a.id !== item.id);
  writeRaw([rest, ...existing]);
  enqueueArtefact(item);
}

/** Remove one artefact from persistence (manual delete). */
export function deleteStoredArtefact(id: string): void {
  writeRaw(readRaw().filter((a) => a.id !== id));
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