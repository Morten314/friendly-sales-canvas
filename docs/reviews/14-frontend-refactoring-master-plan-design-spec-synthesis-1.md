---
synthesizes_review: docs/reviews/14-frontend-refactoring-master-plan-design-spec-review-1.md
artifact: specs/14-frontend-refactoring-master-plan-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-26
round: 1
---

## Round Recommendation

yes

Reason: 19 findings agreed and merit revision (mostly Medium/Low touch-ups but several High findings — TanStack scope, abort protocol, route updates, error boundaries, NFR budgets — open meaningful design surface that should be re-reviewed). The Critical is disagreed with reasoning, but the volume and substance of agreed High findings drives a round-2 spec.

## Agreed Findings

- **High #2 — Phase 2b enforces `import/no-restricted-paths` for layout that doesn't exist yet.** Sequencing fix: Phase 2b adds general type-aware rules + `import/order` + Prettier. The features-specific dependency rules (§3.3 `features/<X>/`, `features/<Y>/index.ts` only) move to Phase 4 (when `src/features/` skeleton exists) and become enforceable from Phase 5 onward.

- **High #3 — TanStack Query scope boundary with Phases 5–10 underspecified.** Adding an explicit "TanStack Query migration of this feature's fetch sites" deliverable to each of Phases 5–10. The dual concern (structural extraction + data-layer migration) becomes an explicit per-phase responsibility instead of implicit shared work.

- **High #4 — No mid-phase abort protocol.** Adding §5.7 "Abort and revert" subsection: if a phase branch cannot reach its done-when state within bounded scope/duration, revert the branch, log findings to `docs/TECH_DEBT.md`, and replan with revised scope. Gives the human orchestrator an explicit decision point.

- **High #5 — Characterization tests for monster files are costly pre-decomposition** (reframed). Reframe Phase 0's characterization target away from monster-file *internal structure* toward (a) stable utility code in `src/lib/`, `src/hooks/`, `src/utils/`, and (b) behavioral E2E coverage of the user-visible journeys those monster files participate in. The user-chosen "tests before LOC" sequencing stays. The deep per-component characterization tests get rewritten anyway during Phase 5+, so we don't build them up front; behavioral and DOM-level coverage carries the safety load.

- **Medium #6 — Escape-hatches.ts cap of 10 lacks review criteria.** Removing the hard "max 10" cap. Replacing with: each entry requires a comment explaining the reason and naming the call site; Phase 2a's spec sets an initial cap based on actual error count; Phase 13's audit re-evaluates all entries.

- **Medium #7 — Phase 1 "Read every file" is infeasible.** Rephrasing Stage 1 audit methodology: "Run `knip` + `ts-prune` + `depcheck` + targeted `rg` queries on the full `src/` tree. Use outputs as the candidate list. Agent reads `investigate` items in full." The blanket "read every file" line goes away.

- **Medium #8 — Phases 6–10 are skeletal.** Adding to each of Phases 6–10: a "Key risks / coupling points" bullet listing specific cross-feature dependencies (e.g., Phase 7 customers ↔ mission-control ICP coupling; Phase 8 signals ↔ market-research shared chat UI; Phase 9 scout/profiler split across mission-control and customers; etc.). This also covers #25 (Plan-Readiness).

- **Medium #9 — `index.ts`-only enforcement cannot be done by `import/no-restricted-paths`.** Updating §3.3: enforcement is via `import/no-internal-modules` (preferred) or `dependency-cruiser` for richer rules; the specific tool is decided in Phase 4 spec. The current "Enforced by ESLint `import/no-restricted-paths`" line gets the correction.

- **Medium #10 — Route management during feature extraction unaddressed.** Adding an explicit deliverable to each of Phases 5–12: "Update route definitions in `App.tsx` to point to the new feature location." Phase 11's done-when adds a verification that route imports resolve to feature folders.

- **Medium #11 — No error boundary strategy.** Adding to Phase 4 deliverables: define a feature-scoped error boundary component (in `src/features/shell/` or `src/shared/`). Each feature's top-level routed component is wrapped in this boundary starting Phase 5. This is a real gap in the spec.

- **Medium #12 — Visual regression tool deferred but Phase 2c assumes it.** Setting the default in §4 Phase 0: Playwright's built-in screenshot diff (since Playwright suite already exists). Upgrade to a heavier tool (Chromatic / Percy / Loki) deferred to post-MVP or surfaced as a Phase 0 spec discussion if needed. This gives Phase 2c a concrete budget anchor.

- **Low #13 — §1.3 LOC counts will be stale by Phase 5.** Adding a footnote to the §1.3 table: "LOC counts are pre-Phase-0 baseline. Phase 1 will reduce these; later phases work from post-Phase-1 counts measured in each phase's own spec."

