# Matched-Leads CSV Export (bundled with Save as Artifact) — Design Spec

**NN:** 43 (pairs with `plans/43-artefact-csv-export.md`)
**Date:** 2026-06-26
**Status:** Draft (pre-review)
**Branch:** `artefact-csv-export`
**Stack:** Cross-stack (backend FastAPI + frontend React PWA) — ships as one coordinated change.
**Relationship to prior work:**
- **Extends** Spec/Plan 38 (`38-signals-cta-design.md`, *Signal Briefing*) and Spec/Plan 41 (`41-recommendation-artefact-design.md`, *GTM Playbook*) — the two "Save as Artifact" flows on an expanded Signal. Both already produce a PDF via `features/artifacts/lib/artefactPdf.ts` and enqueue an `ArtefactItem` to the in-app Artifacts library.
- **Builds on** Spec/Plan 42 (`42-matched-leads-prospect-fields-design.md`), which added the `name` / `title` / `seniority` prospect fields to the matched-leads enrichment (`backend/app/services/signals/lead_map.py::_enrich_matched_leads`) and the FE contract (`SignalLeadMapLeadSchema`). This spec extends that same pure-projection enrichment with the remaining contact fields and adds a CSV export path.
- **Depends on** the verified finding (commit `3254fb1`, recorded at `backend/API_ENDPOINTS_SUMMARY.md` A6 + `frontend/src/features/connectors/README.md`): `POST /connectors/apollo/enrich` (Apollo `people/match` / `bulk_match`) has **no frontend caller**. This feature therefore reads only already-stored data and **spends zero Apollo credits**.

---

## Problem

The "Save as Artifact" action on an expanded Signal produces a **PDF** (a narrative briefing / GTM playbook). The PDF is good for reading but poor for *acting*: a salesperson can't load it into a CRM, sort it, or run outreach from it. The matched leads — the actionable core — are only available as prose bullet points inside the PDF.

We want a **tabular CSV** of the matched leads, delivered alongside the PDF, containing outreach-useful contact fields (email, LinkedIn, phone) in addition to the identity/relevance fields already shown.

## Goal

When a user saves a Signal artifact, additionally produce a **CSV of the matched-leads table** (one row per lead) and make it downloadable both at save time and later from the Artifacts library — using **only already-stored data**, at **zero Apollo cost**.

## Decision (settled with the product owner, 2026-06-26)

1. **CSV = a free, pure export of already-stored fields.** Never trigger a reveal/enrich (`/connectors/apollo/enrich`, `people/match`, `bulk_match`) as part of producing the CSV. Guaranteeing missing contacts is a separate, explicit, credit-spending "Enrich" action and is **out of scope** here.
2. **Columns (fixed order):** `Name, Title, Seniority, Company, Email, Email status, LinkedIn, Phone, Relevance, Why`.
3. **Blanks where data isn't on file**; **keep** leads that lack contact info (their name/title/company is still useful).
4. **Include `Email status`** (Apollo `verified` / `unverified`) so the user knows which emails to trust.
5. **Delivery:** bundled with "Save as Artifact" — one click downloads **both** the PDF and the CSV, and **both** re-download from the Artifacts library. The saved `ArtefactItem` carries the structured lead rows so the library can regenerate the CSV.
6. **Scope of surfaces:** applies to **both** artifact types that carry matched leads — the *Signal Briefing* (Spec 38) and the *GTM Playbook* (Spec 41). It does **not** touch the standalone Lead Stream tables (Customers / Scout) — those are a separate surface.

## Non-Goals

- No on-demand reveal/enrichment of missing contacts (no Apollo credit spend). Out of scope by decision.
- No server-side CSV endpoint. (The existing Apollo `GET /connectors/apollo/leads/export` is a different surface and is not reused here — see §4 rationale.)
- No durable storage of artifacts. The library remains in-memory (seeded + queue-drained); `leadRows` live on the in-memory `ArtefactItem` exactly like the rest of the artifact. Persistence is a separate concern (TD-FE-58/59 family).
- No change to the Lead Stream tables, the matching prompt, the LLM, or the recommendation-artefact request model.

## Column schema — single source of truth (both stacks)

One row per matched lead. Values come from the enriched `SignalLeadMapLead` already held on the frontend.

