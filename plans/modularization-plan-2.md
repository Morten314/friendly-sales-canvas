# Backend Modularization Phase B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the layered architecture Phase A *drew* actually *true*: extract router business logic into services, centralize the 26 inline `MongoClient` constructions, dedupe the Groq/Claude handler pairs and Scout/Profiler signal-search functions, split `models.py` per domain, rename `database.py` → `clients.py`, add `prefix`/`tags`/`response_model` to every router, and sweep three classes of language hygiene (`bare except`, `print()`, `datetime.utcnow()`). 25 commits, single feature branch.

**Architecture:** Eight sub-phases (B-1 setup → B-8 hygiene). Each commit independently green; branch is bisectable. Tests are the contract — Phase A's characterization suite catches any behavior drift. Two intentional exceptions: `response_model` enforcement (C4) may surface latent serialization bugs to fix in the same commit, and `MongoClient` consolidation (B1) replaces 26 per-request connections with a singleton (observably better, not strictly identical).

**Tech Stack:**
- FastAPI `APIRouter` (already in use from Phase A)
- pytest + pytest-mock for the safety net (existing suite at `backend/tests/`)
- Reference spec: `specs/2026-05-21-backend-modularization-phase-b-design.md`
- Naming series: `modularization-plan-1.md` (Phase A, complete), `modularization-plan-2.md` (this), future `modularization-plan-3.md` (Phase C).

**Branch:** `refactor-backend-modularization-phase-b` off `master` (flat naming matches Phase A's `refactor-backend-modularization-phase-a`; the slash-namespaced form collides with a stale top-level `refactor` ref). No squash on merge.

---

## Note on line numbers

Hard line numbers in this plan reference the **post-Phase-A** state captured at plan-writing time (2026-05-22). Many tasks shift lines in downstream files (every router/service touched by a task changes its own line numbering for subsequent tasks). Locate every helper, route, or symbol via `grep` before editing — line numbers are hints, not coordinates.

**Standard locators:**
- Routes: `grep -nE '@router\.(get|post|put|delete)\("<path>"' backend/app/routers/<file>.py`
- Functions: `grep -nE '^(async )?def <name>' backend/app/{routers,services}/*.py`
- Inline MongoClient: `grep -nE '^\s*\w+\s*=\s*MongoClient\(' backend/app/`
- `from app.X import` callsites: `git grep -n "from app\.X" backend/`

---

## Pre-flight: Census and Baseline

Before any moves, capture a clean test baseline and inventory the patch targets that Phase B will touch.

### Task 0: Pre-flight audit and baseline

**Files:**
- Read-only: `backend/tests/conftest.py`, all `backend/app/` files

- [ ] **Step 1: Create the feature branch**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master
git status   # must be clean
git checkout -b refactor-backend-modularization-phase-b
```

- [ ] **Step 2: Capture baseline test result**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/ -q 2>&1 | tail -10
```

Record the passing-test count. Every Phase B commit must produce ≥ this count.

- [ ] **Step 3: Census the inline `MongoClient` constructions (for Task 5)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -rn "MongoClient(" app/ | grep -v "app/core/database.py" > /tmp/mongoclient-census.txt
wc -l /tmp/mongoclient-census.txt
cat /tmp/mongoclient-census.txt
```

Expected: ~26 lines across `app/routers/{documents,signals,org_auth,icp,profiles}.py` and `app/services/market_scoring.py`. The legitimate singleton in `app/core/database.py:39` is the only construction site that survives Phase B.

- [ ] **Step 4: Census `from app.main import logger` callsites (for Task 1)**

```bash
git grep -n "from app.main import logger" backend/
```

Expected: 3 files — `app/routers/org_auth.py`, `app/routers/documents.py`, `app/routers/leads.py`.

- [ ] **Step 5: Census `from app.core.database` callsites (for Task 2)**

```bash
git grep -n "from app.core.database\|from app.core import database\|app.core.database" backend/
```

Save the file list — every match is touched in Task 2's rename sweep.

- [ ] **Step 6: Census `from app.models` callsites (for Task 3)**

```bash
git grep -n "from app.models import\|from app import models\|app.models" backend/
```

Save the file list — every match is touched in Task 3's split.

- [ ] **Step 7: Census `print(` callsites in icp/signals routers (for Task 24)**

```bash
grep -nE "^\s+print\(" backend/app/routers/icp.py backend/app/routers/signals.py
```

Expected: ~13 in `icp.py`, ~6 in `signals.py`.

- [ ] **Step 8: Census `datetime.utcnow` callsites (for Task 25)**

```bash
git grep -n "datetime\.utcnow()" backend/app/
```

Expected: 10+ matches across services and routers.

- [ ] **Step 9: Census bare `except:` clauses (for Task 23)**

```bash
git grep -nE "^\s+except:\s*$" backend/app/
```

Record exact file/line pairs.

- [ ] **Step 10: Census `HTTPException` raises in services (for Task 14)**

```bash
grep -rn "raise HTTPException" backend/app/services/
```

Expected: 2 — `_claude_budget.py:55` and `icp.py:689`.

- [ ] **Step 11: Confirm the test entrypoint**

```bash
git grep -n "from app.main import app\|from main import app" backend/tests/
```

Note the entrypoint — Phase B does NOT change it.

- [ ] **Step 12: No commit; pre-flight only.**

```bash
git status   # untracked /tmp/* files don't matter; working tree should be clean
```

---

## Phase B-1: Setup (4 commits)

Cheap mechanical moves that unblock later phases. Each is small in code change but touches many files.

### Task 1: Move `logger` to `app/core/logging.py` (A3)

**Files:**
- Create: `backend/app/core/logging.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/routers/org_auth.py`, `backend/app/routers/documents.py`, `backend/app/routers/leads.py`

- [ ] **Step 1: Create `app/core/logging.py`**

Write `backend/app/core/logging.py`:

```python
"""Centralized logger.

Moved from `app/main.py` in Phase B (Task 1) to eliminate the
`from app.main import logger` partial-import path that three routers
relied on. New convention: any module needing the logger imports it
from here.
"""
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger("brewra")
```

- [ ] **Step 2: Update `app/main.py` to import logger from the new location**

In `backend/app/main.py`, find the existing block:

```python
# Logging configuration.
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
```

Replace with:

```python
from app.core.logging import logger  # noqa: F401 — re-exported for backward compat within Phase B
```

Also remove `import logging` from `app/main.py` if no other code in the file uses `logging` directly. (Verify with `grep -n "logging\." backend/app/main.py`.)

- [ ] **Step 3: Update the 3 routers that import logger from `app.main`**

For each of `app/routers/org_auth.py`, `app/routers/documents.py`, `app/routers/leads.py`:

```bash
sed -i 's|from app.main import logger|from app.core.logging import logger|' backend/app/routers/org_auth.py backend/app/routers/documents.py backend/app/routers/leads.py
```

- [ ] **Step 4: Verify no stragglers**

```bash
git grep -n "from app.main import logger" backend/
```

Expected: zero matches.

- [ ] **Step 5: Verify the logger still resolves**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
python -c "from app.core.logging import logger; logger.info('logger relocation works')"
```

Expected: `INFO - brewra - INFO - logger relocation works` (or similar — the key signal is no ImportError).

- [ ] **Step 6: Run full test suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: Same passing count as baseline.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): move logger to app/core/logging.py [phase B, commit 1/25]"
```

---

### Task 2: Rename `app/core/database.py` → `app/core/clients.py` (C2)

**Files:**
- Rename: `backend/app/core/database.py` → `backend/app/core/clients.py`
- Modify: every file importing from `app.core.database` (see Task 0 Step 5 census)
- Modify: `backend/tests/conftest.py` (patch targets)

- [ ] **Step 1: Rename the file**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
git mv app/core/database.py app/core/clients.py
```

- [ ] **Step 2: Update the module docstring inside the renamed file**

Open `backend/app/core/clients.py`. Find the existing top docstring (if any) or first-line comment and update / add:

```python
"""External service clients: Neo4j driver, Mongo client(s), S3 client, Pinecone client.

Renamed from `app/core/database.py` in Phase B (Task 2) — the file holds
multiple external clients (not just "the database"). After Task 5 (B1),
this module also exposes `profiler_client` for the secondary Mongo cluster.
"""
```

Place this at the very top of the file, above the `import os` line.

- [ ] **Step 3: Update all import sites**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Replace "from app.core.database" with "from app.core.clients"
git grep -l "from app.core.database" backend/ | xargs sed -i 's|from app\.core\.database|from app.core.clients|g'
# Replace "from app.core import database" with "from app.core import clients as database" for now —
# downstream code still references `database.driver`, `database.client`, etc. We rename the symbol in step 4.
git grep -l "from app.core import database" backend/ | xargs sed -i 's|from app\.core import database|from app.core import clients as database|g'
```

- [ ] **Step 4: Rename the local alias from `database` to `clients` across consumer files**

This is a careful sweep. The previous step left consumers using `database.driver`, `database.client`, etc. via an alias. Now switch them to `clients.driver`, `clients.client`:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Remove the alias in import lines:
git grep -l "from app.core import clients as database" backend/ | xargs sed -i 's|from app\.core import clients as database|from app.core import clients|g'
# Replace references:
git grep -l "database\.\(driver\|client\|graph\|s3_client\|pc\|query\|results_to_string\|escape_property_name\|upsert_node\)" backend/app/ | xargs sed -i 's|\bdatabase\.\(driver\|client\|graph\|s3_client\|pc\|query\|results_to_string\|escape_property_name\|upsert_node\)|clients.\1|g'
```

(If sed's `\b` doesn't work on this system, use a Python one-liner: `python -c "import re, sys; ...` per file. Confirm with the verification step below.)

- [ ] **Step 5: Update `tests/conftest.py` patch paths**

In `backend/tests/conftest.py`, replace every occurrence of `app.core.database` with `app.core.clients`:

```bash
sed -i 's|app\.core\.database|app.core.clients|g' backend/tests/conftest.py
```

- [ ] **Step 6: Verify no stragglers**

```bash
git grep -n "app\.core\.database" backend/
git grep -n "from app.core.database" backend/
git grep -n "\bdatabase\.\(driver\|client\|graph\|s3_client\|pc\)" backend/app/
```

Expected: zero matches for all three (except possibly inside string literals or comments — inspect manually).

- [ ] **Step 7: Run full test suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: Same passing count.

- [ ] **Step 8: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): rename app/core/database.py to clients.py [phase B, commit 2/25]"
```

---

### Task 3: Split `app/models.py` into `app/models/<domain>.py` (C1)

**Files:**
- Delete: `backend/app/models.py`
- Create: `backend/app/models/__init__.py`, `backend/app/models/leads.py`, `backend/app/models/market_scoring.py`, `backend/app/models/profiles.py`, `backend/app/models/customer_profile.py`, `backend/app/models/pipeline.py`, `backend/app/models/signals.py`, `backend/app/models/org_auth.py`, `backend/app/models/graph_chat.py`, `backend/app/models/market_research.py`
- Modify: every router/service file that currently imports from `app.models` (see Task 0 Step 6 census)
- Modify: `backend/tests/` files that import models

- [ ] **Step 1: Read the current `models.py`**

```bash
cat backend/app/models.py
```

Confirm the class list matches the spec §4.3 C1 table (27 classes). If any class is in the file but not in the spec table, **stop** — update the spec mapping first before splitting.

- [ ] **Step 2: Create the `app/models/` package**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
git mv app/models.py app/_models_old.py   # temp: keeps source readable while we split
mkdir -p app/models
touch app/models/__init__.py
```

