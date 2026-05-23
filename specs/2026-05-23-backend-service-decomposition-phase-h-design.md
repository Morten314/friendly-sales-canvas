# Backend Service Decomposition Phase H — Per-Domain Packages Split By Concern

**Date:** 2026-05-23
**Status:** Draft — awaiting spec review
**Branch (planned):** `refactor-backend-service-decomposition-phase-h` off `master`
**Predecessors:** Phase A (`/specs/2026-05-12-backend-modularization-design.md`), Phase B (`/specs/2026-05-21-backend-modularization-phase-b-design.md`), Phase C (`/specs/2026-05-22-backend-modularization-phase-c-design.md`), Phase D (`/specs/2026-05-22-backend-modularization-phase-d-design.md`), Phase E (`/specs/2026-05-22-backend-test-improvements-phase-e-design.md`), Phase F (`/specs/2026-05-22-backend-modularization-phase-f-design.md`), Phase G (`/specs/2026-05-23-backend-pagination-and-index-hygiene-phase-g-design.md`)

**Note on phase naming.** TD-005 and the Phase G spec earlier reserved "Phase H" for v1-route deletion. That work is reassigned to a later phase. This Phase H is service decomposition. Future phase letters renumber accordingly — v1 deletion becomes Phase I or later.

---

## 1. Summary

Phase H converts the five remaining large service files into per-domain packages split by concern. `signals.py` (1297 LOC), `icp.py` (1145 LOC), `market_research.py` (1016 LOC), `documents.py` (930 LOC), and `market_scoring.py` (854 LOC) each become a `services/<domain>/` package with focused submodules — typically `prompts.py`, `llm.py`, `parsing.py`, `persistence.py`, and `orchestrator.py`, with `__init__.py` re-exporting the public API to preserve every existing import path.

The `documents.py` package is renamed to `data_sources/` to disambiguate from project documentation. Routers, test files, and the public-API symbol surface get the same rename. HTTP route paths (`/user-documents`, `/document/*`, `/delete-data-source`) are **unchanged** — they're FE contracts.

This is a pure structural move: zero changes to behavior, signatures, response shapes, route paths, or test assertions. After this phase prompts are isolated to their own modules (paving the way for Option D — prompt externalization), and the codebase has clean seams for future work on JWT/CORS/Cypher hardening.

Free side-effect: closes TD-006 (`market_scoring.py` callers recomputing `len(leads)` instead of using returned `total`) as a two-character fix folded into the `market_scoring/` extraction commit.

Test count holds at 236 (the Phase G end-state baseline observed post-merge). No new tests this phase; current tests cover the public surface and migrate transparently via `__init__.py` re-exports.

---

## 2. Scope

### 2.1 In scope

1. **Five service-file decompositions** into `services/<domain>/` packages. Per-service module set varies — LLM-driven services use the full `prompts/llm/parsing/persistence/orchestrator` set; persistence-driven services use a tailored set (see §3). Services below ~800 LOC (`graph_chat.py`, `org_auth.py`, `profiles.py`, `customer_profile.py`, `pipeline.py`, `leads.py`) are not decomposed in this phase — they fit on one screen and the package overhead would exceed the readability benefit. Test files (`tests/test_<domain>.py`, `tests/unit/test_<domain>.py`) for the four non-renamed services stay at their current locations and remain unchanged.

2. **`documents/` → `data_sources/` rename.** Ripples to:
   - `services/documents.py` → `services/data_sources/` (package).
   - `routers/documents.py` → `routers/data_sources.py`.
   - `routers/v2/documents.py` → `routers/v2/data_sources.py`.
   - `tests/test_documents.py` → `tests/test_data_sources.py`.
   - `tests/test_documents_v2.py` → `tests/test_data_sources_v2.py`.
   - `tests/unit/test_documents.py` → `tests/unit/test_data_sources.py`.
   - `app/main.py` router-include lines (`app/main.py:141,145`) + any `tags=["documents"]` attribute.

   **OpenAPI grouping note.** `tags=["documents"]` and `tags=["v2", "documents"]` become `tags=["data_sources"]` and `tags=["v2", "data_sources"]`. This shifts the Swagger `/docs` grouping from "documents" to "data_sources" — an intentional cosmetic surface change consistent with the package rename. Tags are not listed in the §2.3 HTTP-surface-stability exclusion, so this isn't a constraint violation.

