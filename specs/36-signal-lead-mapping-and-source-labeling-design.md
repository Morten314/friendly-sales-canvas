# Signal↔Lead Relevance Mapping + Lead Source Labeling — Design Spec

**Date:** 2026-06-15
**NN:** 36
**Scope:** Cross-stack (backend + frontend)
**Status:** Design intent (output of brainstorming; revised after spec-review round 1)

---

## 1. Overview

This spec adds two cohesive lead-enrichment features:

1. **Signal↔Lead relevance mapping** — a read-time, LLM-ranked mapping between an org's
   existing **signals** (the Scout/Profiler market-intelligence feed) and its existing
   **leads** (the Neo4j CRM graph). It answers two questions from one computation:
   *"which signals are relevant to this lead?"* and *"which of my leads does this signal
   affect?"*
2. **Lead source labeling** — formalize the existing, half-formed `Lead.source` field into a
   real taxonomy, stamp it on every ingest path, surface it everywhere the leads are shown
   with real `source` (a multi-valued filter + per-lead badges).

Both features enrich the same entity (Lead). They share no code path, so the **plan phases
Feature #2 first** (small, low-risk, independently shippable) and Feature #1 second; they
remain one spec per the requesting decision.

### Key finding that shapes the design

Signals are **already generated aware of leads**. The batch generation path
(`app/services/signals/batch.py::_generate_signals_batch_impl`) calls
`get_leads_for_org(org_id, limit=100)` and injects up to 50 leads into the prompt via
`prompts/signals/signals_leads_section.md.j2`. That sub-template (paraphrased; the actual text
is `{{signal_label}}`-templated and renders "ICP signal" for the profiler persona) tells the
LLM to prioritize signals related to companies/industries/regions in the leads pipeline and to
check signal company-mentions against the leads data. **But that linkage is soft and
discarded** — the LLM may mention a lead's company in free-text `headline`/`description`, and
nothing structured records which leads a signal touches.

Feature #1 recovers that linkage at **read time** (not generation time), so it stays live as
leads and signals change (within the windowing limit in §5.2), and requires **no change to the
signal document schema**.

### Surface reality (verified against code — drove the round-1 revision)

There are two lead tables in the FE, with very different data backing:

- **customers/LeadStream** (`features/customers/components/lead-stream/LeadStream.tsx`,
  exported as `LeadStreamPanel`) renders a hardcoded `mockLeads` array with
  `hasProspectData = true`; its only props are `{filterByICP, onClearFilter}`. It has **no API
  wiring**, mock ids, no `source` on rows, and no `signals` field. This spec **wires it to real
  leads** (see §5.7/§6.3).
- **market-research/LeadsTable** (`features/market-research/components/lead-stream/LeadsTable.tsx`)
  renders **real Live-API data** (`baseLeads = apiHeatmapLeads ?? heatmapLeads`) from
  `POST /leads/market-scores`, falling back to a sample only when the API is empty. Its real
  rows carry the **real Neo4j `lead_id`** (`mapMarketScoresRowToHeatmapLead` →
  `id: String(row.lead_id)`), and the backend scores leads read via `get_leads_for_org`
  (`market_scoring/orchestrator.py`) — the **same id space as the mapping**, so the join is
  valid. Its one gap: `source` is hardcoded `"Prospect List"` in the mapper and is absent from
  `LeadMarketScoreRow`.

Both surfaces consume the shared `features/connectors/lib/leadSource.ts` filter.

### Relationship to prior artifacts

- **`specs/27-frontend-phase-8-signals-strategist-design.md`** — the signals feature + the
  Strategist (`StrategistContext.leads[].signals?: string[]` / `.source?: string`, currently
  unpopulated). The Strategist is **not** a surface for this spec (§2 Non-goals).
- **`specs/35-apollo-discovery-design.md`** — introduced `Lead.source` (`"apollo"`/`"csv"`),
  `apollo_origin`, and the FE binary source filter (`leadSource.ts`). Feature #2 generalizes
  that filter and taxonomy.

---

## 2. Goals / Non-goals

