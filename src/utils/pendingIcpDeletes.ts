/**
 * When POST /customer_profile lags or the API still returns a deleted row on GET,
 * keep a short-lived client tombstone so the UI stays consistent until the server omits that id.
 */
const storageKey = (uid: string) => `customer_profile_deleted_icp_ids_${uid}`;

export function getPendingDeletedIcpIds(uid: string): string[] {
  try {
    const raw = sessionStorage.getItem(storageKey(uid));
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.map((x) => String(x).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function addPendingDeletedIcpId(uid: string, id: string): void {
  const idStr = String(id).trim();
  if (!idStr) return;
  const prev = getPendingDeletedIcpIds(uid);
  if (prev.includes(idStr)) return;
  try {
    sessionStorage.setItem(storageKey(uid), JSON.stringify([...prev, idStr]));
  } catch {
    /* quota */
  }
}

export function removePendingDeletedIcpId(uid: string, id: string): void {
  const idStr = String(id).trim();
  if (!idStr) return;
  const prev = getPendingDeletedIcpIds(uid);
  const next = prev.filter((x) => x !== idStr);
  try {
    if (next.length === 0) {
      sessionStorage.removeItem(storageKey(uid));
    } else {
      sessionStorage.setItem(storageKey(uid), JSON.stringify(next));
    }
  } catch {
    /* ignore */
  }
}

/** Call after a successful GET: drop tombstones for ids the server no longer returns. */
export function reconcilePendingDeletesWithServerIds(uid: string, serverIcpIds: string[]): void {
  const server = new Set(serverIcpIds.map((x) => String(x).trim()));
  const prev = getPendingDeletedIcpIds(uid);
  const next = prev.filter((id) => server.has(id));
  try {
    if (next.length === 0) {
      sessionStorage.removeItem(storageKey(uid));
    } else {
      sessionStorage.setItem(storageKey(uid), JSON.stringify(next));
    }
  } catch {
    /* ignore */
  }
}

export function filterOutPendingDeletedIcps<T extends { id: string }>(uid: string, icps: T[]): T[] {
  const pending = new Set(getPendingDeletedIcpIds(uid));
  if (pending.size === 0) return icps;
  return icps.filter((icp) => !pending.has(String(icp.id)));
}

/** Reconcile tombstones with server, then hide rows user deleted until server catches up. */
export function finalizeDisplayIcpsForUser<T extends { id: string }>(uid: string, loadedFromApi: T[]): T[] {
  const serverIds = loadedFromApi.map((i) => String(i.id));
  reconcilePendingDeletesWithServerIds(uid, serverIds);
  return filterOutPendingDeletedIcps(uid, loadedFromApi);
}