3. **TD-006 close-out.** Two callsites in `market_scoring` orchestrator change from `leads, _ = get_leads_for_org(...); total_leads = len(leads)` to `leads, total_leads = get_leads_for_org(...)`. Folded into the `market_scoring/` orchestrator-extraction commit (no separate commit).

4. **`__init__.py` re-exports.** Every public symbol that was importable from `app.services.<domain>` before this phase is importable from the same path after. `_`-prefixed helpers are not re-exported **unless they are imported by code outside the package** (routers, lifespan hooks, or referenced as `BackgroundTasks.add_task` callables). The exhaustive exception list is in §3.7.

5. **Shared cross-domain helpers stay flat.** `_llm_helpers.py`, `_retrieval.py`, `_neo4j_helpers.py`, `_claude_budget.py` keep their current location at `services/` root. They serve multiple domains and don't belong inside any single package.

### 2.2 Out of scope

- **Lifting prompts out of Python.** Prompts move into `prompts.py` modules but stay as inline `f"""..."""` and `template.format(...)` strings. Externalization to `.md`/`.yaml` and prompt versioning is Option D, deferred to the next phase.
- **Reducing hardcoded regional examples** (`ANALYSIS_MARKET_ICP_RESEARCH_ISSUES.md`). Content change — deferred to Option D.
- **Consolidating the three `_*_agent_output` helpers** (`_signals_agent_output`, `_icp_research_agent_output`, `_market_research_agent_output`) into a single `_llm_helpers.py` function. Each gets moved unchanged into its per-service `llm.py` this phase. Consolidation is a behavioral change and out of Phase H's purely-structural scope; it can land as a follow-up.
- **v1 route deletion / FE migration to v2** (TD-005). Cross-stack work — deferred.
- **Security hardening** (JWT validation, Cypher injection, CORS) — deferred to a dedicated phase.
- **Background-task durability** — deferred.
- **TD-004 (real captured fixtures), TD-007 (cosmetic cruft)** — deferred to separate close-out work. TD-005 and TD-007 sit in files this phase touches but are out of scope; downstream phases can address them without conflict.
- **New per-submodule unit tests.** Current tests assert against the public API and cover behavior end-to-end. Adding tests at the submodule level (`test_signals_prompts.py`, etc.) would be premature — service-level coverage already exists.
- **Renaming public function names** even when the function name still says "document" inside `data_sources/`. The package name signals the domain; function-name churn would ripple into routers and tests for no real gain.
- **Splitting routers.** Router files stay single-file per domain. Routers are already small (24-128 LOC); the decomposition pressure is on services only.

### 2.3 Constraints

- **Public API stability.** Every existing `from app.services.<domain> import <symbol>` keeps working byte-for-byte. This is the load-bearing invariant — routers and tests don't change because services migrated.
- **HTTP surface stability.** No route paths, no `response_model` types, no query/body params change.
- **Per-commit greenness.** `BREWRA_SKIP_DB_INIT=1 python -m pytest -q` passes at every commit on the phase branch. Tests run in ~8s; full-suite per commit is the verification floor.
- **No new dependencies.** Pure code-shape work.

---

## 3. Per-Service Layout

### 3.1 Common convention

```
services/<domain>/
  __init__.py       # public API re-exports
  prompts.py        # prompt templates + builders         (LLM-driven only)
  llm.py            # LLM invocation wrappers             (LLM-driven only)
  parsing.py        # response shape → domain objects     (LLM-driven only)
  persistence.py    # Mongo / Neo4j / S3 / Pinecone I/O
  orchestrator.py   # multi-step workflow compositions
```

