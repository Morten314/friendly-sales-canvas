# Backend Documentation Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the monorepo's *living* project/agent docs into sync with the refactored layered backend, while preserving the pre-refactor analysis docs as dated historical snapshots.

**Architecture:** Documentation-only change. Create one new canonical living doc (`docs/architecture/BACKEND.md`) from the code; reconcile the agent files and the other living docs to point at it and to describe the current `backend/app/` shape; banner the two `docs/analysis/` sets as frozen snapshots; verify-only the prompt/tech-debt docs. The acceptance gate is a grep that finds zero old-monolith signatures in living docs plus an endpoint-inventory match against the live router surface.

**Tech Stack:** Markdown docs; `git` for history/dates; `grep`/`ls` for code-derived facts. No application code changes, no pytest.

**Spec:** `specs/22-backend-doc-reconciliation-design.md` (read it before starting; this plan implements it).

---

## Preconditions

- [ ] **Confirm you are in the monorepo root and on a feature branch off `master`.**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git rev-parse --abbrev-ref HEAD          # if on master/develop/production, branch off:
git checkout master && git checkout -b docs/22-backend-doc-reconciliation
```
Expected: you are on `docs/22-backend-doc-reconciliation` (or an equivalently-named feature branch). Per CLAUDE.md, never commit doc work directly to `develop`/`production`.

- [ ] **Confirm the refactored backend exists where this plan expects.**

Run:
```bash
ls backend/app/core backend/app/routers/v2 backend/app/services backend/prompts >/dev/null && echo OK
```
Expected: `OK`. If this fails, stop — the backend shape differs from the spec's assumptions and the plan needs revisiting.

---

## Execution model (parallelism & abort)

**Dependency order (per spec §9):** Task 1 (canonical doc) lands **first** — Tasks 2, 3, 4, and 7 link to `docs/architecture/BACKEND.md`, so it must exist for those links to resolve. After Task 1, **Tasks 4, 5, 6, 7, and 8 are mutually independent and may run in parallel**. **Task 3 depends on Task 2** (it mirrors `CLAUDE.md`), so run them in that order, ideally in the same agent/session. Task 8 (verify-only) depends on nothing and may run as early as the preconditions check. Task 9 (acceptance gate) runs **last**, after everything merges.

Subagent dispatch graph: `1 → ({2 → 3}, 4, 5, 6, 7, 8) → 9`.

**Abort & report (applies to every task):** these are documentation edits derived from the live code, and the spec (§10) warns the old facts may not hold. If a re-anchoring grep returns **zero hits** for a claim the plan says still exists (e.g. Task 2 Step 2 cannot locate the CORS / Cypher / embeddings / Neo4j-schema site), or the endpoint count is far from the expected ~58 (Task 6 Step 1), or the backend tree diverges from Task 1 Step 1's expectations — **stop and report** rather than inventing a location or guessing. Never write a doc claim you could not anchor in the code.

---

## Task 1: Create the canonical doc `docs/architecture/BACKEND.md`

**Files:**
- Create: `docs/architecture/BACKEND.md`
- Read (source of truth): `backend/app/main.py`, `backend/app/core/*`, `backend/app/routers/` (+ `v2/`), `backend/app/services/`, `backend/prompts/`, `backend/tests/`

- [ ] **Step 1: Gather and verify the structural facts from the code.**

Run each and read the output; these are the facts the doc asserts:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
ls -1 app/core app/models app/routers app/routers/v2 app/services
grep -n "lifespan\|asynccontextmanager\|refresh_schema\|init_registry\|verify_connectivity" app/main.py app/core/*.py
grep -rn "health\|healthz\|livez\|readyz" app/main.py app/routers/ app/services/health.py   # resolve OPEN QUESTION: how health is wired
grep -rn "Neo4j\|GraphDatabase\|MongoClient\|Pinecone\|boto3\|client(\"s3\"\|TogetherAI\|ChatGroq" app/core/clients.py app/core/config.py
grep -rn "llama-3.3\|Qwen\|multilingual-e5\|OpenAIEmbeddings\|max_iterations\|ZERO_SHOT" app/core/llm_config.py app/core/clients.py
ls -1 app/routers/v2                                                                          # confirm which domains have a v2
```
Expected: confirms layers (`core`/`models`/`routers`+`v2`/`services`+shared `_` helpers/`prompts`), the 12 service domains (`icp signals leads market_research market_scoring customer_profile data_sources org_auth graph_chat pipeline profiles health`), v2 set (`data_sources icp leads org_auth signals`), the persistence clients, and the LLM/embedding identities. Note the health wiring for §9 of the doc.

- [ ] **Step 2: Write `docs/architecture/BACKEND.md`.**

```bash
mkdir -p /projects/Brewra/brewra-gtm-intelligence/docs/architecture
```

Write the file with this template, **replacing every `<!-- … -->` marker with the confirmed fact from Step 1 before saving** and correcting any claim that drifted. Reference modules/symbols — **never line numbers**:

````markdown
# Backend Architecture

Canonical, living map of the FastAPI backend at `backend/app/`. Source of truth is the code; this doc is a navigation aid. **Reference modules/symbols, never line numbers** — line numbers rot on the next refactor.

> The two `docs/analysis/` sets are pre-refactor snapshots (flat `api.py`/`services.py` monolith) and are **not** current for backend structure.

## Entrypoint & boot
- `backend/main.py` is a thin shim: `from app.main import app`. It preserves `uvicorn main:app` for Render and local dev (`python main.py` runs uvicorn on `127.0.0.1:8000`).
- `app/main.py` builds the FastAPI app and registers routers. Startup/shutdown run in a lifespan handler: prompt-registry init, client connectivity checks, and Neo4j schema refresh (covered by `tests/test_lifespan.py`). <!-- verify exact lifespan steps against app/main.py -->

## Layering
- `app/core/` — cross-cutting infra: `clients` (Neo4j / Mongo / Pinecone / S3 / LLM providers), `config`, `dependencies`, `exceptions`, `llm_config`, `logging`, `prompts` (loader/registry/render API).
- `app/models/` — per-domain Pydantic request/response models, plus `pagination.py`.
- `app/routers/` — per-domain routers; `app/routers/v2/` holds the versioned successors.
- `app/services/<domain>/` — business logic split into `orchestrator` / `persistence` / `llm` / `parsing` / `normalization` / `scoring` (per domain, as applicable), with shared helpers `_claude_budget`, `_llm_helpers`, `_neo4j_helpers`, `_retrieval`.
- `backend/prompts/<svc>/` — Jinja2 prompt bodies served by `app/core/prompts.py` (see `docs/PROMPTS.md`).

## Request lifecycle
Router (`app/routers/<domain>` or `v2/`) → service orchestrator (`app/services/<domain>/orchestrator`) → `persistence` / `llm` / `_retrieval` helpers → response model. Background work uses `fastapi.BackgroundTasks` (in-process; lost on restart — no queue/retries).

## Domains
`icp`, `signals`, `leads`, `market_research`, `market_scoring`, `customer_profile`, `data_sources`, `org_auth`, `graph_chat`, `pipeline`, `profiles`. Plus `health` — a service module (`app/services/health.py`) with no dedicated router; liveness/readiness is wired via <!-- fill from Step 1: lifespan or a root route -->.

## v1 vs v2 routers
`app/routers/` is the original surface; `app/routers/v2/` (`data_sources`, `icp`, `leads`, `org_auth`, `signals`) is the versioned successor. When adding/changing an endpoint, target the version the FE consumer uses and update both router and model. <!-- confirm v2 set and intent against app/routers/v2 + app/main.py include_router calls -->

## Cross-cutting
- **Clients** (`app/core/clients`): Neo4j (CRM graph), MongoDB (Market Intelligence, Lead Market Scores, Signals, File Processing Status, Customer Profiles; dbs `Scout_Agent`, `Profiler`), Pinecone (embeddings namespaced by `org_id`), S3 `eu-north-1` (uploaded PDFs/text).
- **LLMs** (`app/core/llm_config`): Groq `llama-3.3-70b-versatile` (primary chat/research); Together.ai `Qwen/Qwen3-235B-A22B-Instruct-2507` (LangChain ReAct `agent_chain` + Tavily WebSearch); embeddings `intfloat/multilingual-e5-large-instruct` (1024-dim) served by TogetherAI via `langchain_openai.OpenAIEmbeddings` — **not** OpenAI despite the class name. <!-- verify model IDs against Step 1 -->
- `dependencies`, `config`, `logging`, `exceptions` provide DI, settings, structured logging, and the error hierarchy.

## Prompt system
Prompt bodies live in `backend/prompts/<svc>/` (Jinja2 `.md.j2`), composed from `_shared/` partials, served by `app/core/prompts.py`; per-call `prompt_meta` is persisted with output. Full details: `docs/PROMPTS.md`.

## Testing layout
`backend/tests/unit/` holds the unit suite (incl. golden-prompt tests `test_prompts_golden.py` / `test_prompts_loader.py`); `backend/tests/` top level holds API/integration tests (incl. `*_v2`, `test_lifespan`, `test_smoke`); `__snapshots__`/`_baselines`/`fixtures` hold fixture infra. Details: `backend/TESTING.md`. (Golden-prompt tests live inside `tests/unit/` — there is no separate golden directory.)

## Current posture (descriptive — not a to-do list)
No backend auth: endpoints trust `user_id`/`org_id` from query/body; multi-tenancy is `WHERE … org_id` filtering only. CORS is `allow_origins=["*"]` with credentials. Background tasks are in-process. These are accepted at the MVP stage — see `docs/TECH_DEBT.md`. (This doc describes; it does not recommend hardening.)

## Keeping this current
When the layering changes, update this map and reference modules/symbols, not line numbers.
````

- [ ] **Step 3: Verify every path the doc references exists, and that no line-number refs slipped in.**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Every backend path token in the doc must resolve:
grep -oE 'app/[a-z_/]+|backend/[a-z_/]+|tests/[a-z_/]+' docs/architecture/BACKEND.md | sort -u | while read p; do
  [ -e "backend/${p#backend/}" ] || [ -e "$p" ] || echo "MISSING: $p"; done
# No line-number references:
grep -nE '\.py:[0-9]' docs/architecture/BACKEND.md && echo "FAIL: line refs present" || echo "OK: no line refs"
# No unresolved authoring markers left behind:
grep -n '<!-- ' docs/architecture/BACKEND.md && echo "FAIL: resolve TODO comments" || echo "OK: no markers"
```
Expected: no `MISSING:` lines, `OK: no line refs`, `OK: no markers`. Remove every `<!-- verify… -->` comment once its claim is confirmed/corrected.

- [ ] **Step 4: Commit.**

```bash
git add docs/architecture/BACKEND.md
git commit -m "docs(architecture): add canonical backend architecture map"
```

---

## Task 2: Reconcile `CLAUDE.md` to the current backend shape

**Files:**
- Modify: `CLAUDE.md` (sections: "Polyglot Repo Practices", "Architecture: Big Picture → What the product is" + "Backend topology", "Gotchas", "Pre-existing Analyses", "Plans / Specs Reference")

- [ ] **Step 1: Inventory every stale reference in the file (this is the pass/fail target).**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE 'backend/(api|services|database|config|llm_config)\.py|(api|services)\.py:[0-9]|pagination is not a project convention|[Pp]rompts are inline|16-line entrypoint|no routers' CLAUDE.md
```
Expected now: multiple hits. After this task: zero. Each hit is a thing to fix below.

- [ ] **Step 2: Locate the current code site for each gotcha being kept (so you can re-anchor by module/symbol).**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -rln "allow_origins\|CORSMiddleware" app/                      # CORS
grep -rln "voice_graph\|text_graph\|raw.*[Cc]ypher\|/query" app/    # Cypher-injection paths
grep -rln "multilingual-e5\|OpenAIEmbeddings" app/                  # embeddings
grep -rln "schema" app/core/llm_config.py prompts/llm_config/       # Neo4j schema in prompt
grep -rln "scout\|profiler" app/services/signals/                   # Scout/Profiler shared code
```
Expected: each prints the current owning module(s). Use these paths in the rewrites (module/symbol, no line numbers).

- [ ] **Step 3: Rewrite "What the product is" — Scout/Profiler shared-code note.**

Replace the sentence asserting `backend/services.py: search_signals_scout vs search_signals_profiler` with the current location, e.g.: "Scout and Profiler share most of their backend logic in `app/services/signals/` (search/LLM/parsing), differentiated by prompt persona resolved through the prompt loader (`app/core/prompts.py` + `prompts/signals/`)." Keep the Strategist-has-no-backend point unchanged.

- [ ] **Step 4: Rewrite "Backend topology".**

Replace the flat-monolith bullets with a short layered summary and a pointer. Remove the `api.py`/`services.py` LOC claims, the "no routers — all endpoints inline" line, and the `main.py` 16-line import-order line. Keep the polyglot-persistence and LLM bullets (they are still accurate) but re-anchor any file paths (`backend/llm_config.py:29-96` → `app/core/llm_config.py` / `prompts/llm_config/`; `backend/api.py:111-114,3722-3734` → the embeddings module from Step 2). Add: "Full map: `docs/architecture/BACKEND.md`."

- [ ] **Step 5: Rewrite "Gotchas".** Apply spec §5.2:
  - **Remove/replace as resolved:** "`GET /leads` has no `LIMIT` … Pagination is not a project convention yet" → state the current pagination convention (`app/models/pagination.py`; v2 list endpoints; cross-ref `TD-005` for the `count` caveat). "Prompts are inline in `backend/services.py`…" → "Prompts live in `backend/prompts/<svc>/` served by `app/core/prompts.py`; regional-bias examples are in the prompt bodies — see `docs/PROMPTS.md` and `backend/ANALYSIS_MARKET_ICP_RESEARCH_ISSUES.md`."
  - **Keep, re-anchored to Step 2 paths (no line numbers):** CORS `["*"]`; Cypher-injection caution ("don't extend the f-string pattern"); embeddings-are-TogetherAI-not-OpenAI; Neo4j schema hard-coded in the Cypher-generation prompt.
  - **Keep, re-anchored:** "Smoke-test scripts hit production" → clarify the root `backend/test_*.py` probes still hit prod and are distinct from the real `backend/tests/` pytest suite. "`config.py` credential fallbacks" → `app/core/config.py`. "Multiple admin tools" (`admin_panel.html`, `registration_admin_panel.html`, `cleanup_company_profile.py`) → still at `backend/` root; drop any line refs.

- [ ] **Step 6: Update "Pre-existing Analyses" and "Plans / Specs Reference".**

In "Pre-existing Analyses", state that `docs/analysis/detailed-analysis/` and `docs/analysis/claude-analysis/` are **frozen pre-refactor snapshots** and that `docs/architecture/BACKEND.md` is the canonical current backend reference. In "Plans / Specs Reference", add: `` - `/specs/22-backend-doc-reconciliation-design.md` + `/plans/22-backend-doc-reconciliation.md` — sync project/agent docs to the refactored backend. ``

- [ ] **Step 7: Verify the file is clean.**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE 'backend/(api|services|database|config|llm_config)\.py|(api|services)\.py:[0-9]|pagination is not a project convention|[Pp]rompts are inline|16-line entrypoint|no routers' CLAUDE.md && echo "FAIL: stale refs remain" || echo "OK: clean"
grep -c "docs/architecture/BACKEND.md" CLAUDE.md   # expect >= 1
```
Expected: `OK: clean` and the pointer present.

- [ ] **Step 8: Commit.**

```bash
git add CLAUDE.md
git commit -m "docs: reconcile CLAUDE.md backend topology, gotchas, and pointers to refactored shape"
```

---

## Task 3: Mirror the changes into `AGENTS.md`

**Files:**
- Modify: `AGENTS.md` (same shared sections as Task 2; **preserve** its unique "Tool Usage Pitfalls" / "Glob patterns are NOT regex" section)

- [ ] **Step 1: Bring the reconciled shared sections from the updated `CLAUDE.md` into `AGENTS.md`.**

**Depends on Task 2 — run after it, ideally in the same session.** The two files share the backend sections verbatim, so **copy them from the now-updated `CLAUDE.md`** (What the product is, Backend topology, Gotchas, Pre-existing Analyses, Plans/Specs Reference) rather than re-deriving the edits — the goal is byte-identical shared sections. Do **not** touch AGENTS.md's unique "Tool Usage Pitfalls" / "Glob patterns are NOT regex" section. If Tasks 2 and 3 run in separate agents, the Task 3 agent must read the updated `CLAUDE.md` as its source of truth (it cannot infer Task 2's edits otherwise).

- [ ] **Step 2: Verify `AGENTS.md` is clean and the shared sections match `CLAUDE.md`.**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE 'backend/(api|services|database|config|llm_config)\.py|(api|services)\.py:[0-9]|pagination is not a project convention|[Pp]rompts are inline|16-line entrypoint|no routers' AGENTS.md && echo "FAIL: stale refs remain" || echo "OK: clean"
# Compare the shared "Gotchas" section between the two files (should be identical):
diff <(sed -n '/^## Gotchas/,/^## /p' CLAUDE.md) <(sed -n '/^## Gotchas/,/^## /p' AGENTS.md) && echo "OK: gotchas match" || echo "REVIEW: gotchas differ"
```
Expected: `OK: clean`. The `diff` should be empty (`OK: gotchas match`); if it differs only by the trailing next-heading line, that is fine — inspect and confirm the body matches.

- [ ] **Step 3: Commit.**

```bash
git add AGENTS.md
git commit -m "docs(agents): mirror CLAUDE.md backend reconciliation into AGENTS.md"
```

---

## Task 4: Banner the two `docs/analysis/` sets as frozen snapshots

**Files:**
- Modify (add banner only, no body changes): the 9 files —
  `docs/analysis/detailed-analysis/{ARCHITECTURE_DOCUMENT,DESIGN_SYSTEM,FUNCTIONALITY_INVENTORY,PRODUCT_SPECIFICATION,README}.md`
  `docs/analysis/claude-analysis/{ARCHITECTURE_DOCUMENT,DESIGN_SYSTEM,FUNCTIONALITY_INVENTORY,PRODUCT_SPECIFICATION}.md`

- [ ] **Step 1: Get each file's creation date.**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
for f in docs/analysis/detailed-analysis/{ARCHITECTURE_DOCUMENT,DESIGN_SYSTEM,FUNCTIONALITY_INVENTORY,PRODUCT_SPECIFICATION,README}.md \
         docs/analysis/claude-analysis/{ARCHITECTURE_DOCUMENT,DESIGN_SYSTEM,FUNCTIONALITY_INVENTORY,PRODUCT_SPECIFICATION}.md; do
  echo "$f  ->  $(git log --diff-filter=A --format=%cs -- "$f" | tail -1)"
done
```
Expected: each file maps to its earliest (creation) commit date (`YYYY-MM-DD`). Use that date in the banner for that file.

- [ ] **Step 2: Insert the banner immediately under each file's top `#` heading.** Both analysis subfolders are at the same depth, so the relative link is `../../architecture/BACKEND.md` for **all 9 files**. Banner block:

```markdown
> **Snapshot — pre-backend-refactor.** This document reflects the backend as the flat `api.py`/`services.py` monolith and is preserved as a point-in-time analysis (authored <YYYY-MM-DD>). For the **current** backend architecture see [`docs/architecture/BACKEND.md`](../../architecture/BACKEND.md). Frontend sections are likewise a snapshot; the frontend refactor is in progress (see specs 14–21).
```
Replace `<YYYY-MM-DD>` per file from Step 1. Do not change any other content.

- [ ] **Step 3: Verify all 9 banners are present and link correctly, and bodies are otherwise unchanged.**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -lc "Snapshot — pre-backend-refactor" docs/analysis/detailed-analysis/*.md docs/analysis/claude-analysis/*.md | wc -l   # expect 9
grep -L "architecture/BACKEND.md" docs/analysis/detailed-analysis/*.md docs/analysis/claude-analysis/*.md                    # expect no output
git diff --stat docs/analysis/                                                                                              # expect each file +~3 lines only
```
Expected: count is 9, no files missing the link, and the diffstat shows only small additions.

- [ ] **Step 4: Commit.**

```bash
git add docs/analysis/
git commit -m "docs(analysis): banner detailed/claude analysis sets as pre-refactor snapshots"
```

---

## Task 5: Fix `docs/Deployment Infrastructure and Notes.md`

**Files:**
- Modify: `docs/Deployment Infrastructure and Notes.md` (note: filename contains spaces — quote it everywhere)

- [ ] **Step 1: Confirm the start command is still valid (keep it) and list the stale internals.**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -n "startCommand" backend/render.yaml backend/main.py 2>/dev/null; head -6 backend/main.py
grep -nE 'backend/(config|database|api)\.py|main\.py:[0-9]|inline ~15' "docs/Deployment Infrastructure and Notes.md"
```
Expected: `render.yaml` keeps `uvicorn main:app …`; `main.py` is the `from app.main import app` shim (so the command is correct — **do not change it**). The second grep lists the stale internal-shape references to fix.

- [ ] **Step 2: Re-anchor the stale internals, preserve operational notes.** Edits:
  - "Source of truth `backend/config.py` + `backend.env`" → `app/core/config.py` (env + fallbacks).
  - "Connected on import `backend/database.py` — `verify_connectivity()` at module load" → connectivity now runs in the `app/main.py` lifespan via `app/core/clients`.
  - "Schema refresh on import `backend/main.py:10` — `graph.refresh_schema()`" → schema refresh runs in the lifespan handler (no module-load import-order contract).
  - "credentials … repeated inline ~15× in `backend/api.py`" → describe the current `app/core/config.py` reality (no `api.py`).
  Keep the Render cold-start note, the shared-prod-data warning, and the network-policy `sbx policy allow network backend-11kr.onrender.com` guidance unchanged.

- [ ] **Step 3: Verify clean.**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE 'backend/(config|database|api)\.py|main\.py:[0-9]|inline ~15' "docs/Deployment Infrastructure and Notes.md" && echo "FAIL" || echo "OK: clean"
grep -n "uvicorn main:app" "docs/Deployment Infrastructure and Notes.md"   # expect: still present (preserved)
```
Expected: `OK: clean`, start command still present.

- [ ] **Step 4: Commit.**

```bash
git add "docs/Deployment Infrastructure and Notes.md"
git commit -m "docs: re-anchor deployment notes to app/core config + lifespan; keep start command"
```

---

## Task 6: Reconcile `backend/API_DOCUMENTATION.md` + `backend/API_ENDPOINTS_SUMMARY.md`

**Files:**
- Modify: `backend/API_DOCUMENTATION.md`, `backend/API_ENDPOINTS_SUMMARY.md`

- [ ] **Step 1: Derive the live endpoint surface programmatically (do not hand-reconcile).**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
# Route methods + decorator paths, per router file (ignore stale __pycache__ / removed `documents.*.pyc`):
grep -rnoE '@router\.(get|post|put|delete|patch)\("[^"]*"' app/routers/ --include='*.py'
# Router prefixes / include_router mounts (to assemble full paths):
grep -rnE 'APIRouter\(.*prefix|include_router' app/main.py app/routers/*.py app/routers/v2/*.py
# Optional authoritative cross-check IF the app boots in this env (needs all clients reachable):
# (cd backend && uvicorn main:app --port 8123 &) ; sleep 5 ; curl -s localhost:8123/openapi.json | python -c 'import sys,json;[print(p) for p in json.load(sys.stdin)["paths"]]' ; kill %1
```
Expected: the full v1+v2 path list (≈58 decorators). Ignore any `documents` hits that only appear under `__pycache__` — that router was removed. **Final routes = `APIRouter(prefix=…)` + `include_router(prefix=…)` + the decorator path; the decorator grep alone yields path *fragments*, so combine them manually to get each real route.**

- [ ] **Step 2: Update both docs to match the derived surface.** Add endpoints that exist now and are undocumented, correct changed paths/shapes, remove endpoints that no longer exist, and note the v1 vs `v2/` split where a domain has both. Use the Step 1 output as the authority.

- [ ] **Step 3: Verify the documented endpoints match the code.**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
# Sanity: every path segment documented should be greppable in routers; spot-list any doc path not found in code:
grep -oE '(GET|POST|PUT|DELETE|PATCH) /[a-zA-Z0-9_/{}-]+' API_ENDPOINTS_SUMMARY.md | sort -u | head -80
```
Expected: the documented method+path list lines up with Step 1's decorators (manually confirm no documented endpoint is absent from the code and no code endpoint is missing from the doc).

- [ ] **Step 4: Commit.**

```bash
git add backend/API_DOCUMENTATION.md backend/API_ENDPOINTS_SUMMARY.md
git commit -m "docs(be): reconcile API docs to current routers + v2 surface"
```

---

## Task 7: Author `backend/README.md`; accuracy-pass `backend/TESTING.md`

**Files:**
- Modify: `backend/README.md` (currently a Render-template stub — this is **new-content authoring**, flag for review attention)
- Modify: `backend/TESTING.md`

- [ ] **Step 1: Write a real `backend/README.md`.** Replace the Render-template content with:

````markdown
# Brewra Backend

FastAPI service for the Brewra GTM/sales-intelligence product. Layered app under `app/` (core, models, routers + v2, services); prompts under `prompts/`; tests under `tests/`.

## Run locally
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload        # serves on http://127.0.0.1:8000 ; docs at /docs
```
Configuration is read by `app/core/config.py` (env vars with fallbacks). See `docs/Deployment Infrastructure and Notes.md` for the shared-prod-data warning before running against live credentials.

## Test
```bash
pip install -r requirements-test.txt
pytest                 # unit + integration; see TESTING.md
pytest tests/unit      # unit suite only
```

## Architecture
See [`docs/architecture/BACKEND.md`](../docs/architecture/BACKEND.md) for the current backend map.
````
Confirm the run/test commands against `backend/pytest.ini`, `requirements.txt`, and `requirements-test.txt` before saving.

- [ ] **Step 2: Accuracy-pass `backend/TESTING.md`** against the verified layout (`tests/unit/` + top-level integration + `__snapshots__`/`_baselines`/`fixtures`). Correct any command or path that drifted; keep the patch-where-used guidance.

- [ ] **Step 3: Verify.**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -n "architecture/BACKEND.md" backend/README.md            # expect present
grep -nE 'render-examples|deploy-to-render|template' backend/README.md && echo "FAIL: stub remnants" || echo "OK: stub replaced"
ls backend/pytest.ini backend/requirements-test.txt >/dev/null && echo "OK: test config exists"
```
Expected: pointer present, `OK: stub replaced`, test config exists.

- [ ] **Step 4: Commit.**

```bash
git add backend/README.md backend/TESTING.md
git commit -m "docs(be): author real backend README; accuracy-pass TESTING.md"
```

---

## Task 8: Verify-only pass on `TECH_DEBT.md` + `PROMPTS.md`

**Files:**
- Inspect (fix only on confirmed drift): `docs/TECH_DEBT.md`, `docs/PROMPTS.md`
- Do **not** edit: `docs/prompt-migration-outcome.md` (audit-only, frozen)

- [ ] **Step 1: Check for drift against the current code.**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE 'backend/(api|services|database)\.py|api\.py:[0-9]' docs/TECH_DEBT.md docs/PROMPTS.md
# Confirm the structural anchors they cite still exist:
ls backend/app/core/prompts.py backend/prompts/_shared >/dev/null && echo "OK: prompt anchors exist"
```
Expected: ideally no stale-shape hits (these docs were maintained during the refactor). `OK: prompt anchors exist`.

- [ ] **Step 2: If — and only if — Step 1 surfaced genuine drift, fix it minimally.** No rewrite. If there are zero hits, make no changes and record that in the commit/PR notes. Leave `docs/prompt-migration-outcome.md` untouched regardless.

- [ ] **Step 3: Commit (only if you changed something).**

```bash
git add docs/TECH_DEBT.md docs/PROMPTS.md
git commit -m "docs: correct drift in TECH_DEBT/PROMPTS after backend refactor"
```
If nothing changed, skip the commit and note "verify-only: no drift found."

---

## Task 9: Acceptance gate

**Files:** none (verification only; fix-and-recommit if it fails)

- [ ] **Step 1: Old-shape grep across living docs returns zero.** (Excludes frozen snapshots, historical specs/plans/reviews, and `prompt-migration-outcome.md`.)

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE 'backend/(api|services|database|config|llm_config)\.py|(api|services)\.py:[0-9]|database\.py|pagination is not a project convention|[Pp]rompts are inline' \
  CLAUDE.md AGENTS.md \
  "docs/architecture/BACKEND.md" \
  "docs/Deployment Infrastructure and Notes.md" \
  docs/TECH_DEBT.md docs/PROMPTS.md \
  backend/README.md backend/TESTING.md backend/API_DOCUMENTATION.md backend/API_ENDPOINTS_SUMMARY.md \
  && echo "FAIL: stale signatures in living docs" || echo "OK: living docs clean"
```
Expected: `OK: living docs clean`. (`app/core/config.py` / `app/core/llm_config.py` are valid and won't match the `backend/…` anchored patterns. Adjudicate any hit: a legitimate "formerly api.py" aside is acceptable; a current-state claim is not — fix it.)

- [ ] **Step 2: Every backend path referenced in the canonical doc resolves; no line-number refs.**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE '\.py:[0-9]' docs/architecture/BACKEND.md && echo "FAIL: line refs" || echo "OK: no line refs"
grep -n '<!-- ' docs/architecture/BACKEND.md && echo "FAIL: markers left" || echo "OK"
```
Expected: `OK: no line refs`, `OK`.

- [ ] **Step 3: Agent files share byte-identical sections (spec §8 item 3).**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
diff CLAUDE.md AGENTS.md
```
Expected: the **only** difference is AGENTS.md's unique "Tool Usage Pitfalls" / "Glob patterns are NOT regex" block (lines added in AGENTS.md). If any shared section (Backend topology, Gotchas, Pre-existing Analyses, etc.) differs, Task 3 regressed or a later edit drifted — re-sync the shared sections from `CLAUDE.md`.

- [ ] **Step 4: Endpoint inventory matches the live router surface (mechanical diff).**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
# Decorator path fragments from code (sorted/unique):
grep -rhoE '@router\.(get|post|put|delete|patch)\("[^"]*"' app/routers/ --include='*.py' \
  | grep -oE '"[^"]*"' | tr -d '"' | sort -u > /tmp/code_paths.txt
# Path fragments documented in the summary (sorted/unique):
grep -oE '/[a-zA-Z0-9_/{}-]+' API_ENDPOINTS_SUMMARY.md | sort -u > /tmp/doc_paths.txt
diff /tmp/code_paths.txt /tmp/doc_paths.txt
```
Expected: no code path fragment is missing from the doc. This compares decorator path *fragments*, not assembled full routes (full route = prefix + decorator path — see Task 6 Step 1), so treat a non-empty diff as a list to **adjudicate**: a `<` line (in code, not in doc) is a real gap to fix; a `>` line is usually the doc stating a full prefixed path the fragment grep stripped — confirm, don't blindly delete.

- [ ] **Step 5: If any check failed, fix the offending doc and re-run Steps 1–4.** Then make a final commit if fixes were needed:

```bash
git add -A
git commit -m "docs: close acceptance gaps for backend doc reconciliation"
```

- [ ] **Step 6: Confirm the full set of changes.**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --oneline master..HEAD
git diff --stat master..HEAD
```
Expected: commits for the canonical doc, CLAUDE.md, AGENTS.md, analysis banners, deployment notes, API docs, README/TESTING, (optional) tech-debt/prompts; diffstat touches only the intended living docs + the 9 bannered snapshots + the new `docs/architecture/BACKEND.md`. No `backend/app/**` code files changed.

---

## Self-Review (completed during planning)

- **Spec coverage:** §3 tiers → Tasks 2/3 (living agent files), 5/6/7 (other living), 4 (frozen), 8 (verify-only); §4 canonical doc → Task 1; §5 agent-file edits → Tasks 2–3 (incl. the broader api.py sweep needed for §8.2); §6 banner → Task 4; §7 → Tasks 5/6/7; §8 acceptance → Task 9 (grep + endpoint match + path resolution); §9 ordering (canonical doc first) → task order; §10 risks (dual-maintenance, spaced filename, stale `documents.pyc`, health wiring) → addressed in Tasks 3/5/6 and Task 1 open-question step.
- **Placeholder scan:** the only `<…>` tokens are the per-file `<YYYY-MM-DD>` banner date (Task 4, resolved by a given git command) and `<!-- verify -->` authoring markers in the Task 1 draft (explicitly required to be removed in Task 1 Step 3 / Task 9 Step 2). No "TBD"/"handle edge cases"/"similar to" placeholders.
- **Consistency:** the acceptance grep in Task 9 uses the same anchored pattern (`backend/(api|services|…)\.py`, `…\.py:[0-9]`) as the per-file checks in Tasks 2/3/5, so a doc that passes its task check passes the gate. Canonical doc path `docs/architecture/BACKEND.md` and banner link `../../architecture/BACKEND.md` are used consistently.
