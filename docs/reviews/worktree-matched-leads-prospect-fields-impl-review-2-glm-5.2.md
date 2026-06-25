---
artifact: worktree-matched-leads-prospect-fields
artifact_type: impl
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-25
round: 2
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Change-context source: `git log -p master..worktree-matched-leads-prospect-fields` (full per-commit patches + commit messages; ~205 KB across 15 commits — under the 200 KB guidance by a hair, **0 commit bodies dropped**). This is round 2, invoked after `…-impl-synthesis-1.md` (round:1) recommended `yes` and three fix commits landed on top of the original 9 tasks: `0e91f5f` (migrate `heatmapLeadFromUnknownRow`), `cf0a0bb` (test-comment clarify), `d84d58d` (nested-company parity in `resolveLeadFields`). Spec 42 and plan 42 loaded from the worktree paths. Config loaded from the branch via `git show`: `frontend/package.json` (engines `node >=21.2.0`, preflight incl. `knip --strict`), `frontend/tsconfig.json`. `backend/pyproject.toml` absent (BE verified via pytest only).

Round-1 focus was verifying the round-1 High (scored market-research rows bypassed enrichment). This round also re-ran full coverage on the unchanged paths (backend, signals card/PDF, customers) — they remain faithful to spec/plan and are not re-litigated below.

## Findings

### [Low] The High fix's correctness rests on an unverified assumption about the `/leads/market-scores` response shape

**Location:** `frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx:563-571` (merge), `frontend/src/features/market-research/lib/marketScoresHeatmap.ts:120-174` (`heatmapLeadFromUnknownRow`), test fixture at `frontend/src/features/market-research/components/lead-stream/__tests__/LeadsTable.realLeads.test.tsx:143-160` (`SCORED_API_RESPONSE`).

The round-1 fix is implemented correctly and is well-covered in isolation: `heatmapLeadFromUnknownRow` now calls `resolveLeadFields` and sets `title`/`seniority` on the returned `HeatmapLead` (`…return { …mapped, name, company, title: fields.title || null, seniority: fields.seniority || null }`), with unit tests asserting CSV/Apollo/absent/score-preservation, and a `LeadsTable` merge-path render test asserting the Title/Seniority cells populate for a scored row. The dead `pickFirstString`/`pickCompanyName`/`pickLeadDisplayName` helpers were removed with no dangling references (verified repo-wide).

However, the fix only enriches scored rows **if the market-scores payload actually carries the prospect keys**. The merge still replaces the real `/v2/leads` row wholesale with the scored row (`byId.set(real)` then `byId.set(scored)` — scored wins by `lead_id`), so if a scored response row omits `name`/`title`/`seniority` (e.g. the scoring endpoint projects only score fields), the enriched real row is discarded and the cells render "—" — the exact symptom round-1 set out to fix. Neither the round-1 review nor this implementation verified the live `/leads/market-scores` JSON shape; both the unit tests and the render test use hand-authored fixtures (`SCORED_API_RESPONSE` includes the prospect fields by construction, so they cannot falsify the assumption). The spec/plan's grounding context establishes prospect fields are populated on the Lead *nodes* and that normalization returns every property verbatim, which is a strong indirect argument the rows carry them — but it is an inference, not a confirmed observation, and AGENTS.md is explicit that endpoint response shapes must be verified with a live call rather than inferred (no OpenAPI client; several routers lack `response_model`).

Recommendation: confirm the live `POST /leads/market-scores` response rows include `name`/`title`/`seniority` (or the CSV/Apollo aliases) via `/docs` or `curl`, OR harden the merge to be lossless — prefer the real row's non-empty `title`/`seniority`/`name` when the scored row's are absent (field-by-field merge rather than whole-object overwrite). Either removes the load-bearing assumption. This is Low because the indirect evidence is favorable, the change is display-only on a 0-user MVP, and the whole-object overwrite is a pre-existing pattern (it carried the same risk for `name`/`company` before this feature) — not a regression.

## Observations (no action)

- **Round-1 High fully resolved.** `heatmapLeadFromUnknownRow` migrated to `resolveLeadFields` with `title`/`seniority` set additively (scoring fields untouched); both feed paths into `LeadsTable` now enrich, so the scored-overwrites-real merge no longer drops prospect fields. Coverage is appropriate: mapper behavior unit-tested in `marketScoresHeatmap.prospect.test.ts` (a dedicated `heatmapLeadFromUnknownRow — prospect fields (scored path)` block), merge+render covered by the new `LeadsTable scored-row merge-path (Fix R2)` test. The Low from round 1 (abort-trigger (b) left the gap surviving) is folded into this fix and resolved.
- **Nested-company parity restored (`d84d58d`).** The original `pickCompanyName` handled `{ company: { name: "Acme" } }`; the first `resolveLeadFields` draft did not, so `resolveNestedCompany` was added to avoid stringifying to `"[object Object]"`. It is correctly guarded (`rawCompany === "[object Object]" || rawCompany === ""`), tested for the nested case, flat-string case, name-no-leak, and the never-`"[object Object]"` guarantee. Good parity restoration, not overengineering.
- **Test split is sound.** The merge-path test injects a *pre-mapped* `HeatmapLead` via the session cache rather than driving the raw market-scores fetch → `heatmapLeadFromUnknownRow` → merge pipeline end-to-end (documented in the test header). The mapper's raw→fields conversion is covered separately, so the two together close the gap. The unused `fetch` stub in that test is documented as vestigial (LeadsTable fetches on Refresh, not mount) — harmless.
- **Unchanged paths still clean (spot-checked, not re-litigated):** backend `_enrich_matched_leads` (pure, dual-path, cache-narrow, prompt untouched, 6 new tests); signals `SignalCard` secondary-line guard (`lead.name ? lead.company : null`); `formatLeadFinding` unifying both PDF builders with byte-identical prospect-less output; customers `mapRawLead` single-source (no merge-overwrite analogue). All faithful to spec/plan 42.
