"""Domain exception hierarchy.

Service-layer functions raise these. A FastAPI exception handler in
app/main.py maps each base class to its HTTP response. Routers MAY still
raise HTTPException directly for transport-only concerns; the rule is
crisp: services raise BrewraError subclasses, routers may raise either.

Phase D leaf-class inventory (discovery 2026-05-22):
  404 NotFoundError leaves (14):
    LeadNotFoundError, CompanyProfileNotFoundError, CustomerProfileNotFoundError,
    SuggestedICPNotFoundError, CustomerProfileICPNotFoundError, DocumentNotFoundError,
    ICPConfigNotFoundError, RecommendedICPNotFoundError, MarketScoreNotFoundError,
    MarketScoringRunNotFoundError, SignalNotFoundError, UsersDocumentNotFoundError,
    OrgNotFoundError, ProfileNotFoundError
  400 ValidationError leaves (5):
    ProfileValidationError, LeadCSVValidationError, DocumentValidationError,
    UnsupportedComponentError, SignalActionValidationError
  409 ConflictError leaves (1):
    ICPAlreadyExistsError
  Retained (reparented under BrewraError):
    BudgetExhaustedError → 429, ICPIdRegistryError → 500

Standalone 500 raises at signals.py:1007/1137/1261 are converted to
RuntimeError (not BrewraError) so they fall to FastAPI's default 500
handler — they are ops-only signals (config check, race condition,
upstream API failure) and don't need typed identity.
"""


class BrewraError(Exception):
    """Base for all Brewra domain exceptions. Never raised directly."""


# ─── Status-family bases (abstract by convention, not enforced by ABC) ───

class NotFoundError(BrewraError):
    """→ HTTP 404. Resource exists in the domain model but not in storage."""


class ValidationError(BrewraError):
    """→ HTTP 400. Input fails domain validation rules."""


class ConflictError(BrewraError):
    """→ HTTP 409. Operation conflicts with current resource state."""


class AuthenticationError(BrewraError):
    """→ HTTP 401. Caller's identity could not be verified.
    No leaves today — reserved for future JWT auth."""


class AuthorizationError(BrewraError):
    """→ HTTP 403. Caller's identity is verified but lacks permission.
    No leaves today — reserved for future use."""


# ─── 404 NotFoundError leaves ───

class LeadNotFoundError(NotFoundError):
    """Lead not found in Neo4j."""


class CompanyProfileNotFoundError(NotFoundError):
    """No company profile found in Neo4j for the given org_id."""


class CustomerProfileNotFoundError(NotFoundError):
    """No customer profile document found in MongoDB."""


class SuggestedICPNotFoundError(NotFoundError):
    """Suggested ICP not found for the given icp_id."""


class CustomerProfileICPNotFoundError(NotFoundError):
    """Customer profile ICP not found for the given icp_id."""


class DocumentNotFoundError(NotFoundError):
    """File document not found."""


class ICPConfigNotFoundError(NotFoundError):
    """No ICP config found for the given user_id."""


class RecommendedICPNotFoundError(NotFoundError):
    """Recommended ICP not found for the given icp_id."""


class MarketScoreNotFoundError(NotFoundError):
    """Lead market scores not found for the given org_id."""


class MarketScoringRunNotFoundError(NotFoundError):
    """Market scoring run not found for the given org_id."""


class SignalNotFoundError(NotFoundError):
    """Signal not found for the given signal_id."""


class UsersDocumentNotFoundError(NotFoundError):
    """Users document not found in MongoDB."""


class OrgNotFoundError(NotFoundError):
    """No org_id found for the given user_id."""


class ProfileNotFoundError(NotFoundError):
    """Profile not found for the given user_id."""


# ─── 400 ValidationError leaves ───

class ProfileValidationError(ValidationError):
    """Profile payload missing required fields (user_id, org_id, etc.)."""


class LeadCSVValidationError(ValidationError):
    """CSV upload for leads failed parsing or content checks."""


class DocumentValidationError(ValidationError):
    """Document update payload fails validation."""


class UnsupportedComponentError(ValidationError):
    """component_name / agent value is not in the supported set."""


class SignalActionValidationError(ValidationError):
    """Invalid action requested on a signal."""


# ─── 409 ConflictError leaves ───

class ICPAlreadyExistsError(ConflictError):
    """ICP already saved for this org."""


# ─── 429: retained domain-specific ───

class BudgetExhaustedError(BrewraError):
    """Claude per-window token budget exhausted. Carries dict payload
    (error message + budget metadata) in args[0]. Routers map to HTTP 429."""


# ─── 500: retained domain-specific ───

class ICPIdRegistryError(BrewraError):
    """ICP id reservation could not be acquired. Maps to HTTP 500."""
