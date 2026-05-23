# Backend Service Decomposition Phase H — Per-Domain Packages Split By Concern

**Date:** 2026-05-23
**Status:** Approved for plan-writing (pending user spec review)
**Branch (planned):** `refactor-backend-service-decomposition-phase-h` off `master`
**Predecessors:** Phase A (`/specs/2026-05-12-backend-modularization-design.md`), Phase B (`/specs/2026-05-21-backend-modularization-phase-b-design.md`), Phase C (`/specs/2026-05-22-backend-modularization-phase-c-design.md`), Phase D (`/specs/2026-05-22-backend-modularization-phase-d-design.md`), Phase E (`/specs/2026-05-22-backend-test-improvements-phase-e-design.md`), Phase F (`/specs/2026-05-22-backend-modularization-phase-f-design.md`), Phase G (`/specs/2026-05-23-backend-pagination-and-index-hygiene-phase-g-design.md`)

**Note on phase naming.** TD-005 and the Phase G spec earlier reserved "Phase H" for v1-route deletion. That work is reassigned to a later phase (TBD). This Phase H is service decomposition. Future phase letters renumber accordingly — v1 deletion becomes Phase I or later.

---

## 1. Summary

Phase H converts the five remaining large service files into per-domain packages split by concern. `signals.py` (1297 LOC), `icp.py` (1145 LOC), `market_research.py` (1016 LOC), `documents.py` (930 LOC), and `market_scoring.py` (854 LOC) each become a `services/<domain>/` package with focused submodules — typically `prompts.py`, `llm.py`, `parsing.py`, `persistence.py`, and `orchestrator.py`, with `__init__.py` re-exporting the public API to preserve every existing import path.

The `documents.py` package is renamed to `data_sources/` to disambiguate from project documentation. Routers, test files, and the public-API symbol surface get the same rename. HTTP route paths (`/user-documents`, `/document/*`, `/delete-data-source`) are **unchanged** — they're FE contracts.

This is a pure structural move: zero changes to behavior, signatures, response shapes, route paths, or test assertions. After this phase no service file exceeds ~400 LOC, prompts are isolated to their own modules (paving the way for Option D — prompt externalization), and the codebase has clean seams for future work on JWT/CORS/Cypher hardening.

Free side-effect: closes TD-006 (`market_scoring.py` callers recomputing `len(leads)` instead of using returned `total`) as a two-character fix folded into the `market_scoring/` extraction commit.

Test count stays at ~240 (the Phase G end-state). No new tests this phase; current tests cover the public surface and migrate transparently via `__init__.py` re-exports.

---

## 2. Scope

### 2.1 In scope

1. **Five service-file decompositions** into `services/<domain>/` packages. Per-service module set varies — LLM-driven services use the full `prompts/llm/parsing/persistence/orchestrator` set; persistence-driven services use a tailored set (see §3).

2. **`documents/` → `data_sources/` rename.** Ripples to:
   - `services/documents.py` → `services/data_sources/` (package).
   - `routers/documents.py` → `routers/data_sources.py`.
   - `routers/v2/documents.py` → `routers/v2/data_sources.py`.
   - `tests/test_documents.py` → `tests/test_data_sources.py`.
   - `tests/test_documents_v2.py` → `tests/test_data_sources_v2.py`.
   - `tests/unit/test_documents.py` → `tests/unit/test_data_sources.py`.
   - `app/main.py` router-include line + any `tags=["documents"]` attribute.

3. **TD-006 close-out.** Two callsites in `market_scoring` orchestrator change from `leads, _ = get_leads_for_org(...); total_leads = len(leads)` to `leads, total_leads = get_leads_for_org(...)`. Folded into the `market_scoring/` orchestrator-extraction commit (no separate commit).

4. **`__init__.py` re-exports.** Every public symbol that was importable from `app.services.<domain>` before this phase is importable from the same path after. Internal-only helpers (prefixed with `_`) are not re-exported.

5. **Shared cross-domain helpers stay flat.** `_llm_helpers.py`, `_retrieval.py`, `_neo4j_helpers.py`, `_claude_budget.py` keep their current location at `services/` root. They serve multiple domains and don't belong inside any single package.

### 2.2 Out of scope

