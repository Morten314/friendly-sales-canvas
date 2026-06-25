# Matched-Leads Prospect Fields: surface name / title / seniority — Design Spec

**Date:** 2026-06-25
**Spec:** 42 (pairs with `plans/42-matched-leads-prospect-fields.md`)
**Branch:** `worktree-matched-leads-prospect-fields`
**Status:** Reviewed round 1 (`docs/reviews/42-matched-leads-prospect-fields-design-spec-review-1-glm-5.2.md`) — revised; synthesis at `…-synthesis-1.md`. Scope decision (user, 2026-06-25): the Customers Lead Stream surface is **folded in**. Proceeding to plan.
**Scope:** Backend (`backend/app/services/signals/lead_map.py`) + Frontend (`frontend/src/features/signals`, `frontend/src/features/market-research`, `frontend/src/features/customers`, `frontend/src/shared/lib`)

> Builds directly on the RCA at `docs/reviews/matched-leads-prospect-fields-rca-2026-06-24.md` (root cause confirmed in code + live probe). This spec is the resolution of that RCA's "Option A" path, after the product decision in its §7.

---

## Problem

Clicking **"Find Matched Leads"** on a Signal card returns results, but each matched lead shows the **company name only** — no contact-level detail (name, designation/title, seniority). The same gap appears in the **"Save as Artifact"** PDF the card produces and in the **Lead Stream** tables (Scout / market-research, and the Customers view). A salesperson scanning matched leads cannot tell *who* to contact.

The prospect fields are present and fully populated in storage (live-verified: 198/198 on a CSV org, 172/172 on an Apollo org — RCA §4). They are discarded **in code**, not missing from the data.

## Goal

Surface each matched lead's **name, title, and seniority** in three places — the Signal card, the Save-as-Artifact PDF, and the Lead Stream columns — **without changing how matching works and with no extra LLM cost**.

---

## Decision (settled with the product owner, 2026-06-25)

- **Granularity — display-only ("Option A").** Surface individual prospects, but keep company/account-level *matching* exactly as-is. We do **not** widen the prompt or change which leads the LLM matches.
- **Field set — Name + Title + Seniority.** No email / phone / LinkedIn on screen or in the PDF.
- **Surfaces — both.** Signals matched-leads + Save-as-Artifact PDF (backend + FE) **and** the Lead Stream tables (FE-only — market-research/Scout *and* Customers, folded in per the 2026-06-25 scope decision).
- **Backend re-join placement — a separate post-parse step ("A2").** Enrich after `_parse_mapping` returns, leaving its validation / truncation-tolerance untouched.

---

## Context: what grounding confirmed (2026-06-25, at HEAD `f49e618`)

1. **No drift since the RCA.** Every touch-point file is exactly as the RCA described — `git log f49e618..HEAD` over `lead_map.py`, the prompt, the test file, and `app/models` is empty.

2. **The map result is per-contact, not per-company.** `lead_map.py::_parse_mapping` emits `{signal_id, headline, leads: [{lead_id, company, relevance, why}]}` — **one entry per matched `lead_id`**, and each lead *is* a person (`_leads_for_prompt` passes one row per lead with no per-company dedup). So the fix is to **enrich each existing row**, not to expand a company into contacts. This also explains the symptom precisely: when several contacts at one company match, the card today renders repeated identical "Company" rows.

3. **The full lead dicts are already in memory — re-join needs no extra fetch.** `build_signal_lead_map_claude` fetches all org leads via `leads_persistence.get_leads_for_org` → `normalization._process_neo4j_lead_records` (which returns **every** stored Lead-node property verbatim via `dict(lead_node.items())`), and holds them through the function (used for the cache fingerprint and the prompt). A `{lead_id → full_dict}` index is therefore free.

