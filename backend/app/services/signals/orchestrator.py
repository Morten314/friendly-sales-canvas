"""Signals service: Scout/Profiler signal search + batch generation."""
import json
import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

import requests

from app.core.config import tavily_api_key, claude_sonnet_model
from app.core.exceptions import (
    ServiceError,
    UnsupportedComponentError,
)
from app.models.market_research import MarketRequest
from app.models.signals import SignalAskRequest
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
from app.services.signals import persistence, search
from app.services.signals.prompts import (
    _SCOUT_PROMPT_TEMPLATE,
    _PROFILER_PROMPT_TEMPLATE,
    _LEADS_SECTION_TEMPLATE,
    _LEADS_SECTION_FALLBACK_TEMPLATE,
    _EXISTING_HEADLINES_SECTION_TEMPLATE,
    _SIGNAL_ASK_PROMPT_TEMPLATE,
    _SIGNAL_ASK_CLAUDE_PROMPT_TEMPLATE,
)
from app.services.signals.llm import _signals_agent_output
from app.services.signals.parsing import (
    _parse_search_signals_response,
    _normalize_search_signals_result,
)

from app.core.logging import logger

