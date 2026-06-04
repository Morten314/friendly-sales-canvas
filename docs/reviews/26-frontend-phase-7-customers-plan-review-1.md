---
artifact: plans/26-frontend-phase-7-customers.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-04
round: 1
---

## Context

This review is of the full plan (2009 lines, 22 tasks across 5 stages) against its paired spec `specs/26-frontend-phase-7-customers-design.md`. The plan is a Phase 7 frontend feature extraction (customers/Profiler surface, ~3,717 LOC) following Phases 4–6's established per-feature shape. No token or context pressure; the entire plan and spec were read.

## Findings

### [High] T20 commit path includes repo directory prefix — will fail

**Location:** Task 20, step 4 (line 1903–1905)

The `git add` command uses `brewra-gtm-intelligence/specs/25-frontend-phase-6-mission-control-design.md` as the path. The working directory at execution time is the repo root (`/projects/Brewra/brewra-gtm-intelligence`), so the correct path is `specs/25-frontend-phase-6-mission-control-design.md`. The prefixed path will cause `git add` to fail (path not found). The same incorrect prefix appears in step 2 (line 1886).

**Fix:** Strip the `brewra-gtm-intelligence/` prefix from both the `git add` paths and the file-modification instruction in steps 1–2.

### [High] T16 reject test is pseudocode — will not compile or run

**Location:** Task 16, step 2 (lines 1659–1671)

The second test case ("reject writes a dismissed-marker after the undo window") is a stub: the body is a comment (`// …trigger reject, advance timers 5s, assert localStorage[…] contains rec-1…`) with no actual assertions or user-event interactions. The file imports `PROFILER_DISMISSED_RECOMMENDED_IDS_KEY` but never references it in an assertion, so the import will flag as unused under lint. A test file with no actionable assertions provides a false green signal.

**Fix:** Either complete the test body (render cards → find the reject button → click → `vi.advanceTimersByTime(5000)` → assert localStorage) or, if the full behavioral coverage is deferred, remove the stub and log the gap via a TD-FE entry as the plan suggests at line 1607 ("if the full optimistic edge-case matrix proves out-of-budget"). As written, a no-assertion test that always passes is worse than no test.

### [High] No global kill/abort criteria stated

**Location:** Plan-wide (conventions section, lines 13–26; stage structure throughout)

The plan specifies per-stage recovery (`git reset --hard` to last-green checkpoint) and a merge gate (T22), but nowhere states the conditions under which the **entire plan** should be abandoned. What if T11 (the highest-risk parity swap) fails three times? What if the SuggestedICPCards decomposition proves structurally impossible without a behavior change? The convention "stop — that's a parity break, not a refactor" (line 25) is a per-step halt rule, not an abort criterion for the phase.

**Fix:** Add a brief abort section after the conventions (or in the stage-1 header). Something like: "If three successive attempts at T11 (or any single task) fail VR parity without a clear fix, escalate to the human operator. If the operator cannot resolve within one session, the phase is suspended and the spec is revisited." This matches the repo's pre-launch CTO-autonomy posture while providing a floor.

### [Medium] T11's hook-first-but-disabled pattern is architecturally confusing

**Location:** Task 11 context (lines 1050–1056)

The plan mounts `useCustomerProfile` and `useSuggestedIcps` with `enabled: false`, so they register cache keys but never fetch. The actual data flow goes through the service functions (`fetchCustomerProfileIcps`, `fetchSuggestedIcps`) called from the imperative `loadProfilerPagePayload` loader. The hooks' only role at this stage is cache registration — they don't participate in fetching, loading states, or error handling. A future reader (or Phase 9 consolidation agent) will see hooks mounted but unused and may incorrectly assume they drive the data flow.

The plan acknowledges this via TD-FE-43, but the intermediate state is still potentially misleading. Consider a code comment at the mount site explaining the split (e.g., "Hooks registered for cache-key ownership; fetching driven by the imperative loader until TD-FE-43 resolution").

### [Medium] T16 accept-test DOM selector is fragile

**Location:** Task 16, step 2 (line 1652)

The selector `card.closest("[data-slot], .card, div") as HTMLElement` will match the first ancestor `<div>` — which is almost certainly too broad and will scope `getByRole("button", { name: /accept/i })` to the entire page, not the card. This will either match the wrong button or fail non-deterministically depending on render order.

**Fix:** Use a more specific card container selector (e.g., wrap `RecommendedICPCard` in a `data-testid="icp-card"` in T12, then use `screen.getByTestId("icp-card")` as the scope). Alternatively, since the accept flow requires two clicks (Accept → confirm "Save to Customer Profile"), use `screen.getAllByRole("button", { name: /accept/i })` and pick the first, or use `within` on a more targeted container.

### [Medium] Stages 2–4 tasks lack explicit VR regression signal between stage gates

**Location:** Tasks T3–T10, T13–T15

