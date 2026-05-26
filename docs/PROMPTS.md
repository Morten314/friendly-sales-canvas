# Prompt management

Authoritative reference for the prompt management subsystem in `backend/`. Reflects the system as it exists post-plan-13. For the migration audit trail, see [`prompt-migration-outcome.md`](prompt-migration-outcome.md). For design intent and rationale, see [`../specs/13-prompt-management-design.md`](../specs/13-prompt-management-design.md).

---

## 1. Filesystem layout

All prompt bodies live under `backend/prompts/`, peer of `app/`. The loader entrypoint is `backend/app/core/prompts.py`.

```
backend/
├── app/core/prompts.py            # loader / registry / render API
└── prompts/
    ├── _shared/                   # partials + cross-prompt defaults
    │   ├── defaults.yaml
    │   ├── response_format_json.md.j2
    │   ├── scout_persona.md.j2
    │   ├── final_answer_directive.md.j2
    │   ├── final_answer_json_directive.md.j2
    │   └── cypher_base.md.j2
    ├── icp/
    ├── signals/
    ├── market_research/
    ├── market_scoring/
    ├── llm_config/
    └── graph_chat/
```

Conventions:

- Per-service subdirectories mirror `app/services/<svc>/`. New services that need prompts create a peer subdirectory.
- `_shared/` holds partials and `defaults.yaml` only. Files under `_shared/` cannot be invoked directly via `prompts.render()` — they're only includable.
- File extension is `.md.j2` so editors give markdown highlighting on the prose body and recognize Jinja2 blocks.
- Filenames are globally unique across `backend/prompts/`. Boot fails on collision.
- The prompt's `name` front-matter field must match the filename stem exactly. Boot fails on mismatch.
- **Naming convention:** the registry uses `<svc>_<file_stem>` for ICP/signals/market_research/market_scoring, where `file_stem` is already prefixed (`icp_generator`, `signals_scout_search`, `research_market_1`, `score_lead`, …). The on-disk stem and the registered `name` are identical.

---

## 2. Prompt file format

Each callable prompt is YAML front-matter (fenced by `---`) followed by a Jinja2-rendered body.

```jinja
---
name: research_market_1
version: 1.0.0
description: Market research component 1 — overview synthesis
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
temperature: 0.0
max_tokens: 4000
response_format: json
inputs:
  - company_profile_json
---
Task: Research and compile an updated overview of market...

Company Profile Data:
{{ company_profile_json }}

...

{% include '_shared/response_format_json.md.j2' %}
{% include '_shared/final_answer_directive.md.j2' %}
```

### 2.1 Front-matter schema

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Stable identifier. Must match filename stem and be globally unique across `backend/prompts/` (boot fails on collision). |
| `version` | semver string | yes | Manually bumped on intent change. Recorded in observability. |
| `description` | string | yes | One-line human description. Surfaced in registry listings (`list_prompts()`). |
| `model` | string | yes | Required for every callable prompt; **no `_shared/defaults.yaml` default**. Must be explicitly declared per prompt — defaulting `model` would silently switch LLM behavior at migration time. Boot fails if any callable prompt omits this field. |
| `temperature` | float | no | Inherited from `_shared/defaults.yaml` if omitted. |
| `max_tokens` | int | no | Inherited from `_shared/defaults.yaml` if omitted. |
| `response_format` | enum `json` \| `text` | yes | Drives whether call sites expect JSON parsing. Informational — the loader does not parse the LLM output for you. |
| `timeout_s` | int | no | Inherited from `_shared/defaults.yaml` if omitted. |
| `inputs` | list[string] | yes | Declared template variables. Must be exhaustive: every `{{ var }}` reference in the body (and in any included partial) must appear here, and the caller must pass exactly this set of kwargs to `render()`. |

Boot fails loudly if a required field is missing after the merge with `_shared/defaults.yaml`. Validation aggregates per-file failures into a single `BootFailure` rather than first-hit, so one boot reports every problem.

### 2.2 Partial schema

Files under `_shared/` follow the same front-matter format with a minimal subset: `name`, `version`, `description`. They are not callable via `prompts.render()` — only includable. The loader flags any file under `_shared/` as "partial" and refuses to register it as a top-level prompt.

