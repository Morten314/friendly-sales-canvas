"""Signals endpoints: research, batch generation, signal feed, signal Q&A."""
import json
import asyncio
import uuid
import logging
from datetime import datetime
from typing import Any, Dict, Optional

import requests
from fastapi import APIRouter, HTTPException, Query

from app.core import clients
from app.core.config import tavily_api_key, claude_sonnet_model
from app.models.market_research import MarketRequest
from app.models.signals import SignalActionRequest, SignalAskRequest
from app.core import llm_config
from app.services import signals as signals_service
from app.services._retrieval import (
    _build_signal_context_queries,
    _fetch_pinecone_supporting_context,
)
from app.services._claude_budget import (
    CLAUDE_SIGNAL_TOKEN_LIMIT_5M,
    CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
    CLAUDE_API_KEY,
    _estimate_token_count,
    _reserve_claude_signal_budget,
    _finalize_claude_signal_budget,
)

router = APIRouter(tags=["signals"])
logger = logging.getLogger(__name__)


@router.post("/signals-research")
async def signals_research(request: MarketRequest):
    """Research web signals for specific agents (scout/profiler)"""
    agent_name = request.component_name.strip().lower()

    # Lookup the function for the given agent
    signals_function = signals_service.SIGNALS_FUNCTIONS.get(agent_name)
    if not signals_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported agent: {request.component_name}. Supported agents: scout, profiler"
        )

    db = clients.client["Signals"]
    collection = db["signals"]

    # Filter by user_id only for multitenancy
    query = {
        "user_id": request.user_id,
        "agent": agent_name
    }

    # If refresh is False, fetch the latest signal
    if not request.refresh:
        latest_signal = await asyncio.to_thread(
            collection.find_one, query, sort=[("timestamp", -1)]
        )
        if latest_signal:
            latest_signal.pop("_id", None)
            return {"status": "success", "data": latest_signal}

    # Prepare data for the signals function
    pre_data = request.data

    # Fetch existing headlines from signal_track collection
    existing_headlines = []
    if request.org_id or request.user_id:
        track_db = clients.client["Signals"]
        track_collection = track_db["signal_track"]
        track_key = request.org_id if request.org_id else f"user_{request.user_id}"

        def fetch_existing_headlines():
            track_doc = track_collection.find_one({"_id": track_key})
            if track_doc and track_doc.get("headlines"):
                return track_doc.get("headlines", [])
            return []

        existing_headlines = await asyncio.to_thread(fetch_existing_headlines)

    # Add existing headlines to pre_data for prompt injection
    if isinstance(pre_data, dict):
        pre_data["existing_headlines"] = existing_headlines
    else:
        # If pre_data is a string, convert to dict
        try:
            pre_data_dict = json.loads(pre_data) if isinstance(pre_data, str) else {}
            pre_data_dict["existing_headlines"] = existing_headlines
            pre_data = pre_data_dict
        except:
            pre_data = {"company_profile": pre_data, "existing_headlines": existing_headlines}

    signal_context_queries = _build_signal_context_queries(agent_name, pre_data)
    pinecone_context = await asyncio.to_thread(
        _fetch_pinecone_supporting_context,
        signal_context_queries,
        request.org_id,
        3
    )
    if isinstance(pre_data, dict):
        pre_data["pinecone_context_queries"] = signal_context_queries
        pre_data["pinecone_supporting_context"] = pinecone_context

    # Fetch leads for org_id if available
    leads_data = []
    if request.org_id:
        try:
            from app.services.leads import fetch_leads_for_org
            leads_data = fetch_leads_for_org(request.org_id, limit=100)
            if isinstance(pre_data, dict):
                pre_data["leads_data"] = leads_data
            else:
                if not isinstance(pre_data, dict):
                    try:
                        pre_data = json.loads(pre_data) if isinstance(pre_data, str) else {}
                    except:
                        pre_data = {}
                pre_data["leads_data"] = leads_data
                if "company_profile" not in pre_data:
                    pre_data["company_profile"] = request.data
        except Exception as e:
            logger.warning(f"Could not fetch leads: {e}")

    # For profiler agent, also include ICP data if available - filter by user_id
    if agent_name == "profiler":
        # Try to get ICP data from Profiler database
        try:
            profiler_db = clients.client["Profiler"]
            icp_collection = profiler_db["ICP_config"]
            icp_data = icp_collection.find_one({"user_id": request.user_id})
            if icp_data:
                if isinstance(pre_data, dict):
                    pre_data["icp_data"] = icp_data.get("icps", {})
                    if "company_profile" not in pre_data:
                        pre_data["company_profile"] = request.data
                else:
                    pre_data = {
                        "company_profile": request.data,
                        "icp_data": icp_data.get("icps", {}),
                        "existing_headlines": existing_headlines,
                        "leads_data": leads_data
                    }
        except Exception as e:
            logger.warning(f"Could not fetch ICP data: {e}")

    # Run signals research with retries (max 2 attempts)
    max_retries = 2
    for attempt in range(1, max_retries + 1):
        try:
            signals_result = await asyncio.to_thread(signals_function, pre_data)
            break
        except Exception as e:
            if attempt == max_retries:
                raise HTTPException(
                    status_code=500,
                    detail=f"Signals research failed after {max_retries} attempts: {str(e)}"
                )
            await asyncio.sleep(1)  # retry delay

    # Generate unique ID for signal
    signal_id = str(uuid.uuid4())

    # Add metadata - filter by user_id only
    signals_result.update({
        "id": signal_id,
        "signal_id": signal_id,  # Ensure signal_id is also present
        "user_id": request.user_id,
        "agent": agent_name,
        "timestamp": datetime.utcnow()
    })
    if request.org_id:
        signals_result["org_id"] = request.org_id

    # Save to Signals DB
    await asyncio.to_thread(collection.insert_one, signals_result)

    # Store headline in signal_track collection
    if signals_result.get("headline") and (request.org_id or request.user_id):
        track_db = clients.client["Signals"]
        track_collection = track_db["signal_track"]
        track_key = request.org_id if request.org_id else f"user_{request.user_id}"

        def update_signal_track():
            track_collection.update_one(
                {"_id": track_key},
                {
                    "$addToSet": {"headlines": signals_result.get("headline")},
                    "$set": {"last_updated": datetime.utcnow()}
                },
                upsert=True
            )

        await asyncio.to_thread(update_signal_track)

    signals_result.pop("_id", None)
    return {"status": "success", "data": signals_result}


