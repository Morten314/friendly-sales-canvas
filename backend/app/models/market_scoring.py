"""Lead market scoring models."""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


MARKET_SCORE_COMPONENT_KEYS: List[str] = [
    "market size & opportunity",
    "industry trends report",
    "competitor landscape",
    "regulatory & compliance highlights",
    "market entry & growth strategy",
]


class LeadMarketScoresRequest(BaseModel):
    user_id: str
    org_id: str
    refresh: bool = False


class LeadMarketScoreRow(BaseModel):
    lead_id: str
    org_id: str
    file_id: Optional[str] = None
    company_name: Optional[str] = None
    lead_name: Optional[str] = None
    score_market_size_opportunity: float
    score_industry_trends_report: float
    score_competitor_landscape: float
    score_regulatory_compliance_highlights: float
    score_market_entry_growth_strategy: float
    combined_score: float
    scoring_status: str = "completed"
    scored_at: Optional[str] = None
    updated_at: Optional[str] = None


class LeadMarketScoresResponse(BaseModel):
    org_id: str
    total_leads: int
    processing_status: str
    active_run_id: Optional[str] = None
    last_scored_at: Optional[str] = None
    rows: List[LeadMarketScoreRow]


class LeadMarketScoreDescriptionsResponse(BaseModel):
    lead_id: str
    org_id: str
    combined_score: Optional[float] = None
    scored_at: Optional[str] = None
    descriptions: Dict[str, str]


class LeadMarketScoreStatusItem(BaseModel):
    lead_id: str
    scoring_status: str
    combined_score: Optional[float] = None
    updated_at: Optional[str] = None
    description_preview: Optional[str] = None


class LeadMarketScoringStatusResponse(BaseModel):
    org_id: str
    run_id: Optional[str] = None
    processing_status: str
    processed_leads: int
    total_leads: int
    processed_with_descriptions: int
    failed_count: int
    progress_percent: float
    started_at: Optional[str] = None
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None
    recent_items: List[LeadMarketScoreStatusItem] = Field(default_factory=list)
