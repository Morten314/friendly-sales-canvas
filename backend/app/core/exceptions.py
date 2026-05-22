"""Domain exception hierarchy.

Service-layer functions raise these. Routers catch and convert to
HTTPException at the HTTP boundary. This keeps the services layer
free of FastAPI specifics.
"""


class BrewraError(Exception):
    """Base for all Brewra service-layer exceptions."""


class BudgetExhaustedError(BrewraError):
    """Claude per-window token budget exhausted. Maps to HTTP 429."""


class ICPIdRegistryError(BrewraError):
    """ICP id reservation could not be acquired. Maps to HTTP 500."""
