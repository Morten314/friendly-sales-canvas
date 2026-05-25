---
artifact: specs/13-prompt-management-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-25
round: 3
---

## Findings

### [High] `call_with_prompt` signature contradicts §3.5 in Phase 1 step 4

**Location:** §3.5 "Simple-invoke helper" vs §4 Phase 1 step 4

§3.5 defines `call_with_prompt(prompt_name, **inputs)` where the LLM is resolved internally from `rendered.config.model` via `_get_llm_for_model()`. The caller does not pass an LLM instance. §4 Phase 1 step 4 however says `call_with_prompt(llm, name, **inputs)` — a different signature accepting an explicit `llm` argument. This is not a typo in passing; it contradicts the central design goal of §3.5 ("front-matter `model` edits actively change behavior on this path with no code change"). If the caller passes `llm`, front-matter model routing is dead.

**Resolution:** §4 step 4 should read `call_with_prompt(name, **inputs)` matching §3.5. The `llm` parameter should not exist.

### [High] `retry_policy` listed in §2.1 scope but absent from §3.2 schema

**Location:** §2.1 bullet 4 vs §3.2 front-matter table and `PromptConfig` dataclass

§2.1 states: "Per-prompt YAML front-matter carrying model, temperature, max_tokens, response_format, timeout, retry_policy, semver version, declared inputs." But the front-matter field table in §3.2 has no `retry_policy` row, and the `PromptConfig` dataclass explicitly omits it with a comment: "retry_policy intentionally absent from v1 schema."

The scope section over-promises what the design section delivers. A reader skimming §2.1 will expect `retry_policy` in the front-matter; a reader of §3.2 will not find it.

**Resolution:** Remove `retry_policy` from the §2.1 enumeration, or add a parenthetical "(v2)" to flag the deferral.

### [High] Module-level `render()` / `get_config()` need `app.state` access — mechanism unspecified

**Location:** §3.3 "Boot lifecycle" paragraph after `init_registry()` definition

The spec says: "module-level `render()` / `get_config()` / `list_prompts()` are thin wrappers that delegate to `app.state.prompts`." But no mechanism is shown for how module-level functions (which have no access to a FastAPI `Request` object) resolve the running app instance and read `app.state`.

The implied pattern is a module-level global (e.g., `_registry: Registry | None = None`) set during `init_registry()`. This works but is not stated, and the interaction between the `init_registry()` return value (stored on `app.state.prompts`) and the module-level wrappers is ambiguous: are they the same reference? Does the module keep its own copy? If `init_registry()` is called with a test-provided `tmp_path`, does the module-level singleton get replaced?

**Resolution:** Show the module-level state variable and explain the dual-access pattern (lifespan sets both `app.state.prompts` and the module-level `_registry`). Clarify that tests call `init_registry(test_root)` which replaces the module singleton.

### [High] Include-depth test assertion contradicts §3.4 depth limit

**Location:** §3.6 Layer 1 — "Include depth >2 rejected at boot" vs §3.4 "Maximum include depth: 1"

§3.4 states: "Maximum include depth: 1. A top-level prompt may include leaf partials in `_shared/`; partials may not include other partials. Deeper nesting is rejected at boot." This means depth 2 (partial-includes-partial) is the first rejected depth.

§3.6 Layer 1 says "Include depth >2 rejected at boot" — which implies depth 2 is allowed and depth 3+ is rejected. This is a direct contradiction.

**Resolution:** §3.6 test should read "Include depth >1 rejected at boot" or equivalently "Include depth ≥2 rejected at boot."

### [Medium] `_PROMPTS_ROOT` path computation via `__file__` parent navigation is fragile

**Location:** §3.3 "Boot lifecycle" — `_PROMPTS_ROOT = Path(__file__).resolve().parent.parent.parent / "prompts"`

The path `app/core/prompts.py` → three `.parent` calls → `backend/` is correct today but silently breaks if `prompts.py` is ever moved within the directory tree (e.g., from `app/core/` to `app/`). No assertion or test validates the resolved path points to a directory that exists. A silent wrong path would produce an empty registry (no `.md.j2` files found) rather than a clear error.

**Resolution:** Add a boot-time assertion that `_PROMPTS_ROOT.is_dir()` and that at least the `_shared/` subdirectory exists. The empty-registry-during-development scenario is likely and deserves an early loud failure.

### [Medium] LLM factory registration scope says "two models" but inventory implies three

**Location:** §3.5 "LLM-client factory" paragraph — "registers the two models in use today (`Qwen/Qwen3-235B-A22B-Instruct-2507-tput`, `llama-3.3-70b-versatile`)"

