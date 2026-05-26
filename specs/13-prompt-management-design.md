# Spec 13 — Prompt management system

**Status:** Design (reconciled with implementation 2026-05-26)
**Date:** 2026-05-25 (spec), 2026-05-26 (post-merge reconciliation)
**Resolves:** TD-010 (`docs/TECH_DEBT.md`)
**Paired plan:** `plans/13-prompt-management.md`

> **Post-merge note (2026-05-26):** Plan 13 implementation completed across 15 commits on `master`. This spec was originally written as "frozen on approval" per CLAUDE.md convention, but the user explicitly chose to reconcile it with the implementation deviations so the spec remains a current source of truth rather than a historical snapshot. Every post-merge edit is tagged inline with `<!-- post-merge -->` or a section-level banner. The full audit trail of deviations lives at `docs/prompt-migration-outcome.md`; current-state authoring docs are at `docs/PROMPTS.md`.

---

## 1. Goal

Replace inline Python prompt constants with a purpose-built prompt management subsystem so prompts are externalized into files, versioned, observable, and editable independently of code structure. The overhaul covers every prompt in `backend/` — not just the three previously-extracted `prompts.py` modules.

The system answers, at runtime, "which prompt produced this LLM output?" via observability binding, and at edit time, "what changed in this prompt?" via golden-rendered fixtures and front-matter version bumps.

This spec resolves TD-010's five explicit design questions (template engine, versioning convention, config location, loader caching, rollout) and the one optional-scope question (#9 runtime variant routing).

<!-- post-merge -->
> **Post-merge note (2026-05-26) — "no behavioral change" interpretation:** "No behavioral change" is read as "no LLM-behavior-changing prompt drift." Pure-whitespace differences inside Jinja2 conditional blocks are accepted as semantically inert. Concretely: signals scout/profiler renders show a 3-byte whitespace drift relative to legacy `.format()`-based assembly because Jinja2's `trim_blocks=True, lstrip_blocks=True` collapses blank lines at `{% if leads %}…{% endif %}` boundaries (legacy `.format()` preserved them). Accepted in `docs/prompt-migration-outcome.md` "Documented spec deviations" section; no LLM token-level meaning change. The byte-parity check is reserved for non-conditional prompts; conditional prompts are validated via golden fixtures + code review of rendered output.

## 2. Scope

### 2.1 In scope

- Externalize **every prompt string in `backend/`** into files under `backend/prompts/`. The Phase 0 audit determines the authoritative complete set; the known baseline inventory is:
  - The three `prompts.py` modules: `market_research/`, `icp/`, `signals/`.
  - LangChain-wrapped prompts in `app/core/llm_config.py`: `Cypher_gen_prompt`, `Cypher_gen_prompt2`, `qa_prompt_template`, `qa_prompt_template2`, plus the shared base blocks `_CYPHER_BASE` and `_QA_BASE` and the assembly constants between them.
  - Inline prompts known at spec time: `market_scoring/orchestrator.py:282-325` (`score_single_lead_against_market`, 34-line f-string prompt) and `health.py:10` (`probe_llm` smoke-test prompt). Phase 0 may surface more.
- `health.py:10`'s 1-line smoke-test prompt is a **likely "intentionally deferred" candidate** in the migration outcome report (§4.1) — migration ROI is near-zero (no non-engineer iteration, no observability value on a diagnostic probe). Final disposition is the audit's call; the spec flags the recommendation so the audit author doesn't reflexively migrate trivial diagnostic prompts.
- A loader/registry module (`app/core/prompts.py`) with a small public API: `render(name, **inputs)`, `get_config(name)`, `list_prompts()`.
- Per-prompt YAML front-matter carrying model, temperature, max_tokens, response_format, timeout, semver version, declared inputs.
- Shared partials in `backend/prompts/_shared/` for duplicated fragments (response-format directives, Scout persona, JSON-only output directive).
- Observability binding: every LLM call records `prompt_meta = {name, version, content_hash, render_inputs_hash, model, rendered_at}` embedded in the existing output document in Mongo.
- A test scaffold with three layers: renderer unit tests, golden rendered fixtures, behavior tests decoupled from prompt body.
- Migration sequencing: audit → infrastructure → service-by-service → cleanup + outcome report.

### 2.2 Out of scope

- **Runtime variant routing** (A/B testing of prompt variants). Loader API stays `(name, **inputs)`. Extending later to `(name, variant=…, **inputs)` is non-breaking and can ship in a follow-up spec when needed.
- **Hot-reload** of prompt files. Boot-time load only; restart on prompt edits. File-watching infra and dev/prod parity for watch directories are not designed.
- **Database-backed prompt overrides** or admin UI for runtime edits. Filesystem is the only source of truth.
- **Per-environment prompt divergence.** Staging and production ship the same `backend/prompts/` tree in the Docker image.
- **Retroactive backfill of `prompt_meta`** onto pre-migration Mongo documents. Observability coverage closes service-by-service as the migration progresses.
- **On-disk historical retention of old prompt versions.** Old versions live in git history; the registry only knows the current version per prompt name.
- **TD-004 (stub LLM-response fixtures).** Independent concern; tracked separately. The two will compose naturally once both are resolved (real captures will include `prompt_meta`).

## 3. Design

### 3.1 Filesystem layout

```
backend/
├── app/
│   └── core/
│       └── prompts.py            # NEW — loader/registry/render API + observability hooks
└── prompts/                       # NEW — all prompt bodies live here
    ├── _shared/
    │   ├── defaults.yaml          # cross-prompt defaults (temperature, max_tokens, timeout_s)
    │   ├── response_format_json.md.j2
    │   ├── scout_persona.md.j2
    │   └── final_answer_directive.md.j2
    ├── market_research/
    │   ├── research_market_1.md.j2
    │   ├── research_market_2.md.j2
    │   ├── research_market_3.md.j2
    │   ├── research_market_4.md.j2
    │   └── research_market_5.md.j2
    ├── icp/
    │   ├── generator.md.j2
    │   ├── research_1.md.j2
    │   ├── research_2.md.j2
    │   ├── research_3.md.j2
    │   └── research_4.md.j2
    ├── signals/
    │   ├── scout_search.md.j2
    │   ├── profiler_search.md.j2
    │   ├── leads_section.md.j2
    │   ├── leads_section_fallback.md.j2
    │   ├── existing_headlines_section.md.j2
    │   ├── signal_ask_groq.md.j2
    │   └── signal_ask_claude.md.j2
    ├── llm_config/
    │   ├── cypher_gen.md.j2
    │   ├── cypher_gen_alt.md.j2
    │   ├── qa_scout.md.j2
    │   └── qa_scout_alt.md.j2
    └── market_scoring/
        └── score_lead.md.j2          # inline prompt extracted from orchestrator.py
```

Conventions:
- `backend/prompts/` sits at the backend root (peer of `app/`) so it ships with the Docker image and is resolvable by a module-level path constant — no env var.
- Per-service subdirectories mirror `app/services/<svc>/`. New services adding prompts create a peer subdirectory.
- `_shared/` is for partials and the defaults file only. Files in `_shared/` cannot be invoked directly via `prompts.render()`; they're only includable.
- File extension `.md.j2` so editors give markdown highlighting on the prose body and recognize Jinja2 blocks.
- **The tree above is provisional.** It reflects what is known at spec time: the three service `prompts.py` modules, `llm_config.py`, and the two inline prompts called out in §2.1. The Phase 0 discovery audit produces the authoritative inventory. The implementation plan reconciles the tree against the audit output before Phase 1 lands — including, if the audit surfaces inline prompts in services not in the baseline (e.g. `customer_profile/`, `leads/`, `pipeline/`), creating new peer subdirectories under `backend/prompts/`.

### 3.2 Prompt file format

Each prompt file is YAML front-matter (fenced by `---`) followed by a Jinja2-rendered body.

