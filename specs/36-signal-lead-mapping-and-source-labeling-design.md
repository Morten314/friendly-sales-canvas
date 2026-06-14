# Signal↔Lead Relevance Mapping + Lead Source Labeling — Design Spec

**Date:** 2026-06-14
**NN:** 36
**Scope:** Cross-stack (backend + frontend)
**Status:** Design intent (output of brainstorming)

---

## 1. Overview

This spec adds two cohesive lead-enrichment features:

1. **Signal↔Lead relevance mapping** — a read-time, LLM-ranked mapping between an org's
   existing **signals** (the Scout/Profiler market-intelligence feed) and its existing
   **leads** (the Neo4j CRM graph). It answers two questions from one computation:
   *"which signals are relevant to this lead?"* and *"which of my leads does this signal
   affect?"*
2. **Lead source labeling** — formalize the existing, half-formed `Lead.source` field into a
   real taxonomy, stamp it on every ingest path, and replace the binary FE filter with a
   multi-valued filter + per-lead source badges.

Both features enrich the same entity (Lead) and are small enough to share one spec and one
implementation plan.

### Why these two together

The frontend `StrategistContext` (`frontend/src/features/strategist/types.ts`) already
declares the two fields these features produce — `leads[].signals?: string[]` and
`leads[].source?: string` — but both are unpopulated / ad-hoc today. This spec gives both a
real backing computation and a real surfacing, without coupling them to each other.

### Key finding that shapes the design

Signals are **already generated aware of leads**. The batch generation path
(`app/services/signals/batch.py::_generate_signals_batch_impl`) calls
`get_leads_for_org(org_id, limit=100)` and injects up to 50 leads into the prompt via
`prompts/signals/signals_leads_section.md.j2`, which instructs the LLM to *"Prioritize
signals that relate to companies/industries/regions in your leads pipeline"* and *"If a
signal mentions a company or organization, check if it matches any entity in your leads
data."* **But that linkage is soft and discarded** — the LLM may mention a lead's company in
free-text `headline`/`description`, and nothing structured records which leads a signal
touches.

Feature #1 recovers that linkage at **read time** (not generation time), so it stays live as
leads and signals change, and requires **no change to the signal document schema**.

### Relationship to prior artifacts

- **`specs/27-frontend-phase-8-signals-strategist-design.md`** — the signals feature + the
  Strategist that declares the consumer fields. The Strategist is **not** a surface for this
  spec (see §2 Non-goals).
- **`specs/35-apollo-discovery-design.md`** — introduced `Lead.source` (`"apollo"`/`"csv"`),
  `apollo_origin`, and the FE binary source filter (`leadSource.ts`). Feature #2 generalizes
  that filter and taxonomy.

---

## 2. Goals / Non-goals

**Goals**
- Surface, for each lead, the org's signals relevant to it (and the inverse: each signal's
  affected leads), computed by one LLM call over the whole org and reused across surfaces.
- Stay faithful to how signals already work: reuse `fetch_signals`, `get_leads_for_org`, the
  prompt loader, the `_claude` budget path, and the cache-or-compute `refresh` pattern of
  `run_signals_research`. No signal-schema change; no persisted hard link.
- Promote `Lead.source` to a real taxonomy stamped by every ingest path, with a multi-valued
  FE filter and per-lead badges.

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
   never HTTP 500 — so neither the LeadStream nor the Signals page breaks.
5. Every lead-creating path stamps a specific `source`: Apollo discovery/import → `apollo`,
   batch upload → `csv`, manual create → `manual`. Leads with absent/empty/unrecognized
   source read as `unknown`.
6. The customers/LeadStream filters leads by source across the live values
   (`all`/`apollo`/`csv`/`manual`/`unknown`) using **exact match**, and each lead row shows a
   source badge.
7. The customers/LeadStream shows per-lead "N relevant signals" (expandable), and each signal
   card on the Signals page shows "Affects N leads" — both driven by the single mapping and
   both quiet when zero.

**Non-goals**
- **No signal-document schema change** and **no persisted signal↔lead relationship** on either
  entity. The mapping lives only in a disposable derived cache (§5.4).
