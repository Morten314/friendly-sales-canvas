# Backend Pagination + Index Hygiene Phase G Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the project's first paginated-list convention. Every list-returning HTTP endpoint gets a `/api/v2/` sibling returning a `PaginatedResponse[T]` envelope (`{items, total, limit, offset}`). Service functions gain `limit`/`offset` parameters and return `tuple[list[X], int]`. v1 routes stay alive with their current shapes, gain RFC 8594 `Deprecation` + RFC 5988 `Link` headers, and silently cap at 500 rows. Two remaining `create_index` hot paths move to lifespan.

**Architecture:** New `PaginatedResponse[T]` generic in `app/models/pagination.py`. New `app/routers/v2/` subpackage (5 files, 6 endpoints) mounted at `prefix="/v2"`. Each paginated service runs two queries in one DB session/connection — items (with `.skip()/.limit()`) plus a count query — and returns `(items, total)`. v1 routes adapt: bare-list routes return only `items`; wrapper-shape routes reconstruct their existing wrapper dict. `_ensure_leads_indexes(mongo)` extracted from `batch_upload_leads`; `_ensure_icp_id_registry_indexes(db)` renamed + reparameterized to `_ensure_icp_indexes(mongo)`, with six defensive callsites deleted and 14 test mock-patch targets updated. All three `_ensure_*_indexes` helpers invoked from `lifespan`. 8 commits, each independently green and `git revert`-safe.

**Tech Stack:** Pydantic v2 `BaseModel + Generic[T]` (already in 2.13.4), FastAPI `Query(..., ge=..., le=...)` validation, FastAPI lifespan from Phase F, Neo4j `SKIP $offset LIMIT $limit`, Mongo `.find().sort().skip().limit()` + `.count_documents()`, pytest + pytest-mock (existing). No new dependencies.

**Spec:** `specs/2026-05-23-backend-pagination-and-index-hygiene-phase-g-design.md`
**Branch:** `refactor-backend-pagination-and-index-hygiene-phase-g` off `master`.
**Baseline:** Phase F HEAD on `master`; `cd backend && pytest --collect-only -q` reports `203 tests collected`.
**Target:** ~242 tests after Phase G (203 + 24 v2 endpoint tests + ~10 service unit tests + 3 pagination model tests + 2 lifespan tests). Final exact count pinned here at execution time.

**Commit numbering convention:** `<type>(be): <description> [phase G, commit N/8]`. Conventional-commit type per change: `feat(be)` for v2 routes, `refactor(be)` for service-signature changes, `chore(be)` for index relocation, `test(be)` for test-only commits.

**Merge cadence:** Each task lands as a single commit on the feature branch. Per Brewra "Business State" (0 live users, deployment ceremony not a constraint), the CTO is free to merge each completed task to `master` as soon as it's green rather than batching to the end of the branch. Recommendation: per-commit merges, since each commit is bisectable and strictly-safer behavior-change-wise.

**Abort criterion:** if any task's full-suite sanity check shows >5 unexpected failures, or any task introduces a previously-passing test failure that can't be diagnosed in 2-3 attempts, halt and report to the operator before proceeding. This prevents drift across the 8-commit chain when something upstream broke unexpectedly.

**Phase G scope notes** (cross-reference to spec sections):

- Six v2 endpoints across 5 router files: `documents.py` (1), `icp.py` (1), `leads.py` (2), `org_auth.py` (1), `signals.py` (1). The `/leads` router holds both `/v2/leads` and `/v2/leads/by-file`.
- Line numbers in this plan reflect the Phase F baseline at plan-writing time (verified via grep against `master`). Phase G's own earlier commits may shift lines before later tasks land — re-verify with `git grep` in each task before editing.
- `/v2/registration`, `/v2/icp`, and `/v2/fetch-signals` are user-scoped or admin-only (not org-scoped) — preserved from current code. See spec §2.1 #2 for rationale.
- `list_icps` uses in-memory pagination (LLM regenerates the full set, then slice). All other paginated services slice at the query layer.

---

## Pre-flight (one-time setup, no commit)

- [ ] **Verify master state**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status                                # expected: clean working tree (or only this plan file untracked)
git rev-parse --abbrev-ref HEAD           # expected: master
git log --oneline -5                      # confirm Phase F is the most recent landed work
```

- [ ] **Verify the test baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest --collect-only -q 2>&1 | tail -3   # expected: "203 tests collected"
pytest tests/ -q 2>&1 | tail -3           # expected: 203 passed
```

Record the exact count here at execution time: __________

- [ ] **Verify Phase F pytest fixtures are present**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest --fixtures -q 2>&1 | grep -E "^(client|mock_mongo|mock_neo4j)\s"
```

Expected: all three of `client`, `mock_mongo`, `mock_neo4j` listed. If any are missing, halt — Phase F may have renamed or relocated them, and every v2 endpoint test in Tasks 3-7 depends on these fixtures.

- [ ] **Verify spec-referenced line numbers still match (sanity check)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -n "def get_leads_for_org" backend/app/services/leads.py
grep -n "def _ensure_icp_id_registry_indexes" backend/app/services/icp.py
grep -n "_ensure_icp_id_registry_indexes" backend/app/services/icp.py backend/app/services/customer_profile.py
grep -n "lead_stream_coll.create_index" backend/app/services/leads.py
grep -rn "_ensure_icp_id_registry_indexes" backend/tests/ | wc -l   # expected: 14
```

If any count differs significantly, halt and re-validate the spec's line references against `master`.

- [ ] **Create the feature branch**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout -b refactor-backend-pagination-and-index-hygiene-phase-g
git rev-parse --abbrev-ref HEAD   # expected: refactor-backend-pagination-and-index-hygiene-phase-g
```

---

## Task 1: Add `PaginatedResponse[T]` model (commit 1 of 8)

**Goal:** Land the generic envelope model and three unit tests. Pure-additive — no service or route changes yet.

**Files:**
- Create: `backend/app/models/pagination.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/unit/test_pagination_model.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/test_pagination_model.py`:

```python
from typing import Any, Dict

import pytest
from pydantic import ValidationError

from app.models import PaginatedResponse


def test_paginated_response_with_dict_items():
    resp = PaginatedResponse[Dict[str, Any]](
        items=[{"id": 1}, {"id": 2}],
        total=100,
        limit=50,
        offset=0,
    )
    assert resp.items[0]["id"] == 1
    assert resp.total == 100
    assert resp.limit == 50
    assert resp.offset == 0


def test_paginated_response_limit_above_cap_rejected():
    with pytest.raises(ValidationError):
        PaginatedResponse[Dict[str, Any]](
            items=[],
            total=0,
            limit=501,
            offset=0,
        )


def test_paginated_response_json_round_trip():
    original = PaginatedResponse[Dict[str, Any]](
        items=[{"x": 1}],
        total=1,
        limit=50,
        offset=0,
    )
    restored = PaginatedResponse[Dict[str, Any]].model_validate_json(
        original.model_dump_json()
    )
    assert restored == original
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/unit/test_pagination_model.py -v
```

Expected: 3 errors with `ImportError: cannot import name 'PaginatedResponse' from 'app.models'`.

- [ ] **Step 3: Create the model file**

Create `backend/app/models/pagination.py`:

```python
from typing import Generic, List, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=500)
    offset: int = Field(ge=0)
```

- [ ] **Step 4: Re-export from the models package**

Add a line to the end of `backend/app/models/__init__.py`:

```python
from app.models.pagination import PaginatedResponse  # noqa: F401
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/unit/test_pagination_model.py -v
```

Expected: 3 passed.

- [ ] **Step 6: Full-suite sanity check (no regressions)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -3
```

Expected: 206 passed (baseline 203 + 3 new).

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/models/pagination.py \
        backend/app/models/__init__.py \
        backend/tests/unit/test_pagination_model.py
git commit -m "feat(be): add PaginatedResponse[T] generic envelope model [phase G, commit 1/8]"
```

---

## Task 2: Move `create_index` calls to lifespan (commit 2 of 8)

**Goal:** Pure index-hygiene commit. Extract `_ensure_leads_indexes(mongo)` from `batch_upload_leads`; rename + reparameterize `_ensure_icp_id_registry_indexes(db)` → `_ensure_icp_indexes(mongo)`; delete six defensive callsites; update 14 test mock-patch targets; wire both into lifespan. Seven sub-operations, all in one commit (non-bisectable if split — `customer_profile.py` would briefly import a function that no longer exists).

**Files:**
- Modify: `backend/app/services/leads.py` — add `_ensure_leads_indexes`; delete inline `create_index` calls in `batch_upload_leads`
- Modify: `backend/app/services/icp.py` — rename helper, change signature, delete 2 defensive callsites
- Modify: `backend/app/services/customer_profile.py` — delete 4 defensive callsites (and lazy imports)
- Modify: `backend/app/main.py` — import + invoke both new helpers in lifespan
- Modify: `backend/tests/unit/test_customer_profile.py` — update 9 mock-patch targets
- Modify: `backend/tests/unit/test_icp.py` — update 5 mock-patch targets
- Create: `backend/tests/test_lifespan.py` — 2 integration tests for the new helpers

- [ ] **Step 1: Write the failing lifespan tests**

Create `backend/tests/test_lifespan.py`:

```python
"""Lifespan index-ensure smoke tests.

Patch targets MUST reference `app.main._ensure_*` (not `app.services.<module>._ensure_*`).
`app/main.py` does `from app.services.<module> import _ensure_*`, creating a new binding
in `app.main`'s namespace. The lifespan function calls *that* binding, not the source-module
binding. Patching `app.services.leads._ensure_leads_indexes` would rebind the source name
but leave `app.main`'s reference pointing at the original function, so the test would
silently pass against unchanged behavior. Do not "fix" the patch target to the more
natural-looking `app.services.leads._ensure_leads_indexes`.
"""
from fastapi.testclient import TestClient

