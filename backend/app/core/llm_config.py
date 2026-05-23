"""LLM-side artifacts (chat models, transformers, memory, chains, ReAct
agent). `build_llm_config()` constructs an `LLMBundle` holding all
components; invoked once per process by `app.main.lifespan`. Services receive
bundle fields via FastAPI dependency injection — no module-level state.
"""
from dataclasses import dataclass
from typing import Any, Optional

from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_experimental.graph_transformers import LLMGraphTransformer
from langchain_core.prompts import PromptTemplate
from langchain_neo4j import GraphCypherQAChain
from langchain_classic.memory import ConversationBufferMemory
from langchain_classic.agents import initialize_agent, Tool
from langchain_classic.agents.agent_types import AgentType
from langchain_community.tools.tavily_search.tool import TavilySearchResults
from app.core.config import groq_api_key, together_api_key, tavily_api_key
from app.core.clients import ClientBundle

# Prompt Template for Cypher Query Generation
Cypher_gen_prompt = """
You are a Neo4j Cypher expert. Your task is to return a single clean, executable Cypher query — with no markdown, no commentary, no prefixes or suffixes, and no text outside the Cypher code.

You are querying a CRM-style knowledge graph with the following schema:

───────────────────────────────────────────────
🧠 NODE TYPES & PROPERTIES
───────────────────────────────────────────────

Contact:
  - first_name: string
  - last_name: string
  - designation: string
  - email: string (unique)
  - mobile: string
  - linkedin: string
  - last_activity: datetime

Company:
  - name: string (unique)
  - industry: string
  - location: string
  - region: string
  - main_url: string
  - linkedin: string
  - size: string
  - last_funding_amount: float
  - last_funding_date: string
  - total_funding_amount: float

Lead:
  - id: string (unique)
  - stage: string
  - score: int
  - last_stage_update_date: datetime

Activity:
  - timestamp: datetime (unique)
  - type: string
  - content: string
  - note: string
  - people: list of strings

Tech:
  - name: string (unique)

ICP:
  - id: string (unique)

Campaign:
  - id: string (unique)

GTM_Strategy:
  - id: string (unique)

───────────────────────────────────────────────
🔗 RELATIONSHIPS
───────────────────────────────────────────────

(Company)-[:Has_Contact]->(Contact)
(Contact)-[:Represents]->(Company)
(Company)-[:Has_Lead]->(Lead)
(Contact)-[:Is_POC_For]->(Lead)
(Lead)-[:Has_Activity]->(Activity)
(Company)-[:Uses_Tech]->(Tech)
(Lead)-[:ICPs_Tagged_with]->(ICP)
(Lead)-[:Campaigns_Tagged_With]->(Campaign)
(Lead)-[:GTM_Strategies_Tagged_With]->(GTM_Strategy)

───────────────────────────────────────────────
📌 QUERY RULES
───────────────────────────────────────────────

- Return only one Cypher query.
- Do not include any markdown formatting.
- Do not explain or describe the query.
- Do not return more than one Cypher statement unless specifically required by the question.
- Prefer MATCH and WHERE clauses; avoid CALL blocks unless absolutely necessary.
- Make the query syntactically valid and ready to execute in Neo4j.
- Use reasonable assumptions if details are missing (e.g., lead stage progression order).

the prompt might have extra stuff called as original_json and modified_json , they represent the context wherein the original_json is psection of a market research and the modified_json is the edits the user made on top of those , also understand them to answer any thing.
if you are not asked for any particular thing regarding the leads , just fetch all the infomration all nodes and parameters and values and pass as context , dont make complex cypher queries

Schema : {schema}

Question: {question}
"""

Cypher_Prompt = PromptTemplate(input_variables=["question","schema"], template=Cypher_gen_prompt)

