---
artifact: 13-prompt-management (Task 3, init_registry + source-expansion)
artifact_type: impl
verdict: findings
reviewer_model: claude-opus-4-7[1m]
date: 2026-05-26
round: 2
base_ref: 48445f3
spec_loaded: true
plan_loaded: true
---

## Context

Review covers the single-commit range `48445f3..226a28d` for Task 3 of plan-13. Two files touched: `backend/app/core/prompts.py` (+283 LOC) and `backend/tests/unit/test_prompts_loader.py` (+291 LOC). All 21 tests pass locally (`pytest tests/unit/test_prompts_loader.py -v` → 21 passed in 0.15s). Spec and plan loaded explicitly per the brief; deviations from plan-literal code are noted where they exist but most of the impl reproduces the plan verbatim. The brief explicitly de-scopes (1) the deferred `field` import, (2) the plan-literal source-expansion wording, (3) the stub `render` / `as_langchain` messages, and (4) the spec-allowed `list_prompts` / `get_config` early impl — none of those are critiqued below.

## Findings

### [Medium] Duplicated branches in `is_partial` check are dead code, mask cross-platform intent

**Location:** `backend/app/core/prompts.py:330`

```python
is_partial = relpath.startswith("_shared/") or relpath.startswith("_shared" + "/")
```

Both sides of the `or` are the literal string `"_shared/"`. The `"_shared" + "/"` is a constant-folded duplicate. Verified by direct evaluation — both branches return identically for every input.