**Where public functions live.** Public functions go in whichever submodule does the actual work. `orchestrator.py` holds multi-step compositions (e.g., `run_icp_research` calls research workers, persists results, fetches related data). Simple persistence-only operations (e.g., `record_signal_action` — one Mongo write) live in `persistence.py` and are re-exported from there. `__init__.py` imports from wherever each symbol actually lives.

**Dependency direction.** `orchestrator` is the root that composes everything. All four leaves (`prompts`, `llm`, `parsing`, `persistence`) are independent of each other; `llm.py` does not import from `prompts.py` because the existing `_*_agent_output` signatures take `prompt: str` as a parameter — the orchestrator imports both `llm` and `prompts` and threads the prompt string in as an argument. No leaf-to-leaf imports permitted. If a parser needs prompt-specific knowledge, colocate (keep them in one module); cross-imports between siblings are a smell.

**`__init__.py` content.** Re-exports only — no logic. Two illustrative examples:

```python
# services/signals/__init__.py — public-only re-exports
from app.services.signals.orchestrator import (
    search_signals,
    run_signals_research,
    generate_signals_batch,
    signal_ask,
    fetch_signals,
)
from app.services.signals.persistence import (
    record_signal_action,
)

__all__ = [
    "search_signals",
    "run_signals_research",
    "generate_signals_batch",
    "signal_ask",
    "fetch_signals",
    "record_signal_action",
]
```

```python
# services/market_scoring/__init__.py — illustrates §3.7 _-prefix exceptions
from app.services.market_scoring.orchestrator import (
    trigger_or_get_market_scores,
    get_market_scores_status,
    get_lead_market_score_descriptions,
)
from app.services.market_scoring.persistence import (
    get_company_profile_for_org,
    _ensure_market_scoring_indexes,      # §3.7: called by app/main.py lifespan
    _get_latest_market_score_rows,       # §3.7: imported by unit tests
)
from app.services.market_scoring.scoring import (
    _run_market_scoring_for_org,         # §3.7: imported by unit tests
)

__all__ = [
    "trigger_or_get_market_scores",
    "get_market_scores_status",
    "get_lead_market_score_descriptions",
    "get_company_profile_for_org",
    "_ensure_market_scoring_indexes",
    "_get_latest_market_score_rows",
    "_run_market_scoring_for_org",
]
```

### 3.2 `signals/` — full layout

Source: `services/signals.py` (1297 LOC).

| Submodule | Contains | Approx LOC |
|---|---|---|
| `prompts.py` | Inline `MAIN_PROMPT_TEMPLATE` + persona prompt blocks (current lines ~75-313) | ~250 |
| `llm.py` | `_signals_agent_output` | ~35 |
| `parsing.py` | Response-normalization helpers extracted from `search_signals` / `_generate_signals_batch_impl` bodies (helper names assigned during implementation) | ~150 |
| `persistence.py` | `record_signal_action` (public) + Mongo read helpers extracted from `fetch_signals` body (helper names assigned during implementation) | ~120 |
| `orchestrator.py` | `search_signals`, `run_signals_research`, `_generate_signals_batch_impl`, `generate_signals_batch`, `generate_signals_batch_claude`, `fetch_signals`, `signal_ask`, `signal_ask_claude` | ~350 |
| `__init__.py` | Re-exports (see public symbols below) | ~25 |

**Public symbols (re-exported from `__init__.py`):** `search_signals`, `run_signals_research`, `generate_signals_batch`, `generate_signals_batch_claude`, `signal_ask`, `signal_ask_claude`, `record_signal_action`, `fetch_signals`.

**Implementor note — Claude variants.** Pre-flight against the current codebase confirmed: `generate_signals_batch_claude` and `signal_ask_claude` are live backend-dispatcher wrappers (covered by `tests/unit/test_signals.py` lines 117 / 273 etc., which assert dispatch with `llm_backend='claude'`). Keep in `orchestrator.py` unchanged.

