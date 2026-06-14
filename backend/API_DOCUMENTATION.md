# High-Level API Documentation

This is the fuller path+purpose reference for the backend HTTP surface. Endpoints
are organized into per-domain routers under `app/routers/`, with paginated
successors under `app/routers/v2/` (mounted at the `/v2` prefix) — not a single
`api.py` file. Paths are the routes served by the backend process (bare, no
app-level prefix); the frontend reaches them via its `/api/*` proxy, so they also
appear as `/api/...` (and `/api/v2/...`) in the browser. For per-endpoint
parameters and response shapes, see `API_ENDPOINTS_SUMMARY.md`.

## Company and Profile Management

- `POST /create-company/`  
  Creates a new prospect/company node with predefined questions and answers.
- `POST /profile/{profile_type}`  
  Creates or updates a profile for a given type (dynamic profile category).
- `GET /profile/{profile_type}`  
  Fetches profile details for the given profile type.
- `POST /cleanup-company-profiles`  
  Triggers cleanup/normalization of stored company profiles.

## Lead Management

- `GET /leads`  
  Returns the lead list for an org. **Deprecated** — emits `Deprecation`/`Link` headers pointing to `GET /api/v2/leads`.
- `POST /leads`  
  Creates a new lead.
- `PUT /leads/{lead_id}`  
  Updates an existing lead by ID.
- `DELETE /leads/{lead_id}`  
  Deletes a lead by ID.
- `POST /leads/batch-upload`  
  Bulk creates/imports leads from uploaded dataset.
- `GET /leads/by-file`  
  Lists leads associated with uploaded file(s). **Deprecated** — emits `Deprecation`/`Link` headers pointing to `GET /api/v2/leads/by-file`.
- `GET /leads/stream/status`  
  Checks status of ongoing lead streaming/processing job.
- `DELETE /leads/by-file/{file_id}`  
  Deletes leads tied to a specific source file.
- `POST /leads/market-scores`  
  Computes/returns market scores for one or more leads.
- `GET /leads/market-scores/status`  
  Returns live scoring progress (`processed/total`), run status, and recent scored lead description previews.
- `GET /leads/{lead_id}/market-score-descriptions`  
  Returns score explanation/description metadata for a lead.

## Sales Pipeline

- `GET /Sales_Pipeline`  
  Fetches high-level sales pipeline data/insights.

## Research and Signals

Each of the research/signal *generator* endpoints has a Qwen-backed default and a
Claude-backed `_claude` twin (same request/response shape; the `_claude` variant
uses Tavily + Anthropic and returns HTTP 500 if `ANTHROPIC_API_KEY` is unset).
`GET /test-llm` is a separate diagnostic utility and does not follow this pattern.

- `POST /market-research`  
  Runs market research workflow (Qwen backend) and returns structured output.
- `POST /market-research_claude`  
  Same as `/market-research`, generated with the Claude backend.
- `GET /icp`  
  Retrieves ICP (Ideal Customer Profile) data. **Deprecated** — see `GET /api/v2/icp`; only the list portion is replaced (the lazy generate/create behavior has no v2 successor).
- `POST /icp-research`  
  Generates/refines ICP research results (Qwen backend).
- `POST /icp-research_claude`  
  Same as `/icp-research`, generated with the Claude backend.
- `POST /signals-research`  
  Runs signal discovery/research process.
- `POST /generate-signals-batch`  
  Batch generates signals (2 scout + 2 profiler) in one call (Qwen backend).
- `POST /generate-signals-batch_claude`  
  Same as `/generate-signals-batch`, generated with the Claude backend.
- `GET /test-llm`  
  Health/test endpoint for LLM integration.
- `GET /fetch-signals`  
  Returns generated/fetched signals. **Deprecated** — emits `Deprecation`/`Link` headers pointing to `GET /api/v2/fetch-signals`.
- `POST /signal_action`  
  Records a user/system action (accept/reject) on a signal.
