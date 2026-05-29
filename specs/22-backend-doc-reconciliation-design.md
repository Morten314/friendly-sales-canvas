# Spec 22 — Backend Documentation Reconciliation

**Date:** 2026-05-29
**Status:** Draft (design)
**Type:** Documentation / agent-rules sync (no code changes)
**Related:** Backend refactor Phases A–L (specs `2026-05-12-backend-modularization` … `12-backend-loc-and-docstring-audit-phase-l`) and `13-prompt-management`. Successor reference doc: `docs/architecture/BACKEND.md` (created by this work).

---

## 1. Context & problem

The monorepo backend (`brewra-gtm-intelligence/backend/`) was refactored from a flat monolith into a layered FastAPI application:

- **Old shape:** `api.py` (~4.4k LOC, all endpoints inline), `services.py` (~2.5k LOC), `models.py`, `config.py`, `database.py`, `llm_config.py`, a thin `main.py` with a strict import-order contract.
- **New shape:**
  - `app/core/` — `clients`, `config`, `dependencies`, `exceptions`, `llm_config`, `logging`, `prompts` (loader/registry/render API)
  - `app/models/` — per-domain Pydantic models, including `pagination.py`
  - `app/routers/` + `app/routers/v2/` — versioned routers per domain
  - `app/services/<domain>/` — `orchestrator` / `persistence` / `llm` / `parsing` / `normalization` / `scoring` modules plus shared helpers (`_claude_budget`, `_llm_helpers`, `_neo4j_helpers`, `_retrieval`)
  - `prompts/<svc>/` — Jinja2 prompt bodies served by `app/core/prompts.py`
  - `tests/` — `tests/unit/` (unit suite, incl. golden-prompt + loader tests), top-level API/integration tests (incl. `*_v2`, `test_lifespan`, `test_smoke`), plus `__snapshots__`/`_baselines`/`fixtures` infra
  - `main.py` — thin shim: `from app.main import app` (preserves `uvicorn main:app`)

The code refactor is **complete**. Several *living* project/agent docs still describe the old monolith — citing `api.py`/`services.py` line numbers, asserting "pagination is not a project convention yet" (Phase G added it) and "prompts are inline in `services.py`" (plan-13 externalized them). An agent or Brewra dev reading these is actively misled.

This spec defines the work to reconcile the living docs with the current backend shape, while preserving the historical analysis snapshots as a dated record.

## 2. Goals & non-goals

### Goals
- Living project/agent docs reflect the current layered backend, so a reader gets the real shape rather than the retired monolith.
- A single concise, canonical, living backend-architecture reference exists at `docs/architecture/BACKEND.md`; agent files point to it.
- The two `docs/analysis/` sets are clearly preserved as pre-refactor point-in-time snapshots, not mistaken for current truth.

### Non-goals (explicit)
- **No frontend doc updates.** The frontend refactor is in flight (specs 14–21). Where a frozen analysis doc's frontend section could mislead, the banner notes "frontend refactor in progress — see specs 14–21." No frontend prose is rewritten.
- **No code changes.** Docs only.
- **No security/hardening recommendations.** Consistent with the MVP, pre-launch, 0-users posture: living docs *describe* current reality (no auth, CORS `*`, in-process background tasks) accurately, but neither add "recommended security architecture" pressure nor strip existing descriptions. Preserve posture as-is.
- **Out of scope:** the legacy standalone `/projects/Brewra/backend/` repo; `genesis-strategy/`; the parent `/projects/CLAUDE.md`; all historical specs/plans/reviews (they are the record of the work and are left untouched).

## 3. Doc tiers & treatment

Each affected doc falls into one of three tiers.

### 3.1 Living (edit to current state)
- `CLAUDE.md`
- `AGENTS.md`
- `docs/architecture/BACKEND.md` (**new** — §4)
- `docs/Deployment Infrastructure and Notes.md`
- `backend/API_DOCUMENTATION.md`
- `backend/API_ENDPOINTS_SUMMARY.md`
- `backend/README.md`
- `backend/TESTING.md`

### 3.2 Frozen (preserve body; add banner)
- `docs/analysis/detailed-analysis/*` (ARCHITECTURE_DOCUMENT, DESIGN_SYSTEM, FUNCTIONALITY_INVENTORY, PRODUCT_SPECIFICATION, README)
- `docs/analysis/claude-analysis/*` (ARCHITECTURE_DOCUMENT, DESIGN_SYSTEM, FUNCTIONALITY_INVENTORY, PRODUCT_SPECIFICATION)

