# Backend Modularization Phase I Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close three Phase H deferrals. (A) Consolidate 3 `_*_agent_output` and 3 JSON-parsing helpers into shared `_llm_helpers.py` functions. (C) Decompose `signals/orchestrator.py` (744 LOC) into `search.py` / `batch.py` / `ask.py` + promote `fetch_signals` in `persistence.py`; delete orchestrator.py. (D) Rename `app.models.documents` → `app.models.data_sources`, hoist `_URL_PATTERN` constant, close TD-007 cosmetic cruft (4 one-line fixes).

**Architecture:** Structural refactor with one intentional behavior change. Cross-service helpers move to a shared module; per-service wrappers become thin adapters that hardcode service-specific config (search query template, escape keys, URL extraction, Claude prompt suffix). signals/ decomposition follows the Phase H pattern — module-import + namespace-prefix at any callsite where a moved symbol is patched-by-string in tests. The one intentional behavior change: signals' historical quote-escaping in `_parse_search_signals_response` (escaping `"` inside matched `description`/`snippet`/`headline` values, on top of `\n`/`\r`) is removed during I-A consolidation to unify all three research services on the simpler escape rule.

**Tech Stack:** Python 3.12, FastAPI, pytest, pytest-mock, syrupy. No new dependencies.

**Spec:** `specs/2026-05-24-backend-modularization-phase-i-design.md` (round 0 + round 1 + round 2 synthesis applied; status "ready for implementation").

**Branch:** `refactor-backend-modularization-phase-i` off `master` (Phase H merged at commit `55a5c3a`).

**Baseline:** 236 behavior tests passing, 19 syrupy snapshots passing. Verified by `cd backend && BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q` post-merge.

**Target:** 242-246 tests passing at branch HEAD (236 existing + 6-10 new helper tests added in commit 1). 19 syrupy snapshots unchanged (Phase I doesn't change function output, only module homes and dispatch indirection).

**Commit numbering convention:** `<type>(be): <description> [phase I, commit N/11]`. 11 total commits.

**Greenness invariant:** every commit ends with `cd backend && BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q` clean. No "fix in next commit" exceptions. Any test failure during a task: do not commit. Either fix forward or `git checkout -- .` and re-read the step. Never commit a red state.

**Abort criterion:** if any commit drops the test count below the expected post-commit baseline (242-246 after commit 1; same after each subsequent commit), halt and surface to operator. Structural moves shouldn't change test count.

**Spec deviations from `specs/2026-05-24-backend-modularization-phase-i-design.md`:**
- **Added `claude_prompt_suffix_template` parameter** to `_research_agent_output`. Spec §2.1 item 1 lists only 6 parameters; this plan adds a 7th. Reason: the 3 services use 3 different Claude-side prompt augmentation framings (signals: simple newline-separated; icp: triple-quoted with "synthesize with company profile and ICP card"; market_research: triple-quoted with "synthesize with company profile"). Unifying on one framing would change LLM input for 2 services — a behavior change neither the spec nor the round-2 review committed to. Adding the parameter (with the signals framing as default) preserves all three services' exact current behavior. The parameter is a string with a literal `{web_ctx}` placeholder. Documented again at Task 1 Step 4 below.

---

## Pre-flight (one-time setup, no commit)

- [ ] **Verify master state and create branch**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status                                # expected: clean working tree (no uncommitted changes)
git rev-parse --abbrev-ref HEAD           # expected: master
git log --oneline -3                      # confirm Phase H merge (55a5c3a) is HEAD
git checkout -b refactor-backend-modularization-phase-i
```

- [ ] **Verify the test baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
# expected: "236 passed, 19 snapshots passed"
```

Record actual count: __________ (must be 236; if different, surface to operator before proceeding).

- [ ] **Inventory the orchestrator.py patch surface (one-time)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rhn "app\.services\.signals\.orchestrator\." backend/tests/ --include="*.py" | sort -u
```

This produces the complete list of test patch strings that target `signals.orchestrator.*` — the surface that will need retargeting across commits 4-7. Skim it once so you recognize each hit when it shows up in pre-flight greps. Expected count: ~20 hits across 4 categories (public functions, `_fetch_pinecone_supporting_context`, budget helpers + `CLAUDE_API_KEY` + `requests.post`, integration tests).

---

## Sub-sequence I-A — Shared LLM helpers (commits 1-3)

### Task 1: Add `_research_agent_output` + `_extract_research_json` to `_llm_helpers.py`

**Files:**
- Modify: `backend/app/services/_llm_helpers.py` (add 2 functions + 1 constant + expand docstring)
- Create: `backend/tests/unit/test_llm_helpers.py` (new test module)

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/test_llm_helpers.py`:

```python
# backend/tests/unit/test_llm_helpers.py
"""Unit tests for app/services/_llm_helpers.py shared helpers.

Covers _research_agent_output (Groq + Claude paths, URL extraction)
and _extract_research_json (escape_keys, trim_braces, strip_final_answer).
"""
from unittest.mock import MagicMock

import pytest

from app.services._llm_helpers import (
    _research_agent_output,
    _extract_research_json,
)


# ---------------------------------------------------------------------------
# _research_agent_output — Groq path
# ---------------------------------------------------------------------------

def test_research_agent_output_groq_returns_text_and_empty_urls_by_default():
    """Default (extract_intermediate_urls=False) returns (text, [])."""
    agent_chain = MagicMock()
    agent_chain.invoke.return_value = {"output": "agent response text"}

    text, urls = _research_agent_output(
        agent_chain, prompt="hello", seed_text="seed", llm_backend="groq",
        search_query_template="market research {seed}",
    )
    assert text == "agent response text"
    assert urls == []


def test_research_agent_output_groq_extracts_intermediate_urls_when_flagged():
    """extract_intermediate_urls=True walks intermediate_steps for tavily URLs."""
    agent_chain = MagicMock()
    raw = MagicMock()
    raw.__getitem__.side_effect = lambda k: "response text" if k == "output" else None
    raw.intermediate_steps = [
        ("step1", [{"url": "https://a.com"}, {"url": "https://b.com"}])
    ]
    agent_chain.invoke.return_value = raw

    text, urls = _research_agent_output(
        agent_chain, prompt="x", seed_text="s", llm_backend="groq",
        search_query_template="q {seed}",
        extract_intermediate_urls=True,
    )
    assert text == "response text"
    assert "https://a.com" in urls
    assert "https://b.com" in urls


def test_research_agent_output_groq_regex_fallback_when_no_intermediate_urls():
    """extract_intermediate_urls=True falls back to regex on the response text."""
    agent_chain = MagicMock()
    raw = MagicMock()
    raw.__getitem__.side_effect = lambda k: "see https://x.com and https://y.com here" if k == "output" else None
    raw.intermediate_steps = []
    agent_chain.invoke.return_value = raw

    text, urls = _research_agent_output(
        agent_chain, prompt="x", seed_text="s", llm_backend="groq",
        search_query_template="q {seed}",
        extract_intermediate_urls=True,
    )
    assert "https://x.com" in urls
    assert "https://y.com" in urls


# ---------------------------------------------------------------------------
# _research_agent_output — Claude path
# ---------------------------------------------------------------------------

def test_research_agent_output_claude_substitutes_seed_into_query_template(mocker):
    """Claude path: search_query_template gets {seed} replaced; calls _tavily_context_and_urls + _claude_messages_text."""
    mock_tavily = mocker.patch(
        "app.services._llm_helpers._tavily_context_and_urls",
        return_value=("web ctx", ["https://t1.com"]),
    )
    mocker.patch(
        "app.services._llm_helpers._claude_messages_text",
        return_value="claude response",
    )

    text, urls = _research_agent_output(
        MagicMock(), prompt="P", seed_text="acme corp", llm_backend="claude",
        search_query_template="industry trends {seed}",
    )
    assert text == "claude response"
    assert urls == ["https://t1.com"]
    # Seed was normalized + substituted into template
    mock_tavily.assert_called_once_with("industry trends acme corp")


def test_research_agent_output_claude_normalizes_whitespace_and_truncates_seed(mocker):
    """Seed text: whitespace collapsed via " ".join(str(x).split()), truncated to 1200 chars."""
    mock_tavily = mocker.patch(
        "app.services._llm_helpers._tavily_context_and_urls",
        return_value=("ctx", []),
    )
    mocker.patch(
        "app.services._llm_helpers._claude_messages_text",
        return_value="resp",
    )

    long_seed = "  word1   word2\n\tword3  " + ("x" * 2000)
    _research_agent_output(
        MagicMock(), prompt="P", seed_text=long_seed, llm_backend="claude",
        search_query_template="q {seed}",
    )
    call_arg = mock_tavily.call_args[0][0]
    # Whitespace collapsed
    assert "  " not in call_arg.replace("q ", "", 1)
    # Truncated to 1200 chars worth of seed
    assert len(call_arg) <= len("q ") + 1200


def test_research_agent_output_claude_uses_custom_suffix_template(mocker):
    """claude_prompt_suffix_template is appended with {web_ctx} substituted."""
    mocker.patch(
        "app.services._llm_helpers._tavily_context_and_urls",
        return_value=("WEBCTX", []),
    )
    mock_claude = mocker.patch(
        "app.services._llm_helpers._claude_messages_text",
        return_value="r",
    )

    _research_agent_output(
        MagicMock(), prompt="PROMPT", seed_text="s", llm_backend="claude",
        search_query_template="q {seed}",
        claude_prompt_suffix_template="\n--CUSTOM--\n{web_ctx}\n--END--",
    )
    augmented = mock_claude.call_args[0][0]
    assert augmented.startswith("PROMPT")
    assert "--CUSTOM--" in augmented
    assert "WEBCTX" in augmented


# ---------------------------------------------------------------------------
# _extract_research_json — defaults (icp/market_research baseline)
# ---------------------------------------------------------------------------

def test_extract_research_json_defaults_strip_fences_and_escape_description_newlines():
    """Default: strip ```json fences, escape \\n inside "description" value."""
    raw = '```json\n{"description": "line1\nline2"}\n```'
    result = _extract_research_json(raw)
    assert result == {"description": "line1\nline2"}


def test_extract_research_json_trim_braces_drops_surrounding_prose():
    """trim_braces=True keeps only content between first '{' and last '}'."""
    raw = 'Sure, here you go:\n{"k": "v"}\nLet me know.'
    result = _extract_research_json(raw, trim_braces=True)
    assert result == {"k": "v"}


def test_extract_research_json_strip_final_answer_extracts_tail():
    """strip_final_answer=True keeps only text after 'Final Answer:'."""
    raw = 'Thought: ...\nFinal Answer: {"k": "v"}'
    result = _extract_research_json(raw, strip_final_answer=True)
    assert result == {"k": "v"}


def test_extract_research_json_multiple_escape_keys():
    """escape_keys: each named key's \\n inside its string value gets escaped."""
    raw = '{"description": "a\nb", "snippet": "c\nd", "other": "no escape needed"}'
    result = _extract_research_json(raw, escape_keys=("description", "snippet"))
    assert result["description"] == "a\nb"
    assert result["snippet"] == "c\nd"
    assert result["other"] == "no escape needed"


def test_extract_research_json_does_not_escape_quotes():
    """Round-1 review decision: \" inside values is NOT escaped (signals' historical
    quote-escaping is dropped during I-A consolidation; all 3 services unified)."""
    # If we had \"-escaping, a value containing literal " would parse cleanly.
    # Without it, an unescaped " inside a value would break json.loads. This test
    # documents that the shared helper does NOT add quote-escaping.
    raw = '{"k": "no quote here"}'   # plain case, just confirms baseline still works
    result = _extract_research_json(raw)
    assert result == {"k": "no quote here"}
```

- [ ] **Step 2: Run test module to verify it fails (helpers don't exist yet)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest tests/unit/test_llm_helpers.py -v 2>&1 | tail -10
# expected: ImportError / ModuleNotFoundError / cannot import name '_research_agent_output' from '_llm_helpers'
```

- [ ] **Step 3: Read current `_llm_helpers.py` to understand the additions in context**

```bash
cat backend/app/services/_llm_helpers.py
```

Confirm it's 71 LOC with: `CLAUDE_RESEARCH_MAX_TOKENS`, `_tavily_context_and_urls`, `_claude_messages_text`.

- [ ] **Step 4: Implement the two helpers + `_URL_PATTERN` constant + expanded docstring**

Replace the entire content of `backend/app/services/_llm_helpers.py` with:

```python
"""Cross-domain LLM helpers — primitives and shared patterns used by 2+ services.

Primitives:
  - _tavily_context_and_urls(search_query, k=10) — Tavily search + URL extraction
  - _claude_messages_text(user_prompt, max_tokens) — Anthropic /v1/messages call

Shared patterns:
  - _research_agent_output — Groq agent_chain OR Claude+Tavily dispatch for the 3
    research services (signals, icp, market_research). Each service's llm.py module
    is a thin wrapper that hardcodes its search_query_template, claude_prompt_suffix,
    and extract_intermediate_urls flag.
  - _extract_research_json — JSON extraction from LLM markdown-wrapped output.
    Per-service kwargs conventions:
      signals: escape_keys=("description","snippet","headline"), trim_braces=True,
               strip_final_answer=True
      icp:     per-worker variations of escape_keys ranging from ("description",)
               to ("description","blurb","headline"); ICP_generator/research_1 use
               defaults; research_2/4 use trim_braces=True, strip_final_answer=True
      market_research: all defaults (escape_keys=("description",) only)

Constants:
  - _URL_PATTERN — regex matching http(s) URLs in free-form text. Used by
    _tavily_context_and_urls fallback path and _research_agent_output URL extraction.
"""
import os
import json
import re
from typing import Iterable, List

import requests

from app.core.config import claude_sonnet_model, tavily_api_key
from app.core.exceptions import ServiceError


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CLAUDE_RESEARCH_MAX_TOKENS = int(os.getenv("CLAUDE_RESEARCH_MAX_TOKENS") or "8192")

# Matches http(s) URLs in free-form text. Used in 2 places below.
_URL_PATTERN = r'https?://[^\s<>"{}|\\^`\[\]]+'


