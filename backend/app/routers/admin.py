"""Internal ops-console router. Mounted at prefix='/admin' (spec 44)."""
import asyncio
from typing import Callable, Dict, List

from fastapi import APIRouter, Depends

from app.core.dependencies import (
    get_llm2,
    get_mongo,
    get_neo4j_driver,
    get_pinecone,
)
from app.models.admin import AdminHealthResponse, AdminOrgSummary
from app.services.admin import (
    list_all_orgs,
    probe_llm_health,
    probe_mongo,
    probe_neo4j,
    probe_pinecone,
)

router = APIRouter(tags=["admin"])

_PROBE_TIMEOUT_S = 5.0


async def _run_probe(name: str, fn: Callable, *args) -> Dict:
    try:
        return await asyncio.wait_for(asyncio.to_thread(fn, *args), timeout=_PROBE_TIMEOUT_S)
    except asyncio.TimeoutError:
        return {"name": name, "status": "timeout", "detail": f"probe exceeded {_PROBE_TIMEOUT_S}s"}
    except Exception as exc:  # noqa: BLE001
        return {"name": name, "status": "error", "detail": str(exc)}


@router.get("/orgs", response_model=List[AdminOrgSummary])
async def admin_list_orgs(mongo=Depends(get_mongo)):
    return list_all_orgs(mongo)


@router.get("/health", response_model=AdminHealthResponse)
async def admin_health(
    mongo=Depends(get_mongo),
    driver=Depends(get_neo4j_driver),
    pc=Depends(get_pinecone),
    llm2=Depends(get_llm2),
):
    probes = await asyncio.gather(
        _run_probe("mongo", probe_mongo, mongo),
        _run_probe("neo4j", probe_neo4j, driver),
        _run_probe("pinecone", probe_pinecone, pc),
        _run_probe("llm", probe_llm_health, llm2),
    )
    return AdminHealthResponse(probes=probes)
