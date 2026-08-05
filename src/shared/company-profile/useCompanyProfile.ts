import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ZodError } from "zod";

import { apiGet, apiPost } from "@/shared/api/client";
import {
  CompanyProfileSaveResponseSchema,
  CompanyProfileSchema,
  type CompanyProfileResponse,
} from "@/shared/api/contracts";
import { qk } from "@/shared/api/queryKeys";

export interface UseCompanyProfileOptions {
  userId?: string | null;
  enabled?: boolean;
}

function buildCompanyProfileEndpoint(orgId: string, userId?: string | null): string {
  const params = new URLSearchParams({ org_id: orgId });
  if (userId) {
    params.set("user_id", userId);
  }
  return `profile/company?${params.toString()}`;
}

/**
 * Reads GET /api/profile/company?org_id=…&user_id=… via the shared client + zod.
 * Tolerance preserved: a ZodError (response drift) surfaces to `error`; any other
 * failure — including HTTP 5xx, network, and CORS errors — resolves to `null` → the
 * component renders the empty form, exactly as the old bare-fetch path did for "no
 * profile yet" (spec 20 §3.6). A genuine server outage is therefore shown as an empty
 * form, not an error state — matching pre-migration behavior.
 */
export function useCompanyProfile(
  orgId: string,
  options: UseCompanyProfileOptions | boolean = true,
) {
  const opts: UseCompanyProfileOptions =
    typeof options === "boolean" ? { enabled: options } : options;
  const userId = opts.userId ?? null;
  const enabled = (opts.enabled ?? true) && orgId.length > 0;

  return useQuery<CompanyProfileResponse | null>({
    queryKey: qk.companyProfile(orgId, userId ?? undefined),
    enabled,
    queryFn: async () => {
      try {
        return await apiGet(
          buildCompanyProfileEndpoint(orgId, userId),
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
export function useSaveCompanyProfile(orgId: string, userId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost(
        buildCompanyProfileEndpoint(orgId, userId),
        payload,
        CompanyProfileSaveResponseSchema,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.companyProfile(orgId, userId ?? undefined) });
    },
  });
}