Add a banner at the top of **each file** (see §6 for exact content). The document body is left intact — these are historical snapshots, not living docs.

### 3.3 Verify-only (fix confirmed drift only; no rewrite)
- `docs/TECH_DEBT.md`
- `docs/PROMPTS.md`
- `docs/prompt-migration-outcome.md`

Two distinct treatments within this tier:
- **Verify-and-fix-drift** — `docs/TECH_DEBT.md` and `docs/PROMPTS.md`. Expected already current (maintained during the refactor; `TECH_DEBT.md` references `app/` and `prompts/`, and the prompt docs were authored by plan-13). Confirm, and correct only genuine drift; no rewrite.
- **Audit-only (no content changes)** — `docs/prompt-migration-outcome.md`. A frozen audit trail by design: verify it exists and is structurally intact, but make **no** content edits even where it references the old shape. It is explicitly exempt from the §8 acceptance grep (see §8 item 2).

## 4. New canonical doc — `docs/architecture/BACKEND.md`

Create `docs/architecture/` (new directory) as the home for living architecture references. The doc is concise (~2–3 pages), written from the code as source of truth, and structured so it survives future refactors (reference modules/symbols, never line numbers). Related required sections below may be merged where that reads more naturally (e.g. entrypoint+lifecycle, posture+maintenance) — the section list is a content checklist, not a mandated heading count.

### Required sections
1. **Entrypoint & boot** — `main.py` shim → `app.main`; lifespan responsibilities (prompt registry init, client connectivity, Neo4j schema refresh); how it runs locally (`uvicorn main:app`) and on Render.
2. **Layering** — one line each on the responsibility of `core/`, `models/`, `routers/` (+ `v2/`), `services/<domain>/` (the `orchestrator` / `persistence` / `llm` / `parsing` / `normalization` / `scoring` split + shared `_`-prefixed helpers), and `prompts/`.
3. **Request lifecycle** — router → service orchestrator → persistence / llm / retrieval → response.
4. **Domains** — enumerate the service packages: `icp`, `signals`, `leads`, `market_research`, `market_scoring`, `customer_profile`, `data_sources`, `org_auth`, `graph_chat`, `pipeline`, `profiles`, plus `health` (a service module — `app/services/health.py` — with no dedicated router; note how its liveness/readiness check is wired). Verify the set against `app/services/` at authoring time.
5. **v1 vs v2 routers** — what the versioning split is and what it implies for adding/changing endpoints.
6. **Cross-cutting** — `core/clients` (Neo4j / Mongo / Pinecone / S3 / LLM providers), `dependencies`, `config`, `logging`, `exceptions`, and the prompt loader.
7. **Polyglot persistence map** + a one-line pointer to the prompt system (`docs/PROMPTS.md`).
8. **Testing layout** — one line describing the *actual* structure (`tests/unit/` unit suite incl. golden-prompt tests; top-level API/integration tests incl. `*_v2`; `__snapshots__`/`_baselines`/`fixtures` infra), with a pointer to `backend/TESTING.md`. Do not assert a clean unit/integration/golden three-way directory split — golden-prompt tests live inside `tests/unit/`.
9. **Current posture** — no auth, CORS `*`, in-process background tasks (descriptive only; link `docs/TECH_DEBT.md`; no hardening recommendations).
10. **Keeping this current** — a short note: reference modules/symbols, not line numbers; update when the layering changes.

### Content rules
- Every structural claim traces to a real path under `backend/app/` (or `backend/prompts/`, `backend/tests/`).
- No line-number references. Symbol- or module-level references only.
- Concise prose over exhaustive enumeration; this is a map, not a module-by-module reference.

## 5. Agent files — `CLAUDE.md` + `AGENTS.md`

`CLAUDE.md` and `AGENTS.md` are intentionally near-duplicate context files for different agent tools and are both actively maintained. All edits below are applied **identically to both**, preserving each file's unique sections (notably `AGENTS.md`'s "Tool Usage Pitfalls").

### 5.1 "Architecture: Big Picture → Backend topology"
- Replace the flat-shape description with the layered structure (summarized; `docs/architecture/BACKEND.md` carries the detail).
- Remove the `api.py`/`services.py` LOC claims and the `main.py` import-order contract line.
- Update the Scout/Profiler shared-code note: the shared logic now lives in `app/services/signals/` (relocate the `search_signals_scout`/`search_signals_profiler` reference to its current module; persona differentiation is now via the prompt loader). Verify against code.
- Add a pointer: "See `docs/architecture/BACKEND.md` for the current backend map."

