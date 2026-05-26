---
artifact: 13-prompt-management (Task 4, render() + as_langchain() + module wrappers)
artifact_type: impl
verdict: findings
reviewer_model: claude-opus-4-7[1m]
date: 2026-05-26
round: 3
base_ref: 226a28d
spec_loaded: true
plan_loaded: true
---

## Context

Review covers the single-commit range `226a28d..1399da8` for Task 4 of plan-13. Two files touched: `backend/app/core/prompts.py` (+96 LOC net) and `backend/tests/unit/test_prompts_loader.py` (+153 LOC). All 30 unit tests pass locally (`pytest tests/unit/test_prompts_loader.py -v` → 30 passed in 0.16s). Spec and plan loaded per the brief; the three declared deviations from plan-literal code (env.from_string vs get_template; keep_trailing_newline=True; +\n sentinel in as_langchain) are reviewed substantively below. Task 3 carry-forward cosmetics (unused `field` import, duplicated `_shared/` startswith branch) are de-scoped per the brief.

Runtime probes were performed for:
- `__str__`-raising input behavior on both the Jinja and `_json.dumps` paths
- LangChain parity across 4 trailing-newline shapes (0/1/2 trailing newlines, no-newline-multiline) — all four byte-equal
- `as_langchain` pre-init RuntimeError and post-init PromptNotFound paths

## Findings

### [High] `_json.dumps(default=str)` failure leaks raw exception past the `RenderError` wrapper

**Location:** `backend/app/core/prompts.py:455-456`

```python
canonical = _json.dumps(inputs, sort_keys=True, default=str)
render_inputs_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
```

These two lines sit **outside** the `try/except` that wraps the Jinja render (lines 449-453). When an input object's `__str__` raises (the exact failure mode the brief asked about), the failure path depends on whether the template actually substitutes the variable:

- **If `{{ x }}` is in the body** — Jinja calls `str(x)` during render, `RenderError` correctly wraps.
- **If `x` is declared but never substituted** — render succeeds (verified by spec §3.4 allowing declared-but-unused inputs; the boot AST check is one-directional, referenced ⊆ declared), then `_json.dumps(default=str)` calls `str(x)` for the hash, and the raw `RuntimeError` escapes the function. Verified via probe (see Context): a `class Boom: __str__ raises` passed as an unused declared input surfaces as `builtins.RuntimeError`, not `app.core.prompts.RenderError`.

Spec §3.3 step 4 explicitly notes this category as a "limitation": *"Non-serializable types are coerced via `str()` and may produce hash collisions across semantically different values."* But the spec assumes `str()` succeeds; it does not address `str()` raising. And §3.3 step 3 commits to wrapping "any Jinja2 exception (`UndefinedError` from `StrictUndefined`, filter type errors, etc.)" in `RenderError` — the wrapper's purpose is "so call sites can catch `PromptError` uniformly without leaking `jinja2.UndefinedError` / `jinja2.TemplateError` types out of `app/core/prompts.py`." The same uniformity argument applies to the hash-phase failure: a call site doing `except PromptError:` will not catch the leaked `RuntimeError`, and the failure mode (a per-input `__str__` defect) is exactly the kind of thing a `prompts.render()` boundary should isolate.

**Fix:** extend the existing `try/except` to cover the hash phase too, or add a separate wrapper:

```python
try:
    template = registry.env.from_string(entry.body_source_expanded)
    body = template.render(**inputs)
    canonical = _json.dumps(inputs, sort_keys=True, default=str)
except Exception as e:
    raise RenderError(name, e) from e
render_inputs_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
```

`hashlib.sha256` itself cannot fail on a UTF-8-encoded `str`, so it's fine outside. This is a 2-line move. A regression test mirroring the probe (Boom input, declared but unused, asserts `RenderError` not `RuntimeError`) would lock it down.

### [Medium] Test `test_module_wrappers_error_before_init` skips `as_langchain`

**Location:** `backend/tests/unit/test_prompts_loader.py:502-510`

```python
def test_module_wrappers_error_before_init():
    import app.core.prompts as prompts_mod
    prompts_mod._registry = None  # reset
    with pytest.raises(RuntimeError, match="init_registry not called"):
        render("anything")
    with pytest.raises(RuntimeError, match="init_registry not called"):
        get_config("anything")
    with pytest.raises(RuntimeError, match="init_registry not called"):
        list_prompts()
```

The docstring on `_require_registry` (lines 414-419) explicitly says "Called by render / get_config / list_prompts / as_langchain" — but only 3 of the 4 wrappers are tested for the pre-init guard. The brief asked about this directly; I verified via probe that `as_langchain` correctly raises `RuntimeError("init_registry not called")` pre-init (because the `_require_registry()` call precedes the `from langchain_core...` import), but a test should pin that contract.

