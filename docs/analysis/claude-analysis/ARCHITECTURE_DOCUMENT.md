# Brewra — Software Architecture

> **Snapshot — pre-backend-refactor.** This document reflects the backend as the flat `api.py`/`services.py` monolith and is preserved as a point-in-time analysis (authored 2026-05-08). For the **current** backend architecture see [`docs/architecture/BACKEND.md`](../../architecture/BACKEND.md). Frontend sections are likewise a snapshot; the frontend refactor is in progress (see specs 14–21).

> Reverse-engineered analysis of `backend/` and `PWA-multi-tenancy/development/friendly-sales-canvas/`.
> Frontend: development variant only (per scope).

## 1. System Overview

Brewra is a two-tier system:

```
┌─────────────────────────────────────────────────────────┐
│  Browser (PWA — React 18 + Vite + Tailwind + shadcn-ui) │
│  Firebase Auth │ JWTManager │ rateLimitManager │ caches │
└──────────────────────────┬──────────────────────────────┘
                           │ /api/* (Vite proxy in dev,
                           │ Vercel rewrite in prod)
                           ▼
┌─────────────────────────────────────────────────────────┐
│  FastAPI monolith (api.py ~4.4k LOC, services.py ~2.5k) │
│  Render.io free tier · uvicorn · BackgroundTasks         │
└─────┬──────────┬──────────┬──────────┬───────────┬──────┘
      │          │          │          │           │
      ▼          ▼          ▼          ▼           ▼
   Neo4j     MongoDB    Pinecone    AWS S3     Tavily
   (CRM      (intel,    (RAG       (uploads)   (web
    graph)   scores,    embed-                  search)
             signals)   dings)
                           │
                           ▼  Groq (Llama 3.3 70B), Together.ai (Qwen3 235B + e5-large embeddings), Anthropic Claude (claude-sonnet-4-20250514, `_claude` endpoint variants)
```

Two repos:
- `backend/` — single FastAPI service.
- `PWA-multi-tenancy/` — Vite/React PWA with `development/` and `production/` copies of the same Vite project (`friendly-sales-canvas`). Treat them as branches in folder form.

## 2. Backend

### 2.1 Stack
| Concern | Choice |
|---|---|
| Language / runtime | Python 3, FastAPI + Uvicorn |
| Entrypoint | `main.py` → imports `api.py` (16 lines, ordering-sensitive imports) |
| Routers | None — single `app = FastAPI()` in `api.py:152`, ~30 inline routes |
| ORM | None — direct `neo4j` driver + `pymongo` |
| LLM orchestration | `langchain`, `langchain-neo4j`, `langchain-groq`, `langchain-community` (`agent_chain` = ZERO_SHOT_REACT_DESCRIPTION) |
| Validation | Pydantic models in `models.py` (~30 classes) |
| Deploy | Render.io, `render.yaml` |

### 2.2 Process Topology

Single-process, single-instance Uvicorn on Render free tier. No worker pool, no Celery/RQ, no scheduler. Asynchrony comes from `async def` endpoints + `BackgroundTasks`. **Important:** because `pymongo` is synchronous, async endpoints block the event loop on every Mongo call — concurrency is largely theoretical.

### 2.3 Data Stores

| Store | Role | Tenancy key | Notes |
|---|---|---|---|
| Neo4j | CRM graph: Company, Lead, Contact, Prospect, Activity, Tech, ICP, Campaign, GTM_Strategy | `org_id` on Lead | Schema cached in `llm_config.py:29-96` for Cypher prompt |
| MongoDB | Market Intelligence reports, Lead Market Scores, Lead Market Score Runs, File Processing Status, Customer Profiles, Signals | `(user_id, org_id)` composite, `org_id` for shared | Multiple databases: `Scout_Agent`, `Profiler` |
| Pinecone | Document embeddings (RAG) | `org_id` namespace | `intfloat/multilingual-e5-large-instruct`, 1024-dim, served via TogetherAI's OpenAI-compatible endpoint (`api.py:111-114, 3722-3734`) |
| AWS S3 | Uploaded PDFs/text | per-user prefix | `eu-north-1` |

