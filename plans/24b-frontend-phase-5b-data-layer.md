# Frontend Phase 5b — market-research data layer → TanStack Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace market-research's raw `fetch()` calls + hand-rolled localStorage cache with the Phase 3 data-layer pattern — feature-local zod contracts (`.parse` at the boundary), typed service fns over the shared `client.ts` + single `RateLimiter`, and `useQuery`/`useMutation` hooks keyed through the central `qk` factory with a **memory-only** TanStack cache — so section decomposition (5d–5h) reads from clean hooks instead of prop-drilled fetch results. Plus the two phase ADRs.

**Architecture:** New `services/`, `hooks/`, `contracts.ts` under `features/market-research/`; the response **envelope is authoritatively `{ status, data }`** (backend `MarketResponse`, `app/models/market_research.py`); the inner `data` report is `Dict[str, Any]` (opaque, varies per `component_name`), so its per-component internals are **captured before the zod contract is finalized** (Spec 24 R2; the inner doc has no `response_model`). The still-monolithic `MarketResearchPage.tsx` is rewired to consume the hooks; the raw `fetch` sites, the `CACHE_DURATION` localStorage cache, and the localStorage refs backing it are deleted. Company-profile reads route through Phase 3's existing `useCompanyProfile` (no new hook). The intelligence sites all migrate; the `analysis`/lead-stream tab has **no** fetch sites of its own (confirmed in 5a — see §"Endpoint reality"), so there is nothing to exclude there. **Scope note (discovered in 5a section reads):** the five section components *also* self-fetch the same `market-research` endpoint + keep their own localStorage cache — not just the page. 5b builds the data layer (`services`/`hooks`/`contracts`/`qk`/MSW) and migrates the **page-level** fetch sites + cache; each **section's in-component fetch migrates with its 5d–5h decomposition** (which reads these hooks). The hooks therefore exist *before* sections convert (Spec 24 R3 satisfied).

**Tech Stack:** React 18 + TS (strict), `@tanstack/react-query` (provider already mounted at `App.tsx`), `zod`, the shared `@/shared/api/{client,rateLimiter,queryClient,queryKeys,contracts}`, Vitest + RTL + **MSW** (`src/test/msw/handlers.ts`), knip `--strict`.

**Source spec:** `specs/24-frontend-phase-5-market-research-design.md` §4 (and §1.3.3, §1.3.4, §2.3, §12 R2/R7).

**Companion:** `specs/20-frontend-phase-3-api-data-layer-design.md` + `plans/20-frontend-phase-3-api-data-layer.md` — the pattern this plan mirrors: `apiGet`/`apiPost` in `src/shared/api/client.ts`, the single `rateLimiter` (`RATE_LIMIT_RPM = 30`) in `src/shared/api/rateLimiter.ts`, `queryClient` (`staleTime` 5 min, `gcTime` 10 min, `retry` 1, no persister) in `src/shared/api/queryClient.ts`, the `qk` factory in `src/shared/api/queryKeys.ts`, feature-local contracts via `z.infer`, and `useCompanyProfile`/`useSaveCompanyProfile` in `src/components/settings/useCompanyProfile.ts`.

**Prerequisite (hard):** **5a (`plans/24a-frontend-phase-5a-relocate.md`) merged to `master`.** This plan operates on `src/features/market-research/pages/MarketResearchPage.tsx` (the moved page) and re-identifies fetch sites **by searching the moved file** (`fetch(` + `buildApiUrl`), not by the pre-5a line numbers. Branch off the latest `master`.

**Conventions for every task:** as 24a (npm from `frontend/`; commits from monorepo root; `type(scope):`, no `Co-Authored-By`, no `[N/M]`; per-task `tsc --noEmit` + `lint` green before commit). **Visual-parity guard remains behavioral E2E `journeys/04` + Vitest/RTL + preflight — no MR pixel VR** (5a TD-FE).

