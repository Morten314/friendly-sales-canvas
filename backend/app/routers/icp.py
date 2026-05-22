"""ICP endpoints: synthesis, multi-component research, and saved-ICP delete."""
import asyncio
import json
import urllib.parse
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query
from pymongo import MongoClient

from app.core import clients
from app.models.market_research import MarketRequest
from app.services import icp as icp_service
from app.services._claude_budget import CLAUDE_API_KEY
from app.services._retrieval import (
    _build_market_context_queries,
    _fetch_pinecone_supporting_context,
)

router = APIRouter(tags=["icp"])


@router.get("/icp")
async def get_or_create_icp_config(user_id: str = Query(...), refresh: bool = Query(False)):
    print(f"[ICP] Request - user_id: {user_id}, refresh: {refresh}")
    client = None
    try:
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
                candidate_id = icp_service._reserve_unique_icp_id(
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

        # MongoDB connection setup
        from app.services.market_scoring import _get_profiler_mongo_client
        client = _get_profiler_mongo_client()
        db = client["Profiler"]
        icp_service._ensure_icp_id_registry_indexes(db)
        collection = db["ICP_config"]

        # Filter by user_id only for multitenancy
        existing_icp = collection.find_one({"user_id": user_id})

        if existing_icp:
            print(f"[ICP] Found existing ICP for user_id: {user_id}")
            if existing_icp.get("icps"):
                icps_data = existing_icp.get("icps")
                if isinstance(icps_data, dict) and "suggestedICPs" in icps_data:
                    print(f"[ICP] Existing ICP count: {len(icps_data.get('suggestedICPs', []))}")
                elif isinstance(icps_data, list):
                    print(f"[ICP] Existing ICP count (list): {len(icps_data)}")
        else:
            print(f"[ICP] No existing ICP found for user_id: {user_id}")

        if existing_icp and not refresh:
            print(f"[ICP] Returning cached ICP for user_id: {user_id}")
            normalized_cached = normalize_icp_response(existing_icp.get("icps", {"suggestedICPs": []}))
            # Persist normalized payload so ids/shape remain stable for subsequent fetches.
            collection.update_one(
                {"user_id": user_id},
                {"$set": {"user_id": user_id, "icps": normalized_cached}},
                upsert=True
            )
            return normalized_cached

        print(f"[ICP] Generating new ICPs for user_id: {user_id}")

        # Generate new ICPs from Neo4j company profile - get shared company profile
        with clients.driver.session() as session:
            result = session.run(
                "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
            )
            record = result.single()

            if not record:
                print(f"[ICP] ERROR: No company profile in Neo4j")
                client.close()
                raise HTTPException(status_code=404, detail="No company profile found in Neo4j")

            company_profile = dict(record.values()[0])
            print(f"[ICP] Company profile retrieved from Neo4j")

            # Convert JSON string if needed
            if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
                try:
                    company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
                except json.JSONDecodeError:
                    pass

            # Generate ICPs
            print(f"[ICP] Calling ICP_generator() for user_id: {user_id}")
            try:
                icp_result = icp_service.ICP_generator(company_profile)
                if isinstance(icp_result, dict) and "suggestedICPs" in icp_result:
                    print(f"[ICP] Generated {len(icp_result.get('suggestedICPs', []))} ICPs for user_id: {user_id}")
                else:
                    print(f"[ICP] ICP_generator returned: {type(icp_result)}")
                icp_result = normalize_icp_response(icp_result)
            except Exception as gen_error:
                print(f"[ICP] ERROR in ICP_generator: {str(gen_error)}")
                raise HTTPException(status_code=500, detail=f"ICP generation failed: {str(gen_error)}")

            # Upsert the result in MongoDB - filter by user_id only
            print(f"[ICP] Saving to MongoDB for user_id: {user_id}")
            try:
                update_result = collection.update_one(
                    {"user_id": user_id},
                    {"$set": {"user_id": user_id, "icps": icp_result}},
                    upsert=True
                )
                print(f"[ICP] Saved to MongoDB - matched: {update_result.matched_count}, modified: {update_result.modified_count}")
            except Exception as save_error:
                print(f"[ICP] ERROR saving to MongoDB: {str(save_error)}")
                raise HTTPException(status_code=500, detail=f"Failed to save ICP: {str(save_error)}")

            print(f"[ICP] Successfully returned ICPs for user_id: {user_id}")
            return icp_result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ICP] ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    finally:
        if client:
            client.close()


