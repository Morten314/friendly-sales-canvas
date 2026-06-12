# Apollo ICP-Driven Lead Discovery — Design Spec

**Date:** 2026-06-12
**NN:** 35
**Scope:** Cross-stack (backend + frontend)
**Status:** Design intent (output of brainstorming)

---

## 1. Overview

This spec adds **ICP-driven lead discovery** to the existing Apollo integration: discovering net-new leads from Apollo's database based on the customer's ICP, then surfacing them to Scout, Profiler, and Signals. It is the backend + frontend work required to realize the product team's frontend design (`specs/2026-06-04-apollo-integration-design.md`).

It builds on, and deliberately extends past, `specs/23-apollo-lead-integration-design.md` (the connectors backend that shipped import + enrichment). Spec 23 **explicitly deferred** net-new prospecting:

> "Net-new Apollo People Search prospecting (`/mixed_people/api_search`) — returns IDs with no emails and would burn enrichment credits per row. Future extension."

This spec is that extension, designed around Apollo's real API constraints (Section 3).

### Relationship to prior artifacts
- **`specs/2026-06-04-apollo-integration-design.md`** (product team, frontend-only) — the *product* reference for tile states, the warmup gate, the discovery flow, agent views, and UC1–UC10. This spec implements it and records the **divergences** forced by Apollo's API (Section 9).
- **`specs/23-apollo-lead-integration-design.md` / `plans/23a-apollo-lead-integration-backend.md`** — the connectors substrate we reuse (credentials, normalize, ingestion, run-doc pattern, exception→HTTP mapping).

### What is new vs. reused

**Reused as-is (no rewrite):**
- Per-org credential storage (`Profiler.Connector_Credentials`) and lifecycle (`credentials.py`).
- `normalize_apollo_record` (extended with two fields, fill-only-empty preserved).
- `ingestion.upsert_imported_leads` / Company merge / fill-only-empty Cypher.
- The background-task + run-doc progress pattern (mirrors `Connector_Enrich_Runs`).
- The connector exception → HTTP mapping in `routers/connectors.py`.

**New backend:**
- `ApolloConnector.search_people` (People Search) and `ApolloConnector.match_person` (single enrichment/reveal by Apollo id).
- A discovery pipeline (search → free funnel → LLM re-rank → reveal → quality gate → ingest).
- A discovery-run collection (`Profiler.Connector_Discovery_Runs`) + status polling.
- A warmup-readiness endpoint fanning across four Mongo databases.
- An ICP-completeness gate at connect, and master-key validation.
- Reactive credit awareness (spend tracking via `credits_consumed`).
- ICP-change detection and existing-lead management (keep / replace / download).

**New / changed frontend:**
- Apollo tile (5 lifecycle states — Locked / Unlocked / Running / Complete / Error; zero-results and partial are Complete sub-states) + single-step connection modal in Mission Control → Data Sources.
- Warmup progress UI + app-wide unlock toast.
- The discovery flow with the re-discovery guard and keep/replace/download prompts.
- A source filter (All / CSV / Apollo) on Scout and Profiler lead tables.
- An "unverified" confidence badge on lead rows (divergence — Section 9).
- The data layer (zod contracts + TanStack Query hooks) for all new contracts.

The existing **import-from-lists + enrich** endpoints remain in the codebase but are **not surfaced** in this UI; Mission Control's "Discover Leads" is the single control point. They stay callable for future use.

---

## 2. Goals / Non-goals

**Goals**
- Turn an org's active ICP into a vetted set of net-new, contactable leads with minimal wasted Apollo credits.
- Gate discovery behind a meaningful "warmup" so searches are ICP-quality.
- Make Apollo-sourced leads first-class in Scout/Profiler/Signals, filterable by source, with honest confidence signalling.
- Degrade gracefully against Apollo's API gaps (no credit-balance endpoint; master-key requirement; obfuscated search data).