**Endpoint reality (confirmed against the backend `market_research` router + models; re-confirm the inner `data` live in Task 1).** The market-research raw fetches resolve to **2 backend endpoints**, all owned by the `intelligence` surface:

| Operation | Endpoint | Method | Notes |
|---|---|---|---|
| Per-component research (load / generate / refresh) | `market-research` | **POST only** | one `component_name` per call; **initial hydrate fires this 5×** (no load-all endpoint). `refresh: true` regenerates; competitor has a retry loop |
| Company profile | `profile/company?org_id=` | GET | **already migrated** — reuse `useCompanyProfile` |

**There is no GET / "load latest" / array / keyed-object response.** Each POST returns `MarketResponse = { status: str, data: Dict[str, Any] }` (`app/models/market_research.py:15-25`) — the page's own parser already reads `{ status, data }`. The request is `MarketRequest = { user_id, org_id?, component_name, data, refresh }` (`:7-12`); `user_id` and `data` are **required** (Task 1 captures what `data` carries). The route HAS `response_model=MarketResponse`, so the **envelope is authoritative**; only the inner `data` doc is opaque. ⚠️ The 5a E2E mock (`e2e/fixtures/api-mocks.ts` — `{ component_name, status:"completed", result, cached }`) is the WRONG shape; do not use it as the contract source. The `analysis` (lead-stream) and `trends` (Scout-chat) tabs perform **no** market-research fetches — so Spec 24 §4.2's "exclude analysis-tab fetch sites from migration" is moot (record as a §9 delta in Task 7 Step 6). **The 5 section components each ALSO hold their own `market-research` POST + cache** (not only the page) — 5b migrates the page sites and creates the hooks; the section-internal fetches migrate per-section in 5d–5h. The canonical `component_name` strings (verified in 5a code): `"market size & opportunity"`, `"industry trends report"`, `"regulatory & compliance highlights"`, `"competitor landscape"`, `"market entry & growth strategy"`.

**Abort criteria (whole-branch — halt + report):** (1) 5a not merged. (2) Task 0 baseline RED before any change. (3) The `MarketRequest` body the page must send cannot be confirmed (from live page behavior or the backend), so the POST would 422 — STOP and capture it. (The response envelope `{ status, data }` is known from `MarketResponse`; the opaque inner `data` per component is captured for 5d–5h, recorded as `z.unknown()` if a section's fields can't be obtained — not a whole-branch blocker.) (4) Behavioral `journeys/04` can't be made green after rewire and the cause is unfound after investigation (Task 7).

---

## Task 0: Branch + green baseline + locate the fetch sites

**Files:** none (verification only).

- [ ] **Step 1: Branch off the latest `master` (5a merged)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master && git pull --ff-only
test -d frontend/src/features/market-research/pages && echo "OK: 5a merged" || echo "STOP: 5a not merged"
git checkout -b phase-5b-data-layer
```

- [ ] **Step 2: Green baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight   # or the lighter typecheck+lint+test subset; Task 7 is the real gate
```
Expected: PASS. RED before any change → STOP (abort 2).

- [ ] **Step 3: Re-identify the fetch sites in the MOVED file (spec §4.1)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
P=src/features/market-research/pages/MarketResearchPage.tsx
echo "=== fetch( sites ==="; grep -n 'fetch(' "$P"
echo "=== buildApiUrl targets ==="; grep -n 'buildApiUrl(' "$P"
echo "=== cache machinery ==="; grep -n 'CACHE_DURATION\|getUserLocalStorage\|setUserLocalStorage\|removeUserLocalStorage\|localStorage\.' "$P" | head -40
echo "=== localStorage ref count ==="; grep -c 'localStorage' "$P"
echo "=== sessionStorage (primary state — LEAVE) ==="; grep -n 'sessionStorage' "$P"
echo "=== component_name strings ==="; grep -n 'component_name' "$P" | head
```
Then inventory the **section-internal** fetches (these migrate in 5d–5h, but catalog them now so the partition is explicit):
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rn 'fetch(\|apiFetchJson\|executeWithRateLimit' src/features/market-research/components --include=*.tsx | grep -iv 'test'
```
Record: the fetch line numbers (current), the two endpoints, the `CACHE_DURATION` cache read/write helpers, the count of `localStorage` refs (spec anchor: ~68), **and which section files carry their own fetch** (expected: MarketEntry/Regulatory/Competitor/IndustryTrends/MarketSize all self-fetch `market-research` + cache — those convert in 5d–5h). Confirm every `fetch(` resolves to `market-research` or `profile/company`. `sessionStorage` used as cross-tab handoff (`leadStreamChatContext`, `signalsChatContext`) is **primary state, not cache — leave it alone** (spec §4.2).

