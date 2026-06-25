---
synthesizes_review: docs/reviews/worktree-matched-leads-prospect-fields-impl-review-2-glm-5.2.md
artifact: worktree-matched-leads-prospect-fields
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-25
round: 2
---

## Round Recommendation

yes

Reason: A confirmed High remains — scored market-research rows provably lack `title`/`seniority` (the typed `response_model` strips them), so the wholesale byId merge renders "—" for the table's main case; the round-2 fix is inert in production and its two tests are false-green.

## Agreed Findings

- **[HIGH — verified] Scored market-research rows drop Title/Seniority through the byId merge.** On the market-research `LeadsTable`, the "scored" array (`apiHeatmapLeads`) is built *purely* from `POST /leads/market-scores` response rows (`LeadsTable.tsx:433-437` → `heatmapLeadFromUnknownRow`), and those rows carry no `title`/`seniority`. The merge (`LeadsTable.tsx:567-570`) overwrites the enriched real row (`heatmapLeadFromV2Lead`, which *does* carry them) wholesale by `lead_id`, so Title/Seniority render "—" for every scored lead. **Fix:** make the merge lossless — when a scored row overwrites a real row by id, preserve the real row's `title`/`seniority` (and prefer its non-empty `name`/`company`) wherever the scored row's are empty, while keeping the scored row's scoring fields (`ratings`/`totalScore`/`priority`/`scored`). **Plus** add a regression test that drives a `LeadMarketScoreRow`-shaped row **without** `title`/`seniority` keys through the real `fetch → heatmapLeadFromUnknownRow → merge` path and asserts the enriched real-row values survive (the existing tests fabricate the stripped keys, so they cannot catch this).

## Disagreed Findings

(none on substance — the finding is correct, and verified more strongly than the review could establish: the review's own "indirect evidence is favorable" basis is refuted by the typed response model, which proves the fields are absent rather than present.)

## Deferred Findings

(none)

## Severity Disagreements

- **Reviewer rated [Low]; I rate it [High].** The reviewer hedged to Low on "the indirect evidence is favorable" *because they could not verify the live `/leads/market-scores` shape*. That shape is verifiable from code and is **unfavorable**: the endpoint declares `response_model=LeadMarketScoresResponse` with `rows: List[LeadMarketScoreRow]` (`backend/app/models/market_scoring.py:21-45`), and `LeadMarketScoreRow` has `company_name` + `lead_name` but **no `title`/`seniority`** and no key matching the FE `TITLE_ALIASES`/`SENIORITY_ALIASES`. FastAPI strips undeclared keys, so `resolveLeadFields(row)` returns `title:"" , seniority:""` → `null` for every scored row, deterministically. This is the *same* defect round 1 rated High, merely relocated (the mapper was migrated, but its input provably lacks the fields); it is the **primary** case of this surface (scored leads are the whole point of the market-scores heatmap); and both round-2 tests are **false-green** — the unit fixture `SCORED_API_RESPONSE` and the merge-path render test inject `title`/`seniority` keys that the live `response_model` strips, so neither can fail on the real shape. Not Critical: display-only, `name`/`company` still resolve (`lead_name`/`company_name` are in the model), no data loss, 0 users.

## Open Questions

- **Scope is isolated (verified, no action):** the gap exists only on the market-research `LeadsTable` merge. The customers `LeadStream` has a single source (`mapRawLead`, no scored-overwrite) and the signals card/PDF builders each have a single source — none has the merge hazard. Consistent with the round-1 observations.
- **Remedy (a) is documentation-only here.** The review offered (a) live-probe the endpoint OR (b) harden the merge. A probe would *confirm* the fields are absent, so it cannot substitute for (b). No backend change is warranted: plan 42 deliberately scoped the market-research surface to FE-only enrichment from `/v2/leads`; adding `title`/`seniority` to the scoring response would be out-of-scope (a second BE change + re-scoring). The FE lossless merge is the correct, in-scope fix.
