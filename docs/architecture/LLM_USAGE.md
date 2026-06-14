# LLM Usage Map

Which model backs each feature. Snapshot date: **2026-06-14** (after Groq was
retired and its paths moved to Qwen). Source of truth is
`backend/app/core/llm_config.py` (`build_llm_config`) plus the per-domain service
modules — update this map when the wiring there changes.

## Models in play

| Tag | Model | Provider / transport |
| --- | --- | --- |
| **Claude** | `claude-sonnet-4-6` | Anthropic, direct HTTP `/v1/messages` (`app/services/_llm_helpers.py::_claude_messages_text`; model from `app/core/config.py::claude_sonnet_model`) |
| **Qwen** | `Qwen/Qwen3-235B-A22B-Instruct-2507-tput` | Together.ai, via LangChain `agent_chain` (ReAct + Tavily), `GraphCypherQAChain`, `LLMGraphTransformer`, or direct `.invoke` (`llm2` in `llm_config.py`) |
| **e5** | `intfloat/multilingual-e5-large-instruct` (1024-dim) | Together.ai embeddings via `langchain_openai.OpenAIEmbeddings` (`app/services/_retrieval.py`) — not a chat model |

> **Groq is no longer used anywhere.** `llama-3.3-70b-versatile` was retired
> 2026-06-14; every path it drove moved to Qwen.

## Feature → LLM

| Feature / functionality | Endpoint(s) | LLM in production | Notes |
| --- | --- | --- | --- |
| Market research (5-component report) | `/market-research_claude` | **Claude** | FE calls the `_claude` twin. A `/market-research` Qwen twin exists but the FE does not use it. |
| ICP research (Profiler) | `/icp-research_claude` | **Claude** | `_claude` twin; Qwen twin (`/icp-research`) exists, unused by FE. |
| Signal generation (2 Scout + 2 Profiler batch) | `/generate-signals-batch_claude` | **Claude** | Parallelized via `asyncio.gather`; Qwen twin (`/generate-signals-batch`) exists, unused by FE. |
| Signal Q&A / Scout chat (signal-detail ask) | `/signal_ask_claude` | **Claude** | Qwen twin (`/signal_Ask`) exists, unused by FE. |
| Signals research (single) | `/signals-research` | **Qwen** | `agent_chain` (ReAct + Tavily WebSearch). No FE `_claude` twin. |
| CRM graph chat / Q&A (Cypher gen + answer) | `/ask/`, `/chat/` | **Qwen** | `GraphCypherQAChain` (`chain` / `chain2`). Consumed by ChatWithScout, StrategistWorkspace, AIPromptingInterface (edit-mode `/ask`). `/query/` is raw Cypher — **no LLM**. |
| Document → Neo4j knowledge-graph extraction (doc upload) | `/upload_file/` | **Qwen** | `LLMGraphTransformer` (function/tool-calling — validated live on Together/Qwen). |
| Prospect-list scoring (prospect upload) | `/upload` | **Qwen** | `score_prospect` (0–10), `graph_chat/prospect_pipeline.py`. |
| Lead market scoring | `/leads/market-scores` | **Qwen** | `call_with_prompt` → `prompts/market_scoring/score_lead.md.j2`. |
| Apollo lead discovery re-rank | `/apollo/discover` | **Qwen** | Ranks candidate leads by ICP fit; deterministic fit fallback on LLM/parse failure. |
| Document embeddings + retrieval (data-source context) | doc upload + retrieval (Pinecone) | **e5** | Embeddings only; powers `_fetch_pinecone_supporting_context`. |
| Strategist sequence builder | — (frontend only) | none | No backend LLM; its chat box hits `/chat/` (→ Qwen, above). |

## The Claude vs. Qwen "twin" nuance

The four customer-facing research/signal features — market research, ICP, signal
generation, and signal ask — each ship **two backend variants**: a default that
runs on **Qwen** via `agent_chain`, and a `_claude`-suffixed twin that calls
**Claude** directly. The frontend (`frontend/src/shared/api/transport.ts`
callsites) invokes the **`_claude`** variants, so in production those features run
on **Claude**. The Qwen twins remain in the codebase but are not reached by the
current frontend.

Dispatch is selected by the internal `llm_backend` argument: `"claude"` routes to
Anthropic+Tavily; any other value (now standardized to `"qwen"`) routes to the
Together `agent_chain` (`app/services/_llm_helpers.py::_research_agent_output`,
which only branches on `!= "claude"`).