- **No per-lead title-level ranking.** Ranking is whole-org (one call); two leads at the same
  company see the same relevance for a given signal.
- **No new API connectors** (HubSpot, Salesforce, Pipedrive, Zoho). Those source values are
  *reserved* in the taxonomy (§6.1) but not produced; each real connector is its own future
  spec.
- **No Strategist wiring.** `StrategistContext.leads[].signals[]` stays as-is; the mapping is
  surfaced on the LeadStream and Signals page only.
- **No backfill / migration / feature flag** (MVP posture). Legacy null sources normalize at
  read; the cache self-populates on first call.
- **No auth/security changes** (MVP posture per repo `CLAUDE.md`).

---

## 3. Current state (what we build on)

**Signals** (`app/services/signals/`):
- Generated via `/generate-signals-batch_claude` (the endpoint the FE calls): 2 scout + 2
  profiler signals per batch, each an independent Claude+Tavily call.
- Persisted to Mongo `Signals.signals`, one doc per signal. Shape:
  `headline, snippet, description, sourceUrl, sourceLabel, source[], nextBestMoves[], NBAs[],
  contextualSuggestions[]` + metadata `id, signal_id, user_id, agent (scout|profiler),
  timestamp, batch_id, org_id?`. **No company/lead field.**
- Read via v2 `GET /fetch-signals` (paginated, **user-scoped**) →
  `persistence.fetch_signals(mongo, user_id, limit, offset)`.
- Dedup via derived doc `Signals.signal_track[_id=track_key].headlines`.
- `signal_ask_claude` is the closest existing template: read org signals + customer profile +
  a question → one Claude call → structured answer.

**Leads** (`app/services/leads/`, Neo4j `Lead` nodes):
- `get_leads_for_org(driver, org_id, limit=500, offset=0)` → `(items, total)`, newest first.
- `Lead.source` ∈ `{"apollo", "csv", null}` set fill-only-empty via
  `l.source = coalesce(l.source, $source)` in connector ingestion; `apollo_origin`,
  `discovery_run_id` further qualify Apollo leads.
- `create_lead` stores arbitrary key/value data and sets a default `stage` but **does not set
  `source`**.

**Frontend:**
- `features/connectors/lib/leadSource.ts`: `LeadSourceFilter = "all" | "csv" | "apollo"`, where
  the `"csv"` bucket is a **catch-all** (`source !== "apollo"`) that also swallows legacy mock
  labels ("HubSpot", "Prospect List").
- `features/customers/components/lead-stream/LeadStream.tsx` renders the lead table and uses
  `LEAD_SOURCE_OPTIONS`; `features/connectors/components/UnverifiedBadge.tsx` is the existing
  per-row badge pattern.
- `features/signals/components/SignalCard.tsx` renders a signal; `features/signals/services/`
  + `shared/api/` (TanStack Query + zod) is the data layer.

---

## 4. Architecture

One read-time computation, two views, plus an independent labeling change.

```
Feature #1 (signal↔lead mapping)
  FE: useSignalLeadMap(orgId)  ──POST /api/signal-lead-map_claude──▶  BE: build_signal_lead_map_claude
        │  signalsForLead(id)                                              │
        │  leadsForSignal(id)                                             ├─ fetch_signals(user_id)
        ▼                                                                 ├─ get_leads_for_org(org_id)
   ┌──────────────┬───────────────────┐                                  ├─ ICP/company profile
   │ LeadStream   │ Signals page      │                                  ├─ cache check (fingerprint)
   │ "N signals"  │ "Affects N leads" │                                  ├─ 1× Claude call (on miss)
   └──────────────┴───────────────────┘                                  └─ Signals.signal_lead_map (cache)

Feature #2 (source labeling)
  ingest paths ──stamp source──▶ Lead.source ──read──▶ normalizeLeadSource() ──▶ filter + LeadSourceBadge
```

---

## 5. Feature #1 — Signal↔Lead relevance mapping

### 5.1 Endpoint

`POST /signal-lead-map_claude` in `app/routers/signals.py`, delegating to
`signals_service.build_signal_lead_map_claude(...)`. Claude-backed only (the FE uses `_claude`
variants exclusively); no Qwen sibling unless a later need appears.

