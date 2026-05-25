---
artifact: plans/13-prompt-management.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-25
round: 1
---

## Context

Reviewed against paired spec `specs/13-prompt-management-design.md` (734 lines, frozen). The plan is 3485 lines, 15 tasks across 4 phases. All prerequisite files referenced as "Modify" targets (`_llm_helpers.py`, `test_llm_helpers.py`, `_baselines/llm_config_prompt_strings.py`, `test_llm_config_prompts.py`) confirmed to exist on disk. The spec's filesystem layout (§3.1) is marked "provisional" — the plan's naming drift from it is acknowledged and intentional.

## Findings

### High — Task 11 Step 6 verification script contradicts front-matter names

**Location:** Task 11 "Migrate `llm_config/`", Step 6 (lines 2869-2885)

Steps 2-5 create files with front-matter names `cypher_gen`, `cypher_gen_alt`, `qa_scout`, `qa_scout_alt` (matching the file stems per the `name == filename_stem` convention established in Task 3). But Step 6's verification script filters by `x['name'].startswith('llm_config_')` and expects output like `llm_config_cypher_gen 1.0.0`. No registered prompt will match that filter — the script produces empty output, and the "Expected" block is wrong.

The same bare names are used correctly in:
- Task 6 `test_prompts_golden.py` `_LANGCHAIN_PROMPT_NAMES` set (line 1666)
- Task 11 Step 9 `as_langchain("cypher_gen")` calls (line 2968)

Fix: change the filter to `x['name'].startswith('cypher_') or x['name'].startswith('qa_')` or simply drop the filter and print all names. Update the expected output to match the actual front-matter names.

### High — No abort conditions stated anywhere in the plan

**Location:** Plan-wide (no section addresses this); spec §4 Phase 2 mentions rollback via `git revert` but the plan doesn't carry this forward.

The plan has no stated conditions under which execution should halt entirely. There is no guidance on:
- Scope explosion: what if Phase 0 surfaces 50+ additional prompts beyond the §2.1 baseline?
- Performance ceiling: spec §3.3 budgets "<1 second for up to 200 prompt files" but no step verifies this or says what to do if boot exceeds budget.
- Infrastructure failure: what if `init_registry` boot fails in production after Task 7 wires it into lifespan? The server won't start.
- Unresolvable regression: what if a service migration causes test failures that can't be resolved within a reasonable effort?

Each task says "Expected: green" on test runs but never states the fallback. The plan should include a top-level "Abort criteria" section — even a simple "If any task's full-suite regression can't be resolved in one session, stop and report to human" would suffice.

### High — No recovery strategy for mid-task failures

**Location:** Plan-wide; every task ends with "Expected: green" but no task says what to do on red.

The spec §4 Phase 2 defines service-level rollback via `git revert`, but the plan doesn't surface this at any task boundary. If Task 7 (lifespan wiring) passes its unit tests but the full suite regresses, the plan says "Expected: green" with no stated next step. An explicit recovery protocol — even as simple as "If full-suite regression: investigate, revert the commit, report to human" — would make the plan safe for autonomous execution.

Tasks 2-6 (infrastructure) are especially vulnerable: they modify shared infrastructure (`prompts.py`, `main.py`, `requirements.txt`) that every subsequent task depends on. A regression here is architecturally expensive to unwind if not caught immediately.

### Medium — Task 11 Step 8 requires `tests/_baselines/llm_config_prompt_strings.py` to already exist with correct contents

**Location:** Task 11 Step 8 (lines 2901-2954)

The one-shot equivalence test imports `CYPHER_GEN_PROMPT_BASELINE`, `CYPHER_GEN_PROMPT2_BASELINE`, `QA_PROMPT_TEMPLATE_BASELINE`, `QA_PROMPT_TEMPLATE2_BASELINE` from `tests/_baselines/llm_config_prompt_strings.py`. The file exists on disk, but the plan never verifies it contains the correct baseline strings (snapshot of current prompt assembly output). If the baselines are stale or missing these symbols, the one-shot test passes vacuously or fails with `ImportError` that misleads the executor.

The plan should include a pre-step: before Task 11, verify the baseline file's contents match the current `llm_config.py` prompt assembly output (or create/snapshot them if they don't).

