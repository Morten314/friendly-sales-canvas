import { useMutation } from "@tanstack/react-query";

import { generateSignalsBatch } from "../services/signals";

import type { CompanyProfileResponse } from "@/shared/api/contracts";

/**
 * POST /api/generate-signals-batch_claude — page-only batch generate. Takes the
 * org's company profile so signals are generated against its real firmographics
 * (see `generateSignalsBatch`). No cache invalidation here; the consumer (Phase 8,
 * Task 12) refetches the feed.
 */
export function useGenerateSignalsBatch() {
  return useMutation({
    mutationFn: ({
      userId,
      orgId,
      profile,
    }: {
      userId: string;
      orgId: string | null;
      profile: CompanyProfileResponse | null;
    }) => generateSignalsBatch(userId, orgId, profile),
  });
}
