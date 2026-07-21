# `src/shared/api/` — the shared data layer

Introduced by spec 20. Everything a feature needs to talk to the backend
through one rate-limited, JWT-injecting, zod-validated path lives here. The
dependency-rule lint that enforces `shared/` boundaries is in place; placement
here follows that boundary.

## The fetch path

`client.ts` is the single fetch path for migrated code.

- **Normal path** — `apiGet` / `apiPost` / `apiRequest`. Wraps `apiFetchJson`
  (`src/lib/api.ts`), so JWT is injected by `apiFetch` and any non-2xx **throws**.
  The call is routed through the shared rate limiter, and the JSON body is
  `schema.parse(...)`-d at the boundary. A `ZodError` (response drift), an HTTP
  error, or a rate-limit rejection each propagates distinctly to the caller —
  the client does not normalize them.
- **Auth-endpoint path** — `authEndpointRequest`, for `/api/auth/token` and
  `/api/auth/refresh` ONLY. Uses a bare, **non-throwing** `fetch` with **no JWT
  injection** (a JWT-injecting auth call would recurse via
  `getAuthHeader → refreshAccessToken → getAuthHeader`). Still draws from the
  shared limiter. zod runs **only on a 2xx body**; the caller branches on
  `ok`/`status` to preserve 404-tolerance.

|            | Normal path                     | `authEndpoint` path        |
| ---------- | ------------------------------- | -------------------------- |
| Transport  | `apiFetchJson` (throws on !2xx) | bare non-throwing `fetch`  |
| JWT        | auto-injected via `apiFetch`    | none                       |
| Rate-limit | shared limiter                  | shared limiter             |
| zod        | `.parse(json)`                  | `.parse(json)` on 2xx only |

## Rate limiting

`rateLimiter.ts` holds the **one** `RateLimiter` instance (`RATE_LIMIT_RPM = 30`).
`src/lib/rateLimitManager.ts` re-exports it as a shim, so the legacy
`executeWithRateLimit` sites and the TanStack path share one 30/min budget. Never
construct a second instance for production use.

## Contracts (zod)

`contracts/` holds hand-authored zod schemas, the source of truth for the
endpoints this phase touches. Static types come from `z.infer`. Schemas are
authored from captured live responses and default permissive
(`.nullish()`/`.passthrough()`); a drifted response surfaces as a `ZodError` in
the query's `error` state. Extend per endpoint as feature surfaces migrate.

## Query keys

`queryKeys.ts` exports `qk`, a factory returning array-tuple keys
(`qk.companyProfile(orgId)` → `["company-profile", orgId]`). Use it for both the
`useQuery` key and `invalidateQueries`, so targets are not stringly-typed.

## QueryClient

`queryClient.ts` is the configured client `App.tsx` mounts. Memory-only (no
persister); the repo-wide persistence policy is deferred to an ADR.