Neo4j relationships of note:
```
(Company)-[:Has_Contact]->(Contact)
(Company)-[:Has_Lead]->(Lead)
(Contact)-[:Is_POC_For]->(Lead)
(Lead)-[:Has_Activity]->(Activity)
(Lead)-[:ICPs_Tagged_with]->(ICP)
(Lead)-[:Campaigns_Tagged_With]->(Campaign)
(Lead)-[:GTM_Strategies_Tagged_With]->(GTM_Strategy)
(Company)-[:Uses_Tech]->(Tech)
```

### 2.4 API Surface (grouped)

| Domain | Representative routes |
|---|---|
| Leads | `GET/POST /leads`, `PUT/DELETE /leads/{id}`, `POST /leads/batch-upload`, `GET/DELETE /leads/by-file`, `POST /leads/market-scores`, `GET /leads/market-scores/status` |
| Market Research | `POST /market-research`, `POST /icp-research`, `GET /icp` |
| Signals | `POST /signals-research`, `POST /generate-signals-batch`, `GET /fetch-signals`, `POST /signal_action`, `POST /signal_Ask`, `POST /edit` |
| Claude-backed variants (added 2026-05) | `POST /market-research_claude`, `POST /icp-research_claude`, `POST /generate-signals-batch_claude`, `POST /signal_ask_claude` (last has 5-min/1M-token in-process budget). All four are alternate paths to the corresponding non-Claude endpoint, swapping the LangChain `agent_chain` for direct Anthropic Messages calls. |
| Profiles | `GET/POST /profile/{type}`, `GET/POST/DELETE /customer_profile`, `POST /customer_profile/from_suggested_icp`, `POST /cleanup-company-profiles` |
| Documents | `POST /upload-document`, `GET /document-status/{key}`, `GET /user-documents`, `PUT/DELETE /data-source/{id}` |
| Org / Registration | `GET/POST /org`, `POST /connect_org`, `POST/GET /registration` |
| Pipeline | `GET /Sales_Pipeline` (stage distribution + conversion) |
| Legacy / debug | `POST /upload_file/`, `POST /create-company/`, `POST /upload`, `POST /voice_graph/`, `POST /text_graph/`, `GET /ask/`, `GET /chat/`, `GET /query/`, `GET /test-llm` |

Scout/Profiler/Strategist do not have dedicated routers. The dispatch happens inside services via `COMPONENT_FUNCTIONS` and `ICP_FUNCTIONS` dicts that map a `component_name` string to a research function.

### 2.5 LLM Stack

- **Primary chat/research:** Groq `llama-3.3-70b-versatile` (`llm_config.py`).
- **Vision:** Groq `llama-3.2-90b-vision-preview` (rarely invoked).
- **Agent chain:** Together.ai `Qwen/Qwen3-235B-A22B-Instruct-2507`, used as the LangChain `ZERO_SHOT_REACT_DESCRIPTION` agent driving Tavily search (`max_iterations=20`, `max_execution_time=120s`).
- **Embeddings:** `intfloat/multilingual-e5-large-instruct`, 1024-dim, called through `langchain_openai.OpenAIEmbeddings` pointed at TogetherAI's OpenAI-compatible API (`api.py:111-114, 3722-3734`). Indexed in Pinecone, namespaced by `org_id`.
- **Anthropic Claude:** `claude-sonnet-4-20250514`, called via raw HTTP `POST https://api.anthropic.com/v1/messages` with `anthropic-version: 2023-06-01` (no SDK, no LangChain). Powers the four `_claude` endpoint variants: `/market-research_claude`, `/icp-research_claude`, `/generate-signals-batch_claude`, `/signal_ask_claude`. Tavily still drives external search; Claude replaces the `agent_chain` reasoning step. Signal-ask variant enforces a rolling 5-minute / 1M-token budget in-process (`api.py:61-752`) — lost on Render restart.
- **Graph QA:** `GraphCypherQAChain` with `allow_dangerous_requests=True` — natural language → Cypher → Neo4j → answer. Used by `/ask`, `/chat`. **Risk: arbitrary Cypher generation with no validator.**

