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
runs four sequential Claude+Tavily calls (`max_tokens=8192`). Measured live
(direct to Render, 2026-06-13): **~117–130s**. A single Claude call
(`/signal_ask_claude`) is **~33s**. This ~2-minute batch latency is the reason
the production frontend calls Render directly rather than through the Vercel
`/api` rewrite (which has a ~120s gateway timeout — see below).

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
// Dev + localhost use the Vite /api proxy; Vercel production calls Render directly.
const API_BASE_URL = (import.meta.env.DEV || hostname is localhost/127.0.0.1)
  ? "/api"
  : BACKEND_BASE_URL;
```

All FE→backend calls route through `buildApiUrl()` / `apiFetch()` in that file.
The per-component hardcoded-URL bypasses from the pre-refactor codebase
(`src/lib/api.ts`, `ICPSummaryOpportunity`, `ChatWithScout`, `DataHistoryDialog`,
the old `buildIcpUrl` `/icp` bypass, etc.) are **gone** — those files were
removed/relocated in the feature-folder refactor; everything now goes through
`transport.ts`.

- **Dev / `vite preview` / localhost e2e:** requests target `/api/...` → the Vite
  dev proxy (`frontend/vite.config.ts`, target `brewra-gtm-intelligence.onrender.com`)
  → Render. (Playwright's `**/api/*` route handlers also hook this path.)
- **Vercel production:** requests target `https://brewra-gtm-intelligence.onrender.com/...`
  **directly** — they do **not** pass through the Vercel `/api` rewrite. This is
  deliberate: `frontend/vercel.json` rewrites `/api/(.*)` → Render, but Vercel's
  edge gateway **times out proxied rewrites at ~120s** (confirmed 2026-06-13:
  `POST /api/generate-signals-batch_claude` *through* Vercel returns **502 at
  ~119s**, while the same call **direct to Render** returns 200 at ~120s), and the
  Claude signal batch often runs longer than that. Calling Render directly avoids
  the ceiling; the backend sets `allow_origins=["*"]` so cross-origin browser
  calls are accepted.

> **Consequences for debugging:**
> - The `vercel.json` `/api/*` rewrite is **effectively vestigial in production** —
>   the FE bypasses it. It still matters for dev parity and any code that hardcodes
>   `/api`. If you ever route production through `/api` again, the ~120s Vercel
>   ceiling re-applies; keep long endpoints (the signal batch) under it.
> - Because production hits Render directly, a slow/failing batch surfaces as a
>   **direct Render response** (e.g. a 500 from a transient Claude/Tavily/JSON
>   error, or a long wait), **not** a Vercel 502. When triaging a Scout-signal
>   failure, read the **Render** logs, not Vercel's.

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
