import { z } from "zod";

/**
 * The v2 paginated envelope returned by every `/api/v2/*` list endpoint
 * (backend `app/models/pagination.py`). The FE consumes `items`, `total`,
 * `limit`, and `offset` (TD-FE-67).
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
 * shapes — TD-FE-38/53). `total`, `limit`, and `offset` are now typed on
 * the parsed result (TD-FE-67).
 */
export const paginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      items: z.array(item).default([]),
      total: z.number().default(0),
      limit: z.number().optional(),
      offset: z.number().optional(),
    })
    .passthrough();

/** `limit=<n>&offset=0` — the single (first) page these reads request. */
export const firstPageParams = (limit: number) => `limit=${limit}&offset=0`;

/** `limit=<n>&offset=<m>` — an arbitrary page for offset-paged (infinite) reads. */
export const pageParams = (limit: number, offset: number) => `limit=${limit}&offset=${offset}`;
