"""Domain exception hierarchy.

Service-layer functions raise these. A FastAPI exception handler in
`app/main.py` maps each base class to its HTTP response. Routers MAY still
raise `HTTPException` directly for transport-only concerns; the rule is
crisp: services raise `BrewraError` subclasses, routers may raise either.

Base classes route to status codes:
  - `NotFoundError` → 404, `ValidationError` → 400, `ConflictError` → 409
  - `AuthenticationError` → 401, `AuthorizationError` → 403
  - `BudgetExhaustedError` → 429
  - `ICPIdRegistryError`, `ServiceError` → 500

The generic `ServiceError` exists so 500 responses can carry a useful detail
message instead of FastAPI's default "Internal Server Error".
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


# ─── 500: generic service-side failure ───

class ServiceError(BrewraError):
    """Operational failure (config missing, upstream API down, race condition).
    Maps to HTTP 500 with the exception message in the detail field."""


class ScoringPostProcessingError(ServiceError):
    """Raised when ``score_single_lead_against_market``'s LLM call succeeded
    but post-processing (JSON parse, score normalization) failed. Carries the
    ``prompt_meta`` from the successful render so the caller can persist the
    observability payload even on the error path."""

    def __init__(self, message: str, prompt_meta: dict):
        super().__init__(message)
        self.prompt_meta = prompt_meta


# ─── Connector leaves (Apollo + future adapters) ───

class ConnectorNotConnectedError(NotFoundError):
    """No stored credentials for the given (org_id, provider). → 404."""


class ConnectorEnrichRunNotFoundError(NotFoundError):
    """No connector enrichment run found for the given org_id/run_id. → 404."""


class ConnectorCredentialsInvalidError(ValidationError):
    """A supplied connector API key was rejected by the provider on validation. → 400."""


class ApolloAPIError(ServiceError):
    """Unexpected failure talking to the Apollo API (non-credit, non-auth). → 500."""


class ApolloCreditsExhaustedError(ServiceError):
    """Apollo reported the account is out of enrichment credits. → 500.
    Background tasks catch this and end the run `partial` rather than surfacing 500."""
