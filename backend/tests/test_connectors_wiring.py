"""The connectors router is mounted and the lifespan ensures connector indexes."""
from app.main import app


def _all_paths(routes):
    """Collect every route path, descending into included sub-routers.

    Starlette 1.3.x mounts `app.include_router(...)` as lazy `_IncludedRouter`
    objects that have no `.path` and expose their real routes via
    `.original_router.routes` (older versions flattened sub-routes into
    `app.routes` directly). Walk both shapes so the guard survives the change.
    """
    paths = set()
    for route in routes:
        path = getattr(route, "path", None)
        if path is not None:
            paths.add(path)
        original = getattr(route, "original_router", None)
        if original is not None:
            paths |= _all_paths(original.routes)
        sub = getattr(route, "routes", None)
        if sub:
            paths |= _all_paths(sub)
    return paths


def test_connectors_routes_registered():
    paths = _all_paths(app.routes)
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
