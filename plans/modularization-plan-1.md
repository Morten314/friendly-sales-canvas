# Backend Modularization Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `backend/api.py` (4,995 LOC) + `backend/services.py` (2,632 LOC) into a domain-modular FastAPI app under `backend/app/` with 11 router/service module pairs, preserving behavior exactly. The existing characterization-test suite is the contract.

**Architecture:** Two-phase split. Phase A (this plan) is pure structural: move files, change `@app.X` to `@router.X`, mount routers from a single `app/main.py`. No behavior changes, no dependency injection, no cleanups. Phase B (separate future plan `modularization-plan-2.md`) handles dedupe, DI, security hardening, etc. Each commit on the feature branch keeps the test suite green; the branch is bisectable.

**Tech Stack:**
- FastAPI `APIRouter` for per-domain routing modules
- pytest + pytest-mock for the safety net (existing suite at `backend/tests/`)
- Reference spec: `specs/2026-05-12-backend-modularization-design.md`
- Naming series: `modularization-plan-1.md` (this), `modularization-plan-2.md` (phase B, future)

**Branch:** `refactor/backend-modularization-phase-a` off `master`. No squash on merge.

---

## Note on line numbers

Hard line numbers in this plan (`api.py:NNNN-MMMM`, `services.py:NNNN-MMMM`) reference the **pre-refactor** state captured at plan-writing time. They are accurate for Tasks 0-4. After Task 4 deletes the first route block, every subsequent line number shifts.

**Locate every route, helper, or function via grep before deletion:**

- Routes: `grep -nE '^@app\.(get|post|put|delete)\("<path>"' backend/api.py`
- Functions: `grep -nE '^(async )?def <name>' backend/api.py backend/services.py`
- Module-level constants: `grep -nE '^<NAME> = ' backend/services.py`

The verification grep at the end of each task's delete-step is the source of truth for "did I delete the right thing." Line numbers in the plan are hints, not coordinates.

---

## Pre-flight: Census and Baseline

Before any moves, build the patch-target census and capture a clean test baseline. This is **not** a commit — it's a 15-minute exercise that surfaces hidden import sites and prevents silent test no-ops mid-refactor.

### Task 0: Pre-flight audit and baseline

**Files:**
- Read-only: `backend/tests/conftest.py`, `backend/api.py`, `backend/services.py`, `backend/tests/test_*.py`

- [ ] **Step 1: Create the feature branch**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master
git pull --rebase
git checkout -b refactor/backend-modularization-phase-a
```

- [ ] **Step 2: Capture baseline test result**

```bash
cd backend && pytest tests/ -q 2>&1 | tail -10
```

Expected: A summary line like `N passed in Ms` (no failures). Record the number of passing tests — every commit in this plan must produce ≥ this number.

- [ ] **Step 3: Build the patch-target census**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git grep -n "mocker.patch(" backend/tests/ > /tmp/patch-census-before.txt
cat /tmp/patch-census-before.txt
```

Expected output covers ~15 patch lines across:
- `api.driver`, `services.driver`
- `api.client`, `services.client`
- `api.s3_client`
- `api.pc`, `api.Pinecone`
- `api.graph`, `services.graph`, `llm_config.graph`
- `services.agent_chain`, `llm_config.agent_chain`
- `llm_config.chain`, `llm_config.chain2`, `llm_config.llm`, `llm_config.llm2`, `llm_config.llm_transformer`
- `api.chain`, `api.chain2`, `api.llm2`
- `services.llm`, `services.llm2`, `services.llm_transformer`

If any patch target isn't in the above mapping, **stop** — flag it before continuing. The spec §6.2 table assumes this exhaustive list.

- [ ] **Step 4: Verify no external code imports from `backend.config`, `backend.api`, etc.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git grep -nE "from backend\.(api|services|config|database|llm_config|models) import" -- ':!backend/'
git grep -nE "import backend\.(api|services|config|database|llm_config|models)" -- ':!backend/'
```

Expected: Both produce zero matches. (If any matches appear outside `backend/`, document them — they'll need updating in Phase 1.)

- [ ] **Step 5: Verify no test files import from `api` or `services` directly**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git grep -nE "^from (api|services) import" backend/tests/
git grep -nE "^import (api|services)" backend/tests/
```

Expected: At most a small set of matches. Record them — they'll become `from app.main import app` etc. in Task 3.

- [ ] **Step 6: Verify `from main import app` is the test entrypoint**

```bash
git grep -n "from main" backend/tests/
```

Expected: `conftest.py` contains `from main import app`. This stays valid because root `main.py` keeps an `app` reference (now via shim in Task 3).

No commit for this task. The baseline number and census file are local-only artifacts used for verification in later tasks.

---

## Phase 1: Prep (3 commits)

### Task 1: Scaffold `app/` package skeleton

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/services/__init__.py`

- [ ] **Step 1: Create directories and empty `__init__.py` files**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
mkdir -p app/core app/routers app/services
touch app/__init__.py app/core/__init__.py app/routers/__init__.py app/services/__init__.py
```

- [ ] **Step 2: Verify directory structure**

```bash
ls -R app/
```

Expected: shows `app/__init__.py`, `app/core/__init__.py`, `app/routers/__init__.py`, `app/services/__init__.py` — and the three directories.

- [ ] **Step 3: Run baseline tests (sanity check — should be unchanged)**

```bash
cd backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: Same passing test count as the pre-flight baseline. No behavior change yet — we've only added empty files.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/
git commit -m "refactor(be): scaffold app/ package skeleton [phase A, commit 1/16]"
```

---

### Task 2: Move core files (`config`, `database`, `llm_config`, `models`) into `app/`

This is the highest-risk commit in the plan. It moves the four files that everyone imports from, centralizes external clients into `app/core/database.py`, switches `api.py` and `services.py` to qualified imports, and updates `conftest.py` to source-patch the new paths.

**Files:**
- Move: `backend/config.py` → `backend/app/core/config.py`
- Move: `backend/database.py` → `backend/app/core/database.py`
- Move: `backend/llm_config.py` → `backend/app/core/llm_config.py`
- Move: `backend/models.py` → `backend/app/models.py`
- Modify: `backend/app/core/database.py` (add `s3_client` and `pc` from current api.py:4155-4163)
- Modify: `backend/api.py` (switch imports; remove `s3_client` and `pc` bindings; update inline Pinecone helper)
- Modify: `backend/services.py` (switch imports)
- Modify: `backend/llm_config.py` (already moved — switch its `from database` import to qualified)
- Modify: `backend/tests/conftest.py` (rewrite fixtures to source-patch)

- [ ] **Step 1: Move the four core files via `git mv`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git mv backend/config.py backend/app/core/config.py
git mv backend/database.py backend/app/core/database.py
git mv backend/llm_config.py backend/app/core/llm_config.py
git mv backend/models.py backend/app/models.py
```

- [ ] **Step 2: Add `s3_client` and `pc` to `app/core/database.py`**

Open `backend/app/core/database.py`. At the bottom of the file (after the existing `upsert_node` function), append:

```python
# S3 + Pinecone clients (moved from api.py during phase A modularization)
import boto3
from pinecone import Pinecone
from app.core.config import (
    aws_access_key,
    aws_secret_key,
    aws_region,
    pinecone_api_key,
)

s3_client = boto3.client(
    's3',
    aws_access_key_id=aws_access_key,
    aws_secret_access_key=aws_secret_key,
    region_name=aws_region,
)

