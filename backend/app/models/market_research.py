"""Market research request models."""
from typing import Optional
from pydantic import BaseModel


# Market Request model
class MarketRequest(BaseModel):
    user_id: str
    org_id: Optional[str] = None
    component_name: str
    data: dict
    refresh: bool = False
