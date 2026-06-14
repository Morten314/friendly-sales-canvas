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
python tests/capture_fixtures.py --components signals_scout,signals_profiler --llm-backend qwen
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
| market_research_market_size_qwen.json | market research | qwen |
| market_research_market_size_claude.json | market research | claude |
| market_research_industry_trends_qwen.json | market research | qwen |
| market_research_industry_trends_claude.json | market research | claude |
| market_research_competitor_landscape_qwen.json | market research | qwen |
| market_research_competitor_landscape_claude.json | market research | claude |
| market_research_regulatory_compliance_qwen.json | market research | qwen |
| market_research_regulatory_compliance_claude.json | market research | claude |
| market_research_market_entry_qwen.json | market research | qwen |
| market_research_market_entry_claude.json | market research | claude |
| icp_research_icp_summary_qwen.json | icp research | qwen |
| icp_research_icp_summary_claude.json | icp research | claude |
| icp_research_icp_buyer_map_qwen.json | icp research | qwen |
| icp_research_icp_buyer_map_claude.json | icp research | claude |
| icp_research_icp_competitive_qwen.json | icp research | qwen |
| icp_research_icp_competitive_claude.json | icp research | claude |
| icp_research_icp_regulatory_qwen.json | icp research | qwen |
| icp_research_icp_regulatory_claude.json | icp research | claude |
| search_signals_scout_qwen.json | search signals | qwen |
| search_signals_scout_claude.json | search signals | claude |
| search_signals_profiler_qwen.json | search signals | qwen |
| search_signals_profiler_claude.json | search signals | claude |
| signal_ask_qwen.json | signal ask | qwen |
| signal_ask_claude.json | signal ask | claude |