async def _generate_signals_batch_core(request: MarketRequest, llm_backend: str):
    db = clients.client["Signals"]
    collection = db["signals"]

    # Prepare data for the signals functions
    pre_data = request.data

    # Fetch existing headlines from signal_track collection
    existing_headlines = []
    if request.org_id or request.user_id:
        track_db = clients.client["Signals"]
        track_collection = track_db["signal_track"]
        track_key = request.org_id if request.org_id else f"user_{request.user_id}"

        def fetch_existing_headlines():
            track_doc = track_collection.find_one({"_id": track_key})
            if track_doc and track_doc.get("headlines"):
                return track_doc.get("headlines", [])
            return []

        existing_headlines = await asyncio.to_thread(fetch_existing_headlines)

    # Add existing headlines to pre_data
    if isinstance(pre_data, dict):
        pre_data["existing_headlines"] = existing_headlines
    else:
        try:
            pre_data_dict = json.loads(pre_data) if isinstance(pre_data, str) else {}
            pre_data_dict["existing_headlines"] = existing_headlines
            pre_data = pre_data_dict
        except:
            pre_data = {"company_profile": pre_data, "existing_headlines": existing_headlines}

    scout_signal_context_queries = _build_signal_context_queries("scout", pre_data)
    scout_pinecone_context = await asyncio.to_thread(
        _fetch_pinecone_supporting_context,
        scout_signal_context_queries,
        request.org_id,
        3
    )
    if isinstance(pre_data, dict):
        pre_data["pinecone_context_queries"] = scout_signal_context_queries
        pre_data["pinecone_supporting_context"] = scout_pinecone_context

    # Fetch leads for org_id if available
    leads_data = []
    if request.org_id:
        try:
            from app.services.leads import fetch_leads_for_org
            leads_data = fetch_leads_for_org(request.org_id, limit=100)
            logger.info(f"[Batch Signals] Fetched {len(leads_data)} leads for org_id: {request.org_id}")
            if isinstance(pre_data, dict):
                pre_data["leads_data"] = leads_data
            else:
                if not isinstance(pre_data, dict):
                    try:
                        pre_data = json.loads(pre_data) if isinstance(pre_data, str) else {}
                    except:
                        pre_data = {}
                pre_data["leads_data"] = leads_data
                if "company_profile" not in pre_data:
                    pre_data["company_profile"] = request.data
        except Exception as e:
            logger.warning(f"Could not fetch leads: {e}")
    else:
        logger.warning(f"[Batch Signals] No org_id provided, skipping leads fetch for user_id: {request.user_id}")

    # For profiler agent, also include ICP data if available - filter by user_id
    profiler_pre_data = pre_data.copy() if isinstance(pre_data, dict) else pre_data
    try:
        profiler_db = clients.client["Profiler"]
        icp_collection = profiler_db["ICP_config"]
        icp_data = icp_collection.find_one({"user_id": request.user_id})
        if icp_data:
            if isinstance(profiler_pre_data, dict):
                profiler_pre_data["icp_data"] = icp_data.get("icps", {})
                if "company_profile" not in profiler_pre_data:
                    profiler_pre_data["company_profile"] = request.data
                # Ensure leads_data is included
                if leads_data and "leads_data" not in profiler_pre_data:
                    profiler_pre_data["leads_data"] = leads_data
            else:
                profiler_pre_data = {
                    "company_profile": request.data,
                    "icp_data": icp_data.get("icps", {}),
                    "existing_headlines": existing_headlines,
                    "leads_data": leads_data
                }
        else:
            # Even if no ICP data, ensure leads_data is included
            if isinstance(profiler_pre_data, dict) and leads_data and "leads_data" not in profiler_pre_data:
                profiler_pre_data["leads_data"] = leads_data
    except Exception as e:
        logger.warning(f"Could not fetch ICP data: {e}")

    profiler_signal_context_queries = _build_signal_context_queries("profiler", profiler_pre_data)
    profiler_pinecone_context = await asyncio.to_thread(
        _fetch_pinecone_supporting_context,
        profiler_signal_context_queries,
        request.org_id,
        3
    )
    if isinstance(profiler_pre_data, dict):
        profiler_pre_data["pinecone_context_queries"] = profiler_signal_context_queries
        profiler_pre_data["pinecone_supporting_context"] = profiler_pinecone_context

    generated_signals = []
    batch_id = f"batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

    # Generate 2 signals for scout
    for i in range(2):
        try:
            print(f"Generating scout signal {i+1}...")
            signals_result = await asyncio.to_thread(signals_service.search_signals_scout, pre_data, llm_backend)
            signal_id = str(uuid.uuid4())
            signals_result.update({
                "id": signal_id,
                "signal_id": signal_id,  # Ensure signal_id is also present
                "user_id": request.user_id,
                "agent": "scout",
                "timestamp": datetime.utcnow(),
                "batch_id": batch_id
            })
            if request.org_id:
                signals_result["org_id"] = request.org_id

            # Save to Signals DB
            await asyncio.to_thread(collection.insert_one, signals_result)

            # Store headline in signal_track collection
            if signals_result.get("headline") and (request.org_id or request.user_id):
                track_db = clients.client["Signals"]
                track_collection = track_db["signal_track"]
                track_key = request.org_id if request.org_id else f"user_{request.user_id}"

                def update_signal_track():
                    track_collection.update_one(
                        {"_id": track_key},
                        {
                            "$addToSet": {"headlines": signals_result.get("headline")},
                            "$set": {"last_updated": datetime.utcnow()}
                        },
                        upsert=True
                    )

                await asyncio.to_thread(update_signal_track)

                # Update existing_headlines list for next iteration
                if isinstance(pre_data, dict):
                    pre_data["existing_headlines"].append(signals_result.get("headline"))
            signals_result.pop("_id", None)
            generated_signals.append(signals_result)
            print(f"Successfully generated scout signal {i+1}")

        except Exception as e:
            print(f"Error generating scout signal {i+1}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate scout signal {i+1}: {str(e)}"
            )

    # Generate 2 signals for profiler
    for i in range(2):
        try:
            print(f"Generating profiler signal {i+1}...")
            signals_result = await asyncio.to_thread(signals_service.search_signals_profiler, profiler_pre_data, llm_backend)
            signal_id = str(uuid.uuid4())
            signals_result.update({
                "id": signal_id,
                "signal_id": signal_id,  # Ensure signal_id is also present
                "user_id": request.user_id,
                "agent": "profiler",
                "timestamp": datetime.utcnow(),
                "batch_id": batch_id
            })
            if request.org_id:
                signals_result["org_id"] = request.org_id

            # Save to Signals DB
            await asyncio.to_thread(collection.insert_one, signals_result)

            # Store headline in signal_track collection
            if signals_result.get("headline") and (request.org_id or request.user_id):
                track_db = clients.client["Signals"]
                track_collection = track_db["signal_track"]
                track_key = request.org_id if request.org_id else f"user_{request.user_id}"

                def update_signal_track():
                    track_collection.update_one(
                        {"_id": track_key},
                        {
                            "$addToSet": {"headlines": signals_result.get("headline")},
                            "$set": {"last_updated": datetime.utcnow()}
                        },
                        upsert=True
                    )

                await asyncio.to_thread(update_signal_track)

                # Update existing_headlines list for next iteration
                if isinstance(profiler_pre_data, dict):
                    profiler_pre_data["existing_headlines"].append(signals_result.get("headline"))
            signals_result.pop("_id", None)
            generated_signals.append(signals_result)
            print(f"Successfully generated profiler signal {i+1}")

        except Exception as e:
            print(f"Error generating profiler signal {i+1}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate profiler signal {i+1}: {str(e)}"
            )

    return {
        "status": "success",
        "message": f"Generated {len(generated_signals)} signals",
        "data": generated_signals
    }