4. **There is no Pydantic response model to widen.** The `/signal-lead-map_claude` route has no `response_model=`; `_build_result` returns an untyped dict; the response shape is defined solely by `_parse_mapping`'s dict construction. (The `MatchedLead` model the RCA named at `app/models/signals.py` is **Spec 41's recommendation-artefact** model — unrelated to this endpoint.) The real contract is the FE Zod `SignalLeadMapResponseSchema`, which is degrade-never-throw (`.catch()` / `.default("")`), so adding optional fields is backward-compatible and safe.

5. **No canonical lead schema — fields must be resolved by alias.** CSV-uploaded leads use TitleCase_underscore headers (`First_Name`+`Last_Name`, `Job_Title`, `Seniority_Level`); Apollo leads use lowercase canonical keys (`name` / `first_name`+`last_name`, `title`, `seniority`). The backend already normalizes case + separators via `_normalize_lead_keys` / `_first_alias` (that is how `Company Name` / `Company_Name` / `organization` all resolve today). The two FE Lead Stream mappers, by contrast, are **exact-match** and miss CSV TitleCase keys — so they need a normalize-aware resolver for name/company **and** the new fields (both surfaces; see Frontend — Lead Stream).

---

## Canonical fields + alias map (single source of truth for both stacks)

| Canonical | CSV header | Apollo key | Normalized aliases to resolve (lowercased, separators stripped) |
|---|---|---|---|
| `name` | `First_Name` + `Last_Name` (compose) | `name`, or `first_name`+`last_name` | singles: `name`, `fullname`, `contactname`, `leadname`, `personname`, `contactfullname`. Else compose first+last — first: `firstname`, `givenname`, `fname`; last: `lastname`, `surname`, `familyname`, `lname` |
| `title` | `Job_Title` | `title` | `jobtitle`, `title`, `designation`, `position`, `jobrole` |
| `seniority` | `Seniority_Level` | `seniority` | `senioritylevel`, `seniority`, `joblevel` |

`_normalize_lead_keys` lowercases and strips `_`/spaces, so `Job_Title` → `jobtitle` matches the alias. **Missing → `""`** everywhere (degrade-never-throw).

---

## Backend design

File: `backend/app/services/signals/lead_map.py`. **The prompt (`prompts/signals/signals_lead_map.md.j2`) and `_leads_for_prompt` are UNCHANGED** — matching stays company-level, zero added tokens, and the existing `test_leads_for_prompt_resolves_*` tests stay green.

- **New alias tuples** beside `_COMPANY_ALIASES` / `_INDUSTRY_ALIASES` / `_REGION_ALIASES`: `_TITLE_ALIASES`, `_SENIORITY_ALIASES`, `_NAME_ALIASES`, `_FIRST_NAME_ALIASES`, `_LAST_NAME_ALIASES` (values per the table above).
- **`_resolve_contact_name(norm)`** helper: return the first single-field name alias; else join resolved first + last with a space; else `""`.
- **`_enrich_matched_leads(mapping, leads_by_id)`** helper: for each entry, for each lead in `entry["leads"]`, look up `leads_by_id[str(lead_id)]`, normalize once, and attach `name` / `title` / `seniority` (alias-resolved, default `""`). A lead_id not in the index (should not happen — already validated by `_parse_mapping`) leaves the three fields `""`. Never raises.
- In **`build_signal_lead_map_claude`**: build `leads_by_id = {str(l["lead_id"]): l for l in leads if l.get("lead_id")}`, then call `_enrich_matched_leads(mapping, leads_by_id)` **after** the mapping is obtained and **before** `_build_result`, on **both** the cache-hit and cache-miss paths, so the response always reflects current lead data.
- **Caching:** the cache continues to store the **narrow** LLM-derived mapping; enrichment is a deterministic presentation step applied at response-build time. This sidesteps any stale-cache-shape concern entirely.
  - *Implementation check:* confirm `leads` is in scope on the cache-**hit** path (it is fetched before the cache fingerprint, so the index is available). If a future refactor fetches leads only on miss, the fallback is enrich-before-cache + a cache-key version bump.