**Acceptance criteria** (functional + verifiable; MVP-appropriate — no arbitrary latency/quality SLAs while there are 0 users):
1. A discovery run on a complete ICP lands ≥ 1 lead flagged `source="apollo", apollo_origin="discovery"` into the pool, or terminates `completed_empty` with run counts (`searched`/`created`) that explain why.
2. Zero credits are spent on `has_email == false` candidates, on **Apollo-ID-identifiable** duplicates already in the pool, or on candidates the funnel did not select — i.e. `credits_consumed ≤ revealed ≤ selected ≤ effective max_leads`. (CSV-sourced duplicates lack an Apollo ID and are merged at ingest, not skipped pre-reveal — §5.2 step 3.)
3. `credits_consumed` is recorded on every run doc and accumulated into `credits_consumed_total`.
4. A `replace` run never reduces the pool below its **pre-run lead count**: prior discovery leads are removed only after new leads commit (no-loss swap, §5.7).
5. Discovery is reachable only when `warmup.unlocked == true` **and** the selected ICP passes the completeness bar; otherwise the request is rejected.
6. Scout and Profiler can filter the pool by source (All / CSV / Apollo), and unverified-email leads are visibly marked.

**Non-goals** — see Section 11 (out of scope). Notably: enrichment as a *user* feature, lookalike discovery, durable job queues, OAuth, security hardening (MVP posture per repo `CLAUDE.md`).

---

## 3. Confirmed Apollo API facts (grounding)

Verified against Apollo's API reference and an independent 2026 developer guide (see Section 12, Sources). These facts drive the whole design.

| Topic | Fact | Consequence |
|---|---|---|
| Search endpoint | `POST /api/v1/mixed_people/api_search` (the `/mixed_people/search` variant 403s on lower plans) | Discovery calls `api_search`. |
| Master key | Search **requires a master API key** (403 otherwise) | Connect must validate a *master* key with search access; UX must say so. |
| Search credits | Search **consumes no credits** | The search + free-funnel stages are genuinely free. |
| Pagination | `per_page` ≤ 100, `page` ≤ 500, **50,000-record display ceiling**; `pagination` object in response; results under a `people`/`contacts` array | Bounded scan; existing 429 backoff applies. |
| Search payload | Per-person object exposes **`has_email` (bool)**, `last_name` **obfuscated**, `title`, `seniority`, nested `organization` — **not** the email and **not** `email_status` | Free pre-reveal filter keys on `has_email`; verified-vs-unverified unknown until reveal. |
| Reveal | Real `email` + `email_status` (`verified`/`unverified`) come only from enrichment; response returns an accurate **`credits_consumed`** | Exact per-run spend tracking is possible. |
| `bulk_match` gotcha | Search `id`s reportedly **fail in `/people/bulk_match`** (null match, 0 credits); obfuscated last names block name-based bulk entries | Reveal uses **single `POST /people/match` by `id`**, not `bulk_match`. |
| Credit balance | **No public endpoint returns remaining credits** (only Developer Portal / in-app) | UC10 is reactive + spend-tracking, never predictive-from-API. |
| Phone credits | Phone reveal is a separate, costlier credit pool | Keep `reveal_phone_number = false` for discovery. |

---

## 4. Architecture

```
Mission Control (FE)
  └─ Apollo tile / Discover Leads  ──POST /connectors/apollo/discover──▶  Discovery background task
                                                                              │
   warmup poll ◀──GET /connectors/apollo/warmup──┐                            ▼
   status poll ◀──GET /connectors/apollo/discover/status──┐        ┌──────────────────────────────┐
                                                          │        │ 1. ICP → api_search filters   │ free
Scout / Profiler lead tables  ◀── leads (source=apollo) ──┘        │ 2. api_search (paginate)      │ free
   (source filter + unverified badge)                              │ 3. free funnel:               │ free
                                                                   │    has_email + ICP-fit + dedup│
                                                                   │ 4. LLM re-rank → top max_leads│ tokens
                                                                   │ 5. reveal: people/match by id │ CREDITS
                                                                   │ 6. quality gate: has email    │
                                                                   │ 7. ingest (fill-only-empty)   │
                                                                   └──────────────────────────────┘
                                                                       writes: Neo4j Lead/Company
                                                                       run doc: Profiler.Connector_Discovery_Runs
```

The discovery task runs in-process via FastAPI `BackgroundTasks` (same posture as enrich; non-durable on Render restart — acceptable at MVP, and the stale-run failover detects orphans).

---

## 5. Backend design

### 5.1 `ApolloConnector` — two new methods
Added to `app/services/connectors/apollo.py` (alongside `validate_credentials`, `list_collections`, `fetch_contacts`, `bulk_match`):

