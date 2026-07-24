# Spec 42 — Environment-driven configuration (production + staging isolation)

**Status:** Draft (design intent)
**Date logged:** 2026-06-25
**Author origin:** Brainstorm to support a standalone staging environment — a full
copy of all five external services (Neo4j, MongoDB, Pinecone, Render, Vercel)
driven entirely by environment variables, with no shared data between prod and
staging.
**Pairs with plan:** `plans/42-env-driven-config-prod-staging.md` (to be written next).

---

## 1. Context & motivation

Today the backend points at exactly one of everything — one Neo4j Aura instance,
one MongoDB Atlas cluster, one Pinecone project, one Render service, one Vercel
project — and the connection details are **hardcoded as fallback literals** in
`backend/app/core/config.py` (and, for two API keys, as bare literals with no
`os.getenv` at all). The frontend's backend URL is hardcoded in three places, and
the Vercel app URL is hardcoded in the (currently dead) backend CORS list.
`docs/Deployment Infrastructure and Notes.md` records the consequence: **there is
no dev/staging environment**, and any backend started from this repo reads and
writes the production Neo4j/Mongo data.

The goal is to stand up a **staging environment that is a complete, isolated copy
of all five services**, running from the same `master` branch as production. The
only thing that distinguishes prod from staging is the set of environment
variables active on each platform. Achieving that requires removing every
hardcoded service value from the code first.

### 1.1 The core problem with the current pattern
`config.py` uses `os.getenv("X") or "<literal>"`. A **missing or misspelled env
var silently falls back to the production literal.** For a staging service this is
the worst possible failure mode: staging would quietly read and write production
data while appearing healthy. This spec eliminates that pattern entirely.

### 1.2 Security note (carried into scope, not deferred)
Every secret currently in `config.py`, in `backend/backend.env`, and in the two
prod-probe test scripts is **committed to git history and must be treated as
compromised**: Neo4j password, Mongo password, Together key, Tavily key, RapidAPI
key, and two Pinecone keys. Removing them from the working tree does **not** remove
them from history. Credential **rotation** is therefore a required deliverable of
this work (§6), not an optional follow-up. (Optional history-scrubbing is noted but
out of scope.)

### 1.3 Business posture (carried from CLAUDE.md)
Brewra is MVP, pre-launch, 0 live users — optimize for velocity over ceremony.
This change is hygiene + enablement (it unblocks safe staging), not urgent
remediation. The one genuine urgency is the credential exposure (§1.2).

---

## 2. Scope

### 2.1 In scope
- Remove **all** hardcoded service values (secrets, connection targets, URLs, the
  Pinecone index name, the CORS origin list) from backend and frontend code.
- Make every such value env-driven, with **fail-hard-on-missing** for required
  values (no silent fallbacks).
- Define a documented env-var contract (§4.4) and a committed `.env.example` for
  each stack.
- Wire the backend CORS allow-list (currently `allow_origins=["*"]`, with a dead
  `origins` literal in `config.py`) to an env-driven list — closing the existing
  security TODO at `app/main.py:73-78`.
- Rotate every exposed credential and re-issue them only via env vars (§6).

### 2.2 Out of scope
- Provisioning the staging instances themselves (Neo4j/Mongo/Pinecone/Render/Vercel
  dashboard actions) — that's an operational runbook produced alongside the plan,
  not a code change.
- Scrubbing secrets from git history (BFG / filter-repo). Rotation is the required
  fix; history rewrite is optional and deferred.
- Moving to a typed settings framework (pydantic-settings). Explicitly rejected in
  favor of the minimal `os.getenv` refactor (§3, decision D2).
- Migrating any **data** into staging — staging starts empty (databases and the
  Pinecone index are created lazily by the app on first write).
- Tuning the non-environmental constants (model id, signal window, token limits) —
  these stay as in-code defaults (§3, decision D4).

---

