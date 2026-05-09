# Brewra — Functionality Inventory

> Compiled 2026-05-05. Initial pass from code inspection of `backend/api.py`, `backend/services.py`,
> `PWA-multi-tenancy/development/friendly-sales-canvas/src/`, and the existing analysis docs.
> Reviewed and corrected (pass 1) 2026-05-05 by 5 parallel code-inspection agents.
> Reviewed and corrected (pass 2) 2026-05-05 by cross-referencing with Gloria's independent analysis
> and re-verifying all divergences directly in source.
> Importance = product/business criticality. Completion = % implemented end-to-end (UI + backend + data persistence).

---

## Legend

| Importance | Meaning |
|---|---|
| **Critical** | Core product promise; missing = product doesn't work |
| **High** | Key user workflow; missing = significantly degrades value |
| **Medium** | Enhances or completes a flow; can ship without it |
| **Low** | Nice-to-have / future-state feature |

---

## 1. Authentication & Identity

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Email/password login (Firebase) | Critical | 85% | `signInWithEmailAndPassword` + `createUserWithEmailAndPassword` + `onAuthStateChanged` all active in `AuthContext.tsx` (lines 187–340). The file begins with ~185 lines of commented-out old code (which included hardcoded test IDs) — the live code below it is real Firebase auth. No MFA, no social login. Signup only ties to a single "Brewra" org. |
| Tenant/org resolution on login | Critical | 65% | `AuthContext.fetchOrgId()` makes a real `GET /api/org?user_id=…` call and caches result in `localStorage`. `TenantSelection.tsx` UI page shows hardcoded mock tenants ("Acme Corporation", "TechStart Inc", "Global Solutions") with a TODO comment, but users are auto-redirected past this screen once `org_id` resolves. Org resolution mechanism is real; tenant listing UI is mock. |
| JWT auth — frontend token issuance | Critical | 15% | `JWTManager` attempts `POST /api/auth/token`; backend endpoint does not exist. FE gracefully degrades on 404. `Authorization: Bearer` header sent only when token exists; backend ignores it regardless. |
| Backend auth middleware (server-side token validation) | Critical | 0% | No Firebase Admin SDK. No token validation middleware. All endpoints read `user_id`/`org_id` from query/body and trust them unconditionally. |
| Password reset flow | Medium | 0% | No `resetPassword`/`sendPasswordResetEmail` calls anywhere in frontend source. No UI component or backend endpoint. |
| SSO / SAML | Low | 0% | Not started. |
| Role-based access control (admin / member / read-only) | Medium | 0% | `JWTPayload` interface has an optional `role` field, never populated or checked. Single implicit role only. Out-of-band admin HTML panel exists but is not part of the PWA. |

---

## 2. Scout Agent

### 2a. Market Intelligence

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Market Size & Opportunity research | Critical | 85% | FE → `POST /market-research` → `Research_Market_1` (`services.py:276`) → LangChain `agent_chain` + Tavily → MongoDB cache (`Scout_Agent.Market_Intelligence`). Max 2 retries with 1 s delay. |
| Industry Trends research | Critical | 85% | Same pipeline (`Research_Market_2`, lines 396–531). **Region hardcoding has been removed** — code now explicitly forbids hardcoded regions ("do NOT use hardcoded regions like APAC") and extracts market/region from the company profile. |
| Competitor Landscape research | Critical | 85% | Same pipeline (`Research_Market_3`, lines 533–759). Largest prompt (~226 LOC). |
| Regulatory & Compliance research | Critical | 85% | Same pipeline (`Research_Market_4`, lines 761–974). |
| Market Entry research | Critical | 85% | Same pipeline (`Research_Market_5`, lines 976–1137). |
| Per-component result caching (MongoDB + localStorage) | High | 75% | MongoDB cache query filters by `(user_id, component_name)` only — **`org_id` is NOT in the cache lookup key**, so two orgs sharing a `user_id` would collide. `org_id` is stored in the result document but not used in the lookup. `localStorage` per `userId` is a secondary client-side layer. Manual cache-bust via "refresh" toggle. |
| Market Intelligence loading orchestration | Medium | 70% | `MarketResearch.tsx` (~14,956 LOC) implements multi-phase loading with per-component status tracking, retry loops, and validation timeouts. Functional but fragile — orchestration logic is deeply coupled to the monolith. |
| RAG retrieval injection into research prompts | High | 25% | `_fetch_pinecone_supporting_context()` runs and stores context in `company_profile["pinecone_supporting_context"]`, but `services.py` Research_Market functions contain no references to this field — context is fetched then discarded, never injected into LLM prompts. Infrastructure paid for, output dropped. |
| Continuous market monitoring / scheduled refresh | High | 0% | On-demand only. No scheduler, no alerting, no background watcher. |