- **`search_people(filters: dict, page: int, per_page: int = 100) -> dict`**
  `POST /api/v1/mixed_people/api_search`. Returns the parsed page (`people[]` + `pagination`). Raises `ConnectorCredentialsInvalidError` on 401, `ApolloAPIError` on 403 (surfaced as "master key required"), reuses the existing 429 exponential backoff.
- **`match_person(person_id: str, *, reveal_personal_emails: bool = True, reveal_phone_number: bool = False) -> dict | None`**
  `POST /api/v1/people/match` keyed by Apollo `id`. Returns the enriched person (incl. `email`, `email_status`, `credits_consumed`) or `None` on no-match. 402 / 422-with-"credit" → `ApolloCreditsExhaustedError` (existing).

`bulk_match` is intentionally **not** used for discovery reveal (Section 3 gotcha).

### 5.2 Discovery pipeline
Lives in a new `app/services/connectors/discovery.py`, orchestrated from `orchestrator.py` (new `start_apollo_discover` + `_run_discover` background body, mirroring the enrich pair).

1. **Build query** — resolve the active ICP first: the request's `icp_id` selects one entry from `customer_profiles.icps[]`; when omitted, fall back to the most-recently-created ICP for the org. `build_search_filters(icp)` then maps it to `api_search` params: `person_titles`/`person_seniorities` ← `buyer_role[]`; `organization_num_employees_ranges` ← `company_size[]`; **`q_organization_keywords` ← `industry[]`** (keyword match on industry *names* — no ID table to build/maintain; `organization_industry_tag_ids` is a future optimization that would need an Apollo industry-name→tag-ID lookup we don't have, and passing name strings as tag IDs makes Apollo silently ignore the filter); `person_locations` ← `location[]` / `primary_region`. (Other exact Apollo filter keys finalized in the plan against live `/docs`; the step-3 funnel drops any industry mismatch the keyword filter lets through, for free.) The selected ICP must pass the same completeness bar as the connect gate (5.5); a sparse/empty ICP is rejected with `422 {code:"icp_underspecified"}` rather than executing an unbounded, credit-burning search.
2. **Search + paginate** — pull up to the search-scan cap (**500**) candidates (≤ 5 pages × 100), honoring `pagination.total_pages` and the 50k ceiling.
3. **Free pre-reveal funnel** (no credits):
   - Drop `has_email == false`.
   - Local **ICP-fit score** from free fields. The contract: a candidate is **dropped only on zero-overlap against a hard ICP dimension** — no intersection of title/seniority with `buyer_role[]`, OR org `industry` outside `industry[]`, OR org size outside `company_size[]`. Survivors are *scored* (weighted title/seniority match, industry set-intersection, company-size range-match, geo match) as ranking input to step 4. Exact weights/thresholds are a plan-time decision **within this drop contract**.
   - **Dedup vs. existing pool** is **Apollo-ID-based only** (person `id` ↔ stored `apollo_contact_id`); skip candidates already present. CSV-sourced leads have no Apollo ID, so a CSV duplicate isn't caught *pre-reveal* (we may spend one reveal credit on them) — but the fill-only-empty ingest still **matches them by `email_norm`** and updates rather than duplicating (counted as `matched`, not `created`). In `replace` mode this dedup **excludes `superseded` leads** (5.7) so the same people can be re-discovered.
4. **LLM re-rank** — score the survivors' free metadata against the ICP via the existing LLM config (Groq primary, `app/core/llm_config`); a new prompt at `prompts/connectors/apollo_discovery_rerank.md.j2`. Select the top **`max_leads`** (default **50**). Bounded single-shot batch scoring; **LLM failure degrades deterministically to the step-3 ICP-fit ranking** (logged), so a run never blocks on the LLM. *Rationale (deliberate decision):* the credited reveal is the expensive operation — spending cheap LLM tokens to choose *which* 50 of ~500 free candidates to reveal directly cuts wasted credits, which a purely linear local score over the obfuscated free fields ranks less well. Retained intentionally; the deterministic fallback bounds its risk.
5. **Reveal** — for each selected candidate, `match_person(id)` sequentially (respecting plan rate limits + 429 backoff); accumulate `credits_consumed`.
6. **Quality gate** — keep any candidate that returns a **real email**; record `email_status` (`verified` | `unverified`) on the lead. No-match / no-email candidates are dropped silently (per design).
7. **Ingest** — `normalize_apollo_record(match)` → `upsert_imported_leads(source="apollo", ...)` with `apollo_origin="discovery"` and `discovery_run_id` set; Company merge unchanged; fill-only-empty preserved.

