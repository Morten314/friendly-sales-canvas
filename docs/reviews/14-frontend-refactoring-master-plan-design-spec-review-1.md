---
artifact: specs/14-frontend-refactoring-master-plan-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-26
round: 1
---

## Context

Review conducted against the master-plan spec in isolation, with cross-referencing to root `AGENTS.md` for business-state consistency and to the backend spec precedent (referenced in §9). No token pressure; full file reviewed.

## Findings

### Critical — 17-phase adversarial ceremony contradicts the pre-MVP velocity mandate

**Location:** §1.1 ("17 phases"), §5 (entire per-phase workflow), root `AGENTS.md` ("Brewra is at MVP stage with **0 live users**… optimize for velocity over deployment ceremony")

`AGENTS.md` explicitly states: "the cost of brief breakage is near zero, so optimize for velocity over deployment ceremony" and "it's a license to skip the ceremony that exists to protect users you don't have yet." This spec proposes 17 phases, each running a minimum 3-round adversarial cycle (spec review → plan review → impl review, each potentially multiple rounds), with fresh-eyes agents for review, CI gates with bundle budgets, visual regression, dead-code watchers, and a "no fix-forward" policy. For a product with zero users and a solo CTO + agent workflow, this is deployment ceremony on steroids.

The backend went through Phases A–L because it had accumulated real coupling problems in production code. The frontend refactor should inherit the *discipline* (small commits, typed code, tests) but not the *organizational overhead* designed for risk mitigation in a team context.

**Suggestion:** Collapse the phase count. Phases 0 and 1 can merge (audit + LOC reduction are one workflow). Phases 2a/2b/2c can merge (strict TS + lint + CI is one foundation pass). Phases 6–10 can run as parallel or batched extractions once Phase 5 proves the pattern. Phase 14's agent affordances can be ongoing rather than a phase. Target ≤8 phases with at most 2 review rounds per artifact. Re-evaluate visual regression and the "fresh-eyes" requirement against the zero-user reality.

---

### High — Phase 2b enforces `import/no-restricted-paths` for a target layout that doesn't exist until Phase 4

**Location:** §4 Phase 2b ("Add `import/no-restricted-paths` (rules per §3.3)"), §3.3 dependency rules, §4 Phase 4 ("Feature scaffolding")

§3.3 defines dependency rules for `features/<X>/` importing from `features/<Y>/` only via `index.ts`. Phase 2b proposes to enforce these rules via `import/no-restricted-paths`. But `src/features/` doesn't exist until Phase 4 creates the skeleton. The restricted-paths rules cannot be meaningfully enforced on the flat `src/components/` / `src/pages/` layout. This is a sequencing error.

**Suggestion:** Split the lint work. Phase 2b adds type-aware rules, Prettier, and `import/order`. The `import/no-restricted-paths` rules for the features layout are added in Phase 4 (when the structure exists) or Phase 5 (when the first feature extraction validates them).

---

### High — Phase 3 TanStack Query scope boundary with Phases 5–10 is underspecified

**Location:** §4 Phase 3 ("Per-call-site migration"), §4 Phases 5–10 (no mention of TanStack Query)

Phase 3 says it "establishes the infrastructure and migrates the lowest-coupled call sites (auth, tenant, settings)" and that "per-feature TanStack adoption happens inside each feature's extraction phase (5–10)." But the Phase 5–10 descriptions contain zero mention of TanStack Query migration as a deliverable, success criterion, or risk. This creates a shared responsibility gap: every feature phase must do dual work (structural extraction + data-layer migration) without explicit acknowledgment.

**Suggestion:** Add an explicit TanStack Query migration step to each Phase 5–10 description, or extract TanStack migration into a dedicated post-extraction pass (after Phase 12, before Phase 13). The latter keeps each phase single-concern.

---

### High — No rollback or mid-phase abandonment strategy

**Location:** §5 (per-phase workflow), §7 Risks

The spec describes a clean linear sequence with "done when" criteria but no mechanism for what happens when a phase fails halfway through and can't be completed. Phase 5 (market-research, ~15k LOC) is especially risky. If the extraction proves intractable mid-way, the spec provides no guidance: revert the branch and replan? Merge partial progress? Defer the feature?