Prompts are inline in `services.py` per component (5 market components × ~150 lines each, plus 4 ICP research functions, plus Scout/Profiler signal generators). Notable issues, partially documented in the repo's own `ANALYSIS_MARKET_ICP_RESEARCH_ISSUES.md`:
- **Hardcoded regions** (APAC in Market_1, fixed 3-region object in Market_2, NA/DACH in ICP_generator) — biases output regardless of customer profile.
- **Generic example data** (healthcare-specific examples in icp_research_1) leaks into outputs.
- **No citation requirement** — the prompts ask for sources but don't enforce verifiable URLs or dates.
- RAG context is fetched (`api.py:95-160`) but rarely injected into research prompts; embeddings are paid for, then dropped.

### 2.6 Async / Background Work

`fastapi.BackgroundTasks` for:
- Document embedding (`_process_document_embedding`): chunk → embed → Pinecone → MongoDB status.
- Lead market scoring (`_run_market_scoring_for_org`, `api.py:428-583`): for each lead × 5 components → write `Lead_Market_Scores`, update `Lead_Market_Score_Runs`.

Implications:
- In-process tasks die on Render restart. No retry, no persistence.
- Sequential per org — large customers will time out before completing.
- Status tracking lives in MongoDB, but there's no resume-from-checkpoint logic.

A real job queue (Celery + Redis, or Cloud Tasks, or Inngest) is the single highest-leverage backend investment.

### 2.6.1 Pagination & Result Sizing

There is effectively no pagination on list endpoints:
- `GET /leads` (`api.py:740-753`) executes `MATCH (l:Lead) WHERE l.org_id = $org_id RETURN l` with **no `LIMIT`, no offset, no cursor**. A 50k-lead org gets a 50k-row payload.
- The market-scoring background job calls `fetch_leads_for_org(org_id, limit=5000)` (`api.py:439, 1325`) — a hard ceiling that will silently truncate large orgs.
- Several Cypher reads use `LIMIT 1` for "find one" patterns (`api.py:1593, 1603, 1744, 1750, 1977`), which is correct, but no ranged reads exist anywhere.

Implications: memory pressure on the single Render instance, blocking the event loop while pymongo/neo4j drain results, and a quiet correctness bug at >5k leads. Pagination + cursor-based reads are a prerequisite for any customer with a real CRM.

### 2.7 Auth & Tenancy

| Layer | Reality |
|---|---|
| FE auth | Firebase email/password; FE writes JWT via `lib/jwt.ts` if backend issues one |
| FE → BE auth header | `Authorization: Bearer <jwt>` set by `JWTManager.getAuthHeader()` |
| BE token validation | **None.** `api.py` reads `user_id`, `org_id` from query/body parameters and trusts them |
| BE tenant filter | `WHERE l.org_id = $org_id` in Cypher; `{"org_id": ...}` in Mongo |

Net: a user with the API base URL can read or mutate any org's data by changing the `org_id` parameter. Closing this gap requires a real auth middleware (Firebase Admin SDK to verify the ID token, or backend-issued JWTs with proper validation).

### 2.8 External Integrations

| Service | Path | Status |
|---|---|---|
| Tavily | LangChain tool, k=10 | Active, used in every research call |
| AWS S3 | `boto3`, `eu-north-1` | Active (uploads) |
| Pinecone | `pinecone-client` | Active for indexing; under-utilized for retrieval |
| LinkedIn (RapidAPI) | `services.py:68-102` | Implemented but never called from any route |
| Apollo | — | Not present |
| Salesforce / HubSpot | — | UI-mocked only; no backend connector |

### 2.9 Security Findings (severity-ordered)

