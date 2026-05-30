---
synthesizes_review: docs/reviews/24-frontend-phase-5-market-research-design-spec-review-1.md
artifact: specs/24-frontend-phase-5-market-research-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-05-30
round: 1
---

## Round Recommendation

maybe

Reason: No blocking finding remains after synthesis — the one High (F1) resolves by *aligning to* the master spec's existing leave-in-place model (not new surface) — but only the glm-5.1 reviewer ran; a second-model pass on the revised spec is the operator's call before plan-writing.

## Agreed Findings

- **F1 [High] Leaving-component model contradicts master §4 5c.** Correct, and the fix goes *further* than the recommendation: rather than document the deviation, the spec now **aligns** with master 5c — leaving components **stay in `src/components/market-research/`** (annotated), not pulled into the feature. The reviewer's premise that move-in is "the only practical option" doesn't hold; leave-in-place is both master-faithful and eliminates double-churn (move once, when the owning phase claims it, not twice). Revised §1.3.5, §2.1, §2.3, §3, §5, §7, §9.1, §11.2, §12 R5. (Note: this reverts a wrong "fix" I introduced during round-1 self-review — my original §11.2 wording was correct.)
- **F3 [Medium] `MarketResearchContext` lacks placement guidance.** Correct precedent gap. Added a "Context placement criteria" rule to §5: context holds only state that is (a) shared across ≥2 sections/tabs, (b) not URL-derivable, (c) not server state — else local/URL; if nothing qualifies, no context.
- **F4 [Medium] No endpoint inventory.** Added §4.1. Verified the 9 fetches resolve to **2 endpoints** (`market-research`: 1 GET + 7 POSTs dispatched by body; `profile/company`: 1 GET already covered by Phase 3's `useCompanyProfile`) — sharper than the reviewer's rough estimate, and it reduces 5b's new-contract work to one endpoint. Exact shapes still verified live in 5b.
- **F6 [Medium] Phase 13 boundary overreaches.** Correct. Softened §9.5 to a recommendation Phase 13 re-evaluates, not a binding scope assertion.
- **F7 [Medium] `index.ts` surface unspecified** — partial. Added a *non-binding* anticipated-surface hint to §2.2 (result types + a results-read hook for signals) so 5c–5h keep those exportable. See Deferred for the full draft-surface ask.
- **F9 [Low] `contracts.ts` vs `contracts/` departure unnoted.** Added rationale to §1.3.3 (single file suffices for feature-local scope; the `contracts/` dir pattern is for the shared contract surface).
- **F10 [Low] MSW coverage unconfirmed.** Added a 5b prerequisite (§4) to confirm/extend MSW + `api-mocks` handlers for the `market-research` endpoint.
- **F11 [Low] Long-lived branch conflicts.** Clarified §10: sub-phases merge to `master` **incrementally** (short-lived per sub-phase), re-syncing onto latest `master` before each merge — no weeks-long branch.
- **F13 [Nit] "Leaving components" undefined on first use.** Defined inline at §1.3.5.
- **F14 [Nit] §7 LOC lacks the §1.2 disclaimer.** §7 table caption now references the §1.2 point-in-time anchor.
- **F2 [High] 9 sub-phases — overhead** (partial — see Severity + Disagreed). Agreed to *justify* the per-section split and add a batching escape-hatch (§1.4): per-section is a deliberate, agent-context-bounded choice (master R6 + the brainstorm decision); the 5d-family plan may batch the smaller sections with per-section commits, MarketEntry stays solo.

## Disagreed Findings

- **F5 [Medium] No performance baseline / regression budget.** Disagree with the recommendation. The project **deliberately dropped** NFR/wall-time gating for the pre-launch MVP (master §8 Q3; Phase 2c decision; the repo's "advisory over hard-fail" posture at 0 users). A per-feature performance budget reintroduces exactly the machine-dependent gating that was rejected. The tradeoff is already handled at the project-appropriate level in §12 R7 (accept reload re-fetch; post-launch revisit trigger), which I sharpened to note the 30/min question is untestable pre-launch (0 users).
- **F8 [Low] `MarketResearch_clean.tsx` verification missing.** Disagree — it is present. §1.2 already states "No `_clean` duplicate remains"; tightened to "verified absent." The master spec's verify-before-extraction ask is satisfied.
- **F12 [Low] Date one day ahead.** Disagree — moot. Today is 2026-05-30; the spec date is now current. The reviewer evaluated on 2026-05-29 when it appeared forward-dated. No change.
- **F2 batch-it-away (the recommendation, as distinct from the justification).** Disagree: per-section sub-phases were the explicit brainstorm decision and keep each review scoped to one section's blast radius (master R6). The default stays per-section; batching is an opt-in plan-level escape-hatch for the smaller sections, not the baseline.

## Deferred Findings

- **F7 full "draft public surface with candidate exports."** Deferred to 5i. The sole consumer (signals) extracts in Phase 8 — three phases out — so a detailed draft now is speculative; a detailed-but-wrong surface is worse than a deferred one. Added only the non-binding hint. Trigger: 5i, informed by Phase 8.
- **F4 exact endpoint operation set + request/response shapes.** Deferred to the 5b plan (live verification per the polyglot rule — endpoints lack `response_model`). The spec carries the rough 2-endpoint inventory; exact shapes are a 5b action. Trigger: 5b planning.

## Severity Disagreements

- **F2: stated High → assess Low.** The design (per-section sub-phases) is sound and was the user's explicit choice; what was missing is *justification* — a documentation gap, not a design flaw. Revised by adding the rationale + escape-hatch rather than by restructuring.
- **F7: stated Medium → assess Low.** The warranted fix is a non-binding hint; there is no in-phase consumer, so nothing structural turns on it now.
- **F6: stated Medium → assess Low.** A wording softening from assertion to recommendation; applied.

## Open Questions

- **Second-model review round.** Per repo convention, `/review-spec` pairs a second model (e.g., Opus) for complementary coverage; only glm-5.1 ran round 1. Whether to run an Opus pass on the revised spec before plan-writing is the operator's call — it drives the `maybe` recommendation.
- **F1 reverses what was described to the user in brainstorming** ("leaving components ride into the feature"). The revised leave-in-place model is master-aligned and lower-churn, but the user should confirm the change before it's treated as settled.