No commit.

---

## Task 1: Verify the live request/response shapes (spec §4.1, R2 — polyglot rule)

**Files:** none (capture payloads to scratch, not committed).

> The response **envelope** is authoritative — `MarketResponse = { status, data }` (`backend/app/models/market_research.py`). What's NOT statically known is (a) the exact `MarketRequest.data` the page must send and (b) the inner `data` report fields each section renders (`data: Dict[str, Any]`, varies per `component_name`). Capture those against a running backend (FastAPI `/docs` or `curl`) — or read the backend service assembly — **before** finalizing the contract. The CLAUDE.md polyglot rule still applies to the inner doc. **Do NOT** treat `e2e/fixtures/api-mocks.ts` as a capture: its envelope is wrong.

- [ ] **Step 1: Confirm POST-only + pin the request body**

There is **no GET / load-all** endpoint — the route is `POST /market-research` only. From the running backend `/docs` (or by reading how the current page builds its request), record the exact `MarketRequest` the page sends: `user_id`, `org_id`, `component_name`, and especially what the required `data` dict carries (org/context fields). This is the body the service fn must reproduce or the POST 422s.

- [ ] **Step 2: Capture each per-component POST response**

For each of the 5 `component_name` values, POST a component request and save the response (`/tmp/mr-<component>.json`). The envelope is `{ status, data }` (authoritative). Record the inner **`data`** report shape per component — these differ per section and are what 5d–5h render. If the live backend is unreachable, read the assembly in `backend/app/services/market_research/` to recover the `data` fields.

- [ ] **Step 2b: If no backend is reachable**

Use the backend source as the authority: the envelope from `MarketResponse`, and the inner `data` from `backend/app/services/market_research/` (the `run_market_research` return assembly). **Do NOT** fall back to `e2e/fixtures/api-mocks.ts` — its envelope (`{ component_name, status, result, cached }`) is fabricated and wrong. Note in the Task 7 ADR if the inner `data` fields were taken from the service code rather than a live call. Only if even the backend source can't yield a section's fields, record `z.unknown()` and flag it for that 5d–5h plan.

- [ ] **Step 3: Verify the capture is complete (hard gate)**

Before proceeding to Task 2, confirm: (1) the `MarketRequest` body is pinned (incl. what `data` carries) so the POST won't 422; (2) the `{ status, data }` envelope is confirmed against `MarketResponse`; (3) the inner `data` report is captured for all 5 `component_name` values (`market size & opportunity`, `industry trends report`, `regulatory & compliance highlights`, `competitor landscape`, `market entry & growth strategy`). If a section's inner fields cannot be obtained, record an explicit `z.unknown()` gap with a comment and flag it for the affected 5d–5h plan — do not let a missing shape pass silently.

No commit (Task 2 writes the contract from these captures).

---

## Task 2: Feature-local zod contracts (`contracts.ts`)

**Files:**
- Create: `frontend/src/features/market-research/contracts.ts`
- Test: `frontend/src/features/market-research/__tests__/contracts.test.ts`

> Spec 24 §1.3.3, §4.2. Feature-local (single file) — this is the precedent ADR (Task 7). Mirror `src/shared/api/contracts/company-profile.ts` style: `z.object({...}).passthrough()` for tolerance to extra backend fields, `nullish()` for optional, `z.infer` for static types.

