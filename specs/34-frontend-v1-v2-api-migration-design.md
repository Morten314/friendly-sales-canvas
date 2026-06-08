# Spec 34 — Frontend v1 → v2 backend API migration (paginated read endpoints)

**Status:** Draft (brainstormed 2026-06-08)
**Spec:** `specs/34-frontend-v1-v2-api-migration-design.md`
**Plan:** `plans/34-frontend-v1-v2-api-migration.md` (to follow)
**Relates to:** TD-005 (v1 `count` = page size, not DB total — backend-side record), the `buildIcpUrl` proxy-bypass quirk (project memory), Phase G (`specs/2026-05-23-backend-pagination-and-index-hygiene-phase-g-design.md`, which added the v2 endpoints).
**Explicitly NOT in scope (deferred TD):** TD-FE-38 / TD-FE-53 (item-schema tightening), TD-FE-42 (`/icp` + `/customer_profile` read-path unification), TD-FE-19 / TD-FE-53 (imperative→TanStack data-flow rewrites).

---

## 1. Context & problem

The frontend calls the backend's **v1 unversioned** read endpoints (`/api/<path>`, proxied to `/<path>`). Phase G added **v2 paginated** endpoints under `/v2/<path>` but they have **zero FE consumers**.

The v1 list envelopes report `count = len(items)` *after* the service silently caps the page at 500 — so `count` is the page size, not the true DB total (TD-005). For an org exceeding 500 rows the FE under-reports and cannot tell that truncation happened.

The v2 endpoints return a single uniform envelope:

```python
# backend/app/models/pagination.py
class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int   = Field(ge=0)     # true DB total
    limit: int   = Field(ge=1, le=500)
    offset: int  = Field(ge=0)
```

**Goal:** move the FE's three consumed v1 reads onto their v2 successors, **behavior-preserving**, so reads carry the honest `total`. MVP / 0-users / velocity posture: single-page reads, advisory gate, no new UI.

---

## 2. Goals / Non-goals

**Goals**
- **G1** — Migrate the 3 consumed v1 reads to their `/v2/*` successors with an explicit `limit` that preserves today's effective page size.
- **G2** — Introduce one shared FE paginated-envelope contract so the three services decode `{items,total,limit,offset}` from a single definition site.
- **G3** — Fold the bespoke `buildIcpUrl` (direct-host, bypasses the dev `/api` proxy) into the standard `buildApiUrl` stack and delete it.
- **G4** — Thread the true `total` through each service return (available + honest); **no new UI**.
- **G5** — Preserve every consumer's existing behavior verbatim (error/empty/fallback paths, downstream item shapes, optimistic state). Only URL + envelope-decode change.
- **G6** — Flip MSW handlers, unit tests, and any e2e route mocks to the v2 path + shape; add a focused test for the shared decoder.

**Non-goals**
- **N1** — Pagination UX (page controls / infinite scroll). Single page only.
- **N2** — Fetch-all looping. The >500 item truncation becomes *visible* via `total` but is **not eliminated** (residual → TD-FE-67).
- **N3** — `leads`, `leads/by-file`, `registration` v2 endpoints — they have no FE consumer (see §3.3).
- **N4** — Any mutation (`POST /leads`, `POST /generate-signals-batch`, `GET /ask` writes, connector/ICP/profile writes).
- **N5** — Tightening the loose item schemas / escape-hatch item types (TD-FE-38/53).
- **N6** — Unifying the `/icp` read with the `/profile/company` + `/customer_profile` read (TD-FE-42).
- **N7** — Migrating the imperative signals/customers loaders to TanStack Query (TD-FE-19/53).
- **N8** — Any backend change. v1 stays deprecated-but-live.

---

## 3. Scope — the exact reads

### 3.1 In scope (3 service functions, 1 `/icp` reader)

| # | Service fn | File | Today (v1) | After (v2) | `limit` |
|---|---|---|---|---|---|
| 1 | `fetchDataSources` | `features/mission-control/services/missionControl.ts` | `apiGet("user-documents?org_id=…", DataSourceListSchema)` → `.documents ?? .files ?? .data ?? []` | `apiGet("v2/user-documents?org_id=…&limit=500&offset=0", paginatedSchema)` → `.items` | **500** |
| 2 | `fetchSignals` | `features/signals/services/signals.ts` | `fetch("/api/fetch-signals?user_id=…&limit=10")` → `.signals` | `fetch("/api/v2/fetch-signals?user_id=…&limit=10&offset=0")` → `.items` | **10** |
| 3 | `fetchSuggestedIcps` | `features/customers/services/customers.ts` | `fetch(buildIcpUrl("user_id=…[&refresh=true]"))` → `{suggestedICPs}` | `fetch(buildApiUrl("v2/icp?user_id=…[&refresh=true]&limit=500&offset=0"))` → `.items` | **500** |