Two plausible origins:
1. **Author intent was Windows-sep support** (`"_shared\\"`), and the second branch was meant to be `relpath.startswith("_shared" + os.sep)` or `relpath.startswith("_shared\\")` but was completed as a copy-paste. If that was the intent, the impl currently silently misclassifies `_shared/<x>.md.j2` as a callable prompt on Windows (because `str(Path.relative_to())` uses the platform's `os.sep`).
2. **Author intent was just a single check** but the editor expanded a snippet and the duplicate wasn't deleted.

Brewra is Linux-only (Render), so the platform concern is hypothetical for production. But the dead `or` is misleading and the spec-reviewer also flagged it. **Fix:** collapse to a single `relpath.startswith("_shared/")` and add a comment noting the loader assumes POSIX paths (or use `Path(relpath).parts[0] == "_shared"` which is sep-agnostic and arguably clearer intent). One-line change. The brief flagged this as "fix if minor" — it is minor; fix in Task 4 cleanup.

### [Medium] `_INCLUDE_LINE_RE` accepts mismatched include quotes

**Location:** `backend/app/core/prompts.py:250`

```python
_INCLUDE_LINE_RE = re.compile(r"^[ \t]*\{%\s*include\s+['\"]([^'\"]+)['\"]\s*%\}[ \t]*\n?", re.MULTILINE)
```

The opening and closing quote are each `['"]` character classes evaluated independently. `{% include 'foo.j2" %}` matches and the capture group yields `foo.j2`. Jinja2 itself would reject this as a syntax error at `env.parse()` — so in practice the malformed include reaches AST parsing only when its file actually exists at the wrong-quoted path (otherwise `partial not found` fires first), and even then `env.parse(expanded_body)` will fail on the *surrounding* template if the quotes are mismatched there.

Net effect: not a correctness bug — the loop still catches it eventually via the Jinja parse step. But the failure attribution shifts: the user sees `Jinja2 parse failed: ...` on the parent prompt, not `malformed include directive` at the include site. Diagnostic quality, not behavior.

**Fix:** use a back-reference: `r"^[ \t]*\{%\s*include\s+(['\"])([^'\"]+)\1\s*%\}[ \t]*\n?"` and update `_sub` to use `m.group(2)`. Then the textual scan matches what Jinja2 would accept and a mismatched quote leaves the directive in the body, where it gets a precise error at parse time. Minor improvement; not blocking.

### [Medium] `_FRONTMATTER_RE` rejects trailing whitespace on the closing `---`

**Location:** `backend/app/core/prompts.py:188`

```python
_FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n(.*)\Z", re.DOTALL)
```

The pattern demands a literal `\n` immediately after the closing `---`. A file authored with `---  \n` (trailing spaces, easy to introduce with an auto-formatter or VS Code's "trim trailing whitespace on save" being disabled) fails to match, and the user sees `malformed front-matter (must be \`---\`-fenced YAML at file head)` — an error message that does not hint at "the issue is trailing whitespace on line 3."

Spec §3.3 step 2 says "Errors caught: UTF-8 decode failures, malformed YAML, missing closing `---` fence." Trailing-whitespace on the closing fence is genuinely a "missing closing fence" case from the parser's POV, but human authors will not see it that way.

**Fix:** relax to `r"\A---\n(.*?)\n---[ \t]*\n(.*)\Z"` (or `\r?\n` if you care about Windows line endings authored by VS Code on a Mac mounted to a Linux container — unlikely here). Same for the opening fence is overkill but symmetric. Lo-pri; not a current blocker because no real prompt files exist yet and Task 5 will hand-author them.

### [Medium] `is_partial` validation appends per-field failures but does not validate value types

**Location:** `backend/app/core/prompts.py:338-343`

```python
if is_partial:
    # Validate minimal partial front-matter; never register as callable.
    for f in _REQUIRED_FIELDS_PARTIAL:
        if f not in fm:
            failures.append(FailureDetail(file=relpath, error=f"partial missing required field: {f}"))
    continue
```

This catches missing fields, but does not validate that `version` is semver, that `name` matches the filename stem, or that `description` is a non-empty string. A partial with `version: not-a-version` ships into production silently — and since partial body content is hashed into every includer's `content_hash`, a malformed partial that breaks the includer's Jinja2 parse will be attributed to the includer, not the partial.

The plan defined exactly this minimal validation, so this is plan-faithful, not implementer-introduced. But the spec §3.3 step 5 says "Validate front-matter: required fields present, semver shape, `response_format` enum, `_shared/` files marked as partials, filename stem matches `name`, cross-prompt `name` collisions rejected." A reasonable reading is that semver/name-stem/etc apply to *all* front-matter, partials included. The plan narrowed this to "required fields only" for partials.

**Recommendation:** apply at minimum semver validation to partial `version` (same `_SEMVER_RE`) and the filename-stem check to partial `name`. Adds 4 lines. Not a defect of Task 3 per the plan-literal contract; flag as Task-4-cleanup-or-later candidate.

### [Low] `_validate_callable_frontmatter` raises `KeyError`-style failure when defaults lack required scalar fields

**Location:** `backend/app/core/prompts.py:236-243`

After the `_REQUIRED_FIELDS_CALLABLE - merged.keys()` check (line 225), the code unconditionally accesses `merged["temperature"]`, `merged["max_tokens"]`, and `merged["timeout_s"]` to build `PromptConfig`. These three fields are NOT in `_REQUIRED_FIELDS_CALLABLE` — they're expected to come from `defaults.yaml` per the merge semantics. If a project misconfigures `defaults.yaml` to omit `temperature`, the `missing` set check passes (because `temperature` isn't required) but `merged["temperature"]` raises `KeyError`. The `KeyError` propagates out of `_validate_callable_frontmatter`, but the surrounding code catches only `ValueError` (line 348), so the boot **crashes with an uncaught KeyError** rather than producing a clean `FailureDetail`.

Reproduce by editing `_write_defaults` to drop one of `temperature`/`max_tokens`/`timeout_s`. Boot crashes.

**Fix:** either include `temperature`/`max_tokens`/`timeout_s` in `_REQUIRED_FIELDS_CALLABLE` (preferred — these are part of the contract regardless of where they're provided), or catch `KeyError` alongside `ValueError` in the boot loop and add a clearer message. The plan and spec don't specify this case; the test `test_boot_merges_defaults` exercises the happy path only. Low because the production `defaults.yaml` will be authored once with all three fields (Task 5) and rarely change — but the failure mode is loud and ugly.

### [Low] `is_partial` short-circuit skips parse failures, but parse already ran

**Location:** `backend/app/core/prompts.py:332-343`

The sequence is:
1. Line 332-336: `_parse_file(path)` — if it fails, `failures.append`, `continue`. (Good.)
2. Line 338: branch on `is_partial`. If partial, validate required fields and `continue`.

This is fine in itself, but note: a partial whose front-matter YAML is *malformed* gets the error attributed correctly at step 1 (the `_parse_file` ValueError). A partial whose front-matter is *valid YAML but missing required fields* gets the right error at step 2. Both paths work. No defect — just confirming the layering is intact.

The Low-severity concern is: if a partial body contains an unbalanced `{% if %}`/`{% endif %}`, the failure surfaces on every PARENT that includes it, with no direct mention of the partial. The Jinja2 error message includes line/col but in the parent's expanded coordinate space, not the partial's. **Mitigation suggestion** (for Task 4 or later, not this commit): after each successful partial parse, do a minimal `env.parse(partial_body)` dry run to validate partial syntax, and attribute failures to the partial file directly. Defensive, costs one parse per partial at boot; the partial corpus is small.

### [Low] `_parse_file` swallows file IO errors

**Location:** `backend/app/core/prompts.py:197-200`

```python
try:
    raw = _strip_bom(path.read_text(encoding="utf-8"))
except UnicodeDecodeError as e:
    raise ValueError(f"UTF-8 decode failed: {e}") from e
```

`path.read_text` can raise `OSError` (permission denied, file removed between glob and read, ENOENT race) in addition to `UnicodeDecodeError`. The function catches only the latter. An `OSError` will propagate out of `_parse_file`, out of the boot loop's `except ValueError` (line 334) which does NOT catch `OSError`, and crash the boot. Per spec §3.3, the boot should "aggregate failures and continue." This is a hole.

**Fix:** `except (UnicodeDecodeError, OSError) as e: raise ValueError(f"file read failed: {e}") from e`. Two-character change. Low because it's a vanishingly rare path in practice (Render filesystem is stable; the `rglob` and the `read_text` happen back-to-back).

### [Low] Test `test_promptconfig_is_frozen` raises clause is too permissive

**Location:** `backend/tests/unit/test_prompts_loader.py:34`

```python
with pytest.raises((AttributeError, Exception)):
    cfg.model = "other"  # frozen dataclass
```

`(AttributeError, Exception)` is redundant — `AttributeError` is-a `Exception`. Worse, `Exception` catches literally any error including unrelated bugs. If a future refactor breaks `cfg.model = "other"` such that it raises `TypeError` or even a random library error inside `__setattr__`, this test would still pass and silently "verify" the wrong thing.

**Fix:** `with pytest.raises(dataclasses.FrozenInstanceError):` — that's the actual exception `@dataclass(frozen=True)` raises. Imports `dataclasses` (already imported in production code, not in test file — add). One-line change. This was carried from Task 2; flagged here because the same test is now load-bearing.

### [Low] Boot pre-flight `_shared/` check produces inconsistent error path

**Location:** `backend/app/core/prompts.py:300-301`

```python
if not (root / "_shared").is_dir():
    raise BootFailure([FailureDetail(file=str(root / "_shared"), error="_shared/ not found")])
```

`file=str(root / "_shared")` uses the *absolute* path (because `root` is absolute when passed in). But line 306 reports `file="_shared/defaults.yaml"` (relative). Other failures use `relpath = str(path.relative_to(root))` (also relative). The pre-flight `_shared/` check is the only place where the `file` is an absolute path.

Effect: when the boot fails with mixed reasons (defaults missing + per-file errors), the error message has one absolute path and several relative paths, which makes log filtering and IDE click-to-open inconsistent. Aesthetic only.

**Fix:** `file="_shared"` to match the relative-path convention. Same for line 299's `file=str(root)` for the prompts-root case (though there, "the prompts root itself is missing" is arguably better expressed as the absolute path). One-line change.

### [Low] No test for the BOM-stripping path

**Location:** `backend/app/core/prompts.py:191-192` (`_strip_bom`) — no covering test

`_strip_bom` is exercised only via `_parse_file`, and no test writes a BOM-prefixed file. The code looks correct (`text[1:] if text.startswith("﻿") else text`) — direct evaluation confirms the U+FEFF character matches — but a future refactor that, say, accidentally uses the bytes `b"\xef\xbb\xbf"` after decoding (where the BOM has already been stripped) would silently break this path with zero test signal.

Add a 5-line test: `_write_prompt` followed by `prepend BOM`, `init_registry`, assert boot succeeds. Low because BOM-prefixed files are vanishingly rare in this codebase.

### [Low] `defaults.yaml` is parsed once but its `name`/`version`/`description` fields (if present) silently override per-prompt values

**Location:** `backend/app/core/prompts.py:224` (`merged = {**defaults, **fm}`)

The merge `{**defaults, **fm}` means per-prompt `fm` *overrides* `defaults`. That's correct for `temperature`/`max_tokens`/`timeout_s`. But if `defaults.yaml` accidentally contains `name: foo` or `version: 0.0.0`, it would be the silent fallback when a prompt omits those fields. Since those fields ARE required (`_REQUIRED_FIELDS_CALLABLE`), the missing-fields check passes if defaults supplies them. A prompt without `name` in its own front-matter would inherit `name: foo` from defaults and then fail the `expected_stem` check.

In practice no one writes `name:` in defaults.yaml. The current test `_write_defaults` only sets the three scalar overrides. But the loader doesn't enforce a defaults schema — `defaults.yaml` could contain arbitrary keys and they'd leak into every PromptConfig via the merge. **Recommendation:** add a constant `_ALLOWED_DEFAULTS_FIELDS = {"temperature", "max_tokens", "timeout_s"}` and reject defaults that contain other keys. 6 lines. Defends against a configuration footgun.

### [Nit] `body_source_expanded` is computed but unused in Task 3

**Location:** `backend/app/core/prompts.py:392`

The `_RegistryEntry` stores `body_source_expanded=expanded_body` for `as_langchain()` to use (per the dataclass comment). `as_langchain()` is still a stub in Task 3 — so the field is dead weight in this commit. This is correct per the plan (Task 4 wires it). Just noting that the field is paying its rent only after Task 4. No action needed.

### [Nit] `_validate_callable_frontmatter` declares `file_relpath` parameter but doesn't use it

**Location:** `backend/app/core/prompts.py:223`

```python
def _validate_callable_frontmatter(fm: dict, defaults: dict, file_relpath: str, expected_stem: str) -> PromptConfig:
```

`file_relpath` is unused inside the function. The caller (`init_registry`) passes it as `relpath`, presumably anticipating that error messages might include the file path. Currently every `raise ValueError(...)` inside this function omits the file path — the caller wraps the failure with `FailureDetail(file=relpath, ...)` at line 349, which provides the file context separately.

Either (a) remove the unused parameter, or (b) actually include the file path in the validation error messages (e.g. `raise ValueError(f"{file_relpath}: version not semver: ...")`). Option (b) is a defensive improvement when a partial helper is reused outside the boot loop. Plan-literal preserved as-is; this is just dead-parameter noise.

### [Nit] Test `test_boot_succeeds_with_only_shared_dir` peeks at module-level private state

**Location:** `backend/tests/unit/test_prompts_loader.py:166-167`

```python
from app.core import prompts as prompts_mod
assert prompts_mod._registry is reg
```

Reaching into `prompts_mod._registry` (private singleton) tightly couples the test to module-level implementation. If the singleton is later moved (e.g. into an `_internal` namespace), this test fails on a refactor that doesn't change behavior. The public-API alternative is `assert get_config(...)` or `assert list_prompts() == reg.list()` — verifies the same invariant ("module-level wrapper sees the new registry") through the API surface.

Acceptable as-is per the file's docstring (which explicitly says tests patch `_registry`), but flags as test-fragility. The spec-reviewer's "silent replacement" contract is exercised through the wrappers in subsequent tests anyway.

### [Nit] `seen_names` value is captured but only the value is used

**Location:** `backend/app/core/prompts.py:326,394`

```python
seen_names: dict[str, str] = {}  # name -> file relpath (for collision messages)
...
seen_names[name] = relpath
```

The dict-vs-set choice is correct (we want the *file path* of the prior occurrence for the collision error message at line 354). One-line clarity nit: the comment on line 326 already explains this well. No change needed; just confirming the intent reads correctly.

### [Nit] Section banners use 75-char `---` rules; consistent throughout

**Location:** `backend/app/core/prompts.py` various

The plan-suggested `# ---...---` comment-banner separators are present and used consistently for: Dataclasses (line 33-35), Error types (65-67), Observability helper (116-118), Registry (137-139), Front-matter parsing (184-186), Front-matter validation (213-215), Source-expansion algorithm (246-248), `init_registry()` (277-279), Module-level wrappers (404-408). Nine sections, 400 LOC, well-organized. Imports stay at the top (lines 16-26), no scattering. Matches spec/plan structure. Good.

### [Nit] Commit hygiene clean

**Location:** commit `226a28d`

- Subject `feat(be): implement init_registry + source-expansion algorithm` matches `type(scope):` convention, under 70 chars. ✓
- Two files changed, both in the planned scope. Atomic. ✓
- No Claude co-author footer. ✓
- No commit body — defensible for a single-task implementation where the "why" is in the subject and the plan. (CLAUDE.md says body is optional.) ✓

## Assessment

**Approved with Minor.**

Task 3 delivers a sound implementation of `init_registry()` and the source-expansion algorithm that adheres faithfully to plan-13's verbatim code (and through it, spec §3.3 step 0-10 and §3.4 Source-expansion). All 21 tests pass; the test suite covers the happy path, every documented failure mode (missing root/_shared/defaults, malformed front-matter, missing fields, semver shape, response_format enum, filename-stem mismatch, name collision, undeclared inputs, partial-as-callable rejection, depth-overrun), the defaults-merge precedence, partial-include resolution, and content-hash partial sensitivity. The boot-time error aggregation works as specified: per-file failures accumulate into a single `BootFailure` rather than first-fail-then-exit. The source-expansion regex correctly rejects inline includes (spec §3.4 authoring rule) and handles indented, double-quoted, single-quoted, and trailing-newline-absent forms.

**What I'd fix before Task 4 lands:**

- **Medium:** the duplicated `is_partial` `or` branch (cosmetic — fix in the Task 4 cleanup pass).
- **Medium:** the include regex's mismatched-quote acceptance (`['"]...['"]` independent classes). Use a back-reference. Improves diagnostic attribution.
- **Medium:** the `_FRONTMATTER_RE` rejection of trailing whitespace on the closing `---`. Will bite a real author someday. Relax to `r"---[ \t]*\n"`.

**What I'd address in Task 4 or as cleanup:**

- **Low:** `_validate_callable_frontmatter` raises `KeyError` (not caught) if defaults misconfigured. Add `temperature`/`max_tokens`/`timeout_s` to `_REQUIRED_FIELDS_CALLABLE` or catch `KeyError` in the boot loop.
- **Low:** `_parse_file` doesn't catch `OSError` — will crash boot on permission denied / file-removed race.
- **Low:** `test_promptconfig_is_frozen` catches `Exception`; should catch `FrozenInstanceError`. Fidelity improvement.
- **Low:** Pre-flight error paths use absolute paths; everything else uses relative. Cosmetic consistency.
- **Low:** No BOM test (the `_strip_bom` path has zero coverage).
- **Low:** `defaults.yaml` schema is unconstrained; an accidental `name:` key would leak silently.
- **Low:** Partial validation is missing-fields-only — no semver/stem checks for partial front-matter.

**Nits** are housekeeping (unused `file_relpath` param, test peeking at module-private state, dead `body_source_expanded` until Task 4 lands). None are blocking; address opportunistically.

The implementer (same subagent) should fix the three Mediums in Task 4's first commit (a cleanup pre-pass), then proceed with the render lifecycle. The Lows can land as one consolidated "loader hardening" commit at the end of Phase 1 (before Task 7 wires lifespan) — that keeps the Task 4 diff focused on the render contract.
