# Frontend v1 → v2 Backend API Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the three FE read paths that consume v1 endpoints (`fetchDataSources`, `fetchSignals`, `fetchSuggestedIcps`) onto their `/v2/*` paginated successors, behavior-preserving, via one shared envelope contract.

**Architecture:** Add `src/shared/api/pagination.ts` (the v2 `{items,total,limit,offset}` envelope: a `PaginatedResponse<T>` type, a `paginatedSchema(item)` zod schema, and `firstPageParams(limit)`). Each service swaps its URL to `/api/v2/*` with an explicit `limit` and decodes `.items` through `paginatedSchema`, then re-wraps `items` back into the exact shape its consumer already expects — so no consumer code changes. The bespoke `buildIcpUrl` (direct-host, proxy-bypassing) is folded into the standard `buildApiUrl`. `total` is NOT surfaced (deferred to TD-FE-67).

**Tech Stack:** TypeScript, React, Zod, TanStack Query, Vitest + MSW (unit), Playwright (e2e). Spec: `specs/34-frontend-v1-v2-api-migration-design.md`. Branch: `feature/fe-v1-v2-api-migration`.

**Conventions for every task:** commit only the files listed (by path — never `git add -A`); commit messages carry **no** `Co-Authored-By` footer. Run targeted Vitest per task; the full `npm run preflight` (serial) is the final gate in Task 6.

---

### Task 1: Shared paginated-envelope module

**Files:**
- Create: `frontend/src/shared/api/pagination.ts`
- Test: `frontend/src/shared/api/__tests__/pagination.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/api/__tests__/pagination.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { firstPageParams, paginatedSchema } from "../pagination";

describe("paginatedSchema", () => {
  it("parses a well-formed v2 envelope and extracts items", () => {
    const env = paginatedSchema(z.unknown()).parse({
      items: [{ a: 1 }, { a: 2 }],
      total: 7,
      limit: 50,
      offset: 0,
    });
    expect(env.items).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("defaults items to [] when absent", () => {
    const env = paginatedSchema(z.unknown()).parse({ total: 0, limit: 50, offset: 0 });
    expect(env.items).toEqual([]);
  });

  it("rejects a non-array items field", () => {
    expect(() => paginatedSchema(z.unknown()).parse({ items: "nope" })).toThrow();
  });

  it("passes extra envelope keys through (total/limit/offset retained at runtime)", () => {
    const env = paginatedSchema(z.unknown()).parse({
      items: [],
      total: 99,
      limit: 10,
      offset: 0,
    }) as Record<string, unknown>;
    expect(env.total).toBe(99);
  });
});

describe("firstPageParams", () => {
  it("formats limit with offset=0", () => {
    expect(firstPageParams(500)).toBe("limit=500&offset=0");
    expect(firstPageParams(10)).toBe("limit=10&offset=0");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/shared/api/__tests__/pagination.test.ts`
Expected: FAIL — `Failed to resolve import "../pagination"` (module does not exist yet).

- [ ] **Step 3: Write the module**

