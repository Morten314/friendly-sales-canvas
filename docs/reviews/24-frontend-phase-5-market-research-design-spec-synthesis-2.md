---
synthesizes_review: docs/reviews/24-frontend-phase-5-market-research-design-spec-review-2.md
artifact: specs/24-frontend-phase-5-market-research-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-05-30
round: 2
---

## Round Recommendation

no

Reason: After the agreed revisions, no High/Critical remains; the two Mediums are closed by bounded scoping/clarification (not new design surface), and everything else is Low/Nit — the spec is converged for plan-writing.

## Agreed Findings

- **F1(R2) [Medium] search/filter→URL is un-elevated.** Correct. Moved the search/filter→URL *specifics* to §13 as a `24c` decision (the heuristic stays as default guidance), and added a §5 constraint: URL params carry top-level navigation + simple shareable filters; ephemeral inputs (draft text, open/closed dialogs, interim loading) stay local; complex or rapidly-changing filter state may stay local or use `replace`-mode history to avoid history pollution — 5c decides once the actual filters are known.
- **F2(R2) [Medium] lead-stream cross-boundary hook dependency.** Correct, and a genuine consequence of the round-1 leave-in-place flip. Revised: 5b migrates **only the market-research-proper** fetch sites; the analysis/lead-stream tab's sites stay raw, ride into the legacy `lead-stream/` unit in 5c, and **Phase 7 migrates them** when it claims the component. This avoids a legacy→feature hook dependency (the transitional exception covers feature→legacy only). Updated §4.1, §4.2, §5, and both done-whens.
- **F3(R2) [Low] tab containers absent from §2.1 tree.** Added `IntelligenceTab` (under `components/intelligence/`) and `TrendsTab` (under `components/trends/`) to the tree, noted as 5c output.
- **F4(R2) [Low] `MarketIntelligenceTabProps.ts` deletion timing.** Added: deleted when its last consuming section converts (≤ 5h), confirmed gone in 5i's `knip --strict` sweep (§6 + §11.2).
- **F5(R2) [Low] "keep exportable" unenforceable.** Took option (b): §2.2 now states 5i includes a surface-extraction restructure (no behavior change) if 5d–5h buried result types — replacing the unenforceable soft claim with an explicit 5i fallback.
- **F6(R2) [Low] master sub-split mapping implicit.** Added the explicit line to §9.3: master 5a→5a, master 5b→5b, master 5c→5c + 5d–5h + 5i.
- **F7(R2) [Nit] §9.2 framing.** Split §9.2 into the amendment (mark Phase 5 status) and the 5a-merge *action* (verify/correct stale Phase 3/4 rows).

## Disagreed Findings

None — all seven actionable round-2 findings hold and were applied.

## Deferred Findings

- **Search/filter URL policy → `24c`.** The exact URL-vs-local boundary and history mode depend on what the filters actually are (a 5c discovery); the §5 heuristic + constraint stand as the default. Trigger: 5c planning.
- **Lead-stream data-layer migration → Phase 7 (customers).** 5b/5c explicitly skip it; the component that owns lead-stream migrates its data access when it extracts. Trigger: Phase 7.

## Severity Disagreements

- **F1(R2): stated Medium → assess Low.** The heuristic itself is sound; the gap was elevation/clarity, resolved by relocating the decision to §13 + a one-paragraph constraint, not a redesign. Applied regardless of severity.

## Open Questions

- The exact partition of the 9 fetch sites into market-research-proper vs lead-stream is a 5b discovery (the spec now directs 5b to tag each site by owning tab). If the `analysis` tab shares the GET "load latest research" fetch with the `intelligence` tab, 5b documents how the extracted legacy lead-stream re-fetches independently post-extraction (rather than importing the feature hook).
- The complementary second-model (Opus) pass was never run — both rounds were glm-5.1. Given convergence (round 2: no High, "resolution quality high"), this is optional; operator's call before plan-writing.
