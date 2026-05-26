---
artifact: 13-prompt-management (Task 7, LLM factory + call_with_prompt + lifespan init_registry)
artifact_type: impl
verdict: findings
reviewer_model: claude-opus-4-7[1m]
date: 2026-05-26
round: 4
base_ref: ddd7cb1
spec_loaded: true
plan_loaded: true
---

## Context

Review covers the single-commit range `ddd7cb1..fb722d7` ("feat(be): wire call_with_prompt + lifespan init_registry") for Task 7 of plan-13. Diff stat: 5 files, 150 insertions, 0 deletions:

- `backend/app/core/llm_config.py` (+4 LOC) — factory registrations inside `build_llm_config()`
- `backend/app/main.py` (+4 LOC) — `init_registry()` wired into lifespan + module-level import
- `backend/app/services/_llm_helpers.py` (+36 LOC) — `_LLM_FACTORY`, `_LLM_CACHE`, `register_llm`, `_get_llm_for_model`, `call_with_prompt`
- `backend/tests/test_lifespan.py` (+16 LOC) — `test_lifespan_initializes_prompts_registry`
- `backend/tests/unit/test_llm_helpers.py` (+90 LOC) — `isolated_llm_factory` fixture + two tests

Verification performed in-sandbox:
- `pytest tests/unit/test_llm_helpers.py tests/test_lifespan.py -v` → 16 passed (the three new tests pass: `test_register_llm_and_get_llm_for_model`, `test_call_with_prompt_renders_and_invokes`, `test_lifespan_initializes_prompts_registry`)
- `pytest --no-header -q` → **292 passed, 2 skipped, 8 warnings in 10.83s** (matches implementer's claim, +3 from prior 289+2)
- Lifespan order in `app/main.py` confirmed: `build_clients()` (line 40) → `_prompts.init_registry()` (line 43) → `build_llm_config()` (line 44) → indexes (lines 52–55) → yield
- Factory registrations in `llm_config.py` are **inside** `build_llm_config()` (after the `ChatGroq`/`ChatOpenAI` constructors), not at module-import time — no side-effect-at-import anti-pattern
- Commit message exact subject `feat(be): wire call_with_prompt + lifespan init_registry`; no Claude footer

Spec §3.5 reference code and plan Task 7 prescribed code were compared line-by-line against the implementation. Substantive adherence is high — one Low and one Nit finding below; nothing rises to High/Critical.

## Findings

### [Low] `Callable` typing import placed mid-module instead of with the other module-level imports

**Location:** `backend/app/services/_llm_helpers.py:236-238` (lines just after the new section banner)

```python
# ---------------------------------------------------------------------------
# LLM-client factory + simple-invoke helper
# ---------------------------------------------------------------------------
from typing import Callable

from app.core import prompts as _prompts
from app.core.prompts import UnknownModelError, prompt_meta_from
```

Three new module-level imports (`Callable`, `_prompts`, `UnknownModelError`/`prompt_meta_from`) sit ~230 lines down the file, attached to the new banner rather than to the existing import block at the top of `_llm_helpers.py`. This is intentional grouping ("everything for the factory section lives here") and is a defensible style choice, but Python convention (PEP 8) and the rest of this file's existing top-of-module import block argue for hoisting them. None of these imports is conditional or expensive — `app.core.prompts` is already loaded by `app/main.py` before `build_llm_config()` runs, so there is no startup-order benefit to deferring. Cosmetic; not a blocker.

The spec-literal code (§3.5) also shows `from typing import Any, Callable` at the top of the file fragment, suggesting the spec's intent is top-of-module placement.

### [Low] Return-type annotation `tuple` is unparameterized

**Location:** `backend/app/services/_llm_helpers.py:259`

```python
def call_with_prompt(prompt_name: str, **inputs) -> tuple:
```

Spec §3.5 specifies `-> tuple[Any, dict[str, Any]]` and the existing `app.core.prompts.prompt_meta_from()` is fully annotated (`-> dict[str, Any]`). A bare `tuple` discards the call-site information that the second element is the prompt-meta dict — IDE autocompletion on the return value collapses to `Any`, and a future `mypy --strict` pass would flag this. Trivial fix:

```python
def call_with_prompt(prompt_name: str, **inputs) -> tuple[object, dict[str, Any]]:
```

(`Any` import would need to be added if not already pulled in; `prompt_meta_from` already uses it.) The review brief flagged this as cosmetic; calling it out for completeness, not as a blocker.

### [Nit] `**inputs` parameter is untyped

**Location:** `backend/app/services/_llm_helpers.py:259`

`**inputs` has no `Any` annotation. Spec-literal code says `**inputs: Any`. Same observation as above — annotation discipline. Not a defect.

### [Nit] Test does not assert that builder is *not* called for unregistered model

**Location:** `backend/tests/unit/test_llm_helpers.py:212` (the `UnknownModelError` branch of `test_register_llm_and_get_llm_for_model`)

```python
with pytest.raises(UnknownModelError):
    _llm_helpers._get_llm_for_model("not-registered")
```

The test verifies the exception is raised but does not assert that `built_count["n"]` stays at `1` after the failed lookup (i.e. that the unknown-model path doesn't accidentally invoke or re-invoke a builder). The current code obviously raises before any builder call so this is genuinely a nit — the assertion would only catch a future regression where the lookup order was reversed.

### [Nit] `isolated_llm_factory` fixture restore path doesn't run if a test raises mid-yield

**Location:** `backend/tests/unit/test_llm_helpers.py:189-198`

```python
@pytest.fixture
def isolated_llm_factory():
    from app.services import _llm_helpers
    factory_snapshot = dict(_llm_helpers._LLM_FACTORY)
    cache_snapshot = dict(_llm_helpers._LLM_CACHE)
    _llm_helpers._LLM_FACTORY.clear()
    _llm_helpers._LLM_CACHE.clear()
    yield _llm_helpers
    _llm_helpers._LLM_FACTORY.clear()
    _llm_helpers._LLM_FACTORY.update(factory_snapshot)
    _llm_helpers._LLM_CACHE.clear()
    _llm_helpers._LLM_CACHE.update(cache_snapshot)
```

If a test using the fixture raises an exception after `yield`, the restore code below `yield` is **skipped**. Pytest fixtures need a `try/finally` (or `with`) to guarantee teardown under exception:

```python
yield _llm_helpers
# ↓ skipped if test raises ↓
```

vs.

```python
try:
    yield _llm_helpers
finally:
    _llm_helpers._LLM_FACTORY.clear()
    ...
```

In current practice this is invisible because both tests using the fixture pass — the snapshot/restore works. But the brief explicitly asked whether the fixture "actually defends against test pollution"; the honest answer is "only on the happy path." If a future call_with_prompt test starts failing, factory state could leak into the next test's snapshot baseline. One-line fix (add `try:` before `yield`, `finally:` before the restore). Not a defect in the current passing suite; flagging as a discipline improvement.

### [Nit] No docstring on `register_llm` / `_get_llm_for_model`

**Location:** `backend/app/services/_llm_helpers.py:245-256`

Spec §3.5 code includes a docstring on `register_llm`:

```python
def register_llm(model_name: str, builder: Callable[[], Any]) -> None:
    """Register a builder for a model name. Called once at startup from
    build_llm_config(). Builders are cached on first call (lazy singleton)."""
```

The implementation drops it. The `call_with_prompt` docstring is present (and the review brief explicitly excludes plan-literal docstring text from nitpicking), but the two factory functions are bare. Spec-faithful would be to keep the spec's docstrings; not a blocker.

---

## Positive observations (not findings — for synthesis context)

The implementation is tight and faithful to spec §3.5 on every load-bearing point:

- **Lazy `HumanMessage` import inside `call_with_prompt`** (line 264) — matches spec exactly; avoids forcing `langchain_core` on importers of `_llm_helpers` who only need the JSON extractors at the top of the file. Verified: import is *not* at module level.
- **Cache stores the BUILT object** (line 254: `_LLM_CACHE[model_name] = _LLM_FACTORY[model_name]()` — note the trailing `()` invoking the builder).
- **Cache-before-build check** (line 253: `if model_name not in _LLM_CACHE`) — matches spec's lazy-singleton intent.
- **Return shape is a 2-tuple, not a dataclass or dict wrapper** (line 267: `return response, prompt_meta_from(rendered)`) — matches spec and call-site contract.
- **Lifespan order is correct** — `init_registry()` precedes `build_llm_config()` so the factory registrations land on top of an already-initialized prompt registry. This ordering matters because `build_llm_config()` doesn't *use* the registry, but a future call site that runs *during* `build_llm_config()` (e.g. a `prompts.render()` for boot-time validation) would need the registry up first. Implementer chose the safer order.
- **Factory registrations are inside `build_llm_config()`** (lines 235-238), not at module-import time — confirms no side-effect-at-import anti-pattern. Module imports of `llm_config` do not mutate the global factory.
- **Module-private mangling** — `_LLM_FACTORY` and `_LLM_CACHE` both have leading underscore; only `register_llm` (public) and `_get_llm_for_model` (private) mutate them. The test fixture reaches in via `_llm_helpers._LLM_FACTORY` — intentional and acceptable for the snapshot/restore pattern.
- **`test_call_with_prompt_renders_and_invokes` is genuinely behavior-based**: uses `tmp_path` for synthetic prompts (no production prompt leakage), registers a `FakeLLM` that captures the `messages` arg, then asserts the captured value is `[HumanMessage(content="Body: hi\n")]` — exact rendered body verification. The `prompt_meta` dict is asserted on `name`, `version`, `model`, and presence of `content_hash`/`render_inputs_hash`/`rendered_at`.
- **`test_lifespan_initializes_prompts_registry` correctly asserts singleton identity** — `app.state.prompts is prompts_mod._registry` (the `is` check, not `==`) — meaning the lifespan stored the same object the module owns, not a copy.

**Verdict:** Approved with Minor. All Low/Nit findings are cosmetic/discipline-level; none affects correctness, behavior, or production safety. The Low items (typing annotation on `tuple` return, import placement) are spec-faithfulness gaps that take 5 minutes to fix if rolled into a follow-up cosmetic pass; the Nits (fixture try/finally, missing docstrings) are discipline notes.
