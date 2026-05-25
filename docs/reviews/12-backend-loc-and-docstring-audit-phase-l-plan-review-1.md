---
artifact: plans/12-backend-loc-and-docstring-audit-phase-l.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-25
round: 1
---

## Findings

### [Medium] Spec §7 import smoke test omitted from all K-task verification steps

**Location:** All Stage 3 tasks (K1–K7); spec §7 "Per-task verification" item 1.

The spec requires each Stage-3 commit to pass three verification gates: (1) import smoke test `python -c "from app.main import app; print('imports OK')"`, (2) module-scoped pytest, (3) task-specific behavior-preservation evidence. The plan includes gates 2 and 3 for every K-task but omits gate 1 entirely.

This matters most for K1 (unused-import removal) — the primary risk of that task is removing an import that's used at module load time but not detectable by pyflakes (e.g., side-effect imports, decorator registrations, or imports consumed via `getattr`/`__all__`). K1 already uses pyflakes as its primary evidence, which covers the common case. But the spec explicitly requires the import smoke test as a defense-in-depth check, and the plan's full-pytest gate may not exercise `app.main`'s import graph if no test file imports it directly.

**Recommendation:** Add a "Run import smoke test" step (matching spec §7's exact command) to K1 at minimum, and optionally to all K-tasks as a cheap (<2s) safety net.

### [Low] K3 Step 6 illustrative `_run_research_component` body may diverge from actual `Research_Market_1`

**Location:** Task K3, Step 6 (lines 866–901).

The plan shows an illustrative implementation of `_run_research_component` with specific `json.dumps(pre_data, indent=2)` / `json.loads(pre_data)` branching logic. However, Step 1's AST hash check only verifies that the 5 original functions are byte-identical *after template-name normalization* — it doesn't verify that the illustrative code matches the actual function body. The plan's prose says "The body comes verbatim from `Research_Market_1` (lines 43–69)", but the code block that follows is labeled as illustrative and includes a specific JSON-serialization strategy that may not match the originals.

The byte-equality test (Step 7) only asserts `_build_research_prompt` output, not `_run_research_component`'s full behavior. Existing stub-fixtured tests may not catch differences in JSON serialization because they mock the LLM call. An executor who copies the illustrative code verbatim (rather than deriving from the actual source) could introduce a behavioral change in how `pre_data` is serialized before being passed to the template.

**Recommendation:** Either (a) remove the illustrative body and rely on Step 1's AST extraction to produce the canonical body, or (b) add a note explicitly stating the illustrative code is a structural guide only and the executor MUST copy the actual `Research_Market_1` body character-for-character, replacing only the template-name reference with the dispatch.

### [Low] K4 helper's `is not None` check differs from original sites' truthiness check for empty-string `org_id`

**Location:** Task K4, Step 2 (helper definition at lines 1275–1281) and Step 4 (fallback-site replacement at lines 1357–1364).

The helper uses `if org_id is not None` to decide between filtered and unfiltered queries. The original fallback sites (e.g., `market_research/orchestrator.py` and `icp/orchestrator.py`) use `if request.org_id:`, which treats empty string `""` as falsy (triggers fallback-to-any). With the helper, passing `org_id=""` would execute `MATCH ... {org_id: $org_id}` with `org_id=""` (returning None since no node has empty org_id) instead of the fallback `MATCH (c:CompanyProfile) RETURN c LIMIT 1`.

This edge case likely never occurs (org_id is always a non-empty string or None from upstream), and the helper's signature matches the spec's design. But it is a genuine behavioral difference at the boundary, and the plan's Step 1 ("Confirm Stage 1's per-site verification") doesn't explicitly flag this truthiness-vs-identity distinction.

**Recommendation:** Either (a) note this behavioral difference in the scorecard as an accepted trade-off (empty-string org_id produces a "not found" error instead of a fallback-to-any match, which is arguably more correct), or (b) adjust the helper to use `if org_id:` instead of `if org_id is not None` to preserve the original truthiness semantics exactly.

### [Low] K2 baseline generation mechanism differs from spec's literal description

**Location:** Task K2, Step 1 (lines 1013–1048); spec §6 K2 strategy.

The spec says baseline constants must be "independent hardcoded string literal copies of the pre-refactor values — written by reading the current `llm_config.py` contents and copying the literals into the baseline file." The plan generates baselines by importing the live values from `app.core.llm_config` and serializing via `repr()`. The result is functionally equivalent — the baseline file contains standalone hardcoded literals that won't change when `llm_config.py` is refactored. But the mechanism differs from the spec's described approach.

This is acceptable because the spec's concern ("NOT imports or re-exports from `app.core.llm_config`") is about preventing tautological assertions, and the plan's approach generates a one-time dump to an independent file — the baseline file has no import dependency on `llm_config.py` after generation. The test imports both sources independently, so the assertion is not tautological.

**Recommendation:** Add a one-line note to Step 1 clarifying that `repr()`-based generation is an equivalent mechanism that satisfies the spec's non-tautological requirement.

### [Nit] Plan summary undercounts total commits by 1

**Location:** "Plan summary" table and final line (lines 1794–1802).

The summary states "Total commits: 10 + N". Counting: Stage 1 (1) + Stage 2 (1) + Stage 3 K1–K7 (7) + N audit-surfaced + Final review (1) + Final TD-update (1) = 11 + N. The Final row in the table correctly shows "1 (review) + 1 (TD-update)" = 2 commits, but the total below the table says 10 + N instead of 11 + N.

### [Nit] Inconsistent `cd` command styles within tasks

**Location:** Throughout. Some steps use absolute paths (`cd /projects/Brewra/brewra-gtm-intelligence`), others use relative paths (`cd backend`). For example, Task K5 Step 5 uses `cd /projects/Brewra/brewra-gtm-intelligence/backend` (absolute) while Step 6 uses no `cd` (implying the working directory carries forward). No functional impact, but an executor relying on shell session state between steps could be confused.