---

## 3. Defaults inheritance

`backend/prompts/_shared/defaults.yaml` (no front-matter):

```yaml
temperature: 0.0
max_tokens: 4000
timeout_s: 120
```

Per-prompt front-matter overrides these field-by-field. The merge is purely additive-with-override; there is no `null`-sentinel meaning "unset this default."

`model` is intentionally absent from defaults: every callable prompt must declare its own. The other three fields are universally safe to default — wrong temperature/max_tokens/timeout produces visible behavioral differences during testing, whereas a wrong default `model` would silently route to a different LLM.

---

## 4. Includes and composition

`{% include 'PATH' %}` references are resolved relative to `backend/prompts/`. Both shared partials (`_shared/foo.md.j2`) and service-scoped partials (`signals/signals_leads_section.md.j2`) are includable.

### 4.1 Authoring rules

- **Own-line includes.** `{% include 'PATH' %}` directives must appear on their own line, with no surrounding text. Inline includes (e.g. `Some text {% include 'partial.md.j2' %} more text`) produce undefined expansion behavior — the source-expansion algorithm replaces the entire line containing the directive.
- **Depth 1.** Partials may not include other partials. Boot enforces this.
- **Partials live under `_shared/` or under the owning service directory.** Service-scoped sub-templates (see §10) are also resolved through the same `{% include %}` mechanism.

### 4.2 How expansion works

At boot, each prompt body has its `{% include %}` directives replaced **textually** with the included partial's body (front-matter stripped). The expanded body is what gets:

- hashed for `content_hash` (so changes to a shared partial bump the hash of every prompt that includes it),
- handed to the Jinja2 environment at render time,
- handed to LangChain via `as_langchain()` (see §6.3).

The set of variables a prompt declares (`inputs:`) must cover every `{{ var }}` reference in the body **and in every transitive partial**. Boot validates this with an AST walk.

### 4.3 Conditional includes

Includes can be wrapped in `{% if %}` blocks:

```jinja
{% if leads_json %}
{% include 'signals/signals_leads_section.md.j2' %}
{% else %}
{% include 'signals/signals_leads_section_fallback.md.j2' %}
{% endif %}
```

The boot-time AST walk treats both branches as reachable when validating declared inputs, so both `signals_leads_section` and `signals_leads_section_fallback` must be self-contained relative to the parent's `inputs:` declaration.

---

## 5. JSON-example handling

A long-standing pain point of `str.format()`-based prompt templates was that any literal `{` or `}` (e.g. in a JSON example) had to be escaped as `{{` / `}}`, doubling the size of every embedded JSON snippet. Jinja2 uses `{{ var }}` / `{% block %}`, so **single-brace JSON literals pass through unchanged**:

```jinja
Return a JSON object like:
{
  "headline": "...",
  "score": 0.8
}
```

This is the largest authoring ergonomics win over the legacy system. Authors no longer need to remember to escape braces in JSON examples.

---

## 6. Invocation patterns

There are four ways production code consumes prompts. Each maps to one of three invocation patterns from the LLM call-site taxonomy.

### 6.1 Simple-invoke — `call_with_prompt`

For sync `llm.invoke([HumanMessage(...)])` call sites. The prompt's front-matter `model` actively selects the LLM client; `temperature` / `max_tokens` are applied (where the LLM client supports them).

```python
from app.services._llm_helpers import call_with_prompt

response, prompt_meta = call_with_prompt(
    "score_lead",
    lead_json=lead_json,
    icp_json=icp_json,
)
persistence.save(score=parse(response), prompt_meta=prompt_meta)
```

Single user-message shape only. The LLM client is selected by `rendered.config.model` via the `_LLM_FACTORY` registered in `build_llm_config()`. Today's simple-invoke models: `Qwen/Qwen3-235B-A22B-Instruct-2507-tput` (Together) and `llama-3.3-70b-versatile` (Groq). New simple-invoke models register in `build_llm_config()`.

Used by: `market_scoring/score_lead`.

### 6.2 Two-prompt simple-invoke recipe (System + User)

