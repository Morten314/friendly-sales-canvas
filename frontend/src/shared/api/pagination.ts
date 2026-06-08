import { z } from "zod";

/**
 * The v2 paginated envelope returned by every `/api/v2/*` list endpoint
 * (backend `app/models/pagination.py`). The FE consumes `items`; `total`,
 * `limit`, and `offset` are present on the wire but NOT surfaced by this
 * migration (Spec 34 §2 / TD-FE-67).
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Zod schema for the v2 envelope. Pass the item schema explicitly — use
 * `z.unknown()` for the loose case (this migration does NOT tighten item
 * shapes — TD-FE-38/53). Only `items` is validated; `total/limit/offset`
 * pass through untyped.
 */
export const paginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item).default([]) }).passthrough();

/** `limit=<n>&offset=0` — the single (first) page these reads request. */
export const firstPageParams = (limit: number) => `limit=${limit}&offset=0`;
