"""Domain exception hierarchy.

For errors that map 1:1 to an HTTP status, services raise
fastapi.HTTPException directly — FastAPI catches it at the boundary.
That is the convention across the services layer (~77 sites).

The exceptions below exist for errors where the router needs context to
decide the response: BudgetExhaustedError carries a dict payload that
becomes the 429 body; ICPIdRegistryError carries a message that becomes
a 500 detail.
"""


class BudgetExhaustedError(Exception):
    """Claude per-window token budget exhausted. Carries a dict payload
    (error message + budget metadata) in args[0]. Routers map to HTTP 429."""


class ICPIdRegistryError(Exception):
    """ICP id reservation could not be acquired. Maps to HTTP 500."""
