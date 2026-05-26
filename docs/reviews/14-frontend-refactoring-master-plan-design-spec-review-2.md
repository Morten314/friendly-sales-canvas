---
artifact: specs/14-frontend-refactoring-master-plan-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-26
round: 2
---

## Context

Round 2 review of the master-plan spec after round 1 synthesis was applied. Reviewed against the round 1 review (`docs/reviews/14-frontend-refactoring-master-plan-design-spec-review-1.md`) and synthesis (`docs/reviews/14-frontend-refactoring-master-plan-design-spec-synthesis-1.md`) to verify agreed findings were incorporated and to surface residual or new issues. No token pressure; full file reviewed.

## Findings

### Critical — §6 escape-hatch cap contradicts Phase 2a revision

**Location:** §6 Definition of Done #3 ("`any` confined to a documented `src/shared/types/escape-hatches.ts` (max 10 entries)"), §4 Phase 2a ("No hard cap up front… The number 10 was a placeholder in round 1 — drop the predetermined cap.")

The round 2 revision correctly removed the hard cap from Phase 2a's description but left the §6 #3 "max 10 entries" intact. These directly contradict. A phase author reading only §6 would enforce a cap that Phase 2a explicitly rejects. §6 is the definition of done for the entire master plan — it should reflect the converged position.

**Suggestion:** Update §6 #3 to match Phase 2a: remove "max 10 entries." Replace with "each entry requires a documented justification and call-site reference; Phase 2a's spec sets the initial count cap; Phase 13's audit re-evaluates every entry."

---

### High — Phase 0 overview table wasn't updated to match refocused characterization scope

**Location:** §4 Overview table, row "0 | Inventory + full safety net" ("characterization tests for top 5 monsters"), §4 Phase 0 detailed description ("Do not build deep characterization tests against the internal structure of the monster files themselves")