| CSV column | Source field (`SignalLeadMapLead`) | Origin |
|---|---|---|
| Name | `name` | Spec 42 (existing) |
| Title | `title` | Spec 42 (existing) |
| Seniority | `seniority` | Spec 42 (existing) |
| Company | `company` | existing |
| Email | `email` | **new** |
| Email status | `email_status` | **new** |
| LinkedIn | `linkedin_url` | **new** |
| Phone | `phone` | **new** |
| Relevance | `relevance` | existing (LLM mapping: `high`/`medium`/`low`) |
| Why | `why` | existing (LLM per-lead rationale; PDF-only today) |

### Alias map for the new backend fields (mirrors the Spec 42 pattern in `lead_map.py`)

Resolved from the full stored lead dict already in scope, case-insensitively, first-match-wins. Apollo leads use canonical keys; CSV-uploaded leads keep verbatim `TitleCase_underscore` headers.

| Canonical wire key | Aliases (Apollo · CSV-upload) |
|---|---|
| `email` | `email` · `Email_Id`, `email_id`, `Email`, `Email_Address` |
| `email_status` | `email_status` · *(no common CSV equivalent → blank)* |
| `phone` | `phone` · `Contact_Number`, `Phone`, `Phone_Number`, `mobile` |
| `linkedin_url` | `linkedin_url` · `LinkedIn_URL`, `linkedin`, `LinkedIn` |

`email_status` is populated only for Apollo-discovered leads; it will be blank for CSV-uploaded and manually-added leads. Phone is blank for most Apollo leads (phone reveal is a separate, costlier pool that discovery leaves off) and present only when the source file/record included it. These blanks are expected (decision §3).

## Backend design

**File:** `backend/app/services/signals/lead_map.py` — extend `_enrich_matched_leads` only.

- Add `_EMAIL_ALIASES`, `_PHONE_ALIASES`, `_LINKEDIN_ALIASES` tuples beside the existing `_TITLE_ALIASES` / `_SENIORITY_ALIASES` / `_NAME_ALIASES`.
- In the per-lead enrichment (where `name`/`title`/`seniority` are already projected from the joined full dict), also set `email`, `email_status`, `phone`, `linkedin_url`, resolved via the same `_normalize_lead_keys` + first-alias helper. `email_status` reads the canonical key only.
- **Pure projection.** The full lead dict (`leads_by_id`) is already in scope from the post-mapping re-join. **No new external call, no Apollo API, no LLM, no credits.** Degrade-never-throw: any missing field → `""`.
- The `/signal-lead-map_claude` response is an **untyped dict** (confirmed: no `MatchedLead` Pydantic response model on this route), so no Pydantic model needs updating — the new keys simply ride along in each lead object on both the cache-hit and cache-miss paths.

## Contract change

**File:** `frontend/src/features/signals/contracts.ts` — widen `SignalLeadMapLeadSchema`:

```ts
email: z.string().optional().default(""),
email_status: z.string().optional().default(""),
phone: z.string().optional().default(""),
linkedin_url: z.string().optional().default(""),
```

The schema is non-`strict()`, so this is additive and safe. These fields flow into `SignalLeadMapLead` and are consumed by the artifact builders (below). The on-screen card (`SignalCard`) is unchanged — contact fields appear only in the CSV.

## Frontend design

### F1. New CSV module — `frontend/src/features/artifacts/lib/artefactCsv.ts`

Mirrors `artefactPdf.ts` (blob + anchor download), so the two exports are symmetric.

- `buildLeadsCsv(rows: ArtefactLeadRow[]): string`
  - Header row in the fixed column order (§column schema).
  - **RFC 4180** quoting: a field is wrapped in `"…"` when it contains `,`, `"`, `\n`, or `\r`; embedded `"` is doubled. (The `Why` rationale is free text and commonly contains commas — quoting is load-bearing.)
  - `\r\n` line endings.
- `generateAndDownloadCsv(artefact: ArtefactItem): void`
  - No-op if `!artefact.leadRows?.length` (see edge cases).
  - Content = **UTF-8 BOM (`﻿`)** + `buildLeadsCsv(rows)`, so Excel opens it as UTF-8.
  - `Blob([...], { type: "text/csv;charset=utf-8" })` → object URL → synthetic `<a download>` → click → revoke (same lifecycle as `generateAndDownloadPDF`).
  - Filename: `${slug}-leads-${Date.now()}.csv`, `slug` derived from `artefact.fullReport.title` exactly like the PDF.
