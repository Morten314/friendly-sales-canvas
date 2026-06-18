"""Cross-domain LLM helpers — primitives and shared patterns used by 2+ services.

Primitives:
  - _tavily_context_and_urls(search_query, k=10) — Tavily search + URL extraction
  - _claude_messages_text(user_prompt, max_tokens) — Anthropic /v1/messages call

Shared patterns:
  - _research_agent_output — Qwen agent_chain (Together) OR Claude+Tavily dispatch
    for the 3 research services (signals, icp, market_research). Each service's llm.py module
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

# Matches http(s) URLs in free-form text. The negated class stops only at
# whitespace and the delimiters that wrap URLs in HTML/markdown/JSON (< > " `),
# so URLs containing brackets, pipes, carets, braces or IPv6 hosts
# (e.g. http://[::1]/, ?q=[a|b]) are NOT truncated mid-URL. Trailing prose/markdown
# punctuation captured this way (a wrapping ')' or sentence '.') is trimmed
# downstream by _sanitize_source_url(), which also drops api.tavily.com endpoints.
_URL_PATTERN = r'https?://[^\s<>"`]+'

_BLOCKED_SOURCE_HOSTS = frozenset({"api.tavily.com"})


def _strip_trailing_url_punct(url: str) -> str:
    """Trim trailing prose/markdown punctuation a URL picked up from free text,
    without dropping characters that belong to the URL.

    Always-junk trailing chars (' " . , ;) are removed. A closing ')' or ']' is
    removed only when it is UNBALANCED (more closers than openers), so a
    balanced pair inside the path — e.g. a Wikipedia 'Foo_(bar)' link — is
    preserved instead of being mangled into a different, often 404, URL.
    """
    s = url
    while s:
        last = s[-1]
        if last in "'\".,;":
            s = s[:-1]
            continue
        if last == ")" and s.count(")") > s.count("("):
            s = s[:-1]
            continue
        if last == "]" and s.count("]") > s.count("["):
            s = s[:-1]
            continue
        break
    return s


def _sanitize_source_url(url: str) -> str:
    """Normalize a citation URL and drop Tavily API / junk endpoints."""
    if not url or not isinstance(url, str):
        return ""
    cleaned = _strip_trailing_url_punct(url.strip())
    if not cleaned.startswith(("http://", "https://")):
        return ""
    try:
        from urllib.parse import urlparse

        host = urlparse(cleaned).netloc.lower()
        if not host or host in _BLOCKED_SOURCE_HOSTS:
            return ""
    except Exception:
        return ""
    return cleaned


def _filter_source_urls(urls: List[str]) -> List[str]:
    """Dedupe and keep only browser-safe citation URLs."""
    seen: set[str] = set()
    out: List[str] = []
    for raw in urls:
        cleaned = _sanitize_source_url(raw)
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            out.append(cleaned)
    return out


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
            urls = _filter_source_urls(re.findall(_URL_PATTERN, raw))[:12]
        elif isinstance(raw, list):
            parts = []
            for item in raw:
                if isinstance(item, dict):
                    u = item.get("url") or item.get("source", "")
                    if isinstance(u, str):
                        cleaned = _sanitize_source_url(u)
                        if cleaned:
                            urls.append(cleaned)
                    parts.append(json.dumps(item, default=str))
            context = "\n".join(parts)
            urls = _filter_source_urls(urls)[:12]
        else:
            context = str(raw)
    except Exception as e:
        context = f"(web search unavailable: {e})"
    return context, _filter_source_urls(urls)[:10]


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
# Shared pattern — research dispatch (Qwen agent_chain vs Claude+Tavily)
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
    """Dispatch a research call to the Qwen agent_chain (default) or to
    Anthropic+Tavily (when llm_backend == "claude"). Returns (text, urls).

    Args:
      agent_chain: a LangChain initialize_agent result (Qwen/Together path).
      prompt: the research prompt to send.
      seed_text: free-form text used to seed the Tavily search query (Claude path).
        Whitespace-normalized via " ".join(str(seed_text).split()) then truncated
        to 1200 chars before substitution.
      llm_backend: "claude" routes to Anthropic+Tavily; anything else (e.g.
        "qwen") routes to agent_chain.invoke({"input": prompt}).
      search_query_template: must contain literal "{seed}" placeholder, filled via
        str.format(seed=...). Only used in Claude path.
      claude_prompt_suffix_template: must contain literal "{web_ctx}" placeholder.
        Appended to prompt before sending to Claude. Default matches the signals
        framing; icp + market_research pass custom triple-quoted templates.
      extract_intermediate_urls: when True (signals path), walks
        agent_chain response's intermediate_steps to collect tavily URLs from
        the agent_chain path; falls back to regex over the text if empty. When
        False (icp/market_research paths), the returned url list is empty for
        the agent_chain path.

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
                # AgentExecutor.invoke returns a DICT; intermediate_steps is a KEY
                # (present when the agent is built with return_intermediate_steps=True),
                # not an attribute. Read it as a dict key, with an attribute fallback
                # for non-dict responses.
                steps = (
                    raw_response.get("intermediate_steps")
                    if isinstance(raw_response, dict)
                    else getattr(raw_response, "intermediate_steps", None)
                ) or []
                for step in steps:
                    if len(step) <= 1:
                        continue
                    observation = step[1]
                    # Tavily observations arrive either as a list of result dicts
                    # ({"url": ...}) or as a flat string; collect genuine URLs from both.
                    if isinstance(observation, list):
                        for result in observation:
                            if isinstance(result, dict) and "url" in result:
                                cleaned = _sanitize_source_url(result["url"])
                                if cleaned:
                                    tavily_urls.append(cleaned)
                            elif isinstance(result, str):
                                tavily_urls.extend(_filter_source_urls(re.findall(_URL_PATTERN, result)))
                    elif isinstance(observation, str):
                        tavily_urls.extend(_filter_source_urls(re.findall(_URL_PATTERN, observation)))
                tavily_urls = _filter_source_urls(tavily_urls)[:10]
                if not tavily_urls:
                    found_urls = re.findall(_URL_PATTERN, response)
                    tavily_urls = _filter_source_urls(found_urls)[:5]
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
        tavily_urls = _filter_source_urls(found_urls)[:5]
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
    historical quote-escaping was dropped to unify all three research services
    on the simpler escape rule (see spec §1).
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


# ---------------------------------------------------------------------------
# LLM-client factory + simple-invoke helper
# ---------------------------------------------------------------------------
from typing import Callable

from app.core import prompts as _prompts
from app.core.prompts import UnknownModelError, prompt_meta_from


_LLM_FACTORY: dict[str, Callable[[], object]] = {}
_LLM_CACHE: dict[str, object] = {}


def register_llm(model_name: str, builder: Callable[[], object]) -> None:
    _LLM_FACTORY[model_name] = builder


def _get_llm_for_model(model_name: str) -> object:
    if model_name not in _LLM_FACTORY:
        raise UnknownModelError(model_name)
    if model_name not in _LLM_CACHE:
        _LLM_CACHE[model_name] = _LLM_FACTORY[model_name]()
    return _LLM_CACHE[model_name]


def call_with_prompt(prompt_name: str, **inputs) -> tuple:
    """Simple-invoke path: render the prompt, resolve LLM from front-matter,
    invoke with HumanMessage wrapper, return (response, prompt_meta).
    """
    from langchain_core.messages import HumanMessage
    rendered = _prompts.render(prompt_name, **inputs)
    llm = _get_llm_for_model(rendered.config.model)
    response = llm.invoke([HumanMessage(content=rendered.body)])
    return response, prompt_meta_from(rendered)
