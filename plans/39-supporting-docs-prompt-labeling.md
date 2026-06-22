# Supporting-Documents Prompt Labeling (WS2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface Pinecone-retrieved org documents as a distinct, labeled prompt section on every Scout/Profiler generation surface (signals scout+profiler, market-research, ICP), stop leaking them into the company-profile JSON blob, fix the profiler drop, and align the `signal_ask` label to one shared formatter.

**Architecture:** A single pure helper `format_supporting_documents(rows)` (in `app/services/_retrieval.py`) turns the raw match-rows into a JSON string (de-duping the redundant `metadata.text`/`page_content`). A single guarded Jinja partial `prompts/_shared/supporting_documents_section.md.j2` carries the label + `{{ supporting_documents }}` once and is `{% include %}`-d by all 11 generation templates (boot-inlined by the loader). Each generation orchestrator threads a `supporting_documents` render variable through to `prompts.render(...)` and stops stamping `pinecone_*` keys onto the profile/context dict. `signal_ask` (no D1 defect) reuses the same helper + aligned label wording in Python.

**Tech Stack:** Python 3.12 / FastAPI backend, Jinja2 prompt loader (`app/core/prompts.py`), pytest + pytest-mock, golden-fixture regen scripts under `backend/tests/`.

## Global Constraints

- **Backend-only change.** No frontend, no `npm`. WS1 (`org_id` wire fix) is already done on `fix-signals-batch-org-id` and is out of scope.
- **Branch:** implement on the current branch `fix-supporting-docs-labeling` (which already carries the Spec 39 + this plan commits). One commit per task; subjects use `type(scope):` form; **no `Co-Authored-By` footer**. Commit by explicit path (never `git add -A`).
- **Run tests via the worktree venv:** `.venv/bin/python -m pytest <path> -q`, run from `backend/`. The worktree's `backend/.venv` is a symlink to the main checkout's venv (already created this session). The `asyncio_mode` config warning is pre-existing noise — ignore it.
- **Merge gate is the backend pytest suite + review** (the controller-run `npm run preflight` is frontend-only and does not apply here). There is no backend preflight runner.
- **Helper contract:** pure, total, **never raises** (`json.dumps(..., default=str)` tolerates numpy/Decimal `score` + arbitrary metadata); **non-mutating** (operates on shallow copies); returns `None` for empty/`None` input; **strips `text` and `page_content` from each row's `metadata`** (M2 de-dupe — they duplicate `content`).
- **Threading is by KEYWORD, never positional before `llm_backend`.** In market-research and ICP, the `_CLAUDE` dispatch lambdas pass `"claude"` positionally; a positional `supporting_documents` inserted before `llm_backend` would bind `"claude"`→docs and silently revert the Claude path to the Qwen default.
- **Label single-source caveat:** the label text lives in the Jinja partial for the 11 template surfaces (the single source for those) and is duplicated once as a Python constant in `ask.py` (the Jinja/Python boundary makes true single-source impractical — AC4 scopes "single source" to template surfaces). The two copies **must be byte-identical**; the exact string is given verbatim in Task 2 and Task 5.
- **Version bump:** bump each of the 11 edited templates' `version:` from `1.0.0` to `1.1.0`; the new partial stays `1.0.0`.
- **Spec divergence (verified against code, encode here):** Spec §"Testing" says to regenerate `captured/signal_ask_{qwen,claude}.json` because they "embed the runtime context string carrying the old label." **This premise is false** — those captured files are LLM-**output** stubs (`{"output": "...", "_stub": true}`) that contain no context string and no label; all 24 `captured/*.json` are hand-written stubs pending live API keys. Therefore **no `captured/` fixture is regenerated** in this plan (and `tests/capture_fixtures.py` requires live keys we do not use). Only the deterministic `rendered/` golden fixtures for the 11 edited templates are regenerated (Task 6).

---

## File Structure

**Created:**
- `backend/prompts/_shared/supporting_documents_section.md.j2` — the shared guarded label partial (Task 2).
- `backend/tests/unit/test_retrieval.py` — unit tests for the new helper (Task 1).

**Modified — services:**
- `backend/app/services/_retrieval.py` — add `format_supporting_documents` helper (Task 1).
- `backend/app/services/signals/search.py` — compute + thread `supporting_documents`; widen `context_json` exclude list (Task 2).
- `backend/app/services/market_research/orchestrator.py` — thread `supporting_documents` (keyword); drop `pinecone_*` from `company_profile` (Task 3).
- `backend/app/services/icp/orchestrator.py` — thread `supporting_documents` (keyword); drop `pinecone_*` from `context_data` (Task 4).
- `backend/app/services/signals/ask.py` — replace bespoke `DATA SOURCES` block with the shared helper + aligned label, both call sites (Task 5).

**Modified — prompt templates (`inputs:` += `supporting_documents`, add include, bump `version:` → 1.1.0):**
- `backend/prompts/signals/signals_scout_search.md.j2`, `signals_profiler_search.md.j2` (Task 2).
- `backend/prompts/market_research/research_market_1..5.md.j2` (Task 3).
- `backend/prompts/icp/icp_research_1..4.md.j2` (Task 4).

**Modified — tests:**
- `backend/tests/unit/test_signals.py` — update 2 version asserts; add 2 run_signals_research tests (Task 2).
- `backend/tests/unit/test_market_research.py` — add 1 through-orchestrator test (Task 3).
- `backend/tests/unit/test_icp.py` — add 1 through-orchestrator test (Task 4).

**Modified — fixtures (Task 6):**
- `backend/tests/fixtures/prompts/_inputs/<name>.json` for the 11 edited templates (add `supporting_documents` key).
- `backend/tests/fixtures/prompts/rendered/<name>.txt` for the 11 (regenerated).

---

## Task 1: `format_supporting_documents` helper

**Files:**
- Modify: `backend/app/services/_retrieval.py` (append at end of file, after line 113)
- Test: `backend/tests/unit/test_retrieval.py` (create)

**Interfaces:**
- Consumes: nothing (pure stdlib `json`, already imported in `_retrieval.py`).
- Produces: `format_supporting_documents(rows: Optional[List[Dict[str, Any]]]) -> Optional[str]` — public module-level helper imported by `signals/search.py`, `market_research/orchestrator.py`, `icp/orchestrator.py`, `signals/ask.py` in later tasks. Returns a `json.dumps(..., indent=2, default=str)` string of the rows with each row's `metadata.text` / `metadata.page_content` stripped; `None` when `rows` is empty/`None`. Never raises; never mutates the input.