### 2b. Lead Stream (Scout)

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Lead market scoring pipeline (async, 5 components × N leads) | High | 70% | `POST /leads/market-scores` triggers `_run_market_scoring_for_org` via `BackgroundTasks`. Works but in-process (lost on Render restart), no retry, sequential per org — 500 leads × ~90 s ≈ 12+ hrs. Silently caps at 5,000 leads. |
| Lead–ICP heatmap visualisation | High | 75% | `ScoutLeadStream` + `marketScoresHeatmap.ts` render scored leads from real API data. Depends on scoring pipeline completing. |
| Lead market score descriptions | Medium | 70% | `GET /leads/{lead_id}/market-score-descriptions` endpoint exists (`api.py:1378`). Scoring pipeline writes per-component `component_descriptions` to MongoDB; FE surfaces them. |
| Lead market scoring status polling | Medium | 80% | `GET /leads/market-scores/status` polled by FE. Status ("queued", "processing", "completed", "failed") tracked in MongoDB `Lead_Market_Score_Runs`. Well-implemented. |
| Add lead modal | Medium | 75% | `AddLeadModal.tsx` → `POST /api/leads`. Real backend connectivity. |
| Lead stream filtering | Medium | 55% | `LeadStreamFilterBar.tsx` exists; filtering is FE-side only against already-fetched data. No server-side query parameters. |

### 2c. Scout Chat

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Context-aware Q&A over market intelligence | High | 75% | `ScoutChatPanel` calls `POST /signal_Ask` (contextual answers against signal payload). Edit-context mode uses `GET /ask`. Multi-turn history tracked in component state. Regex post-processing strips LLM JSON markers. Note: `ChatWithScout.tsx` hardcodes the backend URL directly instead of going through `apiFetch`. |
| Chat history persistence | Medium | 55% | `ScoutChatWithHistory` persists sessions to `localStorage` (key `scout_chat_sessions_${uid}`). **No server-side persistence** — history is lost if browser storage is cleared. |
| Signal context chat | Medium | 60% | `SignalsContextChat.tsx` provides chat with signal context via `POST /signal_Ask`. Falls back to sample data when API unavailable. |

### 2d. Scout Deployment

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Scout deployment configuration UI | Low | 20% | `ScoutDeployment.tsx` `handleDeploy()` calls `console.log()` only (no API call). However `ScoutSettingsForm.tsx` calls `GET/POST /api/profile/agent_name` which IS wired to the backend profile endpoint. Partially wired via profile endpoint; no dedicated deployment-save endpoint. |

---

## 3. Profiler Agent

### 3a. ICP Management

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| ICP CRUD (create / read / update / delete) | Critical | 85% | `POST /customer_profile` (create/upsert), `GET /customer_profile`, `DELETE /customer_profile/icp/{id}`. Global ID registry enforced. `CustomerProfileICP` model with `extra='allow'` for flexible fields. **No explicit PUT/PATCH** — updates reuse POST with upsert logic. MongoDB-backed. |
| AI-generated ICP research (4 research functions) | Critical | 80% | `POST /icp-research` → `icp_research_1..4` (`services.py:1298–1736`) → `agent_chain` + Tavily. Each has 3 retries + validation. Hardcoded healthcare/DACH example data still present in `icp_research_1` prompt (unlike Market Intelligence functions, these have not been cleaned up). |
| Suggested ICP gallery | High | 80% | `SuggestedICPsGallery` + `SuggestedICPCards`. `GET /icp` fetches suggestions; `POST /customer_profile/from_suggested_icp` converts to saved profile. |
| ICP insights display | High | 70% | `ICPInsights` component renders charts and a simulated chat with hardcoded `setTimeout` AI responses — **not wired to a backend endpoint**. `ICPManager.tsx` (~2,500 LOC) has heavy commented-out code indicating mid-refactor. |
| Delete recommended ICP | Medium | 80% | `DELETE /icp/recommended/{icp_id}`. Fully wired. |
| ICP edit history | Low | 50% | `ICPEditHistory.tsx` exists; operates locally only, no backend persistence of the edit audit trail. |

