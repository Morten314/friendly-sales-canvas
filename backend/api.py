import json
import shutil
import asyncio
import datetime
import urllib.parse
import uuid
import logging
import os
import math
import threading
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from fastapi import UploadFile, File, Form, Query, HTTPException, Body, APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from langchain_pinecone import PineconeVectorStore
from langchain_community.document_loaders import PyPDFLoader, TextLoader, CSVLoader, UnstructuredExcelLoader
from langchain_core.documents import Document
import pandas as pd
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
import requests

from app.core.config import origins, STAGE_ORDER, STAGE_MAPPING, s3_bucket, aws_region, aws_access_key, aws_secret_key, pinecone_api_key, together_api_key, claude_sonnet_model, tavily_api_key, claude_signal_window_seconds, claude_signal_token_limit_5m, claude_signal_max_output_tokens
from app.models import (
    ProspectData, Lead, Contact, SalesPipelineResponse, TimeframeResponse, StageStats,
    CompanyProfile, UserProfile, ScoutProfile, MarketRequest, EditRequest,
    CustomerProfileRequest, CustomerProfileICP, LeadCreateRequest, LeadUpdateRequest,
    SignalActionRequest, SignalAskRequest, RegistrationRequest, RegistrationResponse,
    SuggestedICPToCustomerProfileRequest, LeadMarketScoresRequest, LeadMarketScoresResponse,
    LeadMarketScoreRow, LeadMarketScoreDescriptionsResponse, LeadMarketScoringStatusResponse,
    LeadMarketScoreStatusItem, MARKET_SCORE_COMPONENT_KEYS
)
from app.core import database
from app.core.database import upsert_node  # function — local binding ok
from app.core import llm_config
from langchain_core.messages import HumanMessage
# services imports (fetch_leads_for_org, get_company_profile_for_org,
# get_market_reports_for_org, score_single_lead_against_market) removed in
# commit 15/16 — all callers extracted to app.services.market_scoring.
from app.main import app, logger
from app.services._retrieval import (
    _stringify_context_for_query,
    _build_market_context_queries,
    _build_signal_context_queries,
    _fetch_pinecone_supporting_context,
)
from app.services._claude_budget import (
    CLAUDE_SIGNAL_WINDOW_SECONDS,
    CLAUDE_SIGNAL_TOKEN_LIMIT_5M,
    CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
    CLAUDE_API_KEY,
    _estimate_token_count,
    _prune_claude_signal_window,
    _reserve_claude_signal_budget,
    _finalize_claude_signal_budget,
)


# --- 3 market scoring routes (/leads/market-scores, /leads/market-scores/status,
#     /leads/{lead_id}/market-score-descriptions) and 18 helpers
#     (_get_profiler_mongo_client, _get_market_score_collections, identity/lookup
#     extraction, scoring run helpers, _persist_market_score_for_lead,
#     _run_market_scoring_for_org) moved to app.routers.market_scoring and
#     app.services.market_scoring in commit 15/16. ---


# --- GET /icp, POST /icp-research, POST /icp-research_claude moved to
#     app.routers.icp in commit 13/16. ---


# --- 7 signals routes (/signals-research, /generate-signals-batch[_claude],
#     /fetch-signals, /signal_action, /signal_Ask, /signal_ask_claude) plus
#     _generate_signals_batch_core moved to app.routers.signals in commit 14/16. ---
# --- DELETE /icp/recommended/{icp_id} moved to app.routers.icp in commit 13/16. ---
