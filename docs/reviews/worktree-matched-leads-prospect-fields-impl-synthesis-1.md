---
synthesizes_review: docs/reviews/worktree-matched-leads-prospect-fields-impl-review-1-glm-5.2.md
artifact: worktree-matched-leads-prospect-fields
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-25
round: 1
---

## Round Recommendation

yes

Reason: One real **High** remains — scored rows on the market-research Lead Stream bypass enrichment (Title/Seniority always render "—" and the CSV alias fix never reaches them). The fix (migrate `heatmapLeadFromUnknownRow` + a merge-path regression test) is substantive and warrants a round-2 verify. The branch is **not** merge-ready until it lands.

## Agreed Findings

- **[High] Scored market-research rows bypass enrichment — Title/Seniority always "—", CSV alias fix missed.** Verified against the branch (not just the review): `LeadsTable.tsx:567-570` builds the displayed rows as a `byId` map that sets `real` (enriched, from `fetchAllOrgLeads` → `heatmapLeadFromV2Lead`) **then** `scored` (`apiHeatmapLeads`), so scored rows **overwrite** enriched rows of the same `lead_id`. `apiHeatmapLeads` is produced at `LeadsTable.tsx:434-437` via `heatmapLeadFromUnknownRow`, which (`marketScoresHeatmap.ts:183-220+`) still uses the exact-match `pickCompanyName`/`pickLeadDisplayName` pickers and builds a `MarketScoresApiRow` that carries no `title`/`seniority` (and `mapMarketScoresRowToHeatmapLead`, 96-118, never sets them). Net: for any lead present in the market-scores response — the dominant case on this surface — Task 7's new `{lead.title || "—"}` / `{lead.seniority || "—"}` cells render "—" regardless of the data, and the CSV-TitleCase blank-Name/Company fix (the feature's headline bug) does not reach scored rows. The added `marketScoresHeatmap.prospect.test.ts` only exercises `heatmapLeadFromV2Lead`, and the `LeadsTable.columns` test renders only the empty state, so the suite never touched the merge path — which is why both the per-task and the whole-branch reviews missed it. **This overturns my round-1 whole-branch "T6 is out-of-scope" call: `heatmapLeadFromUnknownRow` is NOT a separate surface — its output feeds the LeadsTable display and wins.** Fix: migrate `heatmapLeadFromUnknownRow` to `resolveLeadFields` the same way `heatmapLeadFromV2Lead` was (alias-aware name/company **and** set `title`/`seniority` on the returned `HeatmapLead`), so both feed paths enrich; add a regression test that renders a **scored** row through `LeadsTable` (mock `fetchAllOrgLeads` + the market-scores fetch) and asserts the Title/Seniority cells populate. The exact-match pickers may then be removable if `heatmapLeadFromUnknownRow` is their last caller — re-check with `knip --strict`.

- **[Low] Abort-trigger (b) caught the live caller but the gap survived — fold into the High fix.** Agreed in substance. Plan abort-trigger (b) ("deleting `pickCompanyName`/`pickLeadDisplayName` surfaces a live caller") did fire — the implementer correctly found `heatmapLeadFromUnknownRow` still calls them and correctly did **not** delete them — but the right response was to also migrate that second mapper (or escalate the scope question), not just to keep the pickers. **Scope decision (this synthesis): migrating `heatmapLeadFromUnknownRow` IS in scope for round 2** — it is required to make Task 7 functional for scored leads, so this Low is resolved by the same fix as the High. No separate action.

## Disagreed Findings

- None. Both findings hold under code verification.

## Deferred Findings

- None. The High is on the feature's own deliverable surface and is not deferrable — it must be fixed before merge (the market-research Title/Seniority columns are non-functional for the common case without it).

## Severity Disagreements

- None. High is correct for the scored-rows finding: Task 7's columns — a stated deliverable — are non-functional for the surface's primary case, and the headline CSV alias fix is absent there. (MVP/0-user posture would argue Medium for a display-only gap, but the gap defeats the feature's purpose on that surface, so High stands.) Low is correct for the abort-trigger observation.

## Open Questions

- **Fix-mechanics note for round 2 (non-blocking):** `heatmapLeadFromUnknownRow` returns through the `MarketScoresApiRow` → `mapMarketScoresRowToHeatmapLead` shape, which has no `title`/`seniority` slots; the migration must set those on the returned `HeatmapLead` directly (e.g. spread + `title`/`seniority`) rather than only swapping in `resolveLeadFields` for name/company. The scoring fields (`ratings`/`totalScore`/`priority`/`scored`) must stay untouched — additive change, low risk, covered by the existing `marketScoresHeatmap` tests plus the new scored-row LeadsTable regression test.
- **Reviewer Observations (no action) — all confirmed against code:** SignalCard secondary-line guard (`lead.name ? lead.company : null`) is the right improvement; `formatLeadFinding` unifies both PDF builders with byte-identical prospect-less output; backend `_enrich_matched_leads` is pure, dual-path, cache-narrow, prompt untouched; the Customers surface is single-source (`useLeads → mapRawLead`) so it has no merge-overwrite analogue. The FE-trims-vs-BE-doesn't divergence in `normalizeLeadKeys` is behavior-equivalent (both take first non-empty) — leave as-is.
