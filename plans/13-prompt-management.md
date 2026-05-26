# Plan 13 — Prompt management system

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `specs/13-prompt-management-design.md` (frozen on approval). Authoritative for design decisions; this plan executes it.

**Goal:** Externalize every prompt in `backend/` into versioned `.md.j2` files with YAML front-matter, served by a new `app/core/prompts.py` loader/registry, with per-LLM-call `prompt_meta` observability written to Mongo.

**Architecture:** A module-level singleton `Registry` populated once at FastAPI lifespan, holding `name → (PromptConfig, jinja_template, declared_inputs, content_hash)`. Three invocation patterns share one observability surface (`prompt_meta` sub-doc on existing Mongo collections): simple-invoke gets active model routing via a new `call_with_prompt` helper; agent-chain and custom-dispatch get observability-only. Shared partials in `backend/prompts/_shared/` compose into callable prompts via `{% include %}`; the same source-expansion algorithm produces self-contained templates for LangChain interop.

**Tech Stack:** Python 3, FastAPI, Jinja2 ≥3.1 (newly declared as direct dependency — currently transitive via `langchain-core`), PyYAML (already transitive), LangChain `PromptTemplate` (existing), pytest.

**Paths:** Plan lives at `plans/13-prompt-management.md`. All file paths below are relative to repo root `/projects/Brewra/brewra-gtm-intelligence/` unless prefixed `backend/`, in which case relative to `backend/`.

**Commit convention (per `CLAUDE.md`):** `type(scope):` subjects. One commit per task. No `Co-Authored-By: Claude` footer. `Refs: spec-13` trailer optional, only when commit context isn't obvious from the diff.

## Abort criteria

Halt execution and report to the human, do not proceed to the next task, if any of the following happens at any task boundary:

- **Pre-existing red baseline.** Task 1 Step 0 finds the full suite already failing before any plan work begins.
- **Full-suite regression that resists resolution within one session.** If after a reasonable debugging attempt the regression can't be traced or fixed, revert the failing commit (`git revert <sha>`) and stop. The spec §4 Phase 2 explicitly supports service-level revert as the rollback mechanism — no shim layer is needed.
- **Boot failure in production after Task 7 lands.** `init_registry()` is now in `lifespan()`. If it raises `BootFailure` in production (e.g. a malformed `.md.j2` snuck through local testing), the server won't start. Roll the commit back via `git revert` and investigate from local.
- **Scope explosion in Phase 0.** If the audit surfaces >2× the baseline count (i.e. >50 additional prompts), pause and revisit migration order/sequencing with the human — Task 13's catch-all may not be appropriately sized.
- **Performance ceiling exceeded.** Spec §3.3 budgets `init_registry()` boot at <1 second for up to 200 files. If a manual run (`python -c "from app.core.prompts import init_registry; ..."`) takes >2× the budget, investigate before landing further migrations — the loader's linear walk may need a pre-compiled cache.
- **Byte drift in Task 11 one-shot equivalence test.** If the rendered output diff between `as_langchain()` and the legacy baselines isn't traceable to a known whitespace boundary in <30 minutes, stop. The migration must preserve LLM behavior; unexplained drift means the prompt translation is wrong.

**Recovery is `git revert`, not state surgery.** Service-level commits are designed to revert cleanly per spec §4 Phase 2 — a reverted commit removes the `.md.j2` files, call-site rewrites, fixture changes, and test rewrites atomically. Subsequent services' migrations resume from a known-good base.

---

## File map (all new or modified files)

**Created:**
- `backend/app/core/prompts.py` — loader/registry/render/observability hooks (~400 LOC)
- `backend/prompts/_shared/defaults.yaml` — cross-prompt defaults (temperature, max_tokens, timeout_s)
- `backend/prompts/_shared/response_format_json.md.j2`
- `backend/prompts/_shared/scout_persona.md.j2`
- `backend/prompts/_shared/final_answer_directive.md.j2`
- `backend/prompts/icp/{icp_generator,icp_research_1..4}.md.j2`
- `backend/prompts/signals/signals_{scout_search,profiler_search,leads_section,leads_section_fallback,existing_headlines_section,signal_ask_groq,signal_ask_claude}.md.j2`
- `backend/prompts/market_research/research_market_{1..5}.md.j2`
- `backend/prompts/llm_config/{cypher_gen,cypher_gen_alt,qa_scout,qa_scout_alt}.md.j2`
- `backend/prompts/market_scoring/score_lead.md.j2`
- `backend/tests/unit/test_prompts_loader.py`
- `backend/tests/unit/test_prompts_golden.py`
- `backend/tests/regen_prompt_fixtures.py`
- `backend/tests/fixtures/prompts/_inputs/<name>.json` — one per registered prompt
- `backend/tests/fixtures/prompts/rendered/<name>.txt` — one per registered prompt
- `docs/prompt-inventory.md` (Phase 0; deleted at end of Phase 3 — its contents fold into the migration-outcome doc)
- `docs/PROMPTS.md`
- `docs/prompt-migration-outcome.md`

**Modified:**
- `backend/requirements.txt` — add `jinja2>=3.1`
- `backend/app/services/_llm_helpers.py` — add `register_llm`, `_get_llm_for_model`, `call_with_prompt`, `_LLM_FACTORY`, `_LLM_CACHE`
- `backend/app/main.py` — wire `init_registry()` in `lifespan`
- `backend/app/core/llm_config.py` — `build_llm_config()` registers Qwen/Groq LLMs in factory, calls `prompts.as_langchain(...)` for Cypher/QA prompts; old `_CYPHER_*` / `_QA_*` constants deleted
- `backend/app/services/icp/orchestrator.py` — call sites use `prompts.render()`; functions return `(parsed_json, prompt_meta)` tuple
- `backend/app/services/icp/persistence.py` — `list_icps()` merges `prompt_meta` into ICP_config insert
- `backend/app/services/signals/{search,ask,batch}.py` — call sites; persistence calls include `prompt_meta`
- `backend/app/services/signals/persistence.py` — add `prompt_meta` to Mongo writes
- `backend/app/services/market_research/{orchestrator,persistence}.py` — same pattern as signals/icp
- `backend/app/services/market_scoring/orchestrator.py` — `score_single_lead_against_market` uses `call_with_prompt`; `_persist_market_score_for_lead` gets `prompt_meta` arg
- `backend/app/services/market_scoring/scoring.py` — propagate `prompt_meta` from scoring loop to persistence
- `backend/tests/unit/test_icp.py`, `test_signals.py`, `test_market_research.py`, `test_market_scoring.py` — substring assertions on prompt bodies → `prompt_meta` assertions
- `backend/tests/test_lifespan.py` — assert `app.state.prompts` populated after lifespan
- `docs/TECH_DEBT.md` — mark TD-010 resolved with PR refs

**Deleted (only after their service migrates):**
- `backend/app/services/icp/prompts.py`
- `backend/app/services/signals/prompts.py`
- `backend/app/services/market_research/prompts.py`
- `backend/tests/unit/test_llm_config_prompts.py`
- `backend/tests/_baselines/llm_config_prompt_strings.py`
- `backend/tests/unit/test_market_research_prompt_assembly.py` (assertions on inline prompt strings — equivalent coverage moves to golden fixtures)

---

# Phase 0 — Discovery audit

## Task 1: Inventory every prompt string in `backend/`

**Goal:** Produce the authoritative list of prompt locations before any code change. Output: `docs/prompt-inventory.md`. No production code touched.

**Files:**
- Create: `docs/prompt-inventory.md`

- [ ] **Step 0: Establish a clean test-suite baseline**

Before any task runs, confirm the suite currently passes. Every subsequent "Expected: green" step is meaningless if pre-existing failures already exist.

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest --no-header -q 2>&1 | tail -10
```

Expected: exit 0, summary line like `N passed`. If there are pre-existing failures, **halt and report to the human before starting Task 1** — do not proceed with the migration on a red baseline.

- [ ] **Step 1: Sweep `backend/` for prompt strings**

Run from repo root:

```bash
cd backend && rg -n --type py -e 'PROMPT' -e 'TEMPLATE' -e 'HumanMessage\(' -e 'PromptTemplate' --glob '!__pycache__' --glob '!tests' app/ | sort
```

Also catch f-strings used as prompts (no convention to grep for, so check each `llm.invoke`, `agent_chain.invoke`, `_research_agent_output` call site):

```bash
cd backend && rg -n --type py 'llm[0-9]?\.invoke|agent_chain\.invoke|_research_agent_output|_claude_messages_text' app/
```

Expected: hits for the baseline inventory (§2.1 of spec) plus any in-line prompts in `customer_profile/`, `leads/`, `pipeline/`, `data_sources/`, `profiles/`, `org_auth/`, `graph_chat/`, `health.py`.

- [ ] **Step 2: Classify each location by invocation pattern**

For every match, label one of:
- **simple-invoke** — `llm.invoke([HumanMessage(content=prompt)])` or equivalent direct LLM call. Active model routing applies via `call_with_prompt` (spec §3.5).
- **agent-chain** — `agent_chain.invoke({'input': prompt})` (LangChain ReAct). Observability-only model field in v1.
- **custom-dispatch** — wraps Groq+Claude (signals' `_research_agent_output`) or direct `requests.post(anthropic)`. Observability-only model field in v1.
- **langchain-prompt-template** — passed into `GraphCypherQAChain.from_llm(cypher_prompt=..., qa_prompt=...)` (Cypher/QA in `llm_config.py`). Uses `as_langchain()` adapter; observability is best-effort and may be skipped if no Mongo write exists at the call site.

- [ ] **Step 3: Write `docs/prompt-inventory.md`**

Use this exact structure (one row per prompt location):

```markdown
# Prompt inventory — Phase 0 audit

**Date:** YYYY-MM-DD
**Author:** [name]
**Purpose:** Authoritative list of every prompt string in `backend/`. Input for plan-13 Phase 1/2.

## Table

| ID | Location | LOC | Current shape | Invocation pattern | Consumers (call sites) | Notes |
|---|---|---:|---|---|---|---|
| P-001 | `app/services/market_research/prompts.py:RESEARCH_MARKET_1_TEMPLATE` | 718 (file) | Python constant, `.format()`-substituted | agent-chain | `market_research/orchestrator.py:research_market_1` | — |
| P-002 | `app/services/icp/prompts.py:ICP_GENERATOR_TEMPLATE` | 383 (file) | Python constant, `.format()`-substituted | agent-chain | `icp/orchestrator.py:ICP_generator` | retry with appended directive on empty result |
| ... | | | | | | |
| P-NNN | `app/services/health.py:10` | 1 | inline f-string-free | simple-invoke | `health.py:probe_llm` | candidate "intentionally deferred" (ROI ~zero) |

## Counts

- Total locations: N
- By pattern: simple-invoke=A, agent-chain=B, custom-dispatch=C, langchain-prompt-template=D
- By service: icp=5, signals=7, market_research=5, llm_config=4, market_scoring=1, health=1, [others discovered]=K

## `call_with_prompt` scope confirmation

Helper covers simple-invoke pattern (`llm.invoke([HumanMessage(content=...)])` shape).
Audit confirms scope is sufficient — no additional patterns warrant their own helper.
[If false, list any additional patterns + recommendation.]

## Cross-service prompt imports

None observed / [list any cross-service `from <other_service>.prompts import ...`].
This confirms service-level migration units (spec §5).

## Recommended migration order

Per spec §4 Phase 2, with audit confirmation:

1. `icp/` — mechanical, exercises base infrastructure
2. `signals/` — exercises includes + conditionals
3. `market_research/` — volume case
4. `llm_config/` — LangChain interop
5. `market_scoring/` — single inline prompt
6. [audit-surfaced services, if any]
```

- [ ] **Step 4: Verify audit completeness**

Cross-check the inventory against the spec's §2.1 baseline:
- 5 prompts in `market_research/prompts.py`
- 5 prompts in `icp/prompts.py`
- 7 prompts in `signals/prompts.py`
- 4 LangChain prompts (`Cypher_gen_prompt`, `Cypher_gen_prompt2`, `qa_prompt_template`, `qa_prompt_template2`) + the shared `_CYPHER_BASE` and `_QA_BASE` blocks they compose from
- `market_scoring/orchestrator.py:282-325` `score_single_lead_against_market` inline f-string
- `health.py:10` `probe_llm` smoke-test prompt

The audit must equal-or-exceed this baseline. Any *missing* baseline item is a bug in the audit. Any *additional* item is expected (the spec assumes the audit surfaces extras).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/prompt-inventory.md
git commit -m "docs(prompts): add Phase 0 prompt inventory audit"
```

---

# Phase 1 — Infrastructure

> **Commit count:** Spec §4 Phase 1 says "3-4 commits"; this plan decomposes into 6 (Tasks 2-7). The split happens at the `app/core/prompts.py` boundary: Task 2 (dataclasses + errors), Task 3 (boot + source-expansion), Task 4 (render + as_langchain). The decomposition follows TDD discipline (one red→green→commit cycle per concern) and CLAUDE.md's "prefer small, frequent commits" guidance. The intent of the spec's "3-4" estimate is preserved — landing the loader, the partials, the fixture infra, and the helper as four distinguishable phases — just rendered as one commit per discrete step within the loader.

## Task 2: Add `jinja2>=3.1` + scaffold `app/core/prompts.py` core types

**Goal:** Land the loader module with dataclasses, error types, and `prompt_meta_from()` helper — but no boot/render logic yet. Tests cover the types only. Module is importable but does nothing.

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/core/prompts.py`
- Create: `backend/tests/unit/test_prompts_loader.py`

- [ ] **Step 1: Add `jinja2>=3.1` to requirements**

Edit `backend/requirements.txt`. Add line after `langchain-classic`:

```
jinja2>=3.1
```

- [ ] **Step 2: Install the new dep locally**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pip install -r requirements.txt
```

Expected: `jinja2` either already installed (transitive) or freshly pulled. Exit 0.

- [ ] **Step 3: Write failing test for dataclasses + error types**

Create `backend/tests/unit/test_prompts_loader.py`:

```python
"""Loader/registry/render unit tests.

Patch `app.core.prompts._registry` between test cases — `init_registry()`
sets the module-level singleton, and tests pointing at different tmp_path
roots must not bleed state. See spec §3.3 "Double-call behavior" — silent
replacement is the v1 contract; tests rely on it.
"""
import pytest

from app.core.prompts import (
    PromptConfig,
    RenderedPrompt,
    PromptError,
    PromptNotFound,
    MissingInputs,
    UnknownInputs,
    BootFailure,
    RenderError,
    UnknownModelError,
    FailureDetail,
    prompt_meta_from,
)


def test_promptconfig_is_frozen():
    cfg = PromptConfig(
        version="1.0.0",
        model="some-model",
        temperature=0.0,
        max_tokens=4000,
        response_format="json",
        timeout_s=120,
    )
    with pytest.raises((AttributeError, Exception)):
        cfg.model = "other"  # frozen dataclass


def test_rendered_prompt_carries_meta_fields():
    cfg = PromptConfig(
        version="1.0.0",
        model="m",
        temperature=0.0,
        max_tokens=10,
        response_format="json",
        timeout_s=60,
    )
    from datetime import datetime, timezone
    rp = RenderedPrompt(
        name="x",
        version="1.0.0",
        content_hash="hash",
        render_inputs_hash="ihash",
        body="body",
        rendered_at=datetime.now(timezone.utc),
        config=cfg,
    )
    assert rp.name == "x"
    assert rp.version == "1.0.0"
    assert rp.config is cfg


def test_all_error_types_subclass_prompterror():
    assert issubclass(PromptNotFound, PromptError)
    assert issubclass(MissingInputs, PromptError)
    assert issubclass(UnknownInputs, PromptError)
    assert issubclass(BootFailure, PromptError)
    assert issubclass(RenderError, PromptError)
    assert issubclass(UnknownModelError, PromptError)


def test_bootfailure_aggregates_failures():
    failures = [
        FailureDetail(file="a.md.j2", error="bad yaml"),
        FailureDetail(file="b.md.j2", error="missing model"),
    ]
    err = BootFailure(failures=failures)
    assert err.failures == failures
    assert "a.md.j2" in str(err)
    assert "b.md.j2" in str(err)


def testprompt_meta_from_extracts_six_fields():
    cfg = PromptConfig(
        version="1.2.3",
        model="qwen",
        temperature=0.0,
        max_tokens=10,
        response_format="json",
        timeout_s=30,
    )
    from datetime import datetime, timezone
    now = datetime(2026, 5, 25, 12, 0, 0, tzinfo=timezone.utc)
    rp = RenderedPrompt(
        name="x",
        version="1.2.3",
        content_hash="ch",
        render_inputs_hash="rih",
        body="body",
        rendered_at=now,
        config=cfg,
    )
    meta = prompt_meta_from(rp)
    assert meta == {
        "name": "x",
        "version": "1.2.3",
        "content_hash": "ch",
        "render_inputs_hash": "rih",
        "model": "qwen",
        "rendered_at": now,
    }
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_prompts_loader.py -v
```

