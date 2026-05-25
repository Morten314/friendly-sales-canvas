---
synthesizes_review: docs/reviews/13-prompt-management-design-spec-review-1.md
artifact: specs/13-prompt-management-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-25
round: 1
---

## Round Recommendation

no

Reason: Both High findings agreed and being addressed; remaining disagreements are bounded (scope decision already made knowingly during brainstorming; Nit-level convention preferences) and the agreed revisions do not open new design surface.

## Agreed Findings

- **[High] F1 — `call_with_prompt` invocation diversity.** Verified against source: `market_scoring/orchestrator.py:326` uses `llm2.invoke([HumanMessage(content=prompt)])`; `icp/orchestrator.py:53` uses `agent_chain.invoke({'input': pmt})`. The spec's sketched `await llm.ainvoke(rendered.body)` cannot cover these uniformly. Revising §3.5 to scope `call_with_prompt` to the simple `llm.invoke(prompt_string)` path only. Agent_chain and Claude+Tavily call sites call `prompts.render()` directly and assemble `prompt_meta` themselves. The spec will document the `prompt_meta` dict shape as the single source of truth so manual assembly stays uniform.
- **[High] F2 — Inline prompts overlooked in baseline inventory.** Verified against source: `market_scoring/orchestrator.py:282-325` (`score_single_lead_against_market`) is a 34-line inline f-string prompt; `health.py:10` is a trivial test prompt. Revising §2.1 baseline inventory to list these explicitly alongside the three `prompts.py` modules and `llm_config.py`. Reframing §3.1 filesystem-layout tree as provisional pending Phase 0 audit reconciliation (current phrasing already hints at this; making it definitive).
- **[Medium] F3 — `as_langchain()` lacks StrictUndefined safety.** LangChain's `PromptTemplate.from_template(..., template_format='jinja2')` constructs its own Jinja2 environment without StrictUndefined. Revising §3.4 LangChain interop to document the asymmetry explicitly: the LangChain path relies on boot-time AST validation as its only safety net; this is acceptable because (a) the four LangChain-consumed prompts are self-contained (no includes; no dynamic refs likely to evade the AST walk), and (b) the surface area is bounded to those four prompts only.
- **[Medium] F4 — Content hash semantics ambiguous.** Revising §3.3 step 7 and §3.5 to define `content_hash` precisely: SHA-256 of the static source-expanded template body — every `{% include 'X' %}` directive is textually replaced with X's raw source body before hashing (recursively, bounded by the include-depth limit), with no Jinja2 rendering performed. This is partial-sensitive (a partial edit bumps every includer's hash) and input-independent. Whitespace effects from `trim_blocks`/`lstrip_blocks` are intentionally not reflected — the hash detects *source* changes, not *render* changes.
- **[Medium] F6 — `retry_policy` has no consumer.** Removing `retry_policy` from initial front-matter schema, from `_shared/defaults.yaml` example, and from `PromptConfig` dataclass. Re-introduce when a real consumer exists (e.g., when `call_with_prompt` or a peer helper implements tenacity-style retry, or when a per-prompt resilience policy is genuinely needed).
- **[Medium] F7 — Include-depth limit 2 not motivated.** Reducing initial limit to depth 1 (top-level prompts include leaf partials only; partials cannot include partials). Adding a note that the limit can be raised to 2 when a concrete use case arises. The spec's own examples (§3.4) only exercise depth 1.
- **[Medium] F8 — `llm_config.py` deletion target under-specified.** Adding an explicit sub-bullet to §4 Phase 2 item 4: "Delete `_CYPHER_BASE`, `_CYPHER_GEN_PROMPT_OVERLAY`, `_CYPHER_GEN_PROMPT2_OVERLAY`, `_CYPHER_TAIL`, `_QA_BASE`, `_QA_PROMPT_TEMPLATE_OVERLAY`, `_QA_TAIL`, and the assembled prompt constants (`Cypher_gen_prompt`, `Cypher_gen_prompt2`, `qa_prompt_template`, `qa_prompt_template2`, `Cypher_Prompt`, `Cypher_Prompt2`, `qa_prompt`, `qa_prompt2`) from `llm_config.py`. `build_llm_config()` calls `prompts.as_langchain()` and stores the resulting `PromptTemplate` references on the `LLMBundle` instead."
- **[Low] F10 — CI/regen workflow under-specified.** Adding a sentence to §3.6 Layer 2: "CI runs `test_prompts_golden.py` and fails on drift; the failure message includes the regen command. `_inputs/*.json` files are checked in and manually updated when prompt inputs change. The regen script does not auto-update input skeletons when inputs change — that remains a deliberate author step so input-shape drift surfaces as a deliberate edit."
- **[Low] F11 — `render_inputs_hash` collisions with `default=str`.** Adding a one-sentence limitation note to §3.3 render lifecycle step 4: "Callers should pass JSON-serializable types (str, int, float, bool, None, list, dict) as inputs. Non-serializable types are coerced via `str()` and may produce hash collisions across semantically different values. The hash is observability-grade ('were these likely the same inputs as last call?'), not security-grade."
- **[Nit] F14 — §4.1 numbering inconsistency.** Renaming §4.1 from numeric sub-heading to a plain `### Migration outcome report` sub-section under §4. The parent §4 uses Phase labels rather than section numbers; the sub-section follows suit.
- **[Medium] F16 — Plan-readiness rolled up.** Addressed by the F1 and F2 revisions. Adding a brief clarification to §4 Phase 0 that the audit output is a gate producing: (a) authoritative prompt list, (b) call-site classification (simple-invoke vs. agent-chain vs. Claude+Tavily — the three patterns identified in F1), (c) confirmation of `call_with_prompt` scope based on the call-site classification.

