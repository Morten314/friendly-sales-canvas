---
synthesizes_review: docs/reviews/14-frontend-refactoring-master-plan-design-spec-review-2.md
artifact: specs/14-frontend-refactoring-master-plan-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-26
round: 2
---

## Round Recommendation

yes

Reason: 17 findings, all agreed. The Critical is a contradiction I introduced during round 2 (§6 DoD #3 still cites the "max 10 entries" cap that Phase 2a explicitly dropped). Plus four Highs: Phase 0 overview row not updated, Phase 11 done-when references post-Phase-12 state (logical impossibility), Phase 5 sub-split 5c routes components to features that don't exist yet, and the new `<FeatureErrorBoundary>` has no test coverage. After fixes, a round-3 review is warranted to confirm the round-2 contradiction class is resolved.

## Agreed Findings

- **Critical #1 — §6 escape-hatch cap contradicts Phase 2a.** Round 2 dropped the "max 10" cap from Phase 2a's description but left it in §6 DoD #3. Direct contradiction. Updating §6 #3 to match Phase 2a: removing "(max 10 entries)" and replacing with "each entry requires documented justification and a call-site reference; Phase 2a's spec sets the initial count cap; Phase 13's audit re-evaluates every entry."

- **High #2 — Phase 0 overview row not updated for refocused characterization.** The overview table row still reads "characterization tests for top 5 monsters" — directly contradicts the detailed Phase 0 description (which I correctly refocused in round 2). A reader skimming the table would plan exactly the work I told them to skip. Updating the overview row to: "Audit, lock Playwright, visual regression baselines, Vitest+RTL+MSW setup, characterization tests for stable utilities + behavioral E2E for monster-file routes."

- **High #3 — Phase 11 done-when references post-Phase-12 state.** Phase 11 cannot verify that shared utilities from Phase 12 are populated because Phase 12 hasn't run yet. The description text already handles this correctly ("any additional shared utilities surfaced [in Phase 12] are pulled into `src/shared/` at the time Phase 12 needs them"). Removing "and 12" from Phase 11's done-when.

- **High #4 — Phase 5 sub-split 5c routes components to features that don't exist yet.** Phase 5's 5c proposes moving lead-stream → `customers/`, scout chat → `scout/`, strategist workspace → `strategist/`, but those folders don't exist until Phases 7, 9, 8 respectively. Reframing 5c: it becomes a **handoff annotation** rather than a physical code move. Components identified as belonging to later features stay in their current location (or move to a `_pending/` subfolder inside `src/features/market-research/`) with their target feature recorded in the Phase 5 spec. The owning future-phase claims them when it runs. No `_staging/` top-level area — that would introduce yet another transient location.

- **High #5 — `<FeatureErrorBoundary>` has no test coverage.** The component's purpose is fault isolation; an untested one defeats the goal. Adding to Phase 4's deliverables: "Unit tests for `<FeatureErrorBoundary>` verifying (a) catches and renders fallback for thrown errors in children, (b) does not intercept errors outside its subtree, (c) logs error information for debugging."

- **Medium #6 — Phase 2a 1,500 threshold lacks justification.** Adding a one-line rationale: "1,500 is a starting heuristic — roughly the error surface where an agent without sub-decomposition can maintain consistent error-category focus across a single plan. Phase 2a's spec author validates against the actual post-Phase-1 error count and adjusts if measurements suggest a different cutoff."

- **Medium #7 — Profiler coordination mechanism is vague.** Adding a concrete coordination artifact. Phase 6's spec includes a "Profiler disposition" section listing each profiler-related component with its interim home and intended final home. Phase 7's spec confirms or amends. Phase 9 reads both before planning, then resolves and updates the section. The section lives in whichever phase spec is current; it's not a top-level master-plan artifact (those would drift faster than they're useful). Also adding a precondition to Phase 9's "Key risks / coupling points": "Phase 9 spec author reads Phases 6 and 7's profiler-disposition sections before planning."

- **Medium #8 — Phase 3 localStorage/sessionStorage wording too broad.** Qualifying the mission statement: "Migrate `localStorage` and `sessionStorage` **caching** usage to TanStack Query persistence. Features using `sessionStorage` as a primary data store (e.g., Strategist's `sessionStorage.strategistContext`) are explicitly out of scope for this migration — they're persistent state, not cache."

- **Medium #9 — Phase 12 source paths missing prefix.** Updating Phase 12's source list to include full `src/pages/` paths, matching the convention used in Phases 5–10.

- **Medium #10 — `src/services/` disposition unclaimed.** Adding to Phase 3's deliverables: "Identify all files in `src/services/` and migrate or redirect them. API-related services move to `src/shared/api/`; feature-local services move with their feature in Phases 5–10." This makes Phase 11's "verify `src/services/` is gone or redirected" reachable.

- **Low #11 — `src/styles/` no phase claims it.** Adding a note to §3.1: "`src/styles/` is carried forward as-is from the current layout. Phase 11's spec may decide to restructure it (per §8 Q12), but the default is no movement." This avoids assigning a phase prematurely.

- **Low #12 — E2E test suite location.** Adding to §2.3 (Frozen interfaces) or §2.1 (In scope): "E2E test suite location remains centralized at `frontend/e2e/`." This commits to the simpler decision rather than deferring.

- **Low #13 — Phase 0 NFR CI baseline against TODO workflow.** Adding a qualifier to Phase 0's NFR-measurement deliverable: "CI pipeline duration is captured as *informational* only — the workflow is mostly TODO scaffolding at this stage. The CI duration *budget anchor* for Phase 2c is re-measured in Phase 2c against the fully-wired workflow." Phase 2c gates against its own measurement, not Phase 0's.

- **Low #14 — Phase 13 codemod test framework unspecified.** Adding to Phase 13's codemod paragraph: "Codemod test approach: Vitest + filesystem fixtures under `frontend/scripts/codemods/__tests__/` (input.ts → expected.ts pairs). Phase 13's spec finalizes the harness details."

- **Low #15 — No sub-phase rollback protocol within feature extractions.** Extending §5.7 to address sub-phase granularity: "Within a sub-split phase, each sub-phase is a discrete commit (or commit series) that leaves the codebase in a green state. If a sub-phase fails, revert to the last green sub-phase commit and replan the remainder — the full phase doesn't need to revert."

- **Nit #16 — Visual regression "default threshold" is a range, not a default.** Rewording Phase 0: "Threshold range: 0.5–1.0% pixel delta per screen. Phase 0's spec selects the exact value within this range." And matching update in Phase 2c.

- **Nit #17 — Stale-doc watcher regex will match many legitimate references.** Adding a UX note to Phase 14: "The allowlist is expected to be non-trivial in size. Phase 14's spec should consider whether an inverted approach — scan only `src/` files, not docs/specs/plans — is more maintainable than maintaining a large allowlist."

## Disagreed Findings

(none — all 17 findings are agreed)

## Deferred Findings

(none — all are revised in round 3)

## Severity Disagreements

(none — every severity matches reviewer's assignment)

## Open Questions

- **Q1 — Handoff annotation location for Phase 5's 5c.** Should the components-pending-future-phases live in `src/features/market-research/_pending/` (a subfolder inside the feature being extracted), or stay in their current pre-extraction locations (`src/components/market-research/*`) until claimed? Both work; round-3 spec picks one and the Phase 5 spec carries the consequences. Leaning toward staying in current pre-extraction locations — simpler, no transient folders, the only invariant is that the Phase 5 spec records what's leaving market-research and where it lands.

- **Q2 — Profiler-disposition section location.** Inside Phase 6's spec, inside the master plan as a living section, or as a `docs/audits/profiler-disposition.md`? Round-3 spec commits to one. Leaning toward inside Phase 6's spec (where the first concrete decision is made) with Phase 7 and 9 amending in their own specs — keeps documentation co-located with the decisions, not centralized into yet another doc.
