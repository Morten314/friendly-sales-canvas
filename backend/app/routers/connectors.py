"""Apollo connector endpoints: connect/status/disconnect/lists/import/enrich/discover/warmup/export.

Endpoints that make a blocking Apollo call (/connect, /lists) are sync `def` so
FastAPI runs them in its threadpool (requests must not block the event loop).
Import/enrich/discover schedule BackgroundTasks and return immediately.
"""
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response

from app.core.dependencies import get_llm2, get_mongo, get_neo4j_driver
from app.models.connectors import (
    ApolloConnectRequest,
    ApolloConnectResponse,
    ApolloDiscoverRequest,
    ApolloDiscoverResponse,
    ApolloDiscoverStatusResponse,
    ApolloEnrichRequest,
    ApolloEnrichResponse,
    ApolloEnrichStatusResponse,
    ApolloImportRequest,
    ApolloImportResponse,
    ApolloListsResponse,
    ApolloStatusResponse,
    ApolloWarmupResponse,
    DisconnectResponse,
)
from app.services import connectors as connectors_service
from app.services.connectors import warmup as warmup_service

router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.post("/apollo/connect", response_model=ApolloConnectResponse)
def connect_apollo(request: ApolloConnectRequest, mongo=Depends(get_mongo)):
    """Validate the customer's Apollo API key (credit-free) and store it."""
    return connectors_service.connect_apollo(mongo, request)


@router.get("/apollo/status", response_model=ApolloStatusResponse)
def apollo_status(org_id: str = Query(...), mongo=Depends(get_mongo)):
    """Return the Apollo connection status and connected_at timestamp for the org."""
    return connectors_service.get_apollo_status(mongo, org_id)


@router.delete("/apollo/connect", response_model=DisconnectResponse)
def disconnect_apollo(org_id: str = Query(...), mongo=Depends(get_mongo)):
    """Remove stored Apollo credentials. Credentials are keyed by (org_id, provider)."""
    return connectors_service.disconnect_apollo(mongo, org_id)


@router.get("/apollo/lists", response_model=ApolloListsResponse)
def apollo_lists(org_id: str = Query(...), mongo=Depends(get_mongo)):
    """The customer's Apollo lists (labels) for the import picker."""
    return connectors_service.list_apollo_lists(mongo, org_id)


@router.post("/apollo/import", response_model=ApolloImportResponse)
async def apollo_import(
    request: ApolloImportRequest,
    background_tasks: BackgroundTasks,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
):
    """Queue a background import. Progress is polled via GET /leads/stream/status."""
    return connectors_service.start_apollo_import(driver, mongo, request, background_tasks)


@router.post("/apollo/enrich", response_model=ApolloEnrichResponse)
async def apollo_enrich(
    request: ApolloEnrichRequest,
    background_tasks: BackgroundTasks,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
):
    """Queue a background enrichment run over the selected lead_ids."""
    return connectors_service.start_apollo_enrich(driver, mongo, request, background_tasks)


@router.get("/apollo/enrich/status", response_model=ApolloEnrichStatusResponse)
async def apollo_enrich_status(
    org_id: str = Query(...),
    run_id: Optional[str] = Query(None),
    mongo=Depends(get_mongo),
):
    """Return progress and result summary for an Apollo enrichment run."""
    return connectors_service.get_apollo_enrich_status(mongo, org_id, run_id)


@router.post("/apollo/discover", response_model=ApolloDiscoverResponse)
async def apollo_discover(
    request: ApolloDiscoverRequest,
    background_tasks: BackgroundTasks,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    llm=Depends(get_llm2),
):
    """Queue an ICP-driven Apollo discovery run."""
    return connectors_service.start_apollo_discover(driver, mongo, request, background_tasks, llm=llm)


@router.get("/apollo/discover/status", response_model=ApolloDiscoverStatusResponse)
async def apollo_discover_status(
    org_id: str = Query(...),
    run_id: Optional[str] = Query(None),
    mongo=Depends(get_mongo),
):
    """Return progress and result summary for an Apollo discovery run."""
    return connectors_service.get_apollo_discovery_status(mongo, org_id, run_id)


@router.get("/apollo/warmup", response_model=ApolloWarmupResponse)
async def apollo_warmup(
    org_id: str = Query(...),
    user_id: str = Query(...),
    mongo=Depends(get_mongo),
):
    """Return the four-milestone warmup readiness status for ICP-driven discovery."""
    return warmup_service.get_warmup_status(mongo, org_id, user_id)


@router.get("/apollo/leads/export")
async def apollo_leads_export(
    org_id: str = Query(...),
    fmt: str = Query("json", alias="format"),
    driver=Depends(get_neo4j_driver),
):
    """Export discovery leads as JSON or CSV."""
    body, content_type = connectors_service.export_discovery_leads(driver, org_id, fmt=fmt)
    return Response(content=body, media_type=content_type)