**LOC estimation note for signals/.** The submodule estimates above total ~930 LOC against a 1297 LOC source — leaving ~370 LOC (28%) for imports, module-level constants, docstrings, blank lines, and any inline helpers not yet mapped to a submodule. Distribute that residual by best judgment during decomposition; the `~400 LOC per submodule` ceiling was dropped from §6 in round-1 revisions and no longer applies as a constraint.

### 3.3 `icp/` — full layout

Source: `services/icp.py` (1145 LOC).

| Submodule | Contains | Approx LOC |
|---|---|---|
| `prompts.py` | Prompt templates from `ICP_generator` + `icp_research_1..4` | ~280 |
| `llm.py` | `_icp_research_agent_output` | ~20 |
| `parsing.py` | JSON-extraction helpers extracted from `icp_research_N` bodies (helper names assigned during implementation) | ~80 |
| `persistence.py` | `list_icps`, `delete_recommended_icp`, `_ensure_icp_indexes`, `_reserve_unique_icp_id`, `_release_icp_id` (last three re-exported per §3.7) | ~280 |
| `orchestrator.py` | `ICP_generator`, `icp_research_1..4`, `_run_icp_research_impl`, `run_icp_research` | ~280 |
| `__init__.py` | Re-exports (see public symbols below) | ~25 |

**Public symbols (re-exported from `__init__.py`):** `ICP_generator`, `icp_research_1`, `icp_research_2`, `icp_research_3`, `icp_research_4`, `run_icp_research`, `list_icps`, `delete_recommended_icp`. Plus `_ensure_icp_indexes`, `_reserve_unique_icp_id`, `_release_icp_id` (see §3.7 — the last two are lazy-imported by `customer_profile.py`).

### 3.4 `market_research/` — full layout

Source: `services/market_research.py` (1016 LOC).

| Submodule | Contains | Approx LOC |
|---|---|---|
| `prompts.py` | Five prompt templates extracted from `Research_Market_1..5` | ~400 |
| `llm.py` | `_market_research_agent_output` | ~20 |
| `parsing.py` | JSON-extraction helpers shared across the five `Research_Market_N` workers (helper names assigned during implementation) | ~80 |
| `persistence.py` | Mongo writes for the market-research report (helpers extracted from `run_market_research` body) | ~80 |
| `orchestrator.py` | `Research_Market_1..5`, `run_market_research` | ~280 |
| `__init__.py` | Re-exports (see public symbols below) | ~25 |

**Public symbols (re-exported from `__init__.py`):** `Research_Market_1`, `Research_Market_2`, `Research_Market_3`, `Research_Market_4`, `Research_Market_5`, `run_market_research`.

### 3.5 `data_sources/` — deviates (no LLM)

Source: `services/documents.py` (930 LOC), renamed.

| Submodule | Contains | Approx LOC |
|---|---|---|
| `loaders.py` | `load_document`, `grapher`, `process_prospect_list`, `upload_file_text`, `upload_prospect_list_file` | ~150 |
| `pipeline.py` | `process_file_to_embeddings`, `upload_document_file` (the S3+Pinecone+Mongo coordinated upload) | ~400 |
| `persistence.py` | `list_user_documents`, `get_document_status`, `delete_data_source`, `update_data_source` | ~280 |
| `__init__.py` | Re-exports (see public symbols below) | ~25 |

**Public symbols (re-exported from `__init__.py`):** `upload_file_text`, `upload_prospect_list_file`, `upload_document_file`, `process_file_to_embeddings`, `list_user_documents`, `get_document_status`, `delete_data_source`, `update_data_source`. Implementor confirms the full surface by greping for `from app.services.documents import` across `backend/`.

No `prompts.py`/`llm.py`/`parsing.py` — this service doesn't drive LLMs.

### 3.6 `market_scoring/` — deviates (data-transformation heavy)

Source: `services/market_scoring.py` (854 LOC).