pc = Pinecone(api_key=pinecone_api_key)
```

- [ ] **Step 3: Update `app/core/database.py` to use qualified imports for `config`**

The original `backend/database.py` had `from config import neo4j_uri, neo4j_username, neo4j_password, mongo_uri` at line 4. After `git mv` it still says that. Replace with:

```python
from app.core.config import neo4j_uri, neo4j_username, neo4j_password, mongo_uri
```

- [ ] **Step 4: Update `app/core/llm_config.py` to use qualified imports**

`backend/app/core/llm_config.py` originally has at lines 10-11:

```python
from config import groq_api_key, together_api_key, tavily_api_key
from database import graph
```

Replace with:

```python
from app.core.config import groq_api_key, together_api_key, tavily_api_key
from app.core import database
```

Then search for any usage of bare `graph` within `llm_config.py` and replace with `database.graph`. This is the qualified-import convention — references go through the module so source-patches in tests catch them.

- [ ] **Step 5: Update `backend/api.py` imports**

Find the imports at the top of `backend/api.py` (lines 30-41 currently — verify with `head -50 backend/api.py`). **Scope of this step:** replace the four-line block that imports from `config`, `models`, `database`, `llm_config`. Do NOT touch the two lines that follow it:

- `from langchain_core.messages import HumanMessage` (third-party — unchanged)
- `from services import (grapher, create_prospect_node, ...)` — sibling module still at `backend/services.py` throughout phase A; the import stays valid until `services.py` is split (Tasks 8-15) and finally deleted (Task 16)

Replace the block:

```python
from config import origins, STAGE_ORDER, STAGE_MAPPING, s3_bucket, aws_region, aws_access_key, aws_secret_key, pinecone_api_key, together_api_key, claude_sonnet_model, tavily_api_key, claude_signal_window_seconds, claude_signal_token_limit_5m, claude_signal_max_output_tokens
from models import (
    ProspectData, Lead, Contact, SalesPipelineResponse, TimeframeResponse, StageStats,
    CompanyProfile, UserProfile, ScoutProfile, MarketRequest, EditRequest,
    CustomerProfileRequest, CustomerProfileICP, LeadCreateRequest, LeadUpdateRequest,
    SignalActionRequest, SignalAskRequest, RegistrationRequest, RegistrationResponse,
    SuggestedICPToCustomerProfileRequest, LeadMarketScoresRequest, LeadMarketScoresResponse,
    LeadMarketScoreRow, LeadMarketScoreDescriptionsResponse, LeadMarketScoringStatusResponse,
    LeadMarketScoreStatusItem, MARKET_SCORE_COMPONENT_KEYS
)
from database import driver, graph, client, upsert_node
from llm_config import chain, chain2, llm2
```

With qualified-import equivalents:

```python
from app.core.config import origins, STAGE_ORDER, STAGE_MAPPING, s3_bucket, aws_region, aws_access_key, aws_secret_key, pinecone_api_key, together_api_key, claude_sonnet_model, tavily_api_key, claude_signal_window_seconds, claude_signal_token_limit_5m, claude_signal_max_output_tokens
from app.models import (
    ProspectData, Lead, Contact, SalesPipelineResponse, TimeframeResponse, StageStats,
    CompanyProfile, UserProfile, ScoutProfile, MarketRequest, EditRequest,
    CustomerProfileRequest, CustomerProfileICP, LeadCreateRequest, LeadUpdateRequest,
    SignalActionRequest, SignalAskRequest, RegistrationRequest, RegistrationResponse,
    SuggestedICPToCustomerProfileRequest, LeadMarketScoresRequest, LeadMarketScoresResponse,
    LeadMarketScoreRow, LeadMarketScoreDescriptionsResponse, LeadMarketScoringStatusResponse,
    LeadMarketScoreStatusItem, MARKET_SCORE_COMPONENT_KEYS
)
from app.core import database
from app.core.database import upsert_node  # function — local binding ok
from app.core import llm_config
```

The `upsert_node` function is a pure helper (no module state); binding it locally is fine. Globals like `driver`, `graph`, `client`, `chain`, `chain2`, `llm2`, `pc`, `s3_client` are accessed via `database.X` / `llm_config.X`.

- [ ] **Step 6: Replace global references in `backend/api.py`**

In the body of `backend/api.py`, every bare reference like `driver.session()`, `client.Scout_Agent.signals`, `graph.refresh_schema()`, `chain.invoke(...)`, `chain2.invoke(...)`, `llm2.invoke(...)`, `pc.Index(...)`, `s3_client.upload_fileobj(...)` becomes:

| Before | After |
|---|---|
| `driver` | `database.driver` |
| `graph` | `database.graph` |
| `client` | `database.client` |
| `s3_client` | `database.s3_client` |
| `pc` | `database.pc` |
| `chain` | `llm_config.chain` |
| `chain2` | `llm_config.chain2` |
| `llm2` | `llm_config.llm2` |

Use a careful search-and-replace. Verify with a **tight** grep that looks for the symbol followed by a method call or attribute access — this filters out string-literal `"client"` keys and `client: MongoClient` parameter annotations:

```bash
grep -nE "(^|[^a-zA-Z0-9_.])(driver|graph|client|s3_client|pc|chain|chain2|llm2)\.(session|run|refresh_schema|Scout_Agent|Profiler|MarketReports|Index|upload_fileobj|invoke|stream)" backend/api.py | grep -v "database\.\|llm_config\.\|self\.\|test_client\." | head -30
```

Expected: Zero matches. Every remaining reference like `driver.session()` should now read `database.driver.session()`.

**Why a tight pattern:** the bare-word regex `\b(driver|client|...)\b` matches too aggressively — parameter names (`def fn(client: MongoClient):`), dict keys (`{"driver": ...}`), and FastAPI `TestClient` usages all hit. The method-attached pattern above only flags real call sites that need rewriting.

After the tight grep, do a final sanity pass with the broad pattern but treat any hits as needing manual review rather than auto-fix:

```bash
grep -nE "(^|[^a-zA-Z0-9_.])(driver|graph|client|s3_client|pc|chain|chain2|llm2)([^a-zA-Z0-9_]|$)" backend/api.py | grep -v "database\.\|llm_config\.\|\"client\"\|'client'\|MongoClient\|TestClient" | head -30
```

- [ ] **Step 7: Remove module-level `s3_client` and `pc` bindings from `api.py`**

Find lines around 4155-4163 in `backend/api.py`:

```python
s3_client = boto3.client(
    's3',
    aws_access_key_id=aws_access_key,
    aws_secret_access_key=aws_secret_key,
    region_name=aws_region
)