- `POST /signal_Ask`  
  Answers a question about signals (Qwen + agent chain + WebSearch).
- `POST /signal_ask_claude`  
  Claude-powered variant of `/signal_Ask` with a local token/run limiter.
- `POST /edit`  
  Generic edit/update endpoint in the profile/research workflow.

## Customer Profile and ICP

- `POST /customer_profile`  
  Creates/updates customer profile.
- `GET /customer_profile`  
  Fetches customer profile data.
- `POST /customer_profile/from_suggested_icp`  
  Creates customer profile based on suggested ICP.
- `DELETE /customer_profile/icp/{icp_id}`  
  Removes ICP from customer profile context.
- `DELETE /icp/recommended/{icp_id}`  
  Deletes a recommended ICP entry.

## Organization Management

- `GET /org`  
  Fetches organization details/configuration.
- `POST /org`  
  Creates or updates organization metadata.
- `POST /connect_org`  
  Connects/links organization to external/internal context.

## Registration

- `POST /registration`  
  Registers a new entity/user/workflow entry.
- `GET /registration`  
  Lists registration records (admin-only cross-tenant view; reads from `Registration_DB`). **Deprecated** — emits `Deprecation`/`Link` headers pointing to `GET /api/v2/registration`.

## Document and Data Source Management

- `POST /upload-document`  
  Uploads a document for processing/indexing.
- `GET /document-status/{file_key:path}`  
  Returns processing status for a specific document.
- `GET /user-documents`  
  Lists documents uploaded for an org. **Deprecated** — emits `Deprecation`/`Link` headers pointing to `GET /api/v2/user-documents`.
- `POST /upload-document`  
  (See above.) PDF/TXT or URL ingestion to S3 + background embedding into Pinecone.
- `POST /upload_file/`  
  Uploads a file and processes it into the Neo4j graph via LangChain (graph transformer).
- `POST /upload`  
  Uploads a CSV/Excel prospect list and processes it into Neo4j (scores prospects, skips duplicates).
- `DELETE /data-source/{file_id}`  
  Deletes a data source/document reference by ID (S3 object, Mongo record, Pinecone vectors).
- `PUT /data-source/{file_id}`  
  Updates metadata/configuration of a data source.

## Graph Chat & Engagement

- `GET /ask/`  
  Asks a question via the primary LLM chain. *(No `response_model`; legacy handler.)*
- `GET /chat/`  
  Asks a question via the secondary LLM chain.
- `GET /query/`  
  Runs a raw Cypher query (testing/debugging — direct database access).
- `POST /voice_graph/`  
  Adds an engagement (note/meeting/email) from a voice file; transcribes audio and stores it in the graph.
- `POST /text_graph/`  
  Adds an engagement from text input and stores it in the graph.

## v2 (Paginated) Endpoints

Paginated successors under `app/routers/v2/`, mounted at the `/v2` prefix (served
at `/v2/...`; FE proxy form `/api/v2/...`). All return the shared
`PaginatedResponse[T]` envelope (`items` / `total` / `limit` / `offset`, `limit`
capped at 500). Common query params: `limit` (default 50), `offset` (default 0).

- `GET /v2/leads`  
  Paginated lead list (successor to `GET /leads`). Params: `org_id`.
- `GET /v2/leads/by-file`  
  Paginated leads-by-file (successor to `GET /leads/by-file`). Params: `org_id`, `file_id`.
- `GET /v2/fetch-signals`  
  Paginated signal feed (successor to `GET /fetch-signals`). Params: `user_id`, `limit` (default 10).
- `GET /v2/icp`  
  Paginated ICP list (successor to the list portion of `GET /icp`). Params: `user_id`, `refresh`.
- `GET /v2/user-documents`  
  Paginated document list (successor to `GET /user-documents`). Params: `org_id`.
- `GET /v2/registration`  
  Paginated registration list (successor to `GET /registration`).