- [ ] **Step 3: Create `app/models/leads.py`**

Write `backend/app/models/leads.py`:

```python
"""Lead and contact models."""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel


class Contact(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None


class Lead(BaseModel):
    lead_id: Optional[str] = None
    company: str
    industry: str
    size: str
    region: str
    location: str
    techStack: List[str]
    contact: Contact
    status: str
    user_id: Optional[str] = None
    org_id: Optional[str] = None


class LeadCreateRequest(BaseModel):
    user_id: str
    org_id: str
    data: Dict[str, Any]


class LeadUpdateRequest(BaseModel):
    user_id: str
    org_id: str
    # Copy remaining fields from app/_models_old.py LeadUpdateRequest.
```

Open `app/_models_old.py`, locate `class LeadUpdateRequest`, copy its body into the file above verbatim. Same for any other class in this domain.

- [ ] **Step 4: Create `app/models/market_scoring.py`**

Locate in `app/_models_old.py` and copy verbatim:
- `LeadMarketScoresRequest`
- `LeadMarketScoreRow`
- `LeadMarketScoresResponse`
- `LeadMarketScoreDescriptionsResponse`
- `LeadMarketScoreStatusItem`
- `LeadMarketScoringStatusResponse`

Add header:

```python
"""Lead market scoring models."""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict
```

- [ ] **Step 5: Create `app/models/profiles.py`**

Copy verbatim from `_models_old.py`:
- `SocialMedia`
- `CompanyProfile`
- `UserProfile`
- `ScoutProfile`
- `EditRequest`

Header:

```python
"""User, company, scout profile models. Includes EditRequest (per-domain edit handler payload)."""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
```

If A1.3 (Task 8) later reveals `EditRequest` is consumed across multiple routers, it can move to `app/models/_shared.py`. For now, it lives in `profiles.py`.

- [ ] **Step 6: Create `app/models/customer_profile.py`**

Copy verbatim:
- `CustomerProfileICP`
- `CustomerProfileRequest`
- `SuggestedICPToCustomerProfileRequest`

Header:

```python
"""Customer profile models."""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
```

- [ ] **Step 7: Create `app/models/pipeline.py`**

Copy verbatim:
- `StageStats`
- `TimeframeResponse`
- `SalesPipelineResponse`

Header:

```python
"""Sales pipeline aggregator models."""
from typing import Dict
from pydantic import BaseModel
```

- [ ] **Step 8: Create `app/models/signals.py`**

Copy verbatim:
- `SignalActionRequest`
- `SignalAskRequest`

Header:

```python
"""Signal request models."""
from typing import Optional, Any
from pydantic import BaseModel
```

- [ ] **Step 9: Create `app/models/org_auth.py`**

Copy verbatim:
- `RegistrationRequest`
- `RegistrationResponse`

Header:

```python
"""Org registration / auth models."""
from typing import Optional
from pydantic import BaseModel
```

- [ ] **Step 10: Create `app/models/graph_chat.py`**

Copy verbatim:
- `ProspectData`

Header:

```python
"""Prospect / graph chat models."""
from pydantic import BaseModel
```

- [ ] **Step 11: Create `app/models/market_research.py`**

Copy verbatim:
- `MarketRequest`

Header:

```python
"""Market research request models."""
from pydantic import BaseModel
```

- [ ] **Step 12: Verify class accounting**

```bash
grep -c "^class " backend/app/_models_old.py
grep -c "^class " backend/app/models/*.py
```

Both numbers must equal 27. If they differ, find the missing class and place it.

- [ ] **Step 13: Update import sites across routers and services**

For each router/service file that imports from `app.models`, change `from app.models import X` to `from app.models.<domain> import X`. Use the census from Task 0 Step 6 to know which files to touch. Domain assignment per spec §4.3 C1.

Example mechanical transform for `app/routers/leads.py`:

```bash
sed -i 's|from app\.models import \(Lead\|Contact\|LeadCreateRequest\|LeadUpdateRequest\)|from app.models.leads import \1|g' backend/app/routers/leads.py
```

Repeat for each router/service with its domain. Use the census in Task 0 Step 6 as the authoritative file list — work file by file.

For files importing multiple classes from different domains, split the import statement:

```python
# Before:
from app.models import Lead, MarketRequest

# After:
from app.models.leads import Lead
from app.models.market_research import MarketRequest
```

- [ ] **Step 14: Update test files**

```bash
git grep -nl "from app.models import\|from app import models" backend/tests/
```

For each match, update imports analogously.

- [ ] **Step 15: Verify the old file is now empty of consumers**

```bash
git grep -n "from app.models import\|from app import models\|^from app\.models$" backend/
```

Expected: zero matches (everything is now `from app.models.<domain>`).

- [ ] **Step 16: Delete the temporary file**

```bash
git rm backend/app/_models_old.py
```

- [ ] **Step 17: Verify imports resolve**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
python -c "
from app.models.leads import Lead, Contact, LeadCreateRequest, LeadUpdateRequest
from app.models.market_scoring import LeadMarketScoresRequest, LeadMarketScoreRow
from app.models.profiles import CompanyProfile, UserProfile, ScoutProfile, SocialMedia, EditRequest
from app.models.customer_profile import CustomerProfileICP, CustomerProfileRequest
from app.models.pipeline import SalesPipelineResponse
from app.models.signals import SignalActionRequest, SignalAskRequest
from app.models.org_auth import RegistrationRequest, RegistrationResponse
from app.models.graph_chat import ProspectData
from app.models.market_research import MarketRequest
print('models split: all imports resolve')
"
```

Expected: `models split: all imports resolve`.

- [ ] **Step 18: Run full test suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: Same passing count.

- [ ] **Step 19: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): split models.py into app/models/<domain>.py [phase B, commit 3/25]"
```

---

### Task 4: Add `prefix` and `tags` to every `APIRouter()` (C3)

**Files:**
- Modify: every file in `backend/app/routers/`

**Approach:** add `tags=["<domain>"]` to every router. Add `prefix=<common>` only where ALL routes in the router share a common prefix segment.

Per-router prefix decisions:
- `pipeline.py` — no common prefix (`/Sales_Pipeline`, `/test-llm`). `prefix=""`.
- `org_auth.py` — no common prefix (`/org`, `/connect_org`, `/registration`). `prefix=""`.
- `profiles.py` — routes use `/profile/{profile_type}`, `/cleanup-company-profiles`, `/edit`. No common prefix. `prefix=""`.
- `customer_profile.py` — all routes start with `/customer_profile`. `prefix="/customer_profile"`.
- `documents.py` — routes: `/upload_file/`, `/upload`, `/upload-document`, `/document-status/{...}`, `/user-documents`, `/data-source/{...}`. No common prefix. `prefix=""`.
- `leads.py` — all routes start with `/leads`. `prefix="/leads"`.
- `graph_chat.py` — no common prefix (`/create-company`, `/ask`, `/chat`, `/query`, `/voice_graph`, `/text_graph`). `prefix=""`.
- `market_research.py` — routes: `/market-research`, `/market-research_claude`. Common prefix `/market-research` won't work (the second is `/market-research_claude`, NOT `/market-research/claude`). `prefix=""`.
- `icp.py` — routes: `/icp`, `/icp-research`, `/icp-research_claude`, `/icp/recommended/{...}`. Mixed (some `/icp` some `/icp-research`). Going to `prefix="/icp"` would break the dashed variants. `prefix=""`.
- `signals.py` — routes: `/signals-research`, `/generate-signals-batch`, `/generate-signals-batch_claude`, `/fetch-signals`, `/signal_action`, `/signal_Ask`, `/signal_ask_claude`. No clean common prefix. `prefix=""`.
- `market_scoring.py` — all routes start with `/leads/market-scores...` or `/leads/{lead_id}/market-score-descriptions`. Common is `/leads`, but that would conflict with `leads.py`. Keep `prefix=""`.

Net: only `customer_profile.py` and `leads.py` get a real prefix. The rest get `tags` only.

- [ ] **Step 1: Update `app/routers/pipeline.py`**

Locate the line `router = APIRouter()`. Replace with:

```python
router = APIRouter(tags=["pipeline"])
```

- [ ] **Step 2: Update `app/routers/org_auth.py`**

```python
router = APIRouter(tags=["org-auth"])
```

- [ ] **Step 3: Update `app/routers/profiles.py`**

```python
router = APIRouter(tags=["profiles"])
```

- [ ] **Step 4: Update `app/routers/customer_profile.py`**

```python
router = APIRouter(prefix="/customer_profile", tags=["customer-profile"])
```

Then update every `@router.<method>("...")` in the file: strip the `/customer_profile` prefix from each path. Examples:

```python
# Before
@router.get("/customer_profile")
# After
@router.get("")

# Before
@router.post("/customer_profile/from_suggested_icp")
# After
@router.post("/from_suggested_icp")

# Before
@router.delete("/customer_profile/icp/{icp_id}")
# After
@router.delete("/icp/{icp_id}")
```

After all edits, verify the resolved URLs match the original by inspecting:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
python -c "
from app.main import app
for route in app.routes:
    if 'customer_profile' in str(route.path):
        print(route.methods, route.path)
