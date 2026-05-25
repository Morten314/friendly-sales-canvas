---
artifact: specs/12-backend-loc-and-docstring-audit-phase-l-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-25
round: 1
---

## Findings

### [Critical] K4 call-site count is wrong and target file's existing contents are ignored

**Location:** §6, K4 row and K4 behavior-preservation detail

K4 claims "7 call sites across 5 files" for `fetch_company_profile` extraction. Actual count from the codebase: `customer_profile/orchestrator.py` has 3 inline Cypher matches (lines 31, 153, 319), `market_scoring/persistence.py` has 1 (line 109), `market_research/orchestrator.py` has 1 nested def (line 228), `icp/orchestrator.py` has 1 nested def (line 286), `signals/ask.py` has 2 inline matches (lines 44, 133). That is **8 sites, not 7**.

More critically, K4 proposes extracting to `services/_neo4j_helpers.py` without acknowledging that this file **already exists** at 71 LOC containing `query()`, `results_to_string()`, `escape_property_name()`, and `upsert_node()`. The plan must account for integrating with existing content (imports, naming collisions, docstring) or choose a different target file.

**Suggestion:** Correct the site count to 8. Add a note that `_neo4j_helpers.py` exists and specify whether `fetch_company_profile` is appended to it or placed in a new module.

---

### [Critical] K2 behavior-preservation strategy relies on fragile git-stash workflow

**Location:** §6, "Behavior-preservation strategy per known win" → K2

> "implementation writes a temporary script that imports both pre-refactor constants (via stash apply of a baseline) and the post-refactor base+overlay assembly"

Using `git stash apply` mid-execution to compare old and new constants is fragile: it requires a clean working tree, risks merge conflicts in the stash, and assumes the stash contains only the relevant file. If other files are dirty (which is likely during a multi-commit phase), the stash will include unrelated changes.

**Suggestion:** Replace with a simpler approach: snapshot the current string values to a temporary file or inline constants *before* refactoring, then assert byte-equality against those snapshots after. No git operations needed. Example: write the 4 current strings to `tests/_snapshots/llm_config_baseline.py` in the K2 commit, then assert `assembled == baseline` in the test.

---

### [High] Verification framework depends on stub-fixtured test suite (TD-004)

**Location:** §7, "Per-task verification" and "Final verification"

§7 mandates `pytest tests/services/<affected_module>` and `pytest` (full suite) as verification gates. However, per TD-004, all captured fixtures in `backend/tests/fixtures/captured/*.json` are stubs with `_stub: true` and 4–6 key minimal shapes. Tests assert against this stub shape, not real LLM output.

For pure structural refactoring (extracting helpers, deduplicating code), stub-based tests are a valid safety net — if the code structure is preserved, stubs still match. But the spec should acknowledge this limitation: the test suite can confirm structural preservation, not behavioral correctness against real data. This is especially relevant for K3 (collapsing `Research_Market_1..5`), where the parametrized test will assert against stub fixtures.

**Suggestion:** Add a note to §7 acknowledging TD-004 and stating that pytest confirms structural preservation only. Alternatively, consider K2/K3 byte-equality assertions (which the spec already specifies) as the primary evidence, with pytest as a secondary smoke test.

---

### [High] K5 and K4 LOC estimates are unsubstantiated

**Location:** §6, K5 row (-50 LOC) and K4 row (-50 LOC)

**K5** claims -50 LOC from extracting `_update_run(run_coll, run_id, **fields)` replacing 10 `update_one` call sites in `scoring.py` (217 LOC total). Each `update_one` call is 1–2 lines; the helper definition is ~3 lines; each call-site replacement is roughly 1 line. Net savings: ~(10 × 2) − 3 − 10 = ~7 LOC, not 50. Unless the `update_one` calls have multi-line dict constructions (3–5 lines each), the estimate is inflated. The spec provides no line-level evidence.

**K4** claims -50 LOC. The 8 call sites break into: 5 inline Cypher strings (~1–3 lines each with session boilerplate) and 2 nested function definitions (~10–15 lines each) plus 1 inline in `market_scoring`. Rough estimate: 5×3 + 2×12 + 3 − 10 (helper) = ~35 LOC. Closer to 50 is possible if the session boilerplate at each site is larger than assumed, but the spec doesn't show the actual code.