- Exported from the feature barrel `frontend/src/features/artifacts/index.ts` (the signals save flow imports it via `@/features/artifacts`).
- **Note:** the CSV is plain UTF-8 text, so it is **not** subject to the PDF's Unicode-font limitation (TD-FE-78) — accented and non-Latin names export correctly.

### F2. `ArtefactItem` extension — `frontend/src/features/artifacts/types.ts`

```ts
export interface ArtefactLeadRow {
  name: string; title: string; seniority: string; company: string;
  email: string; emailStatus: string; linkedin: string; phone: string;
  relevance: string; why: string;
}
// ArtefactItem gains:
leadRows?: ArtefactLeadRow[];
```

`ArtefactLeadRow` is owned by the `artifacts` feature (no cross-feature type coupling); the signals builders map their `SignalLeadMapLead` into it.

### F3. Builders attach `leadRows` — `frontend/src/features/signals/lib/signalBriefing.ts`

Both `buildSignalBriefingArtefact` and `buildRecommendationPlaybookArtefact` already receive `leads: SignalLeadMapLead[]`. Each maps that array into `leadRows: ArtefactLeadRow[]` (a small `leadToRow` helper) and sets it on the returned `ArtefactItem`. `formatLeadFinding` (the PDF line) is unchanged.

### F4. Save handlers download the CSV too — `frontend/src/features/signals/pages/SignalsPage.tsx`

In `handleSaveAsArtefact` and `handleSaveRecommendationAsArtefact`, after building `item`, call `generateAndDownloadCsv(item)` in addition to the existing `generateAndDownloadPDF(item)` and `enqueueArtefact(item)`. One click → PDF + CSV. (Two sequential downloads; see Risks for the browser caveat.)

### F5. Artifacts library — re-download CSV

In `frontend/src/features/artifacts/pages/ArtifactsPage.tsx` + `components/LibraryCard.tsx`: add a **CSV** download control next to the existing PDF download, rendered only when `artefact.leadRows?.length`. It calls `generateAndDownloadCsv(artefact)` (a new `onDownloadCsv` handler alongside the existing `handleDownloadClick`). The "mark `new` → `viewed`" behavior matches the existing PDF download.

## Data flow

```
Signal matched leads (already enriched by _enrich_matched_leads, cached in useSignalLeadMap)
   │  + new contact fields (email / email_status / phone / linkedin_url) via pure projection
   ▼
build{SignalBriefing|RecommendationPlaybook}Artefact(signal, leads, …)
   │  → ArtefactItem { fullReport, leadRows: ArtefactLeadRow[] }
   ├── generateAndDownloadPDF(item)   (existing)
   ├── generateAndDownloadCsv(item)   (NEW — blob text/csv, no backend call)
   └── enqueueArtefact(item)          (existing; carries leadRows into the library)
                                          │
                              Artifacts library card → PDF download (existing) + CSV download (NEW)
```

No backend call occurs at download time on either path; the only backend involvement is the one-time enrichment projection that already runs for the matched-leads map.

## Error handling / degradation / edge cases

- **Missing fields** → empty cells (degrade-never-throw end to end: backend `""`, zod `.default("")`, builder maps `""`).
- **0 leads** (possible for a GTM Playbook): `leadRows` is `[]`; `generateAndDownloadCsv` is a no-op and the library CSV control is hidden. The PDF + artifact still save as today.
- **`email_status` / phone blank** for non-Apollo or non-revealed leads — expected, not an error.
- **Commas / quotes / newlines** in `Why` (or any field) — handled by RFC-4180 quoting.
- **Excel encoding** — UTF-8 BOM ensures correct rendering of non-ASCII names.

## Cost & safety

This feature reads only data already stored and already enriched by the existing matched-leads map. It makes **no** call to `/connectors/apollo/enrich`, `people/match`, or `people/bulk_match`, and runs **no** LLM. **Zero Apollo credits are spent** by saving an artifact or downloading a CSV — consistent with the enrich-not-wired finding (commit `3254fb1`). The only UI-wired path that spends reveal credits remains Apollo discovery, which is untouched.

## Testing strategy

