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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import clients
from app.core.logging import logger  # noqa: F401 — re-exported for backward compat within Phase B

app = FastAPI()

# NOTE: allow_origins=["*"] with allow_credentials=True is preserved from
# original behavior. Phase B tightens this.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
