---
artifact: specs/23-apollo-lead-integration-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
---

## Findings

### [High] Concurrent-write race on fill-only-empty

**Location:** §5.3 ("fill-only-empty merge")

The `upsert_lead_by_email` primitive must guarantee that no existing value is overwritten even when two background tasks (e.g., import + CSV upload, or two enrichment runs) operate on overlapping leads concurrently. The spec mentions two implementation alternatives ("coalesce-style Cypher" vs "read-modify-write") but does not choose one or acknowledge the race. A pure Cypher `SET l.x = coalesce(l.x, $x)` is atomic at the single-property level and safe. A read-modify-write round-trip is not atomic and can violate the fill-only-empty contract under concurrency. The spec should commit to the Cypher coalesce approach (or another atomic strategy) and explicitly reject read-modify-write.

### [High] Import cap is undefined and under-specified

**Location:** §8 ("Caps / no silent truncation")

The spec states that imports "page up to a sane maximum and surface when capped" but does not define the cap value, whether it's a hard limit per import or a rolling limit, or what the user sees when they hit it. The error-surface behavior ("partial" status with counts) is mentioned for credit exhaustion and 429 but not explicitly for the cap case. Since this is a gate-posture decision the spec calls out by name, the cap threshold and its UX treatment should be specified here, not deferred to the plan.

### [High] No-email dedup gap could create duplicates on re-import

**Location:** §5.3 ("No email → create a new lead (new lead_id UUID), as today.")

Apollo contacts that lack an email address will create a new Lead node on every import, with no dedup key. The spec does not quantify how common email-less contacts are in Apollo's dataset, nor does it provide a fallback strategy (e.g., dedup by `apollo_contact_id` as a secondary key, or skip/skip-and-warn). If a customer re-imports the same list, every email-less contact duplicates. This interacts badly with the idempotency guarantee in success criterion #4.

### [Medium] Per-org API key storage in Mongo is a different threat model than current posture

**Location:** §5.4

The spec argues that unencrypted storage is consistent because existing keys are also plaintext. But existing keys are Brewra-operator secrets in environment variables / `config.py` — they are not user-supplied, not queryable via API, and not scoped to a tenant. `Connector_Credentials` puts a customer's Apollo API key into a Mongo collection readable by any endpoint that takes an `org_id`. No auth middleware validates the caller's right to that `org_id` (per AGENTS.md's "Auth reality check"). The spec should either acknowledge this as a conscious risk acceptance with a concrete trigger for hardening, or add a minimal protection (e.g., encrypt at rest with a Brewra-managed key, or at minimum restrict which endpoints can read the `api_key` field).

### [Medium] Enrichment match by `apollo_contact_id` is mentioned once and never specified

**Location:** §6.1 ("builds match keys (email / apollo_contact_id)"); §5.3 (only defines email dedup)

The enrichment flow says it builds match keys from "email / apollo_contact_id" but §5.3's dedup rules only define normalized email as the person-match key. What is `apollo_contact_id`'s role? Is it a fallback when email is missing? Is it a secondary check? What happens when a lead has no `apollo_contact_id` (e.g., CSV-created leads)? The spec needs a single, unified match-key hierarchy for both import and enrichment.

### [Medium] DELETE endpoint doesn't specify behavior for in-flight runs

**Location:** §6 ("DELETE /connectors/apollo/connect")

The disconnect endpoint removes credentials but does not say what happens to an import or enrichment run that is currently executing and about to make an Apollo API call with those credentials. Should it cancel? Fail mid-run? The run-doc would presumably end up as `status="partial"` or `status="failed"`, but this should be explicit.

### [Medium] `upsert_lead_by_email` implementation choice left open

**Location:** §5.3 ("coalesce-style Cypher, e.g. `SET l.x = coalesce(l.x, $x)`, or read-modify-write")

Listing two alternatives without selecting one is a plan-readiness gap. The plan author will have to make this design decision, and the two approaches have different correctness properties (see the concurrent-write finding above). The spec should make the call so the plan can focus on task decomposition.

### [Medium] Connector seam (ABC/Protocol) may be premature

**Location:** §4 ("base.py — LeadSource interface (ABC/Protocol)")

Building an abstract connector interface for a single implementation (Apollo) with one hypothetical future adapter (HubSpot) is borderline overengineering. The spec acknowledges "without building a plugin system now" but a formal ABC is the skeleton of a plugin system. An alternative: start with just `ApolloConnector` as concrete functions, and extract the interface when HubSpot is actually spec'd. The spec should justify why the indirection is worth its complexity cost now (e.g., does the plan's task structure benefit from the seam?).

