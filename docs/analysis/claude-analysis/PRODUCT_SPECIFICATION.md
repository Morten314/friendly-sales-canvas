# Brewra — Product Specification

> **Snapshot — pre-backend-refactor.** This document reflects the backend as the flat `api.py`/`services.py` monolith and is preserved as a point-in-time analysis (authored 2026-05-08). For the **current** backend architecture see [`docs/architecture/BACKEND.md`](../../architecture/BACKEND.md). Frontend sections are likewise a snapshot; the frontend refactor is in progress (see specs 14–21).

> Reverse-engineered from `backend/` and `PWA-multi-tenancy/development/friendly-sales-canvas/` on 2026-05-04.
> Marketing copy on brewra.com is client-rendered; positioning here is taken from the user's product brief and verified against the built UI (page subtitles, sidebar labels, agent prompts).

## 1. Positioning

**Brewra is a B2B GTM/sales intelligence platform for SaaS go-to-market teams.** It uses a small set of named AI agents to surface buying signals, refine ICP/persona understanding, and translate those into concrete sales plays. The product targets revenue, marketing, and partnership teams who want signal-driven outbound rather than spray-and-pray.

The core promise: **better signals → better timing → better messaging.**

## 2. Users & Tenancy

| Actor | Source of truth | Notes |
|---|---|---|
| Authenticated user | Firebase Email/Password (`AuthContext.tsx`) | Per-user `localStorage` keys; no SSO, no social login. |
| Organization (tenant) | `org_id` resolved via `GET /org?user_id=…` | Multi-tenant model; one user → one org in current code. A separate `TenantContext` allows selecting between tenants but is in practice a single-org flow. |
| Admin | `admin_panel.html`, `registration_admin_panel.html` (server-rendered HTML) | Out-of-band admin tooling — not part of the PWA. |

Multi-tenancy is enforced at the data layer via `org_id` filters in Neo4j Cypher and MongoDB queries. There is **no server-side auth middleware**: `user_id`/`org_id` are passed as request parameters and trusted. The frontend has a JWT manager (`lib/jwt.ts`) that posts to `/api/auth/token` and `/api/auth/refresh` and gracefully degrades on 404 — the auth endpoints exist on the FE side but are not implemented on the backend.

## 3. The Agents

The product is structured around three customer-facing agents plus a cross-cutting Signals feed. Implementation maturity differs significantly between the marketing narrative and the code.

### 3.1 Scout — The Researcher

> "I scan markets, signals, and data to uncover your next opportunity."

**Implemented surface area:** dedicated route `/your-ai-team/scout/:tab` with four tabs: Market Intelligence, Lead Stream, Deployment, Chat With Scout.

**Capabilities present in code:**
- Market Intelligence: five research components — Market Size & Opportunity, Industry Trends, Competitor Landscape, Regulatory & Compliance, Market Entry — each implemented as a section component on the FE and as `Research_Market_1..5` functions in `services.py:276-1400`. Each calls a LangChain `agent_chain` with a Tavily WebSearch tool to compile a structured JSON report.
- Lead Stream: `ScoutLeadStream` and supporting heatmap helpers (`marketScoresHeatmap.ts`) that visualize how known leads map to ICPs/markets, scored by the Lead Market Scoring pipeline (`POST /leads/market-scores`, async background task `_run_market_scoring_for_org`).
- Scout Chat: `ScoutChatPanel` and `ScoutChatWithHistory` provide context-aware Q&A over the market intelligence already produced (`POST /signal_Ask`, `POST /signal-ask`-equivalent endpoints).
- Deployment tab: configuration UI for "deploying" Scout into a customer's environment (Scout API key, deployment details). Mostly a placeholder.

**Gaps versus the brief:** "Tracks ICP across markets" and "detects shifts in personas/intent" are partially modelled — there is no continuous tracking loop; insights are produced on demand and cached. There is no persistent monitoring/alerting layer.

### 3.2 Profiler — The Analyst

> "I map your ideal customers and stakeholders — and show you who really matters."

