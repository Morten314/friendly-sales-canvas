---
artifact: plans/28-frontend-phase-10-settings-tenant-auth.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-04
round: 1
---

## Context

Plan file was located in a git worktree at `.claude/worktrees/phase-10-settings-tenant-auth/plans/28-frontend-phase-10-settings-tenant-auth.md`. The companion spec `specs/28-frontend-phase-10-settings-tenant-auth-design.md` exists in the same worktree. All line-number and import-path claims in the plan were verified against the worktree's source and confirmed accurate.

## Findings

### [High] Plan contradicts spec's one-late-commit App.tsx strategy, widening the Phase-8 overlap window

**Location:** "Conventions & execution rules" — paragraph beginning "Divergence from Spec 28 §7/§9"; Tasks 4/5/6 Steps 8/9 (App.tsx edits per feature)

Spec §7 stage 4 and §4 both state: "All App.tsx + registry edits land in **one final commit** to minimize the overlap window with Phase 8 (§9)." The plan instead edits `App.tsx` and `app/routes.tsx` in each of Tasks 4, 5, and 6 — three separate commits touching the same import cluster.

The plan's justification ("git merges the *final* `App.tsx` state") is correct for the *merge mechanics* — the conflict resolution is identical regardless of commit count. However, the spec's intent was narrower: if Phase 8 merges to `master` *while Phase 10 is mid-execution*, the `git merge master` in Task 8 Step 2 hits a messier diff with three intermediate `App.tsx` states vs one. The plan should either (a) acknowledge this tradeoff explicitly and state that it's acceptable because Phase 10 does not rebase onto `master` mid-flight, or (b) revert to the spec's one-late-commit strategy by deferring all `App.tsx`/`routes.tsx` edits to a single Task 7.5 (between current Tasks 6 and 7).

As-written, the plan's per-feature approach is defensible — but the stated rationale is incomplete and the divergence from spec is more than cosmetic.

### [High] No abort conditions or kill criteria stated beyond the baseline check

**Location:** Entire plan; specifically Task 0 Step 2 ("If it fails, STOP and report") is the only explicit halt point.

Task 0 requires a green baseline before proceeding — good. But no other task specifies what happens on failure. Concretely:

- Task 8 Step 3 (`npm run preflight`): "If VR flakes under load, re-run on an idle box — do not accept a red merge gate." This describes what *not* to do, but not when to escalate. How many re-runs before the phase is blocked? What if the failure is a genuine regression, not a flake?
- Tasks 1–6 (`npm run verify`): Expected: PASS. What happens when it fails? The implicit recovery is "fix the failure," but for an agentic worker there's no stated boundary between "fix a missed import path" (expected) and "something fundamental is wrong with the plan, stop and report" (escalation).

**Recommendation:** Add one sentence to the Conventions section: "If `npm run verify` fails and the cause is not a missed import-path update within the current task's file list, stop and report to the operator. Do not attempt speculative fixes outside the plan's scope." For Task 8, add a retry cap (e.g., "After 3 preflight failures, report to operator with the last failure output").

### [Medium] Tasks 3–4 are over-decomposed: placeholder index.ts is created then immediately replaced

**Location:** Task 3 (scaffold only, 2 files) → Task 4 Step 6 (finalize index.ts)

Task 3 creates `src/features/auth/README.md` and a placeholder `index.ts` (`export {};`), commits them, then Task 4 Step 6 replaces `index.ts` with the real content (`export { authRoutes } from "./routes"`). The placeholder exists for exactly one commit and is never meaningful. Tasks 5 and 6 do not split scaffold from relocate — they combine both into one task each, which is cleaner.

**Recommendation:** Merge Task 3 into Task 4 (create README + placeholder + move + wire in one task), matching the pattern used for Tasks 5 and 6. This saves one commit and one verify cycle for zero information loss.

### [Medium] No explicit regression verification beyond typecheck/lint/unit-test

**Location:** All task verify steps (e.g., Task 4 Step 9, Task 5 Step 9, Task 6 Step 11)

Each task's verify step is `npm run verify` (typecheck + lint + `vitest run --changed`) + prettier check. This confirms the moved code compiles and the moved tests pass. It does **not** confirm that the routes actually resolve (no integration check). A typo in `routes.tsx` that produces a valid JSX element but wrong path would pass verify silently.

The spec §8 says "Playwright journeys (fixture-backed) stay green" — but the plan defers Playwright to the merge-gate preflight (Task 8 Step 3). If a route registration is subtly wrong (wrong path, missing `<ProtectedRoute>` wrapper), it won't surface until Task 8.

