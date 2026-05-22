"""Org registration / auth models."""
from typing import Optional
from pydantic import BaseModel


# Registration Request model
class RegistrationRequest(BaseModel):
    name: str
    email: str


# Registration Response model
class RegistrationResponse(BaseModel):
    id: str
    name: str
    email: str
    timestamp: str
