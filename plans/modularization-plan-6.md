# Backend Modularization Phase F Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every module-level singleton in `app/core/clients.py` and `app/core/llm_config.py` with FastAPI `Depends`-injected dependencies, constructed once in a `lifespan` context manager. Retire TD-003 (`@app.on_event("startup")` → `lifespan`).

**Architecture:** Two new factory functions (`build_clients()`, `build_llm_config()`) produce `ClientBundle` / `LLMBundle` dataclasses. A `lifespan` context manager in `app/main.py` builds them once and stashes on `app.state`. A new `app/core/dependencies.py` exposes 12 `Request`-bound provider functions. Services become pure functions taking clients as positional args. Tests substitute mocks via `app.dependency_overrides`. The conversion runs in 16 or 17 commits over a single branch; commits 1–15 keep module globals alive so unconverted callers keep working (the §3.7 backward-compat fallback). Commit 17 deletes globals, fallbacks, and the deprecated `on_event` hook in one step.

**Tech Stack:** FastAPI (lifespan, Depends, dependency_overrides), Python `dataclasses`, `contextlib.asynccontextmanager`, pytest + pytest-mock (existing). No new dependencies.

**Spec:** `specs/2026-05-22-backend-modularization-phase-f-design.md`
**Branch:** `refactor-backend-modularization-phase-f` off `master`.
**Baseline:** Phase E HEAD on `master`; `pytest backend/tests/` reports 203 PASSED (195 distinct `def test_` definitions).

**Commit numbering convention:** This plan assumes the 15a/15b split (17 commits total) per spec §4.2's recommendation. Commit messages below use `/17`. If commit 15a's diff lands below ~200 LOC, merge 15a and 15b into a single commit 15 and renumber the cleanup commit from `17/17` to `16/16` (one-line change in Task 16's commit command).

**Merge cadence:** Brewra's CTO has solo-write authority on `master` (per CLAUDE.md "Discipline rule"). To minimize the dual-construction window (spec §6 Risk 9), **the recommended cadence is to merge each completed task to `master` as soon as it lands green** rather than batching to the end of the branch. The branch exists for organization during execution; per-commit merges are preferred. The post-execution "Final merge" step at the bottom of this plan is a fallback for when batched merges are unavoidable.

**Known spec errata** (verified against live code at plan-writing; flagged here for cross-reference):

1. **Spec §4.2 commit-13 row says "7 call sites" in `customer_profile.py`; spec §3.7 table says "11 call sites".** The 11 in §3.7 is correct (`_ensure_icp_id_registry_indexes` × 4 + `_reserve_unique_icp_id` × 6 + `_release_icp_id` × 1, verified by grep). The §4.2 cell is stale.
2. **Spec §3.7 claims customer_profile's 11 call sites need patching in commit 13 to "pass `mongo` to icp's helpers."** Verified incorrect against `app/services/icp.py:1101, 1107, 1134`: the three helpers take a pre-indexed `db` parameter, never read `clients.*` themselves, and don't change signatures in Phase F. customer_profile's call sites stay structurally as-is — Task 13 has no `customer_profile.py` changes.
3. **Spec §3.7's caller-shape example for `get_leads_for_org`** shows positional calls `get_leads_for_org(org_id, …)` after the new `driver=None` parameter is added. That binding is broken (`org_id` → `driver`). Task 10 fixes this by keyword-promoting the 4 call sites in `signals.py` / `market_scoring.py` as a cross-cutting prerequisite step (Task 10 Step 3).
4. **Spec §2.1 item 9 specifies `query(driver, query_string)` (two args).** The plan implements `query(driver, query_string, params=None)` (three args, `params` optional) — a backwards-compatible extension needed for Phase G's parameterized-Cypher security work. See Task 11 Step 2 for the rationale.

These errata are flagged inline at the affected tasks; this section is the single-stop reference for future readers cross-checking the spec against the implementation.

---

## Pre-flight (one-time setup, no commit)

- [ ] **Verify master state**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status   # expected: clean working tree (or only this plan file untracked)
git rev-parse --abbrev-ref HEAD   # expected: master
git log --oneline -5
```

- [ ] **Verify the test baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -3
```

Expected: `203 passed` (give or take parametrized variants — record the exact number; every conversion commit must match it).

- [ ] **Verify grep counts that the spec relies on**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -rE "clients\.(driver|client|graph|s3_client|pc)" app/services/ | wc -l   # expected: ~75
grep -rE "llm_config\." app/services/ | wc -l                                  # expected: ~11
grep -rnE "from app\.core\.clients import (query|upsert_node)" app/             # expected: 8 sites
```

If counts diverge by more than ±2 from the spec, stop and reconcile before proceeding — the spec's blast-radius table drives task sizing.

- [ ] **Verify router structure (1:1 with services)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
ls app/routers/
for f in app/routers/*.py; do
    echo "== $f =="
    grep -E "^from app\.services|^import app\.services" "$f" | head -3
done
```

Expected (verified at plan-writing): exactly one router file per service in `app/routers/` (`customer_profile.py`, `documents.py`, `graph_chat.py`, `icp.py`, `leads.py`, `market_research.py`, `market_scoring.py`, `org_auth.py`, `pipeline.py`, `profiles.py`, `signals.py`), each importing its corresponding `app/services/<service>.py` as `<service>_service` or similar. If a router shows imports from multiple services, the per-task "Modify: `backend/app/routers/<service>.py`" instruction may be incomplete — flag and adapt before proceeding.

- [ ] **Audit `backend/scripts/` for any direct `clients` / `llm_config` imports (spec §7.4 open question 1)**

```bash
grep -rnE "^(from app\.core import (clients|llm_config)|from app\.core\.(clients|llm_config) import|import app\.core\.(clients|llm_config))" backend/scripts/ 2>/dev/null
```

Expected: empty (Phase A's analogous audit found none). If any script reaches into module globals, note its path — those callsites must be refactored in commit 17 alongside the global deletion, or earlier if convenient.

- [ ] **Audit for external references to `_SKIP_DB_INIT` (spec §7.4 open question 3)**

```bash
grep -rn "_SKIP_DB_INIT" backend/app/ backend/scripts/ --include="*.py" 2>/dev/null | grep -v "backend/app/core/clients.py"
```

Expected: empty. The `_SKIP_DB_INIT` module-level constant disappears after Task 1 Step 3 collapses module-level construction into `build_clients()` (which reads `os.getenv("BREWRA_SKIP_DB_INIT")` internally). Any external `from app.core.clients import _SKIP_DB_INIT` would break silently. If non-empty, refactor those callers to read the env var directly or to call `build_clients()` with the explicit `skip_db_init=` argument.

- [ ] **Create the feature branch**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout -b refactor-backend-modularization-phase-f
```

All Tasks 1–16 land on this branch. Push when convenient; the CTO merges to `master` solo per CLAUDE.md.

---

## Task 1: Introduce `ClientBundle`, `LLMBundle`, and `build_*` factories

Commit message: `refactor(be): introduce ClientBundle and LLMBundle factories [phase F, commit 1/17]`

This commit adds the new shape without changing behavior. The factories are called BOTH at module import (to populate the existing module globals, which §3.7 fallback relies on) AND will later be called inside `lifespan` (Task 2). At the end of this task, no production code change is observable — services still read `clients.driver` etc.

**Files:**
- Modify: `backend/app/core/clients.py` (add `ClientBundle`, `build_clients`; keep existing module-level construction)
- Modify: `backend/app/core/llm_config.py` (add `LLMBundle`, `build_llm_config`; keep existing module-level construction)
- Test: `backend/tests/` (existing suite — no test changes)

- [ ] **Step 1: Read the spec §3.1 in full before touching code**

```bash
sed -n '75,210p' /projects/Brewra/brewra-gtm-intelligence/specs/2026-05-22-backend-modularization-phase-f-design.md
```

The spec gives the complete `ClientBundle` dataclass + `build_clients` body and the `LLMBundle` + `build_llm_config` shape.

- [ ] **Step 2: Add `ClientBundle` and `build_clients()` to `app/core/clients.py`**

Insert *above* the existing module-level construction block (do not delete the existing block — it stays through commit 15). Required content per spec §3.1:

```python
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class ClientBundle:
    driver: Optional[Any]          # neo4j.GraphDatabase driver — None when BREWRA_SKIP_DB_INIT or connect fails
    graph: Optional[Any]           # Neo4jGraph — None when BREWRA_SKIP_DB_INIT or init fails
    client: Optional[Any]          # MongoClient — None when BREWRA_SKIP_DB_INIT or connect fails
    s3_client: Any                 # boto3 client — always constructed (lazy)
    pc: Any                        # Pinecone — always constructed (lazy)


def build_clients(skip_db_init: Optional[bool] = None) -> ClientBundle:
    """Construct all external clients. Call once at app startup.

    Preserves current code semantics exactly:
    - Neo4j driver / graph / Mongo are gated by `skip_db_init` AND wrapped in
      try/except — matches today's module-level `_SKIP_DB_INIT` + try/except.
    - S3 and Pinecone are constructed UNCONDITIONALLY and NOT wrapped in
      try/except — matches today. Construction is lazy for both (no network
      call), so this is safe in test environments.
    """
    if skip_db_init is None:
        skip_db_init = bool(os.getenv("BREWRA_SKIP_DB_INIT"))

    driver, graph, client = None, None, None

    if not skip_db_init:
        try:
            driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_username, neo4j_password))
            driver.verify_connectivity()
            logger.info("Connected to Neo4j successfully!")
        except Exception as e:
            logger.error("Neo4j Connection failed: %s", e)

        try:
            graph = Neo4jGraph(url=neo4j_uri, username=neo4j_username, password=neo4j_password)
        except Exception as e:
            logger.error("Neo4jGraph init failed: %s", e)

        try:
            client = MongoClient(mongo_uri)
        except Exception as e:
            logger.error("MongoDB Connection failed: %s", e)

    s3_client = boto3.client(
        "s3",
        aws_access_key_id=aws_access_key,
        aws_secret_access_key=aws_secret_key,
        region_name=aws_region,
    )
    pc = Pinecone(api_key=pinecone_api_key)

    return ClientBundle(driver=driver, graph=graph, client=client, s3_client=s3_client, pc=pc)
```

The existing module-level `driver = …`, `graph = …`, `client = …`, `s3_client = …`, `pc = …` assignments **stay below this** — they remain the substrate for §3.7 fallback through commit 15.

- [ ] **Step 3: Collapse the duplicate construction (mandatory)**

Replace the existing module-level construction block with a single call to the factory:

```python
# At the bottom of clients.py, replacing the existing module-level construction:
_bundle = build_clients()
driver = _bundle.driver
graph = _bundle.graph
client = _bundle.client
s3_client = _bundle.s3_client
pc = _bundle.pc
```

This collapse keeps the same module globals alive (`clients.driver`, etc. all still work) while routing construction through the factory. The greppable invariant "module-import-time construction still happens" is preserved. The collapse removes the risk of behavior drift between two construction paths (Risk 1 in spec §6) — without it, the factory and the inline construction could subtly diverge under code rebases.

- [ ] **Step 4: Add `LLMBundle` and `build_llm_config()` to `app/core/llm_config.py`**

Insert above the existing module-level construction. Required content per spec §3.1:

```python
from dataclasses import dataclass
from typing import Any, Optional

from app.core.clients import ClientBundle


@dataclass
class LLMBundle:
    llm: Any                                      # ChatGroq
    llm2: Any                                     # ChatOpenAI (Together)
    llm_transformer: Any                          # LLMGraphTransformer
    memory: Any                                   # ConversationBufferMemory
    chain: Optional[Any]                          # GraphCypherQAChain — None when clients.graph is None
    chain2: Optional[Any]                         # GraphCypherQAChain — None when clients.graph is None
    agent_chain: Any                              # LangChain AgentExecutor