"
```

Expected: prints the same `/customer_profile`, `/customer_profile/from_suggested_icp`, `/customer_profile/icp/{icp_id}` etc. that existed before.

- [ ] **Step 5: Update `app/routers/documents.py`**

```python
router = APIRouter(tags=["documents"])
```

- [ ] **Step 6: Update `app/routers/leads.py`**

```python
router = APIRouter(prefix="/leads", tags=["leads"])
```

Then update every `@router.<method>("/leads...")` path to strip the `/leads` prefix:

```python
@router.get("/leads")           → @router.get("")
@router.post("/leads")          → @router.post("")
@router.put("/leads")           → @router.put("")
@router.delete("/leads")        → @router.delete("")
@router.post("/leads/batch-upload")     → @router.post("/batch-upload")
@router.get("/leads/by-file")           → @router.get("/by-file")
@router.get("/leads/stream/status")     → @router.get("/stream/status")
@router.delete("/leads/by-file/{file_id}") → @router.delete("/by-file/{file_id}")
@router.post("/leads/market-scores")    → STOP — this is owned by market_scoring.py
@router.get("/leads/market-scores/status") → STOP — market_scoring.py
@router.get("/leads/{lead_id}/market-score-descriptions") → STOP — market_scoring.py
```

The market-scoring routes are NOT in `leads.py`; they're in `market_scoring.py` and remain with `prefix=""` (see Step 11).

Verify post-edit:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
python -c "
from app.main import app
for route in app.routes:
    if 'leads' in str(route.path):
        print(route.methods, route.path)
" | sort
```

Expected: prints the same `/leads`, `/leads/batch-upload`, `/leads/by-file`, `/leads/stream/status`, `/leads/by-file/{file_id}`, `/leads/market-scores`, `/leads/market-scores/status`, `/leads/{lead_id}/market-score-descriptions` as before.

- [ ] **Step 7: Update `app/routers/graph_chat.py`**

```python
router = APIRouter(tags=["graph-chat"])
```

- [ ] **Step 8: Update `app/routers/market_research.py`**

```python
router = APIRouter(tags=["market-research"])
```

- [ ] **Step 9: Update `app/routers/icp.py`**

```python
router = APIRouter(tags=["icp"])
```

- [ ] **Step 10: Update `app/routers/signals.py`**

```python
router = APIRouter(tags=["signals"])
```

- [ ] **Step 11: Update `app/routers/market_scoring.py`**

```python
router = APIRouter(tags=["market-scoring"])
```

(No `prefix` — see analysis in the task preface.)

- [ ] **Step 12: Verify the URL surface is unchanged**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
python -c "
from app.main import app
paths = sorted(set(str(r.path) for r in app.routes if hasattr(r, 'path')))
for p in paths:
    print(p)
" > /tmp/phase-b-task-4-paths.txt
wc -l /tmp/phase-b-task-4-paths.txt
```

Compare against the pre-Task-4 path count. If you didn't snapshot it before, run this on the previous commit's tree (`git stash && python -c "..." > /tmp/before.txt && git stash pop`) and diff.

- [ ] **Step 13: Verify Swagger UI tagging**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
python -c "
from app.main import app
for route in app.routes:
    if hasattr(route, 'tags') and route.tags:
        print(route.tags, route.path)
" | head -20
```

Expected: every route has tags.

- [ ] **Step 14: Run full test suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: Same passing count. (Tests use URLs; tags/prefix changes don't change URLs.)

- [ ] **Step 15: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): add prefix and tags to every APIRouter [phase B, commit 4/25]"
```

---

## Phase B-2: MongoClient consolidation (1 commit)

### Task 5: Centralize 26 inline MongoClient constructions (B1)

**Files:**
- Modify: `backend/app/core/clients.py` (add `profiler_client` symbol)
- Modify: `backend/app/routers/documents.py`, `backend/app/routers/signals.py`, `backend/app/routers/org_auth.py`, `backend/app/routers/icp.py`, `backend/app/routers/profiles.py` (replace inline constructions)
- Modify: `backend/app/services/market_scoring.py` (replace `_get_profiler_mongo_client()` body + remove local helper)
- Modify: `backend/tests/conftest.py` (remove now-redundant per-router `MongoClient` patches; add `profiler_client` patch)

**The pattern.** Today, 26 sites contain:

```python
username = urllib.parse.quote_plus("techbrewra")
password = urllib.parse.quote_plus("Brewra@Best09")
mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/..."
client = MongoClient(mongo_uri)
```

(Variable names vary: `mongo_client`, `client`, `profiler_client`.)

After Task 5, all sites use the singleton:

```python
from app.core.clients import client
# ... use `client` directly
```

…or for the secondary Profiler cluster (1 site in `services/market_scoring.py`):

```python
from app.core.clients import profiler_client
```

- [ ] **Step 1: Add `profiler_client` to `app/core/clients.py`**

Open `backend/app/core/clients.py`. Locate the existing primary-cluster section (the `client = MongoClient(mongo_uri)` block guarded by `_SKIP_DB_INIT`). Below it, add:

```python
# Secondary "Profiler" cluster — used by market_scoring's lead-scoring pipeline.
# Migrated from app/services/market_scoring.py:_get_profiler_mongo_client() in Phase B.
profiler_client = None
if not _SKIP_DB_INIT:
    try:
        from app.core.config import profiler_mongo_uri  # add this config var if missing
        profiler_client = MongoClient(profiler_mongo_uri)
    except Exception as e:
        print("MongoDB Profiler connection failed:", e)
```

If `profiler_mongo_uri` doesn't exist in `app/core/config.py`, locate the URI used by `_get_profiler_mongo_client()` (read `services/market_scoring.py:37` and surrounding lines) and add it to `app/core/config.py` as `profiler_mongo_uri`. Pull the URI from the same source that the current helper uses (likely `os.getenv` with a fallback).

- [ ] **Step 2: Inspect each inline construction and replace**

For each file in the census (`/tmp/mongoclient-census.txt`), inspect and replace per the following per-file recipes.

**`app/routers/documents.py` (10 sites):**

Each site looks like:

```python
username = urllib.parse.quote_plus(...)
password = urllib.parse.quote_plus(...)
mongo_uri = f"mongodb+srv://..."
mongo_client = MongoClient(mongo_uri)
# ... uses mongo_client ...
```

Replace with:

```python
from app.core.clients import client as mongo_client
# ... uses mongo_client ...
```

If the import is already at the top of the file, drop it from the per-handler block and use `mongo_client` directly. The variable rename keeps existing references intact within each handler.

After all 10 sites in `documents.py`:
- Add `from app.core.clients import client as mongo_client` once at the top.
- Delete every 4-line credential block inside handlers.
- If `urllib.parse` is no longer used in the file, remove its import.

**`app/routers/signals.py` (8 sites):**

Same approach as documents. Variable names in this file are mixed (`client`, `profiler_client`, `mongo_client`). Disambiguate:

- Sites using the primary cluster (most of them): `from app.core.clients import client` at the top; replace inline `client = MongoClient(...)` blocks with nothing (already named).
- Sites using the Profiler cluster (`signals.py:138` and `signals.py:289` per Task 0 census): `from app.core.clients import profiler_client` at the top; replace `profiler_client = MongoClient(...)` blocks with nothing.

Verify by grep:

```bash
grep -n "MongoClient(" backend/app/routers/signals.py
```

Expected: zero matches.

**`app/routers/org_auth.py` (3 sites):**

Same pattern. Each site builds the primary-cluster URI and assigns to `mongo_client`. Replace with `from app.core.clients import client as mongo_client` at the top.

**`app/routers/icp.py` (2 sites):**

Each site uses the primary cluster. Replace with `from app.core.clients import client` at the top; rename downstream references from `client` to the same name (no change needed if already `client`).

**`app/routers/profiles.py` (2 sites):**

Same. One site uses `mongo_client`, one uses `client` (per Task 0 Step 3 census). Pick one alias (`client`); update accordingly.

**`app/services/market_scoring.py` (1 site):**

The function `_get_profiler_mongo_client()` at `services/market_scoring.py:37` returns a freshly-constructed Profiler-cluster client. Replace its body:

```python
# Before
def _get_profiler_mongo_client():
    username = urllib.parse.quote_plus("techbrewra")
    password = urllib.parse.quote_plus("Brewra@Best09")
    mongo_uri = f"mongodb+srv://..."  # Profiler URI
    return MongoClient(mongo_uri)
```

After:

```python
# After — keep the function as a thin alias so existing callers don't change in this commit.
# A future commit can inline-replace the function calls.
def _get_profiler_mongo_client():
    from app.core.clients import profiler_client
    return profiler_client
```

(Subsequent Phase B tasks that touch market_scoring may inline this further; leave alone for now.)

- [ ] **Step 3: Verify zero inline constructions remain**

```bash
grep -rn "MongoClient(" backend/app/ | grep -v "app/core/clients.py"
```

Expected: zero matches.

- [ ] **Step 4: Verify `urllib.parse.quote_plus` is no longer needed in routers**

```bash
grep -rn "urllib.parse" backend/app/routers/
```

Expected: zero matches (the credential-string assembly is the only reason routers imported `urllib`). Remove unused imports.

- [ ] **Step 5: Update `tests/conftest.py`**

Find the block that patches per-router `MongoClient`:

```python
# Around conftest.py:103-113 — confirm with grep
ROUTER_MODULES_WITH_INLINE_MONGOCLIENT = [
    "app.routers.documents",
    "app.routers.signals",
    "app.routers.org_auth",
    "app.routers.icp",
    "app.routers.profiles",
]
for mod in ROUTER_MODULES_WITH_INLINE_MONGOCLIENT:
    mocker.patch(f"{mod}.MongoClient", mock_constructor)
mocker.patch("app.services.market_scoring.MongoClient", mock_constructor)
```

Replace with:

```python
# Phase B Task 5: routers no longer construct MongoClient inline; they import
# `client` / `profiler_client` from app.core.clients. Patching the singletons
# (which conftest already does in `mock_mongo` for the primary client) is
# sufficient. Add the profiler_client patch:
mocker.patch("app.core.clients.profiler_client", mongo)  # same mock as primary
```

(Adjust the exact mock variable name to match the `mock_mongo` fixture's locals — read the surrounding code.)

- [ ] **Step 6: Run full test suite**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: Same passing count.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): centralize MongoClient construction to clients.client / clients.profiler_client [phase B, commit 5/25]"
```

---

## Phase B-3: Stub extractions (4 commits)

Move business logic out of routers whose service module is currently empty. Smallest first.

### Task 6: Extract `pipeline` service (A1.1)

**Files:**
- Modify: `backend/app/routers/pipeline.py`
- Modify: `backend/app/services/pipeline.py`

**Routes:** `GET /Sales_Pipeline`, `GET /test-llm`.

- [ ] **Step 1: Inspect the current router**

```bash
cat backend/app/routers/pipeline.py
```

Identify the handler bodies. The `/test-llm` handler likely returns a string from an LLM probe — pure I/O, no business logic. The `/Sales_Pipeline` handler aggregates lead stage counts from Neo4j — business logic.

- [ ] **Step 2: Add service functions to `app/services/pipeline.py`**

Write `backend/app/services/pipeline.py` (replacing the existing 5-line stub):