### 3b. Profiler Lead Stream

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Profiler lead stream display | Medium | 10% | `components/customers/LeadStream.tsx` (432 LOC) renders a lead table but uses a **hardcoded `mockLeads` array of 14 fictional leads** (lines 33–54). `getLeadCountForICP()` filters this mock array. **Zero API calls.** Users on the Profiler lead stream see entirely fake data. |

### 3c. Profiler Chat

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Context-aware Q&A with Profiler persona | High | 75% | `ProfilerChatPanel` + `ProfilerChatWithHistory` (314 LOC). Uses `POST /signal_Ask`. localStorage persistence under key prefix `profiler_chat_sessions`. 90% code duplicate of Scout chat; differentiated only by prompt persona. |
| Chat → ICP promotion (event bus) | Medium | 65% | `Header.tsx` dispatches `profilerExportData` and `profilerCreateICP` custom events. `Customers.tsx` (lines 58–63) registers `addEventListener` handlers for both events. Both dispatch and listener sides exist and are wired. Functional but fragile — depends on `Customers.tsx` being mounted when the header button is clicked. |

### 3d. Contact Enrichment & CRM Connectors

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| LinkedIn enrichment (RapidAPI) | High | 0% | `get_linkedin_followers()`, `get_linkedin_recent_activity()`, `extract_linkedin_username()` in `services.py:68–102`. Imported by `api.py` but **never called by any endpoint**. Effectively dead code. |
| Salesforce connector | High | 5% | UI card in `DataSourcesManager`. `handleConnectToCRM('Salesforce')` opens `https://login.salesforce.com/` in a new tab. No backend connector, no OAuth, no data sync. |
| HubSpot connector | High | 5% | UI card in `DataSourcesManager`. Opens `https://app.hubspot.com/login`. Same status as Salesforce — UI redirect only. |
| Apollo enrichment | Medium | 0% | Zero references to Apollo anywhere in the codebase. |
| Hidden buying centres / champion detection | Medium | 15% | `(Contact)-[:Is_POC_For]->(Lead)` Neo4j relationship exists and appears in OPTIONAL MATCH queries (`api.py:902, 1184`). No UI component surfaces or manages it. |

---

## 4. Strategist Agent

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Strategist workspace UI (sequence builder) | High | 50% | `StrategistWorkspace.tsx` (809 LOC, in `components/market-research/`). Renders step-through animation and email/LinkedIn/call sequence drafting. **Does make a real backend call**: `fetch('https://backend-11kr.onrender.com/chat/?question=…')` (hardcoded URL, bypassing the Vite proxy — a bug). Sequences are ephemeral (no persistence). |
| Lead-to-Strategist handoff (via Signals) | High | 5% | `Deals.tsx` is prepared to read `sessionStorage.strategistContext` on mount and hydrate from it. However, **no code in `Signals.tsx` writes to `strategistContext`** — it only sets `signalsChatContext`. The receiver is built; the sender is absent. Broken by omission. |
| Tiered lead recommendations (T1/T2/T3) | High | 15% | Both `StrategistRecommendations.tsx` and `StrategistLeadStream.tsx` import `heatmapLeads` from `leadData.ts` — a **397-line file of entirely hardcoded mock data** (44 fictional leads with fabricated ratings). `getPriority()` / `computeScore()` logic functions are real but operate on this static data, never on real API leads. |
| GTM strategy sequence persistence | Critical | 0% | No `/sequences` endpoint in backend. Generated sequences live in FE state only — lost on page reload. |
| Email outreach execution (send) | Critical | 0% | Email drafted in workspace. `handleSaveEmail()` navigates to `/artifacts` page. No SMTP integration, no send endpoint. |
| LinkedIn outreach execution | Critical | 0% | LinkedIn message shown in UI. No send capability, no API integration. |
| Sequence templates / A-B angles | Medium | 0% | Single dynamically generated sequence. No template selection or variant support. |
| Sequence branching / step logic | Medium | 0% | `SequenceStep` interface has no conditional or dependency fields. Linear steps only. |

---

