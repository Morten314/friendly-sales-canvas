"""connectors service — public API.

First third-party lead-source connector (Apollo). Submodules:
  - apollo.py:        ApolloConnector (the only Apollo-aware code)
  - normalize.py:     Apollo raw -> canonical lead dict (pure)
  - ingestion.py:     provider-agnostic Neo4j writes (atomic fill-only-empty + dedup + Company MERGE)
  - credentials.py:   per-org credential store + _ensure_connectors_indexes
  - runs.py:          import-batch + enrich run-doc tracking (stale-run failover)
  - orchestrator.py:  router-facing service fns + the two BackgroundTasks bodies

_-prefix re-exports for external callers: _ensure_connectors_indexes
(app/main.py lifespan), _run_import / _run_enrich (BackgroundTasks targets /
test patch sites). Per patch-where-used, tests target the caller's namespace.
"""

from app.services.connectors.orchestrator import (
    connect_apollo,
    get_apollo_status,
    disconnect_apollo,
    list_apollo_lists,
    start_apollo_import,
    start_apollo_enrich,
    get_apollo_enrich_status,
    start_apollo_discover,
    get_apollo_discovery_status,
    export_discovery_leads,
    _run_import,
    _run_enrich,
)
from app.services.connectors.credentials import _ensure_connectors_indexes

__all__ = [
    "connect_apollo",
    "get_apollo_status",
    "disconnect_apollo",
    "list_apollo_lists",
    "start_apollo_import",
    "start_apollo_enrich",
    "get_apollo_enrich_status",
    "start_apollo_discover",
    "get_apollo_discovery_status",
    "export_discovery_leads",
    "_ensure_connectors_indexes",
    "_run_import",
    "_run_enrich",
]