# Initialize Pinecone
pc = Pinecone(api_key=pinecone_api_key)
```

Delete this block. Both clients now live in `app/core/database.py` (Step 2).

- [ ] **Step 8: Update the inline Pinecone construction in `_fetch_pinecone_supporting_context`**

In `backend/api.py` around line 123 (inside `_fetch_pinecone_supporting_context`):

```python
index = Pinecone(api_key=pinecone_api_key).Index("brewra-documents")
```

Replace with:

```python
index = database.pc.Index("brewra-documents")
```

Remove the `from pinecone import Pinecone` import at the top of `api.py` if no other reference to `Pinecone` remains (grep `Pinecone` to confirm).

- [ ] **Step 9: Update `backend/services.py` imports**

`backend/services.py` lines 15-17 currently:

```python
from config import PREDEFINED_QUESTIONS, rapidapi_key, claude_sonnet_model, tavily_api_key
from database import driver, query, client
from llm_config import llm_transformer, graph, llm, llm2, agent_chain
```

Replace with:

```python
from app.core.config import PREDEFINED_QUESTIONS, rapidapi_key, claude_sonnet_model, tavily_api_key
from app.core.database import query  # function — local binding ok
from app.core import database
from app.core import llm_config
```

Then in the body of `services.py`, replace bare references the same way as Step 6:

| Before | After |
|---|---|
| `driver` | `database.driver` |
| `client` | `database.client` |
| `graph` | `database.graph` (NOTE: `llm_config` also exports `graph` — same instance, but per convention go through `database`) |
| `llm_transformer` | `llm_config.llm_transformer` |
| `llm` | `llm_config.llm` |
| `llm2` | `llm_config.llm2` |
| `agent_chain` | `llm_config.agent_chain` |

Verify with grep:

```bash
grep -nE "^[^#]*\b(driver|graph|client|llm_transformer|llm|llm2|agent_chain)\b" backend/services.py | grep -v "database\.\|llm_config\." | head -20
```

Expected: Only string-literal / parameter matches.

- [ ] **Step 9b: Rewrite deferred imports inside function bodies**

`api.py` and `services.py` contain `from X import Y` statements **inside `def` blocks** — these execute at call time, not module-load time, and were not caught by Steps 5/6/9. After Task 2, `backend/database.py` / `backend/config.py` / `backend/llm_config.py` / `backend/models.py` no longer exist; any deferred import referencing them will raise `ModuleNotFoundError` the first time its enclosing handler is invoked. Tests with full mocks may not exercise these code paths, so the failure surfaces only in integration/prod.

Find them:

```bash
grep -nE "^\s+(from|import) (config|database|llm_config|models)( |$)" backend/api.py backend/services.py
```

Expected hits in `backend/api.py` (line numbers approximate — verify):
- 3× `from database import query` inside `/query/`, `/voice_graph/`, `/text_graph/` handlers
- 1× `from llm_config import llm2` inside `/test-llm` handler
- 1× `from llm_config import agent_chain` inside `/signal_Ask` handler

Plus `from services import fetch_leads_for_org` (2 sites) — leave those for now; `backend/services.py` still exists throughout phase A and gets a re-export alias in Task 9. They are rewritten when `signals` extracts in Task 14.

Rewrite the imports inline (keep them inside the function bodies — moving them to module level would change `api.py`'s import-time semantics):

| Original | After |
|---|---|
| `from database import query` | `from app.core.database import query` |
| `from llm_config import llm2` | `from app.core import llm_config` (then references become `llm_config.llm2`) |
| `from llm_config import agent_chain` | `from app.core import llm_config` (references become `llm_config.agent_chain`) |

For the two `llm_config` cases, prefer the qualified module import so source-patching works in tests (consistent with Task 2's qualified-import convention).

Verify the rewrites:

```bash
grep -nE "^\s+from (config|database|llm_config|models) import" backend/api.py backend/services.py
```

Expected: Zero matches. Any `from services import ...` deferred-import sites remain — they're handled when their host handler moves.

- [ ] **Step 9c: Sweep stale `__pycache__/`**

After `git mv` of `database.py`, `config.py`, `llm_config.py`, `models.py`, the stale `backend/__pycache__/database.cpython-*.pyc` (etc.) can satisfy a `from database import ...` import in confusing ways — Python's import system will load the cached bytecode if it finds it. Wipe all `__pycache__` under `backend/`:

```bash
find backend/ -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
```

This is idempotent and safe — Python regenerates the cache on next import. Do this before running tests in Step 13.

- [ ] **Step 10: Update `backend/main.py` imports**

The current 16-line `backend/main.py`:

```python
from config import *
from models import *
from database import *
from llm_config import *
from services import *
from api import app
```

Replace with a minimal transitional shim — drop the `from X import *` chain. The original star-imports existed to hoist every symbol into `main`'s namespace, but no caller relies on `main.X` for any of these names; the moves to `app/core/*` and `app/models` mean their callers now import from the new paths directly. Carrying the star-imports forward would silently mask any missed migration — a name resolved via `main.foo` instead of the proper module would look fine until the shim is removed.

```python
"""Transitional backend entrypoint.

After Task 2 the core files live under app/core/. The FastAPI() instance
and routers still live in api.py until Task 3 moves them to app/main.py.
This file's job during Tasks 2-15 is just to import api.py so its
@app.X decorators register on the shared FastAPI instance.
"""
from app.core import database
from api import app  # registers @app.X routes by import side-effect

database.graph.refresh_schema()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

Why: the `graph.refresh_schema()` call at module load (originally in the old `main.py`) is preserved via the qualified `database.graph.refresh_schema()`. After Task 3 moves FastAPI construction to `app/main.py`, this file shrinks further (Task 3 Step 5).

**Verify no callers depend on `main.X` star-imported symbols:**

```bash
git grep -nE "from main import [^a]" -- ':!backend/api.py' ':!backend/services.py' ':!backend/main.py'
git grep -n "import main\b" -- ':!backend/api.py' ':!backend/services.py' ':!backend/main.py'
```

Expected: the only meaningful match is `from main import app` (allowed). If anything else turns up (`from main import driver`, etc.), that caller needs to be updated to import from `app.core.database` directly before this step lands.

- [ ] **Step 11: Rewrite `backend/tests/conftest.py` fixtures to source-patch new paths**

Open `backend/tests/conftest.py`. Replace the fixture bodies (keep the docstrings and file header) with these source-patched versions:

```python
@pytest.fixture
def mock_neo4j(mocker):
    """Mock Neo4j driver — single source-patch at app.core.database.driver."""
    mock_driver = MagicMock()
    mock_session = MagicMock()
    mock_driver.session.return_value.__enter__.return_value = mock_session
    mock_driver.session.return_value.__exit__.return_value = False
    mocker.patch("app.core.database.driver", mock_driver)
    return {"driver": mock_driver, "session": mock_session}


@pytest.fixture
def mock_mongo(mocker):
    mongo = MagicMock()
    mocker.patch("app.core.database.client", mongo)
    return mongo


@pytest.fixture
def mock_llm_chain(mocker):
    mock_chain = MagicMock()
    mocker.patch("app.core.llm_config.agent_chain", mock_chain)
    return mock_chain


@pytest.fixture
def mock_llm_config(mocker):
    """Source-patch all llm_config globals + the shared `graph` Neo4jGraph."""
    mocks = {}
    for name in ("chain", "chain2", "llm", "llm2", "llm_transformer", "graph"):
        mocks[name] = MagicMock(name=f"llm_config.{name}")
        mocker.patch(f"app.core.llm_config.{name}", mocks[name])
    # database.graph and llm_config.graph are the same Neo4jGraph object — patch both.
    mocker.patch("app.core.database.graph", mocks["graph"])
    return mocks


@pytest.fixture
def mock_s3(mocker):
    s3 = MagicMock()
    mocker.patch("app.core.database.s3_client", s3)
    return s3


@pytest.fixture
def mock_pinecone(mocker):
    """Source-patch the database.pc singleton. The inline Pinecone constructor
    in api.py is gone (replaced with database.pc.Index in Task 2)."""
    pc = MagicMock()
    pc.Index.return_value.query.return_value = {"matches": []}
    mocker.patch("app.core.database.pc", pc)
    return pc


@pytest.fixture
def client(mock_neo4j, mock_mongo, mock_llm_chain, mock_llm_config,
           mock_s3, mock_pinecone):
    """All-mocks-applied TestClient. Use this in 95% of tests."""
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as c:
        yield c
```

- [ ] **Step 12: Verify `app` is importable under test sys.path**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
python -c "import sys; sys.path.insert(0, '.'); import app.main" 2>&1 | head -5
```

Expected: Either silent success or an ImportError pointing at something other than `app` (e.g., `No module named 'app.main'` — that's expected because we haven't created `app/main.py` yet; Task 3 does that). If the import error says `No module named 'app'`, sys.path is broken — debug before continuing.

For the test runner, since `conftest.py` already adds `backend/` to `sys.path`, `import app.core.database` will resolve.

- [ ] **Step 13: Run the full test suite**

```bash
cd backend && pytest tests/ -q 2>&1 | tail -10
```

Expected: Same passing count as baseline. If failures appear, the most likely cause is a missed reference replacement in Step 6 or 9 — grep again.

- [ ] **Step 14: Confirm the patch-target census now resolves cleanly**

```bash
grep -n "mocker.patch(" backend/tests/conftest.py
```

Expected: Every patch target uses `app.core.database.*` or `app.core.llm_config.*`. No `api.*` or `services.*` or bare `llm_config.*` paths remain in conftest.

- [ ] **Step 15: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): move core files to app/core, switch to qualified imports, source-patch tests [phase A, commit 2/16]"
```

---

### Task 3: Move FastAPI app construction to `app/main.py`; reduce root `main.py` to a shim

**Files:**
- Create: `backend/app/main.py`
- Modify: `backend/api.py` (remove `app = FastAPI()` and CORS block; import `app` instead)
- Modify: `backend/main.py` (reduce to 4-line shim)

- [ ] **Step 1: Create `backend/app/main.py` with FastAPI app construction**

Write `backend/app/main.py`:

```python
"""FastAPI application factory.

This module owns:
  - The FastAPI() instance
  - CORS middleware
  - Logging configuration
  - include_router() calls for all domain routers (added incrementally
    as routers are extracted in Tasks 4-15)

Domain routers register themselves here. Routes themselves live in
app/routers/<domain>.py.
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import origins  # noqa: F401 — kept for backwards compat if any code reads it

# Logging configuration (moved from api.py)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI app construction (moved from api.py:165)
app = FastAPI()

# CORS middleware (moved from api.py:168-174)
# NOTE: allow_origins=["*"] with allow_credentials=True is preserved from
# original behavior. Phase B tightens this.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router registrations are added incrementally in Tasks 4-15.
# Each Task N adds one line: app.include_router(<domain>.router)
```

- [ ] **Step 2: Remove app construction and CORS block from `backend/api.py`**

Find this block at api.py:163-174:

```python
# Create FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Delete it.

Also find and delete the logging configuration block at api.py:50-55:

```python
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
```

(Logging moved to `app/main.py`.)

- [ ] **Step 3: Import `app` and `logger` into `backend/api.py`**

At the top of `backend/api.py`, after the other imports, add:

```python
from app.main import app, logger
```

Now api.py's `@app.X(...)` decorators reference the FastAPI instance defined in `app/main.py` (the same instance — Python import semantics).

Verify with grep:

```bash
grep -nE "^app = FastAPI|^app\.add_middleware" backend/api.py
```

Expected: Zero matches (both moved to app/main.py).

- [ ] **Step 4: Remove now-unused FastAPI/CORS imports from `api.py`**

At the top of `backend/api.py`, the line is currently:

```python
from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException, Body, APIRouter, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
```

Remove `FastAPI` and `CORSMiddleware` (only `app/main.py` uses them now):

```python
from fastapi import UploadFile, File, Form, Query, HTTPException, Body, APIRouter, BackgroundTasks
```

The `CORSMiddleware` import line is removed entirely.

- [ ] **Step 5: Reduce `backend/main.py` to a 4-line shim**

Replace the entire contents of `backend/main.py` with:

```python
"""Backend entrypoint shim — preserves `uvicorn main:app` for Render and local dev."""
from app.main import app
import api  # noqa: F401 — registers routes by import side-effect (interim; routers replace this in Tasks 4-15)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

The `import api` line is the bridge until routers replace `@app.X` decorators. After Task 15 it will be removed.

- [ ] **Step 6: Run the full test suite**

```bash
cd backend && pytest tests/ -q 2>&1 | tail -10
```

Expected: Same passing count as baseline. If a fixture-related failure surfaces, double-check that `from main import app` in `conftest.py` still works (the root main.py shim must define `app`).

- [ ] **Step 7: Smoke-test CORS headers**

```bash
cd backend && python -c "
from fastapi.testclient import TestClient
from main import app
client = TestClient(app)
resp = client.options('/leads', headers={'Origin': 'http://localhost:3000', 'Access-Control-Request-Method': 'GET'})
print('Status:', resp.status_code)
print('CORS Allow-Origin:', resp.headers.get('access-control-allow-origin'))
"
```

Expected: Status 200, `Access-Control-Allow-Origin: *`. Confirms middleware moved correctly.

- [ ] **Step 8: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): move FastAPI app construction to app/main.py; root main.py becomes shim [phase A, commit 3/16]"
```

---

## Phase 2: Extract no-service-dep domains (4 commits)

These four domains have inline-only handlers — no `services.py` content to move. The extraction recipe is identical for each:

1. Create empty `app/services/<domain>.py` (kept for consistency).
2. Create `app/routers/<domain>.py` with `router = APIRouter()`, all imports the routes need, and the route handlers copied from `api.py` with `@app.X` → `@router.X`.
3. Add `app.include_router(<domain>.router)` to `app/main.py`.
4. Delete the extracted routes from `api.py`.
5. Run tests.
6. Commit.

### Task 4: Extract `pipeline` router (2 routes — smallest first)

**Files:**
- Create: `backend/app/routers/pipeline.py`
- Create: `backend/app/services/pipeline.py` (empty placeholder)
- Modify: `backend/app/main.py` (add `include_router`)
- Modify: `backend/api.py` (delete routes)

**Routes:** `GET /Sales_Pipeline`, `GET /test-llm` — locate with `grep -nE '^@app\.get\("/(Sales_Pipeline|test-llm)"' backend/api.py`.

- [ ] **Step 1: Create empty service module**

Write `backend/app/services/pipeline.py`:

```python
"""Pipeline service — currently no service-layer functions.

The /Sales_Pipeline aggregator and /test-llm probe are inline in the
router. If a service-layer function emerges in phase B, add it here.
"""
```

- [ ] **Step 2: Create router module**

Write `backend/app/routers/pipeline.py`:

```python
"""Pipeline router: Sales pipeline aggregator + LLM probe endpoints."""
from fastapi import APIRouter, Query

from app.core import database
from app.core import llm_config
from app.core.config import STAGE_ORDER, STAGE_MAPPING
from app.models import SalesPipelineResponse, TimeframeResponse, StageStats

router = APIRouter()


# Copy /Sales_Pipeline handler verbatim from api.py:1546-1599.
# Change @app.get(...) → @router.get(...).
# All `driver.session()` references already use `database.driver.session()`
# from Task 2's qualified-imports pass.

# Copy /test-llm handler verbatim from api.py:2920-2933.
# Change @app.get(...) → @router.get(...).
```

Then **copy the handler bodies** for `/Sales_Pipeline` and `/test-llm` from `backend/api.py` (locate via the grep above) into this file. Change `@app.get(...)` to `@router.get(...)` for both. Leave everything else (including the handler function names and signatures) unchanged.

- [ ] **Step 3: Verify the router file is well-formed**

```bash
cd backend && python -c "from app.routers import pipeline; print(len(pipeline.router.routes), 'routes')"
```

Expected: `2 routes`.

- [ ] **Step 4: Wire the router into `app/main.py`**

Open `backend/app/main.py`. After the existing CORS block, add:

```python
from app.routers import pipeline

app.include_router(pipeline.router)
```

- [ ] **Step 5: Delete the extracted routes from `backend/api.py`**

Locate each handler via grep and delete its full decorator + function body (decorator line through to next `@app.` or end of function). For `/Sales_Pipeline`:

```bash
grep -nE '^@app\.get\("/Sales_Pipeline"' backend/api.py
```

Find the matching `def ` two lines below; delete from `@app.get(...)` through the last line before the next module-level definition. Same for `/test-llm`. Verify:

```bash
grep -nE '^@app\.(get|post|put|delete)\("/Sales_Pipeline"|^@app\.get\("/test-llm"' backend/api.py
```

Expected: Zero matches.

- [ ] **Step 6: Run full test suite**

```bash
cd backend && pytest tests/ -q 2>&1 | tail -10
```

Expected: Same passing count as baseline. The `pipeline` domain doesn't have dedicated tests in `tests/test_*.py` (verified at pre-flight), but the smoke test `tests/test_smoke.py` exercises `/test-llm` indirectly via TestClient construction.

- [ ] **Step 7: Verify both routes still respond**

```bash
cd backend && python -c "
from fastapi.testclient import TestClient
from main import app
c = TestClient(app)
print('Sales_Pipeline path mounted:', any(r.path == '/Sales_Pipeline' for r in app.routes))
print('test-llm path mounted:', any(r.path == '/test-llm' for r in app.routes))
"
```

Expected: Both `True`.

- [ ] **Step 8: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract pipeline router [phase A, commit 4/16]"
```

---

### Task 5: Extract `org_auth` router (5 routes — `/org`, `/connect_org`, `/registration`)

**Files:**
- Create: `backend/app/routers/org_auth.py`
- Create: `backend/app/services/org_auth.py` (empty placeholder)
- Modify: `backend/app/main.py` (add `include_router`)
- Modify: `backend/api.py` (delete routes)

**Routes:** `GET /org`, `POST /org`, `POST /connect_org`, `POST /registration`, `GET /registration` — locate with `grep -nE '^@app\.(get|post)\("/(org|connect_org|registration)"' backend/api.py`.

- [ ] **Step 1: Create empty service module**

Write `backend/app/services/org_auth.py`:

```python
"""Org / registration service — currently no service-layer functions.

All handler logic is inline in the router for phase A. Phase B may
extract registration validation / Mongo upsert into service functions.
"""
```

- [ ] **Step 2: Create router module**

Write `backend/app/routers/org_auth.py`:

```python
"""Org and registration endpoints."""
from typing import List

from fastapi import APIRouter, Body, HTTPException, Query

from app.core import database
from app.models import RegistrationRequest, RegistrationResponse

router = APIRouter()


# Copy /org GET / POST handlers              — grep '^@app\.(get|post)\("/org"' backend/api.py
# Copy /connect_org POST handler              — grep '^@app\.post\("/connect_org"' backend/api.py
# Copy /registration POST / GET handlers     — grep '^@app\.(get|post)\("/registration"' backend/api.py
#
# For each: change @app.X(...) → @router.X(...). Keep handler bodies unchanged.
```

Copy the five handler bodies into the file as described.

- [ ] **Step 3: Verify the router has 5 routes**

```bash
cd backend && python -c "from app.routers import org_auth; print(len(org_auth.router.routes), 'routes')"
```

Expected: `5 routes`.

- [ ] **Step 4: Wire into `app/main.py`**

In `backend/app/main.py`, after the `pipeline` include_router, add:

```python
from app.routers import org_auth

app.include_router(org_auth.router)
```

- [ ] **Step 5: Delete extracted routes from `api.py`**

Delete the five handler blocks from `backend/api.py`. Verify:

```bash
grep -nE '^@app\.(get|post)\("/(org|connect_org|registration)"' backend/api.py
```

Expected: Zero matches.

- [ ] **Step 6: Run tests**

```bash
cd backend && pytest tests/test_auth_org.py -q 2>&1 | tail -10
```

Expected: All `test_auth_org.py` tests pass. Snapshots unchanged. Then run the full suite:

```bash
cd backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: Same passing count as baseline.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract org_auth router [phase A, commit 5/16]"
```

---

### Task 6: Extract `profiles` router (4 routes)

**Files:**
- Create: `backend/app/routers/profiles.py`
- Create: `backend/app/services/profiles.py` (empty placeholder)
- Modify: `backend/app/main.py`
- Modify: `backend/api.py`

**Routes:** `POST /profile/{profile_type}`, `GET /profile/{profile_type}`, `POST /cleanup-company-profiles`, `POST /edit` — locate with `grep -nE '^@app\.(get|post)\("/(profile/|cleanup-company-profiles|edit)' backend/api.py`.

- [ ] **Step 1: Create empty service module**

Write `backend/app/services/profiles.py`:

```python
"""Profiles service — currently no service-layer functions.

Profile types: 'org', 'user', 'scout', 'profiler', 'agent_name'.
Handler logic is inline in the router for phase A.
"""
```

- [ ] **Step 2: Create router module**

Write `backend/app/routers/profiles.py`:

```python
"""Profile (org/user/scout/profiler) endpoints + bulk cleanup + generic edit."""
from fastapi import APIRouter, Body, HTTPException, Query

from app.core import database
from app.models import CompanyProfile, UserProfile, ScoutProfile, EditRequest

router = APIRouter()


# Copy /profile/{profile_type} POST / GET    — grep '^@app\.(get|post)\("/profile/' backend/api.py
# Copy /cleanup-company-profiles POST         — grep '^@app\.post\("/cleanup-company-profiles' backend/api.py
# Copy /edit POST                             — grep '^@app\.post\("/edit"' backend/api.py
#
# For each: change @app.X → @router.X, keep body unchanged.
```

Copy the four handler bodies in.

- [ ] **Step 3: Verify the router**

```bash
cd backend && python -c "from app.routers import profiles; print(len(profiles.router.routes), 'routes')"
```

Expected: `4 routes`.

- [ ] **Step 4: Wire into `app/main.py`**

```python
from app.routers import profiles

app.include_router(profiles.router)
```

- [ ] **Step 5: Delete extracted routes from `api.py`**

Verify:

```bash
grep -nE '^@app\.(get|post)\("/profile/|^@app\.post\("/(cleanup-company-profiles|edit)"' backend/api.py
```

Expected: Zero matches.

- [ ] **Step 6: Run tests**

```bash
cd backend && pytest tests/test_profiles.py -q 2>&1 | tail -10
cd backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: profiles test file passes; full suite same count as baseline.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract profiles router [phase A, commit 6/16]"
```

---

### Task 7: Extract `customer_profile` router (4 routes)

**Files:**
- Create: `backend/app/routers/customer_profile.py`
- Create: `backend/app/services/customer_profile.py` (empty placeholder)
- Modify: `backend/app/main.py`
- Modify: `backend/api.py`

**Routes:** `POST /customer_profile`, `GET /customer_profile`, `POST /customer_profile/from_suggested_icp`, `DELETE /customer_profile/icp/{icp_id}` — locate with `grep -nE '^@app\.(get|post|delete)\("/customer_profile' backend/api.py`.

- [ ] **Step 1: Create empty service module**

Write `backend/app/services/customer_profile.py`:

```python
"""Customer profile (Profiler-agent ICP-bound) service — inline-only in phase A."""
```

- [ ] **Step 2: Create router module**

Write `backend/app/routers/customer_profile.py`:

```python
"""Customer profile (Profiler agent) endpoints."""
from fastapi import APIRouter, Body, HTTPException, Query

from app.core import database
from app.models import (
    CustomerProfileRequest,
    CustomerProfileICP,
    SuggestedICPToCustomerProfileRequest,
)

router = APIRouter()


# Locate each handler with the grep in the task header. For each:
# change @app.X → @router.X, keep body unchanged.
```

Copy the four handler bodies in.

- [ ] **Step 3: Verify**

```bash
cd backend && python -c "from app.routers import customer_profile; print(len(customer_profile.router.routes), 'routes')"
```

Expected: `4 routes`.

- [ ] **Step 4: Wire into `app/main.py`**

```python
from app.routers import customer_profile

app.include_router(customer_profile.router)
```

- [ ] **Step 5: Delete extracted routes from `api.py`**

```bash
grep -nE '^@app\.(get|post|delete)\("/customer_profile' backend/api.py
```

Expected: Zero matches.

- [ ] **Step 6: Run tests**

The customer_profile routes are covered by `tests/test_icp.py` (per spec §6.3 — the characterization spec lumps customer_profile + icp).

```bash
cd backend && pytest tests/test_icp.py -q 2>&1 | tail -10
cd backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: All pass; full suite same count as baseline.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract customer_profile router [phase A, commit 7/16]"
```

---

## Phase 3: Extract domains with services (3 commits)

These domains have matching `services.py` functions that move alongside the router.

### Task 8: Extract `documents` router and service (7 routes + 3 functions)

**Files:**
- Create: `backend/app/routers/documents.py`
- Create: `backend/app/services/documents.py`
- Modify: `backend/app/main.py`
- Modify: `backend/api.py`
- Modify: `backend/services.py`

**Routes:** `POST /upload_file/`, `POST /upload`, `POST /upload-document`, `GET /document-status/{file_key:path}`, `GET /user-documents`, `DELETE /data-source/{file_id}`, `PUT /data-source/{file_id}` — locate with `grep -nE '^@app\.(get|post|delete|put)\("/(upload|upload_file|upload-document|document-status|user-documents|data-source)' backend/api.py`.

**Service functions:** `load_document`, `grapher`, `process_prospect_list` — locate with `grep -nE '^(async )?def (load_document|grapher|process_prospect_list)' backend/services.py`.

Also: the `process_file_to_embeddings` async helper is used internally by `/upload-document` as a BackgroundTask. It's inline in the router handler, not in services.py — locate with `grep -n 'async def process_file_to_embeddings' backend/api.py`. It moves with the router.

- [ ] **Step 1: Create service module**

Write `backend/app/services/documents.py`:

```python
"""Document loading + prospect-list processing service.

Extracted from services.py during phase A modularization.
"""
```

Then **copy the three functions verbatim** from `backend/services.py` (locate via grep):
- `load_document`
- `grapher` — note this depends on `llm_transformer` which is in `llm_config`; uses qualified reference
- `process_prospect_list`

Required imports at top of `app/services/documents.py`:

```python
import os
import json
from typing import List, Dict, Any

from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_core.messages import HumanMessage

from app.core import database
from app.core import llm_config
```

Verify after copy:

```bash
cd backend && python -c "from app.services import documents; print(documents.load_document.__name__, documents.grapher.__name__, documents.process_prospect_list.__name__)"
```

Expected: `load_document grapher process_prospect_list`.

- [ ] **Step 2: Create router module**

Write `backend/app/routers/documents.py`:

```python
"""Document upload, status, and data-source management endpoints."""
import os
import shutil
import uuid
from typing import List, Dict, Any

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from langchain_core.documents import Document
from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
import pandas as pd

from app.core import database
from app.core import llm_config
from app.core.config import s3_bucket, together_api_key
from app.services import documents as documents_service

router = APIRouter()


# Locate each handler with the grep in the task header. Also copy the
# process_file_to_embeddings async helper (`grep -n 'async def process_file_to_embeddings' backend/api.py`)
# — this is a BackgroundTask used inside /upload-document.
#
# For each route: @app.X → @router.X. For internal service calls like
# `grapher(file_path)` (inside /upload_file/) and `process_prospect_list(file_path)`
# (inside /upload), prefix with `documents_service.`:
#   grapher(file_path)            → documents_service.grapher(file_path)
#   process_prospect_list(...)    → documents_service.process_prospect_list(...)
#   load_document(file_path)      → documents_service.load_document(file_path)
```

Copy the seven route handlers + `process_file_to_embeddings`. Apply the qualified-call substitution as noted.

- [ ] **Step 3: Verify the router**

```bash
cd backend && python -c "from app.routers import documents; print(len(documents.router.routes), 'routes')"
```

Expected: `7 routes`.

- [ ] **Step 4: Wire into `app/main.py`**

```python
from app.routers import documents

app.include_router(documents.router)
```

- [ ] **Step 5: Remove the three functions from `services.py`**

Delete `load_document`, `grapher`, `process_prospect_list` from `backend/services.py`. They've moved.

- [ ] **Step 6: Delete extracted routes from `api.py`**

Delete the seven route handlers and the `process_file_to_embeddings` helper from `backend/api.py`. Verify:

```bash
grep -nE '^@app\.(post|get|delete|put)\("/(upload|upload_file|upload-document|document-status|user-documents|data-source)' backend/api.py
```

Expected: Zero matches.

- [ ] **Step 7: Run document tests + smoke**

```bash
cd backend && pytest tests/test_documents.py -q 2>&1 | tail -10
cd backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: documents tests pass; full suite same count.

- [ ] **Step 8: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract documents router and service [phase A, commit 8/16]"
```

---

### Task 9: Extract `leads` router and service (8 routes + 1 function)

**Files:**
- Create: `backend/app/routers/leads.py`
- Create: `backend/app/services/leads.py`
- Modify: `backend/app/main.py`
- Modify: `backend/api.py`
- Modify: `backend/services.py`

**Routes:** `GET /leads`, `POST /leads`, `PUT /leads/{lead_id}`, `DELETE /leads/{lead_id}`, `POST /leads/batch-upload`, `GET /leads/by-file`, `GET /leads/stream/status`, `DELETE /leads/by-file/{file_id}` — locate with `grep -nE '^@app\.(get|post|put|delete)\("/leads' backend/api.py` (filter out `/leads/market-scores` lines — they go to Task 15).

**Service functions:** `fetch_leads_for_org` — locate with `grep -n '^def fetch_leads_for_org' backend/services.py`.

Note: `/leads/market-scores`, `/leads/market-scores/status`, and `/leads/{lead_id}/market-score-descriptions` are NOT in this task — they go to `market_scoring` (Task 15).

- [ ] **Step 1: Create service module**

Write `backend/app/services/leads.py`:

```python
"""Leads service: org-scoped lead retrieval.

Extracted from services.py during phase A modularization.
"""
from typing import List, Dict, Any

from app.core import database
```

Copy `fetch_leads_for_org` into this file (locate via grep).

- [ ] **Step 2: Create router module**

Write `backend/app/routers/leads.py`:

```python
"""Leads endpoints: CRUD, batch upload, file-grouped queries."""
import csv
import io
import json
import uuid
from typing import List, Dict, Any

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile

from app.core import database
from app.core.database import upsert_node
from app.models import LeadCreateRequest, LeadUpdateRequest

router = APIRouter()


# Copy the 8 lead handlers from api.py listed in the task header.
# For each: @app.X → @router.X. Keep handler bodies unchanged.
#
# The handlers do not currently call `fetch_leads_for_org` — that service
# function is referenced from market_scoring (Task 15), not from these
# routes. It moves here in Task 9 because its scope is "leads", not
# "market_scoring".
```

Copy the eight route handlers in.

- [ ] **Step 3: Verify**

```bash
cd backend && python -c "from app.routers import leads; print(len(leads.router.routes), 'routes')"
```

Expected: `8 routes`.

- [ ] **Step 4: Wire into `app/main.py`**

```python
from app.routers import leads

app.include_router(leads.router)
```

- [ ] **Step 5: Replace `fetch_leads_for_org` in `services.py` with a temporary alias**

`services.py` still contains `score_single_lead_against_market` (until Task 15) which calls `fetch_leads_for_org`. Rather than rewriting every call site, replace the original function definition in `backend/services.py` (locate via the grep in the task header) with a single re-export line:

```python
# Temporary alias — function moved to app.services.leads in commit 9/16.
# This alias keeps services.py callers (e.g. score_single_lead_against_market)
# working until they themselves move in commit 15/16.
from app.services.leads import fetch_leads_for_org  # noqa: F401
```

The alias survives Tasks 9-14, then is removed in Task 15 along with the rest of `services.py`.

- [ ] **Step 6: Delete extracted routes from `api.py`**

```bash
grep -nE '^@app\.(get|post|put|delete)\("/leads"' backend/api.py
grep -nE '^@app\.(get|post|put|delete)\("/leads/' backend/api.py | grep -v "market-score"
```

Expected: First grep zero matches. Second grep zero matches (only market-score lines remain — they go to Task 15).

- [ ] **Step 7: Run leads tests + smoke**

```bash
cd backend && pytest tests/test_leads.py -q 2>&1 | tail -10
cd backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: leads tests pass; full suite same count.

- [ ] **Step 8: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract leads router and service [phase A, commit 9/16]"
```

---

### Task 10: Extract `graph_chat` router and service (6 routes + 9 helper functions)

**Files:**
- Create: `backend/app/routers/graph_chat.py`
- Create: `backend/app/services/graph_chat.py`
- Modify: `backend/app/main.py`
- Modify: `backend/api.py`
- Modify: `backend/services.py`

**Routes:** `POST /create-company/`, `GET /ask/`, `GET /chat/`, `GET /query/`, `POST /voice_graph/`, `POST /text_graph/` — locate with `grep -nE '^@app\.(get|post)\("/(create-company|ask|chat|query|voice_graph|text_graph)' backend/api.py`.

**Service functions:** `create_prospect_node`, `convert_audio_to_text`, `get_linkedin_followers`, `get_linkedin_recent_activity`, `extract_linkedin_username`, `calculate_prospect_score`, `get_ranked_prospects`, `extract_number`, `score_prospect` — locate with `grep -nE '^def (create_prospect_node|convert_audio_to_text|get_linkedin_|extract_linkedin_username|calculate_prospect_score|get_ranked_prospects|extract_number|score_prospect)' backend/services.py`.

- [ ] **Step 1: Create service module**

Write `backend/app/services/graph_chat.py`:

```python
"""Graph chat / prospect scoring service.

Functions:
  - create_prospect_node: builds Cypher MERGE for new Company+Lead from
    answers
  - convert_audio_to_text: speech_recognition wrapper
  - get_linkedin_followers / get_linkedin_recent_activity /
    extract_linkedin_username: LinkedIn-related helpers via RapidAPI
  - calculate_prospect_score / get_ranked_prospects / extract_number /
    score_prospect: prospect-scoring chain

Extracted from services.py during phase A.
"""
import re
import requests
import speech_recognition as sr
from typing import List

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.prompts import PromptTemplate

from app.core import database
from app.core import llm_config
from app.core.config import PREDEFINED_QUESTIONS, rapidapi_key
```

Copy the nine functions verbatim from `services.py` (locate each via grep). Adjust any bare `driver` / `client` / `llm` / `agent_chain` / `query` references to qualified form (`database.driver`, `database.client`, `llm_config.llm`, `llm_config.agent_chain`, `database.query`).

- [ ] **Step 2: Create router module**

Write `backend/app/routers/graph_chat.py`:

```python
"""Graph chat endpoints: company creation, NL chat, voice/text engagement."""
from fastapi import APIRouter, Form

from app.core import database
from app.core import llm_config
from app.models import ProspectData
from app.services import graph_chat as graph_chat_service

router = APIRouter()


# Locate each handler with the grep in the task header.
#
# Service calls inside these handlers (e.g., create_prospect_node, score_prospect)
# become graph_chat_service.create_prospect_node, etc.
```

Copy the six route handlers, applying the qualified-call substitution.

- [ ] **Step 3: Verify**

```bash
cd backend && python -c "from app.routers import graph_chat; print(len(graph_chat.router.routes), 'routes')"
```

Expected: `6 routes`.

- [ ] **Step 4: Wire into `app/main.py`**

```python
from app.routers import graph_chat

app.include_router(graph_chat.router)
```

- [ ] **Step 5: Remove functions from `services.py`**

Delete the nine functions from `backend/services.py` (locate each via grep).

- [ ] **Step 6: Delete extracted routes from `api.py`**

```bash
grep -nE '^@app\.(get|post)\("/(create-company|ask|chat|query|voice_graph|text_graph)' backend/api.py
```

Expected: Zero matches.

- [ ] **Step 7: Run tests**

No dedicated `test_graph_chat.py` exists; smoke test covers it.

```bash
cd backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: Same passing count.

- [ ] **Step 8: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract graph_chat router and service [phase A, commit 10/16]"
```

---

## Phase 4: Shared helpers + LLM-heavy domains (5 commits)

### Task 11: Create shared helper modules `_retrieval.py` and `_claude_budget.py`

Isolates the shared-helper move so any breakage is unambiguous. No domain extraction in this commit.

**Files:**
- Create: `backend/app/services/_retrieval.py`
- Create: `backend/app/services/_claude_budget.py`
- Modify: `backend/api.py` (replace inline definitions with imports)

**Retrieval helpers (locate with `grep -nE '^def (_stringify_context_for_query|_build_market_context_queries|_build_signal_context_queries|_fetch_pinecone_supporting_context)' backend/api.py`):**
- `_stringify_context_for_query`
- `_build_market_context_queries`
- `_build_signal_context_queries`
- `_fetch_pinecone_supporting_context`

**Claude budget helpers + module-level globals — locate with the relevant greps:**
- Module-level constants and globals: `grep -nE '^(CLAUDE_SIGNAL_|CLAUDE_API_KEY|_claude_signal_usage_window|_claude_signal_usage_lock|_claude_signal_total_runs)' backend/api.py`
- Functions: `grep -nE '^def (_estimate_token_count|_prune_claude_signal_window|_reserve_claude_signal_budget|_finalize_claude_signal_budget)' backend/api.py`

- [ ] **Step 1: Create `app/services/_retrieval.py`**

Write `backend/app/services/_retrieval.py`:

```python
"""Pinecone-backed retrieval helpers (shared across market_research, icp, signals).

Internal to the services layer (leading underscore).
"""
import json
import logging
from typing import List, Dict, Any, Optional

from langchain_openai import OpenAIEmbeddings

from app.core import database
from app.core.config import pinecone_api_key, together_api_key

logger = logging.getLogger(__name__)
```

Copy the four functions verbatim from `backend/api.py` (locate via grep — see task header):
- `_stringify_context_for_query`
- `_build_market_context_queries`
- `_build_signal_context_queries`
- `_fetch_pinecone_supporting_context`

In `_fetch_pinecone_supporting_context`, the call `index = database.pc.Index("brewra-documents")` (already updated in Task 2) is now correct as-is.

- [ ] **Step 2: Create `app/services/_claude_budget.py`**

Write `backend/app/services/_claude_budget.py`:

```python
"""Claude signal-budget windowing (shared across all _claude route variants).

Module-level globals are stateful — they track real wall-clock usage
across requests. Internal to the services layer.
"""
import os
import threading
from collections import deque
from typing import Dict

from app.core.config import (
    claude_signal_window_seconds,
    claude_signal_token_limit_5m,
    claude_signal_max_output_tokens,
)

CLAUDE_SIGNAL_WINDOW_SECONDS = claude_signal_window_seconds
CLAUDE_SIGNAL_TOKEN_LIMIT_5M = claude_signal_token_limit_5m
CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS = claude_signal_max_output_tokens
CLAUDE_API_KEY = os.getenv("ANTHROPIC_API_KEY") or ""

_claude_signal_usage_window = deque()
_claude_signal_usage_lock = threading.Lock()
_claude_signal_total_runs = 0
```

Then copy the four functions verbatim from `backend/api.py` (locate via grep — see task header):
- `_estimate_token_count`
- `_prune_claude_signal_window`
- `_reserve_claude_signal_budget`
- `_finalize_claude_signal_budget`

Inside these functions, `_claude_signal_total_runs` is mutated via `global _claude_signal_total_runs` (verify presence). The mutation pattern works identically with the module-level globals now living in `_claude_budget.py`.

- [ ] **Step 3: Replace inline definitions in `api.py` with imports**

In `backend/api.py`, delete (locate each block via the greps in the task header):
- CLAUDE constants + module-level globals
- The four retrieval helpers
- The four claude budget helpers

At the top of `api.py`, add:

```python
from app.services._retrieval import (
    _stringify_context_for_query,
    _build_market_context_queries,
    _build_signal_context_queries,
    _fetch_pinecone_supporting_context,
)
from app.services._claude_budget import (
    CLAUDE_SIGNAL_WINDOW_SECONDS,
    CLAUDE_SIGNAL_TOKEN_LIMIT_5M,
    CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
    CLAUDE_API_KEY,
    _estimate_token_count,
    _prune_claude_signal_window,
    _reserve_claude_signal_budget,
    _finalize_claude_signal_budget,
)
```

The remaining routes in api.py (icp/market_research/signals/market_scoring — to be extracted in Tasks 12-15) continue working through these imports.

- [ ] **Step 4: Verify imports resolve**

```bash
cd backend && python -c "
from app.services._retrieval import _fetch_pinecone_supporting_context
from app.services._claude_budget import _reserve_claude_signal_budget
print('OK')
"
```

Expected: `OK`.

- [ ] **Step 5: Run full suite**

```bash
cd backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: Same passing count. The signals + market_research + icp routes (still in api.py) now exercise the moved helpers.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract _retrieval and _claude_budget shared helpers [phase A, commit 11/16]"
```

---

### Task 12: Extract `market_research` router and service (2 routes + 6 service functions)

**Why before `icp`:** market_research owns the helpers `_tavily_context_and_urls` and `_claude_messages_text` that `icp` (and later `signals`) also need. Extracting market_research first lets `icp` import these from their final location (`app.services.market_research`) on day one, without a temporary `from services import ...` alias.

**Files:**
- Create: `backend/app/routers/market_research.py`
- Create: `backend/app/services/market_research.py`
- Modify: `backend/app/main.py`
- Modify: `backend/api.py`
- Modify: `backend/services.py`

**Routes:** `POST /market-research`, `POST /market-research_claude` — locate with `grep -nE '^@app\.post\("/market-research' backend/api.py`.

**Service functions from services.py:** `Research_Market_1..5`, `_market_research_agent_output`. Locate with `grep -nE '^def (Research_Market_|_market_research_agent_output)' backend/services.py`.

Also: `COMPONENT_FUNCTIONS` and `COMPONENT_FUNCTIONS_CLAUDE` dispatch dicts — `grep -nE '^COMPONENT_FUNCTIONS' backend/services.py`.

Also: shared helpers `_tavily_context_and_urls` and `_claude_messages_text` — they're used by market_research, icp, and signals. Per spec §4.2, only `_retrieval.py` and `_claude_budget.py` are forced shared modules. Decision: co-locate in `app/services/market_research.py` since market_research is their primary user; `icp` (Task 13) and `signals` (Task 14) import from there. Phase B may promote them into `_retrieval` / `_claude_budget` if appropriate.

- [ ] **Step 1: Create service module**

Write `backend/app/services/market_research.py`:

```python
"""Market research service: 5-component report generation.

Owns the shared helpers _tavily_context_and_urls and _claude_messages_text,
which are also imported by app/services/icp.py (Task 13) and
app/services/signals.py (Task 14).
"""
import json
from typing import List, Dict, Any, Tuple

from langchain_core.messages import HumanMessage, SystemMessage

from app.core import database
from app.core import llm_config
from app.core.config import claude_sonnet_model, tavily_api_key
from app.services._retrieval import (
    _build_market_context_queries,
    _fetch_pinecone_supporting_context,
)
from app.services._claude_budget import (
    _estimate_token_count,
    _reserve_claude_signal_budget,
    _finalize_claude_signal_budget,
    CLAUDE_API_KEY,
    CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
)
```

Copy from `services.py` (locate via grep):
- `_tavily_context_and_urls`
- `_claude_messages_text`
- `_market_research_agent_output`
- `Research_Market_1..5`
- `COMPONENT_FUNCTIONS` and `COMPONENT_FUNCTIONS_CLAUDE` dispatch dicts

- [ ] **Step 2: Create router module**

Write `backend/app/routers/market_research.py`:

```python
"""Market research endpoints: 5-component report (Groq + Claude variants)."""
from fastapi import APIRouter

from app.core import database
from app.models import MarketRequest
from app.services import market_research as market_research_service

router = APIRouter()


# Copy /market-research handler — grep '^@app\.post\("/market-research"' backend/api.py
# Copy /market-research_claude handler — grep '^@app\.post\("/market-research_claude"' backend/api.py
#
# Service calls (Research_Market_1..5, _market_research_agent_output) become
# market_research_service.Research_Market_1, etc.
```

Copy the two route handlers, applying qualified-call substitution.

- [ ] **Step 3: Verify**

```bash
cd backend && python -c "from app.routers import market_research; print(len(market_research.router.routes), 'routes')"
```

Expected: `2 routes`.

- [ ] **Step 4: Wire into `app/main.py`**

```python
from app.routers import market_research

app.include_router(market_research.router)
```

- [ ] **Step 5: Remove functions from `services.py`**

Delete the following from `backend/services.py` (locate each via grep):
- `_tavily_context_and_urls`, `_claude_messages_text`, `_market_research_agent_output`
- `Research_Market_1..5`
- `COMPONENT_FUNCTIONS`, `COMPONENT_FUNCTIONS_CLAUDE` dispatch dicts

- [ ] **Step 6: Delete extracted routes from `api.py`**

```bash
grep -nE '^@app\.post\("/market-research' backend/api.py
```

Expected: Zero matches.

- [ ] **Step 7: Run market_research tests**

```bash
cd backend && pytest tests/test_market_research.py -q 2>&1 | tail -10
cd backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: All pass; full suite same count.

- [ ] **Step 8: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract market_research router and service [phase A, commit 12/16]"
```

---

### Task 13: Extract `icp` router and service (4 routes + 5 service functions + 3 ICP-id registry helpers)

**Files:**
- Create: `backend/app/routers/icp.py`
- Create: `backend/app/services/icp.py`
- Modify: `backend/app/main.py`
- Modify: `backend/api.py`
- Modify: `backend/services.py`

**Routes:** `GET /icp`, `POST /icp-research`, `POST /icp-research_claude`, `DELETE /icp/recommended/{icp_id}` — locate with `grep -nE '^@app\.(get|post|delete)\("/icp' backend/api.py`.

**Service functions from services.py:** `ICP_generator`, `icp_research_1..4`, `_icp_research_agent_output` — locate with `grep -nE '^def (ICP_generator|icp_research_|_icp_research_agent_output)' backend/services.py`.

**Helpers from api.py:** `_ensure_icp_id_registry_indexes`, `_reserve_unique_icp_id`, `_release_icp_id` — `grep -nE '^def (_ensure_icp_id_registry_indexes|_reserve_unique_icp_id|_release_icp_id)' backend/api.py`.

**Module-level constants from services.py to move into service:** `ICP_FUNCTIONS`, `ICP_FUNCTIONS_CLAUDE` — `grep -n 'ICP_FUNCTIONS' backend/services.py`. They stay in `app/services/icp.py` since they map components to icp_research functions.

- [ ] **Step 1: Create service module**

Write `backend/app/services/icp.py`:

```python
"""ICP (Ideal Customer Profile) generation and research service.

Includes:
  - ICP_generator: main ICP synthesis from company profile
  - icp_research_1..4: 4-component ICP-research breakdown
  - _icp_research_agent_output: prompt-dispatch helper
  - _ensure_icp_id_registry_indexes / _reserve_unique_icp_id / _release_icp_id:
    Mongo-backed ICP-id reservation
  - ICP_FUNCTIONS, ICP_FUNCTIONS_CLAUDE dispatch dicts
"""
import json
import re
from typing import List, Dict, Any, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import PromptTemplate

from app.core import database
from app.core import llm_config
from app.core.config import claude_sonnet_model, tavily_api_key
from app.services._retrieval import (
    _build_market_context_queries,
    _fetch_pinecone_supporting_context,
)
from app.services._claude_budget import (
    _estimate_token_count,
    _reserve_claude_signal_budget,
    _finalize_claude_signal_budget,
)
from app.services.market_research import (
    _tavily_context_and_urls,
    _claude_messages_text,
)
```

Note: because Task 12 extracted `market_research` first, the `_tavily_context_and_urls` / `_claude_messages_text` imports point at their final home — no temporary alias needed.

Copy from `services.py` (locate each via grep):
- `_icp_research_agent_output`
- `ICP_generator`
- `icp_research_1..4`
- `ICP_FUNCTIONS` and `ICP_FUNCTIONS_CLAUDE` dispatch-dict definitions

Copy from `api.py`:
- `_ensure_icp_id_registry_indexes`
- `_reserve_unique_icp_id`
- `_release_icp_id`

- [ ] **Step 2: Create router module**

Write `backend/app/routers/icp.py`:

```python
"""ICP endpoints: synthesis, multi-component research, and saved-ICP delete."""
from fastapi import APIRouter, HTTPException, Query

from app.core import database
from app.models import MarketRequest
from app.services import icp as icp_service

router = APIRouter()


# Copy /icp                         — grep '^@app\.get\("/icp"' backend/api.py
# Copy /icp-research                — grep '^@app\.post\("/icp-research"' backend/api.py
# Copy /icp-research_claude         — grep '^@app\.post\("/icp-research_claude"' backend/api.py
# Copy /icp/recommended/{icp_id}    — grep '^@app\.delete\("/icp/recommended' backend/api.py
#
# Service calls (ICP_generator, icp_research_1..4, _reserve_unique_icp_id, etc.)
# become icp_service.ICP_generator, icp_service._reserve_unique_icp_id, etc.
```

Copy the four route handlers, applying the qualified-call substitution.

- [ ] **Step 3: Verify**

```bash
cd backend && python -c "from app.routers import icp; print(len(icp.router.routes), 'routes')"
```

Expected: `4 routes`.

- [ ] **Step 4: Wire into `app/main.py`**

```python
from app.routers import icp

app.include_router(icp.router)
```

- [ ] **Step 5: Remove ICP functions from `services.py`**

Delete the five ICP-related function definitions (and `ICP_FUNCTIONS` / `ICP_FUNCTIONS_CLAUDE` dispatch dicts) from `backend/services.py`. Locate via grep.

- [ ] **Step 6: Remove ICP-id helpers from `api.py`**

Delete `_ensure_icp_id_registry_indexes`, `_reserve_unique_icp_id`, `_release_icp_id` from `backend/api.py` (locate via grep).

- [ ] **Step 7: Delete ICP routes from `api.py`**

```bash
grep -nE '^@app\.(get|post|delete)\("/icp' backend/api.py
```

Expected: Zero matches.

- [ ] **Step 8: Run ICP tests**

```bash
cd backend && pytest tests/test_icp.py -q 2>&1 | tail -10
cd backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: All pass; full suite same count.

- [ ] **Step 9: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract icp router and service [phase A, commit 13/16]"
```

---

### Task 14: Extract `signals` router and service (7 routes + 4 service functions + the batch helper)

**Files:**
- Create: `backend/app/routers/signals.py`
- Create: `backend/app/services/signals.py`
- Modify: `backend/app/main.py`
- Modify: `backend/api.py`
- Modify: `backend/services.py`

**Routes:** `POST /signals-research`, `POST /generate-signals-batch`, `POST /generate-signals-batch_claude`, `GET /fetch-signals`, `POST /signal_action`, `POST /signal_Ask`, `POST /signal_ask_claude` — locate with `grep -nE '^@app\.(get|post)\("/(signals-research|generate-signals-batch|fetch-signals|signal_action|signal_Ask|signal_ask_claude)' backend/api.py`.

**Service functions:** `_signals_agent_output`, `search_signals_scout`, `search_signals_profiler` — locate with `grep -nE '^def (_signals_agent_output|search_signals_scout|search_signals_profiler)' backend/services.py`.

**Module-level constants:** `SIGNALS_FUNCTIONS` dispatch dict — `grep -n '^SIGNALS_FUNCTIONS' backend/services.py`.

**Router-internal helper:** `_generate_signals_batch_core` — `grep -n '^async def _generate_signals_batch_core' backend/api.py`. It's an async dispatch wrapper around the `/generate-signals-batch` endpoints. Decision: place in `app/services/signals.py` because it calls service functions and is reused by two routes.

- [ ] **Step 1: Create service module**

Write `backend/app/services/signals.py`:

```python
"""Signals service: Scout/Profiler signal search + batch generation.

Phase B will dedupe search_signals_scout and search_signals_profiler
(~80% overlapping). For now they remain near-duplicates.
"""
import json
import re
from typing import List, Dict, Any, Tuple

from langchain_core.messages import HumanMessage, SystemMessage

from app.core import database
from app.core import llm_config
from app.core.config import claude_sonnet_model, tavily_api_key
from app.models import MarketRequest
from app.services._retrieval import (
    _build_signal_context_queries,
    _fetch_pinecone_supporting_context,
)
from app.services._claude_budget import (
    _estimate_token_count,
    _reserve_claude_signal_budget,
    _finalize_claude_signal_budget,
    CLAUDE_API_KEY,
    CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
)
from app.services.market_research import (
    _tavily_context_and_urls,
    _claude_messages_text,
)
```

Copy from `services.py` (locate each via grep — see task header):
- `_signals_agent_output`
- `search_signals_scout`
- `search_signals_profiler`
- `SIGNALS_FUNCTIONS` dispatch dict

Copy from `api.py`:
- `_generate_signals_batch_core` — change all bare service function calls (e.g., `search_signals_scout(...)`) to module-qualified form. Since they're now in this same `signals.py` module, the local references work without prefix.

**Inside `_generate_signals_batch_core`** there is a deferred `from services import fetch_leads_for_org`. After this task, `app/services/leads.py` is the canonical home — rewrite the deferred import to `from app.services.leads import fetch_leads_for_org` as part of the copy. (The duplicate deferred import inside `/signals-research` likewise becomes `from app.services.leads import fetch_leads_for_org`.)

- [ ] **Step 2: Create router module**

Write `backend/app/routers/signals.py`:

```python
"""Signals endpoints: research, batch generation, signal feed, signal Q&A."""
from fastapi import APIRouter, Query

from app.core import database
from app.models import MarketRequest, SignalActionRequest, SignalAskRequest
from app.services import signals as signals_service

router = APIRouter()


# Locate each handler with the grep in the task header.
#
# Service calls (search_signals_scout, search_signals_profiler,
# _generate_signals_batch_core, _signals_agent_output) become
# signals_service.search_signals_scout, etc.
```

Copy the seven route handlers, applying qualified-call substitution.

- [ ] **Step 3: Verify**

```bash
cd backend && python -c "from app.routers import signals; print(len(signals.router.routes), 'routes')"
```

Expected: `7 routes`.

- [ ] **Step 4: Wire into `app/main.py`**

```python
from app.routers import signals

app.include_router(signals.router)
```

- [ ] **Step 5: Remove signal functions from `services.py`**

Delete from `backend/services.py` (locate each via grep):
- `_signals_agent_output`
- `search_signals_scout`
- `search_signals_profiler`
- `SIGNALS_FUNCTIONS` dispatch dict

- [ ] **Step 6: Remove `_generate_signals_batch_core` from `api.py`**

Locate via `grep -n '^async def _generate_signals_batch_core' backend/api.py` and delete the function.

- [ ] **Step 7: Delete signal routes from `api.py`**

```bash
grep -nE '^@app\.(get|post)\("/(signals-research|generate-signals-batch|fetch-signals|signal_action|signal_Ask|signal_ask_claude)' backend/api.py
```

Expected: Zero matches.

- [ ] **Step 8: Run signals tests**

```bash
cd backend && pytest tests/test_signals.py -q 2>&1 | tail -10
cd backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: All pass; full suite same count.

- [ ] **Step 9: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract signals router and service [phase A, commit 14/16]"
```

---

### Task 15: Extract `market_scoring` router and service (3 routes + scoring helpers + background task)

The largest, most-stateful extraction — last. Includes the entire `_run_market_scoring_for_org` background task, the Mongo collection helpers, the lead-identity helpers, and the score-row aggregators.

**Files:**
- Create: `backend/app/routers/market_scoring.py`
- Create: `backend/app/services/market_scoring.py`
- Modify: `backend/app/main.py`
- Modify: `backend/api.py`
- Modify: `backend/services.py`

**Routes:** `POST /leads/market-scores`, `GET /leads/market-scores/status`, `GET /leads/{lead_id}/market-score-descriptions` — locate with `grep -nE '^@app\.(get|post)\("/leads/(market-scores|\{lead_id\}/market-score)' backend/api.py`.

**Service functions from services.py:** `fetch_leads_for_org` (already moved in Task 9 — re-export from `app.services.leads`), `get_company_profile_for_org`, `get_market_reports_for_org`, `_clean_and_parse_json`, `score_single_lead_against_market` — locate with `grep -nE '^def (get_company_profile_for_org|get_market_reports_for_org|_clean_and_parse_json|score_single_lead_against_market)' backend/services.py`.

**Helpers from api.py (move all 18) — locate with the grep below:**

```bash
grep -nE '^(async )?def (_get_profiler_mongo_client|_get_market_score_collections|_safe_json_to_obj|_normalize_non_empty_string|_canonicalize_key|_build_lookup_maps|_first_non_empty_value_from_keys|_extract_company_name|_extract_lead_name|_get_lead_identity_from_neo4j|_lead_to_score_row|_extract_description_preview|_get_latest_market_score_rows|_get_latest_scoring_run|_parse_iso_datetime|_is_stale_queued_run|_persist_market_score_for_lead|_run_market_scoring_for_org)' backend/api.py
```

Expected: 18 matches covering the helper cluster + the `_run_market_scoring_for_org` background task at the bottom.

- [ ] **Step 1: Create service module**

Write `backend/app/services/market_scoring.py`:

```python
"""Lead market scoring service.

Owns:
  - Profiler Mongo connection (separate cluster from Scout)
  - Lead identity extraction (cross-source name normalization)
  - Single-lead scoring against market reports
  - Bulk scoring background task with stale-run detection

This is the largest service module — extracted last in phase A.
Phase B candidates: DI for the Profiler Mongo client, dedupe of the
lead-name/company-name extraction helpers.
"""
import json
import urllib.parse
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

from app.core import database
from app.core import llm_config
from app.models import (
    LeadMarketScoreRow,
    LeadMarketScoreStatusItem,
    MARKET_SCORE_COMPONENT_KEYS,
)
from app.services.leads import fetch_leads_for_org
```

Copy from `api.py` (locate via the 18-name grep in the task header):
- All 18 helpers (Mongo connection + lead-identity + scoring + background task)

Copy from `services.py` (locate via grep):
- `get_company_profile_for_org`
- `get_market_reports_for_org`
- `_clean_and_parse_json`
- `score_single_lead_against_market`

- [ ] **Step 2: Create router module**

Write `backend/app/routers/market_scoring.py`:

```python
"""Lead market scoring endpoints: score / status / per-lead descriptions."""
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from app.core import database
from app.models import (
    LeadMarketScoresRequest,
    LeadMarketScoresResponse,
    LeadMarketScoringStatusResponse,
    LeadMarketScoreDescriptionsResponse,
)
from app.services import market_scoring as market_scoring_service

router = APIRouter()


# Locate each handler with the grep in the task header.
#
# Service calls (_run_market_scoring_for_org, _get_latest_market_score_rows,
# _get_latest_scoring_run, score_single_lead_against_market, etc.) become
# market_scoring_service.<name>.
```

Copy the three route handlers, applying qualified-call substitution.

- [ ] **Step 3: Verify**

```bash
cd backend && python -c "from app.routers import market_scoring; print(len(market_scoring.router.routes), 'routes')"
```

Expected: `3 routes`.

- [ ] **Step 4: Wire into `app/main.py`**

```python
from app.routers import market_scoring

app.include_router(market_scoring.router)
```

- [ ] **Step 5: Remove scoring functions from `services.py`**

Delete from `backend/services.py` (locate each via grep):
- `get_company_profile_for_org`
- `get_market_reports_for_org`
- `_clean_and_parse_json`
- `score_single_lead_against_market`

Also remove the temporary `fetch_leads_for_org` alias added in Task 9 step 5.

- [ ] **Step 6: Remove scoring helpers from `api.py`**

Delete the 18 helpers from `backend/api.py` (locate via the grep in the task header).

- [ ] **Step 7: Delete scoring routes from `api.py`**

```bash
grep -nE '^@app\.(get|post)\("/leads/(market-scores|\{lead_id\}/market-score)' backend/api.py
```

Expected: Zero matches.

- [ ] **Step 8: Run market_scoring tests**

```bash
cd backend && pytest tests/test_market_scoring.py -q 2>&1 | tail -10
cd backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: All pass; full suite same count.

- [ ] **Step 9: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract market_scoring router and service [phase A, commit 15/16]"
```

---

## Phase 5: Finalize (1 commit)

### Task 16: Delete `api.py` and `services.py`; cleanup root `main.py`

After Tasks 4-15, `backend/api.py` and `backend/services.py` should be empty (or contain only stray comments / imports). This commit verifies and deletes them, plus cleans up the root `main.py` shim's now-unnecessary `import api` bridge.

**Files:**
- Delete: `backend/api.py`
- Delete: `backend/services.py`
- Modify: `backend/main.py` (remove `import api`)

- [ ] **Step 1: Audit residual content in api.py**

```bash
cd backend
echo "=== api.py size ==="
wc -l api.py
echo "=== api.py routes (should be 0) ==="
grep -cE "^@app\." api.py || echo "0"
echo "=== api.py function defs (should be only stragglers, if any) ==="
grep -cE "^(async )?def " api.py || echo "0"
echo "=== api.py imports ==="
grep -E "^(from|import)" api.py
```

Expected: route count 0; function count 0 (or a small number that you've explicitly accounted for). Imports should be just leftover module-level imports.

If any routes or functions remain — **stop** and investigate. Don't delete. Most likely cause: a route or helper that was missed in Tasks 4-15. Add it to the appropriate router/service file in a separate commit, then come back.

- [ ] **Step 2: Audit residual content in services.py**

```bash
cd backend
echo "=== services.py size ==="
wc -l services.py
echo "=== services.py function defs (should be 0) ==="
grep -cE "^(async )?def " services.py || echo "0"
echo "=== services.py imports ==="
grep -E "^(from|import)" services.py
```

Expected: function count 0. If non-zero — stop, investigate.

- [ ] **Step 3: Confirm no other file imports from `api` or `services`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git grep -nE "^from (api|services) import|^import (api|services)" -- ':!backend/api.py' ':!backend/services.py' ':!backend/test_*.py'
```

Expected: Zero matches. (The exclusions exempt the legacy `backend/test_*.py` files which are live-prod smoke probes, not part of the refactor.)

- [ ] **Step 4: Confirm legacy smoke-test scripts at `backend/test_*.py` still work conceptually**

These are out-of-scope live-prod probes, but they import from somewhere. Check:

```bash
cd backend && grep -E "^(from|import)" test_*.py | grep -v __pycache__
```

If any test_*.py imports from `api` or `services`, decide:
- (a) If it hits a route URL only via httpx (no import), no change needed.
- (b) If it does `from api import X`, update to `from app.routers.<domain> import X` — but only if the file is still actively used. Otherwise note as phase-B cleanup.

Spec §2.4 success criterion 4 (bisectable) requires this commit not break anything. If the legacy smoke probes have a hard import dependency on api/services, leave a deprecation comment in their file and update on a follow-up commit (within Task 16).

- [ ] **Step 5: Delete `api.py` and `services.py`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git rm backend/api.py backend/services.py
```

- [ ] **Step 6: Clean up root `main.py` shim**

Open `backend/main.py`. Current contents (from Task 3):

```python
"""Backend entrypoint shim — preserves `uvicorn main:app` for Render and local dev."""
from app.main import app
import api  # noqa: F401 — registers routes by import side-effect (interim; routers replace this in Tasks 4-15)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

Replace with the final shim (no `import api` line):

```python
"""Backend entrypoint shim — preserves `uvicorn main:app` for Render and local dev."""
from app.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

- [ ] **Step 7: Verify the FastAPI app still has all 52 routes mounted**

```bash
cd backend && python -c "
from main import app
route_paths = [r.path for r in app.routes if hasattr(r, 'methods')]
print(f'Total routes: {len(route_paths)}')
print(f'Sample: {sorted(route_paths)[:5]}')
"
```

Expected: ~52 routes (plus FastAPI's default `/docs`, `/openapi.json`, `/redoc` — so the printed count is closer to 55-56). Sample shows a sorted list including `/Sales_Pipeline`, `/ask/`, `/chat/`, etc.

- [ ] **Step 8: Run full test suite**

```bash
cd backend && pytest tests/ -q 2>&1 | tail -10
```

Expected: Same passing count as the pre-flight baseline (Task 0 Step 2). If different — **stop**, investigate.

- [ ] **Step 9: Run final patch-target census diff**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git grep -n "mocker.patch(" backend/tests/ > /tmp/patch-census-after.txt
diff /tmp/patch-census-before.txt /tmp/patch-census-after.txt | head -30
```

Expected: All patch targets in `after` go through `app.core.database.*` or `app.core.llm_config.*`. No `api.*` or `services.*` paths remain.

- [ ] **Step 10: Verify `app/` directory shape**

```bash
ls /projects/Brewra/brewra-gtm-intelligence/backend/app/
ls /projects/Brewra/brewra-gtm-intelligence/backend/app/core/
ls /projects/Brewra/brewra-gtm-intelligence/backend/app/routers/
ls /projects/Brewra/brewra-gtm-intelligence/backend/app/services/
```

Expected (per spec §5):
- `app/`: `__init__.py`, `main.py`, `core/`, `models.py`, `routers/`, `services/`
- `app/core/`: `__init__.py`, `config.py`, `database.py`, `llm_config.py`
- `app/routers/`: `__init__.py` + 11 domain files
- `app/services/`: `__init__.py` + 11 domain files + `_retrieval.py` + `_claude_budget.py`

- [ ] **Step 11: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): delete api.py and services.py; phase A complete [phase A, commit 16/16]"
```

---

## Post-Phase A Validation Checklist

After Task 16, before merging the feature branch into `master`:

- [ ] `pytest backend/tests/` matches pre-flight baseline passing count
- [ ] `git log --oneline master..HEAD | wc -l` shows ~16 commits (15 if Task 0 had no commit, plus 16 from Tasks 1-16)
- [ ] `git log --oneline master..HEAD` — every commit message includes `[phase A, commit N/16]`
- [ ] For each commit on the branch: `git checkout <sha> && cd backend && pytest tests/ -q` passes (branch is bisectable). You don't need to verify every commit manually — spot-check 3-5 random commits including commit 2 (the highest-risk one) and commit 15 (the largest extraction).
- [ ] `backend/api.py` and `backend/services.py` no longer exist
- [ ] `backend/main.py` is the 6-line shim
- [ ] `find backend/app/ -name "*.py" | wc -l` shows the expected module count (1 main + 4 core + 13 routers/services + 11 routers + 11 services = ~40 files)
- [ ] No symbol mocked in `conftest.py` resolves to a path outside `app.core.*`

After merge: the next plan is `modularization-plan-2.md` (phase B). Open questions captured in spec §8 ("Open questions to resolve during execution") that were resolved during Task 0 / Task 1 should be noted as Deviations at the top of this plan (matching the convention in `plans/03-characterization-tests.md`).
