---
artifact: specs/12-backend-loc-and-docstring-audit-phase-l-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-25
round: 2
---

## Context

Round 2 review of the spec after synthesis of round 1 findings. The spec has been revised: K4 site count corrected to 8, K2 baseline approach replaced git-stash with snapshot file, TD-004 acknowledgment added to §7, "frozen-intent" replaced with "committed audit record," date corrected, Phase J/K trigger clarified, K6/K7 estimates softened to ranges, and investigation soft cap expressed in agent-relevant terms. This round checks for residual issues from round 1 and new issues introduced or exposed by the revisions.

## Findings

### [High] Risk register R3 still says "7 inline sites" — synthesis revision missed it

**Location:** §8, Risk Register, R3: "K4 helper diverges from one of the 7 inline sites"

The K4 row in §6 was corrected from "7" to "8 call sites across 5 files" per round 1 synthesis (finding F1). The risk register entry R3, which directly references the same count, was not updated. This inconsistency will confuse implementers: §6 says 8, §8 says 7.

**Suggestion:** Update R3 to read "one of the 8 inline sites."

### [High] K7 scope contradiction: §3 limits to docstrings, §10 success criterion greps all text

**Location:** §3 out-of-scope / §6 K7 / §10 success criterion 5

§3 scopes TD-009 as "docstring drift cleanup." K7's behavior-preservation strategy (line 204) describes per-match evaluation of docstring content. But §10 criterion 5 runs the grep across all of `backend/app/`, matching code comments and inline comments in addition to docstrings.

At least 3 of the 25 current grep matches are in code comments, not docstrings:
- `signals/search.py:158`: `#    (extracted to signals.parsing during Phase H commit 19/20)`
- `signals/batch.py:1`: module docstring (borderline, but also a "from X in Phase Y" origin claim)
- `_llm_helpers.py:202`: inline comment in a docstring paragraph

If the scope is truly docstring-only, the success criterion's grep should exclude code comments, or §3 should be expanded to "docstrings and code comments containing stale Phase/commit references."

**Suggestion:** Either expand §3 scope to include code comments with stale Phase references, or add `--include='*.py'` with a narrower pattern that targets docstring-located matches. The simplest fix: change §3 to "docstring and code-comment drift cleanup" and be done with it.

### [Medium] K2 baseline file must be hardcoded string literals — spec should state this explicitly

**Location:** §6, K2 behavior-preservation strategy (line 199)

The revised strategy says the baseline file contains "module-level constants `CYPHER_GEN_PROMPT_BASELINE`, …" This could be interpreted as either (a) hardcoded string literal copies of the current prompt values, or (b) imports from `app.core.llm_config` re-exported under new names. Interpretation (b) would make the byte-equality assertion tautological — the baseline would track the refactor, not guard against it.

**Suggestion:** Add an explicit sentence: "Baseline constants are independent string literal copies of the pre-refactor values, not imports from the source module. They are written once and never updated by the refactoring process."

### [Medium] §5 scorecard example is ambiguous about being a template vs. pre-audited result

**Location:** §5, scorecard example (lines 134–167)

The scorecard example shows specific findings for `market_research/orchestrator.py` (unused imports at named symbols, near-duplicate functions with hash `ce5d84bd`) that exactly match known wins K1 and K3 from §6. The `fetch_company_profile` cross-cutting finding lists exact line numbers. An implementer could reasonably interpret this as a pre-audited result and skip re-examining those files during Stage 1.

The spec should mark this section as a format illustration only. §5 does say "Key properties: Every one of the 91 files appears at least once" but doesn't disclaim the example's specificity.

**Suggestion:** Add a one-line disclaimer before the example: "The following is a format illustration using representative findings; actual audit results may differ." Alternatively, use clearly fictional file names and findings in the example.

### [Medium] K4 behavior-preservation relies on "existing tests for the 5 consuming services" — coverage may be thin

**Location:** §6, K4 behavior-preservation strategy (line 201)

The strategy says: "Existing tests for the 5 consuming services continue to pass." Tests do exist (`test_signals_v2.py`, `test_icp.py`, `test_market_scoring.py`, `test_data_sources.py`), but per TD-004 they use stub fixtures (`_stub: true`, 4–6 key minimal shapes). These tests verify structural integrity against stubs, not behavioral correctness against real data.

For K4 (extracting a Cypher query helper), the stub-based tests should be sufficient — they confirm the code paths still reach the same points. But the spec should acknowledge this explicitly for K4, as it did for K2/K3 in §7. As written, the §7 TD-004 note says the limitation "doesn't apply" to K4 (because K4 doesn't touch LLM paths), which is accurate for the LLM dimension but could mislead a reader into thinking the tests are comprehensive.

**Suggestion:** In K4's behavior-preservation strategy, note that "existing tests are stub-fixtured and confirm structural preservation; the primary evidence for K4 is the line-by-line call-site inspection during Stage 1 audit confirming each site's return-value shape matches the helper's contract."

### [Medium] Investigation soft cap's "immediate call sites" is undefined

**Location:** §2 Stage 2 (line 36), §4 investigation methodology (line 99)

The revised soft cap reads: "an investigation defers if it requires reading more than 5 files beyond the immediate call sites." The term "immediate call sites" is ambiguous: does it mean only direct callers of the affected symbol, or the full call chain to some depth? For a function called by 3 callers, each called by 5 more, "immediate" could mean 3 files or 18 files.

**Suggestion:** Replace "immediate call sites" with "direct callers of the affected symbol" (or equivalent) to make the scope unambiguous.

### [Low] Scorecard format for clean files may produce a 91-subsection document

**Location:** §5, scorecard format (line 148): `_audited; clean_`

The example shows clean files as a one-liner. If ~60 of the 91 files are clean, the scorecard will have 60 subsection headings each containing one line. This is valid but potentially verbose. The spec doesn't specify an alternative grouping (e.g., a "Clean files" table listing filenames in a compact format).

**Suggestion:** Consider adding an option for clean-file grouping: "Files with no findings may be listed in a compact table under a single `## Clean files` heading rather than each getting its own `###` subsection." This is a format preference, not a correctness issue.

### [Low] No total effort or session estimate for the phase

**Location:** §2 (overall)

The spec estimates ~430 LOC savings but doesn't estimate the total effort (e.g., number of agent sessions, approximate token budget, or wall-clock time). For a 91-file audit across three stages, this is a multi-session task. An effort estimate would help with planning and checkpointing.

**Suggestion:** Add a rough estimate: "Expected: 3–5 agent sessions (Stage 1 audit, Stage 2 investigation, Stage 3 execution split across 2–3 sessions by risk tier)."

### [Nit] K5 line numbers are verified correct for the current codebase

**Location:** §6, K5 row: "lines 48, 55, 69, 83, 97, 112, 162, 173, 192, 208"

Confirmed: `run_coll.update_one` appears at exactly those 10 lines in `services/market_scoring/scoring.py`. No issue — noting for the record since Stage 1 audit should re-verify if any edits land before Phase L begins.

### [Nit] §9 merge strategy says "fast-forward" but doesn't address the impl-review-has-findings path

**Location:** §9: "Merge strategy: fast-forward into master after impl review verdict is clean"

If the impl review produces actionable findings, the spec doesn't describe the cycle (fix → re-review → merge). The Phase J/K pattern is referenced implicitly. No action needed — the pattern is established — but an explicit "if findings: fix and re-review" clause would remove ambiguity for first-time readers.
