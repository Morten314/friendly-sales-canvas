import os
import json
import re
import shutil
import pandas as pd
import requests
import speech_recognition as sr
import pytz
import datetime
import urllib.parse
from typing import List, Optional, Dict, Any
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.prompts import PromptTemplate
from app.core.config import PREDEFINED_QUESTIONS, rapidapi_key, claude_sonnet_model, tavily_api_key
from app.core.database import query  # function — local binding ok
from app.core import database
from app.core import llm_config

# NOTE: convert_audio_to_text, create_prospect_node, get_linkedin_followers,
# get_linkedin_recent_activity, extract_linkedin_username,
# calculate_prospect_score, get_ranked_prospects, extract_number,
# score_prospect — all moved to app.services.graph_chat in commit 10/16.
# (No aliases needed: nothing remaining in services.py references them.)

# --- _signals_agent_output, search_signals_scout, search_signals_profiler,
#     SIGNALS_FUNCTIONS moved to app.services.signals in commit 14/16.
#     (Claude-backed research helpers from market_research no longer re-imported here;
#     they live in app.services.market_research.)
# --- ICP_generator, icp_research_1..4, _icp_research_agent_output, ICP_FUNCTIONS,
#     ICP_FUNCTIONS_CLAUDE moved to app.services.icp in commit 13/16. ---


# COMPONENT_FUNCTIONS / COMPONENT_FUNCTIONS_CLAUDE moved to app.services.market_research
# in commit 12/16. The canonical MARKET_SCORE_COMPONENT_KEYS lives in app.models; re-imported
# here so the remaining services.py callers (score_single_lead_against_market,
# get_market_reports_for_org) keep working until they themselves move in commit 15/16.
from app.models import MARKET_SCORE_COMPONENT_KEYS  # noqa: E402

# Temporary alias — function moved to app.services.leads in commit 9/16.
# This alias keeps services.py callers (e.g. score_single_lead_against_market)
# working until they themselves move in commit 15/16.
from app.services.leads import fetch_leads_for_org  # noqa: F401


def get_company_profile_for_org(org_id: str) -> Dict[str, Any]:
    """Fetch a single company profile for an org."""
    with database.driver.session() as session:
        result = session.run(
            "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
            org_id=org_id,
        )
        record = result.single()
        if not record:
            return {}
        company_profile = dict(record.values()[0])
        if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
            try:
                company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
            except json.JSONDecodeError:
                pass
        return company_profile


def get_market_reports_for_org(user_id: str, org_id: str) -> Dict[str, Dict[str, Any]]:
    """Fetch latest market research reports for all five components."""
    db = database.client["Scout_Agent"]
    collection = db["Market_Intelligence"]
    reports: Dict[str, Dict[str, Any]] = {}
    for component_name in MARKET_SCORE_COMPONENT_KEYS:
        doc = collection.find_one(
            {"user_id": user_id, "org_id": org_id, "component_name": component_name},
            sort=[("timestamp", -1)],
        )
        if doc:
            doc.pop("_id", None)
            reports[component_name] = doc
    return reports


def _clean_and_parse_json(raw_text: str) -> Dict[str, Any]:
    cleaned = (
        str(raw_text)
        .strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )
    return json.loads(cleaned)


def score_single_lead_against_market(
    lead: Dict[str, Any],
    company_profile: Dict[str, Any],
    market_reports: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Score one lead against all five market components with explanations.
    Returns component_scores, component_descriptions and total score.
    """
    prompt = f"""
You are scoring a sales lead fit against five market-research components.
Return strict JSON only.

Component keys (must match exactly):
{json.dumps(MARKET_SCORE_COMPONENT_KEYS)}

Company profile:
{json.dumps(company_profile, default=str)}

Lead data:
{json.dumps(lead, default=str)}

Market research component reports:
{json.dumps(market_reports, default=str)}

Return JSON schema:
{{
  "component_scores": {{
    "market size & opportunity": <number 0-100>,
    "industry trends report": <number 0-100>,
    "competitor landscape": <number 0-100>,
    "regulatory & compliance highlights": <number 0-100>,
    "market entry & growth strategy": <number 0-100>
  }},
  "component_descriptions": {{
    "market size & opportunity": "<short reason>",
    "industry trends report": "<short reason>",
    "competitor landscape": "<short reason>",
    "regulatory & compliance highlights": "<short reason>",
    "market entry & growth strategy": "<short reason>"
  }}
}}
"""
    response = llm_config.llm2.invoke([HumanMessage(content=prompt)])
    content = getattr(response, "content", response)
    parsed = _clean_and_parse_json(content)
    scores = parsed.get("component_scores", {}) if isinstance(parsed, dict) else {}
    descriptions = parsed.get("component_descriptions", {}) if isinstance(parsed, dict) else {}

    normalized_scores: Dict[str, float] = {}
    normalized_descriptions: Dict[str, str] = {}
    for component in MARKET_SCORE_COMPONENT_KEYS:
        raw_score = scores.get(component, 0)
        try:
            score = float(raw_score)
        except (TypeError, ValueError):
            score = 0.0
        score = max(0.0, min(100.0, score))
        normalized_scores[component] = round(score, 2)

        description = descriptions.get(component)
        if not isinstance(description, str) or not description.strip():
            description = "Score generated with limited evidence from available lead/profile context."
        normalized_descriptions[component] = description.strip()

    total_score = round(sum(normalized_scores.values()) / float(len(MARKET_SCORE_COMPONENT_KEYS)), 2)
    return {
        "component_scores": normalized_scores,
        "component_descriptions": normalized_descriptions,
        "market_total_score": total_score,
    }

# --- search_signals_scout, search_signals_profiler, SIGNALS_FUNCTIONS
#     moved to app.services.signals in commit 14/16. ---