```python
"""Pipeline service: sales-pipeline aggregator + LLM probe."""
from typing import Dict

from app.core import clients
from app.core.config import STAGE_ORDER, STAGE_MAPPING
from app.core.llm_config import agent_chain
from app.models.pipeline import SalesPipelineResponse, TimeframeResponse, StageStats


def compute_sales_pipeline(org_id: str) -> SalesPipelineResponse:
    """Aggregate lead stage counts from Neo4j for the given org.

    Moved from app/routers/pipeline.py in Phase B Task 6.
    """
    # Copy the body of the /Sales_Pipeline handler from the current router file.
    # Replace any `return JSONResponse(...)` with `return SalesPipelineResponse(...)`.
    # Replace `database.driver` with `clients.driver` if not already done by Task 2.
    raise NotImplementedError("populate from the handler body during the move")


def probe_llm() -> Dict[str, str]:
    """LLM-availability smoke probe. Returns a small dict.

    Moved from app/routers/pipeline.py in Phase B Task 6.
    """
    # Copy the body of the /test-llm handler verbatim.
    raise NotImplementedError("populate from the handler body during the move")
```

Replace the two `NotImplementedError` lines with the actual handler bodies. The handler signature in the router today is `def get_sales_pipeline(...)` and `def test_llm()`; copy the body code only (not the FastAPI decorator).

- [ ] **Step 3: Reduce the router to HTTP wiring**

In `backend/app/routers/pipeline.py`, replace each handler body with a call to the service:

```python
"""Pipeline router: HTTP wiring for sales pipeline + LLM probe."""
from fastapi import APIRouter, Query

from app.services import pipeline as pipeline_service
from app.models.pipeline import SalesPipelineResponse

router = APIRouter(tags=["pipeline"])  # (Task 4 already added the tags arg)


@router.get("/Sales_Pipeline")
def get_sales_pipeline(org_id: str = Query(...)):
    return pipeline_service.compute_sales_pipeline(org_id)


@router.get("/test-llm")
def test_llm():
    return pipeline_service.probe_llm()
```

- [ ] **Step 4: Run pipeline-related tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_pipeline.py -v 2>&1 | tail -20
```

If `test_pipeline.py` doesn't exist, run the full suite:

```bash
pytest tests/ -q 2>&1 | tail -5
```

Expected: Same passing count.

- [ ] **Step 5: Verify routes still respond**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
python -c "
from app.main import app
paths = [str(r.path) for r in app.routes if hasattr(r, 'path')]
assert '/Sales_Pipeline' in paths, 'missing /Sales_Pipeline'
assert '/test-llm' in paths, 'missing /test-llm'
print('pipeline routes mounted')
"
```

Expected: `pipeline routes mounted`.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract pipeline service from router [phase B, commit 6/25]"
```

---

### Task 7: Extract `org_auth` service (A1.2)

**Files:**
- Modify: `backend/app/routers/org_auth.py`
- Modify: `backend/app/services/org_auth.py`

**Routes:** `GET /org`, `POST /org`, `POST /connect_org`, `GET /registration`, `POST /registration`.

- [ ] **Step 1: Inspect the current router**

```bash
wc -l backend/app/routers/org_auth.py
grep -nE "^@router\.|^(async )?def " backend/app/routers/org_auth.py
```

Identify the 5 handlers and their helper functions (if any).

- [ ] **Step 2: Identify the business-logic vs. wiring split**

Per handler:

- `GET /org` — fetches org list from Mongo. Service function: `list_orgs(user_id) -> List[dict]`.
- `POST /org` — creates org in Mongo. Service function: `create_org(payload) -> dict`.
- `POST /connect_org` — joins user to org in Mongo. Service function: `connect_user_to_org(user_id, org_id) -> dict`.
- `GET /registration` — fetches registration records (admin panel). Service function: `list_registrations() -> List[dict]`.
- `POST /registration` — creates registration record. Service function: `create_registration(payload: RegistrationRequest) -> RegistrationResponse`.

- [ ] **Step 3: Populate `app/services/org_auth.py`**

Write the service module with the function signatures above. For each function, copy the corresponding handler body verbatim — all Mongo access via `clients.client` (Task 5 already centralized), no inline `MongoClient`.

```python
"""Org / auth / registration service. HTTP-free."""
from typing import Dict, List

from app.core import clients
from app.core.logging import logger
from app.models.org_auth import RegistrationRequest, RegistrationResponse


def list_orgs(user_id: str) -> List[Dict]:
    # Copy body from `GET /org` handler.
    ...


def create_org(payload: Dict) -> Dict:
    # Copy body from `POST /org` handler.
    ...


def connect_user_to_org(user_id: str, org_id: str) -> Dict:
    # Copy body from `POST /connect_org` handler.
    ...


def list_registrations() -> List[Dict]:
    # Copy body from `GET /registration` handler.
    ...


def create_registration(payload: RegistrationRequest) -> RegistrationResponse:
    # Copy body from `POST /registration` handler.
    ...
```

Replace the `...` placeholders with the actual handler bodies. Wherever a handler returned a JSONResponse or a dict-keyed response, return the same structure.

- [ ] **Step 4: Reduce the router to HTTP wiring**

Open `backend/app/routers/org_auth.py`. Replace every handler body with a service call. Final shape:

```python
"""Org / auth / registration router. HTTP wiring only."""
from fastapi import APIRouter, Body, Query

from app.services import org_auth as org_auth_service
from app.models.org_auth import RegistrationRequest, RegistrationResponse

router = APIRouter(tags=["org-auth"])


@router.get("/org")
def get_orgs(user_id: str = Query(...)):
    return org_auth_service.list_orgs(user_id)


@router.post("/org")
def post_org(payload: dict = Body(...)):
    return org_auth_service.create_org(payload)


@router.post("/connect_org")
def post_connect_org(payload: dict = Body(...)):
    return org_auth_service.connect_user_to_org(payload["user_id"], payload["org_id"])


@router.get("/registration")
def get_registration():
    return org_auth_service.list_registrations()


@router.post("/registration")
def post_registration(payload: RegistrationRequest):
    return org_auth_service.create_registration(payload)
```

(The exact handler signatures may differ slightly — read the current router and preserve query/body parsing.)

- [ ] **Step 5: Confirm no MongoClient or urllib imports survive**

```bash
grep -nE "MongoClient|urllib\.parse" backend/app/routers/org_auth.py
```

Expected: zero matches.

- [ ] **Step 6: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_auth_org.py -v 2>&1 | tail -20
```

Expected: green.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract org_auth service from router [phase B, commit 7/25]"
```

---

### Task 8: Extract `profiles` service (A1.3)

**Files:**
- Modify: `backend/app/routers/profiles.py`
- Modify: `backend/app/services/profiles.py`

**Routes:** `GET /profile/{profile_type}`, `POST /profile/{profile_type}`, `POST /cleanup-company-profiles`, `POST /edit`.

- [ ] **Step 1: Inspect the current router**

```bash
wc -l backend/app/routers/profiles.py
grep -nE "^@router\.|^(async )?def " backend/app/routers/profiles.py
```

- [ ] **Step 2: Identify split**

Per handler:

- `GET /profile/{profile_type}` — fetches profile by type. Service: `get_profile(profile_type, org_id) -> dict`.
- `POST /profile/{profile_type}` — upserts profile. Service: `upsert_profile(profile_type, payload) -> dict`.
- `POST /cleanup-company-profiles` — bulk cleanup. Service: `cleanup_company_profiles(org_id) -> dict`.
- `POST /edit` — generic edit dispatch. Service: `edit_profile_field(payload: EditRequest) -> dict`.

- [ ] **Step 3: Populate `app/services/profiles.py`**

Write the service with the four functions above. Copy handler bodies. All Mongo access via `clients.client`; all Neo4j via `clients.driver`.

Note: `profile_type` is currently interpolated into Cypher f-strings (`profiles.py:87, 94, 104`). This is a Cypher-injection site flagged in the code review. **Phase B does NOT fix it** — security work is deferred. Move the f-string code verbatim into the service; mark with a comment:

```python
# Phase C security pass: this query interpolates `profile_type` into Cypher.
# Move was verbatim during Phase B; parameterization comes later.
```

- [ ] **Step 4: Reduce the router**

```python
"""Profiles router: HTTP wiring."""
from fastapi import APIRouter, Body

from app.services import profiles as profiles_service
from app.models.profiles import EditRequest

router = APIRouter(tags=["profiles"])


@router.get("/profile/{profile_type}")
def get_profile(profile_type: str, org_id: str):
    return profiles_service.get_profile(profile_type, org_id)


@router.post("/profile/{profile_type}")
def post_profile(profile_type: str, payload: dict = Body(...)):
    return profiles_service.upsert_profile(profile_type, payload)


@router.post("/cleanup-company-profiles")
def cleanup_company_profiles(org_id: str):
    return profiles_service.cleanup_company_profiles(org_id)


@router.post("/edit")
def edit(payload: EditRequest):
    return profiles_service.edit_profile_field(payload)
```

Verify query/body parsing matches what the current router accepts.

- [ ] **Step 5: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_profiles.py -v 2>&1 | tail -20
```

If no test file for profiles exists, run the full suite.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract profiles service from router [phase B, commit 8/25]"
```

---

### Task 9: Extract `customer_profile` service (A1.4)

**Files:**
- Modify: `backend/app/routers/customer_profile.py`
- Modify: `backend/app/services/customer_profile.py`

**Routes:** `GET /customer_profile`, `POST /customer_profile`, `POST /customer_profile/from_suggested_icp`, `DELETE /customer_profile/icp/{icp_id}`.

(Task 4 already added `prefix="/customer_profile"` to this router, so handler decorators in the file are `""`, `""`, `/from_suggested_icp`, `/icp/{icp_id}`.)

- [ ] **Step 1: Inspect the current router**

```bash
wc -l backend/app/routers/customer_profile.py
grep -nE "^@router\.|^(async )?def " backend/app/routers/customer_profile.py
```

- [ ] **Step 2: Identify split**

Per handler:

- `GET ""` (i.e. `GET /customer_profile`) — fetches customer profile. Service: `get_customer_profile(user_id, org_id) -> dict`.
- `POST ""` — upserts customer profile. Service: `upsert_customer_profile(payload: CustomerProfileRequest) -> dict`.
- `POST "/from_suggested_icp"` — bootstraps customer profile from a suggested ICP. Service: `create_from_suggested_icp(payload: SuggestedICPToCustomerProfileRequest) -> dict`.
- `DELETE "/icp/{icp_id}"` — removes ICP from customer profile. Service: `delete_icp_from_customer_profile(icp_id, org_id) -> dict`.

- [ ] **Step 3: Populate `app/services/customer_profile.py`**

Replace the 1-line stub with the four functions. Copy handler bodies; Mongo via `clients.client`; Neo4j via `clients.driver`.

- [ ] **Step 4: Reduce the router**

```python
"""Customer profile router: HTTP wiring."""
from fastapi import APIRouter, Query