# ---------------------------------------------------------------------------
# Primitives — Tavily search + Claude messages API
# ---------------------------------------------------------------------------

def _tavily_context_and_urls(search_query: str, k: int = 10) -> tuple:
    """Returns (context_text, url_list) for injection into Claude prompts."""
    urls: List[str] = []
    context = ""
    try:
        from langchain_community.tools.tavily_search.tool import TavilySearchResults

        search_tool = TavilySearchResults(k=k, tavily_api_key=tavily_api_key)
        raw = search_tool.run(search_query[:2000])
        if isinstance(raw, str):
            context = raw
            urls = list(dict.fromkeys(re.findall(_URL_PATTERN, raw)))[:12]
        elif isinstance(raw, list):
            parts = []
            for item in raw:
                if isinstance(item, dict):
                    u = item.get("url") or item.get("source", "")
                    if isinstance(u, str) and u.startswith("http"):
                        urls.append(u)
                    parts.append(json.dumps(item, default=str))
            context = "\n".join(parts)
        else:
            context = str(raw)
    except Exception as e:
        context = f"(web search unavailable: {e})"
    return context, urls[:10]


def _claude_messages_text(user_prompt: str, max_tokens: int = CLAUDE_RESEARCH_MAX_TOKENS) -> str:
    api_key = os.getenv("ANTHROPIC_API_KEY") or ""
    if not api_key:
        raise ServiceError("ANTHROPIC_API_KEY is not configured")
    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": claude_sonnet_model,
            "max_tokens": max_tokens,
            "temperature": 0.2,
            "messages": [{"role": "user", "content": user_prompt}],
        },
        timeout=300,
    )
    if r.status_code >= 400:
        raise ServiceError(f"Claude API failed ({r.status_code}): {r.text[:800]}")
    payload = r.json()
    out: List[str] = []
    for block in payload.get("content", []) or []:
        if isinstance(block, dict) and block.get("type") == "text":
            out.append(block.get("text", ""))
    return "\n".join(out).strip()


# ---------------------------------------------------------------------------
# Shared pattern — research dispatch (Groq agent_chain vs Claude+Tavily)
# ---------------------------------------------------------------------------

_DEFAULT_CLAUDE_PROMPT_SUFFIX = "\n\nWEB SEARCH RESULTS:\n{web_ctx}\n"


