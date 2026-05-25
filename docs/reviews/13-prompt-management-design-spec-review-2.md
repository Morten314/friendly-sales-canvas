---
artifact: specs/13-prompt-management-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-25
round: 2
---

## Context

Round 2 review of the spec post-synthesis of round 1 findings. All agreed revisions from round 1 synthesis are incorporated: `call_with_prompt` scoped to simple-invoke, inline prompts listed in baseline, LangChain `StrictUndefined` asymmetry documented, content hash defined precisely, `retry_policy` removed, include depth reduced to 1, `llm_config.py` deletion targets specified, CI/regen workflow documented, `render_inputs_hash` limitation noted, `_prompt_meta_from()` helper introduced, and Phase 0 gate deliverables specified. This review focuses on residual and newly-visible issues.

## Findings

### [High] `PromptConfig.model` is advisory-only — spec promises active config but delivers observability metadata

**Location:** §3.2 front-matter fields table (`model`), §3.3 `PromptConfig` dataclass, §3.5 `call_with_prompt` signature and manual-assembly examples; TD-010 "What it should be" item 3: "Per-prompt config bundle — model, temperature, max_tokens, response_format, timeout, retry policy travel with the prompt (front-matter or sidecar config), not with the call site. Changing a prompt's model becomes a prompt edit, not a code edit."

TD-010's item 3 explicitly promises "changing a prompt's model becomes a prompt edit, not a code edit." The spec designs a `model` field in `PromptConfig` and records it in `prompt_meta` for observability. But the actual LLM client instances are built centrally in `build_llm_config()` (`llm_config.py:218-267`): `llm` = ChatGroq with "llama-3.3-70b-versatile", `llm2` = ChatOpenAI with "Qwen/Qwen3-235B-A22B-Instruct-2507-tput". The `call_with_prompt(llm, prompt_name, **inputs)` helper takes a pre-built `llm` parameter and ignores `rendered.config.model`. The manual-assembly examples also use pre-built LLM clients. The prompt's front-matter `model` field is purely recorded-in-observability — it never reaches the LLM client constructor.

Same applies to `temperature`: the prompt front-matter declares it, but the LLM client is built with its own defaults in `build_llm_config()`. No code path reads `rendered.config.temperature` and passes it to an LLM client.

This means the spec does not fulfill TD-010 item 3. "Changing a prompt's model" still requires a code edit (to `build_llm_config()` or the call site) — exactly what TD-010 says should not be necessary. The `model` and `temperature` fields in front-matter are expensive cargo-cult metadata unless the system actually uses them to configure the LLM call.

**Suggestion:** Either (a) implement model/temperature routing: `call_with_prompt` reads `rendered.config.model` and `rendered.config.temperature`, selects or constructs the appropriate LLM client, and makes the call — so front-matter edits actually change LLM behavior; or (b) acknowledge in the spec that `model` and `temperature` are observability-only fields in v1, and that TD-010 item 3 is only partially resolved (active config deferred to a follow-up). Option (a) adds significant complexity (LLM client factory, model registry, per-call client selection); option (b) is honest scoping. The current spec silently delivers less than TD-010 promises.

### [Medium] `call_with_prompt` is declared `async` but calls sync `llm.invoke()` — blocks the event loop

**Location:** §3.5 "Simple-invoke helper" — `async def call_with_prompt(...)` then `response = llm.invoke([HumanMessage(content=rendered.body)])`

The helper is declared `async def` but calls `llm.invoke()` (synchronous LangChain call). In FastAPI's async context, calling a blocking sync function inside an `async def` blocks the event loop for the LLM call's entire duration (potentially 10-120 seconds for the Together Qwen model). Either the function should be `def` (sync, FastAPI runs it in a threadpool automatically), or it should use `await llm.ainvoke()` (async). The current signature is the worst of both worlds: async appearance with blocking reality.

Verified against source: `health.py:12` and `market_scoring/orchestrator.py:326` both use sync `llm2.invoke()`, so the sync pattern matches current code. The plan should decide: all sync (`def call_with_prompt`) or all async (`async def` + `ainvoke`).

**Suggestion:** Either make it `def call_with_prompt(...)` (sync — matches current call sites, FastAPI handles threadpool offload), or `async def` with `await llm.ainvoke(...)`. Don't mix.

### [Medium] Phase 1 step 1 contradicts Phase 1 step 2 on "no prompt bodies on disk"

**Location:** §4 Phase 1 — step 1: "No prompt bodies on disk except synthetic ones written by tests to `tmp_path`." Step 2: "`backend/prompts/_shared/` — `defaults.yaml` plus shared partials extracted from the inventory's common fragments."

Step 2 creates actual prompt partial files in `backend/prompts/_shared/` (e.g., `response_format_json.md.j2`, `scout_persona.md.j2`). These are prompt bodies (partials). Step 1 says "no prompt bodies on disk" but step 2 immediately places them. The intent is clear (no *callable* prompts yet, only partials), but the phrasing is contradictory and could confuse the plan author about what Phase 1 step 2 delivers.

