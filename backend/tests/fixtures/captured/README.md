# Captured Fixtures

## Status: STUBS

The 24 JSON files in this directory are **stubs**, not real LLM captures. They were
written by hand to unblock the test suite while API keys are unavailable. Each file
contains `"_stub": true` to make this explicit.

## How to regenerate

Once you have API keys, run:

```bash
export ANTHROPIC_API_KEY=...
export TOGETHER_API_KEY=...
export TAVILY_API_KEY=...
cd backend
python tests/capture_fixtures.py
```

The script writes all 24 files and prints progress. Partial re-runs are supported:

```bash
# Single component, single backend
python tests/capture_fixtures.py --components market_size --llm-backend claude

# Multiple components
python tests/capture_fixtures.py --components signals_scout,signals_profiler --llm-backend groq
```

## When to regenerate

Regenerate intentionally when any of the following occur:

- A `_SCOUT_PROMPT_TEMPLATE`, `_PROFILER_PROMPT_TEMPLATE`, or `Research_Market_N`
  template is edited
- `claude_sonnet_model` or `together_model` in `app/core/config.py` is bumped
- An `app/models/<domain>.py` shape change breaks the captured response structure
- A "fixtures lied" incident — production behaviour diverged from what tests asserted

## File inventory

| File | Category | Backend |
|------|----------|---------|
| market_research_market_size_groq.json | market research | groq |
| market_research_market_size_claude.json | market research | claude |
| market_research_industry_trends_groq.json | market research | groq |
| market_research_industry_trends_claude.json | market research | claude |
| market_research_competitor_landscape_groq.json | market research | groq |
| market_research_competitor_landscape_claude.json | market research | claude |
| market_research_regulatory_compliance_groq.json | market research | groq |
| market_research_regulatory_compliance_claude.json | market research | claude |
| market_research_market_entry_groq.json | market research | groq |
| market_research_market_entry_claude.json | market research | claude |
| icp_research_icp_summary_groq.json | icp research | groq |
| icp_research_icp_summary_claude.json | icp research | claude |
| icp_research_icp_buyer_map_groq.json | icp research | groq |
| icp_research_icp_buyer_map_claude.json | icp research | claude |
| icp_research_icp_competitive_groq.json | icp research | groq |
| icp_research_icp_competitive_claude.json | icp research | claude |
| icp_research_icp_regulatory_groq.json | icp research | groq |
| icp_research_icp_regulatory_claude.json | icp research | claude |
| search_signals_scout_groq.json | search signals | groq |
| search_signals_scout_claude.json | search signals | claude |
| search_signals_profiler_groq.json | search signals | groq |
| search_signals_profiler_claude.json | search signals | claude |
| signal_ask_groq.json | signal ask | groq |
| signal_ask_claude.json | signal ask | claude |
