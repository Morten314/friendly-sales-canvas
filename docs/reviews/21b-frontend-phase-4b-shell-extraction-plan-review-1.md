---
artifact: plans/21b-frontend-phase-4b-shell-extraction.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
---

## Findings

### [Medium] No global abort criteria — only local STOP points

**Location:** Plan-wide; only Task 0 Steps 2–3 and Task 2 Step 2 contain explicit STOP instructions.

The plan has well-placed local aborts (4a not merged → STOP; baseline red → STOP; sed line range drifted → STOP). But there is no stated threshold for abandoning the entire branch mid-execution. If Task 4 (shell extraction) or Task 6 (parity verification) fails in a way the executor cannot resolve, the plan is silent on whether to report to the human and wait, or to revert the branch. Task 8 Step 4 mentions "hand off for review" but only at the happy-path end. A single sentence like "If any task cannot be resolved after reasonable effort, report to the controller and halt — do not force-push or amend commits" would close the gap.

### [Medium] VR failure in Task 6 has no escalation path

**Location:** Task 6 Step 3 — "A VR failure is a regression, not a re-baseline trigger (Spec 14 §2.2) — investigate the shell move (a stray style/markup change), fix it, and re-run."

The instruction says what to investigate but not what to do if investigation is inconclusive. For a parity-preserving migration, a VR failure means something genuinely went wrong — but the plan provides no fallback beyond "fix it." If the diff cannot be resolved (e.g., a rendering difference caused by import-order side effects that `eslint --fix` introduced), there is no stated escalation. Adding "If the cause is unclear after investigating, report to the human with the failing screenshot diff" would satisfy the recovery-strategy bar.

### [Medium] `useAppSidebar` knip contingency is open-ended judgment

**Location:** Task 6 Step 2 — "the executor's judgment call between (i) a JSDoc `@public` tag… or (ii) deferring just the `useAppSidebar` alias to Phase 5."

The two options have different consequences: option (i) adds a knip-specific annotation that may not be portable across knip versions; option (ii) creates a deviation from the spec §3.4 surface list. Leaving this to executor judgment is reasonable for a small decision, but the plan should state a preferred option (the self-review notes suggest option (ii) is expected) and make the other a fallback. As written, an executor unfamiliar with the project's knip configuration could choose unwisely.

### [Low] `sed '1,186d'` hardcodes a fragile line range

**Location:** Task 2 Step 2 — `sed -i '1,186d' src/shared/auth/AuthContext.tsx`

The plan acknowledges the fragility ("If it is anything else, the line range drifted — STOP, re-read the file") and provides a manual recovery. This is a reasonable tradeoff for a one-time strip. However, a pattern-based alternative (e.g., `sed -i '/^import type { User }/,$!d'`) would be resilient to upstream edits to AuthContext between plan authoring and execution. Not blocking — the STOP guard is adequate — but worth noting.

### [Low] Task 4 Step 4 sed covers only two relative-depth forms

**Location:** Task 4 Step 4 — the four `-e` clauses handle `@/components/layout/Layout`, `../components/layout/Layout`, `@/components/layout/Header`, `../components/layout/Header`.

If any file imports `Layout` or `Header` via a deeper relative path (e.g., `../../components/layout/Layout` from a nested page), the sed would miss it. Task 0 Step 5's audit is the intended safety net ("note it so the Task 4 sed covers it"), and `tsc --noEmit` in Task 4 Step 7 would catch a broken import. The grep-for-stale-references check in Step 4 (`grep -rn 'components/layout/' src`) is the final backstop. Three layers of defense make this low risk — but the plan could note that the `-e` clauses are generated from the audit's findings rather than being a fixed set.

### [Low] Task 4 is a large atomic commit (~30 file touches) — bisect granularity coarser than other tasks

**Location:** Task 4 Steps 1–8 — a single commit message covers 6 `git mv`, ~25 import rewrites, barrel creation, legacy-dir deletion.

The plan chose this intentionally ("the atomic shell-extraction commit… each kept green by `tsc --noEmit`"). Splitting would produce intermediate broken states (moved but not re-wired), so the choice is sound. The consequence is that `git bisect` within this commit is impossible — but since the commit is a pure migration with no logic changes, a bisect stop here is unlikely to be ambiguous. Acceptable tradeoff.

### [Low] Task 4 Step 5 App.tsx edit is prose-described, not scriptable

**Location:** Task 4 Step 5 — "Remove these two lines… Add this single line…"

Every other import rewrite in the plan uses `sed` for repeatability. App.tsx's unique import structure makes sed fragile here, so prose is a reasonable choice. However, an executor could misread the instruction and accidentally remove other imports or change the provider nesting. The `tsc --noEmit` gate in Step 7 catches structural breakage, and `eslint --fix` handles ordering. A grep verification after the edit (e.g., `grep -c 'features/shell' src/App.tsx` should show exactly 1) would add a lightweight sanity check.

### [Nit] `DeploymentData` surface addition is properly surfaced but not cross-referenced in the done-when

**Location:** Task 4 Step 3 (Discovery), Task 8 Step 1 (done-when checklist).

The plan correctly identifies that `MarketResearch.tsx` imports `type { DeploymentData }` from `Header`, and adds it to the shell barrel. This is a legitimate spec §3.4 deviation, called out in the self-review and flagged for the reviewer. However, the Task 8 done-when checklist does not include an explicit line verifying that `DeploymentData` is in the barrel — item 5 only checks `useAppSidebar`. The `tsc --noEmit` gate covers it implicitly, but a `grep -q 'DeploymentData' src/features/shell/index.ts` would make it explicit.

### [Nit] Task 5 TD-FE entry includes `useAuth` collision — scope broader than spec §3.6

**Location:** Task 5 Step 2 — "TD-FE-15 — Sidebar export-name twins + `useAuth` name collision."

Spec §3.6 mentions only the sidebar name-twin as the TD-FE trigger. The plan bundles the `useAuth` collision into the same entry, which is pragmatic (both are naming hazards surfaced by the move) but slightly broader than what §3.6 specified. This is a reasonable expansion — logging both in one entry is cleaner than two separate entries — but worth noting as a minor spec drift.

### [Nit] Task 1 could theoretically parallel with Task 2

**Location:** Task 1 (scaffold `features/shell/`) and Task 2 (promote AuthContext).

Task 1 creates `src/features/shell/` via the scaffolder. Task 2 creates `src/shared/auth/`. These are independent directories with no cross-references. However, the plan runs them sequentially, and Task 4 depends on both. The serial ordering is justified by the "one green commit at a time" discipline and the low cost of scaffolding — parallelizing would save ~1 minute and add coordination overhead. No action needed; noted for completeness.

### [Nit] Task 3 Step 1 defensive re-fix could silently mask a Task 2 miss

**Location:** Task 3 Step 1 — "If it still says `./AuthContext`, Task 2 Step 5 missed it — fix with `sed -i …`."

This is good defensive engineering, but it could mask a systemic issue with Task 2's sed (if it missed one file, did it miss others?). If this branch fires, the executor should re-run Task 2 Step 6's grep (`grep -rn 'contexts/AuthContext'`) to confirm it was an isolated miss, not a pattern. The plan's Task 2 Step 6 grep should already have caught it, so this branch ideally never fires — but if it does, it signals the earlier verification was incomplete.