| Submodule | Contains | Approx LOC |
|---|---|---|
| `normalization.py` | `_safe_json_to_obj`, `_normalize_non_empty_string`, `_canonicalize_key`, `_build_lookup_maps`, `_first_non_empty_value_from_keys`, `_extract_company_name`, `_extract_lead_name`, `_extract_description_preview`, `_parse_iso_datetime` | ~200 |
| `persistence.py` | `_get_market_score_collections`, `_get_latest_market_score_rows`, `_get_latest_scoring_run`, `_get_lead_identity_from_neo4j`, `get_company_profile_for_org`, `_ensure_market_scoring_indexes` | ~250 |
| `scoring.py` | `_lead_to_score_row`, `_is_stale_queued_run`, `_run_market_scoring_for_org` (the background scoring task) | ~180 |
| `orchestrator.py` | `trigger_or_get_market_scores`, `get_market_scores_status`, `get_lead_market_score_descriptions` (with TD-006 two-char fix applied) | ~200 |
| `__init__.py` | Re-exports (see public symbols below) | ~25 |

**Public symbols (re-exported from `__init__.py`):** `trigger_or_get_market_scores`, `get_market_scores_status`, `get_lead_market_score_descriptions`, `get_company_profile_for_org`. Plus `_ensure_market_scoring_indexes`, `_get_latest_market_score_rows`, and `_run_market_scoring_for_org` (see §3.7).

No `prompts.py`/`llm.py`/`parsing.py` — no LLM in this service.

### 3.7 Exception list: `_`-prefixed symbols re-exported from `__init__.py`

The general rule (§2.1 item 4) is that `_`-prefixed helpers stay internal to their package. The following exceptions are imported by code outside their package and **must** be re-exported from the corresponding `__init__.py`. Forgetting any of these breaks `app/main.py` lifespan or router-level `BackgroundTasks.add_task` calls.

