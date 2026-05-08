# Brewra — Functionality Inventory

> Compiled 2026-05-05 from deep code inspection of `backend/api.py` (4,441 LOC),
> `backend/services.py` (2,540 LOC), `backend/models.py`, `backend/llm_config.py`,
> `backend/database.py`, `backend/config.py`, and all frontend source under
> `PWA-multi-tenancy/development/friendly-sales-canvas/src/`.
>
> Importance = product/business criticality. Completion = % implemented end-to-end
> (UI rendered + backend wired + data persisted). Items rated purely on observable
> code — import-graph-traced, route-verified, not pattern-matched.

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
| Email/password login (Firebase) | Critical | 85% | `signInWithEmailAndPassword` + `createUserWithEmailAndPassword` wired end-to-end. No MFA, no social login. Signup only offers one org ("Brewra"). |
| Tenant/org resolution on login | Critical | 75% | `GET /api/org?user_id=…` wired. Multi-org selection UI (`/tenant-selection`) exists but uses hardcoded mock tenants (Acme Corporation, TechStart Inc, Global Solutions) — zero backend connectivity for tenant listing. Users auto-redirected past it in practice. |
| JWT auth — frontend token issuance | Critical | 30% | `JWTManager` (`src/lib/jwt.ts`) sends `Authorization: Bearer` header; backend has no `/api/auth/token` or `/api/auth/refresh` endpoints. Token calls fail gracefully with 404. |
| Backend auth middleware (server-side token validation) | Critical | 0% | No Firebase Admin SDK validation. Every endpoint reads `user_id` / `org_id` from query/body params and trusts them. Any caller who knows an ID pair can spoof any tenant. |
| Password reset flow | Medium | 0% | Not present. |
| SSO / SAML | Low | 0% | Not started. |
| Role-based access control (admin / member / read-only) | Medium | 0% | Single implicit role. Out-of-band `admin_panel.html` and `registration_admin_panel.html` exist but are not part of the PWA auth flow. |

---

## 2. Scout Agent

### 2a. Market Intelligence

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Market Size & Opportunity research | Critical | 85% | FE `MarketSizeSection` → `POST /api/market-research` → `Research_Market_1` (`services.py:276-394`) → LangChain `agent_chain` + Tavily WebSearch → MongoDB cache (`Scout_Agent.Market_Intelligence`). JSON parsing + retry built in. |
| Industry Trends research | Critical | 85% | Same pipeline (`Research_Market_2`, lines 396-531). Hardcoded APAC/3-region prompt bias in all 5 research functions. |
| Competitor Landscape research | Critical | 85% | Same pipeline (`Research_Market_3`, lines 533-759). Largest prompt (226 LOC). |
| Regulatory & Compliance research | Critical | 85% | Same pipeline (`Research_Market_4`, lines 761-974). |
| Market Entry research | Critical | 85% | Same pipeline (`Research_Market_5`, lines 976-1137). |
| Per-component result caching (MongoDB + localStorage) | High | 80% | Dual-layer: MongoDB per `(user_id, org_id, component_name)` + `localStorage` per `userId`. FE has user-scoped 5-min in-memory cache (`MarketResearch.tsx`). Manual invalidation via "refresh" toggles. |
| RAG retrieval injection into research prompts | High | 25% | Embeddings produced and stored in Pinecone (TogetherAI `intfloat/multilingual-e5-large-instruct`, 1024-dim). `POST /api/market-research` does fetch Pinecone context (`api.py:95-160`) but injection into the `agent_chain` prompt is inconsistent. Paid for infrastructure, rarely utilised. |
| Continuous market monitoring / scheduled refresh | High | 0% | On-demand only. No scheduler, no alerting. |
| Market Intelligence loading orchestration | Medium | 70% | `MarketResearch.tsx` (~14,956 LOC) has complex multi-phase loading with component status tracking, retry loops, and validation timeouts. Functional but fragile — blank lines from formatted code inflate the file, and the orchestration logic is deeply coupled. |

