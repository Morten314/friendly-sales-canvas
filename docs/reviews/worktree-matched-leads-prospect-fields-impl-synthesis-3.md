---
synthesizes_review: docs/reviews/worktree-matched-leads-prospect-fields-impl-review-3-glm-5.2.md
artifact: worktree-matched-leads-prospect-fields
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-25
round: 3
---

## Round Recommendation

yes

Reason: The High is unchanged and unaddressed — no code fix landed since synthesis-2 (only docs commits); round 3 independently re-verified it from backend source and now agrees the severity is High. A fix + re-gate is required before merge.

## Agreed Findings

- **[High — confirmed, severity now agreed] Scored market-research `LeadsTable` rows render "—" for Title/Seniority.** `LeadMarketScoreRow` (`backend/app/models/market_scoring.py`) declares `lead_name`/`company_name` but no `title`/`seniority` and no `extra="allow"`; with `response_model=LeadMarketScoresResponse` → `rows: List[LeadMarketScoreRow]` (`routers/market_scoring.py:21`), FastAPI deterministically strips those keys from `POST /leads/market-scores`. `apiHeatmapLeads` is built purely from those rows (`LeadsTable.tsx:434-437` → `heatmapLeadFromUnknownRow` → `resolveLeadFields` → `title:null, seniority:null`), and the wholesale byId merge (`LeadsTable.tsx:567-570`) overwrites the enriched `/v2/leads` real row → "—" for every scored lead (the surface's primary case). The round-2 mapper migration is inert in production; both round-2 tests are false-green (they fabricate the stripped keys). **Fix (FE-only, backend out of plan-42 scope):** make the byId merge lossless — keep the scored row's scoring fields (`ratings`/`totalScore`/`priority`/`scored`) but carry over the real row's `title`/`seniority` (and prefer its non-empty `name`/`company`) wherever the scored row's are empty; replace the regression fixture with a real `LeadMarketScoreRow` shape (**no** `title`/`seniority` keys) driven through the actual `fetch → heatmapLeadFromUnknownRow → merge` path, asserting the real-row prospect values survive so the test can fail if the merge regresses. Keep the round-2 migration (`0e91f5f`/`d84d58d`) — it is the necessary precondition the lossless merge pulls `title`/`seniority` from via the real-row path.

## Disagreed Findings

(none — the finding is correct and now independently re-verified by the reviewer; it matches synthesis-2's code-grounded verification on unchanged code.)

## Deferred Findings

(none)

## Severity Disagreements

(none this round — the round-2 Low↔High disagreement is resolved: the reviewer self-corrected to High, matching synthesis-2. No standing severity disagreement.)

## Open Questions

- This round **ratifies synthesis-2 on unchanged code** rather than reviewing new work — three reviews now converge on the same verified High. The outstanding action is the round-3 **fix**, not a further review; implement it, then re-gate (vitest incl. the real-`LeadMarketScoreRow`-shape test + e2e) before any merge.
- The reviewer's note that the round-2 migration is a necessary precondition is correct: the lossless merge sources `title`/`seniority` from the real-row path (`heatmapLeadFromV2Lead` → `resolveLeadFields`), so `0e91f5f`/`d84d58d` must **not** be reverted.
