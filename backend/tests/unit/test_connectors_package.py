"""The connectors package re-exports its public + lifespan/test surface."""
import app.services.connectors as connectors


def test_public_surface_re_exported():
    for name in (
        "connect_apollo",
        "get_apollo_status",
        "disconnect_apollo",
        "list_apollo_lists",
        "start_apollo_import",
        "start_apollo_enrich",
        "get_apollo_enrich_status",
        "_ensure_connectors_indexes",
        "_run_import",
        "_run_enrich",
    ):
        assert hasattr(connectors, name), f"missing re-export: {name}"
