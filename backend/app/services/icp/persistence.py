"""Persistence layer for icp/ — Mongo CRUD for ICP records + ID-registry helpers.

§3.7 exceptions re-exported from __init__.py:
- _ensure_icp_indexes (called from app/main.py lifespan)
- _reserve_unique_icp_id, _release_icp_id (lazy-imported by customer_profile.py)
"""
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from pymongo.errors import DuplicateKeyError

from app.core.exceptions import (
    CompanyProfileNotFoundError,
    ICPConfigNotFoundError,
    ICPIdRegistryError,
    RecommendedICPNotFoundError,
)
from app.core.logging import logger


def list_icps(
    driver,
    mongo,
    agent_chain,
    user_id: str,
    refresh: bool = False,
    limit: int = 500,
    offset: int = 0,
) -> tuple[List[Dict[str, Any]], int]:
    """Fetch or generate ICPs for a given user_id.

    Implements the GET /icp handler logic:
      - Returns cached ICPs from MongoDB unless refresh=True.
      - On cache miss or refresh, generates new ICPs via ICP_generator() from
        a Neo4j company profile, normalises the payload, and persists to Mongo.
    """
    # Lazy imports to avoid circular dependency: persistence -> orchestrator -> persistence
    from app.services.icp.orchestrator import ICP_generator
    from app.services._retrieval import (  # lazy to avoid circular imports
        _build_market_context_queries,
        _fetch_pinecone_supporting_context,
    )

    logger.info(f"[ICP] Request - user_id: {user_id}, refresh: {refresh}")

    def normalize_icp_response(payload: Any) -> Dict[str, Any]:
        """
        Normalize ICP payload to the required schema:
        {"suggestedICPs": [{...required keys...}]}
        """
        if isinstance(payload, dict) and isinstance(payload.get("suggestedICPs"), list):
            raw_icps = payload.get("suggestedICPs", [])
        elif isinstance(payload, dict) and isinstance(payload.get("icps"), list):
            raw_icps = payload.get("icps", [])
        elif isinstance(payload, list):
            raw_icps = payload
        else:
            raw_icps = []

        normalized_icps = []
        seen_ids = set()
        for idx, icp in enumerate(raw_icps):
            if not isinstance(icp, dict):
                icp = {}

            # Backend-controlled id generation with global uniqueness across ICP datasets.
            # Keep existing id only if non-empty and not duplicated in current response.
            preferred_id = str(icp.get("id") or "").strip()
            if preferred_id in seen_ids:
                preferred_id = ""
            candidate_id = _reserve_unique_icp_id(
                db,
                id_type="recommended_icp",
                owner_key=str(user_id),
                preferred_id=preferred_id
            )
            seen_ids.add(candidate_id)

            # Backward/forward-compatible mapping to the expanded suggested ICP schema.
            # Old keys: industry, segment, companySize, decisionMakers, whySuggested, marketSize, topPainPoint, buyingTriggers
            # New keys: title, is_new, is_agentic, why_suggested, how_it_differs, firmographics, key_decision_makers, pain_points_and_triggers
            firmographics = icp.get("firmographics") if isinstance(icp.get("firmographics"), dict) else {}
            pain_points_and_triggers = icp.get("pain_points_and_triggers") if isinstance(icp.get("pain_points_and_triggers"), dict) else {}

            old_industry = str(icp.get("industry") or "").strip()
            old_segment = str(icp.get("segment") or "").strip()
            old_company_size = str(icp.get("companySize") or "").strip()
            old_market_size = str(icp.get("marketSize") or "").strip()

            new_title = str(icp.get("title") or "").strip()
            if not new_title:
                # Fallback title derived from firmographics (or old keys)
                title_parts = [p for p in [firmographics.get("industry") or old_industry,
                                          firmographics.get("segment") or old_segment,
                                          firmographics.get("company_size") or old_company_size] if isinstance(p, str) and p.strip()]
                new_title = " - ".join([str(p).strip() for p in title_parts]) or f"Suggested ICP {idx + 1}"

            why_suggested = icp.get("why_suggested") if isinstance(icp.get("why_suggested"), list) else None
            if why_suggested is None:
                why_suggested = icp.get("whySuggested") if isinstance(icp.get("whySuggested"), list) else []

            how_it_differs = icp.get("how_it_differs") if isinstance(icp.get("how_it_differs"), list) else []

            key_decision_makers = icp.get("key_decision_makers") if isinstance(icp.get("key_decision_makers"), list) else None
            if key_decision_makers is None:
                key_decision_makers = icp.get("decisionMakers") if isinstance(icp.get("decisionMakers"), list) else []
            if not key_decision_makers:
                key_decision_makers = ["unknown"]

            competitors = icp.get("competitors") if isinstance(icp.get("competitors"), list) else []
            if not competitors:
                competitors = ["unknown"]

            # Build firmographics block with fallbacks
            firmographics_out = {
                "industry": str(firmographics.get("industry") or old_industry),
                "segment": str(firmographics.get("segment") or old_segment),
                "company_size": str(firmographics.get("company_size") or old_company_size),
                "market_size": str(firmographics.get("market_size") or old_market_size),
            }

            # Build pain points & triggers block with fallbacks
            critical_pp = pain_points_and_triggers.get("critical")
            if not (isinstance(critical_pp, str) and critical_pp.strip()):
                critical_pp = str(icp.get("topPainPoint") or "").strip()
            others_list = pain_points_and_triggers.get("others") if isinstance(pain_points_and_triggers.get("others"), list) else None
            if others_list is None:
                others_list = icp.get("buyingTriggers") if isinstance(icp.get("buyingTriggers"), list) else []

            pain_points_out = {
                "critical": str(critical_pp or ""),
                "others": others_list,
            }

            # Derive legacy output keys from new schema whenever possible.
            derived_regions = icp.get("regions") if isinstance(icp.get("regions"), list) else []
            if not derived_regions:
                derived_regions = ["global"]

            derived_confidence = str(icp.get("confidenceScore") or "").strip()
            if not derived_confidence:
                derived_confidence = "medium"

            normalized_icps.append({
                "id": candidate_id,
                "title": new_title,
                "is_new": bool(icp.get("is_new", True)),
                "is_agentic": bool(icp.get("is_agentic", True)),
                "why_suggested": why_suggested,
                "how_it_differs": how_it_differs,
                "firmographics": firmographics_out,
                "key_decision_makers": key_decision_makers,
                "pain_points_and_triggers": pain_points_out,
                # Keep legacy keys for backward compatibility
                "industry": str(icp.get("industry") or ""),
                "segment": str(icp.get("segment") or ""),
                "companySize": str(icp.get("companySize") or ""),
                "decisionMakers": icp.get("decisionMakers") if isinstance(icp.get("decisionMakers"), list) and icp.get("decisionMakers") else key_decision_makers,
                "regions": derived_regions,
                "keyAttributes": icp.get("keyAttributes") if isinstance(icp.get("keyAttributes"), list) else [],
                "growthIndicator": str(icp.get("growthIndicator") or ""),
                "whySuggested": icp.get("whySuggested") if isinstance(icp.get("whySuggested"), list) else [],
                "confidenceScore": derived_confidence,
                "marketSize": str(icp.get("marketSize") or ""),
                "growth": str(icp.get("growth") or ""),
                "topPainPoint": str(icp.get("topPainPoint") or ""),
                "buyingTriggers": icp.get("buyingTriggers") if isinstance(icp.get("buyingTriggers"), list) else [],
                "competitors": competitors
            })

        return {"suggestedICPs": normalized_icps}

    try:
        db = mongo["Profiler"]
        collection = db["ICP_config"]

        # Filter by user_id only for multitenancy
        existing_icp = collection.find_one({"user_id": user_id})

        if existing_icp:
            logger.info(f"[ICP] Found existing ICP for user_id: {user_id}")
            if existing_icp.get("icps"):
                icps_data = existing_icp.get("icps")
                if isinstance(icps_data, dict) and "suggestedICPs" in icps_data:
                    logger.debug(f"[ICP] Existing ICP count: {len(icps_data.get('suggestedICPs', []))}")
                elif isinstance(icps_data, list):
                    logger.debug(f"[ICP] Existing ICP count (list): {len(icps_data)}")
        else:
            logger.info(f"[ICP] No existing ICP found for user_id: {user_id}")

        if existing_icp and not refresh:
            logger.info(f"[ICP] Returning cached ICP for user_id: {user_id}")
            normalized_cached = normalize_icp_response(existing_icp.get("icps", {"suggestedICPs": []}))
            # Persist normalized payload so ids/shape remain stable for subsequent fetches.
            collection.update_one(
                {"user_id": user_id},
                {"$set": {"user_id": user_id, "icps": normalized_cached}},
                upsert=True
            )
            all_items = normalized_cached.get("suggestedICPs", [])
            total = len(all_items)
            items = all_items[offset : offset + limit]
            return items, total

        logger.info(f"[ICP] Generating new ICPs for user_id: {user_id}")

        # Generate new ICPs from Neo4j company profile - get shared company profile
        with driver.session() as session:
            result = session.run(
                "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
            )
            record = result.single()

            if not record:
                logger.error(f"[ICP] ERROR: No company profile in Neo4j")
                raise CompanyProfileNotFoundError("No company profile found in Neo4j")

            company_profile = dict(record.values()[0])
            logger.info(f"[ICP] Company profile retrieved from Neo4j")

            # Convert JSON string if needed
            if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
                try:
                    company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
                except json.JSONDecodeError:
                    pass

            # Generate ICPs
            logger.info(f"[ICP] Calling ICP_generator() for user_id: {user_id}")
            try:
                icp_result = ICP_generator(agent_chain, company_profile)
                if isinstance(icp_result, dict) and "suggestedICPs" in icp_result:
                    logger.info(f"[ICP] Generated {len(icp_result.get('suggestedICPs', []))} ICPs for user_id: {user_id}")
                else:
                    logger.debug(f"[ICP] ICP_generator returned: {type(icp_result)}")
                icp_result = normalize_icp_response(icp_result)
            except Exception as gen_error:
                logger.error(f"[ICP] ERROR in ICP_generator: {str(gen_error)}")
                raise

            # Upsert the result in MongoDB - filter by user_id only
            logger.info(f"[ICP] Saving to MongoDB for user_id: {user_id}")
            try:
                update_result = collection.update_one(
                    {"user_id": user_id},
                    {"$set": {"user_id": user_id, "icps": icp_result}},
                    upsert=True
                )
                logger.info(f"[ICP] Saved to MongoDB - matched: {update_result.matched_count}, modified: {update_result.modified_count}")
            except Exception as save_error:
                logger.error(f"[ICP] ERROR saving to MongoDB: {str(save_error)}")
                raise

            logger.info(f"[ICP] Successfully returned ICPs for user_id: {user_id}")
            all_items = icp_result.get("suggestedICPs", [])
            total = len(all_items)
            items = all_items[offset : offset + limit]
            return items, total

    except Exception as e:
        logger.error(f"[ICP] ERROR: {str(e)}")
        raise