When you need `[SystemMessage, HumanMessage]` shape instead of a single user message, render the two prompts separately and use the **user-message's `prompt_meta` as the canonical observability surface** (the system message is treated as boilerplate):

```python
from langchain_core.messages import SystemMessage, HumanMessage
from app.core import prompts

system_rendered = prompts.render("score_prospect_system")
user_rendered = prompts.render("score_prospect_user", cypher_query=cypher_query)
messages = [
    SystemMessage(content=system_rendered.body),
    HumanMessage(content=user_rendered.body),
]
response = llm.invoke(messages)
prompt_meta = prompts.prompt_meta_from(user_rendered)
```

Used by: `graph_chat/score_prospect_system` + `graph_chat/score_prospect_user`.

### 6.3 LangChain adapter — `as_langchain`

For prompts consumed by LangChain chains (today: `GraphCypherQAChain.from_llm(...)`). Returns a `langchain_core.prompts.PromptTemplate` over the source-expanded body:

```python
from app.core import prompts

CYPHER_GENERATION_PROMPT = prompts.as_langchain("cypher_gen")
chain = GraphCypherQAChain.from_llm(
    cypher_prompt=CYPHER_GENERATION_PROMPT,
    qa_prompt=prompts.as_langchain("qa_scout"),
    ...,
)
```

LangChain's machinery substitutes `{{ var }}` and evaluates `{% if %}` at chain invocation time. Includes are pre-expanded at `as_langchain()` call time, so LangChain never sees `{% include %}` directives (it has no `FileSystemLoader` against `backend/prompts/`).

Used by: `llm_config/cypher_gen`, `cypher_gen_alt`, `qa_scout`, `qa_scout_alt`.

### 6.4 Agent-chain and custom-dispatch — manual render + `prompt_meta_from`

For prompts that flow into a LangChain ReAct `agent_chain.invoke({'input': ...})` or a bespoke HTTP dispatch (e.g. Claude over `requests.post`). The prompt's `model` field is **observability-only** in v1 — it's recorded in `prompt_meta` but doesn't drive routing.

```python
from app.core import prompts

rendered = prompts.render("icp_generator", pre_data=pre_data)
raw = agent_chain.invoke({'input': rendered.body})
output = raw["output"]
prompt_meta = prompts.prompt_meta_from(rendered)
persistence.save(icp=output, prompt_meta=prompt_meta)
```

Used by: every ICP prompt, signals scout/profiler (Groq), signals Q&A Groq, signals Q&A Claude (custom dispatch), every market_research prompt.

### 6.5 Pattern → prompt cross-reference

| Pattern | API | Active model routing? | Examples |
|---|---|---|---|
| simple-invoke | `call_with_prompt(name, **inputs)` | yes (from front-matter) | `score_lead` |
| two-prompt simple-invoke | `prompts.render` twice + `prompts.prompt_meta_from(user)` | yes (front-matter on user message) | `score_prospect_system` + `score_prospect_user` |
| agent-chain | `prompts.render(name, **inputs)` + `prompt_meta_from(rendered)` | no — observability only | `icp_generator`, `icp_research_1..4`, `signals_scout_search`, `signals_profiler_search`, `signals_signal_ask_groq`, `research_market_1..5` |
| custom-dispatch | same as agent-chain | no — observability only | `signals_signal_ask_claude` |
| LangChain | `as_langchain(name)` returning `PromptTemplate` | no — chain owns LLM | `cypher_gen`, `cypher_gen_alt`, `qa_scout`, `qa_scout_alt` |

---

## 7. Observability binding (`prompt_meta`)

Every LLM call persisted to Mongo carries a `prompt_meta` sub-document alongside the output. Schema:

| Field | Source | Example |
|---|---|---|
| `name` | front-matter `name` | `"research_market_1"` |
| `version` | front-matter `version` | `"1.0.0"` |
| `content_hash` | SHA-256 of source-expanded template body (partials textually substituted in source form, no Jinja2 rendering) | `"a3f2c1..."` |
| `render_inputs_hash` | SHA-256 of canonical-JSON(declared inputs only) | `"7b8d9e..."` |
| `model` | resolved config `model` | `"Qwen/Qwen3-235B-A22B-Instruct-2507-tput"` |
| `rendered_at` | server timestamp at render time (UTC) | ISODate |

