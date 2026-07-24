# Runbook 42 — Deploy env-driven config, then stand up isolated staging

> **Operational companion to `specs/42-env-driven-config-prod-staging-design.md`.**
> This is dashboard + CLI work, not code. It assumes the spec-42 code change is
> reviewed and ready to merge to `master`. Both Render and Vercel auto-deploy from
> `master`, so **sequencing matters**: prod env vars must be in place *before* the
> fail-hard code goes live, or production refuses to boot.

**Audience:** whoever owns the Render, Vercel, Neo4j Aura, MongoDB Atlas, and
Pinecone dashboards (account: `shilpa@brewra.com`).

---

## The variable contract (reference)

**Backend — required (14).** The app raises `RuntimeError: Missing required
environment variable: <NAME>` at startup if any is missing or empty.

| Variable | Notes |
|---|---|
| `NEO4J_URI` | e.g. `neo4j+s://<id>.databases.neo4j.io` |
| `NEO4J_USERNAME` | usually `neo4j` |
| `NEO4J_PASSWORD` | |
| `MONGO_URI` | **full** SRV string; URL-encode special chars in the password (`@`→`%40`, `:`→`%3A`) |
| `PINECONE_API_KEY` | |
| `PINECONE_INDEX` | `brewra-documents` (same name is fine in both envs — different projects) |
| `TOGETHER_API_KEY` | |
| `TAVILY_API_KEY` | |
| `RAPIDAPI_KEY` | |
| `S3_BUCKET` | |
| `AWS_REGION` | e.g. `eu-north-1` |
| `AWS_ACCESS_KEY` | |
| `AWS_SECRET_KEY` | |
| `CORS_ALLOWED_ORIGINS` | comma-separated exact origins, scheme+host, **no trailing slash** (e.g. `https://app.brewra.com,https://www.brewra.com`) |

**Backend — optional (defaulted, leave unset unless overriding):**
`CLAUDE_SONNET_MODEL`, `CLAUDE_SIGNAL_WINDOW_SECONDS`,
`CLAUDE_SIGNAL_TOKEN_LIMIT_5M`, `CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS`.
Do **not** set `BREWRA_SKIP_DB_INIT` in deployed environments (test-only).

**Frontend — required (2), build-time.** Vite inlines these at build, so changing
them requires a **redeploy**, not just a restart.

| Variable | Local dev | Deployed (prod & staging) |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | the **full backend URL**, e.g. `https://<render-host>` (no `/api` — the rewrite was removed) |
| `VITE_BACKEND_BASE_URL` | `http://localhost:8000` | same full backend URL |

---

## Step 0 — Pre-merge: load the PRODUCTION variable set (do this FIRST)

Goal: get every required var onto the existing prod services *while the old code is
still running* (old code ignores extras / uses its own fallbacks, so this is safe
and changes nothing yet). This guarantees the fail-hard boot succeeds the moment
the new code deploys.

- [ ] **Audit what's already set.** Render dashboard → existing backend service →
  *Environment*. Compare against the 14 required vars above. Likely missing today
  (they relied on in-code defaults): `PINECONE_INDEX`, `CORS_ALLOWED_ORIGINS`,
  possibly `MONGO_URI` (the old code built it from `MONGO_USERNAME`/`MONGO_PASSWORD`).
- [ ] **Set the full prod backend set on Render** (existing service). Use the
  **current** production values so prod keeps talking to the same instances:
  - `MONGO_URI` — assemble the full SRV string from the current Atlas cluster
    (`...@brewra-db.d3hvuf8.mongodb.net/...`), URL-encoding the password.
  - `PINECONE_INDEX=brewra-documents`
  - `CORS_ALLOWED_ORIGINS=` the current prod Vercel origin(s), e.g.
    `https://brewra-gtm-intelligence.vercel.app`
  - Confirm `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY`, `AWS_SECRET_KEY` are all
    present (you confirmed these are set in prod).
- [ ] **Set the prod frontend set on Vercel** (existing project) → *Settings →
  Environment Variables* (Production scope):
  - `VITE_API_BASE_URL=https://<prod-render-host>`
  - `VITE_BACKEND_BASE_URL=https://<prod-render-host>`
- [ ] Do **not** redeploy yet. (Old code is still running; nothing has changed.)

---

## Step 1 — Merge & deploy; verify production is unchanged

- [ ] **Merge the spec-42 branch to `master`.** This triggers auto-deploy on both
  Render (backend) and Vercel (frontend).
- [ ] **Watch the Render deploy log.** A green boot means the env contract is
  satisfied. If you see `Missing required environment variable: <NAME>`, that var
  wasn't set in Step 0 — add it and redeploy.
- [ ] **Verify backend health:**
  ```bash
  curl -i https://<prod-render-host>/openapi.json   # expect 200
  ```
- [ ] **Verify CORS** (allowed origin echoed, junk origin not):
  ```bash
  curl -s -o /dev/null -D - https://<prod-render-host>/openapi.json \
    -H "Origin: https://brewra-gtm-intelligence.vercel.app" | grep -i access-control-allow-origin
  ```
- [ ] **Verify the frontend:** load the prod Vercel URL, log in, confirm data loads
  (leads, market research, chat). Because the `/api` rewrite is gone, the browser
  now calls Render directly — confirm there are **no CORS errors** in the console.
- [ ] **Confirm production data is intact** — same Neo4j/Mongo/Pinecone as before.
  Nothing should have changed; you only re-sourced the same values from env.

