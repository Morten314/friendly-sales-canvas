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
