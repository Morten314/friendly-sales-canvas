---
synthesizes_review: docs/reviews/24b-frontend-phase-5b-data-layer-plan-review-3.md
artifact: plans/24b-frontend-phase-5b-data-layer.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-05-30
round: 3
---

## Round Recommendation

no

Reason: The one substantive finding is an agreed, code-verified factual-claim correction that opens no new design surface; all others are Low/Nit.

## Agreed Findings

- **[High] CompetitorLandscapeSection does not self-fetch `market-research`** — Verified against code: `CompetitorLandscapeSection.tsx` calls `/api/ask` (line 697) and `/api/market_intelligence` (line 727) and contains zero `market-research` references; the other four sections (IndustryTrends, MarketEntry, Regulatory, MarketSize) do call `apiFetchJson("market-research")`. Correct the Architecture "Scope note" (line 7) and Task 0 Step 3's "expected:" line to read "4 of 5 sections self-fetch `market-research`; CompetitorLandscapeSection calls `/api/ask` + `/api/market_intelligence` instead," and add a handoff flag (Self-review notes + Task 7 Step 6 §9 delta) telling the 5f plan to do its own endpoint analysis rather than assume it can swap to `fetchResearchComponent`. Note: this does not change 5b's executable scope — the page-level competitor fetch is genuinely `market-research` POST (MarketResearchPage.tsx line 3252) and Task 0 Step 3's section-inventory grep would surface the real endpoints regardless.
- **[Low] Task 3 Step 2 verification does not exercise the MSW handlers** — Accurate: the `npx vitest run src/features/market-research` invocation runs the Task 2 contracts test (`Schema.parse` on a hardcoded fixture), which never touches MSW; handlers are first exercised in Task 4. Apply recommendation (b): change the verification description from "contracts test stays green" to "existing tests still pass; handlers are first exercised in Task 4." No new smoke test added (handlers are test infra, Task 4 catches breakage).
- **[Low] `userId` excluded from query key** — True: the key is `["market-research", "component", orgId, componentName]` and omits `user_id`. Add a one-line "accepted limitation" note to ADR-0004 (the lighter of the two options), consistent with the repo's no-real-auth / MVP posture — do not add `userId` to the key.
- **[Nit] Self-review note "5a E2E mock" phrasing** — Agree it can misread as a mock 5a introduced when `api-mocks.ts` pre-dates 5a. Light rephrase to "the pre-existing `e2e/fixtures/api-mocks.ts` mock" in the Self-review notes paragraph 3.
- **[Nit] Task 4 Step 3 combines red + implement in one checkbox** — Agree; split into two `- [ ]` checkboxes (run-red / implement) to match Task 2 and Task 5 granularity.

## Disagreed Findings

(none)

## Deferred Findings

(none)

## Severity Disagreements

- **[High → Medium] CompetitorLandscapeSection self-fetch claim** — I agree the claim is factually wrong, but read it as Medium rather than High. The error does not break 5b's executable path (its page-level competitor fetch is genuinely `market-research`, and Task 0 Step 3's `grep -rn` over the section components would surface the actual `/api/ask` + `/api/market_intelligence` endpoints during execution). The real harm is a misleading "expected:" hint and a false assumption propagated to the downstream 5f plan — a scope-accuracy/handoff defect, not an execution blocker. This is a severity note only; the correction being made is identical either way, and even at High the finding is fully resolved by the text correction (it opens no new design surface), so it does not warrant a round-4 re-review.

## Open Questions

(none)
