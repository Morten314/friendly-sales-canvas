import { ResearchComponentSchema, type ResearchComponentResponse } from "../contracts";

import { apiPost } from "@/shared/api/client";

/** Canonical backend component_name values (verified in 5a/5b). */
export const RESEARCH_COMPONENTS = {
  marketSize: "market size & opportunity",
  industryTrends: "industry trends report",
  regulatory: "regulatory & compliance highlights",
  competitor: "competitor landscape",
  marketEntry: "market entry & growth strategy",
} as const;
export type ResearchComponentName =
  (typeof RESEARCH_COMPONENTS)[keyof typeof RESEARCH_COMPONENTS];

/** Fetch one research component (POST `/market-research`). The backend `MarketRequest`
 *  REQUIRES `user_id` and `data`; `org_id` and `refresh` are optional. `data` carries the
 *  org/context fields the LLM needs — the page currently sends `data: {}` (empty). NO
 *  `_cache_bust`/`_cb`/`_r` — memory-only cache replaces hand-rolled busting (ADR-0004).
 *  There is no load-all endpoint: the page hydrates by calling this once per component. */
export function fetchResearchComponent(
  userId: string,
  componentName: ResearchComponentName,
  opts: { orgId?: string; data?: Record<string, unknown>; refresh?: boolean } = {},
): Promise<ResearchComponentResponse> {
  return apiPost(
    "market-research",
    {
      user_id: userId,
      org_id: opts.orgId,
      component_name: componentName,
      data: opts.data ?? {},
      refresh: opts.refresh ?? false,
    },
    ResearchComponentSchema,
  );
}