**Suggestion:** Add a "abort and revert" protocol: if a phase branch cannot reach its "done when" state within a defined scope/duration, revert the branch, log findings to `docs/TECH_DEBT.md`, and replan with a revised scope. This also gives the human orchestrator a clear decision point.

---

### High — Characterization tests for monster files are extremely costly to write before decomposition

**Location:** §4 Phase 0 ("Characterization tests for the top 5 monster files")

Writing characterization tests for MarketResearch.tsx (14,956 LOC), ICPSummaryOpportunity.tsx (6,925 LOC), MissionControl.tsx (5,645 LOC) before any decomposition means testing deeply intertwined components with massive prop surfaces, internal state, and data fetching. These tests will be fragile (tied to internal structure) and expensive to write (potentially weeks of effort for 5 files). By Phase 5, when the files are decomposed, the tests will need substantial rewriting anyway.

**Suggestion:** Defer deep characterization tests to each feature's extraction phase, when the component structure is simpler. Phase 0 should focus on: (1) Playwright E2E suite locked green, (2) visual regression baselines, (3) Vitest/RTL/MSW infrastructure wired, (4) characterization tests for smaller, stable utilities in `src/lib/` and `src/hooks/` as proof-of-pattern.

---

### Medium — Phase 2a `escape-hatches.ts` limit of 10 `any` entries lacks review criteria

**Location:** §4 Phase 2a ("Escape hatch: `src/shared/types/escape-hatches.ts` may hold explicit `any` types with documented justification… Limit: no more than 10 entries; reviewed every phase")

The cap is specified but the review criteria are not. What constitutes a valid escape hatch? When should one be eliminated? Who approves additions? "Reviewed every phase" is ongoing administrative overhead for a pre-MVP product. The cap also pre-supposes the exact number of legitimate `any` needs, which is unknowable before Phase 2a runs.

**Suggestion:** Remove the hard cap. Instead: each entry requires a comment explaining why it exists and a reference to the call site. The Phase 2a spec sets an initial cap based on the actual error count. Phase 13's LOC audit re-evaluates all entries. This avoids micro-management of a number that can't be predicted.

---

### Medium — Phase 1 methodology "Read every file" is infeasible in practice

**Location:** §4 Phase 1, Stage 1 — Audit ("Read every file under `frontend/src/`")

At 75,894 LOC across potentially hundreds of files, no single agent session can "read every file." The methodology should rely on automated tooling (`knip`, `ts-prune`, `depcheck`, `rg` for dead imports) to produce the candidate list, with the agent reading only `investigate` items in full.

**Suggestion:** Reword Stage 1 to: "Run `knip` + `ts-prune` + `depcheck` on the full `src/` tree. Use outputs as the candidate list. Agent reads only `investigate` items in full."

---

### Medium — Phases 6–10 are skeletal compared to Phases 0–5 and 13–14

**Location:** §4 Phases 6, 7, 8, 9, 10