```
---
name: research_market_1
version: 1.0.0
description: Market size & opportunity research worker (Research_Market_1)
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
temperature: 0.0
max_tokens: 4000
response_format: json
timeout_s: 120
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

#### Front-matter fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Stable identifier. Must match filename stem and be globally unique across `backend/prompts/` (boot fails on collision). |
| `version` | semver string | yes | Manually bumped on intent change. Recorded in observability. |
| `description` | string | yes | One-line human description. Surfaced in registry listings (`list_prompts()`). |
| `model` | string | yes | Required for every callable prompt; **no `_shared/defaults.yaml` default**. Must be explicitly declared per prompt — defaulting `model` would silently switch LLM behavior at migration time (a Groq-prompt moved into the new system without an explicit `model:` line would inherit the wrong client). Boot fails if any callable prompt omits this field. |
| `temperature` | float | no | Inherited from `_shared/defaults.yaml` if omitted. |
| `max_tokens` | int | no | Inherited from `_shared/defaults.yaml`. |
| `response_format` | enum `json` \| `text` | yes | Drives whether call sites expect JSON parsing. |
| `timeout_s` | int | no | Inherited from `_shared/defaults.yaml`. |
| `inputs` | list[string] | yes | Declared template variables (see §3.4 for validation). |

Boot fails loudly if a required field is missing after the merge with `_shared/defaults.yaml`.

#### Partials

Files under `_shared/` follow the same front-matter format with a minimal subset: `name`, `version`, `description`. They are not callable via `prompts.render()` — only includable. The loader enforces this by flagging any file under `_shared/` as "partial" and refusing to register it as a top-level prompt.

<!-- post-merge -->
> **Post-merge note (2026-05-26) — service-scoped include-only sub-templates:** A third pattern emerged during signals migration that this section did not originally anticipate. Some sub-templates are **service-scoped and include-only**: they live under `signals/` (not `_shared/`), are registered as callable prompts with full front-matter (so they get their own golden-fixture coverage and content_hash for change tracking), but in production code are only invoked via `{% include %}` from parent prompts — never via direct `prompts.render()` calls. Concrete examples: `signals_leads_section`, `signals_leads_section_fallback`, `signals_existing_headlines_section` (all included by `signals_scout_search` / `signals_profiler_search`). Authoring rule: such sub-templates use the `<svc>_<role>_section[ _fallback ]` naming pattern; consumers of `list_prompts()` that want only "top-level prompts" should filter accordingly. See `docs/PROMPTS.md` §service-scoped sub-templates.

**Include placement rule.** `{% include 'PATH' %}` directives must appear on their own line, with no surrounding text on the same line. Inline includes (e.g. `Some text {% include 'partial.md.j2' %} more text`) produce undefined expansion behavior — the source-expansion algorithm (§3.4) replaces the entire line containing the directive, which would drop "Some text" and "more text." All examples in this spec follow the own-line convention; the constraint is not enforced by the loader but is an authoring rule.

#### Defaults file (`_shared/defaults.yaml`)

```yaml
temperature: 0.0
max_tokens: 4000
timeout_s: 120
```

Per-prompt front-matter overrides these field-by-field. The defaults file itself has no front-matter.

`model` is intentionally absent from defaults: every callable prompt must declare its own. The other three fields are universally safe to default — wrong temperature/max_tokens/timeout produces visible behavioral differences during testing, whereas a wrong default `model` would silently route to a different LLM.

**Limitation:** the merge is purely additive-with-override; there is no `null`-sentinel meaning "unset this default and use the LLM client's own default." Every default present in `_shared/defaults.yaml` is present in every resolved `PromptConfig`. If a prompt later needs to disable an inherited default, that's a deferred design decision (see TD addendum after migration).

### 3.3 Loader & registry API

Single public module: `app/core/prompts.py`.

#### Public surface

```python
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

@dataclass(frozen=True)
class PromptConfig:
    version: str                   # front-matter version (so get_config() returns it)
    model: str                     # active on simple-invoke; observability-only on agent-chain in v1 (see §3.5)
    temperature: float             # same v1 routing rules as `model`
    max_tokens: int                # same
    response_format: str           # "json" | "text" — informational; call sites decide JSON parsing
    timeout_s: int                 # same v1 routing rules as `model`
    # retry_policy intentionally absent from v1 schema; reintroduce when a
    # real consumer exists.

@dataclass(frozen=True)
class RenderedPrompt:
    name: str
    version: str                   # convenience copy of config.version (always equal)
    content_hash: str              # SHA-256 of source-expanded body (see §3.3 boot step 8)
    render_inputs_hash: str        # SHA-256 of canonical-JSON(declared inputs)
    body: str                      # final rendered string
    rendered_at: datetime          # UTC timestamp captured inside render() — see render lifecycle below
    config: PromptConfig

def render(name: str, **inputs: Any) -> RenderedPrompt:
    """Render a prompt by name. Raises PromptNotFound / MissingInputs / UnknownInputs / RenderError.
    Pure computation (no I/O); safe to call from async handlers without blocking the event loop."""

def get_config(name: str) -> PromptConfig:
    """Resolve config without rendering."""

def list_prompts() -> list[dict[str, Any]]:
    """Registry listing — name, version, description, model, response_format."""

def as_langchain(name: str) -> "PromptTemplate":
    """Adapter for prompts consumed by LangChain chains (Cypher, QA). Returns a
    langchain_core.prompts.PromptTemplate constructed via
    PromptTemplate.from_template(<source-expanded but not Jinja2-rendered template body>, template_format='jinja2').
    LangChain substitutes its own input variables at chain execution time.
    Source-expanded at call time (see §3.4); shared partials are resolved and
    the returned PromptTemplate is fully self-contained."""
```

#### Error types (all subclass `PromptError`)

- `PromptNotFound(name)` — name not in registry
- `MissingInputs(name, missing: set[str])` — caller didn't supply declared inputs
- `UnknownInputs(name, unknown: set[str])` — caller supplied vars not declared in front-matter
- `BootFailure(failures: list[FailureDetail])` — raised from `init_registry()`; aggregates every malformed prompt, not first-hit
- `RenderError(name, cause: Exception)` — wraps any Jinja2 exception that escapes boot AST validation and fires during `render()` (filter type errors, attribute access failures on complex input objects, etc.). Lets call sites catch `PromptError` uniformly without leaking `jinja2.UndefinedError` / `jinja2.TemplateError` types out of `app/core/prompts.py`.
- `UnknownModelError(model_name)` — raised by the LLM factory (§3.5) when `rendered.config.model` is not registered. Call sites are expected to either register the model or correct the prompt's front-matter.

#### Boot lifecycle

```python
# Module-relative default; computed from app/core/prompts.py's __file__ to
# resolve to backend/prompts/ regardless of process working directory.
_PROMPTS_ROOT = Path(__file__).resolve().parent.parent.parent / "prompts"

# Module-level singleton populated by init_registry(). Module-level wrappers
# (render, get_config, list_prompts) delegate to this. Same Registry object
# is also stored on app.state.prompts during lifespan setup.
_registry: "Registry | None" = None

def init_registry(root: Path = _PROMPTS_ROOT) -> Registry:
    """Walk root/, parse every .md.j2 file, validate, build Jinja env, populate cache.
    Sets the module-level _registry singleton; returns the same Registry object
    for the caller to store on app.state.prompts.
    Raises BootFailure with aggregated failures."""
