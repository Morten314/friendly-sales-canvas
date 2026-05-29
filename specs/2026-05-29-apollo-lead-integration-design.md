# Apollo lead integration — import & enrichment (v1)

**Status:** Design (approved in brainstorming 2026-05-29)
**Date:** 2026-05-29
**Paired plans:** split by stack — `plans/apollo-lead-integration-backend.md` (to be written now) and `plans/apollo-lead-integration-frontend.md` (**deferred** until the frontend refactor completes — see §12)
**Author:** brainstorming session (re-grounded against the post-refactor codebase, not the pre-refactor analysis docs)

> **Grounding note:** The `docs/analysis/**` documents predate a large backend/frontend
> refactor and are stale on architecture/code-layout. This spec was re-derived directly
> from the current code. Product behaviour is unchanged, so the product-level decisions
> are unaffected; only concrete module/seam references were re-grounded.

---

## 1. Goal

Let a customer connect their own Apollo.io account and (a) **import** their Apollo leads into
Brewra's lead store, and (b) **enrich** leads already in Brewra with Apollo data, on demand.
Imported leads flow into the existing `Lead` graph so the Scout/Profiler agents can research
and score them like any other lead.

This is the first third-party lead-source connector. It is built behind a thin connector
seam so a deferred HubSpot adapter can slot in later — **without** building a plugin system now.

## 2. Scope

### 2.1 In scope (v1)

- **Apollo only.** Connect via the customer's Apollo **API key** (no OAuth).
- **Import** the customer's existing Apollo **Contacts** (their own saved/enriched people),
  optionally scoped to a chosen Apollo **list (label)**. On-demand pull (a "Sync now" click).
- **Enrich** leads already in Brewra: the customer selects leads and triggers Apollo
  enrichment; matched fields are written back **fill-only-empty**.
- **Dedup by identity:** people by normalized **email**, companies by normalized **domain**.
- **Auto-map** Apollo fields to a small canonical set; keep unmapped fields as raw passthrough.
- **Connector module** (`app/services/connectors/`) + a single `ApolloConnector`, reusing the
  existing lead-write path, the "lead-stream file" tracking abstraction, and the market-scoring
  background-run pattern. Stays on FastAPI `BackgroundTasks`.
- **Frontend:** an Apollo connector card + API-key entry, an "Import from Apollo" action, and a
  **real, multi-selectable** lead list with an "Enrich with Apollo" bulk action (this requires
  wiring `LeadStream.tsx` to real data — see §7).

### 2.2 Out of scope (v1)

- **Clay** and **HubSpot** (both deferred). Clay specifically has *no read API* and can only push
  to a webhook; revisit if/when demand justifies a webhook receiver.
- **Net-new Apollo People Search** prospecting (`/mixed_people/api_search`) — returns IDs with no
  emails and would burn enrichment credits per row. Future extension.
- **Scheduled / automatic sync** and any **webhook** receiver (including Apollo's async *waterfall*
  enrichment, which delivers emails/phones to a webhook). Enrichment uses the **synchronous**
  match endpoints only.
- **Writing anything back to Apollo** (one-directional, inbound).
- **Security hardening** — consistent with the current MVP posture (0 users): per-org credentials
  are stored unhardened (see §5.4), tenancy stays parameter-based. Neither hardened nor removed.
- **A durable job queue / checkpoint-resume.** Reliability rests on idempotency (see §8).
- Retrofitting dedup / fill-only-empty onto the CSV `batch-upload` path (possible later; not now).

### 2.3 Success criteria

1. Customer enters + validates an Apollo API key and sees "Connected".
2. Customer clicks **Import from Apollo** (optionally picks a list); a background run pulls their
   Apollo Contacts, auto-maps fields, dedups by email/domain, and writes them as `Lead` records
   visible in the lead stream — tracked as a named batch they can re-run or delete.
3. Customer selects leads (checkboxes) and clicks **Enrich with Apollo**; a background run fills
   **only empty** fields on matched leads and reports progress.
4. Re-importing the same contacts **updates rather than duplicates**.

## 3. Current architecture this builds on (verified 2026-05-29)

