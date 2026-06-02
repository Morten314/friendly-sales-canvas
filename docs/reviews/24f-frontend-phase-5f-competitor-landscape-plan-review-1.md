---
artifact: plans/24f-frontend-phase-5f-competitor-landscape.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-01
round: 1
---

## Context

This review was performed against the plan prose and the paired spec (`specs/24-frontend-phase-5-market-research-design.md` round 5). The sibling 5d plan review (`docs/reviews/24d-frontend-phase-5d-market-entry-plan-review-1.md`, claude-opus-4-8) was consulted to check whether its findings were addressed in this later plan. The plan was not verified against the live file tree (no worktree created); structural claims are taken at the plan author's word.

The plan is exceptionally well-grounded — it reads the real 2,648-LOC file end-to-end, names the exact seams (16 `useState`, 15 `useEffect`, 4 `useRef`, 10 `uiComponents` slices, 2 self-fetches, per-user localStorage cache), and aligns with the spec's §6 per-section pattern. Findings below are about verification sequencing and the one area where prior review feedback was not incorporated.

## Findings

### [High] The behavioral regression guard (`journeys/04`) runs only at Task N+2 — identical to the 5d finding, unaddressed

**Location:** Task 4 Step 3 note ("If removing the read fetch/sync makes `journeys/04` fail because the section no longer hydrates…") vs. Task N+2 Step 3/4 (the only place the full preflight + `journeys/04` runs).

Every intermediate task gates on `tsc --noEmit` + `npm run lint` + `npx vitest run <touched>` + `knip`. The spec's designated "primary guard that decomposition preserved behavior" (spec §8) does not run until the end of a ~15-commit branch. The 5d review flagged this as High; this plan reproduces the same structure without change. Task 4 is the riskiest commit (deletes the read-path fetch/cache/sync machinery, swaps to `useCompetitorLandscape`) and the plan explicitly predicts its signature failure mode ("the hook's `enabled`/auto-fetch isn't matching the old behavior"). A regression introduced at Task 4 would not surface until after Tasks 5–15 and N+1 are complete, making rollback expensive. Recommend: (a) run `npx vitest run` on the competitor-landscape tests plus `journeys/04` (or a scoped Playwright subset) at the Task 4 checkpoint; or (b) encode the auto-hydrate/refresh behavior as a Vitest/RTL assertion in Task 4's hook test so the structural gate carries a behavioral signal.

### [Medium] Task 4 bundles an optional error-boundary wrap into the heaviest single commit — same as 5d's Medium finding

**Location:** Task 4 Step 4 ("(if warranted) wrap in `<FeatureErrorBoundary>`"), folded into the same commit as the read-path swap + machinery deletion.

The 5d review flagged this as Medium ("reduces the reviewability of the gnarliest, most error-prone change") and recommended splitting it into its own commit. This plan did not adopt that recommendation. Task 4 is self-described as "the heaviest task" — it adopts the hook, re-routes read seams, deletes `getUserLocalStorage` read fallbacks, the big props↔local sync effect, and multiple read-orchestration effects/refs. Adding a new error boundary (which changes runtime failure behavior) into the same commit further increases the blast radius of the single hardest-to-review diff. Split the boundary wrap into its own commit (after Task 4 is green) or defer it to Task N+1.

### [Medium] Baseline gate (Task 0 Step 3) may be weaker than the final gate — same as 5d's Medium finding

**Location:** Task 0 Step 3 — `npm run preflight   # or the lighter typecheck+lint+test subset` — and abort criterion 2.

The parenthetical "or the lighter typecheck+lint+test subset" permits skipping build, `bundle:check`, Playwright `journeys/04`, and `knip --strict` at baseline. If any of those are pre-broken (by upstream 5c/5d/5e churn), the baseline passes but the first failure at Task N+2 gets misattributed to 5f changes, triggering a fruitless investigation or a false abort. The 5d review flagged this. The baseline should run the same full `npm run preflight` the final task uses, or at minimum include `journeys/04` and the build, which are the gates most likely to be pre-broken.

### [Medium] No explicit decision branch if Task 0 finds the self-fetch already removed by 5c/5d