## 5. Signals Feed

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Batch signal generation (Scout + Profiler) | Critical | 85% | `POST /generate-signals-batch` → `search_signals_scout()` (301 LOC) + `search_signals_profiler()` (322 LOC). Both ~80% identical code, differentiated by prompt persona. Sequential execution (slow). Stored in MongoDB `Signals.signals`. Deduplication tracking exists. |
| Signal feed display (cards with NBAs) | Critical | 85% | `Signals.tsx` (~1,544 LOC) renders `SignalCard` objects with headline, snippet, description, sourceUrl, agent badge, `nextBestMoves`, `NBAs: [{nba, prompt}]`, `contextualSuggestions`. Falls back to sample data when API unavailable. |
| Signal accept/dismiss actions | High | 80% | `POST /signal_action`. Accept sets org_id in MongoDB; Reject deletes the document. |
| Signal Q&A (ask follow-up) | High | 80% | `POST /signal_Ask` fetches company + customer profiles as context, runs WebSearch, returns answer. Multi-turn with conversation history. |
| Signal → Strategist handoff | High | 0% | **`Signals.tsx` only sets `signalsChatContext` — it never writes to `sessionStorage.strategistContext`.** `Deals.tsx` reads `strategistContext` on mount but receives nothing. Handoff is entirely unimplemented from the Signals side. |
| Signal filtering / search | Medium | 50% | FE filters by `rejectedHashes` and insight type (`all / competitor / icp / industry / linkedin`). `GET /fetch-signals` accepts only `user_id` and `limit` — no server-side filter params. |
| Scheduled/continuous signal generation | Critical | 0% | All signals are on-demand. `main.py` has no scheduler. No background worker monitors markets. |
| Accept/reject feedback as ranking input | High | 0% | Actions stored in MongoDB but `search_signals_scout` / `search_signals_profiler` never query past actions. No feedback loop, no re-ranking. |

---

## 6. Leads & CRM

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Lead CRUD (create, read, update, delete) | Critical | 90% | `GET/POST/PUT/DELETE /leads`. Neo4j-backed. UUID generation on create. Ownership verification on update/delete. Flexible schema via `Dict[str, Any]`. |
| CSV / batch lead upload | Critical | 90% | `POST /leads/batch-upload` (167 LOC). CSV/Excel parsed with robust encoding handling; leads written to Neo4j; tracking doc in MongoDB. |
| Lead file tracking (by-file CRUD) | High | 90% | `GET /leads/by-file`, `DELETE /leads/by-file/{file_id}`, `GET /leads/stream/status`. All well-implemented. |
| Sales pipeline view (stage distribution + conversion) | High | 40% | `GET /Sales_Pipeline` exists with timeframe filtering. **Bug: no `org_id` filter** — `MATCH (l:Lead) WHERE l.last_stage_update_date >= $start_date` returns stage counts across all tenants. Every user sees aggregate pipeline data for the whole database. FE display only; no funnel editing. |
| Lead–ICP tagging (`ICPs_Tagged_with` edge) | High | 20% | Relationship defined in Neo4j schema prompt (`llm_config.py:94`) for GraphCypherQAChain use. **No direct Cypher in `api.py` or `services.py` writes this edge.** The scoring pipeline writes only to MongoDB. LLM-generated Cypher could theoretically create it via `/ask`, but no guaranteed active write path exists. |
| Activity / interaction tracking | Medium | 10% | `(Lead)-[:Has_Activity]->(Activity)` modelled in schema prompt (`llm_config.py:92`). No direct endpoint or Cypher in `api.py`/`services.py` creates Activity nodes or this relationship. |
| Campaign tagging | Medium | 10% | `(Lead)-[:Campaigns_Tagged_With]->(Campaign)` in schema prompt. Same status as Activity — schema only, no active write path. |
| GTM strategy tagging on leads | Medium | 10% | `(Lead)-[:GTM_Strategies_Tagged_With]->(GTM_Strategy)` in schema prompt. Same status. |
| Contact graph | Medium | 45% | `(Contact)-[:Is_POC_For]->(Lead)` relationship exists and is used in OPTIONAL MATCH queries (`api.py:902, 1184`). Note: relationship is `Is_POC_For`, not `Has_Contact`. No dedicated graph traversal API; accessible only via `/ask` NL query through GraphCypherQAChain. |
| Lead pagination | High | 0% | `GET /leads` has no `LIMIT`, no offset, no cursor. Returns entire org. Scoring silently caps at 5,000. |
| Lead deduplication | Medium | 0% | Not implemented. |
| Lead export | Medium | 0% | Not implemented. |

---

