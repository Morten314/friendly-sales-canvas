---
artifact: Task 11 of plan-13 (migrate llm_config Cypher+QA prompts via as_langchain) — commit fedfcfd
artifact_type: impl
verdict: Approved with Minor
reviewer_model: claude-opus-4-7[1m]
date: 2026-05-26
round: 6
base_ref: 51a0dfb (after Task 10)
spec_loaded: true
plan_loaded: true
---

## Context

Review of commit `fedfcfd` against plan §Task 11 and spec §1 (no behavioral change). Range scoped to `git diff 51a0dfb..fedfcfd` (16 files, +471/-224). Spec at `specs/13-prompt-management-design.md`, plan at `plans/13-prompt-management.md` Task 11 (lines 2969-3260).

Verifications performed independently:
- All 4 byte-equivalence tests pass (`test_llm_config_migration_equivalence.py`: 4 passed, 0.47s).
- Full backend suite: 312 passed, 8 warnings, 33.81s (matches implementer claim).
- Golden + as_langchain parity tests for the 4 llm_config prompts: 8 passed (4 golden + 4 parity).
- 21 prompts registered (5 ICP + 7 signals + 5 market_research + 4 llm_config).
- `Schema :` (with space) preserved in `cypher_gen.md.j2`; `Schema:` (no space) preserved in `cypher_gen_alt.md.j2`.
- 5× JSON-directive duplication preserved verbatim in `qa_scout.md.j2` and rendered fixture.
- All four front-matter blocks match the plan's spec exactly (name=stem, version 1.0.0, correct model, correct response_format per plan: `text/text/json/text`, correct inputs).
- `test_llm_config_prompts.py` deleted; `_baselines/llm_config_prompt_strings.py` retained (per plan Step 10).
- Lifespan ordering preserved: `app/main.py:43` `init_registry()` precedes `:44` `build_llm_config()`.
- `app/core/llm_config.py` is now 100 lines (was 302), with `_CYPHER_BASE`, `_QA_BASE`, `_CYPHER_TAIL`, `_QA_TAIL`, `Cypher_gen_prompt*`, `qa_prompt_template*`, `Cypher_Prompt*`, `qa_prompt*` all removed. `PromptTemplate` import removed. No dead references remain (`rg` returns `CLEAN_NO_DEAD_REFS`).
- No hidden imports of deleted symbols anywhere in `backend/app/`.
- Commit message exactly matches plan Step 12; no Claude footer; single author.

## Findings

### [Low] Wrapper-template blank-line compensation is undocumented

**Location:** `backend/prompts/llm_config/qa_scout.md.j2:11-12`, `backend/prompts/llm_config/qa_scout_alt.md.j2:11-12`, `backend/prompts/_shared/scout_persona.md.j2:5-25`.

The implementer correctly noted that `scout_persona.md.j2` does not byte-equal `_QA_BASE`. Specifically:
- `scout_persona.md.j2` has no leading blank line (starts directly with "You are Scout") and ends with exactly one `\n` after `format.` (hex confirms `…f o r m a t . \n` at EOF).
- The legacy `_QA_BASE` constants (`QA_PROMPT_TEMPLATE_BASELINE`, `QA_PROMPT_TEMPLATE2_BASELINE`) begin with `\n` and end with `\n\n` before the next overlay.

To recover byte-equivalence, both wrapper templates compensate by:
1. Inserting a blank line **between** the front-matter fence and the `{% include %}` directive (line 11).
2. Inserting a blank line **after** the `{% include %}` directive (line 13).
3. Relying on Jinja2 default `trim_blocks=False, lstrip_blocks=False` so the template-tag line itself contributes `\n` rather than being stripped.

This works (the equivalence test passes), but the strategy is invisible: there is no comment in either wrapper or in the `scout_persona` partial's front-matter description explaining the convention or warning future editors that touching the leading/trailing whitespace of `scout_persona.md.j2`, or removing the seemingly cosmetic blank line at line 11/13 of the wrappers, will break byte equivalence.

