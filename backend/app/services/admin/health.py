"""Admin ops — dependency health probes (spec 44 §6 item 2).

Each probe is sync and returns a dict shaped like HealthProbe. The router
wraps each in a per-probe timeout so an up-but-slow dependency surfaces as a
degraded badge rather than hanging the request.
"""
import time
from typing import Any, Dict

from app.services.health import probe_llm


def _ok(name: str, start: float) -> Dict[str, Any]:
    return {
        "name": name,
        "status": "ok",
        "latency_ms": round((time.perf_counter() - start) * 1000, 2),
    }


def _err(name: str, exc: Exception) -> Dict[str, Any]:
    return {"name": name, "status": "error", "detail": str(exc)}


def probe_mongo(mongo) -> Dict[str, Any]:
    start = time.perf_counter()
    try:
        mongo.admin.command("ping")
        return _ok("mongo", start)
    except Exception as exc:  # noqa: BLE001
        return _err("mongo", exc)


def probe_neo4j(driver) -> Dict[str, Any]:
    start = time.perf_counter()
    try:
        driver.verify_connectivity()
        return _ok("neo4j", start)
    except Exception as exc:  # noqa: BLE001
        return _err("neo4j", exc)


def probe_pinecone(pc) -> Dict[str, Any]:
    start = time.perf_counter()
    try:
        pc.list_indexes()
        return _ok("pinecone", start)
    except Exception as exc:  # noqa: BLE001
        return _err("pinecone", exc)


def probe_llm_health(llm2) -> Dict[str, Any]:
    start = time.perf_counter()
    result = probe_llm(llm2)  # {"status": "success"|"error", ...}
    if result.get("status") == "success":
        return _ok("llm", start)
    return {"name": "llm", "status": "error", "detail": result.get("error", "unknown")}