### 2b. Lead Stream (Scout)

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Lead market scoring pipeline (async, 5 components × N leads) | High | 75% | `POST /api/leads/market-scores` triggers `BackgroundTasks` → `score_single_lead_against_market` (normalises 0-100 with retry). Works but lost on Render restart; no retry on failure; sequential per org (500 leads × 90 s ≈ 12 hrs). Silently caps at 5,000 leads. |
| Lead–ICP heatmap visualisation | High | 75% | `ScoutLeadStream` + `marketScoresHeatmap.ts` + `LeadsTable`. Renders scored leads from real API data. Depends on scoring pipeline completing. |
| Lead market score descriptions | Medium | 75% | `GET /api/leads/{id}/market-score-descriptions` wired. FE displays per-component explanations. Backend has good retry/validation logic. |
| Lead market scoring status polling | Medium | 80% | `GET /api/leads/market-scores/status` polled by FE. MongoDB status doc tracks progress with recent items. Well-implemented. |
| Add lead modal | Medium | 75% | `AddLeadModal.tsx` → `POST /api/leads`. Real backend connectivity. |
| Lead stream filtering | Medium | 55% | `LeadStreamFilterBar.tsx` exists; filtering is FE-side only against already-fetched data. No server-side query parameters. |

### 2c. Scout Chat

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Context-aware Q&A over market intelligence | High | 70% | `ScoutChatPanel` + `POST /api/signal_Ask` (contextual answers against signal payload) and `POST /api/chat/` (GraphCypherQAChain). Multi-turn with edit context. `ChatWithScout.tsx` hardcodes backend URL directly instead of using `apiFetch`. |
| Chat history persistence | Medium | 60% | `ScoutChatWithHistory` stores session history in state. Persistence mechanism is unclear — no dedicated server-side chat history endpoint found. |
| Signal context chat | Medium | 60% | `SignalsContextChat.tsx` provides chat with signal context. Uses `POST /api/signal_Ask`. Falls back to sample data when API unavailable. |

### 2d. Scout Deployment

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Scout deployment configuration UI | Low | 20% | `ScoutDeployment` page + `ScoutDeploymentDetails` + `ScoutSettingsForm`. `ScoutSettingsForm` calls `GET/POST /api/profile/agent_name` — partially wired. But deployment save has no dedicated endpoint. Primarily placeholder. |

---

## 3. Profiler Agent

### 3a. ICP Management

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| ICP CRUD (create / read / update / delete) | Critical | 85% | `POST/GET /api/customer_profile`, `DELETE /api/customer_profile/icp/{icp_id}`. MongoDB-backed. Global ID registry enforced. `CustomerProfileICP` model with `extra='allow'` for flexible fields. |
| AI-generated ICP research (4 research functions) | Critical | 80% | `POST /api/icp-research` → `icp_research_1..4` (`services.py:1298-1736`) → `agent_chain`. Each has 3 retries + validation. Hardcoded healthcare/NA/DACH prompt examples leak into output. |
| Suggested ICP gallery | High | 80% | `SuggestedICPsGallery` + `SuggestedICPCards`. `GET /api/icp` fetches suggestions, `POST /api/customer_profile/from_suggested_icp` converts to saved profile. |
| ICP insights display | High | 75% | `ICPInsights` component. Heavy commented-out code in `ICPManager.tsx` (~2,500 LOC) suggests mid-refactor. |
| Delete recommended ICP | Medium | 80% | `DELETE /api/icp/recommended/{icp_id}`. Fully wired. |
| ICP edit history | Low | 50% | `ICPEditHistory.tsx` exists; operates locally only, no backend persistence of edit audit trail. |

### 3b. Profiler Lead Stream

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Profiler lead stream display | Medium | 10% | `components/customers/LeadStream.tsx` (432 LOC) renders a lead table but uses a **hardcoded `mockLeads` array of 14 fictional leads**. Zero API calls. The `getLeadCountForICP()` helper filters mock data. No backend connectivity whatsoever. |

### 3c. Profiler Chat

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Context-aware Q&A with Profiler persona | High | 75% | `ProfilerChatPanel` + `ProfilerChatWithHistory`. Uses `POST /api/signal_Ask`. 90% code duplicate of Scout chat; differentiated only by prompt persona in the request. |
| Chat → ICP promotion (event bus) | Medium | 65% | `profilerExportData` / `profilerCreateICP` custom events allow promoting chat output to ICP tab. Functional but fragile — depends on event listener timing. |

### 3d. Contact Enrichment & CRM Connectors

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| LinkedIn enrichment (RapidAPI) | High | 0% | `services.py:68-102` has 3 helper functions (`get_linkedin_followers`, `get_linkedin_recent_activity`, `extract_linkedin_username`). Imported by `api.py` but **never called by any endpoint**. Dead code. |
| Salesforce connector | High | 5% | UI card in `DataSourcesManager` with auth modal stub. No backend connector. |
| HubSpot connector | High | 5% | UI card in `DataSourcesManager` with auth modal stub. No backend connector. |
| Apollo enrichment | Medium | 0% | Not present in code. |
| "Hidden buying centres / champion detection" | Medium | 15% | Neo4j `(Contact)-[:Is_POC_For]->(Lead)` relationship modelled in schema. No UI surface for it. |

