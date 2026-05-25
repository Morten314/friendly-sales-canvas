---
synthesizes_review: docs/reviews/13-prompt-management-design-spec-review-2.md
artifact: specs/13-prompt-management-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-25
round: 2
---

## Round Recommendation

yes

Reason: F1's agreed revision adds active LLM routing via a factory for the simple-invoke path (with explicit observability-only scope on the agent-chain path) — this is a genuinely new architectural piece that warrants validation before plan-writing.

## Agreed Findings

- **[High] F1 — `PromptConfig.model` is advisory-only; spec under-delivers on TD-010 item 3.** Verified: §3.5's `call_with_prompt(llm, prompt_name, **inputs)` takes a pre-built `llm` and never reads `rendered.config.model`. The reviewer correctly identifies that TD-010 item 3 promises "changing a prompt's model becomes a prompt edit, not a code edit" but the spec only delivers observability metadata. Revising §3.5 to take the **partial-routing path** (reviewer's option (a) for simple-invoke only, option (b) for agent-chain). Specifically:
   - `app/services/_llm_helpers.py` gains a small LLM-client factory: `_get_llm_for_model(model_name: str) -> Any` returning a pre-built client per known model. Initial registered models: `Qwen/Qwen3-235B-A22B-Instruct-2507-tput` (ChatOpenAI/Together), `llama-3.3-70b-versatile` (ChatGroq). Unknown model → `UnknownModelError`.
   - `call_with_prompt` signature changes to `(prompt_name: str, **inputs) -> tuple[Any, dict]` — no `llm` parameter. The helper resolves the LLM from `rendered.config.model` internally. Front-matter model edits now take effect on simple-invoke calls without code changes.
   - Agent-chain and custom-dispatch call sites continue using pre-built `agent_chain` / `_research_agent_output` infrastructure; the `model` field in those prompts' front-matter is **observability-only in v1** (recorded in `prompt_meta` but not actively routed). This asymmetry is documented explicitly in §3.5 as a v1 scope decision; full active routing on agent-chain paths is a v2 follow-up (would require per-prompt agent_chain construction or refactoring the agent abstraction).
   - `temperature`, `max_tokens`, `response_format`, `timeout_s` follow the same rule: active on simple-invoke (passed through to the LLM client where the client supports per-call overrides), observability-only on agent-chain.

- **[Medium] F2 — `async def` + sync `llm.invoke()` mismatch.** Verified: §3.5 shows `async def call_with_prompt(...)` then `response = llm.invoke(...)` (no `await`). Current source uses sync `llm2.invoke()` at `health.py:12` and `market_scoring/orchestrator.py:326`. Changing to `def call_with_prompt(...)` (sync). FastAPI handles threadpool offload for sync route handlers; matches existing call shapes; avoids the worst-of-both-worlds inconsistency.

- **[Medium] F3 — Phase 1 step 1 vs step 2 wording contradiction.** Verified: step 1 says "No prompt bodies on disk except synthetic" but step 2 ships partials in `_shared/`. Reword step 1: "No *callable* prompt bodies on disk except synthetic ones written by tests to `tmp_path`. Shared partials land in step 2 and are includable-only."