Create `frontend/src/shared/api/pagination.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/shared/api/__tests__/pagination.test.ts`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/shared/api/pagination.ts src/shared/api/__tests__/pagination.test.ts
git commit -m "feat(fe): add shared v2 PaginatedResponse contract (Spec 34 Task 1)"
```

---

### Task 2: Migrate `fetchDataSources` → `/api/v2/user-documents`

**Files:**
- Modify: `frontend/src/features/mission-control/services/missionControl.ts` (the `fetchDataSources` fn + imports)
- Modify: `frontend/src/features/mission-control/services/__tests__/missionControl.test.ts`
- Modify: `frontend/src/features/mission-control/hooks/__tests__/useDataSources.test.tsx`
- Maybe modify: `frontend/src/features/mission-control/contracts.ts` (drop `DataSourceListSchema` if it becomes dead)

There is **no** shared MSW handler for `user-documents` (only per-test handlers), so this task is self-contained.

- [ ] **Step 1: Update the unit tests to the v2 path + envelope (failing)**

In `frontend/src/features/mission-control/services/__tests__/missionControl.test.ts`, replace the two `user-documents` handlers. The first (object envelope) and the second (bare-array, line ~19) become v2 envelopes:

```ts
// first handler (inside the describe for fetchDataSources):
http.get("/api/v2/user-documents", () =>
  HttpResponse.json({ items: [{ file_id: "d1" }], total: 1, limit: 500, offset: 0 }),
),
```

```ts
// the second `server.use(...)` (previously returned a bare array [{ file_id: "d1" }]):
server.use(
  http.get("/api/v2/user-documents", () =>
    HttpResponse.json({ items: [{ file_id: "d1" }], total: 1, limit: 500, offset: 0 }),
  ),
);
```

In `frontend/src/features/mission-control/hooks/__tests__/useDataSources.test.tsx`, line ~19:

```ts
http.get("/api/v2/user-documents", () =>
  HttpResponse.json({ items: [{ file_id: "d1" }], total: 1, limit: 500, offset: 0 }),
),
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/mission-control/services/__tests__/missionControl.test.ts src/features/mission-control/hooks/__tests__/useDataSources.test.tsx`
Expected: FAIL — `fetchDataSources` still requests `/api/user-documents` (the new `/api/v2/...` handlers don't match), so it returns `[]`/errors and assertions fail.

- [ ] **Step 3: Migrate the service**

In `frontend/src/features/mission-control/services/missionControl.ts`, change the import on line 1 from:

```ts
import { DataSourceListSchema, LeadStreamStatusSchema } from "../contracts";
```

to (drop `DataSourceListSchema`, keep `LeadStreamStatusSchema`):

```ts
import { LeadStreamStatusSchema } from "../contracts";
```

Add the pagination import alongside the existing `import { apiGet } from "@/shared/api/client";`:

```ts
import { z } from "zod";

import { apiGet } from "@/shared/api/client";
import { firstPageParams, paginatedSchema } from "@/shared/api/pagination";
```

Replace the whole `fetchDataSources` function body with:

```ts
export async function fetchDataSources(orgId: string): Promise<unknown[]> {
  const env = await apiGet(
    `v2/user-documents?org_id=${encodeURIComponent(orgId)}&${firstPageParams(500)}`,
    paginatedSchema(z.unknown()),
  );
  return env.items;
}
```

(The JSDoc above it should be updated to say `GET /api/v2/user-documents` and drop the "bare array or `{ documents|files|data }`" wording, since v2 always returns the envelope.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/mission-control/services/__tests__/missionControl.test.ts src/features/mission-control/hooks/__tests__/useDataSources.test.tsx`
Expected: PASS.

- [ ] **Step 5: Resolve the now-possibly-dead `DataSourceListSchema`**

Run: `cd frontend && grep -rn "DataSourceListSchema" src`
- If the **only** remaining hit is its definition in `src/features/mission-control/contracts.ts` (and its `export type DataSourceListResponse = z.infer<...>` line), delete both the `DataSourceListSchema` const and the `DataSourceListResponse` type. Then run `grep -rn "UserDocumentSchema" src` — if `UserDocumentSchema` is now unreferenced too, delete it as well; if it is still used elsewhere, leave it.
- If `DataSourceListSchema` is referenced anywhere else, leave it (Spec 34 §4.5).

- [ ] **Step 6: Verify typecheck + the mission-control suite are green**

Run: `cd frontend && npx tsc --noEmit && npx vitest run src/features/mission-control`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
cd frontend && git add src/features/mission-control/services/missionControl.ts \
  src/features/mission-control/services/__tests__/missionControl.test.ts \
  src/features/mission-control/hooks/__tests__/useDataSources.test.tsx \
  src/features/mission-control/contracts.ts