@router.post("/generate-signals-batch")
async def generate_signals_batch(request: MarketRequest):
    """Generate 2 signals for scout and 2 signals for profiler"""
    return await _generate_signals_batch_core(request, "default")


@router.post("/generate-signals-batch_claude")
async def generate_signals_batch_claude(request: MarketRequest):
    """Same as /generate-signals-batch but signal text is produced with Claude (Tavily + Anthropic)."""
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    return await _generate_signals_batch_core(request, "claude")


@router.get("/fetch-signals")
async def fetch_signals(user_id: str = Query(...), limit: int = Query(10)):
    """Fetch signals and return them in a simple list format - filtered by user_id only"""
    db = clients.client["Signals"]
    collection = db["signals"]

    # Fetch signals for the user only (multitenancy), ordered by timestamp (newest first)
    signals_cursor = collection.find(
        {"user_id": user_id}
    ).sort("timestamp", -1).limit(limit)

    signals_list = []
    for signal in signals_cursor:
        # Remove MongoDB _id and format for simple list
        signal.pop("_id", None)
        # Ensure signal_id is present (use "id" if signal_id doesn't exist)
        if "signal_id" not in signal and "id" in signal:
            signal["signal_id"] = signal["id"]
        elif "id" not in signal and "signal_id" in signal:
            signal["id"] = signal["signal_id"]
        signals_list.append(signal)

    return {
        "status": "success",
        "count": len(signals_list),
        "signals": signals_list
    }

