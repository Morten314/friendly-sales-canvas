# Backend Architecture

Canonical, living map of the FastAPI backend at `backend/app/`. Source of truth is the code; this doc is a navigation aid. **Reference modules/symbols, never line numbers** — line numbers rot on the next refactor.

> The two `docs/analysis/` sets are pre-refactor snapshots (flat `api.py`/`services.py` monolith) and are **not** current for backend structure.

## Entrypoint & boot
- `backend/main.py` is a thin shim: `from app.main import app`. It preserves `uvicorn main:app` for Render and local dev (`python main.py` runs uvicorn on `127.0.0.1:8000`).
- `app/main.py` is the FastAPI application factory: it owns the `FastAPI(lifespan=lifespan)` instance, the CORS middleware, the domain exception handlers, and the `include_router(...)` calls. Startup runs in the `lifespan` async context manager (covered by `tests/test_lifespan.py`), in this order:
  1. `build_clients()` (`app/core/clients.py`) → stashed on `app.state.clients`.
  2. `init_registry()` (`app/core/prompts.py`) → stashed on `app.state.prompts`.
  3. `build_llm_config(...)` (`app/core/llm_config.py`) → stashed on `app.state.llm`.
  4. Neo4j `graph.refresh_schema()` — guarded (skipped/logged if the graph client is `None` or the call raises).
  5. Mongo index ensures — guarded on the Mongo client being present: `_ensure_market_scoring_indexes`, `_ensure_leads_indexes`, `_ensure_icp_indexes` (idempotent; `create_index` is a no-op when an equivalent index exists).
  - There is no teardown — clients are process-lifetime singletons. `BREWRA_SKIP_DB_INIT` skips DB connection attempts (clients become `None`).

## Layering
- `app/core/` — cross-cutting infra: `clients` (Neo4j driver + `Neo4jGraph` / Mongo / Pinecone / S3), `config`, `dependencies` (DI wiring, usable in both request and background-task contexts), `exceptions` (the `BrewraError` hierarchy → HTTP responses), `llm_config` (chat models, transformers, ReAct chain), `logging`, `prompts` (loader/registry/render API).
- `app/models/` — per-domain Pydantic request/response models, plus `pagination.py`.
- `app/routers/` — per-domain routers; `app/routers/v2/` holds the versioned successors.
- `app/services/<domain>/` — business logic split into `orchestrator` / `persistence` / `llm` / `parsing` / `normalization` / `scoring` (per domain, as applicable; some domains use domain-specific module names, e.g. `signals/{ask,batch,search}`, `graph_chat/{neo4j,prospect_pipeline}`, `data_sources/{loaders,pipeline}`), with shared helpers `_claude_budget`, `_llm_helpers`, `_neo4j_helpers`, `_retrieval`.
- `backend/prompts/<svc>/` — Jinja2 prompt bodies served by `app/core/prompts.py` (see `docs/PROMPTS.md`).

## Request lifecycle
Router (`app/routers/<domain>` or `app/routers/v2/`) → service orchestrator (`app/services/<domain>/orchestrator`) → `persistence` / `llm` / `_retrieval` helpers → response model. Background work uses `fastapi.BackgroundTasks` (in-process; lost on restart — no queue/retries); it is used by the `data_sources` and `market_scoring` flows.

## Domains
`icp`, `signals`, `leads`, `market_research`, `market_scoring`, `customer_profile`, `data_sources`, `org_auth`, `graph_chat`, `pipeline`, `profiles` (eleven domain service packages under `app/services/`, each with a v1 router). Plus `health` — a service module (`app/services/health.py`) with no dedicated router; see §Health below.

## v1 vs v2 routers
`app/routers/` is the original surface; `app/routers/v2/` is the versioned successor and contains exactly: `data_sources`, `icp`, `leads`, `org_auth`, `signals`. Each v2 router is mounted with `prefix="/v2"` in `app/main.py`. This v2 set are versioned successors that sit alongside their v1 routers — no exception for `org_auth` (its v1 router, `app/routers/org_auth.py`, is mounted in `app/main.py` like every other v1 domain). When adding/changing an endpoint, target the version the FE consumer uses and update both router and model.