## 3. Decisions (resolved during brainstorm)

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | **Fail hard at startup** when a required env var is missing/empty. | Eliminates the silent-fallback-to-prod footgun (§1.1). |
| D2 | **Keep the minimal `os.getenv` + `python-dotenv` pattern.** No pydantic-settings. | Smallest, lowest-risk diff; matches existing module-level config style. |
| D3 | **Frontend goes fully direct-to-backend in deployed environments** (Option A): drop the `vercel.json` `/api` rewrite; deployed builds call the backend via `VITE_API_BASE_URL`. | `vercel.json` rewrites cannot read env vars, so a static rewrite is the last un-parameterizable hardcoded URL. Going direct removes it, relies on the now-configured CORS allow-list, and *improves* slow-batch headroom by bypassing Vercel's ~120s edge gateway. Local dev keeps the Vite `/api` proxy. |
| D4 | **Non-secret, non-environmental tuning constants keep in-code defaults**: `CLAUDE_SONNET_MODEL`, `CLAUDE_SIGNAL_WINDOW_SECONDS`, `CLAUDE_SIGNAL_TOKEN_LIMIT_5M`, `CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS`. | They are identical across environments and carry no secret/targeting risk; requiring them would only add friction. They remain overridable via env. |

---

## 4. Design

### 4.1 Backend — `app/core/config.py`
1. Add a required-getter helper:
   ```python
   def _require(name: str) -> str:
       val = os.getenv(name)
       if not val:
           raise RuntimeError(f"Missing required environment variable: {name}")
       return val
   ```
2. Convert each value:
   - **Neo4j:** `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` → `_require`.
   - **Mongo:** read the full connection string from `MONGO_URI` via `_require`.
     This removes the hardcoded cluster host `brewra-db.d3hvuf8.mongodb.net`
     *and* the user/password literals and the f-string URI assembly. The prior
     `MONGO_USERNAME`/`MONGO_PASSWORD` split is dropped (the full SRV string is
     pasted per environment).
   - **Together / Tavily / RapidAPI:** `TOGETHER_API_KEY`, `TAVILY_API_KEY`,
     `RAPIDAPI_KEY` → `_require` (the latter two are currently bare literals).
   - **Pinecone:** `PINECONE_API_KEY` → `_require`; add `pinecone_index =
     _require("PINECONE_INDEX")`.
   - **S3:** `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY`, `AWS_SECRET_KEY` →
     `_require`.
   - **CORS:** `origins = [o.strip() for o in _require("CORS_ALLOWED_ORIGINS").split(",") if o.strip()]`.
   - **Tuning constants (D4):** keep current `os.getenv(...) or "<default>"`.
3. Make dotenv loading explicit and deterministic: load a `.env` from the backend
   directory via an explicit path (instead of bare `load_dotenv()` which resolves
   against CWD). Retire the misnamed, currently-unloaded `backend/backend.env`.

### 4.2 Backend — other files
- **Pinecone index name:** replace the hardcoded `"brewra-documents"` at
  `app/services/_retrieval.py:74`, `app/services/data_sources/pipeline.py:148`,
  and `app/services/data_sources/persistence.py:186-187` with the shared
  `config.pinecone_index`.
- **CORS wiring:** `app/main.py:76-80` — replace `allow_origins=["*"]` with the
  env-driven `origins` list from config; remove the legacy TODO comment.
- **Prod-probe scripts:** remove the hardcoded `pcsk_…` Pinecone key from
  `backend/test_upload_embedding.py` and `backend/test_delete_api.py`; read from
  env. (These are integration probes, not the pytest suite.)

### 4.3 Frontend (Option A — D3)
- `src/shared/api/transport.ts`: `BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL`
  and `API_BASE_URL = import.meta.env.VITE_API_BASE_URL`. No literal URLs.
- `vite.config.ts`: derive the dev-proxy `target` from `loadEnv(...).VITE_BACKEND_BASE_URL`,
  with a localhost-friendly default so local dev needs no extra setup.
- `vercel.json`: **remove the `/api/(.*)` rewrite**. Keep the SPA catch-all
  (`/(.*) → /index.html`) and build settings. Deployed builds call the backend
  directly via `VITE_API_BASE_URL`.
