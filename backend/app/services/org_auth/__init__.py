"""org_auth service — public API.

Service for org lifecycle (per-user org listing + creation + user-org link)
and admin-only registration entries. Split by entity: orgs.py for the
Org_Management collections, registrations.py for the Registration_DB
collection.

Submodules:
  - orgs.py: list_orgs, create_org, connect_user_to_org
  - registrations.py: list_registrations, create_registration
"""

from app.services.org_auth.orgs import (
    list_orgs,
    create_org,
    connect_user_to_org,
)
from app.services.org_auth.registrations import (
    list_registrations,
    create_registration,
)
