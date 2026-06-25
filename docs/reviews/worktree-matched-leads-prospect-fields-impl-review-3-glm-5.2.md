---
artifact: worktree-matched-leads-prospect-fields
artifact_type: impl
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-25
round: 3
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Change-context source: `git log -p master..worktree-matched-leads-prospect-fields`. Round 3, invoked after `…-impl-synthesis-2.md` (round:2) recommended `yes`. Spec 42 / plan 42 loaded from the worktree paths. Config loaded from the branch: `frontend/package.json`, `frontend/tsconfig.json`; `backend/pyproject.toml` absent.

Procedural note: my round-2 review rated this defect **Low** on the basis that "the indirect evidence is favorable" (I could not verify the live `/leads/market-scores` shape and chose not to speculate above Low). Synthesis-2 refuted that hedge with a code-grounded verification and escalated to High. This round I independently verified the root cause from the backend source rather than trusting the synthesis — see the finding. Self-correction: the round-2 Low under-rated a defect whose determining fact (the response shape) was statically knowable; I should have read the response model instead of treating it as an unverifiable assumption.

Between the round-2 docs commit (`f5b407d`) and this review's HEAD (`5536d2a`), **only the round-2 review + synthesis docs landed — no code fix**. So the synthesis-2 High is unaddressed as of this review.

## Findings

### [High] Scored market-research leads still render "—" for Title/Seniority — the byId merge discards the enriched real row, and the round-2 mapper migration is inert because the response model strips those fields

**Location:** merge at `frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx:563-571`; root cause `backend/app/models/market_scoring.py:18-37` + route `backend/app/routers/market_scoring.py:21`; inert fix at `frontend/src/features/market-research/lib/marketScoresHeatmap.ts:120-174`; false-green tests at `frontend/src/features/market-research/lib/__tests__/marketScoresHeatmap.prospect.test.ts:42-` and `frontend/src/features/market-research/components/lead-stream/__tests__/LeadsTable.realLeads.test.tsx:143-160`.

Independently verified this round (not deferred to the synthesis):

- `LeadMarketScoreRow` (`backend/app/models/market_scoring.py:18-37`) declares only `lead_name` and `company_name` among identity fields — there is no `title`/`seniority` field and no field normalizing to any key in the FE `TITLE_ALIASES`/`SENIORITY_ALIASES`. The model does not opt into `extra="allow"`, so Pydantic excludes undeclared keys.
- The route declares `response_model=LeadMarketScoresResponse` (`backend/app/routers/market_scoring.py:21`), and `LeadMarketScoresResponse.rows: List[LeadMarketScoreRow]`. FastAPI filters the serialized output to the declared model, so `POST /leads/market-scores` **deterministically** returns rows without `title`/`seniority`.
- The merge (`LeadsTable.tsx:567-570`) is still wholesale — `byId.set(real)` then `byId.set(scored)`; the scored row wins by `lead_id`. `apiHeatmapLeads` is built purely from those market-scores rows (`LeadsTable.tsx:434-437` → `heatmapLeadFromUnknownRow`), so every scored row carries `title: null, seniority: null`. It overwrites the real `/v2/leads` row (built via `heatmapLeadFromV2Lead`, which **does** resolve `title`/`seniority`). Net: Task 7's `{lead.title || "—"}` / `{lead.seniority || "—"}` cells render "—" for every scored lead — the surface's primary case.

The round-2 migration of `heatmapLeadFromUnknownRow` to `resolveLeadFields` is therefore inert in production: `resolveLeadFields(row)` returns `title:"" , seniority:""` because the keys were stripped server-side, regardless of how correct the resolver is. The two round-2 tests are **false-green** — `SCORED_API_RESPONSE` and the merge-path render test fabricate `title`/`seniority` keys that the live `response_model` cannot emit, so neither can fail on the real shape.

`name`/`company` are unaffected: `lead_name`/`company_name` resolve via the alias map, so those columns populate normally; the gap is strictly Title/Seniority. Not Critical: display-only, no data loss, 0 users.

Fix (in-scope, FE-only, per synthesis-2's scope analysis — a backend change is deliberately out of plan 42): make the merge lossless — when a scored row overwrites a real row by id, carry over the real row's `title`/`seniority` (and prefer the real row's non-empty `name`/`company`) wherever the scored row's are empty, while keeping the scored row's scoring fields (`ratings`/`totalScore`/`priority`/`scored`). Replace the regression fixture with one shaped like the real `LeadMarketScoreRow` (**no** `title`/`seniority` keys) driven through the actual `fetch → heatmapLeadFromUnknownRow → merge` path, asserting the real-row prospect values survive — so the test can actually fail if the merge regresses.

## Observations (no action)

- **Scope is genuinely isolated.** Re-confirmed the merge hazard exists only on the market-research `LeadsTable`. The customers `LeadStream` is single-source (`mapRawLead`, no scored overwrite) and the signals card/PDF builders each have a single lead source — none has the overwrite problem.
- **The round-2 migration is not wasted.** `heatmapLeadFromV2Lead` (the real-row path) legitimately needed `resolveLeadFields` to resolve CSV-TitleCase prospect fields, and that path is what the lossless merge will pull `title`/`seniority` from. The migration is a necessary precondition; it is just insufficient on its own.
- **Backend, signals, and customers paths remain faithful** to spec/plan 42 (re-affirmed, not re-litigated): `_enrich_matched_leads` pure/dual-path/cache-narrow; `formatLeadFinding` unifies both PDF builders; customers `mapRawLead` single-source. No new issues there this round.