---

## 4. Strategist Agent

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Strategist workspace UI (sequence builder) | High | 52% | `StrategistWorkspace.tsx` (809 LOC) renders step-through animation and email/LinkedIn/call sequence drafting. **Does call `POST /api/chat/?question=…` for AI-generated strategy responses** — not purely FE-only as commonly assumed. But sequences are ephemeral (no persistence). |
| Lead-to-Strategist handoff (via Signals) | High | 40% | `sessionStorage.strategistContext` read in `Deals.tsx:27`. However, no code in `Signals.tsx` writes to this key — the handoff mechanism is incomplete/unwired from the signal source. |
| Tiered lead recommendations (T1/T2/T3) | High | 15% | `StrategistRecommendations.tsx` and `StrategistLeadStream.tsx` both import `heatmapLeads` from `leadData.ts` — a **397-line file of entirely hardcoded mock data** (44 fictional leads, fake ratings, fabricated segment intelligence). Zero API calls. The tiering algorithm works on static data only. |
| GTM strategy sequence persistence | Critical | 0% | No `POST /sequences` endpoint. Generated sequences are ephemeral — user must copy-paste. |
| Email outreach execution (send) | Critical | 0% | Drafting only. No send capability. |
| LinkedIn outreach execution | Critical | 0% | Drafting only. No send or deep-link hand-off. |
| Sequence templates / A-B angles | Medium | 0% | Not implemented. |
| Sequence branching / step logic | Medium | 0% | Not implemented. |

---

## 5. Signals Feed

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Batch signal generation (Scout + Profiler) | Critical | 85% | `POST /api/generate-signals-batch` → `search_signals_scout` (301 LOC) + `search_signals_profiler` (322 LOC). Both are ~80% identical code, differentiated by prompt persona. Sequential execution (slow). Deduplication tracking exists. |
| Signal feed display (cards with NBAs) | Critical | 85% | `Signals.tsx` (~1,500+ LOC) renders cards with headline, snippet, source, agent badge, Next-Best-Actions. Lazy AI answer expansion on recommendation cards. Falls back to sample data when API unavailable. |
| Signal accept/dismiss actions | High | 80% | `POST /api/signal_action`. Accept sets org_id; Reject deletes. MongoDB-backed. Accept has undo via "dismiss" action. |
| Signal Q&A (ask follow-up) | High | 80% | `POST /api/signal_Ask`. Fetches company profile + customer profiles as context. Multi-turn with conversation history. |
| Signal → Strategist handoff | High | 40% | `sessionStorage.strategistContext` bridge. Signal cards can push to Strategist, but the Strategist consumption path is incomplete (see section 4). |
| Signal filtering / search | Medium | 50% | Basic FE-side filtering present. No server-side query parameters on `GET /api/fetch-signals`. |
| Scheduled/continuous signal generation | Critical | 0% | All signals are on-demand. No background job or scheduler watches markets. |
| Accept/reject feedback as ranking input | High | 0% | Actions are stored but never fed back into signal generation or ranking. |

---

## 6. Leads & CRM

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Lead CRUD (create, read, update, delete) | Critical | 90% | `GET/POST/PUT/DELETE /api/leads`. Neo4j-backed. Flexible schema via `Dict[str, Any]`. UUID generation on create. Ownership verification on update/delete. |
| CSV / batch lead upload | Critical | 90% | `POST /api/leads/batch-upload` (167 LOC). File parsed (CSV/Excel), leads written to Neo4j, tracking doc in MongoDB. Robust encoding handling. |
| Lead file tracking (by-file CRUD) | High | 90% | `GET /api/leads/by-file`, `DELETE /api/leads/by-file/{file_id}`, `GET /api/leads/stream/status`. All well-implemented. |
| Sales pipeline view (stage distribution + conversion) | High | 60% | `GET /api/Sales_Pipeline` exists with timeframe filtering. FE display in lead streams. **No `org_id` filter on the backend endpoint** — returns pipeline data across all orgs. No funnel editing UI. |
| Lead–ICP tagging (`ICPs_Tagged_with` edge) | High | 70% | Neo4j relationship populated by scoring pipeline. Displayed in heatmap. |
| Activity / interaction tracking | Medium | 50% | Neo4j `(Lead)-[:Has_Activity]->(Activity)` modelled in schema. Limited FE surface. |
| Campaign tagging | Medium | 45% | Neo4j `(Lead)-[:Campaigns_Tagged_With]->(Campaign)` modelled. No FE campaign builder. |
| GTM strategy tagging on leads | Medium | 45% | Neo4j relationship modelled. No FE management UI. |
| Contact graph (company → contacts) | Medium | 55% | `(Company)-[:Has_Contact]->(Contact)` modelled. Accessible via `/api/ask` NL query. |
| Lead pagination | High | 0% | `GET /api/leads` has no `LIMIT`. Scoring silently caps at 5,000 leads. Unbounded query will OOM large orgs. |
| Lead deduplication | Medium | 0% | Not implemented. |
| Lead export | Medium | 0% | Not implemented. |