> **Naming note:** the spec (§1) names this `format_supporting_documents` (public, no leading underscore). The module's other helpers are underscore-prefixed, but they are cross-module imports too; we follow the spec's name verbatim because it is the reviewed contract and the function is a shared cross-surface formatter. Do not rename it.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/test_retrieval.py`:

```python
# backend/tests/unit/test_retrieval.py
"""Unit tests for app/services/_retrieval.format_supporting_documents."""
import json
from decimal import Decimal

from app.services._retrieval import format_supporting_documents


def test_format_supporting_documents_none_and_empty_return_none():
    assert format_supporting_documents(None) is None
    assert format_supporting_documents([]) is None


def test_format_supporting_documents_emits_content_and_other_metadata():
    rows = [
        {
            "query": "buyer pain points",
            "id": "doc-1",
            "score": 0.91,
            "content": "ACME revenue grew 30% in Q3.",
            "metadata": {"source": "acme.pdf", "page": 2},
        }
    ]
    out = format_supporting_documents(rows)
    assert out is not None
    parsed = json.loads(out)
    assert parsed[0]["content"] == "ACME revenue grew 30% in Q3."
    assert parsed[0]["id"] == "doc-1"
    assert parsed[0]["query"] == "buyer pain points"
    assert parsed[0]["metadata"]["source"] == "acme.pdf"
    assert parsed[0]["metadata"]["page"] == 2


def test_format_supporting_documents_dedupes_redundant_metadata_text():
    """metadata.text / metadata.page_content duplicate `content` — strip them,
    keep `content` and all other metadata, and do not mutate the input."""
    rows = [
        {
            "query": "q",
            "id": "d",
            "score": 0.5,
            "content": "Chunk text about pricing.",
            "metadata": {
                "source": "a.pdf",
                "text": "Chunk text about pricing.",
                "page_content": "Chunk text about pricing.",
                "page": 1,
            },
        }
    ]
    out = format_supporting_documents(rows)
    parsed = json.loads(out)
    # redundant keys stripped from metadata
    assert "text" not in parsed[0]["metadata"]
    assert "page_content" not in parsed[0]["metadata"]
    # content + other metadata survive
    assert parsed[0]["content"] == "Chunk text about pricing."
    assert parsed[0]["metadata"]["source"] == "a.pdf"
    assert parsed[0]["metadata"]["page"] == 1
    # the chunk text appears exactly once (no duplication)
    assert out.count("Chunk text about pricing.") == 1
    # input rows are NOT mutated
    assert rows[0]["metadata"]["text"] == "Chunk text about pricing."
    assert rows[0]["metadata"]["page_content"] == "Chunk text about pricing."


def test_format_supporting_documents_tolerates_non_json_native_score():
    """score may be a numpy float / Decimal depending on the Pinecone client —
    default=str must serialise it without raising."""
    rows = [{"query": "q", "id": "d", "score": Decimal("0.87"), "content": "x", "metadata": {}}]
    out = format_supporting_documents(rows)
    assert isinstance(out, str)
    assert "0.87" in out


def test_format_supporting_documents_tolerates_rows_missing_keys():
    """ask.py passes rows like {"content": ..., "score": ...} with no metadata/id/query."""
    rows = [{"content": "DATA_SOURCE_SENTINEL", "score": 0.8}]
    out = format_supporting_documents(rows)
    assert "DATA_SOURCE_SENTINEL" in out
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/unit/test_retrieval.py -q`
Expected: FAIL with `ImportError: cannot import name 'format_supporting_documents'`.

- [ ] **Step 3: Implement the helper**

In `backend/app/services/_retrieval.py`, append at the **end of the file** (after the final `return []` of `_fetch_pinecone_supporting_context`, line 113), separated by two blank lines. (`json`, `Optional`, `List`, `Dict`, `Any` are already imported at the top — no new imports.)

```python
def format_supporting_documents(rows: Optional[List[Dict[str, Any]]]) -> Optional[str]:
    """Format Pinecone supporting-document rows into a labeled-section body.

    Turns the rows returned by ``_fetch_pinecone_supporting_context`` into a
    pretty-printed JSON array string, or ``None`` when there is nothing to
    show. Each row's ``metadata.text`` / ``metadata.page_content`` is stripped
    before serialising because it duplicates ``content`` (avoids emitting each
    chunk's text twice per generation call). Distinct fields
    (``query``/``id``/``score``/``content`` + all other metadata) are kept.

    Pure and total: never raises (``default=str`` tolerates numpy/Decimal
    ``score`` and arbitrary metadata) and never mutates the input rows.
    """
    if not rows:
        return None
    cleaned: List[Dict[str, Any]] = []
    for row in rows:
        new_row = dict(row)
        metadata = row.get("metadata")
        if isinstance(metadata, dict):
            new_row["metadata"] = {
                k: v for k, v in metadata.items() if k not in ("text", "page_content")
            }
        cleaned.append(new_row)
    try:
        return json.dumps(cleaned, indent=2, default=str)
    except Exception:
        return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/unit/test_retrieval.py -q`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git -C /projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/fix-supporting-docs-labeling add backend/app/services/_retrieval.py backend/tests/unit/test_retrieval.py
git -C /projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/fix-supporting-docs-labeling commit -m "feat(be): add format_supporting_documents retrieval helper"
```

---

## Task 2: Signals surface — shared partial + scout/profiler threading

This task creates the shared partial (used by all 11 templates) and wires the first surface (signals).

**Files:**
- Create: `backend/prompts/_shared/supporting_documents_section.md.j2`
- Modify: `backend/app/services/signals/search.py`
- Modify: `backend/prompts/signals/signals_scout_search.md.j2`
- Modify: `backend/prompts/signals/signals_profiler_search.md.j2`
- Test: `backend/tests/unit/test_signals.py`

**Interfaces:**
- Consumes: `format_supporting_documents` from Task 1.
- Produces: the partial `_shared/supporting_documents_section.md.j2` (included by Tasks 3–4 too); a `supporting_documents` render kwarg on the two signals templates. No public Python signature changes (`search_signals` computes `supporting_documents` internally).

- [ ] **Step 1: Create the shared partial**

