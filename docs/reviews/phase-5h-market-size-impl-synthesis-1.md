---
synthesizes_review: docs/reviews/phase-5h-market-size-impl-review-1.md
artifact: plans/24h-frontend-phase-5h-market-size.md
artifact_type: impl
reactor_model: claude (controller)
date: 2026-06-03
round: 1
---

## Round Recommendation

no

Reason: All findings are Low/Nit with no functional bug; the branch is green end-to-end and the cleanups belong to 5i (the next finalize + dead-code-sweep sub-phase).

## Agreed Findings

(none fixed this round — see Deferred. No finding rose to a fix-before-merge bar; the cost of re-verifying via the ~30-min serial preflight is not justified for Low/Nit non-bugs, and the items have a natural owner in 5i.)

## Disagreed Findings

(none — every finding is technically correct as written; agreement on substance, disagreement only on timing, captured under Deferred.)

## Deferred Findings

- **[Low] `view.*` array identities churn the prop-sync effect when `marketSize.data` is undefined** (`MarketSizeSection.tsx` `view` object + prop-sync `useEffect` deps). Agreed real and 5h-owned (the `view` object is 5h's invention). No loop/functional bug — the effect body is JSON-diff-guarded. Deferred to **5i**: depend on `marketSize.data?.strategicRecommendations`/`?.marketDrivers` (stable TanStack-cache identity) or wrap `view` in `useMemo`. Trigger: 5i container-trim pass, or earlier if anyone adds an unconditional `setState` inside that effect. Flagged in the 5i handoff.

- **[Low] `MarketSizeResultSchema.parse()` throws on a string-typed / non-string-valued `marketSizeBySegment`/`growthProjections`** that the chart helpers otherwise tolerate (`types.ts` vs `marketSize.ts`). Agreed the residual shape-gap exists, but this is the **established sibling convention** (`industry-trends/types.ts`, `market-entry/types.ts` use the same `z.record(z.string())` + `.parse()`), and the section renders under `<FeatureErrorBoundary>`. Fixing it only here would diverge from siblings; it is a **cross-section** hardening change (`.safeParse()` + `?? undefined` across all section hooks), not 5h's to make unilaterally. Deferred to a feature-wide schema-hardening pass (note for 5i / Phase 13). Trigger: a malformed 5b payload of that specific shape is observed, or a deliberate cross-section robustness pass.

- **[Nit] Broad MSW match `lower.includes("market size")`** (`test/msw/handlers.ts`). Latent only — the exact-match clause already covers the real component and the generic round-trip test now self-isolates via `server.use()`, so no current collision. Deferred to 5i (tighten to exact/anchored match). Trigger: a future component name containing "market size" is added.

- **[Nit] Verbatim-carried `console.log`/emoji debug logging in `handleSave`** (`MarketSizeSection.tsx`). Parity-preserved from the deleted monolith (the phase was an explicit verbatim move), not a 5h regression. The broader `/api/ask` edit-save rewrite is already owned by **TD-FE-31**; the log cleanup rides with it (or the repo-wide console.log sweep noted in CLAUDE.md). Deferred to TD-FE-31 / 5i.

- **[Nit] Dead/unused props retained on `MarketSizeSectionProps`** (`isLoading`/`error`/`onRefresh`/`isRefreshing`/`companyProfile`/`_hasEdits`). Knip-clean (typed props, not unused imports). The container already documents these as an intentional deferral matching the 5d–5g convention. Deferred to **5i**'s dead-code sweep + prop-trim, which is its explicit mandate. Flagged in the 5i handoff.

## Severity Disagreements

(none — the reviewer's Low/Nit severities are correct.)

## Open Questions

(none.)