@router.post("/signal_action")
async def signal_action(request: SignalActionRequest):
    """
    Accept or reject a signal.
    - If action is "accept": Keep the signal under the org_id (ensure org_id is set)
    - If action is "reject": Delete the signal
    """
    try:
        db = clients.client["Signals"]
        collection = db["signals"]

        # Find the signal by signal_id (check both "id" and "signal_id" fields)
        signal = collection.find_one({
            "$or": [
                {"id": request.signal_id},
                {"signal_id": request.signal_id}
            ]
        })

        if not signal:
            raise HTTPException(
                status_code=404,
                detail=f"Signal with signal_id {request.signal_id} not found"
            )

        if request.action == "accept":
            # Update the signal to ensure it has the org_id
            update_result = collection.update_one(
                {"_id": signal["_id"]},
                {
                    "$set": {
                        "org_id": request.org_id,
                        "status": "accepted",
                        "actioned_at": datetime.utcnow()
                    }
                }
            )

            if update_result.modified_count > 0:
                return {
                    "status": "success",
                    "message": f"Signal {request.signal_id} accepted and assigned to org {request.org_id}",
                    "signal_id": request.signal_id,
                    "org_id": request.org_id,
                    "action": "accept"
                }
            else:
                return {
                    "status": "success",
                    "message": f"Signal {request.signal_id} already has org_id {request.org_id}",
                    "signal_id": request.signal_id,
                    "org_id": request.org_id,
                    "action": "accept"
                }

        elif request.action == "reject":
            # Delete the signal
            delete_result = collection.delete_one({"_id": signal["_id"]})

            if delete_result.deleted_count > 0:
                return {
                    "status": "success",
                    "message": f"Signal {request.signal_id} rejected and deleted",
                    "signal_id": request.signal_id,
                    "action": "reject"
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to delete signal"
                )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid action: {request.action}. Must be 'accept' or 'reject'"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing signal action: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process signal action: {str(e)}")

