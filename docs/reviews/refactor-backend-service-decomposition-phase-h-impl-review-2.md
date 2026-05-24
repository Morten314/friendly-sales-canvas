---
artifact: refactor-backend-service-decomposition-phase-h
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-24
round: 2
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Review 1 (round 1) was a synthesis of earlier subagent reviews. This round is a full human-in-the-loop review of the aggregate diff against the spec and plan.

## Findings

### [Medium] `data_sources/__init__.py` re-exports 3 internal symbols not in spec §3.5 or §3.7

**Location:** `backend/app/services/data_sources/__init__.py`

The spec §3.5 defines exactly 8 public symbols for `data_sources/`. The implementation re-exports 3 additional internal helpers — `load_document`, `grapher`, `process_prospect_list` — that are not public and not in the §3.7 exception table. The docstring says these are "a §3.7-style exception — re-exported so unit-test direct-import statements work through `__init__.py`."

The plan (Task 7 Step 5) explicitly shows the `__init__.py` with only the 8 public symbols, no extras. The tests in `tests/unit/test_data_sources.py` do `from app.services.data_sources import load_document, grapher, process_prospect_list` — they could just as well import from the submodule (`from app.services.data_sources.loaders import ...`). The re-export inflates the public surface unnecessarily and violates spec §6: "No `_`-prefixed symbol appears in `__all__` outside the §3.7 exception list" — while these symbols lack the `_` prefix, they also weren't in the spec-defined public surface.

### [Medium] `market_scoring/__init__.py` re-exports 2 symbols not in spec §3.6 public surface or §3.7 exception list

**Location:** `backend/app/services/market_scoring/__init__.py`

The spec §3.6 lists 4 public symbols + 3 `_-`prefix exceptions. The implementation adds `get_market_reports_for_org` and `score_single_lead_against_market` to the re-exports (and `__all__`). Neither is imported by external code outside the package — `scoring.py` accesses them via a lazy `from app.services.market_scoring import orchestrator` import at call time. No external caller imports them from the package path. The spec §3.1 says re-exports are for "public functions" and the §3.7 exception list is exhaustive. These two are internal orchestrator helpers that don't meet either bar.

### [Low] Lazy circular import in `market_scoring/scoring.py` → orchestrator

**Location:** `backend/app/services/market_scoring/scoring.py:54` (`from app.services.market_scoring import orchestrator`)

`_run_market_scoring_for_org` uses a function-body lazy import of the orchestrator submodule to break a cycle: orchestrator imports scoring (for `_run_market_scoring_for_org`), and scoring needs orchestrator's `score_single_lead_against_market`, `get_market_reports_for_org`, and `_persist_market_score_for_lead`. The lazy import avoids the cycle but means:

1. The actual dependency isn't visible at module load time — static analysis tools and IDEs won't flag it.
2. If anyone adds a top-level import from orchestrator in scoring.py, it breaks at import time with a circular import error.

The docstring documents this, which is good. A cleaner approach (moving the three shared helpers into a shared submodule or into persistence) would eliminate the cycle entirely but is outside Phase H's structural scope.

### [Low] Duplicated JSON-parsing pattern across `signals/parsing.py`, `icp/parsing.py`, `market_research/parsing.py`

**Location:** `backend/app/services/signals/parsing.py`, `backend/app/services/icp/parsing.py`, `backend/app/services/market_research/parsing.py`

All three files implement near-identical patterns: strip code fences, escape newlines inside specific string fields, then `json.loads`. The spec §2.2 explicitly excluded consolidating these into a shared helper as out of scope ("Consolidating the three `_*_agent_output` helpers... into a single `_llm_helpers.py` function"). The duplication is expected per spec, but each instance is ~30-80 LOC of nearly identical regex-based cleanup. A future pass could extract a shared `_strip_and_parse_json(raw, escape_keys=())` into `_llm_helpers.py`.

### [Low] `ICP_FUNCTIONS` / `COMPONENT_FUNCTIONS` dispatch dicts remain in orchestrator, not prompts

**Location:** `backend/app/services/icp/orchestrator.py:221-228`, `backend/app/services/market_research/orchestrator.py:185-193`

The `ICP_FUNCTIONS` / `ICP_FUNCTIONS_CLAUDE` and `COMPONENT_FUNCTIONS` / `COMPONENT_FUNCTIONS_CLAUDE` dispatch dictionaries map component names to worker functions. They live in `orchestrator.py` because they reference the worker functions by name — that's the correct home. However, they're patched by string in tests (`mocker.patch("app.services.icp.orchestrator.ICP_FUNCTIONS", ...)`). This means the patch paths are correct (they target the module where the dict is defined), but the dicts are module-level mutable state that tests mutate. No issue right now, but a future refactor that moves these dicts would need to update ~10 test patch paths.

### [Nit] `data_sources/` model imports still reference `app.models.documents`

**Location:** `backend/app/routers/data_sources.py:18-24`, `backend/app/services/data_sources/persistence.py`

The router imports from `app.models.documents` (not renamed to `app.models.data_sources`). The spec only specified renaming `services/documents.py` → `services/data_sources/`, routers, and tests — not models. The model module name `documents` is still accurate in the Pydantic/data-model sense (a "document" upload), so this isn't wrong, just a naming inconsistency that a reader might notice. No action needed.

### [Nit] TD-006 closure note says "2026-05-24" in TECH_DEBT.md but spec says "2026-05-23"

**Location:** `docs/TECH_DEBT.md:5`

The closure note reads "TD-006 ... was resolved 2026-05-24 by Phase H Task 4." The spec (§2.1 item 3) was written on 2026-05-23 but execution happened on 2026-05-24. The date is correct for execution time, not spec-writing time — this is fine.

### [Nit] `signals/orchestrator.py` at 744 LOC — close to the original file's 1297 LOC

**Location:** `backend/app/services/signals/orchestrator.py`

Despite extracting prompts (328 LOC), llm (51 LOC), parsing (104 LOC), and persistence (181 LOC), the orchestrator still weighs 744 LOC. This is because `search_signals`, `signal_ask`, `signal_ask_claude`, `_generate_signals_batch_impl`, and `fetch_signals` are all large functions with inline data-munging logic. The spec §3.2 estimated ~350 LOC for orchestrator. The actual is 2x the estimate. The extraction surface was accurate per spec, but the residual was underestimated. Not a bug — the spec noted the estimate was approximate and "~400 LOC per submodule ceiling was dropped from §6."