**Goals**
- Surface, for each lead, the org's signals relevant to it (and the inverse: each signal's
  affected leads), computed by one LLM call over the whole org and reused across surfaces.
- Stay faithful to how signals already work: reuse `fetch_signals`, `get_leads_for_org`, the
  prompt loader, and the `_claude_budget` Claude-call path; reuse the *derived-doc storage*
  idea (cf. `signal_track`) and the *cache-or-compute `refresh`* idea (cf.
  `run_signals_research`). The input-set **fingerprint** in §5.4 is a **new** mechanism, not a
  reuse. No signal-schema change; no persisted hard link.
- Promote `Lead.source` to a real taxonomy stamped by every ingest path, surfaced (filter +
  badge) on every lead table that carries real `source`.

**Acceptance criteria** (functional + verifiable; MVP-appropriate — no latency/quality SLAs
while there are 0 users):
1. `POST /signal-lead-map_claude` for an org with ≥ 1 signal and ≥ 1 lead returns a
   `mapping` array; each entry has a `signal_id` and a `leads[]` list (possibly empty) whose
   entries carry `lead_id`, `company`, `relevance`, and `why`. An org with no signals or no
   leads returns `mapping: []` with `status: "success"`.
2. A second call with the same signal set and lead set and `refresh=false` returns the cached
   mapping (`cached: true`) without a new Claude call; `refresh=true` forces recompute
   (`cached: false`).
3. The cache fingerprint changes when the org's signal set **or** lead set changes, forcing
   recompute on the next non-refresh call.
4. A Claude failure (after retries) returns `{ status: "success", data: { mapping: [] } }` —
   never HTTP 500 — so no consumer surface breaks. (A missing `ANTHROPIC_API_KEY` is a
   separate config error, §5.1.)
5. Every lead-creating path stamps a specific `source`: Apollo discovery/import → `apollo`,
   batch upload → `csv`, manual create → `manual`. Leads with absent/empty/unrecognized source
   read as `unknown`. `LeadMarketScoreRow` carries `source` (read from the Neo4j lead).
6. **market-research LeadsTable** and **customers/LeadStream** (now wired to real leads) filter
   by source across the live values (`all`/`apollo`/`csv`/`manual`/`unknown`) using **exact
   match**, and each lead row shows a source badge driven by the real `source`.
7. **market-research LeadsTable** and **customers/LeadStream** show per-lead "N relevant
   signals" (expandable) joined on real `lead_id`; each signal card on the Signals page shows
   "Affects N leads" — all driven by the single mapping and all quiet when zero.

**Non-goals**
- **No signal-document schema change** and **no persisted signal↔lead relationship** on either
  entity. The mapping lives only in a disposable derived cache (§5.4).
- **No per-lead title-level ranking.** Ranking is whole-org (one call); two leads at the same
  company see the same relevance for a given signal.
- **No new API connectors** (HubSpot, Salesforce). Those source values are *reserved* in the
  taxonomy (§6.1) but not produced; each real connector is its own future spec.
- **No new leads-list endpoint.** Wiring customers/LeadStream reuses the existing paginated
  `GET /api/v2/leads` (→ `get_leads_for_org`, which already returns `source`).
- **No Strategist wiring.** `StrategistContext.leads[].signals[]` stays as-is.
- **No backfill / migration / feature flag** (MVP posture). Legacy null sources normalize at
  read; the cache self-populates on first call.
- **No auth/security changes** (MVP posture per repo `CLAUDE.md`).

---

## 3. Current state (what we build on)

**Signals** (`app/services/signals/`):
- Generated via `/generate-signals-batch_claude`: 2 scout + 2 profiler signals per batch, each
  an independent Claude+Tavily call.
- Persisted to Mongo `Signals.signals`, one doc per signal. Shape:
  `headline, snippet, description, sourceUrl, sourceLabel, source[], nextBestMoves[], NBAs[],
  contextualSuggestions[]` + metadata `id, signal_id, user_id, agent, timestamp, batch_id,
  org_id?`. **No company/lead field.**
- Read via v2 `GET /fetch-signals` (paginated, **user-scoped**) →
  `persistence.fetch_signals(mongo, user_id, limit, offset)`.