Phases 0–5 and 13–14 each have detailed deliverables, methodologies, in-scope/out-of-scope lists, and "done when" criteria. Phases 6–10 are source/destination lists with a single coordination note (Phase 7's ICP coupling mention). The spec says "each phase will get its own design + plan" but the master plan should surface the key risks and coupling points for each feature. Phase 7 already hints at ICP coupling between customers and mission-control; Phases 8–10 almost certainly have similar cross-cutting concerns.

**Suggestion:** Add at minimum a "Key risks / coupling points" bullet to each of Phases 6–10. This prevents the per-phase spec author from discovering coupling late in the game.

---

### Medium — §3.3 `index.ts`-only cross-feature import cannot be enforced by `import/no-restricted-paths`

**Location:** §3.3 ("`features/<X>/` may import from `features/<Y>/` **only via** `features/<Y>/index.ts`")

ESLint's `import/no-restricted-paths` restricts which *zones* can import from which other zones. It cannot enforce that imports from an allowed zone target only `index.ts`. A rule like `import/no-internal-modules` or a custom rule would be needed. The spec's enforcement mechanism doesn't match the desired constraint.

**Suggestion:** Use `import/no-internal-modules` with a configuration that allows `features/<Y>/**` only when importing from `features/<Y>/index`. Or acknowledge in the spec that this constraint requires a custom ESLint rule or architectural boundary tool (e.g., `dependency-cruiser`) and defer implementation choice to Phase 4's spec.

---

### Medium — Route management during feature extraction is unaddressed

**Location:** §2.3 ("Routes… frozen interfaces"), §4 Phases 5–12

Routes are listed as frozen interfaces (URLs don't change), but the React Router `<Route>` definitions currently point to `src/pages/*`. As each feature phase extracts pages into `src/features/<X>/pages/`, the route definitions must be updated to point to the new locations. The spec doesn't address this as a per-phase deliverable. Phase 11 says "`src/pages/` is empty (or only contains `App.tsx`-routed entry points)" but the routing update work is invisible.

**Suggestion:** Add an explicit deliverable to each feature phase: "update route definitions in `App.tsx` (or the route configuration file) to point to the new feature location." Phase 11's "done when" should verify that all route imports resolve to feature folders.

---

### Medium — No error boundary strategy for feature isolation

**Location:** §3.1 target layout, §4 Phases 5–12

As features are extracted into isolated folders, React error boundaries become the natural fault-isolation mechanism. The spec never mentions error boundaries. Without them, a runtime error in one feature can crash the entire app. This is both a design gap and a missed opportunity to establish a per-feature convention.

**Suggestion:** Add to Phase 4 (Feature scaffolding) or Phase 5's "done when": each feature's top-level page component is wrapped in a feature-scoped error boundary. Define the error boundary component in `src/shared/` or `src/features/shell/`.

---

### Medium — Visual regression tool choice is deferred but CI budget depends on it

**Location:** §4 Phase 0, §4 Phase 2c, §8 Q2

The visual regression tool (Playwright screenshots vs. Chromatic/Percy/Loki) is an open question deferred to the Phase 0 spec. But Phase 2c's CI gates already include visual regression as a required gate, and the "no fix forward" policy applies to it. The tool choice significantly affects CI cost, maintenance burden, and false-positive rate. For a zero-user product, a heavyweight visual regression tool is likely over-engineering.

**Suggestion:** Make a default recommendation in the master plan (Playwright's built-in screenshot diff, since the suite already exists) and defer the "upgrade to Chromatic/Percy" decision to post-MVP. The master plan should state the default to avoid the Phase 0 spec author having to make an unbounded tooling decision.

---

### Low — §1.3 LOC counts are point-in-time and will be stale by Phase 5

**Location:** §1.3 ("Largest files" table), §4 Phase 5 ("post-Phase-1 LOC, originally 14,956")

The spec notes "post-Phase-1 LOC" for Phase 5's source but the §1.3 table gives pre-Phase-0 numbers. Phase 1's LOC reduction pass will change these numbers. This isn't a blocker but could cause confusion if the Phase 5 spec author works from the master-plan table.

**Suggestion:** Add a note to the §1.3 table: "LOC counts are pre-Phase-0 baseline. Phase 1 will reduce these; Phase 5 works from post-Phase-1 counts."

---

### Low — Phase 2b self-contradicting instruction on react-hooks plugin

**Location:** §4 Phase 2b ("Add `eslint-plugin-react-hooks/recommended` if not already (it is, but verify rule set is full)")

"If not already (it is)" is a confusing self-contradiction. Either it needs to be added or it doesn't.

**Suggestion:** Reword to: "Verify the existing `eslint-plugin-react-hooks` config includes all `recommended` rules; add any missing ones."

---

### Low — Phase 14 stale-doc grep watcher is under-specified

**Location:** §4 Phase 14 ("stale-doc grep (any reference to `Phase N` outside specs/, plans/, docs/audits/, docs/reviews/ fails")

What constitutes a "Phase N" reference? The regex would need to match patterns like "Phase 5", "phase-5", "Phase 2a", etc., without false-positiveing on legitimate content (e.g., this spec itself references phases). The rule also needs a allowlist mechanism for legitimate cross-references.

**Suggestion:** Define the grep pattern (e.g., `\b[Pp]hase[- ]?\d+[a-z]?\b`) and a allowlist file (e.g., `.stale-doc-allowlist.txt`). Or defer implementation detail to Phase 14's spec with a clearer constraint description here.

---

### Low — §3.1 target layout shows `scout/` but not `profiler/`; Phase 9 contemplates both

**Location:** §3.1 target layout, §4 Phase 9 ("and a `src/features/profiler/` if the spec author decides they're distinct enough")

The canonical target layout in §3.1 only shows `scout/`. If Phase 9 decides `profiler/` is distinct enough, the layout diagram is incomplete. This is minor but could confuse.

**Suggestion:** Add a note to §3.1: "Phase 9 may add `profiler/` as a sibling to `scout/` if the extraction reveals sufficient separation."

---

### Nit — §1.4 "agents-as-authors" vs. "humans drive" phrasing

**Location:** §1.4 ("Agents-as-authors with anti-slop discipline" then "Humans drive… agents do the writing")

"Authors" implies creative authority. The subsequent text clarifies that humans drive and agents write, which is more like "agents-as-typists" or "agents-as-implementers." The heading slightly overstates the agent role relative to the body.

**Suggestion:** Consider "agents-as-writers, humans-as-orchestrators" or keep the heading but note the tension is intentional (agents write, humans direct).

---

### Nit — §5.4 artifact naming convention for frontend phase reviews is unspecified

**Location:** §5.4 ("Spec reviews: `docs/reviews/<phase-name>-spec-review-<round>.md`")

Backend reviews used both numeric (`13-prompt-management-design-spec-review-1.md`) and descriptive (`backend-modularization-phase-f-design-spec-review-1.md`) naming. The frontend hasn't settled a convention.

**Suggestion:** Pick one style in the master plan. Given the phase numbering here (0–14), `phase-N-<short-name>-spec-review-R.md` seems natural and consistent.

---

### Overengineering — Visual regression testing is heavyweight for a pre-MVP product

**Location:** §4 Phase 0, §4 Phase 2c, §5.3

Visual regression baselines, pixel-delta thresholds (0.1% per screen), and CI-gated visual regression are mature-project infrastructure. For a product with zero users where the UI may change significantly post-MVP, these tests will produce frequent false positives and maintenance burden. The pre-MVP velocity mandate in `AGENTS.md` argues against this level of visual lock-down.

**Suggestion:** Replace visual regression with Playwright E2E assertions on key DOM elements (text content, visibility, form state). Add visual regression post-MVP when visual stability matters. Keep the infrastructure (Playwright screenshots) but don't gate merges on pixel-level diff.

---

### Overengineering — Per-feature README.md files are premature documentation

**Location:** §3.1 (per-feature README.md), §4 Phase 4, §6 Definition of Done item 7

Requiring a README.md in every feature folder assumes the feature structure is stable and documentation is needed for navigation. For a solo CTO + agent workflow, the code itself (with good naming and types from Phases 2a/2b) is the primary navigation aid. Per-feature READMEs will drift out of sync faster than they're updated.

**Suggestion:** Replace with a single `src/features/README.md` that documents the conventions and lists features with one-line descriptions. Per-feature READMEs can be added later if the team grows or if specific features become complex enough to warrant them.

---

### Overengineering — Codemod infrastructure (Phase 13) is premature tooling

**Location:** §4 Phase 13 ("for any pattern that appears in ≥3 places, the audit produces a codemod in `frontend/scripts/codemods/<name>.ts`")

Building ts-morph/jscodeshift codemods for patterns that appear 3+ times assumes the patterns are stable and worth automating. In a codebase being actively refactored, patterns will shift between Phase 1 and Phase 13. Codemods built for the Phase 13 audit may never be reused.

**Suggestion:** Phase 13 should apply fixes manually (or with agent assistance). If a pattern appears ≥5 times and is likely to recur, log it to `docs/TECH_DEBT.md` as a codemod candidate. Build codemods only when the codebase is stable enough for them to be reusable.

---

### Overengineering — "No fix-forward" policy is enterprise-grade for a pre-MVP product

**Location:** §5.3 ("No 'fix forward' through a hook failure. Revert and re-plan, per backend Phase L methodology.")

For a product with zero users, reverting and replanning a phase because a CI hook failed is a significant velocity cost. The backend Phase L methodology was applied to a codebase serving production traffic. The frontend refactor has no users to protect.

**Suggestion:** Replace with: "If a CI gate fails, the phase author may fix-forward if the fix is contained within the phase's scope and does not affect frozen interfaces. If the fix leaks scope, revert and replan."

---

### Design Smell — Phase 11 (Layout shell + shared extraction) is conceptually misplaced in the sequence

**Location:** §4 Phase 11

Shell (Sidebar, Header, layout) and shared extraction (hooks, lib, utils) are foundational elements that every feature phase (5–10) will need to reference. By placing shared extraction at Phase 11, Phases 5–10 will inevitably create temporary shared utilities inside feature folders, then need to move them during Phase 11 — creating double-handling. The shell (layout, auth context) is also the app skeleton that features render inside.

**Suggestion:** Move shell extraction earlier — at least before the first feature phase. A lightweight Phase 4.5 or merge into Phase 4: extract layout shell and identify shared utilities that are clearly cross-cutting. Phase 11 can then focus on the remaining shared extraction (utilities discovered during feature work).

---

### Design Smell — Master plan staleness mitigation relies on manual discipline

**Location:** §7 R7, §5.5 ("synthesize-impl-review step includes 'update master-plan deltas' as a checklist item")

Keeping the master plan current via a manual checklist item in a review template is fragile. Over 17 phases, the probability that every synthesis step remembers to update the master plan approaches zero. The backend Spec 13 precedent is mentioned but not analyzed — did it actually stay current?

**Suggestion:** Accept that the master plan is a snapshot of intent at creation time (per `AGENTS.md`: "specs and plans are a frozen record of intent, not current truth"). The per-phase specs are the authoritative documents. The master plan's §1.3 starting-state table drifts by design; don't fight it. Add a disclaimer to §1.3: "These values reflect the state at spec creation; each phase spec carries its own starting-state snapshot."

---

### Plan-Readiness — Phases 6–10 lack enough detail for spec derivation

**Location:** §4 Phases 6, 7, 8, 9, 10

The master plan states "each phase will get its own design + plan" and the plan-readiness of Phases 0–5 and 13–14 is adequate for spec derivation. Phases 6–10, however, are thin source/destination lists without key risks, coupling points, or "done when" criteria beyond the generic "tests + Playwright + visual regression green." A spec author starting from these descriptions would need to do substantial independent analysis to write a credible spec.

**Suggestion:** For each of Phases 6–10, add: (1) key coupling points with other features, (2) specific risks (e.g., Phase 7's ICP coupling is noted but Phase 8's scout/profiler split across multiple current locations is not), (3) "done when" criteria specific to the feature.

---

### Decision Quality — No alternatives considered for overall approach

**Location:** §1.1, §2

The spec presents one approach (17-phase incremental modularization via per-feature extraction) without acknowledging alternatives: (1) Big Bang refactor of the entire `src/` tree in one phase, (2) slice-based refactoring (one vertical feature at a time, top to bottom), (3) "strangler fig" approach (new features in new structure, migrate existing ones opportunistically). Given the zero-user context and the velocity mandate, the incremental approach's overhead should be justified against alternatives.

**Suggestion:** Add a brief "Alternatives considered" section to §1 or §2, with one-line dismissals of the alternatives. This serves as design intent for future readers who might question the approach.

---

### Decision Quality — Non-functional requirements absent beyond bundle size

**Location:** §4 Phase 2c (bundle budget), §6 Definition of Done

The spec defines one NFR (bundle size) but omits: build time budget (Vite dev-server HMR speed matters for velocity), typecheck time budget (`tsc --noEmit` on 75k LOC may be slow), test execution time budget (Vitest suite should run in <X seconds), and CI pipeline duration. As the codebase is restructured, these NFRs affect the "agent affordances" goal — slow feedback loops defeat the purpose.

**Suggestion:** Add to Phase 0's baseline: measure current `vite build` time, `tsc --noEmit` time, and CI pipeline duration. Add time budgets to Phase 2c's CI gates (e.g., typecheck < 30s, Vitest suite < 60s).
