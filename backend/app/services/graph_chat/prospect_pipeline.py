"""Prospect-scoring pipeline — audio transcription, LinkedIn enrichment, score calculation, LLM scoring."""
import re
from typing import Optional

import requests
import speech_recognition as sr
from langchain_core.messages import SystemMessage, HumanMessage

from app.core import prompts
from app.core.config import rapidapi_key


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

def extract_number(content) -> Optional[str]:
    match = re.search(r"'([^']+)'", str(content))
    return match.group(1) if match else None

def score_prospect(llm, cypher_query):
    """Score a prospect on a 0-10 scale via two-message LLM dispatch.

    Returns (score_str_or_none, prompt_meta_dict). Uses a manual two-render recipe:
    the system instruction is a static prompt, the user message embeds the cypher
    query. prompt_meta is reported from the user-side render (the canonical
    invocation surface — render_inputs_hash captures cypher_query, the variable
    half of the call).
    """
    system_rendered = prompts.render("score_prospect_system")
    user_rendered = prompts.render("score_prospect_user", cypher_query=cypher_query)

    messages = [
        SystemMessage(content=system_rendered.body),
        HumanMessage(content=user_rendered.body),
    ]

    response = llm.invoke(messages)
    score = extract_number(response)
    return score, prompts.prompt_meta_from(user_rendered)
