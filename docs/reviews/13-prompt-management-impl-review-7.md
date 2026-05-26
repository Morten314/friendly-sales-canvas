---
artifact: plan-13 Task 13 (audit-discovered services)
artifact_type: impl
verdict: clean
reviewer_model: claude-opus-4-7[1m]
date: 2026-05-26
round: 7
base_ref: 799c2c6
spec_loaded: false
plan_loaded: true
---

## Context

Reviewed range: `799c2c6..1c94e29` (single commit, Task 13). Plan loaded from `plans/13-prompt-management.md` Task 13 section. No standalone spec exists for this task — the canonical scope source is `docs/prompt-inventory.md` (Phase 0 audit), which the plan defers to. Both were loaded.

Verification snapshot:
- 317 tests pass (313 prior + 2 new golden fixtures + 2 new graph_chat unit tests).
- 24 prompts registered (22 prior + `score_prospect_system` + `score_prospect_user`).
- Fixture files present at `backend/tests/fixtures/prompts/_inputs/score_prospect_{system,user}.json` and `.../rendered/score_prospect_{system,user}.txt`.
- Targeted suite (`test_graph_chat.py`, `test_data_sources.py`, `test_prompts_golden.py`): 49 passed.
- No remaining `llm(messages)` callable-syntax sites in graph_chat. All three remaining `llm.invoke` sites are intentional (`_llm_helpers.py:268`, `health.py:12`, `prospect_pipeline.py:121`).

## Findings

### [Nit] System-render `prompt_meta` is silently discarded

**Location:** `backend/app/services/graph_chat/prospect_pipeline.py:104-122`

`score_prospect` renders both prompts but only emits `prompt_meta_from(user_rendered)`. The system render's `content_hash` (and version) are not part of the returned tuple. The commit message and docstring both note this is intentional — the user render is the "canonical invocation surface" because `render_inputs_hash` carries the variable half (`cypher_query`). That is a defensible choice: a single `prompt_meta` blob with one canonical name is simpler downstream than a multi-prompt observability payload, and the system body's `content_hash` would just be a constant (its inputs are `[]`).