- [ ] **Step 1: Write the failing contract test (drive the schema from captured payloads)**

Create `__tests__/contracts.test.ts` that feeds the Task 1 captured JSON through the schema and asserts a successful `.parse`, plus a malformed-input rejection. Example skeleton (fill the fixture from the real capture):
```ts
import { describe, expect, it } from "vitest";

import { ResearchComponentSchema } from "@/features/market-research/contracts";

const realComponentPayload = {
  status: "success",
  data: { /* opaque report — varies per component_name */ title: "…", summary: "…" },
}; // ← replace with /tmp/mr-market-size.json contents (envelope is { status, data })

describe("market-research contracts", () => {
  it("parses a real per-component response", () => {
    expect(() => ResearchComponentSchema.parse(realComponentPayload)).not.toThrow();
  });
  it("rejects a response missing the envelope", () => {
    expect(() => ResearchComponentSchema.parse({ data: {} })).toThrow(); // no `status`
  });
});
```

- [ ] **Step 2: Run it red**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run src/features/market-research/__tests__/contracts.test.ts
```
Expected: FAIL — `contracts.ts` does not exist yet.

- [ ] **Step 3: Write `contracts.ts` from the captured shapes**

```ts
import { z } from "zod";

/** Market-research POST envelope. Authoritative: backend `MarketResponse`
 *  (`app/models/market_research.py`) = `{ status, data }`. `data` is the
 *  heterogeneous LLM report (`Dict[str, Any]`, varies per `component_name`) —
 *  kept opaque here, refined per-section as 5d–5h render it. The 5a E2E mock's
 *  `{ component_name, status, result, cached }` is NOT this shape; ignore it. */
export const ResearchComponentSchema = z
  .object({
    status: z.string(),
    data: z.record(z.string(), z.unknown()),
  })
  .passthrough();
export type ResearchComponentResponse = z.infer<typeof ResearchComponentSchema>;
```
There is no load-all / array response, so **no `LatestResearchSchema`**. As 5d–5h render specific fields out of `data`, add per-section schemas that `.parse` the slice they consume — do not widen `ResearchComponentSchema.data` to a concrete shape here, since it varies per component.

- [ ] **Step 4: Green + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run src/features/market-research/__tests__/contracts.test.ts
npm run lint && npx tsc --noEmit -p tsconfig.app.json
```
Expected: PASS.
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/market-research/contracts.ts frontend/src/features/market-research/__tests__/contracts.test.ts
git commit -m "feat(fe): add feature-local zod contracts for market-research (shapes verified live)"
```

---

## Task 3: MSW handlers for market-research (spec §4.2 prerequisite)

**Files:**
- Modify: `frontend/src/test/msw/handlers.ts`

> Spec 24 §4.2, §8. Per-feature handlers grow here as unit tests need them (Phase-3/0b convention). Author them **now** — before the service and hook tests — so Tasks 4–5 (and 5d–5h) have canned responses and each later task is a clean red→green within its own task.

- [ ] **Step 1: Add handlers** to `src/test/msw/handlers.ts` (append to the `handlers` array) returning the **real** `{ status, data }` envelope (`MarketResponse`):
```ts
http.post("/api/market-research", async ({ request }) => {
  const body = (await request.json()) as { component_name?: string };
  return HttpResponse.json({
    status: "success",
    data: {
      component_name: body.component_name ?? "market size & opportunity",
      title: "Test",
      summary: "Test summary",
    },
  });
}),
```
(There is **no** GET `/api/market-research` — POST only. Put the per-component report fields under `data`; keep them in sync with what 5d–5h sections read.)

- [ ] **Step 2: Verify the harness still loads + commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run src/features/market-research   # contracts test stays green; the service/hook tests (Tasks 4–5) consume these handlers next
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/test/msw/handlers.ts
git commit -m "test(fe): add MSW handlers for market-research operations"
```

---

