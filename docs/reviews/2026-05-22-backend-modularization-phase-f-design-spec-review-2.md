---
artifact: specs/2026-05-22-backend-modularization-phase-f-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-22
round: 2
---

## Context

Round 2 review of the updated spec. All round 1 findings have been addressed — the spec now correctly reports ~94 usage sites, explicitly lists `upsert_node` in the helper move, shows 5 `graph_chat.py` router sites, excludes `_claude_budget.py`/`_llm_helpers.py` with grep verification, preserves S3/Pinecone construction semantics, provides worked examples for `_run_market_scoring_for_org` and `_get_market_score_collections`, shows the full `LLMBundle`/`build_llm_config(clients: ClientBundle)` factory, adds risk #9 for dual construction, adds acceptance grep #2b for direct imports, and clarifies the 203-passed/195-definitions test count.

This round focuses on issues remaining or newly exposed after the updates.

## Findings

### [Critical] Cross-module call-chain ordering will break intermediate commits

**Location:** §4.2 commit table (commits 8–15 ordering)

The spec converts services in "easy → hard" order, one domain per commit. But services call functions from other services, and a signature change to a callee breaks any unconverted caller. The coexistence strategy (§5.3) handles *test fixture* coexistence but not *function-signature* coexistence. Verified cross-module calls that will break:

1. **Commit 8 (`_retrieval`) → consumers (commits 12, 13, 14).** `_fetch_pinecone_supporting_context(queries, org_id, top_k)` currently reads `clients.pc` at `_retrieval.py:74`. After commit 8, the signature changes to `_fetch_pinecone_supporting_context(pc, queries, org_id, top_k)`. Unconverted callers in `market_research.py:984`, `icp.py:994`, and `signals.py:580,717,779` call it without `pc` — TypeError.

2. **Commit 10 (`leads`) → consumers (commits 14, 15).** `get_leads_for_org(org_id, ...)` gains `driver` as first parameter. Unconverted callers in `market_scoring.py:377,658` and `signals.py:594,731` pass `org_id` where `driver` is now expected — TypeError.

3. **Commit 11 (`graph_chat`) → caller in commit 9 (`documents`).** `documents.py:64` imports `score_prospect` from `graph_chat.py` lazily. When commit 11 converts `graph_chat.py`, `score_prospect(cypher_query)` at `graph_chat.py:157` (which reads `clients.driver` at line 183) takes `driver` as a new parameter. But `documents.py` was already converted in commit 9 and calls the old signature. Commit 11 must also update `documents.py` — violating the one-domain-per-commit rule.

4. **Commit 13 (`icp`) → caller in commit 7 (`customer_profile`).** `customer_profile.py` imports `_reserve_unique_icp_id`, `_ensure_icp_id_registry_indexes`, `_release_icp_id` from `icp.py` at lines 143, 21, 224, 365. When commit 13 changes their signatures, `customer_profile.py` (converted in commit 7) breaks unless commit 13 also patches it.

**The spec's bisectability guarantee is violated:** between commits 8 and 12 (4 commits), `_retrieval`'s new signature breaks `market_research`, `icp`, and `signals`. Between commits 10 and 14 (4 commits), `leads`'s new signature breaks `market_scoring` and `signals`. These intermediate states are not independently green.

**Suggested mitigations (pick one):**

- **Backward-compatible default parameters during coexistence.** Converted functions use `driver=None` default with `if driver is None: driver = clients.driver` fallback. Module globals are still alive during commits 4–15, so the fallback works. Commit 16 removes the defaults. This preserves bisectability.
- **Convert shared helpers and cross-called functions last.** Move `_retrieval` after its consumers. Move `get_leads_for_org` after `market_scoring` and `signals`. This reverses the "easy → hard" ordering for specific functions but eliminates the forward breakage.
- **Expand each commit to include cross-module caller updates.** Commit 10 updates `market_scoring.py:377,658` and `signals.py:594,731` to pass `driver`. Commit 8 updates `market_research.py`, `icp.py`, `signals.py` to pass `pc`. This violates one-domain-per-commit but keeps every commit green.

### [High] `query()` function move requires `driver` parameter — not shown in spec

**Location:** §2.1 item 9, §3.4 service signature pattern

The `query(query_string)` function at `clients.py:56-59` accesses `driver` via closure (the module-level `driver` global):
```python
def query(query_string):
    with driver.session() as session:
        ...
```

When this function moves to `_neo4j_helpers.py`, the `driver` closure reference breaks — `driver` won't be in scope. The function must become `query(driver, query_string)`. All 5 call sites (3 in `graph_chat.py` router, 1 in `documents.py`, 1 in `graph_chat.py` service) must pass `driver` explicitly.

The spec's item 9 says "Move all non-client functions out of `clients.py` into `app/services/_neo4j_helpers.py`" but doesn't mention that `query()` needs a new parameter. This is a signature change that cascades to every caller. The spec's §3.4 "Service signature pattern" example only shows `fetch_leads_for_org` — a worked example for `query()` would be more useful since it's the one function that moves modules AND changes signature.

### [High] `_ensure_market_scoring_indexes` refactoring is implied but not described

**Location:** §3.2 lifespan code block

The lifespan code calls `_ensure_market_scoring_indexes(app.state.clients.client)`, passing `mongo` explicitly. But `_ensure_market_scoring_indexes` is currently defined in `app/main.py:158-167` and internally calls `_get_market_score_collections()` from `market_scoring.py` which reads `clients.client`.

