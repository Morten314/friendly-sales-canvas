# Prompt migration outcome — Plan 13

**Date:** 2026-05-26 (last commit of Phase 3)
**Plan:** [`plans/13-prompt-management.md`](../plans/13-prompt-management.md)
**Spec:** [`specs/13-prompt-management-design.md`](../specs/13-prompt-management-design.md)
**Resolves:** TD-010

This document is the frozen audit trail of the prompt-management migration. Every prompt location surfaced in the Phase 0 audit appears here with its disposition. It records what happened during the migration; it does not track ongoing state. See [`docs/PROMPTS.md`](PROMPTS.md) for the current system.

## Summary

- **Total audit-surfaced locations:** 25 (per `docs/prompt-inventory.md` Phase 0 audit)
- **Migrated:** 23
- **Intentionally deferred:** 2 (P-023 `health.probe_llm`; P-025 `_DEFAULT_CLAUDE_PROMPT_SUFFIX`)
- **Unmigratable:** 0
- **Registered prompts after migration:** 24 (P-024 split into two — `score_prospect_system` + `score_prospect_user` — per the two-prompt simple-invoke recipe)

## Migrated

| Audit ID | Old location | New prompt name(s) | Version | Content hash (sha256[:16]) | Migration commit |
|---|---|---|---|---|---|
| P-001 | `app/services/icp/prompts.py:ICP_GENERATOR_TEMPLATE` | `icp_generator` | 1.0.0 | `12773ecafdf4110b` | `c28fab0` |
| P-002 | `app/services/icp/prompts.py:ICP_RESEARCH_1_TEMPLATE` | `icp_research_1` | 1.0.0 | `124ab1e70bb03074` | `c28fab0` |
| P-003 | `app/services/icp/prompts.py:ICP_RESEARCH_2_TEMPLATE` | `icp_research_2` | 1.0.0 | `090f901a55f2e6f6` | `c28fab0` |
| P-004 | `app/services/icp/prompts.py:ICP_RESEARCH_3_TEMPLATE` | `icp_research_3` | 1.0.0 | `f0e09ca9e901993e` | `c28fab0` |
| P-005 | `app/services/icp/prompts.py:ICP_RESEARCH_4_TEMPLATE` | `icp_research_4` | 1.0.0 | `4d097193915984f3` | `c28fab0` |
| P-006 | `app/services/signals/prompts.py:_SCOUT_PROMPT_TEMPLATE` | `signals_scout_search` | 1.0.0 | `54f50137eb3d569c` | `d1edb16` |
| P-007 | `app/services/signals/prompts.py:_PROFILER_PROMPT_TEMPLATE` | `signals_profiler_search` | 1.0.0 | `4d71fbfc5f512813` | `d1edb16` |
| P-008 | `app/services/signals/prompts.py:_LEADS_SECTION_TEMPLATE` | `signals_leads_section` (sub-template, used via `{% include %}` in scout/profiler) | 1.0.0 | `0ada29d06d05f9f5` | `d1edb16` |
| P-009 | `app/services/signals/prompts.py:_LEADS_SECTION_FALLBACK_TEMPLATE` | `signals_leads_section_fallback` (sub-template) | 1.0.0 | `05a45295fd920d96` | `d1edb16` |
| P-010 | `app/services/signals/prompts.py:_EXISTING_HEADLINES_SECTION_TEMPLATE` | `signals_existing_headlines_section` (sub-template) | 1.0.0 | `32ac9aae9cac9b93` | `d1edb16` |
| P-011 | `app/services/signals/prompts.py:_SIGNAL_ASK_PROMPT_TEMPLATE` | `signals_signal_ask_groq` | 1.0.0 | `eaedb519113c35e1` | `d1edb16` |
| P-012 | `app/services/signals/prompts.py:_SIGNAL_ASK_CLAUDE_PROMPT_TEMPLATE` | `signals_signal_ask_claude` | 1.0.0 | `754af227a55d9ac2` | `d1edb16` |
| P-013 | `app/services/market_research/prompts.py:RESEARCH_MARKET_1_TEMPLATE` | `research_market_1` | 1.0.0 | `c3d70e6d4fc5006e` | `51a0dfb` |
| P-014 | `app/services/market_research/prompts.py:RESEARCH_MARKET_2_TEMPLATE` | `research_market_2` | 1.0.0 | `ca20a53b6ef59aa9` | `51a0dfb` |
| P-015 | `app/services/market_research/prompts.py:RESEARCH_MARKET_3_TEMPLATE` | `research_market_3` | 1.0.0 | `54445e5dfdbea6c8` | `51a0dfb` |
| P-016 | `app/services/market_research/prompts.py:RESEARCH_MARKET_4_TEMPLATE` | `research_market_4` | 1.0.0 | `d51eae01ce98a5ef` | `51a0dfb` |
| P-017 | `app/services/market_research/prompts.py:RESEARCH_MARKET_5_TEMPLATE` | `research_market_5` | 1.0.0 | `320c914de144184c` | `51a0dfb` |
| P-018 | `app/core/llm_config.py:_CYPHER_BASE + _CYPHER_GEN_PROMPT_OVERLAY + _CYPHER_TAIL` (`Cypher_gen_prompt`/`Cypher_Prompt`) | `cypher_gen` (consumed via `as_langchain()`) | 1.0.0 | `1a0c0e4a97f83f5b` | `fedfcfd` |
| P-019 | `app/core/llm_config.py:_CYPHER_BASE + _CYPHER_GEN_PROMPT2_OVERLAY + _CYPHER_TAIL` (`Cypher_gen_prompt2`/`Cypher_Prompt2`) | `cypher_gen_alt` (consumed via `as_langchain()`) | 1.0.0 | `1cc8c9dca5b442e9` | `fedfcfd` |
| P-020 | `app/core/llm_config.py:_QA_BASE + _QA_PROMPT_TEMPLATE_OVERLAY + _QA_TAIL` (`qa_prompt_template`/`qa_prompt`) | `qa_scout` (consumed via `as_langchain()`) | 1.0.0 | `c531bf43e4db0c22` | `fedfcfd` |
| P-021 | `app/core/llm_config.py:_QA_BASE + _QA_TAIL` (`qa_prompt_template2`/`qa_prompt2`) | `qa_scout_alt` (consumed via `as_langchain()`) | 1.0.0 | `5a11747ccb95582a` | `fedfcfd` |
| P-022 | `app/services/market_scoring/orchestrator.py:282-325` (`score_single_lead_against_market` inline f-string) | `score_lead` (consumed via `call_with_prompt`) | 1.0.0 | `8c0fee766c5d5d99` | `799c2c6` |
| P-024 | `app/services/graph_chat/prospect_pipeline.py:105-126` (`score_prospect.prompt_instruction` + Cypher-query tail) | `score_prospect_system` + `score_prospect_user` (two-prompt simple-invoke recipe for `[SystemMessage, HumanMessage]`) | 1.0.0 / 1.0.0 | `691c52713bcc3a0b` / `b9b3c4bf5f313d0b` | `1c94e29` |