def delete_recommended_icp(mongo, icp_id: str, user_id: str) -> Dict[str, Any]:
    """Delete a single recommended ICP from ICP_config by icp_id for a given user_id."""
    db = mongo["Profiler"]
    collection = db["ICP_config"]

    document = collection.find_one({"user_id": user_id})
    if not document:
        raise ICPConfigNotFoundError(f"No ICP config found for user_id: {user_id}")

    icps_payload = document.get("icps") or {}
    suggested = []
    if isinstance(icps_payload, dict) and isinstance(icps_payload.get("suggestedICPs"), list):
        suggested = icps_payload.get("suggestedICPs", [])
    elif isinstance(icps_payload, list):
        suggested = icps_payload

    updated_suggested = []
    deleted_icp = None
    for icp in suggested:
        if isinstance(icp, dict) and str(icp.get("id")) == str(icp_id):
            deleted_icp = icp
            continue
        updated_suggested.append(icp)

    if not deleted_icp:
        raise RecommendedICPNotFoundError(f"Recommended ICP not found for icp_id: {icp_id}")

    new_payload = {"suggestedICPs": updated_suggested}
    collection.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "icps": new_payload}},
        upsert=True
    )
    _release_icp_id(db, icp_id)

    return {
        "success": True,
        "message": "Recommended ICP deleted successfully",
        "data": {
            "deleted_icp_id": str(icp_id),
            "remaining_count": len(updated_suggested)
        }
    }