**Implemented surface area:** split across two routes — `/mission-control` (ICP and data-source setup) and `/customers` (Lead Stream + ICP profiles + Chat With Profiler).

**Capabilities present in code:**
- ICP authoring & management: `ICPManager`, `ICPBuilder`, `ICPInsights`, `SuggestedICPCards`, `SuggestedICPsGallery`. Backed by `POST /customer_profile`, `POST /customer_profile/from_suggested_icp`, `DELETE /customer_profile/icp/{icp_id}`. Stored in MongoDB `Customer_Profiles`.
- ICP research: `ICP_generator` plus `icp_research_1..4` (`services.py`) generate ICPs from the company profile via `agent_chain` + WebSearch.
- Data sources: `DataSourcesManager` lists Salesforce, HubSpot, file upload connectors. Status UI is largely **mocked**; only file upload (`POST /upload-document` → S3 → Pinecone) is actually wired end-to-end.
- Profiler Chat: `ProfilerChatPanel`, `ProfilerChatWithHistory`. Sends a custom event bus (`profilerExportData`, `profilerCreateICP`) so chat output can be promoted into the ICP tab.
- Persona enrichment from LinkedIn/Apollo: `services.py:68-102` has LinkedIn helpers via RapidAPI, but they are **not wired into any active flow**. Apollo is not present in code at all.

**Gaps versus the brief:** "Enriches contact data from LinkedIn, Apollo, and CRM" — only stubs exist; CRM connectors and Apollo integration are unimplemented. "Highlights hidden buying centers and champions" is not represented in code beyond contact graph traversal in Neo4j.

### 3.3 Strategist — The Orchestrator

> "I connect the dots between strategy and execution."

**Implemented surface area:** route `/your-ai-team/strategist/:tab` (workspace, recommendations). Page is `Deals.tsx` (82 lines, thin wrapper); the actual workspace is `StrategistWorkspace.tsx` (~809 lines).

**Capabilities present in code:**
- Lead-context handoff: a signal card on the Signals page can stash a lead in `sessionStorage.strategistContext`, navigate to the Strategist, and have it hydrate.
- GTM strategy & sequence generation: `StrategistWorkspace` runs a fake step-through ("analyzing lead signals" → "mapping messaging angles" → "evaluating timing windows" → "building recommendations") and then renders email/LinkedIn/call/wait sequences with AI-suggested angles.
- Tier-based recommendations: `StrategistRecommendations` and `StrategistLeadStream` group leads into Tier 1/2/3 (Direct Outreach / Nurture / Monitor & Educate) using inline emerald/amber/red Tailwind classes.

**Gaps versus the brief:** **There is no Strategist endpoint on the backend.** The Strategist is a frontend-only experience that consumes already-produced Scout/Profiler outputs and renders them into a sequence template; the "orchestration" is mostly UI structure. Next-Best-Actions surface from Scout/Profiler signal payloads (each signal carries `NBAs: [{nba, prompt}]`), not from a dedicated Strategist agent.

### 3.4 Signals — Cross-Agent Feed

Not advertised as an agent, but central to the UX. `/signals` shows a unified feed of Scout-tagged and Profiler-tagged signal cards, each with: headline, snippet, description, source URL, agent badge, NBAs, contextual suggestions. Backed by `POST /generate-signals-batch` (one round-trip produces a batch from both agents) and `POST /signal_action` (accept/reject) and `POST /signal_Ask` (Q&A). Signals are stored in MongoDB and queried via `GET /fetch-signals`.

In code, `search_signals_scout()` and `search_signals_profiler()` (`services.py:1910-2525`) are ~80% the same code, differing only by prompt persona. This is the single biggest implementation observation: **Scout vs. Profiler are differentiated almost entirely by prompt, not architecture.**

## 4. Primary User Journeys