- Add a committed `frontend/.env.example` documenting `VITE_API_BASE_URL` and
  `VITE_BACKEND_BASE_URL`.
- Local dev sets `VITE_API_BASE_URL=/api` (uses the Vite proxy); deployed
  environments set it to the full backend URL.

### 4.4 The env-var contract
**Backend (required):** `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`,
`MONGO_URI`, `PINECONE_API_KEY`, `PINECONE_INDEX`, `TOGETHER_API_KEY`,
`TAVILY_API_KEY`, `RAPIDAPI_KEY`, `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY`,
`AWS_SECRET_KEY`, `CORS_ALLOWED_ORIGINS`.
**Backend (optional, defaulted — D4):** `CLAUDE_SONNET_MODEL`,
`CLAUDE_SIGNAL_WINDOW_SECONDS`, `CLAUDE_SIGNAL_TOKEN_LIMIT_5M`,
`CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS`.
**Frontend (build-time, required):** `VITE_API_BASE_URL`, `VITE_BACKEND_BASE_URL`.

### 4.5 The two environment sets
Same `master` branch everywhere; environment = the active var set on each platform.

| | Production | Staging |
|---|---|---|
| Neo4j | existing Aura instance | new Aura instance |
| Mongo | existing Atlas cluster | new Atlas cluster |
| Pinecone | existing project/key | new project/key (same index name OK) |
| Render | existing service | new service (same repo/branch) |
| Vercel | existing project | new project (same repo, root `frontend/`) |
| CORS | prod Vercel origin(s) | staging Vercel origin(s) |
| Local dev | gitignored `.env` from `.env.example` | — |

---

## 5. Testing & verification
- **Backend unit:** a test asserting `_require` raises `RuntimeError` naming the
  missing variable; confirm the `BREWRA_SKIP_DB_INIT` boot path still works with
  the new required reads (tests mock clients, so set the vars in the test env or
  the skip path).
- **Frontend:** `npm run preflight` (typecheck, lint, build) against a sample
  `.env`; confirm build fails clearly if `VITE_API_BASE_URL` is absent.
- **Manual smoke:** boot the backend with one required var deliberately removed →
  confirm it refuses to start with a clear message naming the var. Then boot with a
  full staging var set pointed at the empty staging instances → confirm writes land
  in staging and production is untouched.

---

## 6. Credential rotation (required deliverable)
After the code change merges and env vars are set on both environments, rotate
every exposed secret in its provider dashboard and update only the env var:
Neo4j password, Mongo user password, Together API key, Tavily API key, RapidAPI
key, and both Pinecone keys. Old values remain in git history permanently —
rotation is the only effective mitigation. Track completion before treating the
exposure as closed.

---

## 7. Rollout
1. Land the code change on a `phase-42-*` branch off `master`; merge after green
   preflight.
2. **Before deploying the fail-hard change**, audit which of the required vars are
   actually set on the production Render dashboard today. Values that currently
   rely on an in-code literal default (notably `S3_BUCKET`, `AWS_REGION`, and the
   tuning constants) may **not** be present as env vars — every required var must
   be set on prod *first*, or the require-on-startup change will refuse to boot.
3. Set the production var set on the existing Render service + Vercel project
   (values = current instances) and redeploy. **Production must talk to the same
   instances as before** — same data, just sourced from env. Verify `/openapi.json`
   200 and the app loads.
4. Provision the staging instances (separate runbook) and set the staging var set
   on the new Render service + Vercel project.
5. Rotate all credentials (§6).

---

## 8. Open questions
1. **S3/AWS enforcement.** Are `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY`, and
   `AWS_SECRET_KEY` actually set on the prod Render dashboard today, or is prod
   relying on the in-code defaults / running with empty AWS keys? If S3 is not
   genuinely configured in prod, making these `_require` would change boot
   behavior — in that case they should stay optional (`os.getenv`, may be empty)
   rather than required. **Resolve by inspecting the Render dashboard during
   implementation** (§7 step 2). Does not block the design.
2. Otherwise none. (D1–D4 resolved during brainstorm; Option A chosen for the
   frontend.)
