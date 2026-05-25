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