**Location:** Task 0 Step 4 preamble ("5b/5c may have rewired or partially removed the in-component read machinery") and abort criteria (none for "self-fetch absent but no behavior change").

The plan correctly verifies the self-fetch exists at Task 0 (Step 4 grep for `fetch(`, `getUserLocalStorage`), and the Architecture section is confident ("5b rewired the page, not this section"). But if 5c (or a 5d/5e side-effect) already removed or replaced this section's read machinery, Tasks 3–4 collapse or invert — the hook may already be consumed, Task 4's deletions become no-ops. The plan says "reconcile any drift" but gives no concrete action for this case. The 5d review flagged the same gap; adding an explicit Task 0 outcome — *"if the self-fetch is already gone, shrink/skip Task 4's read-path deletion, derive the read seams from the existing wiring, and record the reduced scope in the PR"* — would close it. This is low-probability (the plan's reading is likely correct) but the plan's own Task 0 preamble raises the possibility.

### [Low] Task N+1 field-determination heuristic should name `tsc --noEmit` as the guard explicitly

**Location:** Task N+1 Step 1 ("A field is removable only if no other section reads it … When in doubt, leave the field").

The 5d review noted this same gap. The heuristic is sound, but the plan does not state that `tsc --noEmit` at Step 4 is the hard regression signal: removing a field still referenced by a sibling section will cause a type error. Naming tsc explicitly prevents the executor from over-relying on grep/judgment. Low because the mechanism already catches the failure mode.

### [Low] The `/ask` edit-write fetch is kept but not tracked as tech debt within this plan

**Location:** Task 4 Step 3 note ("flag for review; candidate `TD-FE`") and self-review notes.

The plan correctly identifies the edit-write `/ask` fetch as out of scope and flags it for reviewer attention. However, it says "candidate `TD-FE`" without committing to actually logging it to `docs/TECH_DEBT.md`. Given the plan's thoroughness on every other tracking mechanism, the task should either (a) include a Step to log a `TD-FE` entry in Task N+2, or (b) state definitively that logging is deferred to the reviewer's discretion. The current "candidate" phrasing is ambiguous about whether the executing agent should log it.

### [Nit] Heavy pre-5a line-number anchoring — same as 5d, mitigated but could be hardened

**Location:** Throughout Task 0 Step 4 confirmed-structure block, Architecture paragraph, and Task 2/4 inline annotations (~40 anchors: `L84`, `L2648`, `L139`, `L163-186`, `L323-339`, `L344-525`, `L602`, `L697`, `L727`, `L835-850`, `L864-871`, `L886-903`, `L916-931`, `L934-963`, `L1024-1076`, etc.).

The plan correctly flags these as pre-5a anchors and mandates Task 0 re-derivation. The risk is an executing agent using them literally. A one-line prefix like "(re-derive from Task 0 grep output — do not use literal line numbers)" on the densest anchor blocks would harden against this. The plan mitigates well through Task 0's grep-based audit; this is purely defensive.

### [Nit] Tasks 5–15 numbering is absolute, but the task list says "reconcile" — the reconcile instruction should state the numbering adjusts

**Location:** Tasks 5–15 list item "(reconcile) Add/drop tasks to match Task 0's confirmed blocks."

The plan numbers Tasks 5–15 concretely, then says to reconcile (add/drop). But if blocks collapse (e.g. the two MiniLineChart sites → one component), Task numbers shift, and the N+1/N+2 references ("Task N+1", "Task N+2") become ambiguous relative to the concrete list. The plan handles this via the N+1/N+2 abstraction, which is fine — but the reconcile instruction could note "re-number subsequent tasks if the block count changes" for clarity. Very minor.

### [Nit] Positive: plan learned from 5d review on scope-flagging

**Location:** Self-review notes ("NOT purely prop-driven — it self-fetches (5b missed it)") and the "Section-copy note."

The 5d review flagged the scope expansion (section also completes 5b's read migration) as a Low finding that should be explicitly noted. This plan does so prominently — both in the Goal paragraph ("delete its in-component fetch + per-user localStorage cache machinery") and in the self-review. The section-copy note is a similarly clean scope boundary. This is a positive observation, not a defect.
