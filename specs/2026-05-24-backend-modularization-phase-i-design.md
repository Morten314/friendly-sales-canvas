# Backend Modularization Phase I — Phase H Deferrals: Shared LLM Helpers, Signals Decomposition, Cleanup

**Date:** 2026-05-24
**Status:** Draft — awaiting spec review
**Branch (planned):** `refactor-backend-modularization-phase-i` off `master` (after Phase H merges)
**Predecessors:** Phase H (`/specs/2026-05-23-backend-service-decomposition-phase-h-design.md`) and prior phases A-G.

---

## 1. Summary

Phase I closes three deferred items from Phase H:

- **Item A** — Consolidates three near-duplicate `_*_agent_output` helpers (signals/icp/market_research LLM dispatch) and three near-duplicate JSON-parsing helpers into shared `_llm_helpers.py` functions. Spec §2.2 of Phase H explicitly excluded this; Phase H's review-2 synthesis re-flagged it as a Low finding worth a future pass. ~250 LOC of cross-service duplication killed.
- **Item C** — Decomposes `signals/orchestrator.py` (744 LOC, 8 functions) into focused submodules `search.py`, `batch.py`, `ask.py`, plus `fetch_signals` moving into `persistence.py`. `signals/orchestrator.py` is deleted — same pattern as `data_sources/` reached at Phase H commit 7/20. Closes Phase H's "orchestrator at 2× spec-estimate LOC" finding.
- **Item D** — Renames `app.models.documents` → `app.models.data_sources` (catches up the model layer to Phase H's service rename), hoists `_URL_PATTERN` constant into `_llm_helpers.py`, closes TD-007 cosmetic cruft (4 one-line fixes).

This is a structural move: zero changes to behavior, signatures, response shapes, or route paths. Existing 236 behavior tests stay green and unchanged in assertions; snapshot count holds at 19. Commit 1 adds a small parameterized test module for the two new shared helpers (~6-10 new tests; total settles around 242-246). Test patch-path strings update in step with each structural move per the Phase H discipline (see `feedback_phase_h_module_import_pattern.md`).

**Explicitly out of scope:** Item B (lazy circular imports in icp/persistence + market_scoring/scoring). Tracked for Phase J. Phase I will not surface those cycles naturally — they live in different packages.

---

## 2. Scope

### 2.1 In scope

1. **Two shared helpers added to `_llm_helpers.py`:**
   - `_research_agent_output(agent_chain, prompt, seed_text, llm_backend, search_query_template, extract_intermediate_urls=False) -> tuple[str, list[str]]` — unifies the Groq-vs-Claude dispatch pattern used by all three research services. The `search_query_template` must contain a literal `{seed}` placeholder; the helper substitutes it via `str.format(seed=...)` with the first 1200 chars of whitespace-normalized `seed_text`.
   - `_extract_research_json(response, escape_keys=("description",), trim_braces=False, strip_final_answer=False) -> dict` — promoted from `icp/parsing.py::_extract_icp_json` (already generic-shaped).

2. **Per-service wrappers preserved** (~6-15 LOC each) for the three services. The wrappers hardcode service-specific configuration (search query template, escape keys, URL extraction). They keep `mocker.patch("app.services.<svc>.llm._<svc>_agent_output")` strings working — the §3.7 Phase H "patch where it's used" discipline applies.

3. **`signals/` decomposition.** New submodules:
   - `signals/search.py` — `search_signals` + `run_signals_research` (~255 LOC).
   - `signals/batch.py` — `generate_signals_batch` + `generate_signals_batch_claude` + `_generate_signals_batch_impl` (~190 LOC).
   - `signals/ask.py` — `signal_ask` + `signal_ask_claude` (~240 LOC).
   - `signals/persistence.py` — `fetch_signals` added (~10 LOC delta).
   - `signals/orchestrator.py` — deleted.
   - `signals/__init__.py` — re-export paths updated; public surface unchanged (8 symbols).

4. **Cross-submodule import** (`batch.py` → `search.py`) uses the module-import + namespace-prefix pattern: `from app.services.signals import search; search.search_signals(...)`. This makes `mocker.patch("app.services.signals.search.search_signals")` intercept batch's callers — same trick Phase H Task 2 used for market_scoring.

5. **Model rename.** `git mv backend/app/models/documents.py backend/app/models/data_sources.py` + 2 import-site updates (`routers/data_sources.py:16`, `routers/v2/data_sources.py:5`). Class names inside the module are unchanged (already `DataSource*`-prefixed for 4 of 5; `DocumentStatusResponse` and `MessageResponse` are accurate as-is).

6. **URL regex consolidation.** Add `_URL_PATTERN` constant to `_llm_helpers.py`; replace 2 inline literals there (one in `_tavily_context_and_urls` line 28, one in the new `_research_agent_output`); delete the now-orphaned `_URL_PATTERN` from `signals/llm.py` (it becomes unused after I-A commit 2).

7. **TD-007 closure** (4 one-line cleanups documented in `docs/TECH_DEBT.md`):
   - `backend/tests/test_icp_v2.py:7` — unused `fake_result` dead var.
   - `backend/tests/unit/test_market_scoring.py` — unused `monkeypatch` parameter on `test_get_latest_market_score_rows_returns_items_and_total`.
   - `backend/app/routers/v2/org_auth.py:1` — unused `from typing import List`.
   - `backend/tests/unit/test_customer_profile.py` — 9 dead `mocker.patch("app.services.icp._ensure_icp_indexes")` calls.

8. **Tech-debt register update.** Mark TD-007 resolved (preserve numbering convention).

### 2.2 Out of scope

- **Item B** — lazy circular imports (`icp/persistence:40` → `orchestrator.ICP_generator`; `market_scoring/scoring:62` → `orchestrator`). Structural fix requires moving multi-function code across submodules and is deferred to Phase J. Phase I will not naturally surface these (different packages).
- **Decomposing remaining flat services** — `leads.py` (465), `customer_profile.py` (388), `profiles.py` (236), `graph_chat.py` (209), `org_auth.py` (210), `pipeline.py`. Phase J candidate.
- **TD-004** — capturing real LLM fixtures requires API keys; not a structural task.
- **TD-005** — v1 `count` semantics; blocked on FE v2 migration.
- **Public API changes** — no signature changes, no response-shape changes, no route-path changes, no class renames in `models/data_sources.py`.
- **New test coverage beyond what verifies the refactor.** I-A commit 1 adds a single test module for the two new helpers (parameterized over the per-service configurations); no broader test expansion.

### 2.3 HTTP surface stability

No route paths change. No request/response shapes change. No OpenAPI tags change (Phase H already moved data_sources tags; model rename is internal Python only).

---

## 3. Architecture

### 3.1 Shared helpers layer

`backend/app/services/_llm_helpers.py` grows from 72 LOC to ~250 LOC. Becomes the single home for:

- **Primitives (existing):** `_tavily_context_and_urls`, `_claude_messages_text`, `CLAUDE_RESEARCH_MAX_TOKENS`.
- **Patterns (new):** `_research_agent_output`, `_extract_research_json`, `_URL_PATTERN`.

Module docstring updated to reflect both layers: "Cross-domain LLM helpers — primitives (Tavily, Claude messaging) and shared patterns (research dispatch, JSON parsing) used by 2+ services."

### 3.2 Per-service wrapper shape (I-A)

Each service's `llm.py` and `parsing.py` retains thin wrappers:

```python
# signals/llm.py — post-Phase-I, ~15 LOC total
from app.services._llm_helpers import _research_agent_output

def _signals_agent_output(agent_chain, prompt, company_profile_seed, llm_backend):
    return _research_agent_output(
        agent_chain, prompt, company_profile_seed, llm_backend,
        search_query_template="B2B market competitor industry news ICP customer trends 2026 {seed}",
        extract_intermediate_urls=True,
    )
```

```python
# icp/llm.py — post-Phase-I, ~12 LOC total
from app.services._llm_helpers import _research_agent_output

def _icp_research_agent_output(agent_chain, prompt, pre_data, llm_backend):
    text, _ = _research_agent_output(
        agent_chain, prompt, pre_data, llm_backend,
        search_query_template="ICP buyer persona pain points buying triggers competitors compliance 2026 {seed}",
    )
    return text
```

```python
# market_research/llm.py — post-Phase-I, ~12 LOC total
from app.services._llm_helpers import _research_agent_output

def _market_research_agent_output(agent_chain, prompt, company_profile_json, llm_backend):
    text, _ = _research_agent_output(
        agent_chain, prompt, company_profile_json, llm_backend,
        search_query_template="market research industry trends data 2026 {seed}",
    )
    return text
```

`icp/parsing.py::_extract_icp_json` becomes a 1-line alias (`_extract_icp_json = _extract_research_json`) — preserves the existing in-package callsites (8 grep hits across icp/ orchestrator and parsing) without a cross-cutting sweep. `signals/parsing.py::_parse_search_signals_response` and `market_research/parsing.py::_extract_research_json` become thin adapters that call the shared helper with service-specific kwargs.

`signals/parsing.py::_validate_url` stays in signals/ — it's signals-specific (validates URLs against a tavily_urls allowlist).

### 3.3 signals/ structure (post-Phase-I)

```
backend/app/services/signals/
├── __init__.py          # re-exports 8 public symbols
├── prompts.py           # (unchanged from Phase H, 328 LOC)
├── llm.py               # _signals_agent_output adapter (~15 LOC)
├── parsing.py           # _parse_search_signals_response adapter + _validate_url (~50 LOC)
├── persistence.py       # all Mongo helpers + fetch_signals (~191 LOC)
├── search.py            # search_signals + run_signals_research (~255 LOC)   NEW
├── batch.py             # generate_signals_batch + _claude + _impl (~190 LOC) NEW
└── ask.py               # signal_ask + signal_ask_claude (~240 LOC)           NEW
```

`orchestrator.py` is deleted — there's no multi-step cross-submodule composition that needs an orchestrator tier. Same conclusion data_sources/ reached at Phase H commit 7/20.

### 3.4 Module dependency graph (signals/)

```
search.py    ──▶  llm, parsing, persistence, prompts
batch.py     ──▶  search, llm, parsing, persistence, prompts
ask.py       ──▶  llm, parsing, persistence, prompts
persistence, llm, parsing, prompts — leaves (no intra-signals imports)
```

One cross-submodule import (`batch.py` → `search.py`). Resolved via module-import pattern, not from-import:

```python
# batch.py top
from app.services.signals import search

# inside _generate_signals_batch_impl
signals_result = await asyncio.to_thread(search.search_signals, agent_chain, pre_data, "scout", llm_backend)
```

### 3.5 Public surface (signals/__init__.py)

8 symbols, unchanged in name and signature:

```python
from app.services.signals.search import search_signals, run_signals_research
from app.services.signals.batch import generate_signals_batch, generate_signals_batch_claude
from app.services.signals.ask import signal_ask, signal_ask_claude
from app.services.signals.persistence import fetch_signals, record_signal_action

__all__ = [
    "search_signals", "run_signals_research",
    "generate_signals_batch", "generate_signals_batch_claude",
    "signal_ask", "signal_ask_claude",
    "fetch_signals", "record_signal_action",
]
```

Docstring rewritten post-commit-8 to describe final form (no intermediate-state docstrings shipped).

### 3.6 Module rename (D-1)

`backend/app/models/documents.py` → `backend/app/models/data_sources.py`. `git mv` preserves blame. The module's 5 Pydantic classes (`DataSourceDeleteResponse`, `DataSourceUpdateResponse`, `DocumentStatusResponse`, `ListUserDocumentsResponse`, `MessageResponse`, plus `UserDocumentEntry` referenced by v2 router) stay named as-is. Two import sites updated atomically in the same commit.

### 3.7 Patch discipline (carries over from Phase H §3.7-3.8)

When a function moves to a new module, every `mocker.patch("old.path.X")` retargets the new home in the **same commit** as the move. When a function is patched by string in tests, callers within the same package use the module-import + namespace-prefix pattern so a single patch target intercepts all callers.

Per `feedback_phase_h_module_import_pattern.md`: from-import (`from .search import search_signals`) binds a name into the caller's `__dict__`, making `mocker.patch("app.services.signals.search.search_signals")` ineffective at the caller site. Module-import (`from . import search; search.search_signals(...)`) routes through `search.__dict__` at call time and is patchable.

---

## 4. Implementation order

Single sequence, 11 commits, branch `refactor-backend-modularization-phase-i`.

### 4.1 Sub-sequence I-A (commits 1-3) — shared helpers

| # | Commit | Effect |
|---|---|---|
| 1 | `refactor(be): add _research_agent_output + _extract_research_json to _llm_helpers [phase I, 1/11]` | Add shared helpers and `_URL_PATTERN` use inside them. Add `tests/unit/test_llm_helpers.py` covering the parameterized behavior. No service-side callers wired yet. |
| 2 | `refactor(be): consolidate 3 _*_agent_output bodies to shared dispatch [phase I, 2/11]` | Rewrite 3 per-service wrappers to call `_research_agent_output`. ~150 LOC net deletion across `signals/llm.py`, `icp/llm.py`, `market_research/llm.py`. `signals/llm.py::_URL_PATTERN` becomes unused; cleaned in commit 10. |
| 3 | `refactor(be): consolidate 3 JSON-parsing bodies to shared _extract_research_json [phase I, 3/11]` | Promote `icp/parsing.py::_extract_icp_json` (alias for backward compat). Rewrite `signals/parsing.py::_parse_search_signals_response` and `market_research/parsing.py::_extract_research_json` as thin adapters. ~100 LOC net deletion. |

### 4.2 Sub-sequence I-C (commits 4-8) — signals decomposition

| # | Commit | Effect |
|---|---|---|
| 4 | `refactor(be): move fetch_signals into signals/persistence.py [phase I, 4/11]` | 10 LOC move. `__init__.py` re-export updated. Smallest commit — verifies the pattern. |
| 5 | `refactor(be): extract signals/search.py [phase I, 5/11]` | Move `search_signals` + `run_signals_research` out of orchestrator. orchestrator's other functions (still resident) switch to module-import (`from . import search; search.search_signals(...)`). `__init__.py` + test patch-path updates. |
| 6 | `refactor(be): extract signals/batch.py [phase I, 6/11]` | Move `_generate_signals_batch_impl` + 2 wrappers out. `batch.py` uses module-import for search. `__init__.py` + test patch-path updates. |
| 7 | `refactor(be): extract signals/ask.py [phase I, 7/11]` | Move `signal_ask` + `signal_ask_claude` out. No new cross-submodule deps. `__init__.py` + test patch-path updates. |
| 8 | `refactor(be): delete empty signals/orchestrator.py [phase I, 8/11]` | orchestrator.py is empty by now. Delete the file. Rewrite `__init__.py` docstring for final form. |

### 4.3 Sub-sequence I-D (commits 9-11) — cleanup

| # | Commit | Effect |
|---|---|---|
| 9 | `refactor(be): rename app.models.documents → app.models.data_sources [phase I, 9/11]` | `git mv` + 2 import-site updates. Atomic; blame preserved. |
| 10 | `refactor(be): hoist _URL_PATTERN to _llm_helpers [phase I, 10/11]` | Add `_URL_PATTERN` constant in shared module; replace 2 inline literals; delete orphaned constant in `signals/llm.py`. |
| 11 | `chore(be): close TD-007 cosmetic cruft (4 files) [phase I, 11/11]` | Four 1-line deletions. Update `docs/TECH_DEBT.md` to mark TD-007 resolved. |

---

## 5. Test strategy

### 5.1 Greenness invariant

Every commit ends with:

```bash
cd backend && BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q
# expected: 236 passed, 19 snapshots passed
```

No "fix in next commit" exceptions. Same rule as Phase H §6.

### 5.2 New test module

Commit 1 adds `backend/tests/unit/test_llm_helpers.py` covering `_research_agent_output` and `_extract_research_json` parameterized over the per-service configurations (signals tuple-with-URLs, icp/market_research text-only; signals 3-key escape + trim_braces + strip_final_answer, icp's varying escape_keys patterns, market_research's defaults). Net new test count: ~6-10 tests. Total expected: 242-246 passed after commit 1; subsequent commits hold.

### 5.3 Snapshot exposure

19 syrupy snapshots exist. Phase I commits don't change function output (only module homes and dispatch indirection), so snapshots should be byte-identical. If any snapshot drifts unexpectedly, investigate — don't `--snapshot-update` blindly.

### 5.4 Pre-flight greps per I-C commit

Before each function move in commits 4-7:

```bash
# Commit 4
grep -rn 'app\.services\.signals\.orchestrator\.fetch_signals' backend/tests/

# Commit 5
grep -rn 'app\.services\.signals\.orchestrator\.search_signals\|run_signals_research' backend/tests/

# Commit 6
grep -rn 'app\.services\.signals\.orchestrator\.generate_signals_batch\|_generate_signals_batch_impl' backend/tests/

# Commit 7
grep -rn 'app\.services\.signals\.orchestrator\.signal_ask' backend/tests/
```

Each hit is a `mocker.patch(...)` string target that needs to retarget the new submodule home in the same commit as the move.

### 5.5 Post-commit verification

After every commit (1-11):

1. `pytest -q` clean (236 + new-test-module count).
2. Public-surface smoke: `python -c "from app.services.signals import search_signals, run_signals_research, generate_signals_batch, generate_signals_batch_claude, signal_ask, signal_ask_claude, fetch_signals, record_signal_action"` returns no error.
3. After commit 8: `grep -rn "app\.services\.signals\.orchestrator" backend/` returns zero hits.

---

## 6. Risks and mitigations

| ID | Risk | Mitigation |
|---|---|---|
| R1 | Patch-string drift inside `batch.py` → `search.py` boundary. If `batch._generate_signals_batch_impl` is patched-by-string in a test, that test mocks the wrong target after the move. | Pre-flight grep (§5.4) for every I-C commit. Update patches atomically with the move. |
| R2 | `_extract_icp_json` alias breaks an introspection-based caller. | Function aliases are sound for all normal call patterns and `mocker.patch("…._extract_icp_json")`. No introspection-based callers exist (grepped during design). |
| R3 | `signals/__init__.py` docstring drift across intermediate commits 4-7. Phase H shipped a stale docstring that round-2 review caught. | After commit 8 (orchestrator delete), rewrite docstring to describe final form. Don't ship intermediate-state docstrings. |
| R4 | TD-007 `mocker.patch` deletions in `test_customer_profile.py` could mask a real coverage gap if `_ensure_icp_indexes` is still reachable. | Phase G commit that removed the underlying call confirmed unreachability. Post-deletion: `pytest -q` would surface any reachable-but-unmocked path via a live Mongo call. |
| R5 | Model rename breaks an import we missed. | Pre-flight grep already counted 2 sites; atomic single commit. `pytest -q` surfaces any miss. |
| R6 | Cross-submodule `from . import search` cycle inside `batch.py` if `search.py` ever needs anything from `batch.py`. | search.py and batch.py have a clear directional dependency (batch uses search; search never needs batch). Document this in batch.py's module docstring. |

---

## 7. Success criteria

- 3 copies of `_*_agent_output` collapsed to 1 + 3 thin wrappers (per-service `llm.py` retains 12-15 LOC).
- 3 copies of JSON-cleanup collapsed to 1 + 3 thin wrappers; `signals/parsing.py::_validate_url` stays in signals/.
- `signals/orchestrator.py` deleted; signals/ structure mirrors data_sources/'s orchestrator-less shape.
- `app.models.documents` renamed (git-tracked); `_URL_PATTERN` de-duplicated to one constant; TD-007 closed in `docs/TECH_DEBT.md`.
- 236 (+ ~6-10 new helper tests) tests pass at every commit; 19 syrupy snapshots unchanged.
- All `mocker.patch("app.services.signals.orchestrator.*")` strings either retargeted or removed by commit 8.

---

## 8. Spec change log

- **2026-05-24, round 0** — initial draft after `/brainstorming` session; scope A+C+D per user; B deferred to Phase J.