- FastAPI app factory in `app/main.py`; `lifespan` builds `app.state.clients`
  (`ClientBundle{driver, graph, client=Mongo, s3_client, pc}`) and registers routers via
  `include_router`. **No global `/api` prefix on the app itself**; domain routers use their own
  prefix (`/leads`, …); v2 routers mount at `prefix="/v2"`. The modern paginated read path is
  `GET /v2/leads`. (The frontend reaches the backend through the `vite.config.ts` `/api/*` proxy,
  so a FE call to `/api/connectors/...` maps to backend route `/connectors/...`.)
- Dependency injection: `app.core.dependencies.get_neo4j_driver`, `get_mongo`, `get_s3`,
  `get_pinecone` (FastAPI `Depends`, sourced from `app.state.clients`).
- Async work: **FastAPI `BackgroundTasks` only** (market-scoring, doc embedding). No queue exists.
- Canonical background-run pattern (`app/services/market_scoring/orchestrator.py`): a Mongo
  **run-doc** (`run_id`, `status ∈ {queued, processing, completed, failed}`) with **stale-run
  failover** (a new run marks an abandoned queued/processing run `failed`) + a separate
  `GET …/status` endpoint. This spec mirrors it for enrichment runs.
- Raw HTTP uses **`requests`** (`app/services/_llm_helpers.py` calls the Claude Messages API with
  an `x-api-key` header). `httpx` is **not** a dependency. `requests`, `pandas`, `openpyxl` are.
- Lead writes go through `app/services/_neo4j_helpers.upsert_node(tx, label, key, value, data)` —
  `MERGE` on the key field, `SET` provided properties (escaping; JSON-encodes dict/list).
- `batch_upload_leads` (`app/services/leads/orchestrator.py`) writes `file_id` onto each `Lead`
  node **and** inserts a tracking doc into Mongo `Profiler.Lead_Stream_Files`. Therefore
  `list_leads_by_file`, `delete_leads_by_file`, and `get_stream_status` already work for any
  batch that follows the same convention. **The Apollo import reuses this verbatim.**
- All current secrets (Anthropic, Tavily, Pinecone, AWS) are **Brewra-global env vars**
  (`app.core.config`). There is **no** per-customer credential store today.

## 4. Architecture & components

New backend package `app/services/connectors/` (sibling to `leads/`, `market_scoring/`,
`data_sources/`):

| Module | Responsibility | Key dependencies |
|---|---|---|
| *(no `base.py` in v1)* | The connector "seam" is a **documented method surface** on `ApolloConnector` (`validate_credentials()`, `fetch_contacts(filters)`, `enrich(records, reveal)`, `list_collections()`) — **not a formal ABC**. A `typing.Protocol` is the ceiling if a type is wanted (no registry/loader). A formal interface is extracted only when a second adapter (HubSpot) is specced. | — |
| `apollo.py` | `ApolloConnector` (concrete) — the only code that knows Apollo exists. `requests` to a module-constant base URL `https://api.apollo.io/api/v1` with `x-api-key`; `/contacts/search` pagination; `/people/bulk_match` (≤10/call) for enrichment; lists via Apollo labels; 429 backoff; credit-exhausted detection; maps Apollo's raw JSON. The API key is **passed in** (from `credentials.py`), not read from config. | `requests` |
| `normalize.py` | Raw Apollo record → Brewra **canonical** lead dict (see §5.1); preserves the raw record; derives normalized dedup keys (email, domain). | — |
| `ingestion.py` | Provider-agnostic (operates on the normalized canonical dict, not on a connector type): the atomic `upsert_lead_by_email` (match-hierarchy dedup + coalesce fill-only-empty, §5.3), `MERGE` company-by-domain, register/update the import batch in `Lead_Stream_Files`, and the enrichment run-doc lifecycle. Reuses leads persistence; uses `_neo4j_helpers` for the company `MERGE` and new-lead create. | Neo4j, Mongo |
| `credentials.py` | Per-org credential get/set/validate against `Connector_Credentials` (Mongo). | Mongo |
| `__init__.py` | Re-exports the public service functions (house pattern). | — |

- Router: `app/routers/connectors.py`, `APIRouter(prefix="/connectors", tags=["connectors"])`,
  registered in `app/main.py`. Handlers use `Depends(get_neo4j_driver)` / `Depends(get_mongo)`.
- Models: `app/models/connectors.py` (Pydantic request/response models).

## 5. Data model, dedup & merge

### 5.1 Canonical fields

