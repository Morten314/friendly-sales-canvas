"""LLM invocation wrapper for signals/.

Thin adapter over _research_agent_output: hardcodes signals' search
query template, the default Claude-prompt suffix framing, and
extract_intermediate_urls=True (signals consumes URLs for _validate_url).
"""
from app.services._llm_helpers import _research_agent_output


def _signals_agent_output(agent_chain, prompt: str, company_profile_seed: str, llm_backend: str) -> tuple:
    """Returns (model_output_text, tavily_urls) for signal JSON parsing."""
    return _research_agent_output(
        agent_chain, prompt, company_profile_seed, llm_backend,
        search_query_template="B2B market competitor industry news ICP customer trends 2026 {seed}",
        extract_intermediate_urls=True,
    )