Create `backend/prompts/_shared/supporting_documents_section.md.j2`. The label line below is the **single source of truth** for the template surfaces; Task 5 copies it verbatim into `ask.py`.

```
---
name: supporting_documents_section
version: 1.0.0
description: Labeled section for Pinecone-retrieved org documents; included by Scout/Profiler generation prompts. Omitted when no documents retrieved.
---
{% if supporting_documents %}
SUPPORTING DOCUMENTS (retrieved from your organization's uploaded knowledge base — treat as corroborating evidence and cite where relevant; these are NOT the company's declared profile fields):
{{ supporting_documents }}
{% endif %}
```

- [ ] **Step 2: Add the include + input to both signals templates, bump version**

In `backend/prompts/signals/signals_scout_search.md.j2`:

(a) In the frontmatter (lines 1–15), change `version: 1.0.0` to `version: 1.1.0`, and add `  - supporting_documents` as the last entry of the `inputs:` list:

```
inputs:
  - context_json
  - leads
  - leads_count
  - leads_json
  - signal_label
  - existing_headlines
  - headlines_list
  - supporting_documents
```

(b) Insert the include on the blank line (line 31) between the `existing_headlines` `{% endif %}` and `STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):`. The exact old/new text:

Old:
```
{% if existing_headlines %}
{% include 'signals/signals_existing_headlines_section.md.j2' %}
{% endif %}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
```
New:
```
{% if existing_headlines %}
{% include 'signals/signals_existing_headlines_section.md.j2' %}
{% endif %}

{% include '_shared/supporting_documents_section.md.j2' %}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
```

In `backend/prompts/signals/signals_profiler_search.md.j2`: apply the **identical** two edits — bump `version: 1.0.0` → `1.1.0`, append `  - supporting_documents` to `inputs:`, and insert the same `{% include '_shared/supporting_documents_section.md.j2' %}` at the same boundary (the profiler file is structurally identical through this region; its STEP 1 header text differs but the leads/headlines/STEP-2 block is the same).

- [ ] **Step 3: Thread `supporting_documents` through `search_signals`**

In `backend/app/services/signals/search.py`:

(a) Add `format_supporting_documents` to the existing `_retrieval` import (lines 20–23):

Old:
```python
from app.services._retrieval import (
    _build_signal_context_queries,
    _fetch_pinecone_supporting_context,
)
```
New:
```python
from app.services._retrieval import (
    _build_signal_context_queries,
    _fetch_pinecone_supporting_context,
    format_supporting_documents,
)
```

(b) Widen the `context_json` exclude list so the pinecone scaffolding keys never leak into the profile blob (closes D1 on every signals path, incl. the profiler else-comprehension). The literal `["existing_headlines", "leads_data", "icp_data"]` appears **four** times (scout dict + scout str + profiler else + profiler str). Use a single `replace_all`:

Old (replace_all):
```python
{k: v for k, v in pre_data.items() if k not in ["existing_headlines", "leads_data", "icp_data"]}
```
New:
```python
{k: v for k, v in pre_data.items() if k not in ["existing_headlines", "leads_data", "icp_data", "pinecone_context_queries", "pinecone_supporting_context"]}
```

> Note: the profiler str-path comprehension uses `parsed.items()` not `pre_data.items()`. Verify the exact text before editing; if the four occurrences are not byte-identical, apply the same key-list extension to each occurrence individually. The intent: all four exclude lists gain `"pinecone_context_queries", "pinecone_supporting_context"`.

(c) Compute `supporting_documents` (dict-guarded — both real callers dict-ify `pre_data` first; the `str` path is defensive) immediately before `prompt_name` is resolved (line 129). Insert:

```python
    supporting_documents = None
    if isinstance(pre_data, dict):
        supporting_documents = format_supporting_documents(pre_data.get("pinecone_supporting_context"))

    prompt_name = "signals_scout_search" if persona == "scout" else "signals_profiler_search"
```

(d) Pass it to the single shared `prompts.render(...)` call (lines 130–139). Add `supporting_documents=supporting_documents,` as the last kwarg:

```python
    rendered = prompts.render(
        prompt_name,
        context_json=context_json,
        leads=leads_data,
        leads_count=leads_count,
        leads_json=leads_json_str,
        signal_label=signal_label,
        existing_headlines=existing_headlines,
        headlines_list=headlines_list_str,
        supporting_documents=supporting_documents,
    )
```

- [ ] **Step 4: Update the two existing version asserts (they hit the real loader)**

In `backend/tests/unit/test_signals.py`, the two leaf tests render the real prompt and assert its version. Update both:

- Line 58 (`test_search_signals_scout_qwen_uses_captured`): `assert result["prompt_meta"]["version"] == "1.0.0"` → `assert result["prompt_meta"]["version"] == "1.1.0"`.
- Line 82 (`test_search_signals_profiler_claude_uses_captured`): `assert result["prompt_meta"]["version"] == "1.0.0"` → `assert result["prompt_meta"]["version"] == "1.1.0"`.

(The market-research/ICP version asserts use hand-built *fake* `prompt_meta` dicts and are unaffected by the template bump — leave them.)

- [ ] **Step 5: Write the failing signals tests**

In `backend/tests/unit/test_signals.py`, add a module-level sample-rows constant near the top (after the imports) and two new tests. The label + content assertions will fail until Steps 1–3 land; run after writing to confirm they pass (Steps 1–3 are already implemented above, so this is a confirm-green step — if you are doing strict red-first, stage Steps 1–3 after this).

