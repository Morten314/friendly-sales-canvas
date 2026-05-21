"""Pinecone-backed retrieval helpers (shared across market_research, icp, signals).

Internal to the services layer (leading underscore).
"""
import json
import logging
from typing import List, Dict, Any, Optional

from langchain_openai import OpenAIEmbeddings

from app.core import database
from app.core.config import pinecone_api_key, together_api_key

logger = logging.getLogger(__name__)


def _stringify_context_for_query(payload: Any) -> str:
    """Convert payload into compact text for context query generation."""
    try:
        if isinstance(payload, str):
            return payload
        if isinstance(payload, dict):
            parts = []
            for key, value in payload.items():
                if isinstance(value, (str, int, float, bool)):
                    parts.append(f"{key}: {value}")
            if parts:
                return " | ".join(parts)
            return json.dumps(payload, default=str)[:1500]
        return json.dumps(payload, default=str)[:1500]
    except Exception:
        return str(payload)


def _build_market_context_queries(component_name: str, context_payload: Any) -> List[str]:
    """Generate lightweight Pinecone queries for market research support."""
    base_text = _stringify_context_for_query(context_payload)
    trimmed = " ".join(base_text.split())[:220]
    if not trimmed:
        trimmed = "company profile and market context"
    return [
        f"{component_name} market context {trimmed}",
        f"{component_name} buyer pain points and triggers {trimmed}",
    ][:2]


def _build_signal_context_queries(agent_name: str, context_payload: Any) -> List[str]:
    """Generate 1-2 Pinecone queries for signal support context."""
    base_text = _stringify_context_for_query(context_payload)
    trimmed = " ".join(base_text.split())[:220]
    if not trimmed:
        trimmed = "company profile and signals context"
    return [
        f"{agent_name} signal opportunities and trigger events {trimmed}",
        f"{agent_name} expansion intent risk changes {trimmed}",
    ][:2]


def _fetch_pinecone_supporting_context(
    queries: List[str],
    org_id: Optional[str],
    top_k: int = 3
) -> List[Dict[str, Any]]:
    """
    Best-effort Pinecone retrieval.
    Never raises; returns [] on any issue.
    """
    if not queries or not pinecone_api_key:
        return []
    if not org_id:
        return []

    try:
        index = database.pc.Index("brewra-documents")
        embeddings = OpenAIEmbeddings(
            openai_api_key=together_api_key,
            openai_api_base="https://api.together.xyz/v1",
            model="intfloat/multilingual-e5-large-instruct"
        )

        results: List[Dict[str, Any]] = []
        seen_ids = set()
        for q in queries:
            try:
                vector = embeddings.embed_query(q)
                response = index.query(
                    vector=vector,
                    top_k=top_k,
                    namespace=org_id,
                    include_metadata=True
                )
                matches = getattr(response, "matches", []) or []
                for match in matches:
                    match_id = getattr(match, "id", None)
                    if match_id and match_id in seen_ids:
                        continue
                    if match_id:
                        seen_ids.add(match_id)
                    metadata = getattr(match, "metadata", {}) or {}
                    results.append({
                        "query": q,
                        "id": match_id,
                        "score": getattr(match, "score", None),
                        "content": metadata.get("text") or metadata.get("page_content") or "",
                        "metadata": metadata,
                    })
            except Exception as query_error:
                logger.warning(f"Pinecone support query failed, continuing: {query_error}")
                continue
        return results
    except Exception as e:
        logger.warning(f"Pinecone support context unavailable, continuing without it: {e}")
        return []
