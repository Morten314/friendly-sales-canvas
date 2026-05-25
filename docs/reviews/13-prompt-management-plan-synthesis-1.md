---
synthesizes_review: docs/reviews/13-prompt-management-plan-review-1.md
artifact: plans/13-prompt-management.md
artifact_type: plan
reactor_model: claude-opus-4-7
date: 2026-05-25
round: 1
---

## Round Recommendation

no

Reason: All High-severity findings agreed and applied; remaining open items are Low/Nit, deliberate scope deferrals, or substantive disagreements that wouldn't shift in another round.

## Agreed Findings

- **High — Task 11 Step 6 filter contradicts front-matter names.** Filter `startswith('llm_config_')` matched nothing after the naming rename to bare stems; fixed to explicit name set `{'cypher_gen', 'cypher_gen_alt', 'qa_scout', 'qa_scout_alt'}` and updated expected output to match.
- **High — Task 11 Step 8 equivalence test compares the wrong artifacts.** Verified the deeper bug: legacy baselines use Python `{schema}` placeholders, `as_langchain()` builds with `template_format="jinja2"` producing `{{ schema }}`. Comparing `pt.template` against baseline would fail not because of byte drift but because of placeholder syntax. Rewrote the test to compare *rendered* outputs with sentinel values (`__SCHEMA_SENTINEL__` etc.). Reviewer flagged at Medium; I upgraded to High because the test as written could not have passed.
- **High — No abort/recovery criteria.** Added a top-level "Abort criteria" section listing six halt conditions (red baseline, unresolved regression, production boot failure, scope explosion, performance budget, byte drift) plus the explicit `git revert` recovery protocol. Resolves findings #2 and #3 together.
- **Medium — Task 8 step numbering gap.** Steps jumped 1 → 4 due to my earlier edits collapsing Steps 1-3 into a single Step 1. Renumbered Steps 4-14 down to 2-12.
- **Medium — Phase 1 commit count departs from spec's "3-4".** Added a one-paragraph note at the Phase 1 header explaining the 6-commit decomposition (TDD-per-concern at the `app/core/prompts.py` boundary, per CLAUDE.md's small-commits guidance).
- **Medium — `test_prompts_golden.py` state bleed.** Added an autouse fixture `_reinit_production_registry` that calls `init_registry(root=PROMPTS_ROOT)` before each test. Module-level init stays for `@parametrize` collection time; the fixture handles cross-test-module pollution from `test_prompts_loader.py`'s `tmp_path` mutations.
- **Low — No baseline check before Task 1.** Added Step 0 to Task 1: run `pytest` and confirm exit 0 before any migration work begins. Explicit "halt and report" instruction if the suite is already red.
- **Low — Task 7 tests mutate private factory state without restore.** Replaced inline `_LLM_FACTORY.clear()` with a new `isolated_llm_factory` fixture that snapshots+restores both `_LLM_FACTORY` and `_LLM_CACHE`. Task 12's `_register_fake_qwen` updated to the same snapshot/restore pattern.
- **Medium — Task 11 Step 8 baseline file precondition.** Added a sentence noting the baselines pre-exist at `backend/tests/_baselines/llm_config_prompt_strings.py` and are validated by the existing `test_llm_config_prompts.py` (which the plan deletes only *after* this equivalence test is in place). Includes an explicit "confirm by running the existing test first" instruction.

## Disagreed Findings

- **Medium — `signals_leads_section` and `signals_existing_headlines_section` are registered as callable.** Reviewer argues making them callable creates a misleading API surface. I disagree: their callability is a deliberate testability win — they get their own golden fixtures and isolated unit tests via the same parametrized `test_golden_render` mechanism. The "API surface" concern is theoretical (no production code calls them; the loader doesn't enforce non-callability; spec §3.1's `_shared/` rule explicitly doesn't extend to service subdirs). Moving them to `_shared/` would break service-locality without solving anything. Leaving as is; will note the convention in `docs/PROMPTS.md` (Task 14).
- **Nit — Task 8 verbatim-extraction protocol is prose, not sub-checkboxes.** Reviewer suggests promoting the 6-step protocol to checkbox items. I disagree on Nit basis: the protocol *is* the substance of Step 1 (it tells the executor how to extract the body). Promoting to sub-checkboxes would over-formalize what's a single mechanical translation, and would push file-creation across multiple "task boundaries" that aren't real. Leaving as is.

## Deferred Findings

- **Low — `_expand_includes` regex won't catch inline includes.** Reviewer suggests adding boot-time validation that scans for any `{% include` not matched by the strict regex. Deferring because spec §3.2 explicitly defers enforcement to authoring convention ("the constraint is not enforced by the loader but is an authoring rule"). The cost of detection is loader complexity for a rare error case where Jinja2's runtime resolution would handle the include anyway (with a content-hash invariant break, which is the only real cost). Trigger to pull forward: first prompt edit where an author accidentally writes an inline include and the resulting content_hash mismatch causes observability confusion.

## Severity Disagreements

- **Finding #4 (baseline equivalence test).** Reviewer assigned Medium; I assigned High after verifying the test as written cannot pass. The placeholder-syntax mismatch (`{schema}` vs `{{ schema }}`) is not a "verify baselines are correct" concern — it's "the test compares incomparable strings." The fix is structural, not validation. Recording the upgrade explicitly so the reviewer sees the reasoning.

## Open Questions

- **Path-prefix convention (Nit #14).** Reviewer flags mixed `backend/app/core/prompts.py` (absolute from repo root) vs `app/core/prompts.py` (relative to `backend/`) usage. The plan's File Map line states the convention ("relative to repo root unless prefixed `backend/`, in which case relative to `backend/`") but applies it inconsistently. Did not do a full sweep — the executor running `git add` / `pytest` commands as written shouldn't be confused, but a future reader scanning for file references may stumble. Not blocking, not addressed in this revision. Trigger to fix: first executor reports confusion.
- **Phase 2 parallelization (Low #13).** Reviewer notes Tasks 9-12 could run in parallel after Task 8 proves the pattern. Plan assumes solo subagent-driven or solo inline execution. If team execution becomes the mode, a separate "parallelization guide" doc would be useful but is out of scope here.
- **`response_format_json.md.j2` overhead (Low #12).** Reviewer notes a static-text partial doesn't strictly need `.md.j2` extension but the convention demands it. No change suggested; flagged for awareness only.