## 7. Company & Org Management

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Company profile editor (Scout/Profiler/Org profiles) | Critical | 85% | `GET/POST /profile/{type}` with types `scout`, `profiler`, `org`, `user`, `agent_name`. **Neo4j-backed** (uses `driver.session()`). Uses destructive delete-then-insert pattern — no merge/upsert; existing data is deleted before re-writing. |
| Org creation / registration | High | 80% | `POST /registration`, `GET /registration`, `GET/POST /org`. MongoDB-backed. |
| Connect org (link user to org) | Medium | 60% | `POST /connect_org` exists. Limited FE onboarding surface. |
| Cleanup duplicate company profiles | Low | 60% | `POST /cleanup-company-profiles` backend utility; not surfaced in main UI. No auth guard. |

---

## 8. Document & Data Sources

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| PDF / text file upload → S3 | High | 85% | `POST /upload-document` (237 LOC) → S3 (`eu-north-1`). Full multipart form with tags/description. File key returned. |
| Document embedding pipeline (S3 → Pinecone) | High | 70% | `_process_document_embedding` via `BackgroundTasks`. Chunks → TogetherAI embeddings → Pinecone (namespaced by `org_id`). In-process: lost on restart, no retry. Under-utilised in retrieval. |
| URL ingestion | Medium | 60% | `POST /upload-document` accepts a `url` parameter; saved as a data source to MongoDB. `DataSourcesManager` FE wired. |
| Document processing status polling | Medium | 70% | `GET /document-status/{file_key:path}` polled by FE. MongoDB status doc. |
| User document listing | Medium | 75% | `GET /user-documents` filters by `org_id`. |
| Data source delete / update | Medium | 75% | `DELETE /data-source/{file_id}` (removes from S3 + Pinecone + MongoDB, 254 LOC handler). `PUT /data-source/{file_id}` updates tags/description. |
| RAG retrieval in research prompts | High | 25% | Context fetched from Pinecone and stored in `company_profile`, but Research_Market functions in `services.py` contain no references to this field — fetched then discarded. |
| CRM sync (Salesforce / HubSpot) | High | 5% | UI connector cards with external login redirects; zero backend connector. |

---

## 9. Settings

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Company profile settings | High | 85% | `CompanyProfile.tsx` wired to `POST /profile/org`. Neo4j-backed. Multi-tenancy safety check on responses. |
| User profile settings | Medium | 70% | `UserProfile.tsx` calls `POST /api/profile/user`. Backend `POST /profile/{type}` handles `user` type — stores to **Neo4j** (not MongoDB as previously noted). Delete-then-insert pattern. |
| Agent profile configuration | Medium | 50% | `AgentProfile.tsx` calls `GET/POST /api/profile/agent_name`. Backend explicitly handles `profile_type == "agent_name"` case with a full Neo4j delete-then-insert. Endpoint works; UI exists with real backend connectivity. |
| Scout deployment settings | Low | 20% | `ScoutDeployment.tsx` `handleDeploy()` is a no-op (`console.log()` only). `ScoutSettingsForm.tsx` calls `GET/POST /api/profile/agent_name` which IS wired. Partially functional via shared profile endpoint; no dedicated deployment-save. |

---

## 10. Stub / Placeholder Pages

These pages have UI chrome but minimal or zero backend wiring.

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Calendar / Activator page | Medium | 10% | Three tabs (Execution & Automation, Campaign Automation, Task Management) all show "will appear here" stubs. Chat responses simulated with `setTimeout`. 158 LOC. No backend. |
| Reports page | Medium | 15% | Shows hardcoded demo cards (UK Fintech Ops Demo, CTO Demo) with static talking points and demo scripts. "Export" and "Share" buttons non-functional. Simulated chat via `setTimeout`. 277 LOC. No real data. |
| Insights page | Medium | 5% | Hardcoded static percentages (87% UK Market Research, 92% Firmographic Match). "Export All Reports" button does nothing. 246 LOC. No backend. |
| Artifacts page | Medium | 20% | Renders mock Scout/Profiler analysis reports from `mockArtefacts` state. Has a real `createSimplePDF()` function (lines 263–371) that generates downloadable PDF content — this is working code. Listens for `addArtefact` custom events. Receives email saves from Strategist via navigation. All underlying data is mock. 664 LOC. |
| Agent Hub page | Low | **0%** | `AgentHub.tsx` exists with 11 supporting components in `components/agent-hub/`. **`App.tsx:60–64` routes `/agent-hub` to `<Signals />` instead.** The entire AgentHub page and all its child components are dead code — never rendered, never shown to users. |

---