### 5.2 "Gotchas"
Re-validate each gotcha against the current code:
- **Remove or mark resolved:**
  - "Pagination is not a project convention yet" — resolved by Phase G (`app/models/pagination.py`, v2 list endpoints). Replace with the current pagination convention (cross-reference `TD-005` for the `count` semantics caveat if still open).
  - "Prompts are inline in `backend/services.py`" — resolved by plan-13. Replace with the prompt-loader reality (`app/core/prompts.py` + `prompts/<svc>/`; link `docs/PROMPTS.md`).
- **Keep, but re-anchor to the new structure (by module/symbol, not line number):**
  - CORS `allow_origins=["*"]` with credentials.
  - Cypher-injection caution in the graph/query paths ("don't extend this f-string pattern").
  - Embeddings are TogetherAI (not OpenAI despite the `langchain_openai` class name).
  - Neo4j schema hard-coded in the Cypher-generation prompt (now under `prompts/llm_config/` / `app/core/llm_config.py` — verify).
  - "No auto-generated OpenAPI client; verify response shape via `/docs` or `curl`" — keep if still true; update the file reference.
  - **Smoke-test scripts hit production** — re-anchor with nuance: the root `backend/test_*.py` probes (`test_delete_api.py`, `test_lead_market_score_identity.py`, `test_lead_market_scoring.py`, `test_upload_embedding.py`) still exist and hit prod, and must be distinguished from the real `backend/tests/` pytest suite (`tests/unit/` + integration). Keep the warning; clarify the two are different things now.
  - **`config.py` hardcoded credential fallbacks** — re-anchor `backend/config.py` → `app/core/config.py`; the gotcha itself remains valid.
  - **Multiple admin tools at `backend/` root** (`admin_panel.html`, `registration_admin_panel.html`, `cleanup_company_profile.py`) — still present and unchanged; keep the gotcha, drop any stale line references.

### 5.3 "Pre-existing Analyses"
Update to state that `docs/analysis/detailed-analysis/` and `docs/analysis/claude-analysis/` are **frozen pre-refactor snapshots**, and `docs/architecture/BACKEND.md` is the canonical current backend reference.

### 5.4 "Plans / Specs Reference"
Add an entry for this spec (`/specs/22-backend-doc-reconciliation-design.md`).

## 6. Frozen snapshot banner

Add to the top of each file listed in §3.2, immediately under the existing H1:

> **Snapshot — pre-backend-refactor.** This document reflects the backend as the flat `api.py`/`services.py` monolith and is preserved as a point-in-time analysis (authored `<authored-date>`). For the **current** backend architecture see [`docs/architecture/BACKEND.md`](../../architecture/BACKEND.md). Frontend sections are likewise a snapshot; the frontend refactor is in progress (see specs 14–21).

- `<authored-date>` is the file's **creation** date, derived unambiguously per file: `git log --diff-filter=A --format=%cs -- <file>` (the earliest commit that added the file). No subjective "most-relevant commit" judgment.
- The relative link is adjusted to the correct depth for each file's location.
- The banner is additive; no body content is changed.

## 7. Remaining living docs

### 7.1 `docs/Deployment Infrastructure and Notes.md`
- **Keep** the `uvicorn main:app --host 0.0.0.0 --port $PORT` start command — verified still valid (the `main.py` shim re-exports `app.main:app`); `render.yaml` is unchanged.
- **Fix** stale internals: `config.py` → `app/core/config.py`; module-load Neo4j connectivity (`database.py`) → `app/core/clients` + lifespan; `main.py:10` schema refresh → lifespan; "credentials inline ~15× in `api.py`" → current config reality.
- Preserve the operational notes (Render cold-start, shared-prod-data warning, network-policy allow) as-is.

### 7.2 `backend/API_DOCUMENTATION.md` + `backend/API_ENDPOINTS_SUMMARY.md`
- Reconcile the endpoint inventory against the current `app/routers/` + `app/routers/v2/` surface: add new endpoints, correct paths/shapes, remove endpoints that no longer exist.
- Note the v1/v2 split where relevant.
- **Derive the endpoint list programmatically — do not hand-reconcile.** Enumerate route decorators (`grep -rhoE '@router\.(get|post|put|delete|patch)' app/routers/` — currently 58 across v1+v2) or dump a running `/openapi.json`. The decorator grep is the reliable offline method; `/openapi.json` requires a fully-booted app (all clients connecting), so treat it as optional cross-check.