### Medium — Task 8 step numbering gap (Steps 2-3 missing)

**Location:** Task 8 "Migrate `icp/`", between Step 1 (line 2038) and Step 4 (line 2081)

Steps 2 and 3 are absent. Step 1 is "Create `icp_generator.md.j2`", Step 4 is "Create the four `research_N.md.j2` files". The gap suggests Steps 2-3 were consolidated into the Step 4 heading but the numbering wasn't updated. This is cosmetic but could confuse an executor tracking progress via checkbox numbering.

### Medium — Phase 1 is 6 commits; spec says 3-4

**Location:** Phase 1 "Infrastructure", Tasks 2-7 (lines 171-1985); spec §4 Phase 1 (lines 639-647)

The spec describes Phase 1 as "3-4 commits":
1. `app/core/prompts.py` (loader + registry + renderer)
2. `backend/prompts/_shared/`
3. Test fixture infrastructure
4. `call_with_prompt` + lifespan wiring

The plan decomposes item 1 into 3 separate tasks (Task 2: types, Task 3: boot, Task 4: render) for a total of 6 Phase 1 commits. The decomposition is reasonable — each commit is reviewable and TDD'd — but the plan doesn't note the departure from the spec's count. Worth a brief note so the executor isn't confused when comparing plan vs spec.

### Medium — `signals_leads_section` and `signals_existing_headlines_section` are registered as callable but never called directly

**Location:** Task 9 Steps 1-3 (lines 2334-2405); plan file map line 28

These prompts are registered as callable prompts (they live under `signals/`, not `_shared/`), meaning `prompts.render("signals_leads_section", ...)` is legal. But per the design, they're only ever `{% include %}`-d from `signals_scout_search` and `signals_profiler_search`. Making them callable has two consequences:

1. They appear in `list_prompts()` output, which is misleading (they're sub-templates, not top-level prompts).
2. They require their own `inputs:` declarations, which are validated at boot. If someone edits `signals_leads_section` to reference a new variable, the parent must also declare it — or the include-depth validation catches the mismatch.

The spec §3.1 rule is "Files under `_shared/` cannot be invoked directly" — it says nothing about sub-templates in service directories. The plan places them in `signals/` (not `_shared/`) "because it's specific to the signals service" (line 2336). This is defensible but creates an API surface that shouldn't be used. Consider either: (a) moving them to `_shared/` and accepting the broader scope, or (b) adding a loader rule that marks non-`_shared/` files whose names end in `_section` as partial-only (not callable), or (c) documenting the convention in `PROMPTS.md` that these are include-only despite being callable.

### Medium — `test_prompts_golden.py` calls `init_registry` at module import time with production path

**Location:** Task 6 Step 3 (lines 1662)

```python
init_registry(root=PROMPTS_ROOT)
```

This runs at test discovery/import time, not inside a fixture. Side effects during import can cause:
- Test discovery tools (IDEs, `pytest --collect-only`) to fail if the `backend/prompts/` directory is in an intermediate state (e.g., partial migration where a `.md.j2` file is malformed).
- State bleeding: other test modules that import `test_prompts_golden.py`'s fixtures or helpers get the production registry, not a `tmp_path` registry.

The comment says "idempotent — silent replacement is the v1 contract" but `init_registry` is only idempotent if called with the same root. If a prior test called `init_registry(root=tmp_path)`, this module-level call replaces it with the production root. Tests in `test_prompts_loader.py` that rely on `tmp_path` would silently use the wrong root if `test_prompts_golden.py` is imported after them.

Fix: move the `init_registry` call into a `session`-scoped fixture or `conftest.py` setup, and ensure `test_prompts_loader.py` tests reset `_registry = None` in teardown.

### Low — Plan doesn't verify current test suite passes before starting

**Location:** Phase 0, Task 1 (line 69)

Phase 0 begins with the audit and produces `docs/prompt-inventory.md`. But the plan never establishes a baseline: "Run the full test suite and confirm it passes before starting." If the suite is already red when execution begins, every subsequent "Run full suite to verify nothing else broke" step is meaningless — the executor can't distinguish pre-existing failures from regressions they introduced.

Fix: add a "Step 0: Verify clean baseline" before Task 1 that runs `pytest` and confirms exit 0.

### Low — `_expand_includes` regex won't match indented includes on lines with content before the tag

**Location:** Task 3 Step 3, `_INCLUDE_LINE_RE` definition (line 862)

The regex `^[ \t]*\{%\s*include\s+['\"]([^'\"]+)['\"]\s*%\}[ \t]*\n?` with `re.MULTILINE` requires the `{% include %}` directive to be the only thing on its line (aside from leading/trailing whitespace). The spec §3.2 "Include placement rule" explicitly requires this ("must appear on their own line, with no surrounding text on the same line"), so the plan matches the spec. But the constraint is not enforced by the loader — a malformed inline include like `Text {% include 'x' %}` would silently pass the regex (no match, no expansion) and produce a render-time error from Jinja2. Consider adding a validation step that scans for any `{% include` not matched by the strict regex and reports it as a boot failure.

### Low — Task 7 Step 2 test for `call_with_prompt` accesses private symbols `_LLM_FACTORY` and `_LLM_CACHE`

**Location:** Task 7 Step 2 (lines 1770-1819), Step 4 (lines 1834-1891)

The test directly clears `_llm_helpers._LLM_FACTORY` and `_llm_helpers._LLM_CACHE`. These are private module-level dicts with no reset API. If `build_llm_config()` has already been called (e.g., in a prior test that imported the module), the factory contains production LLM builders. The test's `clear()` call wipes them without restoring. While the singleton-replacement contract makes this acceptable in test scope, the plan doesn't provide a teardown/restore mechanism. A fixture that snapshots and restores the factory state would be more robust.

### Low — `response_format_json.md.j2` partial doesn't use Jinja2 variables

**Location:** Task 5 Step 2 (lines 1444-1455)

The partial is static text — no `{{ }}` or `{% %}` directives. This means it passes through Jinja2 rendering unchanged. The plan creates it as a `.md.j2` file with front-matter (name, version, description), which is correct per the partial convention. But it's worth noting that a simple static text file with front-matter overhead may not justify the `.md.j2` extension — the front-matter parser and Jinja2 env initialization add overhead for what is effectively a string constant. The tradeoff is consistency (all partials are `.md.j2`) vs. simplicity. Flagging for awareness, not suggesting a change.

### Low — No parallelization guidance for Phase 2 service migrations

**Location:** Phase 2 "Service-by-service migration" (lines 1989-1997)

Tasks 8-12 migrate independent services with no shared state. The plan sequences them explicitly for risk management ("prove the base pattern first"), which is sound. But after Task 8 (ICP, the proving-ground migration) lands and validates the pattern, Tasks 9-12 could theoretically run in parallel on separate branches. The plan doesn't note this opportunity. For a solo executor this is moot; for a team execution it's a missed optimization.

### Nit — Mixed `backend/` path prefix convention

**Location:** Plan-wide; line 13 states the convention but application is inconsistent.

Some paths use `backend/app/core/prompts.py` (absolute from repo root), others use `app/core/prompts.py` (relative to `backend/`). The plan says "relative to repo root unless prefixed `backend/`, in which case relative to `backend/`" (line 13) — but this convention is backwards from normal expectation and applied inconsistently. No functional impact; just a cognitive tax on the reader.

### Nit — Task 8 "Verbatim source extraction protocol" step numbering starts at Step 1 but items within aren't checkboxes

**Location:** Task 8 Step 1 (lines 2073-2079)

The 6-item extraction protocol is descriptive guidance, not checkbox steps. It's embedded inside Step 1's checkbox. An executor might skip it as prose rather than treating it as mandatory sub-steps. Consider promoting these to checkbox items or marking them as mandatory.

### Nit — `qa_scout.md.j2` preserves 5x duplicated JSON directive

**Location:** Task 11 Step 4 (lines 2825-2831)

The plan correctly notes "5× duplication is a pre-existing manual-emphasis artifact... preserved verbatim." This is the right call for migration (no behavioral change). Flagging only because it's visually striking and a future cleanup candidate.
