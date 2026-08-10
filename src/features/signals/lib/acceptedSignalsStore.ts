import { Bot, Compass, Satellite, Target } from "lucide-react";
import type { ComponentType } from "react";

import type { ArtefactItem } from "@/features/artifacts";

/**
 * Accepted signals live in their own Signals-owned localStorage collection.
 * They are NOT artefacts: Artefacts is structured storage for saved work
 * products (lead sheets), while an accepted signal is a triage bookmark that
 * belongs to the Signals "Accepted" tab only.
 *
 * `agentIcon` is a React component and is not serializable — it is dropped on
 * write and rehydrated from `agentName` on read.
 */
const STORAGE_KEY = "brewra_accepted_signals_v1";
/** Legacy home of accepted signals — drained once so old items are not lost. */
const LEGACY_ARTEFACT_KEY = "brewra_artefacts_v1";
const LEGACY_TASK = "Accepted Signal";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Scout: Satellite,
  Profiler: Target,
  Strategist: Compass,
};

type StoredAcceptedSignal = Omit<ArtefactItem, "agentIcon">;

function readRaw(key: string): StoredAcceptedSignal[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredAcceptedSignal[]) : [];
  } catch (error) {
    console.error("Error reading accepted signals:", error);
    return [];
  }
}

function writeRaw(key: string, items: StoredAcceptedSignal[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (error) {
    console.error("Error writing accepted signals:", error);
  }
}

/** Move any accepted signals still filed under the artefact key into this store. */
function migrateLegacy(): StoredAcceptedSignal[] {
  const legacy = readRaw(LEGACY_ARTEFACT_KEY);
  const accepted = legacy.filter((a) => a.taskNumber === LEGACY_TASK);
  if (accepted.length === 0) return readRaw(STORAGE_KEY);

  writeRaw(
    LEGACY_ARTEFACT_KEY,
    legacy.filter((a) => a.taskNumber !== LEGACY_TASK),
  );
  const current = readRaw(STORAGE_KEY);
  const known = new Set(current.map((a) => a.id));
  const merged = [...accepted.filter((a) => !known.has(a.id)), ...current];
  writeRaw(STORAGE_KEY, merged);
  return merged;
}

/** Newest-first list of accepted signals, with icons rehydrated. */
export function loadAcceptedSignals(): ArtefactItem[] {
  return migrateLegacy().map((item) => ({
    ...item,
    agentIcon: ICONS[item.agentName] ?? Bot,
  }));
}

/** Star a signal: add it to the Accepted collection (newest first). */
export function saveAcceptedSignal(item: ArtefactItem): void {
  const { agentIcon: _icon, ...rest } = item;
  writeRaw(STORAGE_KEY, [rest, ...readRaw(STORAGE_KEY).filter((a) => a.id !== item.id)]);
}

/** Un-star a signal: remove it from the Accepted collection. */
export function deleteAcceptedSignal(id: string): void {
  writeRaw(
    STORAGE_KEY,
    readRaw(STORAGE_KEY).filter((a) => a.id !== id),
  );
}
