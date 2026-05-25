"""leads service — public API.

Service for lead CRUD + bulk CSV/XLSX upload + lead-stream registry.
Submodules:
  - orchestrator.py: batch_upload_leads, delete_leads_by_file
  - persistence.py: _ensure_leads_indexes, get_leads_for_org, create_lead,
    update_lead, delete_lead, list_leads_by_file, get_stream_status
  - normalization.py: _process_neo4j_lead_records (private — not re-exported)

_-prefix helpers re-exported below for external callers that import via the
package path: _ensure_leads_indexes (app/main.py lifespan). Tests patching
these for those callers target the caller's namespace (e.g.,
app.main._ensure_leads_indexes), per patch-where-used.
"""

from app.services.leads.orchestrator import (
    batch_upload_leads,
    delete_leads_by_file,
)
from app.services.leads.persistence import (
    _ensure_leads_indexes,
    get_leads_for_org,
    create_lead,
    update_lead,
    delete_lead,
    list_leads_by_file,
    get_stream_status,
)