@router.post("/icp-research")
async def icp_research(request: MarketRequest):
    component_name = request.component_name.strip().lower()

    # Lookup the function for the given component
    research_function = icp_service.ICP_FUNCTIONS.get(component_name)
    if not research_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported component_name: {request.component_name}"
        )

    # MongoDB connection
    username = urllib.parse.quote_plus("techbrewra")
    password = urllib.parse.quote_plus("Brewra@Best09")
    mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
    client = MongoClient(mongo_uri)
    db = client["Profiler"]
    collection = db["ICPs"]

    try:
        # Filter by user_id only for multitenancy
        query = {
            "user_id": request.user_id,
            "component_name": component_name
        }

        # If refresh is False, fetch the latest report
        if not request.refresh:
            latest_report = await asyncio.to_thread(
                collection.find_one, query, sort=[("timestamp", -1)]
            )
            if latest_report:
                latest_report.pop("_id", None)
                return {"status": "success", "data": latest_report}

        # --- Neo4j query inside a thread - get company profile by org_id ---
        def fetch_company_profile():
            with clients.driver.session() as session:
                # Get the company profile filtered by org_id (if provided)
                if request.org_id:
                    result = session.run(
                        "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                        org_id=request.org_id
                    )
                else:
                    # Fallback: get any company profile (backward compatibility)
                    result = session.run(
                        "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
                    )
                record = result.single()
                return record

        record = await asyncio.to_thread(fetch_company_profile)
        if not record:
            org_msg = f" for org_id: {request.org_id}" if request.org_id else ""
            raise HTTPException(status_code=404, detail=f"No company profile found in Neo4j{org_msg}")

        company_profile = dict(record.values()[0])
        if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
            try:
                company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
            except json.JSONDecodeError:
                pass

        # --- Get ICP card/data from request body (flexible data field) ---
        # Prepare combined context data with company profile and ICP card from request
        context_data = {
            "company_profile": company_profile
        }

        # Add ICP card data from request body if available
        if request.data:
            # The request.data is flexible and should contain ICP card data
            context_data["icp_card"] = request.data

        market_context_queries = _build_market_context_queries(component_name, context_data)
        pinecone_context = await asyncio.to_thread(
            _fetch_pinecone_supporting_context,
            market_context_queries,
            request.org_id,
            3
        )
        context_data["pinecone_context_queries"] = market_context_queries
        context_data["pinecone_supporting_context"] = pinecone_context

        # Convert to JSON string for the research function
        context_json = json.dumps(context_data)

        # --- Run research with retries (max 2 attempts) ---
        max_retries = 2
        for attempt in range(1, max_retries + 1):
            try:
                research_result = await asyncio.to_thread(research_function, context_json)
                break
            except Exception as e:
                if attempt == max_retries:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Research function failed after {max_retries} attempts: {str(e)}"
                    )
                await asyncio.sleep(1)  # retry delay

        # Add metadata - filter by user_id only
        research_result.update({
            "user_id": request.user_id,
            "component_name": component_name,
            "timestamp": datetime.utcnow()
        })
        if request.org_id:
            research_result["org_id"] = request.org_id

        # Save to DB
        await asyncio.to_thread(collection.insert_one, research_result)

        research_result.pop("_id", None)
        return {"status": "success", "data": research_result}

    finally:
        client.close()