def build_llm_config(clients_bundle: "ClientBundle") -> LLMBundle:
    """Construct all LLM-side artifacts. Requires a ClientBundle because
    `chain`/`chain2` need `clients.graph` to be either real or None — exactly
    matching today's conditional construction in this module.
    """
    llm = ChatGroq(model="llama-3.3-70b-versatile", api_key=groq_api_key)
    llm2 = ChatOpenAI(
        api_key=together_api_key,
        base_url="https://api.together.xyz/v1",
        model="Qwen/Qwen3-235B-A22B-Instruct-2507",
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

    tools = [
        Tool(
            name="search",
            func=TavilySearchResults(api_key=tavily_api_key, max_results=4).run,
            description="search the web",
        ),
    ]
    agent_chain = initialize_agent(
        tools=tools, llm=llm2,
        agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
        verbose=True, max_iterations=20, max_execution_time=120,
    )

    return LLMBundle(
        llm=llm, llm2=llm2,
        llm_transformer=llm_transformer, memory=memory,
        chain=chain, chain2=chain2, agent_chain=agent_chain,
    )
```

Use the **exact** initialization arguments currently present in `llm_config.py` — read lines 100-200 first if anything in the snippet above looks different from the existing code. The Cypher prompt-template strings (`Cypher_Prompt`, `Cypher_Prompt2`, `qa_prompt`, `qa_prompt2`) stay at module scope and are referenced by the factory.

- [ ] **Step 5: Route the existing module globals through the factory**

Replace the existing module-level construction of `llm`, `llm2`, `llm_transformer`, `memory`, `chain`, `chain2`, `agent_chain` with:

```python
from app.core import clients as _clients
_bundle = build_llm_config(_clients._bundle)
llm = _bundle.llm
llm2 = _bundle.llm2
llm_transformer = _bundle.llm_transformer
memory = _bundle.memory
chain = _bundle.chain
chain2 = _bundle.chain2
agent_chain = _bundle.agent_chain
```

Step 3 (mandatory) exposes `_clients._bundle` as a module attribute on `app.core.clients`. This step reads it directly — no conditional branching.

- [ ] **Step 6: Run the full test suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/ -q
```

Expected: 203 passed (same as baseline). If anything fails, the construction collapse in Step 3 or Step 5 is the most likely culprit — revert that step alone and leave the duplicate construction in place.

- [ ] **Step 7: Verify grep invariants**

```bash
grep -n "^def build_clients\|^class ClientBundle" backend/app/core/clients.py    # 2 hits
grep -n "^def build_llm_config\|^class LLMBundle" backend/app/core/llm_config.py  # 2 hits
grep -nE "^(driver|graph|client|s3_client|pc) ?=" backend/app/core/clients.py     # still present (kept alive)
```

- [ ] **Step 8: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/core/clients.py backend/app/core/llm_config.py
git commit -m "refactor(be): introduce ClientBundle and LLMBundle factories [phase F, commit 1/17]"
```

---

## Task 2: Add `dependencies.py` and `lifespan` in `app/main.py`

Commit message: `refactor(be): add dependencies module and lifespan [phase F, commit 2/17]`

This commit adds the 12 provider functions and the `lifespan` context manager. Module-level construction in `clients.py` / `llm_config.py` from Task 1 stays alive — `lifespan` AND module-import both construct. The dual-construction risk (spec §6 Risk 9) is accepted; commit 17 collapses it.

**Files:**
- Create: `backend/app/core/dependencies.py`
- Modify: `backend/app/main.py` (add lifespan, remove `@app.on_event("startup")` from this commit — but keep the existing `clients.graph.refresh_schema()` block at module-import for backward compat)

Wait — re-reading spec §4.1 commit 2: the deprecated hook is **not** removed in commit 2. It's removed in commit 17 alongside global deletion. In commit 2, `lifespan` is added *alongside* `@app.on_event("startup")`. Both run. Let me restate:

**Important nuance:** Both `lifespan` and `@app.on_event("startup")` co-exist during commits 2–15. `_ensure_market_scoring_indexes` runs twice per boot in production during the coexistence window (once via `on_event`, once via `lifespan`). That's tolerable because the underlying `create_index` calls are idempotent (Mongo no-ops when an index with the same key spec exists). Commit 17 deletes the `on_event` block.

- [ ] **Step 1: Create `backend/app/core/dependencies.py`**

Required content per spec §3.3 (all 12 providers, multi-line):

```python
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
def get_llm(request: Request):
    return request.app.state.llm.llm


def get_llm2(request: Request):
    return request.app.state.llm.llm2


def get_llm_transformer(request: Request):
    return request.app.state.llm.llm_transformer


def get_memory(request: Request):
    return request.app.state.llm.memory


def get_agent_chain(request: Request):
    return request.app.state.llm.agent_chain


def get_chain(request: Request):
    return request.app.state.llm.chain


def get_chain2(request: Request):
    return request.app.state.llm.chain2
```

- [ ] **Step 2: Add `lifespan` to `app/main.py`**

Find the existing module-level `if clients.graph is not None: clients.graph.refresh_schema()` block and the `@app.on_event("startup") def _ensure_market_scoring_indexes(): …` block. **Do not delete** either yet — they stay for commit 17. *Add* a `lifespan` context manager that does the same work via the bundles.

Insert near the top of `app/main.py`, after the existing imports:

```python
from contextlib import asynccontextmanager
import logging

from app.core.clients import build_clients
from app.core.llm_config import build_llm_config

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Construct all external clients/LLMs once and stash on app.state.

    Idempotent with the legacy module-import-time construction and the
    @app.on_event("startup") hook (both still alive through commit 15).
    """
    app.state.clients = build_clients()
    app.state.llm = build_llm_config(app.state.clients)

    if app.state.clients.graph is not None:
        try:
            app.state.clients.graph.refresh_schema()
        except Exception as e:
            logger.error("Neo4j refresh_schema (lifespan) failed: %s", e)

    if app.state.clients.client is not None:
        # Re-run index creation via lifespan. The on_event version still
        # runs too — Mongo create_index is idempotent so this is safe.
        from app.services.market_scoring import _get_market_score_collections
        score_coll, run_coll = _get_market_score_collections()
        score_coll.create_index([("org_id", 1), ("lead_id", 1)], unique=True)
        score_coll.create_index([("org_id", 1), ("updated_at", -1)])
        run_coll.create_index([("org_id", 1), ("status", 1)])
        run_coll.create_index([("org_id", 1), ("created_at", -1)])

    yield
    # No teardown — clients are process-lifetime singletons.
```

**Sequencing note:** The four inline `create_index` calls inside this lifespan body are *temporary*. Task 15a Step 4 replaces them with a single `_ensure_market_scoring_indexes(app.state.clients.client)` call once that function relocates from `app/main.py` into `app/services/market_scoring.py`. A reviewer checking out commit 2 in isolation sees the inline version; this is intentional sequencing, not stale code.

- [ ] **Step 3: Pass `lifespan` to `FastAPI(...)`**

Find the existing `app = FastAPI(...)` line in `app/main.py` and add `lifespan=lifespan`:

```python
app = FastAPI(lifespan=lifespan)
```

If the existing constructor takes other args, preserve them: `app = FastAPI(title=..., lifespan=lifespan)`.

- [ ] **Step 4: Verify both startup paths still run**

In a TestClient context, `lifespan` runs on the first request. Add a quick smoke check:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
python -c "
from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as c:
    assert hasattr(c.app.state, 'clients'), 'clients not on app.state'
    assert hasattr(c.app.state, 'llm'), 'llm not on app.state'
    print('app.state populated by lifespan: OK')
"
```

Expected output: `app.state populated by lifespan: OK`.

- [ ] **Step 5: Run the full test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed (same as baseline). `lifespan` runs in TestClient automatically — if anything in `tests/conftest.py` relies on `BREWRA_SKIP_DB_INIT=1`, that env var is honored inside `build_clients()` (Task 1 Step 2).

- [ ] **Step 6: Verify grep invariants**

```bash
grep -c "^def get_" backend/app/core/dependencies.py    # 12 hits
grep -n "lifespan" backend/app/main.py                  # at least the asynccontextmanager + FastAPI(lifespan=...) hits
grep -n "@app.on_event" backend/app/main.py             # 1 hit (still alive — removed in commit 17)
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/core/dependencies.py backend/app/main.py
git commit -m "refactor(be): add dependencies module and lifespan [phase F, commit 2/17]"
```

---

## Task 3: Add `dependency_overrides`-based fixtures and leak-detection autouse fixture

Commit message: `test(be): add dependency_overrides fixtures and leak detector [phase F, commit 3/17]`

Add the new override-based fixture set alongside the existing `mocker.patch("app.core.clients.…")` fixtures. The two styles coexist through commit 15 — converted services use overrides, unconverted services keep using source-patches. Commit 17 deletes the source-patch fixtures entirely.

**Files:**
- Modify: `backend/tests/conftest.py` (add client + LLM override fixtures and the session-scope leak-detector)

The unit-test conftest (`backend/tests/unit/conftest.py`) is **not** touched in this task. Unit-test fixture changes happen per-service in Tasks 4–15 Step 5 — each conversion task updates the unit tests for its own domain to pass mocks positionally to the converted service functions. There are no unit-test override fixtures because unit tests bypass FastAPI / TestClient entirely (per Phase E's `backend/tests/unit/conftest.py` docstring).

- [ ] **Step 1: Read the existing `tests/conftest.py` to understand the fixture composition pattern**

```bash
sed -n '1,160p' backend/tests/conftest.py
```

The existing `mock_neo4j`, `mock_mongo`, `mock_s3`, `mock_pinecone`, `mock_llm_chain`, `mock_llm_config` fixtures each source-patch one or more `app.core.clients.*` / `app.core.llm_config.*` names. The composite `client` fixture (TestClient) depends on all of them.

- [ ] **Step 2: Add `app.dependency_overrides`-based fixtures to `backend/tests/conftest.py`**

Add **alongside** the existing fixtures. Use distinct names with the `_via_override` suffix to avoid collisions during the coexistence period. Each new fixture does its own `yield … finally: app.dependency_overrides.pop(...)`.

```python
# Append near the bottom of tests/conftest.py (above the autouse fixture):

@pytest.fixture
def mock_neo4j_via_override():
    """Neo4j driver mock injected via app.dependency_overrides[get_neo4j_driver]."""
    from app.main import app
    from app.core.dependencies import get_neo4j_driver
    from unittest.mock import MagicMock

    mock_session = MagicMock()
    mock_driver = MagicMock()
    mock_driver.session.return_value.__enter__.return_value = mock_session
    mock_driver.session.return_value.__exit__.return_value = False

    app.dependency_overrides[get_neo4j_driver] = lambda: mock_driver
    try:
        yield {"driver": mock_driver, "session": mock_session}
    finally:
        app.dependency_overrides.pop(get_neo4j_driver, None)


@pytest.fixture
def mock_mongo_via_override():
    from app.main import app
    from app.core.dependencies import get_mongo
    from unittest.mock import MagicMock

    mock = MagicMock()
    app.dependency_overrides[get_mongo] = lambda: mock
    try:
        yield mock
    finally:
        app.dependency_overrides.pop(get_mongo, None)


@pytest.fixture
def mock_s3_via_override():
    from app.main import app
    from app.core.dependencies import get_s3
    from unittest.mock import MagicMock

    mock = MagicMock()
    app.dependency_overrides[get_s3] = lambda: mock
    try:
        yield mock
    finally:
        app.dependency_overrides.pop(get_s3, None)


@pytest.fixture
def mock_pinecone_via_override():
    from app.main import app
    from app.core.dependencies import get_pinecone
    from unittest.mock import MagicMock

    mock = MagicMock()
    app.dependency_overrides[get_pinecone] = lambda: mock
    try:
        yield mock
    finally:
        app.dependency_overrides.pop(get_pinecone, None)


@pytest.fixture
def mock_neo4j_graph_via_override():
    from app.main import app
    from app.core.dependencies import get_neo4j_graph
    from unittest.mock import MagicMock

    mock = MagicMock()
    app.dependency_overrides[get_neo4j_graph] = lambda: mock
    try:
        yield mock
    finally:
        app.dependency_overrides.pop(get_neo4j_graph, None)


@pytest.fixture
def mock_llm_via_override():
    """Composite override for all 7 LLM providers. Mirrors mock_llm_config in
    structure but flows through app.dependency_overrides instead of source-patches."""
    from app.main import app
    from app.core.dependencies import (
        get_llm, get_llm2, get_llm_transformer,
        get_memory, get_agent_chain, get_chain, get_chain2,
    )
    from unittest.mock import MagicMock

    mocks = {name: MagicMock() for name in (
        "llm", "llm2", "llm_transformer", "memory", "agent_chain", "chain", "chain2",
    )}
    app.dependency_overrides[get_llm] = lambda: mocks["llm"]
    app.dependency_overrides[get_llm2] = lambda: mocks["llm2"]
    app.dependency_overrides[get_llm_transformer] = lambda: mocks["llm_transformer"]
    app.dependency_overrides[get_memory] = lambda: mocks["memory"]
    app.dependency_overrides[get_agent_chain] = lambda: mocks["agent_chain"]
    app.dependency_overrides[get_chain] = lambda: mocks["chain"]
    app.dependency_overrides[get_chain2] = lambda: mocks["chain2"]
    try:
        yield mocks
    finally:
        for provider in (get_llm, get_llm2, get_llm_transformer, get_memory,
                         get_agent_chain, get_chain, get_chain2):
            app.dependency_overrides.pop(provider, None)
```

- [ ] **Step 3: Add the session-scope leak-detection autouse fixture to `tests/conftest.py`**

Per spec §5.4, append:

```python
@pytest.fixture(autouse=True, scope="session")
def _verify_no_dependency_override_leak():
    """Session-end check: a test fixture forgot to pop its override.

    A leak pollutes later tests — they'd inherit the override and pass/fail
    for the wrong reasons. This safety net catches that without exercising
    any production code path.
    """
    from app.main import app
    yield
    assert app.dependency_overrides == {}, (
        f"Test session leaked overrides: {list(app.dependency_overrides.keys())}"
    )
```

- [ ] **Step 4: Verify both fixture styles coexist**

Quick smoke test — drop this into a scratch file or run inline:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python -c "
from fastapi.testclient import TestClient
from app.main import app
from app.core.dependencies import get_mongo
from unittest.mock import MagicMock

# Set an override
mock = MagicMock()
app.dependency_overrides[get_mongo] = lambda: mock

with TestClient(app) as c:
    # Make a request that touches Mongo — pick any endpoint that uses get_mongo
    # post-Phase-F. For now, just confirm app.state still has the real bundle:
    assert hasattr(c.app.state, 'clients'), 'lifespan did not populate clients'
    print('Override set; app.state preserved; both layers coexist: OK')

# Clean up
app.dependency_overrides.pop(get_mongo, None)
"
```

- [ ] **Step 5: Run the full test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed. The autouse leak-detector runs at session end — if it fires, a *new* override fixture is missing its `.pop()` call. The existing source-patch fixtures don't touch `dependency_overrides` and won't trip the detector.

- [ ] **Step 6: Verify grep invariants**

```bash
grep -c "_via_override" backend/tests/conftest.py                        # 6 fixture definitions
grep -n "_verify_no_dependency_override_leak" backend/tests/conftest.py  # 1 hit
```

- [ ] **Step 7: Commit**

```bash
git add backend/tests/conftest.py
git commit -m "test(be): add dependency_overrides fixtures and leak detector [phase F, commit 3/17]"
```

---

## Task 4: Convert `services/pipeline.py`

Commit message: `refactor(be): inject pipeline service [phase F, commit 4/17]`

Warm-up commit. Two `clients.*` sites, no LLM, no cross-commit callers. Uses the §3.4 simple form (mandatory client args, no fallback).

**Files:**
- Modify: `backend/app/services/pipeline.py`
- Modify: `backend/app/routers/pipeline.py` (whichever router calls into `pipeline`; identify with grep)
- Modify: `backend/tests/test_pipeline.py` or `backend/tests/unit/test_pipeline.py` if they exist (likely none)

- [ ] **Step 1: Inventory all `clients.*` sites in `pipeline.py`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -nE "clients\.|llm_config\.|from app\.core (import|\.core)" app/services/pipeline.py
```

Expected: 2 sites. Note the function each site lives in. These are the functions whose signatures change.

- [ ] **Step 2: Identify callers of those functions**

```bash
for fn in $(grep -nE "^def [a-zA-Z_]+\(" app/services/pipeline.py | awk -F'[ (:]' '{print $4}'); do
    echo "=== $fn ==="
    grep -rn "$fn" app/routers/ app/services/ 2>&1 | grep -v "app/services/pipeline.py" | head -5
done
```

If any caller lives in a service that hasn't been converted yet, the converted function would need a §3.7 fallback. Spec §4.2 commit 4 says "No cross-commit callers" — verify this is still true. If a new caller appeared since the spec was written, switch to §3.7 fallback form (see Task 8 for the pattern).

- [ ] **Step 3: Apply the §3.4 simple-form conversion to each function**

For each function in `pipeline.py` that accesses `clients.*`, rewrite the signature:

**Before:**
```python
def some_pipeline_fn(arg1, arg2):
    with clients.driver.session() as s:
        ...
```

**After:**
```python
def some_pipeline_fn(driver, arg1, arg2):
    with driver.session() as s:
        ...
```

Remove the `from app.core import clients` line if it's no longer used anywhere in the file. Otherwise leave it (the §3.7 fallback in other commits may still reference it indirectly, but pipeline has no fallback).

- [ ] **Step 4: Update the router endpoint(s) that call pipeline**

For every router endpoint that calls into a now-converted `pipeline` function, add the matching `Depends()` and pass through:

```python
from app.core.dependencies import get_neo4j_driver

@router.get("/some-path")
def some_endpoint(
    arg1: str = Query(...),
    driver=Depends(get_neo4j_driver),
):
    return services.pipeline.some_pipeline_fn(driver, arg1, ...)
```

If `pipeline` is called from a service rather than a router, the calling service must pass its own `driver` argument through. Since spec §4.2 says pipeline has no cross-commit callers, the caller(s) must already be in this commit — update them in-place.

- [ ] **Step 5: Update or add the matching tests**

If `backend/tests/test_pipeline*.py` or `backend/tests/unit/test_pipeline*.py` exist, switch their mocking:
- Integration tests using `mock_neo4j` (source-patch) → switch to `mock_neo4j_via_override` and adjust the call sites.
- Unit tests calling the service function directly: pass the mock `driver` as a positional argument instead of expecting the patch to take effect.

If no tests exist for the converted functions, leave the suite alone. Phase F is a mechanism swap; spec §2.3 explicitly forbids new test coverage.

- [ ] **Step 6: Run the full test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed. If a test fails:
- "`AttributeError: 'NoneType' object has no attribute 'session'`" → the caller (router or another service) wasn't updated to pass `driver`.
- "`TypeError: some_pipeline_fn() missing 1 required positional argument: 'driver'`" → same.
- A test that previously passed by source-patching `app.core.clients.driver` now fails → its fixture needs to switch to `mock_neo4j_via_override`.

- [ ] **Step 7: Verify grep invariants**

```bash
grep -nE "clients\." backend/app/services/pipeline.py   # 0 hits
grep -nE "clients\." backend/app/routers/pipeline.py    # 0 hits in router for pipeline-related endpoints
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/pipeline.py backend/app/routers/pipeline.py backend/tests/
git commit -m "refactor(be): inject pipeline service [phase F, commit 4/17]"
```

---

## Task 5: Convert `services/org_auth.py`

Commit message: `refactor(be): inject org_auth service [phase F, commit 5/17]`

5 `clients.*` sites, no LLM, no cross-commit callers. §3.4 simple form.

**Files:**
- Modify: `backend/app/services/org_auth.py`
- Modify: `backend/app/routers/org_auth.py`
- Modify: matching test file(s) under `backend/tests/`

- [ ] **Step 1: Inventory**

```bash
grep -nE "clients\.|llm_config\." backend/app/services/org_auth.py
```

Expected: 5 sites. Note which clients are touched (`driver`, `client`, `s3_client`, etc.). org_auth is typically Neo4j + maybe Mongo.

- [ ] **Step 2: Identify callers**

```bash
grep -rnE "from app\.services\.org_auth import|services\.org_auth\." backend/app/
```

Spec §4.2 commit 5: "No cross-commit callers". Verify.

- [ ] **Step 3: Apply the §3.4 simple-form conversion**

For each function that touches a client, prepend the appropriate client name to its signature in caller-determined order: `driver` before `mongo` before `s3` before `pc` before any LLM. Inside the body, replace `clients.driver` → `driver`, `clients.client` → `mongo`, etc.

- [ ] **Step 4: Update `backend/app/routers/org_auth.py`**

For each endpoint that calls a converted `org_auth` function, add `=Depends(get_<provider>)` arguments to the endpoint signature and pass them through to the service call.

```python
from app.core.dependencies import get_neo4j_driver, get_mongo

@router.post("/auth/org/some-action")
def some_action(
    body: SomeBody,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
):
    return services.org_auth.some_fn(driver, mongo, body.field1, body.field2)
```

- [ ] **Step 5: Update test files**

Use `grep -l "org_auth" backend/tests/` to find affected tests. Migrate any `mocker.patch("app.core.clients.driver", …)` calls in those tests to `mock_neo4j_via_override` (and similar for Mongo). Unit tests calling the service function directly should pass mocks positionally.

- [ ] **Step 6: Run the test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed.

- [ ] **Step 7: Verify grep invariants**

```bash
grep -nE "clients\." backend/app/services/org_auth.py     # 0 hits
grep -nE "clients\." backend/app/routers/org_auth.py      # 0 hits
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/org_auth.py backend/app/routers/org_auth.py backend/tests/
git commit -m "refactor(be): inject org_auth service [phase F, commit 5/17]"
```

---

## Task 6: Convert `services/profiles.py`

Commit message: `refactor(be): inject profiles service [phase F, commit 6/17]`

5 sites. `profiles.py` imports `upsert_node` from `app.core.clients` (this import is re-pointed in commit 17; for now it's a direct import that still works because commit 17 hasn't run). No cross-commit callers. §3.4 simple form.

**Files:**
- Modify: `backend/app/services/profiles.py`
- Modify: `backend/app/routers/profiles.py`
- Modify: matching test file(s)

- [ ] **Step 1: Inventory**

```bash
grep -nE "clients\.|llm_config\.|from app\.core\.clients import" backend/app/services/profiles.py
```

Expected: 5 `clients.*` sites + 1 `from app.core.clients import upsert_node` line.

Leave the `upsert_node` import unchanged in this commit. Commit 17 re-points it to `app.services._neo4j_helpers`. `upsert_node` already takes `tx` as its first parameter (verified in spec §2.1 item 9) and does not need a new arg.

- [ ] **Step 2: Identify callers**

```bash
grep -rnE "from app\.services\.profiles import|services\.profiles\." backend/app/
```

Spec §4.2 commit 6: "No cross-commit callers". Verify.

- [ ] **Step 3: Apply the §3.4 simple-form conversion**

For each function that touches a client, prepend the appropriate client name to its signature in canonical order: `driver` before `mongo` before `s3` before `pc` before any LLM. Inside the body, rewrite `clients.driver` → `driver`, `clients.client` → `mongo`, etc.

**Before:**
```python
from app.core import clients

def fetch_profile_for_org(org_id):
    with clients.driver.session() as s:
        return list(s.run(f"MATCH (p:Profile {{org_id: '{org_id}'}}) RETURN p"))
```

**After:**
```python
def fetch_profile_for_org(driver, org_id):
    with driver.session() as s:
        return list(s.run(f"MATCH (p:Profile {{org_id: '{org_id}'}}) RETURN p"))
```

The `clients.driver.session()` sites at lines 87, 94, 104 (per spec §2.2 / §8 Phase G #1) carry the noted Cypher-injection risk — do NOT fix that here; spec §2.2 defers it to Phase G. Convert mechanically and leave the existing string-formatted Cypher in place.

- [ ] **Step 4: Update `backend/app/routers/profiles.py`**

Add `Depends()` arguments to every endpoint that calls a converted `profiles` function.

- [ ] **Step 5: Update tests**

Standard pattern: source-patches → overrides; direct service calls → positional mocks.

- [ ] **Step 6: Run the test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed.

- [ ] **Step 7: Verify grep invariants**

```bash
grep -nE "clients\.(driver|client|s3_client|pc|graph)" backend/app/services/profiles.py   # 0 hits
grep -n "from app.core.clients import upsert_node" backend/app/services/profiles.py        # 1 hit (intentional — re-pointed in commit 17)
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/profiles.py backend/app/routers/profiles.py backend/tests/
git commit -m "refactor(be): inject profiles service [phase F, commit 6/17]"
```

---

## Task 7: Convert `services/customer_profile.py`

Commit message: `refactor(be): inject customer_profile service [phase F, commit 7/17]`

7 `clients.*` sites. Has **forward-only cross-commit callee dependency** on `icp` helpers — `customer_profile` calls `_reserve_unique_icp_id` / `_ensure_icp_id_registry_indexes` / `_release_icp_id` (defined in `icp.py`, converted in commit 13). Until commit 13, those `icp` helpers still read module globals via the §3.7 fallback we'll add in commit 13. `customer_profile` itself uses the §3.4 simple form in this commit; it just doesn't pass any extra arg to the icp helpers yet.

When commit 13 lands, it patches the 11 call sites in `customer_profile.py` to pass `mongo` to the icp helpers. That patch is part of commit 13's diff, not this one.

**Files:**
- Modify: `backend/app/services/customer_profile.py`
- Modify: `backend/app/routers/customer_profile.py`
- Modify: matching test file(s)

- [ ] **Step 1: Inventory**

```bash
grep -nE "clients\.|llm_config\." backend/app/services/customer_profile.py
```

Expected: 7 sites.

```bash
grep -nE "_reserve_unique_icp_id|_ensure_icp_id_registry_indexes|_release_icp_id" backend/app/services/customer_profile.py
```

Expected: 11 call sites + 4 deferred-import lines (verified per spec §3.7 cross-commit table). Do **not** touch these in this commit — they get patched in commit 13.

- [ ] **Step 2: Identify callers**

```bash
grep -rnE "from app\.services\.customer_profile import|services\.customer_profile\." backend/app/
```

Spec §4.2 commit 7: "No cross-commit callers". Verify.

- [ ] **Step 3: Apply the §3.4 simple-form conversion to customer_profile's own client accesses**

7 sites get rewritten. Argument order: `driver` before `mongo`.

- [ ] **Step 4: Update `backend/app/routers/customer_profile.py`**

Standard `Depends()` injection. customer_profile typically touches Mongo (ICP storage) and possibly Neo4j.

- [ ] **Step 5: Update tests**

- Integration tests using `mock_neo4j` / `mock_mongo` / `mock_pinecone` / `mock_llm_config` (source-patches from `tests/conftest.py`) → switch to `mock_neo4j_via_override` / `mock_mongo_via_override` / `mock_pinecone_via_override` / `mock_llm_via_override` (added in Task 3).
- Unit tests in `backend/tests/unit/test_<service>.py` calling the service function directly: pass the mock client as a positional argument matching the new signature instead of relying on `mocker.patch` of `app.core.clients.…`.
- Don't migrate tests for *unconverted* services — leave them on the source-patch fixtures until their respective conversion commit lands. Commit 17 deletes the source-patch fixtures entirely.

- [ ] **Step 6: Run the test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed.

- [ ] **Step 7: Verify grep invariants**

```bash
grep -nE "clients\.(driver|client|s3_client|pc|graph)" backend/app/services/customer_profile.py   # 0 hits
# The 11 calls to icp helpers stay as-is until commit 13:
grep -cE "_reserve_unique_icp_id|_ensure_icp_id_registry_indexes|_release_icp_id" backend/app/services/customer_profile.py   # 15 (11 calls + 4 imports)
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/customer_profile.py backend/app/routers/customer_profile.py backend/tests/
git commit -m "refactor(be): inject customer_profile service [phase F, commit 7/17]"
```

---

## Task 8: Convert `services/_retrieval.py` (with §3.7 fallback)

Commit message: `refactor(be): inject _retrieval helper with fallback [phase F, commit 8/17]`

1 site (`clients.pc`). **First commit to use the §3.7 backward-compat fallback.** Callers in commits 12 (`market_research`), 13 (`icp`), 14 (`signals`) still call the old single-arg signature until they're converted. The fallback keeps the test suite green at every boundary.

**Files:**
- Modify: `backend/app/services/_retrieval.py`
- Test: existing tests should keep passing without changes (the fallback handles the unconverted callers)

- [ ] **Step 1: Inventory**

```bash
grep -nE "clients\.|llm_config\." backend/app/services/_retrieval.py
```

Expected: 1 site — `clients.pc` (Pinecone). The function is `_fetch_pinecone_supporting_context`.

- [ ] **Step 2: Apply the §3.7 fallback-form conversion**

Per spec §3.7, the converted function accepts `pc` as a `None`-defaulted first argument and falls back to `clients.pc` when not passed. The module-level `from app.core import clients` is already in scope; the fallback just reads `clients.pc` without a deferred import (per round-4 review).

**Before:**
```python
from app.core import clients

def _fetch_pinecone_supporting_context(queries, org_id, top_k=5):
    index = clients.pc.Index("brewra-org-knowledge")
    ...
```

**After:**
```python
from app.core import clients   # kept alive through commit 15 — required by fallback

def _fetch_pinecone_supporting_context(pc=None, queries=None, org_id=None, top_k=5):
    # queries/org_id are defaulted to None ONLY for Python's "no positional arg
    # after default arg" rule during the §3.7 coexistence window. Commit 17
    # (Task 16) restores them as mandatory along with deleting the pc=None default.
    if pc is None:
        pc = clients.pc   # Fallback for unconverted callers (commits 9–14 still call old signature).
                           # Commit 17 removes both the default and this fallback.
    index = pc.Index("brewra-org-knowledge")
    ...
```

Note: making `queries` and `org_id` default to `None` is required because Python prohibits non-default args after a default arg. Convention: pass them as keyword arguments at every call site to retain readability. The existing callers already use positional-or-keyword form so this is a behavior-preserving change. **Caveat:** during commits 8–14, a caller that accidentally omits `queries` or `org_id` would receive `None` instead of a `TypeError` and fail deep inside Pinecone with an opaque error. No new callers are added; the risk is bounded but worth knowing.

- [ ] **Step 3: Verify callers still work without modification**

```bash
grep -rn "_fetch_pinecone_supporting_context" backend/app/services/ | head
```

Expected callers (per spec §3.7 table):
- `services/icp.py` (3 sites — converted in commit 13)
- `services/signals.py` (3 sites — converted in commit 14)
- `services/market_research.py` (1 site — converted in commit 12)

Each of these still calls `_fetch_pinecone_supporting_context(queries=..., org_id=..., top_k=...)` with no `pc` arg. The fallback handles it.

- [ ] **Step 4: Run the test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed. The fallback path is exercised by every existing call site.

- [ ] **Step 5: Verify grep invariants**

```bash
grep -nE "clients\.pc" backend/app/services/_retrieval.py   # 1 hit (the fallback line) — removed in commit 17
grep -n "def _fetch_pinecone_supporting_context" backend/app/services/_retrieval.py   # 1 hit with pc=None default
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/_retrieval.py
git commit -m "refactor(be): inject _retrieval helper with fallback [phase F, commit 8/17]"
```

---

## Task 9: Convert `services/documents.py`

Commit message: `refactor(be): inject documents service [phase F, commit 9/17]`

18 usage sites — the largest non-LLM-heavy file. Touches Mongo (`clients.client`), S3 (`clients.s3_client`), Pinecone (`clients.pc`), Neo4j graph (`clients.graph` for `add_graph_documents` in the sibling function — see spec §3.6 final paragraph note), and the LLM transformer (`llm_config.llm_transformer`).

**Forward-only callee dependency** on `graph_chat.score_prospect` (converted in commit 11). Until commit 11, `documents.py:64` calls the old `score_prospect()` signature — that's fine because the call uses a lazy `from app.services.graph_chat import score_prospect` import that resolves to the unconverted function. **Commit 11 patches `documents.py:64`** to pass `driver`.

**Important per spec §3.6 final paragraph:** `process_file_to_embeddings` (lines 161-350) needs `(mongo, s3, pinecone, …)` — **no `driver`**. It does not access Neo4j. The sibling function above that does call `clients.graph.add_graph_documents` (line 60) is a separate conversion site within this same commit and needs `graph` injected.

**Files:**
- Modify: `backend/app/services/documents.py`
- Modify: `backend/app/routers/documents.py`
- Modify: matching test file(s)

- [ ] **Step 1: Inventory by function**

```bash
grep -nE "^def |^async def |clients\.|llm_config\." backend/app/services/documents.py
```

For each `def`/`async def` line, note which `clients.*` / `llm_config.*` lines fall between it and the next function definition. That tells you what each function needs.

Expected high-level breakdown (verified per spec §3.6 note + grep):
- One function (around line 60) uses `clients.graph` → needs `graph` injected
- `process_file_to_embeddings` (line 161) uses `clients.client`, `clients.s3_client`, `clients.pc` → needs `(mongo, s3, pinecone)` — no `driver`, no `graph`
- Other functions use various subsets — inventory each one

- [ ] **Step 2: Apply the §3.4 simple-form conversion**

For each function that touches a client, prepend that client to its signature in canonical order: `driver, graph, mongo, s3, pinecone, llm_transformer`. Skip any client a function doesn't use.

Example:
```python
# Before
async def process_file_to_embeddings(file_key, user_id, file_name, org_id, file_id):
    db = clients.client["File_Processing"]
    clients.s3_client.download_file(...)
    clients.pc.create_index(...)

# After
async def process_file_to_embeddings(mongo, s3, pinecone, file_key, user_id, file_name, org_id, file_id):
    db = mongo["File_Processing"]
    s3.download_file(...)
    pinecone.create_index(...)
```

- [ ] **Step 3: Apply the conversion to the LLM-transformer sites**

Find all `llm_config.llm_transformer.*` accesses and rewrite to use a new `llm_transformer` parameter. Argument order: clients first, then LLMs.

- [ ] **Step 4: Update `backend/app/routers/documents.py`**

Standard `Depends()` injection per endpoint. For the upload endpoint that schedules `process_file_to_embeddings` as a background task:

```python
from fastapi import BackgroundTasks, Depends
from app.core.dependencies import get_mongo, get_s3, get_pinecone

@router.post("/upload-document")
async def upload_document(
    ...,
    background_tasks: BackgroundTasks,
    mongo=Depends(get_mongo),
    s3=Depends(get_s3),
    pinecone=Depends(get_pinecone),
):
    ...
    background_tasks.add_task(
        services.documents.process_file_to_embeddings,
        mongo, s3, pinecone, file_key, user_id, file_name, org_id, file_id,
    )
```

For the endpoint that calls into `add_graph_documents` (uses `graph`), inject `get_neo4j_graph` and `get_llm_transformer` as needed.

- [ ] **Step 5: Update tests**

Documents has Phase E unit tests (`backend/tests/unit/test_documents*.py` likely). For each test:
- Integration tests: switch any `mocker.patch("app.core.clients.client"…)` for documents code paths to `mock_mongo_via_override`; same for S3/Pinecone.
- Unit tests: pass mocks positionally to the service function under test.

- [ ] **Step 6: Verify documents-→graph_chat caller is in the documents.py:64 region**

```bash
sed -n '60,75p' backend/app/services/documents.py
```

Confirm `score_prospect` is called there with no `driver` argument — that's the unconverted callsite until commit 11.

- [ ] **Step 7: Run the test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed.

- [ ] **Step 8: Verify grep invariants**

```bash
grep -nE "clients\.(driver|client|s3_client|pc|graph)" backend/app/services/documents.py   # 0 hits
grep -nE "llm_config\." backend/app/services/documents.py                                   # 0 hits
grep -nE "clients\.|llm_config\." backend/app/routers/documents.py                          # 0 hits (router code path)
```

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/documents.py backend/app/routers/documents.py backend/tests/
git commit -m "refactor(be): inject documents service [phase F, commit 9/17]"
```

---

## Task 10: Convert `services/leads.py` (with §3.7 fallback on `get_leads_for_org`)

Commit message: `refactor(be): inject leads service with get_leads_for_org fallback [phase F, commit 10/17]`

10 sites. **No background-task wiring in leads** — `BackgroundTasks` does not appear in `leads.py` or `routers/leads.py` (verified). Plain CRUD router.

**Forward-only callee dependency:** `get_leads_for_org` is called from `services/signals.py` (2 sites, converted in commit 14) and `services/market_scoring.py` (2 sites at lines 377 and 658, converted in commit 15). Therefore `get_leads_for_org` uses the §3.7 fallback form. The other 9 leads functions use the simple §3.4 form (they have no cross-commit callers).

`leads.py` also imports `upsert_node` from `app.core.clients` (re-pointed in commit 17) and may use `create_index` on the hot path at lines 255-256 (spec §2.2 carry-forward; **do not fix** here — Phase G).

**Files:**
- Modify: `backend/app/services/leads.py`
- Modify: `backend/app/routers/leads.py`
- Modify: matching test file(s)

- [ ] **Step 1: Inventory**

```bash
grep -nE "clients\.|llm_config\.|from app\.core\.clients import" backend/app/services/leads.py
```

Expected: 10 `clients.*` sites + 1 `upsert_node` import. No `llm_config.*`.

- [ ] **Step 2: Identify which function is `get_leads_for_org`**

```bash
grep -n "def get_leads_for_org" backend/app/services/leads.py
```

This function uses the fallback form. Every other function in leads uses the simple form.

- [ ] **Step 3: Cross-cutting prerequisite — keyword-promote `get_leads_for_org` callers in `signals.py` and `market_scoring.py`**

**Why this must come first:** the §3.7 fallback form for `get_leads_for_org` adds `driver=None` as the new *first* positional parameter. Spec §3.7's example shows callers like `get_leads_for_org(org_id, limit=5000, order_by_recent=True)` hitting the fallback — that example is misleading (**spec erratum**). Positional binding would map `org_id` (a string) → `driver`, the `if driver is None` check would be `False`, and the function would try `.session()` on a string. The fix is to keyword-promote the 4 call sites *before* adding the `driver=None` parameter, so the spec's stated "hits the fallback" behavior actually works.

```bash
grep -n "get_leads_for_org" backend/app/services/signals.py backend/app/services/market_scoring.py
```

Expected: 4 sites (signals.py lines 593-594, 730-731; market_scoring.py lines 377, 658).

For each site, change from positional `get_leads_for_org(org_id, limit=5000, order_by_recent=True)` to keyword `get_leads_for_org(org_id=org_id, limit=5000, order_by_recent=True)`. This is a 4-line drive-by that doesn't change behavior — `signals.py` and `market_scoring.py` still hit the §3.7 fallback path in `get_leads_for_org` until commits 14 and 15 update them to pass `driver` explicitly.

**Verification before continuing:**

```bash
grep -nE "get_leads_for_org\(org_id=" backend/app/services/signals.py backend/app/services/market_scoring.py   # must show 4 hits
grep -nE "get_leads_for_org\([a-z_]+," backend/app/services/signals.py backend/app/services/market_scoring.py   # must show 0 hits (no remaining positional calls)
```

- [ ] **Step 4: Apply the §3.7 fallback to `get_leads_for_org`**

Per spec §3.7 (with the cross-commit-caller bug fixed by Step 3):

```python
# Before
def get_leads_for_org(org_id, limit=None, order_by_recent=False):
    with clients.driver.session() as s:
        ...

# After (with fallback for cross-commit callers in commits 14, 15)
def get_leads_for_org(driver=None, org_id=None, limit=None, order_by_recent=False):
    if driver is None:
        driver = clients.driver   # commit 17 removes this and the default
    with driver.session() as s:
        ...
```

Callers in this commit (router endpoints in `routers/leads.py`) pass `driver` explicitly. The unconverted callers in `signals.py` and `market_scoring.py` — now using keyword form thanks to Step 3 — call `get_leads_for_org(org_id=org_id, limit=…, order_by_recent=…)`, leaving `driver` unbound. The fallback then reads `clients.driver`. This is the §3.7 form, working as intended.

- [ ] **Step 5: Apply the §3.4 simple form to the other 9 functions in `leads.py`**

Each gets `driver` (or `mongo`) prepended to its signature; bodies rewritten accordingly.

- [ ] **Step 6: Update `backend/app/routers/leads.py`**

Every endpoint that calls into `leads` adds `=Depends(get_neo4j_driver)` (and `=Depends(get_mongo)` if applicable). Endpoints calling `get_leads_for_org` now pass `driver` explicitly:

```python
return services.leads.get_leads_for_org(driver, org_id, limit=limit, order_by_recent=True)
```

- [ ] **Step 7: Update tests**

Standard pattern. The `mock_neo4j` fixture's source-patch on `app.core.clients.driver` is still effective for the fallback path (since the fallback reads `clients.driver`), so existing tests that don't go through the router may keep working without changes. Tests going through the router need the override fixture.

- [ ] **Step 8: Run the test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed.

- [ ] **Step 9: Verify grep invariants**

```bash
grep -nE "clients\.(driver|client|s3_client|pc|graph)" backend/app/services/leads.py   # 1 hit (the fallback line in get_leads_for_org)
grep -n "from app.core.clients import upsert_node" backend/app/services/leads.py        # 1 hit (re-pointed in commit 17)
grep -nE "get_leads_for_org\(org_id=" backend/app/services/signals.py backend/app/services/market_scoring.py   # 4 hits
```

- [ ] **Step 10: Commit**

```bash
git add backend/app/services/leads.py backend/app/routers/leads.py backend/app/services/signals.py backend/app/services/market_scoring.py backend/tests/
git commit -m "refactor(be): inject leads service with get_leads_for_org fallback [phase F, commit 10/17]"
```

---

## Task 11: Convert `services/graph_chat.py` and `routers/graph_chat.py`

Commit message: `refactor(be): inject graph_chat service and router [phase F, commit 11/17]`

The only commit with direct router-side client/LLM access. Per spec §2.1 item 5:
- **Router (`routers/graph_chat.py`) has 5 direct sites:**
  - 2 `llm_config.chain*.run(...)` calls (lines 34, 39)
  - 3 `from app.core.clients import query` direct imports (lines 45, 71, 103)
- **Service (`services/graph_chat.py`) has 2 sites**
- **Reverse-direction cross-commit:** `documents.py:64` calls `score_prospect` (already converted in commit 9 to its new signature, with a placeholder). This commit must update `documents.py:64` to pass `driver` explicitly.

**Also re-touches `backend/app/services/documents.py:38`** for the `query()` signature change. Commit 9 fully converted `documents.py` to take its own `driver` parameter, but the `query()` signature change in this commit propagates one more line at line 38 (where `documents.py` calls `query(query_string)` today; after this commit it must call `query(driver, query_string)`). This is a known cross-commit dependency, not a regression.

Per spec §2.1 item 5: "Where appropriate, the direct router-side data access is pushed into the corresponding service (matching the Phase B layer rule)." The 3 `query()` calls in the router are raw Cypher executions for chat-driven graph queries — they belong in the service layer.

**Files:**
- Modify: `backend/app/services/graph_chat.py`
- Modify: `backend/app/routers/graph_chat.py`
- Modify: `backend/app/services/documents.py` (update line 64 to pass `driver`)
- Modify: matching test file(s)

- [ ] **Step 1: Inventory router-side direct accesses**

```bash
grep -nE "from app\.core\.clients import|clients\.|llm_config\." backend/app/routers/graph_chat.py
```

Expected: 5 sites (3 imports + 2 chain calls).

- [ ] **Step 2: Push router-side `query()` calls into the service**

For each of the 3 `query(...)` call sites in the router (lines 45, 71, 103 currently), extract the Cypher and parameters into a new service function in `services/graph_chat.py`. Examples:

```python
# Before — in routers/graph_chat.py
from app.core.clients import query
...
result = query(f"MATCH (l:Lead {{org_id: '{org_id}'}}) RETURN count(l)")
```

```python
# After — service function in services/graph_chat.py
def count_leads_for_org(driver, org_id: str) -> int:
    from app.services._neo4j_helpers import query   # the function moves to _neo4j_helpers in commit 17; for now still at app.core.clients
    # ↑ during commit 11 only, this line says `from app.core.clients import query` instead; commit 17 fixes it
    result = query(driver, "MATCH (l:Lead {org_id: $org_id}) RETURN count(l) AS n", {"org_id": org_id})
    return result[0]["n"]
```

Note the `query()` signature is already changing to `query(driver, query_string, params=None)` per spec §2.1 item 9. Since the move to `_neo4j_helpers.py` happens in commit 17, the signature change is technically tied to that move. **But the `query` function's body in `clients.py` reads `driver` via module closure today** — we cannot defer the signature change without breaking the closure.

**Resolution:** in this commit, also update the `query` function in `app/core/clients.py` to its new signature `query(driver, query_string, params=None)`. Update the existing 2 service-side callers (`services/documents.py:38`, `services/graph_chat.py:24`) to pass `driver`. The 3 router-side callers go through the service layer rewrite above. After this commit, `query()` is fully converted and lives at its old location (`app/core/clients.py`) with the new signature; commit 17 moves it to `_neo4j_helpers.py` without further signature changes.

**Spec deviation note (erratum #4 from the plan header):** Spec §2.1 item 9 specifies `query(driver, query_string)` (two args only). This plan implements `query(driver, query_string, params=None)` — a backwards-compatible third parameter for parameterized Cypher queries. Rationale: (a) `session.run(query_string, params or {})` is semantically equivalent to `session.run(query_string)` when `params` is `None` or `{}`, so existing callers don't change behavior; (b) Phase G's Cypher-injection security work (spec §2.2 / §8 Phase G #1) needs parameterized queries — landing `params` here avoids re-touching every call site after `query()` relocates to `_neo4j_helpers.py` in commit 17. The deviation is documented in the plan header's "Known spec errata" section.

- [ ] **Step 3: Update the 2 chain.run() call sites in the router**

```python
# Before
result = llm_config.chain.run(question)
result2 = llm_config.chain2.run(question)

# After
from app.core.dependencies import get_chain, get_chain2

@router.post("/chat/text-graph")
def text_graph(
    body: TextGraphRequest,
    chain=Depends(get_chain),
    chain2=Depends(get_chain2),
):
    result = chain.run(body.question)
    ...
```

The Cypher-injection risk in `voice_graph`/`text_graph` (spec §2.2 / §8 Phase G #1) is **not fixed here** — Phase G. Just inject `chain`/`chain2` as `Depends()` providers.

- [ ] **Step 4: Update the 2 `clients.*` sites in `services/graph_chat.py`**

Standard §3.4 simple-form conversion.

- [ ] **Step 5: Update `documents.py:64` to pass `driver` to `score_prospect`**

Per spec §3.7 reverse-direction note. Find the call:

```bash
sed -n '60,70p' backend/app/services/documents.py
```

If the call looks like `score_prospect(org_id, lead_id)`, change it to:

```python
from app.services.graph_chat import score_prospect
# ...
# documents.py: the calling function needs `driver` in its own signature already
# (added in commit 9). Pass it through:
result = score_prospect(driver, org_id, lead_id)
```

If `score_prospect`'s converted signature in `services/graph_chat.py` is `score_prospect(driver, org_id, lead_id, …)`, this is mechanical.

- [ ] **Step 6: Run the test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed.

- [ ] **Step 7: Verify grep invariants**

```bash
grep -nE "clients\.|llm_config\." backend/app/routers/graph_chat.py   # 0 hits
grep -nE "from app\.core\.clients import" backend/app/routers/graph_chat.py   # 0 hits
grep -nE "clients\." backend/app/services/graph_chat.py   # 0 hits
grep -n "def query" backend/app/core/clients.py   # 1 hit, signature is `def query(driver, query_string, params=None):`
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/graph_chat.py backend/app/routers/graph_chat.py backend/app/services/documents.py backend/app/core/clients.py backend/tests/
git commit -m "refactor(be): inject graph_chat service and router [phase F, commit 11/17]"
```

---

## Task 12: Convert `services/market_research.py`

Commit message: `refactor(be): inject market_research service [phase F, commit 12/17]`

3 `llm_config.*` sites. **Updates 1 call site** to `_retrieval._fetch_pinecone_supporting_context` to pass `pc` explicitly (replacing the fallback path).

**Files:**
- Modify: `backend/app/services/market_research.py`
- Modify: `backend/app/routers/market_research.py`
- Modify: matching test file(s)

- [ ] **Step 1: Inventory**

```bash
grep -nE "clients\.|llm_config\.|_fetch_pinecone_supporting_context" backend/app/services/market_research.py
```

Expected: 3 `llm_config.*` sites + 1 `_fetch_pinecone_supporting_context` call (per spec §3.7 table).

- [ ] **Step 2: Apply the §3.4 simple-form conversion to the 3 LLM sites**

Each function touching `llm_config.llm` or `llm_config.llm2` gains the corresponding parameter.

- [ ] **Step 3: Update the `_fetch_pinecone_supporting_context` call site**

```python
# Before (uses the fallback)
ctx = _fetch_pinecone_supporting_context(queries=qs, org_id=org_id)

# After (passes pc explicitly)
ctx = _fetch_pinecone_supporting_context(pc, queries=qs, org_id=org_id)
```

market_research's calling function must already have `pc` in its own signature for this to work — so the conversion of the calling function (Step 2) prepends `pc` to its signature.

- [ ] **Step 4: Update `backend/app/routers/market_research.py`**

Inject `Depends(get_llm)` / `Depends(get_llm2)` / `Depends(get_pinecone)` on the affected endpoints; pass through to service calls.

- [ ] **Step 5: Update tests**

- Integration tests using `mock_neo4j` / `mock_mongo` / `mock_pinecone` / `mock_llm_config` (source-patches from `tests/conftest.py`) → switch to `mock_neo4j_via_override` / `mock_mongo_via_override` / `mock_pinecone_via_override` / `mock_llm_via_override` (added in Task 3).
- Unit tests in `backend/tests/unit/test_<service>.py` calling the service function directly: pass the mock client as a positional argument matching the new signature instead of relying on `mocker.patch` of `app.core.clients.…`.
- Don't migrate tests for *unconverted* services — leave them on the source-patch fixtures until their respective conversion commit lands. Commit 17 deletes the source-patch fixtures entirely.

- [ ] **Step 6: Run the test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed.

- [ ] **Step 7: Verify grep invariants**

```bash
grep -nE "clients\.|llm_config\." backend/app/services/market_research.py   # 0 hits
grep -n "_fetch_pinecone_supporting_context" backend/app/services/market_research.py   # 1 hit, passing pc
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/market_research.py backend/app/routers/market_research.py backend/tests/
git commit -m "refactor(be): inject market_research service [phase F, commit 12/17]"
```

---

## Task 13: Convert `services/icp.py` (7 dotted-access sites + 3 `_retrieval` call updates)

Commit message: `refactor(be): inject icp service [phase F, commit 13/17]`

7 `clients.*` / `llm_config.*` sites in `icp.py`. **Updates 3 call sites** to `_fetch_pinecone_supporting_context` (pass `pc`).

**Spec errata being corrected by this plan (no spec edit needed — flagged here only):**

1. Spec §4.2 commit 13 row says "patches `customer_profile.py`'s 7 call sites". Spec §3.7 table says "11 call sites". The 11 in §3.7 is the correct count (verified by grep — `_ensure_icp_id_registry_indexes` × 4 + `_reserve_unique_icp_id` × 6 + `_release_icp_id` × 1). The §4.2 cell is a stale count.

2. Spec §3.7 table claims these 11 call sites need patching in commit 13 to "pass `mongo` to icp's helpers." **This is wrong.** Verified by reading `app/services/icp.py:1101, 1107, 1134`: the three helpers take a pre-indexed `db` parameter (already in place today) and never read `clients.*` themselves. Therefore (a) the helpers' signatures **do not change** in commit 13, (b) customer_profile.py's 11 call sites **stay structurally as-is** (they already pass `db`), (c) the §3.7 fallback discussion **does not apply** to these helpers — they never read module globals to begin with.

What this commit actually does: convert icp.py's **7 dotted-access sites in functions OTHER than the 3 helpers** + update the 3 `_fetch_pinecone_supporting_context` call sites to pass `pc` explicitly + wire icp's router endpoints with `Depends()`. The 3 helpers themselves are untouched. customer_profile.py's call sites are untouched.

**Files:**
- Modify: `backend/app/services/icp.py` (convert the 7 dotted-access sites + update the 3 `_fetch_pinecone_supporting_context` calls)
- Modify: `backend/app/routers/icp.py`
- Modify: matching test file(s)

`backend/app/services/customer_profile.py` is **not** in the file list — Task 7 already converted it; no further changes here.

- [ ] **Step 1: Inventory**

```bash
grep -nE "clients\.|llm_config\." backend/app/services/icp.py
grep -nE "_fetch_pinecone_supporting_context" backend/app/services/icp.py
```

Expected: 7 sites of `clients.*` / `llm_config.*` (none of which are inside the 3 helpers at lines 1101, 1107, 1134 — verify by inspecting line numbers) + 3 `_fetch_pinecone_supporting_context` calls.

- [ ] **Step 2: Apply the §3.4 simple-form conversion to the 7 dotted-access sites**

Each function in icp.py that touches `clients.*` or `llm_config.*` (excluding the 3 helpers at 1101, 1107, 1134) gains the matching parameter(s) — typically `mongo` and/or `llm`. Argument order: clients first (`driver, mongo, s3, pc`), then LLMs (`llm, llm2, ...`).

The 3 helpers (`_ensure_icp_id_registry_indexes`, `_reserve_unique_icp_id`, `_release_icp_id`) are unchanged. They already take `db` as their first parameter, derived by the caller from `mongo`. Leave them alone.

- [ ] **Step 3: Update the 3 `_fetch_pinecone_supporting_context` call sites**

Each becomes `_fetch_pinecone_supporting_context(pc, queries=..., org_id=...)`. The calling function must already have `pc` in its signature from Step 2.

- [ ] **Step 4: Update `backend/app/routers/icp.py`**

Find which endpoints call into converted icp functions; inject `=Depends(get_mongo)`, `=Depends(get_pinecone)`, `=Depends(get_llm)`, etc. on each affected endpoint and pass through to service calls. The endpoints that only call into the 3 unconverted helpers (`_ensure_icp_id_registry_indexes` etc.) — usually none, since those are private — don't need new `Depends()`.

- [ ] **Step 5: Update tests**

- Integration tests using `mock_neo4j` / `mock_mongo` / `mock_pinecone` / `mock_llm_config` (source-patches from `tests/conftest.py`) → switch to `mock_neo4j_via_override` / `mock_mongo_via_override` / `mock_pinecone_via_override` / `mock_llm_via_override` (added in Task 3).
- Unit tests in `backend/tests/unit/test_icp.py` calling icp service functions directly: pass the mock client as a positional argument matching the new signature instead of relying on `mocker.patch` of `app.core.clients.…`.
- Tests of the 3 helpers (`_ensure_icp_id_registry_indexes`, etc.) don't change — those helpers' signatures don't change.

- [ ] **Step 6: Run the test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed.

- [ ] **Step 7: Verify grep invariants**

```bash
grep -nE "clients\.|llm_config\." backend/app/services/icp.py                    # 0 hits
grep -cE "_fetch_pinecone_supporting_context\(pc" backend/app/services/icp.py     # 3 hits
# Sanity check — the 3 helpers' signatures are unchanged:
grep -nE "^def (_ensure_icp_id_registry_indexes|_reserve_unique_icp_id|_release_icp_id)" backend/app/services/icp.py
# Expected: 3 lines, each starting with `def …(db, …)` — db is still the first parameter
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/icp.py backend/app/routers/icp.py backend/tests/
git commit -m "refactor(be): inject icp service [phase F, commit 13/17]"
```

---

## Task 14: Convert `services/signals.py` (3 `_retrieval` callers + 2 `leads` callers)

Commit message: `refactor(be): inject signals service [phase F, commit 14/17]`

17 `clients.*` / `llm_config.*` sites — the largest LLM-heavy file. **Updates 3 call sites** to `_fetch_pinecone_supporting_context` (pass `pc`). **Updates 2 call sites** to `get_leads_for_org` (lines 593-594, 730-731 per spec §3.7 table) to pass `driver` explicitly (replacing the keyword form added in Task 10).

**Files:**
- Modify: `backend/app/services/signals.py`
- Modify: `backend/app/routers/signals.py`
- Modify: matching test file(s)

- [ ] **Step 1: Inventory**

```bash
grep -nE "clients\.|llm_config\." backend/app/services/signals.py
grep -nE "_fetch_pinecone_supporting_context|get_leads_for_org" backend/app/services/signals.py
```

Expected: 17 sites + 3 `_fetch_pinecone_supporting_context` + 2 `get_leads_for_org`.

- [ ] **Step 2: Apply the §3.4 simple-form conversion**

Each function in signals.py touching `clients.*` / `llm_config.*` gains the matching parameter(s).

- [ ] **Step 3: Update the 3 `_fetch_pinecone_supporting_context` call sites**

Each becomes `_fetch_pinecone_supporting_context(pc, queries=..., org_id=...)`.

- [ ] **Step 4: Update the 2 `get_leads_for_org` call sites**

Currently (after Task 10): `get_leads_for_org(org_id=org_id, limit=5000, order_by_recent=True)` — uses the keyword form, hits the fallback.

Change to: `get_leads_for_org(driver, org_id=org_id, limit=5000, order_by_recent=True)`. The calling function must already have `driver` in its signature (added in Step 2).

- [ ] **Step 5: Update `backend/app/routers/signals.py`**

Inject `Depends(get_neo4j_driver)`, `Depends(get_pinecone)`, `Depends(get_llm)`, etc. on each endpoint; thread through to service calls.

- [ ] **Step 6: Update tests**

Standard pattern. Signals likely has Phase E unit tests.

- [ ] **Step 7: Run the test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed.

- [ ] **Step 8: Verify grep invariants**

```bash
grep -nE "clients\.|llm_config\." backend/app/services/signals.py                   # 0 hits
grep -nE "_fetch_pinecone_supporting_context\(pc" backend/app/services/signals.py   # 3 hits
grep -nE "get_leads_for_org\(driver" backend/app/services/signals.py                # 2 hits
```

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/signals.py backend/app/routers/signals.py backend/tests/
git commit -m "refactor(be): inject signals service [phase F, commit 14/17]"
```

---

## Task 15a: Convert `services/market_scoring.py` — helpers and relocation

Commit message: `refactor(be): inject market_scoring helpers and relocate _ensure_market_scoring_indexes [phase F, commit 15a/17]`

> **Spec deviation:** this task introduces temporary §3.7-style fallbacks (`mongo=None` defaults) on the 8 market_scoring helpers, contradicting spec §3.6's "no §3.7 fallback for market_scoring internals" promise. The deviation exists solely because we split commit 15 in two — Task 15b removes the fallbacks. See the detailed spec-deviation note in Step 2 below and the §7.1-grep-timing clarification later in this task.

First half of the market_scoring conversion per spec §4.2 commit-15 row. Converts the 8 helper functions plus relocates `_ensure_market_scoring_indexes` from `app/main.py` to `app/services/market_scoring.py`. Does NOT touch the 3 router-callable functions, `_run_market_scoring_for_org`, or `routers/market_scoring.py` — those are 15b.

Scope per spec §3.6 function table:
- `_get_market_score_collections(mongo)` — gains `mongo`
- `_get_lead_identity_from_neo4j(driver, …)` — gains `driver`
- `_get_latest_market_score_rows(driver, mongo, …)` — gains `driver, mongo`
- `_get_latest_scoring_run(mongo, …)` — gains `mongo`
- `get_company_profile_for_org(driver, …)` — gains `driver`
- `get_market_reports_for_org(mongo, …)` — gains `mongo`
- `score_single_lead_against_market(llm2, …)` — gains `llm2`
- `_persist_market_score_for_lead(driver, mongo, …, score_coll=None)` — gains `driver, mongo` (existing `score_coll=None` stays as last kwarg)

Plus: `_ensure_market_scoring_indexes` moves from `app/main.py:158` to `app/services/market_scoring.py` with `(mongo)` signature.

**Files:**
- Modify: `backend/app/services/market_scoring.py` (8 helper conversions + `_ensure_market_scoring_indexes` addition)
- Modify: `backend/app/main.py` (remove `_ensure_market_scoring_indexes` definition from main; the `@app.on_event("startup")` hook stays for now, but it imports the function from its new location)
- Test: existing tests should keep passing (the synchronous router-callable functions and `_run_market_scoring_for_org` still hit the unconverted code paths in 15b)

**Caveat:** the 3 router-callable functions (`trigger_or_get_market_scores`, `get_market_scores_status`, `get_lead_market_score_descriptions`) and `_run_market_scoring_for_org` haven't been converted yet (15b). They still call the helpers using the **old** calling convention. To keep them working through 15a, the converted helpers need temporary fallback shims (§3.7 form) **only for this in-flight commit pair**:

**Spec deviation note:** spec §3.6 promises "all internal market_scoring functions use the §3.4 simple form — no §3.7 fallback." That promise holds at the *task* level (after Task 15b completes). It deviates at the *commit-15a boundary* because we split commit 15 in two. The spec's §7.1 hard-grep acceptance criterion (`def \w+\([^)]*\b(driver|mongo|llm2)=None`) is **only run at Task 16 Step 10 (final cleanup)** — running it at the 15a boundary would show 8 hits, which is expected and intentional. The fallbacks are removed in Task 15b Step 6; from Task 15b onward, the grep returns 0 hits for market_scoring.py.

```python
def _get_market_score_collections(mongo=None):
    if mongo is None:
        mongo = clients.client   # removed in 15b along with the default
    profiler_db = mongo["Profiler"]
    return profiler_db["Lead_Market_Scores"], profiler_db["Lead_Market_Score_Runs"]
```

Apply the same fallback to all 8 converted helpers. They're only fallback-needed during the 15a↔15b boundary; 15b removes the defaults.

- [ ] **Step 1: Inventory**

```bash
grep -nE "^def |clients\.|llm_config\.|_get_market_score_collections|get_leads_for_org" backend/app/services/market_scoring.py | head -60
```

- [ ] **Step 2: Apply the conversion with §3.7-style fallback to each of the 8 helpers**

Pattern (using `_get_market_score_collections` as example):

```python
# Before
def _get_market_score_collections():
    profiler_db = clients.client["Profiler"]
    return profiler_db["Lead_Market_Scores"], profiler_db["Lead_Market_Score_Runs"]

# After (15a)
def _get_market_score_collections(mongo=None):
    if mongo is None:
        mongo = clients.client   # removed in 15b (15b updates all callers; this fallback bridges 15a→15b)
    profiler_db = mongo["Profiler"]
    return profiler_db["Lead_Market_Scores"], profiler_db["Lead_Market_Score_Runs"]
```

Each of the other 7 helpers gets the analogous fallback.

- [ ] **Step 3: Add `_ensure_market_scoring_indexes(mongo)` to `market_scoring.py`**

Place it near the top of the file (after imports, before `_get_market_score_collections`):

```python
def _ensure_market_scoring_indexes(mongo) -> None:
    """Create Mongo indexes for Lead_Market_Scores and Lead_Market_Score_Runs.
    Called from app.main.lifespan and from the legacy @app.on_event hook
    (both alive through commit 17). Idempotent.
    """
    if mongo is None:
        return
    score_coll, run_coll = _get_market_score_collections(mongo)
    score_coll.create_index([("org_id", 1), ("lead_id", 1)], unique=True)
    score_coll.create_index([("org_id", 1), ("updated_at", -1)])
    run_coll.create_index([("org_id", 1), ("status", 1)])
    run_coll.create_index([("org_id", 1), ("created_at", -1)])
```

- [ ] **Step 4: Update `app/main.py` to call the relocated function**

Find the `@app.on_event("startup") def _ensure_market_scoring_indexes():` block. Replace its body with a delegation to the new location:

```python
@app.on_event("startup")
def _ensure_market_scoring_indexes_startup() -> None:
    """Legacy on_event hook — still alive through commit 17.
    Delegates to the relocated function in app.services.market_scoring."""
    if os.getenv("BREWRA_SKIP_DB_INIT") or clients.client is None:
        return
    from app.services.market_scoring import _ensure_market_scoring_indexes
    _ensure_market_scoring_indexes(clients.client)
```

Rename the wrapper to `_ensure_market_scoring_indexes_startup` to avoid collision with the imported function name. The lifespan in `app/main.py` (from Task 2) also calls this function — update its body to import from the new location:

```python
# In the lifespan body, replace the inline create_index calls with:
from app.services.market_scoring import _ensure_market_scoring_indexes
_ensure_market_scoring_indexes(app.state.clients.client)
```

- [ ] **Step 5: Run the test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed. The 15a↔15b fallbacks keep unconverted callers (the 3 router-callable functions and `_run_market_scoring_for_org`) working.

- [ ] **Step 6: Verify grep invariants**

```bash
grep -n "def _ensure_market_scoring_indexes" backend/app/services/market_scoring.py   # 1 hit
grep -n "def _ensure_market_scoring_indexes" backend/app/main.py                       # 0 hits (the wrapper is now `_ensure_market_scoring_indexes_startup`)
grep -cE "(mongo|driver|llm2)=None" backend/app/services/market_scoring.py             # 8 hits (one per helper's fallback)
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/market_scoring.py backend/app/main.py
git commit -m "refactor(be): inject market_scoring helpers and relocate _ensure_market_scoring_indexes [phase F, commit 15a/17]"
```

---

## Task 15b: Convert market_scoring router-callable functions, background task, and router

Commit message: `refactor(be): inject market_scoring router-callable functions and background task [phase F, commit 15b/17]`

Second half. Converts:
- `trigger_or_get_market_scores(request, background_tasks, driver, mongo, llm2)` — sync router-called
- `get_market_scores_status(driver, mongo, …)` — sync router-called
- `get_lead_market_score_descriptions(mongo, …)` — sync router-called
- `_run_market_scoring_for_org(driver, mongo, llm2, …)` — background task

Plus `routers/market_scoring.py` wiring (two-layer pattern per spec §3.6).

Then removes the 15a fallbacks (all 8 helpers go from `mongo=None` to mandatory `mongo`).

Also updates the 2 `get_leads_for_org` call sites in `market_scoring.py` (line 377 in `get_market_scores_status`, line 658 in `_run_market_scoring_for_org`) to pass `driver` explicitly (replacing the keyword form added in Task 10).

**Files:**
- Modify: `backend/app/services/market_scoring.py` (4 function conversions + remove 8 helper fallbacks + 2 `get_leads_for_org` call site updates)
- Modify: `backend/app/routers/market_scoring.py` (two-layer pattern)
- Modify: matching test file(s)

- [ ] **Step 1: Convert `trigger_or_get_market_scores`**

Per spec §3.6 worked example:

```python
def trigger_or_get_market_scores(request, background_tasks, driver, mongo, llm2):
    _, run_coll = _get_market_score_collections(mongo)
    rows = _get_latest_market_score_rows(driver, mongo, request.org_id)
    # ...existing decision logic about whether to schedule a run...
    background_tasks.add_task(
        _run_market_scoring_for_org,
        driver, mongo, llm2, request.user_id, request.org_id, run_id,
    )
```

Adjust the internal calls (`_get_latest_market_score_rows`, etc.) to pass through `driver` and `mongo`. Once these explicit args land, the 15a fallbacks become unreachable from this caller.

- [ ] **Step 2: Convert `get_market_scores_status`**

Same shape — gain `driver, mongo` parameters; thread to `_get_market_score_collections(mongo)` and the line-377 `get_leads_for_org(driver, org_id=org_id, …)` call.

- [ ] **Step 3: Convert `get_lead_market_score_descriptions`**

Gain `mongo` parameter; thread to `_get_market_score_collections(mongo)`.

- [ ] **Step 4: Convert `_run_market_scoring_for_org`**

Per spec §3.6 worked example:

```python
def _run_market_scoring_for_org(driver, mongo, llm2, user_id, org_id, run_id) -> None:
    score_coll, run_coll = _get_market_score_collections(mongo)
    leads = get_leads_for_org(driver, org_id=org_id, limit=5000, order_by_recent=True)
    company_profile = get_company_profile_for_org(driver, org_id)
    market_reports = get_market_reports_for_org(mongo, user_id, org_id)
    for lead in leads:
        scoring_payload = score_single_lead_against_market(llm2, lead, company_profile, market_reports)
        _persist_market_score_for_lead(driver, mongo, user_id, org_id, lead, scoring_payload, run_id, score_coll=score_coll)
```

The Phase D `try/except BrewraError: log+continue` outer wrapper stays exactly as it is.

- [ ] **Step 5: Update `backend/app/routers/market_scoring.py` to the two-layer pattern**

```python
from app.core.dependencies import get_neo4j_driver, get_mongo, get_llm2

@router.post("/leads/market-scores")
def get_or_refresh_lead_market_scores(
    request: LeadMarketScoresRequest,
    background_tasks: BackgroundTasks,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    llm2=Depends(get_llm2),
):
    return market_scoring_service.trigger_or_get_market_scores(
        request, background_tasks, driver, mongo, llm2,
    )


@router.get("/leads/market-scores/status")
def get_status(
    user_id: str = Query(...),
    org_id: str = Query(...),
    run_id: str | None = Query(None),
    recent_items_limit: int = Query(50),
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
):
    return market_scoring_service.get_market_scores_status(
        driver, mongo, user_id, org_id, run_id, recent_items_limit,
    )


@router.get("/leads/market-scores/{lead_id}/descriptions")
def get_descriptions(
    lead_id: str,
    user_id: str = Query(...),
    org_id: str = Query(...),
    mongo=Depends(get_mongo),
):
    return market_scoring_service.get_lead_market_score_descriptions(
        mongo, lead_id, user_id, org_id,
    )
```

- [ ] **Step 6: Remove the 15a fallbacks from the 8 helpers**

For each of the 8 helpers, change `mongo=None` → `mongo` (mandatory) and delete the `if mongo is None: mongo = clients.client` line. Same pattern for `driver=None` / `llm2=None` etc.

- [ ] **Step 7: Run the test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed.

- [ ] **Step 8: Verify grep invariants**

```bash
grep -nE "clients\.|llm_config\." backend/app/services/market_scoring.py                 # 0 hits
grep -nE "clients\.|llm_config\." backend/app/routers/market_scoring.py                  # 0 hits
grep -cE "(driver|mongo|llm2)=None" backend/app/services/market_scoring.py               # 0 hits (15a fallbacks removed; `score_coll=None` is on _persist_market_score_for_lead — see next grep)
grep -n "score_coll=None" backend/app/services/market_scoring.py                          # 1 hit (the existing optimization param on _persist_market_score_for_lead, intentional)
grep -nE "get_leads_for_org\(driver" backend/app/services/market_scoring.py              # 2 hits (lines 377, 658)
```

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/market_scoring.py backend/app/routers/market_scoring.py backend/tests/
git commit -m "refactor(be): inject market_scoring router-callable functions and background task [phase F, commit 15b/17]"
```

---

## Task 16: Cleanup — delete globals, fallbacks, `on_event`; move helpers to `_neo4j_helpers`

Commit message: `refactor(be): remove module globals and complete DI migration [phase F, commit 17/17]`

Final commit. The five things that happen here, all together:
1. Delete module-level construction at the bottom of `app/core/clients.py` and `app/core/llm_config.py`. The factories remain.
2. Delete every §3.7 fallback `if X is None: X = clients.X` block across `services/_retrieval.py`, `services/leads.py` (and any other service that picked up a fallback).
3. Delete every `=None` default on previously-fallback'd service-function client parameters.
4. Move `query`, `results_to_string`, `escape_property_name`, `upsert_node` from `app/core/clients.py` to a new `app/services/_neo4j_helpers.py`. Update all import sites.
5. Delete the deprecated `@app.on_event("startup")` block from `app/main.py`. Retire TD-003 in `docs/TECH_DEBT.md`.

**Files:**
- Modify: `backend/app/core/clients.py` (delete module-level state; trim to factory + dataclass + helpers-that-stayed)
- Modify: `backend/app/core/llm_config.py` (delete module-level state; trim to factory + dataclass)
- Create: `backend/app/services/_neo4j_helpers.py` (with `query`, `results_to_string`, `escape_property_name`, `upsert_node`)
- Modify: every file that imports the 4 helpers from `app.core.clients` (10+ files; see spec §2.1 item 9 and grep)
- Modify: `backend/app/services/_retrieval.py` (remove `pc=None` default + fallback)
- Modify: `backend/app/services/leads.py` (remove `driver=None` default + fallback on `get_leads_for_org`)
- Modify: `backend/app/main.py` (delete `@app.on_event("startup")` block, delete the legacy module-import-time `clients.graph.refresh_schema()` line if still present)
- Modify: `docs/TECH_DEBT.md` (mark TD-003 resolved)
- Modify: any test files still containing `mocker.patch("app.core.clients.…")` or `mocker.patch("app.core.llm_config.…")` — delete those patches

- [ ] **Step 1: Create `backend/app/services/_neo4j_helpers.py`**

Move the 4 functions from `app/core/clients.py`. Pattern matches existing underscore-prefixed helper modules (`_retrieval`, `_claude_budget`, `_llm_helpers`).

```python
"""Neo4j query helpers — moved here from app.core.clients in Phase F commit 17.

These are query utilities, not clients. `query()` now takes `driver` explicitly
because the old module-level closure no longer exists."""
from typing import Any


def query(driver, query_string: str, params: dict | None = None) -> list[dict]:
    """Execute a Cypher query and return rows as dicts. New signature: driver
    is explicit (was a module-level closure in clients.py before Phase F)."""
    with driver.session() as session:
        result = session.run(query_string, params or {})
        return [record.data() for record in result]


def results_to_string(results: list[dict]) -> str:
    """Render Neo4j results as a readable string."""
    return "\n".join(str(r) for r in results)


def escape_property_name(name: str) -> str:
    """Escape a Cypher property name for safe interpolation."""
    return f"`{name.replace('`', '``')}`"


def upsert_node(tx, label: str, properties: dict) -> Any:
    """Upsert a Neo4j node. `tx` is a transaction object (already takes a tx
    arg, no new arg needed)."""
    # ...existing body copied verbatim from clients.py:81-136...
```

Copy the existing bodies of `query`, `results_to_string`, `escape_property_name`, `upsert_node` from `app/core/clients.py` into this new file. The only signature change is on `query()` (already applied in Task 11). The other 3 functions transfer as-is.

- [ ] **Step 2: Update every import of these 4 functions**

```bash
grep -rln "from app\.core\.clients import \(query\|upsert_node\|results_to_string\|escape_property_name\)" backend/app/
```

Expected files (per spec §2.1 item 9):
- `services/leads.py`
- `services/market_scoring.py`
- `services/profiles.py`
- `services/documents.py` (for `query`)
- `services/graph_chat.py` (for `query`)
- `routers/graph_chat.py` (should have 0 — already removed in Task 11)

For each file, change `from app.core.clients import query` (or the other helper names) to `from app.services._neo4j_helpers import query`.

- [ ] **Step 3: Delete the 4 functions and module-level state from `app/core/clients.py`**

After this step, `clients.py` contains:
- imports
- `ClientBundle` dataclass
- `build_clients()` factory
- nothing else

The bottom-of-file module-level construction (Task 1 Step 3) gets deleted. No more `driver = ...`, `graph = ...`, etc. at module scope.

- [ ] **Step 4: Delete module-level state from `app/core/llm_config.py`**

After this step, `llm_config.py` contains:
- imports
- the 4 Cypher prompt-template string constants (`Cypher_Prompt`, `Cypher_Prompt2`, `qa_prompt`, `qa_prompt2`)
- `LLMBundle` dataclass
- `build_llm_config()` factory
- nothing else

The bottom-of-file module-level `llm = ChatGroq(...)`, etc. all delete.

- [ ] **Step 5: Remove fallbacks from converted services**

For each service file that has a `(driver|mongo|llm|llm2|pc|s3|graph)=None` default plus an `if X is None: X = clients.X` fallback, remove both. Spec §3.7 §7.1 grep:

```bash
grep -rnE "if (driver|mongo|llm|llm2|pc|s3|graph) is None:" backend/app/services/
grep -rnE "def \w+\([^)]*\b(driver|mongo|llm|llm2|pc|s3|graph)=None" backend/app/services/
```

Both greps should be empty after this step (modulo `score_coll=None` on `_persist_market_score_for_lead`, which is the existing optimization parameter and stays).

Verified files needing this cleanup:
- `services/_retrieval.py` — `_fetch_pinecone_supporting_context(pc=None, …)` → `(pc, queries, org_id, top_k=5)`
- `services/leads.py` — `get_leads_for_org(driver=None, …)` → `(driver, org_id, limit=None, order_by_recent=False)`

- [ ] **Step 6: Delete the `@app.on_event("startup")` block from `app/main.py`**

Find and remove the entire `@app.on_event("startup") def _ensure_market_scoring_indexes_startup(): ...` block. Also remove the legacy module-import-time `if clients.graph is not None: clients.graph.refresh_schema()` block if it's still present (lifespan now handles this).

Also remove the legacy `from app.core import clients` import in `app/main.py` if it's no longer referenced. The lifespan reads from `app.state` via the dependency providers; main.py itself shouldn't need to touch `clients` directly anymore.

- [ ] **Step 7: Mark TD-003 resolved in `docs/TECH_DEBT.md`**

```bash
sed -n '69,90p' /projects/Brewra/brewra-gtm-intelligence/docs/TECH_DEBT.md
```

Find the TD-003 entry. Add a new line near the top:

```markdown
## TD-003 — Startup hooks use deprecated `@app.on_event` API

**Resolved 2026-05-22 by Phase F.** `lifespan` context manager replaces both `@app.on_event("startup")` and the module-import-time `clients.graph.refresh_schema()` call. See `plans/modularization-plan-6.md` Task 16.

<original-text-of-TD-003-stays-below-for-historical-record>
...
```

- [ ] **Step 8: Delete stale source-patch fixtures from `tests/conftest.py` and `tests/unit/conftest.py`**

The existing `mock_neo4j`, `mock_mongo`, `mock_s3`, `mock_pinecone`, `mock_llm_chain`, `mock_llm_config` fixtures rely on `mocker.patch("app.core.clients.…")` — now patching attributes that no longer exist. Delete these fixtures. Any test still depending on them was either:
- (a) ported to the override fixtures in earlier commits (now passing), or
- (b) overlooked — and will fail at this commit.

For (b), update the test to use the override fixture; do not restore the source-patch.

Also delete any `mocker.patch("app.core.clients.…")` or `mocker.patch("app.core.llm_config.…")` calls inside test bodies.

```bash
grep -rnE "mocker\.patch.*app\.core\.(clients|llm_config)" backend/tests/   # must return 0 hits after this step
```

- [ ] **Step 9: Run the full test suite**

```bash
pytest tests/ -q
```

Expected: 203 passed. If anything fails:
- Most likely a test fixture that wasn't migrated in earlier commits — port it now.
- Or a `backend/scripts/*.py` script that imports module globals (spec §7.4 open question 1) — refactor it to call `build_clients()` directly.

- [ ] **Step 10: Verify all spec §7.1 hard acceptance criteria**

Run every grep from spec §7.1:

```bash
cd /projects/Brewra/brewra-gtm-intelligence

# 1. No whole-module import of clients/llm_config across app code
git grep -E "^from app\.core import (clients|llm_config)( |,|$)" backend/app/   # expected: empty
git grep -E "^import app\.core\.(clients|llm_config)( |$)" backend/app/         # expected: empty

# 2. No qualified module-access in services or routers
git grep -E "(^|[ (])clients\.(driver|client|s3_client|pc|graph)" backend/app/services backend/app/routers   # expected: empty
git grep -E "(^|[ (])llm_config\.(llm|llm2|llm_transformer|vision|memory|agent_chain|chain|chain2)" backend/app/services backend/app/routers   # expected: empty

# 2b. No direct-import sites of moved helpers
git grep -E "from app\.core\.clients import (query|upsert_node|results_to_string|escape_property_name)" backend/app/   # expected: empty

# 2c. No backward-compat fallback defaults
git grep -E "def \w+\([^)]*\b(driver|mongo|llm|llm2|pc|s3|graph)=None" backend/app/services/   # expected: empty
git grep -E "if (driver|mongo|llm|llm2|pc|s3|graph) is None:" backend/app/services/             # expected: empty

# 3. TD-003 retired
git grep "@app.on_event" backend/app/   # expected: empty
git grep "lifespan" backend/app/main.py   # expected: 1+ hits

# 4. No source-patches at the old module targets
git grep -E "mocker\.patch.*app\.core\.(clients|llm_config)" backend/tests/   # expected: empty
```

Any grep that doesn't match expectations: fix in-place and re-run before committing.

- [ ] **Step 11: Verify all spec §7.2 soft acceptance criteria manually**

- `app/core/clients.py` contains only `ClientBundle`, `build_clients`, and imports. Confirm with `wc -l` (should be ~80 lines vs. the ~155 before this task).
- `app/core/llm_config.py` contains only `LLMBundle`, `build_llm_config`, imports, and the 4 Cypher prompt-template constants.
- `app/core/dependencies.py` has all 12 providers.
- `_ensure_market_scoring_indexes` lives in `app/services/market_scoring.py`.
- `app/services/_neo4j_helpers.py` has the 4 moved helpers.
- `app/main.py` defines `lifespan` and passes it to `FastAPI(lifespan=...)`.
- Session-scope autouse leak-detection fixture is in `tests/conftest.py`.
- `docs/TECH_DEBT.md` TD-003 marked resolved.

- [ ] **Step 12: Commit**

```bash
git add backend/app/core/clients.py backend/app/core/llm_config.py backend/app/main.py \
        backend/app/services/_neo4j_helpers.py backend/app/services/_retrieval.py backend/app/services/leads.py \
        backend/app/services/ backend/app/routers/ backend/tests/ docs/TECH_DEBT.md
git commit -m "refactor(be): remove module globals and complete DI migration [phase F, commit 17/17]"
```

---

## Post-execution sanity check

> **Preamble:** These checks assume the **branch-accumulation workflow** — all 17 commits are still on `refactor-backend-modularization-phase-f`, not yet merged to `master`. If you followed the recommended **per-commit merge cadence** (plan header), each commit was already verified green at merge time, so the commit-count and bisectability checks below are redundant. In that case: skip to the "Merge to master" fallback step (which becomes a no-op), confirm `git log --oneline --grep="\[phase F, commit"` on `master` shows 17 Phase F commits, and you're done.

- [ ] **Full grep + test sweep**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
cd backend && pytest tests/ -q 2>&1 | tail -3                         # 203 passed
git log --oneline master..HEAD | wc -l                                # 16 or 17 commits
git log --oneline master..HEAD                                        # readable history; each commit standalone
```

- [ ] **Bisectability spot-check (concrete commits 5, 10, 14)**

Verify three boundary commits are independently green: commit 5 (`org_auth` — first non-warm-up conversion), commit 10 (`leads` — first commit to introduce the §3.7 fallback), and commit 14 (`signals` — last LLM-heavy commit before the market_scoring split).

```bash
for offset in 5 10 14; do
    sha=$(git log --oneline master..HEAD --reverse | sed -n "${offset}p" | awk '{print $1}')
    echo "=== commit ${offset} (${sha}) ==="
    git checkout "$sha" && (cd backend && pytest tests/ -q 2>&1 | tail -1)
done
git checkout refactor-backend-modularization-phase-f   # return to tip
```

Each `tail -1` line should report `203 passed`. If any commit reports fewer or any failure, that commit broke bisectability — investigate before merging. (For exhaustive verification, replace the `for offset in 5 10 14` line with `for offset in $(seq 1 17)`.)

- [ ] **Final merge to master (fallback — only if per-commit merging was skipped)**

The per-task merge cadence described in the plan header is the preferred path: as each task lands green on the branch, the CTO fast-forwards `master` to it immediately, keeping the dual-construction window short. If for any reason all 17 commits accumulated on the branch through to end of execution, do the catch-up merge now:

```bash
git checkout master
git merge --ff-only refactor-backend-modularization-phase-f
# Or, if non-FF history is acceptable:
# git merge --no-ff refactor-backend-modularization-phase-f -m "Merge Phase F: dependency injection + lifespan"
```

Push when ready. Tracker branches (`develop`, `production`) are not touched per CLAUDE.md "Discipline rule".

---

## Risks and rollback notes

- **Abort condition.** If a service-conversion commit fails the test suite after a reasonable amount of debugging (>1 hour or >3 fix attempts on the same task) AND the failure is not attributable to spec/code drift documented in pre-flight, pause and escalate. Each task is independently revertable; one stuck task does not invalidate completed ones. Don't push through an unexplained red test suite — diagnose the root cause or get a second pair of eyes.

- **Commit 17 is the only irreversible-feeling step.** All other commits leave module globals alive — a `git revert` of any of commits 4–15 just undoes one domain's conversion. If commit 17 reveals a hidden consumer (a `backend/scripts/*.py` reaching into globals), the right fix is to refactor that script to call `build_clients()` directly, then re-apply commit 17. Don't revert; fix forward.

- **The dual-construction window (commits 2–15) doubles boot resource use** in production: two Neo4j Bolt handshakes, two Mongo connection-pool reservations, two `verify_connectivity()` calls. This is acceptable per spec §6 Risk 9 — merge each commit to `master` immediately to keep the window short.

- **Memory-divergence sub-risk during dual-construction window (commits 2–15).** Both the module-level `LLMBundle` and the lifespan `LLMBundle` instantiate independent `ConversationBufferMemory` objects. Unconverted services that still reach `llm_config.chain` / `llm_config.chain2` use the module-level memory; converted services that get `chain`/`chain2` via `Depends()` use the lifespan memory. The two memories accumulate independently. The risk is bounded because chain invocations are stateless from request to request (each call rebuilds the conversation context from the request payload), so the divergence has no user-visible effect during the transition. Document here as a known transient state, not a blocker.

- **Spec §7.4 open questions** (resolvable during execution):
  1. Grep `backend/scripts/` for `from app.core.clients import` or `import app.core.clients`. If anything matches, refactor those scripts in commit 17.
  2. Same for admin tools (`admin_panel.html` request handlers chained from `app/api.py` or routers — already covered by service conversions but verify with grep).
  3. `_SKIP_DB_INIT` constant references outside `clients.py`. Grep on commit 1.
  4. Position of the leak-detection autouse fixture. Default to root `tests/conftest.py` (applies to both unit and integration); already done in Task 3.