from app.main import app


def test_lifespan_calls_all_ensure_index_helpers(monkeypatch):
    called = []
    monkeypatch.setattr(
        "app.main._ensure_leads_indexes",
        lambda mongo: called.append("leads"),
    )
    monkeypatch.setattr(
        "app.main._ensure_icp_indexes",
        lambda mongo: called.append("icp"),
    )
    monkeypatch.setattr(
        "app.main._ensure_market_scoring_indexes",
        lambda mongo: called.append("market_scoring"),
    )
    with TestClient(app):
        pass
    assert "leads" in called
    assert "icp" in called
    assert "market_scoring" in called


def test_lifespan_calls_ensure_icp_indexes(monkeypatch):
    """Sanity that the icp index-ensure helper is the renamed _ensure_icp_indexes,
    not the old _ensure_icp_id_registry_indexes."""
    import app.main as main_module

    assert hasattr(main_module, "_ensure_icp_indexes")
    assert not hasattr(main_module, "_ensure_icp_id_registry_indexes")
```

- [ ] **Step 2: Run lifespan tests to verify they fail**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/test_lifespan.py -v
```

Expected: errors — `AttributeError: module 'app.main' has no attribute '_ensure_leads_indexes'`.

- [ ] **Step 3: Add `_ensure_leads_indexes` to `app/services/leads.py`**

At the top of `backend/app/services/leads.py` (just after the imports, before `get_leads_for_org`), insert:

```python
def _ensure_leads_indexes(mongo) -> None:
    """Create Mongo indexes for Lead_Stream_Files.
    Idempotent — `create_index` is a no-op when an equivalent index exists.
    """
    coll = mongo["Profiler"]["Lead_Stream_Files"]
    coll.create_index("file_id", unique=True)
    coll.create_index([("user_id", 1), ("org_id", 1)])
```

- [ ] **Step 4: Delete the inline `create_index` calls in `batch_upload_leads`**

In `backend/app/services/leads.py` (around lines 219-220 in the Phase F baseline; verify with `grep -n "lead_stream_coll.create_index" backend/app/services/leads.py`), delete these two lines:

```python
        lead_stream_coll.create_index("file_id", unique=True)
        lead_stream_coll.create_index([("user_id", 1), ("org_id", 1)])
```

Surrounding context is preserved — `lead_stream_coll = profiler_db["Lead_Stream_Files"]` stays (used by the `insert_one` call below).

- [ ] **Step 5: Rename + reparameterize `_ensure_icp_id_registry_indexes` in `app/services/icp.py`**

In `backend/app/services/icp.py` (around line 1095 in the Phase F baseline), replace:

```python
def _ensure_icp_id_registry_indexes(db) -> None:
    registry = db["ICP_ID_REGISTRY"]
    registry.create_index("id", unique=True)
    registry.create_index("id_type")
```

with:

```python
def _ensure_icp_indexes(mongo) -> None:
    """Create Mongo indexes for ICP_ID_REGISTRY. Idempotent."""
    registry = mongo["Profiler"]["ICP_ID_REGISTRY"]
    registry.create_index("id", unique=True)
    registry.create_index("id_type")
```

- [ ] **Step 6: Delete the two defensive callsites in `app/services/icp.py`**

In `list_icps` (around line 812 in the Phase F baseline), delete the line:

```python
        _ensure_icp_id_registry_indexes(db)
```

The surrounding `db = mongo["Profiler"]` stays — `db` is reused on the next line (`collection = db["ICP_config"]`).

In `delete_recommended_icp` (around line 1051 in the Phase F baseline), delete the line:

```python
    _ensure_icp_id_registry_indexes(db)
```

The surrounding `db = mongo["Profiler"]` stays — `db` is reused on the next line (`collection = db["ICP_config"]`).

- [ ] **Step 7: Delete the four defensive callsites + lazy imports in `app/services/customer_profile.py`**

Locate each callsite via `grep -n "_ensure_icp_id_registry_indexes" backend/app/services/customer_profile.py` (4 expected — around lines 22, 142, 221, 359).

For each site, two changes:

**At line ~22 in `upsert_customer_profile`** — change the lazy-import line from:

```python
    from app.services.icp import _ensure_icp_id_registry_indexes, _reserve_unique_icp_id
```

to:

```python
    from app.services.icp import _reserve_unique_icp_id
```

Then delete the line `_ensure_icp_id_registry_indexes(db)` immediately below it. The `db = mongo["Profiler"]` line stays — `db` is reused below.

**At line ~142 in `list_customer_profiles`** — change the lazy-import line from:

```python
    from app.services.icp import _ensure_icp_id_registry_indexes, _reserve_unique_icp_id
```

to:

```python
    from app.services.icp import _reserve_unique_icp_id
```

Then delete the line `_ensure_icp_id_registry_indexes(db)`. The `db = mongo["Profiler"]` line stays.

**At line ~221 in `move_suggested_icp_to_customer_profile`** — change the lazy-import line from:

```python
    from app.services.icp import _ensure_icp_id_registry_indexes, _reserve_unique_icp_id
```

to:

```python
    from app.services.icp import _reserve_unique_icp_id
```

Then delete the line `_ensure_icp_id_registry_indexes(profiler_db)`. The `profiler_db = mongo["Profiler"]` line stays — reused by `icp_config_collection = profiler_db[...]` below.

**At line ~359 in `delete_customer_profile_icp`** — change the lazy-import line from:

```python
    from app.services.icp import _ensure_icp_id_registry_indexes, _release_icp_id
```

to:

```python
    from app.services.icp import _release_icp_id
```

Then delete the line `_ensure_icp_id_registry_indexes(db)`. The `db = mongo["Profiler"]` line stays.

- [ ] **Step 8: Wire both helpers into `app/main.py` lifespan**

In `backend/app/main.py`, add to the imports block (around line 28, alongside the existing `_ensure_market_scoring_indexes`):

```python
from app.services.market_scoring import _ensure_market_scoring_indexes
from app.services.leads import _ensure_leads_indexes
from app.services.icp import _ensure_icp_indexes
```

(Add the two new lines below the existing `_ensure_market_scoring_indexes` import.)

In the `lifespan` function (around line 47), change:

```python
    if app.state.clients.client is not None:
        _ensure_market_scoring_indexes(app.state.clients.client)
```

to:

```python
    if app.state.clients.client is not None:
        _ensure_market_scoring_indexes(app.state.clients.client)
        _ensure_leads_indexes(app.state.clients.client)
        _ensure_icp_indexes(app.state.clients.client)
```

- [ ] **Step 9: Update 9 mock-patch targets in `tests/unit/test_customer_profile.py`**

Run:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
sed -i 's|"app\.services\.icp\._ensure_icp_id_registry_indexes"|"app.services.icp._ensure_icp_indexes"|g' backend/tests/unit/test_customer_profile.py
grep -c "_ensure_icp_id_registry_indexes" backend/tests/unit/test_customer_profile.py   # expected: 0
grep -c "_ensure_icp_indexes" backend/tests/unit/test_customer_profile.py               # expected: 9
```

- [ ] **Step 10: Update 5 mock-patch targets in `tests/unit/test_icp.py`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
sed -i 's|"app\.services\.icp\._ensure_icp_id_registry_indexes"|"app.services.icp._ensure_icp_indexes"|g' backend/tests/unit/test_icp.py
grep -c "_ensure_icp_id_registry_indexes" backend/tests/unit/test_icp.py   # expected: 0
grep -c "_ensure_icp_indexes" backend/tests/unit/test_icp.py               # expected: 5
```

- [ ] **Step 11: Verify no stale references remain anywhere**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rn "_ensure_icp_id_registry_indexes" backend/   # expected: empty
```

If any hits remain, fix them before proceeding.

- [ ] **Step 12: Run lifespan tests to verify they pass**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/test_lifespan.py -v
```

Expected: 2 passed.

- [ ] **Step 13: Full-suite sanity check**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -3
```

Expected: 208 passed (206 + 2 lifespan). If any test fails due to a missed callsite or stale patch target, fix and re-run.

- [ ] **Step 14: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/main.py \
        backend/app/services/leads.py \
        backend/app/services/icp.py \
        backend/app/services/customer_profile.py \
        backend/tests/test_lifespan.py \
        backend/tests/unit/test_customer_profile.py \
        backend/tests/unit/test_icp.py
git commit -m "chore(be): move create_index calls to lifespan, rename _ensure_icp_indexes [phase G, commit 2/8]"
```

Post-commit sanity check:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -rn "_ensure_icp_id_registry_indexes" backend/   # expected: empty (no stale references)
grep -c "_ensure_icp_indexes" backend/app/main.py     # expected: 2 (1 import + 1 call)
```

---

## Task 3: Documents domain pagination (commit 3 of 8)

**Goal:** Convert `list_user_documents` to `(items, total)` return. Add `/v2/user-documents` returning `PaginatedResponse[UserDocumentEntry]`. v1 `/user-documents` reconstructs its existing `{status, count, files}` wrapper from the new tuple.

**Files:**
- Modify: `backend/app/services/documents.py` — update `list_user_documents` signature and body
- Modify: `backend/app/routers/documents.py` — v1 deprecation headers + new service signature
- Create: `backend/app/routers/v2/__init__.py` — empty subpackage marker
- Create: `backend/app/routers/v2/documents.py` — v2 router
- Modify: `backend/app/main.py` — mount v2 documents router
- Create: `backend/tests/test_documents_v2.py` — 4 v2 endpoint tests
- Modify: `backend/tests/test_documents.py` — add deprecation-header assertion to existing happy-path test, update for new service signature

- [ ] **Step 1: Write the failing v2 envelope tests**

Create `backend/tests/test_documents_v2.py`:

```python
"""v2 /user-documents endpoint tests."""
from unittest.mock import MagicMock


