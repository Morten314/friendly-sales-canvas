"""Cross-domain LLM helpers.

Promoted from app/services/market_research.py in Phase B Task 15 because
icp and signals were importing these via the underscore-private path —
a convention violation. New convention: any service helper used by 2+
services lives here.
"""
import os
import json
import re
from typing import List

import requests

from app.core.config import claude_sonnet_model, tavily_api_key
from app.core.exceptions import ServiceError


# --- Claude-backed research (Tavily + Anthropic), same prompts as agent_chain path ---
CLAUDE_RESEARCH_MAX_TOKENS = int(os.getenv("CLAUDE_RESEARCH_MAX_TOKENS") or "8192")


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
            urls = list(dict.fromkeys(re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', raw)))[:12]
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
