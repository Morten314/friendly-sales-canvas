"""customer_profile service — public API.

Service for customer profile (ICP) CRUD on MongoDB + suggested-ICP
promotion flow that pulls from app.services.icp and persists into the
Profiler database. Single submodule because all 4 functions share the
same _reserve_unique_icp_id / _release_icp_id binding from app.services.icp.

Submodules:
  - orchestrator.py: upsert_customer_profile, get_customer_profile,
    create_from_suggested_icp, delete_icp_from_customer_profile
"""

from app.services.customer_profile.orchestrator import (
    upsert_customer_profile,
    get_customer_profile,
    create_from_suggested_icp,
    delete_icp_from_customer_profile,
)