## Health
There is no `/healthz`/`/livez`/`/readyz`, no dedicated health router, and no root route. `app/services/health.py` exposes a single smoke probe, `probe_llm(llm2)`, which invokes the Together LLM and returns a `{"status": ...}` dict. It is surfaced as a diagnostic `GET /test-llm` endpoint on the `pipeline` router (`app/routers/pipeline.py`). Liveness/readiness is therefore not formally wired — process health is implicit (the app is "up" once `lifespan` startup completes); the only health-style endpoint is this ad-hoc LLM probe.

## Cross-cutting
- **Clients** (`app/core/clients`): Neo4j (CRM graph — both a raw `GraphDatabase` driver and a `Neo4jGraph`), MongoDB (databases `Scout_Agent` and `Profiler`; collections include `Market_Intelligence`, `Lead_Market_Scores`, `Lead_Market_Score_Runs`, `Signals`, `File_Processing`, `Company_Profile`, `ICP_config`, `ICP_ID_REGISTRY`, `Org_Management`, `Registration_DB`), Pinecone (embeddings namespaced by `org_id`), S3 (boto3, region `eu-north-1`, bucket `brewra-data-sources`, for uploaded PDFs/text). The driver/graph/Mongo client are `None` when `BREWRA_SKIP_DB_INIT` is set or a connection fails; S3 and Pinecone are always constructed.
- **LLMs** (`app/core/llm_config`): Groq `llama-3.3-70b-versatile` (primary chat/research); Together.ai `Qwen/Qwen3-235B-A22B-Instruct-2507-tput` exposed as a `ChatOpenAI` pointed at `https://api.together.xyz/v1`, used in a LangChain `ZERO_SHOT_REACT_DESCRIPTION` `agent_chain` (`max_iterations=20`, `max_execution_time=120`) with a Tavily `WebSearch` tool (`k=10`). Embeddings (`app/services/_retrieval.py`) use `intfloat/multilingual-e5-large-instruct` (1024-dim) served by Together.ai via `langchain_openai.OpenAIEmbeddings` (also pointed at `https://api.together.xyz/v1`) — **not** OpenAI despite the class name.
- `dependencies`, `config`, `logging`, `exceptions` provide DI, settings, structured logging, and the error hierarchy (each `BrewraError` subclass maps to an HTTP response via the handlers in `app/main.py`).

## Prompt system
Prompt bodies live in `backend/prompts/<svc>/` (Jinja2 `.md.j2`), composed from `_shared/` partials, served by `app/core/prompts.py`; per-call `prompt_meta` is persisted with output by the service orchestrators. Full details: `docs/PROMPTS.md`.

## Testing layout
`backend/tests/unit/` holds the unit suite (incl. golden-prompt tests `test_prompts_golden.py` / `test_prompts_loader.py`); `backend/tests/` top level holds API/integration tests (incl. `*_v2`, `test_lifespan`, `test_smoke`); `tests/__snapshots__`, `tests/_baselines`, and `tests/fixtures` hold fixture infra. Details: `backend/TESTING.md`. (Golden-prompt tests live inside `tests/unit/` — there is no separate golden directory.)

## Current posture (descriptive — not a to-do list)
No backend auth: endpoints trust `user_id`/`org_id` from query/body; multi-tenancy is `WHERE … org_id` filtering plus Pinecone `org_id` namespacing. CORS is `allow_origins=["*"]` with `allow_credentials=True`. Background tasks are in-process. These are accepted at the MVP stage — see `docs/TECH_DEBT.md`. (This doc describes; it does not recommend hardening.)

## Keeping this current
When the layering changes, update this map and reference modules/symbols, not line numbers.
