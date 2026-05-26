---
artifact: master
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-26
round: 9
base_ref: a6a3a48969de906b8a5fa306f5da791869001a06
spec_loaded: true
plan_loaded: true
---

> **Note:** Originally named `master-impl-review-1.md`. Renamed to continue the
> `13-prompt-management-impl-review-N` series as round 9 — this was a post-merge
> review of the plan-13 work landed on `master` (commits `a6a3a48..ac128ae`). The
> `artifact: master` field is preserved for accuracy.

## Context

Review of the last 21 commits on `master` (Plan 13 — prompt management system). Spec loaded from `specs/13-prompt-management-design.md` (reconciled post-merge); plan loaded from `plans/13-prompt-management.md`. The venv is broken (dangling symlink to uv python at `/home/agent/`), so tests were not executed — all findings are from static analysis of the diff and source files.

## Findings

### [Medium] `prompt_meta` lost on error path in market_scoring

**Location:** `backend/app/services/market_scoring/scoring.py:135-154`

When `score_single_lead_against_market` raises (e.g. LLM response JSON parse failure), the `except` block in `scoring.py` constructs a `fallback_payload` and calls `_persist_market_score_for_lead` **without** `prompt_meta`. The `orchestrator.py:373` fallback (`prompt_meta or {}`) writes `prompt_meta: {}` to Mongo. If the LLM call succeeded but post-processing failed, the render's `prompt_meta` — which was already computed — is discarded. This means you can never answer "which prompt version produced this failed score?" for the class of failures where the LLM returned garbage JSON.

**Fix:** capture `prompt_meta` before the try block (or in a wider scope) and pass it on the error path.

### [Medium] `_prompt_meta` discarded for prospect scoring

**Location:** `backend/app/services/data_sources/loaders.py:90`

`score, _prompt_meta = score_prospect(llm, temp_cypher)` — the `_prompt_meta` is discarded with the underscore convention. Prospect scoring has **no observability**: there is no record of which prompt version or content hash produced a given score. The `score_prospect` function in `prospect_pipeline.py` does correctly return `(score, prompt_meta)`, so the plumbing exists, but the caller throws it away.

This is a gap in the migration's definition-of-done checklist (spec §6 item 5: "Every service's persistence calls write a `prompt_meta` sub-doc alongside LLM output"). Prospect scoring is not persisted to Mongo (scores are returned inline in the HTTP response), so the gap is in the response shape rather than Mongo — but the spec's intent is full coverage.

### [Low] No `prompt_meta` observability for Cypher/QA graph chains

**Location:** `backend/app/core/llm_config.py:61-69`

`as_langchain()` returns a `PromptTemplate` consumed by `GraphCypherQAChain.from_llm()`. LangChain's chain internally calls `.format()` at query time — there is no hook to capture `prompt_meta` (content_hash, version, etc.) for graph QA or Cypher generation calls. This is a known v1 omission acknowledged in the spec (§3.5 "active routing on simple-invoke path; observability-only on agent-chain" and the `as_langchain` path is neither), but worth surfacing because graph chat is a user-facing feature with no prompt-level debugging surface.

### [Low] Unused `llm2` parameter retained in `score_single_lead_against_market`

**Location:** `backend/app/services/market_scoring/orchestrator.py:283`

The `llm2` parameter is documented as "kept in signature for backward compat with callers; ignored in v1." All callers in `scoring.py` still pass `llm2` (the LLMBundle's `llm2` field). This creates a false dependency — the function signature implies `llm2` is used, but `call_with_prompt` resolves the LLM from the prompt's front-matter `model` field via the factory. The parameter should be removed and callers updated since the spec says "no backwards-compat shims" (CLAUDE.md / spec §4 Phase 2).

### [Low] `_registry` singleton silently replaced — no production guard

**Location:** `backend/app/core/prompts.py:286-405`

The spec §3.3 documents "double-call behavior" as the v1 contract: a second `init_registry()` call silently replaces the module-level singleton. This is acceptable for test overrides, but `app.main.lifespan` at `app/main.py:43` calls `init_registry()` without any guard against double-invocation. If lifespan were somehow triggered twice (e.g. during testing, or a FastAPI reload), the registry would be silently rebuilt. The spec acknowledges this and documents a pull-forward trigger ("first production bug masked by silent replacement"), so this is informational rather than actionable — but worth noting since the lifespan has no guard.

### [Nit] Typo in signal_ask error log

**Location:** `backend/app/services/signals/ask.py:107`

`"Error in signal_Ask"` — capital A in "Ask" is inconsistent with the function name `signal_ask`.

### [Nit] `_include_depth_greater_than_one_rejected` test validates max_depth=1 but `_expand_includes` has `max_depth` as a parameter

**Location:** `backend/tests/unit/test_prompts_loader.py` (test near end), `backend/app/core/prompts.py:254`

The `_expand_includes` function accepts `max_depth` as a parameter (defaulting to 1), but `init_registry` calls it without specifying `max_depth`. The test validates depth > 1 is rejected, which is correct for the default. However, since `max_depth` is exposed as a parameter, a future caller could bypass the depth limit by passing `max_depth=2` without any validation that this is intentional. Not a bug today — just noting the parameter is a latent escape hatch.