**Rollback:** if the deploy misbehaves, revert the merge commit on `master` (Render
+ Vercel redeploy the prior build). The env vars you added are harmless to leave.

---

## Step 2 — Provision the STAGING instances (all empty, no data migration)

Create brand-new, isolated copies. **None of these share anything with prod.**
Staging databases and the Pinecone index are created lazily by the app on first
write — start empty.

- [ ] **Neo4j Aura** — create a new AuraDB instance. Record its
  `NEO4J_URI` / `NEO4J_USERNAME` / `NEO4J_PASSWORD`.
- [ ] **MongoDB Atlas** — create a new cluster (or a new DB user on a separate
  cluster). Build the staging `MONGO_URI` SRV string (URL-encode the password).
  Add Render's egress IPs (or `0.0.0.0/0` for MVP) to the Atlas IP access list.
- [ ] **Pinecone** — create a new project + API key. The index name can stay
  `brewra-documents` (it's a different project, so no collision). Record
  `PINECONE_API_KEY`; `PINECONE_INDEX=brewra-documents`.
- [ ] **S3** — decide: reuse the existing bucket with a staging prefix, or create a
  new bucket. For clean isolation, a **new bucket** is preferable. Record
  `S3_BUCKET` (+ region / AWS keys — can reuse the same AWS account/keys or issue
  staging-scoped IAM keys).
- [ ] Together / Tavily / RapidAPI keys: reuse the same keys, or issue separate
  staging keys if you want isolated usage/billing.

---

## Step 3 — Create the STAGING Render service + Vercel project

Both deploy from the **same repo and `master` branch** as prod. The only
difference is the variable set.

- [ ] **Render — new Web Service**, same repo, branch `master`, root = `backend/`,
  same build/start commands as the prod service. Set the **staging** backend var
  set (all 14), pointing at the Step-2 staging instances. For
  `CORS_ALLOWED_ORIGINS`, you'll fill the staging Vercel origin in the next step
  (set a placeholder now, finalize after the Vercel URL exists).
- [ ] **Vercel — new Project**, same repo, root = `frontend/`. Set the **staging**
  frontend vars:
  - `VITE_API_BASE_URL=https://<staging-render-host>`
  - `VITE_BACKEND_BASE_URL=https://<staging-render-host>`
- [ ] **Close the CORS loop:** copy the staging Vercel URL (e.g.
  `https://brewra-staging.vercel.app`) into the staging Render
  `CORS_ALLOWED_ORIGINS`, then redeploy the staging Render service.
- [ ] **Verify isolation (the whole point):**
  - `curl -i https://<staging-render-host>/openapi.json` → 200
  - Log into the staging Vercel URL, create/upload something, confirm it appears in
    the **staging** Neo4j/Mongo/Pinecone — and that **production is untouched**.
  - Optional but recommended: in staging Render, temporarily remove one required
    var and redeploy → confirm it **refuses to boot** with a clear message. This
    proves the fail-hard guard (and that staging can't silently fall back to prod).
    Restore the var afterward.

---

## Step 4 — Rotate all exposed credentials (required)

Everything below was committed to git history and must be treated as compromised.
Rotation is the only effective fix (history rewrite is out of scope). After
rotating each, update the env var on the relevant platform and redeploy/restart.

> **Expanded beyond the spec's §6 list:** the AWS keys were also exposed (in the
> now-deleted `check_it.txt` and the probe scripts), so they are included here.

- [ ] **Neo4j** password — rotate in Aura → update `NEO4J_PASSWORD` (prod).
- [ ] **MongoDB** user password — rotate in Atlas → rebuild & update `MONGO_URI` (prod).
- [ ] **Together** API key → update `TOGETHER_API_KEY`.
- [ ] **Tavily** API key → update `TAVILY_API_KEY`.
- [ ] **RapidAPI** key → update `RAPIDAPI_KEY`.
- [ ] **Pinecone** key(s) (both exposed `pcsk_…` keys) → update `PINECONE_API_KEY`.
- [ ] **AWS** access key + secret → rotate in IAM, update `AWS_ACCESS_KEY` /
  `AWS_SECRET_KEY`. Disable the old key pair once the new one is confirmed working.
- [ ] After each rotation, redeploy/restart the affected service and re-verify
  `/openapi.json` 200 + a real data read. Track completion before treating the
  credential exposure as closed.

---

## Gotchas (read before starting)

- **Order is load-vars-then-deploy.** Setting env vars on Render/Vercel while old
  code runs is harmless; merging the fail-hard code before vars exist is not.
- **`MONGO_URI` password encoding.** The old password contained `@`; in an SRV
  string that must be `%40`, or the connection string parses wrong.
- **Vercel vars are build-time.** After changing any `VITE_*`, trigger a redeploy —
  a restart won't pick it up.
- **No `/api` rewrite in deployed builds.** Deployed `VITE_API_BASE_URL` must be the
  full backend URL, not `/api`. The browser calls Render directly, so the backend
  `CORS_ALLOWED_ORIGINS` *must* include the exact Vercel origin or every request
  fails CORS.
- **Pre-existing, separate from this work:** `requirements.txt` is unpinned — a
  future redeploy could pull newer breaking FastAPI/LangChain versions (seen
  locally as `_IncludedRouter.path` / lambda-arg test failures). Worth pinning soon
  to de-risk deploys, but it does not block this runbook.