from app.services import customer_profile as cp_service
from app.models.customer_profile import (
    CustomerProfileRequest,
    SuggestedICPToCustomerProfileRequest,
)

router = APIRouter(prefix="/customer_profile", tags=["customer-profile"])


@router.get("")
def get_customer_profile(user_id: str = Query(...), org_id: str = Query(...)):
    return cp_service.get_customer_profile(user_id, org_id)


@router.post("")
def post_customer_profile(payload: CustomerProfileRequest):
    return cp_service.upsert_customer_profile(payload)


@router.post("/from_suggested_icp")
def post_from_suggested_icp(payload: SuggestedICPToCustomerProfileRequest):
    return cp_service.create_from_suggested_icp(payload)


@router.delete("/icp/{icp_id}")
def delete_icp(icp_id: str, org_id: str = Query(...)):
    return cp_service.delete_icp_from_customer_profile(icp_id, org_id)
```

- [ ] **Step 5: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_customer_profile.py -v 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract customer_profile service from router [phase B, commit 9/25]"
```

---

## Phase B-4: Heavy router extractions (4 commits)

Reduce LOC in the four routers that still hold most of their business logic. Smallest first.

### Task 10: Extract `leads` router logic to service (A2.1)

**Files:**
- Modify: `backend/app/routers/leads.py` (target: ~150-200 LOC after extraction, down from 499)
- Modify: `backend/app/services/leads.py` (currently 41 LOC; will grow substantially)

(Task 4 added `prefix="/leads"` to this router. Handler decorators are now `""`, `""`, `""`, `""`, `/batch-upload`, `/by-file`, `/stream/status`, `/by-file/{file_id}`.)

- [ ] **Step 1: Inspect handlers**

```bash
grep -nE "^@router\.|^(async )?def " backend/app/routers/leads.py
```

8 routes total. Categorize each:
- Pure CRUD on Neo4j: `GET ""`, `POST ""`, `PUT ""`, `DELETE ""`.
- File-keyed batch operations: `POST /batch-upload`, `GET /by-file`, `GET /stream/status`, `DELETE /by-file/{file_id}`.

- [ ] **Step 2: Add service functions to `app/services/leads.py`**

For each handler, define a corresponding service function. Names: `get_all_leads`, `create_lead`, `update_lead`, `delete_lead`, `batch_upload_leads`, `list_leads_by_file`, `get_stream_status`, `delete_leads_by_file`.

Existing `fetch_leads_for_org` (already in `services/leads.py`) becomes one of the helpers used by `get_all_leads`. Don't duplicate it.

For each function: copy the corresponding handler body; Neo4j access via `clients.driver`; Mongo via `clients.client`; LLM via `clients` / `llm_config` as needed.

- [ ] **Step 3: Reduce the router**

Each route handler becomes a 1-3 line delegation:

```python
@router.get("")
def get_all_leads(org_id: str = Query(...)):
    return leads_service.get_all_leads(org_id)


@router.post("")
def create_lead(payload: LeadCreateRequest):
    return leads_service.create_lead(payload)


# … etc
```

- [ ] **Step 4: Verify line counts**

```bash
wc -l backend/app/routers/leads.py backend/app/services/leads.py
```

Expected: router LOC drops to roughly 150-200; service LOC grows to ~400+.

- [ ] **Step 5: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_leads.py -v 2>&1 | tail -30
```

Expected: green. If a test fails because it patches a function name in the router that no longer exists, update the test (the function moved to the service module).

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract leads router logic to service [phase B, commit 10/25]"
```

---

### Task 11: Extract `icp` router logic to service (A2.2)

**Files:**
- Modify: `backend/app/routers/icp.py` (target: substantially below 543)
- Modify: `backend/app/services/icp.py` (already 696 LOC; will grow further)

**Routes:** `GET /icp`, `POST /icp-research`, `POST /icp-research_claude`, `DELETE /icp/recommended/{icp_id}`.

- [ ] **Step 1: Inspect handlers**

```bash
grep -nE "^@router\.|^(async )?def " backend/app/routers/icp.py
```

- [ ] **Step 2: Identify split**

- `GET /icp` — fetches ICPs from Neo4j+Mongo. Service: `list_icps(org_id) -> List[dict]`.
- `POST /icp-research` — runs the Groq research pipeline. Service: `run_icp_research(payload, llm_backend="groq") -> dict`.
- `POST /icp-research_claude` — same, Claude backend. Service: `run_icp_research(payload, llm_backend="claude") -> dict`.
- `DELETE /icp/recommended/{icp_id}` — removes recommended ICP. Service: `delete_recommended_icp(icp_id, org_id) -> dict`.

**Note:** B2.2 (Task 17) later collapses the Groq/Claude pair into a parameterized function. For Task 11, the two endpoints can already share a private worker `_run_icp_research_impl(payload, llm_backend)` if extracting them cleanly is straightforward; otherwise, keep both as distinct service functions and let Task 17 finish the collapse.

- [ ] **Step 3: Populate service functions**

Add the 4 functions. Existing `ICP_generator`, `icp_research_1..4`, ICP-id-registry helpers in `services/icp.py` are the workhorses; the new functions are router-facing wrappers that call them.

- [ ] **Step 4: Reduce the router**

Each handler becomes a delegation. Keep the existing handler signatures (FastAPI parameter names, defaults) unchanged.

Also: 13 `print(...)` calls in `routers/icp.py` will be addressed in Task 24 (E2). Leave them for now.

- [ ] **Step 5: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_icp.py -v 2>&1 | tail -30
```

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract icp router logic to service [phase B, commit 11/25]"
```

---

### Task 12: Extract `signals` router logic to service (A2.3)

**Files:**
- Modify: `backend/app/routers/signals.py` (target: substantially below 901)
- Modify: `backend/app/services/signals.py` (already 645 LOC)

**Routes:** `POST /signals-research`, `POST /generate-signals-batch`, `POST /generate-signals-batch_claude`, `GET /fetch-signals`, `POST /signal_action`, `POST /signal_Ask`, `POST /signal_ask_claude`.

- [ ] **Step 1: Inspect handlers**

```bash
grep -nE "^@router\.|^(async )?def " backend/app/routers/signals.py
```

- [ ] **Step 2: Identify split**

- `POST /signals-research` — runs Scout+Profiler search across personas. Service: `run_signals_research(payload, llm_backend="default") -> dict`. (B3 in Task 19 collapses the dispatch to one function `search_signals(persona=...)`.)
- `POST /generate-signals-batch` — batch signal generation, Groq. Service: `generate_signals_batch(payload, llm_backend="groq") -> dict`.
- `POST /generate-signals-batch_claude` — batch signal generation, Claude. Same service, different `llm_backend`. (B2.3 in Task 18 collapses.)
- `GET /fetch-signals` — read signals from Mongo. Service: `fetch_signals(org_id, ...) -> List[dict]`.
- `POST /signal_action` — record signal action. Service: `record_signal_action(payload: SignalActionRequest) -> dict`.
- `POST /signal_Ask` — ask Groq about signals. Service: `signal_ask(payload: SignalAskRequest, llm_backend="groq") -> dict`.
- `POST /signal_ask_claude` — same, Claude. (B2.3.)

- [ ] **Step 3: Populate service**

Add the 7 router-facing functions. The existing `search_signals_scout`, `search_signals_profiler`, `_generate_signals_batch_core`, etc., are the underlying machinery and stay (Task 19 reshapes them).

`HTTPException` in `_claude_budget` (used by signal_ask_claude and generate-signals-batch_claude) is still in services as of Task 12; Task 14 fixes it. For Task 12, leave the exception flow as-is.

- [ ] **Step 4: Reduce the router**

Each handler delegates. 6 `print(...)` calls in `routers/signals.py` stay for Task 24.

- [ ] **Step 5: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_signals.py -v 2>&1 | tail -30
```

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract signals router logic to service [phase B, commit 12/25]"
```

---

### Task 13: Extract `documents` router logic to service (A2.4)

**Files:**
- Modify: `backend/app/routers/documents.py` (target: substantially below 879)
- Modify: `backend/app/services/documents.py` (currently 113 LOC; will grow significantly)

**Routes:** `POST /upload_file/`, `POST /upload`, `POST /upload-document`, `GET /document-status/{file_key:path}`, `GET /user-documents`, `DELETE /data-source/{file_id}`, `PUT /data-source/{file_id}`.

- [ ] **Step 1: Inspect handlers**

```bash
grep -nE "^@router\.|^(async )?def " backend/app/routers/documents.py
```

- [ ] **Step 2: Identify split**

Each handler has substantial logic. Service function names (suggested):
- `upload_file_text(payload) -> dict`
- `upload_document_form(file, ...) -> dict`
- `upload_document_lead_list(file, ...) -> dict`
- `get_document_status(file_key) -> dict`
- `list_user_documents(user_id, org_id) -> List[dict]`
- `delete_data_source(file_id, org_id) -> dict`
- `update_data_source(file_id, payload) -> dict`

Note: 10 inline `MongoClient` constructions were removed by Task 5. The router file should already use `from app.core.clients import client as mongo_client`. Verify.

- [ ] **Step 3: Populate service**

Copy each handler body into its service function. Existing `load_document`, `grapher`, `process_prospect_list` (already in `services/documents.py`) become callees of the new functions.

S3 access via `clients.s3_client`. Pinecone via `clients.pc`.

- [ ] **Step 4: Reduce the router**

Each handler becomes a delegation. Background tasks (`FastAPI.BackgroundTasks`) stay declared in the router but invoke service functions:

```python
@router.post("/upload_file/")
async def upload_file(payload: dict = Body(...), bg: BackgroundTasks = ...):
    return await documents_service.upload_file_text(payload, bg)
```

Pass `bg` (BackgroundTasks) into the service function so the service can call `bg.add_task(...)`. FastAPI handles BackgroundTasks correctly across the boundary.

- [ ] **Step 5: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_documents.py tests/test_upload_embedding.py -v 2>&1 | tail -30
```

(Some test files may not exist — adjust to what's present in `tests/`.)

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): extract documents router logic to service [phase B, commit 13/25]"
```

---

## Phase B-5: Layering polish (2 commits)

### Task 14: Domain exceptions; HTTPException out of services (A4)

