import type { QueryClient } from "@tanstack/react-query";

import { ResearchComponentSchema, type ResearchComponentResponse } from "../contracts";

import { apiPost } from "@/shared/api/client";
import { qk } from "@/shared/api/queryKeys";

/** Canonical backend component_name values (verified in 5a/5b). */
export const RESEARCH_COMPONENTS = {
  marketSize: "market size & opportunity",
  industryTrends: "industry trends report",
  regulatory: "regulatory & compliance highlights",
  competitor: "competitor landscape",
  marketEntry: "market entry & growth strategy",
} as const;
export type ResearchComponentName = (typeof RESEARCH_COMPONENTS)[keyof typeof RESEARCH_COMPONENTS];

/** Keep 5b section hooks in sync when legacy page fetchers in useMarketResearchData
 *  receive a fresh response. Without this, the console/API layer and the TanStack
 *  cache the sections render from can diverge. */
export function syncResearchComponentToQueryCache(
  queryClient: QueryClient,
  orgId: string,
  componentName: ResearchComponentName,
  response: ResearchComponentResponse,
): void {
  queryClient.setQueryData(qk.marketResearchComponent(orgId, componentName), response);
}

/** @deprecated Use {@link syncResearchComponentToQueryCache} */
export function syncMarketSizeToQueryCache(
  queryClient: QueryClient,
  orgId: string,
  response: ResearchComponentResponse,
): void {
  syncResearchComponentToQueryCache(queryClient, orgId, RESEARCH_COMPONENTS.marketSize, response);
}

/** Fetch one research component (POST `/market-research_claude`). The backend `MarketRequest`
 *  REQUIRES `user_id` and `data`; `org_id` and `refresh` are optional. `data` carries the
 *  org/context fields the LLM needs: the legacy page's per-component fetchers pass a cascade
 *  `previousContext` here (not `{}`); only its all-components cascade sends `{}`. Callers pass
 *  `data` accordingly — 5d–5h decide whether to preserve the cascade (see plan 24b §9). NO
 *  `_cache_bust`/`_cb`/`_r` — memory-only cache replaces hand-rolled busting (ADR-0004).
 *  There is no load-all endpoint: the page hydrates by calling this once per component. */
export function fetchResearchComponent(
  userId: string,
  componentName: ResearchComponentName,
  opts: { orgId?: string; data?: Record<string, unknown>; refresh?: boolean } = {},
): Promise<ResearchComponentResponse> {
  return apiPost(
    "market-research_claude",
    {
      user_id: userId,
      ...(opts.orgId !== undefined && { org_id: opts.orgId }),
      component_name: componentName,
      data: opts.data ?? {},
      refresh: opts.refresh ?? false,
    },
    ResearchComponentSchema,
  );
}