```python
SUPPORTING_DOC_ROWS = [
    {
        "query": "scout signal opportunities",
        "id": "doc-chunk-1",
        "score": 0.91,
        "content": "ACME Corp announced 30% revenue growth and DACH expansion in Q3.",
        "metadata": {
            "source": "acme_q3.pdf",
            "text": "ACME Corp announced 30% revenue growth and DACH expansion in Q3.",
            "page": 2,
        },
    },
]


def test_run_signals_research_scout_labels_supporting_documents(
    mocker, mock_session, mock_mongo_client,
):
    """Scout signals prompt carries a distinct, labeled SUPPORTING DOCUMENTS
    section with the retrieved content, and the pinecone scaffolding keys no
    longer leak into the company-profile JSON blob (D1)."""
    captured = load_captured("search_signals_scout_qwen")
    chain_mock = MagicMock()
    chain_mock.invoke.return_value = {"output": json.dumps(captured)}
    mocker.patch(
        "app.services.signals.search._fetch_pinecone_supporting_context",
        return_value=SUPPORTING_DOC_ROWS,
    )
    mocker.patch("app.services.signals.search.get_leads_for_org", return_value=([], 0))
    mocker.patch("app.services.signals.persistence._get_existing_headlines", return_value=[])
    mocker.patch("app.services.signals.persistence._get_user_icp_config", return_value=None)
    mocker.patch("app.services.signals.persistence._save_signal_and_track_headline", return_value=None)

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="scout", data={"industry": "SaaS", "region": "DACH"}, refresh=True,
    )
    result = asyncio.run(
        run_signals_research(mock_session._driver, mock_mongo_client, MagicMock(), chain_mock, request)
    )

    assert result["status"] == "success"
    prompt = chain_mock.invoke.call_args[0][0]["input"]
    assert "SUPPORTING DOCUMENTS" in prompt
    assert "ACME Corp announced 30% revenue growth" in prompt
    assert "pinecone_supporting_context" not in prompt
    assert "pinecone_context_queries" not in prompt


def test_run_signals_research_profiler_includes_supporting_documents(
    mocker, mock_session, mock_mongo_client,
):
    """D3 regression: the profiler signals branch (which previously rebuilt
    context_json from only {company_profile, icp_data} and dropped the docs)
    now includes the retrieved documents."""
    captured = load_captured("search_signals_profiler_qwen")
    chain_mock = MagicMock()
    chain_mock.invoke.return_value = {"output": json.dumps(captured)}
    mocker.patch(
        "app.services.signals.search._fetch_pinecone_supporting_context",
        return_value=SUPPORTING_DOC_ROWS,
    )
    mocker.patch("app.services.signals.search.get_leads_for_org", return_value=([], 0))
    mocker.patch("app.services.signals.persistence._get_existing_headlines", return_value=[])
    mocker.patch("app.services.signals.persistence._get_user_icp_config", return_value=None)
    mocker.patch("app.services.signals.persistence._save_signal_and_track_headline", return_value=None)

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="profiler", data={"industry": "SaaS"}, refresh=True,
    )
    result = asyncio.run(
        run_signals_research(mock_session._driver, mock_mongo_client, MagicMock(), chain_mock, request)
    )

    assert result["status"] == "success"
    prompt = chain_mock.invoke.call_args[0][0]["input"]
    assert "SUPPORTING DOCUMENTS" in prompt
    assert "ACME Corp announced 30% revenue growth" in prompt
    assert "pinecone_supporting_context" not in prompt
```

- [ ] **Step 6: Run signals tests + the prompt loader/golden boot**

