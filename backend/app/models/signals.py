"""Signal request models."""
from typing import Dict, List, Literal, Optional, Any
from pydantic import BaseModel


# Signal Action Request model
class SignalActionRequest(BaseModel):
    org_id: str
    signal_id: str
    action: Literal["accept", "reject"]


# Signal Ask Request model
class SignalAskRequest(BaseModel):
    org_id: str
    user_id: str
    question: str
    history: Optional[List[Dict[str, Any]]] = None  # Open-ended history format
