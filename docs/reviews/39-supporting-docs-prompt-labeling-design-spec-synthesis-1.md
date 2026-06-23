---
synthesizes_review: docs/reviews/39-supporting-docs-prompt-labeling-design-spec-review-1.md
artifact: specs/39-supporting-docs-prompt-labeling-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-22
round: 1
---

## Round Recommendation

maybe

Reason: All findings agreed and incorporated; the revision adds a 4th surface (signal_ask, light-touch alignment) and a fixture-regeneration task but no architectural novelty — a second automated round is optional, while the higher-value gate is the user's spec review, where the signal_ask scope decision (it touches the "all surfaces" choice) should be confirmed.

## Agreed Findings

- **H1 (signal_ask is a 4th surface):** Confirmed independently — `signals/ask.py:87` retrieves via `_fetch_pinecone_supporting_context`; `:142/:231` already label it `DATA SOURCES (uploaded documents):`. Revising: add `signal_ask`/`signal_ask_claude` to the Problem table and scope it explicitly. Note the nuance below — `signal_ask` does NOT have the D1 "buried in profile JSON" defect (it's already a separate, labeled section), so its inclusion is *consistency alignment* (reuse `format_supporting_documents`, align label wording), not a report bug-fix.
- **H2 (golden fixtures / criterion 5 false):** Confirmed — `tests/regen_prompt_fixtures.py` + `tests/fixtures/prompts/{_inputs,rendered}` + `tests/fixtures/captured/`. Revising: add an explicit "regenerate `_inputs` skeletons + golden/captured fixtures" requirement and reword criterion 5 to "existing suite green *after* fixture regeneration."
- **M1 (market-research threading):** Revising §4 to name the real indirection — the `COMPONENT_FUNCTIONS`/`COMPONENT_FUNCTIONS_CLAUDE` dispatch lambdas (arity widen), the `research_function(...)` call site, and `_run_research_component`'s signature.
- **M2 (ICP positional-arg break):** Revising §4 to thread `supporting_documents` as a **keyword** arg and update `ICP_FUNCTIONS`/`ICP_FUNCTIONS_CLAUDE` lambdas — not a 3rd positional arg before `llm_backend`.
- **M3 (partial frontmatter):** Revising §2 to show required `name`/`version`/`description` frontmatter on the partial.
- **M4 (single shared signals render):** Revising §4 bullet 1 — one shared `prompts.render` call; both `signals_scout_search` and `signals_profiler_search` must declare `supporting_documents` in `inputs:` in lockstep.
- **L1 (naming `_run_research_component`):** Fixed as part of M1.
- **L2 (grep "returns nothing" false):** Reword to "no prompt labels the *retrieved Pinecone* content" (the 4 matches are WebSearch-URL instructions, unrelated).
- **L3 (`default=str` load-bearing for numpy scores):** Add acceptance note + a helper test that a non-JSON-native `score` (e.g. numpy float) does not raise.
- **L4 (criterion 1 "all 11" vs sampling):** State the test plan samples one template per surface family exercising the shared partial.
- **N1 (`pinecone_context_queries` reader):** Confirmed no `app/` reader and not persisted to Mongo; `/debug/signal-trace` is not deployed. Note the confirmation in the spec.
- **N2 (ICP final-answer partial precedent):** Drop the specific `_json` filename from the precedent citation (ICP uses `final_answer_directive.md.j2`).

## Disagreed Findings

None. Every finding was verified accurate against the code.

## Deferred Findings

None. All agreed findings are cheap to incorporate at spec stage; deferring would push known gaps into the plan.

## Severity Disagreements

- **H1 — agree finding, partial severity nuance.** It is correctly High *as a spec-completeness/scope issue* (a "all surfaces" claim that silently omits a surface). But the underlying D1 defect does not exist on `signal_ask` (already a separate labeled section), so the *fix* there is light alignment, not a correctness bug. Recording the nuance; not contesting the High rating, since the spec-scope gap is the thing that matters at this stage.

## Open Questions

- **signal_ask scope (for the user):** include `signal_ask`/`signal_ask_claude` in WS2 for label-wording consistency (recommended, honors the "all surfaces" intent — light change: shared helper + aligned wording), or explicitly defer it to a follow-up since it is already labeled and not implicated by either report? To confirm at the user spec-review gate.
