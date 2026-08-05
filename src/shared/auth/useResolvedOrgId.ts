import { useAuthToken } from "./useAuthToken";

/**
 * Resolves the org id for API calls without racing ahead of GET /org on login.
 * While org is loading, `orgIdForApi` is null — callers must not fetch/save yet.
 * After load, falls back to legacy "brewra" only if the user has no org record.
 */
export function useResolvedOrgId() {
  const { orgId, orgLoading, currentUser } = useAuthToken();
  const isOrgReady = !orgLoading;
  const orgIdForApi = orgId ?? (isOrgReady ? "brewra" : null);

  return {
    orgId,
    orgLoading,
    isOrgReady,
    orgIdForApi,
    currentUser,
    canCallOrgScopedApi: Boolean(currentUser?.uid && orgIdForApi && isOrgReady),
  };
}