- **Structured-JSON-from-Claude template:** `search_signals` / `run_signals_research`
  (`search.py`) → Claude call via `_claude_budget` → parsed by `parsing.py`
  (`_parse_search_signals_response` → `_extract_research_json`). **Note:** `signal_ask_claude`
  (`ask.py`) is *not* this template — it joins Claude content blocks into **plain text**, has
  **no cache/refresh**, and does **not** call `_extract_research_json`. We reuse `ask.py` only
  for its `_claude_budget` call mechanism and its `_get_signal_ask_customer_profile` helper.

**Leads** (`app/services/leads/`, Neo4j `Lead` nodes):
- `get_leads_for_org(driver, org_id, limit, offset)` → `(items, total)`, newest first; returns
  the **full node** (so `source`, `lead_id`, `company`, etc. are all present).
- Exposed as `GET /leads` (`get_all_leads`, all leads) and paginated `GET /api/v2/leads`.
- `Lead.source` ∈ `{"apollo", "csv", null}` set fill-only-empty via
  `l.source = coalesce(l.source, $source)` in connector ingestion; `apollo_origin`,
  `discovery_run_id` further qualify Apollo leads.
- `batch_upload_leads` (`app/services/leads/orchestrator.py`) sets **no** `source`;
  `create_lead` (`persistence.py`) sets **no** `source`. (Both are net-new assignments in §6.2,
  not refactors of an implicit value.)

**Market scoring** (`app/services/market_scoring/`):
- `POST /leads/market-scores` scores the org's leads (read via `get_leads_for_org`) and returns
  `LeadMarketScoreRow[]`: `lead_id, org_id, file_id?, company_name, lead_name, score_*,
  combined_score, …`. **No `source` field** (added in §6.2).

**Frontend:**
- `features/connectors/lib/leadSource.ts`: `LeadSourceFilter = "all" | "csv" | "apollo"`, where
  `"csv"` is a **catch-all** (`source !== "apollo"`). Consumed by **both** customers/LeadStream
  and market-research LeadsTable (and re-exported from `features/connectors/index.ts`).
- `features/connectors/components/UnverifiedBadge.tsx` is the existing per-row badge pattern.
- `features/signals/components/SignalCard.tsx` renders a signal; `features/signals/services/`
  + `shared/api/` (TanStack Query + zod) is the data layer.
- `shared/lib/leadData.ts` `HeatmapLead.source` is a **required** `"HubSpot" | "Prospect List"`
  union (the sample rows); these legacy values normalize to `unknown` (§6.3).

---

## 4. Architecture

One read-time computation, multiple views, plus an independent labeling change.

```
Feature #1 (signal↔lead mapping)
  FE: useSignalLeadMap(orgId)  ──POST /api/signal-lead-map_claude──▶  BE: build_signal_lead_map_claude
        │  signalsForLead(id)                                              │
        │  leadsForSignal(id)                                             ├─ fetch_signals(user_id, limit=50)
        ▼                                                                 ├─ get_leads_for_org(org_id, 100)
   ┌───────────────┬──────────────┬───────────────────┐                  ├─ ICP/company profile
   │ LeadsTable    │ LeadStream   │ Signals page      │                   ├─ cache check (fingerprint)
   │ "N signals"   │ "N signals"  │ "Affects N leads" │                   ├─ 1× Claude call (_claude_budget, on miss)
   └───────────────┴──────────────┴───────────────────┘                  └─ Signals.signal_lead_map (derived cache)

Feature #2 (source labeling)
  ingest paths ──stamp source──▶ Lead.source ──read (incl. market-scores row)──▶ normalizeLeadSource() ──▶ filter + LeadSourceBadge
```

---

## 5. Feature #1 — Signal↔Lead relevance mapping

### 5.1 Endpoint

`POST /signal-lead-map_claude` in `app/routers/signals.py`, delegating to
`signals_service.build_signal_lead_map_claude(...)`. Claude-backed only (the FE uses `_claude`
variants exclusively); no Qwen sibling.

Request model `SignalLeadMapRequest` (sibling to `SignalActionRequest` in
`app/models/signals.py`):