The lazy import inside `as_langchain` makes this assertion slightly more valuable than the other three: a future refactor that moves the import to module level and accidentally caches a copy of `_require_registry`'s return value somewhere brittle could break the contract silently. One line:

```python
    with pytest.raises(RuntimeError, match="init_registry not called"):
        as_langchain("anything")
```

### [Medium] No coverage for `RenderError` wrapper or for `as_langchain` on unknown name

**Location:** `backend/tests/unit/test_prompts_loader.py` (absent — no test references `RenderError`)

Two missing error-path tests:

1. **`RenderError`** — The `try/except` at lines 449-453 wraps Jinja2 failures into `RenderError`, but no test forces this path. The most natural trigger is a Jinja2 filter error (e.g., `{{ x | upper }}` where `x` is `None` — `StrictUndefined` would catch it at render, but `None` itself is passable and `None.upper()` fails). Alternatively, a syntactically valid template that references an attribute on a wrong-typed input (`{{ x.attr }}` where `x` is an int). The spec lists exactly this class — "filter type errors, attribute access failures on complex input objects" — as the wrapper's reason for existing. With no test, a future refactor that catches a narrower exception class (or moves the wrapper) could silently let those failures leak. Also relevant to the Critical finding above.

2. **`as_langchain` PromptNotFound** — Verified via probe that `as_langchain("never_existed")` raises `PromptNotFound`. A one-line test would lock that contract.

These two tests would close the error-path coverage for Task 4's public surface. Both <5 LOC.

### [Medium] `test_as_langchain_parity_with_render` exercises a narrow newline shape

**Location:** `backend/tests/unit/test_prompts_loader.py:536-552`

The test uses a body that ends `...\n{% include '_shared/footer.md.j2' %}\n` and a partial ending `END OF PROMPT\n`. After source expansion, the parent's `{% include %}` line is consumed (per spec §3.4 step 3) and replaced with the partial's body, yielding something like `Question: hello\nEND OF PROMPT\n\n`. Two trailing newlines, exactly the shape where `keep_trailing_newline=True` matters: one is "the partial's authored newline" and the other is "the parent's authored newline after the include line."

