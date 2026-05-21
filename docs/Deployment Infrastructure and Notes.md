# Deployment Infrastructure and Notes

Snapshot date: 2026-05-21. Captures what was discoverable from the
`brewra-gtm-intelligence` repo and a sandboxed probe of public endpoints.
Update when the deployed surface changes.

## Render backend

**URL:** `https://backend-11kr.onrender.com`

**Render service config** (`backend/render.yaml`):

| field          | value                                              |
| -------------- | -------------------------------------------------- |
| `name`         | `brewera` (note: misspelling — "brewera", not "brewra") |
| `runtime`      | `python`                                           |
| `plan`         | `free`                                             |
| `autoDeploy`   | `false` (manual redeploys only)                    |
| `buildCommand` | `pip install -r requirements.txt`                  |
| `startCommand` | `uvicorn main:app --host 0.0.0.0 --port $PORT`     |

**Path / routes.** There is no URL path prefix — endpoints live at the root of
the domain. The frontend Vite proxy rewrites `/api/foo` → `/foo` before
forwarding, and the hardcoded direct fetches in components hit paths like
`/icp-research`, `/chat/`, `/ask`, `/profile/company`, `/icp` at the root.

**Free-plan implications.**
- Cold start after idle (~50s spin-up) is normal — the first request after a
  quiet period will look like a hang.
- No autoscaling. Long-running requests (`agent_chain` has
  `max_execution_time=120`, document embedding, lead scoring) compete on a
  single dyno.
- Background tasks are in-process `fastapi.BackgroundTasks` — they are lost on
  Render restart. No queue, no retries.

**Reachability check.** From this Claude sandbox, the domain is **blocked by
network policy** (default-deny). Probes:

```
HTTP 403 — Blocked by network policy: domain backend-11kr.onrender.com:443
  detail: no matching allow rule — blocked by default deny policy
```

To check liveness from your host:

```bash
curl -i https://backend-11kr.onrender.com/
curl -i https://backend-11kr.onrender.com/docs           # FastAPI swagger UI
curl -i https://backend-11kr.onrender.com/openapi.json
```

To make the sandbox able to reach it (run on the host, not in the sandbox):

```bash
sbx policy allow network backend-11kr.onrender.com
```

## Database topology and isolation

There is **no dev / staging environment**. The repo points at exactly one
Neo4j cluster and one MongoDB cluster, and the credentials are baked into
`backend/config.py` as fallback literals next to `os.getenv(...)`. Any local
backend started from this repo writes to the same data the Render backend
serves.

### Neo4j

| item           | value                                                |
| -------------- | ---------------------------------------------------- |
| URI            | `neo4j+s://29adf28f.databases.neo4j.io`              |
| Source of truth | `backend/config.py` + `backend/backend.env` (identical) |
| Connected on import | `backend/database.py` — `driver.verify_connectivity()` runs at module load |
| Schema refresh on import | `backend/main.py:10` — `graph.refresh_schema()` runs at module load |

No `dev`/`stage`/`test` instance string was found anywhere in
`backend/config.py`, `backend/database.py`, `backend/backend.env`, or any other
config. The `tvly-dev-...` prefix on the Tavily key is Tavily's naming
convention for dev-tier API keys; it does **not** imply a separate Neo4j or
Mongo instance.

### MongoDB Atlas

| item                | value                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Cluster (single)    | `brewra-db.d3hvuf8.mongodb.net`                                                                          |
| Connection string   | `mongodb+srv://<user>:<pw>@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db` |
| Source of truth     | `backend/config.py` (literal credentials as fallback) — repeated inline ~15× in `backend/api.py`        |

**Logical databases on this cluster** (no physical separation between dev/prod):

| database          | used by                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| `Profiler`        | Customer profiles, ICP, lead-market scores                             |
| `Scout_Agent`     | Market intelligence reports, scout flow                                |
| `Signals`         | Signals tracking                                                       |
| `Org_Management`  | Tenant/org auth (referenced in `backend/tests/test_auth_org.py`)       |
| `Registration_DB` | Registrations — commented reference in `test_auth_org.py`, may be live |

### What "no isolation" means in practice

- A local backend started from this repo will read and write the **production
  Neo4j and Mongo data** Render is using.
- This is fine for read-mostly inspection (browsing UI, hitting `/docs`, GET
  endpoints). It is **not safe** for: destructive endpoints, document upload
  + embedding, lead scoring background tasks, anything that mutates `Profiler`
  / `Scout_Agent` / `Signals`.