### 7.3 `backend/README.md`
- Currently a Render-template stub. Replace with a short, real backend README: what the service is, how to run it locally and test it, and a pointer to `docs/architecture/BACKEND.md`.

### 7.4 `backend/TESTING.md`
- Accuracy pass against the current `tests/` layout (unit + integration + golden-prompt). Correct any commands or paths that drifted.

## 8. Acceptance criteria

Definition of done:
1. **`docs/architecture/BACKEND.md` exists** and covers the §4 required sections; every structural claim traces to a real `backend/app/` (or `prompts/`/`tests/`) path; no line-number references.
2. **Old-shape grep across living docs returns zero.** Searching the §3.1 living docs for old-monolith signatures — e.g. `api\.py:` / `services\.py:` line refs, `database\.py` module-load, "pagination is not a project convention", "prompts are inline" — yields no hits. Excluded from this grep: the §3.2 frozen snapshots, all historical specs/plans/reviews, and `docs/prompt-migration-outcome.md`.
3. **Agent files updated identically** (`CLAUDE.md` ≡ `AGENTS.md` for the shared sections), with the Backend topology, Gotchas, Pre-existing Analyses, and Plans/Specs Reference changes from §5; each file's unique sections preserved.
4. **Both `analysis/` sets banner-stamped** per §6; bodies unchanged.
5. **Deployment, backend API docs, backend README, backend TESTING** updated per §7; the start command preserved. The endpoint inventory matches the live router surface — every `@router.*` path in `app/routers/` + `v2/` is represented, and none that no longer exist remain.
6. **Verify-only docs** confirmed current (or minimally corrected); `prompt-migration-outcome.md` left as a frozen audit trail.
7. Living docs reference the new structure **by module/symbol, not line number**, so they survive the next refactor.

## 9. Work breakdown (input to the plan)

1. Author `docs/architecture/BACKEND.md` from the code (create `docs/architecture/`).
2. Update `CLAUDE.md` + `AGENTS.md` (mirrored edits; preserve unique sections).
3. Banner the two `docs/analysis/` sets (creation date per file via `git log --diff-filter=A --format=%cs`; compute the relative link to `docs/architecture/BACKEND.md` per file — mechanically two depth variants for the two directory levels).
4. Fix `docs/Deployment Infrastructure and Notes.md`.
5. Reconcile `backend/API_DOCUMENTATION.md` + `backend/API_ENDPOINTS_SUMMARY.md`.
6. Author a real `backend/README.md` — this is **new-content authoring**, not reconciliation of existing prose, so flag it for review attention; accuracy-pass `backend/TESTING.md` against the verified `tests/` layout.
7. Verify-only pass on `docs/TECH_DEBT.md` + `docs/PROMPTS.md`.
8. Run the acceptance grep (§8.2) and confirm zero hits.

Sequencing note: step 1 should land first — it is the reference the agent files (step 2) and analysis banners (step 3) point to. Steps 4–7 are independent and can proceed in parallel.

## 10. Risks & open questions

- **Code-vs-doc verification burden.** Several living-doc claims (CORS, Cypher path, embeddings provider, Neo4j schema location, Scout/Profiler shared module) must be re-located in the new tree before re-anchoring. The plan should treat "find current location in code" as an explicit step per claim, not assume the old fact still holds verbatim.
- **Endpoint inventory accuracy.** `API_ENDPOINTS_SUMMARY.md` reconciliation depends on enumerating the current router surface (v1 + v2); the plan should derive this from `app/routers/` directly (or a running `/openapi.json`) rather than hand-editing.
- **Dual agent-file maintenance persists.** This spec keeps `CLAUDE.md` and `AGENTS.md` as mirrored files and mandates identical edits — honest about the current scope, but it perpetuates a dual-maintenance burden. Collapsing them to a single source with tool-specific wrappers is a known future cleanup, deliberately out of scope here.
- **Spaced filename.** `docs/Deployment Infrastructure and Notes.md` contains spaces; the implementer must quote it in shell commands and grep patterns.
- **No regression into frozen tiers.** The acceptance grep must scope-exclude the frozen snapshots, historical specs/plans/reviews, and `prompt-migration-outcome.md`, or it will report false positives.