Expected: `ImportError: cannot import name 'PromptConfig' from 'app.core.prompts'` (module doesn't exist yet).

- [ ] **Step 5: Implement dataclasses + error types in `app/core/prompts.py`**

Create `backend/app/core/prompts.py` with this scaffold (boot/render bodies stay stub for now):

```python
"""Prompt management — loader/registry, render, observability.

Public API:
  - PromptConfig, RenderedPrompt, FailureDetail (dataclasses)
  - PromptError + subclasses (PromptNotFound, MissingInputs, UnknownInputs,
    BootFailure, RenderError, UnknownModelError)
  - init_registry(root=...) — populate the module-level _registry singleton
  - render(name, **inputs), get_config(name), list_prompts(), as_langchain(name)
  - prompt_meta_from(rendered) — shared observability sub-doc shape

Boot is invoked from app.main.lifespan; module-level wrappers raise if accessed
before init_registry().

See specs/13-prompt-management-design.md for the design contract.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


# Module-relative default — resolves to backend/prompts/ regardless of CWD.
_PROMPTS_ROOT = Path(__file__).resolve().parent.parent.parent / "prompts"


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PromptConfig:
    version: str
    model: str
    temperature: float
    max_tokens: int
    response_format: str  # "json" | "text"
    timeout_s: int


@dataclass(frozen=True)
class RenderedPrompt:
    name: str
    version: str
    content_hash: str
    render_inputs_hash: str
    body: str
    rendered_at: datetime
    config: PromptConfig


@dataclass(frozen=True)
class FailureDetail:
    file: str
    error: str


# ---------------------------------------------------------------------------
# Error types
# ---------------------------------------------------------------------------


class PromptError(Exception):
    pass


class PromptNotFound(PromptError):
    def __init__(self, name: str):
        super().__init__(f"Prompt not found: {name}")
        self.name = name


class MissingInputs(PromptError):
    def __init__(self, name: str, missing: set[str]):
        super().__init__(f"Prompt {name!r} missing inputs: {sorted(missing)}")
        self.name = name
        self.missing = missing


class UnknownInputs(PromptError):
    def __init__(self, name: str, unknown: set[str]):
        super().__init__(f"Prompt {name!r} received unknown inputs: {sorted(unknown)}")
        self.name = name
        self.unknown = unknown


class BootFailure(PromptError):
    def __init__(self, failures: list[FailureDetail]):
        msg = "Prompt registry boot failed:\n" + "\n".join(
            f"  - {f.file}: {f.error}" for f in failures
        )
        super().__init__(msg)
        self.failures = failures


class RenderError(PromptError):
    def __init__(self, name: str, cause: Exception):
        super().__init__(f"Render error for prompt {name!r}: {cause}")
        self.name = name
        self.cause = cause


class UnknownModelError(PromptError):
    def __init__(self, model_name: str):
        super().__init__(f"Unknown model: {model_name!r} — register via _llm_helpers.register_llm()")
        self.model_name = model_name


# ---------------------------------------------------------------------------
# Observability helper (used by both call_with_prompt and manual call sites)
# ---------------------------------------------------------------------------


def prompt_meta_from(rendered: RenderedPrompt) -> dict[str, Any]:
    """Single source of truth for the prompt_meta sub-doc shape.

    Reads rendered_at from the RenderedPrompt (captured at render time inside
    render(), not at LLM-completion time — see spec §3.3 render lifecycle step 5).
    """
    return {
        "name": rendered.name,
        "version": rendered.version,
        "content_hash": rendered.content_hash,
        "render_inputs_hash": rendered.render_inputs_hash,
        "model": rendered.config.model,
        "rendered_at": rendered.rendered_at,
    }


# ---------------------------------------------------------------------------
# Boot / render — implemented in Task 3 + Task 4
# ---------------------------------------------------------------------------


_registry: "Registry | None" = None


class Registry:
    """Populated by init_registry(). Implementation lands in Task 3."""
    pass


def init_registry(root: Path = _PROMPTS_ROOT) -> Registry:
    """Stub — full implementation in Task 3."""
    raise NotImplementedError("init_registry implementation lands in Task 3")


def render(name: str, **inputs: Any) -> RenderedPrompt:
    """Stub — full implementation in Task 4."""
    raise NotImplementedError("render implementation lands in Task 4")


def get_config(name: str) -> PromptConfig:
    """Stub — full implementation in Task 4."""
    raise NotImplementedError("get_config implementation lands in Task 4")


def list_prompts() -> list[dict[str, Any]]:
    """Stub — full implementation in Task 4."""
    raise NotImplementedError("list_prompts implementation lands in Task 4")


def as_langchain(name: str):
    """Stub — full implementation in Task 4."""
    raise NotImplementedError("as_langchain implementation lands in Task 4")
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_prompts_loader.py -v
```

Expected: 5 tests pass (the ones written in Step 3). PASS.

- [ ] **Step 7: Verify no other tests regressed**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest -x --no-header -q 2>&1 | tail -30
```

Expected: full suite still green. The new module is importable but only its dataclasses/errors are exercised.

- [ ] **Step 8: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/requirements.txt backend/app/core/prompts.py backend/tests/unit/test_prompts_loader.py
git commit -m "feat(be): scaffold app/core/prompts.py dataclasses + error types"
```

---

## Task 3: Implement `init_registry()` + source-expansion algorithm

**Goal:** Replace the boot stub with the real implementation: directory walk, front-matter parse, defaults merge, AST input-validation, source-expansion + content-hash, registry construction. Tests use synthetic prompts written to `tmp_path` — no production prompts exist yet.

**Files:**
- Modify: `backend/app/core/prompts.py`
- Modify: `backend/tests/unit/test_prompts_loader.py`

- [ ] **Step 1: Write failing tests for boot-time validation (single file)**

Append to `backend/tests/unit/test_prompts_loader.py`:

```python
# ---------------------------------------------------------------------------
# Boot lifecycle tests — synthetic prompts via tmp_path
# ---------------------------------------------------------------------------

import textwrap
from pathlib import Path

from app.core.prompts import init_registry, render, get_config, list_prompts


def _write_defaults(root: Path) -> None:
    (root / "_shared").mkdir(parents=True, exist_ok=True)
    (root / "_shared" / "defaults.yaml").write_text(textwrap.dedent("""
        temperature: 0.0
        max_tokens: 4000
        timeout_s: 120
    """).lstrip())


def _write_prompt(root: Path, relpath: str, frontmatter: dict, body: str) -> None:
    import yaml
    file = root / relpath
    file.parent.mkdir(parents=True, exist_ok=True)
    fm = "---\n" + yaml.safe_dump(frontmatter, sort_keys=False) + "---\n"
    file.write_text(fm + body)


def test_boot_fails_when_prompts_root_missing(tmp_path):
    nonexistent = tmp_path / "does_not_exist"
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=nonexistent)
    assert "prompts root" in str(exc_info.value) or "not found" in str(exc_info.value)


def test_boot_fails_when_shared_dir_missing(tmp_path):
    (tmp_path / "icp").mkdir()
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    assert "_shared" in str(exc_info.value)


def test_boot_fails_when_defaults_yaml_missing(tmp_path):
    (tmp_path / "_shared").mkdir()
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    assert "defaults.yaml" in str(exc_info.value)


def test_boot_succeeds_with_only_shared_dir(tmp_path):
    _write_defaults(tmp_path)
    reg = init_registry(root=tmp_path)
    assert reg is not None
    # Module-level singleton populated.
    from app.core import prompts as prompts_mod
    assert prompts_mod._registry is reg
    # No callable prompts registered yet.
    assert list_prompts() == []


def test_boot_registers_single_valid_prompt(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/generator.md.j2",
        frontmatter={
            "name": "generator",
            "version": "1.0.0",
            "description": "Test prompt",
            "model": "test-model",
            "response_format": "json",
            "inputs": ["pre_data"],
        },
        body="Hello {{ pre_data }}\n",
    )
    init_registry(root=tmp_path)
    listed = list_prompts()
    assert len(listed) == 1
    assert listed[0]["name"] == "generator"
    assert listed[0]["version"] == "1.0.0"
    assert listed[0]["model"] == "test-model"
    assert listed[0]["response_format"] == "json"


def test_boot_aggregates_multiple_failures(tmp_path):
    _write_defaults(tmp_path)
    # Missing model
    _write_prompt(
        tmp_path, "icp/bad1.md.j2",
        frontmatter={
            "name": "bad1", "version": "1.0.0", "description": "x",
            "response_format": "json", "inputs": [],
        },
        body="x",
    )
    # Filename stem != name
    _write_prompt(
        tmp_path, "icp/bad2.md.j2",
        frontmatter={
            "name": "wrong_stem", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": [],
        },
        body="x",
    )
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    failures = exc_info.value.failures
    assert len(failures) == 2
    assert any("bad1" in f.file for f in failures)
    assert any("bad2" in f.file for f in failures)


def test_boot_rejects_name_collision(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/dup.md.j2",
        frontmatter={
            "name": "dup", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": [],
        },
        body="x",
    )
    _write_prompt(
        tmp_path, "signals/dup.md.j2",
        frontmatter={
            "name": "dup", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": [],
        },
        body="x",
    )
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    assert any("dup" in f.error or "collision" in f.error.lower() for f in exc_info.value.failures)


def test_boot_rejects_undeclared_input_reference(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/x.md.j2",
        frontmatter={
            "name": "x", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": ["a"],
        },
        body="{{ a }} {{ b }}",  # b is not declared
    )
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    assert any("b" in f.error for f in exc_info.value.failures)


def test_boot_rejects_partial_in_shared_as_callable(tmp_path):
    _write_defaults(tmp_path)
    # Partial in _shared/ — must NOT be callable via render().
    (tmp_path / "_shared" / "x.md.j2").write_text(
        "---\nname: x\nversion: 1.0.0\ndescription: partial\n---\nhi\n"
    )
    init_registry(root=tmp_path)
    assert list_prompts() == []  # partial NOT registered as callable


def test_boot_rejects_filename_stem_mismatch(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/actual_filename.md.j2",
        frontmatter={
            "name": "different_name", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": [],
        },
        body="x",
    )
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    assert any("filename" in f.error.lower() or "stem" in f.error.lower() for f in exc_info.value.failures)


def test_boot_merges_defaults(tmp_path):
    _write_defaults(tmp_path)  # temperature=0.0, max_tokens=4000, timeout_s=120
    _write_prompt(
        tmp_path, "icp/x.md.j2",
        frontmatter={
            "name": "x", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": [],
            "temperature": 0.7,  # overrides default
        },
        body="hi",
    )
    init_registry(root=tmp_path)
    cfg = get_config("x")
    assert cfg.temperature == 0.7    # overridden
    assert cfg.max_tokens == 4000    # inherited
    assert cfg.timeout_s == 120      # inherited
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_prompts_loader.py -v
```

Expected: the new tests fail with `NotImplementedError: init_registry implementation lands in Task 3`.

- [ ] **Step 3: Implement `init_registry()` + Registry + source-expansion in `app/core/prompts.py`**

Replace the stubbed section of `backend/app/core/prompts.py` with the full implementation. Add these imports at the top:

```python
import hashlib
import re
import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined, meta
```

Then replace the stub `Registry` / `init_registry` block with:

```python
# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _RegistryEntry:
    config: PromptConfig
    description: str
    template_name: str        # path relative to root, e.g. "icp/generator.md.j2"
    declared_inputs: frozenset[str]
    content_hash: str
    body_source_expanded: str  # for as_langchain() — partials inlined; {% if %} preserved


class Registry:
    def __init__(self, entries: dict[str, _RegistryEntry], env: Environment, root: Path):
        self._entries = entries
        self._env = env
        self._root = root

    def get(self, name: str) -> _RegistryEntry:
        if name not in self._entries:
            raise PromptNotFound(name)
        return self._entries[name]

    def list(self) -> list[dict[str, Any]]:
        return [
            {
                "name": name,
                "version": entry.config.version,
                "description": entry.description,
                "model": entry.config.model,
                "response_format": entry.config.response_format,
            }
            for name, entry in sorted(self._entries.items())
        ]

    @property
    def env(self) -> Environment:
        return self._env

    @property
    def root(self) -> Path:
        return self._root


# ---------------------------------------------------------------------------
# Front-matter parsing
# ---------------------------------------------------------------------------

_FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n(.*)\Z", re.DOTALL)


def _strip_bom(text: str) -> str:
    return text[1:] if text.startswith("﻿") else text


def _parse_file(path: Path) -> tuple[dict, str]:
    """Return (front_matter_dict, body_text). Raises ValueError on malformed input."""
    try:
        raw = _strip_bom(path.read_text(encoding="utf-8"))
    except UnicodeDecodeError as e:
        raise ValueError(f"UTF-8 decode failed: {e}") from e
    m = _FRONTMATTER_RE.match(raw)
    if not m:
        raise ValueError("malformed front-matter (must be `---`-fenced YAML at file head)")
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError as e:
        raise ValueError(f"YAML parse error: {e}") from e
    if not isinstance(fm, dict):
        raise ValueError("front-matter must be a YAML mapping")
    return fm, m.group(2)


# ---------------------------------------------------------------------------
# Front-matter validation
# ---------------------------------------------------------------------------

_REQUIRED_FIELDS_CALLABLE = {"name", "version", "description", "model", "response_format", "inputs"}
_REQUIRED_FIELDS_PARTIAL = {"name", "version", "description"}
_RESPONSE_FORMATS = {"json", "text"}
_SEMVER_RE = re.compile(r"\A\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.\-]+)?\Z")


def _validate_callable_frontmatter(fm: dict, defaults: dict, file_relpath: str, expected_stem: str) -> PromptConfig:
    merged = {**defaults, **fm}
    missing = _REQUIRED_FIELDS_CALLABLE - merged.keys()
    if missing:
        raise ValueError(f"missing required fields: {sorted(missing)}")
    if not _SEMVER_RE.match(str(merged["version"])):
        raise ValueError(f"version not semver: {merged['version']!r}")
    if merged["response_format"] not in _RESPONSE_FORMATS:
        raise ValueError(f"response_format must be 'json' or 'text', got {merged['response_format']!r}")
    if merged["name"] != expected_stem:
        raise ValueError(f"front-matter name {merged['name']!r} != filename stem {expected_stem!r}")
    if not isinstance(merged.get("inputs"), list):
        raise ValueError("inputs must be a list")
    return PromptConfig(
        version=str(merged["version"]),
        model=str(merged["model"]),
        temperature=float(merged["temperature"]),
        max_tokens=int(merged["max_tokens"]),
        response_format=str(merged["response_format"]),
        timeout_s=int(merged["timeout_s"]),
    )


# ---------------------------------------------------------------------------
# Source-expansion algorithm (shared by content_hash + as_langchain)
# ---------------------------------------------------------------------------

_INCLUDE_LINE_RE = re.compile(r"^[ \t]*\{%\s*include\s+['\"]([^'\"]+)['\"]\s*%\}[ \t]*\n?", re.MULTILINE)


def _expand_includes(body: str, root: Path, depth: int = 0, max_depth: int = 1) -> str:
    """Textually substitute every {% include 'PATH' %} line with the partial's body.

    Bounded by max_depth (default 1 per spec §3.4). Partial bodies are NOT
    Jinja2-rendered — `{% if %}` / `{{ var }}` markers pass through verbatim
    for the caller's Jinja2 env to evaluate.
    """
    if depth > max_depth:
        raise ValueError(f"include depth {depth} exceeds max ({max_depth})")

    def _sub(m):
        partial_path = root / m.group(1)
        if not partial_path.exists():
            raise ValueError(f"partial not found: {m.group(1)}")
        _, partial_body = _parse_file(partial_path)
        return _expand_includes(partial_body, root, depth=depth + 1, max_depth=max_depth)

    return _INCLUDE_LINE_RE.sub(_sub, body)


def _content_hash(expanded_body: str) -> str:
    return hashlib.sha256(expanded_body.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# init_registry()
# ---------------------------------------------------------------------------


def init_registry(root: Path = _PROMPTS_ROOT) -> Registry:
    """Walk root/, parse every .md.j2, validate, build env, populate registry.

    Raises BootFailure aggregating every per-file failure (not first-hit).
    Sets module-level _registry to the new Registry on success.
    Production code calls this exactly once via app.main.lifespan; tests may
    call it repeatedly with different roots — silent replacement is the v1
    contract (spec §3.3 "Double-call behavior").
    """
    global _registry
    failures: list[FailureDetail] = []

    # Step 0 — pre-flight
    if not root.is_dir():
        raise BootFailure([FailureDetail(file=str(root), error="prompts root not found")])
    if not (root / "_shared").is_dir():
        raise BootFailure([FailureDetail(file=str(root / "_shared"), error="_shared/ not found")])

    # Step 3 — defaults
    defaults_path = root / "_shared" / "defaults.yaml"
    if not defaults_path.is_file():
        raise BootFailure([FailureDetail(file="_shared/defaults.yaml", error="missing required file")])
    try:
        defaults = yaml.safe_load(defaults_path.read_text(encoding="utf-8")) or {}
        if not isinstance(defaults, dict):
            raise ValueError("defaults.yaml must be a YAML mapping")
    except (yaml.YAMLError, ValueError) as e:
        raise BootFailure([FailureDetail(file="_shared/defaults.yaml", error=f"{e}")])

    # Step 1 — walk
    all_files = sorted(root.rglob("*.md.j2"))

    # Step 6 — Jinja env
    env = Environment(
        loader=FileSystemLoader(str(root)),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )

    entries: dict[str, _RegistryEntry] = {}
    seen_names: dict[str, str] = {}  # name -> file relpath (for collision messages)

    for path in all_files:
        relpath = str(path.relative_to(root))
        is_partial = relpath.startswith("_shared/") or relpath.startswith("_shared" + "/")

        try:
            fm, body = _parse_file(path)
        except ValueError as e:
            failures.append(FailureDetail(file=relpath, error=str(e)))
            continue

        if is_partial:
            # Validate minimal partial front-matter; never register as callable.
            for f in _REQUIRED_FIELDS_PARTIAL:
                if f not in fm:
                    failures.append(FailureDetail(file=relpath, error=f"partial missing required field: {f}"))
            continue

        expected_stem = path.stem.removesuffix(".md")  # ".md.j2" → stem is "*.md"
        try:
            config = _validate_callable_frontmatter(fm, defaults, relpath, expected_stem)
        except ValueError as e:
            failures.append(FailureDetail(file=relpath, error=str(e)))
            continue

        name = fm["name"]
        if name in seen_names:
            failures.append(FailureDetail(
                file=relpath,
                error=f"name collision: {name!r} already registered by {seen_names[name]}",
            ))
            continue

        # Step 7 — AST input validation against the source-expanded body
        try:
            expanded_body = _expand_includes(body, root)
        except ValueError as e:
            failures.append(FailureDetail(file=relpath, error=f"include resolution failed: {e}"))
            continue

        try:
            ast = env.parse(expanded_body)
        except Exception as e:
            failures.append(FailureDetail(file=relpath, error=f"Jinja2 parse failed: {e}"))
            continue

        referenced = set(meta.find_undeclared_variables(ast))
        declared = set(fm.get("inputs") or [])
        extra_refs = referenced - declared
        if extra_refs:
            failures.append(FailureDetail(
                file=relpath,
                error=f"undeclared inputs referenced in template: {sorted(extra_refs)}",
            ))
            continue

        # Step 8 — content hash over source-expanded body
        h = _content_hash(expanded_body)

        entries[name] = _RegistryEntry(
            config=config,
            description=str(fm["description"]),
            template_name=relpath,
            declared_inputs=frozenset(declared),
            content_hash=h,
            body_source_expanded=expanded_body,
        )
        seen_names[name] = relpath

    if failures:
        raise BootFailure(failures)

    registry = Registry(entries=entries, env=env, root=root)
    _registry = registry
    return registry
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_prompts_loader.py -v
```

Expected: all boot-lifecycle tests pass. Earlier dataclass tests still pass.

- [ ] **Step 5: Add include-depth + content-hash regression tests**

Append to `backend/tests/unit/test_prompts_loader.py`:

```python
def test_partial_include_resolves_at_boot(tmp_path):
    _write_defaults(tmp_path)
    (tmp_path / "_shared" / "footer.md.j2").write_text(
        "---\nname: footer\nversion: 1.0.0\ndescription: footer partial\n---\nFOOTER {{ x }}\n"
    )
    _write_prompt(
        tmp_path, "icp/main.md.j2",
        frontmatter={
            "name": "main", "version": "1.0.0", "description": "main",
            "model": "m", "response_format": "json", "inputs": ["x"],
        },
        body="MAIN {{ x }}\n{% include '_shared/footer.md.j2' %}\n",
    )
    init_registry(root=tmp_path)
    # Boot succeeds — the partial referenced {{ x }} and parent declared it.


def test_partial_include_rejected_when_parent_does_not_declare_partial_var(tmp_path):
    _write_defaults(tmp_path)
    (tmp_path / "_shared" / "footer.md.j2").write_text(
        "---\nname: footer\nversion: 1.0.0\ndescription: footer partial\n---\nFOOTER {{ x }}\n"
    )
    _write_prompt(
        tmp_path, "icp/main.md.j2",
        frontmatter={
            "name": "main", "version": "1.0.0", "description": "main",
            "model": "m", "response_format": "json", "inputs": [],   # no `x`
        },
        body="MAIN\n{% include '_shared/footer.md.j2' %}\n",
    )
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    assert any("x" in f.error for f in exc_info.value.failures)


def test_include_depth_greater_than_one_rejected(tmp_path):
    _write_defaults(tmp_path)
    (tmp_path / "_shared" / "inner.md.j2").write_text(
        "---\nname: inner\nversion: 1.0.0\ndescription: inner partial\n---\nINNER\n"
    )
    (tmp_path / "_shared" / "outer.md.j2").write_text(
        "---\nname: outer\nversion: 1.0.0\ndescription: outer partial\n---\nOUTER\n{% include '_shared/inner.md.j2' %}\n"
    )
    _write_prompt(
        tmp_path, "icp/main.md.j2",
        frontmatter={
            "name": "main", "version": "1.0.0", "description": "main",
            "model": "m", "response_format": "json", "inputs": [],
        },
        body="{% include '_shared/outer.md.j2' %}\n",
    )
    with pytest.raises(BootFailure) as exc_info:
        init_registry(root=tmp_path)
    assert any("depth" in f.error.lower() for f in exc_info.value.failures)


def test_content_hash_is_stable_across_calls(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/x.md.j2",
        frontmatter={
            "name": "x", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": [],
        },
        body="STATIC BODY\n",
    )
    init_registry(root=tmp_path)
    from app.core import prompts as prompts_mod
    h1 = prompts_mod._registry.get("x").content_hash
    init_registry(root=tmp_path)
    h2 = prompts_mod._registry.get("x").content_hash
    assert h1 == h2


def test_content_hash_changes_when_partial_body_edits(tmp_path):
    _write_defaults(tmp_path)
    (tmp_path / "_shared" / "p.md.j2").write_text(
        "---\nname: p\nversion: 1.0.0\ndescription: p\n---\nORIGINAL\n"
    )
    _write_prompt(
        tmp_path, "icp/x.md.j2",
        frontmatter={
            "name": "x", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": [],
        },
        body="HEAD\n{% include '_shared/p.md.j2' %}\nTAIL\n",
    )
    init_registry(root=tmp_path)
    from app.core import prompts as prompts_mod
    h_before = prompts_mod._registry.get("x").content_hash

    (tmp_path / "_shared" / "p.md.j2").write_text(
        "---\nname: p\nversion: 1.0.0\ndescription: p\n---\nEDITED\n"
    )
    init_registry(root=tmp_path)
    h_after = prompts_mod._registry.get("x").content_hash

    assert h_before != h_after
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_prompts_loader.py -v
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/core/prompts.py backend/tests/unit/test_prompts_loader.py
git commit -m "feat(be): implement init_registry + source-expansion algorithm"
```

---

## Task 4: Implement `render()`, `as_langchain()`, and module wrappers

**Goal:** Land the render lifecycle (inputs check, Jinja render, hashes, RenderedPrompt) and the LangChain adapter. Module-level `render` / `get_config` / `list_prompts` / `as_langchain` delegate to the singleton.

**Files:**
- Modify: `backend/app/core/prompts.py`
- Modify: `backend/tests/unit/test_prompts_loader.py`

- [ ] **Step 1: Write failing tests for render lifecycle**

Append to `backend/tests/unit/test_prompts_loader.py`:

```python
# ---------------------------------------------------------------------------
# Render lifecycle
# ---------------------------------------------------------------------------

import json


def test_render_returns_rendered_prompt(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/greet.md.j2",
        frontmatter={
            "name": "greet", "version": "1.0.0", "description": "greet",
            "model": "m", "response_format": "json", "inputs": ["who"],
        },
        body="Hello {{ who }}\n",
    )
    init_registry(root=tmp_path)
    rp = render("greet", who="world")
    assert isinstance(rp, RenderedPrompt)
    assert rp.body == "Hello world\n"
    assert rp.name == "greet"
    assert rp.version == "1.0.0"
    assert rp.config.model == "m"
    assert rp.rendered_at is not None


def test_render_missing_input_raises(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/x.md.j2",
        frontmatter={
            "name": "x", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": ["a", "b"],
        },
        body="{{ a }} {{ b }}",
    )
    init_registry(root=tmp_path)
    with pytest.raises(MissingInputs) as exc_info:
        render("x", a="hi")
    assert "b" in exc_info.value.missing


def test_render_unknown_input_raises(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/x.md.j2",
        frontmatter={
            "name": "x", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": ["a"],
        },
        body="{{ a }}",
    )
    init_registry(root=tmp_path)
    with pytest.raises(UnknownInputs) as exc_info:
        render("x", a="hi", b="extra")
    assert "b" in exc_info.value.unknown


def test_render_not_found(tmp_path):
    _write_defaults(tmp_path)
    init_registry(root=tmp_path)
    with pytest.raises(PromptNotFound):
        render("does_not_exist")


def test_render_inputs_hash_canonical(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/x.md.j2",
        frontmatter={
            "name": "x", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "json", "inputs": ["a", "b"],
        },
        body="{{ a }} {{ b }}",
    )
    init_registry(root=tmp_path)
    rp1 = render("x", a="1", b="2")
    rp2 = render("x", b="2", a="1")  # different keyword order
    assert rp1.render_inputs_hash == rp2.render_inputs_hash


def test_get_config_resolves_without_rendering(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "icp/x.md.j2",
        frontmatter={
            "name": "x", "version": "2.1.0", "description": "x",
            "model": "qwen", "response_format": "json", "inputs": ["a"],
        },
        body="{{ a }}",
    )
    init_registry(root=tmp_path)
    cfg = get_config("x")
    assert cfg.version == "2.1.0"
    assert cfg.model == "qwen"


def test_module_wrappers_error_before_init():
    import app.core.prompts as prompts_mod
    prompts_mod._registry = None  # reset
    with pytest.raises(RuntimeError, match="init_registry not called"):
        render("anything")
    with pytest.raises(RuntimeError, match="init_registry not called"):
        get_config("anything")
    with pytest.raises(RuntimeError, match="init_registry not called"):
        list_prompts()


# ---------------------------------------------------------------------------
# as_langchain — source-expanded template body for LangChain consumers
# ---------------------------------------------------------------------------

def test_as_langchain_returns_prompttemplate(tmp_path):
    _write_defaults(tmp_path)
    _write_prompt(
        tmp_path, "llm_config/cypher.md.j2",
        frontmatter={
            "name": "cypher", "version": "1.0.0", "description": "cypher",
            "model": "m", "response_format": "text", "inputs": ["schema", "question"],
        },
        body="Schema: {{ schema }}\nQuestion: {{ question }}\n",
    )
    init_registry(root=tmp_path)
    pt = as_langchain("cypher")
    from langchain_core.prompts import PromptTemplate
    assert isinstance(pt, PromptTemplate)
    rendered = pt.format(schema="S", question="Q")
    assert "Schema: S" in rendered
    assert "Question: Q" in rendered


def test_as_langchain_parity_with_render(tmp_path):
    _write_defaults(tmp_path)
    (tmp_path / "_shared" / "footer.md.j2").write_text(
        "---\nname: footer\nversion: 1.0.0\ndescription: footer partial\n---\nEND OF PROMPT\n"
    )
    _write_prompt(
        tmp_path, "llm_config/x.md.j2",
        frontmatter={
            "name": "x", "version": "1.0.0", "description": "x",
            "model": "m", "response_format": "text", "inputs": ["q"],
        },
        body="Question: {{ q }}\n{% include '_shared/footer.md.j2' %}\n",
    )
    init_registry(root=tmp_path)
    rp = render("x", q="hello")
    lc = as_langchain("x").format(q="hello")
    assert rp.body == lc
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_prompts_loader.py -v
```

Expected: new render/as_langchain tests fail with `NotImplementedError`.

- [ ] **Step 3: Implement render + module wrappers + as_langchain**

Replace the stubbed `render` / `get_config` / `list_prompts` / `as_langchain` block at the bottom of `backend/app/core/prompts.py` with:

```python
# ---------------------------------------------------------------------------
# Render lifecycle
# ---------------------------------------------------------------------------

import json as _json
from datetime import datetime, timezone

def _require_registry() -> Registry:
    if _registry is None:
        raise RuntimeError("init_registry not called")
    return _registry


def render(name: str, **inputs: Any) -> RenderedPrompt:
    """Render a prompt by name. See spec §3.3 render lifecycle.

    Pure computation (no I/O); safe to call from async handlers.
    """
    registry = _require_registry()
    entry = registry.get(name)  # raises PromptNotFound

    provided = set(inputs.keys())
    extras = provided - entry.declared_inputs
    if extras:
        raise UnknownInputs(name, extras)
    missing = entry.declared_inputs - provided
    if missing:
        raise MissingInputs(name, missing)

    try:
        template = registry.env.get_template(entry.template_name)
        body = template.render(**inputs)
    except Exception as e:
        raise RenderError(name, e) from e

    render_inputs_hash = hashlib.sha256(
        _json.dumps(inputs, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()
    rendered_at = datetime.now(timezone.utc)

    return RenderedPrompt(
        name=name,
        version=entry.config.version,
        content_hash=entry.content_hash,
        render_inputs_hash=render_inputs_hash,
        body=body,
        rendered_at=rendered_at,
        config=entry.config,
    )


def get_config(name: str) -> PromptConfig:
    return _require_registry().get(name).config


def list_prompts() -> list[dict[str, Any]]:
    return _require_registry().list()


def as_langchain(name: str):
    """Return a langchain PromptTemplate built from the source-expanded body.

    LangChain's Jinja2 env (no StrictUndefined) substitutes input variables at
    chain execution time. Boot-time AST validation already verified that every
    {{ var }} reference in the parent and every included partial appears in
    the parent's `inputs:` declaration, so runtime substitution is safe.
    """
    from langchain_core.prompts import PromptTemplate
    entry = _require_registry().get(name)
    return PromptTemplate.from_template(
        entry.body_source_expanded,
        template_format="jinja2",
    )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_prompts_loader.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite to verify nothing else broke**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest -x --no-header -q 2>&1 | tail -10
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/core/prompts.py backend/tests/unit/test_prompts_loader.py
git commit -m "feat(be): implement prompt render + as_langchain adapter"
```

---

## Task 5: Create `backend/prompts/_shared/` defaults + partials

**Goal:** Land the production `_shared/` directory with `defaults.yaml` and the three shared partials. The directory now exists at the path `init_registry()` will use at lifespan. Registry contains zero callable prompts but partials are includable.

**Files:**
- Create: `backend/prompts/_shared/defaults.yaml`
- Create: `backend/prompts/_shared/response_format_json.md.j2`
- Create: `backend/prompts/_shared/scout_persona.md.j2`
- Create: `backend/prompts/_shared/final_answer_directive.md.j2`

- [ ] **Step 1: Create `defaults.yaml`**

Write `backend/prompts/_shared/defaults.yaml`:

```yaml
temperature: 0.0
max_tokens: 4000
timeout_s: 120
```

Note: no `model:` line. Every callable prompt must declare its own (spec §3.2).

- [ ] **Step 2: Create `response_format_json.md.j2` partial**

Write `backend/prompts/_shared/response_format_json.md.j2`. Extract the JSON-output directive that recurs across signals + market_research + icp prompts:

```jinja
---
name: response_format_json
version: 1.0.0
description: Shared directive — output strict JSON only
---
Give your response as valid JSON in a single line. Do not use markdown or code blocks. Do not escape characters unnecessarily. Just give plain minified JSON. Return ONLY valid JSON, nothing else.
```

- [ ] **Step 3: Create `scout_persona.md.j2` partial**

Write `backend/prompts/_shared/scout_persona.md.j2`. Extract the Scout persona block from `llm_config.py:_QA_BASE`:

```jinja
---
name: scout_persona
version: 1.0.0
description: Shared Scout persona header used by QA prompts
---
You are Scout — a smart, strategic Sales Helper Agent designed to guide users in working effectively with leads and understanding the sales landscape.

You analyze prospect data, engagement history across a timeline, objections raised, blockers, wins, sentiment trends, and all other available context to derive intelligent guidance. You help users understand the behavior, stage, and signals of the lead and how it aligns with broader market patterns.

Your role is to:
- Identify what's working, what's not, and why
- Highlight missed signals or opportunities
- Recommend the next best actions to take with the lead
- Ask insightful follow-up questions to refine your advice
- Be interactive, conversational, and proactive in tone

You are especially skilled at:
- Surfacing red flags or friction points in long timelines
- Spotting high intent or buy-ready signals
- Suggesting tone, channel, and timing strategies
- Offering industry-level insights based on behavior patterns

Always present your answers in a **beautiful, point-wise, well-organized** format.
```

- [ ] **Step 4: Create `final_answer_directive.md.j2` partial**

Write `backend/prompts/_shared/final_answer_directive.md.j2`. Extract the trailing "Final Answer" directive from the ICP and signal prompts:

```jinja
---
name: final_answer_directive
version: 1.0.0
description: Shared trailer — stop after Final Answer
---
When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
```

- [ ] **Step 5: Verify `_shared/` parses cleanly via a manual init_registry call**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python -c "
from pathlib import Path
from app.core.prompts import init_registry, list_prompts
init_registry(root=Path('prompts'))
print('callable prompts:', list_prompts())
"
```

Expected output:

```
callable prompts: []
```

(empty list — only partials in `_shared/`, no callable prompts yet)

- [ ] **Step 6: Run full suite to verify nothing else broke**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest -x --no-header -q 2>&1 | tail -10
```

Expected: green. The new `_shared/` directory exists on disk but lifespan doesn't yet load it (that comes in Task 7); regression should be impossible, but consistency with other Phase 1 tasks' verification cadence matters.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/prompts/_shared/
git commit -m "feat(be): add prompts/_shared/ defaults and partials"
```

---

## Task 6: Test fixture infrastructure (regen script + golden test)

**Goal:** Land the golden-fixture scaffold. `tests/regen_prompt_fixtures.py` exists; `test_prompts_golden.py` exists and parametrizes over `list_prompts()`. No callable prompts yet, so the parametrized test has zero cases (passes vacuously).

**Files:**
- Create: `backend/tests/regen_prompt_fixtures.py`
- Create: `backend/tests/unit/test_prompts_golden.py`
- Create: `backend/tests/fixtures/prompts/_inputs/.gitkeep`
- Create: `backend/tests/fixtures/prompts/rendered/.gitkeep`

- [ ] **Step 1: Create fixture directories**

```bash
mkdir -p /projects/Brewra/brewra-gtm-intelligence/backend/tests/fixtures/prompts/_inputs
mkdir -p /projects/Brewra/brewra-gtm-intelligence/backend/tests/fixtures/prompts/rendered
touch /projects/Brewra/brewra-gtm-intelligence/backend/tests/fixtures/prompts/_inputs/.gitkeep
touch /projects/Brewra/brewra-gtm-intelligence/backend/tests/fixtures/prompts/rendered/.gitkeep
```

- [ ] **Step 2: Write `regen_prompt_fixtures.py`**

Create `backend/tests/regen_prompt_fixtures.py`:

```python
"""Regenerate golden-rendered prompt fixtures.

Usage:
    python tests/regen_prompt_fixtures.py [name | --all]

Reads canonical inputs from tests/fixtures/prompts/_inputs/<name>.json,
calls prompts.render(name, **inputs), writes the rendered body to
tests/fixtures/prompts/rendered/<name>.txt.

If a prompt has no _inputs/<name>.json, scaffolds one with placeholders
(REPLACE_ME values) for the declared inputs — author edits before running again.
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PROMPTS_ROOT = REPO_ROOT / "prompts"
INPUTS_DIR = REPO_ROOT / "tests" / "fixtures" / "prompts" / "_inputs"
RENDERED_DIR = REPO_ROOT / "tests" / "fixtures" / "prompts" / "rendered"


def _ensure_input_skeleton(name: str, declared_inputs: list[str]) -> None:
    p = INPUTS_DIR / f"{name}.json"
    if p.exists():
        return
    skeleton = {key: "REPLACE_ME" for key in declared_inputs}
    p.write_text(json.dumps(skeleton, indent=2) + "\n")
    print(f"[regen] scaffolded {p} — fill in REPLACE_ME values before next run", file=sys.stderr)


def _regen_one(name: str) -> bool:
    """Returns True if regenerated; False if skipped (skeleton just created or REPLACE_ME present)."""
    from app.core.prompts import render, get_config, _require_registry  # noqa
    registry = _require_registry()
    entry = registry.get(name)
    _ensure_input_skeleton(name, sorted(entry.declared_inputs))

    inputs_path = INPUTS_DIR / f"{name}.json"
    inputs = json.loads(inputs_path.read_text())
    if any(v == "REPLACE_ME" for v in inputs.values()):
        print(f"[regen] {name}: skipped (REPLACE_ME values in {inputs_path})", file=sys.stderr)
        return False

    rp = render(name, **inputs)
    out_path = RENDERED_DIR / f"{name}.txt"
    out_path.write_text(rp.body)
    print(f"[regen] wrote {out_path}", file=sys.stderr)
    return True


def main(argv: list[str]) -> int:
    sys.path.insert(0, str(REPO_ROOT))
    from app.core.prompts import init_registry, list_prompts
    init_registry(root=PROMPTS_ROOT)

    if not argv or argv[0] in {"--all", "-a"}:
        names = [p["name"] for p in list_prompts()]
    else:
        names = argv

    if not names:
        print("[regen] no callable prompts registered yet — nothing to do", file=sys.stderr)
        return 0

    regenerated = 0
    for name in names:
        if _regen_one(name):
            regenerated += 1
    print(f"[regen] {regenerated}/{len(names)} fixtures regenerated", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
```

- [ ] **Step 3: Write `test_prompts_golden.py`**

Create `backend/tests/unit/test_prompts_golden.py`:

```python
"""Golden-fixture parity tests — one parametrized case per registered prompt.

If a prompt's rendered body differs from the on-disk fixture, the test fails
with a hint pointing at the regen script. Run:

    python tests/regen_prompt_fixtures.py <name>
    # or
    python tests/regen_prompt_fixtures.py --all

then commit the resulting fixture diff alongside the prompt edit.
"""
import json
from pathlib import Path

import pytest

from app.core.prompts import init_registry, render, list_prompts, as_langchain

REPO_ROOT = Path(__file__).resolve().parent.parent.parent  # backend/
PROMPTS_ROOT = REPO_ROOT / "prompts"
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "prompts"


# Initialize the production registry once at module import time so the
# @parametrize decorator below can read names at COLLECTION time. The
# autouse fixture re-initializes per test to guard against state bleed
# from other test modules (test_prompts_loader.py uses tmp_path roots).
#
# Wrap in try/except so a malformed prompt mid-migration produces a clean
# pytest skip rather than poisoning test discovery for the whole suite.
try:
    init_registry(root=PROMPTS_ROOT)
    _REGISTERED = [p["name"] for p in list_prompts()]
    _COLLECTION_ERROR: str | None = None
except Exception as e:
    _REGISTERED = []
    _COLLECTION_ERROR = f"Prompt registry boot failed during collection: {e!r}"
# LangChain-wrapped prompts (consumed by GraphCypherQAChain in llm_config.py).
# Hardcoded because the four prompts are known and stable. Update if the
# Phase 0 audit surfaces additional GraphCypherQAChain consumers.
_LANGCHAIN_PROMPT_NAMES = [name for name in _REGISTERED if name in {
    "cypher_gen", "cypher_gen_alt", "qa_scout", "qa_scout_alt",
}]


@pytest.fixture(autouse=True)
def _reinit_production_registry():
    """Re-point the module-level _registry at the production prompts root.

    test_prompts_loader.py runs init_registry(root=tmp_path) in its tests
    and doesn't restore. Without this fixture, golden tests that run after
    those would render against the wrong registry. Silent replacement is
    the documented v1 contract (spec §3.3 "Double-call behavior").

    Skip the re-init if collection already failed — the always-run test
    below surfaces that error with a clear message instead.
    """
    if _COLLECTION_ERROR is None:
        init_registry(root=PROMPTS_ROOT)
    yield


def test_prompt_registry_boots():
    """Always-present test (no parametrization). Surfaces collection-time
    boot failures with the loader's aggregated error message — otherwise a
    mid-migration malformed .md.j2 would produce zero parametrized cases
    that silently 'pass' rather than red-failing.
    """
    if _COLLECTION_ERROR is not None:
        pytest.fail(_COLLECTION_ERROR)


@pytest.mark.parametrize("name", _REGISTERED)
def test_golden_render(name):
    inputs_path = FIXTURE_DIR / "_inputs" / f"{name}.json"
    rendered_path = FIXTURE_DIR / "rendered" / f"{name}.txt"
    assert inputs_path.exists(), (
        f"Missing canonical inputs for prompt {name!r}. "
        f"Run: python tests/regen_prompt_fixtures.py {name}"
    )
    assert rendered_path.exists(), (
        f"Missing golden render for prompt {name!r}. "
        f"Run: python tests/regen_prompt_fixtures.py {name}"
    )
    inputs = json.loads(inputs_path.read_text())
    rp = render(name, **inputs)
    expected = rendered_path.read_text()
    assert rp.body == expected, (
        f"Prompt {name!r} rendered body differs from golden fixture.\n"
        f"If intentional, regenerate with:\n"
        f"    python tests/regen_prompt_fixtures.py {name}"
    )


@pytest.mark.parametrize("name", _LANGCHAIN_PROMPT_NAMES)
def test_as_langchain_byte_equal_to_render(name):
    """LangChain parity — as_langchain(name).format(**inputs) must equal render(name, **inputs).body.

    Guards the source-expansion algorithm against LangChain Jinja2 env drift.
    """
    inputs_path = FIXTURE_DIR / "_inputs" / f"{name}.json"
    if not inputs_path.exists():
        pytest.skip(f"no canonical inputs for {name}")
    inputs = json.loads(inputs_path.read_text())
    rp = render(name, **inputs)
    lc = as_langchain(name).format(**inputs)
    assert rp.body == lc, f"LangChain parity drift for prompt {name!r}"
```

- [ ] **Step 4: Run the golden test — must pass vacuously**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_prompts_golden.py -v
```

Expected: zero parametrized cases (no callable prompts registered yet); pytest reports `0 tests collected` or `no tests ran`, exit 0.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/tests/regen_prompt_fixtures.py backend/tests/unit/test_prompts_golden.py backend/tests/fixtures/prompts/
git commit -m "feat(be): add prompt fixture infra + golden-render test"
```

---

## Task 7: LLM-client factory + `call_with_prompt` + wire `init_registry()` into lifespan

**Goal:** Land the simple-invoke helper. `_llm_helpers.py` gains `register_llm` / `_get_llm_for_model` / `call_with_prompt`; `build_llm_config()` registers Qwen and Groq LLMs in the factory; `app/main.lifespan` calls `init_registry()` and stashes the result on `app.state.prompts`.

**Files:**
- Modify: `backend/app/services/_llm_helpers.py`
- Modify: `backend/app/core/llm_config.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/unit/test_llm_helpers.py`
- Modify: `backend/tests/test_lifespan.py`

- [ ] **Step 1: Write failing test for `register_llm` / `_get_llm_for_model`**

Append to `backend/tests/unit/test_llm_helpers.py`. Add an `isolated_llm_factory` fixture that snapshots/restores `_LLM_FACTORY` and `_LLM_CACHE` so tests don't pollute production-registered LLMs from prior fixtures (e.g. a build_llm_config call):

```python
import pytest


@pytest.fixture
def isolated_llm_factory():
    """Snapshot/restore _LLM_FACTORY and _LLM_CACHE for tests that mutate them.

    Without this, a test that clears the factory leaves subsequent tests
    without the Qwen/Groq builders that build_llm_config() registered.
    """
    from app.services import _llm_helpers
    factory_snapshot = dict(_llm_helpers._LLM_FACTORY)
    cache_snapshot = dict(_llm_helpers._LLM_CACHE)
    _llm_helpers._LLM_FACTORY.clear()
    _llm_helpers._LLM_CACHE.clear()
    yield _llm_helpers
    _llm_helpers._LLM_FACTORY.clear()
    _llm_helpers._LLM_FACTORY.update(factory_snapshot)
    _llm_helpers._LLM_CACHE.clear()
    _llm_helpers._LLM_CACHE.update(cache_snapshot)


def test_register_llm_and_get_llm_for_model(isolated_llm_factory):
    from app.core.prompts import UnknownModelError
    _llm_helpers = isolated_llm_factory

    built_count = {"n": 0}

    def builder():
        built_count["n"] += 1
        return object()

    _llm_helpers.register_llm("test-model", builder)
    llm1 = _llm_helpers._get_llm_for_model("test-model")
    llm2 = _llm_helpers._get_llm_for_model("test-model")
    assert llm1 is llm2          # cached
    assert built_count["n"] == 1  # builder called once

    with pytest.raises(UnknownModelError):
        _llm_helpers._get_llm_for_model("not-registered")
```

- [ ] **Step 2: Write failing test for `call_with_prompt`**

Continue appending to `backend/tests/unit/test_llm_helpers.py`:

```python
def test_call_with_prompt_renders_and_invokes(tmp_path, isolated_llm_factory):
    """call_with_prompt should: render via prompts.render(), resolve LLM by
    front-matter model, invoke([HumanMessage(content=body)]), return (response, prompt_meta).
    """
    from app.core import prompts as prompts_mod
    import yaml
    _llm_helpers = isolated_llm_factory

    # Build a synthetic prompts tree.
    (tmp_path / "_shared").mkdir()
    (tmp_path / "_shared" / "defaults.yaml").write_text("temperature: 0.0\nmax_tokens: 100\ntimeout_s: 30\n")
    prompt_dir = tmp_path / "svc"
    prompt_dir.mkdir()
    (prompt_dir / "p.md.j2").write_text(
        "---\n" +
        yaml.safe_dump({
            "name": "p", "version": "1.0.0", "description": "test",
            "model": "fake-llm", "response_format": "json", "inputs": ["x"],
        }) +
        "---\n" +
        "Body: {{ x }}\n"
    )
    prompts_mod.init_registry(root=tmp_path)

    # Register a fake LLM (fixture already cleared the factory).
    captured = {}
    class FakeResponse:
        content = "fake response"
    class FakeLLM:
        def invoke(self, messages):
            captured["messages"] = messages
            return FakeResponse()
    _llm_helpers.register_llm("fake-llm", lambda: FakeLLM())

    response, prompt_meta = _llm_helpers.call_with_prompt("p", x="hi")
    assert response.content == "fake response"
    assert prompt_meta["name"] == "p"
    assert prompt_meta["version"] == "1.0.0"
    assert prompt_meta["model"] == "fake-llm"
    assert "content_hash" in prompt_meta and prompt_meta["content_hash"]
    assert "render_inputs_hash" in prompt_meta and prompt_meta["render_inputs_hash"]
    assert "rendered_at" in prompt_meta

    # Verify HumanMessage shape.
    from langchain_core.messages import HumanMessage
    assert len(captured["messages"]) == 1
    assert isinstance(captured["messages"][0], HumanMessage)
    assert captured["messages"][0].content == "Body: hi\n"
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_llm_helpers.py -v -k "register_llm or call_with_prompt"
```

Expected: tests fail with `AttributeError` / `ImportError` — symbols don't exist yet.

- [ ] **Step 4: Add factory + helper to `_llm_helpers.py`**

Append to `backend/app/services/_llm_helpers.py`:

```python
# ---------------------------------------------------------------------------
# LLM-client factory + simple-invoke helper
# ---------------------------------------------------------------------------
#
# Active model routing applies only to the simple-invoke path. Agent-chain
# and custom-dispatch call sites build prompt_meta themselves from the
# RenderedPrompt object returned by prompts.render(); their LLM is fixed at
# build-time in v1 (model field is observability-only on those paths).
#
# See spec §3.5 for the asymmetry rationale.

from typing import Callable

from app.core import prompts as _prompts
from app.core.prompts import UnknownModelError, prompt_meta_from


_LLM_FACTORY: dict[str, Callable[[], object]] = {}
_LLM_CACHE: dict[str, object] = {}


def register_llm(model_name: str, builder: Callable[[], object]) -> None:
    """Register a builder for a model name. Called once at startup from
    build_llm_config(). Builders are cached on first call (lazy singleton)."""
    _LLM_FACTORY[model_name] = builder


def _get_llm_for_model(model_name: str) -> object:
    if model_name not in _LLM_FACTORY:
        raise UnknownModelError(model_name)
    if model_name not in _LLM_CACHE:
        _LLM_CACHE[model_name] = _LLM_FACTORY[model_name]()
    return _LLM_CACHE[model_name]


def call_with_prompt(prompt_name: str, **inputs) -> tuple:
    """Simple-invoke path: render the prompt, resolve the LLM from front-matter,
    invoke with a HumanMessage wrapper, return (response, prompt_meta).

    The LLM client is selected by rendered.config.model — front-matter `model`
    edits actively change behavior on this path with no code change.

    DO NOT use from agent_chain or custom-dispatch call sites — they build
    prompt_meta themselves from prompts.render()'s RenderedPrompt; the
    agent_chain's underlying LLM is fixed at build-time in v1 (model field is
    observability-only on that path).

    Sync (def, not async def). FastAPI runs sync routes in a threadpool; mixing
    async def with a blocking llm.invoke() would block the event loop for the
    full LLM call (up to 120s).
    """
    from langchain_core.messages import HumanMessage
    rendered = _prompts.render(prompt_name, **inputs)
    llm = _get_llm_for_model(rendered.config.model)
    response = llm.invoke([HumanMessage(content=rendered.body)])
    return response, prompt_meta_from(rendered)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_llm_helpers.py -v -k "register_llm or call_with_prompt"
```

Expected: PASS.

- [ ] **Step 6: Wire factory registrations in `build_llm_config()`**

Edit `backend/app/core/llm_config.py`. In `build_llm_config()`, *after* `llm = ChatGroq(...)` and `llm2 = ChatOpenAI(...)`, add:

```python
    # Register simple-invoke models in the LLM factory for `call_with_prompt`
    # (spec §3.5). Builders are no-op wrappers that return the already-built
    # client — the factory caches them lazily on first lookup.
    from app.services._llm_helpers import register_llm
    register_llm("Qwen/Qwen3-235B-A22B-Instruct-2507-tput", lambda: llm2)
    register_llm("llama-3.3-70b-versatile", lambda: llm)
```

- [ ] **Step 7: Write failing test for lifespan calling `init_registry()`**

Append to `backend/tests/test_lifespan.py`:

```python
def test_lifespan_initializes_prompts_registry(monkeypatch):
    """app.state.prompts is set by lifespan; same singleton as module-level _registry."""
    fake_bundle = MagicMock()
    fake_bundle.graph = None
    fake_bundle.client = MagicMock(name="mongo_client")
    monkeypatch.setattr("app.main.build_clients", lambda: fake_bundle)
    monkeypatch.setattr("app.main._ensure_leads_indexes", lambda mongo: None)
    monkeypatch.setattr("app.main._ensure_icp_indexes", lambda mongo: None)
    monkeypatch.setattr("app.main._ensure_market_scoring_indexes", lambda mongo: None)

    with TestClient(app):
        from app.core import prompts as prompts_mod
        assert app.state.prompts is not None
        assert app.state.prompts is prompts_mod._registry
```

- [ ] **Step 8: Wire `init_registry()` into `app/main.py`**

Edit `backend/app/main.py`. Add at the top (with other imports):

```python
from app.core import prompts as _prompts
```

In `lifespan()`, **insert before** `app.state.llm = build_llm_config(...)`:

```python
    # Prompt registry — populated once per process. Stored at module level
    # (app.core.prompts._registry) and on app.state.prompts for handler access.
    # Must precede build_llm_config: Task 11 will have build_llm_config call
    # prompts.as_langchain(...) to construct LangChain PromptTemplates for the
    # Cypher/QA chains.
    app.state.prompts = _prompts.init_registry()
```

Final order inside `lifespan()`:

```python
    app.state.clients = build_clients()
    app.state.prompts = _prompts.init_registry()
    app.state.llm = build_llm_config(app.state.clients)
    # ... rest unchanged (Neo4j refresh_schema, index ensures, yield)
```

- [ ] **Step 9: Run the lifespan test to verify**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_lifespan.py -v
```

Expected: all lifespan tests pass.

- [ ] **Step 10: Run full suite to verify nothing else broke**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest -x --no-header -q 2>&1 | tail -20
```

Expected: green. The lifespan calls `init_registry(root=backend/prompts/)`, which finds only `_shared/` — zero callable prompts but no `BootFailure`.

- [ ] **Step 11: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/_llm_helpers.py backend/app/core/llm_config.py backend/app/main.py backend/tests/unit/test_llm_helpers.py backend/tests/test_lifespan.py
git commit -m "feat(be): wire call_with_prompt + lifespan init_registry"
```

---

# Phase 2 — Service-by-service migration

Each service migrates as one atomic commit. The order is fixed by the spec:
1. `icp/` (mechanical agent-chain, no conditionals — validates base infra)
2. `signals/` (conditionals + includes + custom-dispatch Claude)
3. `market_research/` (volume, parallel prompts)
4. `llm_config/` (LangChain interop via `as_langchain`)
5. `market_scoring/` (single simple-invoke inline prompt)
6. Audit-discovered services (conditional on Phase 0 output)

Each migration commit includes:
- New `.md.j2` files under `backend/prompts/<svc>/`
- Call-site rewrites (Python source)
- Old `prompts.py` deleted (no shim)
- Golden fixtures (one per migrated prompt)
- Substring assertions in service tests → `prompt_meta` assertions
- `prompt_meta` added to that service's Mongo writes

---

## Task 8: Migrate `icp/`

**Goal:** Five prompts (`ICP_GENERATOR_TEMPLATE`, `ICP_RESEARCH_1..4_TEMPLATE`) move to `backend/prompts/icp/*.md.j2`. Each is agent-chain (uses `agent_chain.invoke({'input': rendered.body})` — model field is observability-only). All five share the structural pattern: take `pre_data`, embed it via `{{ pre_data }}`, produce a JSON output.

**Files:**
- Create: `backend/prompts/icp/icp_generator.md.j2`
- Create: `backend/prompts/icp/icp_research_1.md.j2`
- Create: `backend/prompts/icp/icp_research_2.md.j2`
- Create: `backend/prompts/icp/icp_research_3.md.j2`
- Create: `backend/prompts/icp/icp_research_4.md.j2`
- Create: `backend/tests/fixtures/prompts/_inputs/{icp_generator,icp_research_1..4}.json` (5 files)
- Create: `backend/tests/fixtures/prompts/rendered/{icp_generator,icp_research_1..4}.txt` (5 files)
- Modify: `backend/app/services/icp/orchestrator.py`
- Modify: `backend/app/services/icp/persistence.py`
- Modify: `backend/tests/unit/test_icp.py`
- Delete: `backend/app/services/icp/prompts.py`

### Naming convention

The loader rule (from Task 3) is **`name == filename_stem`** — the front-matter `name:` field must equal the filename without `.md.j2`. Names must be globally unique across `backend/prompts/`.

Production authors achieve global uniqueness by choosing service-prefixed filenames when the bare stem would be too generic:
- `backend/prompts/icp/icp_generator.md.j2` → name `icp_generator`
- `backend/prompts/icp/icp_research_1.md.j2` → name `icp_research_1`
- `backend/prompts/market_research/research_market_1.md.j2` → name `research_market_1` (naturally distinct, no prefix needed)
- `backend/prompts/llm_config/cypher_gen.md.j2` → name `cypher_gen` (naturally distinct)

**No loader change is required** — Task 3's simple `name == filename_stem` rule handles all cases. The spec's §3.1 example tree (`icp/generator.md.j2`) is reinterpreted as `icp/icp_generator.md.j2` to give a globally-unique name without a loader rewrite. The spec's example call (`prompts.render("icp_generator", ...)` in §3.5) matches exactly.

- [ ] **Step 1: Create `backend/prompts/icp/icp_generator.md.j2`**

Write the file. Source the body verbatim from `backend/app/services/icp/prompts.py:ICP_GENERATOR_TEMPLATE` (lines 12-120), unescaping the doubled `{{` `}}` in JSON examples (Jinja2 doesn't need them escaped — but `{{ pre_data }}` is now a real Jinja2 expression).

```jinja
---
name: icp_generator
version: 1.0.0
description: ICP synthesis from company profile — agent-chain prompt
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
response_format: json
inputs:
  - pre_data
---
Task: Based on the provided company_profile below, analyze the data and research the market to suggest the most relevant Ideal Customer Profiles (ICPs). Consider industry fit, strategic alignment, and known patterns of technology adoption.

CRITICAL INSTRUCTIONS:
1. Extract the company's ACTUAL industry, target markets, regions, and business model from the company_profile data provided
2. Use WebSearch to find real ICPs that match the company's ACTUAL industry and target markets
3. DO NOT use the example values below - they are ONLY showing the JSON format/structure
4. All ICPs must be based on the company profile's actual industry, regions, and business context
5. You MUST populate the new schema fields: title, why_suggested, how_it_differs, firmographics, key_decision_makers, pain_points_and_triggers, competitors
6. For backward compatibility, also include these keys for each ICP: regions, confidenceScore, decisionMakers

Company Profile Data:
{{ pre_data }}

[... rest of body, copied verbatim from ICP_GENERATOR_TEMPLATE, with these substitutions:
 - Replace `{pre_data}` (curly-brace placeholder) → `{{ pre_data }}` (Jinja2)
 - Replace `{{` `}}` JSON-escape pairs → single `{` `}` (Jinja2 handles single braces natively per spec §3.4)
]

{% include '_shared/final_answer_directive.md.j2' %}
```

**Verbatim source extraction protocol (apply to every prompt in this migration):**
1. Open the source constant in `prompts.py`.
2. Substitute placeholders: `{name}` → `{{ name }}`.
3. Un-double JSON braces: `{{ "key": ` → `{ "key": `. (Caution: only un-double pairs that were escaping JSON; leave Jinja2 expressions intact.)
4. Strip the trailing "When you have reached the final answer..." block (now lives in the partial).
5. Add `{% include '_shared/final_answer_directive.md.j2' %}` as the final line.
6. Add front-matter at the head.
7. **Sanity-grep for orphan single-brace placeholders.** After creating each `.md.j2`, run:
   ```bash
   grep -nE '(^|[^{])\{[a-zA-Z_][a-zA-Z0-9_]*\}([^}]|$)' backend/prompts/<svc>/<name>.md.j2
   ```
   Expected: no matches. Any hit is a `{name}`-style placeholder that wasn't converted to `{{ name }}` — fix before proceeding. (Won't catch every error; the byte-parity check in Step 3 is the primary safety net.)

- [ ] **Step 2: Create the four `icp_research_N.md.j2` files**

Apply the same protocol for `ICP_RESEARCH_1_TEMPLATE` through `ICP_RESEARCH_4_TEMPLATE`. Each gets:

```yaml
---
name: icp_research_N        # N = 1..4
version: 1.0.0
description: ICP research worker N — agent-chain prompt
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
response_format: json
inputs:
  - pre_data
---
```

followed by body extracted from the corresponding template constant.

- [ ] **Step 3: Verify all five register + byte-parity against the legacy template**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python -c "
from pathlib import Path
from app.core.prompts import init_registry, list_prompts
init_registry(root=Path('prompts'))
for p in list_prompts():
    print(p['name'], p['version'], p['model'])
"
```

Expected output:

```
icp_generator 1.0.0 Qwen/Qwen3-235B-A22B-Instruct-2507-tput
icp_research_1 1.0.0 Qwen/Qwen3-235B-A22B-Instruct-2507-tput
icp_research_2 1.0.0 Qwen/Qwen3-235B-A22B-Instruct-2507-tput
icp_research_3 1.0.0 Qwen/Qwen3-235B-A22B-Instruct-2507-tput
icp_research_4 1.0.0 Qwen/Qwen3-235B-A22B-Instruct-2507-tput
```

If `BootFailure` raises, read the error report — typical cause is a stray un-doubled JSON brace producing an `{{`/`}}` that Jinja2 sees as an expression boundary.

**Byte-parity check against the legacy template.** Run this BEFORE generating golden fixtures — fixtures snapshot the *new* render output, so they pass trivially even if the extraction protocol introduced an error. The parity check below catches that. The legacy `ICP_GENERATOR_TEMPLATE` is still importable (it's deleted later in Step 8). Pick one representative prompt per service (here: `icp_generator`); if it passes, the manual extraction protocol worked. If the other four ICP prompts use the same protocol, they're likely correct too — spot-check via golden fixture review.

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python -c "
from pathlib import Path
from app.core.prompts import init_registry, render
from app.services.icp.prompts import ICP_GENERATOR_TEMPLATE
init_registry(root=Path('prompts'))

inputs = {'pre_data': '__SENTINEL__'}
legacy = ICP_GENERATOR_TEMPLATE.format(**inputs)
new = render('icp_generator', **inputs).body
if legacy == new:
    print('PARITY OK: icp_generator matches legacy byte-for-byte')
else:
    print(f'MISMATCH (legacy len={len(legacy)}, new len={len(new)})')
    for i, (l, n) in enumerate(zip(legacy, new)):
        if l != n:
            print(f'first diff at offset {i}: legacy={l!r} new={n!r}')
            print(f'  legacy context: ...{legacy[max(0,i-40):i+40]!r}')
            print(f'  new    context: ...{new[max(0,i-40):i+40]!r}')
            break
"
```

Expected: `PARITY OK: icp_generator matches legacy byte-for-byte`. If MISMATCH, the most common causes are: an un-doubled `{{` JSON brace that should have stayed as `{{`, a stray newline introduced by an `{% include %}` directive, or a placeholder left as `{pre_data}` instead of `{{ pre_data }}`. Fix the `.md.j2` file and re-run.

**Spot-check the remaining four ICP prompts.** Repeat the same parity check by replacing `icp_generator` and `ICP_GENERATOR_TEMPLATE` with `icp_research_1` / `ICP_RESEARCH_1_TEMPLATE`, etc. All five must match before proceeding to Step 4.

- [ ] **Step 4: Generate canonical inputs + golden fixtures**

Write `backend/tests/fixtures/prompts/_inputs/icp_generator.json` (minimal but sufficient — see spec §3.6 sizing guidance, target <5KB):

```json
{
  "pre_data": "{\"name\": \"Acme Corp\", \"industry\": \"SaaS\", \"region\": \"DACH\", \"employees\": 120}"
}
```

Repeat for `icp_research_1..4.json` with similar minimal `pre_data` payloads.

Then run the regen script:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python tests/regen_prompt_fixtures.py --all
```

Expected: 5 fixtures written.

- [ ] **Step 5: Run the golden test**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_prompts_golden.py -v
```

Expected: 5 cases pass.

- [ ] **Step 6: Rewrite call sites in `icp/orchestrator.py`**

Edit `backend/app/services/icp/orchestrator.py`. Replace the imports of `ICP_*_TEMPLATE` and the bodies of `ICP_generator` + `icp_research_1..4` with a single helper pattern. New shape:

```python
from app.core import prompts


def ICP_generator(agent_chain, pre_data: str) -> tuple[dict, dict]:
    """Returns (parsed_json, prompt_meta). Caller merges prompt_meta into Mongo write."""
    rendered = prompts.render("icp_generator", pre_data=pre_data)
    prompt_meta = prompts.prompt_meta_from(rendered)

    def _invoke_generator(body: str) -> dict:
        raw_response = agent_chain.invoke({'input': body})
        response = raw_response["output"]
        try:
            logger.debug("[ICP_generator] Raw LLM output (first 500 chars): %s", str(response)[:500])
        except Exception:
            pass
        return _extract_icp_json(response)

    parsed_json = _invoke_generator(rendered.body)

    if not parsed_json.get("suggestedICPs"):
        retry_body = rendered.body + "\n\nYou must return at least 3 ICP entries in suggestedICPs. Do not return an empty list."
        parsed_json = _invoke_generator(retry_body)

    if not parsed_json.get("suggestedICPs"):
        raise ValueError("LLM returned empty suggestedICPs after retry.")

    return parsed_json, prompt_meta


def icp_research_1(agent_chain, pre_data: str, llm_backend: str = "default") -> tuple[dict, dict]:
    rendered = prompts.render("icp_research_1", pre_data=pre_data)
    prompt_meta = prompts.prompt_meta_from(rendered)
    response = _icp_research_agent_output(agent_chain, rendered.body, pre_data, llm_backend)
    parsed_json = _extract_icp_json(response)
    return parsed_json, prompt_meta


def icp_research_2(agent_chain, pre_data: str, llm_backend: str = "default") -> tuple[dict, dict]:
    rendered = prompts.render("icp_research_2", pre_data=pre_data)
    prompt_meta = prompts.prompt_meta_from(rendered)
    max_retries = 3
    last_response = None
    for attempt in range(1, max_retries + 1):
        try:
            response = _icp_research_agent_output(agent_chain, rendered.body, pre_data, llm_backend)
            last_response = response
            parsed_json = _extract_icp_json(
                response,
                escape_keys=("description", "blurb"),
                trim_braces=True,
                strip_final_answer=True,
            )
            if "currentData" not in parsed_json:
                raise ValueError("Missing 'currentData' key in response")
            return parsed_json, prompt_meta
        except json.JSONDecodeError as e:
            if attempt == max_retries:
                raise ValueError(f"Failed to parse JSON after {max_retries} attempts: {str(e)}. Response: {(last_response or '')[:500]}")
            continue
        except Exception as e:
            if attempt == max_retries:
                raise ValueError(f"Error in icp_research_2 after {max_retries} attempts: {str(e)}")
            continue
```

`icp_research_3` (preserves `buyingSignals` + `currentData` validation from the legacy body):

```python
def icp_research_3(agent_chain, pre_data: str, llm_backend: str = "default") -> tuple[dict, dict]:
    rendered = prompts.render("icp_research_3", pre_data=pre_data)
    prompt_meta = prompts.prompt_meta_from(rendered)
    max_retries = 3
    last_response = None
    for attempt in range(1, max_retries + 1):
        try:
            response = _icp_research_agent_output(agent_chain, rendered.body, pre_data, llm_backend)
            last_response = response
            parsed_json = _extract_icp_json(
                response,
                escape_keys=("description", "blurb", "headline"),
                trim_braces=True,
                strip_final_answer=True,
            )
            if "currentData" not in parsed_json:
                raise ValueError("Missing 'currentData' key in response")
            if "buyingSignals" not in parsed_json.get("currentData", {}):
                raise ValueError("Missing 'buyingSignals' key in currentData")
            return parsed_json, prompt_meta
        except json.JSONDecodeError as e:
            if attempt == max_retries:
                raise ValueError(f"Failed to parse JSON after {max_retries} attempts: {str(e)}. Response: {(last_response or '')[:500]}")
            continue
        except Exception as e:
            if attempt == max_retries:
                raise ValueError(f"Error in icp_research_3 after {max_retries} attempts: {str(e)}")
            continue
```

`icp_research_4` (preserves `icpRefinementRecommendations` + `currentData` validation from the legacy body):

```python
def icp_research_4(agent_chain, pre_data: str, llm_backend: str = "default") -> tuple[dict, dict]:
    rendered = prompts.render("icp_research_4", pre_data=pre_data)
    prompt_meta = prompts.prompt_meta_from(rendered)
    max_retries = 3
    last_response = None
    for attempt in range(1, max_retries + 1):
        try:
            response = _icp_research_agent_output(agent_chain, rendered.body, pre_data, llm_backend)
            last_response = response
            parsed_json = _extract_icp_json(
                response,
                escape_keys=("description", "blurb"),
                trim_braces=True,
                strip_final_answer=True,
            )
            if "currentData" not in parsed_json:
                raise ValueError("Missing 'currentData' key in response")
            if "icpRefinementRecommendations" not in parsed_json.get("currentData", {}):
                raise ValueError("Missing 'icpRefinementRecommendations' key in currentData")
            return parsed_json, prompt_meta
        except json.JSONDecodeError as e:
            if attempt == max_retries:
                raise ValueError(f"Failed to parse JSON after {max_retries} attempts: {str(e)}. Response: {(last_response or '')[:500]}")
            continue
        except Exception as e:
            if attempt == max_retries:
                raise ValueError(f"Error in icp_research_4 after {max_retries} attempts: {str(e)}")
            continue
```

Remove the imports `from app.services.icp.prompts import (ICP_*_TEMPLATE, ...)` and `from langchain_core.prompts import PromptTemplate` (no longer needed).

- [ ] **Step 7: Update `_run_icp_research_impl` and `list_icps` to thread `prompt_meta`**

In `backend/app/services/icp/orchestrator.py`, update `_run_icp_research_impl` to expect the tuple return and merge `prompt_meta` into the Mongo write:

```python
    # --- Run research with retries (max 2 attempts) ---
    max_retries = 2
    research_result: Any = None
    prompt_meta: dict = {}
    for attempt in range(1, max_retries + 1):
        try:
            research_result, prompt_meta = await asyncio.to_thread(research_function, agent_chain, context_json)
            break
        except Exception:
            if attempt == max_retries:
                raise
            await asyncio.sleep(1)

    if not isinstance(research_result, dict):
        research_result = {"data": research_result}

    research_result.update({
        "user_id": request.user_id,
        "component_name": component_name,
        "timestamp": datetime.now(timezone.utc),
        "prompt_meta": prompt_meta,
    })
    if request.org_id:
        research_result["org_id"] = request.org_id

    await asyncio.to_thread(collection.insert_one, research_result)
    research_result.pop("_id", None)
    return {"status": "success", "data": research_result}
```

In `backend/app/services/icp/persistence.py`, update `list_icps` similarly: `ICP_generator()` now returns `(icp_result, prompt_meta)`. Capture both and persist `prompt_meta` alongside `icps`:

```python
        icp_result, prompt_meta = ICP_generator(agent_chain, company_profile)
        # ... normalization ...
        collection.update_one(
            {"user_id": user_id},
            {"$set": {"user_id": user_id, "icps": icp_result, "prompt_meta": prompt_meta}},
            upsert=True,
        )
```

Apply the same change inside the dispatch dicts at lines 226-238 — `ICP_FUNCTIONS` and `ICP_FUNCTIONS_CLAUDE` now point at functions returning tuples; downstream callers in `_run_icp_research_impl` unpack the tuple.

- [ ] **Step 8: Delete `backend/app/services/icp/prompts.py`**

```bash
rm /projects/Brewra/brewra-gtm-intelligence/backend/app/services/icp/prompts.py
```

- [ ] **Step 9: Rewrite substring assertions in `test_icp.py`**

Find every assertion of the form `assert "<substring>" in <prompt_string>` in `backend/tests/unit/test_icp.py` and replace with `prompt_meta` assertions. Concrete pattern:

```python
# BEFORE — fragile
captured_prompt = ...  # whatever the test captured from a mocked agent_chain
assert "Research and compile" in captured_prompt

# AFTER — stable
captured_prompt_meta = ...  # captured from the inserted Mongo doc or a side channel
assert captured_prompt_meta["name"] == "icp_research_1"
assert captured_prompt_meta["version"] == "1.0.0"
```

The icp service tests likely mock `agent_chain.invoke` — extend the mock to also capture the prompt_meta that gets passed to `collection.insert_one`. Use a `MagicMock(...) ` on `collection.insert_one` and inspect the kwargs.

- [ ] **Step 10: Run icp service tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_icp.py tests/test_icp.py tests/test_icp_v2.py -v
```

Expected: green.

- [ ] **Step 11: Run full suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest -x --no-header -q 2>&1 | tail -20
```

Expected: green.

- [ ] **Step 12: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/prompts/icp/ backend/tests/fixtures/prompts/_inputs/icp_*.json backend/tests/fixtures/prompts/rendered/icp_*.txt backend/app/services/icp/orchestrator.py backend/app/services/icp/persistence.py backend/tests/unit/test_icp.py backend/tests/unit/test_prompts_loader.py backend/app/core/prompts.py
git rm backend/app/services/icp/prompts.py
git commit -m "refactor(be): migrate icp/ prompts to backend/prompts/ + prompt_meta"
```

---

## Task 9: Migrate `signals/`

**Goal:** Seven prompts (`_SCOUT_PROMPT_TEMPLATE`, `_PROFILER_PROMPT_TEMPLATE`, `_LEADS_SECTION_TEMPLATE`, `_LEADS_SECTION_FALLBACK_TEMPLATE`, `_EXISTING_HEADLINES_SECTION_TEMPLATE`, `_SIGNAL_ASK_PROMPT_TEMPLATE`, `_SIGNAL_ASK_CLAUDE_PROMPT_TEMPLATE`). Two of them (`scout_search`, `profiler_search`) embed conditional sections via `{% if leads %}` / `{% if existing_headlines %}`. Two of them (`signal_ask_groq`, `signal_ask_claude`) are nearly identical — both ask the same question with web-search context.

**Files:**
- Create: `backend/prompts/signals/signals_{scout_search,profiler_search,leads_section,leads_section_fallback,existing_headlines_section,signal_ask_groq,signal_ask_claude}.md.j2`
- Create: matching `_inputs/*.json` + `rendered/*.txt`
- Modify: `backend/app/services/signals/{search,ask,batch}.py`
- Modify: `backend/app/services/signals/persistence.py` — add `prompt_meta` to signal Mongo writes
- Modify: `backend/tests/unit/test_signals.py`, `backend/tests/test_signals.py`, `backend/tests/test_signals_v2.py`
- Delete: `backend/app/services/signals/prompts.py`

- [ ] **Step 1: Create `backend/prompts/signals/signals_leads_section.md.j2` (partial-like sub-template)**

This is the **conditional section** that gets included from `scout_search` and `profiler_search`. It lives under `signals/`, not `_shared/`, because it's specific to the signals service. Per the spec's §3.2 rule that "Files under `_shared/` cannot be invoked directly via `prompts.render()`", a file under `signals/` *is* invocable — but in practice we never call it directly. The include-depth rule allows depth-1 includes; this file is itself a leaf (no further includes).

```jinja
---
name: signals_leads_section
version: 1.0.0
description: Active-leads section embedded in scout/profiler search prompts when leads exist
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
response_format: text
inputs:
  - signal_label
  - leads_count
  - leads_json
---

STEP 1.2 - LEADS DATA (CRITICAL - Use this to prioritize {{ signal_label }} relevance):
Your organization has {{ leads_count }} active leads in your pipeline. Below is the complete lead data with all available fields. You MUST analyze this data and use it when generating {{ signal_label }}s.

Complete Leads Data (showing up to 50 most recent leads):
{{ leads_json }}

CRITICAL INSTRUCTIONS:
- Analyze ALL fields in the leads data above - do not assume any specific field names
- Extract any company names, industries, regions, technologies, or other relevant information from whatever fields exist
- Prioritize {{ signal_label }}s that relate to companies, industries, regions, or any other attributes found in your leads pipeline
- If a {{ signal_label }} mentions a company or organization, check if it matches any entity in your leads data
- Focus on {{ signal_label }}s that would be relevant to your actual sales pipeline based on the lead data structure
- Use the lead data to understand your target market, customer segments, and sales priorities
- This will make the {{ signal_label }}s more actionable for your sales team
```

- [ ] **Step 2: Create `signals/signals_leads_section_fallback.md.j2`**

```jinja
---
name: signals_leads_section_fallback
version: 1.0.0
description: Fallback leads-section used when no detailed lead data is available
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
response_format: text
inputs:
  - signal_label
  - leads_count
---

STEP 1.2 - LEADS DATA:
Your organization has {{ leads_count }} active leads in your pipeline. Use this information to prioritize {{ signal_label }}s relevant to your actual sales pipeline.
```

- [ ] **Step 3: Create `signals/signals_existing_headlines_section.md.j2`**

```jinja
---
name: signals_existing_headlines_section
version: 1.0.0
description: Anti-duplicate-signal directive embedded in scout/profiler search prompts
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
response_format: text
inputs:
  - headlines_list
---

STEP 1.5 - EXISTING SIGNALS (CRITICAL - AVOID DUPLICATES):
You MUST avoid generating signals similar to these existing signal headlines. Review them carefully and ensure your new signal is completely different and unique:

Existing Signal Headlines:
{{ headlines_list }}

IMPORTANT: Your new signal headline must be about a DIFFERENT news story, market development, or industry trend. Do NOT generate a signal about the same event, company news, or market development as any of the above headlines, even if worded differently. Search for NEW and UNIQUE signals that haven't been covered yet.
```

- [ ] **Step 4: Create `signals/signals_scout_search.md.j2` with conditionals**

```jinja
---
name: signals_scout_search
version: 1.0.0
description: Scout-persona market signal research (Groq agent_chain)
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
response_format: json
inputs:
  - context_json
  - leads
  - leads_count
  - leads_json
  - signal_label
  - existing_headlines
  - headlines_list
---
Task: Research and identify a high-quality, actionable market signal for a sales scout agent. This signal should help the sales team understand market opportunities, competitor movements, or industry trends that could impact their sales strategy.

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below. Extract all relevant information about the company's industry, target markets, regions, company size, strategic goals, and any other relevant attributes.

Company Profile Data:
{{ context_json }}
{% if leads %}
{% include 'signals/signals_leads_section.md.j2' %}
{% else %}
{% include 'signals/signals_leads_section_fallback.md.j2' %}
{% endif %}
{% if existing_headlines %}
{% include 'signals/signals_existing_headlines_section.md.j2' %}
{% endif %}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
[... body extracted verbatim from _SCOUT_PROMPT_TEMPLATE, with curly-brace single-format placeholders converted to Jinja2 expressions where appropriate, and JSON examples un-doubled ...]

{% include '_shared/final_answer_directive.md.j2' %}
```

**Important — declared inputs include both branches' variables.** Because the AST-walk validation in §3.3 step 7 walks transitive includes and demands every referenced variable be declared, `signals_scout_search`'s `inputs:` list must include the union: `context_json` (always), `leads` (the truthy flag), `leads_count` + `leads_json` + `signal_label` (used by leads_section), `existing_headlines` (the truthy flag), `headlines_list` (used by existing_headlines_section). At call time, the orchestrator passes ALL of these; when `leads` is falsy the `leads_json` value can be `None` or empty — Jinja2 won't render the `{% include %}` block at all in that branch.

- [ ] **Step 5: Create `signals/signals_profiler_search.md.j2`**

Same shape as scout_search but with the Profiler body from `_PROFILER_PROMPT_TEMPLATE`. Front-matter name: `signals_profiler_search`.

- [ ] **Step 6: Create `signals/signals_signal_ask_groq.md.j2` and `signals/signals_signal_ask_claude.md.j2`**

Two prompts. Groq one:

```jinja
---
name: signals_signal_ask_groq
version: 1.0.0
description: Signal-detail Q&A — Groq agent_chain (WebSearch tool used at runtime)
model: llama-3.3-70b-versatile
response_format: text
inputs:
  - context
  - history_text
  - question
---
You are an intelligent assistant helping answer questions about market signals, company strategy, and customer insights.

{{ context }}
{{ history_text }}

CURRENT QUESTION:
{{ question }}

INSTRUCTIONS:
1. Use the WebSearch tool to find the most up-to-date and accurate information to answer the question
2. Consider the company profile and customer profile (ICPs) when providing context-specific answers
3. Reference the conversation history to maintain context and continuity
4. Provide a comprehensive, well-structured answer that directly addresses the question
5. If the question relates to market signals, trends, or industry insights, use WebSearch to find recent data (2026-2027)
6. Cite sources when using information from WebSearch
7. Be specific and actionable in your response

Please use the WebSearch tool to gather current information and provide a detailed answer.
```

Claude one — note the additional `web_search_results` variable and Claude-specific framing:

```jinja
---
name: signals_signal_ask_claude
version: 1.0.0
description: Signal-detail Q&A — Claude via custom-dispatch (web search injected as context)
model: claude-sonnet  # observability-only; routing happens via _claude_messages_text
response_format: text
inputs:
  - context
  - history_text
  - web_search_results
  - question
---
You are an intelligent assistant helping answer questions about market signals, company strategy, and customer insights.

{{ context }}
{{ history_text }}

WEB SEARCH RESULTS:
{{ web_search_results }}

CURRENT QUESTION:
{{ question }}

INSTRUCTIONS:
1. Use the provided web search results as the freshest external context.
2. Consider the company profile and customer profile (ICPs) when providing context-specific answers.
3. Reference the conversation history to maintain context and continuity.
4. Provide a comprehensive, well-structured answer that directly addresses the question.
5. If the question relates to market signals, trends, or industry insights, prioritize recent data (2026-2027).
6. Cite sources if they appear in web search results.
7. Be specific and actionable in your response.
```

The `model: claude-sonnet` value is informational only in v1 — `signals_signal_ask_claude` is invoked via `_claude_messages_text` (custom dispatch), not via the LLM factory.

- [ ] **Step 7: Verify all seven signals prompts register**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python -c "
from pathlib import Path
from app.core.prompts import init_registry, list_prompts
init_registry(root=Path('prompts'))
for p in [x for x in list_prompts() if x['name'].startswith('signals_')]:
    print(p['name'], p['version'])
"
```

Expected output:

```
signals_existing_headlines_section 1.0.0
signals_leads_section 1.0.0
signals_leads_section_fallback 1.0.0
signals_profiler_search 1.0.0
signals_scout_search 1.0.0
signals_signal_ask_claude 1.0.0
signals_signal_ask_groq 1.0.0
```

**Byte-parity check against the legacy template** (use a non-conditional prompt — `signals_signal_ask_groq` — since conditional prompts require reproducing the legacy assembly logic to be testable). The legacy `_SIGNAL_ASK_PROMPT_TEMPLATE` is still importable (deleted later in Step 13).

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python -c "
from pathlib import Path
from app.core.prompts import init_registry, render
from app.services.signals.prompts import _SIGNAL_ASK_PROMPT_TEMPLATE
init_registry(root=Path('prompts'))

inputs = {'context': 'CTX', 'history_text': 'HIST', 'question': 'QQ'}
legacy = _SIGNAL_ASK_PROMPT_TEMPLATE.format(**inputs)
new = render('signals_signal_ask_groq', **inputs).body
print('PARITY OK' if legacy == new else f'MISMATCH (legacy len={len(legacy)}, new len={len(new)})')
"
```

Expected: `PARITY OK`. For the **conditional prompts** (`signals_scout_search`, `signals_profiler_search`), reproducing the legacy assembly's conditional logic from the orchestrator-side `.format()` machinery byte-for-byte is messy; rely on the golden fixture + code-review of the rendered .txt output instead. The non-conditional prompts (`signals_signal_ask_groq`, `signals_signal_ask_claude`) cover the extraction-protocol correctness signal for this service.

- [ ] **Step 8: Generate canonical inputs + golden fixtures**

For the conditional prompts (`signals_scout_search`, `signals_profiler_search`), per spec §3.6 branch-coverage policy: the golden fixture exercises the **happy path with all conditional sections active**. Set both `leads` and `existing_headlines` to truthy values in `_inputs/signals_scout_search.json` and `_inputs/signals_profiler_search.json`. The fallback branches are exercised by unit tests against synthetic `tmp_path` prompts (already covered in `test_prompts_loader.py`).

Example `_inputs/signals_scout_search.json`:

```json
{
  "context_json": "{\"industry\": \"SaaS\", \"region\": \"DACH\"}",
  "leads": [{"id": "L-1", "company_name": "TestCo"}],
  "leads_count": 1,
  "leads_json": "[{\"id\": \"L-1\", \"company_name\": \"TestCo\"}]",
  "signal_label": "market signal",
  "existing_headlines": ["headline A", "headline B"],
  "headlines_list": "- headline A\n- headline B"
}
```

Run:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python tests/regen_prompt_fixtures.py --all
```

Expected: signals fixtures generated alongside the icp ones from Task 8.

- [ ] **Step 9: Run golden tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_prompts_golden.py -v
```

Expected: all cases pass.

- [ ] **Step 10: Rewrite `signals/search.py` call sites**

Replace prompt-assembly code in `backend/app/services/signals/search.py` with `prompts.render()` calls. Old pattern: build `leads_section` and `existing_headlines_section` strings, then `.format()` the main template. New pattern: pass all the variables and let the template handle conditionals.

```python
from app.core import prompts

# Inside search_signals():
rendered = prompts.render(
    "signals_scout_search",  # or "signals_profiler_search" depending on persona
    context_json=context_json,
    leads=leads_list,
    leads_count=len(leads_list),
    leads_json=leads_json_str,
    signal_label=signal_label,
    existing_headlines=existing_headlines_list,
    headlines_list=headlines_list_str,
)
prompt_meta = prompts.prompt_meta_from(rendered)
output, urls = _signals_agent_output(agent_chain, rendered.body, company_profile_seed, llm_backend)
# ... parse output ...
parsed["prompt_meta"] = prompt_meta
```

- [ ] **Step 11: Rewrite `signals/ask.py` and `signals/batch.py` call sites**

`signal_ask` (Groq path) and `signal_ask_claude` (custom dispatch via `_claude_messages_text`) use prompts `signals_signal_ask_groq` and `signals_signal_ask_claude`. Replace the existing `.format()` call with `prompts.render()`, capture `prompt_meta`, persist it.

For `_signal_ask_claude` (custom dispatch): the `web_search_results` variable is filled at runtime from a Tavily call; render the prompt with all inputs, then pass `rendered.body` to `_claude_messages_text`.

- [ ] **Step 12: Add `prompt_meta` to `signals/persistence.py` writes**

Find every Mongo write that persists a signal (`collection.insert_one(...)` / `update_one(...)`) and merge `prompt_meta` into the document. The signals service writes to multiple collections — apply the change uniformly.

- [ ] **Step 13: Delete `backend/app/services/signals/prompts.py`**

```bash
rm /projects/Brewra/brewra-gtm-intelligence/backend/app/services/signals/prompts.py
```

- [ ] **Step 14: Rewrite substring assertions in signals tests**

Find every `assert "<substring>" in <prompt>` pattern in:
- `backend/tests/unit/test_signals.py`
- `backend/tests/test_signals.py`
- `backend/tests/test_signals_v2.py`

Replace with `prompt_meta` assertions per the icp/ pattern in Task 8 Step 11. The signals tests likely capture prompts through mocked `agent_chain.invoke` or `_claude_messages_text` calls — extend mocks to also assert on the persisted document's `prompt_meta`.

- [ ] **Step 15: Run signals service tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_signals.py tests/test_signals.py tests/test_signals_v2.py -v
```

Expected: green.

- [ ] **Step 16: Run full suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest -x --no-header -q 2>&1 | tail -20
```

Expected: green.

- [ ] **Step 17: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/prompts/signals/ backend/tests/fixtures/prompts/_inputs/signals_*.json backend/tests/fixtures/prompts/rendered/signals_*.txt backend/app/services/signals/search.py backend/app/services/signals/ask.py backend/app/services/signals/batch.py backend/app/services/signals/persistence.py backend/tests/unit/test_signals.py backend/tests/test_signals.py backend/tests/test_signals_v2.py
git rm backend/app/services/signals/prompts.py
git commit -m "refactor(be): migrate signals/ prompts with conditionals + prompt_meta"
```

---

## Task 10: Migrate `market_research/`

**Goal:** Five prompts (`RESEARCH_MARKET_1..5_TEMPLATE`, 718 LOC of prompt text). Heaviest by line count but five near-parallel prompts — recipe is the same as `icp_research_N` (single `pre_data`-equivalent input, agent-chain invocation).

**Files:**
- Create: `backend/prompts/market_research/research_market_{1..5}.md.j2`
- Create: matching `_inputs/*.json` + `rendered/*.txt`
- Modify: `backend/app/services/market_research/orchestrator.py`
- Modify: `backend/app/services/market_research/persistence.py`
- Modify: `backend/tests/unit/test_market_research.py`
- Modify: `backend/tests/test_market_research.py`
- Delete: `backend/app/services/market_research/prompts.py`
- Delete: `backend/tests/unit/test_market_research_prompt_assembly.py` (assertions on inline prompt strings — equivalent coverage moves to golden fixtures)

- [ ] **Step 1: Extract `RESEARCH_MARKET_1_TEMPLATE` to `market_research/research_market_1.md.j2`**

Read `backend/app/services/market_research/prompts.py` to identify the constant. Apply the verbatim-source-extraction protocol from Task 8 Step 1. Filename: `backend/prompts/market_research/research_market_1.md.j2`. Front-matter:

```yaml
---
name: research_market_1
version: 1.0.0
description: Market size & opportunity research worker (Research_Market_1)
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
response_format: json
inputs:
  - company_profile_json
---
```

(Use `company_profile_json` as the input name to match the spec's example in §3.2. The bare stem `research_market_1` is globally unique without a service prefix.)

- [ ] **Step 2: Repeat for `research_market_2..5`**

Filenames: `research_market_2.md.j2` through `research_market_5.md.j2`. Front-matter `name`: `research_market_2` … `research_market_5`. No service prefix — these stems are already distinctive.

- [ ] **Step 3: Verify byte-parity against legacy template + generate fixtures + golden tests pass**

Before generating fixtures, run the byte-parity check against the legacy template (same pattern as Task 8 Step 3 — fixtures snapshot the new render output and would pass trivially even if extraction was wrong):

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python -c "
from pathlib import Path
from app.core.prompts import init_registry, render
from app.services.market_research.prompts import RESEARCH_MARKET_1_TEMPLATE
init_registry(root=Path('prompts'))

inputs = {'company_profile_json': '__SENTINEL__'}
legacy = RESEARCH_MARKET_1_TEMPLATE.format(**inputs)
new = render('research_market_1', **inputs).body
print('PARITY OK' if legacy == new else f'MISMATCH (legacy len={len(legacy)}, new len={len(new)})')
"
```

Expected: `PARITY OK`. If MISMATCH, fix the `.md.j2` file before proceeding. Then run the same parity check for `research_market_2..5` by swapping the constant and prompt name.

After all five pass parity, generate fixtures + run golden tests:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python tests/regen_prompt_fixtures.py --all && pytest tests/unit/test_prompts_golden.py -v
```

Expected: 5 new fixtures generated, all golden tests pass.

- [ ] **Step 4: Rewrite call sites in `market_research/orchestrator.py`**

Apply the same recipe as icp (Task 8 Step 8): each `research_market_N` function returns `(parsed_json, prompt_meta)`.

- [ ] **Step 5: Update `market_research/persistence.py` to persist `prompt_meta`**

Find `collection.insert_one` / `update_one` in `backend/app/services/market_research/persistence.py` and merge `prompt_meta` into the document.

- [ ] **Step 6: Delete prompts.py + test_market_research_prompt_assembly.py**

```bash
rm /projects/Brewra/brewra-gtm-intelligence/backend/app/services/market_research/prompts.py
rm /projects/Brewra/brewra-gtm-intelligence/backend/tests/unit/test_market_research_prompt_assembly.py
```

- [ ] **Step 7: Rewrite substring assertions in market_research tests**

Apply the icp pattern from Task 8 Step 11 to `backend/tests/unit/test_market_research.py` and `backend/tests/test_market_research.py`.

- [ ] **Step 8: Run market_research tests + full suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_market_research.py tests/test_market_research.py -v && pytest -x --no-header -q 2>&1 | tail -20
```

Expected: green.

- [ ] **Step 9: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/prompts/market_research/ backend/tests/fixtures/prompts/_inputs/research_market_*.json backend/tests/fixtures/prompts/rendered/research_market_*.txt backend/app/services/market_research/orchestrator.py backend/app/services/market_research/persistence.py backend/tests/unit/test_market_research.py backend/tests/test_market_research.py
git rm backend/app/services/market_research/prompts.py backend/tests/unit/test_market_research_prompt_assembly.py
git commit -m "refactor(be): migrate market_research/ prompts + prompt_meta"
```

---

## Task 11: Migrate `llm_config/` (LangChain Cypher + QA prompts)

**Goal:** Four LangChain-wrapped prompts (`Cypher_gen_prompt`, `Cypher_gen_prompt2`, `qa_prompt_template`, `qa_prompt_template2`) move to `backend/prompts/llm_config/{cypher_gen,cypher_gen_alt,qa_scout,qa_scout_alt}.md.j2`. The shared `_CYPHER_BASE` and `_QA_BASE` blocks decompose into partials so the base+overlay+tail composition is replaced by Jinja2 includes. `build_llm_config()` constructs `PromptTemplate` objects via `prompts.as_langchain()` and passes them to `GraphCypherQAChain.from_llm(...)`.

**Files:**
- Create: `backend/prompts/llm_config/{cypher_gen,cypher_gen_alt,qa_scout,qa_scout_alt}.md.j2`
- Create: `backend/prompts/_shared/cypher_base.md.j2` (extracted from `_CYPHER_BASE`)
- Note: `_shared/scout_persona.md.j2` (added in Task 5) already covers `_QA_BASE`
- Create: matching `_inputs/*.json` + `rendered/*.txt`
- Modify: `backend/app/core/llm_config.py` — delete the prompt-assembly block; call `prompts.as_langchain(...)` in `build_llm_config()`
- Delete: `backend/tests/unit/test_llm_config_prompts.py`
- Delete: `backend/tests/_baselines/llm_config_prompt_strings.py`

- [ ] **Step 1: Extract `_CYPHER_BASE` to `backend/prompts/_shared/cypher_base.md.j2`**

```jinja
---
name: cypher_base
version: 1.0.0
description: Shared Cypher schema + query-rules block (formerly _CYPHER_BASE)
---
You are a Neo4j Cypher expert. Your task is to return a single clean, executable Cypher query — with no markdown, no commentary, no prefixes or suffixes, and no text outside the Cypher code.

[... body extracted verbatim from llm_config.py:_CYPHER_BASE lines 37-118 ...]
```

- [ ] **Step 2: Create `backend/prompts/llm_config/cypher_gen.md.j2` (uses `_CYPHER_GEN_PROMPT_OVERLAY`)**

```jinja
---
name: cypher_gen
version: 1.0.0
description: GraphCypherQAChain Cypher generator (variant 1 — original/modified context overlay)
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
response_format: text
inputs:
  - schema
  - question
---
{% include '_shared/cypher_base.md.j2' %}
the prompt might have extra stuff called as original_json and modified_json , they represent the context wherein the original_json is psection of a market research and the modified_json is the edits the user made on top of those , also understand them to answer any thing.
if you are not asked for any particular thing regarding the leads , just fetch all the infomration all nodes and parameters and values and pass as context , dont make complex cypher queries

Schema : {{ schema }}

Question: {{ question }}
```

Note the SPACE before the colon in `Schema :` — this is a pre-existing divergence from cypher_gen_alt and must be preserved for byte-equality with the legacy prompt.

- [ ] **Step 3: Create `cypher_gen_alt.md.j2` (uses `_CYPHER_GEN_PROMPT2_OVERLAY`)**

```jinja
---
name: cypher_gen_alt
version: 1.0.0
description: GraphCypherQAChain Cypher generator (variant 2 — bare schema overlay)
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
response_format: text
inputs:
  - schema
  - question
---
{% include '_shared/cypher_base.md.j2' %}
Schema: {{ schema }}
Question: {{ question }}
```

- [ ] **Step 4: Create `qa_scout.md.j2` (composes `scout_persona` + `_QA_PROMPT_TEMPLATE_OVERLAY` + tail)**

```jinja
---
name: qa_scout
version: 1.0.0
description: GraphCypherQAChain QA prompt (variant 1 — response_json directive)
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
response_format: json
inputs:
  - context
  - question
---
{% include '_shared/scout_persona.md.j2' %}
also give your response in a json , clean valid json with response_message key and your tmessage response as its value and also if any changes need be made on the original and modified json , make those and also put that in a key called as response_json
Give me the response as valid JSON in a single line. Do not use markdown or code blocks. Do not escape characters unnecessarily. Just give plain minified JSON.
Give me the response as valid JSON in a single line. Do not use markdown or code blocks. Do not escape characters unnecessarily. Just give plain minified JSON.
Give me the response as valid JSON in a single line. Do not use markdown or code blocks. Do not escape characters unnecessarily. Just give plain minified JSON.
Give me the response as valid JSON in a single line. Do not use markdown or code blocks. Do not escape characters unnecessarily. Just give plain minified JSON.
Give me the response as valid JSON in a single line. Do not use markdown or code blocks. Do not escape characters unnecessarily. Just give plain minified JSON.

Context:
{{ context }}

Question:
{{ question }}

Illuminating Answer:
```

The 5× duplication is a pre-existing manual-emphasis artifact in the original prompt; it is preserved verbatim per spec §1 ("Replace inline Python prompt constants ... no behavioral change").

- [ ] **Step 5: Create `qa_scout_alt.md.j2`**

```jinja
---
name: qa_scout_alt
version: 1.0.0
description: GraphCypherQAChain QA prompt (variant 2 — no response_json overlay)
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
response_format: text
inputs:
  - context
  - question
---
{% include '_shared/scout_persona.md.j2' %}
Context:
{{ context }}

Question:
{{ question }}

Illuminating Answer:
```

- [ ] **Step 6: Verify all four register + generate fixtures**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python -c "
from pathlib import Path
from app.core.prompts import init_registry, list_prompts
init_registry(root=Path('prompts'))
for p in [x for x in list_prompts() if x['name'] in {'cypher_gen', 'cypher_gen_alt', 'qa_scout', 'qa_scout_alt'}]:
    print(p['name'], p['version'])
"
```

Expected:

```
cypher_gen 1.0.0
cypher_gen_alt 1.0.0
qa_scout 1.0.0
qa_scout_alt 1.0.0
```

Then generate canonical inputs (use minimal `schema` + `question`/`context`) and fixtures:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python tests/regen_prompt_fixtures.py --all
```

- [ ] **Step 7: Run golden + LangChain parity tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_prompts_golden.py -v -k "llm_config"
```

Expected: both `test_golden_render` and `test_as_langchain_byte_equal_to_render` pass for all four. The parity test guards the source-expansion algorithm against drift between our render and LangChain's render.

- [ ] **Step 8: Add baseline equivalence test (one-shot guard)**

Before deleting the old `test_llm_config_prompts.py`, add a one-shot assertion that the new `as_langchain()` output equals the legacy hardcoded baseline. This protects against any byte-level drift introduced during the migration.

**Important — compare RENDERED outputs, not template strings.** The legacy baselines (`CYPHER_GEN_PROMPT_BASELINE` etc. at `backend/tests/_baselines/llm_config_prompt_strings.py`) contain Python-format placeholders like `{schema}` and `{question}` — LangChain's default template format is f-string-style. The new `as_langchain()` builds templates with `template_format="jinja2"`, producing template strings with `{{ schema }}` and `{{ question }}`. The TEMPLATE strings differ in placeholder syntax; the RENDERED outputs (after substituting variables) must be byte-equal. The current `test_llm_config_prompts.py` asserts the in-code constants in `llm_config.py` match these baselines, so the baselines are validated as the canonical pre-migration strings — confirm by running `pytest tests/unit/test_llm_config_prompts.py -v` before this step.

Create `backend/tests/unit/test_llm_config_migration_equivalence.py`:

```python
"""One-shot equivalence test — guards against any byte-drift introduced
when the legacy in-code prompts (_CYPHER_BASE etc.) were translated into
.md.j2 files. Compares LangChain-RENDERED output (variables substituted)
against the legacy baselines rendered with the same variables. Delete
this file after the next release cuts; the goal is to fail loudly during
migration review if the translation isn't byte-equal at render time.
"""
from app.core.prompts import init_registry, as_langchain
from pathlib import Path
from tests._baselines.llm_config_prompt_strings import (
    CYPHER_GEN_PROMPT_BASELINE,
    CYPHER_GEN_PROMPT2_BASELINE,
    QA_PROMPT_TEMPLATE_BASELINE,
    QA_PROMPT_TEMPLATE2_BASELINE,
)

# Distinctive sentinels so any placeholder-handling mismatch is obvious in diffs.
_SCHEMA = "__SCHEMA_SENTINEL__"
_QUESTION = "__QUESTION_SENTINEL__"
_CONTEXT = "__CONTEXT_SENTINEL__"


def setup_module(module):
    init_registry(root=Path(__file__).resolve().parent.parent.parent / "prompts")


def test_cypher_gen_byte_equal_to_baseline():
    new = as_langchain("cypher_gen").format(schema=_SCHEMA, question=_QUESTION)
    baseline = CYPHER_GEN_PROMPT_BASELINE.format(schema=_SCHEMA, question=_QUESTION)
    assert new == baseline


def test_cypher_gen_alt_byte_equal_to_baseline():
    new = as_langchain("cypher_gen_alt").format(schema=_SCHEMA, question=_QUESTION)
    baseline = CYPHER_GEN_PROMPT2_BASELINE.format(schema=_SCHEMA, question=_QUESTION)
    assert new == baseline


def test_qa_scout_byte_equal_to_baseline():
    new = as_langchain("qa_scout").format(context=_CONTEXT, question=_QUESTION)
    baseline = QA_PROMPT_TEMPLATE_BASELINE.format(context=_CONTEXT, question=_QUESTION)
    assert new == baseline


def test_qa_scout_alt_byte_equal_to_baseline():
    new = as_langchain("qa_scout_alt").format(context=_CONTEXT, question=_QUESTION)
    baseline = QA_PROMPT_TEMPLATE2_BASELINE.format(context=_CONTEXT, question=_QUESTION)
    assert new == baseline
```

Run it:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_llm_config_migration_equivalence.py -v
```

If any assertion fails, the migration introduced byte drift — read the diff carefully and fix the .md.j2 file (typically whitespace at the boundaries between base + overlay + tail, or a stray newline from a misplaced `{% include %}` directive). Iterate until all four pass.

- [ ] **Step 9: Rewrite `build_llm_config()` to use `as_langchain`**

Edit `backend/app/core/llm_config.py`. Delete the entire prompt-assembly block (lines 21-205 in the current file — `_CYPHER_BASE`, `_CYPHER_GEN_PROMPT_OVERLAY`, `_CYPHER_GEN_PROMPT2_OVERLAY`, `_CYPHER_TAIL`, `Cypher_gen_prompt`, `Cypher_gen_prompt2`, `Cypher_Prompt`, `Cypher_Prompt2`, `_QA_BASE`, `_QA_PROMPT_TEMPLATE_OVERLAY`, `_QA_TAIL`, `qa_prompt_template`, `qa_prompt_template2`, `qa_prompt`, `qa_prompt2`).

In `build_llm_config()`, after the LLM-factory registrations, replace the prompt-construction with `as_langchain()` calls:

```python
    from app.core import prompts as _prompts

    chain = None
    chain2 = None
    if clients_bundle.graph is not None:
        cypher_prompt = _prompts.as_langchain("cypher_gen")
        cypher_prompt_alt = _prompts.as_langchain("cypher_gen_alt")
        qa_prompt = _prompts.as_langchain("qa_scout")
        qa_prompt_alt = _prompts.as_langchain("qa_scout_alt")

        chain = GraphCypherQAChain.from_llm(
            llm=llm2, graph=clients_bundle.graph,
            cypher_prompt=cypher_prompt, qa_prompt=qa_prompt,
            verbose=True, memory=memory, allow_dangerous_requests=True,
        )
        chain2 = GraphCypherQAChain.from_llm(
            llm=llm2, graph=clients_bundle.graph,
            cypher_prompt=cypher_prompt_alt, qa_prompt=qa_prompt_alt,
            verbose=True, memory=memory, allow_dangerous_requests=True,
        )
```

Verify the lifespan ordering established in Task 7 Step 8 — `init_registry()` must precede `build_llm_config()` so `as_langchain()` calls succeed:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && rg -n "init_registry|build_llm_config" app/main.py
```

Expected: `init_registry` line number lower than `build_llm_config` line number.

- [ ] **Step 10: Remove imports + delete old tests**

In `backend/app/core/llm_config.py`:
- Remove `from langchain_core.prompts import PromptTemplate` (no longer used)
- Remove the entire prompt-text + assembly block

Delete the legacy byte-equality test (the new golden fixtures + `test_as_langchain_byte_equal_to_render` + the one-shot equivalence test from Step 8 cover this):

```bash
rm /projects/Brewra/brewra-gtm-intelligence/backend/tests/unit/test_llm_config_prompts.py
```

**Do NOT delete `tests/_baselines/llm_config_prompt_strings.py` in this commit.** The one-shot equivalence test from Step 8 imports from it. Both files (`test_llm_config_migration_equivalence.py` + `_baselines/llm_config_prompt_strings.py`) form a pair and are retired together after one release cycle — recorded in the migration outcome doc.

- [ ] **Step 11: Run all llm_config-related tests + full suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_llm_config_migration_equivalence.py tests/unit/test_prompts_golden.py -v && pytest -x --no-header -q 2>&1 | tail -20
```

Expected: green.

- [ ] **Step 12: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/prompts/_shared/cypher_base.md.j2 backend/prompts/llm_config/ backend/tests/fixtures/prompts/_inputs/{cypher_gen,cypher_gen_alt,qa_scout,qa_scout_alt}.json backend/tests/fixtures/prompts/rendered/{cypher_gen,cypher_gen_alt,qa_scout,qa_scout_alt}.txt backend/app/core/llm_config.py backend/app/main.py backend/tests/unit/test_llm_config_migration_equivalence.py
git rm backend/tests/unit/test_llm_config_prompts.py
git commit -m "refactor(be): migrate llm_config Cypher+QA prompts via as_langchain"
```

---

## Task 12: Migrate `market_scoring/` inline prompt

**Goal:** The single inline `score_single_lead_against_market` prompt (`market_scoring/orchestrator.py:282-325`) moves to `backend/prompts/market_scoring/score_lead.md.j2` and the call site converts to `call_with_prompt()` (simple-invoke path; active model routing).

**Files:**
- Create: `backend/prompts/market_scoring/score_lead.md.j2`
- Create: `backend/tests/fixtures/prompts/_inputs/score_lead.json`
- Create: `backend/tests/fixtures/prompts/rendered/score_lead.txt`
- Modify: `backend/app/services/market_scoring/orchestrator.py`
- Modify: `backend/app/services/market_scoring/scoring.py`
- Modify: `backend/tests/unit/test_market_scoring.py`
- Modify: `backend/tests/test_market_scoring.py`

- [ ] **Step 1: Create `backend/prompts/market_scoring/score_lead.md.j2`**

Body extracted from the f-string at `market_scoring/orchestrator.py:292-325`:

```jinja
---
name: score_lead
version: 1.0.0
description: Score one lead against all five market-research components
model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
response_format: json
inputs:
  - component_keys_json
  - company_profile_json
  - lead_json
  - market_reports_json
---

You are scoring a sales lead fit against five market-research components.
Return strict JSON only.

Component keys (must match exactly):
{{ component_keys_json }}

Company profile:
{{ company_profile_json }}

Lead data:
{{ lead_json }}

Market research component reports:
{{ market_reports_json }}

Return JSON schema:
{
  "component_scores": {
    "market size & opportunity": <number 0-100>,
    "industry trends report": <number 0-100>,
    "competitor landscape": <number 0-100>,
    "regulatory & compliance highlights": <number 0-100>,
    "market entry & growth strategy": <number 0-100>
  },
  "component_descriptions": {
    "market size & opportunity": "<short reason>",
    "industry trends report": "<short reason>",
    "competitor landscape": "<short reason>",
    "regulatory & compliance highlights": "<short reason>",
    "market entry & growth strategy": "<short reason>"
  }
}
```

The JSON-schema example uses single braces — Jinja2 handles `{`/`}` as literals so no escaping needed (spec §3.4 "JSON-example handling"). The leading newline after the `---` fence preserves the existing f-string's leading newline for byte-equality.

- [ ] **Step 2: Byte-parity check + generate canonical inputs + golden fixture**

The legacy prompt is an inline f-string at `market_scoring/orchestrator.py:292-325`. Reconstruct it in a parity-check script (copy the body verbatim from the file) and compare against the new render output:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python -c "
import json
from pathlib import Path
from app.core.prompts import init_registry, render
from app.models.market_scoring import MARKET_SCORE_COMPONENT_KEYS
init_registry(root=Path('prompts'))

company_profile = {'name': 'Acme'}
lead = {'lead_id': 'L-1'}
market_reports = {'a': 'b'}

# Legacy f-string body — copied verbatim from market_scoring/orchestrator.py:292-325.
# If you edit this for the migration, you must mirror the edit on the source side
# until the migration commit lands.
legacy = f'''
You are scoring a sales lead fit against five market-research components.
Return strict JSON only.

Component keys (must match exactly):
{json.dumps(MARKET_SCORE_COMPONENT_KEYS)}

Company profile:
{json.dumps(company_profile, default=str)}

Lead data:
{json.dumps(lead, default=str)}

Market research component reports:
{json.dumps(market_reports, default=str)}

Return JSON schema:
{{{{
  \"component_scores\": {{{{
    \"market size & opportunity\": <number 0-100>,
    \"industry trends report\": <number 0-100>,
    \"competitor landscape\": <number 0-100>,
    \"regulatory & compliance highlights\": <number 0-100>,
    \"market entry & growth strategy\": <number 0-100>
  }}}},
  \"component_descriptions\": {{{{
    \"market size & opportunity\": \"<short reason>\",
    \"industry trends report\": \"<short reason>\",
    \"competitor landscape\": \"<short reason>\",
    \"regulatory & compliance highlights\": \"<short reason>\",
    \"market entry & growth strategy\": \"<short reason>\"
  }}}}
}}}}
'''

new = render('score_lead',
    component_keys_json=json.dumps(MARKET_SCORE_COMPONENT_KEYS),
    company_profile_json=json.dumps(company_profile, default=str),
    lead_json=json.dumps(lead, default=str),
    market_reports_json=json.dumps(market_reports, default=str),
).body
print('PARITY OK' if legacy == new else f'MISMATCH (legacy len={len(legacy)}, new len={len(new)})')
"
```

Expected: `PARITY OK`. The shell-escaping for the JSON-schema braces is `{{{{` → `{{` (Python f-string escape) → `{` (final output). If MISMATCH, fix the `.md.j2` or the shell-escaping in the parity script.

Then generate canonical inputs + fixture:

`backend/tests/fixtures/prompts/_inputs/score_lead.json`:

```json
{
  "component_keys_json": "[\"market size & opportunity\", \"industry trends report\", \"competitor landscape\", \"regulatory & compliance highlights\", \"market entry & growth strategy\"]",
  "company_profile_json": "{\"name\": \"Acme\", \"industry\": \"SaaS\"}",
  "lead_json": "{\"lead_id\": \"L-1\", \"company_name\": \"TestCo\"}",
  "market_reports_json": "{\"market size & opportunity\": {\"score\": 85}}"
}
```

Then:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python tests/regen_prompt_fixtures.py score_lead && pytest tests/unit/test_prompts_golden.py -v -k market_scoring
```

Expected: fixture generated, golden test passes.

- [ ] **Step 3: Rewrite `score_single_lead_against_market` call site**

Edit `backend/app/services/market_scoring/orchestrator.py`. Replace the function body (lines 282-353) with `call_with_prompt` usage:

```python
import json
from typing import Any, Dict, List, Optional, Tuple

# ... (existing imports above)
from app.services._llm_helpers import call_with_prompt


def score_single_lead_against_market(
    llm2,  # kept in signature for backward compat with callers; ignored in v1
    lead: Dict[str, Any],
    company_profile: Dict[str, Any],
    market_reports: Dict[str, Dict[str, Any]],
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Score one lead against all five market components with explanations.

    Returns (scoring_payload, prompt_meta) — caller (scoring.py) passes prompt_meta
    to _persist_market_score_for_lead which adds it to the Mongo doc.

    The `llm2` argument is retained for signature compatibility; the LLM is now
    resolved from front-matter `model:` via the LLM factory at call time.
    """
    response, prompt_meta = call_with_prompt(
        "score_lead",
        component_keys_json=json.dumps(MARKET_SCORE_COMPONENT_KEYS),
        company_profile_json=json.dumps(company_profile, default=str),
        lead_json=json.dumps(lead, default=str),
        market_reports_json=json.dumps(market_reports, default=str),
    )
    content = getattr(response, "content", response)
    parsed = _clean_and_parse_json(content)
    scores = parsed.get("component_scores", {}) if isinstance(parsed, dict) else {}
    descriptions = parsed.get("component_descriptions", {}) if isinstance(parsed, dict) else {}

    normalized_scores: Dict[str, float] = {}
    normalized_descriptions: Dict[str, str] = {}
    for component in MARKET_SCORE_COMPONENT_KEYS:
        raw_score = scores.get(component, 0)
        try:
            score = float(raw_score)
        except (TypeError, ValueError):
            score = 0.0
        score = max(0.0, min(100.0, score))
        normalized_scores[component] = round(score, 2)

        description = descriptions.get(component)
        if not isinstance(description, str) or not description.strip():
            description = "Score generated with limited evidence from available lead/profile context."
        normalized_descriptions[component] = description.strip()

    total_score = round(sum(normalized_scores.values()) / float(len(MARKET_SCORE_COMPONENT_KEYS)), 2)
    return {
        "component_scores": normalized_scores,
        "component_descriptions": normalized_descriptions,
        "market_total_score": total_score,
    }, prompt_meta
