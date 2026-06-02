---
artifact: plans/24f-frontend-phase-5f-competitor-landscape.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-01
round: 3
---

## Findings

### [Medium] Edit-write fetch preservation creates tension with spec §6 "done when" gate

**Location:** Task 4 Step 3 ("The `/api/ask` edit-write `fetch` (L697) + its `/api/market_intelligence` re-read (L727) are the **write** path… **leave them as-is** this phase"); Self-review notes, second bullet; Task N+2 Step 6 done-when item 3.

The plan deliberately preserves two raw `fetch` calls inside `handleCompetitorLandscapeSaveChanges`: the POST to `/api/ask` (L697) and the GET re-read to `/api/market_intelligence` (L727). The reasoning is sound — 5d treated its `/ask` path identically, and migrating edit-writes to mutations is genuinely a different concern than read-path conversion. The spec §4 amendment also grants per-section plans explicit authority to decide what converts vs. is consciously deferred.

However, spec §6 "Done when (each)" states unambiguously: "the page's raw `fetch` site + cache slice for this section is removed." These two `fetch` calls survive past 5f, creating a literal mismatch with that gate. The `/api/market_intelligence` GET re-read is particularly notable — it is a raw GET that fires on every successful edit-save, effectively a read-path fetch bundled into the write handler. If 5i's zero-raw-fetch confirmation gate (spec §11 item 3) depends on every section having removed all raw fetches, this surviving pair becomes a blocker unless a mutation migration is scheduled before 5i.

**Recommendation:** The plan's "flag for review; candidate `TD-FE`" note is good. Upgrade it: during Task 4 execution, explicitly log a `TD-FE-<n>` entry recording the two surviving raw `fetch` calls, their rationale, and the 5i gate they must satisfy. This makes the deferred work traceable rather than just flagged.

### [Medium] No `journeys/04` regression check after Task 4 (the riskiest change)

**Location:** Task 4 Step 5 ("Settle, typecheck, lint, test, knip, commit") — runs `eslint`, `lint`, `tsc`, `vitest run <section>`, `knip`. Task N+2 Step 3 runs `npm run preflight` (which includes `journeys/04`).

Task 4 is the heaviest task — it introduces the hook, deletes the in-component read fetch/cache machinery, and rewrites how the container hydrates. It is the single point where a behavioral regression is most likely. But its gate only runs `vitest run` scoped to the section directory. The full `npm run preflight` (which includes `journeys/04` behavioral E2E) doesn't run until Task N+2, after all 11 sub-component extractions. If the hook adoption breaks `journeys/04`, the executor discovers this after 11+ commits of extraction work on top of the regression, making bisect and diagnosis harder.

**Recommendation:** Add `npx vitest run` (unscoped, full suite) and at minimum a `journeys/04` Playwright run to Task 4's gate, or add an explicit Step 5b between Task 4 and Task 5 that runs `journeys/04`. The full `npm run preflight` at Task N+2 remains the final gate.

### [Low] Hook test coverage is thin for the riskiest new module

**Location:** Task 4 Step 1 — the `useCompetitorLandscape.test.tsx` test file with 2 test cases.

The hook is the plan's riskiest new code (it bridges the 5b data layer to this section's view model). The provided test skeleton covers only: (1) data loads from the research-component hook, and (2) hook is disabled without an orgId. Missing coverage: error states (what happens when `useResearchComponent` errors — does `isError` propagate?), the `refresh` function's actual effect (does it call `regenerate.mutate` with the right arg?), `isRefreshing` tracking, and the data unwrap logic (`query.data?.data ?? query.data` — the `??` fallback may mask a 5b contract change).

The plan acknowledges the unwrap may need refinement ("refine the unwrap to whatever 5d/5e's hooks do"), but the test doesn't exercise the fallback path.

**Recommendation:** Add at least one error-state test and one test verifying the `refresh()` calls `regenerate.mutate(RESEARCH_COMPONENTS.competitor)`. This is not blocking — the test skeleton is a reasonable starting point and TDD will expand it — but the plan should note expected coverage expansion during implementation.

### [Low] `forceUpdate` useReducer fate not explicitly stated