## Task 4: Service fns over the shared client + rate limiter (`services/marketResearch.ts`)

**Files:**
- Create: `frontend/src/features/market-research/services/marketResearch.ts`
- Test: `frontend/src/features/market-research/services/__tests__/marketResearch.test.ts`

> Spec 24 §4.2. One typed fn per operation over `apiGet`/`apiPost` (which already route through the single shared `rateLimiter` — confirm in Step 1; **no second limiter**). `.parse` happens inside `apiGet`/`apiPost` via the schema arg.

- [ ] **Step 1: Confirm the shared client applies the rate limiter**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -n 'rateLimiter\|executeWithRateLimit\|RATE_LIMIT_RPM' src/shared/api/client.ts src/shared/api/rateLimiter.ts
```
Expected: `client.ts`'s `apiRequest` (used by `apiGet`/`apiPost`) draws on the single `rateLimiter` instance. If it does **not**, the service fns must wrap calls in `rateLimiter.executeWithRateLimit(...)` themselves — but do not instantiate a new limiter (spec §4.2: 30/min is one frozen budget).

- [ ] **Step 2: Write the failing service test (MSW-backed)**

Create `services/__tests__/marketResearch.test.ts` asserting `fetchResearchComponent` hits `POST /api/market-research` with a valid `MarketRequest` body (`user_id` + `component_name` + `data`) and returns a parsed `ResearchComponentResponse` (`{ status, data }`) (MSW handlers already exist from Task 3; the test is red only until the service fn is implemented in Step 4). Include a `.parse`-failure case (handler returns junk → throws).

- [ ] **Step 3: Run it red**, then **Step 4: implement `services/marketResearch.ts`:**

```ts
import { apiPost } from "@/shared/api/client";

import { ResearchComponentSchema, type ResearchComponentResponse } from "../contracts";

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
 *  org/context fields the LLM needs — pin its exact contents from Task 1. NO
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
```
> If the competitor 2-retry loop (5a code) is genuinely needed, encode it here as a small bounded retry inside `fetchResearchComponent` (or rely on TanStack's `retry`); do not reintroduce raw `fetch`. Decide from the Task 1 live behavior.

- [ ] **Step 5: Green + commit** (the Task 3 MSW handlers back the test — it goes green once the service fn is implemented):
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/market-research/services
git commit -m "feat(fe): add market-research service fns over shared client + rate limiter"
```

---

## Task 5: Query keys (extend `qk`) + hooks (`hooks/useMarketResearch.ts`)

**Files:**
- Modify: `frontend/src/shared/api/queryKeys.ts` (extend `qk`)
- Create: `frontend/src/features/market-research/hooks/useMarketResearch.ts`
- Test: `frontend/src/features/market-research/hooks/__tests__/useMarketResearch.test.tsx`

> Spec 24 §1.3.6, §4.2. Query keys go in the **central** `qk` factory (array-tuple, `as const`), matching the existing flat-function style (`qk.companyProfile(orgId)`). Hooks are **feature-owned**.

- [ ] **Step 1: Extend `qk`** in `src/shared/api/queryKeys.ts` (add to the existing `qk` object, matching style):
```ts
  marketResearchComponent: (orgId: string, componentName: string) =>
    ["market-research", "component", orgId, componentName] as const,
```

- [ ] **Step 2: Write the failing hook test** (RTL + `QueryClientProvider` + MSW) asserting `useResearchComponent` returns parsed data and `useRegenerateResearch` invalidates the component key.