**Suggestion:** For each known win, include representative code snippets (or line ranges) from the current codebase showing the pattern to be consolidated. This allows the reviewer to verify the LOC estimate and the reviewer/executor to confirm the behavior-preservation claim.

---

### [High] K3 fixture generation process is underspecified

**Location:** §6, K3 behavior-preservation detail

> "Fixtures are generated from the pre-refactor functions on a baseline branch."

This sentence raises several questions: What baseline branch? How are fixtures generated — a script, manual copy, or automated capture? Where do fixtures live — `tests/fixtures/`? The spec assumes the implementer knows the fixture convention, but this is a cross-stack spec consumed by AI agents that need explicit instructions.

Additionally, the parametrized test calls `template.format(company_profile_json=<fixture>)` — but the current `Research_Market_1..5` functions don't appear to take a `template` parameter (they take `agent_chain, pre_data, llm_backend`). The spec's test description doesn't match the function signatures visible in the codebase.

**Suggestion:** Specify the fixture directory, the generation method, and reconcile the test description with actual function signatures. If the post-refactor `_run_research_component(template)` is a new function with a different signature, the test should describe testing the new interface, not the old one.

---

### [Medium] Scorecard described as "frozen-intent" but updated twice

**Location:** §5: "Frozen-intent artifact, committed once at end of Stage 1, updated once at end of Stage 2."

The phrase "frozen-intent" implies immutability, yet the scorecard is explicitly updated in Stage 2. Each update (Stage 1 commit, Stage 2 commit) is itself a frozen snapshot, but calling the artifact "frozen" is misleading when it has two versions.

**Suggestion:** Replace "frozen-intent artifact" with "versioned audit record" or "committed audit record" and clarify that each stage's commit represents a frozen snapshot at that point in time.

---

### [Medium] No minimum LOC bar in success criteria

**Location:** §10, Success criteria

The spec has 8 success criteria, none of which mention LOC reduction. TD-008's framing says "the goal is not to hit a target LOC count," which is reasonable, but the known wins (K1–K7) total ~430 LOC. If Stage 3 execution somehow produces 0 LOC reduction (all findings reverted), the phase would still "succeed" per the written criteria. This creates a gap between intent (reduce LOC) and verifiable success.

**Suggestion:** Add a criterion like: "Known-wins K1–K7 are fully executed with their stated LOC savings ±20% (emergent; no per-task minimum)." Or, more conservatively: "Stage 3 commits collectively reduce `backend/app/` LOC by ≥300 lines from the 10,403 baseline."

---

### [Medium] Date anomaly — spec dated tomorrow

**Location:** §1 header: "**Date:** 2026-05-26"

Today is 2026-05-25. The spec is dated one day in the future. Minor but affects traceability — future readers comparing the spec date against commit dates or audit artifacts may be confused.

**Suggestion:** Use the actual creation/review date, or note that the date is the planned execution date.

---

### [Medium] Spec references Phase K as completed but doesn't verify structural stability claim

**Location:** §1: "Phase K closed the last structural-decomposition item by converting the six remaining flat services to packages."

The spec uses Phase K's completion as justification for "the codebase shape is stable." But the TD-008 entry in TECH_DEBT.md (line 104) says the pull-forward trigger is "after Phase J (decomposing remaining flat services) completes" — it doesn't mention Phase K. There's an implicit assumption that K is a superset of J or that J was absorbed into K. This should be explicit.

**Suggestion:** Add a one-line note clarifying the Phase J → Phase K relationship and confirming that all structural decomposition is complete.

---

### [Medium] K6 call-site count doesn't match the stated pattern

**Location:** §6, K6 row: "replace 11 call sites"

The spec claims 11 instances of `db = mongo["File_Processing"]; collection = db["file_status"]` across `data_sources/persistence.py` and `data_sources/pipeline.py`. My count shows 4 references to `"File_Processing"` in persistence.py and 7 in pipeline.py = 11 total references, but not all 11 are necessarily the two-line pattern `db = …; collection = …`. Some may be one-liners like `mongo["File_Processing"]["file_status"]` or references in comments/strings.

**Suggestion:** Verify that all 11 references are the exact two-line boilerplate pattern, not partial matches. The LOC savings estimate of -22 (11 × 2 lines − ~0 helper overhead) assumes each site is exactly 2 lines.