- **Resulting per-lead response shape:** `{lead_id, company, relevance, why, name, title, seniority}`.

## Frontend — Signals card + Artifact PDF

- **`frontend/src/features/signals/contracts.ts`** — `SignalLeadMapLeadSchema` gains `name`, `title`, `seniority` as `z.string().optional().default("")`. `SignalLeadMapLead` widens accordingly. Backward-compatible with a stale narrow response (defaults fill in).
- **`frontend/src/features/signals/components/SignalCard.tsx`** (matched-leads map block, ~L223–230) — each row becomes two lines, omitting empty parts and falling back to company when there is no name:
  - line 1: `name || company || "Unknown company"` + the existing relevance badge (badge logic unchanged).
  - line 2: `[title, seniority, company].filter(Boolean).join(" · ")`.
- **`frontend/src/features/signals/lib/signalBriefing.ts`** (`buildSignalBriefingArtefact`, `keyFindings` map) — each entry becomes a line built from non-empty parts, e.g. `"{name} — {title}, {seniority} ({company}) — Relevance: {High}: {why}"`, omitting empty segments and preserving the existing "omit `: {why}` when empty" behavior. The same `leads` array still feeds card + PDF, so `handleSaveAsArtefact` is structurally unchanged.
  - *PII note (review F3):* the contact **name** now rides into the downloaded PDF and the artefact-library item — i.e. it enters the **saved** briefing, not just the on-screen render. This follows Spec 38's precedent that briefings carry lead data; the no-email/phone field-set and the anonymized golden-fixture guardrail still apply, and the library itself stays non-durable per Spec 38.
- The per-lead `why` remains **PDF-only** (unchanged from Spec 38).

## Frontend — Lead Stream (FE-only; market-research/Scout + Customers)

Both Lead Stream surfaces read lead fields from `/api/v2/leads` independently today — the market-research mapper via exact-match pickers, the customers mapper via `??` chains — and **both miss CSV TitleCase keys**, so the RCA's primary CSV org renders **blank Name + Company** on both (RCA §4/§6; review F1). This section unifies field resolution behind one shared resolver and adds Title + Seniority to both tables. No backend change — `/v2/leads` already returns full records.

- **Shared resolver — `frontend/src/shared/lib/leadData.ts`** (where `HeatmapLead` lives): add `pickNormalized(raw, keys)` (lowercase + strip `_`/space on **both** the candidate keys and the object's keys; match by normalized **equality**, not substring — avoids spurious matches) and `resolveLeadFields(raw) → { name, company, title, seniority }` applying the canonical alias lists (the same concepts as the backend's `_normalize_lead_keys`, re-implemented in TS per the FE↔BE "implement twice" rule; composes `First_Name`+`Last_Name` when there is no single name field). This is the single FE source of truth for lead-field aliasing; both mappers below call it. This **fixes F1** (CSV blank Name/Company) on both surfaces, and Apollo lowercase keys still resolve (superset → no regression).
- **`HeatmapLead` type (`shared/lib/leadData.ts`)** — gains `title?: string | null; seniority?: string | null;` (`name` / `company` already present).
- **`frontend/src/features/market-research/lib/marketScoresHeatmap.ts`** — `heatmapLeadFromV2Lead` resolves **name / company / title / seniority** via the shared `resolveLeadFields` (replacing the local exact-match `pickCompanyName` / `pickLeadDisplayName`; `pickFirstString` may stay for any other caller). Sets the two new fields on the returned `HeatmapLead`.
- **`frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx`** — add **Title** and **Seniority** columns (header + cell) in order `Lead | Title | Seniority | Company | <score columns>`, rendering `—` when empty (matches the existing unscored `—` pattern).
  - **Column-count edit sites (review F2):** the empty/loading rows hardcode `REPORT_COLUMNS.length + 5` at **L786 and L802** (and L868 consumes the L802-derived `colSpan`). Adding two columns means `+ 5` → **`+ 7`** at both literal sites, or those state rows render with a mismatched `colSpan`.
  - **Consumers (review F2):** `LeadsTable` is **not** purely feature-local — it is rendered by `ScoutLeadStream.tsx` (L6/L54), so both the **market-research** and **Scout** Lead Stream surfaces gain the columns (intended; keeps them consistent).
