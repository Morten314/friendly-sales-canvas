"""Prospect-scoring pipeline — audio transcription, LinkedIn enrichment, score calculation, LLM scoring."""
import re
from typing import Optional

import requests
import speech_recognition as sr
from langchain_core.messages import SystemMessage, HumanMessage

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