What the test does NOT cover:
- A body with no trailing newline at all (probe shows parity holds, but it's an unstated invariant)
- A body with only a single trailing newline and no partial (the same shape every Task 8-13 migrated prompt will use 95% of the time)
- A body ending mid-line with `{{ var }}` and no newline

The brief asked "does it actually catch the byte-parity issue, or could it pass with subtle drift?" — the existing test catches the two-trailing-newline case, which is the case the +\n sentinel was added to fix. If a future change (e.g., LangChain bumping to a version that changes the strip behavior, or someone removing `keep_trailing_newline=True`) introduces drift in the no-newline or one-newline case, this test passes and the migrated prompts break at runtime when their content_hash diverges from the LangChain-formatted version.

**Fix:** parametrize the test or add 2-3 more cases. Trivial since the test infrastructure is already in place. I verified manually via probe that all 4 trailing-newline shapes (0/1/2 + no-newline-multiline) currently produce byte-equal output — so locking that in is a small additional cost.

### [Medium] `_require_registry` returns a typed `Registry` but the lazy import in `as_langchain` re-fetches `entry` from a fresh call

**Location:** `backend/app/core/prompts.py:493-498`

```python
def as_langchain(name: str):
    ...
    from langchain_core.prompts import PromptTemplate
    entry = _require_registry().get(name)
    return PromptTemplate.from_template(
        entry.body_source_expanded + "\n",
        template_format="jinja2",
    )
```

Minor inconsistency with `render()`'s style (line 434-435) which binds `registry = _require_registry(); entry = registry.get(name)`. Here the registry isn't stored — fine, only `entry` is needed — but if the future PromptTemplate construction ever needs `registry.env` (e.g., to override LangChain's Jinja env, which is the spec's deferred caveat), the refactor footprint grows. Cosmetic.

Counter-argument: the current shape is honest — `as_langchain` doesn't need the env, doesn't need the root, just the entry. Leaving it minimal documents that. I'm flagging only because the brief asked about consistency.

**Recommendation:** leave as-is. Nit-level concern at most.

### [Low] `as_langchain` docstring says "Boot-time AST validation already proved..." but the proof only covers parent inputs, not partial-only refs

**Location:** `backend/app/core/prompts.py:483-485`

> "Boot-time AST validation already proved every `{{ var }}` reference is in the parent's declared inputs."

This is true and well-stated, **but** it's a non-obvious property. The reader has to recall that `_expand_includes` runs first, producing `expanded_body`, and that the AST walk runs on the expanded body (line 372). A partial that references `{{ x }}` requires the *parent* to declare `x` (verified by `test_partial_include_rejected_when_parent_does_not_declare_partial_var`). The docstring's phrasing is technically correct but glosses the boot-time mechanism.

Consider linking the assertion to spec §3.4 ("partials may reference variables from the including prompt's context. The loader's input-validation pass walks transitive `{% include %}` references") so the next reader knows where to look.

Optional. Self-documentation, not a defect.

### [Low] `keep_trailing_newline=True` config — confirming no interaction with source expansion

**Location:** `backend/app/core/prompts.py:319-327`

The brief asked: "does it affect the source-expansion algorithm in `_expand_includes()`? (Source-expansion is pre-Jinja2 text substitution, so should be safe — but worth confirming.)"

Verified: `_expand_includes` (line 254-271) is pure Python regex substitution; it never invokes the `env`. The `keep_trailing_newline=True` setting only affects `env.parse()`, `env.from_string()`, and `env.get_template()`. So:

- `_expand_includes` output: unchanged by the env flag.
- `_content_hash` (over `expanded_body`): unchanged by the env flag.
- `env.parse(expanded_body)` at boot (line 372): the parsed AST is whitespace-insensitive at the `find_undeclared_variables` level; the trailing-newline flag affects only the rendered output. No effect on validation.
- `env.from_string(entry.body_source_expanded)` at render (line 450): this is the only place the flag matters, and it matters in exactly the intended way (preserves the author's final newline in `body`).
- `as_langchain(...)`: see the parity discussion above; the +\n sentinel compensates for LangChain's own env not having the flag.

So the change is well-isolated. The probe corroborated: a parent ending in `{{ a }}\n` produces `body_source_expanded = 'Got: {{ a }}\n'` and `render() body = 'Got: X\n'` — the newline is preserved at render time, and `_expand_includes` did not gain or lose anything. No defect.

### [Low] `import json as _json` — why the underscore prefix?

**Location:** `backend/app/core/prompts.py:19`

The brief asked: "is the `_` prefix to avoid conflict with `json` parameter names elsewhere?" Inspecting the module, no parameter or local is named `json`. The plan's literal code (line 1350) wrote `import json as _json`, and the impl reproduced it — the convention may have been added by the plan author defensively (in case `inputs` dicts ever contain a key named `json` and the author wanted to avoid the shadow risk in some refactor), but no current site reads the bare name. Functionally indistinguishable from `import json`.

Not a defect. Mentioning only because the brief asked. Recommend: leave it; matches the plan; no harm.

### [Nit] Commit body lists 4 bullets but doesn't reference the test that proves the +\n sentinel works

**Location:** Commit `1399da8` body

The brief asked whether the commit "documents the three deviations or links to the test that proves they work." The body documents all three deviations (`from_string` over `get_template`, `keep_trailing_newline=True`, +\n sentinel) clearly. It does not name the test (`test_as_langchain_parity_with_render`) that proves the +\n sentinel works.

Strictly optional. The body is already 4 bullets, well above average commit hygiene for this repo. A trailer like `Refs: tests/unit/test_prompts_loader.py::test_as_langchain_parity_with_render` would be defensible per CLAUDE.md ("Plan-reference trailers... default off, use only when a commit would otherwise be hard to trace back to its context") — and the LangChain parity invariant is exactly the kind of nonobvious thing a trailer earns its keep on. But this is author's-judgment territory.

## Assessment

**Approved with Minor.**

The render lifecycle is correct, the deviations from plan-literal code are all spec-compliant and well-documented in code comments, and the 30 tests pass. The High finding (`_json.dumps` failure leak) is a 2-line fix and a small test addition — it's a real contract violation (`PromptError` uniformity is the explicit point of the `RenderError` wrapper), but it's strictly hardening; no current call site can trigger it because Phase 2 hasn't started and `prompts.render()` is not yet imported anywhere. The Medium findings are all test-coverage gaps (3 missing error-path assertions, 1 narrow parity test) plus one cosmetic; none block the task.

Recommended before Task 7 wires lifespan and Task 8 starts migrating real call sites:
1. Wrap `_json.dumps` in the `RenderError` try/except (High).
2. Add `as_langchain` to the pre-init guard test (Medium).
3. Add `as_langchain` PromptNotFound test (Medium).
4. Add `RenderError` test (Medium).
5. Optionally parametrize the parity test across newline shapes (Medium).

Item 1 should land before Task 8 in case a migrated prompt declares an input that ends up unused in a conditional branch (signals/leads_section_fallback is a plausible site). Items 2-5 are quality-of-life and can land any time before Task 11 (LangChain Cypher migration), which exercises the parity invariant in production.