**Files:**
- Create: `backend/app/core/exceptions.py`
- Modify: `backend/app/services/_claude_budget.py`
- Modify: `backend/app/services/icp.py`
- Modify: `backend/app/routers/signals.py`, `backend/app/routers/market_research.py`, `backend/app/routers/icp.py` (routers that consume the affected services)

- [ ] **Step 1: Create `app/core/exceptions.py`**

```python
"""Domain exception hierarchy.

Service-layer functions raise these. Routers catch and convert to
HTTPException at the HTTP boundary. This keeps the services layer
free of FastAPI specifics.
"""


class BrewraError(Exception):
    """Base for all Brewra service-layer exceptions."""


class BudgetExhaustedError(BrewraError):
    """Claude per-window token budget exhausted. Maps to HTTP 429."""


class ICPIdRegistryError(BrewraError):
    """ICP id reservation could not be acquired. Maps to HTTP 500."""
```

- [ ] **Step 2: Replace HTTPException in `_claude_budget.py`**

Open `backend/app/services/_claude_budget.py`. Find the `raise HTTPException(...)` block near line 55. Change it to:

```python
# Before
raise HTTPException(status_code=429, detail=f"Claude signal budget exceeded: ...")

# After
from app.core.exceptions import BudgetExhaustedError
raise BudgetExhaustedError(f"Claude signal budget exceeded: ...")
```

Also remove `from fastapi import HTTPException` at the top of the file if it's no longer used.

- [ ] **Step 3: Replace HTTPException in `services/icp.py`**

Open `backend/app/services/icp.py:689`. The current code:

```python
raise HTTPException(status_code=500, detail="Failed to generate globally unique ICP id.")
```

Change to:

```python
from app.core.exceptions import ICPIdRegistryError
raise ICPIdRegistryError("Failed to generate globally unique ICP id.")
```

Remove `from fastapi import HTTPException` from `services/icp.py` if no other `HTTPException` raises remain (`grep -n "HTTPException" backend/app/services/icp.py`).

- [ ] **Step 4: Update routers to catch and convert**

For each router that calls into `_claude_budget` (via signals service or market_research service) or into the ICP-id registry, wrap the call:

In `backend/app/routers/signals.py` — wherever a Claude-backed handler is invoked:

```python
from app.core.exceptions import BudgetExhaustedError
from fastapi import HTTPException

try:
    return signals_service.run_signal_ask(payload, llm_backend="claude")
except BudgetExhaustedError as e:
    raise HTTPException(status_code=429, detail=str(e))
```

Same wrap in `routers/market_research.py` and `routers/icp.py` for their `_claude` endpoints.

In `backend/app/routers/icp.py` — wherever ICP creation hits the registry:

```python
from app.core.exceptions import ICPIdRegistryError

try:
    return icp_service.run_icp_research(payload, llm_backend=llm_backend)
except ICPIdRegistryError as e:
    raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 5: Verify no `HTTPException` raises survive in services**

```bash
grep -rn "raise HTTPException" backend/app/services/
```

Expected: zero matches.

- [ ] **Step 6: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/ -q 2>&1 | tail -5
```

Expected: existing tests that check for HTTP 429 / HTTP 500 from these endpoints still pass — the routers' try/except converts the domain exception to the same HTTP code.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): move HTTPException out of services; add domain exceptions [phase B, commit 14/25]"
```

---

### Task 15: Promote LLM helpers to `_llm_helpers.py` (A5)

**Files:**
- Create: `backend/app/services/_llm_helpers.py`
- Modify: `backend/app/services/market_research.py`, `backend/app/services/icp.py`, `backend/app/services/signals.py`

- [ ] **Step 1: Locate the helpers in market_research**

```bash
grep -n "^def _tavily_context_and_urls\|^def _claude_messages_text" backend/app/services/market_research.py
```

Note the start lines.

- [ ] **Step 2: Inspect the helpers**

```bash
sed -n "/^def _tavily_context_and_urls/,/^def [^_]/p" backend/app/services/market_research.py | head -40
sed -n "/^def _claude_messages_text/,/^def [^_]/p" backend/app/services/market_research.py | head -40
```

Read the function bodies to understand dependencies. Note any imports that need to come along.

- [ ] **Step 3: Create `app/services/_llm_helpers.py`**

Move `_tavily_context_and_urls` and `_claude_messages_text` verbatim. Carry along their import dependencies. Header:

```python
"""Cross-domain LLM helpers.

Promoted from app/services/market_research.py in Phase B Task 15 because
icp and signals were importing these via the underscore-private path —
a convention violation. New convention: any service helper used by 2+
services lives here.
"""
# … carried imports …


def _tavily_context_and_urls(...):
    # body verbatim from market_research.py


def _claude_messages_text(...):
    # body verbatim from market_research.py
```

- [ ] **Step 4: Delete from market_research.py**

Remove the two function bodies from `app/services/market_research.py`. Add at the top:

```python
from app.services._llm_helpers import _tavily_context_and_urls, _claude_messages_text
```

(This preserves backward compatibility for any callsite within `market_research.py` that uses the helpers locally.)

- [ ] **Step 5: Update icp and signals imports**

In `backend/app/services/icp.py` and `backend/app/services/signals.py`, replace:

```python
from app.services.market_research import _tavily_context_and_urls, _claude_messages_text
```

with:

```python
from app.services._llm_helpers import _tavily_context_and_urls, _claude_messages_text
```

- [ ] **Step 6: Verify**

```bash
git grep -n "from app.services.market_research import _" backend/app/services/
```

Expected: zero matches (private cross-module imports gone).

```bash
git grep -n "from app.services._llm_helpers" backend/app/services/
```

Expected: 3 files match (market_research, icp, signals).

- [ ] **Step 7: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/ -q 2>&1 | tail -5
```

- [ ] **Step 8: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): promote _tavily_context_and_urls and _claude_messages_text to _llm_helpers [phase B, commit 15/25]"
```

---

## Phase B-6: Domain dedup (4 commits)

### Task 16: Collapse `market_research` Groq/Claude pair (B2.1)

**Files:**
- Modify: `backend/app/routers/market_research.py`
- Modify: `backend/app/services/market_research.py`

- [ ] **Step 1: Diff the two handlers**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
diff <(sed -n '/@router\.post.."\/market-research".$/,/^@router\./p' app/routers/market_research.py | head -100) \
     <(sed -n '/@router\.post.."\/market-research_claude".$/,/^@router\./p' app/routers/market_research.py | head -100)
```

Confirm the diff is the function-map and API-key check only (or whatever the differences turn out to be).

- [ ] **Step 2: Refactor to one worker + two wrappers**

In `backend/app/services/market_research.py`, identify or create:

```python
def run_market_research(request: MarketRequest, llm_backend: str = "groq") -> dict:
    components = COMPONENT_FUNCTIONS_CLAUDE if llm_backend == "claude" else COMPONENT_FUNCTIONS
    # ... rest of the body unifying both handler variants ...
```

In `backend/app/routers/market_research.py`:

```python
@router.post("/market-research")
def market_research(request: MarketRequest):
    return mr_service.run_market_research(request, llm_backend="groq")


@router.post("/market-research_claude")
def market_research_claude(request: MarketRequest):
    return mr_service.run_market_research(request, llm_backend="claude")
```

If the Claude variant requires an API-key precheck (`if not anthropic_api_key: raise HTTPException(...)`), keep that precheck inside the router's `market_research_claude` handler, before delegating.

- [ ] **Step 3: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_market_research.py -v 2>&1 | tail -20
```

Note: Only the Groq variant has test coverage today. The Claude variant continues to be uncovered after this collapse — adding coverage is Phase C work.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): collapse market_research Groq/Claude pair into one worker [phase B, commit 16/25]"
```

---

### Task 17: Collapse `icp` Groq/Claude pair (B2.2)

**Files:**
- Modify: `backend/app/routers/icp.py`
- Modify: `backend/app/services/icp.py`

Same pattern as Task 16, for the `icp-research` / `icp-research_claude` pair.

- [ ] **Step 1: Identify the worker**

If Task 11 already collapsed `run_icp_research(payload, llm_backend=...)` to one function, Task 17 is just verifying the router wires both endpoints to it. If Task 11 kept two functions, merge here.

- [ ] **Step 2: Refactor**

```python
# In services/icp.py
def run_icp_research(payload, llm_backend: str = "groq") -> dict:
    # unified body; dispatch on llm_backend
    ...


# In routers/icp.py
@router.post("/icp-research")
def icp_research(payload):
    return icp_service.run_icp_research(payload, llm_backend="groq")


@router.post("/icp-research_claude")
def icp_research_claude(payload):
    return icp_service.run_icp_research(payload, llm_backend="claude")
```

- [ ] **Step 3: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_icp.py -v 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): collapse icp Groq/Claude pair into one worker [phase B, commit 17/25]"
```

---

### Task 18: Collapse `signals` Groq/Claude pair (B2.3)

**Files:**
- Modify: `backend/app/routers/signals.py`
- Modify: `backend/app/services/signals.py`

Same pattern. The `signals` router has two Groq/Claude pairs: `generate-signals-batch` / `_claude` and `signal_Ask` / `signal_ask_claude`. Both collapse.

- [ ] **Step 1: Collapse `generate-signals-batch`**

In `services/signals.py`, ensure `_generate_signals_batch_core(payload, llm_backend)` is the single worker (it likely already exists, hence the name). Verify both router endpoints call it with the right backend.

```python
# routers/signals.py
@router.post("/generate-signals-batch")
def generate_signals_batch(payload):
    return signals_service.generate_signals_batch(payload, llm_backend="groq")


@router.post("/generate-signals-batch_claude")
def generate_signals_batch_claude(payload):
    return signals_service.generate_signals_batch(payload, llm_backend="claude")
```

- [ ] **Step 2: Collapse `signal_Ask`**

```python
# services/signals.py
def signal_ask(payload: SignalAskRequest, llm_backend: str = "groq") -> dict:
    # unified body
    ...


# routers/signals.py
@router.post("/signal_Ask")
def signal_ask(payload: SignalAskRequest):
    return signals_service.signal_ask(payload, llm_backend="groq")


@router.post("/signal_ask_claude")
def signal_ask_claude(payload: SignalAskRequest):
    return signals_service.signal_ask(payload, llm_backend="claude")
```

- [ ] **Step 3: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_signals.py -v 2>&1 | tail -30
```

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): collapse signals Groq/Claude pairs (generate-signals-batch and signal_ask) into one worker per pair [phase B, commit 18/25]"
```

---

### Task 19: Collapse Scout/Profiler into `search_signals(persona=...)` (B3)

**Files:**
- Modify: `backend/app/services/signals.py`
- Modify: `backend/app/routers/signals.py`

- [ ] **Step 1: Diff the two functions**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
diff <(sed -n "/^def search_signals_scout/,/^def [^_]/p" app/services/signals.py) \
     <(sed -n "/^def search_signals_profiler/,/^def [^_]/p" app/services/signals.py) | head -100
```