**Suggestion:** Amend Phase 1 step 1 to: "No callable prompt bodies on disk except synthetic ones written by tests to `tmp_path`. Shared partials land in step 2."

### [Medium] `init_registry()` default path `Path("backend/prompts")` is CWD-relative, not module-relative

**Location:** §3.3 "Boot lifecycle" — `def init_registry(root: Path = Path("backend/prompts")) -> Registry:`

`Path("backend/prompts")` resolves relative to the process working directory. In production (Render), the backend likely runs from `backend/` as CWD, making `backend/prompts` incorrect — the actual path would be just `prompts/`. In local dev, it depends on where `uvicorn` is launched from. The spec should use a module-relative path computed from `__file__` (e.g., `Path(__file__).resolve().parent.parent / "prompts"`) to be deterministic regardless of CWD.

Verified against source: `app/main.py:39-40` shows lifespan runs in the FastAPI app context; the current `build_clients()` and `build_llm_config()` don't depend on CWD, but file-path-based loading will.

**Suggestion:** Change the default to a module-relative computation, or specify that the argument is always provided explicitly from `main.py` with a path resolved relative to `app.main.__file__`.

### [Medium] Phase 2 ordering — signals-first is high-risk "fail fast" with no acknowledged fallback

**Location:** §4 Phase 2 — "1. `signals/` first — its conditional logic is the strongest test of Jinja2 includes + conditionals. Migrating it first proves the mechanism."

Starting with the most complex service is a valid strategy ("fail fast on the hardest case"), but it carries a specific risk: if the Jinja2 conditional-include pattern doesn't work as designed (e.g., `trim_blocks` produces unexpected whitespace around `{% if %}`/`{% include %}` blocks, or the include-depth-1 constraint proves too restrictive for the signals' branching structure), the infrastructure needs iteration before any service can migrate. Starting with `icp/` (all five prompts are mechanical `{pre_data}` substitutions, no conditionals) would prove the basic loader/render path works with lower risk, then signals proves the advanced features. The spec doesn't discuss this tradeoff or provide a fallback ordering.

**Suggestion:** Either (a) acknowledge the risk explicitly and state the rationale for signals-first (the spec is allowed to pick a risky ordering, but should own it), or (b) swap icp and signals so the mechanical migration proves infrastructure first.

### [Medium] No error type defined for Jinja2 render failures at call time

**Location:** §3.3 "Error types (all subclass `PromptError`)", §3.3 "Render lifecycle"

The spec defines four error types: `PromptNotFound`, `MissingInputs`, `UnknownInputs`, `BootFailure`. Boot-time validation catches malformed templates. But the render lifecycle (step 3: "Render the cached Jinja template with the provided inputs") can still fail at call time if the template uses Jinja2 features that pass AST validation but fail during rendering (e.g., filter applied to wrong type, undefined attribute access on a complex object passed as input). The `StrictUndefined` flag converts some silent failures into exceptions, but those exceptions are raw `UndefinedError` from Jinja2 — not caught by the spec's `PromptError` hierarchy.

**Suggestion:** Add a fifth error type: `RenderError(name, cause: Exception)` — wraps any Jinja2 rendering exception into the `PromptError` hierarchy so call sites can catch `PromptError` uniformly.

### [Medium] `prompt_meta` not recorded on LLM call failure — observability gap for debugging

**Location:** §3.5 "What gets recorded", §3.5 "How call sites get coverage"

The spec records `prompt_meta` alongside successful LLM output in Mongo. But when an LLM call fails (timeout, rate limit, API error), no record is created — the rendered prompt and its metadata are lost. For production debugging, knowing "which prompt is timing out?" or "which prompt hits rate limits?" is more valuable than knowing which prompts succeed. The spec explicitly excludes "Cost / latency per call" but failure observability is a different concern.

**Suggestion:** Either (a) add a failure-log path: `call_with_prompt` (and the manual-assembly call sites) catch LLM exceptions, persist `prompt_meta` + error details to a lightweight `prompt_failures` collection or log, then re-raise; or (b) explicitly scope v1 observability to successful calls only and note the gap for a follow-up.

### [Low] `PromptConfig` dataclass has no `version` field — `get_config()` cannot return it

**Location:** §3.3 `PromptConfig` dataclass, `get_config()` docstring, `list_prompts()` docstring