After Phase F:
- `_ensure_market_scoring_indexes` must accept `mongo` as parameter
- `_get_market_score_collections(mongo)` must accept `mongo` as parameter (shown in §3.6 worked example)

But `_ensure_market_scoring_indexes` lives in `main.py`, not in a service. The spec doesn't say where the refactored function goes — does it stay in `main.py` with a `mongo` parameter? Does it move to `market_scoring.py`? The lifespan code imports it from `app.services.market_scoring`, implying it moves, but this isn't stated.

If it stays in `main.py`, it needs to import `_get_market_score_collections` and pass `mongo` through. If it moves to `market_scoring.py`, it's part of commit 15. Either way, the spec should state the decision.

### [Medium] Commit ordering creates asymmetric cross-domain blast radius

**Location:** §4.2 commit table

Even if the Critical finding above is addressed with backward-compatible defaults, the commit ordering means some commits are trivially small (`pipeline` = 2 usages, import-only potentially) while commit 15 (`market_scoring`) is enormous — 6 `clients.*`/`llm_config.*` sites + `_get_market_score_collections` refactoring + 5 internal functions (`get_company_profile_for_org`, `get_market_reports_for_org`, `score_single_lead_against_market`, `_persist_market_score_for_lead`, `_run_market_scoring_for_org`) that each read globals + cross-module caller updates for `get_leads_for_org` + the `_ensure_market_scoring_indexes` move. The worked example in §3.6 shows the pattern but the actual commit 15 diff will be the largest in the phase by a significant margin.

Consider splitting commit 15 into 2 commits: (a) convert the internal helper functions, (b) convert `_run_market_scoring_for_org` and the router wiring.

### [Medium] `build_llm_config` placeholder elides `search_tool`/`tools` construction details

**Location:** §3.1 `build_llm_config` code block, lines 191-196

The code shows:
```python
    # agent_chain construction (TavilySearchResults + Tool + initialize_agent)
    # is identical to today; omitted here for brevity.
    tools = [...]  # TavilySearchResults wrapped in Tool, as today
```

While the comment says "identical to today," the current `llm_config.py:298-318` constructs `TavilySearchResults` with `tavily_api_key` from `app.core.config`. The spec doesn't show whether `search_tool` and `tools` become local variables in `build_llm_config` or module-level constants. If they're constructed inside the factory, the `Tool` name resolution and `TavilySearchResults` import must be correct. Since this is the one place where an `import` from a third-party library (`langchain_community.tools.tavily_search.tool`) is needed inside the factory, the spec should note that these imports stay at module level in `llm_config.py` (only the construction moves into the factory).

### [Medium] `vision` field included in `LLMBundle` but may have no consumers

**Location:** §3.1 `LLMBundle` dataclass — `vision: ChatGroq` field

The spec's own open question §7.4 item 4 raises this: `vision` appears in `LLMBundle` but grep shows no qualified `llm_config.vision` access in services or routers. Including it means constructing a second `ChatGroq` instance (with a potentially expensive model `llama-3.2-90b-vision-preview`) at every app startup for a field nobody reads. The spec acknowledges this as an open question — but the correct action is to drop it from the bundle now and add it back if/when a consumer appears, rather than carrying dead construction through Phase F.

### [Low] `pipeline` service has 2 real usages, not just 2 imports

**Location:** §4.2 commit table — "pipeline | 2 | Warm-up. No LLM."

The round 1 review flagged this as "may be import-only." Verified: `pipeline.py` has `clients.driver.session()` at line 25 and `llm_config.llm2.invoke()` at line 79. Both are real usage sites, not just imports. The spec's "2" count is accurate. This is a clarification of the round 1 finding, not a new issue.

### [Low] `_neo4j_helpers.py` will hold `query()` which is a security-relevant function

**Location:** §2.1 item 9

The `query()` function is used at the raw Cypher endpoint (`GET /query/` at `graph_chat.py:44`) and in `voice_graph`/`text_graph` — all flagged in CLAUDE.md "Gotchas" as Cypher injection risks. Moving it to `_neo4j_helpers.py` doesn't change the risk, but the Phase G security hardening spec should reference the new location. Not blocking for Phase F, but worth noting in §8 Phase G inventory.

### [Nit] Worked example in §3.6 shows `llm.invoke([HumanMessage(...)])` but current code uses `llm2`

**Location:** §3.6 worked example — `response = llm.invoke([HumanMessage(content=prompt)])  # was: llm_config.llm2.invoke(...)`

The comment says "was: `llm_config.llm2`" but the example variable is named `llm`. This is fine — the router will inject `get_llm2` and the service parameter is just named `llm` locally. But the worked example should use consistent naming to avoid confusion. If the router does `llm2=Depends(get_llm2)`, the service parameter should also be `llm2`. If the service uses `llm`, the router should too. The spec doesn't show the router side for this specific example.

### [Nit] Provider names corrected to `get_chain`/`get_chain2` — good, but §2.1 item 1 still says 13 providers

**Location:** §2.1 item 1 — "13 providers"

The spec now lists `get_chain` and `get_chain2` (matching `LLMBundle` field names). The count is correct: 5 client + 8 LLM = 13. The round 1 naming inconsistency is resolved. No issue, just confirming.