Embedded in the existing collections (Market Intelligence reports, Lead Market Scores, Signals, Prospects, etc.), not a separate collection:

```js
{
  _id: ...,
  org_id: "...",
  headline: "...",
  description: "...",
  // ... existing fields ...
  prompt_meta: {
    name: "signals_scout_search",
    version: "1.0.0",
    content_hash: "a3f2c1...",
    render_inputs_hash: "7b8d9e...",
    model: "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
    rendered_at: ISODate("2026-05-26T14:30:00Z"),
  }
}
```

`prompt_meta_from(rendered)` in `app/core/prompts.py` is the single source of truth for the shape — every call site goes through it (either directly on agent-chain/custom-dispatch, or transitively via `call_with_prompt` on simple-invoke).

### 7.1 Queries this enables

- "Show me this output and what produced it" — one `find`, no join.
- "Group outputs by `prompt_meta.version` to compare quality across prompt revisions" — `$group` over the sub-doc field.
- "Find all outputs from prompt X at content_hash Y" — exact-match query for reproducibility audits.
- `render_inputs_hash` lets you detect "same inputs, different output" runs (LLM nondeterminism) vs "different inputs" cases.

### 7.2 What is deliberately not recorded

- **End-to-end LLM latency.** `rendered_at` is render time, not LLM-completion time. For simple-invoke calls the two are usually <1s apart; for agent-chain calls (`max_execution_time=120s`), completion may lag rendering by up to two minutes. Latency belongs in a planned peer `llm_meta` sub-document (not in scope for v1).
- **Token counts / cost.** Same reason — belongs in `llm_meta`.
- **Failure-path `prompt_meta`.** Today, if the LLM call raises before persistence, no `prompt_meta` is recorded. See §10 for the v2 plan.

---

## 8. Adding a new prompt

1. Choose the owning service. Create `backend/prompts/<svc>/` if it doesn't exist yet.
2. Create `backend/prompts/<svc>/<svc>_<descriptive_name>.md.j2` (or `<svc>/<descriptive_name>.md.j2` for ICP/llm_config/graph_chat which use bare stems).
   - The filename stem becomes the registered prompt `name`.
3. Write the front-matter (§2.1). Declare every `{{ var }}` reference in `inputs:`.
4. Write the body. Use `{% include '_shared/...' %}` for shared directives (response-format, persona, final-answer trailers).
5. Pick the invocation pattern (§6). For new simple-invoke models, register them in `build_llm_config()` first.
6. Regenerate the golden fixture: `python tests/regen_prompt_fixtures.py <name>`. The script will scaffold `tests/fixtures/prompts/_inputs/<name>.json` with `REPLACE_ME` placeholders on first run — fill them in with realistic values that exercise every conditional branch, then re-run.
7. Run the test suite. `tests/unit/test_prompts_golden.py` will pick up the new fixture automatically.
8. Wire the call site. Use `call_with_prompt` (simple-invoke), `prompts.render` + `prompt_meta_from` (agent-chain / custom-dispatch / two-prompt recipe), or `prompts.as_langchain` (LangChain). Persist `prompt_meta` alongside the output.

---

## 9. Test scaffold

Three layers:

### 9.1 Loader unit tests — `backend/tests/unit/test_prompts_loader.py`

Loader behavior against synthetic prompts written to `tmp_path`. Coverage:

- Valid prompts load and register correctly.
- `BootFailure` aggregates every malformed prompt, not first-hit.
- `UnknownInputs` raised when caller supplies undeclared vars.
- `MissingInputs` raised when caller omits declared vars.
- `StrictUndefined` raises at render time for dynamic references the AST walk missed.
- `content_hash` stable across calls (same template + same inputs → same hash).
- `render_inputs_hash` canonical regardless of input dict key order.
- Partial include resolution: declared inputs cover the union of body + transitive partial references.
- Include depth >1 rejected at boot.
- Files under `_shared/` cannot be invoked via `render()`.
- Filename stem must match `name` front-matter field.
- Cross-prompt `name` collision rejected at boot.

