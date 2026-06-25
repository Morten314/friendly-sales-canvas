---
artifact: specs/42-matched-leads-prospect-fields-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-24
round: 1
---

## Context

Review was performed against the code at `master` HEAD (the spec's cited grounding commit `f49e618`). I spot-verified the spec's load-bearing grounding claims against the actual files rather than trusting them at face value:

- `backend/app/services/signals/lead_map.py` — confirmed: `_leads_for_prompt` projects to `{lead_id, company, industry, region}` only; `_parse_mapping` rebuilds `{lead_id, company, relevance, why}`; the full lead dicts are held in `leads` (L218–219) and remain in scope through the cache-hit early return (L228–231); the `/signal-lead-map_claude` route has no `response_model`. All as the spec states.
- `frontend/src/features/signals/contracts.ts` — confirmed `SignalLeadMapLeadSchema = {lead_id, company, relevance, why}`, degrade-never-throw, no `.strict()`.
- `frontend/src/features/market-research/lib/marketScoresHeatmap.ts` — confirmed `pickFirstString` is **exact key membership** (`if (!(k in o))`) with hardcoded lower/camelCase keys, so the spec's "FE pickers would miss CSV TitleCase keys" diagnosis is correct.

The spec is unusually well-grounded; the findings below are mostly where its stated scoping decisions produce a visible inconsistency or omit a concrete edit site.

## Findings

### [High] Lead Stream will look broken on the primary CSV org: normalized matcher is applied to new title/seniority but deliberately withheld from the existing name/company pickers

**Location:** "Frontend — Lead Stream (separate FE-only path)", bullet on `marketScoresHeatmap.ts` — "The existing name / company pickers are left untouched (no behavior risk to current columns)."

The existing `pickCompanyName` / `pickLeadDisplayName` keys are hardcoded lower/camelCase (`company_name`, `contact_name`, `full_name`, `name`, …) and resolved via exact `k in o` membership. The CSV org that is the RCA's primary example (`b06907ac…`, 198 leads) stores `Company_Name`, `First_Name`, `Last_Name` (TitleCase underscore) — none of which match. So for that org the Lead Stream currently renders Company `—` and Name `—` (a latent gap), while the **new** normalized `pickTitle` / `pickSeniority` *will* resolve `Job_Title` / `Seniority_Level`. The net result post-feature is a row showing populated **Title** + **Seniority** but blank **Lead (name)** and **Company** — i.e. the feature looks broken on exactly the org that motivated it, and is also inconsistent with the Signals card (whose backend path normalizes company, so it shows company+name+title+seniority correctly).

The spec acknowledges this possibility only as a *conditional* future TD ("If implementation reveals … the CSV-key case-sensitivity also affects the existing name/company columns, capture that as TD", Dependencies & follow-ups). But the RCA §4 + §6 already document that it *does* affect those columns — so this is a known issue being deferred behind "if," not an unknown. The "no behavior risk to current columns" rationale is true in isolation (those columns don't change) but ignores the cross-column inconsistency it creates.

Recommendation: apply the same `pickNormalized` matcher to name/company resolution in `heatmapLeadFromV2Lead` (cheap, local, makes the two surfaces consistent, and actually fixes the primary org's Lead Stream). If that is genuinely out of scope, state the expected CSV-org Lead Stream appearance explicitly so reviewers don't read blank identity columns as a regression.

### [Medium] LeadsTable column-count edit sites are not enumerated; the component is also reused (not purely feature-local)

**Location:** "Frontend — Lead Stream", bullet on `LeadsTable.tsx` — "add Title and Seniority columns … Confirm this table is feature-local to lead-stream and not reused with a fixed column set elsewhere."

Two concrete gaps:

1. `LeadsTable.tsx` hardcodes the fixed-column count as the literal `REPORT_COLUMNS.length + 5` in **three** places (L786, L802, and the derived `colSpan` at L802/868). Adding two columns turns `+ 5` into `+ 7` everywhere; the spec's "add columns" description doesn't surface these, so a plan derived literally from it would leave `colSpan` mismatched (broken empty/loading-state rows). Worth naming the three literals.
2. The "feature-local" check is presented as unresolved, but the answer is already in the tree: `LeadsTable` is rendered by `ScoutLeadStream.tsx` (L6/L54), so adding columns changes *both* the market-research and Scout lead-stream surfaces. That's almost certainly desirable (consistency), but the spec should state the two consumers explicitly rather than leave it as a verification TBD.

### [Low] Surfacing names persists PII into the saved artefact store, not only ephemeral display

**Location:** "Frontend — Signals card + Artifact PDF" (`signalBriefing.ts`) + Out-of-scope PII bullet.

The spec correctly excludes email/phone/LinkedIn and references Spec 38's PII guardrail / anonymized golden fixtures. But names (First/Last) are themselves PII, and `buildSignalBriefingArtefact` feeds a *persisted* artefact-library item — so this change introduces contact names into stored artefacts, not just an on-screen render. The spec frames the field set as a display decision ("No email / phone / LinkedIn on screen or in the PDF") without noting the persistence dimension. Not blocking (Spec 38 sets the retention precedent for the artefact store), but worth an explicit one-liner acknowledging that the name now lives in the artefact store so it isn't discovered as a surprise during impl review.

### [Nit] `level` is an overly generic seniority alias

**Location:** "Canonical fields + alias map" table — `seniority` aliases include `level`.

`_first_alias` iterates the tuple in order and `level` is last, so collision risk is low, but `level` is generic enough to plausibly match an unrelated Lead-node property on some future CSV (e.g. a `Level` column). The other aliases (`senioritylevel`, `seniority`, `joblevel`) are sufficient and specific. Suggest dropping `level`, or noting the collision acceptance if it's intentional.

## Observations (no action)

- The "no extra LLM cost" claim is verified: the prompt and `_leads_for_prompt` are untouched; enrichment is a post-parse dict re-join. Negligible perf cost (O(≤100 leads × ≤50 signals) dict build + lookups).
- The cache design reasoning is sound and correctly stated: storing the narrow mapping and enriching at response-build time means a stale cache never has a shape problem and the response always reflects current lead data (enrichment reads freshly-fetched `leads`). The cache-hit-path "Implementation check" (leads in scope) is accurate against the code.
- The spec correctly corrects the RCA's `MatchedLead` misnaming — that model is Spec 41's recommendation-artefact, unrelated to this endpoint; the real contract is the untyped `_build_result` dict + the FE Zod schema. Good catch.
- Non-ASCII contact-name mojibake is appropriately deferred to the existing Spec 38 shared-generator TD rather than re-scoped here.
- Plan-readiness is strong: the work decomposes cleanly into ordered, independently testable BE (aliases + `_resolve_contact_name` + `_enrich_matched_leads` + orchestration wiring on both cache paths) and FE (contracts → SignalCard → signalBriefing → HeatmapLead → pickers → LeadsTable) tasks with named test assertions per task.