def test_v2_user_documents_envelope_shape(client, mock_mongo):
    """v2 returns {items, total, limit, offset}, not the v1 wrapper."""
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = [
        {"file_id": "f1", "file_key": "k1", "file_name": "doc1.pdf",
         "status": "completed", "uploaded_at": "2026-01-01", "data_source_type": "file"}
    ]
    mock_mongo["File_Processing"]["file_status"].find.return_value = fake_cursor
    mock_mongo["File_Processing"]["file_status"].count_documents.return_value = 1

    response = client.get("/v2/user-documents?org_id=org_1")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "limit", "offset"}
    assert body["limit"] == 50
    assert body["offset"] == 0
    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["file_id"] == "f1"


def test_v2_user_documents_limit_offset_passthrough(client, mock_mongo):
    """limit/offset query params reach the Mongo cursor."""
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = []
    mock_mongo["File_Processing"]["file_status"].find.return_value = fake_cursor
    mock_mongo["File_Processing"]["file_status"].count_documents.return_value = 0

    response = client.get("/v2/user-documents?org_id=org_1&limit=10&offset=20")
    assert response.status_code == 200
    fake_cursor.sort.return_value.skip.assert_called_with(20)
    fake_cursor.sort.return_value.skip.return_value.limit.assert_called_with(10)


def test_v2_user_documents_limit_above_cap_rejected(client):
    """limit > 500 returns 422 via Query(..., le=500)."""
    response = client.get("/v2/user-documents?org_id=org_1&limit=501")
    assert response.status_code == 422


def test_v2_user_documents_total_independent_of_limit(client, mock_mongo):
    """total reflects DB count, not items length."""
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = [
        {"file_id": "f1", "file_key": "k1", "file_name": "doc1.pdf",
         "status": "completed", "uploaded_at": "2026-01-01", "data_source_type": "file"},
        {"file_id": "f2", "file_key": "k2", "file_name": "doc2.pdf",
         "status": "completed", "uploaded_at": "2026-01-02", "data_source_type": "file"},
    ]
    mock_mongo["File_Processing"]["file_status"].find.return_value = fake_cursor
    mock_mongo["File_Processing"]["file_status"].count_documents.return_value = 423

    body = client.get("/v2/user-documents?org_id=org_1&limit=2").json()
    assert len(body["items"]) == 2
    assert body["total"] == 423
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/test_documents_v2.py -v
```

Expected: 4 failures with `404 Not Found` (the route doesn't exist).

- [ ] **Step 3: Update `list_user_documents` service signature**

In `backend/app/services/documents.py` (around line 596), replace the current function:

```python
async def list_user_documents(mongo, org_id: str) -> dict:
    db = mongo["File_Processing"]
    collection = db["file_status"]

    files = collection.find({"org_id": org_id}).sort("uploaded_at", -1)

    file_list = []
    for file_doc in files:
        # ... transformation pass ...
        file_list.append(file_item)

    return {
        "status": "success",
        "count": len(file_list),
        "files": file_list
    }
```

with:

```python
async def list_user_documents(
    mongo,
    org_id: str,
    limit: int = 500,
    offset: int = 0,
) -> tuple[List[Dict[str, Any]], int]:
    db = mongo["File_Processing"]
    collection = db["file_status"]
    flt = {"org_id": org_id}

    files = collection.find(flt).sort("uploaded_at", -1).skip(offset).limit(limit)

    file_list = []
    for file_doc in files:
        file_item = {
            "file_id": file_doc.get("file_id") or file_doc.get("file_key"),
            "file_key": file_doc.get("file_key"),
            "file_name": file_doc.get("file_name"),
            "status": file_doc.get("status", "unknown"),
            "uploaded_at": file_doc.get("uploaded_at"),
            "data_source_type": file_doc.get("data_source_type", "file"),
        }
        if file_doc.get("url"):
            file_item["url"] = file_doc.get("url")
        if "tags" in file_doc:
            file_item["tags"] = file_doc.get("tags")
        if "description" in file_doc:
            file_item["description"] = file_doc.get("description")
        file_list.append(file_item)

    total = collection.count_documents(flt)
    return file_list, total
```

- [ ] **Step 4: Update v1 `/user-documents` route to use new signature**

In `backend/app/routers/documents.py` (around line 96), replace:

```python
@router.get("/user-documents", response_model=ListUserDocumentsResponse)
async def get_user_documents(org_id: str = Query(...), mongo=Depends(get_mongo)):
    return await documents_service.list_user_documents(mongo, org_id)
```

with:

```python
@router.get("/user-documents", response_model=ListUserDocumentsResponse)
async def get_user_documents(
    response: Response,
    org_id: str = Query(...),
    mongo=Depends(get_mongo),
):
    """**Deprecated:** use `GET /api/v2/user-documents` for the paginated envelope.

    Returns up to 500 documents (silent cap; previously unbounded).
    """
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v2/user-documents>; rel="successor-version"'
    items, _ = await documents_service.list_user_documents(mongo, org_id)
    return {"status": "success", "count": len(items), "files": items}
```

Add `Response` to the existing `fastapi` import line near the top of the file (it likely already imports `APIRouter, Depends, Query`).

- [ ] **Step 5: Create v2 router subpackage marker**

Create `backend/app/routers/v2/__init__.py`:

```python
"""v2 paginated API routers — see specs/2026-05-23-backend-pagination-and-index-hygiene-phase-g-design.md"""
```

- [ ] **Step 6: Create v2 documents router**

Create `backend/app/routers/v2/documents.py`:

```python
from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_mongo
from app.models import PaginatedResponse
from app.models.documents import UserDocumentEntry
from app.services.documents import list_user_documents

router = APIRouter(prefix="/user-documents", tags=["v2", "documents"])


@router.get("", response_model=PaginatedResponse[UserDocumentEntry])
async def list_user_documents_v2(
    org_id: str = Query(...),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    mongo=Depends(get_mongo),
):
    items, total = await list_user_documents(mongo, org_id, limit=limit, offset=offset)
    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)
```

`UserDocumentEntry` is defined at `app/models/documents.py:49` and is already used by `ListUserDocumentsResponse.files`. Import via `from app.models.documents import UserDocumentEntry`.

- [ ] **Step 7: Mount v2 documents router in `app/main.py`**

In `backend/app/main.py`, locate the existing `app.include_router(...)` block. Add:

```python
from app.routers.v2 import documents as documents_v2

app.include_router(documents_v2.router, prefix="/v2")
```

(Import goes near the top with other router imports; `include_router` call goes alongside the others.)

- [ ] **Step 8: Run v2 tests to verify they pass**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/test_documents_v2.py -v
```

Expected: 4 passed.

- [ ] **Step 9: Add deprecation-header assertion to existing v1 test**

In `backend/tests/test_documents.py`, locate the existing happy-path test for `GET /user-documents` (the one calling `client.get("/user-documents?org_id=...")`). Append these three assertions to that test:

```python
    assert response.headers.get("Deprecation") == "true"
    assert 'rel="successor-version"' in response.headers.get("Link", "")
    assert "/api/v2/user-documents" in response.headers["Link"]
```

- [ ] **Step 10: Update existing tests for new service signature**

Run:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -10
```

Any test calling `list_user_documents(mongo, org_id)` with the old single-return-dict expectation needs updating. Fix each:
- If the test asserted on the wrapper dict shape, it may now need to call the v1 route (which still returns the wrapper) instead of the service directly.
- If the test asserted on a list of items, change it to unpack the tuple: `items, total = await list_user_documents(...)`.

Re-run until green.

- [ ] **Step 11: Full-suite sanity check**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -3
```

Expected: 212 passed (208 baseline + 4 new v2 tests).

- [ ] **Step 12: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/documents.py \
        backend/app/routers/documents.py \
        backend/app/routers/v2/__init__.py \
        backend/app/routers/v2/documents.py \
        backend/app/main.py \
        backend/tests/test_documents_v2.py \
        backend/tests/test_documents.py
git commit -m "feat(be): add /v2/user-documents paginated endpoint + deprecate v1 [phase G, commit 3/8]"
```

---

## Task 4: ICP domain pagination (commit 4 of 8)

**Goal:** In-memory pagination for `list_icps` (LLM regenerates the full set, then slice). v1 `/icp` reconstructs `{suggestedICPs: items}`. v2 `/v2/icp` returns `PaginatedResponse[Dict[str, Any]]`.

**Files:**
- Modify: `backend/app/services/icp.py` — update `list_icps` signature and both return sites
- Modify: `backend/app/routers/icp.py` — v1 deprecation headers
- Create: `backend/app/routers/v2/icp.py` — v2 router
- Modify: `backend/app/main.py` — mount v2 icp router
- Create: `backend/tests/test_icp_v2.py` — 4 v2 endpoint tests
- Modify: `backend/tests/test_icp.py` — add deprecation-header assertion to existing happy-path test, update for new service signature

- [ ] **Step 1: Write the failing v2 envelope tests**

Create `backend/tests/test_icp_v2.py`:

```python
"""v2 /icp endpoint tests."""
from unittest.mock import MagicMock, patch


def test_v2_icp_envelope_shape(client):
    """v2 returns {items, total, limit, offset}, not the v1 wrapper."""
    fake_result = {"suggestedICPs": [{"id": "icp_1", "name": "ICP 1"}]}
    with patch("app.routers.v2.icp.list_icps", return_value=([{"id": "icp_1", "name": "ICP 1"}], 1)):
        response = client.get("/v2/icp?user_id=user_1")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "limit", "offset"}
    assert body["limit"] == 50
    assert body["offset"] == 0
    assert body["total"] == 1