The plan itself anticipated this risk (lines 3192-3193: "typically whitespace at the boundaries between base + overlay + tail, or a stray newline from a misplaced `{% include %}` directive"), and the one-shot equivalence test does provide a regression guard for the duration it lives — but that test is explicitly scheduled for deletion after one release cycle (see test docstring: "Delete this file after the next release cuts"). After that deletion, the only remaining guard is the golden-fixture parity test, which would catch a render diff but would not explain *why* the prompt structure looks the way it does to anyone reformatting these files in a future cleanup pass.

Suggested fix (post-merge, low-priority): add a one-line comment after the front-matter fence in each wrapper, e.g.:

```jinja
---
…
---
{# Blank lines around the include are load-bearing: scout_persona has no
   leading/trailing blanks; the legacy _QA_BASE did. Do not collapse. #}

{% include '_shared/scout_persona.md.j2' %}

…
```

Or alternatively, update the `description` field in `scout_persona.md.j2`'s front-matter to flag the convention: `"Shared Scout persona header used by QA prompts; callers add their own leading/trailing whitespace as needed for byte-equivalence with legacy _QA_BASE."`

This is intentionally categorized **Low** rather than **Medium** because: (a) the byte-equivalence test currently catches any drift, (b) the golden fixtures continue to catch render drift after the equivalence test is retired, and (c) the cypher wrappers (`cypher_gen.md.j2:11`, `cypher_gen_alt.md.j2:11`) deliberately do NOT have a leading blank line because `_CYPHER_BASE` had its own leading `\n` baked in — so the partial+wrapper whitespace pattern is internally consistent across both base partials. The risk is purely that a future cleanup PR ("delete trailing blank lines") could regress this without obvious cause.

### [Nit] `_baselines/llm_config_prompt_strings.py` docstring references the now-deleted test

**Location:** `backend/tests/_baselines/llm_config_prompt_strings.py:5-7`.

The docstring says: "the byte-equality test in `test_llm_config_prompts.py` asserts that…". That test file no longer exists; the current consumer is `test_llm_config_migration_equivalence.py`. Per plan, the baselines file is retained for one more release cycle to support the new equivalence test, so this docstring should be updated to point to the new consumer. Cosmetic; no behavioral impact. The `rg` for `test_llm_config_prompts` in `backend/` found exactly this one stale reference and nothing else, confirming there are no other hidden references to the deleted file.

### [Nit] llm_config.py docstring contains a fragile line-number reference

**Location:** `backend/app/core/llm_config.py:46-47` — docstring on `build_llm_config`:

```
…wired in `app.main.lifespan` (init_registry on line 43, build_llm_config on 44).
```

Embedding specific line numbers from another file inside a docstring is a code smell — any future reordering of `app/main.py:lifespan()` will silently make this comment misleading, and there is no test that asserts the line numbers stay aligned. A version that names what's required without the line numbers (e.g. "wired in `app.main.lifespan`, which calls `init_registry()` before `build_llm_config()`") is just as informative and won't decay. Pure cosmetic; no behavioral risk.

## Summary

Task 11 is functionally clean: all required behaviors are in place, byte-equivalence holds across all 4 prompts (the critical abort criterion), no hidden imports of removed symbols, lifespan ordering protected, full suite green at 312 passed. The implementation faithfully follows plan §Task 11 Steps 1-12 with no scope creep and no observable drift. `app/core/llm_config.py` shrunk from 302→100 lines (~67% reduction) and now reads as a clean factory function. The deferral of `_DEFAULT_CLAUDE_PROMPT_SUFFIX` to Task 13 is correct per scope. Commit message matches plan exactly with no Claude footer.

The only substantive critique (the **Low** finding) is documentation-only and concerns the blank-line compensation strategy used to bridge the structural mismatch between `scout_persona.md.j2` and the legacy `_QA_BASE` — the strategy works and is regression-guarded for now, but the convention is invisible in the source and would benefit from a `{# … #}` comment in the two QA wrappers before the equivalence test is retired in the next release. The two **Nit** findings (stale docstring references) are pure cleanup and can be deferred or rolled into Task 14 (docs/PROMPTS.md).

Recommend: approve and proceed to Task 12.