```

**Module-level singleton pattern.** `init_registry()` sets the module-level `_registry` before returning the same `Registry` object. `app.main.lifespan` stores it on `app.state.prompts` for handler access via the FastAPI app instance, but the same reference also lives at the module level so non-handler call sites (services, helpers) can use the module-level `render()` / `get_config()` / `list_prompts()` wrappers without a `Request` in scope. Module-level wrappers raise `RuntimeError("init_registry not called")` if accessed before initialization. Tests calling `init_registry(test_root)` replace the singleton (acceptable in test scope; production `lifespan` calls it exactly once).

**Double-call behavior.** A second `init_registry()` call — whether from a buggy production `lifespan`, a script importing the module twice, or a test fixture — silently replaces the module-level `_registry` with the new build. This matches the documented test-override pattern (no `_registry = None` reset required between test cases) and is the v1 contract. Production code calls `init_registry()` exactly once; if a real incident demonstrates that silent replacement masked a production bug, a `RuntimeError` guard can be added in v2 without API change. Pull-forward trigger: first production bug masked by silent replacement.

The default `root` is CWD-independent. `app.main.lifespan` may pass an explicit `root` (e.g. for tests pointing at `tmp_path`); production code uses the default.

Invoked from `app.main.lifespan` before services start.

`init_registry()` performs, in order:

0. **Pre-flight directory check.** Assert `root.is_dir()` and `(root / "_shared").is_dir()`. If either is false, raise `BootFailure([FailureDetail(file=str(root), error='prompts root or _shared/ not found')])` immediately. This catches the case where `prompts.py` has been moved (silently breaking the `__file__`-relative default) and produces a loud error instead of an empty registry.
1. Recursively walk `root`, collecting all `.md.j2` files.
2. Parse each: split front-matter (`---` fenced YAML) from body. **Per-file parse errors are captured as `FailureDetail` entries and aggregated into `BootFailure`; processing continues for remaining files.** Errors caught: UTF-8 decode failures, malformed YAML, missing closing `---` fence. BOM markers at file head are stripped silently (UTF-8 BOM allowed but not required).
3. Load and parse `_shared/defaults.yaml`. If missing, raise `BootFailure([FailureDetail(file='_shared/defaults.yaml', error='missing required file')])`. If malformed YAML, raise `BootFailure` with the YAML error captured.
4. Merge each prompt's front-matter with the defaults loaded in step 3.
5. Validate front-matter: required fields present, semver shape, `response_format` enum, `_shared/` files marked as partials, filename stem matches `name`, cross-prompt `name` collisions rejected.
6. Build a Jinja2 environment with `FileSystemLoader(root)` (see §3.4 for env flags).
7. For each prompt: parse the template's AST and extract referenced variables (including via `{% include %}` transitively). Compare to declared `inputs` — mismatch is a failure entry.
8. Compute and cache each prompt's `content_hash`. **Algorithm:** SHA-256 of the prompt's *source-expanded body* — produced by the shared expansion algorithm defined in §3.4 "Source-expansion algorithm." No Jinja2 rendering during hash computation; no input values are needed. The hash is partial-sensitive (any partial source edit bumps every includer's hash) and input-independent. Whitespace effects from `trim_blocks`/`lstrip_blocks` are intentionally not reflected — the hash detects *source* changes, not *render* changes.
9. Build the registry mapping `name → (PromptConfig, jinja_template, declared_inputs, content_hash)`.
10. Set `_registry = registry`. If any failures accumulated, raise `BootFailure(failures)` with the full list. Otherwise return the `Registry`.

**Performance budget.** Expected boot-time initialization: <1 second for up to 200 prompt files on Render's standard runtime. The walk + parse + AST + hash work is linear in file count, and Jinja2 AST parsing is fast (it doesn't render). If the prompt corpus grows past this ceiling, the loader can be extended with lazy per-prompt loading or a pre-compiled cache without changing the public API. The current baseline (~25-30 known prompts plus audit-surfaced inline) is well under this bar.

#### Render lifecycle

```python
rendered = render("research_market_1", company_profile_json=...)
```

1. Lookup `name` in registry. Missing → `PromptNotFound`.
2. Compare `inputs.keys()` to the prompt's declared input set. Extras → `UnknownInputs`. Missing → `MissingInputs`.
3. Render the cached **source-expanded body** with the provided inputs (see step 3 detail below). Any Jinja2 exception (`UndefinedError` from `StrictUndefined`, filter type errors, etc.) is caught and re-raised as `RenderError(name, cause=<jinja2_exception>)` so call sites can catch `PromptError` uniformly.
4. Compute `render_inputs_hash = sha256(json.dumps(inputs, sort_keys=True, default=str))`. **Limitation:** callers should pass JSON-serializable types (`str`, `int`, `float`, `bool`, `None`, `list`, `dict`) as inputs. Non-serializable types are coerced via `str()` and may produce hash collisions across semantically different values (e.g. a `datetime` and its `str()`-cast string both hash identically). The hash is observability-grade ("were these likely the same inputs as last call?"), not security-grade. **The `json.dumps` call sits inside the same `try/except` block as the Jinja2 render** so a callback that fails `default=str` raises `RenderError`, preserving PromptError uniformity (a raw `TypeError`/`RuntimeError` would otherwise leak out).
5. Capture `rendered_at = datetime.now(timezone.utc)`. The timestamp is taken *here*, immediately after a successful render, so it reflects the actual prompt-render time rather than the LLM-completion time. Downstream observability reads this field from `RenderedPrompt` (see §3.5 `_prompt_meta_from()`).
6. Return `RenderedPrompt(name, version, content_hash, render_inputs_hash, body, rendered_at, config)`.

<!-- post-merge -->
> **Post-merge note (2026-05-26) — step 3 implementation detail:** `render()` must render the **source-expanded body** (partials already textually substituted, see §3.4), not the raw file-on-disk template. The implementation uses `env.from_string(entry.body_source_expanded).render(**inputs)`, not `env.get_template(entry.template_name).render(**inputs)`. Using `get_template` would re-read the raw file from disk including its YAML front-matter, which would render verbatim into the output (critical correctness bug). This makes `body_source_expanded` load-bearing for both `render()` and `as_langchain()`, not just the LangChain adapter (clarified in §3.4).

<!-- post-merge -->
> **Post-merge note (2026-05-26) — Jinja2 env config:** The shared Jinja2 `Environment` set up at boot (see §3.4) must use `keep_trailing_newline=True`. Without it, Jinja2 strips the trailing newline of every rendered body, breaking byte-parity with legacy `.format()`-based assembly (legacy preserved file-trailing newlines verbatim). The full env config is therefore: `loader=FileSystemLoader(root), undefined=StrictUndefined, trim_blocks=True, lstrip_blocks=True, keep_trailing_newline=True`. See §3.4 update.

### 3.4 Rendering pipeline

#### Jinja2 environment

```python
from jinja2 import Environment, FileSystemLoader, StrictUndefined