```

Remove the now-unused `from langchain_core.messages import HumanMessage` import at the top of the file (the helper does its own `HumanMessage` wrap).

- [ ] **Step 4: Thread `prompt_meta` through `_persist_market_score_for_lead`**

Update `_persist_market_score_for_lead` in the same file to accept `prompt_meta`:

```python
def _persist_market_score_for_lead(
    driver,
    mongo,
    user_id: str,
    org_id: str,
    lead: Dict[str, Any],
    scoring_payload: Dict[str, Any],
    run_id: str,
    scoring_status: str = "completed",
    score_coll=None,
    prompt_meta: Optional[Dict[str, Any]] = None,  # new
) -> None:
    # ... existing body ...
    local_score_coll.update_one(
        {"org_id": org_id, "lead_id": lead_id},
        {
            "$set": {
                # ... existing fields ...
                "prompt_meta": prompt_meta or {},
                # ... rest ...
            },
            "$setOnInsert": {"created_at": now_iso},
        },
        upsert=True,
    )
    # ... Neo4j update (unchanged) ...
```

- [ ] **Step 5: Update `scoring.py` to pass `prompt_meta` down**

Edit `backend/app/services/market_scoring/scoring.py`. Find the call to `score_single_lead_against_market(...)` (likely inside `_run_market_scoring_for_org` loop) and unpack the tuple:

```python
scoring_payload, prompt_meta = score_single_lead_against_market(llm2, lead, company_profile, market_reports)
_persist_market_score_for_lead(driver, mongo, user_id, org_id, lead, scoring_payload, run_id, scoring_status, score_coll, prompt_meta=prompt_meta)
```

- [ ] **Step 6: Rewrite substring assertions in market_scoring tests**

Apply the icp pattern to `backend/tests/unit/test_market_scoring.py` and `backend/tests/test_market_scoring.py`. Tests likely mock `llm2.invoke` — extend to capture `prompt_meta` from the inserted Mongo doc instead.

The tests must register a fake LLM in `_LLM_FACTORY` for `Qwen/Qwen3-235B-A22B-Instruct-2507-tput` since `call_with_prompt` resolves the LLM via the factory. Snapshot/restore pattern (mirrors the `isolated_llm_factory` fixture from Task 7 Step 1, but autouse with a pre-registered fake):

```python
@pytest.fixture(autouse=True)
def _fake_qwen_in_factory():
    """Register a fake Qwen LLM in the factory for this test module.
    Snapshots/restores factory + cache state so other test modules' LLM
    registrations (production Qwen/Groq from build_llm_config) survive."""
    from app.services import _llm_helpers
    factory_snapshot = dict(_llm_helpers._LLM_FACTORY)
    cache_snapshot = dict(_llm_helpers._LLM_CACHE)
    _llm_helpers._LLM_CACHE.clear()
    _llm_helpers._LLM_FACTORY["Qwen/Qwen3-235B-A22B-Instruct-2507-tput"] = lambda: _FAKE_LLM
    yield
    _llm_helpers._LLM_FACTORY.clear()
    _llm_helpers._LLM_FACTORY.update(factory_snapshot)
    _llm_helpers._LLM_CACHE.clear()
    _llm_helpers._LLM_CACHE.update(cache_snapshot)