VR journey `06` runs at stage boundaries (T2 step 12, T7 step 4, T11 step 4, T12 step 6, T16 step 4). But within stages 2–4, tasks T3–T6 and T13–T15 have no VR check — only `npm run verify` + prettier. These tasks create hooks/services/mutations that are not yet wired into the running app (hooks are consumed later in T11/T16), so VR would pass trivially. However, T5 (MSW handlers) modifies the shared `handlers.ts` file — a collision with another feature's handler could surface as a VR regression on a *different* feature's journey, which wouldn't be caught until the stage-5 full preflight.

The shared-MSW risk is partially mitigated by the convention at line 21 ("also run the broader `npm run test` … grep for sibling consumers before changing a handler"). But `npm run test` (unit tests) wouldn't catch an MSW collision that manifests as a visual regression.

**Fix:** Consider running the full e2e suite (`npm run test:e2e`) after T5, not just the customers journey, since `handlers.ts` is shared infrastructure. Alternatively, this risk is acceptable given the plan's explicit note about MSW collisions (line 519) and the stage-5 serial preflight's full e2e coverage.

### [Medium] T2 is a large atomic relocation — if it fails partway, recovery is unclear

**Location:** Task 2 (lines 122–267, 13 steps)

T2 moves 5 files via `git mv`, fixes imports across all 5, creates `routes.tsx`, updates `index.ts`, modifies `src/app/routes.tsx`, modifies `App.tsx`, and deletes the old files. The plan states this should be one commit ("a single commit keeps the tree green"). But with 13 steps, if the import-fixing goes wrong at step 6, there's no intermediate green state to roll back to within T2 — you'd have to `git checkout` all the moved files and start over.

This is partially mitigated by the checkpoint being the T1 commit, but T1 is just placeholders. The risk is that `git reset --hard` to T1 loses the `git mv` history-preservation benefit (the moves would need to be re-done). A workable alternative: do the `git mv` + import fixes + verify all in one pass without committing intermediates, which is essentially what the plan prescribes. The concern is minor but worth noting for an implementer who might try to commit after step 6.

### [Low] T3 and T4 could run in parallel; T6 and T7 could run in parallel; T14 and T15 could run in parallel

**Location:** Tasks 3–4, 6–7, 14–15

- T3 (query keys) and T4 (zod contracts) are independent — T4 doesn't reference the query keys.
- T6 (`useCustomerProfile`) and T7 (`useSuggestedIcps`) are independent — they import from the same service file (T5) but don't reference each other.
- T14 (accept/save mutations) and T15 (reject/delete mutations) are independent.

The plan is designed for single-agent serial execution, and the tasks are small, so the parallelization benefit is marginal. But if using the subagent-driven-development execution mode (which the plan recommends), these parallelization opportunities are available and not called out.

### [Low] T1 (scaffold) is ceremonial overhead — could be folded into T2

**Location:** Task 1 (lines 74–120)

T1 creates three files with placeholder content (`export {};`, a one-line README) and commits them. T2 immediately modifies two of the three (`index.ts`, `README.md` stays a placeholder until T19). The scaffold adds a commit checkpoint but no independent value — the relocate in T2 could create the directory structure as part of its `git mv` operations. This is a minor observation about commit granularity; the plan's convention of "one logical step = one commit" justifies it, but the implementer should know the T1 commit is discardable if T2 needs to reset.

### [Low] T5 `fetchSuggestedIcps` sets an unnecessary `Content-Type` header on a GET request

**Location:** Task 5, step 1 (line 417)

```ts
headers: { "Content-Type": "application/json" },
```

A GET request has no body, so `Content-Type` is meaningless. This is harmless but could confuse a future reader into thinking the request sends a body. Remove the header for clarity (parity is preserved either way since the header is ignored by the server).

### [Nit] T17 is in Stage 4 but tests Stage 1 artifacts

**Location:** Task 17 (lines 1699–1764)

T17 adds tests for `LeadStream` and `ProfilerChatWithHistory`, both relocated in Stage 1 (T2). These tests don't depend on any Stage 4 work. They could run in Stage 1 (after T2) or Stage 3 (after decomposition). Being in Stage 4 is harmless but slightly misleading about dependencies.

### [Nit] Spec 26 §3 file tree shows `CurrentIcpsTable.tsx` not present, but plan T12 creates it

**Location:** Plan Task 12 vs Spec §3 (line 86 of spec)

The spec's target structure (§3) lists `SuggestedICPCard.tsx` but not `CurrentIcpsTable.tsx`. The plan adds `CurrentIcpsTable.tsx` in T12. This is within spec's delegation ("exact subcomponent split inside `icp-intelligence/` is finalized during stage 3 — the plan enumerates it; names above are the expected seams, not a contract"), so it's not drift, but worth noting for completeness.

### [Nit] Self-review section (lines 1988–1998) is a good practice

The plan includes a detailed self-review mapping every spec section to plan tasks. This is thorough and speeds up the plan review. No action needed; noting as a positive pattern.
