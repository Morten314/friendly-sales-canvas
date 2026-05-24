"""LLM invocation wrapper for market_research/.

``_market_research_agent_output`` dispatches between the LangChain agent-chain
(default / Groq path) and the Claude messages API (when ``llm_backend ==
"claude"``). Body unchanged from its original orchestrator.py home.
"""
from app.services._llm_helpers import (
    CLAUDE_RESEARCH_MAX_TOKENS,
    _claude_messages_text,
    _tavily_context_and_urls,
)


def _market_research_agent_output(
    agent_chain, prompt: str, company_profile_json: str, llm_backend: str
) -> str:
    if llm_backend != "claude":
        raw_response = agent_chain.invoke({"input": prompt})
        return raw_response["output"]
    seed = " ".join(str(company_profile_json).split())[:1200]
    web_ctx, _ = _tavily_context_and_urls(
        f"market research industry trends data 2026 {seed}"
    )
    augmented = f"""{prompt}

WEB SEARCH RESULTS (primary external evidence — synthesize with company profile):
{web_ctx}
"""
    return _claude_messages_text(augmented, max_tokens=CLAUDE_RESEARCH_MAX_TOKENS)