```

- [ ] **Step 7: Run market_scoring tests + full suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_market_scoring.py tests/test_market_scoring.py -v && pytest -x --no-header -q 2>&1 | tail -20
```

Expected: green.

- [ ] **Step 8: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/prompts/market_scoring/ backend/tests/fixtures/prompts/_inputs/score_lead.json backend/tests/fixtures/prompts/rendered/score_lead.txt backend/app/services/market_scoring/orchestrator.py backend/app/services/market_scoring/scoring.py backend/tests/unit/test_market_scoring.py backend/tests/test_market_scoring.py
git commit -m "refactor(be): migrate market_scoring inline prompt via call_with_prompt"
```

---

## Task 13: Migrate audit-discovered services (conditional)

**Goal:** Migrate any inline prompts the Phase 0 audit surfaced beyond the §2.1 baseline (e.g. in `customer_profile/`, `leads/`, `pipeline/`, `data_sources/`, `profiles/`, `org_auth/`, `graph_chat/`).

**If Phase 0 surfaced zero additional prompts beyond the §2.1 baseline: skip this task. Record "no audit-discovered prompts" in the migration outcome (Task 15).**

**Files:** depend on audit output.

- [ ] **Step 1: For each audit-discovered prompt, apply the appropriate recipe**

- **simple-invoke** → `call_with_prompt` (Task 12 pattern)
- **agent-chain** → `prompts.render()` + manual `prompt_meta_from()` (Task 8 pattern)
- **custom-dispatch** → `prompts.render()` + manual `prompt_meta_from()`, body passed to custom HTTP/SDK call (Task 9 signals_signal_ask_claude pattern)

Each audit-discovered service gets its own per-service subdirectory (`backend/prompts/<svc>/`).

- [ ] **Step 2: For each, generate fixtures + run golden tests + rewrite test substring assertions**

Same protocol as Tasks 8-12.

- [ ] **Step 3: For `health.py:probe_llm` — apply the deferral recommendation per spec §2.1**

The 1-line smoke-test prompt is a candidate "intentionally deferred." Migration ROI is near-zero. If the Phase 0 audit's recommendation is to defer, record it in the migration outcome and leave the inline prompt in place.

If the audit author chose to migrate it anyway, follow the simple-invoke recipe — and accept the slight oddity of a 1-line prompt file (`backend/prompts/health/probe_llm.md.j2`).

- [ ] **Step 4: Commit each audit-discovered migration as its own commit**

One commit per service (per spec's "all-or-nothing PR" rule for service-level migrations).

---

# Phase 3 — Cleanup + migration outcome report

## Task 14: Write `docs/PROMPTS.md` + resolve TD-010

**Goal:** Document the system as it exists post-migration. Update `docs/TECH_DEBT.md` to mark TD-010 resolved with PR references.

**Files:**
- Create: `docs/PROMPTS.md`
- Modify: `docs/TECH_DEBT.md`

- [ ] **Step 1: Write `docs/PROMPTS.md`**

Cover:
1. Where prompts live (`backend/prompts/<svc>/`, `_shared/`)
2. Front-matter schema with the table from spec §3.2
3. Defaults inheritance (`_shared/defaults.yaml`)
4. Include conventions (`{% include 'PATH' %}` own-line, depth 1, `_shared/` partials not callable)
5. JSON-example handling (single braces, no escaping needed — the win over `.format()`)
6. How to add a new prompt: file path convention, naming (`<svc>_<file_stem>`), `pre_data` style inputs, regen the fixture
7. The three invocation patterns and which uses what:
   - simple-invoke → `call_with_prompt(name, **inputs)` (active model routing)
   - agent-chain → `prompts.render(name, **inputs)` + `prompt_meta_from()` (observability-only model)
   - custom-dispatch → same as agent-chain
   - langchain → `as_langchain(name)` returns a LangChain `PromptTemplate`
8. The `prompt_meta` observability sub-doc — schema, where it lives in Mongo, what queries it enables
9. The regen-fixtures workflow
10. Limitations recorded for v2: failure-path `prompt_meta` not persisted; agent-chain `model` field is observability-only; no Mongo index on `prompt_meta.*`
11. **Service-scoped include-only sub-templates.** `signals_leads_section`, `signals_leads_section_fallback`, and `signals_existing_headlines_section` live under `signals/` (not `_shared/`) because they're specific to the signals service. They're registered as callable so they get their own golden-fixture coverage, but they're invoked only via `{% include %}` from `signals_scout_search` / `signals_profiler_search` — not via direct `prompts.render()` calls from production code. If `list_prompts()` is being used to enumerate "top-level prompts the system exposes," filter to entries whose stems do **not** end in `_section` or `_section_fallback`. Future service-scoped sub-templates should follow the same naming pattern.

- [ ] **Step 2: Update `docs/TECH_DEBT.md`**

Find the TD-010 section and add a resolution header at the top:

```markdown
## TD-010 — Overhaul prompt management system

