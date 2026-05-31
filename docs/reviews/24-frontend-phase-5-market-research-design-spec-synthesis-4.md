---
synthesizes_review: docs/reviews/24-frontend-phase-5-market-research-design-spec-review-4.md
artifact: specs/24-frontend-phase-5-market-research-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-05-31
round: 4
---

## Round Recommendation

no

Reason: All six substantive findings agreed and revised in place; every fix was an internal-consistency reconciliation (the round-5 amendment had edited some passages but not their cross-referencing neighbors) — no new design surface opened, and the one High was a wording contradiction now resolved.

## Agreed Findings

- **F1 (High — §4 self-contradiction):** The §4.2 Actions bullet still mandated the page→hooks rewire that the new §4 amendment records as descoped. Struck the bullet through and replaced it with an explicit "DESCOPED during 5b execution (TD-FE-19); redistributes to 5c structural relocation + 5d–5h conversion; the page still holds all 9 raw `fetch` + the cache after 5b." §4 now reads consistently top-to-bottom.
- **F2 (Medium — stale "analysis owns some fetches" framing):** Reconciled §4.1 to state **all 9 page fetches are market-research-proper / 0 belong to analysis** (the analysis tab does no page-level fetching; `ScoutLeadStream` holds any data access internally, in legacy). Reworded the §5 done-when so the lead-stream unit "imports no feature hook, with any data access living inside the `ScoutLeadStream` it renders" rather than "carrying its own raw `fetch`." Updated the §4.1 company-profile row to note the Phase-3 hook exists but is unadopted.
- **F3 (Medium — context-criteria vs "context-or-props" conflict):** Reframed the §5 "Context placement criteria" so the three tests gate **hoistability** (may this leave a single component at all), and the hoist **mechanism** is a second choice — props to nearest common owner by default (small/shallow consumer sets, e.g. the 2-consumer scout pair), context only when prop-drilling is deep or >2 consumers. The cross-tab-shared-state bullet and the done-when were aligned to "props-vs-context decision recorded," removing the rule that would have *mandated* a context.
- **F4 (Medium — 5d–5h ownership of page fetch/cache deletion unassigned):** Added an explicit §6 per-section bullet ("Delete the page's raw `fetch`/cache machinery for this section as it converts") and a matching §6 "Done when (each)" clause, with the note that 24i's zero-`fetch`/zero-`CACHE_DURATION` gate depends on it. The deferred data-layer deliverable now has a home in the section that governs those sub-phases.
- **F5 (Low — useState count stated three ways):** Settled §1.2 on "≈76 distinct `useState` hooks (88 `useState(` tokens incl. import + setter-only forms)"; propagated the figure to the two downstream "~70" references.
- **F6 (Low — spec drifts into impl detail):** Trimmed the §5 Safe-wrapper bullet's symbol/import-path specificity (dropped the `@/components/common/ErrorBoundary` path and the inner component name), keeping the design-level invariant (sanitization must be preserved or its removal documented) and pointing to the 24c plan for the exact symbols. Left the trends out-of-band render fact in §5 — it is the load-bearing reason R1 fired and directly constrains the plan, so it earns its place in the reconciliation record.

## Disagreed Findings

(none)

## Deferred Findings

(none)

## Severity Disagreements

(none — F1 High, F2/F3/F4 Medium, F5/F6 Low all accepted as rated. The review's own [Nit] on review-vs-design round numbering was a self-correction already folded into the review file, not a spec change.)

## Open Questions

- F3's relief valve introduces a soft threshold (">2 consumers / deep prop-drilling → context"). It is deliberately not a hard number — the 5c plan makes the props-vs-context call for the one real case (the scout pair → props) and records it. If Phases 6–12 find this precedent too loose, a later spec can harden the threshold; left soft to avoid over-specifying a single-feature decision.
