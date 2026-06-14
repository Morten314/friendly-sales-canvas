import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Load API Keys and DB Credentials from environment variables
neo4j_uri = os.getenv("NEO4J_URI") or "neo4j+s://29adf28f.databases.neo4j.io"
neo4j_username = os.getenv("NEO4J_USERNAME") or "neo4j"
neo4j_password = os.getenv("NEO4J_PASSWORD") or "ShhMJSuKlseOSfN936BK_8gXNelap65MnZVyPrBCGyU"
together_api_key = os.getenv("TOGETHER_API_KEY") or "125f716e1162e3e22c14cfe83269a2c4ac25c8a90f8f3155fc7ec2da76b031b8"
claude_sonnet_model = os.getenv("CLAUDE_SONNET_MODEL") or "claude-sonnet-4-6"
claude_signal_window_seconds = int(os.getenv("CLAUDE_SIGNAL_WINDOW_SECONDS") or "300")
claude_signal_token_limit_5m = int(os.getenv("CLAUDE_SIGNAL_TOKEN_LIMIT_5M") or "1000000")
claude_signal_max_output_tokens = int(os.getenv("CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS") or "4000")

mongo_username = os.getenv("MONGO_USERNAME") or "techbrewra"
mongo_password = os.getenv("MONGO_PASSWORD") or "Brewra@Best09"

# MongoDB connection string
import urllib.parse
username = urllib.parse.quote_plus(mongo_username)
password = urllib.parse.quote_plus(mongo_password)
mongo_uri = (
    f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/"
    "?retryWrites=true&w=majority&appName=brewra-db"
)

# Tavily API Key
tavily_api_key = "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"

# RapidAPI Key for LinkedIn
rapidapi_key = "21e118e355mshbc19a8a36c9651ap150506jsn12f7ce6866aa"

# AWS S3 Configuration
s3_bucket = os.getenv("S3_BUCKET") or "brewra-data-sources"
aws_region = os.getenv("AWS_REGION") or "eu-north-1"
aws_access_key = os.getenv("AWS_ACCESS_KEY") or ""
aws_secret_key = os.getenv("AWS_SECRET_KEY") or ""

# Pinecone Configuration
pinecone_api_key = os.getenv("PINECONE_API_KEY") or ""

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

# CORS origins
origins = [
    "https://brewra-gtm-intelligence.vercel.app",  # Production PWA (Vercel)
    "http://localhost:3000",  # Allow local dev testing
]
