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


# --- get_company_profile_for_org, get_market_reports_for_org,
#     _clean_and_parse_json, score_single_lead_against_market moved to
#     app.services.market_scoring in commit 15/16.
#     fetch_leads_for_org alias also removed (no remaining services.py callers).
#     MARKET_SCORE_COMPONENT_KEYS lives in app.models. ---

# --- search_signals_scout, search_signals_profiler, SIGNALS_FUNCTIONS
#     moved to app.services.signals in commit 14/16. ---