qa_prompt_template = """
You are Scout — a smart, strategic Sales Helper Agent designed to guide users in working effectively with leads and understanding the sales landscape.

You analyze prospect data, engagement history across a timeline, objections raised, blockers, wins, sentiment trends, and all other available context to derive intelligent guidance. You help users understand the behavior, stage, and signals of the lead and how it aligns with broader market patterns.

Your role is to:
- Identify what's working, what's not, and why
- Highlight missed signals or opportunities
- Recommend the next best actions to take with the lead
- Ask insightful follow-up questions to refine your advice
- Be interactive, conversational, and proactive in tone

You are especially skilled at:
- Surfacing red flags or friction points in long timelines
- Spotting high intent or buy-ready signals
- Suggesting tone, channel, and timing strategies
- Offering industry-level insights based on behavior patterns

Always present your answers in a **beautiful, point-wise, well-organized** format.

also give your response in a json , clean valid json with response_message key and your tmessage response as its value and also if any changes need be made on the original and modified json , make those and also put that in a key called as response_json
Give me the response as valid JSON in a single line. Do not use markdown or code blocks. Do not escape characters unnecessarily. Just give plain minified JSON.
Give me the response as valid JSON in a single line. Do not use markdown or code blocks. Do not escape characters unnecessarily. Just give plain minified JSON.
Give me the response as valid JSON in a single line. Do not use markdown or code blocks. Do not escape characters unnecessarily. Just give plain minified JSON.
Give me the response as valid JSON in a single line. Do not use markdown or code blocks. Do not escape characters unnecessarily. Just give plain minified JSON.
Give me the response as valid JSON in a single line. Do not use markdown or code blocks. Do not escape characters unnecessarily. Just give plain minified JSON.
Context:
{context}

Question:
{question}

Illuminating Answer:
"""
qa_prompt = PromptTemplate(
    template=qa_prompt_template,
    input_variables=["context", "question"]
)

Cypher_gen_prompt2 = """
You are a Neo4j Cypher expert. Your task is to return a single clean, executable Cypher query — with no markdown, no commentary, no prefixes or suffixes, and no text outside the Cypher code.

You are querying a CRM-style knowledge graph with the following schema:

───────────────────────────────────────────────
🧠 NODE TYPES & PROPERTIES
───────────────────────────────────────────────

Contact:
  - first_name: string
  - last_name: string
  - designation: string
  - email: string (unique)
  - mobile: string
  - linkedin: string
  - last_activity: datetime

Company:
  - name: string (unique)
  - industry: string
  - location: string
  - region: string
  - main_url: string
  - linkedin: string
  - size: string
  - last_funding_amount: float
  - last_funding_date: string
  - total_funding_amount: float

Lead:
  - id: string (unique)
  - stage: string
  - score: int
  - last_stage_update_date: datetime

Activity:
  - timestamp: datetime (unique)
  - type: string
  - content: string
  - note: string
  - people: list of strings

Tech:
  - name: string (unique)

ICP:
  - id: string (unique)

Campaign:
  - id: string (unique)

GTM_Strategy:
  - id: string (unique)

───────────────────────────────────────────────
🔗 RELATIONSHIPS
───────────────────────────────────────────────

(Company)-[:Has_Contact]->(Contact)
(Contact)-[:Represents]->(Company)
(Company)-[:Has_Lead]->(Lead)
(Contact)-[:Is_POC_For]->(Lead)
(Lead)-[:Has_Activity]->(Activity)
(Company)-[:Uses_Tech]->(Tech)
(Lead)-[:ICPs_Tagged_with]->(ICP)
(Lead)-[:Campaigns_Tagged_With]->(Campaign)
(Lead)-[:GTM_Strategies_Tagged_With]->(GTM_Strategy)

───────────────────────────────────────────────
📌 QUERY RULES
───────────────────────────────────────────────

- Return only one Cypher query.
- Do not include any markdown formatting.
- Do not explain or describe the query.
- Do not return more than one Cypher statement unless specifically required by the question.
- Prefer MATCH and WHERE clauses; avoid CALL blocks unless absolutely necessary.
- Make the query syntactically valid and ready to execute in Neo4j.
- Use reasonable assumptions if details are missing (e.g., lead stage progression order).

Schema: {schema}
Question: {question}
"""

Cypher_Prompt2 = PromptTemplate(input_variables=["question","schema"], template=Cypher_gen_prompt2)