### 9.2 Golden-rendered fixtures — `backend/tests/unit/test_prompts_golden.py`

One parametrized test case per registered prompt. The test renders the prompt against canonical inputs from `tests/fixtures/prompts/_inputs/<name>.json` and asserts byte-equality against `tests/fixtures/prompts/rendered/<name>.txt`.

When a prompt body changes, the golden test fails with a hint pointing at `tests/regen_prompt_fixtures.py`. Regenerate, review the diff, commit the fixture alongside the prompt edit.

For each LangChain-wrapped prompt, the test also asserts `as_langchain(name).format(**inputs)` produces byte-equal output to `render(name, **inputs).body` — guards the source-expansion algorithm and LangChain's Jinja2 environment against drift.

### 9.3 Behavior tests

Service-level tests continue to assert on parsed LLM outputs and persisted state, decoupled from prompt body text. Prompt edits don't cascade into noisy behavior-test diffs anymore — that's the whole point of the golden layer.

### 9.4 Regen workflow

```bash
# Single prompt
python tests/regen_prompt_fixtures.py signals_scout_search

# All registered prompts
python tests/regen_prompt_fixtures.py --all
```

The script reads `tests/fixtures/prompts/_inputs/<name>.json`, renders, and writes `tests/fixtures/prompts/rendered/<name>.txt`. Missing input fixtures are scaffolded with `REPLACE_ME` placeholders for the declared inputs and skipped — author edits, then re-runs.

---

## 10. Conventions worth knowing

### 10.1 Service-scoped include-only sub-templates

Some prompts exist only to be `{% include %}`-ed from a parent in the same service. They live under the service directory (not `_shared/`) because they're not cross-cutting:

- `signals_leads_section` — included from `signals_scout_search` / `signals_profiler_search` when `leads_json` is present.
- `signals_leads_section_fallback` — included from the same when `leads_json` is absent.
- `signals_existing_headlines_section` — included from `signals_profiler_search` when `existing_headlines_json` is present.

These are **registered as callable prompts** (full front-matter, including `model`/`response_format`) so they get their own golden-fixture coverage. The convention is just "don't call them directly via `prompts.render()` from production code."

If you enumerate "top-level prompts the system exposes" via `list_prompts()`, filter to entries whose stems do **not** end in `_section` or `_section_fallback`. Future service-scoped sub-templates should follow the same naming pattern.

### 10.2 Sub-template-as-callable contract

Any prompt invoked only via `{% include %}` should still have full callable front-matter (model, response_format, inputs). The loader treats them like any callable; the registration is needed for the golden test to cover them. The "don't call directly" rule is a convention, not loader-enforced.

### 10.3 `keep_trailing_newline=True`

The loader's Jinja2 `Environment` is constructed with `keep_trailing_newline=True`. Trailing newlines in `.md.j2` files are preserved in rendered output. Adding (or removing) a trailing newline to a prompt file changes the rendered output and bumps `content_hash` — golden tests will surface the change.

### 10.4 Boot lifecycle

`init_registry()` is called exactly once at app startup via `app/main.py:lifespan`. After that, `_registry` is a populated module-level singleton; all public functions (`render`, `get_config`, `list_prompts`, `as_langchain`) raise `RuntimeError("init_registry not called")` if accessed pre-boot.

Tests may call `init_registry()` repeatedly with different roots (e.g. `tmp_path`); silent replacement is the v1 contract.

### 10.5 Error types

All loader and render errors subclass `PromptError`. Boot-time errors are aggregated into `BootFailure([FailureDetail, ...])`. Render-time errors are `PromptNotFound`, `MissingInputs`, `UnknownInputs`, `RenderError`.

---

## 11. Known limitations (v1)

Items deliberately deferred from v1. Each warrants a v2 design discussion when the trigger fires.

### 11.1 Failure-path `prompt_meta` not persisted

If an LLM call raises before reaching persistence, no `prompt_meta` is recorded. Observability covers successful outputs only. **Trigger to revisit:** first production incident where "what prompt was attempted before this LLM error?" is the unanswerable question.

### 11.2 Agent-chain and custom-dispatch `model` is observability-only

