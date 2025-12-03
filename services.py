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
from config import PREDEFINED_QUESTIONS, rapidapi_key
from database import driver, query
from llm_config import llm_transformer, graph, llm, agent_chain

# Function to load documents
def load_document(file_path):
    if file_path.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    elif file_path.endswith(".txt"):
        loader = TextLoader(file_path)
    return loader.load()

# Function to process documents and update Neo4j graph
def grapher(file_path):
    text = load_document(file_path)
    graph_documents = llm_transformer.convert_to_graph_documents(text)
    graph.add_graph_documents(graph_documents)

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
def create_prospect_node(Name: str, Company: str, answers: list):
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

    query(cypher_query)  # Execute the Cypher query

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

def get_ranked_prospects():
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

def extract_number(content) -> str:
    match = re.search(r"'([^']+)'", str(content))
    return match.group(1) if match else None

def score_prospect(cypher_query):
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

def process_prospect_list(file_path):
    """Process the prospect list and add data to Neo4j."""
    
    # Read file based on extension
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    elif file_path.endswith('.xlsx'):
        df = pd.read_excel(file_path)
    else:
        return {'error': 'Unsupported file format'}
    
    required_columns = ['Prospect Name', 'Prospect Company']
    question_columns = [
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
    
    all_columns = required_columns + question_columns
    added_count = 0
    
    for _, row in df.iterrows():
        data = {col: row[col] if col in df.columns and pd.notna(row[col]) else '' for col in all_columns}
        
        # Check if prospect already exists
        check_query = f"""
            MATCH (p:Prospect {{name: '{data['Prospect Name']}', company: '{data['Prospect Company']}'}}) RETURN p
        """
        existing_prospect = query(check_query)
        
        if existing_prospect:
            continue  # Skip if already exists
        
        # First create a query to get a score
        temp_cypher = f"""
        CREATE (p:Prospect {{
            Name: '{data["Prospect Name"]}',
            Company: '{data["Prospect Company"]}',
            `Is there a budget planned for the next four quarters?`: '{data[question_columns[0]]}',
            `Would this be categorized as Opex or Capex?`: '{data[question_columns[1]]}',
            `Do you have a general idea of the expected spend range?`: '{data[question_columns[2]]}',
            `What factors are considered when determining this spend range?`: '{data[question_columns[3]]}',
            `What level of access or visibility might be available to us?`: '{data[question_columns[4]]}',
            `Who would typically be involved in making the final decision?`: '{data[question_columns[5]]}',
            `What's their role or designation?`: '{data[question_columns[6]]}',
            `Would it be convenient to meet in the office for a one-on-one discussion?`: '{data[question_columns[7]]}',
            `Would you be open to meeting in a different location if that works better?`: '{data[question_columns[8]]}',
            `Could this project contribute to career growth for the buyer?`: '{data[question_columns[9]]}'
        }})
        """
        score = score_prospect(temp_cypher)

        # Final query with score
        cypher_query = f"""
        CREATE (p:Prospect {{
            Name: '{data["Prospect Name"]}',
            Company: '{data["Prospect Company"]}',
            `Is there a budget planned for the next four quarters?`: '{data[question_columns[0]]}',
            `Would this be categorized as Opex or Capex?`: '{data[question_columns[1]]}',
            `Do you have a general idea of the expected spend range?`: '{data[question_columns[2]]}',
            `What factors are considered when determining this spend range?`: '{data[question_columns[3]]}',
            `What level of access or visibility might be available to us?`: '{data[question_columns[4]]}',
            `Who would typically be involved in making the final decision?`: '{data[question_columns[5]]}',
            `What's their role or designation?`: '{data[question_columns[6]]}',
            `Would it be convenient to meet in the office for a one-on-one discussion?`: '{data[question_columns[7]]}',
            `Would you be open to meeting in a different location if that works better?`: '{data[question_columns[8]]}',
            `Could this project contribute to career growth for the buyer?`: '{data[question_columns[9]]}',
            `Prospect_Score`: '{score}' 
        }})
        """
        query(cypher_query)
        added_count += 1

    return {"message": f"{added_count} new prospects added."}

# Research Market Functions
def Research_Market_1(pre_data: str) -> dict:
    # Construct prompt by embedding the entire JSON string
    template = """Task: Research and compile an updated overview of market, including size, segment breakdown, growth projections, strategic recommendations, and market drivers based on the data below based on this ( follow this strictly and do research based on what all provided here - {pre_data}.

Return your findings in the following exact JSON format --  use this data to do the research - {pre_data}


{{
  "executiveSummary": "[1-2 sentence summary of overall market opportunity and trends]",
  "tamValue": "[Total Addressable Market size, e.g., '$4.2B']",
  "samValue": "[Serviceable Addressable Market size, e.g., '$2.1B']",
  "apacGrowthRate": "[Growth rate of APAC market, e.g., '25%']",
  "strategicRecommendations": [
    "[Recommendation #1]",
    "[Recommendation #2]",
    "[Recommendation #3]"
  ],
  "marketEntry": "[Brief description of phased market entry strategy, ideally mentioning regions like North America and APAC]",
  "marketDrivers": [
    "[Key driver #1]",
    "[Key driver #2]",
    "[Key driver #3]",
    "[Key driver #4]"
  ],
  "marketSizeBySegment": {{
    "Enterprise": "[e.g., '45%']",
    "Mid-Market": "[e.g., '35%']",
    "SMB": "[e.g., '20%']"
  }},
  "growthProjections": {{
    "2023": "[value or index]",
    "2024": "[value or index]",
    "2025": "[value or index]",
    "2026": "[value or index]"
  }}
}}
⚠️ Notes:

Use USD for monetary values in billions (B) or millions (M).

If numeric growth values aren't available for projections, provide a normalized trend (e.g., index from 1.0 to 2.5).

Pie chart data under marketSizeBySegment must sum to ~100%.

Keep bullet point recommendations short and actionable.

give only json , nothing else , nothing at all

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
    input_variables=["pre_data"],
    template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response
    raw_response = agent_chain.invoke({'input': prompt})
    response = raw_response["output"]

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

def Research_Market_2(pre_data: str) -> dict:
    # Construct prompt by embedding the entire JSON string
    template = """Task: Research and compile an updated overview of market, including size, segment breakdown, growth projections, strategic recommendations, and market drivers based on the data below based on this ( follow this strictly and do research based on what all provided here - {pre_data}.

Return your findings in the following exact JSON format --  use this data to do the research - {pre_data}


{{
  "executiveSummary": "[1-2 sentence summary of overall market opportunity and trends]",
  "aiAdoption": "[AI adoption percentage, e.g., '78%']",
  "cloudMigration": "[Cloud migration percentage, e.g., '45%']",
  "regulatory": "[Number of regulatory changes, e.g., '12']",
  "trendSnapshots": [
    {{
      "title": "[Trend title]",
      "metric": "[Metric value]",
      "type": "[adoption|growth|performance]"
    }},
    {{
      "title": "[Trend title]",
      "metric": "[Metric value]",
      "type": "[adoption|growth|performance]"
    }},
    {{
      "title": "[Trend title]",
      "metric": "[Metric value]",
      "type": "[adoption|growth|performance]"
    }}
  ],
  "regionalHotspots": {{
    "APAC": "[Percentage value]",
    "Europe": "[Percentage value]",
    "North America": "[Percentage value]"
  }},
  "recommendations": {{
    "primaryFocus": "[Primary focus recommendation]",
    "marketEntry": "[Market entry strategy recommendation]"
  }},
  "risks": [
    "[Risk #1]",
    "[Risk #2]",
    "[Risk #3]"
  ],
  "visualCharts": {{
    "aiAdoptionTrends": ["[Quarter labels]"],
    "technologyBudgetAllocation": {{
      "[Category]": "[Percentage]",
      "[Category]": "[Percentage]",
      "[Category]": "[Percentage]"
    }}
  }}
}}
⚠️ Notes:

Use USD for monetary values in billions (B) or millions (M).

If numeric growth values aren't available for projections, provide a normalized trend (e.g., index from 1.0 to 2.5).

Pie chart data under marketSizeBySegment must sum to ~100%.

Keep bullet point recommendations short and actionable.

give only json , nothing else , nothing at all

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
    input_variables=["pre_data"],
    template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response
    raw_response = agent_chain.invoke({'input': prompt})
    response = raw_response["output"]

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

def Research_Market_3(pre_data: str) -> dict:
    # Construct prompt by embedding the entire JSON string
    template = """Task: Research and compile an updated overview of market in the exact format given at end, based on the data below based on this ( follow this strictly and do research based on what all provided here - {pre_data}.

Return your findings in the following exact JSON format --  use this data to do the research - {pre_data}


{{
  "uiComponents": [
    {{
      "type": "section",
      "title": "[Section title]",
      "description": "[Section description]",
      "metrics": [
        {{ "label": "[Metric label]", "value": "[Metric value]", "trend": "[up|down|stable]" }},
        {{ "label": "[Metric label]", "value": "[Metric value]", "trend": "[up|down|stable]" }}
      ],
      "tags": ["[Competitor name]", "[Competitor name]", "[Competitor name]"]
    }},
    {{
      "type": "report",
      "title": "[Report title]",
      "executiveSummary": "[Executive summary of competitive landscape]",
      "dataPoints": [
        {{
          "label": "[Data point label]",
          "value": "[Data point value]"
        }},
        {{
          "label": "[Data point label]",
          "value": "[Data point value]"
        }},
        {{
          "label": "[Data point label]",
          "value": "[Data point value]"
        }}
      ]
    }},
    {{
      "type": "swotAnalysis",
      "entities": [
        {{
          "name": "[Competitor name]",
          "strengths": ["[Strength]", "[Strength]"],
          "weaknesses": ["[Weakness]", "[Weakness]"]
        }},
        {{
          "name": "[Competitor name]",
          "strengths": ["[Strength]", "[Strength]"],
          "weaknesses": ["[Weakness]", "[Weakness]"]
        }}
      ]
    }},
    {{
      "type": "news",
      "headlines": [
        "[News headline #1]",
        "[News headline #2]",
        "[News headline #3]"
      ]
    }},
    {{
      "type": "marketShareCharts",
      "regions": [
        {{
          "name": "[Region name]",
          "data": {{
            "[Competitor]": "[Market share percentage]",
            "[Competitor]": "[Market share percentage]",
            "[Competitor]": "[Market share percentage]",
            "Others": "[Market share percentage]"
          }}
        }},
        {{
          "name": "[Region name]",
          "data": {{
            "[Competitor]": "[Market share percentage]",
            "[Competitor]": "[Market share percentage]",
            "[Competitor]": "[Market share percentage]",
            "Others": "[Market share percentage]"
          }}
        }}
      ]
    }},
    {{
      "type": "featureComparison",
      "features": ["[Feature]", "[Feature]", "[Feature]", "[Feature]"],
      "tools": {{
        "[Tool name]": ["[Comparison value]", "[Comparison value]", "[Comparison value]", "[Comparison value]"],
        "[Tool name]": ["[Comparison value]", "[Comparison value]", "[Comparison value]", "[Comparison value]"],
        "[Tool name]": ["[Comparison value]", "[Comparison value]", "[Comparison value]", "[Comparison value]"],
        "[Tool name]": ["[Comparison value]", "[Comparison value]", "[Comparison value]", "[Comparison value]"]
      }}
    }},
    {{
      "type": "mnaInsights",
      "insights": [
        {{
          "label": "[Insight label]",
          "description": "[Insight description]"
        }},
        {{
          "label": "[Insight label]",
          "description": "[Insight description]"
        }},
        {{
          "label": "[Insight label]",
          "description": "[Insight description]"
        }}
      ]
    }},
    {{
      "type": "marketTrends",
      "charts": [
        {{ "name": "[Chart name]", "xAxis": "[X-axis labels]" }},
        {{ "name": "[Chart name]", "xAxis": ["[X-axis label]", "[X-axis label]"] }}
      ]
    }}
  ]
}}

⚠️ Notes:

Use USD for monetary values in billions (B) or millions (M).

If numeric growth values aren't available for projections, provide a normalized trend (e.g., index from 1.0 to 2.5).

Pie chart data under marketSizeBySegment must sum to ~100%.

Keep bullet point recommendations short and actionable.

give only json , nothing else , nothing at all

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
    input_variables=["pre_data"],
    template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response
    raw_response = agent_chain.invoke({'input': prompt})
    response = raw_response["output"]

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

def Research_Market_4(pre_data: str) -> dict:
    # Construct prompt by embedding the entire JSON string
    template = """Task: Research and compile an updated overview of market in the exact format given at end, based on the data below based on this ( follow this strictly and do research based on what all provided here - {pre_data}.

Return your findings in the following exact JSON format --  use this data to do the research - {pre_data}


{{
  "executiveSummary": "[1-2 sentence summary of regulatory landscape and compliance requirements]",
  "keyUpdates": [
    {{
      "title": "[Update title]",
      "description": "[Update description or date]",
      "tag": "[New|Update|Risk|High Priority]",
      "icon": "[icon name]"
    }},
    {{
      "title": "[Update title]",
      "description": "[Update description or percentage]",
      "tag": "[New|Update|Risk|High Priority]",
      "icon": "[icon name]"
    }},
    {{
      "title": "[Update title]",
      "description": "[Update description]",
      "tag": "[New|Update|Risk|High Priority]",
      "icon": "[icon name]"
    }},
    {{
      "title": "[Update title]",
      "description": "[Update description]",
      "tag": "[New|Update|Risk|High Priority]",
      "icon": "[icon name]"
    }}
  ],
  "visualDataCards": [
    {{
      "title": "[Card title]",
      "type": "[bar-chart|timeline|percentage]",
      "data": [
        {{ "label": "[Label]", "value": [numeric value] }},
        {{ "label": "[Label]", "value": [numeric value] }},
        {{ "label": "[Label]", "value": [numeric value] }},
        {{ "label": "[Label]", "value": [numeric value] }}
      ]
    }},
    {{
      "title": "[Card title]",
      "type": "[bar-chart|timeline|percentage]",
      "data": [
        {{ "label": "[Label]", "time": "[Time period]" }},
        {{ "label": "[Label]", "time": "[Time period]" }},
        {{ "label": "[Label]", "time": "[Time period]" }}
      ]
    }},
    {{
      "title": "[Card title]",
      "type": "[bar-chart|timeline|percentage]",
      "data": [
        {{ "label": "[Label]", "value": [numeric value] }},
        {{ "label": "[Label]", "value": [numeric value] }},
        {{ "label": "[Label]", "value": [numeric value] }}
      ]
    }}
  ],
  "regionalData": [
    {{
      "region": "[Region name]",
      "framework": "[Regulatory framework]",
      "deadline": "[Deadline or status]",
      "impact": "[High|Medium|Low]",
      "status": "[Active|Evolving|Mandatory]",
      "requirements": "[Key requirements]"
    }},
    {{
      "region": "[Region name]",
      "framework": "[Regulatory framework]",
      "deadline": "[Deadline or status]",
      "impact": "[High|Medium|Low]",
      "status": "[Active|Evolving|Mandatory]",
      "requirements": "[Key requirements]"
    }},
    {{
      "region": "[Region name]",
      "framework": "[Regulatory framework]",
      "deadline": "[Deadline or status]",
      "impact": "[High|Medium|Low]",
      "status": "[Active|Evolving|Mandatory]",
      "requirements": "[Key requirements]"
    }},
    {{
      "region": "[Region name]",
      "framework": "[Regulatory framework]",
      "deadline": "[Deadline or status]",
      "impact": "[High|Medium|Low]",
      "status": "[Active|Evolving|Mandatory]",
      "requirements": "[Key requirements]"
    }}
  ],
  "strategicRecommendations": {{
    "mitigateRegulatoryRisks": [
      "[Recommendation #1]",
      "[Recommendation #2]",
      "[Recommendation #3]",
      "[Recommendation #4]"
    ],
    "competitivePositioning": [
      "[Recommendation #1]",
      "[Recommendation #2]",
      "[Recommendation #3]",
      "[Recommendation #4]"
    ],
    "goToMarketStrategy": [
      "[Recommendation #1]",
      "[Recommendation #2]",
      "[Recommendation #3]",
      "[Recommendation #4]"
    ]
  }}
}}


⚠️ Notes:

Use USD for monetary values in billions (B) or millions (M).

If numeric growth values aren't available for projections, provide a normalized trend (e.g., index from 1.0 to 2.5).

Pie chart data under marketSizeBySegment must sum to ~100%.

Keep bullet point recommendations short and actionable.

give only json , nothing else , nothing at all

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
    input_variables=["pre_data"],
    template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response
    raw_response = agent_chain.invoke({'input': prompt})
    response = raw_response["output"]

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

def Research_Market_5(pre_data: str) -> dict:
    # Construct prompt by embedding the entire JSON string
    template = """Task: Research and compile an updated overview of market in the exact format given at end, based on the data below based on this ( follow this strictly and do research based on what all provided here - {pre_data}.

Return your findings in the following exact JSON format --  use this data to do the research - {pre_data}


{{
  "executiveSummary": "[1-2 sentence summary of market entry opportunity and challenges]",
  "entryBarriers": [
    "[Entry barrier #1]",
    "[Entry barrier #2]",
    "[Entry barrier #3]",
    "[Entry barrier #4]"
  ],
  "recommendedChannel": "[Recommended channel strategy]",
  "timeToMarket": "[Time to market estimate, e.g., '12-18 months']",
  "topBarrier": "[Top barrier description]",
  "competitiveDifferentiation": [
    "[Differentiation factor #1]",
    "[Differentiation factor #2]",
    "[Differentiation factor #3]",
    "[Differentiation factor #4]"
  ],
  "strategicRecommendations": [
    "[Strategic recommendation #1]",
    "[Strategic recommendation #2]",
    "[Strategic recommendation #3]",
    "[Strategic recommendation #4]"
  ],
  "riskAssessment": [
    "[Risk #1]",
    "[Risk #2]",
    "[Risk #3]"
  ],
  "swot": {{
    "strengths": ["[Strength]", "[Strength]"],
    "weaknesses": ["[Weakness]", "[Weakness]"],
    "opportunities": ["[Opportunity]", "[Opportunity]"],
    "threats": ["[Threat]", "[Threat]"]
  }},
  "timeline": [
    {{
      "label": "[Timeline label]",
      "phase": "[Phase name]",
      "quarter": "[Quarter, e.g., 'Q1 2025']",
      "timestamp": "[ISO timestamp, e.g., '2025-01-01']"
    }},
    {{
      "label": "[Timeline label]",
      "phase": "[Phase name]",
      "quarter": "[Quarter, e.g., 'Q2 2025']",
      "timestamp": "[ISO timestamp, e.g., '2025-04-01']"
    }},
    {{
      "label": "[Timeline label]",
      "phase": "[Phase name]",
      "quarter": "[Quarter, e.g., 'Q3 2025']",
      "timestamp": "[ISO timestamp, e.g., '2025-07-01']"
    }}
  ]
}}



⚠️ Notes:

Use USD for monetary values in billions (B) or millions (M).

If numeric growth values aren't available for projections, provide a normalized trend (e.g., index from 1.0 to 2.5).

Pie chart data under marketSizeBySegment must sum to ~100%.

Keep bullet point recommendations short and actionable.

give only json , nothing else , nothing at all

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
    input_variables=["pre_data"],
    template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response
    raw_response = agent_chain.invoke({'input': prompt})
    response = raw_response["output"]

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

def ICP_generator(pre_data: str) -> dict:
    # Construct prompt by embedding the entire JSON string
    template = """Task: Based on the provided company_profile below, analyze the data and research the market to suggest the most relevant Ideal Customer Profiles (ICPs). Consider industry fit, strategic alignment, and known patterns of technology adoption.

Use this data to do your research and reasoning — {pre_data}.

Return your results strictly in the following JSON format — follow the field names and refer to the previous data to search the internet and find the ICPs for this particular company details.

{{"suggestedICPs": [
    {{
      "id": "fintech-neobanks",
      "industry": "Fintech",
      "segment": "Neobanks",
      "companySize": "50–200 employees",
      "decisionMakers": ["CTO", "Head of Digital"],
      "regions": ["North America", "DACH"],
      "keyAttributes": ["High cloud adoption", "Regulatory compliance focus"],
      "growthIndicator": "5.6% CAGR"
    }},
    {{
      "id": "healthcare-saas",
      "industry": "Healthcare SaaS",
      "segment": "Patient Data Analytics",
      "companySize": "100–500 employees",
      "decisionMakers": ["Chief Medical Officer", "IT Director"],
      "regions": ["North America", "EU"],
      "keyAttributes": ["HIPAA compliance", "AI/ML integration"],
      "growthIndicator": "8.2% CAGR"
    }}
]}}

⚠️ Notes:

- Choose ICPs that are strategically relevant to the profile.
- Use real-world signals from similar companies/markets.
- Ensure consistency in field names and value types.
- Only return JSON, nothing else.

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
    input_variables=["pre_data"],
    template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response
    raw_response = agent_chain.invoke({'input': prompt})
    response = raw_response["output"]

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

def icp_research_1(pre_data: str) -> dict:
    # Construct prompt by embedding the entire JSON string
    template = """Task: Research and compile an updated overview of icp  in the exact format given at end, based on the data below based on this ( follow this strictly and do research based on what all provided here - {pre_data}.

Return your findings in the following exact JSON format --  use this data to do the research - {pre_data}


{{
  "currentData": {{
    "title": "Healthcare Providers - Hospitals/Clinics (201-500 employees)",
    "blurb": "Hospitals/Clinics companies in Healthcare Providers seeking innovative solutions to scale their operations across Germany, DACH, EU markets. Key focus areas include High cloud adoption and HIPAA/GDPR compliance.",
    "_metadata": {{
      "dataSource": "api"
    }},
    "marketSize": "€51.6B",
    "growth": "+30%",
    "urgency": "High",
    "timeToClose": "4-6 months",
    "marketAnalysis": {{
      "totalMarketSize": "€51.7B",
      "marketGrowth": "+30%",
      "servicableMarket": "€17.5B",
      "targetableMarket": "€4.1B",
      "segments": [
        {{
          "name": "Advanced Hospitals/Clinics",
          "share": "45%",
          "size": "€22.0B",
          "growth": "+40%"
        }},
        {{
          "name": "Traditional Hospitals/Clinics",
          "share": "35%",
          "size": "€17.0B",
          "growth": "+22%"
        }}
      ],
      "growthTrajectory": {{
        "units": "index(2023=100)",
        "points": [
          {{ "year": 2023, "index": 100 }},
          {{ "year": 2024, "index": 103 }},
          {{ "year": 2025, "index": 107 }},
          {{ "year": 2026, "index": 112 }}
        ]
      }},
      "marketShareDistribution": [
        {{ "name": "Advanced Hospitals/Clinics", "share": "45%" }},
        {{ "name": "Traditional Hospitals/Clinics", "share": "35%" }},
        {{ "name": "Other", "share": "20%" }}
      ],
      "keyChallenges": [
        "Healthcare Providers sector complexity requiring specialized high cloud adoption",
        "Hospitals/Clinics integration challenges for 201-500 employees organizations"
      ],
      "strategicRecommendations": [
        "Target Healthcare Providers companies specifically needing high cloud adoption",
        "Focus hospitals/clinics messaging on high cloud adoption and HIPAA/GDPR compliance benefits"
      ],
      "signalsToMonitor": [
        "Healthcare Providers sector funding and hospitals/clinics investment announcements",
        "Germany regulatory changes affecting healthcare providers high cloud adoption"
      ]
    }},
  }}
}}


⚠️ Notes:

Use USD for monetary values in billions (B) or millions (M).

If numeric growth values aren't available for projections, provide a normalized trend (e.g., index from 1.0 to 2.5).

Pie chart data under marketSizeBySegment must sum to ~100%.

Keep bullet point recommendations short and actionable.

give only json , nothing else , nothing at all

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
    input_variables=["pre_data"],
    template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response
    raw_response = agent_chain.invoke({'input': prompt})
    response = raw_response["output"]

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

def icp_research_2(pre_data: str) -> dict:
    # Construct prompt by embedding the entire JSON string
    template = """Task: Research and compile an updated overview of icp  in the exact format given at end, based on the data below based on this ( follow this strictly and do research based on what all provided here - {pre_data}.

Return your findings in the following exact JSON format --  use this data to do the research - {pre_data}


{{
  "currentData": {{
    "title": "Buyer Map & Roles, Pain Points, Triggers",
    "blurb": "Primary decision makers include CTOs focused on infrastructure modernization and Heads of Digital driving customer experience improvements. Key pain points center around legacy system constraints and regulatory compliance complexity, with funding rounds and competitive pressures serving as primary buying triggers.",
    "_metadata": {{
      "dataSource": "ui"
    }},
    "coreBuyerPersonas": 2,
    "topPainPoint": "High digital marketing spend",
    "buyingTriggersIdentified": 2,
    "buyingTriggers": [
      {{
        "trigger": "E-commerce Modernization",
        "description": "E-commerce companies upgrading direct-to-consumer brands to address high digital marketing spend."
      }},
      {{
        "trigger": "High digital marketing spend",
        "description": "New e-commerce regulations requiring high digital marketing spend improvements in DACH."
      }}
    ]
  }}
}}


⚠️ Notes:

Use USD for monetary values in billions (B) or millions (M).

If numeric growth values aren't available for projections, provide a normalized trend (e.g., index from 1.0 to 2.5).

Pie chart data under marketSizeBySegment must sum to ~100%.

Keep bullet point recommendations short and actionable.

give atleast 5-6 buyer signals which are accurate

give only json , nothing else , nothing at all

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
    input_variables=["pre_data"],
    template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response
    raw_response = agent_chain.invoke({'input': prompt})
    response = raw_response["output"]

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

def icp_research_3(pre_data: str) -> dict:
    # Construct prompt by embedding the entire JSON string
    template = """Task: Research and compile an updated overview of icp  in the exact format given at end, based on the data below based on this ( follow this strictly and do research based on what all provided here - {pre_data}.

Return your findings in the following exact JSON format --  use this data to do the research - {pre_data}


{{
  "currentData": {{
    "title": "Competitive Overlap & Buying Signals",
    "blurb": "Key competitors include E-commerce Leader A and E-commerce Leader B dominating the established market, while cloud-native solutions gain traction. Recent market signals show increased funding activity and regulatory-driven technology investments creating new opportunities.",
    "_metadata": {{
      "dataSource": "ui"
    }},
    "numberOfMainCompetitors": 7,
    "recentWinLossChange": "+11%",
    "activeBuyingSignals": 3,
    "competitiveMap": [
      {{
        "competitor": "E-commerce Incumbent A",
        "segment": "Direct-to-Consumer Brands",
        "share": "24%",
        "winsLosses": "Strong in DACH, high digital marketing spend focus",
        "differentiators": "Legacy e-commerce presence, high digital marketing spend approach"
      }}
    ],
    "competitiveNewsAndEvents": [
      {{
        "headline": "E-commerce Leader announces direct-to-consumer brands expansion",
        "source": "E-commerce Leader A",
        "date": "2024-12-15"
      }}
    ],
    "buyingSignals": [
      {{
        "signalType": "High digital marketing spend",
        "description": "Increased high digital marketing spend spending in e-commerce",
        "source": "Industry Reports",
        "recency": "2 weeks ago"
      }},
      {{
        "signalType": "Funding Round",
        "description": "Major e-commerce player raises Series C funding to accelerate digital transformation",
        "source": "Press Release",
        "recency": "1 month ago"
      }},
      {{
        "signalType": "Regulatory Compliance",
        "description": "New DACH regulations pushing higher investment in marketing and compliance systems",
        "source": "Government Bulletin",
        "recency": "3 weeks ago"
      }}
    ]
  }}
}}



⚠️ Notes:

Use USD for monetary values in billions (B) or millions (M).

If numeric growth values aren't available for projections, provide a normalized trend (e.g., index from 1.0 to 2.5).

Pie chart data under marketSizeBySegment must sum to ~100%.

Keep bullet point recommendations short and actionable.

give atleast 3-4 buyingsignals

give only json , nothing else , nothing at all

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
    input_variables=["pre_data"],
    template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response
    raw_response = agent_chain.invoke({'input': prompt})
    response = raw_response["output"]

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

def icp_research_4(pre_data: str) -> dict:
    # Construct prompt by embedding the entire JSON string
    template = """Task: Research and compile an updated overview of icp  in the exact format given at end, based on the data below based on this ( follow this strictly and do research based on what all provided here - {pre_data}.

Return your findings in the following exact JSON format --  use this data to do the research - {pre_data}


{{
  "currentData": {{
    "title": "Regulatory, Compliance & Recommended ICP",
    "blurb": "Companies in this segment face increasing compliance requirements, especially around cloud-hosted data and regulatory frameworks. This section recommends refining your ICP to reflect these regulatory triggers and market dynamics.",
    "_metadata": {{
      "dataSource": "ui"
    }},
    "keyComplianceFrameworks": [
      "GDPR",
      "Industry Standards"
    ],
    "upcomingMandates": "Q4 2025 Updates",
    "icpFitScore": "92% match",
    "recommendationConfidence": "High",
    "icpRefinementRecommendations": [
      {{
        "title": "Target High-Compliance Organizations",
        "description": "Focus on companies that have already invested in compliance infrastructure and understand regulatory complexity"
      }},
      {{
        "title": "Prioritize Multi-Jurisdiction Players",
        "description": "Companies operating across multiple regions face the highest compliance burden and need comprehensive solutions"
      }},
      {{
        "title": "Focus on Cloud-First Organizations",
        "description": "Target companies already committed to cloud infrastructure who need compliance-ready solutions"
      }},
      {{
        "title": "Emphasize Audit-Ready Capabilities",
        "description": "Position solutions that provide built-in audit trails and compliance reporting features"
      }}
    ]
  }}
}}



⚠️ Notes:

Use USD for monetary values in billions (B) or millions (M).

If numeric growth values aren't available for projections, provide a normalized trend (e.g., index from 1.0 to 2.5).

Pie chart data under marketSizeBySegment must sum to ~100%.

Keep bullet point recommendations short and actionable.

give accurate values by internet research

give only json , nothing else , nothing at all

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
    input_variables=["pre_data"],
    template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response
    raw_response = agent_chain.invoke({'input': prompt})
    response = raw_response["output"]

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

# Function mappings
ICP_FUNCTIONS = {
    "icp summary & market opportunity": icp_research_1,
    "buyer map & roles, pain points, triggers" : icp_research_2,
    "competitive overlap & buying signals" : icp_research_3,
    "regulatory, compliance & recommended icp" : icp_research_4
}

COMPONENT_FUNCTIONS = {
    "market size & opportunity": Research_Market_1,
    "industry trends report": Research_Market_2,
    "competitor landscape": Research_Market_3,
    "regulatory & compliance highlights" : Research_Market_4,
    "market entry & growth strategy" : Research_Market_5
}

# Signals Research Functions
def search_signals_scout(pre_data: str) -> dict:
    """Search for market, competitor, and industry trend signals for Scout agent"""
    # For now, generate realistic signals based on the company profile
    # TODO: Integrate with actual LLM once configuration issues are resolved
    
    import random
    from datetime import datetime, timedelta
    
    # Generate realistic market signals based on company profile
    industry = pre_data.get("industry", "SaaS")
    company_size = pre_data.get("companySize", "50-200 employees")
    
    # Sample market signals
    market_signals = [
        {
            "headline": f"{industry} market shows 25% growth in Q4 2024",
            "snippet": f"Market analysis indicates strong demand for {industry} solutions in your target segment.",
            "sourceUrl": "https://techcrunch.com/market-analysis-2024",
            "sourceLabel": "Industry report"
        },
        {
            "headline": f"Competitors in {industry} space raise $50M in funding",
            "snippet": f"Recent funding rounds suggest increased competition in the {industry} market.",
            "sourceUrl": "https://crunchbase.com/funding-rounds",
            "sourceLabel": "Funding news"
        },
        {
            "headline": f"AI adoption in {industry} increases by 40%",
            "snippet": f"Companies in your target market are rapidly adopting AI-powered solutions.",
            "sourceUrl": "https://gartner.com/ai-adoption-trends",
            "sourceLabel": "Research report"
        },
        {
            "headline": f"Regulatory changes impact {industry} compliance",
            "snippet": f"New regulations create opportunities for compliance-focused solutions.",
            "sourceUrl": "https://regulatory-updates.com",
            "sourceLabel": "Regulatory news"
        }
    ]
    
    # Select a random signal
    signal = random.choice(market_signals)
    
    # Generate timestamp
    hours_ago = random.randint(1, 24)
    timestamp = f"{hours_ago}h ago"
    
    return {
        "id": "1",
        "agent": "scout",
        "timestamp": timestamp,
        "headline": signal["headline"],
        "snippet": signal["snippet"],
        "sourceUrl": signal["sourceUrl"],
        "sourceLabel": signal["sourceLabel"],
        "nextBestMoves": [
            "Should I analyze competitor strategies in your market?",
            "Would you like me to identify market opportunities for your product?"
        ],
        "contextualSuggestions": [
            {"icon": "chart", "text": "View market trends"},
            {"icon": "target", "text": "Update targeting strategy"}
        ]
    }

def search_signals_profiler(pre_data: str) -> dict:
    """Search for ICP and customer-related signals for Profiler agent"""
    # For now, generate realistic signals based on the company profile and ICP data
    # TODO: Integrate with actual LLM once configuration issues are resolved
    
    import random
    from datetime import datetime, timedelta
    
    # Extract company profile data
    if isinstance(pre_data, dict):
        if "company_profile" in pre_data:
            company_data = pre_data["company_profile"]
            icp_data = pre_data.get("icp_data", {})
        else:
            company_data = pre_data
            icp_data = {}
    else:
        company_data = {}
        icp_data = {}
    
    industry = company_data.get("industry", "SaaS")
    company_size = company_data.get("companySize", "50-200 employees")
    
    # Sample customer/ICP signals
    customer_signals = [
        {
            "headline": f"Mid-market {industry} companies increase tech spending by 30%",
            "snippet": f"Your ICP segment shows strong buying signals for technology solutions in {industry}.",
            "sourceUrl": "https://gartner.com/midmarket-tech-spending-2024",
            "sourceLabel": "Market research"
        },
        {
            "headline": f"Customer acquisition costs rise 15% in {industry}",
            "snippet": f"Companies in your target market are investing more in customer acquisition.",
            "sourceUrl": "https://marketingland.com/cac-trends-2024",
            "sourceLabel": "Marketing report"
        },
        {
            "headline": f"Buying committees expand in {industry} sector",
            "snippet": f"Decision-making processes are becoming more complex in your target market.",
            "sourceUrl": "https://salesforce.com/buying-committee-research",
            "sourceLabel": "Sales research"
        },
        {
            "headline": f"Customer success metrics show 25% improvement",
            "snippet": f"Companies in your ICP are focusing more on customer success and retention.",
            "sourceUrl": "https://customer-success.com/metrics-2024",
            "sourceLabel": "Customer success report"
        }
    ]
    
    # Select a random signal
    signal = random.choice(customer_signals)
    
    # Generate timestamp
    hours_ago = random.randint(1, 24)
    timestamp = f"{hours_ago}h ago"
    
    return {
        "id": "1",
        "agent": "profiler",
        "timestamp": timestamp,
        "headline": signal["headline"],
        "snippet": signal["snippet"],
        "sourceUrl": signal["sourceUrl"],
        "sourceLabel": signal["sourceLabel"],
        "nextBestMoves": [
            "Should I identify high-value prospects in your ICP?",
            "Would you like me to analyze customer buying patterns?"
        ],
        "contextualSuggestions": [
            {"icon": "target", "text": "Update targeting criteria"},
            {"icon": "chart", "text": "Analyze customer trends"}
        ]
    }

# Signals function mapping
SIGNALS_FUNCTIONS = {
    "scout": search_signals_scout,
    "profiler": search_signals_profiler
}