The overview table still says "characterization tests for top 5 monsters." The detailed Phase 0 description (revised in round 2 per synthesis finding #5) correctly refocuses characterization tests toward stable utilities and behavioral E2E. But the overview table — the first thing a reader sees for Phase 0 — contradicts this. A spec author skimming the overview would plan deep monster-file characterization tests, directly against the detailed description's guidance.

**Suggestion:** Update the overview table to: "Audit, lock Playwright, visual regression baselines, Vitest+RTL+MSW setup, characterization tests for stable utilities + behavioral E2E for monster-file routes."

---

### High — Phase 11 done-when references Phase 12 discoveries that haven't happened yet

**Location:** §4 Phase 11, done-when ("shared utilities discovered in Phases 5–10 and 12"), §4 Phase 11 description text ("Phase 12's small-pages sweep follows after; any additional shared utilities surfaced there are pulled into `src/shared/` at the time Phase 12 needs them.")

Phase 11's done-when says "shared utilities discovered in Phases 5–10 **and 12**." Phase 12 runs after Phase 11. The description text handles this correctly (Phase 12 pulls shared utilities "at the time Phase 12 needs them"), but the done-when creates a logical impossibility: Phase 11 cannot verify that shared utilities from Phase 12 are populated because Phase 12 hasn't run. This makes Phase 11's "done when" unreachable as written.

**Suggestion:** Remove "and 12" from Phase 11's done-when. The description text's approach (Phase 12 handles its own shared needs inline) is correct and should be the authoritative statement.

---

### High — Phase 5 sub-split 5c routes components to features that don't exist yet

**Location:** §4 Phase 5, "Likely sub-split" 5c ("cross-feature concerns (lead-stream, scout chat, strategist workspace) routed to their target features")

Phase 5's 5c proposes routing lead-stream to `customers/`, scout chat panels to `scout/`, and strategist workspace to `strategist/`. But `src/features/customers/` doesn't exist until Phase 7, `src/features/scout/` not until Phase 9, and `src/features/strategist/` not until Phase 8. Phase 5 can't move components into folders that haven't been created yet. The spec doesn't specify where these components land temporarily — do they stay in market-research? Get placed in feature skeletons? Live in `src/shared/` as a staging area?

**Suggestion:** Add an explicit disposition rule: components identified as belonging to later features stay in their current location (or move to a `src/features/_staging/` temporary area) and are claimed by the owning phase when that phase runs. Alternatively, 5c becomes a cross-reference annotation (a TODO list in the Phase 5 spec of what moves where) rather than an actual code move.

---

### High — Error-boundary component has no specified test coverage

**Location:** §4 Phase 4 ("Define a feature-scoped `<FeatureErrorBoundary>` component"), §4 Phases 5–12 ("The feature's top-level routed component is wrapped in `<FeatureErrorBoundary>`")

Phase 4 defines a component whose entire purpose is fault isolation at feature boundaries. If it doesn't work correctly (catches the wrong errors, fails to render the fallback UI, swallows errors that should propagate), it defeats the isolation goal. Yet no phase specifies testing this component. Phase 0 sets up test infrastructure; Phase 4 defines the component; Phase 5 wraps features in it — but the boundary itself is never tested.

**Suggestion:** Phase 4's deliverables should include: "Unit tests for `<FeatureErrorBoundary>` verifying: (a) catches and renders fallback for thrown errors in children, (b) does not intercept errors outside its subtree, (c) logs error information for debugging."

---

### Medium — Phase 2a error-count gate threshold (1,500) lacks justification

**Location:** §4 Phase 2a ("If the error count exceeds **1,500**, the plan author must propose a sub-decomposition")

The 1,500 threshold determines whether Phase 2a is one phase or gets sub-decomposed into multiple sub-phases — a major scope decision. But no rationale is given for why 1,500 and not 1,000 or 2,500. The threshold should be grounded in something measurable: e.g., "an agent can reliably fix ~N errors per session" or "a sub-decomposition is warranted when the error surface exceeds what fits in a single plan."

**Suggestion:** Add a one-line justification. For example: "1,500 is estimated as ~3× the error density where an agent working without sub-decomposition can maintain consistent error-category focus. The threshold is calibrated against the post-Phase-1 LOC, not the raw 75k baseline."

---

### Medium — Cross-phase profiler coordination (Phases 6↔7↔9) lacks a concrete handoff mechanism

**Location:** §4 Phase 6 ("Phase 6 spec decides what stays vs migrates to `scout/profiler` in Phase 9"), §4 Phase 7 ("Phase 7 spec coordinates with Phase 9 on what migrates where"), §4 Phase 9 ("Phase 9 spec coordinates with Phases 6 and 7 on which surfaces stay and which migrate")

Three phases must coordinate on where profiler functionality lands. The coordination mechanism is "Phase N spec coordinates" — which is vague. Phase 6's spec author must decide what stays for Phase 9 to claim, but Phase 6 doesn't know what Phase 9 will want. Phase 9's spec author must reconcile decisions from two earlier phases. There's no shared artifact (e.g., a profiler-disposition checklist in the master plan, or a `TD-FE-<n>` entry with the resolution) that persists across phases.

**Suggestion:** Add a coordination artifact: Phase 6's spec includes a "Profiler disposition" section listing each profiler-related component with its interim home and intended final home. Phase 7 confirms or amends. Phase 9 resolves. Alternatively, accept that the master plan is too early to fully disentangle this and add a Phase 9 precondition: "Phase 9 spec author reads Phase 6 and 7 specs' profiler-disposition sections before planning."

---

### Medium — Phase 3 "Migrate localStorage and sessionStorage" wording is broader than actual scope

**Location:** §4 Phase 3 ("Migrate `localStorage` and `sessionStorage` caching usage to TanStack Query persistence (or document why a specific case stays on `localStorage`)."), §4 Phase 8 ("Strategist has no backend — it's a sessionStorage-driven sequence builder")

Phase 3's mission statement says "Migrate `localStorage` and `sessionStorage` caching usage." The per-call-site migration note correctly limits Phase 3 to auth/tenant/settings. But the mission statement is the first thing read and sounds comprehensive. Strategist's `sessionStorage.strategistContext` is not cache — it's the primary data store for a feature with no backend. Phase 3's wording implies Strategist's sessionStorage is in scope for migration, which would be incorrect.

**Suggestion:** Qualify the mission statement: "Migrate `localStorage` and `sessionStorage` **caching** usage to TanStack Query persistence. Features using `sessionStorage` as a primary data store (e.g., Strategist) are explicitly out of scope for this migration."

---

### Medium — Phase 12 source paths unspecified

**Location:** §4 Phase 12 ("Sources moving in: `Calendar.tsx`, `Deals.tsx`, `Insights.tsx`, `Reports.tsx`, `Artifacts.tsx` (666), `NotFound.tsx`.")

Every other feature phase specifies full source paths: `src/pages/MarketResearch.tsx`, `src/components/customers/ICPSummaryOpportunity.tsx`, etc. Phase 12 lists only filenames without the `src/pages/` prefix. A spec author would need to verify these files exist and are at the expected path.

**Suggestion:** Add full paths: `src/pages/Calendar.tsx`, `src/pages/Deals.tsx`, etc. Or explicitly state "all files under `src/pages/` not claimed by Phases 5–10."

---

### Medium — No mention of `src/services/` disposition

**Location:** §1.3 starting state ("Layout: Flat `src/components/`, `src/pages/`, `src/contexts/`, `src/hooks/`, `src/lib/`, **`src/services/`**, `src/utils/`"), §4 Phase 11 ("Verify `src/contexts/`/`hooks/`/`lib/`/`services/`/`utils/` are gone or redirected")

`src/services/` appears in the starting-state layout and Phase 11's verification list, but no phase explicitly claims responsibility for emptying it. Phase 3 moves API concerns into `src/shared/api/` but doesn't mention `src/services/` by name. Phase 11 verifies it's "gone or redirected" but the actual clearing work is invisible.

**Suggestion:** Phase 3's deliverables should explicitly mention: "Identify all files in `src/services/` and migrate or redirect them. API-related services move to `src/shared/api/`; feature-local services move with their feature in Phases 5–10."

---

### Low — `src/styles/` in target layout but no phase claims it

**Location:** §3.1 target layout ("`styles/` — global styles, theme tokens"), §8 Q12 ("Phase 11 spec")

The target layout shows `src/styles/` at root level. §8 Q12 defers the decision about its final location to the Phase 11 spec. But no phase between 0 and 11 creates, moves, or touches `src/styles/`. If styles need reorganization, it should be claimed by a phase (or explicitly documented as untouched).

**Suggestion:** Either (a) assign styles reorganization to Phase 11 explicitly (alongside shared utility extraction), or (b) add a note to §3.1: "`src/styles/` is carried forward as-is from the current layout unless a phase has a specific reason to restructure it."

---

### Low — E2E test suite location (`frontend/e2e/`) not claimed by any phase

**Location:** §4 Phase 0 ("Playwright suite locked green"), §4 Phase 2c ("Playwright" in CI gates), §1.3 starting state ("Tests: Playwright E2E only (`frontend/e2e/`)")

The E2E test suite lives at `frontend/e2e/`, outside `src/`. Phase 0 locks it green and may expand it, but no phase addresses its location. As features are extracted into `src/features/`, should E2E tests be co-located (e.g., `src/features/market-research/e2e/`)? Or stay centralized? The spec is silent.

**Suggestion:** Add to §2.1 in-scope or §2.2 out-of-scope: "E2E test suite location remains centralized at `frontend/e2e/`." Or defer the decision to a specific phase.

---

### Low — Phase 0 NFR CI baseline measured against a scaffolded (mostly-TODO) workflow

**Location:** §4 Phase 0 ("CI pipeline total duration (against the workflow scaffolded here)"), §4 Phase 0 ("CI workflow file scaffolding (the gates added across Phase 2c are pre-shaped here as TODOs)")

Phase 0 scaffolds the CI workflow with TODO placeholders and measures CI duration as an NFR baseline. But a workflow that's mostly TODOs will have a misleadingly short duration. When Phase 2c adds real gates, the baseline from Phase 0 won't be comparable. The CI total duration budget (≤8 min ballpark in Phase 2c) would anchor on an artificially low number.

**Suggestion:** Phase 0 records the scaffolded CI duration as informational only. The actual CI baseline for budgeting purposes is measured in Phase 2c, after all gates are wired. Phase 2c's spec sets budgets against its own measurements, not Phase 0's.

---

### Low — Phase 13 codemod test framework unspecified

**Location:** §4 Phase 13 ("codemods land in `frontend/scripts/codemods/<name>.ts` (using ts-morph or jscodeshift) with a documented invocation and a **test case** (input → expected output)")

Codemod test cases are required but the testing mechanism isn't specified. Codemods operate on ASTs, not DOM — Vitest/RTL don't apply. The spec doesn't say whether codemod tests use Vitest with file-system fixtures, ts-morph's built-in test utils, or a custom harness.

**Suggestion:** Phase 13's spec should specify the codemod testing approach. A lightweight option: Vitest + `fs.readFileSync` fixtures (input.ts → expected.ts) under `frontend/scripts/codemods/__tests__/`.

---

### Low — No sub-phase rollback protocol within feature extractions

**Location:** §5.7 (phase-level abort and revert), §4 Phase 5 ("Likely sub-split: 5a, 5b, 5c")

§5.7 defines a phase-level abort protocol (revert the branch, log to TECH_DEBT, replan). But feature phases like Phase 5 may sub-split into 5a/5b/5c, each as a potentially independent commit series. If 5b breaks and 5a was clean, the spec provides no guidance on partial rollback within the branch. The branch model is one branch per phase, so the rollback granularity is commit-level, not branch-level.

**Suggestion:** Add to §5.7 or to the per-phase deliverables: "Within a sub-split phase, each sub-phase should be a discrete commit (or commit series) that leaves the codebase in a green state. If a sub-phase fails, revert to the last green sub-phase commit and replan the remainder."

---

### Nit — Visual regression "default threshold" is a range, not a default value

**Location:** §4 Phase 0 ("Default threshold: 0.5–1.0% pixel delta per screen")

"Default" implies a specific value. 0.5–1.0% is a range. Phase 2c says "Visual regression diff threshold codified at the value chosen in Phase 0," so Phase 0 must choose a single value. The round 2 text is an improvement over round 1's 0.1% but calling it a "default" is still slightly misleading.

**Suggestion:** Change "Default threshold: 0.5–1.0%" to "Threshold range: 0.5–1.0% — Phase 0 spec selects the exact value."

---

### Nit — Stale-doc watcher regex will match many legitimate references

**Location:** §4 Phase 14 ("Default regex: `\b[Pp]hase[- ]?\d+[a-z]?\b`")

The regex will match "Phase 0", "Phase 2a", "phase-5" — all of which appear extensively in specs, plans, ADRs, audit scorecards, and potentially in code comments referencing the refactoring journey. The allowlist mechanism is mentioned but its scale isn't acknowledged. This is a minor UX concern for the Phase 14 spec author, not a design flaw.

**Suggestion:** Add a note: "The allowlist is expected to be non-trivial in size. Phase 14's spec should consider whether an inverted approach (only scan `src/` files, not docs/specs/plans) is more maintainable."