**Status:** RESOLVED 2026-MM-DD via plan-13 ([spec](../specs/13-prompt-management-design.md), [plan](../plans/13-prompt-management.md)).

**Resolution summary:** Every prompt in `backend/` now lives under `backend/prompts/<svc>/` with YAML front-matter, served by `app/core/prompts.py`. Per-LLM-call `prompt_meta` (name, version, content_hash, render_inputs_hash, model, rendered_at) is persisted alongside output in Mongo. Shared partials in `_shared/` compose into callable prompts. See [`docs/PROMPTS.md`](PROMPTS.md) for the system as it exists; see [`docs/prompt-migration-outcome.md`](prompt-migration-outcome.md) for the audit trail of what migrated, what was deferred, and why.

**PR references:** [commit list, populated when commits exist]

---

[... original TD-010 body kept below as historical context ...]
```

- [ ] **Step 3: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/PROMPTS.md docs/TECH_DEBT.md
git commit -m "docs(prompts): add PROMPTS.md + resolve TD-010"
```

---

## Task 15: Write `docs/prompt-migration-outcome.md`

**Goal:** Frozen historical record of the migration. Every Phase 0 audit-surfaced location appears with one of three dispositions (Migrated / Intentionally deferred / Unmigratable). Spec §4 "Migration outcome report" defines the structure exactly.

