"""Domain exception hierarchy.

Service-layer functions raise these. Routers catch and convert to
HTTPException at the HTTP boundary. This keeps the services layer
free of FastAPI specifics for the cases that warrant it.
"""


class BudgetExhaustedError(Exception):
    """Claude per-window token budget exhausted. Carries a dict payload
    (error message + budget metadata) in args[0]. Routers map to HTTP 429."""


class ICPIdRegistryError(Exception):
    """ICP id reservation could not be acquired. Maps to HTTP 500."""