| Symbol | Re-exported from | Imported by | Reason |
|---|---|---|---|
| `_ensure_market_scoring_indexes` | `services/market_scoring/__init__.py` | `app/main.py` (lifespan) | Mongo-index creation at startup |
| `_ensure_icp_indexes` | `services/icp/__init__.py` | `app/main.py` (lifespan) | Mongo-index creation at startup |
| `_reserve_unique_icp_id` | `services/icp/__init__.py` | `app/services/customer_profile.py:20,139,217` (lazy, in function bodies) | Atomic ID-reservation shared with customer-profile service |
| `_release_icp_id` | `services/icp/__init__.py` | `app/services/customer_profile.py:354` (lazy, in function body) | Atomic ID-release shared with customer-profile service |
| `_run_market_scoring_for_org` | `services/market_scoring/__init__.py` | `tests/unit/test_market_scoring.py:19` | Direct unit-test import (the router uses `from app.services import market_scoring as market_scoring_service` and references via attribute access, which works through the package's `__init__.py` even without explicit re-export — but the test imports the symbol directly, so re-export is required) |
| `_get_latest_market_score_rows` | `services/market_scoring/__init__.py` | `tests/unit/test_market_scoring.py:372` | Direct unit test of pagination contract |

**Pre-flight check before scaffolding any service.** Run `grep -rn "from app.services.<domain> import _" backend/ tests/` for each service (replace `<domain>` with each of `signals`, `icp`, `market_research`, `documents`, `market_scoring`). Any new `_`-prefixed import surfaced gets added to this table before the corresponding service is decomposed.

---

## 4. Migration Strategy

### 4.1 Order of attack

Easiest → hardest, so the per-domain pattern is validated on simpler services before tackling the most interleaved file:

1. **`market_scoring/`** — no LLM, cleanest internal seams. Proves the package pattern. Closes TD-006 as side-effect.
2. **`data_sources/`** — proves the rename pattern (package + routers + tests + main.py).
3. **`market_research/`** — proves the LLM-package pattern on the most regular `Research_Market_N`-style file.
4. **`icp/`** — applies proven LLM pattern.
5. **`signals/`** — hardest case (most interleaved), done last with the pattern fully validated.

### 4.2 Per-service commit template

While Python's import machinery allows both `services/<domain>.py` and `services/<domain>/__init__.py` on disk (the package shadows the module), leaving the original file alongside the new package is confusing and easy to miss in review. Step 1 therefore moves all code into the package and deletes the original in a single commit.

```
1. Move service file into package: git mv services/<domain>.py services/<domain>/orchestrator.py;
   create services/<domain>/__init__.py with full public-API re-exports against orchestrator.py.
   Tests must pass. (Use git mv to preserve git log --follow and git blame continuity.)
2. extract persistence.py from orchestrator.py — lowest coupling, no caller signature changes
3. extract prompts.py from orchestrator.py — LLM-driven services only; pure data, no behavior
4. extract llm.py + parsing.py from orchestrator.py — LLM-driven services only
5. closeout (per-service variations):
   - data_sources/: rename router files + test files + main.py inclusion in same commit
   - market_scoring/: fold in TD-006 two-char fix in same commit
   - signals/: final cleanup pass
   - market_research/, icp/: no closeout commit needed
```

Commit count per service: `market_scoring/` 4 commits (1, 2, normalization/scoring split, 5); `data_sources/` 4 commits (1, 2, loaders/pipeline split, 5); `market_research/` 4 commits (1, 2, 3, 4); `icp/` 4 commits (1, 2, 3, 4); `signals/` 5–6 commits (1, 2, 3, 4, 5, optional cleanup). **Total: approximately 21–22 commits.**

Each commit message follows the convention used in Phase G: `refactor(be): extract <domain>/persistence.py [phase H, commit N/M]`. The `[phase H, commit N/M]` tail makes review-trace easy.

### 4.3 Per-commit verification

`cd backend && BREWRA_SKIP_DB_INIT=1 python -m pytest -q` from each commit's checkout. Full suite (~8s). The cost is trivial; full coverage at every commit gives confidence the structural move hasn't broken any caller.

No test removed unless the commit message explicitly justifies it; total count holds at ≥236 throughout the phase (Phase G end-state observed post-merge).

---

## 5. Risks

### 5.1 Hidden interdependencies between submodules

A parser function may depend on prompt-specific knowledge of LLM output structure; a persistence helper may have implicit ordering assumptions tied to scoring logic. Mitigation: extract `persistence.py` first (lowest coupling, surfaces fewest surprises), discover prompt↔parser ties only when extracting `parsing.py`. **If two pieces are too coupled to separate cleanly, colocate them rather than forcing a split.** The package convention adapts to the code, not the other way around.

### 5.2 Circular imports

All four leaves (`prompts`, `llm`, `parsing`, `persistence`) are independent of each other; only `orchestrator.py` imports from them. No cycles possible if discipline holds. Risk surfaces only if a submodule reaches sideways. Mitigation: code review check, plus the test suite will fail with `ImportError` immediately on a bad import order.

### 5.3 `__init__.py` re-export drift

Adding a symbol to a submodule but forgetting to re-export it in `__init__.py` produces an `ImportError` at the caller. Mitigation: every commit's diff explicitly lists which symbols re-exported; full test suite runs per commit and imports the public API the same way callers do — broken re-exports fail tests immediately. The §3.7 exception list is the authoritative reference for `_`-prefixed symbols that must be re-exported despite the underscore convention.

**Known gap in automated coverage.** Two external consumers are not exercised by `pytest -q`:
- `backend/tests/capture_fixtures.py` (manual capture script) imports `Research_Market_1..5`, `icp_research_1..4`, and `search_signals` from their service packages (lines 86, 108, 130).
- `backend/scripts/test_claude_batch_and_market_research.py:32` imports `get_company_profile_for_org` from `market_scoring`.

All four symbols are public and covered by the §3 enumerations, so the re-exports will be in place. But if a future refactor accidentally removes one of these from the `__init__.py`, the break surfaces only when someone runs the script manually. Mitigation: after the phase completes, run `python tests/capture_fixtures.py --dry-run` (or a one-line import smoke) as a post-phase verification.

### 5.4 `data_sources/` rename ripple

Multiple files renamed in one commit (router + v2 router + 3 test files + main.py reference). Anything missing the rename breaks imports. The most easily-missed sites are the two `app/main.py` router-include lines that use the `from app.routers import documents` form (lines 141, 145) — a regex tuned to dotted paths like `app.routers.documents` will not match these.

Mitigation: before the rename commit, run a broad grep and classify hits manually:

```bash
grep -rn "documents" backend/app/main.py backend/app/routers/ backend/app/services/customer_profile.py backend/tests/
```

Expected hit categories:
- `app/main.py:141,145` — router import lines (must rename).
- `app/routers/documents.py`, `app/routers/v2/documents.py` — router files (renamed).
- `app/routers/documents.py:25`, `app/routers/v2/documents.py:8` — `tags=["documents"]` / `tags=["v2", "documents"]` (rename per §2.1 item 2).
- `tests/test_documents.py`, `tests/test_documents_v2.py`, `tests/unit/test_documents.py` — test files (renamed).
- Any `mocker.patch("app.services.documents.X")` strings inside test bodies.

Verify the Mongo collection name (it's `user_documents`, not `documents` — the rename does not touch any database identifiers). Run full suite after; broken imports fail loud.

### 5.5 `market_scoring/` background-task callable reference

`routers/market_scoring.py` invokes the background task via `BackgroundTasks.add_task(_run_market_scoring_for_org, ...)`. After extraction, the function lives in `services/market_scoring/scoring.py`. The router's existing import `from app.services.market_scoring import _run_market_scoring_for_org` must keep resolving — which means re-exporting the symbol from `__init__.py` per §3.7. Same convention applies to `_ensure_market_scoring_indexes` and `_ensure_icp_indexes` (both called from lifespan).

### 5.6 Phase F dependency injection assumption

Phase F migrated services to receive `driver`, `mongo`, `pc`, `agent_chain` as explicit parameters from routers via `Depends()`. This phase assumes that DI is in place and intact. **Pre-flight check:** run `grep -rEn "^(client|mongo|driver|pc|agent_chain)\s*=" backend/app/services/` — expect zero matches. Any match indicates a service still reaching into module globals; surface and fix before starting Phase H.

---

## 6. Acceptance Criteria

- All five services exist under `services/<domain>/` packages (one of which is `data_sources/`).
- Every existing import path `from app.services.<domain> import <symbol>` still resolves to the same callable.
- HTTP routes, route paths, response models, query/body params: byte-for-byte unchanged.
- `pytest -q` passes at every commit on the phase branch.
- Test count holds at ≥236 throughout the phase. No test removed unless the commit message explicitly justifies it.
- TD-006 is closed in `docs/TECH_DEBT.md` after the `market_scoring/` extraction.
- No new files in `services/` root other than the four existing shared helpers (`_llm_helpers.py`, `_retrieval.py`, `_neo4j_helpers.py`, `_claude_budget.py`).
- Each `__init__.py` contains only `from ... import` statements, an `__all__` list, and optionally a docstring — no executable logic. No `_`-prefixed symbol appears in `__all__` outside the §3.7 exception list.

---

## 7. What's Set Up for Future Phases

**Option D — Prompt extraction & versioning.** After Phase H, every prompt lives in a per-domain `prompts.py`. D becomes: move those files to `prompts/<domain>/<name>.md` (or `.yaml`), add a registry that loads them at module-import time, add version pinning, and reduce hardcoded regional examples. Much smaller than D-without-H would have been.

**Security hardening (JWT / Cypher injection / CORS).** JWT verification becomes a FastAPI dependency that plugs into routers, untouched by this phase. The Cypher injection sites (`graph_chat/persistence.py` after potential future restructuring of graph_chat — out of scope this phase) become a focused 1-2 file fix.

**v1 route deletion.** Future phase. The `data_sources/` rename happens now so future v1-deletion doesn't have to fight with stale "documents" naming.

**Background-task durability.** Now that `market_scoring/scoring.py` isolates the background-task body, a future swap to a real queue (RQ/Celery/poll-based) is easier to scope and review.