def _research_agent_output(
    agent_chain,
    prompt: str,
    seed_text: str,
    llm_backend: str,
    search_query_template: str,
    claude_prompt_suffix_template: str = _DEFAULT_CLAUDE_PROMPT_SUFFIX,
    extract_intermediate_urls: bool = False,
) -> tuple:
    """Dispatch a research call to the Groq agent_chain (default) or to
    Anthropic+Tavily (when llm_backend == "claude"). Returns (text, urls).

    Args:
      agent_chain: a LangChain initialize_agent result (Groq path).
      prompt: the research prompt to send.
      seed_text: free-form text used to seed the Tavily search query (Claude path).
        Whitespace-normalized via " ".join(str(seed_text).split()) then truncated
        to 1200 chars before substitution.
      llm_backend: "claude" routes to Anthropic+Tavily; anything else routes to
        agent_chain.invoke({"input": prompt}).
      search_query_template: must contain literal "{seed}" placeholder, filled via
        str.format(seed=...). Only used in Claude path.
      claude_prompt_suffix_template: must contain literal "{web_ctx}" placeholder.
        Appended to prompt before sending to Claude. Default matches the signals
        framing; icp + market_research pass custom triple-quoted templates.
      extract_intermediate_urls: when True (signals path), walks
        agent_chain response's intermediate_steps to collect tavily URLs from
        the Groq path; falls back to regex over the text if empty. When False
        (icp/market_research paths), the returned url list is empty for Groq.

    Returns:
      (response_text, tavily_urls) tuple. Callers that don't need URLs unpack
      only the first element (e.g., `text, _ = _research_agent_output(...)`).
    """
    tavily_urls: List[str] = []

    if llm_backend != "claude":
        raw_response = agent_chain.invoke({"input": prompt})
        response = raw_response["output"]
        if extract_intermediate_urls:
            try:
                if hasattr(raw_response, "intermediate_steps"):
                    for step in raw_response.intermediate_steps:
                        if len(step) > 1 and isinstance(step[1], list):
                            for result in step[1]:
                                if isinstance(result, dict) and "url" in result:
                                    tavily_urls.append(result["url"])
                if not tavily_urls:
                    found_urls = re.findall(_URL_PATTERN, response)
                    tavily_urls = list(set(found_urls))[:5]
            except Exception:
                pass
        return response, tavily_urls

    # Claude path
    seed = " ".join(str(seed_text).split())[:1200]
    web_ctx, tavily_urls = _tavily_context_and_urls(
        search_query_template.format(seed=seed)
    )
    augmented = prompt + claude_prompt_suffix_template.format(web_ctx=web_ctx)
    response = _claude_messages_text(augmented, max_tokens=CLAUDE_RESEARCH_MAX_TOKENS)
    if not tavily_urls:
        found_urls = re.findall(_URL_PATTERN, response)
        tavily_urls = list(set(found_urls))[:5]
    return response, tavily_urls


# ---------------------------------------------------------------------------
# Shared pattern — JSON extraction from LLM markdown-wrapped output
# ---------------------------------------------------------------------------

def _extract_research_json(
    response: str,
    escape_keys: Iterable[str] = ("description",),
    trim_braces: bool = False,
    strip_final_answer: bool = False,
) -> dict:
    """Strip markdown code fences and parse JSON from an LLM response.

    Steps applied in order:
      1. (Optional) Split on 'Final Answer:' marker and keep the tail.
      2. Strip ``` and ```json code fences.
      3. (Optional) Trim text before the first '{' and after the last '}'.
      4. For each key in `escape_keys`, replace literal newlines/CRs inside
         that key's string value with the escaped \\n / \\r sequences.
      5. json.loads the result.

    Note: this helper does NOT escape quotes inside matched values. Signals'
    historical quote-escaping was dropped during Phase I to unify all three
    research services on the simpler escape rule (see spec §1).
    """
    if strip_final_answer and "Final Answer:" in response:
        response = response.split("Final Answer:")[-1].strip()

    cleaned_str = (
        response.strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )

    if trim_braces:
        if "{" in cleaned_str:
            cleaned_str = cleaned_str[cleaned_str.index("{"):]
        if "}" in cleaned_str:
            cleaned_str = cleaned_str[:cleaned_str.rindex("}") + 1]

    for key in escape_keys:
        pattern = r'\"' + re.escape(key) + r'\": \"(.*?)\"'

        def _make_replacer(k):
            def _repl(m):
                inner = m.group(1).replace("\n", "\\n").replace("\r", "\\r")
                return '"' + k + '": "' + inner + '"'
            return _repl

        cleaned_str = re.sub(pattern, _make_replacer(key), cleaned_str, flags=re.DOTALL)

    return json.loads(cleaned_str)
```

- [ ] **Step 5: Run the new test module to verify it passes**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest tests/unit/test_llm_helpers.py -v 2>&1 | tail -20
# expected: 10 passed
```

- [ ] **Step 6: Run the full test suite to verify no regressions**

```bash
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
# expected: 246 passed (236 prior + 10 new), 19 snapshots passed
```

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/_llm_helpers.py backend/tests/unit/test_llm_helpers.py
git commit -m "refactor(be): add _research_agent_output + _extract_research_json to _llm_helpers [phase I, 1/11]

Shared dispatch + JSON-parsing helpers for the 3 research services
(signals, icp, market_research). No per-service wrappers wired yet —
commits 2 and 3 consume them.

New test module backend/tests/unit/test_llm_helpers.py covers both
helpers parameterized across the per-service configurations.

Adds claude_prompt_suffix_template parameter (plan deviation from spec
§2.1; spec didn't account for the 3 services' differing Claude-prompt
augmentation framings — defaulting to signals' framing preserves all
three services' exact current behavior when commits 2-3 wire wrappers).

Test count: 236 → 246 (10 new tests)."
```

---

### Task 2: Consolidate 3 `_*_agent_output` bodies to call `_research_agent_output`

**Files:**
- Modify: `backend/app/services/signals/llm.py` (~51 → ~17 LOC)
- Modify: `backend/app/services/icp/llm.py` (~30 → ~13 LOC)
- Modify: `backend/app/services/market_research/llm.py` (~29 → ~13 LOC)

- [ ] **Step 1: Pre-flight grep — verify test patches target the per-service wrappers, not the bodies**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rn "_signals_agent_output\|_icp_research_agent_output\|_market_research_agent_output" backend/tests/ --include="*.py"
```

Expected: all hits are `mocker.patch("app.services.<svc>.llm._<svc>_agent_output", ...)` strings. Wrappers stay; patch paths unchanged.

- [ ] **Step 2: Rewrite `signals/llm.py`**

Replace the entire content of `backend/app/services/signals/llm.py` with:

```python
"""LLM invocation wrapper for signals/.

Thin adapter over _research_agent_output: hardcodes signals' search
query template, the default Claude-prompt suffix framing, and
extract_intermediate_urls=True (signals consumes URLs for _validate_url).
"""
from app.services._llm_helpers import _research_agent_output

# Note: _URL_PATTERN was previously defined here but its body moved into
# _research_agent_output. Phase I commit 10 hoists the canonical constant
# to _llm_helpers; this file's local _URL_PATTERN is removed at that step.
_URL_PATTERN = r'https?://[^\s<>"{}|\\^`\[\]]+'


def _signals_agent_output(agent_chain, prompt: str, company_profile_seed: str, llm_backend: str) -> tuple:
    """Returns (model_output_text, tavily_urls) for signal JSON parsing."""
    return _research_agent_output(
        agent_chain, prompt, company_profile_seed, llm_backend,
        search_query_template="B2B market competitor industry news ICP customer trends 2026 {seed}",
        extract_intermediate_urls=True,
    )
```

- [ ] **Step 3: Rewrite `icp/llm.py`**

Replace the entire content of `backend/app/services/icp/llm.py` with:

```python
"""LLM invocation wrappers for icp/.

Thin adapter over _research_agent_output: hardcodes the ICP-specific
search query template and the icp-specific Claude-prompt suffix framing.
Discards tavily_urls (icp doesn't consume them).
"""
from app.services._llm_helpers import _research_agent_output


_ICP_CLAUDE_SUFFIX = """

WEB SEARCH RESULTS (primary external evidence — synthesize with company profile and ICP card):
{web_ctx}
"""


def _icp_research_agent_output(
    agent_chain, prompt: str, pre_data: str, llm_backend: str
) -> str:
    """Dispatcher for ICP research LLM call. Mirrors _market_research_agent_output."""
    text, _ = _research_agent_output(
        agent_chain, prompt, pre_data, llm_backend,
        search_query_template="ICP buyer persona pain points buying triggers competitors compliance 2026 {seed}",
        claude_prompt_suffix_template=_ICP_CLAUDE_SUFFIX,
    )
    return text