Identify which lines actually differ — they're the persona-specific bits (prompt template, Mongo collection name, output field names).

- [ ] **Step 2: Add `search_signals(persona, ...)`**

In `backend/app/services/signals.py`, add (or rewrite from one of the two existing functions) a unified version:

```python
from typing import Literal


def search_signals(
    pre_data,
    persona: Literal["scout", "profiler"] = "scout",
    llm_backend: str = "default",
) -> dict:
    """Unified scout/profiler signal search.

    Replaces search_signals_scout and search_signals_profiler.
    Persona switches:
      - prompt template (scout-style vs profiler-style language)
      - Mongo collection target (Scout_Agent vs Profiler db)
      - output field naming where it differs
    """
    if persona not in ("scout", "profiler"):
        raise ValueError(f"unknown persona: {persona!r}")

    # Unified body. Where the two old functions diverged, branch on `persona`.
    prompt = _SCOUT_PROMPT if persona == "scout" else _PROFILER_PROMPT
    collection = _scout_collection() if persona == "scout" else _profiler_collection()
    # ... etc, restoring the divergent logic from the two old functions ...
```

(The exact unification depends on the diff from Step 1. Where the two functions differ in non-trivial ways, branch on `persona`. Where they differ trivially — e.g., a string suffix — pick the right value via a small dict.)

- [ ] **Step 3: Update router callsites**

In `backend/app/routers/signals.py`:

```python
# Before
signals_result = await asyncio.to_thread(signals_service.search_signals_scout, pre_data, llm_backend)
signals_result = await asyncio.to_thread(signals_service.search_signals_profiler, profiler_pre_data, llm_backend)

# After
signals_result = await asyncio.to_thread(signals_service.search_signals, pre_data, persona="scout", llm_backend=llm_backend)
signals_result = await asyncio.to_thread(signals_service.search_signals, profiler_pre_data, persona="profiler", llm_backend=llm_backend)
```

- [ ] **Step 4: Delete the old functions**

Once all callers are migrated:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
grep -n "def search_signals_scout\|def search_signals_profiler\|search_signals_scout(\|search_signals_profiler(" app/
```

If only the two `def`s match (no callers), delete the `def`s. Also delete the `PERSONA_SEARCH_FUNCTIONS` dispatch dict at the bottom of `services/signals.py` (around lines 642-645 per the original census).

- [ ] **Step 5: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_signals.py -v 2>&1 | tail -30
```

Tests that patched `search_signals_scout` or `search_signals_profiler` directly need updating: replace those patches with `mocker.patch("app.services.signals.search_signals", ...)`.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): collapse search_signals_scout/profiler into search_signals(persona=) [phase B, commit 19/25]"
```

---

## Phase B-7: Response models (3 commits)

Add `response_model` to every router endpoint. Each commit covers one cluster.

### Task 20: Annotate data domains (C4.1)

**Domains:** `leads`, `documents`, `customer_profile`, `profiles`.

**Files:**
- Modify: `backend/app/routers/leads.py`, `backend/app/routers/documents.py`, `backend/app/routers/customer_profile.py`, `backend/app/routers/profiles.py`
- Create: `backend/app/models/documents.py` (new — none exist today)

- [ ] **Step 1: Define `app/models/documents.py`**

For each `documents` endpoint, define the response shape it currently returns. Read each handler in `app/routers/documents.py` (now mostly thin delegations after Task 13), inspect the service function's return type, and write a corresponding `BaseModel`.

```python
"""Document upload / status / management response models."""
from typing import List, Optional
from pydantic import BaseModel


class UploadResponse(BaseModel):
    file_id: str
    status: str
    message: Optional[str] = None


class DocumentStatusResponse(BaseModel):
    file_id: str
    status: str
    progress: Optional[float] = None
    # ... fields that match the actual handler return ...


class UserDocumentEntry(BaseModel):
    file_id: str
    filename: str
    uploaded_at: str
    # ...


class DataSourceUpdateResponse(BaseModel):
    file_id: str
    updated: bool


class DataSourceDeleteResponse(BaseModel):
    file_id: str
    deleted: bool
```

The exact field set depends on what the handlers actually return. Match the JSON keys.

- [ ] **Step 2: Annotate `app/routers/leads.py` endpoints**

For each `@router.<method>` decorator, add `response_model=...`:

```python
from app.models.leads import Lead

@router.get("", response_model=List[Lead])
def get_all_leads(...): ...


@router.post("", response_model=Lead)
def create_lead(payload: LeadCreateRequest): ...


# ... etc for PUT, DELETE, batch-upload, by-file, stream/status, by-file/{file_id}
```

For batch-upload / stream/status (likely return dicts), define new models in `app/models/leads.py` if no match exists:

```python
class BatchUploadResponse(BaseModel):
    file_id: str
    uploaded_count: int
    failed_count: int


class StreamStatusResponse(BaseModel):
    org_id: str
    in_progress: int
    completed: int
```

- [ ] **Step 3: Annotate `app/routers/documents.py` endpoints**

```python
from app.models.documents import UploadResponse, DocumentStatusResponse, UserDocumentEntry, DataSourceUpdateResponse, DataSourceDeleteResponse

@router.post("/upload_file/", response_model=UploadResponse)
def upload_file(...): ...

@router.get("/document-status/{file_key:path}", response_model=DocumentStatusResponse)
def get_document_status(...): ...

# ... etc ...
```

- [ ] **Step 4: Annotate `app/routers/customer_profile.py` endpoints**

```python
from app.models.customer_profile import CustomerProfileRequest, ...

@router.get("", response_model=CustomerProfileRequest)
def get_customer_profile(...): ...
# Add CustomerProfileResponse to app/models/customer_profile.py if the response shape differs from the request.
```

If GET responses differ from POST request shapes, create response-only models.

- [ ] **Step 5: Annotate `app/routers/profiles.py` endpoints**

```python
from app.models.profiles import CompanyProfile, UserProfile, ScoutProfile

@router.get("/profile/{profile_type}", response_model=Union[CompanyProfile, UserProfile, ScoutProfile])
def get_profile(profile_type: str, ...): ...
```

Or, if the response is too heterogeneous for a Union, leave that one endpoint unannotated with a comment:

```python
# Response shape varies by profile_type; annotation deferred — see Phase C test track.
@router.get("/profile/{profile_type}")
def get_profile(profile_type: str, ...): ...
```

- [ ] **Step 6: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/ -q 2>&1 | tail -10
```

**Important:** when `response_model` is added, FastAPI starts filtering. A handler returning `{"foo": 1, "extra": "stuff"}` against `class X(BaseModel): foo: int` now returns `{"foo": 1}` — the `extra` key disappears. If tests fail because of dropped keys:

- Inspect the failure. Is the dropped key one the FE actually consumes (per the spec §8 risk row)? If yes, **add the field to the model** — that's the correct fix.
- If the dropped key was genuine cruft (debug info, internal IDs), update the snapshot.
- If the test fails because of MISSING fields (response shape missing something the model declares required), that's a handler bug. Fix the handler in this commit.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): add response_model to data domain endpoints (leads/documents/customer_profile/profiles) [phase B, commit 20/25]"
```

---

### Task 21: Annotate research domains (C4.2)

**Domains:** `market_research`, `icp`, `signals`.

**Files:**
- Modify: `backend/app/routers/market_research.py`, `backend/app/routers/icp.py`, `backend/app/routers/signals.py`
- Create: `backend/app/models/icp.py` (new — none today)

Same pattern as Task 20.

- [ ] **Step 1: Define `app/models/icp.py`**

Inspect the handler return shapes for `GET /icp`, `POST /icp-research`, `DELETE /icp/recommended/{icp_id}`. Define models:

```python
"""ICP response models."""
from typing import List, Optional
from pydantic import BaseModel


class ICPEntry(BaseModel):
    icp_id: str
    name: str
    description: Optional[str] = None
    # ... fields matching the handler ...


class ICPResearchResponse(BaseModel):
    icp: ICPEntry
    research_summary: str
    # ... fields matching the handler ...


class ICPDeleteResponse(BaseModel):
    icp_id: str
    deleted: bool
```

- [ ] **Step 2: Annotate `app/routers/market_research.py`**

`MarketRequest` exists; `MarketResponse` doesn't. Add `MarketResponse` to `app/models/market_research.py`:

```python
class MarketResponse(BaseModel):
    market_summary: str
    components: dict
    # ... actual response keys ...
```

Then:

```python
@router.post("/market-research", response_model=MarketResponse)
def market_research(...): ...

@router.post("/market-research_claude", response_model=MarketResponse)
def market_research_claude(...): ...
```

- [ ] **Step 3: Annotate `app/routers/icp.py`**

```python
from app.models.icp import ICPEntry, ICPResearchResponse, ICPDeleteResponse

@router.get("/icp", response_model=List[ICPEntry])
def get_icps(...): ...

@router.post("/icp-research", response_model=ICPResearchResponse)
def icp_research(...): ...

@router.post("/icp-research_claude", response_model=ICPResearchResponse)
def icp_research_claude(...): ...

@router.delete("/icp/recommended/{icp_id}", response_model=ICPDeleteResponse)
def delete_icp(...): ...
```

- [ ] **Step 4: Annotate `app/routers/signals.py`**

Add response models to `app/models/signals.py` as needed (currently it only has request models):

```python
class SignalEntry(BaseModel):
    signal_id: str
    title: str
    # ... actual fields ...


class SignalsResearchResponse(BaseModel):
    signals: List[SignalEntry]
    summary: str
    # ...


class SignalsBatchResponse(BaseModel):
    org_id: str
    batch_id: str
    queued: int
    # ...


class FetchSignalsResponse(BaseModel):
    signals: List[SignalEntry]
    next_cursor: Optional[str] = None


class SignalActionResponse(BaseModel):
    signal_id: str
    action_recorded: bool


class SignalAskResponse(BaseModel):
    question: str
    answer: str
    # ...
```

Then annotate all 7 signals endpoints with the appropriate model.

- [ ] **Step 5: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_market_research.py tests/test_icp.py tests/test_signals.py -v 2>&1 | tail -30
```

Same drift-handling rules as Task 20.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): add response_model to research domain endpoints (market_research/icp/signals) [phase B, commit 21/25]"
```

---

### Task 22: Annotate meta domains (C4.3)

**Domains:** `org_auth`, `graph_chat`, `pipeline`.

**Files:**
- Modify: `backend/app/routers/org_auth.py`, `backend/app/routers/graph_chat.py`, `backend/app/routers/pipeline.py`

- [ ] **Step 1: Annotate `app/routers/org_auth.py`**

```python
from app.models.org_auth import RegistrationRequest, RegistrationResponse