---

### [Medium] K7 LOC estimate of ~-90 from 25 grep matches is not mechanically derivable

**Location:** §6, K7 row: "~-90" LOC, "25 grep matches"

25 grep matches hit the targeted patterns, but LOC savings depend on how many lines each match's surrounding docstring occupies. Some matches are single-line comments within multi-line docstrings; others are entire docstrings that will be removed. The -90 estimate is an assumption about average docstring length per match, not a verified count.

**Suggestion:** Break down: N matches where the docstring is removed entirely (X LOC), N matches where a line/subsentence is edited (Y LOC). This would make the estimate auditable.

---

### [Low] R7's 60-minute soft cap doesn't translate to AI-agent execution

**Location:** §4, "Investigation methodology (Stage 2)": "soft cap: any single investigation that's still inconclusive after ~60 minutes of focused reading"

Wall-clock time is meaningful for human developers but not for AI-agent sessions, which are bounded by token budgets and session continuity. The cap should be expressed in terms of agent-visible resources.

**Suggestion:** Replace "~60 minutes" with an agent-relevant bound, e.g., "~3 full read-analyze cycles of the affected call sites" or "if the investigation requires reading more than 5 files beyond the immediate call sites."

---

### [Low] Opportunity categories 11–12 are out of scope but receive full taxonomy entries

**Location:** §4, opportunity categories table, rows 11–12

Categories 11 (redundant fallback branches) and 12 (long string literals worth hoisting) are tagged `design-discussion` and explicitly deferred per §3's out-of-scope list. They occupy taxonomy space and a risk-register entry (R8, R10) but no execution will happen. The spec's §2 already documents the alternative-considered reasoning.

**Suggestion:** This is a style preference, not a defect. The taxonomy is complete and educational for future readers. Leaving as-is is fine, but a reviewer should note that ~10% of the spec's §4 space discusses work this phase won't do.

---

### [Low] §5 scorecard example references files/lines that may not match current codebase

**Location:** §5, scorecard example

The illustrative scorecard shows `backend/app/services/market_research/orchestrator.py (288 LOC)` with specific line references (31, 153, 319 for customer_profile). The current file is indeed 288 LOC, and the line references match the grep output. However, the example is presented as an illustration, not a commitment — the actual audit may find different things. No action needed, but future readers should be aware this is a template, not a pre-audited result.

---

### [Nit] §9 commit message style contradicts TD-009 cleanup intent

**Location:** §9: "No `[N/M]` numbering (Phase L commits are bounded by the scorecard, not by a fixed task count)."

This is a good decision (no false finality in commit messages), but the spec doesn't address whether the scorecard file itself will contain `[N/M]`-style references that TD-009 would later flag. The scorecard's format (§5) doesn't use such references, so this is consistent.

---

### [Nit] Typo in scorecard example

**Location:** §5, scorecard example: `"regulatory & compliance highlights" : Research_Market_4`

Inconsistent spacing around the colon (space before, space after) vs other entries in the same dict that use consistent `"key": value` formatting. This is copied from the actual codebase (line 189 of `market_research/orchestrator.py`), so the spec is accurately reflecting the source — but if K3 collapses these, the new code should fix the inconsistency.

---

### [Nit] TD-009 grep pattern may miss variants

**Location:** §10, criterion 4; §6, K7

The grep pattern is: `Phase [A-Z]|commit [0-9]+/[0-9]+|extracted from .* in Phase|final form|Renamed.*in Phase`

Actual grep output shows 25 matches including hits like `"Phase I commit 5/11"`, `"Phase H commit 7/20 final form"`, `"Phase I final form"`, `"extracted from orchestrator.py in Phase I"`, `"Renamed from documents/ in Phase H"`. The pattern covers the observed variants. However, it won't catch references like `"Phase H scope"` or `"Phase I unification"` or `"Phase H Sequence A"` which also appear in the grep output. These are borderline — some are structural references (legitimate), others are stale origin claims (should be cleaned).

**Suggestion:** Decide whether the cleanup scope is the exact 5-pattern grep or a broader "remove all phase-origin references from docstrings" pass. The current wording commits to the 5-pattern grep, which is narrower than what TD-009's description ("stale Phase/commit references") implies.
