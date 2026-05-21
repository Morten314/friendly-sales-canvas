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

from app.core.config import origins  # noqa: F401 — kept for backwards compat if any code reads it
from app.core import database

# Logging configuration (moved from api.py)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI app construction (moved from api.py:164)
app = FastAPI()

# CORS middleware (moved from api.py:167-173)
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

# Preserve original boot-time Neo4j schema refresh (was in pre-Task-2 main.py).
# Guarded so BREWRA_SKIP_DB_INIT=1 (and any future None-graph mode) is safe.
if database.graph is not None:
    database.graph.refresh_schema()
