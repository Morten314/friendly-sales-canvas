"""User, company, scout profile models. Includes EditRequest (per-domain edit handler payload)."""
from typing import Dict, List, Literal, Optional, Any
from pydantic import BaseModel


# Social Media model
class SocialMedia(BaseModel):
    platform: str
    url: str


# Company Profile model
class CompanyProfile(BaseModel):
    industry: str
    companySize: str
    companyUrl: str
    strategicGoals: str
    primaryGTMModel: str
    revenueStage: str
    keyBuyerPersona: str
    targetMarkets: List[str]
    socialMediaUrls: List[SocialMedia]


# User Profile model
class UserProfile(BaseModel):
    name: str
    role: str
    department: str
    experienceLevel: str
    professionalBackground: str
    personalKPIs: str
    socialMediaUrls: List[SocialMedia]


# Scout Profile model
class ScoutProfile(BaseModel):
    agentName: Literal["Scout"] = "Scout"
    communicationTone: Literal["analytical", "professional", "friendly", "neutral"]
    checkinFrequency: Literal["weekly", "bi-weekly", "monthly"]
    generalInstructions: str


# Edit Request model
class EditRequest(BaseModel):
    user_id: str
    original_json: Dict[str, Any]
    modified_json: Dict[str, Any]
    edit_type: str  # "comment" or "modification"


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class ProfileMessageResponse(BaseModel):
    """Returned by upsert_profile (POST /profile/{profile_type})."""
    message: str


class CleanupProfilesResponse(BaseModel):
    """Returned by cleanup_company_profiles."""
    message: str
    deleted: int
    remaining: int


class EditProfileResponse(BaseModel):
    """Returned by edit_profile_field (POST /edit).
    Status can be 'success', 'feature coming soon', or error message.
    """
    status: Optional[str] = None
    inserted_id: Optional[str] = None
    error: Optional[str] = None