## 11. Platform & Infrastructure

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Multi-tenancy data isolation | Critical | 55% | Filter-based (`WHERE org_id = …` in Cypher; `{"org_id": ...}` in Mongo). Works for most endpoints but **`GET /icp` has a critical scoping bug** (`api.py:1977`: `MATCH (c:CompanyProfile) RETURN c LIMIT 1` — no org_id filter, returns any org's company profile). Trivially bypassable without backend auth. |
| PWA install prompt + manifest | Medium | 65% | `PWAInstallPrompt.tsx` + `manifest.webmanifest`. `vite-plugin-pwa` with Workbox. `pwaDiagnostics.ts` utility exists. Theme, icons, standalone mode configured. |
| Offline capability | Low | 5% | Workbox caches static assets (`js/css/html/ico/png/svg`). No API response caching — all data fetches fail offline. |
| FE rate-limit manager (30 req/min) | Medium | 80% | `rateLimitManager.ts`: `maxRequestsPerMinute: 30`, queue-based with exponential backoff and jitter. Integrated with `enhancedApi`. Motivated by LLM provider limits. |
| In-memory API cache (5-min TTL) | Medium | 75% | `enhancedApi.ts` keyed on endpoint + payload hash, 300,000 ms TTL. Staleness handled by manual "refresh" toggles. |
| Persistent job queue (durable background tasks) | Critical | 0% | All async work via FastAPI `BackgroundTasks` — in-process, lost on Render restart, no retries. Affects document embedding and lead market scoring. |
| Backend observability (structured logging, APM, LLM tracing) | High | 5% | `print()` and `logger.warning()` only. No structlog, no LangSmith/OpenLLMetry, no per-endpoint timing or cost telemetry. |
| Backend error handling / retries | High | 25% | Retry logic exists on individual LLM research calls (`max_retries=2`) and per-lead in the scoring pipeline. No general-purpose retry on DB writes or non-research API calls. |
| Pagination on list endpoints | High | 0% | `GET /leads` returns entire org (no LIMIT). Scoring silently caps at 5,000. |
| Backend rate limiting / request size caps | High | 0% | No middleware. FE-side rate limiting only. `POST /upload-document` has no size cap. |
| Test coverage | High | 20% | **Backend** (`backend/tests/`, added 2026-05-08): pytest with FastAPI `TestClient`, dependency-overridden fixtures for Neo4j/Mongo/Pinecone/S3/LLM, snapshot-based via `__snapshots__/`. 10 test modules covering auth/org, leads, signals, market research, ICP, profiles, documents, market scoring. **Frontend** (`frontend/e2e/`, added 2026-05-08): Playwright with 5 journey specs (login+tenant+mission, CSV upload, signals feed, market research, ICP create) + screenshot snapshots. Fixtures hand-crafted, not captured from real responses (TD-001 in `docs/TECH_DEBT.md`). No CI yet. The four pre-existing `backend/test_*.py` smoke scripts (live-production probes, hardcoded `USER_ID`/`ORG_ID`) still sit at backend root. |
| API schema / OpenAPI client generation | Medium | 30% | FastAPI auto-generates `/docs`. Most endpoints lack `response_model` annotations — no client auto-generated from schema. |
| Environment-based configuration (FE) | Medium | 30% | Backend URL hardcoded in `vite.config.ts` (line 14), `jwt.ts` (line 6), `enhancedApi.ts` (line 36), and directly in `StrategistWorkspace.tsx`. No `VITE_API_BASE_URL`. |
| Dev/prod codebase unification | Medium | 30% | Two sibling Vite projects (`development/` vs `production/`) diverged. Components like `MarketRankings*`, `SwotAnalysis*`, `TechnologyDrivers*` exist only in `production/`; `lead-stream/`, `strategist/`, `OpportunityMatchCard` exist only in `development/`. |

---

## 12. Security (Gap Analysis)

| Issue | Importance | Current State | Notes |
|---|---|---|---|
| Backend auth enforcement | Critical | 0% remediated | No token validation. `user_id`/`org_id` trusted from request body/query on every endpoint. |
| **Shared global `ConversationBufferMemory`** | Critical | 0% remediated | `llm_config.py:26`: `memory = ConversationBufferMemory(...)` is a **module-level singleton** used by both `chain` and `chain2`. Concurrent requests from different users share the same memory object — User A's questions appear in User B's LLM context. Active data leakage in production. |
| **ICP org_id scoping bug** | Critical | 0% remediated | `api.py:1977`: `MATCH (c:CompanyProfile) RETURN c LIMIT 1` — no org_id filter. ICP generation for any user silently uses whichever company profile happens to be returned first. User A's ICP suggestions may be based on User B's company data. |
| Hardcoded credentials in `config.py` | Critical | 0% remediated | Live production API keys hardcoded as env-var fallbacks: Groq, Neo4j, MongoDB, Together, Tavily, RapidAPI. |
| Cypher injection (`voice_graph`/`text_graph`) | Critical | 0% remediated | `api.py:682–694, 714–727` — f-string interpolation of user-supplied `prospect_name` and `text` into Cypher queries. |
| **Cypher injection (`process_prospect_list`)** | Critical | 0% remediated | `services.py:225–269` — CSV field values (`Prospect Name`, `Prospect Company`, all question columns) interpolated directly into Cypher f-strings. Any CSV with crafted data can inject arbitrary Cypher. |
| Raw Cypher endpoint (`GET /query/`) | Critical | 0% remediated | Accepts arbitrary Cypher via query parameter; executes with no auth or validation. |
| **`/Sales_Pipeline` no org_id filter** | High | 0% remediated | `api.py:1410`: `MATCH (l:Lead) WHERE l.last_stage_update_date >= $start_date` — no org_id filter. Every user sees aggregate pipeline stage counts across all tenants. |
| CORS `allow_origins=["*"]` + `credentials=True` | High | 0% remediated | `api.py:168–174` — combination nullifies CORS protection; any origin can make credentialed cross-origin requests. |
| `allow_dangerous_requests=True` on GraphCypherQAChain | High | 0% remediated | Both `chain` and `chain2` (`llm_config.py`). LLM-generated Cypher executed with no validator. |
| Sync `pymongo` blocking async event loop | Medium | 0% remediated | `_get_profiler_mongo_client()` returns synchronous `MongoClient` used in async endpoints throughout `api.py`. Concurrency is theoretical. |
| No request size cap on uploads | Medium | 0% remediated | `POST /upload-document` uncapped. |

---

## 13. Known Bugs

| Bug | Location | Severity | Description |
|---|---|---|---|
| Shared `ConversationBufferMemory` cross-pollinates users | `llm_config.py:26` | Critical | Module-level singleton `memory` shared across all requests to `/ask` and `/chat`. User A's chat history bleeds into User B's LLM context. |
| ICP generation ignores org_id | `api.py:1977` | Critical | `MATCH (c:CompanyProfile) RETURN c LIMIT 1` — no org filter. User A's ICP suggestions may be generated from User B's company profile. |
| `/ask/` returns Python set literal | `api.py:646` | High | `return {response}` creates a Python `set`, not a JSON dict. FastAPI cannot serialise a set to JSON — endpoint returns an error or garbled output for all callers. Should be `return {"response": response}`. |
| `/Sales_Pipeline` no org_id filter | `api.py:1410–1462` | High | Pipeline stage counts returned without org_id scoping. Every user sees the aggregate pipeline across all tenants. |
| Duplicate Cypher generation prompts | `llm_config.py:29–116, 164–247` | Low | `Cypher_gen_prompt` and `Cypher_gen_prompt2` are nearly identical (118 lines each). Independent maintenance risks divergence. |

---

## 14. Mock Data Inventory (UI shows fake data)

| Component | File | Data Source | Impact |
|---|---|---|---|
| Profiler Lead Stream | `customers/LeadStream.tsx:33–54` | `mockLeads` — 14 fictional leads | Profiler's lead-facing view shows no real customer data |
| Strategist Lead Stream | `strategist/StrategistLeadStream.tsx` | `leadData.ts` → `heatmapLeads` — 44 fictional leads | Tier-based lead prioritisation in Strategist is not real |
| Strategist Recommendations | `strategist/StrategistRecommendations.tsx` | `leadData.ts` → `heatmapLeads` + hardcoded `TIER_INTELLIGENCE` | Recommendation counts and intelligence are fabricated |
| Tenant Selection | `pages/TenantSelection.tsx` | Hardcoded strings ("Acme Corporation", etc.) | Tenant switching UI is visual only |
| Calendar page | `pages/Calendar.tsx` | `setTimeout` simulated chat | No real task or campaign data |
| Reports page | `pages/Reports.tsx` | Hardcoded demo cards (UK Fintech Ops Demo, CTO Demo) | Demo-mode content only |
| Insights page | `pages/Insights.tsx` | Hardcoded percentages (87%, 92%, etc.) | All metrics are fictional |
| Artifacts page | `pages/Artifacts.tsx` | `mockArtefacts` state array | Stored analyses are placeholder content |

---

## 15. Dead Code Inventory

### Dead Backend Code

| Item | Location | Reason |
|---|---|---|
| `get_linkedin_followers()` | `services.py:68–84` | Imported but never called by any endpoint |
| `get_linkedin_recent_activity()` | `services.py:86–102` | Imported but never called by any endpoint |
| `extract_linkedin_username()` | `services.py:104–107` | Imported but never called by any endpoint |
| `calculate_prospect_score()` | `services.py:109–138` | Imported but never called by any endpoint |
| `get_ranked_prospects()` | `services.py:140–157` | Imported but never called by any endpoint |
| `vision` LLM model | `llm_config.py:15` | `ChatGroq(model="llama-3.2-90b-vision-preview")` defined but never used |

### Dead Frontend Pages

| File | Reason |
|---|---|
| `pages/AgentHub.tsx` | `/agent-hub` route in `App.tsx` renders `<Signals />` — AgentHub page never shown |
| `pages/Index.tsx` | Not routed anywhere in `App.tsx` |
| `pages/MarketResearch_clean.tsx` | Backup copy; not routed |

### Dead Frontend Components

| File | Reason |
|---|---|
| All 11 files under `components/agent-hub/` | Only imported by unrouted `AgentHub.tsx` |
| `market-research/SafeViewToggle.tsx` | Never imported |
| `market-research/SafeChatWithScout copy.tsx` | Literal duplicate file, never imported |
| `market-research/DebugRenderer.tsx` | Never imported |
| `market-research/ConsumerTrends.tsx` | Never imported |
| `market-research/MarketSizeOpportunityComponent.tsx` | Never imported |
| `market-research/OpportunityMatchCard.tsx` | Never imported |
| `market-research/OpportunitySignalBadge.tsx` | Never imported |
| `market-research/LeadStreamScoutSplitView.tsx` | Never imported |
| `market-research/LeadStream.tsx` (legacy) | Only used by dead `LeadStreamScoutSplitView` |
| `deploy/ScoutDeploymentModal.tsx` | Never imported |
| `ApiTest.tsx` | Never imported |
| `MiniPieChart.tsx`, `MiniLineChart.tsx` (top-level) | Never imported |
| `dashboard/RecentDeals.tsx`, `SalesChart.tsx`, `UpcomingActivities.tsx`, `DealsPipeline.tsx`, `StatsCard.tsx` | Never imported |
| `agents/AgentPersonas.tsx` | Only imported by unrouted `Index.tsx` and `AgentHub.tsx` |
| `signals/cards/StatsCard.tsx`, `ProjectCard.tsx` | Never imported |

---

## Summary Heatmap

| Area | Avg Completion | Highest-Priority Gap |
|---|---|---|
| Auth & Identity | **~55%** | Backend token validation (0%); tenant listing still mocked |
| Scout — Market Intelligence | ~78% | RAG injection (25%), continuous monitoring (0%), cache org_id collision |
| Scout — Lead Scoring | ~75% | Durability/retries (0%), pagination (0%) |
| Scout — Chat | ~65% | Server-side history persistence (0%), hardcoded URL in StrategistWorkspace |
| Profiler — ICP | ~76% | ICP insights uses hardcoded data; org_id scoping bug in `/icp` |
| Profiler — Lead Stream | **~10%** | Entire lead table is hardcoded mock data |
| Profiler — Enrichment / CRM | ~4% | LinkedIn dead code; no connectors |
| Strategist — Workspace | ~50% | No sequence persistence (0%), no execution (0%) |
| Strategist — Recommendations | **~15%** | Entirely static mock data from `leadData.ts` |
| Signals Feed | ~60% | Strategist handoff unimplemented (0%), no scheduled generation, no feedback loop |
| Leads & CRM | ~45% | Sales pipeline org_id bug; Neo4j tagging relationships schema-only |
| Documents & RAG | ~60% | RAG retrieval not injected into prompts (25%) |
| Company & Org | ~75% | Destructive profile save pattern (no upsert) |
| Stub Pages (Calendar/Reports/Insights/Artifacts) | ~12% | All need real backend wiring |
| Agent Hub | **~0%** | Dead code — route renders Signals instead |
| Infrastructure / Platform | ~33% | Job queue (0%), observability (5%), tests (5%), shared memory bug |
| Security | ~0% | 12 issues unaddressed, 5 rated Critical |
