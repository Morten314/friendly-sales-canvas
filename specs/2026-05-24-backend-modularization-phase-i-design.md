# Backend Modularization Phase I — Phase H Deferrals: Shared LLM Helpers, Signals Decomposition, Cleanup

**Date:** 2026-05-24
**Status:** Draft — round-1 review applied; awaiting round-2 spec review
**Branch (planned):** `refactor-backend-modularization-phase-i` off `master` (after Phase H merges)
**Predecessors:** Phase H (`/specs/2026-05-23-backend-service-decomposition-phase-h-design.md`) and prior phases A-G.

---

## 1. Summary

Phase I closes three deferred items from Phase H:

- **Item A** — Consolidates three near-duplicate `_*_agent_output` helpers (signals/icp/market_research LLM dispatch) and three near-duplicate JSON-parsing helpers into shared `_llm_helpers.py` functions. Spec §2.2 of Phase H explicitly excluded this; Phase H's review-2 synthesis re-flagged it as a Low finding worth a future pass. ~180 LOC of cross-service duplication killed.
- **Item C** — Decomposes `signals/orchestrator.py` (744 LOC, 8 functions) into focused submodules `search.py`, `batch.py`, `ask.py`, plus `fetch_signals` promoted in `persistence.py`. `signals/orchestrator.py` is deleted — same pattern as `data_sources/` reached at Phase H commit 7/20. Closes Phase H's "orchestrator at 2× spec-estimate LOC" finding.
- **Item D** — Renames `app.models.documents` → `app.models.data_sources` (catches up the model layer to Phase H's service rename), hoists `_URL_PATTERN` constant into `_llm_helpers.py`, closes TD-007 cosmetic cruft (4 one-line fixes).

This is structurally a no-op move: signatures, response shapes, and route paths are unchanged. **One intentional behavior change**: signals' historical quote-escaping in `_parse_search_signals_response` (escaping `"` inside `description`/`snippet`/`headline` matched values, in addition to `\n`/`\r`) is removed during the I-A consolidation. The other two research services (icp, market_research) have always operated without this defensive code path with no recorded incident; Phase I unifies all three on the simpler escape rule. If a future quote-related parsing failure surfaces, it becomes a scoped fix rather than a diverged-per-service legacy. Existing 236 behavior tests stay green; snapshot count holds at 19. Commit 1 adds a small parameterized test module for the two new shared helpers (~6-10 new tests; total settles around 242-246). Test patch-path strings update in step with each structural move per the Phase H discipline (see `feedback_phase_h_module_import_pattern.md`).

**Explicitly out of scope:** Item B (lazy circular imports in icp/persistence + market_scoring/scoring). Tracked for Phase J. Phase I will not surface those cycles naturally — they live in different packages.

---

## 2. Scope

### 2.1 In scope

1. **Two shared helpers added to `_llm_helpers.py`:**
   - `_research_agent_output(agent_chain, prompt, seed_text, llm_backend, search_query_template, extract_intermediate_urls=False) -> tuple[str, list[str]]` — unifies the Groq-vs-Claude dispatch pattern used by all three research services. The `search_query_template` must contain a literal `{seed}` placeholder; the helper substitutes it via `str.format(seed=...)` with the first 1200 chars of whitespace-normalized `seed_text`.
   - `_extract_research_json(response, escape_keys=("description",), trim_braces=False, strip_final_answer=False) -> dict` — promoted from `icp/parsing.py::_extract_icp_json` (already generic-shaped). Per-key escape rule matches icp's current behavior: escape `\n`/`\r` inside matched values, not `"`. Signals' historical quote-escaping is removed as the unification decision (see §1).

2. **Per-service wrappers preserved** (~6-15 LOC each) for the three services. The wrappers hardcode service-specific configuration (search query template, escape keys, URL extraction). They keep `mocker.patch("app.services.<svc>.llm._<svc>_agent_output")` strings working — the §3.7 Phase H "patch where it's used" discipline applies.

3. **`signals/` decomposition.** New submodules:
   - `signals/search.py` — `search_signals` + `run_signals_research` (~255 LOC).
   - `signals/batch.py` — `generate_signals_batch` + `generate_signals_batch_claude` + `_generate_signals_batch_impl` (~190 LOC).
   - `signals/ask.py` — `signal_ask` + `signal_ask_claude` (~240 LOC).
   - `signals/persistence.py` — `_load_signals_for_user` renamed to public `fetch_signals` (no wrapper-to-a-wrapper).
   - `signals/orchestrator.py` — deleted (the existing `fetch_signals` wrapper there is dropped during the I-C commit 4 rename).
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

`backend/app/services/_llm_helpers.py` grows from 71 LOC to ~170-180 LOC. Becomes the single home for:

- **Primitives (existing):** `_tavily_context_and_urls`, `_claude_messages_text`, `CLAUDE_RESEARCH_MAX_TOKENS`.
- **Patterns (new):** `_research_agent_output`, `_extract_research_json`, `_URL_PATTERN`.

Module docstring updated to reflect both layers and to document the per-service kwargs conventions for `_extract_research_json` (signals: `escape_keys=("description","snippet","headline"), trim_braces=True, strip_final_answer=True`; icp: per-worker variations of `escape_keys` ranging from `("description",)` to `("description","blurb","headline")`; market_research: defaults). This is the docstring home of record for those conventions — the icp alias (§3.2) doesn't carry its own.

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

**Parsing adapters** (mirror the agent_output wrapper shape):

```python
# icp/parsing.py — post-Phase-I, ~3 LOC
from app.services._llm_helpers import _extract_research_json

# 1-line alias preserves the existing in-package callsites (8 grep hits across
# icp/ orchestrator and parsing) without a cross-cutting sweep. The alias
# doesn't carry its own docstring — see _extract_research_json in _llm_helpers
# for the per-service convention table.
_extract_icp_json = _extract_research_json
```

```python
# market_research/parsing.py — post-Phase-I, ~4 LOC
# Module-import to avoid name shadow (the local function and the shared helper
# both want the name _extract_research_json).
from app.services import _llm_helpers

def _extract_research_json(raw_response):
    return _llm_helpers._extract_research_json(raw_response)  # defaults: escape_keys=("description",)
```

```python
# signals/parsing.py — post-Phase-I, _parse_search_signals_response is ~7 LOC;
# _validate_url stays put (signals-specific, validates URLs against a
# tavily_urls allowlist).
from app.services._llm_helpers import _extract_research_json

def _parse_search_signals_response(response):
    # Note: signals' historical quote-escaping is removed per §1 unification
    # decision. The shared helper escapes \n/\r only; no escape_quotes kwarg.
    return _extract_research_json(
        response,
        escape_keys=("description", "snippet", "headline"),
        trim_braces=True,
        strip_final_answer=True,
    )
```

### 3.3 signals/ structure (post-Phase-I)

```
backend/app/services/signals/
├── __init__.py          # re-exports 8 public symbols
├── prompts.py           # (unchanged from Phase H, 328 LOC)
├── llm.py               # _signals_agent_output adapter (~15 LOC)
├── parsing.py           # _parse_search_signals_response adapter + _validate_url (~50 LOC)
├── persistence.py       # all Mongo helpers + fetch_signals (renamed from _load_signals_for_user) (~181 LOC, no net change)
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

**Commit dependency graph.** Commits 1-3 are strictly sequential — 1 introduces the shared helpers, 2 and 3 consume them. Commits 4-8 are strictly sequential — progressive extraction from `signals/orchestrator.py`. Commits 9-11 are independent of each other and of commits 4-8, except commit 10 (URL regex hoist) depends on commit 2 (which orphans `_URL_PATTERN` in `signals/llm.py`). Recommended order is sequential 1→11 for review-clarity; a parallel run of 9 alongside 4-8 is technically safe but adds nothing.

### 4.1 Sub-sequence I-A (commits 1-3) — shared helpers

| # | Commit | Effect |
|---|---|---|
| 1 | `refactor(be): add _research_agent_output + _extract_research_json to _llm_helpers [phase I, 1/11]` | Add shared helpers and `_URL_PATTERN` use inside them. Add `tests/unit/test_llm_helpers.py` covering the parameterized behavior. No service-side callers wired yet. |
| 2 | `refactor(be): consolidate 3 _*_agent_output bodies to shared dispatch [phase I, 2/11]` | Rewrite 3 per-service wrappers to call `_research_agent_output`. ~70 LOC net deletion across `signals/llm.py`, `icp/llm.py`, `market_research/llm.py`. `signals/llm.py::_URL_PATTERN` becomes unused; cleaned in commit 10. |
| 3 | `refactor(be): consolidate 3 JSON-parsing bodies to shared _extract_research_json [phase I, 3/11]` | Promote `icp/parsing.py::_extract_icp_json` (1-line alias). Rewrite `signals/parsing.py::_parse_search_signals_response` (drops historical quote-escaping per §1) and `market_research/parsing.py::_extract_research_json` (module-import to avoid name shadow) as thin adapters. ~100 LOC net deletion. |

### 4.2 Sub-sequence I-C (commits 4-8) — signals decomposition

| # | Commit | Effect |
|---|---|---|
| 4 | `refactor(be): rename _load_signals_for_user → fetch_signals (public) in persistence.py [phase I, 4/11]` | The orchestrator's `fetch_signals` was already a one-line wrapper around `persistence._load_signals_for_user`. Rename `_load_signals_for_user` to public `fetch_signals` in `persistence.py`; drop the orchestrator wrapper; update `__init__.py` re-export to point at `persistence.fetch_signals`. Smallest commit — verifies the pattern. |
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

**Catch-all (run after each commit 4-7, not only commit 8)**: `grep -rn "app\.services\.signals\.orchestrator" backend/` — any non-zero hit means a stale reference slipped through the per-symbol greps above. Catching this per-commit instead of only at commit 8 prevents stragglers from compounding across the I-C sub-sequence.

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
- **2026-05-24, round 1** — applied round-1 spec-review synthesis (`docs/reviews/backend-modularization-phase-i-design-spec-synthesis-1.md`). Changes:
  - **Critical (resolved with intentional behavior change):** signals' historical quote-escaping in `_parse_search_signals_response` removed during I-A consolidation rather than preserved via an `escape_quotes` parameter. Documented as the one intentional behavior change in §1 and noted at the relevant code blocks (§2.1 item 1, §3.2 signals adapter, §4.1 commit 3).
  - **High:** LOC estimates corrected — §1 "~250 LOC" → "~180 LOC"; §3.1 "~250 LOC" → "~170-180 LOC"; §4.1 commit 2 "~150 LOC" → "~70 LOC". §3.2 gained 3 code blocks for the parsing adapters (icp alias, market_research module-import wrapper, signals adapter dropping quote-escaping).
  - **Medium:** §5.4 extended with a catch-all `grep -rn "app\.services\.signals\.orchestrator" backend/` to run after each I-C commit (4-7), not only commit 8.
  - **Low:** §4 gained a commit-dependency paragraph explaining strict-sequential (1-3 and 4-8) vs independent (9, 11) vs dependent (10 → 2). §3.1 module docstring expanded to document the per-service `escape_keys`/`trim_braces`/`strip_final_answer` conventions (the icp alias doesn't carry its own). §3.3 + §4.2 commit 4 changed from "move fetch_signals" to "rename `_load_signals_for_user` → public `fetch_signals` in persistence" (avoids wrapper-to-a-wrapper).
  - **Severity disagreements (no spec change):** intermediate `__init__.py` docstring drift kept at the §6 R3 mitigation level (rewrite at commit 8 only). Phase H spec header hygiene noted but not a Phase I prerequisite.
