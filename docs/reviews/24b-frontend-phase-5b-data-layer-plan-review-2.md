---
artifact: plans/24b-frontend-phase-5b-data-layer.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-30
round: 2
---

## Context

Round 2 review. The round 1 review (`24b-frontend-phase-5b-data-layer-plan-review-1.md`) identified 11 findings across High/Medium/Low/Nit. The plan has been substantially revised since round 1: task sequencing was corrected (MSW handlers now precede services and hooks), Task 1 gained a hard-gate verification step, Task 6 gained a bisection checkpoint, `LatestResearchSchema` was removed entirely, and the §9 delta mechanism was added. Most round 1 findings are resolved. This review assesses the current plan against the same checklist and identifies remaining issues.

The source spec (`specs/24-frontend-phase-5-market-research-design.md`) was read in full. The shared client (`frontend/src/shared/api/client.ts`) was verified: `apiPost` accepts `(endpoint, body, schema)` matching the plan's service-fn usage, and the rate limiter is integrated at `apiRequest` (line 18), confirming Task 4 Step 1's expectation. ADR directory currently contains only 0001/0002, so the plan's 0003/0004 is correct as of today.

## Findings

### [Medium] Task 6 Step 1 is a large atomic edit with no per-component verification signal

**Location:** Task 6 Step 1 ("Atomic rewire — hooks in; fetchers + cache-read + server `useState`s out (one step)")

The plan justifies atomicity (on-mount cache-reads call the same `setX` setters the rewire removes, so they must land together) and provides a bisection checkpoint in Step 2. However, the single-pass edit touches 5 per-component fetch fns, 5 cache-read effects, 5 server-data `useState`s, and 5 new hook calls in a monolithic file. If the checkpoint reveals a problem, the agent knows "the rewire is wrong" but not which of the 5 components caused it.

Consider adding a per-component compile check within Step 1: after wiring each component's hook and deleting its fetch fn + useState, verify `tsc --noEmit` passes before proceeding to the next component. This turns a single large diff into 5 smaller verifiable edits. The mutual coupling the plan identifies (cache-reads → setters) applies at the batch level (all 5 components must be wired before the file compiles), but `tsc` will still identify type errors in partially-rewired state — catching e.g., a deleted setter still referenced by an untouched component.

### [Medium] `useRegenerateResearch` invalidation triggers a redundant background POST

**Location:** Task 5 Step 3, `hooks/useMarketResearch.ts` implementation

The mutation fires `POST /market-research` with `refresh: true`. `onSuccess` calls `queryClient.invalidateQueries`, which marks the `useQuery` for that component as stale and triggers a background refetch — `POST /market-research` with `refresh: false` (default). Two POSTs per regeneration. Using `queryClient.setQueryData` to populate the cache directly from the mutation result would avoid the second call.

At 0 users this is acceptable. But if ADR-0004 is the canonical record of the memory-only cache decision, it should note this pattern (invalidate-on-success causes double-fetch for POST-backed queries) and the revisit trigger (if per-component POSTs become expensive under load, switch to `setQueryData`).

### [Medium] §9 delta captures §4.2 correction but not §4.1's GET→POST-only correction

**Location:** Task 7 Step 6 ("Spec 24 §9 delta + handoff")

The plan's "Endpoint reality" section corrects spec §4.1's endpoint inventory: the spec lists a GET endpoint at line 2115 (`market-research` with cache-busted `?_cb&_r`) alongside seven POSTs; the plan verified all calls are POST-only. This is a factual correction to the spec's own "rough" inventory (spec §4.1 header says "rough; verified live in 5b"). The §9 delta note in Task 7 Step 6 captures the §4.2 scope correction (analysis tab has no fetches → exclusion is moot) but does not explicitly note the §4.1 GET→POST correction. Both should be recorded so downstream plan/spec readers see that §4.1's inventory is superseded.

### [Low] Task 7 Step 4 "spot-check" is manual and unexecutable by an agent

**Location:** Task 7 Step 4 ("also spot-check that all five section components still render their data")

The instruction to open the dev server and visually verify five section components is correctly identified as the only 5b regression signal for section-internal fetches (`journeys/04` won't catch a blank section). But the instruction is a human-only step. An agent executing this plan cannot perform it. The plan acknowledges the gap and defers per-section E2E assertions to 5d-5h, but offers no interim automated check (e.g., a Vitest integration test that renders each section component with MSW-backed data and asserts non-empty output).

Consider adding a lightweight Vitest smoke test in Task 7 that imports each section component and renders it within a `QueryClientProvider` + MSW, asserting the component doesn't throw and renders at least one data element. This provides an automated floor until 5d-5h's proper tests arrive.

### [Low] `e2e/fixtures/api-mocks.ts` has the wrong envelope but is not corrected

**Location:** Plan §"Endpoint reality" (identifies the mismatch), Task 3 Step 1 (MSW handlers), Task 7 Step 4 (`journeys/04`)

The plan correctly identifies that `e2e/fixtures/api-mocks.ts` returns `{ component_name, status, result, cached }` instead of the real `{ status, data }` envelope. No task corrects this mock. `journeys/04` reads `component_name` from the mock response (to pick its mock) but doesn't assert on the envelope shape, so the journey passes against the wrong shape today. However, if the mock is later used as a contract reference (by 5d-5h agents or future test authors), the fabricated shape will mislead. The plan warns against using it as a contract source, but the mock file itself carries no such warning.

Consider adding a `// WARNING: envelope shape is fabricated — do not use as contract source` comment to the mock in Task 3 (alongside the MSW handler work), or include a task to correct the mock to match `MarketResponse`.

### [Low] Task 4 Step 5 omits an explicit test-run command before commit

**Location:** Task 4 Step 5 ("Green + commit")

Steps 2-3 follow TDD: write failing test → implement. Step 5 says "Green + commit" but only includes `git add` + `git commit` commands — no `npx vitest run` to confirm the test went green. Compare Task 2 Step 4 which explicitly runs `npx vitest run` before lint/typecheck/commit. An agent executing Task 4 might skip the green verification and commit on assumption. Add `npx vitest run src/features/market-research/services/__tests__/marketResearch.test.ts` to Step 5 for consistency with the plan's own convention.

### [Nit] ADR git-add commands hardcode 0003/0004 despite dynamic-numbering instruction

**Location:** Task 7 Steps 1-3

Step preamble correctly says "pick the next two available numbers after `ls docs/adr/`." But the `git add` commands in Step 3 hardcode `docs/adr/0003-*.md` and `docs/adr/0004-*.md`. Currently correct (only 0001/0002 exist), but if a parallel phase lands ADRs between plan-authoring and execution, the commands reference wrong filenames. Minor: the agent will discover the mismatch when the `git add` fails on a nonexistent file.
