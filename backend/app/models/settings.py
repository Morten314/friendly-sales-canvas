"""Global, admin-editable app settings (spec 47).

A single settings document, edited from the /admin ops console and read by the
signal-generation / matched-leads lead-fetch paths.
"""
from pydantic import BaseModel, Field


class AppSettings(BaseModel):
    # Max org leads fetched per run for signal matching & generation. 500 is both
    # the default and the hard ceiling (matches the PaginatedResponse cap and
    # bounds the single Claude call in the matched-leads map). See spec 47.
    lead_fetch_limit: int = Field(500, ge=1, le=500)

    # Matched-leads (signal↔lead map) tuning, admin-editable so ops can trade
    # coverage/cost/latency without a deploy (TD-014/TD-015). Kept separate from
    # lead_fetch_limit so tuning the map never degrades signal-generation grounding.
    #   lead_limit — max newest leads the map covers (capped at lead_fetch_limit).
    #     Fewer leads is the only real latency lever (wall-clock is floored by total
    #     Claude output ÷ the Anthropic OTPM ceiling).
    #   batch_size — leads per Claude call. Smaller = smaller/faster outputs that
    #     don't truncate (avoids the adaptive-split waste) and less peak memory.
    signal_lead_map_lead_limit: int = Field(100, ge=1, le=500)
    signal_lead_map_batch_size: int = Field(15, ge=1, le=100)
