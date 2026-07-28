/**
 * One-time cleanup of the retired tenant abstraction (spec 46 WS1). Removes any
 * `selectedTenant_*` localStorage keys left by the old TenantProvider; the
 * `org_id_*` / `org_name_*` auth-cache keys are retained. This module is the
 * only place the `selectedTenant` literal survives (success criterion #2).
 */
export function clearStaleTenantKeys(): void {
  const prefix = "selectedTenant_";
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) doomed.push(key);
  }
  // also the legacy non-suffixed key the old clearTenant() used
  doomed.push("selectedTenant");
  doomed.forEach((k) => localStorage.removeItem(k));
}