# Define OrgEntry and ConnectOrgResponse in app/models/org_auth.py:
class OrgEntry(BaseModel):
    org_id: str
    name: str
    # ...

class ConnectOrgResponse(BaseModel):
    user_id: str
    org_id: str
    connected: bool


@router.get("/org", response_model=List[OrgEntry])
def get_orgs(...): ...

@router.post("/org", response_model=OrgEntry)
def post_org(...): ...

@router.post("/connect_org", response_model=ConnectOrgResponse)
def post_connect_org(...): ...

@router.get("/registration", response_model=List[RegistrationResponse])
def get_registration(...): ...

@router.post("/registration", response_model=RegistrationResponse)
def post_registration(...): ...
```

- [ ] **Step 2: Annotate `app/routers/graph_chat.py`**

Define response models in `app/models/graph_chat.py`:

```python
class ProspectScoreResponse(BaseModel):
    prospect_name: str
    score: int
    rationale: str


class GraphChatResponse(BaseModel):
    answer: str
    context: List[str] = []


class GraphQueryResponse(BaseModel):
    results: List[dict]


class GraphMutationResponse(BaseModel):
    success: bool
    message: str
```

Then annotate each endpoint. For `/query` (raw Cypher debug endpoint), use `GraphQueryResponse` if shape is consistent; otherwise leave annotation off with a comment ("debugging endpoint, response shape varies by query").

- [ ] **Step 3: Annotate `app/routers/pipeline.py`**

```python
from app.models.pipeline import SalesPipelineResponse


@router.get("/Sales_Pipeline", response_model=SalesPipelineResponse)
def get_sales_pipeline(...): ...


# /test-llm is a diagnostic; leave unannotated with a comment.
@router.get("/test-llm")
def test_llm():
    """LLM-availability diagnostic. Response shape is informal."""
    return pipeline_service.probe_llm()
```

- [ ] **Step 4: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/test_auth_org.py tests/test_graph_chat.py -v 2>&1 | tail -20
```

(Some test files may not exist; fall back to full suite.)

- [ ] **Step 5: Verify every router has response_model coverage**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
for f in app/routers/*.py; do
    total=$(grep -cE "^@router\.(get|post|put|delete)\(" "$f")
    annotated=$(grep -cE "^@router\.(get|post|put|delete)\(.*response_model" "$f")
    echo "$f: $annotated / $total annotated"
done
```

Expected: every router shows `N/N` annotated, except those with explicit-comment exceptions noted above (`/test-llm`, possibly `/query`, possibly one branch in `/profile/{profile_type}`).

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): add response_model to meta domain endpoints (org_auth/graph_chat/pipeline) [phase B, commit 22/25]"
```

---

## Phase B-8: Hygiene sweep (3 commits)

### Task 23: Replace bare `except:` with `except Exception:` (E1)

**Files:**
- Modify: `backend/app/routers/documents.py`, `backend/app/routers/signals.py`, `backend/app/services/market_research.py`, `backend/app/services/signals.py` (per Task 0 Step 9 census)

- [ ] **Step 1: Locate**

```bash
git grep -nE "^\s+except:\s*$" backend/app/
```

- [ ] **Step 2: Replace each**

For each match, change `except:` to `except Exception:`. Manual or sed:

```bash
sed -i -E 's/^(\s+)except:(\s*)$/\1except Exception:\2/' \
    backend/app/routers/documents.py \
    backend/app/routers/signals.py \
    backend/app/services/market_research.py \
    backend/app/services/signals.py
```

(Verify the exact files from the Task 0 census.)

- [ ] **Step 3: Verify**

```bash
git grep -nE "^\s+except:\s*$" backend/app/
```

Expected: zero matches.

- [ ] **Step 4: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/ -q 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): replace bare except with except Exception [phase B, commit 23/25]"
```

---

### Task 24: Replace `print()` with `logger` in icp/signals routers (E2)

**Files:**
- Modify: `backend/app/routers/icp.py`, `backend/app/routers/signals.py`

- [ ] **Step 1: Census the calls**

```bash
grep -nE "^\s+print\(" backend/app/routers/icp.py backend/app/routers/signals.py
```

For each match, decide log level:
- Diagnostic / "I'm here" lines → `logger.debug(...)`
- Status / progress lines ("Processing X / Y") → `logger.info(...)`
- Error or failure paths → `logger.error(...)` or `logger.warning(...)`

- [ ] **Step 2: Replace each `print(...)` with the chosen `logger.X(...)`**

For `app/routers/icp.py`, ensure the file has:

```python
from app.core.logging import logger
```

Then walk every `print(...)` call and replace by hand. Example:

```python
# Before
print(f"Starting ICP research for org {org_id}")

# After
logger.info("Starting ICP research for org %s", org_id)
```

(Prefer `%` formatting in log calls — the format string isn't interpolated unless the level is enabled, so it's slightly cheaper. f-strings work too; pick consistent.)

Same for `app/routers/signals.py`.

- [ ] **Step 3: Verify**

```bash
grep -nE "^\s+print\(" backend/app/routers/icp.py backend/app/routers/signals.py
```

Expected: zero matches.

- [ ] **Step 4: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/ -q 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): replace print() with logger in icp and signals routers [phase B, commit 24/25]"
```

---

### Task 25: Replace `datetime.utcnow()` with `datetime.now(timezone.utc)` (E3)

**Files:**
- Modify: every file in `backend/app/` using `datetime.utcnow()` (per Task 0 Step 8 census)

- [ ] **Step 1: Locate and inspect**

```bash
git grep -n "datetime\.utcnow()" backend/app/
```

Each call site uses `datetime` from the `datetime` module. The replacement is `datetime.now(timezone.utc)` — requires `timezone` import.

- [ ] **Step 2: For each file, add `timezone` import if missing**

For files matching, inspect the top:

```bash
git grep -l "datetime.utcnow()" backend/app/ | while read f; do
    head -20 "$f" | grep "from datetime import" || echo "$f: needs timezone import added"
done
```

For each file, add `timezone` to the existing `from datetime import ...` line:

```python
# Before
from datetime import datetime, timedelta

# After
from datetime import datetime, timedelta, timezone
```

- [ ] **Step 3: Replace `utcnow()` calls**

```bash
git grep -l "datetime\.utcnow()" backend/app/ | xargs sed -i 's|datetime\.utcnow()|datetime.now(timezone.utc)|g'
```

- [ ] **Step 4: Verify**

```bash
git grep -n "datetime\.utcnow" backend/app/
```

Expected: zero matches.

- [ ] **Step 5: Run tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/ -q 2>&1 | tail -5
```

If any test compares a timestamp to a string that includes a `Z` suffix or timezone marker, the snapshot may drift. The substantive datetime semantics are unchanged — `datetime.utcnow()` returned a naive datetime in UTC; `datetime.now(timezone.utc)` returns an aware datetime in UTC. Where serialization differs (`isoformat()` produces a `+00:00` suffix on aware datetimes), update the snapshot.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A backend/
git commit -m "refactor(be): replace datetime.utcnow() with datetime.now(timezone.utc) [phase B, commit 25/25]"
```

---

## Post-Phase B Validation Checklist

After Task 25, verify the end state against the spec's §2.4 success criteria.

- [ ] **Stub services have real logic.** Each of `services/{pipeline,org_auth,profiles,customer_profile}.py` has business functions, not just a docstring.

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && wc -l app/services/{pipeline,org_auth,profiles,customer_profile}.py
```

Each should be > 30 lines.

- [ ] **Heavy routers shrank.**

```bash
wc -l app/routers/{documents,signals,icp,leads}.py
```

Each should be substantially below its pre-Phase-B size (documents 879→under 400; signals 901→under 400; icp 543→under 250; leads 499→under 250).

- [ ] **Zero inline MongoClient.**

```bash
grep -rn "MongoClient(" app/ | grep -v "app/core/clients.py"
```

Expected: zero matches.

- [ ] **search_signals_scout/profiler gone.**

```bash
grep -rn "search_signals_scout\|search_signals_profiler" app/
```

Expected: zero matches.

- [ ] **Groq/Claude pairs collapsed.**

```bash
for d in market_research icp signals; do
    echo "--- $d ---"
    grep -nE "def.*_claude\b" app/services/${d}.py
done
```

Expected: zero matches (the `_claude` suffix is only on router-endpoint paths, not service-function names).

- [ ] **app/models.py is gone.**

```bash
ls app/models.py 2>/dev/null || echo "OK: models.py removed"
ls app/models/
```

Expected: package directory with per-domain files.

- [ ] **app/core/database.py is gone.**

```bash
ls app/core/database.py 2>/dev/null || echo "OK: database.py removed"
ls app/core/clients.py
```

- [ ] **Every router has prefix/tags.**

```bash
grep -E "APIRouter\(\)" app/routers/*.py
```

Expected: zero matches (every `APIRouter()` has at least `tags=`).

- [ ] **Every endpoint has response_model.**

```bash
for f in app/routers/*.py; do
    total=$(grep -cE "^@router\.(get|post|put|delete)\(" "$f")
    annotated=$(grep -cE "^@router\.(get|post|put|delete)\(.*response_model" "$f")
    echo "$f: $annotated / $total"
done
```

Expected: every router shows N/N (or N-1/N with one explicit-comment exception per file at most).

- [ ] **No bare except, no print, no datetime.utcnow.**

```bash
git grep -nE "^\s+except:\s*$" app/
git grep -nE "^\s+print\(" app/routers/icp.py app/routers/signals.py
git grep -n "datetime\.utcnow" app/
```

Expected: zero matches for all three.

- [ ] **Full test suite passes.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && pytest tests/ -v 2>&1 | tail -20
```

Expected: passing count ≥ baseline (Task 0 Step 2).

- [ ] **Branch is bisectable.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --oneline master..HEAD | wc -l
```

Expected: 25 commits since branch-off. Spot-check a few via `git checkout <SHA> && pytest backend/tests/ -q && git checkout refactor-backend-modularization-phase-b`.

- [ ] **Confirm clean working tree.**

```bash
git status
```

Expected: nothing to commit, working tree clean.

---

## End State

At the conclusion of Phase B:
- `backend/app/` matches the directory layout in spec §5.
- The 25 success criteria (spec §2.4) are met.
- Phase C work (DI rework, security hardening, pagination, test improvements, deeper concerns) is captured in spec §9 for the next planning cycle.
- The feature branch is ready to merge to `master` and ride out as the new baseline.
