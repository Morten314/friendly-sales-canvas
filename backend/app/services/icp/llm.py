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