- **Low #14 — Phase 2b react-hooks self-contradiction.** Rewording to: "Verify the existing `eslint-plugin-react-hooks` config includes all `recommended` rules; add any missing."

- **Low #15 — Phase 14 stale-doc grep watcher under-specified.** Adding a gesture: "default regex `\b[Pp]hase[- ]?\d+[a-z]?\b`, with an allowlist file (e.g., `.stale-doc-allowlist.txt`). Detailed implementation deferred to Phase 14 spec." Just enough to make the constraint concrete.

- **Low #16 — §3.1 layout shows `scout/` but not `profiler/`.** Adding a note under §3.1: "Phase 9 may split `scout/` and `profiler/` if the extraction reveals sufficient separation; the diagram shows one of two possible final states."

- **Nit #17 — "agents-as-authors" vs "humans drive" phrasing.** Tightening §1.4 heading or adding a one-line clarification that the two roles are deliberately layered (agents author, humans orchestrate) — not a contradiction.

- **Nit #18 — Review file naming convention unspecified.** Codifying §5.4 explicitly: review/synthesis files derive from the spec's `NN-<short>-design.md` filename — i.e., `docs/reviews/NN-<short>-design-spec-review-R.md` and `…-synthesis-R.md`. Matches what we're already doing for spec 14.

- **Overengineering #21 — Codemod infrastructure premature** (partial). Softening Phase 13: "Codemods are produced for patterns *likely to recur* and *mechanically transformable*. Ad-hoc one-off patterns are fixed manually. The ≥3-occurrence threshold is a candidacy signal, not an auto-mandate." Avoids building codemods that get used once and never again.

- **Design Smell #23 — Phase 11 misplaced (partial).** Splitting Phase 11's content. **Shell extraction** (Sidebar, Header, AuthContext, route shell) moves to *before* the first feature phase — folded into Phase 4 ("Feature scaffolding + shell extraction") since the shell is the app frame features render inside. **Shared utility extraction** stays at Phase 11 because shared utilities should *emerge* from feature work, not be pre-extracted (premature shared boundaries are worse than late ones). Phase 11 then narrows to "Shared utility extraction" only.

- **Design Smell #24 — Master plan staleness mitigation (partial).** Agree on adding a starting-state disclaimer to §1.3 (as covered by #13). Disagree separately (see Disagreed) with the suggestion to treat the master plan as frozen-by-design; the spec-13 precedent for keeping the spec reconciled stands.

- **Decision Quality #26 — No alternatives considered.** Adding §1.5 "Alternatives considered" with one-line dismissals of Big Bang (too risky), slice-based vertical-at-a-time (loses foundation discipline of strict-TS-everywhere), strangler fig (perpetual two-shape state defeats the modularization goal), and the three approaches explored during brainstorming (linear backend-mirror, foundation-first, parallel-tiered) with reasoning for the chosen hybrid.

- **Decision Quality #27 — Non-functional requirements absent.** Adding to Phase 0 baseline measurements: `vite build` wall time, `tsc --noEmit` wall time, Vitest cold-start time, CI pipeline duration. Adding to Phase 2c gates: budget thresholds for typecheck (cold), test suite (full), and CI total — values set from Phase 0 baselines + agreed headroom. This is core to the agent-readiness goal — slow feedback loops defeat the purpose.

## Disagreed Findings

- **Critical #1 — Adversarial ceremony contradicts pre-MVP velocity mandate.** Disagreed. The reviewer reads root `AGENTS.md` as licensing the removal of review discipline, but the same passage continues: *"This is **not** a license to skip code quality, tests, or careful thinking — it's a license to skip the ceremony that exists to protect users you don't have yet."* The 17-phase adversarial cycle is **code-quality discipline**, not user-protection ceremony. Velocity-license items per `AGENTS.md` are: zero-downtime, deprecation periods, backwards-compat shims, feature flags. Reviews, tests, careful thinking are **explicitly not** in that category. Furthermore, the user established the AI-native target as agents-as-authors *with* adversarial anti-slop mechanisms — the review cycle is the anti-slop machinery, not the deploy ceremony. Collapsing phases 0+1 / 2a+2b+2c removes the explicit checkpoint structure that gives the human orchestrator transition decisions; collapsing review rounds removes the fresh-eyes discipline that catches reasoning errors agents won't self-catch. The user has affirmed this position explicitly. Leaving §1.1, §5, and the per-phase workflow as designed.

