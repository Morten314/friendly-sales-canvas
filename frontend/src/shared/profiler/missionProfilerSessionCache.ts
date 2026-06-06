/**
 * In-memory session cache for Mission Control (GET /profile/company aggregate) and
 * Profiler (ICP lists + suggested cards). Survives route changes; resets on user/org change.
 *
 * Invalidate Mission Control when Profiler mutates customer profile (ICP accept/delete/etc.).
 * Invalidate Profiler when Mission Control saves company or customer profile.
 */

type ProfilerSessionSnapshot = {
  existingICPs: unknown[];
  refinedICPs: unknown[];
  newICPs: unknown[];
  cardStatuses: Record<string, unknown>;
};

type Scope = { uid: string; orgId: string };

let scope: Scope | null = null;

let missionValid = false;
let missionCompanyJson: Record<string, unknown> | null = null;

let profilerValid = false;
let profilerSnapshot: ProfilerSessionSnapshot | null = null;

function sameScope(uid: string, orgId: string): boolean {
  return scope !== null && scope.uid === uid && scope.orgId === orgId;
}

/** Call whenever uid or org changes (login, tenant switch). */
export function ensureMissionProfilerScope(uid: string, orgId: string): void {
  if (sameScope(uid, orgId)) return;
  scope = { uid, orgId };
  missionValid = false;
  missionCompanyJson = null;
  profilerValid = false;
  profilerSnapshot = null;
}

export function isMissionControlCacheValid(uid: string, orgId: string): boolean {
  ensureMissionProfilerScope(uid, orgId);
  return missionValid && missionCompanyJson !== null;
}

export function getMissionControlCompanyProfileJson(
  uid: string,
  orgId: string,
): Record<string, unknown> | null {
  if (!sameScope(uid, orgId) || !missionValid) return null;
  return missionCompanyJson;
}

export function commitMissionControlCompanyProfile(
  uid: string,
  orgId: string,
  data: Record<string, unknown>,
): void {
  ensureMissionProfilerScope(uid, orgId);
  missionCompanyJson = { ...data };
  missionValid = true;
}

export function invalidateMissionControlCache(uid: string, orgId: string): void {
  ensureMissionProfilerScope(uid, orgId);
  missionValid = false;
  missionCompanyJson = null;
}

export function isProfilerCacheValid(uid: string, orgId: string): boolean {
  ensureMissionProfilerScope(uid, orgId);
  return profilerValid && profilerSnapshot !== null;
}

export function getProfilerSnapshot(uid: string, orgId: string): ProfilerSessionSnapshot | null {
  if (!sameScope(uid, orgId) || !profilerValid || !profilerSnapshot) return null;
  return profilerSnapshot;
}

export function commitProfilerSnapshot(
  uid: string,
  orgId: string,
  snapshot: ProfilerSessionSnapshot,
): void {
  ensureMissionProfilerScope(uid, orgId);
  profilerSnapshot = {
    existingICPs: snapshot.existingICPs,
    refinedICPs: snapshot.refinedICPs,
    newICPs: snapshot.newICPs,
    cardStatuses: { ...snapshot.cardStatuses },
  };
  profilerValid = true;
}

export function invalidateProfilerCache(uid: string, orgId: string): void {
  ensureMissionProfilerScope(uid, orgId);
  profilerValid = false;
  profilerSnapshot = null;
}