---

## 7. Mission Control (Company Profile & Data Sources)

> Not categorised under any agent — this is the landing page after login (`/mission-control`).

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Company profile editor (org profile) | Critical | 85% | `MissionControl.tsx` profile tab → `GET/POST /api/profile/company`. Neo4j-backed. Real backend CRUD. |
| Customer profile management (ICPs) | High | 70% | `ICPManager.tsx` (~2,500 LOC) within Mission Control. CRUD via `/api/customer_profile`. Heavy commented-out code block (~150 lines). |
| Data source upload (PDF/text/URL) | High | 85% | `DataSourcesManager.tsx` → `POST /api/upload-document` → S3 (`eu-north-1`) + background Pinecone embedding. URL ingestion also wired. |
| Data source listing | Medium | 75% | `GET /api/user-documents`. Displays uploaded files and URLs with processing status. |
| Data source delete/update | Medium | 75% | `DELETE /api/data-source/{file_id}`, `PUT /api/data-source/{file_id}`. Extensive backend error handling (254 LOC handler). |
| Data source status polling | Medium | 70% | `GET /api/document-status/{file_key}` polled by FE. MongoDB status doc. |
| CRM connector stubs (Salesforce/HubSpot/LinkedIn) | Medium | 5% | UI cards with auth modal stubs. No backend connectors. Mock-only. |

---

## 8. Company & Org Management

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Company profile settings (Scout/Profiler/Org) | High | 85% | `GET/POST /api/profile/{type}` with types `scout`, `profiler`, `org`, `user`, `agent_name`. Neo4j-backed. Delete-then-insert pattern (destructive — no merge/upsert). |
| Org creation / registration | High | 80% | `POST /api/registration`, `GET /api/registration`, `GET/POST /api/org`. MongoDB-backed. |
| Connect org (link user to org) | Medium | 65% | `POST /api/connect_org`. Wired; limited FE onboarding surface. |
| Cleanup duplicate company profiles | Low | 60% | `POST /api/cleanup-company-profiles`. Backend utility; not surfaced in main UI. |

---

## 9. Document & Data Sources

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| PDF / text file upload → S3 | High | 85% | `POST /api/upload-document` (237 LOC) → S3 (`eu-north-1`). Full multipart form with tags/description. File key returned. |
| Document embedding pipeline (S3 → Pinecone) | High | 70% | `_process_document_embedding` via `BackgroundTasks`. Chunks → TogetherAI embeddings → Pinecone (namespaced by `org_id`). Works but lost on restart; under-utilised in retrieval (see RAG gap above). |
| URL ingestion | Medium | 60% | `DataSourcesManager` has URL upload flow wired to backend. |
| Document processing status polling | Medium | 70% | `GET /api/document-status/{file_key}` polled by FE. MongoDB status doc. |
| User document listing | Medium | 75% | `GET /api/user-documents`. Lists all data sources for an org. |
| Data source delete | Medium | 75% | `DELETE /api/data-source/{file_id}`. Removes from S3 + Pinecone + MongoDB. Over-engineered handler (254 LOC) with extensive fallback logic. |
| Data source update | Medium | 75% | `PUT /api/data-source/{file_id}`. Updates tags/description. |
| RAG retrieval in research prompts | High | 25% | Context fetched from Pinecone (`api.py:95-160`) but not injected into most research prompts. Infrastructure paid for, then mostly dropped. |
| CRM sync (Salesforce / HubSpot) | High | 5% | UI connector cards with auth modal stubs. No backend. |

---

## 10. Settings

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Company profile settings | High | 85% | `CompanyProfile.tsx` + `GET/POST /api/profile/org`. Fully wired. Multi-tenancy safety check on responses. |
| User profile settings | Medium | 70% | `UserProfile.tsx`. Reads/writes Firebase user display name + `GET/POST /api/profile/user`. Basic but functional. |
| Agent profile configuration | Medium | 55% | `AgentProfile.tsx`. Calls `GET/POST /api/profile/agent_name`. UI exists with real backend calls. |
| Scout deployment settings | Low | 20% | `ScoutDeployment.tsx` + `ScoutSettingsForm.tsx`. Partially wired via profile endpoint. No dedicated deployment save endpoint. |

