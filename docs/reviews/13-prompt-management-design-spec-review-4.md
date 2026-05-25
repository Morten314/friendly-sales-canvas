---
artifact: specs/13-prompt-management-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-25
round: 4
---

## Context

Round 4 review. All findings from rounds 2 and 3 have been incorporated into the current spec text: `call_with_prompt` is now sync and scoped to simple-invoke with active model routing, the module-level singleton pattern is documented, include depth is consistently 1, `retry_policy` is removed, `_prompt_meta_from()` is placed in `app/core/prompts.py`, the source-expansion algorithm is fully specified, `as_langchain()` performs source expansion at call time (includes allowed for LangChain prompts), boot-time pre-flight checks exist, UTF-8/BOM handling is specified, golden fixture sizing and branch-coverage guidance are present, a performance budget is stated, Phase 2 ordering is icp-first with rollback guidance, indexing is explicitly deferred with a pull-forward trigger, and `RenderedPrompt.version` exists. This round focuses on residual contradictions, subtle semantic mismatches, and gaps newly visible after the prior revisions were absorbed.

## Findings

### [High] `as_langchain()` docstring contradicts §3.4 design text on include resolution

**Location:** §3.3 "Public surface" — `as_langchain()` docstring (lines 197–203) vs §3.4 "LangChain interop" (lines 358–365)

The docstring states: "Includes are not resolved — the prompt must be self-contained (see §3.4)." But §3.4 explicitly says: "Includes ARE allowed in LangChain-consumed prompts" and describes the source-expansion algorithm run at `as_langchain()` call time to produce a self-contained body. The docstring also says the body is `<unrendered template body>` — ambiguous between "before Jinja2 rendering" (correct) and "before source expansion" (incorrect per §3.4).

An implementer reading the code block alone would believe includes are forbidden for LangChain prompts and would not implement source expansion. The design text says the opposite. This is the most consequential contradiction in the current spec because it directly determines whether the four Cypher/QA prompts can use shared partials.

**Resolution:** Replace the docstring's last line with: "Source-expanded at call time (see §3.4); shared partials are resolved and the returned PromptTemplate is fully self-contained." Clarify `<unrendered template body>` to mean "source-expanded but not Jinja2-rendered."

### [Medium] `rendered_at` captured at `_prompt_meta_from()` call time, not at `render()` time

**Location:** §3.5 `_prompt_meta_from()` implementation (lines 496–508), §3.5 "What gets recorded" table (line 380)

The `prompt_meta` table defines `rendered_at` as "server timestamp at render time." The implementation captures it inside `_prompt_meta_from()` via `datetime.now(timezone.utc)`. For the simple-invoke path (`call_with_prompt`), the sequence is: `render()` → `llm.invoke()` (potentially 10–120 s) → `_prompt_meta_from()`. For the manual-assembly agent-chain path, the sequence is: `render()` → `agent_chain.invoke()` (up to 120 s) → `_prompt_meta_from()`. In both cases, `rendered_at` is captured after the LLM call completes, not when the prompt was rendered.

For the Qwen path at max timeout, `rendered_at` could be up to 2 minutes later than the actual render time. The spec's stated semantics ("timestamp at render time") don't match the implementation. The §3.5 note on line 512 ("rendered_at is the timestamp when the prompt was rendered, not when the LLM produced its output") compounds the problem by claiming render-time precision that the implementation doesn't deliver.

**Resolution:** Capture `rendered_at` inside `render()` and store it in `RenderedPrompt`. Move `datetime.now(timezone.utc)` from `_prompt_meta_from()` into the render lifecycle (§3.3 step 5). This makes the timestamp semantics match the spec's description without changing the persisted schema.

### [Medium] `model` in `defaults.yaml` makes the field silently defaultable, creating migration risk

**Location:** §3.2 "Defaults file" (lines 145–154), §3.2 front-matter table `model` row (line 130)

`_shared/defaults.yaml` includes `model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput`. The front-matter table says `model` is "Required for full prompts." But boot validation runs after merge — a prompt that omits `model` in its front-matter inherits the Qwen default and passes validation. During migration, a developer moving a Groq-based prompt (`llama-3.3-70b-versatile`) who forgets to set `model` in the new `.md.j2` file will silently switch models with no boot-time or test-time error.

The front-matter table's "Required" label is misleading: `model` is only required after merge, and the default satisfies the requirement. The other defaults (`temperature`, `max_tokens`, `timeout_s`) are low-risk because their defaults are universally safe. `model` is uniquely dangerous to default because a wrong model silently changes LLM behavior.

**Resolution:** Either (a) remove `model` from `defaults.yaml` so every prompt must explicitly declare it (boot fails on omission — highest safety), or (b) add a migration-validation step in Phase 2 that cross-references each migrated prompt's declared `model` against its pre-migration LLM client, or (c) add a boot-time warning when a prompt inherits the default model (so the audit can flag it).

### [Medium] `as_langchain()` test coverage absent from §3.6 test scaffold

