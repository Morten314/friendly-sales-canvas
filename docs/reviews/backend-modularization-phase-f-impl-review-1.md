---
artifact: refactor-backend-modularization-phase-f
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-22
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Spec: `specs/2026-05-22-backend-modularization-phase-f-design.md`. Plan: `plans/modularization-plan-6.md`. Branch has 17 commits (1–3 prep, 4–15 service conversions, 15a/15b split for market_scoring, 17 cleanup). Acceptance criteria from spec §7.1 were run programmatically; results inline below.

## Findings

### [Medium] `vision` model still constructed at module scope despite zero consumers

**Location:** `backend/app/core/llm_config.py:349-351`

```python
vision = ChatGroq(model="llama-3.2-90b-vision-preview", api_key=groq_api_key)
```

Spec §2.1 item 1 explicitly states: _"constructing the heavy `llama-3.2-90b-vision-preview` instance at every startup for a field no one reads is unjustified."_ The spec excludes `vision` from `LLMBundle` and does not define a `get_vision` provider. `grep -rn "vision" backend/app/services/ backend/app/routers/` returns zero hits — no service or router reads it. Yet the model is still instantiated at import time, contradicting Phase F's core goal of eliminating module-level state and the spec's explicit cost-benefit reasoning.

**Recommendation:** Delete lines 349–351 entirely. If a future consumer surfaces, add it to `LLMBundle` with its own provider at that time — the same pattern as every other LLM resource.

---

### [Medium] Redundant `_via_override` fixture set — transitional dead code

**Location:** `backend/tests/conftest.py:194-290`

The 7 `_via_override` fixtures (`mock_neo4j_via_override`, `mock_mongo_via_override`, `mock_s3_via_override`, `mock_pinecone_via_override`, `mock_neo4j_graph_via_override`, `mock_llm_via_override`) were the transitional set introduced in commit 3 (per spec §4.1 prep commit 3). After commit 17, the primary fixtures (`mock_neo4j`, `mock_mongo`, etc.) were themselves converted from `mocker.patch` to `_install_override`/`dependency_overrides`. The two sets now do the same job via the same mechanism.

No test file references any `_via_override` fixture — a `grep -rn "_via_override" backend/tests/` against the test bodies (not conftest) confirms they're unused. They add ~90 lines of dead code and create confusion about which fixture to use.

**Recommendation:** Delete lines 194–290 and the section-comment header (lines 181–192). The section-comment at lines 181–192 ("Phase F: dependency_overrides-based fixtures … Commit 17 deletes the source-patch fixtures entirely") describes the coexistence window that is now closed — delete that too.

---

### [Low] Stale docstring in `llm_config.py` describes intermediate state, not final

**Location:** `backend/app/core/llm_config.py:1-8`

```
Phase F (commit 1/17) introduces `LLMBundle` + `build_llm_config()`. The
module-level globals at the bottom are routed through the factory to keep a
single construction path. Services not yet converted to dependency injection
still read `llm_config.llm`, `llm_config.chain`, etc. via these globals; they're
deleted in commit 17 after all services are converted.
```

This docstring describes the commit-1 intermediate state. The final file has no module-level globals (the factory is the only construction path). The comment about "module-level globals at the bottom" and "deleted in commit 17" is misleading to a reader checking out `master`.

**Recommendation:** Rewrite the docstring to describe the final state: `LLMBundle` dataclass + `build_llm_config()` factory; construction owned by `lifespan`; no module-level state.

---

### [Low] `_ensure_market_scoring_indexes` `if mongo is None: return` guard triggers acceptance-criterion grep but is legitimate

**Location:** `backend/app/services/market_scoring.py:43`

The spec §7.1 acceptance criterion `git grep -E "if (driver|mongo|...) is None:" backend/app/services/` expects empty output. This guard triggers it:

```python
if mongo is None:
    return
```

This is a runtime guard, not a §3.7 backward-compat fallback — `mongo` can be legitimately `None` when `BREWRA_SKIP_DB_INIT=1` (the `build_clients()` factory returns `client=None`). The guard is correct. The grep criterion is over-broad.

**Recommendation:** No code change needed. Update the acceptance-criterion grep in the spec to exclude this specific pattern, or narrow the grep to match `if X is None: X = clients.` (the actual fallback pattern).

---

### [Nit] Inconsistent cleanup patterns in conftest fixtures

**Location:** `backend/tests/conftest.py:71-78` vs `204-209`

The primary fixtures use the `_install_override()` helper (which returns a cleanup callable), while the `_via_override` fixtures use inline `try/finally`. Two patterns for the same job. Once the `_via_override` set is removed (per the Medium finding above), this inconsistency resolves itself.
