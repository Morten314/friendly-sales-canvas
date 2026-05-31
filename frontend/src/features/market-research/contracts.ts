import { z } from "zod";

/** Market-research POST envelope. Authoritative: backend `MarketResponse`
 *  (`app/models/market_research.py`) = `{ status, data }`. `data` is the
 *  heterogeneous LLM report (`Dict[str, Any]`, varies per `component_name`) —
 *  kept opaque here, refined per-section as 5d–5h render it. The pre-existing
 *  `e2e/fixtures/api-mocks.ts` mock's `{ component_name, status, result, cached }`
 *  is NOT this shape; ignore it. */
export const ResearchComponentSchema = z
  .object({
    status: z.string(),
    data: z.record(z.string(), z.unknown()),
  })
  .passthrough();
export type ResearchComponentResponse = z.infer<typeof ResearchComponentSchema>;
