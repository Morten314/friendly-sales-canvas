"""FastAPI application factory.

Owns the `FastAPI()` instance, CORS middleware, the `lifespan` context
manager (which builds the client/LLM bundles on `app.state`), domain
exception handlers, and `include_router(...)` calls for each domain.
Routes themselves live in `app/routers/<domain>.py`; logging in
`app/core/logging.py`.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
from app.core.logging import logger  # noqa: F401
from app.services.market_scoring import _ensure_market_scoring_indexes
from app.services.leads import _ensure_leads_indexes
from app.services.icp import _ensure_icp_indexes


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Construct external clients/LLMs once and stash them on `app.state`.
    Refresh the Neo4j schema and ensure Mongo indexes for market scoring.
    Idempotent — `create_index` is a no-op when an equivalent index exists.
    """
    app.state.clients = build_clients()
    app.state.llm = build_llm_config(app.state.clients)

    if app.state.clients.graph is not None:
        try:
            app.state.clients.graph.refresh_schema()
        except Exception as e:
            logger.error("Neo4j refresh_schema (lifespan) failed: %s", e)

    if app.state.clients.client is not None:
        _ensure_market_scoring_indexes(app.state.clients.client)
        _ensure_leads_indexes(app.state.clients.client)
        _ensure_icp_indexes(app.state.clients.client)

    yield
    # No teardown — clients are process-lifetime singletons.


app = FastAPI(lifespan=lifespan)

# TODO: tighten — `allow_origins=["*"]` with `allow_credentials=True` is
# the legacy default; the security backlog (spec §2.2) calls for restricting
# this to known frontend origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Domain-exception handlers: each BrewraError base maps to an HTTP response.
# Python's exception MRO makes subclass routing automatic — registering
# against `NotFoundError` catches every `NotFoundError` subclass. Client-error
# families (4xx) log at debug; operational families (429, 500) log at warning.


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