env = Environment(
    loader=FileSystemLoader(root),
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
    keep_trailing_newline=True,  # post-merge: required for byte-parity with legacy .format() output
)
```

Four flags, four reasons:

- **`undefined=StrictUndefined`** — without it, `{{ typo }}` silently renders as empty string. We're escaping exactly this class of silent failure. Boot-time AST validation catches most typos; this catches the remainder (dynamic references like `{{ struct[key] }}`).
- **`trim_blocks=True`** — strips the newline after a block tag (`{% if %}`, `{% endif %}`, `{% include %}`). Without it, every block tag in the body adds a blank line to the rendered output. Material for golden-fixture diff readability.
- **`lstrip_blocks=True`** — strips leading whitespace before a block tag up to the tag itself. Companion to `trim_blocks`; lets authors indent block tags for readability without injecting indentation into the rendered output.
- **`keep_trailing_newline=True`** <!-- post-merge --> — by default Jinja2 strips the final trailing newline of a rendered body. Prompt files conventionally end in a trailing newline, and legacy `.format()`-based assembly preserved it verbatim. Without this flag, byte-parity tests against the legacy baseline fail by exactly one byte (the missing `\n`). Required for the migration's "no behavioral change" contract.

Everything else is Jinja2 defaults. Notably `autoescape=False` is also the default and is not set explicitly.

#### Partial resolution

- Partials live at `_shared/<name>.md.j2`. Includes use literal paths from the loader root: `{% include '_shared/<name>.md.j2' %}`.
- Partials may reference variables from the including prompt's context. The loader's input-validation pass walks transitive `{% include %}` references — the declared `inputs:` of the including prompt must cover the union of all variables referenced by the body and every partial it (transitively) includes.
- Maximum include depth: 1. A top-level prompt may include leaf partials in `_shared/`; partials may not include other partials. Deeper nesting is rejected at boot. The spec's own examples only exercise depth 1. The limit can be raised to 2 in a future revision when a concrete use case arises; the source-expansion algorithm below already handles arbitrary depth via recursion, so the change is bounded to validation logic.

#### Source-expansion algorithm

A shared algorithm used by `content_hash` (§3.3 step 8), `render()` (§3.3 render lifecycle step 3), and `as_langchain()` (LangChain interop below). Produces a single self-contained template body from a prompt + its transitively-included partials, by **textual substitution** of `{% include %}` directives.

<!-- post-merge -->
> **Post-merge note (2026-05-26) — `body_source_expanded` is load-bearing for `render`, not just LangChain:** The expanded body is cached on the registry entry as `body_source_expanded`. `render()` calls `env.from_string(entry.body_source_expanded)` so the same source-expansion semantics drive `render()`, `content_hash`, and `as_langchain()`. Using `env.get_template(entry.template_name)` instead would re-parse the raw file from disk (front-matter included) and is incorrect. The original spec phrasing implied this field was for LangChain only — clarified here.

Algorithm:

1. Read the prompt's `.md.j2` file body (front-matter stripped).
2. Scan the body for `{% include 'PATH' %}` directives (literal-token match — Jinja2 disallows `{% %}` inside string literals, so a textual scan over non-commented source is unambiguous). Commented-out includes (`{# {% include 'x' %} #}`) are not expected in production prompts; if they appear, the textual scan expands them anyway and the resulting malformed Jinja2 is caught at boot-time AST parsing as a `BootFailure` entry — loud failure, not silent corruption.
3. For each `{% include 'PATH' %}` directive: read the file at PATH, strip its front-matter, and substitute the partial's body **in place of the entire `{% include %}` line**. The leading whitespace before the directive on its line is consumed (the partial's body brings its own leading whitespace); the trailing newline after the directive is also consumed (the partial brings its own).
4. Expansion is **unconditional** — a `{% include %}` directive inside `{% if %}` is expanded regardless of the surrounding control structure. The hash is over source content, not rendered output.
5. The partial's own `{% if %}` / `{{ var }}` markers are preserved verbatim into the expanded body. They remain Jinja2 directives, to be evaluated by whichever Jinja2 environment renders the expanded body (the loader's `StrictUndefined` env for `prompts.render()`, or LangChain's Jinja2 env for `as_langchain()`).
6. Recurse: scan the expanded body for any remaining `{% include %}` directives and repeat. Recursion is bounded by the include-depth limit (currently 1), so in v1 the recursion is effectively single-pass.

The output is a single string with no remaining `{% include %}` directives, but with all other Jinja2 syntax (`{% if %}`, `{% for %}`, `{{ var }}`) preserved from both the parent prompt and every included partial.

#### Conditional sections

Today's orchestrator-side branching for variable prompt sections moves into the template. Example (signals):

Before (orchestrator-side):
```python
leads_section = (
    _LEADS_SECTION_TEMPLATE.format(...) if has_leads
    else _LEADS_SECTION_FALLBACK_TEMPLATE.format(...)
)
prompt = _SCOUT_PROMPT_TEMPLATE.format(
    context_json=..., leads_section=leads_section, existing_headlines_section=...
)
```

After (template-side):
```jinja
{# signals/scout_search.md.j2 #}
{% if leads %}
  {% include 'signals/leads_section.md.j2' %}
{% else %}
  {% include 'signals/leads_section_fallback.md.j2' %}
{% endif %}
{% if existing_headlines %}
  {% include 'signals/existing_headlines_section.md.j2' %}
{% endif %}
```

```python
# call site
rendered = prompts.render(
    "signals_scout_search",
    company_profile_json=...,
    leads=leads_list,                      # falsy → fallback path
    existing_headlines=existing_or_none,   # falsy → section omitted
)
```

The orchestrator stops doing prompt-fragment assembly; the logic moves into the template.

#### JSON-example handling

Single `{` and `}` characters pass through Jinja2 unchanged. JSON examples in prompt bodies require no escaping — this is the central win over the current `.format()`-based system, which forced every JSON brace to be doubled (`{{` `}}`).

**Edge cases:** `{{` and `}}` are Jinja2's expression delimiters, so `{{ company_profile_json }}` substitutes the variable. Authors who need a literal `{{` in the *rendered* output should use Jinja2's standard escape `{{ '{{' }}`. The triple-brace case `{{{` parses correctly as `{{` (expression-start) followed by `{` (literal). In practice these edge cases are vanishingly rare in prompts — flagged here for implementer confidence.

#### LangChain interop

The four Cypher/QA prompts in today's `app/core/llm_config.py` are wrapped in `langchain_core.prompts.PromptTemplate` and passed to `GraphCypherQAChain.from_llm(...)`. That API requires a LangChain `PromptTemplate`, not a raw string.

Solution: `prompts.as_langchain(name)` runs the **source-expansion algorithm** (above) on the named prompt to produce a self-contained template body (no remaining `{% include %}` directives, but `{% if %}` / `{{ var }}` preserved), then constructs `PromptTemplate.from_template(<expanded body>, template_format="jinja2")` from it. LangChain's machinery substitutes input variables at chain execution time. Behavior parity (byte-equal output between our loader's render and LangChain's render given the same inputs) is asserted by golden-fixture tests covering each LangChain-wrapped prompt.

**Includes ARE allowed in LangChain-consumed prompts.** The source-expansion is performed at `as_langchain()` call time so LangChain never sees `{% include %}` (which it cannot resolve — no `FileSystemLoader` against our `backend/prompts/` tree). Shared partials (`response_format_json.md.j2`, `final_answer_directive.md.j2`, etc.) flow into Cypher/QA prompts the same way they flow into simple-invoke prompts. The single source of truth is preserved; no drift between Cypher prompts and other prompts when a shared directive changes.

**Caveat — no `StrictUndefined` safety net at runtime.** LangChain's Jinja2 environment is constructed internally by `PromptTemplate.from_template(..., template_format='jinja2')` without `StrictUndefined`. A `{{ typo }}` in a LangChain-consumed prompt's *runtime* execution would render as empty string. The boot-time AST walk (§3.3 step 7) covers this defensively for LangChain-marked prompts by **validating against the source-expanded body** — every `{{ var }}` reference anywhere in the parent body or any included partial body must appear in the parent's `inputs:` declaration, or boot fails. Dynamic references like `{{ struct[key] }}` that could escape the AST walk are not used in the four LangChain-consumed prompts; if a LangChain prompt later needs dynamic refs, this asymmetry must be revisited.

<!-- post-merge -->
> **Post-merge note (2026-05-26) — `as_langchain` `+\n` sentinel workaround for trailing-newline parity:** LangChain's `PromptTemplate.from_template(..., template_format="jinja2")` builds its own internal Jinja2 environment that does **not** expose `keep_trailing_newline` (and defaults to stripping). Our `render()` env sets `keep_trailing_newline=True` (§3.4) to preserve byte-parity with legacy `.format()` output. To make `as_langchain(name).format(**inputs)` produce byte-equal output to `render(name, **inputs).body`, the implementation appends an extra `\n` to the source-expanded body before handing it to `PromptTemplate.from_template`; LangChain's strip-by-default then removes that trailing `\n`, restoring the file's original trailing newline. This workaround is fragile to LangChain version changes — if a future LangChain release changes its Jinja2 env config, the byte-parity test (`test_as_langchain_byte_equal_to_render`) will fail loudly. Listed in §7 v2 backlog for revisiting (e.g. construct LangChain's Jinja2 env manually with `keep_trailing_newline=True`, or migrate Cypher/QA off LangChain entirely).