---

## 11. Stub / Placeholder Pages

These pages have UI chrome but minimal or zero backend wiring.

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Calendar / Activator page | Medium | 15% | Three tabs ("Execution & Automation", "Campaign Automation", "Task Management") all show "will appear here" stubs. Simulated chat via `setTimeout`. 158 LOC. No backend. |
| Reports page | Medium | 20% | Shows hardcoded demo cards (UK Fintech Ops Demo, CTO Demo) with static talking points and demo scripts. Simulated chat. "Export" and "Share" buttons are non-functional. 277 LOC. No real data. |
| Insights page | Medium | 15% | Static dashboard with hardcoded percentages (87% UK Market Research, 92% Firmographic Match). "Export All Reports" button does nothing. 246 LOC. No backend. |
| Artifacts page | Medium | 20% | Shows mock Scout/Profiler analysis reports with expand/collapse, edit, delete UI. Has a `createSimplePDF()` function (lines 263-371) that generates real PDF data for download. Listens for `addArtefact` custom events from other agents but no real agent integration. 664 LOC. All data is mock. |
| Agent Hub page | Low | 0% | `AgentHub.tsx` exists with 11 supporting components in `components/agent-hub/`, but the `/agent-hub` route in `App.tsx:60-64` renders `<Signals />` instead. The entire AgentHub page and all its children are dead code — never rendered, never shown to users. |

---

## 12. Platform & Infrastructure

| Feature | Importance | Completion | Notes |
|---|---|---|---|
| Multi-tenancy data isolation | Critical | 55% | Filter-based (`WHERE org_id = …` in Cypher, `{"org_id": ...}` in Mongo). Works for most endpoints but **`GET /api/icp` has an org_id scoping bug** (line 1977: `MATCH (c:CompanyProfile) RETURN c LIMIT 1` — no org_id filter, potentially leaks data across tenants). Trivially bypassable without backend auth. |
| PWA install prompt + manifest | Medium | 65% | Installable via `PWAInstallPrompt.tsx` + `manifest.webmanifest`. `vite-plugin-pwa` with Workbox. `pwaDiagnostics.ts` utility exists. Theme, icons, standalone mode configured. |
| Offline capability | Low | 5% | Workbox caches static assets only. No API response caching or service worker data interception. App shell loads offline but every data fetch fails. |
| FE rate-limit manager | Medium | 80% | `rateLimitManager.ts` — queue-based: 30 req/min, exponential backoff with jitter. Integrated with `enhancedApi`. Motivated by provider LLM limits. |
| In-memory API cache (5-min TTL) | Medium | 75% | `enhancedApi.ts` (callApi / enhancedApi). Keyed on endpoint + payload hash. Staleness handled by manual "refresh" toggles. |
| Persistent job queue (durable background tasks) | Critical | 0% | All async work via `fastapi.BackgroundTasks` — in-process, lost on Render restart, no retries. Affects document embedding and lead market scoring. |
| Backend observability (structured logging, APM, LLM tracing) | High | 5% | `print` statements only. No structured logs, no LangSmith/OpenLLMetry, no per-endpoint timing or cost telemetry. |
| Backend error handling / retries | High | 25% | Basic FastAPI exception responses. Retry logic exists on individual LLM research calls (3 retries) but no general-purpose retry on DB writes or API calls. |
| Pagination on list endpoints | High | 0% | `GET /api/leads` returns entire org (no LIMIT). Scoring silently caps at 5,000. |
| Backend rate limiting / request size caps | High | 0% | No middleware. FE-side rate limiting only. `POST /api/upload-document` has no size cap. |
| Test coverage | High | 5% | Four `test_*.py` smoke scripts hit the **live production** Render URL (`https://backend-11kr.onrender.com`) with hardcoded `USER_ID` / `ORG_ID`. No unit/integration test framework. |
| API schema / OpenAPI client generation | Medium | 30% | FastAPI auto-generates `/docs`. Most endpoints lack `response_model` annotations — no client auto-generated from the schema. |
| Environment-based configuration (FE) | Medium | 30% | Backend URL hardcoded in `vite.config.ts` and `vercel.json`. No `VITE_API_BASE_URL`. |
| Dev/prod codebase unification | Medium | 30% | Two sibling Vite projects (`development/` vs `production/`) have diverged. Components like `MarketRankings*`, `SwotAnalysis*`, `TechnologyDrivers*` exist only in `production/`; `lead-stream/`, `strategist/`, `OpportunityMatchCard`, `ScoutDeploymentDetails` exist only in `development/`. |

