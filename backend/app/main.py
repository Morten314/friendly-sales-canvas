"""FastAPI application factory.

This module owns:
  - The FastAPI() instance
  - CORS middleware
  - Logging configuration
  - include_router() calls for all domain routers (added incrementally
    as routers are extracted in Tasks 4-15)

Domain routers register themselves here. Routes themselves live in
app/routers/<domain>.py.
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import database

# Logging configuration.
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
if database.graph is not None:
    database.graph.refresh_schema()
