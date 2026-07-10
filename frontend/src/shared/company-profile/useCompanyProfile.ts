import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ZodError } from "zod";

import { apiGet, apiPost } from "@/shared/api/client";
import {
  CompanyProfileSaveResponseSchema,
  CompanyProfileSchema,
  type CompanyProfileResponse,
} from "@/shared/api/contracts";
import { qk } from "@/shared/api/queryKeys";

/** True when the transport's `HTTP error! status: NNN …` Error is a 404 — a
 *  genuine "no profile yet" — vs. a transient 5xx/network/CORS failure. Mirrors
 *  the isRecommendedDeleteNotFound house pattern. */
function isHttpNotFound(e: unknown): boolean {
  return e instanceof Error && (/\b404\b/.test(e.message) || /not found/i.test(e.message));
}

/**
 * Reads GET /api/profile/company?org_id=… via the shared client + zod.
 * A genuine 404 (or "not found" message) resolves to `null` → the component
 * renders the empty form, exactly as the old bare-fetch path did for "no
 * profile yet" (spec 20 §3.6). A ZodError (response drift) surfaces to `error`.
 * Any other failure — HTTP 5xx, network, and CORS errors — now also surfaces to
 * `error` (retried once by the shared queryClient, keeping last-known data)
 * instead of being swallowed to `null`, so a transient outage is never shown as
 * a blank form (spec 48 WS4 / Ishani bug #5). Deferred until `orgId` resolves
 * (spec 48 WS1c).
 */
export function useCompanyProfile(orgId: string, enabled = true) {
  return useQuery<CompanyProfileResponse | null>({
    queryKey: qk.companyProfile(orgId),
    enabled: enabled && !!orgId, // spec 48 WS1c: defer until org resolves
    queryFn: async () => {
      try {
        return await apiGet(
          `profile/company?org_id=${encodeURIComponent(orgId)}`,
          CompanyProfileSchema,
        );
      } catch (e) {
        if (e instanceof ZodError) throw e;
        if (isHttpNotFound(e)) return null; // no profile yet → empty form
        throw e; // 5xx / network / CORS → surface as error, never a blank form
      }
    },
  });
}

/**
 * POSTs the save payload via the shared client. onSuccess invalidates the
 * company-profile query so it refetches. The component owns the cross-component
 * side effects (localStorage publish + CustomEvent) — see CompanyProfile.tsx.
 */
export function useSaveCompanyProfile(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost(
        `profile/company?org_id=${encodeURIComponent(orgId)}`,
        payload,
        CompanyProfileSaveResponseSchema,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.companyProfile(orgId) });
    },
  });
}