---

## 13. Backend Endpoint Inventory

48 endpoints total. 41 fully implemented (90%+), 5 partially implemented (60-89%), 1 stub, 1 diagnostic.

### Fully Wired Endpoints (90%+)

| Method | Path | Purpose |
|---|---|---|
| POST | `/upload_file/` | Upload file to Neo4j via LLMGraphTransformer |
| POST | `/upload` | Upload prospect list CSV |
| POST | `/upload-document` | Upload to S3 + background Pinecone embedding |
| GET | `/document-status/{file_key:path}` | Document processing status |
| GET | `/user-documents` | List data sources for org |
| DELETE | `/data-source/{file_id}` | Delete from S3 + Pinecone + MongoDB |
| PUT | `/data-source/{file_id}` | Update data source metadata |
| GET | `/leads` | Get all leads by org_id (no LIMIT) |
| POST | `/leads` | Create single lead |
| PUT | `/leads/{lead_id}` | Update lead |
| DELETE | `/leads/{lead_id}` | Delete lead |
| POST | `/leads/batch-upload` | Batch upload from CSV/Excel |
| GET | `/leads/by-file` | Leads filtered by file_id |
| GET | `/leads/stream/status` | File upload statuses |
| DELETE | `/leads/by-file/{file_id}` | Delete all leads for a file |
| POST | `/leads/market-scores` | Trigger/refresh lead scoring |
| GET | `/leads/market-scores/status` | Scoring run progress |
| GET | `/leads/{lead_id}/market-score-descriptions` | Per-component scoring descriptions |
| POST | `/market-research` | Run/fetch cached market research |
| GET | `/icp` | Get or generate suggested ICPs |
| POST | `/icp-research` | Run ICP-specific research |
| DELETE | `/icp/recommended/{icp_id}` | Delete recommended ICP |
| POST | `/signals-research` | Generate single signal |
| POST | `/generate-signals-batch` | Generate 2 scout + 2 profiler signals |
| GET | `/fetch-signals` | Fetch signals for user |
| POST | `/signal_action` | Accept or reject signal |
| POST | `/signal_Ask` | Ask question about signals |
| POST | `/customer_profile` | Create/update customer profiles (ICPs) |
| GET | `/customer_profile` | Get customer profiles by org |
| POST | `/customer_profile/from_suggested_icp` | Convert suggested ICP to saved profile |
| DELETE | `/customer_profile/icp/{icp_id}` | Delete saved customer profile ICP |
| GET | `/org` | Get org for user |
| POST | `/org` | Create new org |
| POST | `/connect_org` | Map user to org |
| POST | `/registration` | Create registration |
| GET | `/registration` | List registrations |
| GET | `/test-llm` | LLM diagnostic endpoint |

### Partially Implemented / Problematic Endpoints

| Method | Path | Completion | Issue |
|---|---|---|---|
| POST | `/profile/{profile_type}` | 90% | Delete-then-insert pattern (destructive; no merge) |
| GET | `/profile/{profile_type}` | 90% | Works but company profile fetch also hits MongoDB |
| POST | `/cleanup-company-profiles` | 85% | Admin utility; no auth guard |
| GET | `/Sales_Pipeline` | 85% | No `org_id` filter — returns data across all tenants |
| GET | `/chat/` | 85% | Working; uses shared global `ConversationBufferMemory` |
| POST | `/create-company/` | 80% | No multitenancy / org_id scoping |
| POST | `/voice_graph/` | 70% | Cypher injection via f-string (`prospect_name`, `text`) |
| POST | `/text_graph/` | 70% | Cypher injection via f-string |
| GET | `/ask/` | 60% | **Bug:** returns `{response}` (Python set literal), not `{"response": response}` |
| GET | `/query/` | 60% | Raw Cypher endpoint — security vulnerability |
| POST | `/edit` | 80% | `edit_type="comment"` returns `"feature coming soon"` stub |

---

## 14. Security Issues

