import os
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from backend/.env via an explicit path. Bare
# load_dotenv() resolves against the current working directory, which varies by
# launcher; an explicit path is deterministic. config.py lives at
# backend/app/core/config.py, so parents[2] is the backend/ directory.
# (.env is gitignored — never committed. The legacy backend/backend.env is retired.)
_BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(_BACKEND_DIR / ".env")


def _require(name: str) -> str:
    """Return a required env var, or fail hard at import if it's missing/empty.

    Eliminates the silent-fallback-to-production footgun (spec 42 §1.1): a
    missing or misspelled var raises instead of quietly defaulting to a prod
    literal, which would let a staging service read/write production data.
    """
    val = os.getenv(name)
    if not val:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return val


# --- Neo4j ---
neo4j_uri = _require("NEO4J_URI")
neo4j_username = _require("NEO4J_USERNAME")
neo4j_password = _require("NEO4J_PASSWORD")

# --- MongoDB: full SRV connection string, pasted per environment ---
mongo_uri = _require("MONGO_URI")

# --- LLM / external APIs ---
together_api_key = _require("TOGETHER_API_KEY")
tavily_api_key = _require("TAVILY_API_KEY")
rapidapi_key = _require("RAPIDAPI_KEY")

# --- Pinecone ---
pinecone_api_key = _require("PINECONE_API_KEY")
pinecone_index = _require("PINECONE_INDEX")

# --- AWS S3 ---
s3_bucket = _require("S3_BUCKET")
aws_region = _require("AWS_REGION")
aws_access_key = _require("AWS_ACCESS_KEY")
aws_secret_key = _require("AWS_SECRET_KEY")

# --- CORS allow-list (comma-separated origins) ---
origins = [o.strip() for o in _require("CORS_ALLOWED_ORIGINS").split(",") if o.strip()]

# --- Tuning constants (spec 42 D4): identical across environments, carry no
# secret/targeting risk, so they keep in-code defaults and stay overridable. ---
claude_sonnet_model = os.getenv("CLAUDE_SONNET_MODEL") or "claude-sonnet-4-6"
claude_signal_window_seconds = int(os.getenv("CLAUDE_SIGNAL_WINDOW_SECONDS") or "300")
claude_signal_token_limit_5m = int(os.getenv("CLAUDE_SIGNAL_TOKEN_LIMIT_5M") or "1000000")
claude_signal_max_output_tokens = int(os.getenv("CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS") or "4000")

# Predefined questions for prospect scoring
PREDEFINED_QUESTIONS = [
  "Is there a budget planned for the next four quarters?",
  "Would this be categorized as Opex or Capex?",
  "Do you have a general idea of the expected spend range?",
  "What factors are considered when determining this spend range?",
  "What level of access or visibility might be available to us?",
  "Who would typically be involved in making the final decision?",
  "What's their role or designation?",
  "Would it be convenient to meet in the office for a one-on-one discussion?",
  "Would you be open to meeting in a different location if that works better?",
  "Could this project contribute to career growth for the buyer?"
]

# Stage mapping for sales pipeline
STAGE_ORDER = [
    "Leads prospected",
    "Leads qualified",
    "Soft connect",
    "POC connected",
    "Discovery call",
    "Demo call"
]

# Mapping from Neo4j raw stages to UI stages
STAGE_MAPPING = {
    "Initial Outreach": "Leads prospected",
    "Prospecting": "Leads prospected",
    "Discovery": "Leads qualified",
    "Qualification": "Soft connect",
    "Technical Fit": "POC connected",
    "Discovery Call": "Discovery",  # only if this exists in your Neo4j
    "Demo": "Demo call"
}
