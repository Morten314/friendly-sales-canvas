import { z } from "zod";

/**
 * A single recommended-ICP item from GET /icp — kept opaque (shape varies).
 * Module-local (not exported): only the response schema below references it, so
 * exporting it would be an unused export under `knip --strict`.
 */
const suggestedIcpItemSchema = z.object({}).passthrough();

/**
 * GET /icp response. The backend may return a bare array, or an object wrapping
 * the list under `data` / `payload` / `result` / `icps` / `suggestedICPs` /
 * `results` / `items` / `recommendations` / `profiles`, or a single root object.
 * All optional + `.passthrough()` so `.parse` never throws on a real response;
 * `normalizeIcpGetResponse` (icpMapping.ts) resolves which shape it actually is.
 */
export const SuggestedIcpsResponseSchema = z.union([
  z.array(suggestedIcpItemSchema),
  z
    .object({
      data: z.unknown().nullish(),
      payload: z.unknown().nullish(),
      result: z.unknown().nullish(),
      icps: z.array(suggestedIcpItemSchema).nullish(),
      suggestedICPs: z.array(suggestedIcpItemSchema).nullish(),
      results: z.array(suggestedIcpItemSchema).nullish(),
      items: z.array(suggestedIcpItemSchema).nullish(),
      recommendations: z.array(suggestedIcpItemSchema).nullish(),
      profiles: z.array(suggestedIcpItemSchema).nullish(),
    })
    .passthrough(),
]);
export type SuggestedIcpsResponse = z.infer<typeof SuggestedIcpsResponseSchema>;

/**
 * GET/POST /api/customer_profile. The row shape varies and is consumed via the
 * shared `@/shared/profiler` extractors; kept opaque + passthrough so `.parse`
 * validates the envelope without constraining rows. Consumed at the boundary by
 * `saveAcceptedIcpFirmographics` (T13) — keep it referenced so it is not a dead
 * export under `knip --strict`.
 */
export const CustomerProfileResponseSchema = z
  .object({
    icps: z.array(z.object({}).passthrough()).nullish(),
    data: z.unknown().nullish(),
  })
  .passthrough();