git commit -m "feat(fe): migrate fetchDataSources to /api/v2/user-documents (Spec 34 Task 2)"
```

(If `contracts.ts` was not modified in Step 5, omit it from the `git add`.)

---

### Task 3: Migrate `fetchSignals` → `/api/v2/fetch-signals`

**Files:**
- Modify: `frontend/src/features/signals/services/signals.ts` (the `fetchSignals` fn + imports)
- Modify: `frontend/src/features/signals/services/__tests__/signals.test.ts`
- Modify: `frontend/src/features/signals/hooks/__tests__/useFetchSignals.test.tsx`
- Modify: `frontend/src/test/msw/handlers.ts` (the shared `/api/fetch-signals` default, ~line 233)

`useFetchSignals` itself is **not** modified — it delegates to `fetchSignals` and holds no URL.

- [ ] **Step 1: Update the unit tests to the v2 path + envelope (failing)**

In `frontend/src/features/signals/services/__tests__/signals.test.ts`, change all four `fetchSignals` handlers from `/api/fetch-signals` to `/api/v2/fetch-signals`, and change the success bodies from `{ signals: [...] }` to the v2 envelope. The error/non-JSON tests keep their behavior, only the path changes:

```ts
// test "parses and returns the signals envelope":
http.get("/api/v2/fetch-signals", () =>
  HttpResponse.json({ items: [{ id: "s1" }, { id: "s2" }], total: 2, limit: 10, offset: 0 }),
),
// assertion stays consumer-shaped:
expect(res).toMatchObject({ signals: [{ id: "s1" }, { id: "s2" }] });
```

```ts
// test "requests user_id and limit=10":
http.get("/api/v2/fetch-signals", ({ request }) => {
  seenUrl = request.url;
  return HttpResponse.json({ items: [], total: 0, limit: 10, offset: 0 });
}),
// assertions unchanged: expect(seenUrl).toContain("user_id=u1"); expect(seenUrl).toContain("limit=10");
```

```ts
// test "throws on a non-ok response":
server.use(http.get("/api/v2/fetch-signals", () => new HttpResponse(null, { status: 500 })));
// assertion unchanged: rejects.toThrow(/Failed to fetch signals: 500/)
```

```ts
// test "throws when the response is not JSON":
http.get(
  "/api/v2/fetch-signals",
  () => new HttpResponse("plain text", { headers: { "content-type": "text/plain" } }),
),
// assertion unchanged: rejects.toThrow("Server returned non-JSON response")
```

In `frontend/src/features/signals/hooks/__tests__/useFetchSignals.test.tsx`, line ~19:

```ts
http.get("/api/v2/fetch-signals", () =>
  HttpResponse.json({ items: [{ id: "s1" }], total: 1, limit: 10, offset: 0 }),
),
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/signals/services/__tests__/signals.test.ts src/features/signals/hooks/__tests__/useFetchSignals.test.tsx`
Expected: FAIL — `fetchSignals` still hits `/api/fetch-signals`; the success/`limit` tests fail (no matching handler → returns the shared default or unhandled).

- [ ] **Step 3: Migrate the service**

In `frontend/src/features/signals/services/signals.ts`, add imports at the top:

```ts
import { z } from "zod";

