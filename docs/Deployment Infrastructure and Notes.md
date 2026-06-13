# Deployment Infrastructure and Notes

Snapshot date: **2026-06-13** (refreshed from the 2026-05-21 original). Captures
the deployed surface after the frontend feature-folder refactor and the backend
host repoint (`TD-FE-13`). Update when the deployed surface changes.

## Customer-facing surfaces

| surface          | URL                                            | host                                                                 |
| ---------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| PWA (frontend)   | `https://brewra-gtm-intelligence.vercel.app`   | Vercel — deploys from the monorepo, Root Directory `frontend/`       |
| Backend API      | `https://brewra-gtm-intelligence.onrender.com` | Render — repointed from the now-suspended `backend-11kr.onrender.com`|
| Landing page     | `brewra.com`                                   | separate no-code site (not in this repo)                             |

Both app URLs were verified live on 2026-06-13 (`GET /` 200 on Vercel;
`/openapi.json` 200 on Render).

## Render backend

**URL:** `https://brewra-gtm-intelligence.onrender.com` (verified live — `/docs`
swagger UI and `/openapi.json` return 200).

**Render service config** (`backend/render.yaml`):

| field          | value                                              |
| -------------- | -------------------------------------------------- |
| `name`         | `brewera` — **stale, see discrepancy note below**  |
| `runtime`      | `python`                                           |
| `plan`         | `free`                                             |
| `autoDeploy`   | `false` (manual redeploys via the Render dashboard)|
| `buildCommand` | `pip install -r requirements.txt`                  |
| `startCommand` | `uvicorn main:app --host 0.0.0.0 --port $PORT`     |

> **Service-name discrepancy.** `render.yaml` declares `name: brewera` (which
> would map to `brewera.onrender.com`), but the live backend serves from
> `brewra-gtm-intelligence.onrender.com`. The running service was renamed /
> recreated on the Render dashboard during the host repoint; the committed
> `render.yaml` is stale and is **not** the source of truth for the live deploy
> (`autoDeploy: false`, manual). Verify the real service name on the dashboard
> before relying on `render.yaml`.

**Path / routes.** No URL path prefix — endpoints live at the domain root
(`/signal_ask_claude`, `/generate-signals-batch_claude`, `/icp-research_claude`,
`/profile/company`, `/org`, `/v2/...`, etc.). See "Frontend → backend routing"
for how the FE reaches them in dev vs production.

**Free-plan implications.**
- Cold start after idle (~50s spin-up) is normal — the first request after a
  quiet period looks like a hang.
- No autoscaling. Long-running requests (the Claude signal batch, `agent_chain`
  with `max_execution_time=120`, document embedding, lead scoring) compete on a
  single instance.
- Background tasks are in-process `fastapi.BackgroundTasks` — lost on restart.
  No queue, no retries.

**Latency note (Claude signal batch).** `POST /generate-signals-batch_claude`
runs four Claude+Tavily calls (`max_tokens=8192`) **concurrently**
(`asyncio.gather`). Measured live (2026-06-13, warm): **~40–45s** direct to
Render and **~45s** through the Vercel `/api` rewrite. A single Claude call
(`/signal_ask_claude`) is **~30–33s**. The batch formerly ran these calls
sequentially (~120s), which is why production used to call Render directly; now
that it fits well under the Vercel ~120s gateway timeout, production routes
through `/api` (see below). Cold-start caveat: a cold free-dyno spin-up (~50s)
stacked on the batch (~45s) is ~95s — under the ceiling but with only ~25s of
headroom (`TD-FE-68`).

**Liveness check** (run on your host, or in a sandbox with the domain allowed):

```bash
curl -i https://brewra-gtm-intelligence.onrender.com/
curl -i https://brewra-gtm-intelligence.onrender.com/docs        # FastAPI swagger UI
curl -i https://brewra-gtm-intelligence.onrender.com/openapi.json
```

From a fresh Claude sandbox both hosts are blocked by the default-deny network
policy. Allow them on the host (not inside the sandbox), using the bare domain
(not a full URL):

```bash
sbx policy allow network brewra-gtm-intelligence.onrender.com
sbx policy allow network brewra-gtm-intelligence.vercel.app
```

## Frontend → backend routing

**Single source of truth:** `frontend/src/shared/api/transport.ts`.

```ts
export const BACKEND_BASE_URL = "https://brewra-gtm-intelligence.onrender.com";
// Every environment routes the client stack through `/api`.
const API_BASE_URL = "/api";
```

The main client stack (`buildApiUrl()` / `apiFetch()` and the TanStack
`shared/api/client` layer) routes through `/api` in **all** environments as of
2026-06-13:

- **Dev / `vite preview` / localhost e2e:** `/api/...` → the Vite dev proxy
  (`frontend/vite.config.ts`, target `brewra-gtm-intelligence.onrender.com`) →
  Render. (Playwright's `**/api/*` route handlers also hook this path.)
- **Vercel production:** `/api/...` → the `frontend/vercel.json` rewrite
  (`/api/(.*)` → Render) → Render.

Production **used to** call Render directly to dodge Vercel's edge gateway, which
times out proxied rewrites at ~120s — the Claude signal batch then ran ~120s
sequentially. The batch now runs its calls concurrently (~40–45s; verified live
2026-06-13: `POST /api/generate-signals-batch_claude` *through* Vercel → **200 at
~45s**), so the direct-to-Render workaround is retired in favor of `/api`
(dev/prod parity, no reliance on the CORS wildcard for the main client path).

> **Residual direct-backend callsites.** A handful of components still import
> `BACKEND_BASE_URL` and call Render directly, bypassing `/api`: streaming
> `GET /chat/` in `ChatWithScout` and `StrategistWorkspace`, `GET /ask` in
> `AIPromptingInterface`, and `GET /profile/company` in
> `RegulatoryComplianceSection`. These rely on the backend `allow_origins=["*"]`
> CORS wildcard and are tracked as debt (`TD-FE-68`) — not migrated with the
> batch fix.

> **Consequences for debugging:**
> - Production now reaches Render *through* the `vercel.json` `/api/*` rewrite, so
>   the ~120s edge ceiling applies again. A warm batch (~45s) clears it
>   comfortably; a cold free-dyno spin-up (~50s) + batch (~45s) ≈ ~95s leaves only
>   ~25s of headroom. If cold-start 502s appear, keep the dyno warm or fall the
>   batch endpoint back to direct-to-Render (`TD-FE-68`).
> - A failing batch can now surface **either** as a Vercel 502 (only if it exceeds
>   ~120s) **or** as a direct Render response proxied back (e.g. a 500 from a
>   transient Claude/Tavily/JSON error). Read the **Render** logs for the
>   application-level traceback; check Vercel's edge/function logs only to rule out
>   a gateway timeout.

## Database topology and isolation

There is **no dev / staging environment**. The repo points at exactly one Neo4j
cluster and one MongoDB cluster, and the credentials are baked into
`app/core/config.py` as fallback literals next to `os.getenv(...)`. Any local
backend started from this repo writes to the same data the Render backend serves.

### Neo4j

| item                      | value                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------- |
| URI                       | `neo4j+s://29adf28f.databases.neo4j.io`                                                 |
| Source of truth           | `app/core/config.py` (env vars + fallback literals)                                     |
| Connected at startup      | `app/core/clients` — `verify_connectivity()` runs in the `app/main.py` lifespan handler |
| Schema refresh at startup | `app.main` lifespan handler — guarded `graph.refresh_schema()` after client init        |

No `dev`/`stage`/`test` instance string was found anywhere in `app/core/config.py`
or any other config. The `tvly-dev-...` prefix on the Tavily key is Tavily's
naming convention for dev-tier API keys; it does **not** imply a separate Neo4j
or Mongo instance.

### MongoDB Atlas

| item               | value                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| Cluster (single)   | `brewra-db.d3hvuf8.mongodb.net`                                                                           |
| Connection string  | `mongodb+srv://<user>:<pw>@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db`  |
| Source of truth    | `app/core/config.py` (env vars + literal credentials as fallbacks)                                       |

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
  endpoints). It is **not safe** for: destructive endpoints, document upload +
  embedding, lead scoring background tasks, anything that mutates `Profiler` /
  `Scout_Agent` / `Signals`.
- To run truly isolated, you would need: a second Neo4j Aura instance + a second
  Mongo Atlas cluster (or DBs under different names) + creds wired into
  `backend.env` overrides. Today the literals in `config.py` will win unless every
  `os.getenv(...)` returns a real value first.

## Known stale references (not yet reconciled)

- **`backend/render.yaml` `name: brewera`** — see the discrepancy note above;
  reconcile against the Render dashboard.
- **`scripts/safety_net/`** still references the old `backend-11kr.onrender.com`
  host. That folder is an **intentionally frozen** pre-refactor snapshot ("don't
  refresh it") — left as-is on purpose.
- **`plans/`, `specs/`, `docs/reviews/`, `docs/analysis/`** reference the old host
  / FE structure as frozen historical record — left as-is by convention.