The `model` field in front-matter is recorded in `prompt_meta` but does **not** select the LLM behind `agent_chain` or behind a custom HTTP dispatch (e.g. Claude). Changing the model behind an agent_chain requires rebuilding the chain — out of scope here. Active routing for agent-chain prompts is a v2 concern (per-prompt agent_chain rebuild, or a model-aware agent factory, or a per-call temperature/model override path).

### 11.3 No Mongo index on `prompt_meta.*`

`prompt_meta` is queryable but unindexed. At current write volume this is fine. **Trigger to revisit:** first analytics query over `prompt_meta.version` or `prompt_meta.content_hash` that runs slow enough to be a problem.

### 11.4 `_DEFAULT_CLAUDE_PROMPT_SUFFIX` not cleaned up

`backend/app/services/_llm_helpers.py:_DEFAULT_CLAUDE_PROMPT_SUFFIX` (= `"\n\nWEB SEARCH RESULTS:\n{web_ctx}\n"`) is still actively used by ICP, signals, and market_research Claude paths to inject web-search context after the rendered prompt body. The cleanup deferral is deliberate: untangling it requires either threading `web_ctx` as a declared `inputs:` variable through every consumer, or expressing it as a `{% include %}`-able partial — both are bigger lifts than this migration's scope.

### 11.5 Wording drift in signals scout/profiler renders

Migrating `signals_scout_search` and `signals_profiler_search` produced 3-8 bytes of whitespace difference per render vs the legacy Python string constants, due to how Jinja2 collapses conditional blocks. Accepted as immaterial to LLM behavior; golden fixtures capture the new canonical output.

### 11.6 LangChain `+ "\n"` sentinel in `as_langchain()`

LangChain instantiates its own Jinja2 env with `keep_trailing_newline=False`, stripping one trailing newline. Our `as_langchain()` appends a sentinel `"\n"` to compensate, keeping LangChain's `.format()` output byte-equal to our `render().body`. This is fragile against LangChain version upgrades that might change their Jinja2 environment defaults. The golden parity test (§9.2) will catch any regression, but the fix needs revisiting if it fires.

### 11.7 Retry-with-appended-suffix in `icp_generator`

`icp/orchestrator.py` has a pre-existing retry path that appends extra text to the rendered ICP prompt body before re-invoking the agent_chain. On the retry path, the persisted `prompt_meta.content_hash` reflects the originally-rendered prompt, **not** the actual bytes the LLM saw. This breaks the spec's "prompt_meta answers which prompt produced this output" guarantee on the retry path. Preserved verbatim from the legacy implementation; resolving requires either (a) re-rendering through a separate retry prompt, or (b) recording the appended suffix in a peer `prompt_meta_retry` field.

### 11.8 No staging/prod prompt divergence

Every environment runs the same prompt body — the loader reads from `backend/prompts/`, which ships with the Docker image. There's no mechanism to soak a prompt change in staging before promoting. Acceptable today (pre-launch, eng owns prompts) and out of scope for v1. **Trigger to revisit:** first production prompt change that needs staging soak before promotion.

### 11.9 No prompt hot-reload

The registry is populated once at boot; prompt edits require an app restart to take effect. Acceptable in dev (auto-reload covers it) and in CI (each test process re-inits). **Trigger to revisit:** first need to A/B prompt variants without a deploy.

---

## 12. References

- Loader implementation: [`backend/app/core/prompts.py`](../backend/app/core/prompts.py)
- Defaults: [`backend/prompts/_shared/defaults.yaml`](../backend/prompts/_shared/defaults.yaml)
- Simple-invoke helper: [`backend/app/services/_llm_helpers.py`](../backend/app/services/_llm_helpers.py)
- Boot wiring: [`backend/app/main.py`](../backend/app/main.py) `lifespan`
- Golden tests: [`backend/tests/unit/test_prompts_golden.py`](../backend/tests/unit/test_prompts_golden.py)
- Regen script: [`backend/tests/regen_prompt_fixtures.py`](../backend/tests/regen_prompt_fixtures.py)
- Design spec: [`specs/13-prompt-management-design.md`](../specs/13-prompt-management-design.md)
- Migration audit trail: [`prompt-migration-outcome.md`](prompt-migration-outcome.md)
