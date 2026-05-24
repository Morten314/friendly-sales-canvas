"""LLM invocation wrapper for signals/.

Houses _signals_agent_output, which dispatches to either the Groq agent
chain (llm_backend != "claude") or the Claude messages API (via
_claude_messages_text). The body is unchanged from its previous home in
orchestrator.py.
"""
import re
from typing import List

from app.services._llm_helpers import (
    CLAUDE_RESEARCH_MAX_TOKENS,
    _tavily_context_and_urls,
    _claude_messages_text,
)


def _signals_agent_output(agent_chain, prompt: str, company_profile_seed: str, llm_backend: str) -> tuple:
    """Returns (model_output_text, tavily_urls) for signal JSON parsing."""
    tavily_urls: List[str] = []
    if llm_backend != "claude":
        raw_response = agent_chain.invoke({"input": prompt})
        response = raw_response["output"]
        try:
            if hasattr(raw_response, "intermediate_steps"):
                for step in raw_response.intermediate_steps:
                    if len(step) > 1 and isinstance(step[1], list):
                        for result in step[1]:
                            if isinstance(result, dict) and "url" in result:
                                tavily_urls.append(result["url"])
            if not tavily_urls:
                url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
                found_urls = re.findall(url_pattern, response)
                tavily_urls = list(set(found_urls))[:5]
        except Exception:
            pass
        return response, tavily_urls

    seed = " ".join(str(company_profile_seed).split())[:1200]
    web_ctx, tavily_urls = _tavily_context_and_urls(
        f"B2B market competitor industry news ICP customer trends 2026 {seed}"
    )
    augmented = f"{prompt}\n\nWEB SEARCH RESULTS:\n{web_ctx}\n"
    response = _claude_messages_text(augmented, max_tokens=CLAUDE_RESEARCH_MAX_TOKENS)
    if not tavily_urls:
        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
        found_urls = re.findall(url_pattern, response)
        tavily_urls = list(set(found_urls))[:5]
    return response, tavily_urls
