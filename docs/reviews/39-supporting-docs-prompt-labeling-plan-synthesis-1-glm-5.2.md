---
synthesizes_review: docs/reviews/39-supporting-docs-prompt-labeling-plan-review-1-glm-5.2.md
artifact: plans/39-supporting-docs-prompt-labeling.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-22
round: 1
---

## Round Recommendation

no

Reason: All 5 findings (1 Medium, 4 Low) are agreed and incorporated as additive test coverage + an explicit verification step; none are Critical/High, and the revisions open no new design surface — a second round would not surface more.

## Agreed Findings

- **M1 (Claude-dispatch path untested — the exact threading hazard):** Confirmed — every market/ICP test the plan adds runs `llm_backend="qwen"`, so the real `COMPONENT_FUNCTIONS_CLAUDE` / `ICP_FUNCTIONS_CLAUDE` lambdas (the `_claude` variants the FE actually calls) are never exercised, and the existing per-component tests patch the dispatch dicts with `MagicMock` fakes. Revision: parametrize the Task 3 (market) and Task 4 (ICP) through-orchestrator tests over `llm_backend ∈ {"qwen", "claude"}` so the real `*_CLAUDE` lambda runs end-to-end; capture both the rendered body **and** the `llm_backend` arg, asserting the label/content reach the prompt **and** the captured backend is still `"claude"` (proves the positional `"claude"` survived threading). Add a `signal_ask_claude` alignment test (Task 5) asserting the aligned label in the captured Claude payload.
- **L1 ("omitted when absent" dropped at integration level):** Confirmed — the spec lists a per-surface empty-retrieval assertion; the plan only covered the present case (the absent case was delegated to the helper unit test, which never exercises the `{% include %}` + `{% if supporting_documents %}` guard). Revision: add a signals-scout test (Task 2) patching `_fetch_pinecone_supporting_context` → `[]` and asserting the `SUPPORTING DOCUMENTS` section is **absent** from the rendered prompt (no empty header).
- **L2 (captured/ skip-regen premise unverified in-plan):** Agreed — the divergence is load-bearing and the plan asserted it without an in-plan check. Revision: add an explicit verification step at the top of Task 6 that greps `_stub` in `captured/signal_ask_{qwen,claude}.json` and confirms no embedded label, falling back to the spec-prescribed regen if the premise is wrong. (The stub premise was independently confirmed during plan grounding; the step makes the reliance explicit and self-checking.)
- **L3 (no drift guard for the byte-identical label invariant):** Agreed — the invariant is declared and both strings start identical, but nothing keeps them so. Revision: add a test (Task 5) that reads the partial's label line and asserts byte-equality with `_SUPPORTING_DOCS_LABEL`, locking Goal-4's single-wording source.
- **L4 (kill criteria / recovery not stated):** Agreed with the substance and the Low calibration; **no test/structural revision** — execution is bound to a report-and-wait failure-stop sub-skill (subagent-driven-development / executing-plans), which the reviewer themselves notes makes this Low with "no change required." Added a one-line "Failure handling" note to Global Constraints so the reliance is conscious, per the reviewer's intent.

## Disagreed Findings

None. Every finding is accurate against the plan.

## Deferred Findings

None. All findings are cheap to incorporate at plan stage.

## Severity Disagreements

None. M1 is correctly Medium: the plan's written code is correct, but it is a zero-signal coverage gap on the production Claude path (silent model-selection revert if mis-implemented), which is more consequential than a generic coverage miss yet not a present defect. The four Lows are calibrated correctly.

## Open Questions

None. Observations were addressed inline, not deferred:
- The market `COMPONENT_FUNCTIONS_CLAUDE` lambdas were given the `=None` default that the ICP `_CLAUDE` lambdas already carry — cosmetic symmetry, removes the noted inconsistency.
- The spec/plan disagreement on the profiler exclude-list shape is harmless under the plan's stated intent ("all four exclude lists gain the keys") and its verify-before-editing note — no action.
- The existing `signal_ask` tests assert content sentinels (`DATA_SOURCE_SENTINEL_*`), not the removed `DATA SOURCES (uploaded documents)` literal — verified during grounding, so Task 5's label change does not break them.
- Intermediate commits (Tasks 2–4) leaving `test_prompts_golden.py` red until Task 6 is accepted and documented; acceptable for a short-lived branch merged as a unit.