**Location:** §3.6 "Test scaffold" (lines 530–614) vs §3.4 "LangChain interop" (line 361)

§3.4 states: "Behavior parity (byte-equal output between our loader's render and LangChain's render given the same inputs) is asserted by golden-fixture tests covering each LangChain-wrapped prompt." But §3.6's three-layer test scaffold doesn't mention `as_langchain()` in any layer. Layer 1 tests the loader/renderer against synthetic `tmp_path` prompts. Layer 2 tests golden renders. Layer 3 tests `prompt_meta` assertions. None test `as_langchain()` source expansion or parity.

The four LangChain-consumed prompts (Cypher gen, Cypher gen alt, QA scout, QA scout alt) are the only prompts using a different rendering path. Without explicit test coverage, a regression in source expansion (e.g., whitespace handling change, partial body change) could break LangChain parity silently.

**Resolution:** Add to Layer 1: a test that `as_langchain()` returns a `PromptTemplate` whose `.format(**inputs)` output matches `render(name, **inputs).body` for each LangChain-wrapped prompt, using the canonical fixture inputs. This is the parity test referenced in §3.4 but missing from the scaffold.

### [Low] Source-expansion textual scan doesn't account for Jinja2 comments — "safe and unambiguous" claim is incorrect

**Location:** §3.4 "Source-expansion algorithm" step 2 (line 303)

The algorithm claims: "literal-token match — Jinja2 disallows `{% %}` inside string literals, so a textual scan is safe and unambiguous." This is correct for string literals but incorrect for Jinja2 comment blocks (`{# ... #}`). A commented-out include like `{# {% include 'old_partial.md.j2' %} #}` would be falsely matched and expanded by the textual scan, producing malformed Jinja2 (broken comment syntax). This would likely be caught by boot-time AST parsing as a parse error — not a silent corruption — but the spec's "safe and unambiguous" claim overpromises.

In practice, commented-out includes are extremely unlikely in production prompts. But the claim is technically incorrect and could mislead an implementer into believing the textual scan is universally safe.

**Resolution:** Either (a) amend the claim to "safe for non-commented source (Jinja2 comments are not expected to contain `{% include %}` directives; if they do, boot-time AST parsing catches the resulting malformed template)," or (b) add a simple pre-pass that strips `{# ... #}` blocks before the textual scan.

### [Low] `init_registry()` double-call behavior unspecified

**Location:** §3.3 "Boot lifecycle" (lines 226–251)

The spec states: "production lifespan calls it exactly once" and "Tests calling `init_registry(test_root)` replace the singleton." But no behavior is specified for an accidental double-call in production (e.g., a bug in lifespan startup). Should it: (a) silently replace (current implied behavior), (b) raise `RuntimeError` on re-initialization, or (c) be idempotent (return existing registry without re-parsing)?

Option (a) risks masking a bug in lifespan startup. Option (b) is the safest production guard but adds test complexity (tests need to reset state between cases). Option (c) is the most robust but requires tracking whether the current `_registry` was initialized with the same `root`.

**Resolution:** Add one sentence to the `init_registry()` definition: "If called when `_registry` is already set, raises `RuntimeError('init_registry already called')`. Test teardown must set `_registry = None` between cases."

### [Low] `market_scoring` appears in both known baseline and "discovered in Phase 0" in Phase 2 step 5

**Location:** §2.1 bullet 3 (line 25), §3.1 file tree line 85 (`market_scoring/score_lead.md.j2`), §4 Phase 2 step 5 (line 646)

`market_scoring/orchestrator.py:282-325` is called out in §2.1 as a known inline prompt, appears in the §3.1 file tree, and has a declared model and location. But §4 Phase 2 step 5 lists `market_scoring` under "Other services discovered in Phase 0" alongside genuinely unknown services (`customer_profile`, `leads`, `pipeline`). If `market_scoring` is already in the baseline and file tree, it should have its own migration step (between signals and market_research, or after llm_config) rather than being lumped with services whose existence is still hypothetical.

**Resolution:** Move `market_scoring` to its own Phase 2 step (e.g., step 5, between `llm_config.py` and the catch-all "other services"). Reserve "Other services discovered in Phase 0" for services not in the §2.1 baseline.

### [Nit] Source-expansion algorithm assumes `{% include %}` on its own line

**Location:** §3.4 "Source-expansion algorithm" step 3 (lines 303–304)

Step 3 says "substitute the partial's body **in place of the entire `{% include %}` line**." This means the entire source line containing the directive is replaced, including any surrounding text. An include embedded mid-line like `Some text {% include 'partial.md.j2' %} more text` would lose "Some text" and "more text." The spec's own examples only use includes on dedicated lines, so this isn't a practical issue for v1. But the constraint (includes must be on their own line) is not stated as an authoring rule.

**Resolution:** Add to §3.2 or §3.4 conventions: "Include directives must appear on their own line. Inline includes (on a line with other text) produce undefined expansion behavior."