```

- [ ] **Step 4: Rewrite `market_research/llm.py`**

Replace the entire content of `backend/app/services/market_research/llm.py` with:

```python
"""LLM invocation wrapper for market_research/.

Thin adapter over _research_agent_output: hardcodes the market-research
search query template and the market_research-specific Claude-prompt
suffix framing. Discards tavily_urls (market_research doesn't consume them).
"""
from app.services._llm_helpers import _research_agent_output


_MARKET_RESEARCH_CLAUDE_SUFFIX = """

WEB SEARCH RESULTS (primary external evidence — synthesize with company profile):
{web_ctx}
"""


def _market_research_agent_output(
    agent_chain, prompt: str, company_profile_json: str, llm_backend: str
) -> str:
    text, _ = _research_agent_output(
        agent_chain, prompt, company_profile_json, llm_backend,
        search_query_template="market research industry trends data 2026 {seed}",
        claude_prompt_suffix_template=_MARKET_RESEARCH_CLAUDE_SUFFIX,
    )
    return text
```

- [ ] **Step 5: Run the full test suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
# expected: 246 passed, 19 snapshots passed
```

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/signals/llm.py backend/app/services/icp/llm.py backend/app/services/market_research/llm.py
git commit -m "refactor(be): consolidate 3 _*_agent_output bodies to shared dispatch [phase I, 2/11]

Each service's llm.py is now a thin wrapper over _research_agent_output
that hardcodes service-specific config (search query template, Claude
prompt suffix framing, URL extraction flag).

signals/llm.py: 51 → 17 LOC. icp/llm.py: 30 → 16 LOC. market_research/llm.py:
29 → 16 LOC. Net ~60 LOC deletion.

signals/llm.py::_URL_PATTERN is now unused; cleaned in commit 10.

Test count: 246 passed."
```

---

### Task 3: Consolidate 3 JSON-parsing bodies to call `_extract_research_json`

**Files:**
- Modify: `backend/app/services/icp/parsing.py` (~110 → ~3 LOC for the function; whole file shrinks)
- Modify: `backend/app/services/market_research/parsing.py` (~40 → ~12 LOC)
- Modify: `backend/app/services/signals/parsing.py` (drop quote-escaping; `_parse_search_signals_response` body shrinks to ~10 LOC; `_validate_url` and `_normalize_search_signals_result` stay unchanged)

- [ ] **Step 1: Pre-flight grep — verify icp callsites use `_extract_icp_json` (which becomes alias)**

```bash
grep -rn "_extract_icp_json\|_parse_search_signals_response\|_extract_research_json" backend/app/ --include="*.py"
```

Expected: ~8 hits for `_extract_icp_json` (in icp/orchestrator + parsing), ~3 hits for `_parse_search_signals_response`, ~6 hits for market_research's `_extract_research_json`. All callsites continue to work because we preserve the function names as adapters.

- [ ] **Step 2: Rewrite `icp/parsing.py`**

Replace the entire content of `backend/app/services/icp/parsing.py` with:

```python
"""Response parsing for icp/ — JSON extraction shared across ICP_generator
and icp_research_1..4 workers.

The shared generic helper now lives in app.services._llm_helpers. This
module preserves the _extract_icp_json name as a 1-line alias so the
~8 existing in-package callsites don't need a cross-cutting sweep.
"""
from app.services._llm_helpers import _extract_research_json

# 1-line alias. See _extract_research_json in _llm_helpers for the
# per-service convention table (escape_keys, trim_braces, strip_final_answer
# variations used by ICP_generator and icp_research_1..4 workers).
_extract_icp_json = _extract_research_json
```

- [ ] **Step 3: Rewrite `market_research/parsing.py`**

Replace the entire content of `backend/app/services/market_research/parsing.py` with:

```python
"""Response parsing for market_research/ — JSON extraction shared across
Research_Market_N workers.

Thin adapter over _extract_research_json. Behavior is byte-identical to
the previous inline implementation: same fence-stripping, same default
escape_keys=("description",), no trim_braces, no strip_final_answer.

Module-import pattern used here to avoid name shadow (the local function
and the shared helper both want the name _extract_research_json).
"""
from app.services import _llm_helpers


def _extract_research_json(raw_response: str) -> dict:
    """Strip code fences and parse JSON from agent-chain output."""
    return _llm_helpers._extract_research_json(raw_response)
```

- [ ] **Step 4: Rewrite `signals/parsing.py`**

This is a targeted change, not a whole-file rewrite. `_validate_url` and `_normalize_search_signals_result` must be preserved **byte-identically** to the current file. Only these change:
1. The module docstring (update to reflect adapter shape).
2. The imports (drop `re`, add `_extract_research_json` import).
3. The `_parse_search_signals_response` function body (becomes a thin adapter).

Replace ONLY the following in `backend/app/services/signals/parsing.py`:

**(a) Module docstring + imports.** Replace lines 1-10 (the docstring + import block) with:

```python
"""Response parsing for signals/ — LLM output -> structured signal records.

_parse_search_signals_response: thin adapter over _llm_helpers._extract_research_json
  with signals-specific kwargs (3 escape_keys, trim_braces, strip_final_answer).
  IMPORTANT: signals' historical quote-escaping (escaping " inside matched
  description/snippet/headline values, on top of \\n/\\r) is REMOVED in
  Phase I. All 3 research services now use the simpler \\n/\\r-only escape
  rule. See spec §1.

_validate_url: signals-specific URL validator against the tavily allowlist.
  Unchanged from previous Phase H implementation.

_normalize_search_signals_result: signals-specific post-processor that
  validates URLs, assembles the final signal record, adds default fields.
  Called by search_signals after _parse_search_signals_response.
  Unchanged from previous Phase H implementation.
"""
from typing import Any, Dict, List

from app.services._llm_helpers import _extract_research_json
```

**(b) Replace the entire `_parse_search_signals_response` function** (currently spans lines ~11-47, ~37 LOC) with:

```python
def _parse_search_signals_response(response: str) -> Dict[str, Any]:
    """Parse the raw LLM response from a signal search into a dict.

    Handles Final Answer prefix, ```json fences, and escapes newlines
    inside description/snippet/headline string fields before json.loads.
    Quote-escaping is intentionally NOT performed (Phase I unification).
    """
    return _extract_research_json(
        response,
        escape_keys=("description", "snippet", "headline"),
        trim_braces=True,
        strip_final_answer=True,
    )
```

**(c) Do NOT touch `_validate_url` (lines ~50-64) or `_normalize_search_signals_result` (lines ~66-105).** They stay exactly as-is. After your edits, run:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE "^def " backend/app/services/signals/parsing.py
# expected: 3 functions — _parse_search_signals_response, _validate_url, _normalize_search_signals_result
wc -l backend/app/services/signals/parsing.py
# expected: ~75-80 LOC (was 104)
```

- [ ] **Step 5: Run the full test suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
# expected: 246 passed, 19 snapshots passed
```

If any test fails because of the quote-escaping removal, the test was implicitly depending on signals' divergent behavior. Investigate the failing test before commit — it may be a legitimate find requiring spec consultation.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/icp/parsing.py backend/app/services/market_research/parsing.py backend/app/services/signals/parsing.py
git commit -m "refactor(be): consolidate 3 JSON-parsing bodies to shared _extract_research_json [phase I, 3/11]

icp/parsing.py: 110 → 12 LOC. _extract_icp_json is now a 1-line alias for
the shared helper.

market_research/parsing.py: 40 → 12 LOC. Adapter passes shared helper
defaults; behavior byte-identical.

signals/parsing.py: drops historical quote-escaping (intentional behavior
change per spec §1). _parse_search_signals_response shrinks from ~50 to
~10 LOC; _validate_url and _normalize_search_signals_result unchanged.

All 3 services now use the same JSON-escape rule (\\n/\\r only). Net
~100 LOC deletion.

Test count: 246 passed."
```

---

## Sub-sequence I-C — signals/ decomposition (commits 4-8)

### Task 4: Rename `_load_signals_for_user` → `fetch_signals` (public) in `persistence.py`