**Configuration constants:**

| Constant | Value | Rationale |
|---|---|---|
| `SEARCH_SCAN_CAP` | 500 | candidates pulled (≤ 5 pages) to feed the funnel/re-rank |
| `MAX_LEADS_DEFAULT` | 50 | revealed leads per run; bounds credit spend + reveal latency |
| `MAX_LEADS_HARD_CAP` | 200 | upper bound on `max_leads`; the stale threshold scales with it (5.3) |
| `REVEAL_RATE_DELAY` | plan-tuned | inter-reveal delay to respect Apollo enrichment rate limits |

### 5.3 Discovery run model — `Profiler.Connector_Discovery_Runs`
Mirrors `Connector_Enrich_Runs` (unique index on `run_id`; `[(org_id,1),(status,1)]`; `[(org_id,1),(created_at,-1)]`). The stale-run failover is **proportional to the run's `max_leads`** — `max_leads * 8s + 120s` (≈ 520s at the default 50, ≈ 1720s at the hard cap 200) — so a still-running large reveal is not falsely marked stale.

```jsonc
{
  "run_id": "uuid", "org_id": "...", "user_id": "...",
  "icp_id": "...", "icp_fingerprint": "sha1(normalized icp)",
  "mode": "keep" | "replace",
  "status": "queued"|"processing"|"completed"|"completed_empty"|"failed"|"partial",
  "counts": { "searched": 0, "qualified": 0, "selected": 0, "revealed": 0,
              "verified": 0, "unverified": 0, "created": 0, "matched": 0,
              "skipped_duplicates": 0, "errors": [] },
  "credits_consumed": 0,
  "created_at": "...", "started_at": null, "finished_at": null,
  "message": null
}
```
**Count semantics:** `matched` = revealed candidates that, at ingest, *updated* an existing lead (e.g. an `email_norm` overlap with a CSV lead) rather than creating one; `errors` holds `[{stage, message}]` objects for debugging.

`completed_empty` fires when **`created == 0`**, regardless of which stage emptied the funnel; the FE distinguishes the cause from the counts — `searched == 0` ⇒ "no one in Apollo matches this ICP — widen it" (UC8); `searched > 0` but `created == 0` ⇒ "candidates were found but none were contactable / passed the gate." `partial` ⇒ a credit/rate error mid-run after some leads already landed.

### 5.4 Warmup readiness — `GET /connectors/apollo/warmup?org_id&user_id`
New code querying four collections via the **single shared Mongo client** (one deployment — not four failure domains; confirmed collections below). Each milestone check is independent and wrapped: a query error on one check yields `false` for that milestone (degraded, never a `500`), so a transient issue in one store never blocks the whole readiness signal. Per-check timeouts are not added at MVP (one Mongo deployment, the same one the rest of the app already depends on).

```jsonc
{ "icp_configured": true, "signals_generated": false,
  "scout_completed": true, "profiler_analyzed": true,
  "ready_count": 3, "unlocked": false,
  "missing": [ { "step": "signals_generated", "label": "Signals — first run", "deep_link_hint": "signals" } ] }
```

| Step | Source (db.collection) | "Done once" check |
|---|---|---|
| `icp_configured` | `Profiler.Company_Profile` | `{profile_type:"company", org_id}` has a non-empty `customer_profiles.icps[]` **with all required fields** (`primary_region`, `industry[]`, `company_size[]`, `buyer_role[]`, `fit_confidence`) |
| `signals_generated` | `Signals.signals` | ≥ 1 doc with `org_id` |
| `scout_completed` | `Scout_Agent.Market_Intelligence` | ≥ 1 doc with `org_id` |
| `profiler_analyzed` | `Profiler.ICP_config` | non-empty `icps` for `user_id` |

`unlocked = ready_count == 4`. The completeness logic for `icp_configured` is shared with the connect-time gate (5.5).

**Scope semantics (resolved):** warmup is evaluated for the **requesting `(org_id, user_id)` pair**. Three milestones are org-scoped; `profiler_analyzed` is necessarily user-scoped because `Profiler.ICP_config` is keyed by `user_id` only (no `org_id`). Consequence: for an org with multiple members, the profiler milestone reflects the *querying* user, and the org-level tile therefore reflects that user's profiler progress. Acceptable at MVP (typically one operator per org). True org-level profiler readiness would require an `org_id` backfill on `ICP_config` — flagged as tech debt, not done here.