The file tree in §3.1 includes `signals/signal_ask_claude.md.j2` — a Claude-specific prompt variant. If Claude is an active model (even if proxied through one of the two registered providers), the "two models" claim is either wrong or the Claude prompt needs clarification about which LLM it routes to. If Claude is not actually in use, the file tree entry is misleading.

**Resolution:** Either (a) confirm that the Claude prompt uses one of the two registered models and note it in the prompt's front-matter `model` field, or (b) add the Claude model to the registration list, or (c) rename the file if "claude" is a historical artifact.

### [Medium] `content_hash` source-expansion algorithm underspecified

**Location:** §3.3 boot step 7

The hash is "SHA-256 of the prompt's *static source-expanded body* — the raw template body with every `{% include 'X' %}` directive textually replaced by X's raw source body, recursively bounded by the include-depth limit." But the replacement procedure is ambiguous:

1. Is the `{% include %}` line replaced wholesale (losing surrounding whitespace/indentation)?
2. Does replacement include the included file's own front-matter, or only its body?
3. What about `{% include %}` inside Jinja2 `{% if %}` blocks — are they expanded even though the conditional may never be true?
4. Is the replacement a textual find-and-replace (fragile) or a parse-tree transformation?

The hash must be deterministic across boots for the same source files. Any ambiguity in the expansion algorithm creates a risk of non-deterministic hashes.

**Resolution:** Specify that expansion (a) strips the included file's front-matter, (b) replaces the entire `{% include %}` line (including its indentation) with the included body, (c) is applied unconditionally to all `{% include %}` directives regardless of surrounding control flow, and (d) uses the same recursive walk as the AST validation in step 6. Alternatively, simplify: hash the concatenated source files (prompt body + all transitively included partial bodies) in a defined order, without performing textual substitution.

### [Medium] No encoding or parse-error resilience specified

**Location:** §3.3 boot steps 1-2

The spec assumes all `.md.j2` files are valid UTF-8 with well-formed YAML front-matter. No behavior is specified for:
- Non-UTF-8 files (encoding error at read time)
- Malformed YAML (non-parseable front-matter)
- Missing closing `---` fence
- BOM markers

These will all surface as unhandled exceptions during `init_registry()`, caught by the generic `BootFailure` aggregation — but only if the walk-and-parse loop wraps each file in try/except. The spec doesn't state this explicitly, and the "aggregates every malformed prompt" guarantee depends on it.

**Resolution:** Add to boot step 2: "Parse errors (encoding, YAML, missing fences) are captured as failure entries and aggregated; processing continues for remaining files."

### [Medium] No boot-time validation that `_shared/defaults.yaml` exists and is well-formed

**Location:** §3.3 boot steps, §3.2 "Defaults file"

The merge with `_shared/defaults.yaml` happens at boot step 3. But if the file is missing, absent, or contains invalid YAML, the behavior is unspecified. The spec guarantees "boot fails loudly if a required field is missing after the merge" — but a missing defaults file may cause a different failure mode (exception during file open) that pre-empts the validation step.

**Resolution:** Add an explicit boot step (before step 1 or at step 3): "Load and parse `_shared/defaults.yaml`. If missing or malformed, raise `BootFailure` immediately."

### [Medium] No performance/latency budget for boot-time initialization

**Location:** §3.3 boot lifecycle

The boot walks all `.md.j2` files, parses YAML, builds Jinja2 ASTs, computes SHA-256 hashes, and validates input declarations. For the known baseline (~25 prompt files) this is trivial. But the spec doesn't state a performance expectation or ceiling. If the prompt corpus grows to 100+ files, boot time becomes relevant on Render's cold-start path.

**Resolution:** Add a non-functional note: "Boot-time initialization of the registry is expected to complete in <1 second for up to 200 prompt files. If this ceiling is breached, add lazy-loading or a pre-compiled cache." This sets a measurable bar.

### [Medium] `as_langchain()` design forces self-contained prompts — potential future pain

**Location:** §3.4 "LangChain interop" Caveat 1

The four LangChain-consumed prompts "must therefore be authored as self-contained single files — no includes." This means the shared partials (`response_format_json.md.j2`, `final_answer_directive.md.j2`) cannot be used by these prompts, forcing either (a) duplicating the partial content in each LangChain prompt, or (b) the LangChain prompts diverging from the shared-directive convention.

The spec acknowledges this but doesn't discuss mitigation. If a shared directive changes (e.g., the JSON output format instruction), the four LangChain prompts must be manually updated in parallel — the exact problem the shared partials system was designed to prevent.

**Resolution:** Either (a) accept the duplication and add a Layer 1 test asserting that the relevant sections of the four LangChain prompts match the canonical shared partials (detect drift), or (b) design `as_langchain()` to perform include resolution at call time, returning a fully-expanded template body (losing `{% include %}` for LangChain but gaining single-source-of-truth). Option (b) is more complex but eliminates the drift risk.