def test_v2_icp_limit_offset_passthrough(client):
    """limit/offset query params reach the service."""
    with patch("app.routers.v2.icp.list_icps", return_value=([], 0)) as mock_svc:
        response = client.get("/v2/icp?user_id=user_1&limit=10&offset=5")
    assert response.status_code == 200
    call_kwargs = mock_svc.call_args.kwargs
    assert call_kwargs["limit"] == 10
    assert call_kwargs["offset"] == 5


def test_v2_icp_limit_above_cap_rejected(client):
    response = client.get("/v2/icp?user_id=user_1&limit=501")
    assert response.status_code == 422


def test_v2_icp_total_independent_of_items(client):
    """total reflects full ICP set, not items length."""
    with patch("app.routers.v2.icp.list_icps", return_value=([{"id": "a"}, {"id": "b"}], 7)):
        body = client.get("/v2/icp?user_id=user_1&limit=2").json()
    assert len(body["items"]) == 2
    assert body["total"] == 7
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/test_icp_v2.py -v
```

Expected: 4 failures with `404 Not Found`.

- [ ] **Step 3: Update `list_icps` signature and return sites**

In `backend/app/services/icp.py`, locate `def list_icps(driver, mongo, agent_chain, user_id: str, refresh: bool = False) -> Dict[str, Any]:` (around line 672) and change the signature to:

```python
def list_icps(
    driver,
    mongo,
    agent_chain,
    user_id: str,
    refresh: bool = False,
    limit: int = 500,
    offset: int = 0,
) -> tuple[List[Dict[str, Any]], int]:
```

Then locate **both return sites** and convert each from "return the dict" to "slice and return (items, total)":

**Cache-return path** (around line 842 — find via `grep -n "return normalized_cached" backend/app/services/icp.py`):

Change:

```python
            return normalized_cached
```

to:

```python
            all_items = normalized_cached.get("suggestedICPs", [])
            total = len(all_items)
            items = all_items[offset : offset + limit]
            return items, total
```

**Generation-return path** (around line 894 — find via `grep -n "return icp_result" backend/app/services/icp.py`):

Change:

```python
            return icp_result
```

to:

```python
            all_items = icp_result.get("suggestedICPs", [])
            total = len(all_items)
            items = all_items[offset : offset + limit]
            return items, total
```

If there are other early-return points (e.g., an empty-state early return), apply the same pattern at each. Verify with:

```bash
grep -nE "return (normalized_cached|icp_result|.*suggestedICPs)" backend/app/services/icp.py
```

- [ ] **Step 4: Update v1 `/icp` route**

In `backend/app/routers/icp.py` (around line 17), replace:

```python
@router.get("/icp", response_model=ICPListResponse)
async def get_or_create_icp_config(
    user_id: str = Query(...),
    refresh: bool = Query(False),
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    agent_chain=Depends(get_agent_chain),
):
    return icp_service.list_icps(driver, mongo, agent_chain, user_id=user_id, refresh=refresh)
```

with:

```python
@router.get("/icp", response_model=ICPListResponse)
async def get_or_create_icp_config(
    response: Response,
    user_id: str = Query(...),
    refresh: bool = Query(False),
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    agent_chain=Depends(get_agent_chain),
):
    """**Deprecated:** use `GET /api/v2/icp` for the paginated envelope.

    Returns the user's ICP list (typically 5-10 items; hard cap of 500).
    """
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v2/icp>; rel="successor-version"'
    # Accept service defaults (limit=500, offset=0) — typical ICP cardinality is 5-10.
    items, _ = icp_service.list_icps(driver, mongo, agent_chain, user_id=user_id, refresh=refresh)
    return {"suggestedICPs": items}
```

Add `Response` to the existing `fastapi` import line near the top of the file.

- [ ] **Step 5: Create v2 icp router**

Create `backend/app/routers/v2/icp.py`:

```python
from typing import Any, Dict

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_agent_chain, get_mongo, get_neo4j_driver
from app.models import PaginatedResponse
from app.services.icp import list_icps

router = APIRouter(prefix="/icp", tags=["v2", "icp"])


@router.get("", response_model=PaginatedResponse[Dict[str, Any]])
async def list_icps_v2(
    user_id: str = Query(...),
    refresh: bool = Query(False),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    agent_chain=Depends(get_agent_chain),
):
    items, total = list_icps(
        driver, mongo, agent_chain,
        user_id=user_id, refresh=refresh,
        limit=limit, offset=offset,
    )
    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)
```

- [ ] **Step 6: Mount v2 icp router in `app/main.py`**

```python
from app.routers.v2 import icp as icp_v2
# ...
app.include_router(icp_v2.router, prefix="/v2")
```

- [ ] **Step 7: Run v2 tests to verify they pass**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/test_icp_v2.py -v
```

Expected: 4 passed.

- [ ] **Step 8: Add deprecation-header assertion to existing v1 test**

In `backend/tests/test_icp.py`, locate the happy-path test for `GET /icp` and append:

```python
    assert response.headers.get("Deprecation") == "true"
    assert 'rel="successor-version"' in response.headers.get("Link", "")
    assert "/api/v2/icp" in response.headers["Link"]
```

- [ ] **Step 9: Update existing service tests for new return type**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -20
```

Update any test that called `list_icps(...)` and expected a dict to unpack the tuple instead: `items, total = list_icps(...)`. Update assertions accordingly (a test that asserted `result["suggestedICPs"][0]["id"] == "X"` becomes `items[0]["id"] == "X"`).

Re-run until green.

- [ ] **Step 10: Full-suite sanity check**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -3
```

Expected: 216 passed (212 + 4 new v2 tests).

- [ ] **Step 11: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/icp.py \
        backend/app/routers/icp.py \
        backend/app/routers/v2/icp.py \
        backend/app/main.py \
        backend/tests/test_icp_v2.py \
        backend/tests/test_icp.py
git commit -m "feat(be): add /v2/icp paginated endpoint + deprecate v1 [phase G, commit 4/8]"
```

---

## Task 5: Signals domain pagination (commit 5 of 8)

**Goal:** Convert `fetch_signals` to `(items, total)` return. v2 `/v2/fetch-signals` defaults to `limit=10` (matching current FE behavior). v1 keeps its current unvalidated `Query(10)` `limit` parameter (deferred cleanup per spec §2.3 #3).

**Files:**
- Modify: `backend/app/services/signals.py` — update `fetch_signals` signature, add `count_documents()` call
- Modify: `backend/app/routers/signals.py` — v1 deprecation headers
- Create: `backend/app/routers/v2/signals.py` — v2 router
- Modify: `backend/app/main.py` — mount v2 signals router
- Create: `backend/tests/test_signals_v2.py` — 4 v2 endpoint tests
- Modify: `backend/tests/test_signals.py` — add deprecation-header assertion + update for new service signature

- [ ] **Step 1: Write the failing v2 envelope tests**

Create `backend/tests/test_signals_v2.py`:

```python
"""v2 /fetch-signals endpoint tests."""
from unittest.mock import MagicMock


def test_v2_fetch_signals_envelope_shape(client, mock_mongo):
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = [
        {"signal_id": "s1", "user_id": "user_1", "timestamp": "2026-01-01"}
    ]
    mock_mongo["Signals"]["signals"].find.return_value = fake_cursor
    mock_mongo["Signals"]["signals"].count_documents.return_value = 1

    response = client.get("/v2/fetch-signals?user_id=user_1")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "limit", "offset"}
    assert body["limit"] == 10   # v2 default for fetch-signals is 10, not 50
    assert body["offset"] == 0
    assert body["total"] == 1


def test_v2_fetch_signals_limit_offset_passthrough(client, mock_mongo):
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = []
    mock_mongo["Signals"]["signals"].find.return_value = fake_cursor
    mock_mongo["Signals"]["signals"].count_documents.return_value = 0

    response = client.get("/v2/fetch-signals?user_id=user_1&limit=5&offset=15")
    assert response.status_code == 200
    fake_cursor.sort.return_value.skip.assert_called_with(15)
    fake_cursor.sort.return_value.skip.return_value.limit.assert_called_with(5)


def test_v2_fetch_signals_limit_above_cap_rejected(client):
    response = client.get("/v2/fetch-signals?user_id=user_1&limit=501")
    assert response.status_code == 422


def test_v2_fetch_signals_total_independent_of_limit(client, mock_mongo):
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = [
        {"signal_id": "s1", "user_id": "user_1"},
        {"signal_id": "s2", "user_id": "user_1"},
    ]
    mock_mongo["Signals"]["signals"].find.return_value = fake_cursor
    mock_mongo["Signals"]["signals"].count_documents.return_value = 42

    body = client.get("/v2/fetch-signals?user_id=user_1&limit=2").json()
    assert len(body["items"]) == 2
    assert body["total"] == 42
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/test_signals_v2.py -v
```

Expected: 4 failures with `404 Not Found`.

- [ ] **Step 3: Update `fetch_signals` service signature**

In `backend/app/services/signals.py` (around line 913), replace the current function:

```python
async def fetch_signals(mongo, user_id: str, limit: int = 10) -> dict:
    """Fetch signals and return them in a simple list format - filtered by user_id only."""
    db = mongo["Signals"]
    collection = db["signals"]

    signals_cursor = collection.find(
        {"user_id": user_id}
    ).sort("timestamp", -1).limit(limit)

    signals_list = []
    for signal in signals_cursor:
        signal.pop("_id", None)
        if "signal_id" not in signal and "id" in signal:
            signal["signal_id"] = signal["id"]
        elif "id" not in signal and "signal_id" in signal:
            signal["id"] = signal["signal_id"]
        signals_list.append(signal)

    return {
        "status": "success",
        "count": len(signals_list),
        "signals": signals_list
    }