`limit` rationale: v2 defaults (`user-documents`/`icp` = 50, `fetch-signals` = 10) are smaller than v1's effective cap, so an explicit `limit` is required to preserve today's result-set size. v1 `user-documents` capped at 500; v1 `/icp` was unbounded (recommended-ICP counts are small — 500 is a safe ceiling); signals keeps its existing feed size of 10.

### 3.2 Explicitly OUT — the `/icp` "second reader" is a different resource

`fetchIcpsRowsForOrg` (`src/shared/profiler/profileIcpsExtract.ts:52`) — used by mission-control `useICPs` and customers' `fetchCustomerProfileIcps` — reads **`GET /profile/company`** then **`GET /customer_profile?org_id=…`**, extracting `customer_profiles.icps`. These endpoints have **no v2 paginated variant**, so this reader is out of scope. (This corrects the loose "both read `/api/icp`" framing in TD-FE-42; the actual shared path is the profile read, not `/icp`.)

### 3.3 Available v2 endpoints with NO FE consumer (left alone)

`/v2/leads`, `/v2/leads/by-file`, `/v2/registration`. The FE uses `/leads/stream/status`, `DELETE /leads/by-file/{id}`, and `POST` lead mutations — never the v1 GET list — and never `GET /registration`. Nothing to migrate; YAGNI.

---

## 4. Design (Approach 1 — shared paginated contract + thin per-service decode)

### 4.1 New shared module — `src/shared/api/pagination.ts`

The single definition site for the v2 envelope. Lives alongside `transport.ts` / `client.ts` in `@/shared/api`.

```ts
import { z } from "zod";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Zod schema for the v2 envelope, parameterised by item schema. Items default
 *  to `z.unknown()` — this spec does NOT tighten item shapes (TD-FE-38/53). */
export const paginatedSchema = <T extends z.ZodTypeAny>(item: T = z.unknown() as unknown as T) =>
  z.object({
    items: z.array(item).default([]),
    total: z.number().default(0),
    limit: z.number().default(0),
    offset: z.number().default(0),
  });

/** `limit=<n>&offset=0` — first/only page. */
export const firstPageParams = (limit: number) => `limit=${limit}&offset=0`;
```

### 4.2 Per-service change — the adaptation principle

**Each service adapts the v2 envelope back into the exact return shape its consumer already expects, so no consumer code changes.**

- **`fetchDataSources`** — `apiGet`-based. Pass `paginatedSchema()` (items `unknown`) to `apiGet`, then `return env.items` (bare `unknown[]`, as today). The old `DataSourceListSchema` is no longer used by this path (§4.5).
- **`fetchSignals`** — raw `fetch`. Parse the body with `paginatedSchema().parse(...)` (preserves the current throw-on-gross-mismatch of `FetchSignalsResponseSchema.parse`), then **re-wrap as `{ signals: env.items }`** and return through the existing `FetchSignalsResponse` typing so `buildSignalCardsFromFetchData` is untouched. The non-2xx / non-JSON `throw`s are preserved unchanged.
- **`fetchSuggestedIcps`** — raw `fetch`. Parse the body with `paginatedSchema().parse(...)`, then **re-wrap as `{ suggestedICPs: env.items }`** and return through the existing `SuggestedIcpsResponseSchema` typing so `normalizeIcpGetResponse` + `mapApiICPToSuggested` downstream are untouched. The `!res.ok` `throw` is preserved.

`total` is carried alongside where the return type allows (additive), but nothing renders it (§4.4).

### 4.3 `buildIcpUrl` fold (G3)

`fetchSuggestedIcps` is the only `buildIcpUrl` caller. Replace `buildIcpUrl(params)` with `buildApiUrl("v2/icp?" + params + "&" + firstPageParams(500))`, and **delete** `buildIcpUrl` and the `ICP_BACKEND_URL` binding from `src/shared/api/transport.ts`. Effect: the `/icp` read now flows through the standard `/api` path — proxied in dev (no more cross-origin call to the backend host), identical in prod (prod already resolves `/api/*` to `BACKEND_BASE_URL`).

### 4.4 Behavior invariant

