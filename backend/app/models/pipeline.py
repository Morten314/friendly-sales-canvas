"""Sales pipeline aggregator models."""
from typing import Dict, List, Optional
from pydantic import BaseModel


class StageStats(BaseModel):
    name: str
    count: int
    conversionRate: Optional[float] = None


class TimeframeResponse(BaseModel):
    days: int
    stages: List[StageStats]


class SalesPipelineResponse(BaseModel):
    timeframes: List[TimeframeResponse]
