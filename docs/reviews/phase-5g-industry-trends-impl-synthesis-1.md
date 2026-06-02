---
synthesizes_review: docs/reviews/phase-5g-industry-trends-impl-review-1.md
artifact: worktree-phase-5g-industry-trends
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-02
round: 1
---

## Round Recommendation

no

Reason: No Critical/High findings. The three Mediums are either deliberate, verified-correct deviations matching the merged 5d/5e sibling convention (F1, F2) or a factual misread (F4); the one genuine code issue (F3) is a latent type-safety hole with no runtime consumer, fixed now alongside the F5 micro-opt. Remaining items are Low/Nit.

## Agreed Findings

- **[F3] Unsafe `as TrendSnapshot[]` cast with `type: … ?? undefined`.** Confirmed real: the zod view-model's `type` is `.nullish()` but `TrendSnapshot.type` is a required union, and the cast masks the gap. Verified no consumer reads `snapshot.type` (`TrendSnapshots.tsx` renders title/metric + a fixed gradient bar — `grep` for `.type`/`growth`/`performance`/`adoption` is empty), so it is latent, not a live bug. **Fix:** default to a valid union member (`type: s.type ?? "growth"`) so the object honestly satisfies `TrendSnapshot` and the unsafe cast is removed. (Behavior-identical — the value is unused in render.)
- **[F5] `budgetToChartData` palette array recreated per call.** Confirmed. **Fix:** lift the 8-colour array to module scope (`const BUDGET_COLORS = [...]`) in `industryTrends.ts`.

## Disagreed Findings

- **[F1, Medium] `export default` retained instead of named export.** The finding is factually true (the plan's Task 1 Step 2 asked for a named export) but the recommendation is wrong for this codebase: all three already-merged sibling sections use `export default` — `MarketEntrySection.tsx:524`, `RegulatoryComplianceSection.tsx:1000`, `CompetitorLandscapeSection.tsx:2593`. Following the plan literally would make industry-trends the lone outlier against an established convention (CLAUDE.md: "follow existing code style/patterns"). The plan's instruction predates those merges; the deviation was a conscious reconciliation to the merged reality. Keeping `export default`. The plan's "no `export default` remains" done-when clause is superseded by the sibling convention.
- **[F2, Medium] `orgId` from `useAuth()` instead of an explicit prop.** The plan says "prefer an explicit prop," but the merged exemplar does the opposite: `MarketEntrySection.tsx:80-81` is `const { currentUser, orgId } = useAuth(); const orgIdToUse = orgId || "brewra";` — byte-for-byte what 5g does. Matching the merged sibling wins on consistency; the testability concern is already addressed (the container test mocks `@/shared/auth`). Keeping `useAuth`-sourced `orgId`.
- **[F4, Low] Per-field callbacks retained / "data-prop-surface reduction incomplete vs market-entry."** The premise is factually incorrect. Market-entry did NOT remove its per-field change callbacks — they are on its interface (`MarketEntrySection.tsx:41-48`), destructured (`:68-75`), and called on save (`:145-152`), with the parent still threading them. 5g matches 5d exactly (down = hook data, up = per-field callbacks for committed edits). This is the intended merged pattern, not an incomplete reduction. No change. (The "record the author's-judgment choice" sub-point is satisfied: the keep-callbacks decision is recorded in this synthesis, the handoff, and project memory.)

## Deferred Findings

- **[F6, Low] VisualCharts read-mode line chart uses synthetic `value: 45 + index * 11`.** Confirmed and acknowledged by the reviewer as "not a regression" — it was carried verbatim from the monolith for behavioral parity, which is exactly 5g's mandate (decomposition must preserve behavior, including pre-existing quirks). Fixing it would be a deliberate behavior change outside this refactor's scope. **Defer.** Trigger: a dedicated VisualCharts data-integrity pass (parse the `"2023: 45%"` trend strings), or whenever real trend-series rendering is specced.
- **[F7, Nit] Emoji in `console.error`.** Carried from the original; the reviewer notes it is "for awareness only," the style guide is neutral, and the codebase has many such instances. Behavior-preserving; no policy violation. **Defer** (won't-fix absent a logging-style policy).

## Severity Disagreements

- **[F3] Medium → Low.** Agree with the finding; disagree with severity. There is no runtime consumer of `snapshot.type` (verified), all gates + the full e2e suite are green, so the impact is a latent type-safety hole, not a Medium defect. Fixing it anyway because it is cheap and removes a lying cast.

## Open Questions

- None blocking. Note for the eventual master integration: F1/F2/F4 are deliberate divergences from the 24g plan text in favour of the merged 5d/5e convention — if a future reviewer re-flags them, this synthesis is the standing rationale. The 5h (MarketSize) decomposition should follow the same convention (recorded in project memory).