- **Lifting prompts out of Python.** Prompts move into `prompts.py` modules but stay as inline `f"""..."""` and `template.format(...)` strings. Externalization to `.md`/`.yaml` and prompt versioning is Option D, deferred to the next phase.
- **Reducing hardcoded regional examples** (`ANALYSIS_MARKET_ICP_RESEARCH_ISSUES.md`). Content change — deferred to Option D.
- **v1 route deletion / FE migration to v2** (TD-005). Cross-stack work — deferred.
- **Security hardening** (JWT validation, Cypher injection, CORS) — deferred to a dedicated phase.
- **Background-task durability** — deferred.
- **TD-004 (real captured fixtures), TD-007 (cosmetic cruft)** — deferred to separate close-out work.
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
  orchestrator.py   # public workflow functions
```

**Dependency direction.** `orchestrator` is the root that composes everything; all other submodules are leaves. The only leaf-to-leaf dependency permitted is `llm → prompts` (since `llm.py` invokes models with templates owned by `prompts.py`). `parsing.py` and `persistence.py` import nothing from siblings. No cycles. If a parser needs prompt-specific knowledge, colocate (keep them in one module); other cross-imports between siblings are a smell.

**`__init__.py` content.** Re-exports only — no logic. Example:

```python
# services/signals/__init__.py
from app.services.signals.orchestrator import (
    search_signals,
    run_signals_research,
    generate_signals_batch,
    signal_ask,
    fetch_signals,
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

### 3.2 `signals/` — full layout

Source: `services/signals.py` (1297 LOC).

| Submodule | Contains | Approx LOC |
|---|---|---|
| `prompts.py` | Inline `MAIN_PROMPT_TEMPLATE` + persona prompt blocks (current lines ~75-313) | ~250 |
| `llm.py` | `_signals_agent_output` | ~35 |
| `parsing.py` | Response normalization + signal extraction (extracted from inside `search_signals` / `_generate_signals_batch_impl`) | ~150 |
| `persistence.py` | `record_signal_action` Mongo write + signal CRUD reads called from `fetch_signals` | ~120 |
| `orchestrator.py` | `search_signals`, `run_signals_research`, `_generate_signals_batch_impl`, `generate_signals_batch`, `generate_signals_batch_claude`, `fetch_signals`, `signal_ask`, `signal_ask_claude` | ~350 |
| `__init__.py` | Re-exports | ~25 |

### 3.3 `icp/` — full layout

Source: `services/icp.py` (1145 LOC).

| Submodule | Contains | Approx LOC |
|---|---|---|
| `prompts.py` | Prompt templates from `ICP_generator` + `icp_research_1..4` | ~280 |
| `llm.py` | `_icp_research_agent_output` | ~20 |
| `parsing.py` | JSON extraction + ICP shape normalization | ~80 |
| `persistence.py` | `list_icps`, `delete_recommended_icp`, `_ensure_icp_indexes`, `_reserve_unique_icp_id`, `_release_icp_id` | ~280 |
| `orchestrator.py` | `ICP_generator`, `icp_research_1..4`, `_run_icp_research_impl`, `run_icp_research` | ~280 |
| `__init__.py` | Re-exports | ~25 |

### 3.4 `market_research/` — full layout

Source: `services/market_research.py` (1016 LOC).

| Submodule | Contains | Approx LOC |
|---|---|---|
| `prompts.py` | Five prompt templates extracted from `Research_Market_1..5` | ~400 |
| `llm.py` | `_market_research_agent_output` | ~20 |
| `parsing.py` | JSON extraction shared across the five `Research_Market_N` workers | ~80 |
| `persistence.py` | Mongo writes for the market-research report assembled inside `run_market_research` | ~80 |
| `orchestrator.py` | `Research_Market_1..5`, `run_market_research` | ~280 |
| `__init__.py` | Re-exports | ~25 |

### 3.5 `data_sources/` — deviates (no LLM)

Source: `services/documents.py` (930 LOC), renamed.

| Submodule | Contains | Approx LOC |
|---|---|---|
| `loaders.py` | `load_document`, `grapher`, `process_prospect_list`, `upload_file_text`, `upload_prospect_list_file` | ~150 |
| `pipeline.py` | `process_file_to_embeddings`, `upload_document_file` (the S3+Pinecone+Mongo coordinated upload) | ~400 |
| `persistence.py` | `list_user_documents`, `get_document_status`, `delete_data_source`, `update_data_source` | ~280 |
| `__init__.py` | Re-exports | ~25 |

No `prompts.py`/`llm.py`/`parsing.py` — this service doesn't drive LLMs.

### 3.6 `market_scoring/` — deviates (data-transformation heavy)

Source: `services/market_scoring.py` (854 LOC).

| Submodule | Contains | Approx LOC |
|---|---|---|
| `normalization.py` | `_safe_json_to_obj`, `_normalize_non_empty_string`, `_canonicalize_key`, `_build_lookup_maps`, `_first_non_empty_value_from_keys`, `_extract_company_name`, `_extract_lead_name`, `_extract_description_preview`, `_parse_iso_datetime` | ~200 |
| `persistence.py` | `_get_market_score_collections`, `_get_latest_market_score_rows`, `_get_latest_scoring_run`, `_get_lead_identity_from_neo4j`, `get_company_profile_for_org`, `_ensure_market_scoring_indexes` | ~250 |
| `scoring.py` | `_lead_to_score_row`, `_is_stale_queued_run`, the background scoring task body | ~180 |
| `orchestrator.py` | `trigger_or_get_market_scores`, `get_market_scores_status`, `get_lead_market_score_descriptions` (with TD-006 two-char fix applied) | ~200 |
| `__init__.py` | Re-exports | ~25 |

No `prompts.py`/`llm.py`/`parsing.py` — no LLM in this service.

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

```
1. scaffold <domain>/ package skeleton — empty submodule files + __init__.py with placeholder re-exports against the to-be-extracted symbols
2. extract persistence.py — lowest coupling, no caller signature changes
3. extract prompts.py — LLM-driven services only; pure data, no behavior
4. extract llm.py + parsing.py — LLM-driven services only
5. extract orchestrator.py and DELETE the original <domain>.py file
   - For data_sources/: rename router + test files + main.py inclusion in same commit
   - For market_scoring/: fold in TD-006 two-char fix in same commit
```

Each commit message follows the convention used in Phase G: `refactor(be): extract <domain>/persistence.py [phase H, commit N/M]`. The `[phase H, commit N/M]` tail makes review-trace easy.

### 4.3 Per-commit verification

`cd backend && BREWRA_SKIP_DB_INIT=1 python -m pytest -q` from each commit's checkout. Full suite (~240 tests, ~8s). The cost is trivial; full coverage at every commit gives confidence the structural move hasn't broken any caller.

Commit is rejected if test count drops or any test fails. Test count must stay ≥ Phase G baseline (~240).

### 4.4 `__init__.py` evolution

The Step 1 scaffold creates `__init__.py` with imports that **will** resolve once the corresponding extraction commits land. To keep every intermediate commit green:

- Step 1: `__init__.py` re-exports nothing (empty `__all__`), and the original `<domain>.py` stays intact alongside the new package. Tests still import from `app.services.<domain>` which resolves to the package's `__init__.py`, which is empty, which falls through to... wait, this creates an ambiguity.

**Resolution:** Python doesn't allow both `services/signals.py` and `services/signals/` to coexist. The Step 1 scaffold must therefore use a temporary directory name (`services/signals_pkg/`) or do the rename in a single commit. The simpler convention: Step 1 = "create skeleton **and** delete original" as one commit, with all symbols still defined inside `<domain>/orchestrator.py` initially and moved out submodule-by-submodule in subsequent commits.

Updated per-service commit template:

```
1. scaffold <domain>/ package and move ALL code from <domain>.py into <domain>/orchestrator.py;
   delete <domain>.py; __init__.py re-exports the public API. Tests must pass.
2. extract persistence.py from orchestrator.py
3. extract prompts.py from orchestrator.py (LLM-driven only)
4. extract llm.py + parsing.py from orchestrator.py (LLM-driven only)
5. (no-op for most; data_sources adds the router/test rename;
    market_scoring adds TD-006 fix; signals adds final cleanup)
```

This is **5-6 commits per service × 5 services = 25-30 commits total**, in the Phase A range.

---

## 5. Risks

### 5.1 Hidden interdependencies between submodules

A parser function may depend on prompt-specific knowledge of LLM output structure; a persistence helper may have implicit ordering assumptions tied to scoring logic. Mitigation: extract `persistence.py` first (lowest coupling, surfaces fewest surprises), discover prompt↔parser ties only when extracting `parsing.py`. **If two pieces are too coupled to separate cleanly, colocate them rather than forcing a split.** The package convention adapts to the code, not the other way around.

### 5.2 Circular imports

The dependency tree (orchestrator is the root; leaves are prompts/llm/parsing/persistence; the only leaf-to-leaf edge permitted is `llm → prompts`) means no cycles are possible if discipline holds. Risk surfaces only if a submodule reaches sideways. Mitigation: code review check, plus the test suite will fail with `ImportError` immediately on a bad import order.

### 5.3 `__init__.py` re-export drift

Adding a symbol to a submodule but forgetting to re-export it in `__init__.py` produces an `ImportError` at the caller. Mitigation: every commit's diff explicitly lists which symbols re-exported; full test suite runs per commit and imports the public API the same way callers do — broken re-exports fail tests immediately.

### 5.4 `data_sources/` rename ripple

Multiple files renamed in one commit (router + v2 router + 3 test files + main.py reference). Anything missing the rename breaks imports. Mitigation: before the rename commit, run `grep -rn "from app.services.documents\|app.routers.documents\|app.routers.v2.documents\|test_documents" backend/` and confirm the diff matches the expected set. Run full suite after; broken imports fail loud.

### 5.5 `market_scoring/` background-task callable reference

`routers/market_scoring.py` invokes the background task via `BackgroundTasks.add_task(_run_market_scoring_for_org, ...)`. After extraction, the function lives in `services/market_scoring/scoring.py`. The router-side import path changes from `from app.services.market_scoring import _run_market_scoring_for_org` to either the same (via re-export) or `from app.services.market_scoring.scoring import _run_market_scoring_for_org`. Mitigation: re-export underscored helpers used by routers from `__init__.py` even though `_`-prefixed names are normally internal. This is a known exception.

### 5.6 TD-005 / TD-007 collision with `market_scoring/` orchestrator extraction

TD-005 (v1 count semantics in `documents.py` + `signals.py` v1 routers) and TD-007 (cosmetic cruft) sit in files this phase touches. **Out of scope** for this phase — touching them widens the diff. The phase H closeout note in the merge commit will mention they're still open.

### 5.7 Phase F dependency injection assumption

Phase F migrated services to receive `driver`, `mongo`, `pc`, `agent_chain` as explicit parameters from routers via `Depends()`. This phase assumes that DI is in place and intact. Mitigation: pre-flight check — confirm `app.dependency_overrides` is still the test pattern, no service function reaches into module globals for clients. (Phase F's "Remove module globals" commit `5cc6aa3` was the final cleanup; the assumption is sound.)

---

## 6. Acceptance Criteria

- All five services exist under `services/<domain>/` packages (one of which is `data_sources/`).
- No service submodule exceeds ~400 LOC; most are ~100-300 LOC.
- Every existing import path `from app.services.<domain> import <symbol>` still resolves to the same callable.
- HTTP routes, route paths, response models, query/body params: byte-for-byte unchanged.
- `pytest -q` passes at every commit on the phase branch.
- Test count at the end of the phase is ≥ Phase G end-state baseline (~240).
- TD-006 is closed in `docs/TECH_DEBT.md` after the `market_scoring/` extraction.
- No new files in `services/` root other than the four existing shared helpers (`_llm_helpers.py`, `_retrieval.py`, `_neo4j_helpers.py`, `_claude_budget.py`).
- A code-review pass (separate commit) confirms each `__init__.py` re-exports exactly the public surface and nothing more.

---

## 7. What's Set Up for Future Phases

**Option D — Prompt extraction & versioning.** After Phase H, every prompt lives in a per-domain `prompts.py`. D becomes: move those files to `prompts/<domain>/<name>.md` (or `.yaml`), add a registry that loads them at module-import time, add version pinning, and reduce hardcoded regional examples. Much smaller than D-without-H would have been.

**Security hardening (JWT / Cypher injection / CORS).** JWT verification becomes a FastAPI dependency that plugs into routers, untouched by this phase. The Cypher injection sites (`graph_chat/persistence.py` after potential future restructuring of graph_chat — out of scope this phase) become a focused 1-2 file fix.

**v1 route deletion.** Future phase. The `data_sources/` rename happens now so future v1-deletion doesn't have to fight with stale "documents" naming.

**Background-task durability.** Now that `market_scoring/scoring.py` isolates the background task, swapping `BackgroundTasks` for a real queue (RQ/Celery/poll-based) becomes a one-file change.