- **Overengineering #19 — Visual regression heavyweight for pre-MVP** (partial disagreement). Disagreed on the suggestion to *replace* visual regression with DOM assertions. Visual regression and DOM assertions are different layers — pixel diff catches CSS regressions, layout breakage, and z-index/stacking bugs that DOM-element assertions miss. A refactor is precisely the workload where visual regression earns its keep: behavior unchanged, but CSS subtly breaks. The reviewer's narrower point about the 0.1% pixel threshold being too strict is fair — see Severity Disagreements. But removing visual regression is the wrong move for a refactor-heavy plan. Keeping visual regression as a Phase 0 deliverable and a CI gate from Phase 2c; loosening the threshold (covered in severity section).

- **Overengineering #20 — Per-feature `README.md` files premature documentation.** Disagreed. Per-feature READMEs are core to the agent-readiness goal stated in §1.4. The argument "code + types is the navigation aid" holds for human readers familiar with the codebase; agents that arrive cold benefit substantially from a 50-line README that names the feature's purpose, public surface, and key files. This is the same reason backend specs/plans/audits exist — agents read them before reading code. Drift risk is real but is exactly what Phase 14's stale-doc watchers address. Leaving as designed.

- **Overengineering #22 — "No fix-forward" policy enterprise-grade.** Disagreed. The reviewer reads "no fix-forward" as user-protection ceremony, but the rule's actual purpose is **anti-slop**: agents under pressure to fix CI failures tend to add a band-aid commit that masks the symptom without resolving the cause, leaving the failure latent. The discipline of "revert and re-plan" forces root-cause analysis, which is core to the agent-driven anti-slop machinery the user explicitly chose. The cost of an occasional revert is low compared to the cost of accumulating band-aid commits across 17 phases. The backend Phase L methodology was applied for exactly this reason (agent-quality), not for production-traffic protection. Leaving §5.3 as designed.

- **Design Smell #24 — "Accept master plan as frozen-by-design"** (partial disagreement, separate from the agreed disclaimer). Disagreed. The reviewer cites `AGENTS.md`: "specs and plans are a frozen record of intent, not current truth." But the spec-13 precedent explicitly overrode this: *"This spec was originally written as 'frozen on approval' per CLAUDE.md convention, but the user explicitly chose to reconcile it with the implementation deviations so the spec remains a current source of truth rather than a historical snapshot."* The user has chosen to keep load-bearing specs reconciled with implementation. R7's "update master-plan deltas at phase merge" follows that precedent. The §1.3 starting-state disclaimer (agreed under #13) acknowledges that point-in-time numbers drift, but the rest of the master plan stays reconciled per the spec-13 model. The reviewer doesn't analyze whether the spec-13 reconciliation actually held — it did (see commit `7796c55` and the spec's post-merge note). Leaving R7 and §5.5 as designed.

## Deferred Findings

(none — all findings are either acted on in round 2 revision or explicitly disagreed)

## Severity Disagreements

- **Overengineering #19 — Visual regression severity.** Agree with the substance that the 0.1% pixel-delta threshold is too tight for a refactor where minor anti-aliasing or font-rendering shifts will trigger noise. Disagree with the "Overengineering / remove" severity. Treating this as a Medium ("tune the threshold and re-baseline workflow") rather than Overengineering. Concrete change: bump default threshold to a coarser value (e.g., 0.5–1.0% with explicit re-baseline workflow for accepted UI changes); decide exact value in Phase 0 spec.

## Open Questions

- **Q1 — Where does the feature-scoped error boundary component live?** `src/features/shell/` (alongside the shell) or `src/shared/components/`? Decided in Phase 4 spec (the phase that now owns shell extraction post-#23 reorganization).

- **Q2 — Phase 11's renamed scope.** With shell extraction moving to Phase 4 (per #23), Phase 11 narrows to "shared utility extraction" only. Worth considering whether Phase 11 still needs to be a standalone phase or whether shared extraction can be folded into Phase 13's LOC pass #2 (since both involve "find patterns across already-extracted features and promote what's truly shared"). Decision in round-2 spec.

- **Q3 — Codemod policy clarification.** Per #21's softening, what's the bar for "likely to recur"? Patterns observed in ≥3 places is a candidacy signal, but the actual yes/no decision is judgment. Worth specifying the criteria in the round-2 spec (e.g., "the pattern is structural and likely to appear in new feature work" vs "the pattern is content-shaped and unlikely to recur").

- **Q4 — NFR budget values.** Per #27, what budget values for typecheck / test-suite / CI total? Phase 0 measures, Phase 2c codifies — but the master plan should at least cite ballparks (e.g., typecheck cold ≤ 30s; Vitest full ≤ 60s; CI total ≤ 8 min) so Phase 0's spec author isn't proposing unbounded values. Round-2 spec to include ballparks.