| # | Finding | Location | Severity |
|---|---|---|---|
| 1 | Hardcoded credentials with env-var fallback | `config.py:8-40` (Groq, Neo4j, Mongo, Together, Tavily, RapidAPI) | Critical |
| 2 | Cypher string interpolation with user input | `api.py:682-694, 714-727` (`voice_graph`, `text_graph`) | Critical |
| 3 | `GET /query/` accepts raw Cypher | `api.py:654-657` | Critical |
| 4 | No backend auth — `user_id` trusted from request | All endpoints | High |
| 5 | CORS `allow_origins=["*"]` with `credentials=True` | `api.py:155-161` | High |
| 6 | `allow_dangerous_requests=True` on `GraphCypherQAChain` | `llm_config.py:160-162` | High |
| 7 | Sync `pymongo` from `async def` blocks event loop | Throughout | Medium |
| 8 | No rate limiting on backend | All endpoints | Medium |
| 9 | No request size cap on uploads; `GET /leads` returns the whole org unbounded; scoring caps at 5000 silently | `/upload-document`, `api.py:740`, `api.py:439, 1325` | Medium |
| 10 | Background tasks lost on restart | `BackgroundTasks` pattern | Medium |
| 11 | No structured logging or tracing | All | Medium |
| 12 | No tests | Repo-wide | Medium |

### 2.10 Maintainability Notes

- `api.py` (~4.4k LOC) and `services.py` (~2.5k LOC) are monoliths. Split by domain via `APIRouter` and move LLM prompts to a `prompts/` package — both are mechanical refactors with high upside.
- Prompts are duplicated and drift between Scout and Profiler signal generators — pull common scaffolding into a base prompt template.
- Several admin tools (`admin_panel.html`, `registration_admin_panel.html`, `cleanup_company_profile.py`) live inline in the backend repo — fine for a v1, but should be extracted before public deployment.

## 3. Frontend

### 3.1 Stack
| Concern | Choice |
|---|---|
| Framework | React 18.3 + Vite 5.4 (SWC) |
| Language | TypeScript 5.5, **non-strict** (`strict: false`, `noImplicitAny: false`) |
| Styling | Tailwind 3.4 + shadcn-ui (Radix primitives) |
| Routing | React Router 6.26 |
| Data fetching | Manual `fetch` via custom clients (TanStack Query is in `package.json` but unused) |
| State | React Context (`AuthContext`, `TenantContext`) + `localStorage`/`sessionStorage` + per-page `useState` |
| Forms | `react-hook-form` + Zod (lightly used) |
| Charts | Recharts |
| Icons | lucide-react |
| Auth | Firebase 12.4 (email/password) |
| PWA | `vite-plugin-pwa` with Workbox |
| Deploy | Vercel; `/api/*` rewrite to Render backend |

### 3.2 Routing (top level)

| Path | Page | Notes |
|---|---|---|
| `/` and `/login` | Login | Firebase email/password |
| `/tenant-selection` | TenantSelection | Required before protected routes |
| `/your-ai-team/scout/:tab` | MarketResearch (~14.9k LOC) | Tabs: marketintelligence, leadstream, deployment, chatwithscout |
| `/your-ai-team/strategist/:tab` | Deals → StrategistWorkspace | Tabs: workspace, recommendations |
| `/mission-control` | MissionControl (~5.6k LOC) | Profiler setup |
| `/customers` | Customers | Lead Stream + ICP profiles + Profiler chat |
| `/signals` | Signals (~1.5k LOC) | Cross-agent feed |
| `/calendar`, `/reports`, `/insights`, `/artifacts`, `/settings` | Various | Mostly stubs |

Legacy redirects: `/market-research`, `/your-lead-stream`, `/deals` are aliases.

### 3.3 Core Modules