- [ ] **Step 3: Run red, then Step 4: implement `hooks/useMarketResearch.ts`:**
```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/shared/api/queryKeys";

import {
  fetchResearchComponent,
  type ResearchComponentName,
} from "../services/marketResearch";

/** One research component (read-via-POST). The page hydrates by calling this once per
 *  component; section hooks (5d–5h) wrap it. `userId`/`orgId` come from auth/tenant
 *  context (the backend `MarketRequest` requires `user_id`). */
export function useResearchComponent(
  userId: string,
  orgId: string,
  componentName: ResearchComponentName,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.marketResearchComponent(orgId, componentName),
    enabled: enabled && !!userId && !!orgId,
    queryFn: () => fetchResearchComponent(userId, componentName, { orgId }),
  });
}

/** Force-regenerate a component, then invalidate its cache. */
export function useRegenerateResearch(userId: string, orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (componentName: ResearchComponentName) =>
      fetchResearchComponent(userId, componentName, { orgId, refresh: true }),
    onSuccess: (_data, componentName) => {
      void queryClient.invalidateQueries({
        queryKey: qk.marketResearchComponent(orgId, componentName),
      });
    },
  });
}
```
> Read-vs-write semantics (is per-component a query or a mutation?) are verified live in Task 1 — adjust if the backend treats the POST as non-idempotent generation. Company-profile reads use the existing `useCompanyProfile(orgId)` — do **not** add one here.

- [ ] **Step 5: Green + commit:**
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/shared/api/queryKeys.ts frontend/src/features/market-research/hooks
git commit -m "feat(fe): add market-research query keys + useQuery/useMutation hooks (memory-only)"
```

---

## Task 6: Rewire the page to the hooks; delete raw fetch + localStorage cache

**Files:**
- Modify: `frontend/src/features/market-research/pages/MarketResearchPage.tsx`

> Spec 24 §4.2. Rewire the (still-monolithic) page's **intelligence** data access to the hooks; delete the raw `fetch` sites, the `CACHE_DURATION` cache, and the `localStorage` refs backing it. Keep server data out of page `useState` where the hook now owns it. `sessionStorage` cross-tab handoff stays. The `analysis`/`trends` tabs have no fetches to touch.

> **Sequencing (from the 5b investigation):** the on-mount cache *read* calls the same `setX` setters the rewire removes, so "replace fetches" and "delete cache-read" are **mutually coupled** — they land together or the file won't compile. The `saveXToLocalStorage` helpers take their data as a parameter, so they're separable. Hence one atomic rewire, then a compile-safe checkpoint, then a dead-code sweep.

- [ ] **Step 1: Atomic rewire — hooks in; fetchers + cache-read + server `useState`s out (one step)**

Working from Task 0 Step 3's site list, in a single pass: (a) wire the per-component hooks — `useResearchComponent(userId, orgId, name)` for each of the 5 components, `useRegenerateResearch` for refresh buttons, `useCompanyProfile` for the profile GET (there is **no** `useLatestResearch` — hydrate per-component); (b) delete the per-component fetch fns (`fetchMarketSizeData`, `fetchIndustryTrendsData`, `fetchRegulatoryData`, `fetchCompetitorData`, `fetchMarketEntryData`, the cascade/load) **and** the on-mount cache-read effects that call their `setX` setters; (c) remove the server-data `useState`s those setters filled (the hook now owns that data). `userId`/`orgId` come from the existing auth/tenant context. After this step the page compiles and renders from hooks; the `saveXToLocalStorage` helpers + `CACHE_DURATION` + cache-bust are now **dead but still present** (harmless — swept in Step 3).

- [ ] **Step 2: Checkpoint — compile + render before the sweep (bisection point)**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsc --noEmit -p tsconfig.app.json && npm run test
```
Then `npm run dev` and open the market-intelligence route — confirm every section shows data, not an empty/stale state. **This is the compile-safe bisection point:** the rewire (Step 1) is in but the dead cache code is still present, so if the page renders wrong the cause is isolated to the hook wiring, and the **pre-Task-6 commit remains the rollback anchor** (working raw-`fetch` + cache path). Render correct → proceed; wrong → fix here (or revert and re-apply Step 1 as a smaller diff) before sweeping.

- [ ] **Step 3: Dead-code sweep — remove the now-unreferenced cache machinery**

