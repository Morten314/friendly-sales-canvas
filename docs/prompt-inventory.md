# Prompt inventory — Phase 0 audit

**Date:** 2026-05-26
**Author:** Claude (subagent, plan-13 Task 1)
**Purpose:** Authoritative list of every prompt string in `backend/`. Input for plan-13 Phase 1/2.

Sweep commands used (from `backend/`):

```bash
rg -n --type py -e 'PROMPT' -e 'TEMPLATE' -e 'HumanMessage\(' -e 'PromptTemplate' \
   --glob '!__pycache__' --glob '!tests' app/ | sort
rg -n --type py 'llm[0-9]?\.invoke|agent_chain\.invoke|_research_agent_output|_claude_messages_text' app/
```

Inline f-string call sites were then individually inspected (no convention to grep). Per-service sweep across `customer_profile/`, `leads/`, `pipeline/`, `data_sources/`, `profiles/`, `org_auth/`, `graph_chat/` followed.

## Table

| ID | Location | LOC | Current shape | Invocation pattern | Consumers (call sites) | Notes |
|---|---|---:|---|---|---|---|
| P-001 | `app/services/icp/prompts.py:12` `ICP_GENERATOR_TEMPLATE` | 110 (12-121) | Python constant, triple-quoted; `.format(pre_data=...)` | agent-chain | `icp/orchestrator.py:43` `ICP_generator` -> `agent_chain.invoke({'input': pmt})` at line 53 | Retry with appended directive on empty `suggestedICPs` list (orchestrator lines 66-71). Both invocations use the same prompt body + appended retry sentence. |
| P-002 | `app/services/icp/prompts.py:122` `ICP_RESEARCH_1_TEMPLATE` | 82 (122-203) | Python constant, triple-quoted; `.format(pre_data=...)` | agent-chain (Groq) / custom-dispatch (Claude) | `icp/orchestrator.py:86` `icp_research_1` -> `_icp_research_agent_output(...)` at line 96 (Groq path via `agent_chain.invoke`, Claude path via Anthropic+Tavily) | Routed by `llm_backend` arg ("default"=Groq, "claude"=Anthropic). Dispatch wrapper is `app/services/icp/llm.py::_icp_research_agent_output`. |
| P-003 | `app/services/icp/prompts.py:204` `ICP_RESEARCH_2_TEMPLATE` | 49 (204-252) | Python constant, triple-quoted; `.format(pre_data=...)` | agent-chain (Groq) / custom-dispatch (Claude) | `icp/orchestrator.py:104` `icp_research_2` -> `_icp_research_agent_output(...)` at line 118 | Same dispatch pattern as P-002. |
| P-004 | `app/services/icp/prompts.py:253` `ICP_RESEARCH_3_TEMPLATE` | 69 (253-321) | Python constant, triple-quoted; `.format(pre_data=...)` | agent-chain (Groq) / custom-dispatch (Claude) | `icp/orchestrator.py:143` `icp_research_3` -> `_icp_research_agent_output(...)` at line 157 | Same dispatch pattern as P-002. |
| P-005 | `app/services/icp/prompts.py:322` `ICP_RESEARCH_4_TEMPLATE` | 62 (322-383) | Python constant, triple-quoted; `.format(pre_data=...)` | agent-chain (Groq) / custom-dispatch (Claude) | `icp/orchestrator.py:184` `icp_research_4` -> `_icp_research_agent_output(...)` at line 198 | Same dispatch pattern as P-002. |
| P-006 | `app/services/signals/prompts.py:17` `_SCOUT_PROMPT_TEMPLATE` | 113 (17-129) | Python constant, triple-quoted; `.format(...)` with `{leads_section}`, `{existing_headlines_section}`, `{company_profile_json}`, `{ranked_pinecone_context}` placeholders | agent-chain (Groq) / custom-dispatch (Claude) | `signals/search.py:147` `search_signals(persona="scout")` -> `_signals_agent_output(...)` (which wraps `_research_agent_output` with `extract_intermediate_urls=True`); used by `batch.py::_generate_signals_batch_impl` and `search.py::run_signals_research`. | Two conditional sub-sections (leads vs leads_fallback, existing_headlines presence) are assembled orchestrator-side today; Plan-13 Task 9 moves them into Jinja2 `{% if %}`. |
| P-007 | `app/services/signals/prompts.py:130` `_PROFILER_PROMPT_TEMPLATE` | 120 (130-250) | Python constant, triple-quoted; same `.format(...)` placeholders as P-006 | agent-chain (Groq) / custom-dispatch (Claude) | `signals/search.py:147` `search_signals(persona="profiler")` -> `_signals_agent_output(...)` | Symmetric pair with P-006; persona switches the prompt body but conditional includes are identical. |
| P-008 | `app/services/signals/prompts.py:251` `_LEADS_SECTION_TEMPLATE` | 17 (251-267) | Python constant, triple-quoted; `.format(leads_list=...)` | partial (consumed by P-006/P-007) | `signals/search.py:122` `_LEADS_SECTION_TEMPLATE.format(...)` injected into scout/profiler prompt | Partial. Becomes `prompts/signals/leads_section.md.j2` (Plan-13 Task 9). |
| P-009 | `app/services/signals/prompts.py:269` `_LEADS_SECTION_FALLBACK_TEMPLATE` | 5 (269-273) | Python constant, triple-quoted (no placeholders) | partial (consumed by P-006/P-007) | `signals/search.py:129` `_LEADS_SECTION_FALLBACK_TEMPLATE.format()` injected when `has_leads` is false | Partial. Fallback sibling of P-008. |
| P-010 | `app/services/signals/prompts.py:275` `_EXISTING_HEADLINES_SECTION_TEMPLATE` | 9 (275-284) | Python constant, triple-quoted; `.format(headlines_list=...)` | partial (consumed by P-006/P-007) | `signals/search.py:140` `_EXISTING_HEADLINES_SECTION_TEMPLATE.format(...)`; omitted entirely when no existing headlines | Partial. Becomes `prompts/signals/existing_headlines_section.md.j2`. |
| P-011 | `app/services/signals/prompts.py:286` `_SIGNAL_ASK_PROMPT_TEMPLATE` | 19 (286-304) | Python constant, triple-quoted; `.format(question=..., company_profile=..., customer_profile=..., history_text=...)` | agent-chain (with WebSearch tool) | `signals/ask.py:84` `signal_ask(...)` -> `agent_chain.invoke({"input": prompt})` at line 92 (wrapped in `asyncio.to_thread`) | Routed to Groq via the shared `agent_chain`. |
| P-012 | `app/services/signals/prompts.py:306` `_SIGNAL_ASK_CLAUDE_PROMPT_TEMPLATE` | 19 (306-324) | Python constant, triple-quoted; `.format(...)` same vars as P-011 plus `{web_search_context}` | custom-dispatch (direct Anthropic POST) | `signals/ask.py:172` `signal_ask_claude(...)` -> `requests.post("https://api.anthropic.com/v1/messages", ...)` at line 187 with `messages=[{"role": "user", "content": prompt}]` | Direct Anthropic API call (no LangChain); pre-call Tavily web search injection. |
| P-013 | `app/services/market_research/prompts.py:13` `RESEARCH_MARKET_1_TEMPLATE` | 88 (13-100) | Python constant, triple-quoted; `.format(company_profile_json=...)` | agent-chain (Groq) / custom-dispatch (Claude) | `market_research/orchestrator.py:44` (via `COMPONENT_TEMPLATES` dict, line 44-48) -> `_run_research_component(1, ...)` at line 101/109 -> `_market_research_agent_output(...)` at line 91 | Same `_research_agent_output` dispatch as ICP. All 5 templates funnel through `_run_research_component()`. |
| P-014 | `app/services/market_research/prompts.py:102` `RESEARCH_MARKET_2_TEMPLATE` | 105 (102-206) | Python constant, triple-quoted; `.format(company_profile_json=...)` | agent-chain (Groq) / custom-dispatch (Claude) | Same dispatch as P-013 (component_n=2) | — |
| P-015 | `app/services/market_research/prompts.py:208` `RESEARCH_MARKET_3_TEMPLATE` | 196 (208-403) | Python constant, triple-quoted; `.format(company_profile_json=...)` | agent-chain (Groq) / custom-dispatch (Claude) | Same dispatch as P-013 (component_n=3) | Heaviest single prompt. |
| P-016 | `app/services/market_research/prompts.py:405` `RESEARCH_MARKET_4_TEMPLATE` | 182 (405-587) | Python constant, triple-quoted; `.format(company_profile_json=...)` | agent-chain (Groq) / custom-dispatch (Claude) | Same dispatch as P-013 (component_n=4) | — |
| P-017 | `app/services/market_research/prompts.py:589` `RESEARCH_MARKET_5_TEMPLATE` | 129 (589-718) | Python constant, triple-quoted; `.format(company_profile_json=...)` | agent-chain (Groq) / custom-dispatch (Claude) | Same dispatch as P-013 (component_n=5) | — |
| P-018 | `app/core/llm_config.py:140` `Cypher_gen_prompt` | 88 assembled (`_CYPHER_BASE` 37-123 + `_CYPHER_GEN_PROMPT_OVERLAY` 125-132 + `_CYPHER_TAIL` 138) | Concatenated triple-quoted strings → wrapped in `PromptTemplate(input_variables=["question","schema"], template=...)` at line 143 as `Cypher_Prompt` | langchain-prompt-template | `app/core/llm_config.py:264-272` `build_llm_config()` -> `GraphCypherQAChain.from_llm(cypher_prompt=Cypher_Prompt, ...)` | Composes from shared base `_CYPHER_BASE` (87 LOC) + per-variant overlay + tail. Plan-13 Task 11 extracts `_CYPHER_BASE` into `prompts/_shared/cypher_base.md.j2` partial. |
| P-019 | `app/core/llm_config.py:141` `Cypher_gen_prompt2` | 88 assembled (`_CYPHER_BASE` 37-123 + `_CYPHER_GEN_PROMPT2_OVERLAY` 134 + `_CYPHER_TAIL` 138) | Same shape as P-018; wrapped at line 144 as `Cypher_Prompt2` | langchain-prompt-template | `app/core/llm_config.py:292-300` `build_llm_config()` -> `GraphCypherQAChain.from_llm(cypher_prompt=Cypher_Prompt2, ...)` (the `chain2` variant) | Differs from P-018 only by overlay; same base+tail. |
| P-020 | `app/core/llm_config.py:195` `qa_prompt_template` | 34 assembled (`_QA_BASE` 150-175 + `_QA_PROMPT_TEMPLATE_OVERLAY` 177-183 + `_QA_TAIL` 185-193) | Concatenated triple-quoted strings → `PromptTemplate(input_variables=["context","question"], template=...)` at line 198 as `qa_prompt` | langchain-prompt-template | `app/core/llm_config.py:264-272` `build_llm_config()` -> `GraphCypherQAChain.from_llm(qa_prompt=qa_prompt, ...)` | `_QA_BASE` (Scout persona) is the shared partial; already aligns with the planned `_shared/scout_persona.md.j2` (per spec §3.1). |
| P-021 | `app/core/llm_config.py:196` `qa_prompt_template2` | 28 assembled (`_QA_BASE` 150-175 + `_QA_TAIL` 185-193 only; no overlay) | Same shape as P-020; wrapped at line 202 as `qa_prompt2` | langchain-prompt-template | `app/core/llm_config.py:292-300` `build_llm_config()` -> `GraphCypherQAChain.from_llm(qa_prompt=qa_prompt2, ...)` | `qa_prompt_template2 = _QA_BASE + _QA_TAIL.lstrip("\n")` — strips the leading newline that overlay normally bridges. |
| P-022 | `app/services/market_scoring/orchestrator.py:282` `score_single_lead_against_market` (inline f-string lines 292-325) | 34 (292-325) | Inline Python f-string built inside `score_single_lead_against_market(...)`; substitutes `component_keys`, `company_profile`, `lead`, `market_report` | simple-invoke | `app/services/market_scoring/orchestrator.py:326` `llm2.invoke([HumanMessage(content=prompt)])` | Only baseline simple-invoke path that returns persisted JSON. Target of plan-13 Task 12 (call_with_prompt + active model routing). |
| P-023 | `app/services/health.py:10` `probe_llm` (inline string literal) | 1 (line 10) | Inline Python string literal `"Generate a simple JSON: {\"test\": \"hello\"}"` | simple-invoke | `app/services/health.py:12` `llm2.invoke(messages)` | **Candidate "intentionally deferred"** per spec §2.1 / plan-13 Task 13 Step 3 — ROI ~zero for a 1-line smoke probe with no observability value. |
| P-024 | `app/services/graph_chat/prospect_pipeline.py:105` `score_prospect.prompt_instruction` (inline f-string lines 105-123) | 19 (105-123) | Inline Python f-string built inside `score_prospect(llm, cypher_query)`; substitutes nothing into the f-string body (it's effectively a static instruction template); paired with a tail `HumanMessage(content=f"Cypher Query:\n{cypher_query}\n\n...")` at line 126 | simple-invoke (composed: `[SystemMessage(...), HumanMessage(...)]`) | `app/services/graph_chat/prospect_pipeline.py:124` `llm.invoke([SystemMessage(content=prompt_instruction), HumanMessage(content=...)])` | **Audit-surfaced (not in §2.1 baseline).** Two-part System+Human composition. Eligible for plan-13 Task 13 simple-invoke recipe; needs new `prompts/graph_chat/score_prospect.md.j2` and either (a) a `system_prompt`/`user_prompt` front-matter split or (b) `call_with_prompt` extended to support a `messages_template` shape. See "`call_with_prompt` scope confirmation" below. |
| P-025 | `app/services/_llm_helpers.py:111` `_DEFAULT_CLAUDE_PROMPT_SUFFIX` | 1 (line 111) | Inline Python string literal `"\n\nWEB SEARCH RESULTS:\n{web_ctx}\n"` | fragment (consumed by P-002..P-005, P-013..P-017, P-006/P-007 Claude paths) | `_research_agent_output(..., claude_prompt_suffix_template=...)` — appended to the prompt body before `_claude_messages_text(...)` POST at line 174 | **Audit-surfaced (not in §2.1 baseline).** A prompt fragment (suffix template) that the Claude dispatch path appends to every ICP/market_research/signals Claude-backed prompt. Not a standalone prompt — handled in Phase 1 as part of the `_shared/` partial scaffold or absorbed into per-prompt Jinja2 templates that conditionally `{% if web_ctx %}…{% endif %}` the suffix. |

## Counts

- **Total locations: 25** (23 baseline + 2 audit-surfaced). Baseline = the 22 prompt entities §2.1 enumerates explicitly across `icp/prompts.py` (5), `signals/prompts.py` (7, including the three section partials P-008/P-009/P-010 collapsed inside the "7 prompts" count), `market_research/prompts.py` (5), `llm_config.py` (4), and `market_scoring/orchestrator.py` (1), plus P-023 (`health.py::probe_llm`, which §2.1 also lists as a baseline simple-invoke candidate). Audit-surfaced additions = P-024 (`graph_chat/prospect_pipeline.py::score_prospect`) and P-025 (`_llm_helpers.py::_DEFAULT_CLAUDE_PROMPT_SUFFIX`).
- **By pattern (each location counted once by its dominant pattern):**
  - simple-invoke = 3 (P-022, P-023, P-024)
  - agent-chain = 2 (P-001, P-011) — only the two locations whose sole invocation path is `agent_chain.invoke` with no Claude alternative
  - custom-dispatch = 12 (P-002..P-007 + P-012 + P-013..P-017) — every ICP-research / market_research / signals-research location is dual-mode (Groq agent-chain when `llm_backend != "claude"`, Claude+Tavily dispatch otherwise) via `_research_agent_output`; classified custom-dispatch because the dual path forces manual `prompt_meta` assembly even on the Groq side.
  - langchain-prompt-template = 4 (P-018, P-019, P-020, P-021)
  - partial (consumed-only, never invoked directly) = 3 (P-008, P-009, P-010)
  - fragment (consumed-only suffix, never invoked directly) = 1 (P-025)
  - Pattern sum: 3 + 2 + 12 + 4 + 3 + 1 = **25** ✓
- **By service:**
  - icp = 5 (P-001..P-005)
  - signals = 7 (P-006..P-012)
  - market_research = 5 (P-013..P-017)
  - llm_config = 4 (P-018..P-021)
  - market_scoring = 1 (P-022)
  - health = 1 (P-023) — deferral candidate
  - graph_chat = 1 (P-024) — **audit-surfaced**
  - shared (`_llm_helpers.py` fragment) = 1 (P-025) — **audit-surfaced** (non-service location; lives in `app/services/_llm_helpers.py`)
  - Service sum: 5 + 7 + 5 + 4 + 1 + 1 + 1 + 1 = **25** ✓

The §2.1 baseline lists 22 prompt entities under the four prompt-bearing services plus `market_scoring`, and additionally calls out `health.py::probe_llm` as a baseline simple-invoke candidate (23 baseline total). The audit surfaces **2 additional** locations (P-024 graph_chat score_prospect, P-025 _llm_helpers Claude suffix). 23 + 2 = 25, matching both the by-pattern and by-service totals and the 25 rows in the Table above. This is well under the abort threshold (>50 additional prompts would trigger the "scope explosion" abort criterion).

## `call_with_prompt` scope confirmation

Helper covers simple-invoke pattern (`llm.invoke([HumanMessage(content=...)])` shape).

The audit found **three** simple-invoke call sites:

- `market_scoring/orchestrator.py:326` — `llm2.invoke([HumanMessage(content=prompt)])` (single-message, exact helper shape).
- `health.py:12` — `llm2.invoke(messages)` where `messages = [HumanMessage(content=test_prompt)]` (single-message, exact helper shape).
- `graph_chat/prospect_pipeline.py:124` — **`llm.invoke([SystemMessage(content=prompt_instruction), HumanMessage(content=f"Cypher Query:\n{cypher_query}\n\n...")])` (two-message system+user composition).**

**Recommendation:** The current `call_with_prompt(prompt_name, **inputs)` helper as specified in plan-13 Task 7 / spec §3.5 emits a single `HumanMessage`. It is sufficient for P-022 and P-023 but does **not** cover P-024's `[SystemMessage, HumanMessage]` shape without modification. Two options:

1. **(Preferred for v1)** Treat P-024 as outside the simple-invoke helper's scope and handle it in Task 13 via the manual recipe (`prompts.render()` + manual `llm.invoke([SystemMessage(content=rendered.body), HumanMessage(content=cypher_query_tail)])` + manual `_prompt_meta_from(rendered)`). This keeps `call_with_prompt` minimal in v1. The graph_chat prompt body (`prompt_instruction`) substitutes nothing at runtime — it's effectively a static system instruction — so the `cypher_query` half stays in code as a Human-side tail. The prompt body migrates; the messaging shape stays inline.
2. **(Alternative)** Extend `call_with_prompt` to accept an optional `as_system=False` flag or expose a `call_with_prompt_messages(prompt_name, system: bool, user_tail: str, **inputs)` sibling. Adds API surface for a single call site.

**Audit recommends Option 1.** Plan-13 Task 13 absorbs P-024 with a manual recipe; the `call_with_prompt` helper's single-message scoping remains sufficient for the two known simple-invoke patterns (market_scoring, health) plus any future fully-single-message simple-invoke prompts.

## Cross-service prompt imports

The audit confirmed **no cross-service prompt imports** in the production codebase.

- Each service's `prompts.py` is imported only by the same service's orchestrator/search/ask/llm submodules:
  - `app/services/icp/prompts.py` → consumed only by `app/services/icp/orchestrator.py`.
  - `app/services/market_research/prompts.py` → consumed only by `app/services/market_research/orchestrator.py`.
  - `app/services/signals/prompts.py` → consumed only by `app/services/signals/search.py` and `app/services/signals/ask.py`.
- `app/core/llm_config.py` prompt assembly is consumed only by `build_llm_config()` in the same file.
- `app/services/_llm_helpers.py::_DEFAULT_CLAUDE_PROMPT_SUFFIX` is a default-arg fragment to a *helper* (`_research_agent_output`) that is then called by `icp/llm.py`, `market_research/llm.py`, `signals/llm.py` — but the *prompt body* never crosses service boundaries (only the helper passes the suffix template).

This confirms the spec §5 coexistence rule that per-service migration is a clean unit of work — no cross-service prompt aliasing exists today, so deleting a service's `prompts.py` during its migration commit cannot break another service.

## Recommended migration order

Per spec §4 Phase 2, with audit confirmation:

1. **`icp/`** — mechanical, exercises base infrastructure. Five `{pre_data}`-substituted templates with no conditional sections. Confirms loader/render/observability pipeline before include mechanism stresses it.
2. **`signals/`** — exercises includes + conditionals. Seven templates including the three orchestrator-assembled partials (P-008/P-009/P-010) that move into Jinja2 `{% if %}` / `{% include %}` blocks. Also exercises the custom-dispatch pattern via P-012 (Anthropic direct POST).
3. **`market_research/`** — volume case. Five near-parallel templates (718 LOC); validates the loader on prompt-heavy workloads.
4. **`llm_config` (`app/core/llm_config.py`)** — LangChain interop. Four `PromptTemplate`-wrapped prompts via the `as_langchain()` adapter. Note this is a single file in `app/core/`, **not** a service directory under `app/services/`; the `prompts/llm_config/` subdirectory in spec §3.1's tree is the prompt-files namespace, not a service. Last in the basic-mechanics sequence so the adapter is introduced after the loader/render/observability pipeline is fully validated.
5. **`market_scoring/`** — single inline prompt (P-022). One commit, small surface, simple-invoke via `call_with_prompt`.
6. **Audit-discovered services** (conditional on plan-13 Task 13):
   - **`graph_chat/`** (P-024) — `score_prospect` two-message composition. Migrate via manual recipe per "`call_with_prompt` scope confirmation" Option 1 above.
   - **`health.py`** (P-023) — **recommended deferral** per spec §2.1 (ROI ~zero on a 1-line smoke probe). Record in `docs/prompt-migration-outcome.md` (Task 15) under "Intentionally deferred."
   - **`_llm_helpers.py`** (P-025) — `_DEFAULT_CLAUDE_PROMPT_SUFFIX` does not migrate to a standalone `.md.j2`. Either inline its 1-line literal into each ICP/market_research/signals Claude-backed prompt as `{% if web_ctx %}\n\nWEB SEARCH RESULTS:\n{{ web_ctx }}\n{% endif %}`, or extract to `prompts/_shared/claude_web_search_suffix.md.j2` partial. **Recommended:** inline into per-prompt templates during Tasks 8/9/10 (the prompt-owning services), and delete `_DEFAULT_CLAUDE_PROMPT_SUFFIX` + the `claude_prompt_suffix_template` parameter from `_research_agent_output()` as part of Task 10 (market_research — the last service consuming `_research_agent_output`, per the icp → signals → market_research order above). Deleting earlier (e.g. at Task 9) would break the still-unmigrated market_research call site. Alternatively, ship the deletion as a small post-Task-10 cleanup commit. Either way, the goal is to eliminate the cross-service default-arg coupling instead of preserving it as a partial.

No additional migration tasks are required beyond plan-13's Tasks 8-13; the audit-surfaced items all map to Task 13.