```
src/
├─ App.tsx              ── Router + providers
├─ main.tsx             ── PWA SW unregister in dev (avoids Lovable preview cache)
├─ contexts/
│   ├─ AuthContext.tsx       ── Firebase user, org_id, org_name, per-user localStorage
│   └─ TenantContext.tsx     ── Selected tenant, user-scoped storage
├─ lib/
│   ├─ api.ts                ── apiFetch wrapper, JWT injection, logging
│   ├─ enhancedApi.ts        ── Adds rate limiting + 5min in-memory cache
│   ├─ authenticatedApi.ts   ── Convenience auth GET/POST/PUT/DELETE
│   ├─ jwt.ts                ── JWTManager singleton (token, refresh, expiry)
│   ├─ rateLimitManager.ts   ── 4 req/min queue, exp backoff, 429 handling
│   ├─ marketScoresHeatmap.ts, marketScoreDescriptions.ts ── Lead heatmap helpers
│   ├─ leadStreamHeatmapSession.ts, missionProfilerSessionCache.ts ── per-session caches
│   └─ cacheUtils.ts         ── localStorage helpers, user-scoped keys
├─ pages/
│   ├─ MarketResearch.tsx    ── Scout monolith
│   ├─ MissionControl.tsx    ── Profiler monolith
│   ├─ Signals.tsx           ── Cross-agent feed
│   ├─ Customers.tsx         ── Profiler chat + ICP/Lead views
│   ├─ Deals.tsx             ── Strategist wrapper
│   └─ ...
└─ components/
    ├─ layout/        Sidebar, Header, Layout shell
    ├─ market-research/ Scout sections, ScoutChatPanel, ScoutLeadStream, drawers
    ├─ mission-control/ ICPManager, DataSourcesManager
    ├─ customers/     LeadStream, ICPBuilder, ProfilerChatPanel, SuggestedICPs
    ├─ signals/       ScoutChatWithHistory, ProfilerChatWithHistory
    ├─ strategist/    StrategistWorkspace, StrategistLeadStream, StrategistRecommendations
    ├─ settings/      CompanyProfile, ScoutDeployment
    ├─ ui/            shadcn primitives (~40 components)
    └─ common/        ErrorBoundary, etc.
```

### 3.4 Data Flow & Caching

Three caching layers, no single source of truth:

1. **`localStorage`** — market intelligence per `(user_id, component_name)`, profiler cache, company profile. User-scoped keys (`marketIntelligenceData_${userId}`).
2. **In-memory map** in `enhancedApi` — 5-minute TTL, hashed `endpoint+payload` key.
3. **`sessionStorage.strategistContext`** — lead handoff between Signals and Strategist.

Without React Query, invalidation is manual. Several components include "refresh" toggles and cache-busting params in payloads — a tell that staleness has been a problem.

### 3.5 Backend Integration

Base URL resolves through `/api` and is rewritten:
- Dev: Vite proxy → `https://backend-11kr.onrender.com` (`vite.config.ts:14`).
- Prod: Vercel `vercel.json` rewrite.

Every authenticated call goes through `JWTManager.getAuthHeader()` → backend ignores it. Rate limiting (4 req/min) is FE-side and motivated by provider limits, not backend protection.

### 3.6 PWA Characteristics

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`, `skipWaiting`, `clientsClaim`.
- Manifest: name "Brewra", theme `#2563eb`, standalone display, 192/512 maskable icons.
- Workbox caches `js/css/html/ico/png/svg`. **No offline strategy for API responses** — without connectivity, the app shell loads but every data fetch fails.
- `main.tsx:10-27` aggressively unregisters service workers in dev mode to avoid stale Lovable preview caches.

### 3.7 Frontend Code Smells

- **Monoliths.** `MarketResearch.tsx` ~14.9k lines, `MissionControl.tsx` ~5.6k, `StrategistWorkspace.tsx` ~809. All would benefit from feature-area splits.
- **TS strictness off.** Permits `any`-soup in API clients and contexts.
- **Unused dependency: TanStack Query.** Either adopt it for cache + invalidation, or remove from `package.json`.
- **Cruft.** `SafeChatWithScout copy.tsx`, `MarketResearch_clean.tsx`, `_restore_test.txt` and ~150 lines of commented-out code in `ICPManager.tsx`. Three "Safe…" wrappers suggest iterative error-boundary rewrites that left orphans.
- **Dev/prod folder drift.** `production/friendly-sales-canvas` and `development/friendly-sales-canvas` are sibling Vite projects. Components diverge (`MarketRankings*`, `SwotAnalysis*`, `TechnologyDrivers*` exist only in prod; `lead-stream/`, `strategist/`, `OpportunityMatchCard`, `ScoutDeploymentDetails` exist only in dev). Branches-as-folders is a future merge problem.
- **JWT is optional and gracefully ignored.** The frontend "auth" is theatrical because the backend doesn't enforce.
- **Duplicate signal generators** mirror the backend duplication: `ScoutChatWithHistory` vs. `ProfilerChatWithHistory` are mostly the same component twice.