## Intentionally deferred

| Audit ID | Old location | Reason | New TD ref |
|---|---|---|---|
| P-023 | `app/services/health.py:10` (`probe_llm`) | Migration ROI ~zero — 1-line diagnostic prompt (`"Generate a simple JSON: {\"test\": \"hello\"}"`), no non-engineer iteration use case, no observability value on a smoke probe. Spec §2.1 explicitly flagged this as a deferral candidate; audit confirmed. | None (no ongoing debt) |
| P-025 | `app/services/_llm_helpers.py:111` (`_DEFAULT_CLAUDE_PROMPT_SUFFIX`) | Still actively consumed as the default `claude_prompt_suffix_template` arg of `_research_agent_output()`, which is called by signals' Claude path (passing the default) and by ICP/market_research Claude paths (passing per-call overrides). Retiring requires either (a) inlining the `{% if web_ctx %}…{% endif %}` block into ~15 per-prompt templates with retroactive golden-fixture churn, or (b) a `_research_agent_output()` refactor that lifts the suffix concern out of the helper. The Phase 0 audit recommended inline-during-Tasks-8/9/10; the implementation deferred this to keep each service's commit focused. Out of scope for Task 13's manual cleanup. | Capture in v2 backlog (not a new TD entry — this is a refactor opportunity, not a known-defect debt) |

## Unmigratable

(none)

## Notes

### Test scaffolding scheduled for cleanup

