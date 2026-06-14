"""LLM-side artifacts (chat models, transformers, memory, chains, ReAct
agent). `build_llm_config()` constructs an `LLMBundle` holding all
components; invoked once per process by `app.main.lifespan`. Services receive
bundle fields via FastAPI dependency injection — no module-level state.
"""
from dataclasses import dataclass
from typing import Any, Optional

from langchain_openai import ChatOpenAI
from langchain_experimental.graph_transformers import LLMGraphTransformer
from langchain_neo4j import GraphCypherQAChain
from langchain_classic.memory import ConversationBufferMemory
from langchain_classic.agents import initialize_agent, Tool
from langchain_classic.agents.agent_types import AgentType
from langchain_community.tools.tavily_search.tool import TavilySearchResults
from app.core.config import together_api_key, tavily_api_key
from app.core.clients import ClientBundle


@dataclass
class LLMBundle:
    llm2: Any                                     # ChatOpenAI (Together — Qwen3-235B)
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
    for line (Together Qwen3-235B with the `-tput` model suffix — the single
    chat model, also driving the graph transformer; GraphCypherQAChain with
    `verbose=True`, agent with
    `verbose=False`, `handle_parsing_errors=True`, `max_iterations=20`,
    `max_execution_time=120`, Tavily `k=10`).

    Cypher and QA `PromptTemplate`s are sourced from the prompt registry
    via `prompts.as_langchain(...)`. The registry must be initialized
    (`init_registry()`) before this function is called — wired in
    `app.main.lifespan` (init_registry on line 43, build_llm_config on 44).
    """
    llm2 = ChatOpenAI(
        openai_api_base="https://api.together.xyz/v1",
        openai_api_key=together_api_key,
        model="Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
    )
    # Register simple-invoke models in the LLM factory (spec §3.5).
    from app.services._llm_helpers import register_llm
    register_llm("Qwen/Qwen3-235B-A22B-Instruct-2507-tput", lambda: llm2)
    # Graph extraction runs on Qwen via Together (function/tool-calling — validated
    # live). Previously ChatGroq llama-3.3; Groq has been retired from the stack.
    llm_transformer = LLMGraphTransformer(llm=llm2)
    memory = ConversationBufferMemory(return_messages=True)

    from app.core import prompts as _prompts

    chain = None
    chain2 = None
    if clients_bundle.graph is not None:
        cypher_prompt = _prompts.as_langchain("cypher_gen")
        cypher_prompt_alt = _prompts.as_langchain("cypher_gen_alt")
        qa_prompt = _prompts.as_langchain("qa_scout")
        qa_prompt_alt = _prompts.as_langchain("qa_scout_alt")

        chain = GraphCypherQAChain.from_llm(
            llm=llm2, graph=clients_bundle.graph,
            cypher_prompt=cypher_prompt, qa_prompt=qa_prompt,
            verbose=True, memory=memory, allow_dangerous_requests=True,
        )
        chain2 = GraphCypherQAChain.from_llm(
            llm=llm2, graph=clients_bundle.graph,
            cypher_prompt=cypher_prompt_alt, qa_prompt=qa_prompt_alt,
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
        llm2=llm2,
        llm_transformer=llm_transformer, memory=memory,
        chain=chain, chain2=chain2, agent_chain=agent_chain,
    )
