"""Internal ops-console router. Mounted at prefix='/admin' (spec 44)."""
import asyncio
from typing import Callable, Dict, List

from fastapi import APIRouter, Depends

from app.core.auth import require_admin
from app.core.dependencies import (
    get_llm2,
    get_mongo,
    get_neo4j_driver,
    get_pinecone,
)
from app.models.admin import AdminHealthResponse, AdminOrgSummary
from app.models.settings import AppSettings
from app.services.admin import (
    list_all_orgs,
    probe_llm_health,
    probe_mongo,
    probe_neo4j,
    probe_pinecone,
)
from app.services.settings import get_app_settings, update_app_settings

# Every /admin route requires a verified, allowlisted Firebase operator. This is
# the one backend-enforced surface (spec 44 / TD-FE-79); reused endpoints stay open.
router = APIRouter(tags=["admin"], dependencies=[Depends(require_admin)])

# Connectivity pings (Mongo/Neo4j/Pinecone) are sub-second; the LLM probe issues a
# real generation against the production model (get_llm2 -> Qwen3-235B), which is
# inherently slower and can cold-start -- so it gets a larger budget. Both still cap
# the call so a hung dependency can't block the panel (spec §6 item 2). A single
# tight 5s budget would false-"timeout" a healthy-but-slow LLM (the panel's most
# important row); per-probe budgets keep "timeout" meaning "actually unreachable".
_CONNECTIVITY_TIMEOUT_S = 3.0
_LLM_TIMEOUT_S = 12.0


async def _run_probe(name: str, timeout: float, fn: Callable, *args) -> Dict:
    try:
        return await asyncio.wait_for(asyncio.to_thread(fn, *args), timeout=timeout)
    except asyncio.TimeoutError:
        return {"name": name, "status": "timeout", "detail": f"probe exceeded {timeout}s"}
    except Exception as exc:  # noqa: BLE001
        return {"name": name, "status": "error", "detail": str(exc)}


@router.get("/orgs", response_model=List[AdminOrgSummary])
async def admin_list_orgs(mongo=Depends(get_mongo)):
    return list_all_orgs(mongo)


@router.get("/settings", response_model=AppSettings)
async def admin_get_settings(mongo=Depends(get_mongo)):
    return get_app_settings(mongo)


@router.put("/settings", response_model=AppSettings)
async def admin_update_settings(settings: AppSettings, mongo=Depends(get_mongo)):
    # Pydantic bounds (1..500) reject out-of-range values with 422 before we get here.
    return update_app_settings(mongo, settings)


@router.get("/health", response_model=AdminHealthResponse)
async def admin_health(
    mongo=Depends(get_mongo),
    driver=Depends(get_neo4j_driver),
    pc=Depends(get_pinecone),
    llm2=Depends(get_llm2),
):
    probes = await asyncio.gather(
        _run_probe("mongo", _CONNECTIVITY_TIMEOUT_S, probe_mongo, mongo),
        _run_probe("neo4j", _CONNECTIVITY_TIMEOUT_S, probe_neo4j, driver),
        _run_probe("pinecone", _CONNECTIVITY_TIMEOUT_S, probe_pinecone, pc),
        _run_probe("llm", _LLM_TIMEOUT_S, probe_llm_health, llm2),
    )
    return AdminHealthResponse(probes=probes)