| Issue | Importance | Current State | Location |
|---|---|---|---|
| Backend auth enforcement | Critical | 0% remediated | All endpoints trust `user_id`/`org_id` from request body/params |
| Hardcoded credentials in `config.py` | Critical | 0% remediated | Groq, Neo4j, Mongo, Together, Tavily, RapidAPI keys have hardcoded fallbacks |
| Cypher injection (`voice_graph`/`text_graph`) | Critical | 0% remediated | `api.py:682-694, 714-727` — f-string user input into Cypher |
| Cypher injection (`process_prospect_list`) | Critical | 0% remediated | `services.py:225-269` — CSV data interpolated into Cypher |
| Raw Cypher endpoint (`GET /query/`) | Critical | 0% remediated | `api.py:653-657` — accepts arbitrary Cypher; no auth |
| CORS `allow_origins=["*"]` + `credentials=True` | High | 0% remediated | `api.py:155-161` — combination is a CORS bypass |
| `allow_dangerous_requests=True` on GraphCypherQAChain | High | 0% remediated | LLM-generated Cypher executed with no validator |
| Shared global `ConversationBufferMemory` | Critical | 0% remediated | `llm_config.py:26` — singleton shared across all users; concurrent requests cross-pollinate chat history |
| ICP org_id scoping bug | Critical | 0% remediated | `api.py:1977` — `MATCH (c:CompanyProfile) RETURN c LIMIT 1` with no org_id filter; potentially leaks data across tenants |
| Sync `pymongo` blocking async event loop | Medium | 0% remediated | Throughout `api.py`; async endpoints effectively synchronous |
| No request size cap on uploads | Medium | 0% remediated | `POST /upload-document` uncapped |

---

## 15. Dead Code Inventory

### Dead Backend Code

| Item | Location | Reason |
|---|---|---|
| `get_linkedin_followers()` | `services.py:68-84` | Imported by `api.py` but never called by any endpoint |
| `get_linkedin_recent_activity()` | `services.py:86-102` | Imported by `api.py` but never called by any endpoint |
| `extract_linkedin_username()` | `services.py:104-107` | Imported by `api.py` but never called by any endpoint |
| `calculate_prospect_score()` | `services.py:109-138` | Imported by `api.py` but never called by any endpoint |
| `get_ranked_prospects()` | `services.py:140-157` | Imported by `api.py` but never called by any endpoint |
| `vision` LLM model | `llm_config.py:15` | `ChatGroq(model="llama-3.2-90b-vision-preview")` — defined but never imported or used |

### Dead Frontend Pages

| File | Reason |
|---|---|
| `pages/AgentHub.tsx` | `/agent-hub` route renders `Signals.tsx` instead; page never shown |
| `pages/Index.tsx` | Not routed anywhere |
| `pages/MarketResearch_clean.tsx` | Backup copy; not routed |

### Dead Frontend Components (never imported in active code paths)

| File | Reason |
|---|---|
| `agent-hub/AgentActivityKanban.tsx` | Only imported by unrouted AgentHub.tsx |
| `agent-hub/AgentCards.tsx` | Only imported by other dead agent-hub components |
| `agent-hub/AgentTeamOverview.tsx` | Only imported by unrouted AgentHub.tsx |
| `agent-hub/AgentsByStatus.tsx` | Only imported by other dead agent-hub components |
| `agent-hub/AskBrewra.tsx` | Only imported by unrouted AgentHub.tsx |
| `agent-hub/FloatingAskBrewra.tsx` | Only imported by unrouted AgentHub.tsx |
| `agent-hub/InsightsAnalytics.tsx` | Only imported by unrouted AgentHub.tsx |
| `agent-hub/PipelineSnapshot.tsx` | Only imported by unrouted AgentHub.tsx |
| `agent-hub/QuotaTracker.tsx` | Only imported by unrouted AgentHub.tsx |
| `agent-hub/TodaysFocus.tsx` | Only imported by unrouted AgentHub.tsx |
| `agent-hub/WelcomeMessage.tsx` | Only imported by unrouted AgentHub.tsx |
| `market-research/SafeViewToggle.tsx` | Never imported |
| `market-research/SafeChatWithScout.tsx` | Only imported by dead `MarketResearch_clean.tsx` |
| `market-research/SafeChatWithScout copy.tsx` | Literal duplicate file |
| `market-research/DebugRenderer.tsx` | Never imported |
| `market-research/ConsumerTrends.tsx` | Never imported |
| `market-research/MarketSizeOpportunityComponent.tsx` | Never imported |
| `market-research/OpportunityMatchCard.tsx` | Never imported |
| `market-research/OpportunitySignalBadge.tsx` | Never imported |
| `market-research/LeadStreamScoutSplitView.tsx` | Never imported |
| `market-research/LeadStream.tsx` (legacy) | Only used by dead `LeadStreamScoutSplitView` |
| `deploy/ScoutDeploymentModal.tsx` | Never imported |
| `ApiTest.tsx` | Never imported |
| `MiniPieChart.tsx` (top-level) | Never imported |
| `MiniLineChart.tsx` (top-level) | Never imported |
| `dashboard/RecentDeals.tsx` | Never imported |
| `dashboard/SalesChart.tsx` | Never imported |
| `dashboard/UpcomingActivities.tsx` | Never imported |
| `dashboard/DealsPipeline.tsx` | Never imported |
| `dashboard/StatsCard.tsx` | Never imported |
| `agents/AgentPersonas.tsx` | Only imported by unrouted `Index.tsx` and `AgentHub.tsx` |
| `signals/cards/StatsCard.tsx` | Never imported |
| `signals/cards/ProjectCard.tsx` | Never imported |

