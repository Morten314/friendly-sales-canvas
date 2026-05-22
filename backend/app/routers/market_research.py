"""Market research endpoints: 5-component report (Groq + Claude variants)."""
import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.core import clients
from app.models.market_research import MarketRequest
from app.services import market_research as market_research_service
from app.services._claude_budget import CLAUDE_API_KEY
from app.services._retrieval import (
    _build_market_context_queries,
    _fetch_pinecone_supporting_context,
)

router = APIRouter(tags=["market-research"])


@router.post("/market-research")
async def market_research(request: MarketRequest):
    component_name = request.component_name.strip().lower()

    # Lookup function
    research_function = market_research_service.COMPONENT_FUNCTIONS.get(component_name)
    if not research_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported component_name: {request.component_name}"
        )

    # MongoDB (pymongo client)
    db = clients.client["Scout_Agent"]
    collection = db["Market_Intelligence"]

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

    # --- Run research with retries (max 2 attempts) ---
    market_context_queries = _build_market_context_queries(component_name, company_profile)
    pinecone_context = await asyncio.to_thread(
        _fetch_pinecone_supporting_context,
        market_context_queries,
        request.org_id,
        3
    )
    # Best-effort support context only; research should not depend on this.
    company_profile["pinecone_context_queries"] = market_context_queries
    company_profile["pinecone_supporting_context"] = pinecone_context

    max_retries = 2
    for attempt in range(1, max_retries + 1):
        try:
            research_result = await asyncio.to_thread(research_function, company_profile)
            break
        except Exception as e:
            if attempt == max_retries:
                raise HTTPException(
                    status_code=500,
                    detail=f"Research function failed after {max_retries} attempts: {str(e)}"
                )
            await asyncio.sleep(1)  # retry delay

    # Ensure research_result is a dict and add user_id and metadata
    if not isinstance(research_result, dict):
        research_result = {"data": research_result}

    # Explicitly set user_id, component_name, and timestamp (multitenancy)
    research_result["user_id"] = request.user_id
    if request.org_id:
        research_result["org_id"] = request.org_id
    research_result["component_name"] = component_name
    research_result["timestamp"] = datetime.utcnow()

    # Save to DB (pymongo → wrap in to_thread)
    await asyncio.to_thread(collection.insert_one, research_result)

    research_result.pop("_id", None)
    return {"status": "success", "data": research_result}


@router.post("/market-research_claude")
async def market_research_claude(request: MarketRequest):
    """Same as /market-research but research is generated with Claude (Tavily + Anthropic)."""
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")

    component_name = request.component_name.strip().lower()

    research_function = market_research_service.COMPONENT_FUNCTIONS_CLAUDE.get(component_name)
    if not research_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported component_name: {request.component_name}"
        )

    db = clients.client["Scout_Agent"]
    collection = db["Market_Intelligence"]

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

    market_context_queries = _build_market_context_queries(component_name, company_profile)
    pinecone_context = await asyncio.to_thread(
        _fetch_pinecone_supporting_context,
        market_context_queries,
        request.org_id,
        3
    )
    company_profile["pinecone_context_queries"] = market_context_queries
    company_profile["pinecone_supporting_context"] = pinecone_context

    max_retries = 2
    for attempt in range(1, max_retries + 1):
        try:
            research_result = await asyncio.to_thread(research_function, company_profile)
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

    research_result["user_id"] = request.user_id
    if request.org_id:
        research_result["org_id"] = request.org_id
    research_result["component_name"] = component_name
    research_result["timestamp"] = datetime.utcnow()

    await asyncio.to_thread(collection.insert_one, research_result)

    research_result.pop("_id", None)
    return {"status": "success", "data": research_result}
