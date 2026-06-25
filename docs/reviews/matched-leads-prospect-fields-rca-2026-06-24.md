# Handoff / RCA — "Find Matched Leads" shows company names only, no prospect detail

**Date:** 2026-06-24
**Author:** Claude Code session (analysis only — NO code changes made)
**Status:** Root cause CONFIRMED (code + live-probe). Awaiting a **product decision** before any fix.
**Repo state:** branch `master`, HEAD `f49e618` (Spec 41 merge). TD-FE ceiling = 78 (next = TD-FE-79).

> Pick-up note for the next session: this is a complete RCA. Nothing has been changed. The only
> thing blocking a fix is the product-team decision in §7. If that decision is "show prospects,"
> jump to §8 (Option A) and §9 — the exact files, the alias map, and the live field names are all
> here.

---

## 1. Symptom (as reported by the user, gaurav@brewra.com)

- Clicking **"Find Matched Leads"** on a Signal card (Signals page) **does** return results, but the
  results show **company names only** — no prospect-level detail (contact name, designation, role).
- The **Scout / Profiler "Lead Stream"** shows the same company-only gap.
- After opening Matched Leads and clicking **"Save as Artifact"**, the exported PDF / artefact-library
  item **also** contains only company names.

So leads are matched and returned fine; the loss is specifically the **prospect/contact-level
fields** that exist in the uploaded CSV.

---

## 2. Bottom line

**The data is not the problem.** Prospect fields are present and fully populated in storage. They are
discarded **in code**:

1. **PRIMARY — Signals "Find Matched Leads" + "Save as Artifact" (backend):** the signal↔lead map
   service narrows every lead to `{lead_id, company, industry, region}` before the LLM call and
   rebuilds the response as `{lead_id, company, relevance, why}`. Prospect fields never reach the
   frontend. The UI and the PDF read the *same* narrowed array, so both look identical.
2. **SECONDARY — Scout/Profiler/Customers "Lead Stream" (frontend, separate code path):** `/v2/leads`
   returns the full lead record, but the FE mapper + type keep only `id/name/company/source/email_status`
   and the table renders no Title/Role columns.

This is a **deliberate design narrowing** (company/account-level matching), not an accidental bug — so
surfacing prospects is partly a product decision (see §7). If the decision is "yes," the cleanest fix
needs **no extra LLM tokens** (see §8 Option A).

---

## 3. Field-survival chain (where prospect fields die)

| Layer | Prospect fields present? | Evidence (file — symbol) |
|---|---|---|
| CSV upload → Neo4j Lead nodes | ✅ yes | `backend/app/services/leads/orchestrator.py` — CSV ingestion stores every column header verbatim as a Lead-node property; no canonicalization, no allowlist |
| Neo4j read (`get_leads_for_org`) | ✅ yes | `backend/app/services/leads/persistence.py` `get_leads_for_org`; `backend/app/services/leads/normalization.py` `_process_neo4j_lead_records` — `dict(lead_node.items())` returns ALL node properties (only JSON-looking strings get re-parsed) |
| **signal-lead-map prompt build** | ❌ **DROPPED (primary)** | `backend/app/services/signals/lead_map.py` `_leads_for_prompt` (~L121-133) — projects each lead to only `{lead_id, company, industry, region}`; alias lists (~L87-95) cover company/industry/region only |
| signal-lead-map response rebuild | ❌ not restored | `lead_map.py` `_parse_mapping` (~L196-201) — rebuilds `{lead_id, company, relevance, why}`; full lead dict is still in memory (~L218-219) but never re-joined; `MatchedLead` model has no prospect fields |
| FE Zod contract | ❌ mirrors backend | `frontend/src/features/signals/contracts.ts` `SignalLeadMapLeadSchema` (~L15-20) = `{lead_id, company, relevance, why}` |
| FE display + Artifact builder | ❌ company only | `frontend/src/features/signals/components/SignalCard.tsx` (~L227) renders `{lead.company}`; `frontend/src/features/signals/lib/signalBriefing.ts` (~L40-45) `buildSignalBriefingArtefact` builds the PDF from `{company, relevance, why}` |
| FE Lead Stream read path | ❌ DROPPED (secondary, separate) | `frontend/src/features/market-research/lib/marketScoresHeatmap.ts` `heatmapLeadFromV2Lead` (~L127-153) keeps only id/name/company/source/email_status; `frontend/src/shared/lib/leadData.ts` `HeatmapLead` type (~L8-23) has no title/designation/role slots; `LeadsTable` has no such columns |

**Why both UI and export are blank (Signals):** `frontend/src/features/signals/pages/SignalsPage.tsx`
`handleSaveAsArtefact` (~L566-567) passes the exact `leadsForSignal(signal.id)` array — the same one
`SignalCard` renders — into the PDF builder. One narrowed source feeds both. The export is not a
second drop.

