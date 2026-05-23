---
artifact: refactor-backend-modularization-phase-f
artifact_type: impl
verdict: findings
reviewer_model: claude-opus-4-7
date: 2026-05-23
round: 2
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Round 2 of impl review on this branch. Round-1 findings were folded into the branch via commits `51fc7c0`, `232ce17`, `e923109` (plus the docs commit `f6a0519`). This review evaluates the post-cleanup state.

Spec §7.1 acceptance criteria all clean (verified by grep):
- No `clients.*` / `llm_config.*` qualified access in services or routers
- No `=None` fallback defaults or `if X is None:` fallback checks in service signatures (the one legitimate `if mongo is None: return` runtime guard in `market_scoring.py:43` was reviewed in round 1 and accepted)
- No `mocker.patch("app.core.clients.…")` source-patches in tests
- No `@app.on_event` in code (the one match is a docstring reference to the *replaced* hook)
- 203 tests pass

## Findings

### [Medium] Stale Phase/Task/commit references are systemic across the codebase

**Location:** ~30+ instances, including:
- `backend/app/main.py:7,10,33,64,74,129,175` (7 sites in `main.py` alone)
- `backend/app/services/pipeline.py:12,70`
- `backend/app/services/leads.py:29`
- `backend/app/services/_llm_helpers.py:3`
- `backend/app/services/_neo4j_helpers.py:1` (added by Phase F)
- `backend/app/services/documents.py:8,14,145`
- `backend/app/services/graph_chat.py:11,189,194,205` (added by Phase F)
- `backend/app/services/icp.py:8,15-16,672,1039-1041`
- `backend/app/services/signals.py:517,906-907`
- `backend/app/services/market_research.py:3-5`
- `backend/app/routers/documents.py:53`
- `backend/app/routers/profiles.py:26`
- `backend/tests/conftest.py:3-6` (module docstring)
- `backend/tests/unit/conftest.py:42-43,59-60` (fixture docstrings)

CLAUDE.md explicitly forbids this pattern: _"Don't reference the current task, fix, or callers ('used by X', 'added for the Y flow', 'handles the case from issue #123'), since those belong in the PR description and rot as the codebase evolves."_

Round 1 caught one instance (`llm_config.py` docstring). Round-2 fold-in caught one more (`market_scoring._ensure_market_scoring_indexes` docstring). The remaining ~30 are still present. Phase F is not solely responsible — most predate this phase, inherited from Phase A/B/C/D — but Phase F also *added new* instances at `_neo4j_helpers.py:1` and `graph_chat.py:11,189`, so the phase contributed to the rot rather than reducing it.

The fix is mechanical: delete the stale references. A `git grep -E 'Phase [A-G]|commit [0-9]+/[0-9]+|Task [0-9]+' backend/app/ backend/tests/` enumerates the call sites; each can be deleted or rewritten to describe the present-tense design without commit-numbering.

Some Phase-G references are genuine TODO markers, not stale history (e.g. `graph_chat.py:194` "defers parameterization to Phase G"). Those should migrate to `# TODO(td-XXX):` or be tracked in `docs/TECH_DEBT.md` rather than carrying a phase tag inline.

---

### [Low] `app/main.py` module docstring describes the intermediate refactor state

**Location:** `backend/app/main.py:1-14`

```
This module owns:
  - The FastAPI() instance
  - CORS middleware
  - include_router() calls for all domain routers (added incrementally
    as routers are extracted in Tasks 4-15)

Logging is configured in app/core/logging.py (re-exported below for
backward compat within Phase B).
```

The "added incrementally as routers are extracted in Tasks 4-15" and "backward compat within Phase B" references describe an earlier in-flight refactor (Phase B). Post-Phase-F the architecture is settled — the docstring should describe what the module owns *now*, not the migration narrative. Same class of issue as round-1 Finding 3 (`llm_config.py` docstring), but in a different file. Round 1 missed it.

The same issue affects `backend/app/main.py:33` (logger re-export comment), `:74` ("Phase D: domain-exception handlers"), `:129` ("Router registrations are added incrementally in Tasks 4-15"), and `:175` ("Phase F: `lifespan` (above) owns…") — these are folded into the Medium finding above but flagged here for visibility because the single `main.py` file accounts for 7 of the ~30 stale references.

---

### [Low] `tests/unit/conftest.py` module docstring describes pre-Phase-F mocking

**Location:** `backend/tests/unit/conftest.py:1-15`

```
These tests bypass FastAPI / TestClient entirely. They call service functions
directly and mock at the same source-level layer the integration tests do:
`app.core.clients.driver`, `app.core.clients.client`, and per-module LLM
helper imports.
```

Factually incorrect post-Phase-F:
- Integration tests no longer mock at the source level — they use `app.dependency_overrides`.
- Unit tests don't mock at the source level either — they pass mocks directly as positional args (the fixture comments at lines 42-43 and 59-60 explicitly say "no source-patch").

The docstring still describes the architecture the unit tests *replaced*. Rewrite to: "Unit tests call service functions directly with positional client/LLM mocks (no FastAPI, no dependency injection)."

---

### [Low] Lazy import of `_ensure_market_scoring_indexes` inside `lifespan`

**Location:** `backend/app/main.py:54-55`

```python
if app.state.clients.client is not None:
    from app.services.market_scoring import _ensure_market_scoring_indexes
    _ensure_market_scoring_indexes(app.state.clients.client)
```

The import is placed inside the function body, suggesting a deliberate workaround for a circular import. Tracing the import graph shows none exists: `app.services.market_scoring` imports only from `app.core.*`, `app.models.*`, and standard libraries — never from `app.main`. By the time `lifespan` executes, `app.routers.market_scoring` has already been imported at `main.py:171`, which transitively loads `app.services.market_scoring`. The lazy import is redundant.

Hoist `from app.services.market_scoring import _ensure_market_scoring_indexes` to the top-level imports for consistency with `build_clients` and `build_llm_config` (both imported at module top).

---

### [Nit] CORS comment claims "Phase B tightens this" but Phase B is done and CORS hardening is deferred to Phase G

**Location:** `backend/app/main.py:63-64`

```python
# NOTE: allow_origins=["*"] with allow_credentials=True is preserved from
# original behavior. Phase B tightens this.
```

Phase B shipped without tightening CORS. Per spec §2.2 ("Security hardening … CORS off `*`"), this work is deferred to Phase G. The comment misdirects a reader checking out master to look in Phase B's spec/plan.

Same class as the Medium stale-reference finding, but called out separately because the comment is *misleading* (claims action that didn't happen), not just *historical noise*.

---

### [Nit] Phase B prompt template constants `qa_prompt_template2`, `qa_prompt2` still defined as module-level state in `llm_config.py:239-274`

**Location:** `backend/app/core/llm_config.py:239-274`

These are cheap immutable strings / `PromptTemplate` constants (not heavyweight LLM clients), so they don't violate the spec's intent of "no module-level state — no construction at import time" (§2.1 item 3 targets *clients/LLMs*, not prompt strings). Acceptance criterion §7.1 does not flag them. But after the `vision` deletion in round 1, these are the only module-level non-prompt assignments left, and the prompt block is large — a quick read of the file gives the misleading impression that "no module-level state" was a partial promise. Consider moving prompts to `app/prompts/` (already on the §2.2 backlog under "Inline prompts → `app/prompts/`") as a future cleanup.