import { paginatedSchema } from "@/shared/api/pagination";
```

Replace the `fetchSignals` function with (URL → v2 + explicit page; parse the envelope; re-wrap to the consumer's `{ signals }` shape; keep the `!ok` and non-JSON throws verbatim):

```ts
export async function fetchSignals(userId: string): Promise<FetchSignalsResponse> {
  const response = await fetch(`/api/v2/fetch-signals?user_id=${userId}&${firstPageParams(10)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch signals: ${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Server returned non-JSON response");
  }
  const env = paginatedSchema(z.unknown()).parse(await response.json());
  return { signals: env.items };
}
```

Use `firstPageParams` in the import (one line):

```ts
import { firstPageParams, paginatedSchema } from "@/shared/api/pagination";
```

Now `fetchSignals` no longer uses `FetchSignalsResponseSchema` (it uses `paginatedSchema`), so **remove it from the contracts import** — but keep the `FetchSignalsResponse` type (still the return type) and the two `generateSignalsBatch` symbols. Change the top-of-file contracts import from:

```ts
import {
  FetchSignalsResponseSchema,
  GenerateSignalsBatchResponseSchema,
  type FetchSignalsResponse,
  type GenerateSignalsBatchResponse,
} from "../contracts";
```

to:

```ts
import {
  GenerateSignalsBatchResponseSchema,
  type FetchSignalsResponse,
  type GenerateSignalsBatchResponse,
} from "../contracts";
```

(`FetchSignalsResponse` is `z.object({}).passthrough()` → type `{}`; `{ signals: env.items }` is assignable, no cast needed. Then run `grep -rn "FetchSignalsResponseSchema" src` — if it is now unreferenced everywhere, delete the `export const FetchSignalsResponseSchema = ...` line from `src/features/signals/contracts.ts`; if still referenced, leave it.)

- [ ] **Step 4: Flip the shared MSW default handler**

In `frontend/src/test/msw/handlers.ts`, change the default fetch-signals handler (~line 233) from:

```ts
http.get("/api/fetch-signals", () => HttpResponse.json({ signals: [] })),
```

to:

```ts
http.get("/api/v2/fetch-signals", () => HttpResponse.json({ items: [], total: 0, limit: 10, offset: 0 })),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/signals && npx tsc --noEmit`
Expected: PASS, no type errors. (Running the whole `src/features/signals` folder catches any signals page/component test that relied on the shared default handler.)

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/features/signals/services/signals.ts \
  src/features/signals/services/__tests__/signals.test.ts \
  src/features/signals/hooks/__tests__/useFetchSignals.test.tsx \
  src/test/msw/handlers.ts
# add src/features/signals/contracts.ts too if FetchSignalsResponseSchema was deleted in Step 3
git commit -m "feat(fe): migrate fetchSignals to /api/v2/fetch-signals (Spec 34 Task 3)"
```

---

### Task 4: Migrate `fetchSuggestedIcps` → `/api/v2/icp` + fold `buildIcpUrl`

**Files:**
- Modify: `frontend/src/features/customers/services/customers.ts` (`fetchSuggestedIcps` + imports)
- Modify: `frontend/src/shared/api/transport.ts` (delete `buildIcpUrl` + `ICP_BACKEND_URL`)
- Modify: `frontend/src/features/customers/services/__tests__/customers.test.ts`
- Modify: `frontend/src/test/msw/handlers.ts` (the shared `/icp` default, ~line 216)

- [ ] **Step 1: Update the customers unit tests to v2 (failing)**

In `frontend/src/features/customers/services/__tests__/customers.test.ts`:
- Remove the `BACKEND_BASE_URL` import (line 12) — the icp mock is now a relative `/api/v2/icp` path.
- Rewrite the four `fetchSuggestedIcps` handlers to `/api/v2/icp` returning the v2 envelope, and update the return-shape assertions (the service now always returns `{ suggestedICPs: items }`):

```ts
it("parses the v2 envelope into { suggestedICPs }", async () => {
  server.use(
    http.get("/api/v2/icp", () =>
      HttpResponse.json({ items: [{ id: "r1" }, { id: "r2" }], total: 2, limit: 500, offset: 0 }),
    ),
  );
  const res = await fetchSuggestedIcps("u1");
  expect(res).toMatchObject({ suggestedICPs: [{ id: "r1" }, { id: "r2" }] });
});

it("returns { suggestedICPs: [] } for an empty envelope", async () => {
  server.use(
    http.get("/api/v2/icp", () =>
      HttpResponse.json({ items: [], total: 0, limit: 500, offset: 0 }),
    ),
  );
  const res = await fetchSuggestedIcps("u1");
  expect(res).toMatchObject({ suggestedICPs: [] });
});

it("sends refresh=true and user_id when requested", async () => {
  let seenUrl = "";
  server.use(
    http.get("/api/v2/icp", ({ request }) => {
      seenUrl = request.url;
      return HttpResponse.json({ items: [], total: 0, limit: 500, offset: 0 });
    }),
  );
  await fetchSuggestedIcps("u1", { refresh: true });
  expect(seenUrl).toContain("refresh=true");
  expect(seenUrl).toContain("user_id=u1");
});

it("throws on a non-ok response", async () => {
  server.use(http.get("/api/v2/icp", () => new HttpResponse(null, { status: 500 })));
  await expect(fetchSuggestedIcps("u1")).rejects.toThrow(/GET \/icp failed: 500/);
});
```

(The `fetchCustomerProfileIcps` and write-service tests below are unchanged — they hit `/profile/company`, `/customer_profile`, and the mutation routes, all out of scope.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/customers/services/__tests__/customers.test.ts`
Expected: FAIL — `fetchSuggestedIcps` still calls `buildIcpUrl` (the direct host); the new `/api/v2/icp` handlers don't match.

- [ ] **Step 3: Migrate the service**

In `frontend/src/features/customers/services/customers.ts`, change the import on line 7 from:

```ts
import { apiFetch, apiFetchJson, buildApiUrl, buildIcpUrl } from "@/shared/api/transport";
```

to (drop `buildIcpUrl`):

```ts
import { apiFetch, apiFetchJson, buildApiUrl } from "@/shared/api/transport";
```

Add the pagination + zod imports near the contracts import:

```ts
import { z } from "zod";

import { firstPageParams, paginatedSchema } from "@/shared/api/pagination";
```

Replace the `fetchSuggestedIcps` function body with (route through `buildApiUrl`; parse the envelope; re-wrap to `{ suggestedICPs }` via the retained schema; keep the `!res.ok` throw and its message):

```ts
export async function fetchSuggestedIcps(
  userId: string,
  opts: { refresh?: boolean } = {},
): Promise<SuggestedIcpsResponse> {
  const params = new URLSearchParams({ user_id: userId });
  if (opts.refresh) params.set("refresh", "true");
  const res = await fetch(buildApiUrl(`v2/icp?${params.toString()}&${firstPageParams(500)}`), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`GET /icp failed: ${res.status} ${res.statusText}`);
  }
  const env = paginatedSchema(z.unknown()).parse(await res.json());
  return SuggestedIcpsResponseSchema.parse({ suggestedICPs: env.items });
}
```

(`SuggestedIcpsResponseSchema` is already imported. Update the JSDoc above the function: it no longer resolves to the direct host — it now flows through `buildApiUrl` → `/api/v2/icp`.)

- [ ] **Step 4: Delete `buildIcpUrl` from transport**

In `frontend/src/shared/api/transport.ts`, delete lines 26–30 (the comment block + `ICP_BACKEND_URL` + `buildIcpUrl`):

```ts
// Backend uses /icp only (no /customer_profile endpoint).
// Derived from BACKEND_BASE_URL (single source of truth); the template form keeps
// it a distinct binding so knip --strict doesn't flag it as a duplicate export.
const ICP_BACKEND_URL = `${BACKEND_BASE_URL}`;
export const buildIcpUrl = (params: string): string => `${ICP_BACKEND_URL}/icp?${params}`;
```

Then verify no caller remains: `cd frontend && grep -rn "buildIcpUrl\|ICP_BACKEND_URL" src` → expected: **no matches**.

- [ ] **Step 5: Flip the shared MSW default handler**

In `frontend/src/test/msw/handlers.ts`, change the default icp handler (~line 216) from:

```ts
// Profiler reads/writes. /icp is on the direct backend host (not /api).
http.get(`${BACKEND_BASE_URL}/icp`, () => HttpResponse.json({ icps: [] })),
```

to (now proxied through `/api/v2/icp`, v2 envelope):

```ts
// Profiler recommended-ICP read — now /api/v2/icp (Spec 34; was direct-host /icp).
http.get("/api/v2/icp", () => HttpResponse.json({ items: [], total: 0, limit: 500, offset: 0 })),
```

If `BACKEND_BASE_URL` is now unused in `handlers.ts`, remove it from that file's import. Run `grep -n "BACKEND_BASE_URL" src/test/msw/handlers.ts` to check.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/customers && npx tsc --noEmit`
Expected: PASS, no type errors. (The whole `src/features/customers` folder run catches `SuggestedICPCards.read.test.tsx` and any component test that used the shared `/icp` default.)

- [ ] **Step 7: Commit**

```bash
cd frontend && git add src/features/customers/services/customers.ts \
  src/shared/api/transport.ts \
  src/features/customers/services/__tests__/customers.test.ts \
  src/test/msw/handlers.ts
git commit -m "feat(fe): migrate fetchSuggestedIcps to /api/v2/icp + fold buildIcpUrl (Spec 34 Task 4)"
```

---

### Task 5: Flip the e2e route mocks

**Files:**
- Modify: `frontend/e2e/fixtures/api-mocks.ts` (keys for `fetch-signals`, `icp`, `user-documents`)
- Modify: `frontend/e2e/stubs/agent-hub.spec.ts` (inline `fetch-signals` override)
- Modify: `frontend/e2e/journeys/03-signals-feed-action.spec.ts` (inline `fetch-signals` override)

The e2e harness matches by **exact pathname** (`installApiMocks`), so the v2 reads need v2 keys.

- [ ] **Step 1: Update the shared e2e mock map**

In `frontend/e2e/fixtures/api-mocks.ts`, change three entries:

```ts
  "/api/v2/fetch-signals": { items: signalList(5), total: 5, limit: 10, offset: 0 },
```
(replaces `"/api/fetch-signals": { signals: signalList(5) }`)

```ts
  "/api/v2/icp": { items: [{ icp_id: "sug_1", name: "Suggested", match_score: 0.8 }], total: 1, limit: 500, offset: 0 },
```
(replaces `"/api/icp": { suggested: [...] }`)

```ts
  "/api/v2/user-documents": { items: [], total: 0, limit: 500, offset: 0 },
```
(replaces `"/api/user-documents": { documents: [] }`)

- [ ] **Step 2: Update the two inline overrides**

In `frontend/e2e/stubs/agent-hub.spec.ts` (~line 11) and `frontend/e2e/journeys/03-signals-feed-action.spec.ts` (~line 15), change the override key:

```ts
    "/api/v2/fetch-signals": { items: signalList(3), total: 3, limit: 10, offset: 0 },
```
(in agent-hub.spec.ts; use `signalList(5)` in journeys/03 to match its current count)

- [ ] **Step 3: Confirm no stale e2e keys remain for the migrated reads**

Run: `cd frontend && grep -rn '"/api/fetch-signals"\|"/api/icp"\|"/api/user-documents"' e2e`
Expected: **no matches** (only `/api/v2/...` keys for these three). Out-of-scope keys like `/api/leads`, `/api/customer_profile`, `/api/leads/by-file` remain untouched.

- [ ] **Step 4: Run the affected e2e journeys**

Run: `cd frontend && npx playwright test e2e/journeys/03-signals-feed-action.spec.ts e2e/stubs/agent-hub.spec.ts`
Expected: PASS. (If a `:5173` orphan preview server is running from another session, kill that specific PID first — do not broad-`pkill`.)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add e2e/fixtures/api-mocks.ts e2e/stubs/agent-hub.spec.ts e2e/journeys/03-signals-feed-action.spec.ts
git commit -m "test(fe): point e2e route mocks at /api/v2/* (Spec 34 Task 5)"
```

---

### Task 6: Comments, done-when verification, register, full preflight

**Files:**
- Modify: `frontend/src/features/mission-control/components/data-sources/DataSourcesManager.tsx` (stale v1 comments)
- Modify: `docs/TECH_DEBT.md` (add TD-FE-67 + index row)

- [ ] **Step 1: Update stale v1-path comments**

In `frontend/src/features/mission-control/components/data-sources/DataSourcesManager.tsx`, the comments at lines ~150 and ~215 reference "from `/user-documents`". Update them to `/api/v2/user-documents` (text-only; no code change).

- [ ] **Step 2: Verify the done-when read-absence criterion (anchored, not bare substrings)**

Run each; all should return **no matches**:

```bash
cd frontend
grep -rn 'fetch(`/api/fetch-signals' src          # the v1 signals GET is gone
grep -rn 'buildIcpUrl' src                          # the bespoke icp builder is gone
grep -rn '"/api/fetch-signals"\|"/api/icp"\|"/api/user-documents"' src e2e   # no v1 keys for the 3 reads
```

Then confirm the v2 reads ARE present (expected: one match each):

```bash
cd frontend
grep -rn 'v2/user-documents' src/features/mission-control/services/missionControl.ts
grep -rn 'v2/fetch-signals' src/features/signals/services/signals.ts
grep -rn 'v2/icp' src/features/customers/services/customers.ts
```

Note: bare `grep /icp` or `grep signals` will still match out-of-scope mutations (`icp/recommended`, `customer_profile/icp`, `from_suggested_icp`, `generate-signals-batch`) — that is expected; those are N4 and not part of this criterion.

- [ ] **Step 3: Add TD-FE-67 to the register**

In `docs/TECH_DEBT.md`, append the index row to the TD-FE index table:

```markdown
| TD-FE-67 | open | [below](#td-fe-67--single-page-v2-reads-still-cap-items-at-500-total-not-surfaced) |
```

And append the entry at the end of the file (surgical append — do **not** reformat the file / no prettier on TECH_DEBT.md):

```markdown
## TD-FE-67 — single-page v2 reads still cap items at 500; `total` not surfaced

**Date logged:** 2026-06-08
**Origin:** Spec 34 (frontend v1→v2 API migration). The three migrated reads
(`fetchDataSources`, `fetchSignals`, `fetchSuggestedIcps`) request a single page
(`limit=500`/`10`, `offset=0`) and consume only `items`.

**Current state:** items are still capped at the page `limit`; `total` is present
on the v2 wire but is not extracted, typed, or rendered (no consumer renders a
count). The v1 `count` lie is gone (the FE no longer reads it), but the >500
truncation is exposed-not-eliminated.

**What it should be:** when a count display or a list exceeding 500 rows is
needed, widen the service return types to carry `total` and add either fetch-all
looping or real pagination UX (page controls / infinite scroll), keyed on the
v2 `limit`/`offset`.

**Why deferred:** 0 users; nothing renders a count today; threading an unused
`total` would either break the bare-array consumer or add untyped dead surface
(Spec 34 §2, review synthesis round 1).

**Pull-forward trigger:** a count needs rendering, or an org approaches 500
documents / signals / ICPs.

**Owner:** TBD.
```

- [ ] **Step 4: Run the full serial gate**

Run: `cd frontend && npm run preflight`
Expected: green — typecheck + lint + unit + e2e + build + bundle. (Serial gate per repo posture; if lint flags `prettier` drift on touched `.ts`/`.tsx`, run `npx prettier --write` on those specific files — but NOT on `docs/TECH_DEBT.md`.)

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/mission-control/components/data-sources/DataSourcesManager.tsx docs/TECH_DEBT.md
git commit -m "docs(fe): update v1-path comments + log TD-FE-67 (Spec 34 Task 6)"
```

---

## Self-Review

**Spec coverage (each R / goal → task):**
- R1 (v2 paths + explicit limit, no v1 reads) → Tasks 2, 3, 4 (+ verified Task 6 Step 2).
- R2 (single `pagination.ts`, all three decode through `paginatedSchema`) → Task 1; consumed in Tasks 2, 3, 4.
- R3 (consumer-facing return shapes unchanged: `unknown[]` / `{signals}` / `{suggestedICPs}`) → Tasks 2, 3, 4 (assertions encode it).
- R4 (`buildIcpUrl`/`ICP_BACKEND_URL` deleted, no caller) → Task 4 Steps 3–4.
- R5 (error/empty/fallback preserved) → Tasks 3, 4 keep the `!ok`/non-JSON throws + messages verbatim; Task 2 empty-fallback via `paginatedSchema` `items` default.
- R6 (no `total` surfaced, no new UI) → no task adds a UI or a typed `total`; TD-FE-67 logged (Task 6).
- R7 (MSW + unit + e2e mocks v2-only; `pagination.ts` covered) → Tasks 1–5.
- R8 (`npm run preflight` green) → Task 6 Step 4.
- §7 register impact (TD-005 FE-side, TD-FE-67, buildIcpUrl quirk) → Task 6 Step 3 + Task 4.

**Placeholder scan:** No TBD/TODO. Every code step shows full code; every command shows expected output. The only conditional (Task 2 Step 5 / Task 3 Step 3 dead-schema deletion) is grep-gated and deterministic.

**Type consistency:** `paginatedSchema(item)` (one required arg) is called identically in Tasks 2/3/4 as `paginatedSchema(z.unknown())`; `firstPageParams(n)` returns `limit=n&offset=0` and is used in all three service URLs; `fetchSignals` returns `{ signals }` (assignable to `FetchSignalsResponse` = `{}`); `fetchSuggestedIcps` returns `SuggestedIcpsResponseSchema.parse({ suggestedICPs })`; `fetchDataSources` returns `env.items` (`unknown[]`). Consistent across tasks.