### Commented-Out Code

| File | Lines | Content |
|---|---|---|
| `contexts/AuthContext.tsx` | 1-185 | Entire old version with hardcoded test values |
| `pages/Settings.tsx` | 2-69 | Entire old version of the page |

---

## 16. Known Bugs

| Bug | Location | Severity | Description |
|---|---|---|---|
| `/ask/` returns Python set literal | `api.py:646` | Medium | `return {response}` creates a Python `set`, not a JSON dict. Should be `return {"response": response}`. Clients receive `{response}` as a set string, not parseable JSON. |
| Shared global `ConversationBufferMemory` | `llm_config.py:26` | Critical | Singleton `ConversationBufferMemory` shared across all users. Concurrent requests cross-pollinate chat history — User A's questions appear in User B's context. |
| ICP generation ignores org_id | `api.py:1977` | Critical | `MATCH (c:CompanyProfile) RETURN c LIMIT 1` gets ANY company profile regardless of org. User A's ICP suggestions may be based on User B's company data. |
| Duplicate Cypher prompts | `llm_config.py:29-116, 164-247` | Low | `Cypher_gen_prompt` and `Cypher_gen_prompt2` are nearly identical (118 lines each). One is unused or both are maintained independently — divergence risk. |
| `/Sales_Pipeline` no org filter | `api.py:1410-1462` | High | Pipeline stage counts returned without org_id filtering — every user sees aggregate pipeline data across all tenants. |

---

## 17. Mock Data Usage (Not Connected to Backend)

| Component | File | Data Source |
|---|---|---|
| Profiler Lead Stream | `customers/LeadStream.tsx` | `mockLeads` array (14 fictional leads, lines 33-54) |
| Strategist Lead Stream | `strategist/StrategistLeadStream.tsx` | `leadData.ts` → `heatmapLeads` (44 fictional leads, 397 LOC) |
| Strategist Recommendations | `strategist/StrategistRecommendations.tsx` | `leadData.ts` → `heatmapLeads` + `TIER_INTELLIGENCE` |
| Calendar page | `pages/Calendar.tsx` | Simulated `setTimeout` chat responses |
| Reports page | `pages/Reports.tsx` | Hardcoded demo cards |
| Insights page | `pages/Insights.tsx` | Hardcoded percentages |
| Artifacts page | `pages/Artifacts.tsx` | Mock Scout/Profiler analysis reports |
| Tenant Selection | `pages/TenantSelection.tsx` | Hardcoded mock orgs (Acme, TechStart, Global Solutions) |

---

## Summary Heatmap

| Area | Avg Completion | Highest-Priority Gap |
|---|---|---|
| Auth & Identity | ~35% | Backend token validation (0%), shared memory bug (critical) |
| Scout — Market Intelligence | ~78% | RAG injection (25%), continuous monitoring (0%) |
| Scout — Lead Scoring | ~75% | Durability/retries (0%), pagination (0%) |
| Scout — Chat | ~65% | Hardcoded backend URL, unclear server persistence |
| Profiler — ICP | ~78% | org_id scoping bug in `/icp` endpoint |
| Profiler — Lead Stream | ~10% | Entirely mock data, zero backend |
| Profiler — Enrichment / CRM | ~4% | All LinkedIn code dead, no connectors |
| Strategist — Workspace | ~52% | No sequence persistence (0%), no execution (0%) |
| Strategist — Recommendations | ~15% | Entirely static mock data from `leadData.ts` |
| Signals Feed | ~72% | Scheduled generation (0%), feedback loop (0%) |
| Leads & CRM | ~55% | Pagination (0%), export (0%), pipeline org scoping bug |
| Mission Control | ~70% | CRM connector stubs (5%) |
| Documents & RAG | ~60% | RAG retrieval injection (25%) |
| Stub Pages (Calendar/Reports/Insights/Artifacts) | ~17% | All need real backend wiring |
| Agent Hub | ~0% | Dead code — route renders Signals instead |
| Infrastructure / Platform | ~30% | Job queue (0%), observability (5%), tests (5%), shared memory bug |
| Security | ~0% | Everything listed in Section 14 |