```python
class SignalLeadMapRequest(BaseModel):
    user_id: str
    org_id: str
    refresh: bool = False
```

**`ANTHROPIC_API_KEY` check:** done in the **router**, raising `HTTPException(500)` (mirroring
`generate_signals_batch_claude`, not the service-level `ServiceError` of `signal_ask_claude` —
the two existing `_claude` endpoints differ; we pick the router pattern explicitly). This is a
**config-presence** check (a deploy error), distinct from AC #4's runtime model-failure
degradation: a missing key is a 500; a Claude *call* failure degrades to an empty mapping.

### 5.2 Service

New module `app/services/signals/lead_map.py`. Public symbol re-exported from
`app/services/signals/__init__.py`.

`build_signal_lead_map_claude(driver, mongo, request)` — signature takes neither the Qwen
`agent_chain` nor `pc` (both unused; the router does not depend on `get_agent_chain`). Steps:
1. **Cache check** — `_get_cached_lead_map(mongo, request.org_id, request.user_id)`; compute
   current fingerprint (§5.4); if `not request.refresh` and cached fingerprint matches → return
   cached mapping with `cached: true`.
2. **Fetch signals** — `persistence.fetch_signals(mongo, request.user_id, limit=50, offset=0)`
   (same **user-scoped** read as the feed; `limit=50` caps how many signals enter one Claude
   call). If empty → return `mapping: []`. **Windowing:** only the newest 50 signals are
   mapped; an accepted limitation at MVP volume (see §5.6).
3. **Fetch leads** — `get_leads_for_org(driver, request.org_id, limit=100)` (same call
   generation uses). If empty → return `mapping: []`.
4. **Context** — reuse `_get_signal_ask_customer_profile(mongo, org_id)` / ICP-config helpers
   for ICP/company-profile grounding.
5. **Render + call** — render `prompts/signals/signals_lead_map.md.j2`, make **one** Claude
   call via the `_claude_budget` path (the call mechanism `signal_ask_claude` and the batch
   Claude path both use).
6. **Parse** — extract JSON via `parsing.py`'s `_extract_research_json` (the helper
   `search_signals` uses — *not* `ask.py`). Normalize to the §5.3 shape. Defensive cleanup:
   (a) drop any `lead_id`/`signal_id` the LLM invents that isn't in the inputs; (b) tolerate a
   **structurally-truncated** `mapping[]` by using the valid parsed prefix (a truncated tail is
   discarded, not treated as a hard failure — see §5.6).
7. **Cache write** — `_save_lead_map(mongo, org_id, user_id, mapping, fingerprint)`; log +
   swallow on failure (still return the computed mapping).

The Claude call is wrapped in `asyncio.to_thread`; persistence is sync with `asyncio.to_thread`
at the call site.

### 5.3 Response shape

```jsonc
{
  "status": "success",
  "data": {
    "mapping": [
      {
        "signal_id": "…",
        "headline": "…",                       // convenience echo (see note)
        "leads": [
          { "lead_id": "…", "company": "Acme", "relevance": "high", "why": "Hiring surge matches…" }
        ]
      }
    ],
    "generated_at": "2026-06-15T…Z",
    "cached": false
  }
}
```

- `relevance` ∈ `{"high","medium","low"}` (a small categorical set — easier for the LLM and the
  badges than a float; revisit only if a numeric score is needed later).
- The **per-lead view is derived**, not stored: a lead's signals = every `mapping[]` entry
  whose `leads[]` contains that `lead_id`.
- The `headline` echo is retained for the **per-lead surfaces** (LeadsTable/LeadStream show
  signal headlines without re-fetching the full feed). The Signals page already holds full
  signal objects, so it may ignore the echo and join on `signal_id`.

### 5.4 Derived cache

Mongo collection `Signals.signal_lead_map`, one doc per **(org, user)** — because the signal
feed is **user-scoped** (`fetch_signals` filters by `user_id`) while leads are org-scoped, the
mapping is per-user; keying by org alone would let two users in one org overwrite each other's
cache:

```jsonc
{ "_id": "<org_id>:<user_id>", "mapping": [ … ], "fingerprint": "<hash>", "generated_at": "…" }
```