**Adversarial verification result:** the primary break at `_leads_for_prompt` was **confirmed**. The
two "secondary" locations (`_parse_mapping`, the FE mapper) were correctly judged **not** to be
independent drops for the Signals symptom — they are downstream mirrors. The fields are gone before
the frontend ever runs. (Verdicts: 1 confirmed, 2 "refuted" only in the sense of "not the primary
location" — all three agree the loss origin is `_leads_for_prompt`.)

---

## 4. LIVE PROBE — actual stored field names (verified 2026-06-24)

Backend is live at `https://brewra-gtm-intelligence.onrender.com` (always-on; `/docs` → 200 in ~0.26s).
`GET /v2/leads` and `GET /leads` take **`org_id` query param only — no auth dependency**
(`response_model=PaginatedResponse[Dict[str, Any]]`, so NO field stripping; raw stored keys pass
through). Render threw a couple of transient 500/502s that cleared on retry — not real errors.

### CSV-uploaded leads → org `b06907ac-b9aa-46ae-9535-8f735614b365`
**198 leads, `source` absent (= CSV-origin), every field 100% populated (198/198).** Verbatim
TitleCase_underscore CSV headers:

| What the user wants | Actual stored field name | Sample values |
|---|---|---|
| Designation / title | **`Job_Title`** | (per-contact) |
| Role / function | **`Job_Function`** | Management ×196, Information Technology ×2 |
| Seniority | **`Seniority_Level`** | CXO ×131, Owner ×64, Director ×2, VP ×1 |
| Contact name | **`First_Name`** + **`Last_Name`** | (PII — not printed) |
| Other contact | `Contact_Number`, `Email_Id`, `LinkedIn_URL` | (PII — not printed) |
| Company-level | `Company_Name`, `Company_LinkedIn_URL`, `Website`, `Industry`, `Business_Solution`, `Employee_Range`, `Funding_Round`, `Address_1`, `City`, `State`, `Country`, `Country_Code`, `Zip_Code`, `Sr_No` | — |
| System | `lead_id`, `org_id`, `user_id`, `file_id`, `created_at`, `stage` | — |
| Junk | `Unnamed: 22`, `Unnamed: 23`, `Unnamed: 24` (~115/198 filled) | stray empty trailing CSV columns — worth cleaning at upload |

**There is no field literally named "designation" or "role".** The CSV used `Job_Title`,
`Job_Function`, `Seniority_Level`.

### Apollo leads → org `4ab92719-02cf-4fe5-92b7-11a17755349b`
**172 leads, `source='apollo'`, all 172/172 populated.** Canonical keys: `name`, `first_name`,
`last_name`, **`title`**, **`seniority`**, `email`, `linkedin_url`, `location`, `company_name`, …
(plus `apollo_contact_id`, `apollo_raw`, `discovery_run_id`).

### Other orgs probed
`brewra` (tenant fallback), `org1`, `probe_phase37` → **0 leads**.

### ⚠️ Key implication for the fix — NO canonical lead schema
CSV uses `Job_Title` / `Seniority_Level` / `First_Name`+`Last_Name`; Apollo uses `title` / `seniority` /
`name`. **Any prospect-surfacing fix must be alias-aware**, e.g.:

| Canonical concept | CSV header | Apollo key |
|---|---|---|
| contact name | `First_Name` + `Last_Name` (or none) | `name` / `first_name`+`last_name` |
| designation/title | `Job_Title` | `title` |
| role/function | `Job_Function` | (none) |
| seniority | `Seniority_Level` | `seniority` |
| email | `Email_Id` | `email` |

This is exactly the alias problem the earlier `76b2f6d` fix solved for *matching* — now extended to
*display*.

---

## 5. Recent-commit context (which changes are relevant)

Recent work on this feature (all on `master`):

- `b37b77a` feat(fe): wire Find Matched Leads + Save as Artefact into SignalsPage (Spec 38)
- `071821e` refactor(fe): reconcile `SignalLeadMapResponseSchema` to live shape (TD-FE-73) — mirrors the narrowed shape; not causal
- `76b2f6d` fix(be): resolve CSV-uploaded lead fields **by alias** in signal-lead map → added company/industry/region aliasing in `_leads_for_prompt` so CSV leads would *match at all* (fixed the prior "returns no leads" symptom). **Deliberately did NOT widen to prospect fields.** It cemented, but did not originate, the company-only shape. (See its regression test `backend/tests/unit/test_signal_lead_map.py::test_leads_for_prompt_resolves_*`.)
- `283bc4f` fix(fe): retry + visible feedback for signal-lead matching (S5/S6)
- `84e4555` fix(fe): Scout Lead Stream shows real leads, not demo placeholders — touches the SECONDARY (Lead Stream) path; did not add prospect fields
- Spec 41 (`f49e618` etc.) recommendation-artefact (GTM playbook) — the **recommendation-level** "Save as Artifact" (distinct from the matched-leads one in this bug)

The narrowing predates all of these; it is the `{lead_id, company, industry, region}` prompt contract +
the `{lead_id, company, relevance, why}` `MatchedLead` model.

---

## 6. CSV header note (why `76b2f6d`'s aliases still need a look)

`76b2f6d`'s tests aliased space-separated headers ("Company Name", "Industry", "Country", and
"Organization"/"Sector"/"Location"). The **real** CSV uses underscore TitleCase (`Company_Name`,
`Industry`, `Country`). Company names DO display in matched leads today, so company resolution works
for `Company_Name` — but when extending aliasing to prospect fields, verify the resolver normalizes
separators/casing (underscore vs space) for the new keys too.