```

with:

```python
async def fetch_signals(
    mongo,
    user_id: str,
    limit: int = 10,
    offset: int = 0,
) -> tuple[List[Dict[str, Any]], int]:
    """Fetch signals for a user. Returns (items, total). User-scoped, not org-scoped."""
    db = mongo["Signals"]
    collection = db["signals"]
    flt = {"user_id": user_id}

    signals_cursor = collection.find(flt).sort("timestamp", -1).skip(offset).limit(limit)

    signals_list = []
    for signal in signals_cursor:
        signal.pop("_id", None)
        if "signal_id" not in signal and "id" in signal:
            signal["signal_id"] = signal["id"]
        elif "id" not in signal and "signal_id" in signal:
            signal["id"] = signal["signal_id"]
        signals_list.append(signal)

    total = collection.count_documents(flt)
    return signals_list, total
```

- [ ] **Step 4: Update v1 `/fetch-signals` route**

In `backend/app/routers/signals.py` (around line 64), replace:

```python
@router.get("/fetch-signals", response_model=FetchSignalsResponse)
async def fetch_signals(
    user_id: str = Query(...),
    limit: int = Query(10),
    mongo=Depends(get_mongo),
):
    """Fetch signals and return them in a simple list format - filtered by user_id only"""
    return await signals_service.fetch_signals(mongo, user_id, limit)
```

with:

```python
@router.get("/fetch-signals", response_model=FetchSignalsResponse)
async def fetch_signals(
    response: Response,
    user_id: str = Query(...),
    limit: int = Query(10),
    mongo=Depends(get_mongo),
):
    """**Deprecated:** use `GET /api/v2/fetch-signals` for the paginated envelope.

    Preserves the existing unvalidated `limit` query parameter — tightening is
    deferred to Phase H alongside v1 route deletion.
    """
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v2/fetch-signals>; rel="successor-version"'
    items, _ = await signals_service.fetch_signals(mongo, user_id, limit=limit)
    return {"status": "success", "count": len(items), "signals": items}
```

Add `Response` to the existing `fastapi` import line.

- [ ] **Step 5: Create v2 signals router**

Create `backend/app/routers/v2/signals.py`:

```python
from typing import Any, Dict

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_mongo
from app.models import PaginatedResponse
from app.services.signals import fetch_signals

router = APIRouter(prefix="/fetch-signals", tags=["v2", "signals"])


@router.get("", response_model=PaginatedResponse[Dict[str, Any]])
async def fetch_signals_v2(
    user_id: str = Query(...),
    limit: int = Query(10, ge=1, le=500),
    offset: int = Query(0, ge=0),
    mongo=Depends(get_mongo),
):
    items, total = await fetch_signals(mongo, user_id, limit=limit, offset=offset)
    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)
```

- [ ] **Step 6: Mount v2 signals router in `app/main.py`**

```python
from app.routers.v2 import signals as signals_v2
# ...
app.include_router(signals_v2.router, prefix="/v2")
```

- [ ] **Step 7: Run v2 tests to verify they pass**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/test_signals_v2.py -v
```

Expected: 4 passed.

- [ ] **Step 8: Add deprecation-header assertion to existing v1 test**

In `backend/tests/test_signals.py`, locate the happy-path test for `/fetch-signals` and append:

```python
    assert response.headers.get("Deprecation") == "true"
    assert 'rel="successor-version"' in response.headers.get("Link", "")
    assert "/api/v2/fetch-signals" in response.headers["Link"]
```

- [ ] **Step 9: Update existing service tests for new return type**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -20
```

Fix any test that called `fetch_signals(...)` and expected a dict to unpack the tuple.

- [ ] **Step 10: Full-suite sanity check**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -3
```

Expected: 220 passed (216 + 4 new v2 tests).

- [ ] **Step 11: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/signals.py \
        backend/app/routers/signals.py \
        backend/app/routers/v2/signals.py \
        backend/app/main.py \
        backend/tests/test_signals_v2.py \
        backend/tests/test_signals.py
git commit -m "feat(be): add /v2/fetch-signals paginated endpoint + deprecate v1 [phase G, commit 5/8]"
```

---

## Task 6: Org_auth (registration) pagination (commit 6 of 8)

**Goal:** Convert `list_registrations` to `tuple[list[RegistrationResponse], int]` — note the typed return, not `tuple[list[dict], int]`. Cross-tenant admin view, no `org_id` filter. v2 `/v2/registration` uses `PaginatedResponse[RegistrationResponse]`.

**Files:**
- Modify: `backend/app/services/org_auth.py` — update `list_registrations` signature
- Modify: `backend/app/routers/org_auth.py` — v1 deprecation headers
- Create: `backend/app/routers/v2/org_auth.py` — v2 router
- Modify: `backend/app/main.py` — mount v2 org_auth router
- Create: `backend/tests/test_org_auth_v2.py` — 4 v2 endpoint tests
- Modify: `backend/tests/test_org_auth.py` — add deprecation-header assertion + update for new service signature

- [ ] **Step 1: Write the failing v2 envelope tests**

Create `backend/tests/test_org_auth_v2.py`:

```python
"""v2 /registration endpoint tests."""
from unittest.mock import MagicMock


def test_v2_registration_envelope_shape(client, mock_mongo):
    fake_doc = {
        "_id": "abc123",
        "name": "Alice",
        "email": "alice@example.com",
        "timestamp": "2026-01-01T00:00:00",
    }
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = [fake_doc]
    mock_mongo["Registration_DB"]["registrations"].find.return_value = fake_cursor
    mock_mongo["Registration_DB"]["registrations"].count_documents.return_value = 1

    response = client.get("/v2/registration")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "limit", "offset"}
    assert body["limit"] == 50
    assert body["offset"] == 0
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Alice"


def test_v2_registration_limit_offset_passthrough(client, mock_mongo):
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = []
    mock_mongo["Registration_DB"]["registrations"].find.return_value = fake_cursor
    mock_mongo["Registration_DB"]["registrations"].count_documents.return_value = 0

    response = client.get("/v2/registration?limit=10&offset=20")
    assert response.status_code == 200
    fake_cursor.sort.return_value.skip.assert_called_with(20)
    fake_cursor.sort.return_value.skip.return_value.limit.assert_called_with(10)


def test_v2_registration_limit_above_cap_rejected(client):
    response = client.get("/v2/registration?limit=501")
    assert response.status_code == 422


def test_v2_registration_total_independent_of_limit(client, mock_mongo):
    fake_docs = [
        {"_id": "1", "name": "A", "email": "a@x.com", "timestamp": "2026-01-01T00:00:00"},
        {"_id": "2", "name": "B", "email": "b@x.com", "timestamp": "2026-01-02T00:00:00"},
    ]
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = fake_docs
    mock_mongo["Registration_DB"]["registrations"].find.return_value = fake_cursor
    mock_mongo["Registration_DB"]["registrations"].count_documents.return_value = 87

    body = client.get("/v2/registration?limit=2").json()
    assert len(body["items"]) == 2
    assert body["total"] == 87
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/test_org_auth_v2.py -v
```

Expected: 4 failures with `404 Not Found`.

- [ ] **Step 3: Update `list_registrations` service signature**

In `backend/app/services/org_auth.py` (around line 156), replace:

```python
def list_registrations(mongo) -> List[RegistrationResponse]:
    """
    Fetches all registration entries ordered by recency (most recent first).
    Uses separate database 'Registration_DB' and collection 'registrations'.
    """
    db = mongo["Registration_DB"]
    collection = db["registrations"]

    registrations = collection.find().sort("timestamp", -1)

    result = []
    for reg in registrations:
        result.append(RegistrationResponse(
            id=str(reg["_id"]),
            name=reg["name"],
            email=reg["email"],
            timestamp=reg["timestamp"].isoformat() if isinstance(reg["timestamp"], datetime) else reg["timestamp"]
        ))

    return result
```

with:

```python
def list_registrations(
    mongo,
    limit: int = 500,
    offset: int = 0,
) -> tuple[List[RegistrationResponse], int]:
    """Cross-tenant admin view of registrations, paginated.

    No org_id filter — see spec §2.1 #2. Uses separate database
    'Registration_DB' and collection 'registrations'.
    """
    db = mongo["Registration_DB"]
    collection = db["registrations"]
    flt: dict = {}

    total = collection.count_documents(flt)
    cursor = collection.find(flt).sort("timestamp", -1).skip(offset).limit(limit)

    result: List[RegistrationResponse] = []
    for reg in cursor:
        result.append(RegistrationResponse(
            id=str(reg["_id"]),
            name=reg["name"],
            email=reg["email"],
            timestamp=reg["timestamp"].isoformat() if isinstance(reg["timestamp"], datetime) else reg["timestamp"],
        ))

    return result, total
```

- [ ] **Step 4: Update v1 `/registration` route**

In `backend/app/routers/org_auth.py` (around line 40), replace:

```python
@router.get("/registration", response_model=List[RegistrationResponse])
async def get_registrations(mongo=Depends(get_mongo)):
    return org_auth_service.list_registrations(mongo)
```

with:

```python
@router.get("/registration", response_model=List[RegistrationResponse])
async def get_registrations(
    response: Response,
    mongo=Depends(get_mongo),
):
    """**Deprecated:** use `GET /api/v2/registration` for the paginated envelope.

    Returns up to 500 registrations (silent cap; previously unbounded).
    Admin-only cross-tenant view — no org_id filter — see spec §2.1 #2.
    Reads from the separate `Registration_DB` database (not `Profiler`).
    """
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v2/registration>; rel="successor-version"'
    items, _ = org_auth_service.list_registrations(mongo)
    return items
```

Add `Response` to the existing `fastapi` import line.

- [ ] **Step 5: Create v2 org_auth router**

Create `backend/app/routers/v2/org_auth.py`:

```python
from typing import List

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_mongo
from app.models import PaginatedResponse
from app.models.org_auth import RegistrationResponse
from app.services.org_auth import list_registrations

