"""LLM invocation wrappers for icp/.

_icp_research_agent_output dispatches each icp_research_N call to either
the default Groq/Together agent_chain or to the Anthropic/Tavily backend
based on the llm_backend parameter.
"""
from app.services._llm_helpers import (
    CLAUDE_RESEARCH_MAX_TOKENS,
    _tavily_context_and_urls,
    _claude_messages_text,
)


def _icp_research_agent_output(
    agent_chain, prompt: str, pre_data: str, llm_backend: str
) -> str:
    """Dispatcher for ICP research LLM call. Mirrors _market_research_agent_output."""
    if llm_backend != "claude":
        raw_response = agent_chain.invoke({"input": prompt})
        return raw_response["output"]
    seed = " ".join(str(pre_data).split())[:1200]
    web_ctx, _ = _tavily_context_and_urls(
        f"ICP buyer persona pain points buying triggers competitors compliance 2026 {seed}"
    )
    augmented = f"""{prompt}

WEB SEARCH RESULTS (primary external evidence — synthesize with company profile and ICP card):
{web_ctx}
"""
    return _claude_messages_text(augmented, max_tokens=CLAUDE_RESEARCH_MAX_TOKENS)