### 3.5 Observability binding

#### What gets recorded

For every LLM call, the following five fields are persisted to Mongo alongside the existing output document, as a `prompt_meta` sub-document:

| Field | Source | Example |
|---|---|---|
| `name` | front-matter `name` | `"research_market_1"` |
| `version` | front-matter `version` | `"1.0.0"` |
| `content_hash` | SHA-256 of source-expanded template body (partials textually substituted in source form, no Jinja2 rendering — see §3.3 step 8) | `"a3f2c1..."` |
| `render_inputs_hash` | SHA-256 of canonical-JSON(declared inputs only) | `"7b8d9e..."` |
| `model` | resolved config `model` | `"Qwen/Qwen3-235B-A22B-Instruct-2507-tput"` |
| `rendered_at` | server timestamp at render time | ISODate |

Embedded in existing collections (Market Intelligence reports, Lead Market Scores, Signals, etc.), not a separate collection:

```js
{
  _id: ...,
  org_id: "...",
  headline: "...",
  description: "...",
  // ... existing fields ...
  prompt_meta: {
    name: "signals_scout_search",
    version: "1.2.0",
    content_hash: "a3f2c1...",
    render_inputs_hash: "7b8d9e...",
    model: "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
    rendered_at: ISODate("2026-05-25T14:30:00Z"),
  }
}
```

Rationale: the operational query is "show me this output and what produced it" — one find, no join. Embedded sub-doc fits. Cross-prompt analytics queries ("group by version, count outputs") are rare and remain possible with `$group` on the sub-doc field.

#### How call sites get coverage

Call sites in the codebase use **three distinct invocation patterns**, verified against source:

| Pattern | Example | Today's call shape |
|---|---|---|
| **Simple invoke** | `market_scoring/orchestrator.py:326`, `health.py:12` | `llm.invoke([HumanMessage(content=prompt)])` — direct LLM call |
| **Agent chain** | `icp/orchestrator.py:53` | `agent_chain.invoke({'input': prompt})` — LangChain ReAct agent with tools |
| **Custom dispatch** | signals' `_research_agent_output()` | wraps Groq agent_chain or Claude+Tavily depending on flags |

A one-size-fits-all helper cannot cover all three uniformly. The design splits the responsibility:

**Active routing on the simple-invoke path; observability-only on agent-chain.**

This v1 scope decision fulfils TD-010 item 3 ("changing a prompt's model becomes a prompt edit, not a code edit") for the simple-invoke path, where the prompt's front-matter `model`/`temperature` actively configure the LLM call. On the agent-chain path, the `model` field is observability-only in v1 because changing the model behind an `agent_chain` requires rebuilding the chain — out of scope here, planned for v2. The asymmetry is documented loudly in this section so call-site authors understand which way front-matter edits propagate.

**LLM-client factory (lives in `app/services/_llm_helpers.py`):**

```python
# app/services/_llm_helpers.py
from typing import Any, Callable

_LLM_FACTORY: dict[str, Callable[[], Any]] = {}

def register_llm(model_name: str, builder: Callable[[], Any]) -> None:
    """Register a builder for a model name. Called once at startup from
    build_llm_config(). Builders are cached on first call (lazy singleton)."""
    _LLM_FACTORY[model_name] = builder

_LLM_CACHE: dict[str, Any] = {}

def _get_llm_for_model(model_name: str) -> Any:
    if model_name not in _LLM_FACTORY:
        raise UnknownModelError(model_name)
    if model_name not in _LLM_CACHE:
        _LLM_CACHE[model_name] = _LLM_FACTORY[model_name]()
    return _LLM_CACHE[model_name]
```

`build_llm_config()` registers the models that participate in **simple-invoke** routing. Known simple-invoke models at spec time: `Qwen/Qwen3-235B-A22B-Instruct-2507-tput` (Together) and `llama-3.3-70b-versatile` (Groq). New simple-invoke models register here; no other code path constructs LLM clients for that path.

**Claude is not in the factory.** Today's `signal_ask_claude` and `generate_signals_batch_claude` (in `signals/ask.py` and `signals/batch.py`) make direct `requests.post()` calls to `https://api.anthropic.com/v1/messages` — they belong to the **custom-dispatch** invocation pattern. Per the v1 scope decision (active routing on simple-invoke only; observability-only on agent-chain and custom-dispatch), Claude prompts' `model` field is recorded in `prompt_meta` but does not drive routing in v1. The custom-dispatch call sites continue using their existing HTTP + budget-reservation infrastructure; the migration changes only the prompt body (now rendered via `prompts.render()`) and adds `prompt_meta` to the persistence call. Active model routing on the custom-dispatch path is a v2 concern.

**Simple-invoke helper (active model routing from front-matter):**

```python
# app/services/_llm_helpers.py — sync, not async (see below)
def call_with_prompt(
    prompt_name: str,
    **inputs: Any,
) -> tuple[Any, dict[str, Any]]:
    """Simple-invoke path: render the prompt, resolve the LLM from front-matter,
    invoke with a HumanMessage wrapper, return (output, prompt_meta).

    The LLM client is selected by rendered.config.model — front-matter `model`
    edits actively change behavior on this path with no code change.

    Use this helper from call sites that today look like:
        response = llm.invoke([HumanMessage(content=prompt_string)])

    Do NOT use this helper from agent_chain or custom-dispatch call sites —
    they build prompt_meta themselves from the RenderedPrompt object returned
    by prompts.render(); the agent_chain's underlying LLM is fixed at
    build-time in v1 (model field is observability-only on that path).
    """
    from langchain_core.messages import HumanMessage
    rendered = prompts.render(prompt_name, **inputs)
    llm = _get_llm_for_model(rendered.config.model)
    response = llm.invoke([HumanMessage(content=rendered.body)])
    return response, _prompt_meta_from(rendered)
```

The helper is **sync (`def`, not `async def`)**. FastAPI runs sync route handlers in a threadpool automatically; existing call sites (`market_scoring/orchestrator.py:326`, `health.py:12`) are sync. Mixing `async def` with a blocking `llm.invoke()` would block the event loop for the full LLM call (up to 120s for the Qwen path) — worse than honest sync.

**Manual assembly for agent-chain and custom-dispatch (observability-only model field):**

```python
# from icp/orchestrator.py after migration — agent_chain stays as-is in v1
rendered = prompts.render("icp_generator", pre_data=pre_data)
raw_response = agent_chain.invoke({'input': rendered.body})  # agent_chain uses its build-time LLM
output = raw_response["output"]
prompt_meta = _prompt_meta_from(rendered)  # same dict shape; rendered.config.model recorded for observability
```

The `model` field in `icp_generator.md.j2`'s front-matter is recorded in `prompt_meta` but does **not** select the LLM behind `agent_chain` in v1. If/when active routing for agent-chain prompts becomes needed (v2), the agent abstraction will need refactoring (per-prompt agent_chain rebuild, or a model-aware agent factory, or a per-call temperature/model override path).

**Shared `_prompt_meta_from()` lives in `app/core/prompts.py`** (co-located with `RenderedPrompt`):