**Files:**
- Create: `docs/prompt-migration-outcome.md`
- Delete: `docs/prompt-inventory.md` (its content folds into the outcome doc)

- [ ] **Step 1: Write `docs/prompt-migration-outcome.md`**

Use the structure from spec §4:

```markdown
# Prompt migration outcome — Plan 13

**Date:** YYYY-MM-DD (last commit of Phase 3)
**Plan:** [`plans/13-prompt-management.md`](../plans/13-prompt-management.md)
**Spec:** [`specs/13-prompt-management-design.md`](../specs/13-prompt-management-design.md)
**Resolves:** TD-010

This document is the frozen audit trail of the prompt-management migration. Every prompt location surfaced in the Phase 0 audit appears here with its disposition. It records what happened during the migration; it does not track ongoing state. See [`docs/PROMPTS.md`](PROMPTS.md) for the current system.

## Summary

- Total audit-surfaced locations: N
- Migrated: A
- Intentionally deferred: B (each with a TD entry if ongoing implications)
- Unmigratable: C (each with a follow-up: delete dead path or new TD)

## Migrated

| Audit ID | Old location | New prompt name | Version at migration | Content hash at migration | Migration commit |
|---|---|---|---|---|---|
| P-001 | `app/services/market_research/prompts.py:RESEARCH_MARKET_1_TEMPLATE` | `market_research_research_market_1` | 1.0.0 | `<sha256>` | `<commit-sha>` |
| ... | | | | | |

## Intentionally deferred

| Audit ID | Old location | Reason | New TD ref |
|---|---|---|---|
| P-NNN | `app/services/health.py:10` (probe_llm) | Migration ROI ~zero — 1-line diagnostic prompt, no non-engineer iteration, no observability value on a smoke probe | None (no ongoing debt) |
| ... | | | |

## Unmigratable

| Audit ID | Old location | Blocker | Follow-up |
|---|---|---|---|
| (likely none) | | | |

## Notes

- The one-shot equivalence test `tests/unit/test_llm_config_migration_equivalence.py` (added in Task 11 Step 8) is scheduled for deletion after one release cycle. Its job is byte-equality validation during migration review; the `as_langchain` parity test + golden fixtures cover the same ground going forward.
- No retroactive backfill of `prompt_meta` onto pre-migration Mongo documents. Observability coverage closes service-by-service as the migration progresses (spec §2.2).
- The `model` field on `signals_signal_ask_claude` is recorded as `claude-sonnet` for observability but does not drive routing in v1 (custom-dispatch path). Active model routing for that path is a v2 concern.
- This doc is frozen after merge. Future drift in the prompt system is captured in `docs/PROMPTS.md`, not here.
```

