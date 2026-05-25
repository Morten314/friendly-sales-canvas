---
artifact: specs/12-backend-loc-and-docstring-audit-phase-l-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-25
round: 3
---

## Context

Round 3 review. Rounds 1 and 2 produced 15 findings total; all were synthesized into the spec (commits 55a7880, e3d5458). This round checks for residual issues from prior rounds and identifies new concerns in the post-synthesis spec. Factual claims (91 files, 10,403 LOC, line numbers, grep match counts) were verified against the current codebase and confirmed accurate.

## Findings

### [High] Verification command still references non-existent `tests/services/` path

**Location:** §7 "Per-task verification," item 2: `cd backend && .venv/bin/python -m pytest tests/services/<affected_module>`

This finding survives from round 1 (review-1 §7 finding) and round 2 (not flagged there). The directory `backend/tests/services/` does not exist. Tests are at `backend/tests/unit/test_<module>.py` (unit) and `backend/tests/test_<module>.py` (integration). Running the specified command will fail with a path-not-found error, blocking the per-task verification gate during Stage 3 execution.

**Suggestion:** Replace `tests/services/<affected_module>` with `tests/ -k <affected_module>` or specify the actual paths: `tests/unit/test_<module>.py tests/test_<module>.py`.

### [Medium] K4 pre-classifies `signals/ask.py` alias variant as "semantically equivalent" — should remain an open question

**Location:** §6 K4 description: "alias variant in `signals/ask.py` uses `p:`/`RETURN p`, semantically equivalent for the fetch use case"

The spec acknowledges the alias difference but asserts equivalence upfront. The `p:` alias returns a dict keyed by `p` instead of `c`; if any consuming code accesses the result by key name, the extraction would change behavior. The spec's own mitigation — "sites with non-trivial deviations stay inline" — is sound, but pre-classifying this site as equivalent contradicts the audit-first methodology. The determination should emerge from Stage 1's line-by-line inspection, not precede it.

**Suggestion:** Rephrase to: "alias variant in `signals/ask.py` uses `p:`/`RETURN p` — equivalence to the `c:` pattern is verified during Stage 1 line-by-line inspection; the site stays inline if any deviation exists."

### [Medium] K2 and K3 behavior-preservation strategies prescribe implementation details beyond spec scope

**Location:** §6 "Behavior-preservation strategy per known win," K2 and K3 paragraphs

K2 specifies exact file paths (`backend/tests/_baselines/llm_config_prompt_strings.py`), exact constant names (`CYPHER_GEN_PROMPT_BASELINE`), and an implementation prohibition ("NOT imports or re-exports"). K3 prescribes either a `_build_research_prompt` helper or a `return_prompt: bool` switch — those are implementation choices. Round 2 correctly required the "independent hardcoded copies" clarification, but the spec still over-specifies the file layout.

A spec should define the *quality bar* (baseline must be independent copies; byte-equality must be asserted) and leave file paths, naming, and seam design to the plan. The current detail level reduces the plan's room to adapt during execution.

**Suggestion:** Extract requirements into the spec ("baseline constants are independent hardcoded string literal copies, not imports; pytest asserts byte-equality"). Move file paths and test names to the plan.

### [Medium] Success criterion 5 and K7 grep pattern share false-positive risk with no carve-out

**Location:** §10 criterion 5; §6 K7

The TD-009 closure check requires 0 matches for `grep -rnE 'Phase [A-Z]|commit [0-9]+/[0-9]+|extracted from .* in Phase|final form|Renamed.*in Phase' backend/app/`. Two patterns are broad:

- `final form` matches any occurrence of that phrase, including legitimate text unrelated to phase origin claims (e.g., "the final form of the data structure").
- `Phase [A-Z]` matches any reference to a phase letter, including legitimate cross-references added by Phase L itself (e.g., "restructured in Phase L" in a new docstring).

A single false positive blocks phase completion per the written criterion.

**Suggestion:** Either (a) tighten `final form` to `final form[.;]` or similar, (b) add a carve-out allowing documented false positives that are reviewed and confirmed as non-drift, or (c) run the closure check on `backend/app/` excluding files modified by Phase L's own commits.

### [Medium] Category 12 occupies taxonomy space for work explicitly deferred out of scope

**Location:** §4 taxonomy table, cat 12; §3 out-of-scope deferrals, bullet on "Low-confidence opportunities (cat 11, 12)"

Cat 12 ("Long string literals worth hoisting") is tagged `design-discussion` and explicitly deferred in §3. It appears in the taxonomy, gets a risk-register entry (R8), but no execution will happen. During Stage 1, an auditor who encounters a cat-12 finding must decide whether to record it — the taxonomy says it exists, §3 says it's out of scope. This is a minor contradiction.

**Suggestion:** Either remove cat 12 from the taxonomy (and add a note in §3 that string-hoisting may surface and should be logged for TD-010), or add an explicit instruction: "Cat 11 and 12 findings are recorded in the scorecard under a 'Deferred' section but not acted on."

### [Low] §1 phase-numbering note is over-explained for a frozen-record document

**Location:** §1, "Note on phase numbering" paragraph (4 lines)

The note explains that TD-008 says "Phase J" but Phase K completed structural decomposition, and that "the trigger semantics are satisfied." This is accurate but verbose. The trigger is "after structural decomposition is complete" — Phase K completed it. One sentence suffices.

### [Low] "Phase J/K pattern" referenced three times without citation

**Location:** §9 item 4; §9 "Merge strategy"; §10 criterion 8

The spec references "the Phase J/K pattern" for the impl review and merge strategy without linking to or describing it. A reader unfamiliar with those reviews must search the repo. A file path reference (e.g., `docs/reviews/…`) would improve self-containedness for a frozen-record document.

### [Low] K6 site count "~10-11" is verifiable but stated as a range

**Location:** §6 K6 description

Verification confirms exactly 11 occurrences (4 in `persistence.py`, 7 in `pipeline.py`). The spec acknowledges "exact count confirmed during Stage 1 audit" but the tilde-range on a verifiable integer is unnecessarily vague for a known win.

### [Nit] Cat 8-9 mechanism descriptions less precise than cats 1-7

**Location:** §4 taxonomy table

Categories 1-7 have precise mechanical verification criteria ("AST normalize + hash," "Grep matches"). Cat 9 says "whole-repo grep finds zero references" then qualifies with a caveat about dynamic access with no mechanical check. Minor asymmetry in the taxonomy's precision.

### [Nit] "scorecard" vs "audit scorecard" used interchangeably

**Location:** Throughout the spec

The spec uses both terms for the same artifact. The scorecard format section (§5) uses "audit record"; §2 uses "scorecard." Pick one term.
