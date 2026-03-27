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
def Research_Market_1(pre_data) -> dict:
    # Convert company profile to JSON string (handle both dict and string inputs)
    if isinstance(pre_data, dict):
        company_profile_json = json.dumps(pre_data, indent=2)
    elif isinstance(pre_data, str):
        # If it's already a string, try to parse and reformat for better readability
        try:
            parsed = json.loads(pre_data)
            company_profile_json = json.dumps(parsed, indent=2)
        except:
            company_profile_json = pre_data
    else:
        company_profile_json = str(pre_data)
    
    # Construct prompt with full company profile and WebSearch instructions
    template = """Task: Research and compile an updated overview of market, including size, segment breakdown, growth projections, strategic recommendations, and market drivers.

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below. Extract all relevant information about the company's industry, target markets, regions, company size, strategic goals, and any other relevant attributes. Use this information to guide your research.

Company Profile Data:
{company_profile_json}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool to find real, up-to-date market data. Based on the company profile above, identify the industry and target markets/regions, then perform comprehensive research:

1. Market Size Research:
   - Search for market size (TAM/SAM) for the company's industry in their target markets/regions
   - Include recent data (2026-2027) when available
   - Example searches: "[industry] market size TAM SAM [regions] 2026 2027"

2. Growth Rate Research:
   - Search for growth rates in the company's primary target market/region
   - Find market growth projections for their target regions
   - Example searches: "[industry] growth rate [primary region] 2026 2027"

3. Market Segmentation:
   - Search for market segment breakdowns (Enterprise, Mid-Market, SMB)
   - Find market size distribution by segment
   - Example searches: "[industry] market segments Enterprise Mid-Market SMB breakdown"

4. Market Entry & Strategy:
   - Search for market entry strategies relevant to the company's target markets
   - Find market drivers and trends in their target regions
   - Example searches: "[industry] market entry strategy [regions]"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 5-7 WebSearch queries to ensure comprehensive coverage
- Cross-reference data from multiple sources for accuracy
- Focus on recent data (2026-2027) when available
- Provide specific metrics with sources where possible
- Extract industry and target markets/regions from the company profile - do NOT assume or hardcode regions
- The GrowthRate field should reflect growth rate for the PRIMARY target market/region identified from the company profile
- Market entry strategy should be based on the company's actual target markets/regions from the profile
- Do NOT use hardcoded regions like APAC, North America, etc. - use what's in the company profile

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "executiveSummary": "[1-2 sentence summary of overall market opportunity and trends based on company profile]",
  "tamValue": "[Total Addressable Market size, e.g., '$4.2B']",
  "samValue": "[Serviceable Addressable Market size, e.g., '$2.1B']",
  "GrowthRate": "[Growth rate for primary target market/region from company profile, e.g., '25%']",
  "strategicRecommendations": [
    "[Recommendation #1 based on company profile]",
    "[Recommendation #2 based on company profile]",
    "[Recommendation #3 based on company profile]"
  ],
  "marketEntry": "[Brief description of phased market entry strategy based on company's target markets from profile]",
  "marketDrivers": [
    "[Key driver #1 based on company profile]",
    "[Key driver #2 based on company profile]",
    "[Key driver #3 based on company profile]",
    "[Key driver #4 based on company profile]"
  ],
  "marketSizeBySegment": {{
    "Enterprise": "[e.g., '45%']",
    "Mid-Market": "[e.g., '35%']",
    "SMB": "[e.g., '20%']"
  }},
  "growthProjections": {{
    "2023": "[value or index]",
    "2026": "[value or index]",
    "2027": "[value or index]",
    "2026": "[value or index]"
  }}
}}

⚠️ OUTPUT NOTES:
- Use USD for monetary values in billions (B) or millions (M)
- If numeric growth values aren't available for projections, provide a normalized trend (e.g., index from 1.0 to 2.5)
- Pie chart data under marketSizeBySegment must sum to ~100%
- Keep bullet point recommendations short and actionable
- GrowthRate must be for the PRIMARY target market/region from the company profile, not APAC or any hardcoded region
- Market entry strategy must be based on actual target markets/regions from the company profile
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = template.format(company_profile_json=company_profile_json)

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

def Research_Market_2(pre_data) -> dict:
    # Convert company profile to JSON string (handle both dict and string inputs)
    if isinstance(pre_data, dict):
        company_profile_json = json.dumps(pre_data, indent=2)
    elif isinstance(pre_data, str):
        # If it's already a string, try to parse and reformat for better readability
        try:
            parsed = json.loads(pre_data)
            company_profile_json = json.dumps(parsed, indent=2)
        except:
            company_profile_json = pre_data
    else:
        company_profile_json = str(pre_data)
    
    # Construct prompt with full company profile and WebSearch instructions
    template = """Task: Research and compile an updated overview of industry trends, including technology adoption, regulatory changes, regional hotspots, and strategic recommendations.

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below. Extract all relevant information about the company's industry, target markets, regions, and any other relevant attributes. Use this information to guide your research.

Company Profile Data:
{company_profile_json}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool to find real, up-to-date industry trend data. Based on the company profile above, identify the industry and target markets/regions, then perform comprehensive research:

1. Technology Adoption Research:
   - Search for AI adoption rates, cloud migration percentages, and technology trends in the company's industry
   - Include recent data (2026-2027) when available
   - Example searches: "[industry] AI adoption rate 2026 2027"
   - Example searches: "[industry] cloud migration percentage [regions]"

2. Regulatory Changes Research:
   - Search for recent regulatory changes and compliance updates in the company's industry and target regions
   - Find number of regulatory changes and their impact
   - Example searches: "[industry] regulatory changes [regions] 2026 2027"

3. Regional Hotspots Research:
   - Search for regional market hotspots and growth areas in the company's target markets/regions
   - Find percentage values for different regions based on the company profile
   - Example searches: "[industry] market growth [regions] 2026 2027"
   - Extract regions from company profile - do NOT use hardcoded regions like APAC, Europe, North America

4. Industry Trends Research:
   - Search for current industry trends, adoption patterns, and performance metrics
   - Find technology budget allocation trends
   - Example searches: "[industry] trends 2026 2027"
   - Example searches: "[industry] technology budget allocation"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 5-7 WebSearch queries to ensure comprehensive coverage
