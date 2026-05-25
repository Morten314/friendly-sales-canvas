"""graph_chat service — public API.

Service for prospect-chat ingest and scoring. Mixes Neo4j graph operations
(prospect/engagement nodes, ranking) with a multi-step prospect-scoring
pipeline (audio → LinkedIn enrichment → numeric score → LLM scoring).

Submodules:
  - neo4j.py: create_prospect_node, get_ranked_prospects,
    run_cypher_query, add_engagement
  - prospect_pipeline.py: convert_audio_to_text, get_linkedin_followers,
    get_linkedin_recent_activity, extract_linkedin_username,
    calculate_prospect_score, extract_number, score_prospect
"""

from app.services.graph_chat.neo4j import (
    create_prospect_node,
    get_ranked_prospects,
    run_cypher_query,
    add_engagement,
)
from app.services.graph_chat.prospect_pipeline import (
    convert_audio_to_text,
    get_linkedin_followers,
    get_linkedin_recent_activity,
    extract_linkedin_username,
    calculate_prospect_score,
    extract_number,
    score_prospect,
)