Request model `SignalLeadMapRequest` (sibling to `SignalActionRequest` in
`app/models/signals.py`):

```python
class SignalLeadMapRequest(BaseModel):
    user_id: str
    org_id: str
    refresh: bool = False
```

The `CLAUDE_API_KEY` availability check lives in the router (same as the other `_claude`
endpoints).

### 5.2 Service

New module `app/services/signals/lead_map.py`, modeled on `ask.py` (signal_ask_claude) +
`search.py::run_signals_research`. Public symbol re-exported from
`app/services/signals/__init__.py`.

`build_signal_lead_map_claude(driver, mongo, agent_chain, request)` steps (signature mirrors
the other signals services; Pinecone `pc` is **not** used here — the mapping grounds on
signals + leads + ICP only — so it is omitted):
1. **Cache check** — `_get_cached_lead_map(mongo, request.org_id, request.user_id)`; compute
   current fingerprint (§5.4); if `not request.refresh` and cached fingerprint matches → return
   cached mapping with `cached: true`.
2. **Fetch signals** — `persistence.fetch_signals(mongo, request.user_id, limit=50, offset=0)`
   (same **user-scoped** read as the feed; `limit=50` caps how many signals enter one Claude
   call — generous vs the feed's default page of 10). If empty → return `mapping: []`.
3. **Fetch leads** — `get_leads_for_org(driver, request.org_id, limit=100)` (identical to
   generation). If empty → return `mapping: []`.
4. **Context** — reuse `_get_signal_ask_customer_profile(mongo, org_id)` / ICP-config helpers
   for ICP/company-profile grounding.
5. **Render + call** — render `prompts/signals/signals_lead_map.md.j2`, make **one** Claude
   call via the existing `_claude_budget` path (the same mechanism `signal_ask_claude` uses).
6. **Parse** — extract JSON via the `_extract_research_json` helper family used elsewhere in
   `parsing.py`; normalize to the response shape (§5.3), dropping any `lead_id`/`signal_id` the
   LLM invents that isn't in the inputs (defensive).
7. **Cache write** — `_save_lead_map(mongo, org_id, mapping, fingerprint)`; log + swallow on
   failure (still return the computed mapping).

Side-effect discipline mirrors the signals services: the Claude call is wrapped in
`asyncio.to_thread`; persistence is sync with `asyncio.to_thread` at the call site.

### 5.3 Response shape

```jsonc
{
  "status": "success",
  "data": {
    "mapping": [
      {
        "signal_id": "…",
        "headline": "…",                       // convenience echo for the signal view
        "leads": [
          { "lead_id": "…", "company": "Acme", "relevance": "high", "why": "Hiring surge matches…" }
        ]
      }
    ],
    "generated_at": "2026-06-14T…Z",
    "cached": false
  }
}
```

- `relevance` ∈ `{"high","medium","low"}` (a small categorical set — easier for the LLM and
  the badges than a float; revisit only if a numeric score is needed later).
- The **per-lead view is derived**, not stored: a lead's signals = every `mapping[]` entry
  whose `leads[]` contains that `lead_id`.

### 5.4 Derived cache

Mongo collection `Signals.signal_lead_map`, one doc per (org, user) — because the signal feed
is **user-scoped** (`fetch_signals` filters by `user_id`) while leads are org-scoped, the
mapping is per-user; keying by org alone would let two users in one org overwrite each other's
cache:

```jsonc
{ "_id": "<org_id>:<user_id>", "mapping": [ … ], "fingerprint": "<hash>", "generated_at": "…" }
```

- **Not a hard link** — a disposable projection of (a user's signals × the org's leads). Safe
  to drop and recompute at any time.
- **Fingerprint** = stable hash of `sorted(signal_ids) + sorted(lead_ids)` from steps 2–3.
  Any added/removed signal or lead changes it, invalidating the cache on the next non-refresh
  call. (Edits to a lead's fields without an id change do **not** invalidate — acceptable;
  `refresh=true` is the escape hatch.)
- Cache-or-compute mirrors `run_signals_research`'s `refresh` flag; the derived-doc pattern
  mirrors `signal_track`. Index: `_id` is the natural key (no extra index needed).

### 5.5 Prompt

New `prompts/signals/signals_lead_map.md.j2` (Jinja2 body, served by `app/core/prompts.py`),
inputs: `signals_json`, `leads_json`, `context_json`. It instructs Claude to, for each signal,
list the leads/companies it is genuinely relevant to (matching on company name, industry,
region, tech, or the signal's explicit company mentions — the same matching logic
`signals_leads_section.md.j2` already describes), assign `relevance`, and give a one-line
`why`. Output: the exact JSON of `mapping[]` (§5.3), no prose. Reuses
`_shared/final_answer_json_directive.md.j2`.

### 5.6 Resilience

- Claude call retries twice (matching `_SIGNAL_BATCH_MAX_RETRIES` / `run_signals_research`'s
  `max_retries = 2`); on persistent failure → return `mapping: []`, `status: "success"`.
- Cache **write** failure is logged + swallowed.
- The endpoint never propagates the Claude/parse failure as a 500 — a broken mapping must not
  break the leads list or the signals feed (both are primary surfaces).

### 5.7 Frontend

- **Service** (`features/signals/services/signals.ts`): `fetchSignalLeadMap(userId, orgId, { refresh })`
  → `POST /api/signal-lead-map_claude` via `apiFetch` (the `/api/*` proxy already exists; no
  new proxy rule).
- **Contract** (`shared/api/contracts/signals.ts` or feature contracts): zod — strict on
  `mapping[].leads[]` fields we read (`lead_id`, `company`, `relevance`, `why`), `.passthrough()`
  on signal extras (consistent with the existing permissive signals contracts). Per repo rule:
  confirm the live JSON via `/docs` or `curl` against the running backend before writing the FE.
- **Hook** `useSignalLeadMap(orgId)` (TanStack Query): fetches once, exposes
  `signalsForLead(leadId)` and `leadsForSignal(signalId)` selectors over the in-memory mapping.
  Exposed through `features/signals/index.ts` so `features/customers` imports it via the barrel
  (import-x `no-internal-modules` requires this).
- **Surface A — customers/LeadStream** (`features/customers/components/lead-stream/`): a per-row
  **"N relevant signals"** affordance that expands to the signal headlines + one-line `why`.
  Quiet when zero. Uses `signalsForLead`.
- **Surface B — Signals page** (`features/signals/components/SignalCard.tsx`): an **"Affects N
  leads"** section listing affected companies/leads. Quiet when zero. Uses `leadsForSignal`.
- Both surfaces degrade silently on empty/loading mapping (no error UI).

---

## 6. Feature #2 — Lead source labeling

### 6.1 Canonical taxonomy

A single source vocabulary, split into live vs reserved:

| Value | State | Produced by |
|---|---|---|
| `apollo` | live | Apollo discovery + import (existing) |
| `csv` | live | Batch file upload (CSV/Excel — one upload path) |
| `manual` | live | `create_lead` (manual add) |
| `unknown` | live | Read-time fallback for absent/empty/unrecognized source |
| `hubspot` | reserved | (future connector / upload-tagging) |
| `salesforce` | reserved | (future connector / upload-tagging) |
| `excel` | reserved | (future, if Excel is split from generic file upload) |

Reserved values are spelled out so a future connector lands on a consistent token, but they
are **not** produced and **not** selectable in the filter now. Excel uploads currently share
the single file-upload path and are labeled `csv`; `excel` stays reserved until/unless that
path is split.

### 6.2 Backend — stamp every ingest path

- **Apollo discovery/import** → `source = "apollo"` (already done; no change).
- **Batch upload** (`app/routers/leads.py` / leads upload service) → ensure `source = "csv"`
  is set explicitly at ingest (make explicit if currently implicit).
- **Manual `create_lead`** (`app/services/leads/persistence.py`) → set `source = "manual"`
  when the caller did not supply one (respect an explicit value if provided, matching the
  flexible-key philosophy of that function).
- **Legacy leads** (null/absent source) → **no backfill write**; normalized to `unknown` at
  read on the FE (§6.3). The fill-only-empty `coalesce` semantics in connector ingestion are
  preserved.

### 6.3 Frontend

- `features/connectors/lib/leadSource.ts`:
  - `LeadSourceFilter = "all" | "apollo" | "csv" | "manual" | "unknown"`.
  - New `normalizeLeadSource(raw: string | null | undefined): LeadSource` — lowercases and maps
    known tokens to themselves; everything else (null, empty, legacy "HubSpot"/"Prospect
    List", etc.) → `"unknown"`.
  - `filterLeadsBySource` switches from catch-all to **exact match** on the normalized source.
  - `LEAD_SOURCE_OPTIONS` updated to the live values (with display labels).
- **Badge** — new `LeadSourceBadge` component (sibling to `UnverifiedBadge` in
  `features/connectors/components/`), color/icon per source, shown on LeadStream rows (and lead
  detail if present). Exposed via the connectors `index.ts` for cross-feature use.

### 6.4 Behavior change called out

Today "CSV only" shows **all non-Apollo** leads (catch-all). After this change, exact-match
filtering moves leads with an unrecognized/legacy source out of the `csv` bucket and into
`unknown`. This is an intentional behavior change, acceptable at 0 users; recorded here so it
is not mistaken for a regression.

---

## 7. API contract summary (cross-stack surface)

| Path | Method | Request | Response (`data`) |
|---|---|---|---|
| `/signal-lead-map_claude` | POST | `SignalLeadMapRequest` | `{ mapping: [...], generated_at, cached }` |

- Backend response typed as a `Dict[str, Any]` envelope (consistent with the other permissive
  signals responses); the FE zod contract is the strict reader.
- Update the **backend first**, confirm the live JSON shape (`/docs` or `curl`), then write the
  FE consumer — per repo cross-stack rule (no generated client).

---

## 8. Testing

**Backend** (pytest, patch-where-used per `backend/TESTING.md`; the real suite under
`backend/tests/`, not the root production probes):
- Mock the Claude call, `fetch_signals`, `get_leads_for_org`, and the cache reads/writes.
- Cover: (a) mapping parse from a representative LLM JSON; (b) cache miss → compute → write;
  (c) cache hit on matching fingerprint (no Claude call); (d) `refresh=true` forces recompute;
  (e) fingerprint changes when the signal set or lead set changes; (f) graceful `mapping: []`
  on Claude failure after retries; (g) empty signals or empty leads → `mapping: []` without a
  Claude call; (h) defensive drop of LLM-invented ids not in the inputs.
- `create_lead` stamps `source="manual"` (and respects an explicit source).

**Frontend** (vitest; run with `--no-file-parallelism` per the known sandbox flake; run
`prettier --check` on touched files):
- `normalizeLeadSource` table (known tokens, null/empty, legacy labels → `unknown`).
- `filterLeadsBySource` exact-match across all live values.
- `useSignalLeadMap` selectors: `signalsForLead` / `leadsForSignal` inversion from a fixture
  mapping; empty/loading behavior.
- `LeadSourceBadge` render per source.
- MSW-mocked `/api/signal-lead-map_claude` for the LeadStream "N relevant signals" and the
  SignalCard "Affects N leads" surfaces.

---

## 9. Rollout (MVP posture)

No feature flag, no migration, no backfill. Legacy null sources normalize to `unknown` at
read; the `Signals.signal_lead_map` cache self-populates on first call. Ship FE+BE as
coordinated atomic commits where they pair (the new endpoint + its consumer), separate commits
otherwise, per the monorepo commit-granularity rules. Merge behind a green
`frontend/ npm run preflight` and (for the backend) the relevant pytest module.

---

## 10. Open questions / future extensions

- **Upload-tagging** — let a CSV/Excel upload self-declare its originating system (HubSpot
  export, CRM export), populating a reserved source value without an API connector. Natural
  next step that activates the reserved taxonomy values.
- **Real connectors** — HubSpot/Salesforce API integrations (OAuth, field mapping, sync) —
  each its own spec; they would produce their reserved source values directly.
- **Numeric relevance score** — if the categorical `high/medium/low` proves too coarse for
  sorting/UX.
- **Mapping precompute** — if read-time latency on first view becomes a concern, trigger a
  background recompute when a signal batch completes (piggybacking on generation). Deferred:
  conflicts with nothing here, but unnecessary at MVP volume.
