---
synthesizes_review: docs/reviews/28-frontend-phase-10-settings-tenant-auth-plan-review-1.md
artifact: plans/28-frontend-phase-10-settings-tenant-auth.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-05
round: 1
---

## Round Recommendation

no

Reason: The two High findings resolve to (#1) a severity disagreement resting on a merge-vs-rebase misconception and (#2) a cheap, mechanical guardrail addition; everything else is Low/Nit. No Critical/High remains unresolved and the agreed revisions open no new design surface — they are local edits to Conventions, task decomposition, one verify step, and one grep.

## Agreed Findings

- **[High] #2 — No abort/kill criteria beyond the baseline check.** Agree (real gap; severity Medium not High). The shared-tree constraint makes an unbounded agent's speculative out-of-scope edits the exact failure mode worth fencing. Revision: add to the Conventions section — "If `npm run verify` fails and the cause is not a missed import-path update within the current task's listed file set, STOP and report to the operator; do not attempt speculative fixes outside the task's file list (parallel sessions share the tree)." And to Task 8 Step 3 — "After 3 preflight failures, stop and report to the operator with the last failure output rather than re-running indefinitely."

- **[Medium] #3 — Tasks 3–4 over-decomposed (placeholder `index.ts` created then immediately replaced).** Agree (severity Low not Medium). The `export {};` placeholder lives for exactly one commit and carries no information, while the tenant/settings tasks correctly combine scaffold+relocate. Revision: fold the `README.md` creation into the Login task, drop the placeholder `index.ts` step entirely (nothing imports `@/features/auth` until the registry step in the same task), and renumber the subsequent tasks so all three features follow the identical scaffold+relocate-in-one-task shape.

- **[Medium] #4 — No regression verification beyond typecheck/lint/unit-test.** Partially agree. Revision: add a single `npm run build` smoke step at the end of the last feature task (once all three features are wired) — `build` is fast, is *not* the e2e/VR preview-server path that contends on `:5173` (TD-FE-29), and surfaces any build-only breakage before the heavyweight gate. Caveat recorded in the plan: the *wrong-path-string* class the finding describes (a syntactically valid `<Route>` with a bad `path=`) is **not** caught by `vite build` — typecheck already covers import resolution — it is caught only by the Task 8 Playwright journeys, which are deferred to the gate by deliberate constraint (full e2e/VR cannot run mid-flight while the box is shared).

- **[Low] #6 — Spec §3 test location differs from plan's file structure.** Agree the inconsistency is real; keep the plan's co-located layout (`hooks/__tests__/`, `components/__tests__/`) — it matches the established repo convention (e.g. `features/mission-control/pages/__tests__/`) and the moved tests sit beside their modules. Revision: add a one-line divergence note in the plan's self-review for traceability. The spec is the imprecise side and is not amended (specs are frozen intent — CLAUDE.md).

- **[Low] #7 — Task 8 Step 1 straggler grep is not comprehensive.** Agree. The `:!src/features/*` pathspec exclusions can only *hide* a real straggler, since the old-path patterns (`@/lib/firebase`, `@/components/settings/useCompanyProfile`, `./pages/{Login,Settings,TenantSelection}`) must appear nowhere in `src` post-refactor. Revision: drop the exclusions and grep all of `src`.

- **[Nit] #8 — Task 5 Step 3 import rewrite less precise than Task 4 Step 2.** Agree (trivial). The target import block is already shown, so this is not a placeholder; for parity with Task 4 I will add an explicit "TenantSelection's only relative imports are `../components/ui/*` and `./useTenants`; it does not import `use-toast`" note so the worker has the exact line set.

## Disagreed Findings

- **[High] #1 — Per-feature App.tsx edits widen the Phase-8 overlap window.** Disagree with the substance and the severity. The escalation claims the mid-flight `git merge master` (Task 8 Step 2) "hits a messier diff with three intermediate `App.tsx` states vs one." That is incorrect: integration is a **merge**, not a rebase. A 3-way merge diffs (merge-base, master-tip, branch-tip) — it does not replay the branch's intermediate commits, so whether Phase 10 touched `App.tsx` in one commit or three is invisible to the merge. (I verified the live state: Phase 8 is already on `master` at `9b2438d`, master is 26 commits ahead of this branch's base `0f0b96c`, and the conflict is now real rather than hypothetical — but it is identical in size either way.) The plan's Conventions section already documents this divergence at length and correctly notes the `<Routes>`-block removals are non-overlapping with Phase 8's. The per-feature approach is also *more* aligned with the repo's stated commit philosophy ("prefer small, frequent commits; a single plan task = a single commit" — CLAUDE.md) than the spec's batch-into-one-commit. I will, however, add one clarifying sentence to the divergence note — "integration is `git merge`, not rebase, so intermediate per-feature `App.tsx` commits collapse to the branch tip and never replay" — to pre-empt the same misreading. Severity: Nit (a one-sentence clarification), not High.

- **[Medium] #5 — "Parallel agents" language implies Tasks 4/5/6 can run in parallel.** Disagree with the premise; severity Low. The Conventions phrase "git add only the listed paths (parallel agents share the tree)" is the surgical-commit rationale referring to the **co-tenant** sessions sharing the sandbox tree (Phase 8 historically), not a claim that Phase 10's own tasks parallelize. `subagent-driven-development` is inherently serial — one fresh subagent per task with review between tasks — so the header does not promise concurrency. The finding rests on reading both signals as a parallelism claim. That said, the ambiguity is cheap to remove, so I will add a one-line note: "Tasks execute serially (one task at a time); Tasks 4–6 share `app/routes.tsx` + `App.tsx` and must never be dispatched concurrently." Agreeing to the clarification, disagreeing that the plan is structurally misleading.

- **[Nit] #9 — Self-review §-refs are not clickable links.** Disagree / no action. The reviewer concedes this is "purely cosmetic." Unlinked `§N.N` cross-references are the established style across every spec and plan in this repo; linking them would diverge from convention for no benefit.

## Deferred Findings

(none — every agreed finding is a local revision applied in this round; every disagreed finding is resolved here. Nothing is correct-but-out-of-scope.)

## Severity Disagreements

- **#1: High → Nit.** Agree only with adding a clarifying sentence; the underlying escalation (merge "messier" with per-feature commits) is factually wrong because merge ≠ rebase. No structural change warranted.
- **#2: High → Medium.** Agree with the finding and am adding the guardrails. It does not affect the happy path — it fences the failure path — so Medium, not High. (Worth doing now regardless, given the shared-tree blast radius of speculative out-of-scope edits.)
- **#3: Medium → Low.** A one-commit-lifetime placeholder is an elegance/consistency issue, not a correctness one. The fix (merge scaffold into the relocate task + renumber) is applied because it is cheap and tidies the plan, not because the risk is Medium.
- **#5: Medium → Low.** A wording ambiguity in the Conventions section, resolved by one sentence; no structural flaw.

## Open Questions

- **TD-FE numbering is no longer "provisional" — it is a definite collision.** `master` already carries TD-FE-47 through 53 (Phase 8's reconciliation commit `fa585d3`). Phase 10's Task 7 records TD-FE-47/48/49, which now certainly clash. The plan should renumber Phase 10's three deferrals to the next free slots (≈54/55/56 — confirm against `master`'s `docs/TECH_DEBT.md` at execution time) rather than carrying 47/48/49. This is a correction the plan now needs regardless of the review; flagging for the operator's go-ahead to bake the renumber into Task 7 (and the Conventions note that frames them as provisional).

- **Merge-sequencing: resolve the App.tsx conflict up front instead of at the gate?** Because Phase 8 has already merged (master is 26 commits ahead of the branch base), the operator could `git merge master` into the worktree **before** starting implementation — resolving the `App.tsx` import-cluster conflict (§9) once, on a clean base, and rebasing the plan's line-number references to post-Phase-8 `App.tsx`. The plan currently defers this to Task 8 Step 2. Doing it first trades one early conflict resolution for accurate line numbers throughout execution; doing it last keeps the branch's history linear until the gate. Either is defensible — flagging for an explicit choice before Task 0.