qa_prompt_template2 = """
You are Scout — a smart, strategic Sales Helper Agent designed to guide users in working effectively with leads and understanding the sales landscape.

You analyze prospect data, engagement history across a timeline, objections raised, blockers, wins, sentiment trends, and all other available context to derive intelligent guidance. You help users understand the behavior, stage, and signals of the lead and how it aligns with broader market patterns.

Your role is to:
- Identify what's working, what's not, and why
- Highlight missed signals or opportunities
- Recommend the next best actions to take with the lead
- Ask insightful follow-up questions to refine your advice
- Be interactive, conversational, and proactive in tone

You are especially skilled at:
- Surfacing red flags or friction points in long timelines
- Spotting high intent or buy-ready signals
- Suggesting tone, channel, and timing strategies
- Offering industry-level insights based on behavior patterns

Always present your answers in a **beautiful, point-wise, well-organized** format.

Context:
{context}

Question:
{question}

Illuminating Answer:
"""
qa_prompt2 = PromptTemplate(
    template=qa_prompt_template2,
    input_variables=["context", "question"]
)

@dataclass
class LLMBundle:
    llm: Any                                      # ChatGroq
    llm2: Any                                     # ChatOpenAI (Together)
    llm_transformer: Any                          # LLMGraphTransformer
    memory: Any                                   # ConversationBufferMemory
    chain: Optional[Any]                          # GraphCypherQAChain — None when clients.graph is None
    chain2: Optional[Any]                         # GraphCypherQAChain — None when clients.graph is None
    agent_chain: Any                              # LangChain AgentExecutor


def build_llm_config(clients_bundle: ClientBundle) -> LLMBundle:
    """Construct all LLM-side artifacts. Requires a ClientBundle because
    `chain`/`chain2` need `clients.graph` to be either real or None — exactly
    matching today's conditional construction.

    Initialization arguments match the legacy module-level construction line
    for line (Groq llama-3.3, Together Qwen3-235B with the `-tput` model
    suffix, GraphCypherQAChain with `verbose=True`, agent with
    `verbose=False`, `handle_parsing_errors=True`, `max_iterations=20`,
    `max_execution_time=120`, Tavily `k=10`).
    """
    llm = ChatGroq(model="llama-3.3-70b-versatile", api_key=groq_api_key)
    llm2 = ChatOpenAI(
        openai_api_base="https://api.together.xyz/v1",
        openai_api_key=together_api_key,
        model="Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
    )
    llm_transformer = LLMGraphTransformer(llm=llm)
    memory = ConversationBufferMemory(return_messages=True)

    chain = None
    chain2 = None
    if clients_bundle.graph is not None:
        chain = GraphCypherQAChain.from_llm(
            llm=llm2, graph=clients_bundle.graph,
            cypher_prompt=Cypher_Prompt, qa_prompt=qa_prompt,
            verbose=True, memory=memory, allow_dangerous_requests=True,
        )
        chain2 = GraphCypherQAChain.from_llm(
            llm=llm2, graph=clients_bundle.graph,
            cypher_prompt=Cypher_Prompt2, qa_prompt=qa_prompt2,
            verbose=True, memory=memory, allow_dangerous_requests=True,
        )

    search_tool = TavilySearchResults(
        k=10,
        tavily_api_key=tavily_api_key,
    )
    tools = [
        Tool(
            name="WebSearch",
            func=search_tool.run,
            description="Use this to gather up-to-date market data, TAM, competition, rankings, submarkets, industry trends, growth rates, market segments, regulatory information, and strategic insights. Perform multiple searches to cross-reference data from different sources for accuracy. Focus on recent data (2026-2027) when available.",
        ),
    ]
    agent_chain = initialize_agent(
        tools=tools,
        llm=llm2,
        agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
        verbose=False,
        handle_parsing_errors=True,
        max_iterations=20,
        max_execution_time=120,
    )

    return LLMBundle(
        llm=llm, llm2=llm2,
        llm_transformer=llm_transformer, memory=memory,
        chain=chain, chain2=chain2, agent_chain=agent_chain,
    )
