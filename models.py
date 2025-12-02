from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Any, Dict

# Request Model
class ProspectData(BaseModel):
    Name: str
    Company: str
    answers: list[str]  # Answers corresponding to predefined questions

# Contact model
class Contact(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None

# Lead model
class Lead(BaseModel):
    company: str
    industry: str
    size: str
    region: str
    location: str
    techStack: List[str]
    contact: Contact
    status: str

# Sales Pipeline Models
class StageStats(BaseModel):
    name: str
    count: int
    conversionRate: Optional[float] = None

class TimeframeResponse(BaseModel):
    days: int
    stages: List[StageStats]

class SalesPipelineResponse(BaseModel):
    timeframes: List[TimeframeResponse]

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

# Market Request model
class MarketRequest(BaseModel):
    user_id: str
    org_id: Optional[str] = None
    component_name: str
    data: dict
    refresh: bool = False

# Edit Request model
class EditRequest(BaseModel):
    user_id: str
    original_json: Dict[str, Any]
    modified_json: Dict[str, Any]
    edit_type: str  # "comment" or "modification"