**Backend** (`backend/tests/unit/...` for `lead_map`):
- `_enrich_matched_leads` projects `email`, `email_status`, `phone`, `linkedin_url` onto each matched lead.
- Alias resolution: Apollo canonical (`email`/`phone`/`linkedin_url`/`email_status`) **and** CSV `TitleCase_underscore` (`Email_Id`/`Contact_Number`/`LinkedIn_URL`); missing → `""`; `email_status` blank for CSV leads.
- No new external/LLM call (the join is a pure in-memory dict lookup).

**Frontend**:
- `artefactCsv`: header + exact column order; RFC-4180 quoting (field with comma, embedded quote, newline); `\r\n` endings; leading BOM; blanks for missing fields; `generateAndDownloadCsv` no-op when `leadRows` empty.
- `signalBriefing`: both builders attach `leadRows` correctly mapped (incl. `relevance`, `why`, contact fields) from `leads`.
- `SignalsPage`: saving (briefing + playbook) calls `generateAndDownloadCsv` in addition to PDF + enqueue.
- Artifacts library: CSV control renders iff `leadRows?.length`; clicking calls `generateAndDownloadCsv`.

## Affected files

**Backend**
- `backend/app/services/signals/lead_map.py` — alias tuples + projection (the only logic change).
- `backend/tests/unit/...` — extend the `lead_map` enrichment tests.

**Frontend**
- `frontend/src/features/signals/contracts.ts` — widen `SignalLeadMapLeadSchema`.
- `frontend/src/features/artifacts/types.ts` — `ArtefactLeadRow` + `ArtefactItem.leadRows`.
- `frontend/src/features/artifacts/lib/artefactCsv.ts` — **new**.
- `frontend/src/features/artifacts/index.ts` — export `generateAndDownloadCsv`.
- `frontend/src/features/signals/lib/signalBriefing.ts` — map + attach `leadRows` in both builders.
- `frontend/src/features/signals/pages/SignalsPage.tsx` — call `generateAndDownloadCsv` in both save handlers.
- `frontend/src/features/artifacts/pages/ArtifactsPage.tsx` + `components/LibraryCard.tsx` — CSV download control.
- Tests: `artefactCsv.test.ts` (new), and extensions to `signalBriefing.test.ts`, `SignalsPage.cta.test.tsx`, the Artifacts/LibraryCard test.

## Acceptance criteria

- **AC1** — Saving a Signal Briefing or GTM Playbook downloads a `.csv` (in addition to the PDF) with header `Name,Title,Seniority,Company,Email,Email status,LinkedIn,Phone,Relevance,Why` and one row per matched lead.
- **AC2** — Email / Email status / LinkedIn / Phone are populated from stored data where present and blank where not; rows without contact info are still included.
- **AC3** — The saved artifact in the library exposes a CSV download (next to the PDF) that regenerates the same CSV; hidden when the artifact has no leads.
- **AC4** — Fields containing commas/quotes/newlines (notably `Why`) are correctly RFC-4180 quoted; the file opens cleanly in Excel (UTF-8 BOM) including non-ASCII names.
- **AC5** — No Apollo credits are spent and no LLM runs when saving an artifact or downloading a CSV; `/connectors/apollo/enrich` is never called.
- **AC6** — Backend matched-leads enrichment carries the four new fields via pure projection (no new external call); verified by unit tests and a live response-shape check.

## Risks & open decisions

- **Two automatic downloads from one click** — some browsers prompt "allow multiple downloads." Accepted for MVP. If it proves annoying, a future option is a single `.zip` (adds a zip dependency) — not now.
- **Backend redeploy required** — the enrichment projection must reach the live Render backend for the Signals path to include the new fields (same deploy caveat noted for Spec 42's Signals path). The CSV will simply show blanks for the new contact columns until the backend is redeployed.
- **In-memory library** — `leadRows` are lost on reload along with the rest of the artifact (unchanged behavior; not solved here).

## Dependencies & follow-ups

- Per CLAUDE.md polyglot rule: **land/verify the backend projection first** (confirm the live `/signal-lead-map_claude` response shape with a real call), then implement the FE.
- Possible follow-up (separate spec): an explicit, user-initiated "Enrich missing contacts" action that wires `POST /connectors/apollo/enrich` (credit-spending) — the natural home for the currently UI-unreachable endpoint.