**Location:** Task 0 Step 4 "Confirmed live structure" — lists "16 `useState` + `useReducer` (`forceUpdate`)" and "the ten `uiComponents`-derived locals." Task 4 Step 3 lists state to delete but does not mention `forceUpdate` by name.

The `useReducer` for `forceUpdate` is listed in the baseline (Appendix A: "16 + 1 `useReducer` (`forceUpdate`)") but neither Task 4's deletion list nor the post-extraction container description explicitly states whether it survives. If `forceUpdate` was used to re-render after in-component fetch/cache updates that Task 4 removes, it may become dead. If it's used for edit-state re-renders, it may need to stay. The silence creates a minor ambiguity for the executor.

**Recommendation:** In Task 4 Step 3, add an explicit note about `forceUpdate`'s expected fate (keep or delete) alongside the other state-slice decisions.

### [Low] `uiComponents?: unknown[]` in `CompetitorLandscapeView` provides no downstream type safety

**Location:** Task 2 Step 1 — the `CompetitorLandscapeView` interface: `uiComponents?: unknown[]`.

The view model types the `uiComponents` array as `unknown[]`, which means the hook-to-container handoff is untyped. The extracted `competitorUiComponents.ts` functions (Task 3) do provide typed outputs, so the actual consumption is typed at the extractor boundary. But the intermediate `unknown[]` in the view model means the container could pass un-extracted `cl.data.uiComponents` directly to a sub-component without the extractors, and TypeScript would allow it. This is consistent with 5b's tolerant `.passthrough()` design, and the extractors are the intended gate.

**Recommendation:** No action required. This is a note for the executor that the type safety lives in the extractors, not the view model — matching the 5b contract's intentional looseness.

### [Low] Hard-coded `orgId` default "brewra" preserved without comment

**Location:** Task 4 Step 3 — "the live `orgId` default is `"brewra"` — keep behavior."

The plan preserves the existing hard-coded `"brewra"` default for `orgId`. This is correct for behavioral parity, but `orgId` is available from the `TenantContext` (the `useTenant()` hook) which the rest of the app uses. The plan doesn't note whether the live code already reads from tenant context or whether this default is a genuine hard-code that should be a TD-FE candidate.

**Recommendation:** During Task 4 execution, verify whether the live code reads `orgId` from `useTenant()` or truly defaults to `"brewra"`. If the latter, log a TD-FE entry. This is not a plan defect — the plan correctly says "keep behavior" — but the default is a latent issue.

### [Nit] Task N+1 / N+2 naming indirection

**Location:** "Tasks 5–N" (line 391), "Task N+1" (line 420), "Task N+2" (line 462).

The plan uses "N" to stand for the last extraction task (concretely Task 15). The mapping is clear — N=15, so N+1=16, N+2=17 — and the reconcile instruction at line 408 explains that N may shift. The indirection is intentional (the seam audit may add/drop tasks). No action required; this note is for readability.

### [Nit] Conditional error-boundary step embedded in Task 4

**Location:** Task 4 Step 4 — "(if warranted) wrap in `<FeatureErrorBoundary>`."

The boundary decision is deferred to Task 0 Step 5's findings, so Task 4 Step 4 is conditional. This is correct structurally (you can't decide before auditing), but it splits the boundary work across Task 0 (decision) and Task 4 (implementation), with no reminder in Tasks 5–15 or Task N+1 to verify the boundary survived extraction. The Task 0 Step 5 instruction is clear enough that no action is required.

### [Nit] Pre-5a line numbers in audit results may mislead

**Location:** Task 0 Step 4 "Confirmed live structure" — references L84, L2648, L139, L163-186, L323-339, L344-525, etc.

The plan explicitly states these are "a pre-5a anchor" and instructs the executor to "re-confirm against the merged tree." The audit `grep` commands are pattern-based (correct). But the narrative "Confirmed live structure" section reads as assertions about the current file when they are actually historical anchors. The executor who skims this section could take the line numbers as current truth.

**Recommendation:** Rename the section heading from "Confirmed live structure" to "Pre-5a anchored structure (re-confirm)" to make the temporal qualifier prominent rather than buried in a paragraph.