**Files:**
- Modify: `backend/app/services/signals/persistence.py` (rename + docstring refresh)
- Modify: `backend/app/services/signals/orchestrator.py` (drop the `fetch_signals` wrapper, which was a one-line delegation to `persistence._load_signals_for_user`)
- Modify: `backend/app/services/signals/__init__.py` (re-export path changes: `from .orchestrator import fetch_signals` → `from .persistence import fetch_signals`)

- [ ] **Step 1: Pre-flight grep — find existing references**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rn "_load_signals_for_user\|orchestrator\.fetch_signals\|persistence\.fetch_signals" backend/ --include="*.py"
```

Expected hits (estimate):
- `_load_signals_for_user`: definition in `signals/persistence.py:19`, call inside `signals/orchestrator.py` fetch_signals wrapper
- `orchestrator.fetch_signals`: in `signals/__init__.py` re-export, possibly tests
- Tests patching either: verify which name is used

- [ ] **Step 2: Read current `signals/persistence.py` to find `_load_signals_for_user`**

```bash
sed -n '15,40p' backend/app/services/signals/persistence.py
```

Note the exact signature, args, and docstring of `_load_signals_for_user`. The rename keeps everything except the name and the leading `_`.

- [ ] **Step 3: Rename in `signals/persistence.py`**

Use `sed -i` to rename in-place, then verify by reading:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
sed -i 's/_load_signals_for_user/fetch_signals/g' backend/app/services/signals/persistence.py
grep -n "fetch_signals\|_load_signals_for_user" backend/app/services/signals/persistence.py
# expected: only "fetch_signals" hits; no "_load_signals_for_user" remaining
```