router = APIRouter(prefix="/registration", tags=["v2", "org_auth"])


@router.get("", response_model=PaginatedResponse[RegistrationResponse])
async def list_registrations_v2(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    mongo=Depends(get_mongo),
):
    items, total = list_registrations(mongo, limit=limit, offset=offset)
    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)
```

If `RegistrationResponse` lives in a different module, adjust the import. Locate via `grep -rn "class RegistrationResponse" backend/app/models/`.

- [ ] **Step 6: Mount v2 org_auth router in `app/main.py`**

```python
from app.routers.v2 import org_auth as org_auth_v2
# ...
app.include_router(org_auth_v2.router, prefix="/v2")
```

- [ ] **Step 7: Run v2 tests to verify they pass**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/test_org_auth_v2.py -v
```

Expected: 4 passed.

- [ ] **Step 8: Add deprecation-header assertion to existing v1 test**

In `backend/tests/test_org_auth.py`, locate the happy-path test for `GET /registration` and append:

```python
    assert response.headers.get("Deprecation") == "true"
    assert 'rel="successor-version"' in response.headers.get("Link", "")
    assert "/api/v2/registration" in response.headers["Link"]
```

- [ ] **Step 9: Update existing service tests for new return type**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -20
```

Fix any test that called `list_registrations(mongo)` and expected a list to unpack the tuple.

- [ ] **Step 10: Full-suite sanity check**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -3
```

Expected: 224 passed (220 + 4 new v2 tests).

- [ ] **Step 11: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/org_auth.py \
        backend/app/routers/org_auth.py \
        backend/app/routers/v2/org_auth.py \
        backend/app/main.py \
        backend/tests/test_org_auth_v2.py \
        backend/tests/test_org_auth.py
git commit -m "feat(be): add /v2/registration paginated endpoint + deprecate v1 [phase G, commit 6/8]"
```

---

## Task 7: Leads domain pagination (commit 7 of 8)

**Goal:** Largest commit. Convert `get_leads_for_org` and `list_leads_by_file` to Cypher `SKIP/LIMIT` with mandatory `ORDER BY l.created_at DESC`. Drop the now-redundant `order_by_recent` parameter from `get_leads_for_org`. Update all four cross-domain callers (`market_scoring.py:393,678`; `signals.py:594,732`). Two v2 endpoints in one commit: `/v2/leads` and `/v2/leads/by-file`.

**Note:** Tasks 3-6 may have shifted line numbers in `signals.py` (Task 5 specifically rewrites `fetch_signals` near line 913). Re-verify caller locations with `grep -n 'get_leads_for_org' backend/app/services/signals.py` before editing.

**Files:**
- Modify: `backend/app/services/leads.py` — `get_leads_for_org` + `list_leads_by_file` Neo4j paginated rewrite
- Modify: `backend/app/services/market_scoring.py` — drop `order_by_recent=True` from 2 callers
- Modify: `backend/app/services/signals.py` — drop `order_by_recent=True` from 2 callers, unpack tuple
- Modify: `backend/app/routers/leads.py` — v1 deprecation headers on `/leads` and `/leads/by-file`
- Create: `backend/app/routers/v2/leads.py` — v2 router (2 routes)
- Modify: `backend/app/main.py` — mount v2 leads router
- Create: `backend/tests/test_leads_v2.py` — 8 v2 endpoint tests (4 per route)
- Modify: `backend/tests/test_leads.py` — add deprecation-header assertions + update for new service signature
- Modify: `backend/tests/unit/test_leads.py` (if exists) — update unit tests for new tuple return

- [ ] **Step 1: Write the failing v2 envelope tests**

Create `backend/tests/test_leads_v2.py`:

```python
"""v2 /leads + /leads/by-file endpoint tests."""
from unittest.mock import MagicMock


def test_v2_leads_envelope_shape(client, mock_neo4j):
    mock_neo4j["session"].run.side_effect = [
        [{"l": {"name": "X"}}],
        MagicMock(single=lambda: {"total": 1}),
    ]
    response = client.get("/v2/leads?org_id=org_1")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "limit", "offset"}
    assert body["limit"] == 50
    assert body["offset"] == 0
    assert body["total"] == 1


def test_v2_leads_limit_offset_passthrough(client, mock_neo4j):
    mock_neo4j["session"].run.side_effect = [
        [],
        MagicMock(single=lambda: {"total": 0}),
    ]
    response = client.get("/v2/leads?org_id=org_1&limit=10&offset=20")
    call_kwargs = mock_neo4j["session"].run.call_args_list[0].kwargs
    assert call_kwargs["limit"] == 10
    assert call_kwargs["offset"] == 20


def test_v2_leads_limit_above_cap_rejected(client):
    response = client.get("/v2/leads?org_id=org_1&limit=501")
    assert response.status_code == 422


def test_v2_leads_total_independent_of_limit(client, mock_neo4j):
    mock_neo4j["session"].run.side_effect = [
        [{"l": {"name": "X"}}, {"l": {"name": "Y"}}],
        MagicMock(single=lambda: {"total": 423}),
    ]
    body = client.get("/v2/leads?org_id=org_1&limit=2").json()
    assert len(body["items"]) == 2
    assert body["total"] == 423


def test_v2_leads_by_file_envelope_shape(client, mock_neo4j):
    mock_neo4j["session"].run.side_effect = [
        [{"l": {"name": "X"}}],
        MagicMock(single=lambda: {"total": 1}),
    ]
    response = client.get("/v2/leads/by-file?org_id=org_1&file_id=f1")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "limit", "offset"}


def test_v2_leads_by_file_limit_offset_passthrough(client, mock_neo4j):
    mock_neo4j["session"].run.side_effect = [
        [],
        MagicMock(single=lambda: {"total": 0}),
    ]
    response = client.get("/v2/leads/by-file?org_id=org_1&file_id=f1&limit=5&offset=10")
    call_kwargs = mock_neo4j["session"].run.call_args_list[0].kwargs
    assert call_kwargs["limit"] == 5
    assert call_kwargs["offset"] == 10


def test_v2_leads_by_file_limit_above_cap_rejected(client):
    response = client.get("/v2/leads/by-file?org_id=org_1&file_id=f1&limit=501")
    assert response.status_code == 422


def test_v2_leads_by_file_total_independent_of_limit(client, mock_neo4j):
    mock_neo4j["session"].run.side_effect = [
        [{"l": {"name": "X"}}],
        MagicMock(single=lambda: {"total": 99}),
    ]
    body = client.get("/v2/leads/by-file?org_id=org_1&file_id=f1&limit=1").json()
    assert len(body["items"]) == 1
    assert body["total"] == 99
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/test_leads_v2.py -v
```

Expected: 8 failures with `404 Not Found`.

- [ ] **Step 3: Rewrite `get_leads_for_org` for pagination**

In `backend/app/services/leads.py`, replace the entire `get_leads_for_org` function (lines 18-39) with:

```python
def get_leads_for_org(
    driver,
    org_id: str,
    limit: int = 500,
    offset: int = 0,
) -> tuple[List[Dict[str, Any]], int]:
    """Fetch leads from Neo4j for a given org, paginated. Returns (items, total).

    Results ordered by `created_at DESC` (newest first) — mandatory for stable pagination.
    Raises on storage or query failures; callers wanting silent failure wrap with
    ``except BrewraError`` (or ``except Exception``).
    """
    with driver.session() as s:
        items_result = s.run(
            """
            MATCH (l:Lead {org_id: $org_id})
            RETURN l
            ORDER BY l.created_at DESC
            SKIP $offset LIMIT $limit
            """,
            org_id=org_id, limit=limit, offset=offset,
        )
        items = _process_neo4j_lead_records(items_result)

        total_result = s.run(
            "MATCH (l:Lead {org_id: $org_id}) RETURN count(l) AS total",
            org_id=org_id,
        )
        total = total_result.single()["total"]

    return items, total
```

Three behavior changes from the "before":
- `limit` default goes from `None` (unbounded) to `500`.
- `offset` added with default `0`.
- `order_by_recent` parameter removed; `ORDER BY l.created_at DESC` is now mandatory.

- [ ] **Step 4: Rewrite `list_leads_by_file` for pagination**

In `backend/app/services/leads.py`, replace `list_leads_by_file` (around lines 341-354) with:

```python
def list_leads_by_file(
    driver,
    org_id: str,
    file_id: str,
    limit: int = 500,
    offset: int = 0,
) -> tuple[List[Dict[str, Any]], int]:
    """Fetch leads filtered by file_id within an org, paginated. Returns (items, total).

    Results ordered by `created_at DESC` (newest first) — mandatory for stable pagination.
    """
    with driver.session() as s:
        items_result = s.run(
            """
            MATCH (l:Lead)
            WHERE l.org_id = $org_id AND l.file_id = $file_id
            RETURN l
            ORDER BY l.created_at DESC
            SKIP $offset LIMIT $limit
            """,
            org_id=org_id, file_id=file_id, limit=limit, offset=offset,
        )
        items = _process_neo4j_lead_records(items_result)

        total_result = s.run(
            "MATCH (l:Lead) WHERE l.org_id = $org_id AND l.file_id = $file_id RETURN count(l) AS total",
            org_id=org_id, file_id=file_id,
        )
        total = total_result.single()["total"]

    return items, total
```

- [ ] **Step 5: Update 2 callers in `market_scoring.py`**

In `backend/app/services/market_scoring.py`, locate both calls via `grep -n "get_leads_for_org" backend/app/services/market_scoring.py`.

**Around line 393** (degrade-on-failure path) — change:

```python
            total_leads = len(get_leads_for_org(driver, org_id=org_id, limit=5000, order_by_recent=True))