- **`frontend/src/features/customers/contracts.ts`** — `CustomerLead` gains `title: string | null; seniority: string | null;`; `mapRawLead` resolves **name / company / title / seniority** via the shared `resolveLeadFields` (today it reads only `company_name`/`company` + `lead_name`/`name`, so CSV TitleCase leads show `—` here too — same F1 fix). `RawLeadSchema` already `.passthrough()`es, so the raw CSV/Apollo keys reach the resolver — no schema field additions needed.
- **`frontend/src/features/customers/components/lead-stream/LeadStream.tsx`** (`LeadStreamPanel`) — add **Title** + **Seniority** columns (`Name | Title | Seniority | Company | Source | Signals`), `—` when empty; update the expanded-signals row `colSpan={4}` → **`colSpan={6}`** (L151).

## Data flow

- **Signals:** backend enrich → wider JSON → Zod parse (new optional fields) → `useSignalLeadMap().leadsForSignal(id)` array → `SignalCard` render **and** `signalBriefing` PDF (one array, both gain the fields).
- **Lead Stream (both surfaces):** `/v2/leads` (already returns full records, no backend change) → shared `resolveLeadFields` → market-research `heatmapLeadFromV2Lead` → `HeatmapLead` (widened) → `LeadsTable` (+columns), **and** customers `mapRawLead` → `CustomerLead` (widened) → `LeadStreamPanel` (+columns).

## Error handling / degradation

- Backend enrichment never throws; unresolved fields → `""`.
- FE contract `optional().default("")` → a stale narrow backend response (e.g. an un-enriched cache entry observed mid-deploy) parses cleanly and renders blank prospect fields (calm degrade, never an error).
- Lead Stream renders `—` for missing title/seniority, consistent with unscored rows.

---

## Testing

**Backend** (`backend/tests/unit/test_signal_lead_map.py`):
- `_resolve_contact_name`: CSV `First_Name`+`Last_Name` composes; single `name` field; missing → `""`.
- `_enrich_matched_leads`: a CSV lead (`Job_Title` / `Seniority_Level` / `First_Name`+`Last_Name`) **and** an Apollo lead (`title` / `seniority` / `name`) both yield populated `name` / `title` / `seniority`; a lead with none → all `""`.
- Extend an orchestration test (e.g. `test_build_map_cache_miss_computes_and_writes`) so the input leads carry prospect fields and the test asserts they ride through into `entry["leads"][0]`.
- Add a **cache-hit** assertion: a cached narrow mapping still returns **enriched** leads (enrichment runs on the hit path too).
- Existing `_leads_for_prompt_resolves_*` tests unchanged + green (prompt projection untouched).