### 5.5 Connect + ICP-completeness gate (UC6) + master-key validation
`POST /connectors/apollo/connect` (extends existing), in order:
1. **Check 1 — profile completeness.** Reuse `icp_configured` logic. If incomplete → `409 {code:"profile_incomplete", missing_section}`; connection blocked.
2. **Check 2 — key validity & capability.** A free **1-record `api_search` probe** (`per_page:1, page:1`). Confirms the key is a *master* key with search access in one call (no credits). `401` → `ConnectorCredentialsInvalidError` (400, "Invalid key"); `403` → `ApolloAPIError` surfaced as `{code:"master_key_required"}`.

On both passing: store credentials; tile appears **Locked** until warmup completes.

### 5.6 Credit awareness (UC9/UC10) — extend `GET /connectors/apollo/status`
```jsonc
{ "connected": true, "status": "connected", "connected_at": "...",
  "credits_consumed_total": 1234,          // cumulative, from credits_consumed
  "last_run_credits": 48,
  "low_credit": false,                      // reactive only
  "last_discovery_at": "...",
  "last_discovery_icp_fingerprint": "...",
  "icp_changed_since_last_discovery": true }
```
- **No balance read** (Apollo exposes none). `credits_consumed_total` is accumulated from each reveal response — accurate *spend*, not *remaining*.
- **`low_credit`** is **reactive**: set `true` when a run hits credit pressure (`402` / `422`-credit / `ApolloCreditsExhaustedError`); cleared on the next run that **successfully reveals ≥ 1 lead** without a credit error. An empty run reveals nothing, spends no credits, and gives no credit-health signal, so it leaves `low_credit` unchanged.
- **UC9 (key health):** a `401` during any run sets credential `status:"error"`; existing Apollo-sourced leads untouched; tile shows Error until reconnected.

### 5.7 ICP-change detection + existing-lead management (UC5/UC7)
- Each completed run stores `icp_fingerprint` = **SHA-1 of a canonical JSON serialization** of the ICP's *semantic* fields (`primary_region`, `industry[]`, `company_size[]`, `buyer_role[]`, `fit_confidence`, `location[]`, `additional_context`) — arrays lowercased, trimmed, and sorted; volatile fields (`id`, `created_at`, `status`) excluded. SHA-1 (used as a plain hash, not for security) is chosen because the fingerprint is **persisted in the run doc and surfaced in `/status`** (`last_discovery_icp_fingerprint`) — a compact stable key beats storing/re-serializing the full normalized JSON on every comparison. A single shared `icp_fingerprint(icp)` helper produces it for both the write (run doc) and the read (status comparison) so the scheme cannot drift. `status` compares the current active ICP's fingerprint to the last run's → `icp_changed_since_last_discovery`.
- **UC7 (re-discovery guard):** FE-only prompt when `icp_changed_since_last_discovery == false`. Backend still honors a confirmed request.
- **UC5 (existing-lead management):** `discover` takes `mode: "keep" | "replace"`. `keep` (default) adds net-new. `replace` uses a **no-loss swap**: prior discovery leads (`source:"apollo"` AND `apollo_origin:"discovery"`) are first **tagged `superseded`** (a boolean property), then discovery runs, then — **only after the new leads commit** — the superseded leads are deleted. If the run fails (credit/API/restart), the `superseded` tag is cleared and the old leads are restored intact; **no delete happens before successful ingest**. CSV and import-sourced leads are never touched.
  - **Dedup vs. visibility:** while tagged, `superseded` leads are **excluded from the pre-reveal dedup** (5.2 step 3) so the same people can be re-discovered, but they **remain visible in agent views** until the swap commits — so the user never sees an empty Apollo set during the ~1–3 min run. The accepted lesser-evil is a brief old+new overlap at the commit instant; on success the superseded set is deleted (old rows vanish, new remain), on failure the tag is cleared.
  - **Orphan-tag cleanup:** the stale-run failover that retires hung runs (5.3) also un-tags `superseded` leads left by a run killed between tag and swap — on app startup and at the top of each `POST /discover`, any `processing` replace-run past its stale threshold is marked `failed` and its leads un-superseded. A killed replace never leaves leads permanently mis-tagged.