- **Intended semantics:** per-user signal scoping is deliberate — the mapping reflects the
  signals *this user* sees in their own feed, mapped against the org's shared leads. Two users
  in one org can therefore get different "Affects N leads" answers; that mirrors the
  user-scoped feed and is accepted, not a bug.
- **Not a hard link** — a disposable projection of (a user's signals × the org's leads). Safe
  to drop and recompute at any time.
- **Fingerprint** = stable hash of `sorted(signal_ids) + sorted(lead_ids)` from steps 2–3.
  This invalidation mechanism is **new** (neither `run_signals_research`'s latest-write lookup
  nor `signal_track`'s headline-dedup has a content fingerprint). Any added/removed signal or
  lead changes it, recomputing on the next non-refresh call. Edits to a lead's fields without
  an id change do **not** invalidate — acceptable; `refresh=true` is the escape hatch.
- Index: `_id` is the natural key (no extra index needed).

### 5.5 Prompt

New `prompts/signals/signals_lead_map.md.j2`, inputs: `signals_json`, `leads_json`,
`context_json`. It instructs Claude to, for each signal, list the leads/companies it is
genuinely relevant to (matching on company name, industry, region, tech, or explicit company
mentions — the same matching `signals_leads_section.md.j2` already describes), assign
`relevance`, and give a one-line `why`. Output: the exact JSON of `mapping[]` (§5.3), no prose.
Reuses `_shared/final_answer_json_directive.md.j2`.

### 5.6 Resilience & cost

- **Token volume:** the input bound is 50 signals × 100 leads. The expected output is a
  `mapping[]` of ≤ 50 entries, each with a (typically short) `leads[]` subset — not a dense
  5,000-cell matrix, since most signals touch few leads. Typical MVP orgs are far below the
  caps. Still, the prompt + output must fit the `_claude_budget` window; if the model truncates
  the JSON, step 6 uses the valid parsed prefix (a partial mapping) rather than failing.
- **Retries:** the Claude call retries twice (matching `_SIGNAL_BATCH_MAX_RETRIES` /
  `run_signals_research`'s `max_retries = 2`); on persistent failure → `mapping: []`,
  `status: "success"`. Cache **write** failure is logged + swallowed. The endpoint never
  surfaces a Claude/parse failure as a 500.
- **Opaque-empty caveat:** because a model-down failure and a genuinely-empty mapping both
  return `mapping: []` with `status:"success"`, the consumer cannot distinguish them; debugging
  "why is everything empty?" relies on server logs. Accepted at MVP.
- **Cache-miss double-spend:** two concurrent `refresh=false` calls on a cold/invalid cache
  both miss and both fire a Claude call (no inflight de-dup / lock). Accepted at 0 users; a
  guard is deferred (trigger: real concurrent users on one (org,user) key).

### 5.7 Frontend

- **Service** (`features/signals/services/signals.ts`): `fetchSignalLeadMap(userId, orgId, { refresh })`
  → `POST /api/signal-lead-map_claude` via `apiFetch`.
- **Contract** (`shared/api/contracts/signals.ts` or feature contracts): zod — strict on
  `mapping[].leads[]` fields we read (`lead_id`, `company`, `relevance`, `why`), `.passthrough()`
  on signal extras. Confirm the live JSON via `/docs`/`curl` before writing the FE.
- **Hook** `useSignalLeadMap(orgId)` (TanStack Query): resolves `userId` from `AuthContext` and
  includes **both** `orgId` and `userId` in the `queryKey` (the cache is per-(org,user)).
  Fetches once; exposes `signalsForLead(leadId)` and `leadsForSignal(signalId)` selectors.
  Exposed through `features/signals/index.ts` for cross-feature import (import-x requires the
  barrel).
- **Surface A1 — market-research LeadsTable** (`features/market-research/components/lead-stream/`):
  a per-row **"N relevant signals"** affordance joined on the real `lead_id`, expanding to
  signal headlines + one-line `why`. Quiet when zero.
- **Surface A2 — customers/LeadStream** (`features/customers/components/lead-stream/`): **wire
  `LeadStreamPanel` to real leads** — fetch via the existing paginated `GET /api/v2/leads`
  (`get_leads_for_org`), replace `mockLeads` and the hardcoded `hasProspectData`, add `id`
  (real `lead_id`) and `source` to the row shape, restore the real empty state. Then add the
  same per-row "N relevant signals" affordance. (This is FE-only; the endpoint exists.)
- **Surface B — Signals page** (`features/signals/components/SignalCard.tsx`): an **"Affects N
  leads"** section listing affected companies/leads from `leadsForSignal`. Quiet when zero. No
  dependency on either lead table.
- All surfaces degrade silently on empty/loading mapping.

---

## 6. Feature #2 — Lead source labeling

### 6.1 Canonical taxonomy

| Value | State | Produced by |
|---|---|---|
| `apollo` | live | Apollo discovery + import (existing) |
| `csv` | live | Batch file upload (CSV/Excel — one upload path) |
| `manual` | live | `create_lead` (manual add) |
| `unknown` | live | Read-time fallback for absent/empty/unrecognized source |
| `hubspot` | reserved | (future connector / upload-tagging) |
| `salesforce` | reserved | (future connector / upload-tagging) |

Reserved values are spelled out so a future connector lands on a consistent token, but they are
**not** produced and **not** selectable in the filter now. (`excel` is *not* reserved — Excel
uploads share the single file-upload path and are labeled `csv`.)

### 6.2 Backend — stamp every ingest path + expose source on the score row

- **Apollo discovery/import** → `source = "apollo"` (already done; no change).
- **Batch upload** (`app/services/leads/orchestrator.py::batch_upload_leads`) → **net-new
  assignment** of `source = "csv"` at ingest (it sets none today).
- **Manual `create_lead`** (`app/services/leads/persistence.py`) → **net-new assignment** of
  `source = "manual"` when the caller did not supply one (respect an explicit value if given,
  matching the flexible-key philosophy).
- **Legacy leads** (null/absent source) → **no backfill write**; normalized to `unknown` at
  read (§6.3). The fill-only-empty `coalesce` ingestion semantics are preserved.
- **Market-scores row** — add `source: Optional[str]` to `LeadMarketScoreRow`
  (`app/models/market_scoring.py`), populated from the Neo4j lead in `_lead_to_score_row` /
  the status/row builders (`market_scoring/normalization.py` / `orchestrator.py`). The scored
  leads already come from `get_leads_for_org`, which returns `source`, so this is a passthrough.
- The existing `GET /leads` and `GET /api/v2/leads` already return `source` (full node) — no
  change needed there.

### 6.3 Frontend

- `features/connectors/lib/leadSource.ts`:
  - `LeadSourceFilter = "all" | "apollo" | "csv" | "manual" | "unknown"`.
  - New `normalizeLeadSource(raw: string | null | undefined): LeadSource` — lowercases and maps
    known tokens to themselves; everything else (null, empty, legacy "HubSpot"/"Prospect List",
    etc.) → `"unknown"`.
  - `filterLeadsBySource` switches from catch-all to **exact match** on the normalized source.
  - `LEAD_SOURCE_OPTIONS` updated to the live values.
- **Badge** — new `LeadSourceBadge` (sibling to `UnverifiedBadge` in
  `features/connectors/components/`), color/icon per source; exposed via the connectors
  `index.ts`. Shown on **both** lead tables' rows.
- **market-research LeadsTable mapper** (`marketScoresHeatmap.ts`): stop hardcoding
  `source: "Prospect List"`; preserve the real `source` from the API row (added in §6.2),
  normalized via `normalizeLeadSource`.
- **customers/LeadStream**: now renders real leads (§5.7 A2) carrying real `source` → badge +
  filter are real.

### 6.4 Behavior change called out

Today "CSV only" shows **all non-Apollo** leads (catch-all). After this change, exact-match
filtering moves leads with an unrecognized/legacy source (incl. the `HeatmapLead`
"HubSpot"/"Prospect List" sample values) into `unknown`. This is an intentional behavior change
on **both** consuming tables (LeadsTable and LeadStream), acceptable at 0 users; recorded here
so it is not mistaken for a regression.

---

## 7. API contract summary (cross-stack surface)

| Path | Method | Request | Response (`data`) |
|---|---|---|---|
| `/signal-lead-map_claude` | POST | `SignalLeadMapRequest` | `{ mapping: [...], generated_at, cached }` |
| `/leads/market-scores` | POST | (existing) | `LeadMarketScoreRow[]` **+ new `source` field per row** |
| `/api/v2/leads` | GET | (existing) | paginated leads incl. `source` (no change) |

- The new endpoint's backend response is typed as a `Dict[str, Any]` envelope (consistent with
  the other permissive signals responses); the FE zod contract is the strict reader.
- Update the **backend first**, confirm the live JSON shape (`/docs`/`curl`), then write the FE
  consumer — per repo cross-stack rule (no generated client).

---

## 8. Testing

**Backend** (pytest, patch-where-used per `backend/TESTING.md`; the real suite under
`backend/tests/`, not the root production probes):
- Mock the Claude call, `fetch_signals`, `get_leads_for_org`, cache reads/writes. Cover:
  (a) mapping parse from representative LLM JSON; (b) cache miss → compute → write; (c) cache
  hit on matching fingerprint (no Claude call); (d) `refresh=true` forces recompute;
  (e) fingerprint changes when the signal set or lead set changes; (f) graceful `mapping: []`
  on Claude failure; (g) empty signals or empty leads → `mapping: []` without a Claude call;
  (h) defensive drop of invented ids; (i) truncated-JSON → valid-prefix mapping.
- `create_lead` stamps `source="manual"` (respects explicit); `batch_upload_leads` stamps
  `source="csv"`.
- `LeadMarketScoreRow` includes `source` from the Neo4j lead (passthrough from
  `get_leads_for_org`).

**Frontend** (vitest; run with `--no-file-parallelism` per the known sandbox flake; run
`prettier --check` on touched files):
- `normalizeLeadSource` table (known tokens, null/empty, legacy "HubSpot"/"Prospect List" →
  `unknown`).
- `filterLeadsBySource` exact-match across all live values — tested on **both** LeadsTable and
  LeadStream consumers.
- `useSignalLeadMap` selectors (`signalsForLead`/`leadsForSignal` inversion from a fixture);
  empty/loading behavior; queryKey includes userId+orgId.
- `marketScoresHeatmap` mapper preserves real `source` (no longer hardcoded).
- customers/LeadStream renders fetched real leads (MSW-mocked `GET /api/v2/leads`), empty state
  restored.
- `LeadSourceBadge` render per source.
- MSW-mocked `/api/signal-lead-map_claude` for the LeadsTable/LeadStream "N relevant signals"
  and the SignalCard "Affects N leads" surfaces.

---

## 9. Rollout (MVP posture)

No feature flag, no migration, no backfill. Legacy null sources normalize to `unknown` at read;
the `Signals.signal_lead_map` cache self-populates on first call. **Plan phasing:** Feature #2
(source taxonomy/stamping/badge/filter — small, low-risk, no LLM) lands first and independently;
Feature #1 (mapping endpoint + cache + surfaces) second. Ship FE+BE as coordinated atomic
commits where they pair (e.g. the `LeadMarketScoreRow.source` add + its mapper consumer), and
as separate commits otherwise, per the monorepo commit-granularity rules. Merge behind a green
`frontend/ npm run preflight` and the relevant backend pytest module.

---

## 10. Open questions / future extensions

- **Upload-tagging** — let a CSV/Excel upload self-declare its originating system (HubSpot
  export, CRM export), populating a reserved source value without an API connector. Natural
  next step that activates the reserved taxonomy values.
- **Real connectors** — HubSpot/Salesforce API integrations (OAuth, field mapping, sync) — each
  its own spec; they would produce their reserved source values directly.
- **Numeric relevance score** — if categorical `high/medium/low` proves too coarse.
- **Cache-miss concurrency guard** — inflight de-dup / `setnx` lock once concurrent users exist.
- **Mapping precompute** — trigger a background recompute when a signal batch completes, if
  first-view latency becomes a concern. Unnecessary at MVP volume.