**Frontend** (Vitest):
- `marketScoresHeatmap`: the new normalized picker resolves title + seniority from CSV (`Job_Title` / `Seniority_Level`) **and** Apollo (`title` / `seniority`); missing → empty (renders `—`). **And** (review F1) `pickCompanyName` / `pickLeadDisplayName` now resolve **both** CSV TitleCase (`Company_Name` / `First_Name`+`Last_Name`) **and** Apollo lowercase (`company_name` / `name`) — guarding the fix and its no-regression-for-Apollo guarantee.
- `contracts`: the widened schema defaults the three new fields to `""` when absent and carries them when present.
- `SignalCard`: a lead with name/title/seniority renders two lines (name primary; `title · seniority · company` secondary); a lead with only company falls back to company as the primary line; relevance badge unchanged.
- `signalBriefing`: a `keyFindings` line includes name/title/seniority when present, omits empty segments, and keeps the existing omit-empty-`why` behavior.
- `LeadsTable`: Title / Seniority columns render values, and `—` when empty.
- Shared `resolveLeadFields` (`shared/lib/leadData.ts`): unit-tested for the alias map + `First_Name`+`Last_Name` composition + normalized **equality** (no spurious substring matches).
- `customers/contracts` (`mapRawLead`): resolves name/company/title/seniority for **both** CSV TitleCase (`Company_Name` / `First_Name`+`Last_Name` / `Job_Title` / `Seniority_Level`) **and** Apollo lowercase; missing → `—`/`null` (guards the F1 fix on the customers path too).
- `customers/.../LeadStream` (`LeadStreamPanel`): renders Title + Seniority columns; the expanded-signals row uses `colSpan={6}`.

**Gates:** `npm run preflight` (FE merge gate: typecheck, lint, format:check, vitest, build, bundle, Playwright/VR, knip). Backend: `backend/.venv/bin/python -m pytest backend/tests/unit/test_signal_lead_map.py -q`.

---

## Out of scope

- **Person-aware matching ("Option B").** The LLM still reasons at company/industry/region level; the prompt, `_leads_for_prompt`, and *which* leads match are unchanged.
- **Email / phone / LinkedIn** in the card or PDF (PII; excluded by the field-set decision). The Lead Stream keeps only its existing `email_status` badge.
- **Job_Function / "role" column** (declined in the field-set decision — coarse, and Apollo leads have no such field).
- **Expanding a matched company to its *unmatched* contacts** (would change result cardinality and matching semantics → Option B territory).
- **A Pydantic response model** for the endpoint (keep the existing untyped-dict pattern; the FE Zod contract is the guard).
- **Cleaning the stray `Unnamed: 22/23/24` CSV junk columns** at upload (RCA §4 hygiene note; separate concern).
- **Fixing non-ASCII contact names in the PDF.** Surfacing names makes the pre-existing PDF-generator limitation more visible: accented / non-Latin glyphs beyond Spec 38's common-punctuation ASCII fold still mojibake under `createSimplePDF` (Helvetica/WinAnsi). Spec 38's structural escaping + ASCII fold already apply to the new fields automatically (they ride into the same `keyFindings` strings); residual non-WinAnsi glyphs are **not** fixed here — same shared-generator TD recorded by Spec 38.
- **Any change to `/v2/leads`** — it already returns full records.

## Dependencies & follow-ups

- **Deploy:** `/signal-lead-map_claude` is already live, but this change must be **deployed** (Render redeploys from `master`) before the Signals surface shows prospects in production. The Lead Stream change is FE-only (ships with the Vercel FE deploy). The plan's "after merge" section must call both out.
- **TD-FE-73** (FE contract reconciliation): this widens the same `SignalLeadMapResponseSchema`. Update the golden fixture in `contracts.test.ts` to include the three new fields (anonymized values, PII guardrail per Spec 38).
- **Provenance:** the RCA `docs/reviews/matched-leads-prospect-fields-rca-2026-06-24.md` is currently **untracked in the main checkout**. Commit it alongside this feature (or remove it before the merge) per the cross-sandbox-merge note — untracked review files block a merge into the main checkout.
- **No new deferred TD expected** — this spec *is* the resolution of the RCA's two suggested TD placeholders. (Round-1 review resolved the two "if" conditionals: the CSV-key case-sensitivity **does** affect the existing name/company columns → fixed in-scope via the shared resolver; and `LeadsTable` **is** reused by `ScoutLeadStream` → both surfaces updated. The Customers Lead Stream is folded in per the user's scope decision, fixed by the same shared resolver.)
- **Related:** Spec 38 (Find Matched Leads CTA — the card/PDF this extends), Plan 36 (signal↔lead map), the live field names in the RCA §4.