1. **Onboarding / Mission Control.** New user signs up → AuthContext fetches org → user lands on `/mission-control` to define Company Profile, connect Data Sources, and review/save Suggested ICPs. Most data sources are visual mocks; PDF/document upload is the working path (S3 + Pinecone embedding).
2. **Scout-driven discovery.** User opens Scout → triggers each Market Intelligence component (Market Size, Trends, Competitors, Regulatory, Entry). Each call goes to `/market-research` with `component_name`. Results are cached per `(user_id, org_id, component_name)` in MongoDB and `localStorage`. User can chat with Scout against any component.
3. **Lead scoring.** From Scout's Lead Stream, user kicks off `/leads/market-scores` which fans out across leads, runs the same five Market components against each lead's profile, and writes per-component scores into MongoDB `Lead_Market_Scores`. Status is polled via `/leads/market-scores/status`.
4. **Signal triage.** User opens `/signals` → batch generation produces signals from Scout and Profiler → user accepts, dismisses, asks a follow-up, or hands the signal to Strategist.
5. **Strategist sequencing.** Lead context flows into `/your-ai-team/strategist/workspace` → user reviews tiered recommendations and drafts an outreach sequence (email/LinkedIn/call). No backend persistence of sequences was found; this is currently a generation-only experience.
6. **Profile management.** `/customers` for refining ICPs and chatting with Profiler; `/settings` for User Profile, Company Profile, Scout Deployment, Agent Profile.

## 5. Functional Inventory

| Area | Status | Notes |
|---|---|---|
| Email/password auth | Working (Firebase) | No SSO, no MFA, no password reset UI. |
| Multi-tenant org scoping | Working (filter-based) | Relies on client-supplied IDs; no server enforcement. |
| Company Profile editor | Working | `POST /profile/{type}`. |
| Suggested ICP generation | Working | LLM + WebSearch; results cached. |
| ICP CRUD | Working | MongoDB-backed; some `localStorage` fallback. |
| Lead CRUD + CSV upload | Working | Neo4j; flexible schema-on-read. |
| Document upload + RAG | Working but loosely integrated | S3 + Pinecone; embeddings produced but rarely fed back into research prompts. |
| Market Intelligence (5 components) | Working | Heavy LLM cost; 120s agent timeout is tight. |
| Lead Market Scoring | Working but fragile | `BackgroundTasks`; lost on restart, no retries. |
| Signals batch + action + ask | Working | The core daily-driver loop. |
| Strategist sequences | FE-only generation | No backend persistence or send capability. |
| CRM connectors (Salesforce/HubSpot) | Mocked | UI only. |
| LinkedIn enrichment | Stubbed | RapidAPI helpers exist; not invoked from any endpoint. |
| Apollo enrichment | Not implemented | |
| Calendar / Reports / Insights / Artifacts | Stub pages | Routes exist; little real functionality. |
| PWA install + offline | Installable, not offline-capable | Static-asset SW only; no API caching. |
| Email/LinkedIn send | Not implemented | Strategist drafts outputs but cannot send. |

## 6. Non-Functional Requirements (observed, not stated)

- **Latency budget:** ~120s per market-research call (LLM + 5–7 web searches). UI uses a queue + rate-limit manager (4 req/min) to stay under DeepSeek-style provider limits.
- **Throughput:** Lead scoring is sequential per org. A 500-lead org × 5 components × ~90s ≈ 60+ hours of sequential agent calls — not currently sized for production.
- **Reliability:** No retry/persistence for background jobs. Render free tier means cold starts will occasionally drop in-flight work.
- **Privacy/security:** No JWT validation server-side, CORS `*`, hardcoded credentials in `config.py`, raw Cypher endpoint (`GET /query/`), Cypher-injection via f-strings in `voice_graph`/`text_graph`. Not yet appropriate for handling customer CRM data at scale.

## 7. Roadmap-Affecting Findings

These are not features; they are the gaps a CTO would want to close before scaling sales:

1. **Agent identity is mostly cosmetic.** Scout/Profiler share an execution backbone; Strategist has no backend. Either commit to true agent specialization (distinct tools, memory, prompts, telemetry per agent) or rename "agents" to "workflows" and stop maintaining the fiction.
2. **No closed loop.** Signals are generated on user request; nothing watches markets continuously, alerts, or learns from accept/reject feedback. The product's signal-driven promise needs a scheduler + feedback ingestion.
3. **CRM/enrichment integrations are the product's marketing edge but not yet built.** Salesforce, HubSpot, Apollo are mocked or absent.
4. **Sequence execution is the natural Strategist payoff** — drafting without sending leaves the user copy-pasting into other tools.
5. **Observability is missing.** No structured logging, no per-agent latency/cost telemetry, no LLM call traces. This is the first thing to fix before tuning prompts or sizing capacity.

## 8. Phased Roadmap

Phases are ordered by dependency and risk-reduction, not by calendar.

### Phase 1 — Stop the bleeding (security & correctness)
- Backend Firebase ID token verification middleware; derive `user_id`/`org_id` from claims, never from request body.
- Rotate every credential currently in `config.py` and remove hardcoded fallbacks.
- Tighten CORS to known origins with `credentials: true`.
- Remove `GET /query/`; parameterize Cypher in `voice_graph`/`text_graph`; turn off `allow_dangerous_requests` on `GraphCypherQAChain`.
- Add pagination to `GET /leads`; remove the silent 5000-cap from the scoring path.
- Move from `BackgroundTasks` to a durable queue (Celery + Redis, Inngest, or Cloud Tasks) so document embedding and lead scoring survive restarts.

### Phase 2 — Foundations (so further work doesn't multiply debt)
- Split `api.py` into routers by domain; move prompts to a `prompts/` package versioned alongside code.
- Switch Mongo to `motor` (async) so async endpoints actually scale.
- Adopt LangSmith / OpenLLMetry tracing; add structured logging and per-endpoint timing/cost metrics.
- Smoke-test suite covering each agent path and the ten or so business-critical endpoints.
- Collapse the `development/` and `production/` Vite folders into one project with branch-based Vercel deploys; delete dead variants.
- Adopt React Query (already a dep) as the single server-state cache; retire the three ad-hoc cache layers.

### Phase 3 — Make the product real
- Build a real **Strategist backend**: a service that takes Scout/Profiler outputs, produces sequences as first-class resources (`POST /sequences`, `GET /sequences/{id}`), and persists them.
- Differentiate Scout vs. Profiler in code (distinct tools, memory, telemetry) — not just in prompt.
- First CRM connector — pick one of Salesforce or HubSpot — implemented end-to-end (read leads/contacts, write activities). Mocks come down only when one is real.
- Scheduled signal generation: a job runs per ICP/account on a cadence and pushes new signals into the feed (the "closed loop" the product promises).
- Persist accept/reject feedback on signals; use it to filter or rerank future generations.

### Phase 4 — Sequence execution
- Email send (transactional + reply tracking) and LinkedIn message hand-off (Apollo or Outreach as the system of record, with deep links if direct send isn't viable).
- Sequence templates, A/B angles, and per-step branching.
- Deliverability and compliance plumbing (unsubscribe, bounce handling, GDPR record).

### Phase 5 — Enterprise readiness
- SSO/SAML, RBAC (admin/member/read-only), audit log, data export.
- Apollo + LinkedIn enrichment wired into Profiler so persona claims have provenance.
- Usage metering and billing.
- SOC 2 controls (logging, retention, access reviews) once the above are live.

## 9. Out of Scope (not seen in code)

- In-app email/LinkedIn sending or scheduling
- Webhooks / event bus for external systems
- Role-based access control (admin vs. member)
- Audit trail / data export
- Billing / plans / usage metering

---
*Source files of record:* `backend/api.py`, `backend/services.py`, `backend/models.py`, `backend/llm_config.py`, `backend/config.py`, `backend/render.yaml`, `PWA-multi-tenancy/development/friendly-sales-canvas/src/{App.tsx,pages/*,components/*,contexts/*,lib/*}`, repo-root `*.md` integration guides.