---

## 7. PRODUCT DECISION REQUIRED (the gate)

The narrowing reads as a deliberate "match at the company/account level" choice. Before building,
the product team must decide:

1. **Granularity** — should matched-leads results + the saved Artifact surface **individual prospects**
   (name, designation, role) or stay **company-level** (today)?
2. **(If prospects) matching intelligence** — (a) keep company-level relevance and simply *display*
   the contacts under each matched company (lighter, recommended), vs (b) make the LLM *reason about*
   which roles/people best fit each signal (heavier, higher LLM cost).
3. **Consistency** — apply to both the Signals view and the Scout/Profiler Lead Stream, or one first?

A non-technical framing for the product team was drafted in conversation (can be regenerated). The
concrete field names from §4 can be folded into it.

---

## 8. Fix options (NOT implemented — for after the §7 decision)

### Option A — re-enrich after the LLM (recommended; no extra LLM tokens)
The full lead dicts are already in memory in `lead_map.py` (~L218-219). The LLM only needs `lead_id`
to identify a match. So:
1. In `_parse_mapping` (or right after), **join each matched `lead_id` back to its full lead dict**
   and attach prospect fields via an **alias map** (§4 table) → produce canonical
   `contact_name / job_title / job_function / seniority` (+ raw passthrough if desired).
2. Extend `MatchedLead` (Pydantic) with the new optional fields.
3. Extend FE `SignalLeadMapLeadSchema` (`contracts.ts`).
4. Render them in `SignalCard.tsx` and include them in `signalBriefing.ts` `buildSignalBriefingArtefact`
   (the PDF).
- **Does not** change what the LLM reasons over (company-level matching preserved), **does not** add tokens.

### Option B — widen the prompt (only if matching must become person-aware)
Add prospect aliases to `_leads_for_prompt`, update the prompt template
`backend/prompts/signals/signals_lead_map.md.j2` to receive + reason over them, extend the expected
output, then carry through model → contract → UI → PDF. Heavier; higher LLM cost; changes feature
semantics from "which companies" to "which people."

### Lead Stream (secondary, separate FE-only change — Option A or B doesn't touch it)
Extend `HeatmapLead` type (`frontend/src/shared/lib/leadData.ts`), the `heatmapLeadFromV2Lead` mapper
(`frontend/src/features/market-research/lib/marketScoresHeatmap.ts`), and add Title/Role columns to
the Lead Stream `LeadsTable`. `/v2/leads` already returns the data. Make this consistent with the
Signals decision.

### Suggested tech-debt allocation
File these as new TD-FE entries (ceiling is 78): one for the Signals matched-leads prospect surfacing
(relates to TD-FE-73), one for the Lead Stream prospect columns. Mark blocked on the §7 decision.

---

## 9. How to reproduce the live probe (for verification)

```bash
# CSV org — enumerate stored field names + fill rates (no auth needed)
curl -s "https://brewra-gtm-intelligence.onrender.com/leads?org_id=b06907ac-b9aa-46ae-9535-8f735614b365&limit=500"

# Apollo org
curl -s "https://brewra-gtm-intelligence.onrender.com/leads?org_id=4ab92719-02cf-4fe5-92b7-11a17755349b&limit=500"
```
- Bucket items by `source` (CSV leads have no `source`; Apollo = `'apollo'`).
- Inspect the **keys** (= verbatim CSV headers) and per-key fill counts. **Do not echo PII values**
  (names/emails/phones) — count them only.
- Retry on transient 500/502 (Render flakiness).
- The OpenAPI lists the read endpoints: `GET /v2/leads`, `GET /v2/leads/by-file`, `GET /leads`,
  `GET /leads/by-file`, `GET /connectors/apollo/leads/export`.

---

## 10. Pointers

- Memory: `project_matched_leads_prospect_fields_rca` (auto-memory; org ids + field names + RCA).
- Related: `apollo-integration-rca-2026-06-23.md` (docs/reviews), Spec 38 (Find Matched Leads CTA),
  Plan 36 (signal↔lead map), TD-FE-73 (FE contract derived from code, not live), the FE dual org-id
  divergence note (`useAuth().orgId ?? selectedTenant?.id`).
- This file is **untracked** on the `master` checkout (not committed). If you merge a branch into this
  checkout, remember untracked review files can block the merge — `git add` it or move it first.
```