@router.post("/icp-research_claude")
async def icp_research_claude(request: MarketRequest):
    """Same as /icp-research but research is generated with Claude (Tavily + Anthropic)."""
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")

    component_name = request.component_name.strip().lower()

    research_function = icp_service.ICP_FUNCTIONS_CLAUDE.get(component_name)
    if not research_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported component_name: {request.component_name}"
        )

    username = urllib.parse.quote_plus("techbrewra")
    password = urllib.parse.quote_plus("Brewra@Best09")
    mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
    client = MongoClient(mongo_uri)
    db = client["Profiler"]
    collection = db["ICPs"]

    try:
        query = {
            "user_id": request.user_id,
            "component_name": component_name
        }

        if not request.refresh:
            latest_report = await asyncio.to_thread(
                collection.find_one, query, sort=[("timestamp", -1)]
            )
            if latest_report:
                latest_report.pop("_id", None)
                return {"status": "success", "data": latest_report}

        def fetch_company_profile():
            with clients.driver.session() as session:
                if request.org_id:
                    result = session.run(
                        "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                        org_id=request.org_id
                    )
                else:
                    result = session.run(
                        "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
                    )
                record = result.single()
                return record

        record = await asyncio.to_thread(fetch_company_profile)
        if not record:
            org_msg = f" for org_id: {request.org_id}" if request.org_id else ""
            raise HTTPException(status_code=404, detail=f"No company profile found in Neo4j{org_msg}")

        company_profile = dict(record.values()[0])
        if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
            try:
                company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
            except json.JSONDecodeError:
                pass

        context_data = {
            "company_profile": company_profile
        }

        if request.data:
            context_data["icp_card"] = request.data

        market_context_queries = _build_market_context_queries(component_name, context_data)
        pinecone_context = await asyncio.to_thread(
            _fetch_pinecone_supporting_context,
            market_context_queries,
            request.org_id,
            3
        )
        context_data["pinecone_context_queries"] = market_context_queries
        context_data["pinecone_supporting_context"] = pinecone_context

        context_json = json.dumps(context_data)

        max_retries = 2
        for attempt in range(1, max_retries + 1):
            try:
                research_result = await asyncio.to_thread(research_function, context_json)
                break
            except Exception as e:
                if attempt == max_retries:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Research function failed after {max_retries} attempts: {str(e)}"
                    )
                await asyncio.sleep(1)

        if not isinstance(research_result, dict):
            research_result = {"data": research_result}

        research_result.update({
            "user_id": request.user_id,
            "component_name": component_name,
            "timestamp": datetime.utcnow()
        })
        if request.org_id:
            research_result["org_id"] = request.org_id

        await asyncio.to_thread(collection.insert_one, research_result)

        research_result.pop("_id", None)
        return {"status": "success", "data": research_result}

    finally:
        client.close()


@router.delete("/icp/recommended/{icp_id}")
async def delete_recommended_icp(icp_id: str, user_id: str = Query(...)):
    """
    Delete a single recommended ICP from ICP_config by icp_id for a given user_id.
    """
    mongo_client = None
    try:
        from app.services.market_scoring import _get_profiler_mongo_client
        mongo_client = _get_profiler_mongo_client()
        db = mongo_client["Profiler"]
        icp_service._ensure_icp_id_registry_indexes(db)
        collection = db["ICP_config"]

        document = collection.find_one({"user_id": user_id})
        if not document:
            raise HTTPException(status_code=404, detail=f"No ICP config found for user_id: {user_id}")

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
            raise HTTPException(status_code=404, detail=f"Recommended ICP not found for icp_id: {icp_id}")

        new_payload = {"suggestedICPs": updated_suggested}
        collection.update_one(
            {"user_id": user_id},
            {"$set": {"user_id": user_id, "icps": new_payload}},
            upsert=True
        )
        icp_service._release_icp_id(db, icp_id)

        return {
            "success": True,
            "message": "Recommended ICP deleted successfully",
            "data": {
                "deleted_icp_id": str(icp_id),
                "remaining_count": len(updated_suggested)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if mongo_client:
            mongo_client.close()