@router.post("/signal_Ask")
async def signal_ask(request: SignalAskRequest):
    """
    Answer a question about signals using company profile, customer profile, history, and WebSearch.
    Fetches company profile and customer profile from org_id, includes conversation history,
    and uses WebSearch tool to provide up-to-date answers.
    """
    try:
        # Fetch company profile from Neo4j
        company_profile = None
        try:
            with clients.driver.session() as session:
                result = session.run(
                    "MATCH (p:CompanyProfile {org_id: $org_id}) RETURN p LIMIT 1",
                    org_id=request.org_id
                )
                record = result.single()
                if record:
                    company_profile = dict(record["p"].items())
        except Exception as e:
            logger.warning(f"Could not fetch company profile: {e}")

        # Fetch customer profile from MongoDB
        customer_profile = None
        try:
            db = clients.client["Profiler"]
            collection = db["Company_Profile"]

            filter_query = {"profile_type": "company", "org_id": request.org_id}
            document = collection.find_one(filter_query)

            if document:
                customer_profiles = document.get("customer_profiles", {})
                icps = customer_profiles.get("icps", [])
                # Remove MongoDB _id if present
                for icp in icps:
                    if "_id" in icp:
                        del icp["_id"]
                customer_profile = {"icps": icps}

        except Exception as e:
            logger.warning(f"Could not fetch customer profile: {e}")

        # Format history for prompt
        history_text = ""
        if request.history:
            history_text = "\n\nCONVERSATION HISTORY:\n"
            for i, entry in enumerate(request.history, 1):
                if isinstance(entry, dict):
                    user_msg = entry.get("user", entry.get("question", ""))
                    assistant_msg = entry.get("assistant", entry.get("answer", ""))
                    history_text += f"\nTurn {i}:\n"
                    if user_msg:
                        history_text += f"User: {user_msg}\n"
                    if assistant_msg:
                        history_text += f"Assistant: {assistant_msg}\n"
                else:
                    history_text += f"\nTurn {i}: {str(entry)}\n"

        # Build context for prompt
        context_parts = []

        if company_profile:
            company_profile_json = json.dumps(company_profile, indent=2)
            context_parts.append(f"COMPANY PROFILE:\n{company_profile_json}")

        if customer_profile:
            customer_profile_json = json.dumps(customer_profile, indent=2)
            context_parts.append(f"CUSTOMER PROFILE (ICPs):\n{customer_profile_json}")

        context = "\n\n".join(context_parts)

        # Build prompt
        prompt = f"""You are an intelligent assistant helping answer questions about market signals, company strategy, and customer insights.

{context}
{history_text}

CURRENT QUESTION:
{request.question}

INSTRUCTIONS:
1. Use the WebSearch tool to find the most up-to-date and accurate information to answer the question
2. Consider the company profile and customer profile (ICPs) when providing context-specific answers
3. Reference the conversation history to maintain context and continuity
4. Provide a comprehensive, well-structured answer that directly addresses the question
5. If the question relates to market signals, trends, or industry insights, use WebSearch to find recent data (2026-2027)
6. Cite sources when using information from WebSearch
7. Be specific and actionable in your response

Please use the WebSearch tool to gather current information and provide a detailed answer."""

        # Use agent_chain to answer with WebSearch
        raw_response = await asyncio.to_thread(
            llm_config.agent_chain.invoke,
            {'input': prompt}
        )

        answer = raw_response.get("output", "")

        return {
            "status": "success",
            "answer": answer,
            "org_id": request.org_id,
            "user_id": request.user_id,
            "question": request.question
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in signal_Ask: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to answer question: {str(e)}")

@router.post("/signal_ask_claude")
async def signal_ask_claude(request: SignalAskRequest):
    """
    Claude-powered signal ask endpoint with local token/run limiter.
    """
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")

    reservation: Optional[Dict[str, Any]] = None
    input_tokens_estimate = 0
    output_tokens_estimate = 0
    answer = ""

    try:
        # Fetch company profile from Neo4j
        company_profile = None
        try:
            with clients.driver.session() as session:
                result = session.run(
                    "MATCH (p:CompanyProfile {org_id: $org_id}) RETURN p LIMIT 1",
                    org_id=request.org_id
                )
                record = result.single()
                if record:
                    company_profile = dict(record["p"].items())
        except Exception as e:
            logger.warning(f"Could not fetch company profile (Claude): {e}")

        # Fetch customer profile from MongoDB
        customer_profile = None
        try:
            db = clients.client["Profiler"]
            collection = db["Company_Profile"]

            filter_query = {"profile_type": "company", "org_id": request.org_id}
            document = collection.find_one(filter_query)

            if document:
                customer_profiles = document.get("customer_profiles", {})
                icps = customer_profiles.get("icps", [])
                for icp in icps:
                    if "_id" in icp:
                        del icp["_id"]
                customer_profile = {"icps": icps}

        except Exception as e:
            logger.warning(f"Could not fetch customer profile (Claude): {e}")

        # Format history for prompt
        history_text = ""
        if request.history:
            history_text = "\n\nCONVERSATION HISTORY:\n"
            for i, entry in enumerate(request.history, 1):
                if isinstance(entry, dict):
                    user_msg = entry.get("user", entry.get("question", ""))
                    assistant_msg = entry.get("assistant", entry.get("answer", ""))
                    history_text += f"\nTurn {i}:\n"
                    if user_msg:
                        history_text += f"User: {user_msg}\n"
                    if assistant_msg:
                        history_text += f"Assistant: {assistant_msg}\n"
                else:
                    history_text += f"\nTurn {i}: {str(entry)}\n"

        # Build context for prompt
        context_parts = []
        if company_profile:
            company_profile_json = json.dumps(company_profile, indent=2)
            context_parts.append(f"COMPANY PROFILE:\n{company_profile_json}")

        if customer_profile:
            customer_profile_json = json.dumps(customer_profile, indent=2)
            context_parts.append(f"CUSTOMER PROFILE (ICPs):\n{customer_profile_json}")

        context = "\n\n".join(context_parts)

        web_search_results = ""
        try:
            from langchain_community.tools.tavily_search.tool import TavilySearchResults
            search_tool = TavilySearchResults(k=10, tavily_api_key=tavily_api_key)
            web_search_results = await asyncio.to_thread(search_tool.run, request.question)
        except Exception as e:
            logger.warning(f"WebSearch failed in signal_ask_claude: {e}")

        prompt = f"""You are an intelligent assistant helping answer questions about market signals, company strategy, and customer insights.

{context}
{history_text}

WEB SEARCH RESULTS:
{web_search_results}

CURRENT QUESTION:
{request.question}

INSTRUCTIONS:
1. Use the provided web search results as the freshest external context.
2. Consider the company profile and customer profile (ICPs) when providing context-specific answers.
3. Reference the conversation history to maintain context and continuity.
4. Provide a comprehensive, well-structured answer that directly addresses the question.
5. If the question relates to market signals, trends, or industry insights, prioritize recent data (2026-2027).
6. Cite sources if they appear in web search results.
7. Be specific and actionable in your response.
"""

        input_tokens_estimate = _estimate_token_count(prompt)
        reservation = _reserve_claude_signal_budget(
            input_tokens_estimate=input_tokens_estimate,
            max_output_tokens=CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS
        )

        response = await asyncio.to_thread(
            requests.post,
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": claude_sonnet_model,
                "max_tokens": CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
                "temperature": 0.2,
                "messages": [{"role": "user", "content": prompt}]
            },
            timeout=120
        )

        if response.status_code >= 400:
            response_text = response.text[:1000]
            raise HTTPException(
                status_code=500,
                detail=f"Claude API call failed ({response.status_code}): {response_text}"
            )

        payload = response.json()
        content_blocks = payload.get("content", [])
        answer_parts = []
        for block in content_blocks:
            if isinstance(block, dict) and block.get("type") == "text":
                answer_parts.append(block.get("text", ""))
        answer = "\n".join([x for x in answer_parts if x]).strip()

        output_tokens_estimate = _estimate_token_count(answer)
        finalized = _finalize_claude_signal_budget(
            run_id=reservation["run_id"],
            actual_total_tokens=input_tokens_estimate + output_tokens_estimate
        )
        reservation = None

        logger.info(
            "signal_ask_claude usage | org_id=%s | in=%s | out=%s | total=%s | window_tokens_5m=%s | run_count_5m=%s | run_count_total=%s",
            request.org_id,
            input_tokens_estimate,
            output_tokens_estimate,
            input_tokens_estimate + output_tokens_estimate,
            finalized["window_tokens_5m"],
            finalized["run_count_5m"],
            finalized["run_count_total"]
        )

        return {
            "status": "success",
            "answer": answer,
            "org_id": request.org_id,
            "user_id": request.user_id,
            "question": request.question,
            "provider": "anthropic",
            "model": claude_sonnet_model,
            "usage": {
                "estimated_input_tokens": input_tokens_estimate,
                "estimated_output_tokens": output_tokens_estimate,
                "estimated_total_tokens": input_tokens_estimate + output_tokens_estimate,
                "window_total_tokens_5m": finalized["window_tokens_5m"],
                "run_count_5m": finalized["run_count_5m"],
                "run_count_total": finalized["run_count_total"],
                "token_limit_5m": CLAUDE_SIGNAL_TOKEN_LIMIT_5M
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in signal_ask_claude: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to answer question (Claude): {str(e)}")
    finally:
        # Release reservation if we errored before final accounting.
        if reservation and reservation.get("run_id"):
            _finalize_claude_signal_budget(
                run_id=reservation["run_id"],
                actual_total_tokens=input_tokens_estimate + output_tokens_estimate
            )
