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
    lead_id: Optional[str] = None
    company: str
    industry: str
    size: str
    region: str
    location: str
    techStack: List[str]
    contact: Contact
    status: str
    user_id: Optional[str] = None
    org_id: Optional[str] = None

# Lead Create Request (flexible key-value pairs)
class LeadCreateRequest(BaseModel):
    user_id: str
    org_id: str
    data: Dict[str, Any]  # Flexible key-value pairs for lead properties

# Lead Update Request
class LeadUpdateRequest(BaseModel):
    user_id: str
    org_id: str
    data: Dict[str, Any]  # Flexible key-value pairs for lead properties

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

# Customer Profile ICP model
class CustomerProfileICP(BaseModel):
    id: Optional[str] = None
    primary_region: str = Field(..., min_length=1)
    industry: List[str] = Field(..., min_items=1)
    company_size: List[str] = Field(..., min_items=1)
    buyer_role: List[str] = Field(..., min_items=1)
    accounts_on_watchlist: Optional[List[str]] = None
    accounts_to_avoid: Optional[List[str]] = None
    fit_confidence: Literal["high", "medium", "low"]
    additional_context: Optional[str] = None
    status: str = "saved"
    created_at: Optional[str] = None

# Customer Profile Request model
class CustomerProfileRequest(BaseModel):
    profile_type: Literal["customer"] = "customer"
    icps: List[CustomerProfileICP] = Field(..., min_items=1)
