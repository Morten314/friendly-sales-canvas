import { useAuth } from "./AuthContext";

/**
 * Single source of truth for the current org id. Backed by AuthContext, which
 * treats GET /org as authoritative (see spec 46 WS2). Never resolves from a
 * persisted tenant. Returns null until auth resolves.
 */
export function useOrgId(): string | null {
  return useAuth().orgId;
}