The trade-off worth flagging: if you ever rev the system prompt's body without changing its `name`/`version`, downstream observability won't notice (only the user prompt's `content_hash` is reported). For this single call site that's acceptable, but it's a real semantic gap. If a future call site uses the two-prompt pattern, consider documenting an explicit "the system prompt is invariant, version-bump if you edit it" convention in `docs/PROMPTS.md` (Task 14).

### [Nit] `loaders.py` discards `prompt_meta` with `_prompt_meta`

**Location:** `backend/app/services/data_sources/loaders.py:90`

The call site unpacks `score, _prompt_meta = score_prospect(llm, temp_cypher)` and never threads `_prompt_meta` anywhere — no logging, no return-value passthrough. This is consistent with how other migrated call sites in `data_sources/loaders.py` work (the function returns nothing observable to its caller anyway, and there's no logging infrastructure for prompt observability in this code path yet), and `_`-prefix correctly signals "intentionally unused." If/when an observability sink lands (Task 14/15 territory), this is one of the call sites that will want a TODO marker — but adding one preemptively would be speculative.

### [Nit] `score_prospect` no longer takes a context argument; signature drift is fine

**Location:** `backend/app/services/graph_chat/prospect_pipeline.py:104` and `backend/app/services/data_sources/loaders.py:90`

The pre-migration `score_prospect(llm, cypher_query)` is unchanged in arity; only the return shape changed (str-or-None → tuple). Every call site in the codebase has been updated (`loaders.py:90`, plus the function itself is re-exported from `graph_chat/__init__.py` — `grep -rn 'score_prospect' app/` confirms `loaders.py:90` is the sole caller). No stragglers.

## Spec/plan adherence

Cross-checked against plan-13 Task 13 and the Phase 0 audit (`docs/prompt-inventory.md`):

- **P-024 (graph_chat/score_prospect) migrated via the manual two-render recipe** — matches the audit's Option 1 recommendation verbatim. The audit said: "needs new `prompts/graph_chat/score_prospect.md.j2` and either (a) a `system_prompt`/`user_prompt` front-matter split or (b) `call_with_prompt` extended to support a `messages_template` shape." The implementer chose a third option: two separate prompt files (`score_prospect_system.md.j2` and `score_prospect_user.md.j2`). This is arguably cleaner than (a) (no front-matter overloading) and lower-cost than (b) (no new API surface). The two-file split is well-justified: the system body has `inputs: []` (truly static instruction); the user body has `inputs: [cypher_query]` (variable). Each file's front-matter inputs accurately reflect its body's substitutions. Front-matter (version 1.0.0, model `llama-3.3-70b-versatile`, `response_format: text`) is consistent across both. Stems match `name` fields.

- **P-025 (`_DEFAULT_CLAUDE_PROMPT_SUFFIX` fragment) correctly deferred to v2.** Verified: this is a `claude_prompt_suffix_template` that gets *appended* to already-migrated prompts inside `_research_agent_output` (`_llm_helpers.py:173`). Three consumers — `icp/llm.py:_ICP_CLAUDE_SUFFIX`, `market_research/llm.py:_MARKET_RESEARCH_CLAUDE_SUFFIX`, and the default. It is genuinely a *fragment* (not a standalone prompt), and the audit's "Pattern sum" table classifies it as `fragment (consumed-only suffix, never invoked directly) = 1 (P-025)`. Migrating it would either require (a) the `partials` infrastructure (`_shared/`) to be repurposed for templating suffixes onto already-rendered bodies — which is meaningful new design surface — or (b) inlining the suffix into every consumer's prompt body (~14 prompts), which is duplication. Neither belongs in Task 13's catch-all scope. The deferral is sensible.

- **P-023 (`health.probe_llm`) correctly deferred per audit.** Read the call site (`app/services/health.py:6-15`): it's a 9-line health-probe function with a hardcoded one-liner `"Generate a simple JSON: {\"test\": \"hello\"}"`. The prompt is not consumed by any product surface, has no observability value (the function returns `{"status": "success/error", "response": ...}` and exists to verify LLM wiring works at all). ROI ≈ zero. Audit and plan-13 Step 3 both list this as the canonical deferral example.

- **Commit hygiene clean.** Subject is `refactor(be): migrate graph_chat/score_prospect prompts + prompt_meta` — matches the `type(scope):` convention from CLAUDE.md. No `Co-Authored-By: Claude` footer (matches user's documented preference). Body cleanly explains the manual-recipe choice, the two-file split, the prompt_meta sourcing decision, and the `llm()` → `llm.invoke()` conversion.

- **Deprecation fix (`llm(messages)` → `llm.invoke(messages)`) is correct and risk-free.** The `llm` argument flows from `data_sources/loaders.py:124` (`process_prospect_list(driver, llm, file_path)`) → `loaders.py:90` (`score_prospect(llm, temp_cypher)`). Per `CLAUDE.md`'s architecture note, the project's LLMs are LangChain-wrapped Groq/Together objects — they implement `BaseLanguageModel.invoke()` natively (the same method is used at `_llm_helpers.py:268` and `health.py:12` already). The deprecated callable-syntax (`llm(messages)`) is no longer recommended by LangChain. The fake-LLM tests in `test_graph_chat.py` use `MagicMock.invoke.return_value`, matching the production shape. Risk: zero.

## Code quality

- **Two-file prompt factoring is clean.** The system file is pure static instruction with `inputs: []`; the user file embeds `{{ cypher_query }}` and the trailer ("Only give me the number , nothing else at all , not even punctuation marks:") in one body. The substring boundaries match the original inline code 1-for-1.

- **`score_prospect` body is well-documented.** The docstring explicitly explains the two-render recipe, the tuple return shape, the choice of user-side `prompt_meta`, and the rationale (`render_inputs_hash` carries the variable half). Future readers won't have to reverse-engineer the convention.

- **No premature abstraction.** The "manual recipe" is 6 lines (two renders, a 2-message list literal, an `invoke`, a regex extract, a tuple return). A helper would be premature for one call site.

- **Tests are focused.** `test_score_prospect_returns_score_and_prompt_meta` asserts the message shape, the dispatch, and the prompt_meta fields. `test_score_prospect_returns_none_score_when_response_has_no_number` asserts the regex-miss path and that prompt_meta is *still* emitted on error. The `_FakeAIResponse` helper class is documented with a comment pointing at the production LangChain `AIMessage.__repr__` shape the `extract_number` regex consumes — good archaeology for future readers who'll wonder why `__str__` returns a `content='…'` shape.

- **Test substring assertions match production output.** The user-message-content assertions (`"Cypher Query:" in messages[1].content`, `"Only give me the number" in messages[1].content`) align with the rendered fixture content.

- **`test_data_sources.py` tuple-unpack fix is minimal and correct.** Single-line change: `return_value={}` → `return_value=({}, {})`, with an explanatory comment. No collateral damage.

## Overall

This is a tight, well-scoped commit that completes the migration's audit-discovered tail without scope creep. The two-file factoring is cleaner than the audit's preferred Option 1(a) front-matter split, the manual-recipe trade-off is well-justified (one call site, no new API surface), the deferrals (P-025 and P-023) are correctly scoped, and the bonus deprecation fix is low-risk and consistent with the rest of the codebase. Phase 2 (migration of services) ends here in a clean, complete state — Tasks 14 and 15 (PROMPTS.md and outcome doc) can proceed without back-filling.

Verdict: clean. No findings above Nit.