- Cross-reference data from multiple sources for accuracy
- Focus on recent data (2026-2027) when available
- Provide specific metrics with sources where possible
- Extract target markets/regions from the company profile - do NOT assume or hardcode regions
- The regionalHotspots object should contain regions from the company profile, not hardcoded APAC/Europe/North America
- If company profile has 2 regions, include 2 in regionalHotspots; if 5 regions, include 5
- Do NOT use hardcoded regions - use what's in the company profile

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "executiveSummary": "[1-2 sentence summary of overall industry trends and opportunities based on company profile]",
  "aiAdoption": "[AI adoption percentage, e.g., '78%']",
  "cloudMigration": "[Cloud migration percentage, e.g., '45%']",
  "regulatory": "[Number of regulatory changes, e.g., '12']",
  "trendSnapshots": [
    {{
      "title": "[Trend title based on company profile]",
      "metric": "[Metric value]",
      "type": "[adoption|growth|performance]"
    }},
    {{
      "title": "[Trend title based on company profile]",
      "metric": "[Metric value]",
      "type": "[adoption|growth|performance]"
    }},
    {{
      "title": "[Trend title based on company profile]",
      "metric": "[Metric value]",
      "type": "[adoption|growth|performance]"
    }}
  ],
  "regionalHotspots": {{
    "[Region 1 from company profile]": "[Percentage value]",
    "[Region 2 from company profile]": "[Percentage value]",
    "[Region 3 from company profile if exists]": "[Percentage value]"
  }},
  "recommendations": {{
    "primaryFocus": "[Primary focus recommendation based on company profile]",
    "marketEntry": "[Market entry strategy recommendation based on company profile]"
  }},
  "risks": [
    "[Risk #1 based on company profile]",
    "[Risk #2 based on company profile]",
    "[Risk #3 based on company profile]"
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

⚠️ OUTPUT NOTES:
- Use USD for monetary values in billions (B) or millions (M)
- regionalHotspots must use regions from the company profile, not hardcoded APAC/Europe/North America
- Include 2-5 regions in regionalHotspots based on what's in the company profile
- Keep bullet point recommendations short and actionable
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = template.format(company_profile_json=company_profile_json)

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

def Research_Market_3(pre_data) -> dict:
    # Convert company profile to JSON string (handle both dict and string inputs)
    if isinstance(pre_data, dict):
        company_profile_json = json.dumps(pre_data, indent=2)
    elif isinstance(pre_data, str):
        # If it's already a string, try to parse and reformat for better readability
        try:
            parsed = json.loads(pre_data)
            company_profile_json = json.dumps(parsed, indent=2)
        except:
            company_profile_json = pre_data
    else:
        company_profile_json = str(pre_data)
    
    # Construct prompt with full company profile and WebSearch instructions
    template = """Task: Research and compile a comprehensive competitive landscape analysis, including competitor identification, market share data, SWOT analysis, recent news, feature comparisons, and market trends.

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below. Extract all relevant information about the company's industry, target markets, regions, and any other relevant attributes. Use this information to guide your competitive research.

Company Profile Data:
{company_profile_json}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool extensively to find real, up-to-date competitive data. Based on the company profile above, identify the industry and target markets/regions, then perform comprehensive research:

1. Competitor Identification Research:
   - Search for real competitors operating in the company's industry and target markets/regions
   - Find actual competitor names, not generic examples
   - Example searches: "[industry] competitors [regions] 2026"
   - Example searches: "[industry] top companies [regions]"

2. Market Share Research:
   - Search for market share data by region for the company's target markets
   - Find competitor market share percentages from industry reports
   - Example searches: "[industry] market share [region] 2026"
   - Example searches: "[industry] competitor market share [regions]"
   - Extract regions from company profile for marketShareCharts - do NOT use hardcoded regions

3. Competitor News & Events Research:
   - Search for recent news, product launches, and events from competitors
   - Find M&A activity and strategic moves
   - Example searches: "[competitor name] news 2026 2027"
   - Example searches: "[industry] M&A activity [regions] 2026"

4. SWOT Analysis Research:
   - Search for competitor strengths, weaknesses, opportunities, and threats from industry reports
   - Find competitive positioning data and market opportunities
   - Find competitive threats and risks
   - Example searches: "[competitor name] SWOT analysis"
   - Example searches: "[industry] competitive analysis [regions]"
   - Example searches: "[competitor name] opportunities threats [regions]"

5. Feature Comparison Research:
   - Search for product/feature comparisons in the industry
   - Find competitive feature matrices
   - Example searches: "[industry] product comparison [regions]"
   - Example searches: "[industry] feature comparison tools"

6. Market Trends Research:
   - Search for current market trends and competitive dynamics
   - Find industry trend reports
   - Example searches: "[industry] market trends 2026 2027"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 7-10 WebSearch queries to ensure comprehensive coverage
- Cross-reference data from multiple sources for accuracy
- Focus on recent data (2026-2027) when available
- Provide specific metrics, competitor names, and sources where possible
- Extract target markets/regions from the company profile - do NOT assume or hardcode regions
- The marketShareCharts regions array should use regions from the company profile
- Competitor names must be REAL companies, not generic examples
- News headlines must be REAL recent news with sources
- Do NOT use hardcoded regions - use what's in the company profile

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "uiComponents": [
    {{
      "type": "section",
      "title": "[Section title based on company profile]",
      "description": "[Section description based on company profile]",
      "metrics": [
        {{ "label": "[Metric label]", "value": "[Metric value]", "trend": "[up|down|stable]" }},
        {{ "label": "[Metric label]", "value": "[Metric value]", "trend": "[up|down|stable]" }}
      ],
      "tags": ["[Real Competitor name]", "[Real Competitor name]", "[Real Competitor name]"]
    }},
    {{
      "type": "report",
      "title": "[Report title based on company profile]",
      "executiveSummary": "[Executive summary of competitive landscape based on company profile]",
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
          "name": "[Real Competitor name]",
          "strengths": ["[Strength]", "[Strength]"],
          "weaknesses": ["[Weakness]", "[Weakness]"],
          "opportunities": ["[Opportunity]", "[Opportunity]"],
          "threats": ["[Threat]", "[Threat]"]
        }},
        {{
          "name": "[Real Competitor name]",
          "strengths": ["[Strength]", "[Strength]"],
          "weaknesses": ["[Weakness]", "[Weakness]"],
          "opportunities": ["[Opportunity]", "[Opportunity]"],
          "threats": ["[Threat]", "[Threat]"]
        }}
      ]
    }},
    {{
      "type": "news",
      "headlines": [
        "[Real News headline #1 with source]",
        "[Real News headline #2 with source]",
        "[Real News headline #3 with source]"
      ]
    }},
    {{
      "type": "marketShareCharts",
      "regions": [
        {{
          "name": "[Region from company profile]",
          "data": {{
            "[Real Competitor]": "[Market share percentage]",
            "[Real Competitor]": "[Market share percentage]",
            "[Real Competitor]": "[Market share percentage]",
            "Others": "[Market share percentage]"
          }}
        }},
        {{
          "name": "[Region from company profile]",
          "data": {{
            "[Real Competitor]": "[Market share percentage]",
            "[Real Competitor]": "[Market share percentage]",
            "[Real Competitor]": "[Market share percentage]",
            "Others": "[Market share percentage]"
          }}
        }}
      ]
    }},
    {{
      "type": "featureComparison",
      "features": ["[Feature]", "[Feature]", "[Feature]", "[Feature]"],
      "tools": {{
        "[Real Tool/Competitor name]": ["[Comparison value]", "[Comparison value]", "[Comparison value]", "[Comparison value]"],
        "[Real Tool/Competitor name]": ["[Comparison value]", "[Comparison value]", "[Comparison value]", "[Comparison value]"],
        "[Real Tool/Competitor name]": ["[Comparison value]", "[Comparison value]", "[Comparison value]", "[Comparison value]"],
        "[Real Tool/Competitor name]": ["[Comparison value]", "[Comparison value]", "[Comparison value]", "[Comparison value]"]
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

⚠️ OUTPUT NOTES:
- Use USD for monetary values in billions (B) or millions (M)
- Competitor names must be REAL companies, not generic examples
- News headlines must be REAL recent news (within 6 months) with sources
- Market share percentages must have sources
- marketShareCharts regions must use regions from the company profile, not hardcoded regions
- Include 2-5 regions in marketShareCharts based on what's in the company profile
- Keep bullet point recommendations short and actionable
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = template.format(company_profile_json=company_profile_json)

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

def Research_Market_4(pre_data) -> dict:
    # Convert company profile to JSON string (handle both dict and string inputs)
    if isinstance(pre_data, dict):
        company_profile_json = json.dumps(pre_data, indent=2)
    elif isinstance(pre_data, str):
        # If it's already a string, try to parse and reformat for better readability
        try:
            parsed = json.loads(pre_data)
            company_profile_json = json.dumps(parsed, indent=2)
        except:
            company_profile_json = pre_data
    else:
        company_profile_json = str(pre_data)
    
    # Construct prompt with full company profile and WebSearch instructions
    template = """Task: Research and compile a comprehensive regulatory and compliance analysis, including key regulatory updates, compliance frameworks, regional requirements, and strategic recommendations.

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below. Extract all relevant information about the company's industry, target markets, regions, and any other relevant attributes. Use this information to guide your regulatory research.

Company Profile Data:
{company_profile_json}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool extensively to find real, up-to-date regulatory and compliance data. Based on the company profile above, identify the industry and target markets/regions, then perform comprehensive research:

1. Regulatory Framework Research:
   - Search for region-specific regulatory frameworks for the company's target markets/regions
   - Find industry-specific compliance requirements
   - Example searches: "[region] [industry] regulatory framework 2026 2027"
   - Example searches: "[region] [industry] compliance requirements"

2. Regulatory Updates Research:
   - Search for recent regulatory changes and updates (2026-2027) in the company's industry and target regions
   - Find upcoming mandates and deadlines
   - Example searches: "[industry] regulatory changes [regions] 2026 2027"
   - Example searches: "[industry] upcoming regulations [regions]"

3. Compliance Deadlines Research:
   - Search for specific compliance deadlines and timelines
   - Find mandatory requirements with dates
   - Example searches: "[region] [industry] compliance deadlines 2026 2027"
   - Example searches: "[industry] regulatory deadlines [regions]"

4. Regional Compliance Research:
   - Search for compliance requirements for each target region from the company profile
   - Find region-specific regulatory bodies and frameworks
   - Example searches: "[region] [industry] compliance framework"
   - Extract regions from company profile - do NOT use hardcoded regions

5. Impact Assessment Research:
   - Search for impact assessments of regulatory changes on the industry
   - Find risk levels and compliance priorities
   - Example searches: "[industry] regulatory impact assessment [regions]"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 7-10 WebSearch queries to ensure comprehensive coverage
- Cross-reference data from multiple sources for accuracy
- Focus on recent data (2026-2027) when available
- Provide specific framework names, regulatory body names, and deadline dates
- Extract target markets/regions from the company profile - do NOT assume or hardcode regions
- The regionalData array should use regions from the company profile
- Framework names must be official (e.g., "GDPR", "HIPAA", "SOC 2", not generic)
- Deadlines must be specific dates (YYYY-MM-DD format when possible)
- Do NOT use hardcoded regions - use what's in the company profile

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "executiveSummary": "[1-2 sentence summary of regulatory landscape and compliance requirements based on company profile]",
  "keyUpdates": [
    {{
      "title": "[Real regulatory update title]",
      "description": "[Real update description with date/source]",
      "tag": "[New|Update|Risk|High Priority]",
      "icon": "[icon name]"
    }},
    {{
      "title": "[Real regulatory update title]",
      "description": "[Real update description with date/source]",
      "tag": "[New|Update|Risk|High Priority]",
      "icon": "[icon name]"
    }},
    {{
      "title": "[Real regulatory update title]",
      "description": "[Real update description with date/source]",
      "tag": "[New|Update|Risk|High Priority]",
      "icon": "[icon name]"
    }},
    {{
      "title": "[Real regulatory update title]",
      "description": "[Real update description with date/source]",
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
      "region": "[Region from company profile]",
      "framework": "[Official regulatory framework name]",
      "deadline": "[Specific deadline date or status]",
      "impact": "[High|Medium|Low]",
      "status": "[Active|Evolving|Mandatory]",
      "requirements": "[Key requirements]"
    }},
    {{
      "region": "[Region from company profile]",
      "framework": "[Official regulatory framework name]",
      "deadline": "[Specific deadline date or status]",
      "impact": "[High|Medium|Low]",
      "status": "[Active|Evolving|Mandatory]",
      "requirements": "[Key requirements]"
    }},
    {{
      "region": "[Region from company profile]",
      "framework": "[Official regulatory framework name]",
      "deadline": "[Specific deadline date or status]",
      "impact": "[High|Medium|Low]",
      "status": "[Active|Evolving|Mandatory]",
      "requirements": "[Key requirements]"
    }},
    {{
      "region": "[Region from company profile]",
      "framework": "[Official regulatory framework name]",
      "deadline": "[Specific deadline date or status]",
      "impact": "[High|Medium|Low]",
      "status": "[Active|Evolving|Mandatory]",
      "requirements": "[Key requirements]"
    }}
  ],
  "strategicRecommendations": {{
    "mitigateRegulatoryRisks": [
      "[Recommendation #1 based on company profile]",
      "[Recommendation #2 based on company profile]",
      "[Recommendation #3 based on company profile]",
      "[Recommendation #4 based on company profile]"
    ],
    "competitivePositioning": [
      "[Recommendation #1 based on company profile]",
      "[Recommendation #2 based on company profile]",
      "[Recommendation #3 based on company profile]",
      "[Recommendation #4 based on company profile]"
    ],
    "goToMarketStrategy": [
      "[Recommendation #1 based on company profile]",
      "[Recommendation #2 based on company profile]",
      "[Recommendation #3 based on company profile]",
      "[Recommendation #4 based on company profile]"
    ]
  }}
}}

