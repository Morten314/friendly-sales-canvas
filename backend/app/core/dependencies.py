"""FastAPI dependency providers for clients and LLMs.

Providers read from `request.app.state` rather than module globals so they
work in both request and background-task contexts. Wired in `app.main.lifespan`.
"""
from fastapi import Request


# ── Client providers ────────────────────────────────────────────────────
def get_neo4j_driver(request: Request):
    return request.app.state.clients.driver


def get_neo4j_graph(request: Request):
    return request.app.state.clients.graph


def get_mongo(request: Request):
    return request.app.state.clients.client


def get_s3(request: Request):
    return request.app.state.clients.s3_client


def get_pinecone(request: Request):
    return request.app.state.clients.pc


# ── LLM providers ───────────────────────────────────────────────────────
# Single chat model (Together-served Qwen3-235B). Groq/llama-3.3 has been
# retired, so there is no second raw chat model — graph extraction, the Apollo
# rerank, and prospect scoring all use this one.
def get_llm2(request: Request):
    return request.app.state.llm.llm2


def get_llm_transformer(request: Request):
    return request.app.state.llm.llm_transformer


def get_agent_chain(request: Request):
    return request.app.state.llm.agent_chain


def get_chain(request: Request):
    return request.app.state.llm.chain


def get_chain2(request: Request):
    return request.app.state.llm.chain2
