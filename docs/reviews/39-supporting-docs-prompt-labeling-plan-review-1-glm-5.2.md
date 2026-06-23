---
artifact: plans/39-supporting-docs-prompt-labeling.md
artifact_type: plan
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-22
round: 1
---

## Context

Reviewed against the paired spec `specs/39-supporting-docs-prompt-labeling-design.md`
(rounds 1–2 already synthesized). Plan and spec both live on the
`fix-supporting-docs-labeling` worktree; review written there. The plan is
genuinely high-quality — tightly scoped, exact old/new diffs, correct threading
on the keyword/positional hazards, and explicit spec-divergence documentation.
Findings below are coverage/calibration gaps, not structural defects.

## Findings

### [Medium] Claude-dispatch path is untested — the exact hazard the plan warns about twice

**Location:** Global Constraints ("Threading is by KEYWORD, never positional
before `llm_backend`"); Task 3 Step 3 test (`llm_backend="qwen"`); Task 4 Step 3
test (`llm_backend="qwen"`).

The plan calls out, in two places, that a positional `supporting_documents`
inserted before `llm_backend` would bind `"claude"`→docs and **silently revert
the Claude path to the Qwen default**. Yet every market/ICP test the plan adds
runs `llm_backend="qwen"`. Neither `COMPONENT_FUNCTIONS_CLAUDE` (Task 3) nor
`ICP_FUNCTIONS_CLAUDE` (Task 4) is ever exercised — the existing per-component
tests patch the dispatch dicts with `MagicMock` fakes, so they don't cover the
real claude lambdas either. The signal-ask alignment test (Task 5) covers only
the qwen `signal_ask` call site, not the claude one.

This matters more than a generic coverage gap: per the repo's own architecture
notes, the `_claude` variants are **the path the frontend actually calls** for
Scout/Profiler generation and ICP/market research. A mis-threading introduced
during implementation (the plan's written code is correct, but the hazard
exists precisely because it's easy to get wrong) would change production model
selection with zero test signal. Recommend at least one claude-path assertion
per dispatch surface — even a cheap unit test that invokes each
`*_CLAUDE` lambda and asserts `supporting_documents` is forwarded (and
`llm_backend="claude"` survives) closes the loop.

### [Low] "Omitted when absent" not asserted at the integration level (spec drop)

**Location:** Spec §Testing ("retrieval patched to `[]` → section **absent** (no
empty header)"); Task 2 Step 5, Task 3 Step 3, Task 4 Step 3 tests (all patch
non-empty `SUPPORTING_DOC_ROWS`); AC1.

The spec explicitly lists a per-surface empty-retrieval assertion. The plan's
per-surface tests only cover the present case; the absent case is delegated to
the Task 1 helper unit test, which never exercises the `{% include %}` +
`{% if supporting_documents %}` Jinja guard. The guarantee holds by
construction (the label sits inside the `{% if %}`), so the worst realistic
leak is a cosmetic blank line around the include — but the spec's "no empty
header" assertion was dropped, and a Jinja include is exactly where
whitespace/newline artifacts hide. One empty-rows assertion on a single surface
would restore the spec's coverage and is cheap.

### [Low] captured/ fixture-regen divergence rests on an unverified claim that contradicts the spec

**Location:** Global Constraints ("Spec divergence (verified against code,
encode here)…"); Spec §Testing ("also regenerate the runtime `captured/*.json`
(incl. `captured/signal_ask_{qwen,claude}.json`, whose embedded context string
carries the now-changed `ask` label…)").

The spec and the plan make **opposite factual claims** about the same files:
the spec says `captured/signal_ask_*.json` embed the context string carrying the
ask label; the plan asserts they are LLM-output stubs with no label, and
therefore skips all `captured/` regeneration. The plan's divergence is
well-documented and reasoned, which is good plan craft — but the premise is
load-bearing and unverified here. If the plan is wrong, the `captured/`
fixtures go stale (the spec itself rates this "staleness, not breakage," so the
blast radius is low). Worth a concrete `grep`/read of one `captured/signal_ask_*.json`
during Task 5 to confirm the stub premise before relying on it.

### [Low] No drift guard for the byte-identical label invariant

**Location:** Task 5 Step 3(b) (`_SUPPORTING_DOCS_LABEL`); Global Constraints
("Label single-source caveat… The two copies **must be byte-identical**").

The plan correctly states the invariant and supplies both strings verbatim, so
they start identical. But nothing keeps them identical: a future edit to the
partial's label (or the Python constant) silently breaks Goal 4's
single-wording-source with no test signal. A small test that loads the partial,
extracts the label line, and asserts equality with `_SUPPORTING_DOCS_LABEL`
would lock the invariant the plan already declares.

### [Low] Kill criteria / recovery not stated (Low under the failure-stop calibration)

**Location:** Plan header ("REQUIRED SUB-SKILL: Use
superpowers:subagent-driven-development … or superpowers:executing-plans").

No explicit abort/kill/rollback guidance, and per-step recovery is implied
(red→green test cycle) rather than stated. Under the review calibration this is
Low because the artifact binds execution to a failure-stop skill
(report-and-wait on failure); escalate only if a later revision self-executes or
overrides report-and-wait. No change required at this severity — flagged so the
omission is conscious, not accidental.

## Observations (no action)

- **Intermediate commits leave the golden test red, by design.** Tasks 2–4 each
  commit edited templates before Task 6 regenerates the `rendered/` goldens, so
  `test_prompts_golden.py` is intentionally red for commits 2–4 (acknowledged in
  Task 2 Step 6's note). Acceptable for a short-lived feature branch merged as a
  unit; the cost is bisectability and the only green full-suite checkpoint being
  Task 6. The plan is aware, so no change.
- **Spec/plan discrepancy on the profiler exclude-list shape.** Spec §4 says the
  profiler "already excludes" pinecone keys (rebuilds from
  `{company_profile, icp_data}`); Task 2 Step 3(b) treats the profiler path as
  an exclude-list `not in [...]` needing widening and hedges with a
  verify-before-editing note. The plan's inspection appears more recent/granular,
  and its stated intent ("all four exclude lists gain the keys") is safe
  regardless of which is accurate, so no action — just noting the two artifacts
  disagree on the current code shape.
- **Existing signal_ask tests' dependence on the old label unverified.** Task 5
  Step 4 assumes no existing test asserts the removed `DATA SOURCES (uploaded
  documents)` string. A `grep` of `test_signals.py` would confirm; if any does,
  Step 4 fails (and surfaces immediately). Self-correcting at run time.
- **Threading style is inconsistent but safe.** Market passes
  `supporting_documents` positionally to the dispatch *lambda* (Task 3 Step
  2(c)); ICP passes it by keyword to the *bare* functions (Task 4 Step 2(c)).
  Both are correct given their respective signatures — the hazard only attaches
  to positionals *before `llm_backend`*, and neither violates that. The
  `COMPONENT_FUNCTIONS_CLAUDE` lambdas lack the `=None` default the
  `ICP_FUNCTIONS_CLAUDE` lambdas carry; cosmetic only.
- **No overengineering; decomposition is proportional.** One helper, one
  partial, per-surface threading, fixtures. Tasks 3 and 4 are independent of each
  other and could in principle parallelize after Task 2, but serial execution is
  the sensible default here and the commit history is cleaner for it.