**Recommendation:** Add a lightweight smoke check after Task 6 (all three features wired): `npx vite build` (catches route-level import resolution errors that typecheck alone may miss, since route elements are JSX and may not be statically analyzed). This is already part of `preflight` but running `vite build` alone is fast and catches the class of error described. Alternatively, note in Task 6 that `npm run build` should be run if verify passes, as a belt-and-suspenders check before proceeding to Task 7.

### [Medium] Parallelizability claim in conventions is misleading — Tasks 4/5/6 cannot run in parallel

**Location:** Conventions — "Surgical commits: git add only the listed paths (parallel agents share the tree)."

The plan's header says "REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development." The conventions mention parallel agents sharing the tree. But Tasks 4, 5, and 6 all modify `src/app/routes.tsx` and `src/App.tsx` — the two most contention-prone files. These tasks **cannot** run in parallel on a shared worktree without merge-conflict risk between agents.

This isn't a bug (the plan runs them serially), but the subagent-driven-development invocation and "parallel agents" language set up an expectation that parallelism exists. An agentic worker might attempt to dispatch Tasks 4/5/6 in parallel and hit file conflicts.

**Recommendation:** Add a note: "Tasks 4–6 are serial — they all modify `app/routes.tsx` and `App.tsx`. Do not dispatch them as parallel sub-agents." Or restructure to make the independent file moves (Step 1–4 of each task) parallelizable, with the shared-file edits (Steps 7–10) serialized in a single "wire-up" pass.

### [Low] Spec §3 test location differs from plan's file structure

**Location:** Plan "File structure" section (lines 42–43, 49) vs Spec §3 (lines 110, 117, 124)

The spec shows `features/auth/__tests__/useLogin.test.tsx` (tests as direct children of the feature). The plan puts tests under `features/auth/hooks/__tests__/useLogin.test.tsx` (co-located with the hook they test). The plan's layout is arguably better (test sits next to its module), but this is a structural deviation from the spec's target.

Same for `useTenants.test.tsx` (spec: `features/tenant/__tests__/`; plan: `features/tenant/hooks/__tests__/`) and `CompanyProfile.test.tsx` (spec: `features/settings/__tests__/`; plan: `features/settings/components/__tests__/`).

This is a minor inconsistency — the plan's co-location is the established pattern in other features (e.g., `features/mission-control/pages/__tests__/`).

### [Low] Task 8 Step 1 straggler grep excludes `src/lib/firebase` absolute-path references

**Location:** Task 8 Step 1 — `git grep` command

The grep pattern is: `"@/lib/firebase\|@/components/settings/useCompanyProfile\|from \"\./pages/Login\|from \"\./pages/Settings\|from \"\./pages/TenantSelection"`. This catches absolute imports from old paths and relative imports from `App.tsx`. However:

- It does not check for `from "@/lib/firebase"` in any files *outside* the feature folders (e.g., `src/pages/__tests__/useLogin.test.tsx` would be excluded by the `:!src/features/auth` pathspec, but what about a hypothetical `src/lib/` file that imports it?). The plan's Task 1 Step 5 claims "grep confirms no others" — the Task 8 straggler check should be equally broad.
- It does not check for the `MissionControlPage.test.tsx` mock path (which was updated in Task 2 but could regress if someone conflicts during merge).

These are unlikely in practice (the plan is meticulous about listing every importer), but the straggler check should be comprehensive enough to catch the unexpected.

### [Nit] Task 5 Step 3 import rewrite is incomplete — `use-toast` hook not mentioned

**Location:** Task 5 Step 3 — TenantSelectionPage.tsx import rewrites

The plan says: "rewrite the relative imports — `../components/ui/*` → `@/components/ui/*`, `./useTenants` → `../hooks/useTenants`." But looking at the plan's own Task 5 scope, `TenantSelection.tsx` is a simple page — the only relative imports are `../components/ui/*`. The plan's rewrite instruction is correct for the expected imports. However, unlike Task 4 Step 2 (which lists every import line to change in `LoginPage.tsx`), Task 5 Step 3 is vaguer ("rewrite the relative imports") and relies on the worker to identify which lines need changing. Since TenantSelection is small, this is acceptable — but inconsistent with Task 4's precision.

### [Nit] Self-review notes cite spec section numbers without inline links

**Location:** "Self-review notes (author)" section at end of plan

The notes reference "§2.1 three features → Tasks 3–6; §5 firebase → Task 1" etc. These are useful for traceability but are not clickable/linked. In a Markdown document this is standard, so this is purely cosmetic.