### 3.8 Notable Components

| Component | Purpose | Why it matters |
|---|---|---|
| `Layout.tsx` | App shell: Sidebar + Header + main + Toaster | Single layout for all protected routes |
| `Sidebar.tsx` | Collapsible nav, mobile Sheet variant | Hard-coded `text-sales-blue` instead of design tokens |
| `MarketResearch.tsx` | Scout's everything-page | Calls each section through `executeWithRateLimit` |
| `ScoutChatPanel.tsx` (655 LOC) | Multi-turn chat with edit context | Regex-based response cleanup of LLM JSON markers |
| `ICPManager.tsx` | ICP CRUD + heuristics | Heavy commented-out code, mid-refactor |
| `Signals.tsx` | Unified Scout + Profiler feed | Drives most user actions |
| `StrategistWorkspace.tsx` (809 LOC) | Sequence builder | Frontend-only — no persistence |

## 4. Cross-Cutting Concerns

### 4.1 Observability
None to speak of — `print` statements, browser `console.log`, no structured logs, no APM, no LLM call tracing. Capacity decisions on Render and provider quotas are flying blind. Recommendation: integrate OpenLLMetry / LangSmith (since LangChain is already in use) and ship logs to a real sink.

### 4.2 Configuration
- Backend: `config.py` reads env vars but has hardcoded fallbacks — these fallbacks need to be removed and rotated.
- Frontend: `vite.config.ts` and `vercel.json` hardcode the Render URL. Multi-environment support requires `VITE_API_BASE_URL`.

### 4.3 Deployability
- Backend: Render free tier, single instance — fine for design partners, untenable for paying customers.
- Frontend: Vercel, two-project setup (development/production) per the deployment guides. The dev/prod folder split mirrors this two-target deploy. If you align on a single Vite project, Vercel branch-based deploys are simpler.

## 5. Recommended Architecture Trajectory

Ordered by leverage:

1. **Auth middleware on backend.** Verify Firebase ID tokens server-side; derive `user_id`/`org_id` from claims, never from request params. Removes the entire spoofing surface.
2. **Persistent job queue.** Replace `BackgroundTasks` with Celery + Redis (or Inngest / Cloud Tasks). Lead scoring and document embedding need durability and retries.
3. **Split the API monolith into routers** (`leads`, `market`, `signals`, `profiles`, `documents`, `org`). Move prompts into a `prompts/` package so they can be versioned and A/B tested.
4. **Async DB drivers** (`motor` for Mongo) so async endpoints actually scale.
5. **Observability + cost telemetry.** LangSmith/OpenLLMetry for LLM, structured logs (`structlog`), per-endpoint timings.
6. **Unify frontend builds.** One Vite project, environment-based configuration, branch-based Vercel deploys; retire the dev/prod folder split.
7. **Adopt React Query** (already a dep) for server state; consolidate the three caching layers into one.
8. **Real Strategist backend.** A dedicated agent that takes Scout/Profiler outputs and produces sequences as first-class resources (`POST /sequences`, `GET /sequences/{id}`).
9. **CRM connectors as a roadmap commitment**, not mocked UI. Salesforce + HubSpot are table stakes for B2B GTM.
10. **Tests.** At minimum: contract tests for the public API, smoke tests for each agent path. Hard to refactor anything in `api.py` safely without them.

---
*Cited paths use the `development/friendly-sales-canvas/` variant unless noted.*
