import type { DataSource } from "../../types";

const dataSourcesStorageKey = (userId: string) => `data_sources_dismissed_${userId}`;
const leadStreamStorageKey = (userId: string) => `lead_stream_dismissed_${userId}`;

function readDismissedSet(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function writeDismissedSet(storageKey: string, ids: Set<string>): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...ids]));
  } catch {
    // ignore quota / private-mode errors
  }
}

export function collectDataSourceDismissKeys(
  source: Pick<DataSource, "id" | "fileId" | "fileKey">,
): string[] {
  return [source.fileId, source.id, source.fileKey].filter((key): key is string => !!key);
}

export function getDismissedDataSourceKeys(userId: string): Set<string> {
  if (!userId) return new Set();
  return readDismissedSet(dataSourcesStorageKey(userId));
}

export function rememberDismissedDataSource(
  userId: string,
  source: Pick<DataSource, "id" | "fileId" | "fileKey">,
): void {
  if (!userId) return;
  const storageKey = dataSourcesStorageKey(userId);
  const dismissed = readDismissedSet(storageKey);
  for (const key of collectDataSourceDismissKeys(source)) {
    dismissed.add(key);
  }
  writeDismissedSet(storageKey, dismissed);
}

export function isDataSourceDismissed(
  source: Pick<DataSource, "id" | "fileId" | "fileKey">,
  dismissed: Set<string>,
): boolean {
  return collectDataSourceDismissKeys(source).some((key) => dismissed.has(key));
}

export function getDismissedLeadStreamFileIds(userId: string): Set<string> {
  if (!userId) return new Set();
  return readDismissedSet(leadStreamStorageKey(userId));
}

export function rememberDismissedLeadStreamFile(userId: string, fileId: string): void {
  if (!userId || !fileId) return;
  const storageKey = leadStreamStorageKey(userId);
  const dismissed = readDismissedSet(storageKey);
  dismissed.add(fileId);
  writeDismissedSet(storageKey, dismissed);
}

export function pruneDismissedLeadStreamFileIds(userId: string, idsStillInApi: Set<string>): void {
  if (!userId) return;
  const storageKey = leadStreamStorageKey(userId);
  const dismissed = readDismissedSet(storageKey);
  let changed = false;
  for (const id of [...dismissed]) {
    if (!idsStillInApi.has(id)) {
      dismissed.delete(id);
      changed = true;
    }
  }
  if (changed) {
    writeDismissedSet(storageKey, dismissed);
  }
}
