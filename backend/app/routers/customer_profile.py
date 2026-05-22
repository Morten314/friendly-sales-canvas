"""Customer profile (Profiler agent) endpoints."""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.core import clients
from app.models.customer_profile import CustomerProfileRequest, SuggestedICPToCustomerProfileRequest

# Phase-A:
#   - ICP-id-registry helpers (_ensure_icp_id_registry_indexes, _reserve_unique_icp_id,
#     _release_icp_id) moved to app.services.icp in commit 13/16.
#   - _get_profiler_mongo_client moved to app.services.market_scoring in commit 15/16.
#   Both helpers are imported lazily inside handlers to keep import order simple
#   (no circular risk now that they live in app.services).

router = APIRouter()


@router.post("/customer_profile")
async def create_or_update_customer_profile(request: CustomerProfileRequest):
    """
    Create or update customer profiles (ICPs) in MongoDB.
    Customer profiles are stored within the company profile document.
    """
    from app.services.market_scoring import _get_profiler_mongo_client
    from app.services.icp import _ensure_icp_id_registry_indexes, _reserve_unique_icp_id
    try:
        # MongoDB connection
        mongo_client = _get_profiler_mongo_client()
        db = mongo_client["Profiler"]
        _ensure_icp_id_registry_indexes(db)
        collection = db["Company_Profile"]

        # Get company profile from Neo4j to include in MongoDB document (filter by org_id)
        company_profile_data = {}
        with clients.driver.session() as session:
            result = session.run(
                "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                org_id=request.org_id
            )
            record = result.single()
            if record:
                company_profile_data = dict(record.values()[0])
                # Parse JSON strings back to objects
                for key, value in company_profile_data.items():
                    if isinstance(value, str) and value.strip().startswith(('{', '[')):
                        try:
                            company_profile_data[key] = json.loads(value)
                        except json.JSONDecodeError:
                            pass

        # Prepare ICPs with backend-generated globally unique IDs and timestamps.
        current_time = datetime.now(timezone.utc).isoformat()
        processed_icps = []

        for icp in request.icps:
            icp_dict = icp.model_dump(exclude_none=True)

            # Set created_at if not provided
            if not icp_dict.get("created_at"):
                icp_dict["created_at"] = current_time

            # Ensure status has default value
            if not icp_dict.get("status"):
                icp_dict["status"] = "saved"

            processed_icps.append(icp_dict)

        # Upsert the document - store company profile + customer profiles together (filter by org_id)
        # Merge with existing ICPs instead of overwriting the entire list.
        filter_query = {"profile_type": "company", "org_id": request.org_id}
        existing_doc = collection.find_one(filter_query) or {}
        existing_icps = (((existing_doc.get("customer_profiles") or {}).get("icps")) or [])
        existing_by_id = {str(x.get("id")): x for x in existing_icps if isinstance(x, dict) and x.get("id")}

        # Ensure existing records have globally reserved IDs.
        repaired_existing = {}
        for existing in existing_icps:
            if not isinstance(existing, dict):
                continue
            existing_id = str(existing.get("id") or "").strip()
            if existing_id:
                reserved_existing_id = _reserve_unique_icp_id(
                    db,
                    id_type="customer_profile_icp",
                    owner_key=str(request.org_id),
                    preferred_id=existing_id
                )
                existing["id"] = reserved_existing_id
                repaired_existing[reserved_existing_id] = existing
            else:
                new_existing_id = _reserve_unique_icp_id(
                    db,
                    id_type="customer_profile_icp",
                    owner_key=str(request.org_id)
                )
                existing["id"] = new_existing_id
                repaired_existing[new_existing_id] = existing

        existing_by_id = repaired_existing

        # Upsert by id for existing ICPs. New ICPs always get backend-generated IDs.
        for icp in processed_icps:
            requested_id = str(icp.get("id") or "").strip()
            if requested_id and requested_id in existing_by_id:
                icp["id"] = requested_id
                existing_by_id[requested_id] = icp
                continue

            generated_id = _reserve_unique_icp_id(
                db,
                id_type="customer_profile_icp",
                owner_key=str(request.org_id)
            )
            icp["id"] = generated_id
            existing_by_id[generated_id] = icp

        merged_icps = list(existing_by_id.values())

        update_doc = {
            "$set": {
                "profile_type": "company",
                "org_id": request.org_id,
                "company_profile": company_profile_data,
                "customer_profiles": {
                    "icps": merged_icps
                },
                "updated_at": current_time
            }
        }

        collection.update_one(filter_query, update_doc, upsert=True)

        mongo_client.close()

        return {
            "success": True,
            "message": "Customer profiles saved successfully",
            "data": {
                "icps": merged_icps
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/customer_profile")
async def get_customer_profile(org_id: str = Query(...)):
    """
    Get customer profiles (ICPs) from MongoDB.
    Returns both company profile and associated customer profiles from the same document.
    Filtered by org_id for multi-org support.
    """
    from app.services.market_scoring import _get_profiler_mongo_client
    from app.services.icp import _ensure_icp_id_registry_indexes, _reserve_unique_icp_id
    mongo_client = None
    try:
        # MongoDB connection
        mongo_client = _get_profiler_mongo_client()
        db = mongo_client["Profiler"]
        _ensure_icp_id_registry_indexes(db)
        collection = db["Company_Profile"]

        # Find the company profile document (filter by org_id)
        filter_query = {"profile_type": "company", "org_id": org_id}
        document = collection.find_one(filter_query)

        if not document:
            # If no MongoDB document exists, try to get from Neo4j and return empty customer profiles
            with clients.driver.session() as session:
                result = session.run(
                    "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                    org_id=org_id
                )
                record = result.single()
                if not record:
                    raise HTTPException(
                        status_code=404,
                        detail=f"No company profile found for org_id: {org_id}"
                    )

            return {
                "success": True,
                "data": {
                    "icps": []
                }
            }

        # Extract customer profiles
        customer_profiles = document.get("customer_profiles", {})
        icps = customer_profiles.get("icps", [])

        # Ensure frontend always receives ids and every id is globally unique/reserved.
        changed = False
        for icp in icps:
            if not isinstance(icp, dict):
                continue
            existing_id = str(icp.get("id") or "").strip()
            if existing_id:
                reserved_id = _reserve_unique_icp_id(
                    db,
                    id_type="customer_profile_icp",
                    owner_key=str(org_id),
                    preferred_id=existing_id
                )
                if reserved_id != existing_id:
                    icp["id"] = reserved_id
                    changed = True
            else:
                icp["id"] = _reserve_unique_icp_id(
                    db,
                    id_type="customer_profile_icp",
                    owner_key=str(org_id)
                )
                changed = True

        if changed:
            collection.update_one(
                filter_query,
                {"$set": {"customer_profiles.icps": icps, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )

        # Remove MongoDB _id if present in ICPs
        for icp in icps:
            if "_id" in icp:
                del icp["_id"]

        return {
            "success": True,
            "data": {
                "icps": icps
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if mongo_client:
            mongo_client.close()


@router.post("/customer_profile/from_suggested_icp")
async def save_suggested_icp_as_customer_profile(request: SuggestedICPToCustomerProfileRequest):
    """
    Convert a suggested/recommended ICP (from GET /icp) into a Customer Profile ICP and save it.
    Enforces uniqueness by source suggested ICP id within the org's saved customer profiles.
    """
    from app.services.market_scoring import _get_profiler_mongo_client
    from app.services.icp import _ensure_icp_id_registry_indexes, _reserve_unique_icp_id
    try:
        # --- Load suggested ICPs for this user_id ---
        mongo_client = _get_profiler_mongo_client()

        profiler_db = mongo_client["Profiler"]
        _ensure_icp_id_registry_indexes(profiler_db)
        icp_config_collection = profiler_db["ICP_config"]
        icp_config = icp_config_collection.find_one({"user_id": request.user_id}) or {}
        icps_payload = icp_config.get("icps") or {}
        suggested = []
        if isinstance(icps_payload, dict) and isinstance(icps_payload.get("suggestedICPs"), list):
            suggested = icps_payload.get("suggestedICPs", [])
        elif isinstance(icps_payload, list):
            suggested = icps_payload

        # Find requested suggested ICP by id
        target = None
        for item in suggested:
            if isinstance(item, dict) and str(item.get("id")) == str(request.icp_id):
                target = item
                break
        if not target:
            mongo_client.close()
            raise HTTPException(status_code=404, detail=f"Suggested ICP not found for icp_id: {request.icp_id}")

        # --- Map suggested ICP -> CustomerProfileICP schema ---
        regions = target.get("regions") if isinstance(target.get("regions"), list) else []
        decision_makers = target.get("decisionMakers") if isinstance(target.get("decisionMakers"), list) else []

        primary_region = (regions[0] if regions else None) or "global"
        industry_list = [x for x in [target.get("industry"), target.get("segment")] if isinstance(x, str) and x.strip()]
        company_size_list = [target.get("companySize")] if isinstance(target.get("companySize"), str) and target.get("companySize").strip() else []
        buyer_role_list = [x for x in decision_makers if isinstance(x, str) and x.strip()]

        # fit_confidence: map from confidenceScore if possible, else default to medium
        raw_conf = str(target.get("confidenceScore") or "").strip().lower()
        if raw_conf in {"high", "medium", "low"}:
            fit_confidence = raw_conf
        else:
            # Try to parse numeric confidence
            fit_confidence = "medium"
            try:
                conf_num = float(raw_conf)
                if conf_num >= 0.75:
                    fit_confidence = "high"
                elif conf_num <= 0.35:
                    fit_confidence = "low"
            except Exception:
                pass

        # Pydantic required fields guardrails
        if not industry_list:
            industry_list = ["unknown"]
        if not company_size_list:
            company_size_list = ["unknown"]
        if not buyer_role_list:
            buyer_role_list = ["unknown"]

        why_suggested = target.get("whySuggested") if isinstance(target.get("whySuggested"), list) else []
        additional_context_parts = []
        if why_suggested:
            additional_context_parts.append("Why suggested: " + "; ".join([str(x) for x in why_suggested if str(x).strip()]))
        if target.get("topPainPoint"):
            additional_context_parts.append("Top pain point: " + str(target.get("topPainPoint")))
        if target.get("growthIndicator"):
            additional_context_parts.append("Growth indicator: " + str(target.get("growthIndicator")))
        additional_context = "\n".join([p for p in additional_context_parts if p])

        new_icp = {
            "id": _reserve_unique_icp_id(
                profiler_db,
                id_type="customer_profile_icp",
                owner_key=str(request.org_id)
            ),
            "primary_region": str(primary_region),
            "industry": industry_list,
            "company_size": company_size_list,
            "buyer_role": buyer_role_list,
            "fit_confidence": fit_confidence,
            "status": "saved",
            "created_at": datetime.now(timezone.utc).isoformat(),
            # Track source suggested icp for uniqueness + traceability (allowed due to extra='allow')
            "source_suggested_icp_id": str(request.icp_id),
            "source_user_id": str(request.user_id),
            "source_payload": target,
            "additional_context": additional_context or None,
        }

        # --- Save into Company_Profile customer_profiles.icps (org-scoped) with uniqueness check ---
        company_profile_collection = profiler_db["Company_Profile"]
        filter_query = {"profile_type": "company", "org_id": request.org_id}
        existing_doc = company_profile_collection.find_one(filter_query) or {}
        existing_icps = (((existing_doc.get("customer_profiles") or {}).get("icps")) or [])

        # Reject if this suggested ICP was already saved for this org
        for existing in existing_icps:
            if isinstance(existing, dict) and str(existing.get("source_suggested_icp_id")) == str(request.icp_id):
                mongo_client.close()
                raise HTTPException(status_code=409, detail="This suggested ICP is already saved in customer profile.")

        merged_icps = [x for x in existing_icps if isinstance(x, dict)] + [new_icp]

        # Get company profile from Neo4j to include (reuse existing if present)
        company_profile_data = existing_doc.get("company_profile") or {}
        if not company_profile_data:
            with clients.driver.session() as session:
                result = session.run(
                    "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                    org_id=request.org_id
                )
                record = result.single()
                if record:
                    company_profile_data = dict(record.values()[0])
                    for key, value in company_profile_data.items():
                        if isinstance(value, str) and value.strip().startswith(('{', '[')):
                            try:
                                company_profile_data[key] = json.loads(value)
                            except json.JSONDecodeError:
                                pass

        current_time = datetime.now(timezone.utc).isoformat()
        update_doc = {
            "$set": {
                "profile_type": "company",
                "org_id": request.org_id,
                "company_profile": company_profile_data,
                "customer_profiles": {"icps": merged_icps},
                "updated_at": current_time,
            }
        }
        company_profile_collection.update_one(filter_query, update_doc, upsert=True)
        mongo_client.close()

        return {
            "success": True,
            "message": "Suggested ICP saved to customer profile successfully",
            "data": {"icp": new_icp}
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/customer_profile/icp/{icp_id}")
async def delete_customer_profile_icp(icp_id: str, org_id: str = Query(...)):
    """
    Delete a single saved customer profile ICP by icp_id for a given org_id.
    """
    from app.services.market_scoring import _get_profiler_mongo_client
    from app.services.icp import _ensure_icp_id_registry_indexes, _release_icp_id
    mongo_client = None
    try:
        mongo_client = _get_profiler_mongo_client()
        db = mongo_client["Profiler"]
        _ensure_icp_id_registry_indexes(db)
        collection = db["Company_Profile"]

        filter_query = {"profile_type": "company", "org_id": org_id}
        document = collection.find_one(filter_query)
        if not document:
            raise HTTPException(status_code=404, detail=f"No customer profile document found for org_id: {org_id}")

        existing_icps = (((document.get("customer_profiles") or {}).get("icps")) or [])
        updated_icps = []
        deleted_icp = None
        for icp in existing_icps:
            if isinstance(icp, dict) and str(icp.get("id")) == str(icp_id):
                deleted_icp = icp
                continue
            updated_icps.append(icp)

        if not deleted_icp:
            raise HTTPException(status_code=404, detail=f"Customer profile ICP not found for icp_id: {icp_id}")

        collection.update_one(
            filter_query,
            {"$set": {"customer_profiles.icps": updated_icps, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        _release_icp_id(db, icp_id)

        return {
            "success": True,
            "message": "Customer profile ICP deleted successfully",
            "data": {
                "deleted_icp_id": str(icp_id),
                "remaining_count": len(updated_icps)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if mongo_client:
            mongo_client.close()