- The one-shot equivalence test `tests/unit/test_llm_config_migration_equivalence.py` (added in Task 11 Step 8) is scheduled for deletion after one release cycle. Its job was byte-equality validation between the legacy `Cypher_Prompt`/`Cypher_Prompt2`/`qa_prompt`/`qa_prompt2` strings and the new `as_langchain()`-built `PromptTemplate.template` attribute during the LangChain migration review. The `as_langchain` parity test plus golden fixtures cover the same ground going forward.
- Similarly, the baseline strings under `tests/_baselines/llm_config_prompt_strings.py` are scheduled for deletion alongside the equivalence test.

### Observability scope

- No retroactive backfill of `prompt_meta` onto pre-migration Mongo documents. Observability coverage closes service-by-service as the migration progressed (spec §2.2).
- The `model` field on `signals_signal_ask_claude` (and other Claude-routed prompts that funnel through `_claude_messages_text`) is recorded for observability via `prompt_meta` but does not drive routing in v1 — those paths use the custom-dispatch pattern with the model name hardcoded at the call site. Active model routing for those paths is a v2 concern.

### Documented spec deviations (per spec §1 "no behavioral change")

- **Signals scout/profiler — 3-byte whitespace drift per render** (down from 8 bytes after the Task 9 wording-drift fix). Caused by Jinja2's `trim_blocks=True, lstrip_blocks=True` collapsing a blank line at `{% if leads %}…{% endif %}` boundaries. Documented in the Task 9 review; accepted as semantically inert (whitespace only; no token-level meaning change).
- **Wording drift fix:** Task 9 introduced `_shared/final_answer_json_directive.md.j2` (signals scout/profiler use) alongside the existing `_shared/final_answer_directive.md.j2` (ICP uses) to preserve the legacy `<your JSON answer here>` wording rather than collapse the two directives into one shared partial.

### Documented architectural patterns that emerged

- **Two-prompt simple-invoke recipe** (P-024 graph_chat) — for `[SystemMessage, HumanMessage]` shapes, the prompt body splits into a system prompt and a user prompt, both registered as full callable prompts. The user-message prompt_meta is recorded as the canonical observability surface. Per the Phase 0 audit's "`call_with_prompt` scope confirmation," Option 1 was chosen: `call_with_prompt` stays single-message; P-024 uses a manual `prompts.render(...)` + `llm.invoke([SystemMessage(...), HumanMessage(...)])` recipe.
- **Service-scoped sub-templates as callable prompts** (P-008, P-009, P-010 signals) — the three orchestrator-assembled section partials moved into `prompts/signals/signals_*_section.md.j2` files with full callable front-matter. They are invoked only via `{% include %}` from the parent `signals_scout_search` / `signals_profiler_search` templates, but live in the registry as first-class entries so each has its own golden fixture and content_hash for change tracking.

### Spec §6 Definition of Done verification (run 2026-05-26)

1. **`backend/prompts/` contains every audit-surfaced prompt minus deferred.** PASS — 24 callable prompts registered (23 migrated + P-024 split into 2), matching the migration table above. Deferrals (P-023, P-025) recorded with reasons.
2. **No service has a `prompts.py` (except recorded deferrals).** PASS — `find app/services -name 'prompts.py'` returns empty.
3. **Every migrated prompt has a golden fixture.** PASS — registry walk vs `tests/fixtures/prompts/rendered/` reports `all fixtures present`.
4. **`test_prompts_loader.py` + `test_prompts_golden.py` pass.** PASS — 60 passed.
5. **Every service's persistence writes `prompt_meta`.** PASS — spot-checked via `tests/unit/test_icp.py` (prompt_meta unpacked from research tuple, merged into Mongo insert, threaded into response payload at lines 155-192); equivalent coverage in signals, market_research, market_scoring, graph_chat service tests.
6. **`docs/PROMPTS.md` exists.** PASS — created by Task 14 (commit `459a466`).
7. **`docs/prompt-migration-outcome.md` exists.** PASS — this document (Task 15).
8. **TD-010 resolved with PR references.** PASS — marked RESOLVED in `docs/TECH_DEBT.md` by Task 14.
9. **No substring-on-prompt-body assertions remain.** PASS — `rg 'assert.*in.*PROMPT|assert.*in.*TEMPLATE' tests/` returns no matches.
10. **Boot + full test suite pass.** PASS — `pytest -x --no-header -q` reports `317 passed, 10 warnings in 39.03s` (19 snapshot tests included).

### Closing

This doc is frozen after merge. Future drift in the prompt system is captured in `docs/PROMPTS.md`, not here.