`normalize.py` maps Apollo fields → a small canonical set stored **flat** on the `Lead` node:
`name, first_name, last_name, email, title, seniority, company_name, company_domain, phone,
linkedin_url, location`. Bookkeeping added: `source="apollo"`, `apollo_contact_id` (source id),
`file_id` (= import batch id), `last_imported_at` / `last_enriched_at`. The **full raw Apollo
record** is stored under `apollo_raw` (a dict → JSON via `upsert_node`; re-parsed on read by
`_process_neo4j_lead_records`). No mapping UI; unmapped fields survive in `apollo_raw`.

### 5.2 What an imported record becomes

A Neo4j `Lead` node (same type CSV `batch-upload` produces) so it flows into the existing stream,
scoring and ICP tagging. Additionally `MERGE` a `Company` node by normalized **domain** and link
`(Company)-[:Has_Lead]->(Lead)` (existing relationship vocabulary).

### 5.3 Identity, dedup & merge — one uniform rule (import **and** enrichment)

**Match-key hierarchy** (applied within `org_id`, in order) — used identically by import and enrichment:
1. normalized **email** (`lower(trim(email))`);
2. else **`apollo_contact_id`** (Apollo's stable per-contact id) — covers email-less Apollo
   contacts so they dedup on re-import instead of duplicating (closes the success-criterion-4 hole);
3. else **create a new lead** (new `lead_id` UUID).

*(CSV-origin leads have no `apollo_contact_id`, so enrichment matches them on email only. A selected
lead with neither key is reported as **unmatched** in the run — never duplicated.)*

**Merge = fill-only-empty, atomic.** On a match, only populate empty fields — never overwrite an
existing value. Implemented as a new `upsert_lead_by_email` primitive using **per-property atomic
Cypher** in a single write transaction: `SET l.<prop> = coalesce(l.<prop>, $val)` per canonical
field. **Read-modify-write is explicitly rejected** — its read→write round-trip is not atomic and
would let two concurrent runs (import + CSV upload, or two enrich runs) clobber each other,
violating the contract. (`upsert_node` is unsuitable for the merge because it *overwrites* set
keys.) Bookkeeping fields (`apollo_contact_id`, `file_id`, `last_imported_at`/`last_enriched_at`)
always refresh.

**Company** dedup is by normalized registrable **domain** (strip scheme/path/`www`, lowercase).

Net effect: re-importing the same contacts updates rather than duplicates (with or without email);
neither import nor enrichment ever clobbers customer/CSV-entered data, even under concurrency. No
provenance tracking needed.

### 5.4 Storage of customer credentials

Mongo `Profiler.Connector_Credentials`, one doc per `(org_id, provider)`:
`{org_id, provider:"apollo", api_key, status, connected_at, updated_at}`. Validated by a cheap
authenticated Apollo call on save. Index on `(org_id, provider)`.

**Stored as-is (unencrypted) — a conscious risk acceptance, not a no-op.** This is a *different*
threat model from the existing Brewra-global keys: those are operator secrets in env/config — not
user-supplied, not API-readable, not tenant-scoped. `Connector_Credentials` holds a *customer's*
key in a collection reachable by any caller who supplies the matching `org_id`, and the backend
does not validate the caller's right to that `org_id` (the standing unauthenticated-tenant posture).
We accept this for v1 under the deliberate MVP security posture (§2.2; 0 users). **Hardening
trigger:** the first external/paying users, the pre-launch security pass, or the HubSpot OAuth work
— whichever lands first — at which point at-rest encryption and/or restricting which endpoints can
read the `api_key` field are revisited alongside tenant authz.

### 5.5 Run tracking

- **Import batch = a synthetic "file".** The import mints a `file_id`, writes it onto every
  imported `Lead`, and inserts/updates a `Lead_Stream_Files` doc exactly like `batch_upload_leads`
  (`processing → completed`, with `total_rows / created_count / error_count`). This lights up the
  existing `GET /leads/stream/status`, `GET /leads/by-file`, `DELETE /leads/by-file/{file_id}`
  with **no new CRUD**. The optional `label` becomes the batch's display `filename`.
- **Enrichment run** = its own Mongo doc `Profiler.Connector_Enrich_Runs`
  (`run_id, org_id, user_id, status, total, processed, updated, failed, errors[capped at 10],
  started_at, finished_at`), following the market-scoring run-doc + **stale-run failover** pattern.
  It is a *separate* collection from the import's `Lead_Stream_Files` on purpose: import reuses the
  file-batch surface to inherit its by-file CRUD + stream-status UI for free, whereas enrichment has
  no file/lead-set artifact to list — unifying would mean re-implementing that surface for no gain.

## 6. API surface

All under `app/routers/connectors.py` (`prefix="/connectors"`). Endpoints that make a blocking
Apollo call (`/connect` validation, `/lists`) are defined as sync `def` handlers so FastAPI runs
them in its threadpool — `requests` must not block the event loop. Import/enrich execute as sync
background-task functions.

*Connection*
- `POST /connectors/apollo/connect` `{org_id, user_id, api_key}` → validates via Apollo, stores
  creds, returns `{connected, status}`.
- `GET /connectors/apollo/status?org_id=` → `{connected, connected_at, status}`.
- `DELETE /connectors/apollo/connect?org_id=&user_id=` → disconnect (remove creds).
- `GET /connectors/apollo/lists?org_id=` → the customer's Apollo lists (labels) for the picker.
  `ApolloConnector` paginates the labels endpoint internally and returns the full set (a customer's
  own lists are typically few).

*Import (on-demand pull)*
- `POST /connectors/apollo/import` `{org_id, user_id, list_id?, label?}` → mints `file_id`, writes
  the initial `Lead_Stream_Files` doc, queues a `BackgroundTask`, returns
  `{file_id, status:"queued"}` immediately. The batch is tracked by `file_id` in
  `Lead_Stream_Files`; **progress is polled via the existing `GET /leads/stream/status`** (no
  separate import-status endpoint — import deliberately reuses the file-batch lifecycle).

*Enrichment (manual, on a selection)*
- `POST /connectors/apollo/enrich` `{org_id, user_id, lead_ids[], reveal_personal_emails?=true, reveal_phone_number?=false}`
  → creates an enrich run, queues a `BackgroundTask`, returns `{run_id, status:"queued"}`. The two
  `reveal_*` flags are optional request fields (defaults shown) so the credit-spending choice sits
  with the caller — no global config, no new settings surface in v1.
- `GET /connectors/apollo/enrich/status?org_id=&run_id=` → run-doc progress counters.

*Reused as-is:* `GET /v2/leads` (read), `GET /leads/stream/status`, `GET /leads/by-file`,
`DELETE /leads/by-file/{file_id}`.

### 6.1 Flows

**Import:** FE → `/import` returns instantly → background task loads creds → `ApolloConnector
.fetch_contacts(list_id)` paginates `/contacts/search` (100/page, backoff on HTTP 429) →
`normalize` each row → `ingestion.upsert_lead_by_email` (dedup, `MERGE` company-by-domain,
fill-only-empty) → increment `Lead_Stream_Files` counters → mark `completed`. Leads appear in the
stream as written.

**Enrichment:** FE sends selected `lead_ids` → background task loads those leads from Neo4j →
applies the §5.3 match hierarchy (email → `apollo_contact_id`) → calls `/people/bulk_match` in
batches of 10, passing the request's `reveal_personal_emails` / `reveal_phone_number` flags
(defaults `true` / `false`; phones cost extra credits and stay opt-in) → `normalize` results →
`upsert_lead_by_email` fill-only-empty write-back → update run-doc counters → mark `completed`.
Leads matching neither key are recorded as `unmatched` (not duplicated).

## 7. Frontend

> **Deferred — design intent only (see §12.2).** This section is the input to the *frontend*
> implementation plan, which is **not written until the frontend refactor (Spec 14) completes**.
> The file paths below are accurate to *today's* `src/components/**` / `src/pages/**` layout; they
> will be re-grounded into the `src/features/**` structure (per Spec 14 Phase 4 conventions) when
> the FE plan is authored. Do not implement from this section while the refactor is in flight.

Stack (verified): React + TanStack Query v5 + zod; shared API client at `src/shared/api/client.ts`
(`apiGet`/`apiPost`, JWT + rate-limit + zod-validate); query keys in `src/shared/api/queryKeys.ts`;
zod contracts in `src/shared/api/contracts/`; hook pattern per `useCompanyProfile`.

- **Contracts:** add `src/shared/api/contracts/connectors.ts` (ApolloStatus, Import, Enrich,
  EnrichStatus) and `leads.ts` (Lead, paginated LeadsResponse for `/v2/leads`).
- **Query keys:** add `leads(orgId)`, `apolloStatus(orgId)`, `apolloEnrichRun(runId)`.
- **Hooks:** `useLeads(orgId)` (GET `/v2/leads`), `useApolloStatus`, `useConnectApollo`(mutation),
  `useApolloLists`, `useApolloImport`(mutation), `useApolloEnrich`(mutation),
  `useApolloEnrichStatus(runId)` (polling query).
- **Settings → new "Integrations" tab:** `src/components/settings/IntegrationSettings.tsx` — masked
  Apollo API-key input, Connect/Disconnect, status pill. (Cleaner home than a modal.)
- **Mission Control / `DataSourcesManager.tsx`:** add an **Apollo** entry under "Connect to
  Systems" → "Import from Apollo" action (disabled until connected) with an optional list dropdown.
  Import progress shows via the existing lead-stream/upload-status surface.
- **`src/components/customers/LeadStream.tsx` (currently mock):** wire to `useLeads`, add a checkbox
  column + select-all + a bulk **Enrich with Apollo** button (enabled when ≥1 selected) with
  progress via `useApolloEnrichStatus` (mirroring the market-scoring progress pattern). Retires the
  mock `mockLeads` array on this surface.

## 8. Error handling & limits

- **Bad/expired key:** `/connect` validation returns a clear error; a runtime 401 flips connection
  `status="error"` and prompts reconnect; the run ends gracefully with a recorded reason.
- **Disconnect mid-run:** `DELETE /connect` is non-blocking and does **not** cancel running tasks
  (BackgroundTasks aren't cancellable). An in-flight run detects the missing/invalid credentials at
  its next Apollo call and ends `partial`/`failed` with a recorded reason — same path as a bad key.
- **Rate limit (429):** exponential backoff + retry in-task (base 1s, factor 2, max 30s, with
  jitter, ≤5 retries per request); if it still fails, the run records counters and ends
  `status="partial"`.
- **Credits exhausted:** enrich run stops, `status="partial"`, message "Apollo credits exhausted;
  X of Y enriched."
- **Per-row failures:** isolated `try/except`; `failed` counter increments; run continues; a capped
  sample of errors is stored on the run doc (mirrors `batch_upload`'s `errors[:10]`).
- **Durability (known limit):** `BackgroundTasks` die on Render restart with no checkpoint. Mitigation
  is **idempotency** — dedup + fill-only-empty mean re-clicking Import/Enrich after an interruption
  converges and never duplicates. Stale queued/processing runs are failed by the next run
  (market-scoring pattern). Durable queue = named fast-follow.
- **Caps / no silent truncation:** imports page up to a hard cap of **25,000 records per import
  run** (one product constant). On reaching it, paging stops and the batch ends `completed` with
  `capped=true` and a message ("Reached the 25,000-record import cap; narrow by Apollo list to
  import the rest"), surfaced through `GET /leads/stream/status`. No silent truncation (per the
  team's gate-posture preference).
- **Tenancy:** all reads/writes scoped by `org_id` (+ `user_id` where the existing code verifies it).
  Parameter-based, unhardened — unchanged from current posture.

## 9. Testing

- **Backend (pytest — primary):**
  - Unit: `normalize` mapping (Apollo raw → canonical), dedup-key derivation (email/domain), and the
    fill-only-empty merge (asserts existing values are never overwritten).
  - `ApolloConnector` against **recorded Apollo response fixtures** (no live API): pagination,
    429 backoff, `bulk_match` batching (≤10), credit-exhausted handling.
  - `ingestion` against a test/mocked Neo4j driver: dedup-by-email upsert, company `MERGE`-by-domain,
    no-clobber.
  - Endpoint happy-path with a mocked connector (`connect`, `import`, `enrich`, status), plus
    stale-run failover. Follows the repo's existing characterization-test + hand-crafted-fixture style.
- **Frontend (Vitest + MSW):** MSW handlers for the new endpoints; component tests for the connect
  form, multi-select + "Enrich with Apollo", and import progress.
- **No live Apollo calls in CI.** A Playwright import journey mirroring the CSV-upload journey is a
  nice-to-have *if* the e2e harness is present.

## 10. Decisions log

| # | Decision | Rationale |
|---|---|---|
| 1 | Apollo only; Clay + HubSpot deferred | Clay has no read API (push-to-webhook only), contradicting the chosen pull-only model; HubSpot deferred by the user. |
| 2 | Import + enrichment | Import supplies the initial lead pool; enrichment extends leads the customer already has (incl. CSV-uploaded) — both are needed for the Apollo connector to be useful without a second design round. |
| 3 | On-demand pull, no webhook/scheduler | Smallest infra; fits current `BackgroundTasks` reality; Apollo fully supports synchronous pull + enrich. |
| 4 | Import = existing Apollo Contacts (optional list), not net-new People Search | Truest "their leads data"; arrives usable; avoids burning enrichment credits at import. |
| 5 | Dedup by email (people) / domain (companies) | Industry-standard, predictable; enables clean re-sync + enrichment matching. |
| 6 | Enrichment manual on a selection; fill-only-empty | Keeps credit spend in the customer's control; never clobbers existing data; no provenance needed. |
| 7 | Auto-map to a canonical set; extras in `apollo_raw` | Leverages the flexible schema; no mapping wizard; consistent dedup keys. |
| 8 | Connector module + reuse + `BackgroundTasks`; **no formal ABC in v1** (concrete `ApolloConnector` + documented method surface); wire `LeadStream` + multi-select | Reuses lead-write + stream-file + run-doc patterns; a documented surface keeps the HubSpot seam without a speculative interface for one implementation (extract the ABC when HubSpot is specced); the selectable real lead list is required for enrichment. |
| 9 | Split implementation: backend plan now, frontend plan deferred until the FE refactor completes | Backend refactor is done (additive, conflict-free); the FE refactor (Spec 14 §2.2) bars new features mid-flight, and the Apollo UI lands in pending parity-preserving extraction phases (6/7/10) before `src/features/` exists. See §12. |

## 11. Known limitations (carried forward)

- Per-org Apollo API keys stored unencrypted in Mongo (matches current posture; revisit for scale).
- No durable job queue / checkpoint resume; reliability rests on idempotent re-runs.
- Apollo *waterfall* enrichment (broader email/phone coverage via async webhook) is unused; only
  synchronous match/reveal is in scope.
- `LeadStream` wiring replaces mock data on that one surface only; other mock lead surfaces
  (e.g. market-research/strategist streams) are untouched.

## 12. Implementation sequencing & plan creation

This spec is implemented in **two separately-planned stages, split by stack**, because the backend
refactor is complete but the frontend refactor (Spec 14) is still in progress. The split is
deliberate (Decision §10.9); it is *not* an invitation to land the frontend mid-refactor.

### 12.1 Backend plan — written now

- Plan: `plans/apollo-lead-integration-backend.md`.
- Scope: everything in §4–§6, §8, and the backend portions of §9, plus the net-new primitives in
  §5.3 (dedup-by-email upsert, fill-only-empty merge), credential storage (§5.4), and run tracking
  (§5.5).
- Safe to build now: **purely additive** to the finished, settled `app/services/*` / `app/routers/*`
  structure (the only edit to an existing file is a one-line `include_router` in `main.py`). No
  frontend changes; no breaking API change. Spec 14 §2.2 explicitly allows this — *"Per-feature
  deviations require their own backend spec."*
- Delivers a usable, independently-verifiable import + enrich API, validated via `/docs`/curl per
  CLAUDE.md's "update the backend first, verify the response shape with a live call, then implement
  the frontend" rule.

### 12.2 Frontend plan — deferred

- Plan: `plans/apollo-lead-integration-frontend.md` — **not written yet.**
- **Why deferred:** the frontend refactor (Spec 14) explicitly assumes *"No new product features …
  Agents must not 'improve' mid-refactor"* (§2.2), and the Apollo UI touches surfaces owned by
  pending, parity-preserving extraction phases that have not run yet:
  - `DataSourcesManager.tsx` → Phase 6 (mission-control)
  - `LeadStream.tsx` → Phase 7 (customers)
  - `Settings` / `IntegrationSettings.tsx` → Phase 10 (settings)
  The target `src/features/` structure does not exist yet (Phase 4 is specced but unbuilt), so any
  FE code written now would land in the old `src/components/**` layout and have to be migrated
  again later — double work that also disturbs the visual/behavioral baseline those phases must
  preserve.
- **Trigger to write it:** the frontend refactor has completed (or, at minimum, Phase 4 plus the
  relevant feature-extraction phases 6/7/10 have landed). At that point §7 is re-grounded against
  the then-current structure (paths move from `src/components/**` / `src/pages/**` into
  `src/features/**`) before the FE plan is authored.
- Until then, §7 stands as **frontend design intent**, not a current-structure build guide.