```

to:

```python
            leads, _ = get_leads_for_org(driver, org_id=org_id, limit=5000, offset=0)
            total_leads = len(leads)
```

**Around line 678** (background task main loop) — change:

```python
        leads = get_leads_for_org(driver, org_id=org_id, limit=5000, order_by_recent=True)
        total_leads = len(leads)
```

to:

```python
        leads, _ = get_leads_for_org(driver, org_id=org_id, limit=5000, offset=0)
        total_leads = len(leads)
```

- [ ] **Step 6: Update 2 callers in `signals.py`**

In `backend/app/services/signals.py`, locate both calls via `grep -n "get_leads_for_org" backend/app/services/signals.py`.

**Around line 594** (Scout signals research) — change:

```python
            leads_data = get_leads_for_org(driver, org_id=request.org_id, limit=100, order_by_recent=True)
```

to:

```python
            leads_data, _ = get_leads_for_org(driver, org_id=request.org_id, limit=100, offset=0)
```

**Around line 732** (Profiler signals research) — change:

```python
            leads_data = get_leads_for_org(driver, org_id=request.org_id, limit=100, order_by_recent=True)
            logger.info(f"[Batch Signals] Fetched {len(leads_data)} leads for org_id: {request.org_id}")
```

to:

```python
            leads_data, _ = get_leads_for_org(driver, org_id=request.org_id, limit=100, offset=0)
            logger.info(f"[Batch Signals] Fetched {len(leads_data)} leads for org_id: {request.org_id}")
```

- [ ] **Step 7: Update v1 `/leads` route**

In `backend/app/routers/leads.py` (around line 20), replace:

```python
@router.get("", response_model=List[Dict[str, Any]])
def get_all_leads(org_id: str = Query(...), driver=Depends(get_neo4j_driver)):
    """Get all leads filtered by org_id (multitenant)."""
    return leads_service.get_leads_for_org(driver, org_id=org_id)
```

with:

```python
@router.get("", response_model=List[Dict[str, Any]])
def get_all_leads(
    response: Response,
    org_id: str = Query(...),
    driver=Depends(get_neo4j_driver),
):
    """**Deprecated:** use `GET /api/v2/leads` for the paginated envelope.

    Returns up to 500 leads (silent cap). The cap is new — prior to Phase G
    this endpoint returned all leads unbounded. Results are now returned in
    creation order (newest first) — previously the order was unspecified, as
    Cypher returns rows in arbitrary order without `ORDER BY`.
    """
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v2/leads>; rel="successor-version"'
    items, _ = leads_service.get_leads_for_org(driver, org_id=org_id)
    return items
```

- [ ] **Step 8: Update v1 `/leads/by-file` route**

In `backend/app/routers/leads.py` (around line 70), replace:

```python
@router.get("/by-file", response_model=List[Dict[str, Any]])
def get_leads_by_file(
    org_id: str = Query(...),
    file_id: str = Query(...),
    driver=Depends(get_neo4j_driver),
):
    """Fetch leads filtered by file_id within an org."""
    return leads_service.list_leads_by_file(driver, org_id, file_id)
```

with:

```python
@router.get("/by-file", response_model=List[Dict[str, Any]])
def get_leads_by_file(
    response: Response,
    org_id: str = Query(...),
    file_id: str = Query(...),
    driver=Depends(get_neo4j_driver),
):
    """**Deprecated:** use `GET /api/v2/leads/by-file` for the paginated envelope.

    Returns up to 500 leads (silent cap; previously unbounded). Results are now
    ordered by `created_at DESC` — previously had no ORDER BY at all.
    """
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v2/leads/by-file>; rel="successor-version"'
    items, _ = leads_service.list_leads_by_file(driver, org_id, file_id)
    return items
```

Add `Response` to the existing `fastapi` import line near the top of the file.

- [ ] **Step 9: Create v2 leads router**

Create `backend/app/routers/v2/leads.py`:

```python
from typing import Any, Dict

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_neo4j_driver
from app.models import PaginatedResponse
from app.services.leads import get_leads_for_org, list_leads_by_file

router = APIRouter(prefix="/leads", tags=["v2", "leads"])


@router.get("", response_model=PaginatedResponse[Dict[str, Any]])
def list_leads_v2(
    org_id: str = Query(...),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    driver=Depends(get_neo4j_driver),
):
    items, total = get_leads_for_org(driver, org_id, limit=limit, offset=offset)
    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/by-file", response_model=PaginatedResponse[Dict[str, Any]])
def list_leads_by_file_v2(
    org_id: str = Query(...),
    file_id: str = Query(...),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    driver=Depends(get_neo4j_driver),
):
    items, total = list_leads_by_file(driver, org_id, file_id, limit=limit, offset=offset)
    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)
```

- [ ] **Step 10: Mount v2 leads router in `app/main.py`**

```python
from app.routers.v2 import leads as leads_v2
# ...
app.include_router(leads_v2.router, prefix="/v2")
```

- [ ] **Step 11: Run v2 tests to verify they pass**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/test_leads_v2.py -v
```

Expected: 8 passed.

- [ ] **Step 12: Add deprecation-header assertions to existing v1 tests**

In `backend/tests/test_leads.py`:

For the existing happy-path test of `GET /leads`, append:

```python
    assert response.headers.get("Deprecation") == "true"
    assert 'rel="successor-version"' in response.headers.get("Link", "")
    assert "/api/v2/leads" in response.headers["Link"]
```

For the existing happy-path test of `GET /leads/by-file`, append:

```python
    assert response.headers.get("Deprecation") == "true"
    assert 'rel="successor-version"' in response.headers.get("Link", "")
    assert "/api/v2/leads/by-file" in response.headers["Link"]
```

- [ ] **Step 13: Add unit tests for the new service signature**

If `backend/tests/unit/test_leads.py` exists, append (otherwise create):

```python
from unittest.mock import MagicMock

from app.services.leads import get_leads_for_org


def test_get_leads_for_org_returns_items_and_total():
    session = MagicMock()
    driver = MagicMock()
    driver.session.return_value.__enter__.return_value = session
    session.run.side_effect = [
        [{"l": {"name": "Lead A"}}, {"l": {"name": "Lead B"}}],
        MagicMock(single=lambda: {"total": 7}),
    ]
    items, total = get_leads_for_org(driver, "org_1", limit=10, offset=0)
    assert len(items) == 2
    assert total == 7


def test_get_leads_for_org_default_limit_is_500():
    session = MagicMock()
    driver = MagicMock()
    driver.session.return_value.__enter__.return_value = session
    session.run.side_effect = [[], MagicMock(single=lambda: {"total": 0})]
    get_leads_for_org(driver, "org_1")
    first_call_kwargs = session.run.call_args_list[0].kwargs
    assert first_call_kwargs["limit"] == 500
    assert first_call_kwargs["offset"] == 0
```

- [ ] **Step 14: Update existing leads service tests**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -30
```

Fix any test that:
- Passed `order_by_recent=True` to `get_leads_for_org` (parameter removed).
- Expected `get_leads_for_org` to return a list directly (now returns a tuple).
- Expected `list_leads_by_file` to return a list directly (now returns a tuple).

Common pattern for fixes: change `result = get_leads_for_org(...)` to `result, _ = get_leads_for_org(...)`.

Re-run until green.

- [ ] **Step 15: Full-suite sanity check**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -3
```

Expected: 234 passed (224 + 8 v2 endpoint tests + 2 leads unit tests).

- [ ] **Step 16: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/leads.py \
        backend/app/services/market_scoring.py \
        backend/app/services/signals.py \
        backend/app/routers/leads.py \
        backend/app/routers/v2/leads.py \
        backend/app/main.py \
        backend/tests/test_leads_v2.py \
        backend/tests/test_leads.py \
        backend/tests/unit/test_leads.py
git commit -m "feat(be): add /v2/leads + /v2/leads/by-file paginated endpoints + drop order_by_recent [phase G, commit 7/8]"
```

---

## Task 8: Market_scoring internal helper bounding (commit 8 of 8)

**Goal:** Add explicit `limit`/`offset` parameters to `_get_latest_market_score_rows` and convert its return to `tuple[List[LeadMarketScoreRow], int]`. No HTTP surface change. Internal callers in `market_scoring.py` unpack the tuple.

**Note:** Task 7 has shifted line numbers in `market_scoring.py` (callers of `get_leads_for_org` near lines 393, 678 are now updated to drop `order_by_recent=True`). Re-verify caller locations and `_get_latest_market_score_rows` location with `grep -n '_get_latest_market_score_rows\|get_leads_for_org' backend/app/services/market_scoring.py` before editing.

**Files:**
- Modify: `backend/app/services/market_scoring.py` — update `_get_latest_market_score_rows` + internal callers
- Modify: `backend/tests/test_market_scoring.py` (if exists) or `backend/tests/unit/test_market_scoring.py` — update for new return signature, add pagination tests

- [ ] **Step 1: Write the failing tests**

In `backend/tests/unit/test_market_scoring.py` (create if it doesn't exist), append:

```python
from unittest.mock import MagicMock, patch

from app.services.market_scoring import _get_latest_market_score_rows


def test_get_latest_market_score_rows_returns_items_and_total(monkeypatch):
    """_get_latest_market_score_rows returns (items, total) with paginated query."""
    fake_docs = [
        {"lead_id": "L1", "org_id": "org_1", "updated_at": "2026-01-01",
         "company_name": "C1", "lead_name": "Lead1"},
        {"lead_id": "L2", "org_id": "org_1", "updated_at": "2026-01-02",
         "company_name": "C2", "lead_name": "Lead2"},
    ]
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = iter(fake_docs)
    score_coll = MagicMock()
    score_coll.find.return_value = fake_cursor
    score_coll.count_documents.return_value = 42

    with patch(
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, MagicMock()),
    ):
        rows, total = _get_latest_market_score_rows(
            driver=MagicMock(), mongo=MagicMock(), org_id="org_1",
        )
    assert len(rows) == 2
    assert total == 42


