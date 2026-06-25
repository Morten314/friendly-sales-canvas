---
artifact: worktree-matched-leads-prospect-fields
artifact_type: impl
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-25
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Change-context source: `git log -p master..worktree-matched-leads-prospect-fields` (full per-commit patches + commit messages; combined patch ~190 KB, under the 200 KB budget — **0 commit bodies dropped**). 15 commits; spec 42 and plan 42 were loaded from the worktree paths provided by the operator. Config files loaded from the branch via `git show`: `frontend/package.json` (engines `node >=21.2.0`, full preflight script incl. `knip --strict`), `frontend/tsconfig.json`. `backend/pyproject.toml` is absent on the branch (no BE linter/typecheck config — backend verified via pytest only).

Implementation tracking is tight: the 9-task plan maps 1:1 onto commits, each with its own test module. Backend (Task 1) and the customers surface (Tasks 8–9) are implemented exactly as specified and are well-covered. The signals card/PDF (Tasks 3–5) are implemented with one sensible improvement over the plan (see Observations). The one substantive gap is on the market-research Lead Stream (Tasks 6–7).

## Findings

### [High] Scored leads in the market-research LeadsTable bypass enrichment — Title/Seniority render "—" and the CSV alias fix doesn't apply

**Location:** `frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx:563-571` (merge), fed by `heatmapLeadFromUnknownRow` at `LeadsTable.tsx:435`; unmigrated mapper at `frontend/src/features/market-research/lib/marketScoresHeatmap.ts:183-189`.

`LeadsTable` builds its rendered rows from **two** raw-row mappers that both produce `HeatmapLead`:

- `heatmapLeadFromV2Lead` (Task 6 — migrated to `resolveLeadFields`, now sets `title`/`seniority` and resolves CSV TitleCase name/company), called from `services/orgLeads.ts:38` → stored in `realLeads`.
- `heatmapLeadFromUnknownRow` (Task 6 left untouched — still uses `pickCompanyName`/`pickLeadDisplayName`, sets **neither** `title` nor `seniority`), called at `LeadsTable.tsx:435` from the market-scores endpoint → stored in `apiHeatmapLeads`.

The merge then lets scored rows **overwrite** real rows by id:

```ts
const byId = new Map<string, HeatmapLead>();
for (const lead of real) byId.set(lead.id, lead);     // enriched
for (const lead of scored) byId.set(lead.id, lead);   // NOT enriched — wins
```

Consequence: for **any lead that has a market score** (the dominant case on the market-research Lead Stream — scoring is the surface's purpose), the rendered row is the unmigrated `heatmapLeadFromUnknownRow` output. Task 7's new `<TableCell>{lead.title || "—"}</TableCell>` / `{lead.seniority || "—"}` cells therefore render **`—` for every scored lead**, regardless of whether the data is present. The same path also keeps the pre-existing `pickLeadDisplayName`/`pickCompanyName` exact-match pickers, so the CSV-TitleCase blank-Name/Company fix (the spec's review-F1 fix, the headline bug this feature exists to resolve) does **not** reach scored rows on this surface either.

The added test (`marketScoresHeatmap.prospect.test.ts`) only exercises `heatmapLeadFromV2Lead`, so this path is untested and the gap is invisible to the suite.

This is the central value of the market-research surface (Task 7's columns) not functioning for the common case. The plan scoped Task 6's edit to `heatmapLeadFromV2Lead` by name and assumed `pickCompanyName`/`pickLeadDisplayName` "become unused — delete them" — that assumption was wrong because `heatmapLeadFromUnknownRow` still calls them (which is why the implementer correctly kept them; that part is right). The fix is to migrate `heatmapLeadFromUnknownRow` to `resolveLeadFields` identically to `heatmapLeadFromV2Lead` (it builds the same `HeatmapLead` shape and already shares the lead-id/`MarketScoresApiRow` construction), so both feed paths carry `title`/`seniority` and the alias fix. Worth a regression test that renders a scored row through `LeadsTable` and asserts the Title/Seniority cells populate.

### [Low] Missing abort/kill-criteria coverage for the merge-path gap

**Location:** `plans/42-matched-leads-prospect-fields.md:24` (abort triggers), `frontend/src/features/market-research/lib/marketScoresHeatmap.ts:183`.

The plan's abort-trigger (b) covers "deleting `pickCompanyName`/`pickLeadDisplayName` surfaces a live caller" — which would have caught the existence of `heatmapLeadFromUnknownRow` as a *second* caller. The implementer hit exactly that (a live caller exists) but resolved it by *not* deleting rather than by escalating, leaving the second mapper unmigrated. This is Low under the default report-and-wait calibration (the work is bound to `subagent-driven-development`), surfaced here so the synthesis step can decide whether migrating `heatmapLeadFromUnknownRow` is in- or out-of-scope for round 2.

## Observations (no action)

- **SignalCard secondary-line is an improvement over the plan.** The plan's spec text put `[title, seniority, company]` in the secondary line unconditionally, which would duplicate `company` when it is already the primary line (name-less lead). The implementation guards it — `lead.name ? lead.company : null` — so company appears in the secondary line only when a name is the primary. The Task 4 test (`/VP Engineering · CXO · Acme/`) still passes, and name-less leads no longer show the company twice. Good deviation; no change needed.
- **`formatLeadFinding` correctly unifies both PDF builders** (`buildSignalBriefingArtefact` + `buildRecommendationPlaybookArtefact`) and preserves byte-identical output for prospect-less leads (`"Company (Relevance: X)[: why]"`), matching the round-1 review F1/F2 intent. Verified against the appended test expectations.
- **Backend is clean and faithful:** `_enrich_matched_leads` is pure (returns a new structure; the cache-miss test asserts the cached shape stays narrow — `name`/`title`/`seniority` absent), enrichment is wired on **both** the cache-hit and cache-miss return paths, `leads_by_id` is built before the cache check (so it is in scope on the hit path), and the prompt / `_leads_for_prompt` are untouched. The existing `test_leads_for_prompt_resolves_*` suite is preserved. Backend test coverage (alias composition, CSV+Apollo+missing, purity, cache-hit enrichment, narrow cache-miss write) is thorough.
- **Customers surface is fully migrated** with no merge-path analogue: `LeadStreamPanel` renders a single source (`useLeads` → `mapRawLead`), now via `resolveLeadFields`, with the `colSpan` 4→6 widening. No overwrite hazard there.
- **Minor FE/BE divergence (cosmetic):** the FE `normalizeLeadKeys` trims values (`String(v).trim()`) while the backend `_normalize_lead_keys` does not; both pick the first non-empty value, so behavior is equivalent. Noting only for completeness.