### [Medium] Enrichment `reveal_personal_emails` is a "config knob" with no specified location

**Location:** §6.1 ("`reveal_personal_emails=true`, `reveal_phone_number=false` (a config knob)")

Where does this config live? `app.core.config` (global env var)? A per-org setting in Mongo? Hardcoded in `apollo.py`? Since `reveal_personal_emails` burns Apollo credits, the customer should arguably control it. The spec should specify the config surface or explicitly defer it with a default.

### [Low] 429 backoff parameters are unspecified

**Location:** §8 ("Rate limit (429): exponential backoff + retry in-task")

The spec mentions exponential backoff on 429 but does not specify initial delay, max delay, jitter, or max retry count. These parameters affect import/enrichment run duration and the "partial" status threshold. Worth specifying or explicitly deferring to the plan with a sensible default range.

### [Low] Enrichment error cap size is not explicit

**Location:** §5.5 ("errors[capped]"); §8 ("capped sample of errors")

§8 compares to `batch_upload`'s `errors[:10]`, implying a cap of 10, but §5.5 doesn't state it. Should be explicit.

### [Low] `/lists` endpoint pagination is unspecified

**Location:** §6 ("GET /connectors/apollo/lists?org_id=")

Apollo's labels/list API can return many results. The spec doesn't mention pagination for this endpoint. If a customer has hundreds of lists, a single unpaginated response could be large.

### [Low] `requests` (blocking) in async FastAPI endpoints

**Location:** §3 ("Raw HTTP uses `requests`"); §4 (`apollo.py` depends on `requests`)

FastAPI endpoints are async. `requests` is synchronous and will block the event loop during Apollo API calls. The background tasks may be less affected (Starlette runs them in the same thread), but if any endpoint calls `ApolloConnector` directly (e.g., `/connect` validation, `/lists`), those will block. The spec should clarify whether these are sync endpoints or whether `async` + `requests` is acceptable per the existing codebase convention.

### [Low] Asymmetric tracking: import reuses Lead_Stream_Files, enrichment gets a new collection

**Location:** §5.5

Import reuses `Lead_Stream_Files` (no new CRUD). Enrichment gets `Connector_Enrich_Runs`. The asymmetry is pragmatic (enrichment has no file), but the spec doesn't explain why a generic run-doc collection wasn't chosen for both. A brief rationale would help the plan author decide whether to unify or keep separate.

### [Nit] §4 dependency table lists `app.core.config` for `apollo.py`

**Location:** §4 table row for `apollo.py`

`apollo.py`'s API key comes from Mongo via `credentials.py`, not from `app.core.config`. The `config` dependency might be for the Apollo base URL, but the table is misleading — it implies `apollo.py` reads the customer key from config.

### [Nit] Decision 2 rationale is circular

**Location:** §10, Decision 2

"Both tools are prospecting/enrichment, not a system-of-record; matches 'pull their leads data'." This restates the decision rather than explaining why both import and enrichment are in scope for v1 (e.g., "import supplies the initial lead pool; enrichment extends leads the customer already has — both are needed for the Apollo connector to be useful without a second round of design").

### [Nit] §3 says "No global `/api` prefix" but FE proxy expects `/api/*`

**Location:** §3 ("No global /api prefix")

AGENTS.md notes `frontend/vite.config.ts` proxies `/api/*` to the backend. The backend refactor may have changed this, but the statement could confuse a reader cross-referencing with CLAUDE.md. A one-line clarification would help.