```python
# app/core/prompts.py

def _prompt_meta_from(rendered: RenderedPrompt) -> dict[str, Any]:
    """Single source of truth for the prompt_meta dict shape, used by
    call_with_prompt and by manual-assembly call sites on agent_chain
    and custom-dispatch paths. Reads rendered_at from the RenderedPrompt
    (captured inside render() — see §3.3 render lifecycle step 5) so the
    timestamp reflects render time, not LLM-completion time."""
    return {
        "name": rendered.name,
        "version": rendered.version,
        "content_hash": rendered.content_hash,
        "render_inputs_hash": rendered.render_inputs_hash,
        "model": rendered.config.model,
        "rendered_at": rendered.rendered_at,
    }
```

`_llm_helpers.py` imports `_prompt_meta_from` from `app.core.prompts`. Each service's `persistence.py` accepts `prompt_meta` alongside the parsed output and includes it in the insert/update. The persisted dict is structurally identical regardless of invocation pattern.

**Note on `rendered_at`:** this is the timestamp when the prompt was rendered, *not* when the LLM produced its output. For simple-invoke calls the two are usually <1s apart; for agent-chain calls (`max_execution_time=120s`), output completion may lag rendering by up to two minutes. End-to-end latency belongs in the planned peer `llm_meta` sub-doc (see "What's deliberately not recorded").

#### Coverage during migration

- Once a service is migrated, all its LLM outputs gain `prompt_meta`.
- Pre-migration services keep producing outputs without `prompt_meta` — gap closes service-by-service.
- No retroactive backfill of older documents.
- Post-migration, analytics queries filter on `{prompt_meta: {$exists: true}}` to scope to migration-era data.

**Indexing.** No Mongo index on `prompt_meta.*` fields in v1. For pre-launch data volumes (single-org orgs, < 10k documents per collection) this is fine — analytics queries scan the collection. Add a compound index on `{org_id: 1, "prompt_meta.name": 1, "prompt_meta.version": 1}` when analytics query latency or data volume justifies it. Pull-forward trigger: collection scans exceeding ~100ms p99 on observability queries, or first multi-org analytics demand.

#### What's deliberately not recorded

- **Raw rendered prompt body.** Recoverable from `(name, version, content_hash)` plus a registry lookup at the corresponding git commit. Storing the body inflates Mongo documents 5-50×.
- **Raw inputs dict.** The hash is sufficient for "were these the same inputs as last time?" — the only useful question without a separate hash-to-inputs index, which we don't maintain.
- **Cost / latency per call.** Different concern. If/when needed, lives in a peer `llm_meta` sub-document.
- **Failed LLM calls.** When an LLM call raises (timeout, rate limit, API error), v1 does *not* persist `prompt_meta` to Mongo — the rendered prompt and its metadata are lost. This is an acknowledged gap: failure observability is more valuable than success observability for debugging ("which prompt is timing out?"), but adding a failure-log path adds error-handling complexity at every call site and is out of scope for v1. A planned v2 addition is a `prompt_failures` collection or peer log path written from a `try`/`except` wrapper. Pull-forward trigger: first production incident where the missing `prompt_meta` on failure blocks root-cause analysis.

### 3.6 Test scaffold

Three layers, each catching a different class of bug.

#### Layer 1 — Renderer unit tests

`backend/tests/unit/test_prompts_loader.py`. Tests the loader and renderer in isolation against synthetic prompts written to a `tmp_path`. Coverage includes:

- Valid prompts load and register correctly.
- `BootFailure` aggregates every malformed prompt, not first-hit.
- `UnknownInputs` raised when caller supplies undeclared vars.
- `MissingInputs` raised when caller omits declared vars.
- `StrictUndefined` raises at render time for dynamic references the AST walk missed.
- Content hash stable across calls (same template + same inputs → same hash).
- `render_inputs_hash` canonical regardless of input dict key order.
- Partial include resolution: declared inputs cover the union of body + transitive partial references.
- Include depth >1 rejected at boot (partials may not include other partials).
- Files under `_shared/` cannot be invoked via `render()`.
- Filename stem must match `name` front-matter field.
- Cross-prompt `name` collision rejected at boot.
- **LangChain parity.** For each LangChain-wrapped prompt (Cypher gen, Cypher gen alt, QA scout, QA scout alt), assert that `as_langchain(name).format(**inputs)` produces byte-equal output to `render(name, **inputs).body`, using the canonical fixture inputs from `tests/fixtures/prompts/_inputs/<name>.json`. This guards the source-expansion algorithm and LangChain's Jinja2 environment against drift — a regression in either (whitespace handling change, partial body change, Jinja2 environment configuration mismatch) breaks the parity assertion with a precise per-prompt diff.

#### Layer 2 — Golden rendered fixtures

`backend/tests/fixtures/prompts/`. One file per real prompt, containing the rendered body for a canonical set of inputs. A single focused diff when any prompt's rendered text changes.

```
backend/tests/
├── fixtures/
│   └── prompts/
│       ├── _inputs/
│       │   ├── research_market_1.json
│       │   ├── icp_generator.json
│       │   └── signals_scout_search.json
│       └── rendered/
│           ├── research_market_1.txt
│           ├── icp_generator.txt
│           └── signals_scout_search.txt
└── unit/
    └── test_prompts_golden.py
```

```python
@pytest.mark.parametrize("name", REGISTERED_PROMPT_NAMES)
def test_golden_render(name):
    inputs = json.load(open(f"tests/fixtures/prompts/_inputs/{name}.json"))
    rendered = prompts.render(name, **inputs)
    expected = (FIXTURE_DIR / "rendered" / f"{name}.txt").read_text()
    assert rendered.body == expected, (
        f"Prompt {name} rendered differs from golden fixture. "
        f"If intentional, regenerate with: python tests/regen_prompt_fixtures.py {name}"
    )
```

Two scripts ship with the scaffold:
- `tests/regen_prompt_fixtures.py [name|--all]` — regenerates rendered fixtures from current registry + canonical inputs.
- The same script scaffolds a missing `_inputs/<name>.json` when a new prompt is added (creates a JSON skeleton with the declared input names and `"REPLACE_ME"` values).

Filename convention: `<name>.txt`, **no version suffix**. The current registered version is authoritative; the fixture matches it. Version bumps produce a fixture diff in the same PR — that's the signal. Versioned filenames would create stale `<name>@v0.9.0.txt` orphans over time.

**CI integration.** `test_prompts_golden.py` runs in CI and fails on drift; the assertion failure message includes the regen command. `_inputs/*.json` files are checked into the repo and manually updated when a prompt's declared inputs change — the regen script does *not* auto-update the input skeleton on input-shape changes. This is deliberate: input-shape drift should surface as an author edit, not a silent regen artifact.

**Sizing guidance for canonical inputs.** Several prompts take large JSON blobs (`company_profile_json`, `market_reports`, `lead` data). The fixture tests verify *render correctness*, not data completeness — canonical inputs should be **minimal but sufficient**. For prompts with large inputs, use trimmed synthetic data (3-5 representative fields per JSON blob) rather than full production payloads. Target `_inputs/*.json` size: under 5 KB per file in typical cases.

**Branch coverage policy.** For conditional prompts (`scout_search.md.j2` with its `{% if leads %}` and `{% if existing_headlines %}` branches), golden fixtures exercise **one canonical path per prompt — the happy path with all conditional sections active**. Fallback / empty-branch rendering (the `{% else %}` arm of conditionals, the missing-input case) is covered by Layer 1 unit tests against synthetic `tmp_path` prompts, not by golden fixtures. This keeps the golden-fixture corpus small (one file per registered prompt, not one per branch combination) and keeps the assertion focused on "did the prompt text change" rather than "is every branch reachable."

#### Layer 3 — Behavior tests decoupled from prompt body

Today's service tests (`test_market_research_orchestrator.py` and peers) assert on substring fragments inside prompt literals (per TD-010 §current state). These break on prompt rewording even when LLM behavior is unchanged.

Migration converts each substring assertion to a `prompt_meta` assertion:

```python
# before — fragile
assert "Research and compile" in captured_prompt_arg

# after — stable
assert captured_prompt_meta["name"] == "research_market_1"
assert captured_prompt_meta["version"] == "1.0.0"
```

The substring-assertion sweep is part of each service's migration commit (Phase 2), not a separate phase.

#### Interaction with TD-004

TD-004 tracks 24 stub LLM-response fixtures awaiting real captures. This spec's golden rendered fixtures cover prompt *input* shape; TD-004's captured fixtures cover prompt *output* shape. The two are independent — neither blocks the other. When TD-004 is resolved (real captures generated on a machine with API keys), the captured responses will naturally include the `prompt_meta` sub-document from the migrated call sites.

## 4. Migration plan

### Phase 0 — Discovery audit (one commit)

Inventory every prompt string in `backend/`. This commit makes no code changes — it's the cartographic prerequisite for the migration that follows, and it gates Phase 1's plan with three deliverables:

1. **`docs/prompt-inventory.md`** — every prompt location with file path, line range, current shape (constant in `prompts.py`, inline in `services.py`, LangChain `PromptTemplate` wrapper, etc.), and the call sites that consume it.
2. **Call-site classification** — for each location, label it with one of the three invocation patterns from §3.5 (simple-invoke, agent-chain, custom-dispatch). This determines which call sites use `call_with_prompt` and which use manual `prompts.render()` + `_prompt_meta_from()`.
3. **`call_with_prompt` scope confirmation** — based on (2), confirm that the helper's simple-invoke scoping is sufficient or surface any additional patterns that warrant their own helper.

The implementation plan for Phases 1-3 reads from this audit; per-service migration order in §4 Phase 2 is reconciled against the audit before Phase 2 begins.

### Phase 1 — Infrastructure (3-4 commits)

The new system lands with zero call sites yet using it. Existing `prompts.py` modules stay in place; boot still succeeds; tests still pass.

1. **`app/core/prompts.py`** — loader, registry, renderer, error types, dataclasses, `_prompt_meta_from()` helper. Tests in `tests/unit/test_prompts_loader.py`. **No *callable* prompt bodies on disk except synthetic ones written by tests to `tmp_path`.** Shared partials land in step 2 and are includable-only (not callable via `render()`). Also: add `jinja2>=3.1` to `backend/requirements.txt` as a direct dependency — today it's only present transitively via `langchain-core`, and the prompt system makes it core enough to declare explicitly.
2. **`backend/prompts/_shared/`** — `defaults.yaml` plus shared partials extracted from the inventory's common fragments (response-format JSON directive, final-answer directive, Scout persona). One commit per partial or grouped if small.
3. **`tests/regen_prompt_fixtures.py`** + golden fixture infrastructure. Empty `tests/fixtures/prompts/_inputs/` and `tests/fixtures/prompts/rendered/` directories ready to receive per-prompt fixtures.
4. **`app/services/_llm_helpers.py`** — `call_with_prompt(name, **inputs)` helper (signature per §3.5; LLM is resolved internally from `rendered.config.model` via the `_LLM_FACTORY`). Plus the LLM-client factory itself (`register_llm`, `_get_llm_for_model`, `_LLM_FACTORY`, `_LLM_CACHE`). Wire `init_registry()` and the factory's initial model registrations into `app.main.lifespan`. At boot, the registry contains only shared partials — no callable prompts yet — but the system is live and the factory is populated.

### Phase 2 — Service-by-service migration

Each service migrates in one all-or-nothing PR. Ordering: prove the basic loader/render/observability pipeline on a mechanical migration first, then stress the include/conditional mechanism, then volume, then LangChain interop.

1. **`icp/`** first — five prompts (`ICP_GENERATOR_TEMPLATE`, `ICP_RESEARCH_1`-`4_TEMPLATE`), all `{pre_data}`-substituted with no conditional sections. Mechanical translation that exercises the loader, renderer, observability binding, and per-service `prompt_meta` integration with minimal novel-feature surface. If the basic pipeline has bugs, this commit surfaces them with the smallest possible confound — no include nesting, no conditionals to misinterpret. (Earlier draft had `signals/` first as "fail fast on the hardest case"; round-2 review reordered this so the mechanical case validates infrastructure before the include mechanism stresses it.)
2. **`signals/`** — its conditional logic (leads section, existing headlines section) is the strongest test of Jinja2 includes + conditionals. Migrating it second proves the include mechanism on a now-validated loader. Affects: `_SCOUT_PROMPT_TEMPLATE`, `_PROFILER_PROMPT_TEMPLATE`, `_LEADS_SECTION_TEMPLATE`, `_LEADS_SECTION_FALLBACK_TEMPLATE`, `_EXISTING_HEADLINES_SECTION_TEMPLATE`, `_SIGNAL_ASK_PROMPT_TEMPLATE`, `_SIGNAL_ASK_CLAUDE_PROMPT_TEMPLATE`.
3. **`market_research/`** — five prompts (`RESEARCH_MARKET_1`-`5_TEMPLATE`), 718 LOC. Heaviest by line count but five near-parallel prompts.
4. **`llm_config.py`** — Cypher and QA prompts. Last because it introduces the LangChain `as_langchain()` adapter (see §3.4 caveat) — kept isolated rather than co-introduced with basic migration mechanics. Affects: `Cypher_gen_prompt`, `Cypher_gen_prompt2`, `qa_prompt_template`, `qa_prompt_template2`.
   - **Deletion target:** `_CYPHER_BASE`, `_CYPHER_GEN_PROMPT_OVERLAY`, `_CYPHER_GEN_PROMPT2_OVERLAY`, `_CYPHER_TAIL`, `_QA_BASE`, `_QA_PROMPT_TEMPLATE_OVERLAY`, `_QA_TAIL`, and the assembled prompt constants (`Cypher_gen_prompt`, `Cypher_gen_prompt2`, `qa_prompt_template`, `qa_prompt_template2`, `Cypher_Prompt`, `Cypher_Prompt2`, `qa_prompt`, `qa_prompt2`) are all removed from `llm_config.py`. `build_llm_config()` calls `prompts.as_langchain("cypher_gen")`, etc., and stores the resulting `PromptTemplate` references on the `LLMBundle` (or passes them directly into `GraphCypherQAChain.from_llm(...)`).
5. **`market_scoring/`** — single inline prompt (`score_single_lead_against_market`, 34 LOC in `market_scoring/orchestrator.py:282-325`). Currently uses the simple-invoke pattern (`llm2.invoke([HumanMessage(content=prompt)])` at line 326), so `call_with_prompt` applies directly. One commit; small surface. Known at spec time (baseline inventory in §2.1), not audit-discovered — listed as its own step rather than lumped with the catch-all below.
6. **Other services discovered in Phase 0** — `customer_profile`, `leads`, `pipeline`, and anything else inline that the audit surfaces beyond the §2.1 baseline. Order determined by audit output.

Per-service migration commit includes:

- Prompt bodies moved into `backend/prompts/<svc>/*.md.j2` with front-matter.
- Call sites switched from `from .prompts import X; X.format(...)` to `prompts.render("name", ...)` (or `call_with_prompt(...)` where the helper applies).
- Service's existing `prompts.py` **deleted** — no re-export shim, per CLAUDE.md "no backwards-compat shims."
- Golden rendered fixtures added for every migrated prompt under `tests/fixtures/prompts/`.
- Substring assertions in that service's tests rewritten to `prompt_meta` assertions.
- `prompt_meta` sub-doc added to that service's persistence calls.

After each service's PR lands, the new system covers strictly more ground; no service is half-migrated.

**Rollback.** A regression discovered after a service's PR lands is reverted via `git revert` of the PR — no shim layer (per CLAUDE.md no-backwards-compat-shims rule). A reverted PR removes the prompt files under `backend/prompts/<svc>/`, the call-site changes, the persistence/fixture changes, and the substring-to-`prompt_meta` test rewrite atomically. The service returns to its pre-migration state; subsequent services' migrations continue uninterrupted because the system is designed for service-level independence.

