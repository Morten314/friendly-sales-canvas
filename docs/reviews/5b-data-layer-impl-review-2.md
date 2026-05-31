---
artifact: phase-5b-data-layer
artifact_type: impl
verdict: clean
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-30
round: 2
base_ref: master (resolved to 80ebec9)
spec_loaded: true
plan_loaded: true
---

## Context

Round 2 review of the range `80ebec9..32bbec9` (base = master post-5a; tip = 5b branch before merge). Branch was already merged to master at `d418487`; the explicit parent range was used for the diff. Spec: `specs/24-frontend-phase-5-market-research-design.md` (§4). Plan: `plans/24b-frontend-phase-5b-data-layer.md`.

**Round 1 status:** five findings were raised (1 Medium, 2 Low, 2 Nit). This round re-evaluates all five against the current code state and checks for issues round 1 missed.

- Round 1 Low #2 (service-fn JSDoc claimed `data: {}`) — **fixed** by commit `8889c17`. The doc now correctly describes the cascade `previousContext`.
- Round 1 Medium #1 (read hook can't express cascade/refresh) — re-assessed below. The finding is valid as a forward-looking advisory but is not a deficiency in 5b's scope.
- Round 1 Low #3, Nit #4, Nit #5 — still present; assessed below.

## Findings

### [Low] useResearchComponent doesn't expose `data`/`refresh` opts — forward advisory for 5d–5h

**Location:** `frontend/src/features/market-research/hooks/useMarketResearch.ts:10-21` (`useResearchComponent`).

The hook hard-codes `{ orgId }` and doesn't pass `data` or `refresh` through to `fetchResearchComponent`. This is correct for 5b's delivered scope (initial read-via-POST, no page rewire). But the plan self-review section locks this hook signature as the contract for 24c–24h, and sections that need cascade `previousContext` or read-path refresh cannot express them through `useResearchComponent` without extending the hook. This is a known design decision, not a bug — the cascade is page-level orchestration that 5c–5h own — but it should be surfaced explicitly in each 5d–5h plan so they either (a) accept that cascade is dropped (a deliberate behavior change stated in the plan), or (b) extend the hook signature or add a section-level wrapper. Left unflagged, it surfaces as a parity surprise mid-extraction.

### [Low] Hook test relies on fixed setTimeout rather than deterministic flush

**Location:** `frontend/src/features/market-research/hooks/__tests__/useMarketResearch.test.tsx:59-61` (50ms wait) and `:117-119` (80ms wait).

The load-bearing assertions (disabled query stays idle; regeneration doesn't fire a third POST) use fixed `setTimeout` delays rather than `waitFor` on a stable condition or a deterministic `act` flush. Under MSW's synchronous node adapter this passes reliably, but it's timing-dependent rather than state-dependent. A deterministic pattern (`await waitFor(() => expect(...).toBe(...))`) would be more robust against future handler latency changes.

### [Nit] journeys/04 asserts only that a request fires — no render verification

**Location:** `frontend/e2e/journeys/04-market-research-5-components.spec.ts:50`.

The envelope fix to `{ status, data }` is correct. With the page rewire deferred, the journey asserts only `marketResearchRequestCount > 0`. A page that fetches but renders nothing would still pass. This is acknowledged in the plan (Task 6 Step 3b, Task 7 Step 4) and is acceptable as an interim floor — real render parity arrives per-section in 5d–5h. Recorded so the gap is explicit.

### [Nit] `status: z.string()` accepts any string

**Location:** `frontend/src/features/market-research/contracts.ts:11`.

The envelope schema accepts any `status` string rather than gating on `"success"`. This is intentional (the contract validates shape; callers apply `=== "success"` semantics), and tolerant-by-default is the right posture for a pre-launch contract. Noted for the record only.