def test_get_latest_market_score_rows_default_limit_is_500():
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = iter([])
    score_coll = MagicMock()
    score_coll.find.return_value = fake_cursor
    score_coll.count_documents.return_value = 0

    with patch(
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, MagicMock()),
    ):
        _get_latest_market_score_rows(driver=MagicMock(), mongo=MagicMock(), org_id="org_1")
    fake_cursor.sort.return_value.skip.assert_called_with(0)
    fake_cursor.sort.return_value.skip.return_value.limit.assert_called_with(500)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/unit/test_market_scoring.py::test_get_latest_market_score_rows_returns_items_and_total \
       tests/unit/test_market_scoring.py::test_get_latest_market_score_rows_default_limit_is_500 -v
```

Expected: 2 failures — currently returns a list, not a tuple.

- [ ] **Step 3: Update `_get_latest_market_score_rows` signature and body**

In `backend/app/services/market_scoring.py`, replace:

```python
def _get_latest_market_score_rows(driver, mongo, org_id: str) -> List[LeadMarketScoreRow]:
    score_coll, _ = _get_market_score_collections(mongo)
    docs = list(score_coll.find({"org_id": org_id}).sort("updated_at", -1))
    rows: List[LeadMarketScoreRow] = []
    for doc in docs:
        # ... existing per-doc enrichment loop ...
        rows.append(_lead_to_score_row(doc))
    return rows
```

with:

```python
def _get_latest_market_score_rows(
    driver,
    mongo,
    org_id: str,
    limit: int = 500,
    offset: int = 0,
) -> tuple[List[LeadMarketScoreRow], int]:
    score_coll, _ = _get_market_score_collections(mongo)
    flt = {"org_id": org_id}
    total = score_coll.count_documents(flt)
    docs = list(
        score_coll.find(flt).sort("updated_at", -1).skip(offset).limit(limit)
    )
    rows: List[LeadMarketScoreRow] = []
    for doc in docs:
        doc.pop("_id", None)
        has_company_name = _normalize_non_empty_string(doc.get("company_name")) is not None
        has_lead_name = _normalize_non_empty_string(doc.get("lead_name")) is not None
        if not has_company_name or not has_lead_name:
            lead_identity = _get_lead_identity_from_neo4j(org_id=org_id, lead_id=str(doc.get("lead_id")))
            updates: Dict[str, Optional[str]] = {}
            if not has_company_name and lead_identity.get("company_name"):
                doc["company_name"] = lead_identity.get("company_name")
                updates["company_name"] = lead_identity.get("company_name")
            if not has_lead_name and lead_identity.get("lead_name"):
                doc["lead_name"] = lead_identity.get("lead_name")
                updates["lead_name"] = lead_identity.get("lead_name")
            if updates:
                score_coll.update_one(
                    {"org_id": org_id, "lead_id": str(doc.get("lead_id"))},
                    {"$set": updates},
                )
        rows.append(_lead_to_score_row(doc))
    return rows, total
```

- [ ] **Step 4: Update internal callers of `_get_latest_market_score_rows`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -n "_get_latest_market_score_rows" backend/app/services/market_scoring.py
```

For each callsite (except the function definition itself), change:

```python
rows = _get_latest_market_score_rows(driver, mongo, org_id)
```

to:

```python
rows, _ = _get_latest_market_score_rows(driver, mongo, org_id)
```

If a callsite needs the total (e.g., for a downstream display), use `rows, total = _get_latest_market_score_rows(...)`. Most callers just need the rows, so `_` is appropriate.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/unit/test_market_scoring.py -v
```

Expected: 2 new tests pass; any pre-existing tests in this file may need updates if they called `_get_latest_market_score_rows` expecting a list return.

- [ ] **Step 6: Update any pre-existing market_scoring tests for new return type**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -20
```

Fix tests that called `_get_latest_market_score_rows(...)` and expected a list. Same pattern as Task 7 Step 14.

- [ ] **Step 7: Full-suite sanity check**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend
pytest tests/ -q 2>&1 | tail -3
```

Expected: ~236 passed (234 + 2 new market_scoring tests). Acceptable rounding: anywhere in the 234-242 range, with the exact final count pinned in the next step.

- [ ] **Step 8: Pin the final test count**

Record the final pass count here: __________

If significantly different from ~242 (the spec's target), investigate before committing. A small variance (+/- 5) is acceptable; a large variance suggests something was missed.

- [ ] **Step 9: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/market_scoring.py \
        backend/tests/unit/test_market_scoring.py
git commit -m "refactor(be): bound _get_latest_market_score_rows with limit/offset [phase G, commit 8/8]"
```

---

## Final verification (no commit)

Confirm every spec §7.1 hard acceptance criterion before declaring Phase G complete.

- [ ] **Run all spec §7.1 grep checks**

```bash
cd /projects/Brewra/brewra-gtm-intelligence

# 1. PaginatedResponse model exists and is generic
git grep "class PaginatedResponse" backend/app/models/pagination.py
git grep "PaginatedResponse\[" backend/app/routers/v2/ | wc -l   # expected: 6+

# 2. v2 routes mounted for every target endpoint
git grep -E "router\.get\(.*PaginatedResponse" backend/app/routers/v2/ | wc -l   # expected: 6+
git grep "include_router.*v2.*prefix" backend/app/main.py | wc -l                # expected: 5

# 3. Every v1 list route emits the deprecation header
git grep -E "Deprecation.*=.*\"true\"" backend/app/routers/ | grep -v v2/ | wc -l   # expected: 6+
git grep -E "successor-version" backend/app/routers/ | grep -v v2/ | wc -l          # expected: 6+

# 4. No inline create_index calls in service hot paths
git grep -nE "\.create_index\(" backend/app/services/ | grep -v "_ensure_.*_indexes"   # expected: empty

# 5. Every paginated Cypher query has ORDER BY before SKIP/LIMIT
git grep -B3 -E "SKIP \$offset LIMIT \$limit" backend/app/services/ | grep -E "ORDER BY" | wc -l   # one per paginated query (2 in leads.py)

# 6. Lifespan calls all three _ensure_*_indexes helpers
git grep "_ensure_.*_indexes" backend/app/main.py | wc -l   # expected: 3 imports + 3 calls = 6

# 7. No v2 paths consumed by frontend yet (deliberate)
git grep -E "/api/v2/" frontend/src/   # expected: empty

# 8. Tests pass
cd backend && pytest tests/ -q 2>&1 | tail -3
```

- [ ] **Verify all 8 commits landed cleanly**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log master..HEAD --oneline   # expected: 8 commits, each with "[phase G, commit N/8]"
```

- [ ] **Bisectability spot-check (optional)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Test commit 1 in isolation
git checkout HEAD~7
cd backend && pytest tests/ -q 2>&1 | tail -3   # expected: 206 passed
git checkout refactor-backend-pagination-and-index-hygiene-phase-g
```

Each commit, checked out individually, should produce a green pytest run with the running totals listed in each task's "Full-suite sanity check" step.

- [ ] **Decide merge cadence**

Per the project's per-commit merge recommendation: merge each commit to `master` as it lands rather than batching. If batching is required, merge the whole branch in one fast-forward:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master
git merge --ff-only refactor-backend-pagination-and-index-hygiene-phase-g
git push origin master
git branch -d refactor-backend-pagination-and-index-hygiene-phase-g
```

- [ ] **Phase H carry-forward check**

The spec §8 lists items deferred to Phase H+:

- v1 route deletion (Phase H — trigger: FE has migrated all callsites)
- Security hardening (Phase H — trigger: launch gate)
- Codify lifespan-patch-target convention in AGENTS.md + audit Phase F's `_ensure_market_scoring_indexes` test (Phase H — see binding-semantics note in §5.5 of the spec)
- B4 dedup audit, `has_more` swap-in, sort-key convention, TD-004, Phase E review follow-ups, Anthropic SDK migration, tiktoken, Redis Claude budget, inline prompts → `app/prompts/`, shared `memory` audit (Phase I+)

No action this phase — confirmed.

---

## Self-review checklist

- [x] **Spec coverage:** Each §2.1 in-scope item maps to a task above (PaginatedResponse → Task 1; v2 routers → Tasks 3-7; service `limit`/`offset` → Tasks 3-8; internal-helper bounding → Task 8; index relocation → Task 2; v1 deprecation markers → Tasks 3-7; `list_icps` refresh-flag → Task 4; `fetch_signals` default → Task 5; tests → all tasks).
- [x] **No placeholders:** Every code block is concrete; no TBD, TODO, or "implement appropriate error handling". The one acknowledged judgment point (`UserDocumentEntry` import in Task 3 Step 6) names the fallback explicitly.
- [x] **Type consistency:** Service signatures use `tuple[list[X], int]` uniformly; the typed-return exceptions (`tuple[list[RegistrationResponse], int]` in Task 6, `tuple[List[LeadMarketScoreRow], int]` in Task 8) are called out in the spec §3.6 and reflected in the plan.
- [x] **Test counts trace:** 203 (baseline) → 206 (T1) → 208 (T2) → 212 (T3) → 216 (T4) → 220 (T5) → 224 (T6) → 234 (T7) → ~236 (T8). Final ~236-242 range, target ~242, exact count pinned in Task 8 Step 8.
- [x] **Commit message convention:** All 8 commits follow `<type>(be): <description> [phase G, commit N/8]` per spec §9.
- [x] **Index-rename atomicity:** Task 2 lands all seven sub-operations in one commit — splitting would break the import chain (customer_profile.py importing a non-existent function).