### Phase 3 — Cleanup + migration outcome report (one commit, or one commit + a peer doc commit)

After every prompt is migrated:

- Delete `tests/fixtures/prompts/_inputs/` skeletons for any prompts that turned out to be unreachable in the Phase 0 audit.
- Add `docs/PROMPTS.md` explaining the front-matter schema, the `_shared/` convention, the regen-fixtures workflow, and the `prompt_meta` observability sub-doc. Authored at the end so it describes what landed, not what was planned.
- Resolve TD-010 in `docs/TECH_DEBT.md` with a back-reference to the implementing PRs.
- **Write `docs/prompt-migration-outcome.md`** — the migration's audit trail (see "Migration outcome report" below).

### Migration outcome report

`docs/prompt-migration-outcome.md` is a frozen historical record of the migration. Every prompt location surfaced in the Phase 0 audit appears in this doc with one of three dispositions:

| Disposition | Meaning | Recorded fields |
|---|---|---|
| **Migrated** | Prompt body moved into `backend/prompts/`, registered, golden fixture present, call site uses `prompts.render()`. | Old location, new prompt name, version at migration, content hash at migration. |
| **Intentionally deferred** | Prompt stayed in code on purpose (too small to be worth a file, too entangled with non-prompt logic, planned for a future overhaul, etc.). | Old location, reason, link to a new TD entry in `docs/TECH_DEBT.md` if the deferral creates ongoing debt. |
| **Unmigratable** | Prompt could not be migrated as discovered (runtime-constructed from non-deterministic fragments, referenced only from a dead code path, etc.). | Old location, blocker description, recommendation (delete dead path, refactor before migrating, etc.). |

Rules:
- Every intentionally-deferred item with ongoing implications has a corresponding TD entry created in the same Phase 3 commit.
- Every unmigratable item is followed up either by (a) deleting the dead path in a follow-up commit, or (b) opening a new TD entry naming the blocker.
- The doc is frozen after Phase 3. It is not maintained against future drift — its purpose is to record what happened during the migration, not to track ongoing state.

This sits alongside (not inside) `docs/PROMPTS.md` to preserve the separation between "current state of the system" (`PROMPTS.md`) and "historical record of how we got here" (`prompt-migration-outcome.md`). Same discipline as `specs/` (frozen intent) vs the code (current truth).

## 5. Coexistence rules

During Phase 2, services are migrated one at a time. The transition state is constrained by:

- A service is either fully migrated (no `prompts.py` in its directory, all call sites use the registry) or fully unmigrated (untouched). No partial state.
- Cross-service prompt imports are not a pattern today — each service's `prompts.py` is consumed only by its own `llm.py`/`orchestrator.py` peers. The service-level boundary is the natural migration unit.
- The Phase 0 audit verifies this. If a cross-service prompt dependency is discovered, the implementation plan adjusts before Phase 2 begins.
- During Phase 2, `app.state.prompts` may grow service-by-service: it starts containing only shared partials after Phase 1, gains each service's prompts as their commits land, and is complete after Phase 2's final commit.

## 6. Definition of done

The migration is complete when:

1. `backend/prompts/` contains every prompt surfaced in the Phase 0 audit, with the exception of items recorded as "intentionally deferred" or "unmigratable" in `docs/prompt-migration-outcome.md`.
2. No service directory contains a `prompts.py` module except where the migration-outcome report records deferral.
3. Every migrated prompt has a golden rendered fixture under `tests/fixtures/prompts/rendered/`.
4. `tests/unit/test_prompts_loader.py` passes; `test_prompts_golden.py` passes for every registered prompt.
5. Every service's persistence calls write a `prompt_meta` sub-doc alongside LLM output.
6. `docs/PROMPTS.md` describes the system as it exists.
7. `docs/prompt-migration-outcome.md` lists every audit-surfaced location with its disposition.
8. TD-010 in `docs/TECH_DEBT.md` is resolved with PR references.
9. No substring-on-prompt-body assertions remain in the test suite.
10. Boot succeeds. The full test suite passes.

## 7. References

- TD-010 — `docs/TECH_DEBT.md`
- TD-004 — `docs/TECH_DEBT.md` (independent; composes naturally with this spec when both resolve)
- `backend/CLAUDE.md` / `CLAUDE.md` — repo-level conventions including business state (pre-launch, no zero-downtime requirement), AI-native development, and the no-backwards-compat-shims rule
- `docs/PROMPTS.md` — authoring guide for the migrated system (current truth)
- `docs/prompt-migration-outcome.md` — frozen audit trail of plan-13 deviations, dispositions, and post-merge spec-vs-implementation deltas
- Current prompt locations (baseline inventory at spec time; Phase 0 audit produces the authoritative list):
  - `app/services/market_research/prompts.py` (718 LOC)
  - `app/services/icp/prompts.py` (383 LOC)
  - `app/services/signals/prompts.py` (325 LOC)
  - `app/core/llm_config.py` lines 33-205 (Cypher + QA prompts, ~170 LOC of prompt text)
  - `app/services/market_scoring/orchestrator.py:282-325` (inline `score_single_lead_against_market` f-string, 34 LOC)
  - `app/services/health.py:10` (inline `probe_llm` smoke-test prompt, 1 LOC)

<!-- post-merge -->
## 8. v2 backlog (post-implementation)

Items deferred during plan-13 execution. Each is non-blocking for v1 and earns a separate spec/plan when pulled forward. Source of truth is `docs/prompt-migration-outcome.md` (frozen) plus this v2 backlog (rolling).

| Item | Trigger to pull forward | Notes |
|---|---|---|
| **Retire `_DEFAULT_CLAUDE_PROMPT_SUFFIX`** (`app/services/_llm_helpers.py:111`) | Next prompt-system spec, or first time the suffix needs to differ per Claude consumer beyond what overrides cover | Audit recommended inlining `{% if web_ctx %}…{% endif %}` into Tasks 8–10 prompts; implementation deferred to avoid scope creep. Suffix is still actively consumed by signals (default) + icp + market_research (via overrides). P-025 in outcome doc. |
| **`as_langchain` `+\n` sentinel fragility** | LangChain version bump that changes `PromptTemplate.from_template` Jinja2-env behavior, or first time `test_as_langchain_byte_equal_to_render` fails after a dependency upgrade | Replace with a manually-constructed LangChain Jinja2 env that exposes `keep_trailing_newline=True`, or migrate Cypher/QA off LangChain entirely. See §3.4 LangChain interop post-merge note. |
| **Active model routing for custom-dispatch paths** | First production demand to A/B test or change the model behind a Claude/`_claude_messages_text` call without a code edit | Out of v1 (spec §3.5). Requires reworking the custom-dispatch invocation pattern to consult `rendered.config.model` rather than hardcoded HTTP endpoints. |
| **Retire one-shot equivalence test** (`tests/unit/test_llm_config_migration_equivalence.py` + `tests/_baselines/llm_config_prompt_strings.py`) | After one release cycle from migration merge | The `as_langchain` parity test + golden fixtures cover the same ground going forward. Listed in outcome doc "Test scaffolding scheduled for cleanup." |
| **Failure-path `prompt_meta` persistence** | First production incident where missing `prompt_meta` on a failed LLM call blocks root-cause analysis | A `prompt_failures` collection or peer log path, written from a `try`/`except` wrapper. Spec §3.5 "What's deliberately not recorded." |
| **Mongo index on `prompt_meta.*`** | Collection scans exceeding ~100ms p99 on observability queries, or first multi-org analytics demand | Compound index `{org_id: 1, "prompt_meta.name": 1, "prompt_meta.version": 1}`. Spec §3.5 "Indexing." |