- **[Medium] F4 — `init_registry()` default path is CWD-relative.** Verified: `Path("backend/prompts")` resolves relative to CWD which varies. Changing default to module-relative: `_PROMPTS_ROOT = Path(__file__).resolve().parent.parent / "prompts"` (computed from `app/core/prompts.py`'s location to land at `backend/prompts/`). `app.main.lifespan` may override explicitly, but the default is CWD-independent.

- **[Medium] F5 — Phase 2 ordering risk: signals-first stresses unproven infrastructure.** Reviewer's counter-argument (start with mechanical migration to prove basic loader before stressing includes) is at least as strong as the spec's "fail fast on hardest case" rationale. Swapping order: `icp/` first (five mechanical `{pre_data}` prompts prove the loader/render/observability pipeline with minimal conditional surface), then `signals/` second (proves the include + conditional mechanism on a known-good infrastructure base), then `market_research/`, then `llm_config.py`. Documenting the rationale shift in §4.

- **[Medium] F6 — No `RenderError` type wraps Jinja2 render-time exceptions.** The four error types (`PromptNotFound`, `MissingInputs`, `UnknownInputs`, `BootFailure`) don't cover Jinja2 exceptions that escape the boot AST walk (e.g., filter type errors, attribute access failures on complex inputs). Adding fifth error type `RenderError(name, cause: Exception)` to §3.3 that wraps any Jinja2 exception during `render()`. Call sites can then catch `PromptError` uniformly.

- **[Medium] F7 — `prompt_meta` not recorded on LLM call failure.** Real observability gap: timeouts, rate limits, and API errors lose the prompt context. The reviewer's option (a) (failure-log collection) is the right v2 destination; option (b) (honest v1 scoping) is appropriate now. Adding to §3.5 "What's deliberately not recorded": "Failed LLM calls — when an LLM raises (timeout, rate limit, API error), no `prompt_meta` record is created in v1. A `prompt_failures` collection (or peer log path) is a planned v2 addition; in v1 the gap is acknowledged. Failure observability is more valuable than success observability for debugging, so this is a real limitation, but adding a failure-log path adds error-handling complexity to every call site and is out of scope for v1." Pull-forward trigger: first production incident where the missing prompt_meta on failure blocks root-cause analysis.

- **[Low] F8 — `PromptConfig` missing `version` field.** `get_config(name)` returns `PromptConfig` but version isn't on it; `list_prompts()` returns dicts that include version. Inconsistent. Adding `version: str` to `PromptConfig` so config queries return version without requiring render.

- **[Low] F9 — Jinja2 is undeclared transitive dependency.** Reviewer is correct. Adding `jinja2` (with appropriate version constraint, e.g. `jinja2>=3.1`) to `backend/requirements.txt` as part of Phase 1 step 1.

- **[Low] F10 — `_prompt_meta_from()` module location unspecified.** Co-locating with `RenderedPrompt` in `app/core/prompts.py`. `_llm_helpers.py` imports from there. Single source of truth for the dict shape across simple-invoke and manual-assembly paths.

- **[Low] F11 — `health.py` migration disproportionate.** The reviewer is right that the 1-line `probe_llm` smoke test doesn't warrant the full front-matter + golden fixture ceremony. Updating §2.1 to note `health.py:10` is a **likely "intentionally deferred" candidate** in the Phase 0 audit (reason: 1-line diagnostic prompt; migration ROI near-zero). Final disposition is the audit's call, but the spec flags the recommendation so the audit author doesn't reflexively migrate everything inventoried.

- **[Low] F12 — Golden fixture canonical inputs may be too large.** Adding sizing guidance to §3.6 Layer 2: "Canonical inputs should be minimal but sufficient to exercise all template branches. For prompts with large JSON inputs (e.g., full `company_profile_json`, `market_reports`), use trimmed synthetic data — not full production payloads. The fixture tests verify render correctness, not data completeness."

- **[Low] F13 — `as_langchain()` missing return type annotation.** Adding `-> "PromptTemplate"` (string-quoted to avoid circular import at module load).

- **[Nit] F15 — `rendered_at` ambiguous vs LLM completion time.** Agree on substance, disagree on rename. The field already lives inside the `prompt_meta` sub-document, so the full path `prompt_meta.rendered_at` is unambiguously the prompt's render time. Renaming to `prompt_rendered_at` within `prompt_meta` is redundantly namespaced. Instead, adding a one-sentence clarification under the §3.5 fields table: "`rendered_at` is the timestamp when the prompt was rendered, not when the LLM produced its output — for long agent-chain calls (`max_execution_time=120`), output completion may lag rendering by ≤2 minutes; cost/latency timing belongs in the planned peer `llm_meta` sub-doc."

## Disagreed Findings

None.

## Deferred Findings

- **[Low] F14 — No enforcement mechanism for version bumps when content changes.** Deferred to v2. The reviewer correctly identifies that an author can edit a prompt body without bumping `version`, producing an observability anomaly (same version, different content_hash) rather than a prevented mistake. Adding the `.hash-cache` enforcement mechanism the reviewer suggests is genuinely useful but adds: (a) a new file under version control that has to stay in sync with the prompts, (b) a boot-time check that fails loudly on drift, (c) a regen workflow when intentional version bumps land. In v1, **golden fixture diffs are the partial enforcement mechanism** — a body edit shows up as a fixture diff, and PR review is expected to catch the missing version bump. Documenting this convention gap in the spec (§3.2 version row) so the discipline is explicit. Pull-forward trigger: first incident where an unversioned body edit causes confusion in observability data, or non-engineer prompt iteration begins (PR review can no longer be assumed to enforce convention).

## Severity Disagreements

None. Severities accepted as labeled by the reviewer in all 15 findings.

## Open Questions

- **F1 follow-on — partial-routing scope.** The agreed revision implements active routing for simple-invoke but leaves agent-chain as observability-only in v1. Open question: when the agent-chain path eventually needs active routing (v2), should the architecture be (a) per-prompt agent_chain construction (expensive — agent_chain rebuilds aren't cheap), (b) a model-aware agent factory that picks from a pre-built pool of agent_chains keyed by model, or (c) refactoring the agent abstraction so the model is a per-call concern? Out of scope for v1; flagging for the v2 spec.
- **F1 follow-on — LLM client factory's growth boundary.** The factory initially registers two models (Qwen, llama-3.3-70b). Open question: where does the factory live — `app/core/llm_factory.py`? Inside `_llm_helpers.py`? Co-located with `prompts.py`? The plan should pick a location and ensure the factory's registered-model set has a single source of truth (avoid two services adding the same model with different client configs).
- **F11 follow-on — audit disposition discipline.** The spec now flags `health.py` as a likely "intentionally deferred" candidate. Open question for the Phase 0 author: is there a written threshold for "too trivial to migrate" (e.g., < N lines, no observability value, no non-engineer iteration potential)? Or is each case judged individually? Defining a threshold reduces audit friction; case-by-case keeps judgment local.
