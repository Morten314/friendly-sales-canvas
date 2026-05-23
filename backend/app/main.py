"""FastAPI application factory.

This module owns:
  - The FastAPI() instance
  - CORS middleware
  - include_router() calls for all domain routers (added incrementally
    as routers are extracted in Tasks 4-15)

Logging is configured in app/core/logging.py (re-exported below for
backward compat within Phase B).

Domain routers register themselves here. Routes themselves live in
app/routers/<domain>.py.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core import clients
from app.core.clients import build_clients
from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    BudgetExhaustedError,
    ConflictError,
    ICPIdRegistryError,
    NotFoundError,
    ServiceError,
    ValidationError,
)
from app.core.llm_config import build_llm_config
from app.core.logging import logger  # noqa: F401 — re-exported for backward compat within Phase B


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Construct all external clients/LLMs once and stash on app.state.

    Phase F (commit 2/17): introduced alongside the legacy module-import-time
    construction in `app.core.clients` / `app.core.llm_config` and the
    `@app.on_event("startup")` hook below. All three coexist through commit 15;
    commit 17 deletes the legacy paths. Idempotent — Mongo `create_index` is a
    no-op when an equivalent index exists.
    """
    app.state.clients = build_clients()
    app.state.llm = build_llm_config(app.state.clients)

    if app.state.clients.graph is not None:
        try:
            app.state.clients.graph.refresh_schema()
        except Exception as e:
            logger.error("Neo4j refresh_schema (lifespan) failed: %s", e)

    if app.state.clients.client is not None:
        # Re-run Mongo index creation via lifespan. Inline today; Task 15a
        # replaces this with `_ensure_market_scoring_indexes(app.state.clients.client)`
        # once the helper relocates into `app/services/market_scoring.py`.
        from app.services.market_scoring import _get_market_score_collections
        score_coll, run_coll = _get_market_score_collections()
        score_coll.create_index([("org_id", 1), ("lead_id", 1)], unique=True)
        score_coll.create_index([("org_id", 1), ("updated_at", -1)])
        run_coll.create_index([("org_id", 1), ("status", 1)])
        run_coll.create_index([("org_id", 1), ("created_at", -1)])

    yield
    # No teardown — clients are process-lifetime singletons.


app = FastAPI(lifespan=lifespan)

# NOTE: allow_origins=["*"] with allow_credentials=True is preserved from
# original behavior. Phase B tightens this.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Phase D: domain-exception handlers. Map each BrewraError base to its HTTP
# response. Python's exception MRO makes subclass routing automatic —
# registering against NotFoundError catches every NotFoundError subclass.
# Client-error families (4xx) log at debug; operational families
# (429, 500) log at warning so ops sees them.


@app.exception_handler(NotFoundError)
def _handle_not_found(request, exc):
    logger.debug("%s: %s", type(exc).__name__, exc)
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ValidationError)
def _handle_validation(request, exc):
    logger.debug("%s: %s", type(exc).__name__, exc)
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(ConflictError)
def _handle_conflict(request, exc):
    logger.debug("%s: %s", type(exc).__name__, exc)
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(AuthenticationError)
def _handle_unauthorized(request, exc):
    logger.debug("%s: %s", type(exc).__name__, exc)
    return JSONResponse(status_code=401, content={"detail": str(exc)})


@app.exception_handler(AuthorizationError)
def _handle_forbidden(request, exc):
    logger.debug("%s: %s", type(exc).__name__, exc)
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(BudgetExhaustedError)
def _handle_budget(request, exc):
    logger.warning("%s: %s", type(exc).__name__, exc.args[0])
    return JSONResponse(status_code=429, content={"detail": exc.args[0]})


@app.exception_handler(ICPIdRegistryError)
def _handle_icp_registry(request, exc):
    logger.warning("%s: %s", type(exc).__name__, exc)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.exception_handler(ServiceError)
def _handle_service_error(request, exc):
    logger.warning("%s: %s", type(exc).__name__, exc)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


# Router registrations are added incrementally in Tasks 4-15.
# Each Task N adds one line: app.include_router(<domain>.router)
from app.routers import pipeline

app.include_router(pipeline.router)

from app.routers import org_auth

app.include_router(org_auth.router)

from app.routers import profiles

app.include_router(profiles.router)

from app.routers import customer_profile

app.include_router(customer_profile.router)

from app.routers import documents

app.include_router(documents.router)

from app.routers import leads

app.include_router(leads.router)

from app.routers import graph_chat

app.include_router(graph_chat.router)

from app.routers import market_research

app.include_router(market_research.router)

from app.routers import icp

app.include_router(icp.router)

from app.routers import signals

app.include_router(signals.router)

from app.routers import market_scoring

app.include_router(market_scoring.router)

# Preserve original boot-time Neo4j schema refresh (was in pre-Task-2 main.py).
# Guarded so BREWRA_SKIP_DB_INIT=1 (and any future None-graph mode) is safe.
if clients.graph is not None:
    clients.graph.refresh_schema()


# Phase C: one-time index creation on startup. Guarded by BREWRA_SKIP_DB_INIT
# (test/sandbox env var, also honored by app.core.clients) and a defensive
# clients.client is None check.
@app.on_event("startup")
def _ensure_market_scoring_indexes() -> None:
    if os.getenv("BREWRA_SKIP_DB_INIT") or clients.client is None:
        return
    from app.services.market_scoring import _get_market_score_collections

    score_coll, run_coll = _get_market_score_collections()
    score_coll.create_index([("org_id", 1), ("lead_id", 1)], unique=True)
    score_coll.create_index([("org_id", 1), ("updated_at", -1)])
    run_coll.create_index([("org_id", 1), ("status", 1)])
    run_coll.create_index([("org_id", 1), ("created_at", -1)])