- To run truly isolated, you would need: a second Neo4j Aura instance + a
  second Mongo Atlas cluster (or DBs under different names) + creds wired into
  `backend.env` overrides. Today the literals in `config.py` will win
  unless every `os.getenv(...)` returns a real value first.

## Vite proxy and the bypass surface

`frontend/vite.config.ts` proxies `/api/*` to
`https://backend-11kr.onrender.com` (hard-coded). In dev, code paths that go
through `apiFetch` / `enhancedApi` / `authenticatedApi` route through this
proxy. **Several call sites bypass the proxy entirely and hit Render directly
even in dev**, so swapping the proxy to a local backend won't fully isolate
the frontend.

### Hardcoded Render URLs in `frontend/`

Grouped by what changing the proxy actually changes.

**1. Conditional base-URL fallbacks (respect the dev proxy → local-backend swap helps these):**

| file                                 | line | role                                                    |
| ------------------------------------ | ---- | ------------------------------------------------------- |
| `src/lib/api.ts`                     | 8    | `API_BASE_URL` fallback for non-dev/non-Vercel builds   |
| `src/lib/jwt.ts`                     | 6    | JWT manager base URL fallback for non-dev/non-Vercel    |
| `src/lib/enhancedApi.ts`             | 36   | `enhancedApi.baseUrl` fallback for non-dev              |

**2. Unconditional Render URLs in shared libs (proxy swap does NOT help — always hit Render):**

| file                                 | line | role                                                                            |
| ------------------------------------ | ---- | ------------------------------------------------------------------------------- |
| `src/lib/api.ts`                     | 20   | `ICP_BACKEND_URL` — used by `buildIcpUrl()` for all `/icp` calls, even in dev   |
| `src/lib/enhancedApi.ts`             | 125  | Runtime hard-reset of `this.baseUrl` to the Render URL                          |

**3. Component-level direct `fetch()` to Render (proxy swap does NOT help — always hit Render):**

| file                                                              | line | endpoint                          |
| ----------------------------------------------------------------- | ---- | --------------------------------- |
| `src/components/customers/ICPSummaryOpportunity.tsx`              | 674  | `/icp-research` (POST)            |
| `src/components/market-research/ChatWithScout.tsx`                | 76   | `/chat/?question=...`             |
| `src/components/market-research/DataHistoryDialog.tsx`            | 938  | module-level `const API_BASE_URL = 'https://backend-11kr.onrender.com'` (lines 31 and 621 are commented variants) |
| `src/components/market-research/StrategistWorkspace.tsx`          | 722  | `/chat/?question=...`             |
| `src/components/market-research/AIPromptingInterface.tsx`         | 209  | `/ask?...`                        |
| `src/components/market-research/RegulatoryComplianceSection.tsx`  | 674  | `/profile/company?org_id=...`     |

**4. Non-fetch references (cosmetic / config):**

| file                                | line | role                                                                  |
| ----------------------------------- | ---- | --------------------------------------------------------------------- |
| `src/pages/MarketResearch.tsx`      | 7433 | `console.error(...)` diagnostic string only — not a fetch             |
| `frontend/vite.config.ts`           | 14   | The Vite dev proxy target itself                                      |
| `frontend/vercel.json`              | 5    | Vercel rewrite destination — production deploy routing                |
| `frontend/CORS_FIX_README.md`       | —    | Documentation                                                         |

### Practical consequence

Swapping `frontend/vite.config.ts` to proxy `/api` → `http://localhost:8000`
makes the **base API client** (`apiFetch` / `enhancedApi` / `authenticatedApi`
/ `jwt`) talk to your local FastAPI. But:

- ICP browsing/search (`buildIcpUrl`) — hits Render.
- Scout chat (`/chat/`) in both ChatWithScout and StrategistWorkspace — hits
  Render.
- ICP research POST in `ICPSummaryOpportunity` — hits Render.
- `/ask` in `AIPromptingInterface` — hits Render.
- `/profile/company` in `RegulatoryComplianceSection` — hits Render.
- The Market Research data-history dialog — hits Render.
- `enhancedApi` may also self-reset to Render at runtime (line 125).

If you actually want a clean "everything goes to local backend" dev mode, the
bypass call sites in section 3 (and the unconditional libs in section 2) need
to be refactored to route through `apiFetch` / `enhancedApi`. That's a
non-trivial diff and orthogonal to just running the servers.
