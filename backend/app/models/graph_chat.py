"""Prospect / graph chat models."""
from pydantic import BaseModel


# Request Model
class ProspectData(BaseModel):
    Name: str
    Company: str
    answers: list[str]  # Answers corresponding to predefined questions
