---
artifact: phase-5b-data-layer
artifact_type: impl
verdict: findings
reviewer_model: claude-opus-4-8
date: 2026-05-31
round: 1
base_ref: 80ebec9
spec_loaded: false
plan_loaded: true
---

## Context

Reviewed the range `80ebec9..32bbec9` (base = master with Phase 5a only; tip = the 5b branch before its merge). The branch was already merged to master (`d418487`), so a branch-vs-master diff is empty — the explicit range was used. Plan loaded: `plans/24b-frontend-phase-5b-data-layer.md`. Spec (`specs/24-...`) not separately re-read; the plan carries the spec intent. Task 6 (page rewire) was descoped during execution to 5c/5d–5h; the descope was assessed as part of this review (see below). Diff hygiene is clean — every changed file belongs to 5b's scope; no unrelated changes.

**On the descope (assessed, not a finding):** The Task 6 descope is **justified**. `MarketResearchPage.tsx` confirms the page's market-research data is editable UI state, not a server cache the hooks can own: per-component fetchers pass `data: previousContext` for cascading (e.g. `fetchMarketSizeData` ~2886/2935), responses are reconciled by timestamp-merge (`isTimestampNewer`/`toUTCTimestamp` gating `shouldUpdateData` ~3037–3055), and the data states carry ~113 `setX` callsites plus edit-history apply/undo. Deleting them per the plan's Step 1(c) would destroy real features. Deferring page-level fetch/cache removal to 5c/5d–5h is the correct call, and it is documented (Task 6 banner, ADR-0004 scope note, TD-FE-19). The data layer existing now satisfies R3 (hooks precede section conversion).

## Findings

### [Medium] Read hook can't express the page's cascade context or `refresh`; downstream sections (5d–5h) are locked to an insufficient signature

**Location:** `frontend/src/features/market-research/hooks/useMarketResearch.ts:11-22` (`useResearchComponent`); plan self-review note "Contract locked for downstream plans".

`useResearchComponent(userId, orgId, componentName)` calls `fetchResearchComponent(userId, componentName, { orgId })`, so `data` always defaults to `{}` and `refresh` is always `false` — the hook exposes no way to pass either. But the descope rationale itself establishes that the page's real per-component fetches send `data: previousContext` (cascade) and drive refresh through that path. The service fn (`marketResearch.ts`) correctly supports `{ data?, refresh? }`, but the **read hook** — which the self-review notes lock as the contract 24c–24h consume — does not surface them. Any 5d–5h section that needs the cascade `previousContext` (or a non-mutation refresh) cannot get it through `useResearchComponent` as written; it would have to bypass the hook or the hook must be extended. This should be surfaced to the 5d–5h plans now so they either (a) accept that cascade context is dropped (a deliberate behavior change, which the section plans should state), or (b) extend the hook signature. Left unflagged, it surfaces as a parity surprise mid-section-extraction.

### [Low] Service-fn doc comment claims "the page currently sends `data: {}`" — contradicted by the descope finding

**Location:** `frontend/src/features/market-research/services/marketResearch.ts:14-15` (JSDoc on `fetchResearchComponent`).

The comment states "`data` carries the org/context fields the LLM needs — the page currently sends `data: {}` (empty)." The Task 6 investigation (and ADR/TD-FE-19) established the opposite for the per-component paths: they send `data: previousContext` (cascade). Only the simpler `getAllScoutComponentResponses` cascade sends `data: {}`. The comment is an internal inconsistency between two delivered artifacts and could mislead a 5d–5h implementer into believing `data: {}` is faithful to current behavior. Recommend correcting it to note the page uses cascade context and that callers pass `data` accordingly (ties into the Medium finding above).

### [Low] "No second POST" hook assertion relies on a fixed `setTimeout`, not a deterministic flush

**Location:** `frontend/src/features/market-research/hooks/__tests__/useMarketResearch.test.tsx` (the regenerate test's ~80ms wait; also the ~50ms wait in the disabled-query test).

The load-bearing assertion that `useRegenerateResearch` uses `setQueryData` (not `invalidateQueries`) is proven by waiting a fixed ~80ms and asserting the request count stayed at 2. This passes and isn't flaky under the MSW node adapter (synchronous responses), but it is timing-based rather than state-based; a deterministic flush (`await act(async () => {})`) or a `waitFor` on a stable condition would be more robust and would not regress if handlers later add artificial latency. Already noted as advisory in the per-task code-quality review; recording here for completeness. Not blocking.

### [Nit] journeys/04 no longer verifies any render; mock `data` omits the fields the current page reads

**Location:** `frontend/e2e/journeys/04-market-research-5-components.spec.ts`; `frontend/e2e/fixtures/api-mocks.ts`.

The envelope fix to `{ status, data }` is correct and is the right shape for both the on-old-path sections (`result.status === "success" && result.data`) and the future hooks. With the render assertion deliberately deferred (the un-rewired page reads `data.executiveSummary`/`data.tamValue`/…, not `data.summary`), `journeys/04` now asserts only that a request fires (`marketResearchRequestCount > 0`) — a weak smoke check. This is acknowledged and documented (Task 6 Step 3b note, Task 7 Step 4), and is acceptable as an interim floor; the real render parity arrives with per-section 5d–5h E2E assertions. Flagging only so the gap is explicit: between now and 5d–5h, a page that fetches-but-renders-nothing would still pass this journey.

### [Nit] `status: z.string()` accepts any string

**Location:** `frontend/src/features/market-research/contracts.ts:11`.

The envelope schema accepts any `status` string rather than gating on `"success"`. This is intentional and fine (the contract validates shape; callers/sections decide on the `=== "success"` semantics, matching the existing page), and tolerant-by-default is the right posture for a pre-launch contract. Noted only for the record; no change recommended.
