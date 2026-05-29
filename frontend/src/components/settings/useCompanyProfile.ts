import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ZodError } from "zod";

import { apiGet, apiPost } from "@/shared/api/client";
import {
  CompanyProfileSaveResponseSchema,
  CompanyProfileSchema,
  type CompanyProfileResponse,
} from "@/shared/api/contracts";
import { qk } from "@/shared/api/queryKeys";

/**
 * Reads GET /api/profile/company?org_id=… via the shared client + zod.
 * Tolerance preserved: a ZodError (response drift) surfaces to `error`; any other
 * failure — including HTTP 5xx, network, and CORS errors — resolves to `null` → the
 * component renders the empty form, exactly as the old bare-fetch path did for "no
 * profile yet" (spec 20 §3.6). A genuine server outage is therefore shown as an empty
 * form, not an error state — matching pre-migration behavior.
 */
export function useCompanyProfile(orgId: string, enabled = true) {
  return useQuery<CompanyProfileResponse | null>({
    queryKey: qk.companyProfile(orgId),
    enabled,
    queryFn: async () => {
      try {
        return await apiGet(
          `profile/company?org_id=${encodeURIComponent(orgId)}`,
          CompanyProfileSchema,
        );
      } catch (e) {
        if (e instanceof ZodError) throw e;
        return null;
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
