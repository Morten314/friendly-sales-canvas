"""Graph read/write operations for the prospect chat surface."""
import json

from app.core.config import PREDEFINED_QUESTIONS
from app.services._neo4j_helpers import query


def create_prospect_node(driver, Name: str, Company: str, answers: list):
    if len(answers) != len(PREDEFINED_QUESTIONS):
        raise ValueError("Mismatch between predefined questions and provided answers")

    # Constructing key-value pairs safely
    attributes = ", ".join([f"`{PREDEFINED_QUESTIONS[i]}`: {json.dumps(answers[i])}" for i in range(len(answers))])

    # Construct Cypher query
    cypher_query = f"""
    CREATE (p:Prospect {{
        Name: {json.dumps(Name)},
        Company: {json.dumps(Company)},
        {attributes}
    }})
    RETURN p
    """

    query(driver, cypher_query)  # Execute the Cypher query

def get_ranked_prospects(driver):
    query_string = """
    MATCH (p:Prospect)
    RETURN p.name AS name, p.mobile AS mobile, p.prospect_score AS score
    ORDER BY p.prospect_score DESC
    """

    with driver.session() as session:
        results = session.run(query_string).data()

    if not results:
        return "No prospects found."

    response = "📊 Prospects Ranked by Score\n\n"
    for idx, prospect in enumerate(results, start=1):
        response += f"{idx}. {prospect['name']}, [Call](tel:{prospect.get('mobile', 'N/A')})\n"

    return response

def run_cypher_query(driver, query_string: str):
    """Execute an arbitrary Cypher query string. Backs the raw `/query/` debug endpoint."""
    return query(driver, query_string)


def add_engagement(driver, prospect_name: str, text: str, update_type: str, engagement_id: int, current_time_str: str):
    """Create a Prospect node (if missing) and link an Engagement node to it.
    Used by both `/voice_graph/` and `/text_graph/`.
    TODO: parameterize the Cypher to close the injection risk on
    `prospect_name`/`text`/`update_type` (tracked under spec §2.2 security backlog)."""
    query(driver, f"MERGE (p:Prospect {{Name: '{prospect_name}'}})")
    query(driver, f"""
    CREATE (e:Engagement {{
        text: '{text}',
        id: {engagement_id},
        created_at: '{current_time_str}',
        type: '{update_type}'
    }})
    WITH e
    MATCH (p:Prospect {{Name: '{prospect_name}'}})
    CREATE (p)-[:HAS_ENGAGEMENT]->(e)""")