Delete `CACHE_DURATION`, the `saveXToLocalStorage` helpers, the `?_cb&_r`/`_cache_bust`/`_timestamp` busting, and the now-unused `getUserLocalStorage`/`setUserLocalStorage` imports. Keep `removeUserLocalStorage` only if a non-cache concern still uses it. After this step:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
P=src/features/market-research/pages/MarketResearchPage.tsx
grep -n 'CACHE_DURATION\|_cache_bust\|?_cb' "$P"           # expect: NO output
grep -c 'fetch(' "$P"                                       # expect: 0 (the PAGE; section files still self-fetch until 5d–5h)
grep -c 'localStorage' "$P"                                 # expect: near 0 — only non-cache survivors, if any
```
Expected: no cache machinery, no raw `fetch` in the **page**. (Section components still self-fetch the same endpoint — those migrate with their 5d–5h decomposition, reading these hooks. The legacy lead-stream tab 5c extracts carries its own access — but 5a found the analysis tab has none.)

- [ ] **Step 4: Settle, typecheck, lint, test, commit**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint --fix src && npm run lint && npx tsc --noEmit -p tsconfig.app.json
npm run test
```
Expected: PASS. `npm run test` includes the contract/service/hook tests.
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src
git commit -m "refactor(fe): consume market-research hooks; remove raw fetch + localStorage cache"
```

---

## Task 7: ADRs + final preflight + done-when

**Files:**
- Create: `docs/adr/0003-market-research-contracts-are-feature-local.md`
- Create: `docs/adr/0004-market-research-cache-is-memory-only.md`

> Spec 24 §4.2, §1.3.3, §1.3.4. Two ADRs in the slim Context/Decision/Consequences form (`docs/adr/0001-adr-template.md`). Run `ls docs/adr/` and pick the next two available numbers (likely `0003`/`0004`, but use whatever is free if parallel work landed ADRs first); keep the in-code ADR reference in `services/marketResearch.ts` in sync with the cache ADR's actual number.

- [ ] **Step 1: Write ADR-0003 (feature-local contracts)** — Context: where do market-research zod schemas live; Decision: a single feature-local `contracts.ts` (the ≥2-features promotion rule keeps single-feature shapes in the feature; Phase 3's per-domain `contracts/` *directory* is for the cross-cutting shared surface); Consequences: precedent for Phases 6–12; promote to `shared/api/contracts/` only when a 2nd feature imports a shape.

- [ ] **Step 2: Write ADR-0004 (memory-only cache)** — Context: the retired hand-rolled localStorage 5-min cache vs TanStack; Decision: memory-only TanStack cache, no persister (resolves master §8 Q9 toward simplicity + Phase-3 consistency + MVP velocity); Consequences: reload re-fetches (accepted, R7), more calls through the 30/min limiter — sufficiency is not meaningfully testable pre-launch (0 users), so the post-launch measurement is itself the revisit trigger.

- [ ] **Step 3: Commit the ADRs**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx prettier --check ../docs/adr/0003-*.md ../docs/adr/0004-*.md || true
```
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/adr/0003-market-research-contracts-are-feature-local.md docs/adr/0004-market-research-cache-is-memory-only.md
git commit -m "docs(adr): market-research contracts feature-local (0003); cache memory-only (0004)"
```

- [ ] **Step 4: Full preflight + behavioral parity**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```
Expected: PASS, including `journeys/04` (login → marketintelligence → a market-research POST fires). **If `journeys/04` reds**, the rewire stopped the auto-fetch from firing — investigate (a hook not enabled, wrong endpoint); fix and re-run; if unfound, STOP (abort 4). Note `journeys/04` only checks that ≥1 request fires (it reads `component_name` to pick its mock but does **not** assert it), so it guards "the page still calls the endpoint" — not the request/response shape. The `{ status, data }` parse in the contract test + the service test's body assertion are what guard the shape.