# --- ICP-id registry helpers ---
def _ensure_icp_indexes(mongo) -> None:
    """Create Mongo indexes for ICP_ID_REGISTRY. Idempotent."""
    registry = mongo["Profiler"]["ICP_ID_REGISTRY"]
    registry.create_index("id", unique=True)
    registry.create_index("id_type")


def _reserve_unique_icp_id(db, id_type: str, owner_key: str = "", preferred_id: str = "") -> str:
    """
    Reserve a globally unique ICP id across recommended ICPs + customer profile ICPs.
    Uses ICP_ID_REGISTRY with a unique index on `id`.
    """
    registry = db["ICP_ID_REGISTRY"]
    candidate = str(preferred_id or "").strip()
    for _ in range(20):
        if not candidate:
            candidate = str(uuid.uuid4())
        try:
            registry.insert_one({
                "id": candidate,
                "id_type": id_type,
                "owner_key": owner_key,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            return candidate
        except DuplicateKeyError:
            # If the same owner/type already reserved this id, keep it stable.
            existing = registry.find_one({"id": candidate})
            if existing and str(existing.get("id_type")) == str(id_type) and str(existing.get("owner_key")) == str(owner_key):
                return candidate
            candidate = ""
    raise ICPIdRegistryError("Failed to generate globally unique ICP id.")


def _release_icp_id(db, icp_id: str) -> None:
    if not icp_id:
        return
    registry = db["ICP_ID_REGISTRY"]
    registry.delete_one({"id": str(icp_id)})
