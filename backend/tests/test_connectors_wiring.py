"""The connectors router is mounted and the lifespan ensures connector indexes."""
from app.main import app


def test_connectors_routes_registered():
    paths = {route.path for route in app.routes}
    assert "/connectors/apollo/connect" in paths
    assert "/connectors/apollo/import" in paths
    assert "/connectors/apollo/enrich" in paths


def test_lifespan_binds_ensure_connectors_indexes():
    # The lifespan calls _ensure_connectors_indexes; assert main.py imported the REAL
    # function object (catches a forgotten/renamed import — review F7). A full
    # lifespan-invocation test is not feasible here: under BREWRA_SKIP_DB_INIT
    # (conftest) clients.client is None, so the lifespan's index block is skipped.
    import app.main as main_mod
    from app.services.connectors import credentials
    assert main_mod._ensure_connectors_indexes is credentials._ensure_connectors_indexes
