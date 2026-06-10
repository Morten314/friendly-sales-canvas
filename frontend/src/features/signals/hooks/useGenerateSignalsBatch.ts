import { useMutation } from "@tanstack/react-query";

import { generateSignalsBatch } from "../services/signals";

/**
 * POST /api/generate-signals-batch_claude — page-only batch generate. No cache
 * invalidation here; the consumer (Phase 8, Task 12) refetches the feed.
 */
export function useGenerateSignalsBatch() {
  return useMutation({ mutationFn: (userId: string) => generateSignalsBatch(userId) });
}
