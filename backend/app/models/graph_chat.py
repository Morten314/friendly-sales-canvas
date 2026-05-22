"""Prospect / graph chat models."""
from typing import Any, Dict
from pydantic import BaseModel


# Request Model
class ProspectData(BaseModel):
    Name: str
    Company: str
    answers: list[str]  # Answers corresponding to predefined questions


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class CreateProspectResponse(BaseModel):
    """Returned by POST /create-company/."""
    message: str
    node: Dict[str, Any]


class GraphChatResponse(BaseModel):
    """Returned by GET /chat/."""
    response: str


class GraphMessageResponse(BaseModel):
    """Returned by POST /voice_graph/ and POST /text_graph/."""
    message: str