## Disagreed Findings

- **[Medium] F5 — Spec over-engineered for 0-user MVP.** Disagree. The user knowingly selected the broader scope during brainstorming. Specifically: when asked "Which prompts should the new prompt management system manage?", the user picked the most ambitious option ("Every prompt in backend/") over the recommended minimal scope ("Only the three services' prompts.py"). Each subsequent design section (file format, loader API, rendering, observability, test scaffold) was reviewed and approved per-section. The reviewer's two-tier suggestion (Tier 1 = externalize + render; Tier 2 = observability + golden fixtures, deferred to a future trigger) contradicts those choices. Per CLAUDE.md the pre-launch posture authorizes aggressive refactors — it does not mandate minimal ones. If the user wants to re-scope, they can; that decision sits above this review. Spec stands as-is.
- **[Nit] F12 — `.md.j2` vs `.j2.md` extension convention.** Disagree on action. The reviewer themselves writes "not wrong, just worth noting." The `.md.j2` choice was deliberate (editor markdown highlighting takes the rightmost-known extension and Jinja2's `.j2` is the broader-recognized template-extension; both heuristics align). No change to §3.1.
- **[Nit] F13 — Phase 0-3 numbering vs repo's Phase A-L.** Disagree on action. The backend-modularization Phase A-L sequence was a single contiguous program with letter labels; Spec 13's Phase 0-3 are scoped within this spec only and carry no naming collision in context. The plan author is free to rename if they prefer; the spec itself stands.

## Deferred Findings

- **[Low] F9 — No override-clearing mechanism in defaults inheritance.** Deferred. The reviewer concedes "Likely not worth solving now but worth noting." Adding a brief documentation note to §3.2 stating the limitation (all defaults are always present in the merged config; no `null`-sentinel for "use LLM-client default") so the gap is recorded but not fixed. Re-visit trigger: first prompt that genuinely needs to disable an inherited default (e.g., remove `timeout_s` so the LLM client's own default applies).
- **[Nit] F15 — `app.core.prompts` vs `app.services.signals.prompts` import collision.** Deferred. The reviewer correctly characterizes this as a plan-authoring concern, not a spec defect. Each service's Phase 2 commit deletes its `prompts.py` before any cross-call-site import patterns are needed; transient coexistence is bounded to within a single PR. The plan author should note import-aliasing if any service's migration commit references both old and new modules in transit. No spec change.

## Severity Disagreements

None. Where I agree with the substance of a finding I also agree with its severity. Where I disagree with substance the severity question is moot.

## Open Questions

- **F1 follow-on — `extract_prompt_meta` helper.** The agreed revision scopes `call_with_prompt` to simple-invoke only; agent_chain and Claude+Tavily call sites assemble `prompt_meta` themselves from a `RenderedPrompt`. Open question for the plan author: should the spec also provide a trivial `extract_prompt_meta(rendered: RenderedPrompt) -> dict` helper so all call sites have a single point of truth for the dict shape, or is the 6-key dict simple enough to inline at each call site? Leaning toward providing the helper for symmetry with `call_with_prompt`, but happy for the plan-writing pass to decide.
- **F4 follow-on — depth-2 readiness.** The agreed F7 revision drops include depth to 1 initially. The agreed F4 content-hash definition (static source expansion) trivially supports depth 2 if the limit is later raised (recursive substitution terminates at depth bound). Flagging here so the implementation's depth-bound enforcement and the hash-computation algorithm stay aligned if depth is ever increased.
