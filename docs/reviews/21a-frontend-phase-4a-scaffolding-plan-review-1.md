---
artifact: plans/21a-frontend-phase-4a-scaffolding.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
---

## Findings

### [High] No plan-level kill criteria or abort conditions

**Location:** Plan-wide — no dedicated section; individual STOP conditions scattered across Tasks 0, 5, and 8.

The plan contains multiple per-step STOP conditions (Task 0 Steps 2–3, Task 5 Steps 3–4, Task 8 Step 2), each instructing the executor to halt and report. What is absent is a single, collected statement of the circumstances under which the **entire plan** is abandoned rather than an individual step retried or worked around. Without this, a reader (or agent) cannot distinguish "stop this step, fix, continue" from "this plan cannot proceed — escalate to human for a rewrite." The STOP conditions are thorough enough to prevent silent catastrophic failure, so the safety gap is documentation-level, not runtime-level. A brief "Abort criteria" block near the top (or a line in the Goal section) listing the hard blockers — baseline red, resolver breaks ordering unfixably, source modules moved — would make the plan's failure posture explicit and reviewable as a unit.

### [Medium] Self-review TD-FE numbering incomplete — three-TD-FE scenario unaccounted

**Location:** "Self-review notes (plan author)" → "TD-FE numbering" bullet (line 1057).

The self-review states: "4a logs TD-FE-14 (knip ignore, always) and conditionally TD-FE-15 (index-only fallback)." This omits the TD-FE that **Task 5 Step 4** can emit if pre-existing structural import cycles are found ("log a TD-FE (the next free number)"). In the worst case, 4a produces **three** TD-FE entries: TD-FE-14 (knip ignore), TD-FE-15 (no-cycle deferral from Task 5 Step 4), and TD-FE-16 (index-only fallback from Task 6). Task 6's fallback text correctly accounts for this ("TD-FE-15 if Task 5 Step 4 logged none, otherwise the next after that"), so the **execution logic is sound** — but the self-review summary is misleading. A future reader relying on the self-review for the TD-FE count could be confused about what number 4b's sidebar-twin entry takes.

### [Medium] Task 7 amendments are declarative — higher execution variance than other tasks

**Location:** Task 7, Step 2 (lines 984–993).

Tasks 1–6 embed full file contents or precise, line-level edit instructions (copy-pasteable). Task 7 describes its edits to `specs/14-frontend-refactoring-master-plan-design.md` declaratively — e.g., "add `shared/auth/`, `shared/tenant/`, `shared/components/` to the target structure" or "mark RESOLVED: Q5, Q6, Q7…" — without providing the exact text to insert or a formatting exemplar. This is understandable for amendments to a living document (the edits must match surrounding style), but it introduces significantly more execution variance than the other tasks. The agent must read Spec 14, infer its section formatting conventions, and produce edits that blend in. Providing one sample edit in the plan (e.g., showing the expected §3.1 diff structure or the §4 status-table row format) would reduce variance without over-constraining the output.

### [Low] Task 0 Step 3 baseline runs full Playwright e2e — potentially slow gate for a verification-only step

**Location:** Task 0, Step 3 (lines 48–55).

`npm run preflight` runs the full chain including `test:e2e` (Playwright). The plan notes this is "heavy." If e2e tests are flaky or slow, the plan stalls before any real work begins. A lighter-weight baseline (typecheck + lint + unit tests) would surface most regressions faster; the full preflight could be deferred to Task 8 where it gates merge. The current approach is defensible (verify the whole chain is green before starting), but the cost/benefit tradeoff is worth flagging. If e2e proves unreliable, an agent executing this plan should feel empowered to run the lighter subset for Task 0 and save the full chain for Task 8.

### [Low] Task 4 scaffolder probe cleanup has no mid-point guard if agent crashes

**Location:** Task 4, Step 3 (lines 649–670).

The scaffolder verification creates `src/features/scaffold-probe/` and `src/features/not-on-map/`, then deletes them at the end of the step. If the agent crashes between creation and cleanup, the probe directories persist in the working tree. Task 8's `git diff --stat` check would catch them at the end, but there is no earlier guard. Adding a brief assertion to Task 4 Step 5's verification (or a note at Task 8 Step 2) confirming `src/features/` contains only `README.md` would close this gap earlier in the pipeline.

### [Nit] Task 2 Step 3 Prettier scope handled with hedging language that could be stated definitively

**Location:** Task 2, Step 3 (lines 257–260).

The step conditions on whether Prettier's scope covers `../docs` from `frontend/`, using hedging language ("if the Prettier config scope includes `../docs` — otherwise these monorepo-root docs are outside the frontend Prettier scope and need no formatting"). Since the plan is executed by an agent that can check the Prettier config deterministically, a single definitive instruction ("Run `npx prettier --check ../docs/adr/*.md`; if it errors with 'No configuration found', skip; if it checks, fix with `--write`") would be clearer than the conditional hedging.

### [Nit] Self-review §8.2 reference could be ambiguous between Spec 14 and Spec 21

**Location:** Self-review notes (line 1056), second bullet.

"the resolver-vs-import-x/order interaction (§8.2 item 2)" — §8.2 refers to Spec 21 §8.2, not Spec 14 §8.2. The reference is unambiguous in context (the bullet is discussing Spec 21 risks), but a reader without both specs open could be momentarily confused. A "Spec 21 §8.2" prefix would eliminate the ambiguity.
