---
synthesizes_review: docs/reviews/34-frontend-v1-v2-api-migration-plan-review-1.md
artifact: plans/34-frontend-v1-v2-api-migration.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-08
round: 1
---

## Round Recommendation

no

Reason: No Critical/High findings; the agreed items are cheap execution-readiness clarifications applied now (abort note, accurate parallelization note, transport-preservation note, tsc-guard clause), and they open no new design surface.

## Agreed Findings

- **#1 [Medium] No abort/red-path in the plan body.** Real gap — a subagent executes from the plan, not the spec, and the spec §10 abort criterion isn't restated. Revision: add a **Red-path / abort** line to the conventions section — if a step can't go green without editing a file outside that task's **Files** list, stop and report to the operator (do not expand scope to force green).
- **#2 [Medium → Low] Tasks 2–4 parallelizable but presented serial.** Agreed with a correction: Task 2 is fully independent, but Tasks 3 and 4 **both edit `src/test/msw/handlers.ts`** (the reviewer's "zero file overlap" is inaccurate). Revision: add a **Parallelization** note — Task 2 fully independent after Task 1; Tasks 3 & 4 share `handlers.ts` (different handlers), so parallel dispatch needs a merge on that file (or serialize just the handler edits).
- **#3 [Low] Dead-schema deletion relies on grep.** Agreed on the lighter fix (not the rename-first restructure — see Disagreed): add a tsc-guard clause to Task 2 Step 5 / Task 3 Step 3 — after deleting, the task's `npx tsc --noEmit` is the safety net; a dangling-import error means the export was still referenced (incl. a path grep missed), so restore it.
- **#4 [Low] Transport asymmetry (Task 3 raw `fetch` vs Task 4 `buildApiUrl`) not called out.** Real scope-creep risk for an autonomous agent. Revision: add a **Transport note** to Task 3 Step 3 — `fetchSignals` stays raw `fetch` deliberately (spec N9); do not "fix" it to `buildApiUrl`.
- **#6 [Nit] Approximate line numbers drift.** Revision: add a line to conventions — line numbers are approximate navigation aids; match on the shown code snippet.
- **#7 [Nit] Task 2 Step 7 stages a possibly-unmodified `contracts.ts`.** Revision: drop `contracts.ts` from the default `git add` and add an inline conditional comment ("include only if Step 5 deleted the schema") instead of a trailing parenthetical.

## Disagreed Findings

- **#5 [Low] `BACKEND_BASE_URL` removal scope (Task 4 Step 5).** No change. The plan **already** gates the import removal on `grep -n "BACKEND_BASE_URL" src/test/msw/handlers.ts` — which is exactly "verify no other handler uses it." The reviewer concedes "the grep guard is sufficient to catch this." The requested explicit instruction is already present.
- **#3 (the rename-first restructure specifically).** Decline the heavier "rename the export, typecheck, then delete" pattern as over-engineering for this codebase: it's TypeScript with explicit static imports and no dynamic string-built schema access (the reviewer agrees this is "unlikely"), and the plan's existing `tsc --noEmit` step already fails loudly on a wrongly-deleted export. I adopt the lighter tsc-guard clause (Agreed #3) instead.

## Deferred Findings

- None.

## Severity Disagreements

- **#2 — Medium → Low.** It's a wall-clock optimization hint, not a correctness gap: the serial plan is correct as written. The downgrade is reinforced by the finding's partly-inaccurate premise (Tasks 3 & 4 are *not* zero-overlap — they share `handlers.ts`).

## Open Questions

- None blocking. Parallel dispatch of Tasks 3 & 4 across isolated worktrees would require a merge on `src/test/msw/handlers.ts`; the added Parallelization note states this, so an executor can choose serial-handler-edits or accept the merge.