`PromptConfig` carries `model`, `temperature`, `max_tokens`, `response_format`, `timeout_s` — but not `version`. `get_config(name)` returns `PromptConfig`, so callers can't retrieve the prompt's version without rendering. Meanwhile `list_prompts()` returns `list[dict[str, Any]]` which does include version. This is inconsistent: version is a config-level property (it's in the front-matter, not a render artifact), so it should be accessible without rendering.

**Suggestion:** Either add `version: str` to `PromptConfig`, or create a `PromptSummary` dataclass used by both `get_config()` and `list_prompts()` that includes name, version, and config fields.

### [Low] Jinja2 is an undeclared transitive dependency

**Location:** §3.4 "Jinja2 environment", `backend/requirements.txt`

Jinja2 is not listed in `backend/requirements.txt`. It's currently available as a transitive dependency of `langchain-core`. Relying on a transitive dependency for a core subsystem is fragile: if LangChain changes its dependency tree, the prompt system breaks. The spec designs Jinja2 as the primary template engine — it should be a direct dependency.

**Suggestion:** Add `jinja2` to `backend/requirements.txt` in Phase 1 step 1.

### [Low] `_prompt_meta_from()` helper has no specified module location

**Location:** §3.5 "Simple-invoke helper" and "Manual assembly for patterns 2 and 3"

The `_prompt_meta_from(rendered)` helper is shown in two contexts: inside `_llm_helpers.py` (used by `call_with_prompt`) and at service call sites (used by manual assembly). But the spec doesn't say where it lives. If it's in `_llm_helpers.py`, service code needs to import from there. If it's in `app/core/prompts.py`, it's more natural (same module as `RenderedPrompt`). The spec should specify.

**Suggestion:** Place `_prompt_meta_from()` in `app/core/prompts.py` (co-located with `RenderedPrompt` definition) and have `_llm_helpers.py` import it from there. This makes it a single source of truth for the dict shape.

### [Low] `health.py` smoke-test prompt is 1 line — full migration is disproportionate

**Location:** §2.1 — "`health.py:10` (`probe_llm` smoke-test prompt)"; §3.1 filesystem layout; §3.6 test scaffold

Verified against source: `health.py:10` is `test_prompt = "Generate a simple JSON: {\"test\": \"hello\"}"` — a trivial 1-line string used by a smoke-test endpoint. Migrating this to a full `.md.j2` file with YAML front-matter (name, version, description, model, response_format, inputs), a golden rendered fixture, a canonical inputs JSON, and `prompt_meta` observability on the response creates significant ceremony for a diagnostic probe. The ROI is near-zero: no non-engineer will ever iterate this prompt, and observability on a smoke-test is not useful.

**Suggestion:** Record `health.py`'s prompt as "intentionally deferred" in the Phase 0 audit with reason "1-line smoke-test prompt; migration cost disproportionate to value." Exclude it from the filesystem layout and test scaffold.

### [Low] Golden fixture canonical inputs may be impractically large for some prompts

**Location:** §3.6 Layer 2 — `_inputs/*.json` files, §3.2 front-matter example (`inputs: [company_profile_json]`)

Several prompts take large JSON blobs as inputs (e.g., `company_profile_json`, `market_reports`, `lead` data). The golden fixture system requires checked-in `_inputs/<name>.json` files with "canonical" inputs. For prompts that ingest entire company profiles or multi-report bundles, these input files could be 10-100+ KB each. The spec doesn't address sizing guidance, synthetic vs. real data, or whether the fixtures should use minimal stubs vs. realistic payloads.

**Suggestion:** Add a note to §3.6 Layer 2: "Canonical inputs should be minimal but sufficient to exercise all template branches. For prompts with large JSON inputs, use trimmed synthetic data rather than full production payloads. The fixture tests verify render correctness, not data completeness."

### [Low] `as_langchain()` function signature missing return type annotation

**Location:** §3.3 "Public surface" — `def as_langchain(name: str):`

All other public functions have return type annotations (`-> RenderedPrompt`, `-> PromptConfig`, `-> list[dict[str, Any]]`). `as_langchain` has none. The docstring says it returns a `langchain_core.prompts.PromptTemplate` — the type annotation should match.

**Suggestion:** `def as_langchain(name: str) -> "PromptTemplate":` (with the appropriate import, possibly `from __future__ import annotations` to avoid circular imports).

### [Low] No enforcement mechanism for version bumps when content changes

**Location:** §3.2 front-matter fields — `version: "Manually bumped on intent change. Recorded in observability."`

The spec requires manual version bumps but provides no drift detection. If a prompt body changes without a version bump, `content_hash` will differ but `version` stays the same. Golden fixture tests catch the content change (rendered output differs) but not the version-stale condition. The observability data would show the same `version` with different `content_hash` values — a detectable anomaly but not a prevented one.

**Suggestion:** Add a boot-time check: if the `content_hash` for a prompt name differs from a persisted "last-seen hash" (stored in a `.hash-cache` file or computed fresh against git), warn or fail. Alternatively, accept this as a documentation/convention gap and note it in `docs/PROMPTS.md`.

### [Nit] `rendered_at` field name could be confused with "LLM output produced at"

**Location:** §3.5 "What gets recorded" — `rendered_at: server timestamp at render time`

The field captures when the prompt was rendered, not when the LLM produced output. For simple-invoke calls, these are typically <1 second apart. But for agent-chain calls (ReAct with `max_iterations=20`, `max_execution_time=120`), the LLM call could take up to 2 minutes — making `rendered_at` misleadingly early relative to the output timestamp. The field name is technically accurate but could be clearer.

**Suggestion:** Consider renaming to `prompt_rendered_at` to disambiguate from a hypothetical `llm_completed_at`. Or document explicitly that this is render time, not completion time.