- **Download-before-replace:** `GET /connectors/apollo/leads/export?org_id` returns the org's discovery leads as a **bounded, non-streaming** dump — JSON, or CSV via `format=csv` (a flat fixed-column projection via the stdlib `csv` writer — no nested fields, minimal surface). CSV is kept (not deferred): it is the format users expect for "download my leads," and the small lead set makes pagination/streaming unnecessary.

### 5.8 Lead model additions (Neo4j `Lead`)
Additive, fill-only-empty preserved. `source` already exists.

| Field | Purpose |
|---|---|
| `email_status` | `"verified"` \| `"unverified"` \| null — confidence signal from reveal; drives FE badge |
| `apollo_origin` | `"discovery"` \| `"import"` — distinguishes discovery leads (for replace/export scoping) |
| `discovery_run_id` | ties a lead to its discovery run |
| `superseded` | transient boolean set during a `replace` swap — excluded from dedup but **still shown in agent views**; deleted on success, cleared on failure (5.7) |

`normalize_apollo_record` gains `email_status` in its canonical set (null for import paths, which don't return it).

### 5.9 Endpoint surface (all under `/connectors/apollo/`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/discover` | queue discovery run — body `{org_id, user_id, icp_id?, mode, max_leads?}` → `{run_id, status:"queued"}`. **Single-flight:** `409 {code:"discovery_in_progress"}` if a `queued`/`processing` run exists for the org (the stale-run failover first retires runs past the threshold). `422 {code:"icp_underspecified"}` if the selected ICP fails the completeness bar. |
| GET | `/discover/status` | `?org_id&run_id` → run doc + `progress_percent` |
| GET | `/warmup` | `?org_id&user_id` → 4-milestone readiness |
| GET | `/leads/export` | `?org_id&format=json|csv` → discovery leads (UC5 download) |
| POST | `/connect` *(extended)* | + ICP-completeness gate + master-key probe |
| GET | `/status` *(extended)* | + credit/ICP-change fields |

### 5.10 Models & exceptions
- New Pydantic models in `app/models/` (`ApolloDiscoverRequest/Response`, `ApolloDiscoverStatusResponse`, `ApolloWarmupResponse`, extended `ApolloStatusResponse`).
- New exceptions reusing the connector mapping: `ProfileIncompleteError → 409`, `ApolloSearchError → 502` (search-specific transport failures). Master-key 403 surfaced via `ApolloAPIError` with a `code`.

---

## 6. Frontend design

The 2026-06-04 design owns visual detail; this section wires it to the verified contracts and resolves the import-vs-discovery mismatch. Per repo rule, FE is built against shapes confirmed via `/docs` or a live call.

### 6.1 Data layer
Hand-authored **zod contracts** + **TanStack Query hooks** in `src/shared/api/` + a feature slice, all via `apiFetch` and the 30 req/min limiter:
- `useApolloWarmup` (polls while Locked), `useApolloStatus`, `useDiscover` (mutation), `useDiscoverStatus` (polls while Running), `useExportApolloLeads`.

### 6.2 Apollo tile + connection modal (Mission Control → Data Sources)
- Tile slots into the existing Data Sources surface (`DataSourcesManager` / connector area, `features/mission-control`).
- Single-step modal: logo, one-line description, **"requires a master API key"** helper + "where do I find it?" link, key input, Connect. Runs the two checks (5.5); on `profile_incomplete`, show the error + a deep-link button to `missing_section`.

### 6.3 Warmup progress + unlock toast
- Locked tile shows "`ready_count` of 4 agents ready" + "view what's remaining" (lists `missing[]` with deep links).
- **App-wide toast** fires on the Locked→Unlocked edge: "Apollo discovery is now ready. Start finding leads." → link to Mission Control. **Mechanism:** a low-frequency warmup poll mounted at the app shell (in/near `TenantContext`), active only while Apollo is *connected but locked* and independent of the Mission Control route, so the edge is caught wherever the user is. The toast fires **once** per unlock, deduped via a persisted `apollo_unlock_notified` flag (per org); the poll stops once unlocked. Polling-only (no SSE/WebSocket) at MVP.

### 6.4 Discovery flow + tile state mapping
Discover Leads → **UC7 guard** (when `icp_changed == false`) → **UC5 keep/replace/download prompt** (when `icp_changed == true` AND discovery leads exist) → `POST /discover` → poll status.

| Tile state | Driven by |
|---|---|
| Locked | `warmup.unlocked == false` |
| Unlocked | `unlocked == true`, no active run; `low_credit` ⇒ persistent warning (UC10) |
| Running | latest run `queued`/`processing` (spinner; button disabled) |
| Complete | run `completed` + `finished_at` |
| Error | run `failed` **or** credential `status == "error"` (UC9) |
| Complete · `partial` | run `partial` — displays the leads that **did** land, plus a non-blocking warning banner ("discovery was interrupted — some leads may be missing"); button restored for retry |
| Complete · zero results | run `completed_empty` → "No leads found for your current ICP" + deep-link to widen ICP (UC8); a sub-state of Complete, not a distinct tile state |

### 6.5 Source filter + confidence badge
- Source filter (All / CSV / Apollo) on Scout Lead Stream toolbar and Profiler lead table — filters the existing pool on `source`; no new lead endpoint.
- Rows where `email_status == "unverified"` show a small **"Unverified"** badge (the chosen quality-gate behavior). This is the one row-level visual distinction (Section 9).

### 6.6 Low-credit warning (UC10)
Persistent warning beside Discover Leads whenever `status.low_credit == true` (reactive). Optionally surface `credits_consumed_total` / `last_run_credits` as an informational figure. No "remaining" number (Apollo exposes none).

---

## 7. Use-case handling (UC1–UC10)

| UC | Handling in this design |
|---|---|
| UC1 — No CSV, Apollo only | Connect → warmup → Discover → leads (source=apollo) fill the pool; Scout/Profiler populate from them. |
| UC2 — CSV + Apollo | CSV flow unchanged; discovery adds net-new; pre-reveal dedup (by Apollo id) + ingestion dedup skip overlaps; source filter separates them. |
| UC3 — CSV only | Unchanged; no Apollo UI unless connected. |
| UC4 — Activation gate | Discover Leads disabled until `warmup.unlocked`; progress + unlock toast. |
| UC5 — ICP change | `icp_changed` badge; on Discover, keep/replace/download prompt; backend honors `mode` (replace = no-loss swap, §5.7); export endpoint backs "download before replacing". |
| UC6 — ICP completeness | Connect Check 1 (`409 profile_incomplete` + deep link). |
| UC7 — Re-discovery guard | FE prompt when `icp_changed == false`. |
| UC8 — Zero results | `completed_empty` → empty-state + widen-ICP deep link. |
| UC9 — Key health | `401` → credential `status:"error"`; tile Error; existing leads untouched. |
| UC10 — Low credit | Reactive `low_credit` after credit pressure; persistent tile warning; spend tracked via `credits_consumed`. |

---

## 8. Known seams & risks
1. **Master-key requirement** — many Apollo users only have a regular key; the connect probe surfaces this clearly, but it is a real onboarding friction. Documented in modal copy.
2. **Search obfuscation** — last names (and some fields) are masked pre-reveal; ICP-fit scoring and the LLM re-rank rely on title/seniority/org, which are present. Dedup keys on Apollo `id`, not name.
3. **`people/match` reveal latency** — sequential ~1s/lead × `max_leads`(50) ≈ ~1 min plus rate-limit backoff; the stale-run threshold scales with `max_leads` (§5.3) so large runs aren't falsely retired. Raising `max_leads` materially raises run time and credit burn.
4. **No credit balance** — UC10 cannot warn before the first credit error unless we later add a user-entered allotment (deferred).
5. **In-process background tasks** — non-durable on Render restart; the run doc + stale failover surface a stalled run to the FE.
6. **`normalize_apollo_record` shape coverage** — must tolerate the `api_search` person shape (has `has_email`, no `email`) and the `people/match` shape (has `email`/`email_status`, no `has_email`); separate test cases for each (§10).
7. **Master API keys stored in cleartext in Mongo** — and a master key controls a *paid credit pool*, so a leak has direct financial impact. Encryption stays deferred per MVP posture (§11), but the exposure is flagged for future implementers.
8. **`replace` is a no-loss swap, not delete-then-write** (§5.7) — old discovery leads stay visible and are removed only after new leads commit; a mid-run failure restores them. A `superseded` tag left by a process killed mid-swap is cleared by the stale-run failover on the next startup / `POST /discover` (§5.7), so leads are never permanently mis-tagged. Accepted UX: a brief old+new overlap at the commit instant.

---

## 9. Divergences from the 2026-06-04 frontend design
Recorded explicitly because that doc is the product reference and is treated as frozen intent.

1. **"Discover Leads" = `api_search` prospecting**, not import-from-lists. (The design assumed a discovery capability that did not exist; this spec builds it.)
2. **Row-level confidence badge for unverified emails.** The design says "no visual difference on individual lead rows." Because reveal returns mixed `email_status`, we keep any revealed email but **mark unverified ones**. This is a deliberate, product-approved change.
3. **UC10 is reactive, not threshold-on-balance.** The design's "credits running low" implied a known balance; Apollo exposes none, so it is reactive + spend-tracking. The design's open decision ("exact credit threshold — to be confirmed with Apollo API docs") is hereby resolved: not available; reactive instead.
4. **Connect surfaces a master-key requirement** not mentioned in the design.

---

## 10. Testing
Fixture-based, **patch-where-used** per `backend/TESTING.md`:
- Canned `api_search` and `people/match` JSON fixtures (incl. `has_email:false`, obfuscated last name, verified + unverified, no-match, `credits_consumed`).
- Unit tests: `build_search_filters` (incl. `422` on an underspecified ICP); `normalize_apollo_record` **with separate cases for the `api_search` and `people/match` shapes**; `icp_fingerprint` (stable across re-serialization, changes on a semantic edit); free funnel (`has_email` + zero-overlap drop + dedup); LLM re-rank (mocked LLM, incl. failure → deterministic fallback); reveal loop + spend accumulation; quality gate; keep ingestion; **`replace` no-loss swap (success deletes superseded; failure restores)**; export; the single-flight `409` guard.
- **Pipeline integration test:** a transport-level mock of the Apollo HTTP client (monkeypatched, patch-where-used) feeding canned multi-page `api_search` + sequential `people/match` responses, asserting end-to-end counts/credit totals and stage interactions — without hitting the live API.
- Warmup detection: seeded Mongo fixtures for each of the four stores + the all-four unlock edge + a per-check error → `false` (degraded, no `500`).
- Connect: master-key 403 path, profile-incomplete 409 path.
- FE: vitest for hooks/contracts + tile-state mapping (incl. `partial` and `completed_empty` sub-states) + the guard/keep-replace prompt logic; MSW mocks for new endpoints.
- All run in `npm run preflight` (FE) and the backend pytest suite.

---

## 11. Out of scope (this phase)
| Item | Deferred to |
|---|---|
| Lead enrichment as a *user* feature ("Add Column") | Strategist phase (discovery reuses reveal internally) |
| Lookalike discovery | Later phase |
| Stale-data refresh / re-enrichment | Later phase |
| Retroactive enrichment of pre-Apollo CSV leads | CRM integration phase |
| OAuth connection | Later (API key for now) |
| Per-agent Apollo controls | Not planned (single control point) |
| Live "N found so far" progress | Not in scope (spinner only) |
| Durable job queue / checkpoint-resume | Later (MVP in-process tasks) |
| User-entered credit allotment / predictive UC10 | Later (reactive for now) |
| Security hardening (encrypt keys, authz) | Out of scope at MVP per repo `CLAUDE.md` |

---

## 12. Resolved decisions
| Decision | Resolution |
|---|---|
| Apollo credit threshold for low-credit warning | **Not available** from Apollo API → reactive after 402/422 + cumulative `credits_consumed`; no predictive threshold. |
| Minimum lead completeness (quality gate) | Pre-reveal: `has_email == true`. Post-reveal: keep any **revealed email**; store `email_status`; mark `unverified` as lower-confidence. |
| Max leads per discovery run | Default **50** (`MAX_LEADS_DEFAULT`), hard cap **200**; search-scan cap **500** candidates. Tunable. |
| Reveal mechanism | Single `POST /people/match` by Apollo `id` (not `bulk_match`). |
| Connect validation | Master-key `api_search` probe (free) + ICP-completeness gate. |

**Sources (Apollo API, verified 2026-06-12):** People API Search, People Enrichment, Bulk People Enrichment, View API Usage Stats (`docs.apollo.io/reference/...`); "Apollo.io API Guide 2026" (builtbyjoey.com) for the `api_search`-vs-`search` path, `has_email` field, and the search-id↔`bulk_match` gotcha.