Only **URL + envelope-decode** change per read. Preserved verbatim:
- customers' downstream normalize/map + the `!res.ok` throw; **no UI renders `total`** (nothing renders a count today — the v1 `count` was parsed-and-discarded).
- signals' `[]`/throw-on-error/non-JSON guards and the `buildSignalCardsFromFetchData` consumer.
- the user-documents empty fallback (now via `paginatedSchema`'s `items` default `[]`; v2 always returns the envelope, so the old bare-array branch is dropped as dead).
- every downstream item shape and all optimistic/editable state.
- Repoint the **pre-positioned-but-unused** `useFetchSignals` hook to the v2 path so no v1 `fetch-signals` reference survives; it stays unused (wiring it is TD-FE-53).

### 4.5 Schema bookkeeping

The legacy per-endpoint wire schemas (`DataSourceListSchema`, `FetchSignalsResponseSchema`) are superseded by `paginatedSchema` on these paths. Per path: switch to `paginatedSchema`; if the legacy schema becomes unreferenced, delete it (knip-clean); if still referenced elsewhere, leave it. `SuggestedIcpsResponseSchema` is **retained** — it remains `fetchSuggestedIcps`'s return-type contract (the service feeds it `{ suggestedICPs: items }`).

---

## 5. Tests

- **MSW** (`src/test/msw/handlers.ts` + per-feature handlers): change matched **path** to `/api/v2/user-documents`, `/api/v2/fetch-signals`, `/api/v2/icp` (the icp handler stops matching the direct backend host and matches the relative `/api/v2/icp` now that the call is proxied), and change response **shape** to `{ items, total, limit, offset }`.
- **Unit**: each of the 3 service tests asserts the v2 decode and that the consumer-facing return shape is unchanged. One new test file for `pagination.ts` (`paginatedSchema`: happy parse / missing scalar fields default / non-array `items` rejected; `firstPageParams` formatting).
- **e2e**: update any Playwright `page.route` mocks for these endpoints to the v2 path + shape (journeys touching data-sources, signals, ICP/customers). Verify no journey still intercepts the old paths.

---

## 6. Verification & gate

- **Gate:** advisory (repo pre-launch posture). `npm run preflight` (serial) green: typecheck + lint + unit + e2e + build + bundle.
- **Contract source of truth:** the v2 envelope is confirmed from backend code (`models/pagination.py`); item shapes stay loose (out of scope).
- **Live smoke check (advisory, optional):** a real `GET /api/v2/*` requires a JWT + valid `org_id`/`user_id`. If creds are available, confirm each endpoint responds with the `{items,total,limit,offset}` shape; otherwise code-contract + MSW + e2e is the gate.

---

## 7. Register impact

- **TD-005 (FE side):** resolved for the three consumed endpoints — reads now carry the true `total` instead of the capped `count`. The backend-side TD-005 record (v1 `count` semantics, v1 deletion) stays open.
- **`buildIcpUrl` proxy-bypass:** resolved (deleted).
- **New TD-FE-67 (residual):** single-page reads still cap items at 500; the cap is now *visible* via `total` but not eliminated. Fetch-all / pagination deferred until an org approaches 500 rows.
- **TD-FE-42:** untouched / still open (the `/profile/company` + `/customer_profile` overlap; see §3.2).
- **TD-FE-53:** the unused `useFetchSignals` hook is repointed to v2 but remains unused — its wiring stays deferred.

---

## 8. Requirements (testable)

- **R1** — All three reads issue `GET /api/v2/<path>` (or proxied equivalent) with an explicit `limit` (`user-documents`=500, `fetch-signals`=10, `icp`=500) and `offset=0`. No v1 path (`/user-documents`, `/fetch-signals`, `/icp`) remains for these three reads.
- **R2** — A single `src/shared/api/pagination.ts` defines the envelope type, `paginatedSchema`, and `firstPageParams`; all three services decode through `paginatedSchema`.
- **R3** — Each service's consumer-facing return shape is behaviorally identical to today (`fetchDataSources` → `unknown[]`; `fetchSignals` → `{ signals }` (`FetchSignalsResponse`); `fetchSuggestedIcps` → `{ suggestedICPs }`).
- **R4** — `buildIcpUrl` and `ICP_BACKEND_URL` are deleted from `transport.ts`; no caller remains; the icp read flows through `buildApiUrl`.
- **R5** — Each consumer's error/empty/fallback behavior is unchanged (verified by the existing tests still passing after the shape flip).
- **R6** — `total` is available on each service return; no component renders a count that wasn't rendered before (no new UI).
- **R7** — MSW + unit + e2e mocks reference only v2 paths/shapes for these three endpoints; `pagination.ts` has unit coverage.
- **R8** — `npm run preflight` (serial) is green.

---

## 9. Done-when

1. R1–R8 hold.
2. `grep` shows zero FE references to v1 `/user-documents`, `/fetch-signals`, `/icp` reads (mutations and `/leads/*`, `/customer_profile`, `/profile/company` excluded — out of scope).
3. The register is updated per §7 (TD-005 FE-side note, TD-FE-67 added, `buildIcpUrl` quirk closed).

---

## 10. Risks / abort criteria

- **Item shape under `items`** differs from the v1 array element shape (e.g., v2 wraps/renames). Mitigation: item shapes are loose (`unknown`) and consumers normalize; if a real divergence appears, that's an item-schema concern (TD-FE-38/53), not this spec — flag and stop rather than tightening here.
- **`apiGet` schema coupling** (`fetchDataSources`): if passing `paginatedSchema` to `apiGet` fights its current signature, adjust at the call site only — do not change `apiGet`'s contract for other callers.
- **Abort criterion:** if migrating a read forces a consumer-code change (i.e., §4.2 adaptation can't keep the consumer untouched), stop and re-scope — that read's consumer is more coupled than this envelope-only spec assumes.