- [ ] **Step 2: Delete the Phase 0 inventory doc**

The inventory was a working artifact for Phase 1/2 planning. Its contents are now in the outcome doc above. Delete it:

```bash
rm /projects/Brewra/brewra-gtm-intelligence/docs/prompt-inventory.md
```

- [ ] **Step 3: Verify spec §6 Definition of Done**

For each item in spec §6, check:

1. `backend/prompts/` contains every audit-surfaced prompt minus deferred/unmigratable — confirmed by Task 15 outcome doc.
2. No service has a `prompts.py` (except recorded deferrals):
   ```bash
   cd /projects/Brewra/brewra-gtm-intelligence/backend && find app/services -name 'prompts.py'
   ```
   Expected: empty output.
3. Every migrated prompt has a golden fixture:
   ```bash
   cd /projects/Brewra/brewra-gtm-intelligence/backend && python -c "
   from pathlib import Path
   from app.core.prompts import init_registry, list_prompts
   init_registry(root=Path('prompts'))
   fixture_dir = Path('tests/fixtures/prompts/rendered')
   for p in list_prompts():
       fp = fixture_dir / f\"{p['name']}.txt\"
       assert fp.exists(), f'missing fixture for {p[\"name\"]}'
   print('all fixtures present')
   "
   ```
