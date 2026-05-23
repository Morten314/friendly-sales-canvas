"""Graph chat / prospect scoring service.

Functions:
  - create_prospect_node: builds Cypher MERGE for new Company+Lead from answers
  - convert_audio_to_text: speech_recognition wrapper
  - get_linkedin_followers / get_linkedin_recent_activity / extract_linkedin_username:
    LinkedIn-related helpers via RapidAPI
  - calculate_prospect_score / get_ranked_prospects / extract_number /
    score_prospect: prospect-scoring chain
  - run_cypher_query / add_engagement: extracted from router endpoints
    (Phase F commit 11/17, per spec §2.1 item 5)

Extracted from services.py during phase A.
"""
import json
import re
import requests
import speech_recognition as sr
from typing import Optional

from langchain_core.messages import SystemMessage, HumanMessage

from app.core.config import PREDEFINED_QUESTIONS, rapidapi_key
from app.core.clients import query  # function — local binding ok


def convert_audio_to_text(file):
    recognizer = sr.Recognizer()

    def transcribe(file_path):
        try:
            with sr.AudioFile(file_path) as source:
                audio_data = recognizer.record(source)
                return recognizer.recognize_google(audio_data)
        except Exception as e:
            return f"Error processing {file_path}: {e}"

    text = transcribe(file)

    return text

# Function to create a company node in Neo4j
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

def get_linkedin_followers(username):
    url = f"https://linkedin-data-api.p.rapidapi.com/connection-count?username={username}"
    headers = {
        "x-rapidapi-host": "linkedin-data-api.p.rapidapi.com",
        "x-rapidapi-key": rapidapi_key
    }

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        try:
            data = response.json()
            return data.get("follower", "Follower count not available")
        except ValueError:
            return "Invalid JSON response"
    else:
        return f"Error: {response.status_code}"

def get_linkedin_recent_activity(username):
    url = f"https://linkedin-data-api.p.rapidapi.com/get-profile-recent-activity-time?username={username}"
    headers = {
        "x-rapidapi-host": "linkedin-data-api.p.rapidapi.com",
        "x-rapidapi-key": rapidapi_key
    }

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        try:
            data = response.json()
            return data.get("data", {}).get("recentActivity", "Recent activity not available")
        except ValueError:
            return "Invalid JSON response"
    else:
        return f"Error: {response.status_code}"

def extract_linkedin_username(url):
    """Extract LinkedIn username from profile URL."""
    match = re.search(r'linkedin\.com/in/([^/?]+)', url)
    return match.group(1) if match else ''

def calculate_prospect_score(recent_activity, followers):
    # Assign points based on recent activity
    if "h" in recent_activity:
        hours = int(recent_activity.replace("h", ""))
        activity_score = 5 if hours < 48 else 0
    elif "d" in recent_activity:
        days = int(recent_activity.replace("d", ""))
        activity_score = 3 if days < 7 else 1 if days < 30 else 0
    elif "mo" in recent_activity:
        months = int(recent_activity.replace("mo", ""))
        activity_score = 0.5 if months < 4 else 0
    elif "y" in recent_activity or "yr" in recent_activity:
        activity_score = 0
    else:
        activity_score = 0

    # Assign points based on followers count
    followers = int(followers)
    if followers < 100:
        follower_score = 0
    elif followers < 500:
        follower_score = 1
    elif followers < 2000:
        follower_score = 3
    elif followers < 5000:
        follower_score = 4
    else:
        follower_score = 5

    return activity_score + follower_score

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

def extract_number(content) -> Optional[str]:
    match = re.search(r"'([^']+)'", str(content))
    return match.group(1) if match else None

def score_prospect(llm, cypher_query):
    # AI instruction with memory context
    prompt_instruction = f"""
    You are an AI agent that goes through a cypher query with a prospect and how he answers 10 questions to a sales agent.
    YOU HAVE TO evaluate his answers and score the prospect a number between 0-10
    the questions and some scoring instructions are -
      "Is there a budget planned for the next four quarters?", : if he answers yes and gives a number , take it as good sign
      "Would this be categorized as Opex or Capex?",
      "Do you have a general idea of the expected spend range?", : take a positive answer positively
      "What factors are considered when determining this spend range?",
      "What level of access or visibility might be available to us?", : c-suite , higher executives , directors all things like that are plus
      "Who would typically be involved in making the final decision?",
      "What's their role or designation?",
      "Would it be convenient to meet in the office for a one-on-one discussion?",
      "Would you be open to meeting in a different location if that works better?",
      "Could this project contribute to career growth for the buyer?" : take positively if yes

        Rest analyze the answers and score , just and just give a number as respones like "5" or "6"

        """

    messages = [
        SystemMessage(content=prompt_instruction),
        HumanMessage(content=f"Cypher Query:\n{cypher_query}\n\nOnly give me the number , nothing else at all , not even punctuation marks:")
    ]

    response = llm(messages)
    response = extract_number(response)
    return response


# ---------------------------------------------------------------------------
# Router-extracted helpers (Phase F commit 11/17, per spec §2.1 item 5).
# These were inline Cypher in routers/graph_chat.py before; pushed into the
# service layer to keep the router HTTP-only and to flow `driver` through
# `Depends()` instead of the router's direct `from app.core.clients import query`.
# Cypher-injection risk in voice_graph/text_graph is carried over; spec §2.2
# defers parameterization to Phase G.
# ---------------------------------------------------------------------------

def run_cypher_query(driver, query_string: str):
    """Execute an arbitrary Cypher query string. Backs the raw `/query/` debug endpoint."""
    return query(driver, query_string)


def add_engagement(driver, prospect_name: str, text: str, update_type: str, engagement_id: int, current_time_str: str):
    """Create a Prospect node (if missing) and link an Engagement node to it.
    Used by both `/voice_graph/` and `/text_graph/`. Cypher injection via
    `prospect_name`/`text`/`update_type` is a Phase G concern (spec §2.2)."""
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