⚠️ OUTPUT NOTES:
- Use USD for monetary values in billions (B) or millions (M)
- Framework names must be official (e.g., "GDPR", "HIPAA", "SOC 2", "ISO 27001", not generic)
- Deadlines must be specific dates (YYYY-MM-DD format when possible) or clear status
- regionalData must use regions from the company profile, not hardcoded regions
- Include 2-5 regions in regionalData based on what's in the company profile
- Key updates must be REAL regulatory updates with dates/sources, not generic examples
- Keep bullet point recommendations short and actionable
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = template.format(company_profile_json=company_profile_json)

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

def Research_Market_5(pre_data) -> dict:
    # Convert company profile to JSON string (handle both dict and string inputs)
    if isinstance(pre_data, dict):
        company_profile_json = json.dumps(pre_data, indent=2)
    elif isinstance(pre_data, str):
        # If it's already a string, try to parse and reformat for better readability
        try:
            parsed = json.loads(pre_data)
            company_profile_json = json.dumps(parsed, indent=2)
        except:
            company_profile_json = pre_data
    else:
        company_profile_json = str(pre_data)
    
    # Construct prompt with full company profile and WebSearch instructions
    template = """Task: Research and compile a comprehensive market entry and growth strategy analysis, including entry barriers, channel strategies, competitive differentiation, SWOT analysis, and strategic timeline.

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below. Extract all relevant information about the company's industry, target markets, regions, company size, strategic goals, and any other relevant attributes. Use this information to guide your market entry research.

Company Profile Data:
{company_profile_json}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool extensively to find real, up-to-date market entry and growth strategy data. Based on the company profile above, identify the industry and target markets/regions, then perform comprehensive research:

1. Market Entry Barriers Research:
   - Search for market entry barriers and challenges in the company's industry and target regions
   - Find regulatory, competitive, and operational barriers
   - Example searches: "[industry] market entry barriers [regions] 2026"
   - Example searches: "[industry] entry challenges [regions]"

2. Channel Strategy Research:
   - Search for successful channel strategies and go-to-market approaches in the industry
   - Find distribution and sales channel best practices
   - Example searches: "[industry] channel strategy [regions]"
   - Example searches: "[industry] go-to-market strategy [regions]"

3. Competitive Differentiation Research:
   - Search for competitive differentiation strategies in the industry
   - Find unique value propositions and positioning strategies
   - Example searches: "[industry] competitive differentiation [regions]"
   - Example searches: "[industry] value proposition [regions]"

4. Market Entry Timeline Research:
   - Search for market entry timelines and phases from case studies
   - Find typical time-to-market estimates for the industry
   - Example searches: "[industry] market entry timeline [regions]"
   - Example searches: "[industry] time to market [regions]"

5. SWOT Analysis Research:
   - Search for industry SWOT analysis and competitive positioning
   - Find strengths, weaknesses, opportunities, and threats in the market
   - Example searches: "[industry] SWOT analysis [regions]"
   - Example searches: "[industry] market opportunities [regions]"

6. Risk Assessment Research:
   - Search for market entry risks and mitigation strategies
   - Find risk factors specific to the industry and regions
   - Example searches: "[industry] market entry risks [regions]"
   - Example searches: "[industry] risk assessment [regions]"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 7-10 WebSearch queries to ensure comprehensive coverage
- Cross-reference data from multiple sources for accuracy
- Focus on recent data (2026-2027) when available
- Provide specific examples, case studies, and sources where possible
- Extract target markets/regions from the company profile - do NOT assume or hardcode regions
- Entry barriers, channel strategies, and recommendations must be based on the company's actual industry and target markets
- Timeline should be realistic based on industry standards and company profile
- Do NOT use generic examples - use real industry data

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "executiveSummary": "[1-2 sentence summary of market entry opportunity and challenges based on company profile]",
  "entryBarriers": [
    "[Real entry barrier #1 based on company profile]",
    "[Real entry barrier #2 based on company profile]",
    "[Real entry barrier #3 based on company profile]",
    "[Real entry barrier #4 based on company profile]"
  ],
  "recommendedChannel": "[Recommended channel strategy based on company profile]",
  "timeToMarket": "[Time to market estimate based on company profile, e.g., '12-18 months']",
  "topBarrier": "[Top barrier description based on company profile]",
  "competitiveDifferentiation": [
    "[Differentiation factor #1 based on company profile]",
    "[Differentiation factor #2 based on company profile]",
    "[Differentiation factor #3 based on company profile]",
    "[Differentiation factor #4 based on company profile]"
  ],
  "strategicRecommendations": [
    "[Strategic recommendation #1 based on company profile]",
    "[Strategic recommendation #2 based on company profile]",
    "[Strategic recommendation #3 based on company profile]",
    "[Strategic recommendation #4 based on company profile]"
  ],
  "riskAssessment": [
    "[Risk #1 based on company profile]",
    "[Risk #2 based on company profile]",
    "[Risk #3 based on company profile]"
  ],
  "swot": {{
    "strengths": ["[Strength based on company profile]", "[Strength based on company profile]"],
    "weaknesses": ["[Weakness based on company profile]", "[Weakness based on company profile]"],
    "opportunities": ["[Opportunity based on company profile]", "[Opportunity based on company profile]"],
    "threats": ["[Threat based on company profile]", "[Threat based on company profile]"]
  }},
  "timeline": [
    {{
      "label": "[Timeline label]",
      "phase": "[Phase name]",
      "quarter": "[Quarter, e.g., 'Q1 2027']",
      "timestamp": "[ISO timestamp, e.g., '2027-01-01']"
    }},
    {{
      "label": "[Timeline label]",
      "phase": "[Phase name]",
      "quarter": "[Quarter, e.g., 'Q2 2027']",
      "timestamp": "[ISO timestamp, e.g., '2027-04-01']"
    }},
    {{
      "label": "[Timeline label]",
      "phase": "[Phase name]",
      "quarter": "[Quarter, e.g., 'Q3 2027']",
      "timestamp": "[ISO timestamp, e.g., '2027-07-01']"
    }}
  ]
}}

⚠️ OUTPUT NOTES:
- Use USD for monetary values in billions (B) or millions (M)
- Entry barriers must be REAL barriers for the company's industry and target markets
- Channel strategy must be relevant to the company's industry and target markets
- Time to market should be realistic based on industry standards
- SWOT analysis must be specific to the company profile, not generic
- Timeline should be based on realistic market entry phases
- Keep bullet point recommendations short and actionable
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = template.format(company_profile_json=company_profile_json)

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

CRITICAL INSTRUCTIONS:
1. Extract the company's ACTUAL industry, target markets, regions, and business model from the company_profile data provided
2. Use WebSearch to find real ICPs that match the company's ACTUAL industry and target markets
3. DO NOT use the example values below - they are ONLY showing the JSON format/structure
4. All ICPs must be based on the company profile's actual industry, regions, and business context
5. You MUST populate the new schema fields: title, why_suggested, how_it_differs, firmographics, key_decision_makers, pain_points_and_triggers, competitors
6. For backward compatibility, also include these keys for each ICP: regions, confidenceScore, decisionMakers

Company Profile Data:
{pre_data}

STEP 1 - EXTRACT COMPANY DETAILS:
From the company_profile above, extract:
- Company's actual industry and sub-industry
- Actual target markets and regions (use specific countries/cities, not generic regions)
- Company size and business model
- Technology stack and focus areas
- Any other relevant attributes

STEP 2 - RESEARCH ICPs (USE WEB SEARCH):
You MUST use the WebSearch tool to find real ICPs that match the company's actual industry and target markets:
- Search for ICPs in the company's actual industry
- Find ICPs that target the company's actual regions/markets
- Research real customer segments, company sizes, and decision makers relevant to the company's industry
- Research common pain points and buying triggers for each segment (use credible sources)
- Research competitors relevant to selling into that ICP (peer tools/platforms they evaluate)
- Research how each ICP differs from the others (distinct segment + pains + triggers + buyers)
- Example searches: "[company's actual industry] ideal customer profiles [company's actual regions]"
- Example searches: "[company's actual industry] target customer segments [company's actual regions]"
- Example searches: "[industry] [segment] common pain points buying triggers"
- Example searches: "[industry] [segment] buying committee decision makers titles"
- Example searches: "[industry] [segment] alternatives competitors vendor landscape"

STEP 3 - OUTPUT FORMAT:
Return your results in the following JSON format. The examples below show ONLY the structure - you MUST replace ALL values with data based on the company profile:

{{"suggestedICPs": [
    {{
      "id": "[optional. if you include, it must be unique; otherwise omit and API will generate]",
      "title": "[short descriptive title for this ICP, e.g., 'Mid-market logistics operators modernizing dispatch']",
      "is_new": true,
      "is_agentic": true,
      "why_suggested": [
        "[Reason 1 why this ICP aligns with company profile and strategy]",
        "[Reason 2 with market evidence from WebSearch]"
      ],
      "how_it_differs": [
        "[Key differentiator vs other suggested ICPs: different segment, buyer, trigger, or buying motion]",
        "[Another differentiator]"
      ],
      "firmographics": {{
        "industry": "[company's ACTUAL industry from profile]",
        "segment": "[specific segment relevant to company's industry]",
        "company_size": "[realistic company size range for this ICP, e.g., '50–200 employees']",
        "market_size": "[Estimated market size for this segment, e.g., '$45B' or '€12B']"
      }},
      "key_decision_makers": ["[actual decision maker roles/titles]", "[another role]"],
      "decisionMakers": ["[same decision makers for backward compatibility]"],
      "regions": ["[specific target markets/regions from company profile]"],
      "confidenceScore": "[high|medium|low]",
      "pain_points_and_triggers": {{
        "critical": "[Most relevant pain point for this ICP segment]",
        "others": [
          "[Buying trigger 1 based on industry dynamics]",
          "[Buying trigger 2 based on regulatory/technology/market shifts]"
        ]
      }},
      "competitors": ["[Competitor 1]", "[Competitor 2]", "[Competitor 3]"]
    }},
    {{
      "id": "[optional unique id or omit]",
      "title": "[short descriptive title]",
      "is_new": true,
      "is_agentic": true,
      "why_suggested": ["[Reason 1]", "[Reason 2]"],
      "how_it_differs": ["[Differentiator 1]", "[Differentiator 2]"],
      "firmographics": {{
        "industry": "[industry]",
        "segment": "[another specific segment]",
        "company_size": "[different company size range]",
        "market_size": "[Market size]"
      }},
      "key_decision_makers": ["[relevant decision makers]", "[another role]"],
      "decisionMakers": ["[same decision makers for backward compatibility]"],
      "regions": ["[specific target markets/regions from company profile]"],
      "confidenceScore": "[high|medium|low]",
      "pain_points_and_triggers": {{
        "critical": "[Top pain point]",
        "others": ["[Trigger 1]", "[Trigger 2]"]
      }},
      "competitors": ["[Competitor 1]", "[Competitor 2]", "[Competitor 3]"]
    }}
]}}

⚠️ CRITICAL NOTES:
- DO NOT copy the example values (fintech-neobanks, Healthcare SaaS, etc.) - they are FORMAT examples only
- Extract and use the company's ACTUAL industry, regions, and business context from the company_profile
- Use WebSearch to find real ICPs that match the company's actual industry and markets
- All firmographics, decision makers, regions, confidence scoring, pain points, triggers, and competitors must be based on the company profile data + WebSearch
- Use reasoning + WebSearch evidence to populate why_suggested, how_it_differs, firmographics.market_size, pain_points_and_triggers, and competitors
- Return realistic business values (no placeholders, no "TBD", no example text)
- Return at least 2-3 ICPs, all relevant to the company's actual industry and target markets
- Only return JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
    input_variables=["pre_data"],
    template=template
    ).format(pre_data=pre_data)

    def _invoke_generator(pmt: str) -> dict:
        raw_response = agent_chain.invoke({'input': pmt})
        response = raw_response["output"]
        try:
            print("[ICP_generator] Raw LLM output (first 500 chars):", str(response)[:500])
        except Exception:
            pass
        cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        cleaned_str = re.sub(
            r'\"description\": \"(.*?)\"',
            lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"',
            cleaned_str,
            flags=re.DOTALL
        )
        return json.loads(cleaned_str)

    # First attempt
    parsed_json = _invoke_generator(prompt)

    # If empty, retry with stricter requirement
    if not parsed_json.get("suggestedICPs"):
        retry_template = template + "\n\nYou must return at least 3 ICP entries in suggestedICPs. Do not return an empty list."
        retry_prompt = PromptTemplate(
            input_variables=["pre_data"],
            template=retry_template
        ).format(pre_data=pre_data)
        parsed_json = _invoke_generator(retry_prompt)

    # If still empty, fail fast to surface the issue
    if not parsed_json.get("suggestedICPs"):
        raise ValueError("LLM returned empty suggestedICPs after retry.")

    try:
        if isinstance(parsed_json, dict) and "suggestedICPs" in parsed_json:
            print("[ICP_generator] Parsed suggestedICPs count:", len(parsed_json.get("suggestedICPs", [])))
    except Exception:
        pass

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
          {{ "year": 2026, "index": 103 }},
          {{ "year": 2027, "index": 107 }},
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
    # The pre_data contains both company_profile and icp_card (flexible data structure)
    template = """Task: Research and compile a detailed "Buyer Map & Roles, Pain Points, Triggers" analysis based on the provided company profile and ICP data.