Run:
```bash
.venv/bin/python -m pytest tests/unit/test_signals.py tests/unit/test_prompts_loader.py -q
```
Expected: PASS. The loader test confirms the new partial + edited templates boot cleanly (the AST check requires `supporting_documents` to be declared in both signals templates' `inputs:`, which Step 2 did). The two new signals tests pass; the two updated version asserts pass. `test_prompts_golden.py` is intentionally **not** run here — it will fail until fixtures are regenerated in Task 6.

- [ ] **Step 7: Commit**

```bash
git -C /projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/fix-supporting-docs-labeling add \
  backend/prompts/_shared/supporting_documents_section.md.j2 \
  backend/app/services/signals/search.py \
  backend/prompts/signals/signals_scout_search.md.j2 \
  backend/prompts/signals/signals_profiler_search.md.j2 \
  backend/tests/unit/test_signals.py
git -C /projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/fix-supporting-docs-labeling commit -m "feat(be): label retrieved docs in signals scout/profiler prompts"
```

---

## Task 3: Market-research surface

**Files:**
- Modify: `backend/app/services/market_research/orchestrator.py`
- Modify: `backend/prompts/market_research/research_market_1.md.j2` … `research_market_5.md.j2`
- Test: `backend/tests/unit/test_market_research.py`

**Interfaces:**
- Consumes: `format_supporting_documents` (Task 1); the partial (Task 2).
- Produces: `_run_research_component(component_n, agent_chain, pre_data, llm_backend="qwen", supporting_documents=None) -> tuple[dict, dict]` (new trailing keyword param); the dispatch lambdas gain a 3rd parameter `supporting_documents` forwarded by keyword; the `research_function` call site passes it positionally as the 3rd arg.

- [ ] **Step 1: Add the include + input to all 5 market templates, bump version**

For each of `research_market_1.md.j2` … `research_market_5.md.j2` in `backend/prompts/market_research/`:

(a) Frontmatter: change `version: 1.0.0` → `version: 1.1.0`; append `  - supporting_documents` to the `inputs:` list (each currently has only `  - company_profile_json`):

```
inputs:
  - company_profile_json
  - supporting_documents
```

(b) Insert the include after the `{{ company_profile_json }}` block (line 16) and before `STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):` (line 18). The old/new text (the `Company Profile Data:` + `{{ company_profile_json }}` lines are byte-identical across all 5):

Old:
```
Company Profile Data:
{{ company_profile_json }}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
```
New:
```
Company Profile Data:
{{ company_profile_json }}

{% include '_shared/supporting_documents_section.md.j2' %}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
```

- [ ] **Step 2: Thread `supporting_documents` through the orchestrator**

In `backend/app/services/market_research/orchestrator.py`:

(a) Add `format_supporting_documents` to the existing `_retrieval` import (lines 17–20). Append it to the imported names list.

(b) In `run_market_research`, **remove** the two lines that stamp pinecone onto the profile dict (lines 154–155) and **compute** `supporting_documents` from the already-fetched `pinecone_context`:

Old:
```python
    company_profile["pinecone_context_queries"] = market_context_queries
    company_profile["pinecone_supporting_context"] = pinecone_context
```
New:
```python
    supporting_documents = format_supporting_documents(pinecone_context)
```

(c) Pass `supporting_documents` through the `research_function` call site (line 162):

Old:
```python
            research_result, prompt_meta = await asyncio.to_thread(research_function, agent_chain, company_profile)
```
New:
```python
            research_result, prompt_meta = await asyncio.to_thread(research_function, agent_chain, company_profile, supporting_documents)
```

(d) Widen both dispatch lambda dicts (lines 92–106) so each lambda takes a 3rd `supporting_documents` parameter and forwards it **by keyword** (`"claude"` must stay positional in `COMPONENT_FUNCTIONS_CLAUDE`):

```python
COMPONENT_FUNCTIONS = {
    "market size & opportunity": lambda agent_chain, d, supporting_documents: _run_research_component(1, agent_chain, d, supporting_documents=supporting_documents),
    "industry trends report": lambda agent_chain, d, supporting_documents: _run_research_component(2, agent_chain, d, supporting_documents=supporting_documents),
    "competitor landscape": lambda agent_chain, d, supporting_documents: _run_research_component(3, agent_chain, d, supporting_documents=supporting_documents),
    "regulatory & compliance highlights": lambda agent_chain, d, supporting_documents: _run_research_component(4, agent_chain, d, supporting_documents=supporting_documents),
    "market entry & growth strategy": lambda agent_chain, d, supporting_documents: _run_research_component(5, agent_chain, d, supporting_documents=supporting_documents),
}

COMPONENT_FUNCTIONS_CLAUDE = {
    "market size & opportunity": lambda agent_chain, d, supporting_documents: _run_research_component(1, agent_chain, d, "claude", supporting_documents=supporting_documents),
    "industry trends report": lambda agent_chain, d, supporting_documents: _run_research_component(2, agent_chain, d, "claude", supporting_documents=supporting_documents),
    "competitor landscape": lambda agent_chain, d, supporting_documents: _run_research_component(3, agent_chain, d, "claude", supporting_documents=supporting_documents),
    "regulatory & compliance highlights": lambda agent_chain, d, supporting_documents: _run_research_component(4, agent_chain, d, "claude", supporting_documents=supporting_documents),
    "market entry & growth strategy": lambda agent_chain, d, supporting_documents: _run_research_component(5, agent_chain, d, "claude", supporting_documents=supporting_documents),
}
```

(e) Add the new trailing keyword param to `_run_research_component` (signature, lines 49–54) and pass it to `prompts.render(...)` (lines 77–80):

Signature — change:
```python
def _run_research_component(
    component_n: int,
    agent_chain,
    pre_data,
    llm_backend: str = "qwen",
) -> tuple[dict, dict]:
```
to:
```python
def _run_research_component(
    component_n: int,
    agent_chain,
    pre_data,
    llm_backend: str = "qwen",
    supporting_documents: "str | None" = None,
) -> tuple[dict, dict]:
```

Render call — change:
```python
    rendered = prompts.render(
        COMPONENT_PROMPT_NAMES[component_n],
        company_profile_json=company_profile_json,
    )
```
to:
```python
    rendered = prompts.render(
        COMPONENT_PROMPT_NAMES[component_n],
        company_profile_json=company_profile_json,
        supporting_documents=supporting_documents,
    )
```

- [ ] **Step 3: Write the failing test**

In `backend/tests/unit/test_market_research.py`, add a module-level rows constant and a through-orchestrator test (runs the real dispatch lambda + `_run_research_component` + real `prompts.render`; captures the rendered body via the `_market_research_agent_output` seam):

```python
SUPPORTING_DOC_ROWS = [
    {
        "query": "market size",
        "id": "doc-chunk-1",
        "score": 0.91,
        "content": "ACME Corp announced 30% revenue growth and DACH expansion in Q3.",
        "metadata": {
            "source": "acme_q3.pdf",
            "text": "ACME Corp announced 30% revenue growth and DACH expansion in Q3.",
            "page": 2,
        },
    },
]


def test_run_market_research_labels_supporting_documents(
    mocker, mock_session, mock_mongo_client,
):
    """The market-research prompt carries a labeled SUPPORTING DOCUMENTS
    section (threaded through the real dispatch lambda + _run_research_component
    + prompts.render), and the pinecone keys no longer ride inside the
    company_profile JSON blob (D1)."""
    captured_body = {}

    def _capture(agent_chain, body, profile_json, llm_backend):
        captured_body["body"] = body
        return 'Final Answer: {"executiveSummary": "ok", "tamValue": "$1B"}'

    mocker.patch(
        "app.services.market_research.orchestrator._market_research_agent_output",
        side_effect=_capture,
    )
    mocker.patch(
        "app.services.market_research.orchestrator._fetch_pinecone_supporting_context",
        return_value=SUPPORTING_DOC_ROWS,
    )
    mock_session.run.return_value.single.return_value = _make_neo4j_company_record()
    _mock_market_collection(mock_mongo_client, find_one_return=None)

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="market size & opportunity", data={}, refresh=True,
    )
    result = asyncio.run(
        run_market_research(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request, llm_backend="qwen")
    )

    assert result["status"] == "success"
    body = captured_body["body"]
    assert "SUPPORTING DOCUMENTS" in body
    assert "ACME Corp announced 30% revenue growth" in body
    assert "pinecone_supporting_context" not in body
    assert "pinecone_context_queries" not in body
```

- [ ] **Step 4: Run the test (red → green)**

Run: `.venv/bin/python -m pytest tests/unit/test_market_research.py -q`
Expected: the new test PASS and the existing per-component tests (which patch the dispatch dicts with `MagicMock` fakes that tolerate the extra positional arg) still PASS.

- [ ] **Step 5: Commit**

```bash
git -C /projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/fix-supporting-docs-labeling add \
  backend/app/services/market_research/orchestrator.py \
  backend/prompts/market_research/research_market_1.md.j2 \
  backend/prompts/market_research/research_market_2.md.j2 \
  backend/prompts/market_research/research_market_3.md.j2 \
  backend/prompts/market_research/research_market_4.md.j2 \
  backend/prompts/market_research/research_market_5.md.j2 \
  backend/tests/unit/test_market_research.py
git -C /projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/fix-supporting-docs-labeling commit -m "feat(be): label retrieved docs in market-research prompts"
```

---

## Task 4: ICP-research surface

**Files:**
- Modify: `backend/app/services/icp/orchestrator.py`
- Modify: `backend/prompts/icp/icp_research_1.md.j2` … `icp_research_4.md.j2`
- Test: `backend/tests/unit/test_icp.py`

**Interfaces:**
- Consumes: `format_supporting_documents` (Task 1); the partial (Task 2).
- Produces: `icp_research_1..4(agent_chain, pre_data, llm_backend="qwen", supporting_documents=None)`; `ICP_FUNCTIONS_CLAUDE` lambdas gain a `supporting_documents` keyword param; the `research_function` call site passes `supporting_documents=...` as a keyword.

- [ ] **Step 1: Add the include + input to all 4 ICP templates, bump version**

For each of `icp_research_1.md.j2` … `icp_research_4.md.j2` in `backend/prompts/icp/`:

(a) Frontmatter: `version: 1.0.0` → `version: 1.1.0`; append `  - supporting_documents` to `inputs:` (each currently has only `  - pre_data`):

```
inputs:
  - pre_data
  - supporting_documents
```

(b) Insert `{% include '_shared/supporting_documents_section.md.j2' %}` — placement differs by template (anchor on the **text**, not line numbers):

- `icp_research_2`, `icp_research_3`, `icp_research_4`: each contains the two-line block `Company Profile and ICP Data Context:\n{{ pre_data }}`. Insert the include immediately after `{{ pre_data }}`:

  Old:
  ```
  Company Profile and ICP Data Context:
  {{ pre_data }}
  ```
  New:
  ```
  Company Profile and ICP Data Context:
  {{ pre_data }}

  {% include '_shared/supporting_documents_section.md.j2' %}
  ```

- `icp_research_1`: has no clean data block (it inlines `{{ pre_data }}` twice mid-sentence). Insert the include immediately **before** the terminal `{% include '_shared/final_answer_directive.md.j2' %}` so `final_answer_directive` stays the last include (its no-trailing-newline byte-parity contract must be preserved):

  Old:
  ```
  give only json , nothing else , nothing at all

  {% include '_shared/final_answer_directive.md.j2' %}
  ```
  New:
  ```
  give only json , nothing else , nothing at all

  {% include '_shared/supporting_documents_section.md.j2' %}

  {% include '_shared/final_answer_directive.md.j2' %}
  ```

- [ ] **Step 2: Thread `supporting_documents` through the ICP orchestrator**

In `backend/app/services/icp/orchestrator.py`:

(a) Add `format_supporting_documents` to the existing `_retrieval` import (lines 34–37).

(b) In `_run_icp_research_impl`, **remove** the two pinecone-stamp lines (296–297) and **compute** `supporting_documents` from `pinecone_context` (keep the queries/fetch above them):

Old:
```python
    context_data["pinecone_context_queries"] = market_context_queries
    context_data["pinecone_supporting_context"] = pinecone_context

    # Convert to JSON string for the research function
    context_json = json.dumps(context_data)
```
New:
```python
    supporting_documents = format_supporting_documents(pinecone_context)

    # Convert to JSON string for the research function
    context_json = json.dumps(context_data)
```

(c) Pass `supporting_documents` to the `research_function` call site (line 308) **by keyword** (both the qwen direct-function refs and the claude lambdas accept it):

Old:
```python
            research_result, prompt_meta = await asyncio.to_thread(research_function, agent_chain, context_json)
```
New:
```python
            research_result, prompt_meta = await asyncio.to_thread(research_function, agent_chain, context_json, supporting_documents=supporting_documents)
```

(d) Add the trailing keyword param to all four `icp_research_N` signatures and pass it to each `prompts.render(...)`. For each function (e.g. `icp_research_1`):

Signature — change:
```python
def icp_research_1(agent_chain, pre_data: str, llm_backend: str = "qwen") -> tuple[dict, dict]:
    rendered = prompts.render("icp_research_1", pre_data=pre_data)
```
to:
```python
def icp_research_1(agent_chain, pre_data: str, llm_backend: str = "qwen", supporting_documents: "str | None" = None) -> tuple[dict, dict]:
    rendered = prompts.render("icp_research_1", pre_data=pre_data, supporting_documents=supporting_documents)
```
Apply the same two-line change to `icp_research_2`, `icp_research_3`, `icp_research_4` (each with its own template name `"icp_research_N"`).

(e) Update the `ICP_FUNCTIONS_CLAUDE` lambdas (lines 213–216) to accept and forward `supporting_documents` (keep `"claude"` positional). `ICP_FUNCTIONS` (the qwen dict) maps to the bare functions and needs no change — the bare functions now accept the keyword.

Old:
```python
ICP_FUNCTIONS_CLAUDE = {
    "icp summary & market opportunity": lambda agent_chain, d: icp_research_1(agent_chain, d, "claude"),
    "buyer map & roles, pain points, triggers": lambda agent_chain, d: icp_research_2(agent_chain, d, "claude"),
    "competitive overlap & buying signals": lambda agent_chain, d: icp_research_3(agent_chain, d, "claude"),
    "regulatory, compliance & recommended icp": lambda agent_chain, d: icp_research_4(agent_chain, d, "claude"),
}
```
New:
```python
ICP_FUNCTIONS_CLAUDE = {
    "icp summary & market opportunity": lambda agent_chain, d, supporting_documents=None: icp_research_1(agent_chain, d, "claude", supporting_documents=supporting_documents),
    "buyer map & roles, pain points, triggers": lambda agent_chain, d, supporting_documents=None: icp_research_2(agent_chain, d, "claude", supporting_documents=supporting_documents),
    "competitive overlap & buying signals": lambda agent_chain, d, supporting_documents=None: icp_research_3(agent_chain, d, "claude", supporting_documents=supporting_documents),
    "regulatory, compliance & recommended icp": lambda agent_chain, d, supporting_documents=None: icp_research_4(agent_chain, d, "claude", supporting_documents=supporting_documents),
}
```

- [ ] **Step 3: Write the failing test**

In `backend/tests/unit/test_icp.py`, add a rows constant and a through-orchestrator test. Mirror the mock setup of the existing `test_run_icp_research_qwen_happy_path` exactly, with two differences: (a) do **not** patch `ICP_FUNCTIONS` (let the real `icp_research_1` + `prompts.render` run); (b) patch `_icp_research_agent_output` to capture the rendered body.

```python
SUPPORTING_DOC_ROWS = [
    {
        "query": "icp opportunity",
        "id": "doc-chunk-1",
        "score": 0.91,
        "content": "ACME Corp announced 30% revenue growth and DACH expansion in Q3.",
        "metadata": {
            "source": "acme_q3.pdf",
            "text": "ACME Corp announced 30% revenue growth and DACH expansion in Q3.",
            "page": 2,
        },
    },
]


def test_run_icp_research_labels_supporting_documents(
    mocker, mock_session, mock_mongo_client,
):
    """The ICP prompt carries a labeled SUPPORTING DOCUMENTS section (threaded
    through the real ICP_FUNCTIONS dispatch + icp_research_1 + prompts.render),
    and the pinecone keys no longer ride inside the context_json blob (D1)."""
    captured_body = {}

    def _capture(agent_chain, body, pre_data, llm_backend):
        captured_body["body"] = body
        return 'Final Answer: {"title": "ICP Summary", "currentData": {"segments": ["mid-market"]}}'

    mocker.patch(
        "app.services.icp.orchestrator._icp_research_agent_output",
        side_effect=_capture,
    )
    mocker.patch(
        "app.services.icp.orchestrator._fetch_pinecone_supporting_context",
        return_value=SUPPORTING_DOC_ROWS,
    )
    mocker.patch(
        "app.services.icp.orchestrator._build_market_context_queries", return_value=[],
    )
    mock_session.run.return_value.single.return_value = _make_company_record()
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Profiler"].__getitem__.return_value = coll

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="icp summary & market opportunity", data={}, refresh=True,
    )
    result = asyncio.run(
        run_icp_research(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request, llm_backend="qwen")
    )

    assert result["status"] == "success"
    body = captured_body["body"]
    assert "SUPPORTING DOCUMENTS" in body
    assert "ACME Corp announced 30% revenue growth" in body
    assert "pinecone_supporting_context" not in body
    assert "pinecone_context_queries" not in body
```

- [ ] **Step 4: Run the test (red → green)**

Run: `.venv/bin/python -m pytest tests/unit/test_icp.py -q`
Expected: the new test PASS; existing ICP tests (which patch `ICP_FUNCTIONS`/`icp_research_2` with `MagicMock` fakes that tolerate the new keyword) still PASS.

- [ ] **Step 5: Commit**

```bash
git -C /projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/fix-supporting-docs-labeling add \
  backend/app/services/icp/orchestrator.py \
  backend/prompts/icp/icp_research_1.md.j2 \
  backend/prompts/icp/icp_research_2.md.j2 \
  backend/prompts/icp/icp_research_3.md.j2 \
  backend/prompts/icp/icp_research_4.md.j2 \
  backend/tests/unit/test_icp.py
git -C /projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/fix-supporting-docs-labeling commit -m "feat(be): label retrieved docs in ICP research prompts"
```

---

## Task 5: `signal_ask` label alignment

`signal_ask` already injects a separate labeled data-source section (it has **no** D1/D3 defect). This task is consistency alignment only (Goal 4): reuse `format_supporting_documents` and align the label wording to the partial's, at **both** call sites (qwen + claude).

**Files:**
- Modify: `backend/app/services/signals/ask.py`
- Test: `backend/tests/unit/test_signals.py`

**Interfaces:**
- Consumes: `format_supporting_documents` (Task 1); the label text from Task 2's partial (copied verbatim).
- Produces: no signature change; `ask.py` gains a module-level `_SUPPORTING_DOCS_LABEL` constant.

- [ ] **Step 1: Write the failing test**

In `backend/tests/unit/test_signals.py`, add a test asserting the aligned label appears and the old label does not:

```python
def test_signal_ask_qwen_uses_aligned_supporting_docs_label(
    mocker, mock_session, mock_mongo_client,
):
    """signal_ask labels uploaded docs with the shared 'SUPPORTING DOCUMENTS'
    wording (aligned to the Jinja partial), not the old bespoke
    'DATA SOURCES (uploaded documents):' label."""
    mocker.patch(
        "app.services.signals.ask._fetch_pinecone_supporting_context",
        return_value=[{"content": "DATA_SOURCE_SENTINEL_ALIGN", "score": 0.8}],
    )
    mock_session.run.return_value.single.return_value = None
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value.find_one.return_value = None

    chain_mock = MagicMock()
    chain_mock.invoke.return_value = {"output": "answer"}

    request = SignalAskRequest(user_id=TEST_USER_ID, org_id=TEST_ORG_ID, question="What changed?")
    result = asyncio.run(signal_ask(mock_session._driver, mock_mongo_client, MagicMock(), chain_mock, request))

    assert result["status"] == "success"
    prompt = chain_mock.invoke.call_args[0][0]["input"]
    assert "SUPPORTING DOCUMENTS" in prompt
    assert "DATA SOURCES (uploaded documents)" not in prompt
    assert "DATA_SOURCE_SENTINEL_ALIGN" in prompt
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/bin/python -m pytest "tests/unit/test_signals.py::test_signal_ask_qwen_uses_aligned_supporting_docs_label" -q`
Expected: FAIL (`"SUPPORTING DOCUMENTS" in prompt` is False; the old label still present).

- [ ] **Step 3: Implement the alignment**

In `backend/app/services/signals/ask.py`:

(a) Add `format_supporting_documents` to the existing `_retrieval` import (the line that imports `_fetch_pinecone_supporting_context`, ~line 32).

(b) Add a module-level label constant near the top of the file (after the imports). It must be **byte-identical** to the partial's label line from Task 2:

```python
_SUPPORTING_DOCS_LABEL = (
    "SUPPORTING DOCUMENTS (retrieved from your organization's uploaded "
    "knowledge base — treat as corroborating evidence and cite where relevant; "
    "these are NOT the company's declared profile fields):"
)
```

(c) Replace the bespoke data-source block at **both** call sites (lines 140–142 qwen, lines 229–231 claude — the 3-line block is byte-identical, so a `replace_all` hits both):

Old (replace_all):
```python
        if data_source_context:
            data_source_json = json.dumps(data_source_context, indent=2, default=str)
            context_parts.append(f"DATA SOURCES (uploaded documents):\n{data_source_json}")
```
New:
```python
        if data_source_context:
            supporting_documents = format_supporting_documents(data_source_context)
            context_parts.append(f"{_SUPPORTING_DOCS_LABEL}\n{supporting_documents}")
```

- [ ] **Step 4: Run the ask tests (new + the two existing data-source tests)**

Run:
```bash
.venv/bin/python -m pytest tests/unit/test_signals.py -k "signal_ask" -q
```
Expected: PASS — the new alignment test, plus the existing `test_signal_ask_qwen_includes_data_source_context` and `test_signal_ask_claude_*` tests (which assert on the content sentinel `DATA_SOURCE_SENTINEL_*`, preserved by `format_supporting_documents`).

- [ ] **Step 5: Commit**

```bash
git -C /projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/fix-supporting-docs-labeling add \
  backend/app/services/signals/ask.py backend/tests/unit/test_signals.py
git -C /projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/fix-supporting-docs-labeling commit -m "refactor(be): align signal_ask data-source label to shared helper"
```

---

## Task 6: Regenerate golden fixtures + full suite

**Files:**
- Modify: `backend/tests/fixtures/prompts/_inputs/{signals_scout_search,signals_profiler_search,research_market_1..5,icp_research_1..4}.json` (add `supporting_documents` key)
- Modify (regenerated): `backend/tests/fixtures/prompts/rendered/<name>.txt` for the same 11
- (No `captured/` change — see Global Constraints "Spec divergence".)

**Interfaces:** none (fixtures only).

- [ ] **Step 1: Add `supporting_documents` to the 11 `_inputs` skeletons**

Each edited template now declares `supporting_documents` in `inputs:`, so `prompts.render(name, **inputs)` (used by the regen script and by `test_prompts_golden.py`) requires it as an exact-set kwarg — a missing key raises `MissingInputs`. Add a top-level `"supporting_documents"` key to each of the 11 `_inputs/<name>.json` with a representative value. Use this same value in all 11 (it renders verbatim into the section):

For each file `backend/tests/fixtures/prompts/_inputs/<name>.json`, add the key (keeping existing keys). Example for `research_market_1.json`:

Old:
```json
{
  "company_profile_json": "{\n  \"company_name\": \"Sample Company\",\n  \"industry\": \"B2B SaaS\",\n  \"size\": \"11-50\",\n  \"region\": \"EMEA\",\n  \"products\": [\n    \"Product A\",\n    \"Product B\"\n  ]\n}"
}
```
New:
```json
{
  "company_profile_json": "{\n  \"company_name\": \"Sample Company\",\n  \"industry\": \"B2B SaaS\",\n  \"size\": \"11-50\",\n  \"region\": \"EMEA\",\n  \"products\": [\n    \"Product A\",\n    \"Product B\"\n  ]\n}",
  "supporting_documents": "[\n  {\n    \"query\": \"sample query\",\n    \"id\": \"doc-1\",\n    \"score\": 0.91,\n    \"content\": \"Sample retrieved document chunk.\",\n    \"metadata\": {\n      \"source\": \"sample.pdf\"\n    }\n  }\n]"
}
```

Apply the analogous edit (append the same `"supporting_documents"` key/value) to the other 10: `signals_scout_search.json`, `signals_profiler_search.json`, `research_market_2..5.json`, `icp_research_1..4.json`. Keep each file's existing keys intact.

- [ ] **Step 2: Regenerate the rendered golden fixtures for the 11 templates**

Run (from `backend/`):
```bash
.venv/bin/python tests/regen_prompt_fixtures.py \
  signals_scout_search signals_profiler_search \
  research_market_1 research_market_2 research_market_3 research_market_4 research_market_5 \
  icp_research_1 icp_research_2 icp_research_3 icp_research_4
```
Expected stderr: `[regen] wrote .../rendered/<name>.txt` for each of the 11, and `[regen] 11/11 fixtures regenerated`. If any line reports `skipped (REPLACE_ME values ...)`, a `_inputs` file still has a placeholder — fix it (Step 1) and re-run.

- [ ] **Step 3: Verify the golden + loader tests pass**

Run:
```bash
.venv/bin/python -m pytest tests/unit/test_prompts_golden.py tests/unit/test_prompts_loader.py -q
```
Expected: PASS. `test_prompts_golden` now matches the regenerated `rendered/` fixtures; `test_prompts_loader` confirms all 11 templates + the new partial boot cleanly.

- [ ] **Step 4: Run the full backend unit suite**

Run:
```bash
.venv/bin/python -m pytest tests/unit -q
```
Expected: all green (the 4 affected modules — `test_retrieval`, `test_signals`, `test_market_research`, `test_icp` — plus the prompt golden/loader tests and the rest of the suite).

- [ ] **Step 5: Commit**

```bash
git -C /projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/fix-supporting-docs-labeling add \
  backend/tests/fixtures/prompts/_inputs/ \
  backend/tests/fixtures/prompts/rendered/
git -C /projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/fix-supporting-docs-labeling commit -m "chore(be): regenerate golden prompt fixtures for supporting-documents section"
```

---

## Acceptance criteria (from Spec 39 §"Acceptance criteria")

1. **Each surface family renders the labeled section when docs are present and omits it when absent.** Covered: signals scout (Task 2), profiler (Task 2 D3), market-research (Task 3), ICP (Task 4) tests assert `"SUPPORTING DOCUMENTS"` + content present; the `{% if supporting_documents %}` guard + `format_supporting_documents(...) -> None` on empty omit it (helper test in Task 1 + the dict-guard returning `None`).
2. **No generation surface leaves `pinecone_*` keys inside the profile/context JSON.** Covered: Task 2 widens the signals exclude lists; Task 3/4 remove the `company_profile`/`context_data` pinecone stamps; each surface test asserts the keys are absent from the rendered prompt.
3. **Profiler signals include retrieved docs; the `ask` path uses the shared helper + aligned label.** Covered: Task 2 (D3 profiler test) + Task 5.
4. **`format_supporting_documents` + the partial are the single source of formatting/label wording for the template surfaces.** Covered: Task 1 helper + Task 2 partial; `ask.py` keeps a byte-identical Python copy of the label (documented Jinja/Python-boundary exception).
5. **New pytest coverage green; existing suite green after fixture regeneration.** Covered: Task 6 (`_inputs` + `rendered/` regen, full `tests/unit` run).

## Self-review notes (resolved before finalizing)

- **Spec §Testing captured-fixture regen:** dropped as a no-op — verified the `captured/signal_ask_*` files are LLM-output stubs with no embedded label (Global Constraints "Spec divergence"). No test asserts the old label string, so there is no staleness or breakage.
- **Version-bump fallout:** only `test_signals.py:58,82` assert the real-loader version (`signals_scout_search` / `signals_profiler_search`) and are updated in Task 2; market/ICP version asserts use fake `prompt_meta` and are untouched.
- **Existing dispatch-dict tests survive the threading change:** market/ICP per-component tests patch the dict entries (or `_run_research_component`/`icp_research_N`) with `MagicMock` fakes that absorb the new arg/kwarg.
- **`as_langchain` callers:** none for the 11 prompt names (verified) — adding required `inputs:` only affects `prompts.render` callers, all of which this plan updates (orchestrators + regen + golden test inputs).