4. Tests pass:
   ```bash
   cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/unit/test_prompts_loader.py tests/unit/test_prompts_golden.py -v
   ```
5. Persistence writes `prompt_meta` — spot-check one Mongo write per service via the existing service tests (`test_icp.py`, `test_signals.py`, etc.).
6. `docs/PROMPTS.md` exists — confirmed by Task 14.
7. `docs/prompt-migration-outcome.md` exists — this task.
8. TD-010 resolved — confirmed by Task 14.
9. No substring-on-prompt-body assertions remain:
   ```bash
   cd /projects/Brewra/brewra-gtm-intelligence/backend && rg -n 'assert.*in.*PROMPT|assert.*in.*TEMPLATE' tests/
   ```
   Expected: empty output (or hits only on harmless tests).
10. Boot + full test suite green:
    ```bash
    cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest -x --no-header -q 2>&1 | tail -10
    ```

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/prompt-migration-outcome.md
git rm docs/prompt-inventory.md
git commit -m "docs(prompts): add migration outcome report; remove inventory"
```

---

# Definition of done (mirrors spec §6)

After Task 15 lands, all of the following must hold:

1. `backend/prompts/` contains every prompt surfaced in the Phase 0 audit, minus items recorded "intentionally deferred" or "unmigratable" in `docs/prompt-migration-outcome.md`.
2. No `prompts.py` exists in any `app/services/<svc>/` directory (except where the outcome doc records deferral).
3. Every migrated prompt has a golden rendered fixture under `backend/tests/fixtures/prompts/rendered/`.
4. `pytest backend/tests/unit/test_prompts_loader.py backend/tests/unit/test_prompts_golden.py` passes.
5. Every service's persistence calls write a `prompt_meta` sub-doc alongside LLM output (verified by spot-check tests).
6. `docs/PROMPTS.md` describes the system as it exists.
7. `docs/prompt-migration-outcome.md` lists every audit-surfaced location with its disposition.
8. TD-010 in `docs/TECH_DEBT.md` is marked RESOLVED with PR references.
9. No substring-on-prompt-body assertions remain in the test suite.
10. Boot succeeds. Full test suite passes.

---

# Notes for the executor

- **Each task is one commit.** Don't batch.
- **TDD per step.** Write the failing test → see it fail → implement → see it pass → commit.
- **Don't restart in-flight services.** Lifespan-wired changes (Task 7, 11 ordering) need a clean process. If running the dev server, restart it after Task 7 lands.
- **Patch-where-used.** When writing tests that mock `init_registry` or `call_with_prompt`, patch at the call site's import namespace (see `backend/TESTING.md`). Spec §3.3 "Module-level singleton pattern" explains why both `app.state.prompts` and `app.core.prompts._registry` exist — tests for handler code can patch either; tests for non-handler code patch `app.core.prompts._registry`.
- **The verbatim-extraction protocol matters.** Byte drift between legacy prompts and migrated `.md.j2` files breaks the LLM behavior contract (spec §1: "no behavioral change"). The Task 11 Step 8 one-shot equivalence test catches Cypher+QA drift; signals/icp/market_research/market_scoring don't have legacy baselines, so spot-check with the golden fixture against a known-good output.
- **If `BootFailure` raises during local dev:** read the entire failure list, not just the first entry. The loader aggregates by design.
- **The audit is canonical.** If Phase 0 surfaces a prompt this plan didn't anticipate, route it through Task 13 — don't shoehorn it into Tasks 8-12's scope.