IMPORTANT: Use ALL the information provided in the context data below. Extract relevant details about industries, company sizes, buyer roles, regions, and any other relevant ICP information from the data provided.

Company Profile and ICP Data Context:
{pre_data}

Based on the information provided in the context data above, research and identify:
1. Core buyer personas (decision makers) specific to the industries and roles mentioned
2. Key pain points these buyer personas face in the specified industries
3. Buying triggers that would cause these specific ICP segments to purchase

Return your findings in the following exact JSON format:

{{
  "currentData": {{
    "title": "Buyer Map & Roles, Pain Points, Triggers",
    "blurb": "[2-3 sentence summary focusing on the specific buyer roles, pain points, and triggers based on the ICP data provided]",
    "_metadata": {{
      "dataSource": "api"
    }},
    "coreBuyerPersonas": [number of distinct buyer personas],
    "topPainPoint": "[Most critical pain point for the ICP]",
    "buyingTriggersIdentified": [number of triggers],
    "buyingTriggers": [
      {{
        "trigger": "[Specific trigger name]",
        "description": "[Detailed description of why this trigger matters for the ICP]"
      }},
      {{
        "trigger": "[Another specific trigger]",
        "description": "[Detailed description]"
      }}
    ]
  }}
}}

⚠️ Notes:
- Extract and use buyer roles/decision makers from the provided data
- Research pain points specific to the industries mentioned in the data
- Identify buying triggers relevant to the company sizes and regions specified
- Provide at least 5-6 accurate buying triggers
- Use real research data, not generic examples
- Give only JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
        input_variables=["pre_data"],
        template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response with retries
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            raw_response = agent_chain.invoke({'input': prompt})
            response = raw_response["output"]
            
            # Extract JSON from response
            if "Final Answer:" in response:
                response = response.split("Final Answer:")[-1].strip()
            
            # Clean and escape the JSON string
            cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            # Remove any leading/trailing text before first { or after last }
            if "{" in cleaned_str:
                cleaned_str = cleaned_str[cleaned_str.index("{"):]
            if "}" in cleaned_str:
                cleaned_str = cleaned_str[:cleaned_str.rindex("}") + 1]
            
            # Escape newline and other control characters within string values
            cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)
            cleaned_str = re.sub(r'\"blurb\": \"(.*?)\"', lambda m: '"blurb": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

            # Parse to JSON (Python dict)
            parsed_json = json.loads(cleaned_str)
            
            # Validate structure
            if "currentData" not in parsed_json:
                raise ValueError("Missing 'currentData' key in response")
            
            return parsed_json
            
        except json.JSONDecodeError as e:
            if attempt == max_retries:
                raise ValueError(f"Failed to parse JSON after {max_retries} attempts: {str(e)}. Response: {response[:500]}")
            continue
        except Exception as e:
            if attempt == max_retries:
                raise ValueError(f"Error in icp_research_2 after {max_retries} attempts: {str(e)}")
            continue

def icp_research_3(pre_data: str) -> dict:
    # Construct prompt by embedding the entire JSON string
    # The pre_data contains both company_profile and icp_card (flexible data structure)
    template = """Task: Research and compile a detailed "Competitive Overlap & Buying Signals" analysis based on the provided company profile and ICP data.

IMPORTANT: Use ALL the information provided in the context data below. Extract relevant details about industries, company sizes, regions, accounts, competitors, and any other relevant ICP information from the data provided.

Company Profile and ICP Data Context:
{pre_data}

Based on the information provided in the context data above, research and identify:
1. Real competitors operating in the industries and regions mentioned
2. Actual buying signals relevant to these ICP segments (funding rounds, hiring, product launches, regulatory changes)
3. Competitive landscape specific to the industries and company sizes mentioned

Return your findings in the following exact JSON format:

{{
  "currentData": {{
    "title": "Competitive Overlap & Buying Signals",
    "blurb": "[2-3 sentence summary of competitive landscape and buying signals based on the ICP data provided]",
    "_metadata": {{
      "dataSource": "api"
    }},
    "numberOfMainCompetitors": [actual number],
    "recentWinLossChange": "[percentage change, e.g., +11% or -5%]",
    "activeBuyingSignals": [number of signals],
    "competitiveMap": [
      {{
        "competitor": "[Real competitor name]",
        "segment": "[Specific segment they target]",
        "share": "[Market share percentage]",
        "winsLosses": "[Win/loss pattern description]",
        "differentiators": "[Key differentiators]"
      }}
    ],
    "competitiveNewsAndEvents": [
      {{
        "headline": "[Recent news headline]",
        "source": "[Source name]",
        "date": "[YYYY-MM-DD format]"
      }}
    ],
    "buyingSignals": [
      {{
        "signalType": "[Signal type: Funding Round, Hiring, Product Launch, Regulatory, etc.]",
        "description": "[Detailed description relevant to the ICP industries and company sizes]",
        "source": "[Source name]",
        "recency": "[How recent, e.g., '2 weeks ago']"
      }},
      {{
        "signalType": "[Another signal type]",
        "description": "[Detailed description]",
        "source": "[Source name]",
        "recency": "[How recent]"
      }}
    ]
  }}
}}

⚠️ Notes:
- Research REAL competitors in the industries and regions mentioned in the data
- Identify ACTUAL buying signals (funding, hiring, product launches) relevant to the ICP
- Use any accounts_on_watchlist or accounts_to_avoid information if provided in the data
- Provide at least 3-4 buying signals with real data
- Use real research data, not generic examples
- Give only JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
        input_variables=["pre_data"],
        template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response with retries
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            raw_response = agent_chain.invoke({'input': prompt})
            response = raw_response["output"]
            
            # Extract JSON from response
            if "Final Answer:" in response:
                response = response.split("Final Answer:")[-1].strip()
            
            # Clean and escape the JSON string
            cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            # Remove any leading/trailing text before first { or after last }
            if "{" in cleaned_str:
                cleaned_str = cleaned_str[cleaned_str.index("{"):]
            if "}" in cleaned_str:
                cleaned_str = cleaned_str[:cleaned_str.rindex("}") + 1]
            
            # Escape newline and other control characters within string values
            cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)
            cleaned_str = re.sub(r'\"blurb\": \"(.*?)\"', lambda m: '"blurb": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)
            cleaned_str = re.sub(r'\"headline\": \"(.*?)\"', lambda m: '"headline": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

            # Parse to JSON (Python dict)
            parsed_json = json.loads(cleaned_str)
            
            # Validate structure
            if "currentData" not in parsed_json:
                raise ValueError("Missing 'currentData' key in response")
            if "buyingSignals" not in parsed_json.get("currentData", {}):
                raise ValueError("Missing 'buyingSignals' key in currentData")
            
            return parsed_json
            
        except json.JSONDecodeError as e:
            if attempt == max_retries:
                raise ValueError(f"Failed to parse JSON after {max_retries} attempts: {str(e)}. Response: {response[:500]}")
            continue
        except Exception as e:
            if attempt == max_retries:
                raise ValueError(f"Error in icp_research_3 after {max_retries} attempts: {str(e)}")
            continue

def icp_research_4(pre_data: str) -> dict:
    # Construct prompt by embedding the entire JSON string
    # The pre_data contains both company_profile and icp_card (flexible data structure)
    template = """Task: Research and compile a detailed "Regulatory, Compliance & Recommended ICP" analysis based on the provided company profile and ICP data.

IMPORTANT: This is DIFFERENT from the Buyer Map component. This component focuses on:
1. Regulatory and compliance frameworks relevant to the industries and regions mentioned in the data
2. Upcoming mandates and regulatory changes affecting these industries
3. ICP fit score and confidence assessment
4. Specific recommendations for refining the ICP based on regulatory and compliance requirements

Company Profile and ICP Data Context:
{pre_data}

Based on the information provided in the context data above, research regulatory and compliance requirements and provide ICP refinement recommendations.

Return your findings in the following exact JSON format:

{{
  "currentData": {{
    "title": "Regulatory, Compliance & Recommended ICP",
    "blurb": "[2-3 sentence summary of regulatory landscape and ICP refinement recommendations based on the ICP data provided]",
    "_metadata": {{
      "dataSource": "api"
    }},
    "keyComplianceFrameworks": [
      "[Framework name relevant to the industries mentioned]",
      "[Another framework]"
    ],
    "upcomingMandates": "[Specific upcoming mandate with timeline, e.g., 'Q4 2027 GDPR Updates' or '2027 Industry Standard Changes']",
    "icpFitScore": "[Percentage match, e.g., '85% match' or '92% match']",
    "recommendationConfidence": "[High/Medium/Low]",
    "icpRefinementRecommendations": [
      {{
        "title": "[Specific recommendation title]",
        "description": "[Detailed description of how to refine the ICP based on regulatory/compliance insights]"
      }},
      {{
        "title": "[Another specific recommendation]",
        "description": "[Detailed description]"
      }},
      {{
        "title": "[Third recommendation]",
        "description": "[Detailed description]"
      }},
      {{
        "title": "[Fourth recommendation]",
        "description": "[Detailed description]"
      }}
    ]
  }}
}}

⚠️ Notes:
- Research ACTUAL compliance frameworks relevant to the industries mentioned in the data (e.g., GDPR for EU, HIPAA for healthcare, etc.)
- Identify REAL upcoming mandates and regulatory changes for these industries
- Calculate ICP fit score based on how well the ICP data aligns with regulatory requirements
- Provide specific, actionable recommendations for refining the ICP
- Use real research data, not generic examples
- Give only JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
        input_variables=["pre_data"],
        template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response with retries
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            raw_response = agent_chain.invoke({'input': prompt})
            response = raw_response["output"]
            
            # Extract JSON from response
            if "Final Answer:" in response:
                response = response.split("Final Answer:")[-1].strip()
            
            # Clean and escape the JSON string
            cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            # Remove any leading/trailing text before first { or after last }
            if "{" in cleaned_str:
                cleaned_str = cleaned_str[cleaned_str.index("{"):]
            if "}" in cleaned_str:
                cleaned_str = cleaned_str[:cleaned_str.rindex("}") + 1]
            
            # Escape newline and other control characters within string values
            cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)
            cleaned_str = re.sub(r'\"blurb\": \"(.*?)\"', lambda m: '"blurb": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

            # Parse to JSON (Python dict)
            parsed_json = json.loads(cleaned_str)
            
            # Validate structure
            if "currentData" not in parsed_json:
                raise ValueError("Missing 'currentData' key in response")
            if "icpRefinementRecommendations" not in parsed_json.get("currentData", {}):
                raise ValueError("Missing 'icpRefinementRecommendations' key in currentData")
            
            return parsed_json
            
        except json.JSONDecodeError as e:
            if attempt == max_retries:
                raise ValueError(f"Failed to parse JSON after {max_retries} attempts: {str(e)}. Response: {response[:500]}")
            continue
        except Exception as e:
            if attempt == max_retries:
                raise ValueError(f"Error in icp_research_4 after {max_retries} attempts: {str(e)}")
            continue

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

# Helper function to fetch leads for org_id
def fetch_leads_for_org(org_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    """Fetch leads from Neo4j filtered by org_id"""
    try:
        query_string = """
        MATCH (l:Lead)
        WHERE l.org_id = $org_id
        RETURN l
        ORDER BY l.created_at DESC
        LIMIT $limit
        """
        with driver.session() as session:
            results = session.run(query_string, org_id=org_id, limit=limit)
            leads = []
            for record in results:
                lead_node = record["l"]
                lead_dict = dict(lead_node.items())
                # Convert JSON strings back to objects if needed
                processed_lead = {}
                for key, value in lead_dict.items():
                    if isinstance(value, str) and value.strip().startswith(('{', '[')):
                        try:
                            processed_lead[key] = json.loads(value)
                        except json.JSONDecodeError:
                            processed_lead[key] = value
                    else:
                        processed_lead[key] = value
                leads.append(processed_lead)
        return leads
    except Exception as e:
        print(f"Warning: Could not fetch leads: {e}")
        return []

# Signals Research Functions
def search_signals_scout(pre_data) -> dict:
    """Search for market, competitor, and industry trend signals for Scout agent using WebSearch"""
    
    # Extract existing headlines and leads if present
    existing_headlines = []
    leads_data = []
    company_profile_data = pre_data
    
    if isinstance(pre_data, dict):
        existing_headlines = pre_data.get("existing_headlines", [])
        leads_data = pre_data.get("leads_data", [])
        # Remove metadata fields from dict for company profile
        company_profile_data = {k: v for k, v in pre_data.items() if k not in ["existing_headlines", "leads_data", "icp_data"]}
        company_profile_json = json.dumps(company_profile_data, indent=2)
    elif isinstance(pre_data, str):
        # If it's already a string, try to parse and reformat for better readability
        try:
            parsed = json.loads(pre_data)
            existing_headlines = parsed.get("existing_headlines", [])
            leads_data = parsed.get("leads_data", [])
            company_profile_data = {k: v for k, v in parsed.items() if k not in ["existing_headlines", "leads_data", "icp_data"]}
            company_profile_json = json.dumps(company_profile_data, indent=2)
        except:
            company_profile_json = pre_data
    else:
        company_profile_json = str(pre_data)
    
    # Format leads data for prompt - pass all data without field name assumptions
    leads_text = ""
    if leads_data and len(leads_data) > 0:
        print(f"[DEBUG Scout] Processing {len(leads_data)} leads for signal generation")
        # Convert all leads to JSON string - no field name assumptions, pass everything
        try:
            # Limit to 50 leads to avoid prompt size issues, but include all fields
            leads_for_context = leads_data[:50]
            leads_json = json.dumps(leads_for_context, indent=2, default=str)
            
            leads_text = f"""
STEP 1.2 - LEADS DATA (CRITICAL - Use this to prioritize signal relevance):
Your organization has {len(leads_data)} active leads in your pipeline. Below is the complete lead data with all available fields. You MUST analyze this data and use it when generating signals.

Complete Leads Data (showing up to 50 most recent leads):
{leads_json}

CRITICAL INSTRUCTIONS:
- Analyze ALL fields in the leads data above - do not assume any specific field names
- Extract any company names, industries, regions, technologies, or other relevant information from whatever fields exist
- Prioritize signals that relate to companies, industries, regions, or any other attributes found in your leads pipeline
- If a signal mentions a company or organization, check if it matches any entity in your leads data
- Focus on signals that would be relevant to your actual sales pipeline based on the lead data structure
- Use the lead data to understand your target market, customer segments, and sales priorities
- This will make the signals more actionable for your sales team
"""
        except Exception as e:
            print(f"[ERROR] Failed to format leads data: {e}")
            # Fallback: just mention leads exist
            leads_text = f"""
STEP 1.2 - LEADS DATA:
Your organization has {len(leads_data)} active leads in your pipeline. Use this information to prioritize signals relevant to your actual sales pipeline.
"""
    
    # Format existing headlines for prompt
    existing_headlines_text = ""
    if existing_headlines:
        headlines_list = "\n".join([f"- {h}" for h in existing_headlines[:30]])  # Limit to 30 for prompt size
        existing_headlines_text = f"""
STEP 1.5 - EXISTING SIGNALS (CRITICAL - AVOID DUPLICATES):
You MUST avoid generating signals similar to these existing signal headlines. Review them carefully and ensure your new signal is completely different and unique:

Existing Signal Headlines:
{headlines_list}

IMPORTANT: Your new signal headline must be about a DIFFERENT news story, market development, or industry trend. Do NOT generate a signal about the same event, company news, or market development as any of the above headlines, even if worded differently. Search for NEW and UNIQUE signals that haven't been covered yet.
"""
    
    # Construct prompt with full company profile and WebSearch instructions
    template = """Task: Research and identify a high-quality, actionable market signal for a sales scout agent. This signal should help the sales team understand market opportunities, competitor movements, or industry trends that could impact their sales strategy.

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below. Extract all relevant information about the company's industry, target markets, regions, company size, strategic goals, and any other relevant attributes.

Company Profile Data:
{company_profile_json}
{leads_section}
{existing_headlines_section}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool to find a REAL, RECENT, and ACTIONABLE market signal. Based on the company profile above, perform comprehensive research to identify:

1. Market Opportunity Signals:
   - Search for recent market growth, trends, or opportunities in the company's industry
   - Find market size changes, adoption rates, or emerging segments
   - Example searches: "[industry] market trends [regions] 2026"
   - Example searches: "[industry] growth opportunities 2026"

2. Competitor Activity Signals:
   - Search for competitor funding rounds, product launches, or strategic moves
   - Find market share changes or competitive landscape shifts
   - Example searches: "[industry] competitor funding 2026"
   - Example searches: "[industry] competitor product launch 2026"

3. Industry Trend Signals:
   - Search for technology adoption, regulatory changes, or industry shifts
   - Find emerging trends that could impact sales strategy
   - Example searches: "[industry] technology adoption 2026"
   - Example searches: "[industry] regulatory changes 2026"

4. Market Dynamics Signals:
   - Search for buying behavior changes, market disruptions, or new opportunities
   - Find signals that indicate market readiness or buying intent
   - Example searches: "[industry] buying trends [regions] 2026"
   - Example searches: "[industry] market disruption 2026"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 5-7 WebSearch queries to find the BEST signal
- Focus on RECENT signals from 2026 and recent past (within last 1-3 months when possible)
- CURRENT YEAR IS 2026 - Do NOT use future dates like 2027 in signals. Use actual current dates from 2026 or recent past dates.
- The signal must be REAL and ACTIONABLE - not generic
- Extract industry and target markets from the company profile
- Cross-reference multiple sources to verify signal accuracy
- Find 1-2 different source URLs for the signal (preferably from different publications/sources)
- Prioritize signals that are relevant to the company's specific industry and target markets
- Generate 3 thoughtful NBA questions that help users dive deeper into the signal's implications

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "headline": "[Compelling, specific headline about the signal - must be real and recent]",
  "snippet": "[Brief 1-2 sentence summary of the signal]",
  "description": "[One full paragraph (4-6 sentences) providing detailed context about the signal. Explain what the signal means, why it matters for the company's sales strategy, what opportunities or challenges it presents, and how the sales team should respond. Make it descriptive and actionable.]",
  "sourceUrl": "[Real source URL where this signal was found]",
  "sourceLabel": "[Source type: Industry report, News article, Research report, Funding news, etc.]",
  "source": [
    {{
      "citation": "[Publication name - Article title - Date if available, e.g., 'TechCrunch - AI Market Growth Report - January 15, 2026']. Use actual dates from 2026 or recent past, NOT future dates.",
      "url": "[First source URL where this signal was found]"
    }},
    {{
      "citation": "[Publication name - Article title - Date if available, e.g., 'Industry Research Report - Market Trends Analysis - January 2026']",
      "url": "[Second source URL (if available from different source)]"
    }}
  ],
  "nextBestMoves": [
    "[Actionable question/suggestion #1 related to the signal]",
    "[Actionable question/suggestion #2 related to the signal]"
  ],
  "NBAs": [
    {{
      "nba": "[First suggested question the user should ask based on this signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }},
    {{
      "nba": "[Second suggested question the user should ask based on this signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }},
    {{
      "nba": "[Third suggested question the user should ask based on this signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }}
  ],
  "contextualSuggestions": [
    {{"icon": "[icon name]", "text": "[Suggestion text related to signal]"}},
    {{"icon": "[icon name]", "text": "[Suggestion text related to signal]"}}
  ]
}}

⚠️ OUTPUT NOTES:
- headline must be REAL and SPECIFIC - include actual numbers, dates, or company names when available
- snippet should be concise (1-2 sentences)
- description must be ONE FULL PARAGRAPH (4-6 sentences) with detailed context
- sourceUrl must be a REAL, accessible URL
- sourceLabel should accurately describe the source type
- source must be an array with 1-2 objects, each containing "citation" and "url" fields
- citation should include publication name, article title, and date if available (e.g., "TechCrunch - AI Market Growth Report - January 15, 2026")
- IMPORTANT: Use actual dates from 2026 or recent past. Do NOT use future dates like 2027. Current year is 2026.
- url must be a REAL, accessible URL
- If only one source found, include one object in the array; if two sources found, include both
- nextBestMoves should be actionable questions related to the specific signal
- NBAs must contain exactly 3 suggested questions with detailed prompts for LLM queries
- Each NBA prompt should include: signal headline, signal description, company profile context, and the specific question to answer
- contextualSuggestions should be relevant to the signal content
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = template.format(
        company_profile_json=company_profile_json,
        leads_section=leads_text,
        existing_headlines_section=existing_headlines_text
    )
    
    # Get LLM response with WebSearch
    raw_response = agent_chain.invoke({'input': prompt})
    response = raw_response["output"]
    
    # Extract URLs from Tavily search results if available
    tavily_urls = []
    try:
        # Try to extract URLs from agent chain intermediate steps
        if hasattr(raw_response, 'intermediate_steps'):
            for step in raw_response.intermediate_steps:
                if len(step) > 1 and isinstance(step[1], list):
                    for result in step[1]:
                        if isinstance(result, dict) and 'url' in result:
                            tavily_urls.append(result['url'])
        # Also try to extract URLs from response text as fallback
        if not tavily_urls:
            url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
            found_urls = re.findall(url_pattern, response)
            tavily_urls = list(set(found_urls))[:5]  # Limit to 5 unique URLs
    except Exception as e:
        pass
    
    # Extract JSON from response
    if "Final Answer:" in response:
        response = response.split("Final Answer:")[-1].strip()
    
    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Remove any leading/trailing text before first { or after last }
    if "{" in cleaned_str:
        cleaned_str = cleaned_str[cleaned_str.index("{"):]
    if "}" in cleaned_str:
        cleaned_str = cleaned_str[:cleaned_str.rindex("}") + 1]
    
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r').replace('"', '\\"') + '"', cleaned_str, flags=re.DOTALL)
    cleaned_str = re.sub(r'\"snippet\": \"(.*?)\"', lambda m: '"snippet": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r').replace('"', '\\"') + '"', cleaned_str, flags=re.DOTALL)
    cleaned_str = re.sub(r'\"headline\": \"(.*?)\"', lambda m: '"headline": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r').replace('"', '\\"') + '"', cleaned_str, flags=re.DOTALL)
    
    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)
    
    # Validate and fix URLs using Tavily URLs if available
    def validate_url(url, tavily_urls_list):
        """Validate URL and replace with Tavily URL if invalid"""
        if not url or not isinstance(url, str):
            return tavily_urls_list[0] if tavily_urls_list else ""
        
        # Check if URL is valid format
        if not url.startswith(('http://', 'https://')):
            return tavily_urls_list[0] if tavily_urls_list else ""
        
        # If Tavily URLs available, try to match or use first one
        if tavily_urls_list:
            # Check if URL domain matches any Tavily URL
            url_domain = url.split('/')[2] if len(url.split('/')) > 2 else ""
            for tavily_url in tavily_urls_list:
                tavily_domain = tavily_url.split('/')[2] if len(tavily_url.split('/')) > 2 else ""
                if url_domain and url_domain == tavily_domain:
                    return tavily_url
            # If no match, use first Tavily URL
            return tavily_urls_list[0]
        
        return url
    
    # Validate sourceUrl
    source_url = validate_url(parsed_json.get("sourceUrl", ""), tavily_urls)
    
    # Validate source array URLs
    validated_sources = []
    source_array = parsed_json.get("source", [])
    for i, src in enumerate(source_array[:2]):  # Max 2 sources
        if isinstance(src, dict) and "url" in src:
            validated_url = validate_url(src["url"], tavily_urls[i:] if i < len(tavily_urls) else tavily_urls)
            validated_sources.append({
                "citation": src.get("citation", ""),
                "url": validated_url
            })
    
    # If no sources validated, use Tavily URLs directly
    if not validated_sources and tavily_urls:
        for i, tavily_url in enumerate(tavily_urls[:2]):
            validated_sources.append({
                "citation": f"Source {i+1}",
                "url": tavily_url
            })
    
    # Add metadata (ID will be generated in API layer to ensure uniqueness per org_id)
    from datetime import datetime
    hours_ago = 1  # Default, can be made dynamic based on signal recency
    timestamp = f"{hours_ago}h ago"
    
    result = {
        "agent": "scout",
        "timestamp": timestamp,
        "headline": parsed_json.get("headline", ""),
        "snippet": parsed_json.get("snippet", ""),
        "description": parsed_json.get("description", ""),
        "sourceUrl": source_url if source_url else (validated_sources[0]["url"] if validated_sources else ""),
        "sourceLabel": parsed_json.get("sourceLabel", ""),
        "source": validated_sources if validated_sources else parsed_json.get("source", []),
        "nextBestMoves": parsed_json.get("nextBestMoves", []),
        "NBAs": parsed_json.get("NBAs", []),
        "contextualSuggestions": parsed_json.get("contextualSuggestions", [])
    }
    
    return result

def search_signals_profiler(pre_data) -> dict:
    """Search for ICP and customer-related signals for Profiler agent using WebSearch"""
    
    # Extract existing headlines and leads if present
    existing_headlines = []
    leads_data = []
    company_profile = {}
    icp_data = {}
    
    if isinstance(pre_data, dict):
        existing_headlines = pre_data.get("existing_headlines", [])
        leads_data = pre_data.get("leads_data", [])
        if "company_profile" in pre_data:
            company_profile = pre_data["company_profile"]
            icp_data = pre_data.get("icp_data", {})
        else:
            # Remove metadata fields from dict
            company_profile = {k: v for k, v in pre_data.items() if k not in ["existing_headlines", "leads_data", "icp_data"]}
            icp_data = {}
    else:
        try:
            parsed = json.loads(pre_data) if isinstance(pre_data, str) else {}
            existing_headlines = parsed.get("existing_headlines", [])
            leads_data = parsed.get("leads_data", [])
            if "company_profile" in parsed:
                company_profile = parsed["company_profile"]
                icp_data = parsed.get("icp_data", {})
            else:
                company_profile = {k: v for k, v in parsed.items() if k not in ["existing_headlines", "leads_data", "icp_data"]}
                icp_data = parsed.get("icp_data", {})
        except:
            company_profile = {}
            icp_data = {}
    
    # Format leads data for prompt - pass all data without field name assumptions
    leads_text = ""
    if leads_data and len(leads_data) > 0:
        print(f"[DEBUG Profiler] Processing {len(leads_data)} leads for signal generation")
        # Convert all leads to JSON string - no field name assumptions, pass everything
        try:
            # Limit to 50 leads to avoid prompt size issues, but include all fields
            leads_for_context = leads_data[:50]
            leads_json = json.dumps(leads_for_context, indent=2, default=str)
            
            leads_text = f"""
STEP 1.2 - LEADS DATA (CRITICAL - Use this to prioritize ICP signal relevance):
Your organization has {len(leads_data)} active leads in your pipeline. Below is the complete lead data with all available fields. You MUST analyze this data and use it when generating ICP signals.

Complete Leads Data (showing up to 50 most recent leads):
{leads_json}

CRITICAL INSTRUCTIONS:
- Analyze ALL fields in the leads data above - do not assume any specific field names
- Extract any company names, industries, regions, company sizes, technologies, buyer personas, or other relevant ICP information from whatever fields exist
- Prioritize ICP signals that relate to companies, industries, regions, company sizes, or any other attributes found in your leads pipeline
- If a signal mentions a company or organization, check if it matches any entity in your leads data
- Focus on ICP signals that would be relevant to your actual sales/profiling pipeline based on the lead data structure
- Use the lead data to understand your target ICP segments, customer profiles, and sales priorities
- This will make the ICP signals more actionable for your sales/profiling team
"""
        except Exception as e:
            print(f"[ERROR] Failed to format leads data: {e}")
            # Fallback: just mention leads exist
            leads_text = f"""
STEP 1.2 - LEADS DATA:
Your organization has {len(leads_data)} active leads in your pipeline. Use this information to prioritize ICP signals relevant to your actual sales pipeline.
"""
    
    # Convert to JSON string for prompt
    context_data = {
        "company_profile": company_profile,
        "icp_data": icp_data
    }
    context_json = json.dumps(context_data, indent=2)
    
    # Format existing headlines for prompt
    existing_headlines_text = ""
    if existing_headlines:
        headlines_list = "\n".join([f"- {h}" for h in existing_headlines[:30]])  # Limit to 30 for prompt size
        existing_headlines_text = f"""
STEP 1.5 - EXISTING SIGNALS (CRITICAL - AVOID DUPLICATES):
You MUST avoid generating signals similar to these existing signal headlines. Review them carefully and ensure your new signal is completely different and unique:

Existing Signal Headlines:
{headlines_list}

IMPORTANT: Your new signal headline must be about a DIFFERENT news story, market development, or industry trend. Do NOT generate a signal about the same event, company news, or market development as any of the above headlines, even if worded differently. Search for NEW and UNIQUE signals that haven't been covered yet.
"""
    
    # Construct prompt with full company profile/ICP data and WebSearch instructions
    template = """Task: Research and identify a high-quality, actionable ICP/customer signal for a profiler agent. This signal should help the sales team understand customer buying behavior, ICP trends, or customer acquisition opportunities.

STEP 1 - COMPANY PROFILE AND ICP DATA:
Review the complete company profile and ICP data below. Extract all relevant information about the company's industry, target markets, regions, ICP segments, company sizes, buyer personas, and any other relevant attributes.

Company Profile and ICP Data:
{context_json}
{leads_section}
{existing_headlines_section}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool to find a REAL, RECENT, and ACTIONABLE ICP/customer signal. Based on the company profile and ICP data above, perform comprehensive research to identify:

1. ICP Buying Behavior Signals:
   - Search for buying trends, purchase patterns, or buying signals in the company's ICP segments
   - Find customer acquisition trends or buying committee changes
   - Example searches: "[industry] [ICP segment] buying trends 2026"
   - Example searches: "[industry] customer acquisition [ICP segment] 2026"

2. Customer Spending Signals:
   - Search for tech spending, budget allocation, or investment trends in target ICP segments
   - Find customer spending patterns or budget increases
   - Example searches: "[industry] tech spending [company size] 2026"
   - Example searches: "[industry] budget allocation [ICP segment] 2026"

3. ICP Market Dynamics Signals:
   - Search for ICP segment growth, market expansion, or customer behavior changes
   - Find signals about target customer needs or pain points
   - Example searches: "[industry] [ICP segment] market trends 2026"
   - Example searches: "[industry] customer needs [ICP segment] 2026"

4. Customer Success Signals:
   - Search for customer success metrics, retention trends, or customer satisfaction in ICP segments
   - Find signals about customer lifecycle or engagement patterns
   - Example searches: "[industry] customer success [ICP segment] 2026"
   - Example searches: "[industry] customer retention [company size] 2026"

5. Buyer Persona Signals:
   - Search for decision maker trends, buying committee changes, or buyer behavior in target segments
   - Find signals about how target customers make purchasing decisions
   - Example searches: "[industry] buying committee [ICP segment] 2026"
   - Example searches: "[industry] decision maker trends 2026"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 5-7 WebSearch queries to find the BEST signal
- Focus on RECENT signals from 2026 and recent past (within last 1-3 months when possible)
- CURRENT YEAR IS 2026 - Do NOT use future dates like 2027 in signals. Use actual current dates from 2026 or recent past dates.
- The signal must be REAL and ACTIONABLE - not generic
- Extract industry, ICP segments, and target markets from the provided data
- Cross-reference multiple sources to verify signal accuracy
- Find 1-2 different source URLs for the signal (preferably from different publications/sources)
- Prioritize signals that are relevant to the company's specific ICP segments and target customers
- If ICP data is available, use it to make the signal more specific and relevant
- Generate 3 thoughtful NBA questions that help users dive deeper into the signal's implications for their ICP and sales strategy

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "headline": "[Compelling, specific headline about the ICP/customer signal - must be real and recent]",
  "snippet": "[Brief 1-2 sentence summary of the signal]",
  "description": "[One full paragraph (4-6 sentences) providing detailed context about the signal. Explain what the signal means for the company's ICP and target customers, why it matters for customer acquisition and sales strategy, what opportunities or challenges it presents for reaching the target ICP, and how the sales/profiling team should respond. Make it descriptive and actionable.]",
  "sourceUrl": "[Real source URL where this signal was found]",
  "sourceLabel": "[Source type: Market research, Customer research, Sales report, ICP analysis, etc.]",
  "source": [
    {{
      "citation": "[Publication name - Article title - Date if available, e.g., 'Market Research Report - Customer Buying Trends - January 15, 2026']. Use actual dates from 2026 or recent past, NOT future dates.",
      "url": "[First source URL where this signal was found]"
    }},
    {{
      "citation": "[Publication name - Article title - Date if available, e.g., 'Sales Report - ICP Analysis - January 2026']",
      "url": "[Second source URL (if available from different source)]"
    }}
  ],
  "nextBestMoves": [
    "[Actionable question/suggestion #1 related to the ICP signal]",
    "[Actionable question/suggestion #2 related to the ICP signal]"
  ],
  "NBAs": [
    {{
      "nba": "[First suggested question the user should ask based on this ICP signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, ICP data, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }},
    {{
      "nba": "[Second suggested question the user should ask based on this ICP signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, ICP data, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }},
    {{
      "nba": "[Third suggested question the user should ask based on this ICP signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, ICP data, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }}
  ],
  "contextualSuggestions": [
    {{"icon": "[icon name]", "text": "[Suggestion text related to ICP signal]"}},
    {{"icon": "[icon name]", "text": "[Suggestion text related to ICP signal]"}}
  ]
}}

⚠️ OUTPUT NOTES:
- headline must be REAL and SPECIFIC - include actual numbers, dates, or ICP segment details when available
- snippet should be concise (1-2 sentences)
- description must be ONE FULL PARAGRAPH (4-6 sentences) with detailed context about ICP/customer implications
- sourceUrl must be a REAL, accessible URL
- sourceLabel should accurately describe the source type
- source must be an array with 1-2 objects, each containing "citation" and "url" fields
- citation should include publication name, article title, and date if available (e.g., "Market Research Report - Customer Buying Trends - January 15, 2026")
- IMPORTANT: Use actual dates from 2026 or recent past. Do NOT use future dates like 2027. Current year is 2026.
- url must be a REAL, accessible URL
- If only one source found, include one object in the array; if two sources found, include both
- nextBestMoves should be actionable questions related to the specific ICP signal
- NBAs must contain exactly 3 suggested questions with detailed prompts for LLM queries
- Each NBA prompt should include: signal headline, signal description, company profile context, ICP data, and the specific question to answer
- contextualSuggestions should be relevant to the ICP signal content
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = template.format(
        context_json=context_json,
        leads_section=leads_text,
        existing_headlines_section=existing_headlines_text
    )
    
    # Get LLM response with WebSearch
    raw_response = agent_chain.invoke({'input': prompt})
    response = raw_response["output"]
    
    # Extract URLs from Tavily search results if available
    tavily_urls = []
    try:
        # Try to extract URLs from agent chain intermediate steps
        if hasattr(raw_response, 'intermediate_steps'):
            for step in raw_response.intermediate_steps:
                if len(step) > 1 and isinstance(step[1], list):
                    for result in step[1]:
                        if isinstance(result, dict) and 'url' in result:
                            tavily_urls.append(result['url'])
        # Also try to extract URLs from response text as fallback
        if not tavily_urls:
            url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
            found_urls = re.findall(url_pattern, response)
            tavily_urls = list(set(found_urls))[:5]  # Limit to 5 unique URLs
    except Exception as e:
        pass
    
    # Extract JSON from response
    if "Final Answer:" in response:
        response = response.split("Final Answer:")[-1].strip()
    
    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Remove any leading/trailing text before first { or after last }
    if "{" in cleaned_str:
        cleaned_str = cleaned_str[cleaned_str.index("{"):]
    if "}" in cleaned_str:
        cleaned_str = cleaned_str[:cleaned_str.rindex("}") + 1]
    
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r').replace('"', '\\"') + '"', cleaned_str, flags=re.DOTALL)
    cleaned_str = re.sub(r'\"snippet\": \"(.*?)\"', lambda m: '"snippet": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r').replace('"', '\\"') + '"', cleaned_str, flags=re.DOTALL)
    cleaned_str = re.sub(r'\"headline\": \"(.*?)\"', lambda m: '"headline": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r').replace('"', '\\"') + '"', cleaned_str, flags=re.DOTALL)
    
    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)
    
    # Validate and fix URLs using Tavily URLs if available
    def validate_url(url, tavily_urls_list):
        """Validate URL and replace with Tavily URL if invalid"""
        if not url or not isinstance(url, str):
            return tavily_urls_list[0] if tavily_urls_list else ""
        
        # Check if URL is valid format
        if not url.startswith(('http://', 'https://')):
            return tavily_urls_list[0] if tavily_urls_list else ""
        
        # If Tavily URLs available, try to match or use first one
        if tavily_urls_list:
            # Check if URL domain matches any Tavily URL
            url_domain = url.split('/')[2] if len(url.split('/')) > 2 else ""
            for tavily_url in tavily_urls_list:
                tavily_domain = tavily_url.split('/')[2] if len(tavily_url.split('/')) > 2 else ""
                if url_domain and url_domain == tavily_domain:
                    return tavily_url
            # If no match, use first Tavily URL
            return tavily_urls_list[0]
        
        return url
    
    # Validate sourceUrl
    source_url = validate_url(parsed_json.get("sourceUrl", ""), tavily_urls)
    
    # Validate source array URLs
    validated_sources = []
    source_array = parsed_json.get("source", [])
    for i, src in enumerate(source_array[:2]):  # Max 2 sources
        if isinstance(src, dict) and "url" in src:
            validated_url = validate_url(src["url"], tavily_urls[i:] if i < len(tavily_urls) else tavily_urls)
            validated_sources.append({
                "citation": src.get("citation", ""),
                "url": validated_url
            })
    
    # If no sources validated, use Tavily URLs directly
    if not validated_sources and tavily_urls:
        for i, tavily_url in enumerate(tavily_urls[:2]):
            validated_sources.append({
                "citation": f"Source {i+1}",
                "url": tavily_url
            })
    
    # Add metadata (ID will be generated in API layer to ensure uniqueness per org_id)
    from datetime import datetime
    hours_ago = 1  # Default, can be made dynamic based on signal recency
    timestamp = f"{hours_ago}h ago"
    
    result = {
        "agent": "profiler",
        "timestamp": timestamp,
        "headline": parsed_json.get("headline", ""),
        "snippet": parsed_json.get("snippet", ""),
        "description": parsed_json.get("description", ""),
        "sourceUrl": source_url if source_url else (validated_sources[0]["url"] if validated_sources else ""),
        "sourceLabel": parsed_json.get("sourceLabel", ""),
        "source": validated_sources if validated_sources else parsed_json.get("source", []),
        "nextBestMoves": parsed_json.get("nextBestMoves", []),
        "NBAs": parsed_json.get("NBAs", []),
        "contextualSuggestions": parsed_json.get("contextualSuggestions", [])
    }
    
    return result

# Signals function mapping
SIGNALS_FUNCTIONS = {
    "scout": search_signals_scout,
    "profiler": search_signals_profiler
}