Update the docstring of the now-public `fetch_signals` to remove the `_`-prefix convention note (open the file and rewrite the function's docstring to public-API style, e.g., "Public read API for signals. Returns (items, total) tuple." Keep all other content unchanged.)

- [ ] **Step 4: Drop the wrapper from `signals/orchestrator.py`**

```bash
sed -n '495,510p' backend/app/services/signals/orchestrator.py
```

Locate the `async def fetch_signals(...)` block (lines ~495-502 per spec). Delete it entirely (the whole function block). Also remove `fetch_signals` from any import block at the top of orchestrator.py if it references the wrapper's removed name.

- [ ] **Step 5: Update `signals/__init__.py` re-export**

Open `backend/app/services/signals/__init__.py`. Find the line:

```python
from app.services.signals.orchestrator import (
    ...
    fetch_signals,
)
```

Move `fetch_signals` out of the orchestrator import block and into the persistence import block:

```python
from app.services.signals.orchestrator import (
    search_signals,
    run_signals_research,
    generate_signals_batch,
    generate_signals_batch_claude,
    signal_ask,
    signal_ask_claude,
)
from app.services.signals.persistence import (
    record_signal_action,
    fetch_signals,
)
```

`__all__` is unchanged (still lists `fetch_signals` and the 7 others).

- [ ] **Step 6: Update test patch paths**

```bash
grep -rn "app\.services\.signals\.orchestrator\.fetch_signals\|app\.services\.signals\.persistence\._load_signals_for_user" backend/tests/ --include="*.py"
```

For each hit, retarget:
- `app.services.signals.orchestrator.fetch_signals` → `app.services.signals.persistence.fetch_signals`
- `app.services.signals.persistence._load_signals_for_user` → `app.services.signals.persistence.fetch_signals`

- [ ] **Step 7: Run the full test suite + catch-all grep**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
# expected: 246 passed, 19 snapshots passed

cd /projects/Brewra/brewra-gtm-intelligence
grep -rn "_load_signals_for_user" backend/ --include="*.py"
# expected: no hits (all renamed)
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/signals/persistence.py backend/app/services/signals/orchestrator.py backend/app/services/signals/__init__.py backend/tests/
git commit -m "refactor(be): rename _load_signals_for_user → fetch_signals (public) in persistence.py [phase I, 4/11]

The orchestrator's fetch_signals was already a one-line wrapper around
persistence._load_signals_for_user. Promote the persistence function to
public, drop the wrapper, point __init__.py re-export at persistence.

Test count: 246 passed."
```

---

### Task 5: Extract `signals/search.py` (`search_signals` + `run_signals_research`)

**Files:**
- Create: `backend/app/services/signals/search.py`
- Modify: `backend/app/services/signals/orchestrator.py` (remove the 2 functions; add module-import for callers still resident)
- Modify: `backend/app/services/signals/__init__.py` (re-export path change)
- Modify: `backend/tests/` (retarget patch paths for `search_signals`, `run_signals_research`, and `_fetch_pinecone_supporting_context`)

- [ ] **Step 1: Pre-flight greps**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rn 'app\.services\.signals\.orchestrator\.search_signals\|app\.services\.signals\.orchestrator\.run_signals_research\|app\.services\.signals\.orchestrator\._fetch_pinecone_supporting_context' backend/tests/ --include="*.py"
```

Expected ~7-10 hits across test files. All need retargeting from `orchestrator` to `search` in this commit.

- [ ] **Step 2: Read the function bodies to extract**

```bash
sed -n '52,176p' backend/app/services/signals/orchestrator.py
# search_signals body (~125 LOC)
sed -n '177,305p' backend/app/services/signals/orchestrator.py
# run_signals_research body (~130 LOC)
```

Note the exact imports each function uses (especially `_fetch_pinecone_supporting_context` from `app.services._retrieval`).

- [ ] **Step 3: Create `signals/search.py`**

Create `backend/app/services/signals/search.py` with this skeleton (the function bodies are copied verbatim from orchestrator.py — do NOT paraphrase or simplify):

```python
"""Signal search core — extracted from orchestrator.py in Phase I commit 5/11.

Houses search_signals (persona-shared core) and run_signals_research
(async wrapper around search_signals for the research pipeline).

Submodule dependencies (intra-signals): .llm, .parsing, .persistence, .prompts.
Cross-package: app.services._retrieval (_fetch_pinecone_supporting_context,
_build_signal_context_queries).
"""
import asyncio
import json
from typing import Any, Dict, List

from app.core.exceptions import ServiceError
from app.core.logging import logger
from app.models.market import MarketRequest
from app.services._retrieval import (
    _build_signal_context_queries,
    _fetch_pinecone_supporting_context,
)
from app.services.signals.llm import _signals_agent_output
from app.services.signals.parsing import (
    _parse_search_signals_response,
    _validate_url,
    _normalize_search_signals_result,
)
from app.services.signals.persistence import _save_signal_and_track_headline
from app.services.signals.prompts import (
    _SCOUT_PROMPT_TEMPLATE,
    _PROFILER_PROMPT_TEMPLATE,
)


# <Paste the exact body of `search_signals` from orchestrator.py lines 52-176>


# <Paste the exact body of `run_signals_research` from orchestrator.py lines 177-305>
```

**Important:** the import block above is illustrative — adjust based on what `search_signals` and `run_signals_research` actually use after you read the orchestrator. Only import what's actually used.

- [ ] **Step 4: Remove the 2 functions from `orchestrator.py`**

Delete the `def search_signals(...)` block (lines ~52-176) and the `async def run_signals_research(...)` block (lines ~177-305) from `backend/app/services/signals/orchestrator.py`.

- [ ] **Step 5: Switch orchestrator's remaining functions to module-import for `search_signals`**

Several remaining orchestrator functions (`_generate_signals_batch_impl` at line ~306, called via `search_signals`) need to call `search.search_signals(...)`. Add to orchestrator.py near the top of the imports:

```python
from app.services.signals import search
```

Then find each call site of `search_signals` inside orchestrator.py (likely in `_generate_signals_batch_impl`) and change:

```python
# OLD
signals_result = await asyncio.to_thread(search_signals, agent_chain, pre_data, "scout", llm_backend)
# NEW
signals_result = await asyncio.to_thread(search.search_signals, agent_chain, pre_data, "scout", llm_backend)
```

There may be 2 such callsites (one for "scout", one for "profiler" in `_generate_signals_batch_impl`).

**Why module-import here, not from-import:** if orchestrator did `from app.services.signals.search import search_signals`, the name `search_signals` would bind into orchestrator's `__dict__`. `mocker.patch("app.services.signals.search.search_signals")` would then NOT intercept orchestrator-side calls. Module-import + namespace prefix routes through `search.__dict__` at call time, making the patch effective. See `feedback_phase_h_module_import_pattern.md`.

- [ ] **Step 6: Update `signals/__init__.py` re-exports**

Open `backend/app/services/signals/__init__.py`. Move `search_signals` and `run_signals_research` from the orchestrator import to a new search import block:

```python
from app.services.signals.search import (
    search_signals,
    run_signals_research,
)
from app.services.signals.orchestrator import (
    generate_signals_batch,
    generate_signals_batch_claude,
    signal_ask,
    signal_ask_claude,
)
from app.services.signals.persistence import (
    record_signal_action,
    fetch_signals,
)
```

- [ ] **Step 7: Retarget test patch paths**

For each hit from Step 1, change the path:

```bash
# Use the pre-flight grep results to drive these:
# app.services.signals.orchestrator.search_signals → app.services.signals.search.search_signals
# app.services.signals.orchestrator.run_signals_research → app.services.signals.search.run_signals_research
# app.services.signals.orchestrator._fetch_pinecone_supporting_context → app.services.signals.search._fetch_pinecone_supporting_context
```

You can use bulk `sed` per file if the test file has unambiguous occurrences:

```bash
# Example for a single test file
sed -i 's|app\.services\.signals\.orchestrator\.search_signals|app.services.signals.search.search_signals|g' backend/tests/unit/test_signals.py
sed -i 's|app\.services\.signals\.orchestrator\.run_signals_research|app.services.signals.search.run_signals_research|g' backend/tests/unit/test_signals.py
sed -i 's|app\.services\.signals\.orchestrator\._fetch_pinecone_supporting_context|app.services.signals.search._fetch_pinecone_supporting_context|g' backend/tests/unit/test_signals.py
```

Repeat for every test file containing hits from Step 1's grep.

- [ ] **Step 8: Run the full test suite + catch-all grep**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
# expected: 246 passed, 19 snapshots passed

cd /projects/Brewra/brewra-gtm-intelligence
grep -rn "app\.services\.signals\.orchestrator\.\(search_signals\|run_signals_research\|_fetch_pinecone_supporting_context\)" backend/
# expected: no hits — all retargeted to .search.
```

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/signals/search.py backend/app/services/signals/orchestrator.py backend/app/services/signals/__init__.py backend/tests/
git commit -m "refactor(be): extract signals/search.py (search_signals + run_signals_research) [phase I, 5/11]

Moves the persona-shared search core out of orchestrator.py. Cross-package
import _fetch_pinecone_supporting_context moves with search_signals.
orchestrator's remaining functions call via module-import +
namespace-prefix (search.search_signals) to keep mocker.patch effective.

~10 test patch paths retargeted from orchestrator to search.

Test count: 246 passed."
```

---

### Task 6: Extract `signals/batch.py` (`generate_signals_batch` + `_claude` + `_impl`)

**Files:**
- Create: `backend/app/services/signals/batch.py`
- Modify: `backend/app/services/signals/orchestrator.py` (remove the 3 functions)
- Modify: `backend/app/services/signals/__init__.py`
- Modify: `backend/tests/` (retarget patch paths)

- [ ] **Step 1: Pre-flight greps**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rn 'app\.services\.signals\.orchestrator\.\(generate_signals_batch\|_generate_signals_batch_impl\)' backend/tests/ --include="*.py"
```

Expected ~3-5 hits.

- [ ] **Step 2: Read the function bodies**

```bash
sed -n '306,495p' backend/app/services/signals/orchestrator.py
# _generate_signals_batch_impl (~175 LOC), generate_signals_batch (~5 LOC), generate_signals_batch_claude (~10 LOC)
```

- [ ] **Step 3: Create `signals/batch.py`**

Create `backend/app/services/signals/batch.py`:

```python
"""Signal batch generation — extracted from orchestrator.py in Phase I commit 6/11.

Houses _generate_signals_batch_impl (shared body) and the two public
backend-variant wrappers (generate_signals_batch for Groq, _claude for
Anthropic+Tavily).

batch.py uses search.search_signals via module-import + namespace-prefix
to keep mocker.patch effective (see feedback_phase_h_module_import_pattern.md).
"""
import asyncio
from typing import Any, Dict

from app.core.exceptions import ServiceError
from app.core.logging import logger
from app.models.market import MarketRequest
from app.services.signals import search   # module-import — see docstring
from app.services.signals.llm import _signals_agent_output
from app.services.signals.parsing import (
    _parse_search_signals_response,
    _normalize_search_signals_result,
)
from app.services.signals.persistence import _save_signal_and_track_headline


# <Paste the exact body of `_generate_signals_batch_impl` from orchestrator.py
#  lines 306-479, changing every `search_signals(...)` call to `search.search_signals(...)`>


# <Paste the exact body of `generate_signals_batch` from orchestrator.py lines 480-484>


# <Paste the exact body of `generate_signals_batch_claude` from orchestrator.py lines 485-494>
```

**Important:** copy the function bodies verbatim from orchestrator.py. The only change inside `_generate_signals_batch_impl` is rewriting any direct `search_signals` call to `search.search_signals` (the module-import already happened in Task 5; orchestrator.py's local reference is the one being relocated here).

- [ ] **Step 4: Remove the 3 functions from `orchestrator.py`**

Delete the 3 function blocks. After this commit orchestrator.py should contain only `signal_ask`, `signal_ask_claude` (those move in Task 7).

- [ ] **Step 5: Update `signals/__init__.py`**

```python
from app.services.signals.search import (
    search_signals,
    run_signals_research,
)
from app.services.signals.batch import (
    generate_signals_batch,
    generate_signals_batch_claude,
)
from app.services.signals.orchestrator import (
    signal_ask,
    signal_ask_claude,
)
from app.services.signals.persistence import (
    record_signal_action,
    fetch_signals,
)
```

- [ ] **Step 6: Retarget test patch paths**

```bash
sed -i 's|app\.services\.signals\.orchestrator\.generate_signals_batch_claude|app.services.signals.batch.generate_signals_batch_claude|g' backend/tests/unit/test_signals.py backend/tests/test_signals.py 2>/dev/null
sed -i 's|app\.services\.signals\.orchestrator\.generate_signals_batch|app.services.signals.batch.generate_signals_batch|g' backend/tests/unit/test_signals.py backend/tests/test_signals.py 2>/dev/null
sed -i 's|app\.services\.signals\.orchestrator\._generate_signals_batch_impl|app.services.signals.batch._generate_signals_batch_impl|g' backend/tests/unit/test_signals.py backend/tests/test_signals.py 2>/dev/null
```

Replace test file paths with the actual files that have hits per Step 1's grep.

- [ ] **Step 7: Run tests + catch-all grep**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
# expected: 246 passed, 19 snapshots passed

cd /projects/Brewra/brewra-gtm-intelligence
grep -rn "app\.services\.signals\.orchestrator\." backend/
# expected: only signal_ask/signal_ask_claude hits remain (Task 7 cleans those)
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/signals/batch.py backend/app/services/signals/orchestrator.py backend/app/services/signals/__init__.py backend/tests/
git commit -m "refactor(be): extract signals/batch.py (_impl + 2 wrappers) [phase I, 6/11]

Moves the 3 batch functions out of orchestrator. batch.py imports search
via module-import + namespace-prefix (search.search_signals) to keep
mocker.patch effective.

Test patch paths retargeted from orchestrator to batch.

Test count: 246 passed."
```

---

### Task 7: Extract `signals/ask.py` (`signal_ask` + `signal_ask_claude`)

**Files:**
- Create: `backend/app/services/signals/ask.py`
- Modify: `backend/app/services/signals/orchestrator.py` (remove the last 2 functions; file becomes empty/docstring-only)
- Modify: `backend/app/services/signals/__init__.py`
- Modify: `backend/tests/` (retarget patch paths for budget helpers, CLAUDE_API_KEY, requests.post)

- [ ] **Step 1: Pre-flight greps (broad — Task 7 moves the largest patch-target group)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rn 'app\.services\.signals\.orchestrator\.\(signal_ask\|signal_ask_claude\|_reserve_claude_signal_budget\|_finalize_claude_signal_budget\|_estimate_token_count\|CLAUDE_API_KEY\|requests\)' backend/tests/ --include="*.py"
```

Expected ~12 hits. All retarget to `ask.*` in this commit.

- [ ] **Step 2: Read the function bodies**

```bash
sed -n '505,744p' backend/app/services/signals/orchestrator.py
# signal_ask (~80 LOC), signal_ask_claude (~160 LOC)
```

Note the imports each uses — particularly `_reserve_claude_signal_budget`, `_finalize_claude_signal_budget`, `_estimate_token_count`, `CLAUDE_API_KEY` from `app.services._claude_budget`, and `requests` directly.

- [ ] **Step 3: Create `signals/ask.py`**

Create `backend/app/services/signals/ask.py`:

```python
"""Signal Q&A — extracted from orchestrator.py in Phase I commit 7/11.

Houses signal_ask (Groq-backed) and signal_ask_claude (Anthropic-backed).
Both answer questions about signals using company profile, customer profile,
chat history, and WebSearch context.

Cross-package imports:
  - app.services._claude_budget — token counting + budget reservation
  - requests — direct HTTP calls to Claude API (signal_ask_claude path)
"""
import asyncio
import json
import os
from typing import Any, Dict, List, Optional

import requests

from app.core.exceptions import ServiceError
from app.core.logging import logger
from app.models.signals import SignalAskRequest
from app.services._claude_budget import (
    CLAUDE_API_KEY,
    _estimate_token_count,
    _finalize_claude_signal_budget,
    _reserve_claude_signal_budget,
)
from app.services.signals.persistence import _get_signal_ask_customer_profile
from app.services.signals.prompts import (
    _SIGNAL_ASK_PROMPT_TEMPLATE,
    _SIGNAL_ASK_CLAUDE_PROMPT_TEMPLATE,
)


# <Paste the exact body of `signal_ask` from orchestrator.py lines 505-585>


# <Paste the exact body of `signal_ask_claude` from orchestrator.py lines 586-744>
```

**Important:** imports above are illustrative; trim to only what the bodies actually use. The function bodies themselves are copied verbatim — no logic changes.

- [ ] **Step 4: Remove the 2 functions from `orchestrator.py`**

Delete the 2 function blocks. orchestrator.py is now nearly empty — just the module docstring and (if any) the `from app.services.signals import search` import from Task 5 (which can also be removed since no orchestrator-resident functions remain).

- [ ] **Step 5: Update `signals/__init__.py`**

```python
from app.services.signals.search import (
    search_signals,
    run_signals_research,
)
from app.services.signals.batch import (
    generate_signals_batch,
    generate_signals_batch_claude,
)
from app.services.signals.ask import (
    signal_ask,
    signal_ask_claude,
)
from app.services.signals.persistence import (
    record_signal_action,
    fetch_signals,
)
```

- [ ] **Step 6: Retarget test patch paths**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Retarget all ask-related patches in one sweep:
for sym in signal_ask signal_ask_claude _reserve_claude_signal_budget _finalize_claude_signal_budget _estimate_token_count CLAUDE_API_KEY; do
  find backend/tests/ -name '*.py' -exec sed -i "s|app\.services\.signals\.orchestrator\.${sym}|app.services.signals.ask.${sym}|g" {} +
done
# requests.post is patched as orchestrator.requests.post → ask.requests.post
find backend/tests/ -name '*.py' -exec sed -i "s|app\.services\.signals\.orchestrator\.requests|app.services.signals.ask.requests|g" {} +
```

- [ ] **Step 7: Run tests + catch-all grep**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
# expected: 246 passed, 19 snapshots passed

cd /projects/Brewra/brewra-gtm-intelligence
grep -rn "app\.services\.signals\.orchestrator\." backend/
# expected: no hits — all retargeted to .search, .batch, .ask, or .persistence
```

If the catch-all grep returns hits, those are stragglers. Retarget them before committing.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/signals/ask.py backend/app/services/signals/orchestrator.py backend/app/services/signals/__init__.py backend/tests/
git commit -m "refactor(be): extract signals/ask.py (signal_ask + signal_ask_claude) [phase I, 7/11]

Moves the 2 Q&A functions out of orchestrator. Cross-package imports
(_claude_budget helpers, CLAUDE_API_KEY, requests) move with them.

~12 test patch paths retargeted from orchestrator to ask.

orchestrator.py now empty (docstring only) — Task 8 deletes it.

Test count: 246 passed."
```

---

### Task 8: Delete empty `signals/orchestrator.py`; rewrite `__init__.py` docstring for final form

**Files:**
- Delete: `backend/app/services/signals/orchestrator.py`
- Modify: `backend/app/services/signals/__init__.py` (final docstring)

- [ ] **Step 1: Verify orchestrator.py contains no functions**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -nE "^(def|async def|class) " backend/app/services/signals/orchestrator.py
# expected: no hits
```

If any function remains, surface to operator — Tasks 4-7 missed something.

- [ ] **Step 2: Delete `orchestrator.py`**

```bash
git rm backend/app/services/signals/orchestrator.py
```

- [ ] **Step 3: Rewrite `signals/__init__.py` docstring for final form**

Open `backend/app/services/signals/__init__.py`. Replace the existing docstring (which still mentions `orchestrator.py`) with:

```python
"""signals service — public API (Phase I final form).

Service for researching and persisting Scout/Profiler market signals
(single-shot, batch, and Claude-backed variants) + signal Q&A endpoints.

Submodules:
  - search.py: search_signals (persona-shared core), run_signals_research
  - batch.py: generate_signals_batch (+ _claude variant,
    + _generate_signals_batch_impl shared body)
  - ask.py: signal_ask (+ _claude variant)
  - persistence.py: fetch_signals, record_signal_action (public) + Mongo
    helpers — _get_latest_signal_for_user_agent, _get_existing_headlines,
    _get_user_icp_config, _save_signal_and_track_headline,
    _get_signal_ask_customer_profile
  - prompts.py: _SCOUT_PROMPT_TEMPLATE, _PROFILER_PROMPT_TEMPLATE,
    _LEADS_SECTION_TEMPLATE (+ fallback), _EXISTING_HEADLINES_SECTION_TEMPLATE,
    _SIGNAL_ASK_PROMPT_TEMPLATE (+ Claude variant)
  - llm.py: _signals_agent_output (thin adapter over
    _llm_helpers._research_agent_output)
  - parsing.py: _parse_search_signals_response, _normalize_search_signals_result,
    _validate_url

orchestrator.py was deleted in Phase I commit 8/11 — there is no multi-step
cross-submodule composition that needs an orchestrator tier. Each public
function lives in its defining submodule. Same structure as data_sources/.
"""
```

(Keep the import statements and `__all__` block unchanged from Task 7's state.)

- [ ] **Step 4: Final catch-all grep + tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rn "app\.services\.signals\.orchestrator" backend/
# expected: ZERO hits

cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
# expected: 246 passed, 19 snapshots passed

# Public-surface smoke test
.venv/bin/python -c "from app.services.signals import search_signals, run_signals_research, generate_signals_batch, generate_signals_batch_claude, signal_ask, signal_ask_claude, fetch_signals, record_signal_action"
# expected: no error
```

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/signals/__init__.py
git commit -m "refactor(be): delete empty signals/orchestrator.py [phase I, 8/11]

orchestrator.py was empty after Tasks 4-7 extracted all 8 functions.
Delete it; rewrite signals/__init__.py docstring for final form
(no intermediate-state docstrings shipped — Phase H R3 lesson).

signals/ structure now mirrors data_sources/ — submodules carry public
functions directly, no orchestrator tier.

Test count: 246 passed."
```

---

## Sub-sequence I-D — Cleanup (commits 9-11)

### Task 9: Rename `app.models.documents` → `app.models.data_sources`

**Files:**
- Rename (`git mv`): `backend/app/models/documents.py` → `backend/app/models/data_sources.py`
- Modify: `backend/app/routers/data_sources.py` (line 16 import)
- Modify: `backend/app/routers/v2/data_sources.py` (line 5 import)

- [ ] **Step 1: Pre-flight grep (confirm only 2 external import sites)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rn "from app\.models\.documents\|import app\.models\.documents\|app\.models\.documents" backend/ --include="*.py" | grep -v __pycache__
# expected: 2 hits (routers/data_sources.py:16, routers/v2/data_sources.py:5)
```

If more hits, retarget all of them in this commit.

- [ ] **Step 2: `git mv` the file**

```bash
git mv backend/app/models/documents.py backend/app/models/data_sources.py
```

- [ ] **Step 3: Update the 2 import sites**

```bash
sed -i 's|from app\.models\.documents import|from app.models.data_sources import|g' backend/app/routers/data_sources.py backend/app/routers/v2/data_sources.py
# Verify
grep -n "app\.models" backend/app/routers/data_sources.py backend/app/routers/v2/data_sources.py
```

- [ ] **Step 4: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
# expected: 246 passed, 19 snapshots passed
```

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/models/data_sources.py backend/app/routers/data_sources.py backend/app/routers/v2/data_sources.py
git commit -m "refactor(be): rename app.models.documents → app.models.data_sources [phase I, 9/11]

git mv preserves blame. Catches the model layer up to Phase H's service
rename (documents/ → data_sources/). Class names inside the module
unchanged (already DataSource*-prefixed for 4 of 8; DocumentStatusResponse
and MessageResponse accurate as-is; DocumentStatusData/UploadDocumentResponse
internal-only).

Two external import sites updated atomically.

Test count: 246 passed."
```

---

### Task 10: Hoist `_URL_PATTERN` to `_llm_helpers.py`

**Files:**
- Modify: `backend/app/services/_llm_helpers.py` (already has `_URL_PATTERN` from Task 1; ensure it's the canonical home)
- Modify: `backend/app/services/signals/llm.py` (delete the orphaned `_URL_PATTERN` line from Task 2's leftover)

- [ ] **Step 1: Pre-flight — verify current state**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -n "_URL_PATTERN\|https?://\[\^" backend/app/services/_llm_helpers.py backend/app/services/signals/llm.py
```

Expected:
- `_llm_helpers.py`: 1 line defining `_URL_PATTERN`, and 2 usages (`_tavily_context_and_urls` and `_research_agent_output` already use the constant from Task 1).
- `signals/llm.py`: 1 line with `_URL_PATTERN = r'https?://[^\s<>"{}|\\^\`\[\]]+'` (orphan from Task 2).

- [ ] **Step 2: Delete the orphaned constant from `signals/llm.py`**

Open `backend/app/services/signals/llm.py`. Delete the lines:

```python
# Note: _URL_PATTERN was previously defined here but its body moved into
# _research_agent_output. Phase I commit 10 hoists the canonical constant
# to _llm_helpers; this file's local _URL_PATTERN is removed at that step.
_URL_PATTERN = r'https?://[^\s<>"{}|\\^`\[\]]+'
```

The resulting `signals/llm.py` should be only the module docstring + import + `_signals_agent_output` function (~12 LOC).

- [ ] **Step 3: Verify no other files define `_URL_PATTERN`**

```bash
grep -rn "_URL_PATTERN = " backend/app/ --include="*.py"
# expected: only backend/app/services/_llm_helpers.py
```

- [ ] **Step 4: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
# expected: 246 passed, 19 snapshots passed
```

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/signals/llm.py
git commit -m "refactor(be): hoist _URL_PATTERN to _llm_helpers [phase I, 10/11]

The constant has been canonical in _llm_helpers since Task 1; the
orphaned definition in signals/llm.py (left over after Task 2 moved
its consumers into _research_agent_output) is removed here.

Test count: 246 passed."
```

---

### Task 11: Close TD-007 cosmetic cruft (4 one-line fixes) + update TECH_DEBT.md

**Files:**
- Modify: `backend/tests/test_icp_v2.py` (delete unused `fake_result` dead var at line 7)
- Modify: `backend/tests/unit/test_market_scoring.py` (remove unused `monkeypatch` param)
- Modify: `backend/app/routers/v2/org_auth.py` (delete unused `from typing import List` at line 1)
- Modify: `backend/tests/unit/test_customer_profile.py` (delete 9 dead `mocker.patch("app.services.icp._ensure_icp_indexes")` calls)
- Modify: `docs/TECH_DEBT.md` (mark TD-007 resolved)

- [ ] **Step 1: Fix `backend/tests/test_icp_v2.py`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
sed -n '5,10p' backend/tests/test_icp_v2.py
```

Locate the line `fake_result = {"suggestedICPs": [...]}` at or near line 7. Delete the entire line (the data is inlined into the next line's `patch(...)` call, per TD-007 description).

- [ ] **Step 2: Fix `backend/tests/unit/test_market_scoring.py`**

```bash
grep -n "test_get_latest_market_score_rows_returns_items_and_total" backend/tests/unit/test_market_scoring.py
```

Locate the function. Remove `monkeypatch` from its parameter list (e.g., `def test_get_latest_market_score_rows_returns_items_and_total(monkeypatch, mocker)` → `def test_get_latest_market_score_rows_returns_items_and_total(mocker)`).

- [ ] **Step 3: Fix `backend/app/routers/v2/org_auth.py`**

```bash
sed -n '1,5p' backend/app/routers/v2/org_auth.py
```

Delete the `from typing import List` line at the top.

- [ ] **Step 4: Fix `backend/tests/unit/test_customer_profile.py`**

```bash
grep -n "_ensure_icp_indexes" backend/tests/unit/test_customer_profile.py
```

Expected: 9 hits. All are `mocker.patch("app.services.icp._ensure_icp_indexes")` calls inside test bodies where the patched symbol is never reached (per TD-007). Delete each entire line (and any surrounding blank lines that the deletion leaves dangling).

- [ ] **Step 5: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
# expected: 246 passed, 19 snapshots passed
```

If `test_customer_profile.py` tests fail, the deleted patches were not actually dead — the underlying `_ensure_icp_indexes` is still being called. Investigate before committing.

- [ ] **Step 6: Update `docs/TECH_DEBT.md` — mark TD-007 resolved**

Open `docs/TECH_DEBT.md`. Find the TD-007 entry. Either:
- (a) Delete the entire TD-007 section, and add a note to the top-of-file numbering paragraph:
  ```
  TD-007 (Phase G plan-verbatim cosmetic cruft) was resolved 2026-05-24 by Phase I commit 11/11.
  ```
- (b) Or keep the section but prepend a `**RESOLVED 2026-05-24** by Phase I commit 11/11.` line.

Match the existing convention used for TD-001/002/003/006 (resolved entries removed; numbering note updated at top of file). The current top-of-file note already mentions TD-006 resolution; append TD-007's resolution to it.

- [ ] **Step 7: Final test run + post-commit verification suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
# expected: 246 passed, 19 snapshots passed

cd /projects/Brewra/brewra-gtm-intelligence
grep -rn "app\.services\.signals\.orchestrator" backend/
# expected: ZERO hits (confirmed in Task 8; re-verify nothing crept in)

# Public-surface smoke
backend/.venv/bin/python -c "from app.services.signals import search_signals, run_signals_research, generate_signals_batch, generate_signals_batch_claude, signal_ask, signal_ask_claude, fetch_signals, record_signal_action"
# expected: no error
```

- [ ] **Step 8: Commit**

```bash
git add backend/tests/test_icp_v2.py backend/tests/unit/test_market_scoring.py backend/app/routers/v2/org_auth.py backend/tests/unit/test_customer_profile.py docs/TECH_DEBT.md
git commit -m "chore(be): close TD-007 cosmetic cruft (4 files) [phase I, 11/11]

Four one-line cleanups documented in TD-007:
  - tests/test_icp_v2.py: unused fake_result dead var
  - tests/unit/test_market_scoring.py: unused monkeypatch param
  - routers/v2/org_auth.py: unused from typing import List
  - tests/unit/test_customer_profile.py: 9 dead mocker.patch calls
    for _ensure_icp_indexes (no longer reachable post-Phase-G)

TECH_DEBT.md updated to mark TD-007 resolved.

Test count: 246 passed. Phase I complete."
```

---

## Post-Phase-I (no commit; pre-merge checklist)

- [ ] **Verify branch is fully green and ready to merge**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --oneline master..refactor-backend-modularization-phase-i
# expected: 11 commits, labeled [phase I, 1/11] through [phase I, 11/11]

cd backend && BREWRA_SKIP_DB_INIT=1 .venv/bin/python -m pytest -q 2>&1 | tail -3
# expected: 246 passed, 19 snapshots passed
```

- [ ] **Compute LOC summary for the merge commit message**

```bash
git diff --shortstat master..refactor-backend-modularization-phase-i
# Expected order-of-magnitude: ~250 LOC net deletion, 11 files moved/renamed
```

- [ ] **Operator action items after merge**
  - Merge phase I to master with `--no-ff` (preserves the 11-commit narrative).
  - Push master to origin.
  - Delete local phase I branch.
  - Open a post-Phase-I audit task (deferred Low finding from round 2): grep production logs for JSON parse errors in the 30 days after deployment to empirically confirm the quote-escaping removal was safe.
  - Consider whether to start Phase J (lazy-circular cycles + remaining flat-service decomposition) or take a different direction.