### [Low] `signals/prompts.py` line count minor drift

**Location:** §7 References — "328 LOC"

Actual `wc -l` shows 325 lines. Minor and inconsequential, but the spec's §7 is positioned as a precise baseline inventory.

### [Low] No mention of how `render()` interacts with async call sites

**Location:** §3.3 render lifecycle

`render()` is synchronous and performs no I/O (pure template string interpolation). Calling it from `async def` handlers is safe (no event-loop blocking). But the spec never states this, and future maintainers might wonder whether an `async render()` is needed. The `call_with_prompt` helper explicitly discusses its sync choice; `render()` should too.

**Resolution:** Add a one-liner to `render()`'s docstring: "Pure computation (no I/O); safe to call from async handlers without blocking the event loop."

### [Low] `health.py` line reference is accurate but "1 LOC" understates the function

**Location:** §2.1 bullet 3, §7 last reference

The spec says `health.py:10` (1 LOC smoke-test prompt). The actual code at line 10 is `test_prompt = "Generate a simple JSON: {\"test\": \"hello\"}"`. The spec is correct. But the deferral recommendation (§2.1 second bullet) argues "no non-engineer iteration, no observability value on a diagnostic probe" — this is sound. However, the spec doesn't address that `probe_llm()` receives `llm2` as a parameter, meaning it would need a different `call_with_prompt` signature if it were migrated (the caller already has the LLM instance). Since it's recommended for deferral, this is academic, but worth noting for completeness.

### [Low] Phase 2 ordering rationale is good but could be more explicit about rollback

**Location:** §4 Phase 2 introduction

"Each service migrates in one all-or-nothing PR." This is strong, but no guidance is given on rollback if a service migration introduces a regression. Since the spec says "no backwards-compat shims" (per CLAUDE.md), rollback means reverting the PR. The plan should note this explicitly.

**Resolution:** Add to Phase 2 per-service commit list: "Rollback = PR revert; no shim layer."

### [Low] `prompt_meta` sub-document not indexed

**Location:** §3.5 "What gets recorded"

The `prompt_meta` sub-document is embedded in existing Mongo collections. The spec mentions analytics queries like `$group` on sub-doc fields, but no index is proposed. Without an index, `{ "prompt_meta.name": "X" }` scans the collection. For pre-launch data volumes this is fine, but the spec should acknowledge the indexing gap and flag it as a future concern.

**Resolution:** Add to §3.5 or the migration outcome report's deferral section: "No Mongo index on `prompt_meta` fields in v1. Add compound index on `{org_id, prompt_meta.name, prompt_meta.version}` when analytics queries justify it."

### [Nit] `market_scoring/` cited as "additional services discovered in Phase 0" example

**Location:** §3.1 last paragraph — "including, if the audit surfaces inline prompts in additional services (e.g. `market_scoring/`)"

But `market_scoring/` is already called out in §2.1 as a known inline prompt location. Using it as an example of a "discovered in Phase 0" service is slightly misleading — it's already in the known baseline.

### [Nit] Golden fixture sizing guidance is reasonable but under-specified for conditional prompts

**Location:** §3.6 Layer 2 — "Sizing guidance for canonical inputs"

The guidance says "minimal but sufficient to exercise all template branches." For conditional prompts like `scout_search.md.j2` (which has `{% if leads %}` and `{% if existing_headlines %}` branches), a single `_inputs/scout_search.json` can only exercise one branch combination per golden fixture. The spec should clarify whether conditional prompts get multiple input fixtures (one per branch combination) or a single fixture exercising the "full" path, with the fallback path tested only in Layer 1 unit tests.

**Resolution:** Clarify that golden fixtures exercise one canonical path per prompt (the "happy path" with all conditional sections active). Fallback/empty-branch rendering is covered by Layer 1 unit tests using synthetic `tmp_path` prompts, not by golden fixtures.

### [Nit] Three `{` / `}` brace escaping paragraph could confuse implementers

**Location:** §3.4 "JSON-example handling"

The paragraph correctly states that single `{` and `}` pass through Jinja2 unchanged, unlike `str.format()`. However, it doesn't mention that `{{` and `}}` are Jinja2's expression delimiters. A prompt body containing `{{ variable }}` for Jinja2 substitution coexists with `{"key": "value"}` JSON examples — but `{{{` (three braces) would be ambiguous. This is an extremely unlikely edge case in practice, and Jinja2 handles it correctly (`{{` is expression start, third `{` is literal), but worth a one-sentence note for implementer confidence.