After preflight, also spot-check that all five section components (market size, industry trends, regulatory, competitor, market entry) still render their data — they keep their own raw `fetch` until 5d–5h, and 5b's MSW/`qk`/limiter changes share surface with them. **`journeys/04` is a pure smoke check (it asserts only no-login-bounce + ≥1 request fired), so it will NOT catch a section that renders blank** — this manual render check is the only 5b signal. Per-section E2E assertions arrive with each section's 5d–5h conversion; record this coverage note in the §9 delta (Step 6).

- [ ] **Step 5: Done-when (spec §4 "Done when")**
1. Market-research-proper data comes from TanStack Query (memory-only); company profile via `useCompanyProfile`.
2. The page-level localStorage cache + raw `fetch` sites are gone and the data layer (services/hooks/contracts/qk/MSW) exists. **Section components still self-fetch the same endpoint — migrated per-section in 5d–5h** (hooks exist now → R3). `analysis`/lead-stream has no fetches.
3. MSW handlers cover the market-research operations; contract/service/hook unit tests pass.
4. Both ADRs (0003, 0004) merged.
5. Behavior parity (`journeys/04`) + `npm run preflight` green.

- [ ] **Step 6: Spec 24 §9 delta + handoff** — append a §9 note: "5b confirmed all market-research fetches are intelligence-owned; §4.2's lead-stream-fetch exclusion is moot (analysis tab does no fetching) — its data-layer migration remains Phase 7's when it claims the component. §4.2's 'Done when' item — only the analysis/lead-stream tab's raw `fetch` remains in the page — is likewise void: 5b's done-when is stricter (zero raw `fetch` in the page), since the analysis tab has none." Then `/review-impl` → `/synthesize-impl-review` → controller preflight → merge `phase-5b-data-layer` → `master`. **5c must not begin until 5b is merged** (5c reads from these hooks).

---

## Self-review notes (plan author)

- **Spec coverage:** §4.1 endpoint inventory + live verification (Tasks 0–1); §4.2 services/contracts/hooks/qk/MSW/page-rewire/ADRs (Tasks 2–7); §4 "Done when" (Task 7 Step 5); R2 live-shape verification (Task 1, abort 3); R7 memory-only + reload re-fetch (ADR-0004).
- **Contract locked for downstream plans (24c–24h consume these exact names):** `services/marketResearch.ts` → `RESEARCH_COMPONENTS`, `fetchResearchComponent(userId, componentName, { orgId?, data?, refresh? })`; `contracts.ts` → `ResearchComponentSchema`/`ResearchComponentResponse` (the `{ status, data }` envelope); `hooks/useMarketResearch.ts` → `useResearchComponent(userId, orgId, name)`, `useRegenerateResearch(userId, orgId)`; `qk.marketResearchComponent`; company profile → `useCompanyProfile` (reused). **No `loadLatestResearch`/`LatestResearchSchema`/`useLatestResearch`/`qk.marketResearchLatest`** — the backend has no load-all endpoint, so the page hydrates per-component. ⚠️ Any 24c–24h step that referenced `useLatestResearch` must be updated to per-component `useResearchComponent`.
- **Authoritative envelope, captured internals:** the response envelope `{ status, data }` and the `MarketRequest` body come from the backend `market_research` models/router (authoritative — the route has `response_model`); the opaque inner `data` per component is captured in Task 1 for 5d–5h. The schema code here is the correct envelope; the per-section `data` slices are refined as sections convert. (Corrects the round-1 assumption — copied from the 5a E2E mock — that the envelope was `{ component_name, status, result, cached }`.)
- **Divergence carried from 5a:** the analysis/trends tabs do no MR fetching → §4.2's exclusion is moot; recorded as a §9 delta, and 5c's lead-stream extraction carries no raw fetch.
- **Section self-fetch (key scope correction):** the five sections each hold their own `market-research` fetch + cache; 5b creates the hooks + migrates the **page** sites, and each section's fetch migrates with its **5d–5h** decomposition (R3 satisfied — hooks precede section conversion). Plans 24d/24e/24f/24g/24h each encode "complete this section's 5b migration" accordingly; 24i confirms no raw `fetch` remains in the feature at phase close.
