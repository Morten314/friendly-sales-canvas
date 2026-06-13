# Apollo ICP-Discovery — Backend Implementation Plan (35a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ICP-driven Apollo lead discovery to the backend — search → free funnel → LLM re-rank → credited reveal → quality gate → ingest — plus warmup readiness, an ICP-completeness/master-key connect gate, reactive credit awareness, ICP-change detection, and keep/replace existing-lead management.

**Architecture:** Mirrors the existing `app/services/connectors/` enrich pipeline. New pure helpers live in `discovery.py` and `warmup.py`; the background orchestration (`start_apollo_discover` / `_run_discover`) lives in `orchestrator.py` alongside the enrich pair; run tracking extends `runs.py` (new `Connector_Discovery_Runs` collection); reveal reuses `normalize.py` + fill-only-empty `ingestion.py`. Endpoints extend `app/routers/connectors.py`.

**Tech Stack:** Python 3.12, FastAPI, `BackgroundTasks` (in-process), MongoDB (pymongo), Neo4j (bolt driver), LangChain `ChatGroq` (`llama-3.3-70b-versatile`) + the prompt registry (`app/core/prompts.py`), pytest (patch-where-used, fixture-mocked HTTP/Mongo/Neo4j).

**Scope:** Backend only. The frontend (tile, modals, source filter, data layer) is plan **35b**, written after this ships and its response shapes are verified against a running backend (`/docs` / `curl`), per the repo's backend-first rule.

**Spec:** `specs/35-apollo-discovery-design.md`. Read §3 (Apollo API facts) and §5 (backend design) before starting.

---

## Execution order & dependencies

Tasks are written in a readable order, **not** strict dependency order. Two tasks define names later tasks import — **run them early**:

- **Task 1 (exceptions)** and **Task 1b (models)** MUST run before Tasks 12–17 (which import `ApolloDiscoverRequest`, the extended `ApolloStatusResponse`, and the new exception classes). Task 1b is placed right after Task 1 for exactly this reason.

**Recommended order:** `1 → 1b → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 17 → 18 → 19`. (Task 16 is a pointer — the models moved to 1b.) Tasks 5 and 15 each carry several independent sub-parts; **commit each sub-part separately** (one logical commit per sub-part) for reviewability.

**Parallelizable (independent) set** for subagent-driven execution: `1, 1b, 2, 3, 4, 6, 7` touch disjoint files and can run concurrently; everything from Task 12 onward depends on the connector/service primitives and should serialize.

## Kill criteria (stop and escalate)

Halt and ask the human rather than guessing when:
- A task's tests still fail after **two** genuine implementation attempts.
- A stated assumption is false: the `fake_mongo` / `fake_driver` / `_FakeBT` / `patched` harness isn't present in the expected form; `ingestion._records_to_dicts` doesn't exist; the prompt registry doesn't discover `prompts/connectors/`; or the background task can't obtain the LLM via the threaded `llm` param.
- Apollo's live `api_search` param names (Task 19 Step 3) differ **materially** from `discovery.build_search_filters` (a rename is fine to apply; a structural mismatch — e.g. numeric tag-IDs required — is an escalate).

Report what failed, what you tried, and the smallest decision you need.

## Regression rule (every task that modifies an existing file)

After a task that **modifies** an existing module (`apollo.py`, `normalize.py`, `ingestion.py`, `runs.py`, `orchestrator.py`, `credentials.py`, `main.py`), run that file's **full existing test module** (not just the new tests) before committing — e.g. `RUNPY -m pytest backend/tests/unit/test_connectors_orchestrator.py -v`. A green new test plus a red pre-existing test is still a failed task. This catches silent regressions long before Task 19.

---

## File Structure

**New files:**
- `backend/app/services/connectors/discovery.py` — pure pipeline helpers: `build_search_filters`, `icp_fingerprint`, `passes_hard_dimensions`, `score_icp_fit`, `rerank_candidates`.
- `backend/app/services/connectors/warmup.py` — `icp_is_complete`, `get_active_icp`, the four milestone checks, `get_warmup_status`.
- `backend/prompts/connectors/apollo_discovery_rerank.md.j2` — the re-rank prompt.
- `backend/tests/unit/test_connectors_discovery.py`
- `backend/tests/unit/test_connectors_warmup.py`
- `backend/tests/unit/test_connectors_discovery_integration.py`

**Modified files:**
- `backend/app/core/exceptions.py` — 4 new connector HTTP exceptions.
- `backend/app/main.py` — one new exception handler; orphan-tag sweep on startup.
- `backend/app/services/connectors/apollo.py` — `search_people`, `match_person`.
- `backend/app/services/connectors/normalize.py` — add `email_status` to canonical set.
- `backend/app/services/connectors/ingestion.py` — discovery fields + superseded swap helpers + dedup-pool/export reads.
- `backend/app/services/connectors/runs.py` — discovery-run helpers + proportional stale threshold + index.
- `backend/app/services/connectors/orchestrator.py` — connect gate, discover start/run, status, export.
- `backend/app/models/connectors.py` — discover/warmup models; extend `ApolloStatusResponse`.
- `backend/app/routers/connectors.py` — new endpoints; extend connect/status.
- existing test files: `test_connectors_apollo.py`, `test_connectors_runs.py`, `test_connectors_ingestion.py`, `test_connectors_orchestrator.py`.

**Run all tests with the jag shell invocation** (per repo memory — repo `.venv` symlinks are broken for jag):
```bash
PYTHONPATH=backend/.venv/lib/python3.12/site-packages:$PWD /usr/bin/python3.12 -m pytest backend/tests/unit/<file> -v
```
Throughout this plan, `RUNPY` denotes that prefix: `RUNPY = PYTHONPATH=backend/.venv/lib/python3.12/site-packages:$PWD /usr/bin/python3.12`. Commit only the files you touched, by path (shared working tree — never `git add -A`).

---

### Task 1: New connector HTTP exceptions + handler

**Files:**
- Modify: `backend/app/core/exceptions.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/unit/test_connectors_exceptions.py` (create)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_connectors_exceptions.py
from app.core.exceptions import (
    ProfileIncompleteError, DiscoveryInProgressError,
    IcpUnderspecifiedError, MasterKeyRequiredError, ApolloSearchError, ApolloConnectorHTTPError,
)


def test_profile_incomplete_carries_section_and_409():
    e = ProfileIncompleteError(missing_section="industry")
    assert isinstance(e, ApolloConnectorHTTPError)
    assert e.status_code == 409
    assert e.code == "profile_incomplete"
    assert e.missing_section == "industry"


def test_status_codes_and_codes():
    assert (DiscoveryInProgressError().status_code, DiscoveryInProgressError().code) == (409, "discovery_in_progress")
    assert (IcpUnderspecifiedError().status_code, IcpUnderspecifiedError().code) == (422, "icp_underspecified")
    assert (MasterKeyRequiredError().status_code, MasterKeyRequiredError().code) == (403, "master_key_required")
    assert (ApolloSearchError().status_code, ApolloSearchError().code) == (502, "apollo_search_error")
```

- [ ] **Step 2: Run it, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_exceptions.py -v`
Expected: FAIL — `ImportError: cannot import name 'ProfileIncompleteError'`.

- [ ] **Step 3: Add the exception classes**

Append to `backend/app/core/exceptions.py` (after the existing connector exceptions, ~line 184). `BrewraError` is the package root error already defined in this file.

```python
class ApolloConnectorHTTPError(BrewraError):
    """Base for connector errors that map to a specific HTTP status + machine code.

    Carries a class-level `status_code` and `code`; the app-level handler
    serialises both (plus an optional `missing_section`) into the JSON body so
    the frontend can branch on `code` rather than parse `detail`.
    """
    status_code: int = 400
    code: str = "connector_error"


class ProfileIncompleteError(ApolloConnectorHTTPError):
    """Customer profile is not complete enough to connect/discover. -> 409."""
    status_code = 409
    code = "profile_incomplete"

    def __init__(self, missing_section: str, message: str = "Customer profile is incomplete."):
        super().__init__(message)
        self.missing_section = missing_section


class DiscoveryInProgressError(ApolloConnectorHTTPError):
    """A discovery run is already queued/processing for this org. -> 409."""
    status_code = 409
    code = "discovery_in_progress"


class IcpUnderspecifiedError(ApolloConnectorHTTPError):
    """The selected ICP lacks the hard dimensions needed for a bounded search. -> 422."""
    status_code = 422
    code = "icp_underspecified"


class MasterKeyRequiredError(ApolloConnectorHTTPError):
    """Apollo rejected the key for People Search (needs a master API key). -> 403."""
    status_code = 403
    code = "master_key_required"


class ApolloSearchError(ApolloConnectorHTTPError):
    """Search-specific transport failure surfaced synchronously (spec §5.10). -> 502.

    Note: the discovery *run* executes in a background task, so search failures there
    are recorded on the run doc (status `failed`), not surfaced as HTTP. This class is
    for any future synchronous search call and for spec parity; raise it from a sync
    `search_people` caller that wants a 502 rather than the generic ApolloAPIError (500).
    """
    status_code = 502
    code = "apollo_search_error"
```

- [ ] **Step 4: Register the handler**

In `backend/app/main.py`, alongside the existing `@app.exception_handler(...)` block (~lines 83–130), add:

```python
from app.core.exceptions import ApolloConnectorHTTPError  # add to the existing exceptions import group

@app.exception_handler(ApolloConnectorHTTPError)
def _handle_apollo_connector_http(request, exc: ApolloConnectorHTTPError):
    logger.debug("%s: %s", type(exc).__name__, exc)
    body = {"detail": str(exc), "code": exc.code}
    missing = getattr(exc, "missing_section", None)
    if missing is not None:
        body["missing_section"] = missing
    return JSONResponse(status_code=exc.status_code, content=body)
```

- [ ] **Step 5: Run the test, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_exceptions.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/core/exceptions.py backend/app/main.py backend/tests/unit/test_connectors_exceptions.py
git commit -m "feat(be): connector HTTP exceptions for discovery (409/422/403 + machine codes)"
```

---

### Task 1b: Models — discover/warmup + extend `ApolloStatusResponse`

> Moved ahead of the orchestrator tasks: Tasks 13–17 import `ApolloDiscoverRequest` and the extended `ApolloStatusResponse`, so the models must exist first (resolves the forward dependency).

**Files:**
- Modify: `backend/app/models/connectors.py`
- Test: `backend/tests/unit/test_connectors_models.py` (create)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_connectors_models.py
from app.models.connectors import (
    ApolloDiscoverRequest, ApolloDiscoverResponse, ApolloWarmupResponse, ApolloStatusResponse,
)


def test_discover_request_defaults():
    r = ApolloDiscoverRequest(org_id="o", user_id="u")
    assert r.mode == "keep" and r.icp_id is None and r.max_leads is None


def test_status_response_has_new_fields():
    s = ApolloStatusResponse(connected=True, status="connected", credits_consumed_total=0,
                             last_run_credits=0, low_credit=False, icp_changed_since_last_discovery=False)
    assert s.low_credit is False


def test_warmup_response_shape():
    w = ApolloWarmupResponse(icp_configured=True, signals_generated=False, scout_completed=True,
                             profiler_analyzed=True, ready_count=3, unlocked=False,
                             missing=[{"step": "signals_generated", "label": "Signals", "deep_link_hint": "signals"}])
    assert w.ready_count == 3
```

- [ ] **Step 2: Run, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_models.py -v`
Expected: FAIL — names not importable.

- [ ] **Step 3: Implement** (append to `app/models/connectors.py`; replace the existing `ApolloStatusResponse`). Ensure `from typing import Any, List, Optional, Literal` is present.

```python
class ApolloDiscoverRequest(BaseModel):
    org_id: str
    user_id: str
    icp_id: Optional[str] = None
    mode: Literal["keep", "replace"] = "keep"
    max_leads: Optional[int] = None


class ApolloDiscoverResponse(BaseModel):
    run_id: str
    status: str


class DiscoveryCounts(BaseModel):
    searched: int = 0
    qualified: int = 0
    selected: int = 0
    revealed: int = 0
    verified: int = 0
    unverified: int = 0
    created: int = 0
    matched: int = 0
    skipped_duplicates: int = 0
    errors: List[Dict[str, Any]] = []   # [{stage, message}] per spec §5.3


class ApolloDiscoverStatusResponse(BaseModel):
    run_id: str
    org_id: str
    status: str
    mode: str
    counts: DiscoveryCounts
    credits_consumed: int = 0
    progress_percent: float = 0.0
    icp_fingerprint: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    message: Optional[str] = None


class WarmupMissing(BaseModel):
    step: str
    label: str
    deep_link_hint: str


class ApolloWarmupResponse(BaseModel):
    icp_configured: bool
    signals_generated: bool
    scout_completed: bool
    profiler_analyzed: bool
    ready_count: int
    unlocked: bool
    missing: List[WarmupMissing] = []
```

Replace the existing `ApolloStatusResponse` with:
```python
class ApolloStatusResponse(BaseModel):
    connected: bool
    status: str
    connected_at: Optional[str] = None
    credits_consumed_total: int = 0
    last_run_credits: int = 0
    low_credit: bool = False
    last_discovery_at: Optional[str] = None
    last_discovery_icp_fingerprint: Optional[str] = None
    icp_changed_since_last_discovery: bool = False
```

(`Dict` is needed for `DiscoveryCounts` — ensure `from typing import Dict` too.)

- [ ] **Step 4: Run, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_models.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/connectors.py backend/tests/unit/test_connectors_models.py
git commit -m "feat(be): connector models for discover/warmup + extended status"
```

---

### Task 2: `ApolloConnector.search_people` (People Search)

**Files:**
- Modify: `backend/app/services/connectors/apollo.py`
- Test: `backend/tests/unit/test_connectors_apollo.py:` (append)

- [ ] **Step 1: Write the failing test**

```python
# append to backend/tests/unit/test_connectors_apollo.py
def test_search_people_posts_api_search_and_returns_page(monkeypatch):
    captured = {}

    def fake_http(method, url, **kwargs):
        captured["method"] = method
        captured["url"] = url
        captured["json"] = kwargs.get("json")
        return FakeResp(200, {
            "people": [{"id": "p1", "has_email": True, "title": "VP Sales"}],
            "pagination": {"page": 1, "per_page": 100, "total_pages": 3, "total_entries": 250},
        })

    monkeypatch.setattr(apollo_mod, "_http_request", fake_http)
    body = ApolloConnector("key").search_people({"person_titles": ["VP Sales"]}, page=1, per_page=100)

    assert captured["method"] == "POST"
    assert captured["url"].endswith("/mixed_people/api_search")
    assert captured["json"]["person_titles"] == ["VP Sales"]
    assert captured["json"]["page"] == 1 and captured["json"]["per_page"] == 100
    assert body["people"][0]["id"] == "p1"
    assert body["pagination"]["total_pages"] == 3
```

- [ ] **Step 2: Run it, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_apollo.py::test_search_people_posts_api_search_and_returns_page -v`
Expected: FAIL — `AttributeError: 'ApolloConnector' object has no attribute 'search_people'`.

- [ ] **Step 3: Implement `search_people`**

Add to the `ApolloConnector` class in `backend/app/services/connectors/apollo.py` (after `bulk_match`). `_request` already raises `ConnectorCredentialsInvalidError` on 401 and `ApolloAPIError` on 403 — exactly the master-key/auth signals we need.

```python
def search_people(
    self,
    filters: Dict[str, Any],
    *,
    page: int = 1,
    per_page: int = 100,
) -> Dict[str, Any]:
    """People Search via POST /mixed_people/api_search (credit-free, master key).

    `filters` are Apollo search params (person_titles, organization_num_employees_ranges,
    q_organization_keywords, person_locations, ...). Returns the raw page dict
    (`people` list + `pagination`). A 403 surfaces as ApolloAPIError — the caller
    (connect probe) translates that to "master key required".
    """
    payload = dict(filters)
    payload["page"] = page
    payload["per_page"] = min(per_page, 100)  # Apollo hard cap
    body = self._request("POST", "/mixed_people/api_search", json=payload)
    return body or {}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_apollo.py::test_search_people_posts_api_search_and_returns_page -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/connectors/apollo.py backend/tests/unit/test_connectors_apollo.py
git commit -m "feat(be): ApolloConnector.search_people (mixed_people/api_search)"
```

---

### Task 3: `ApolloConnector.match_person` (single reveal by id)

**Files:**
- Modify: `backend/app/services/connectors/apollo.py`
- Test: `backend/tests/unit/test_connectors_apollo.py:` (append)

- [ ] **Step 1: Write the failing test**

```python
# append to backend/tests/unit/test_connectors_apollo.py
def test_match_person_posts_people_match_with_reveal_flags(monkeypatch):
    captured = {}

    def fake_http(method, url, **kwargs):
        captured["url"] = url
        captured["json"] = kwargs.get("json")
        return FakeResp(200, {"person": {"id": "p1", "email": "a@x.com", "email_status": "verified"},
                              "credits_consumed": 1})

    monkeypatch.setattr(apollo_mod, "_http_request", fake_http)
    person, credits = ApolloConnector("key").match_person("p1")

    assert captured["url"].endswith("/people/match")
    assert captured["json"]["id"] == "p1"
    assert captured["json"]["reveal_personal_emails"] is True
    assert captured["json"]["reveal_phone_number"] is False
    assert person["email_status"] == "verified"
    assert credits == 1


def test_match_person_no_match_returns_none(monkeypatch):
    monkeypatch.setattr(apollo_mod, "_http_request", lambda *a, **k: FakeResp(200, {"person": None, "credits_consumed": 0}))
    person, credits = ApolloConnector("key").match_person("nope")
    assert person is None and credits == 0
```

- [ ] **Step 2: Run it, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_apollo.py -k match_person -v`
Expected: FAIL — no attribute `match_person`.

- [ ] **Step 3: Implement `match_person`**

Add to `ApolloConnector` (after `search_people`). Returns `(person|None, credits_consumed)`.

```python
def match_person(
    self,
    person_id: str,
    *,
    reveal_personal_emails: bool = True,
    reveal_phone_number: bool = False,
) -> Tuple[Optional[Dict[str, Any]], int]:
    """Reveal one person via POST /people/match keyed by Apollo id.

    Search ids do NOT work with /people/bulk_match (spec §3), so discovery reveals
    one at a time. Returns (person|None, credits_consumed). 402/422-credit raise
    ApolloCreditsExhaustedError inside _request.
    """
    body = self._request(
        "POST",
        "/people/match",
        json={
            "id": person_id,
            "reveal_personal_emails": reveal_personal_emails,
            "reveal_phone_number": reveal_phone_number,
        },
    )
    person = body.get("person") if isinstance(body, dict) else None
    credits = int(body.get("credits_consumed") or 0) if isinstance(body, dict) else 0
    return (person or None), credits
```

Ensure `Tuple` is imported at the top of `apollo.py` (`from typing import ..., Tuple`).

- [ ] **Step 4: Run the tests, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_apollo.py -k match_person -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/connectors/apollo.py backend/tests/unit/test_connectors_apollo.py
git commit -m "feat(be): ApolloConnector.match_person (single people/match reveal by id)"
```

---

### Task 4: `normalize.py` — add `email_status` to the canonical set

**Files:**
- Modify: `backend/app/services/connectors/normalize.py`
- Test: `backend/tests/unit/test_connectors_normalize.py:` (append; create if absent)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_connectors_normalize.py
from app.services.connectors.normalize import normalize_apollo_record, CANONICAL_FIELDS


def test_email_status_is_canonical_and_mapped():
    assert "email_status" in CANONICAL_FIELDS
    rec = normalize_apollo_record({"id": "p1", "email": "a@x.com", "email_status": "verified"})
    assert rec["email_status"] == "verified"


def test_email_status_absent_in_search_shape_is_none():
    # api_search shape has has_email but no email/email_status
    rec = normalize_apollo_record({"id": "p1", "has_email": True, "title": "VP"})
    assert rec["email_status"] is None
    assert rec["email"] is None
```

- [ ] **Step 2: Run it, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_normalize.py -v`
Expected: FAIL — `email_status` not in `CANONICAL_FIELDS`.

- [ ] **Step 3: Implement**

In `backend/app/services/connectors/normalize.py`, add `"email_status"` to `CANONICAL_FIELDS` (after `"email"`):

```python
CANONICAL_FIELDS: List[str] = [
    "name",
    "first_name",
    "last_name",
    "email",
    "email_status",
    "title",
    "seniority",
    "company_name",
    "company_domain",
    "phone",
    "linkedin_url",
    "location",
]
```

And in `normalize_apollo_record`, add the field to the record dict (after `"email": email,`):

```python
        "email": email,
        "email_status": raw.get("email_status"),
```

- [ ] **Step 4: Run the tests, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_normalize.py -v`
Expected: PASS.

> Note: adding `email_status` to `CANONICAL_FIELDS` automatically extends the fill-only-empty `_FILL_CLAUSE` in `ingestion.py` (it iterates `CANONICAL_FIELDS`), so revealed `email_status` hydrates empty slots without further change.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/connectors/normalize.py backend/tests/unit/test_connectors_normalize.py
git commit -m "feat(be): normalize email_status onto the canonical lead record"
```

---

### Task 5: `ingestion.py` — discovery fields, superseded swap, dedup-pool & export reads

**Files:**
- Modify: `backend/app/services/connectors/ingestion.py`
- Test: `backend/tests/unit/test_connectors_ingestion.py:` (append)

This task adds: (a) `apollo_origin` + `discovery_run_id` written on import-created leads; (b) superseded tag/clear/delete helpers; (c) a dedup-pool reader; (d) an export reader. These touch Neo4j, so the tests use the repo's existing Neo4j fake/fixture from `test_connectors_ingestion.py`. **The four sub-parts are independent — commit each as its own logical commit** (e.g. `(a)` separately from the `(b)/(c)/(d)` read+swap helpers) for reviewability and a smaller blast radius. `get_discovery_leads` calls `ingestion._records_to_dicts`, which **already exists** in `ingestion.py` (it backs `get_leads_by_ids`) — reuse it; if it's absent, stop (Kill criteria).

- [ ] **Step 1: Write the failing tests** (mirror the existing fake-driver style in this file)

```python
# append to backend/tests/unit/test_connectors_ingestion.py
from app.services.connectors import ingestion


def test_upsert_passes_origin_and_run_id(fake_driver):  # fake_driver fixture already in this file
    recs = [{"apollo_contact_id": "p1", "email": "a@x.com", "email_norm": "a@x.com",
             "company_domain_norm": "x.com", "company_domain": "x.com", "company_name": "X"}]
    ingestion.upsert_imported_leads(
        fake_driver, "org1", "u1", recs,
        file_id="f1", source="apollo", apollo_origin="discovery", discovery_run_id="run1",
    )
    params = fake_driver.last_create_params()  # helper on the fake; see existing tests
    assert params["apollo_origin"] == "discovery"
    assert params["discovery_run_id"] == "run1"


def test_existing_apollo_contact_ids_excludes_superseded(fake_driver):
    fake_driver.seed_leads([
        {"org_id": "org1", "apollo_contact_id": "p1", "superseded": None},
        {"org_id": "org1", "apollo_contact_id": "p2", "superseded": True},
    ])
    ids = ingestion.get_existing_apollo_contact_ids(fake_driver, "org1", include_superseded=False)
    assert ids == {"p1"}
```

> If `test_connectors_ingestion.py` does not already expose a `fake_driver` fixture with `last_create_params()`/`seed_leads()`, first read the file's existing Neo4j test harness and adapt these tests to its actual API (the harness exists because `upsert_imported_leads`/`enrich_fill_leads` are already tested). Keep the assertions; adjust only the fixture calls.

- [ ] **Step 2: Run it, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_ingestion.py -k "origin or superseded" -v`
Expected: FAIL — `upsert_imported_leads() got an unexpected keyword 'apollo_origin'`.

- [ ] **Step 3: Implement**

In `backend/app/services/connectors/ingestion.py`:

1. Extend the signature of `upsert_imported_leads`:

```python
def upsert_imported_leads(
    driver,
    org_id: str,
    user_id: str,
    records: List[Dict[str, Any]],
    *,
    file_id: str,
    source: str = "apollo",
    apollo_origin: Optional[str] = None,
    discovery_run_id: Optional[str] = None,
    chunk_size: int = 500,
) -> Dict[str, Any]:
```

Thread `apollo_origin` and `discovery_run_id` into the `_import_chunk_tx` call and its Cypher. In `_import_chunk_tx`, pass them as params and set them **only on create** (so a later re-import doesn't relabel), e.g. in the `ON CREATE`/create branch of the import Cypher:

```cypher
ON CREATE SET l.apollo_origin = $apollo_origin,
              l.discovery_run_id = $discovery_run_id
```

(For the update branch, use `coalesce(l.apollo_origin, $apollo_origin)` so an existing lead keeps its first origin.) Add `apollo_origin` and `discovery_run_id` to the `session.execute_write(_import_chunk_tx, ...)` argument list and the tx function params.

2. Add the superseded + read helpers at the bottom of the file:

```python
def tag_superseded_discovery_leads(driver, org_id: str) -> int:
    """Mark the org's current discovery leads `superseded` ahead of a replace swap."""
    with driver.session() as session:
        return session.execute_write(_set_superseded_tx, org_id, True)


def clear_superseded_discovery_leads(driver, org_id: str) -> int:
    """Un-tag superseded discovery leads (replace failed, or orphan-tag sweep)."""
    with driver.session() as session:
        return session.execute_write(_set_superseded_tx, org_id, False)


def delete_superseded_discovery_leads(driver, org_id: str) -> int:
    """Delete the superseded discovery leads after a successful replace commit."""
    with driver.session() as session:
        return session.execute_write(_delete_superseded_tx, org_id)


def get_existing_apollo_contact_ids(driver, org_id: str, *, include_superseded: bool = False) -> set:
    """Apollo person ids already in the pool — for pre-reveal dedup. Excludes
    superseded leads by default so a `replace` run can re-discover the same people."""
    with driver.session() as session:
        rows = session.execute_read(_existing_contact_ids_tx, org_id, include_superseded)
    return {r["cid"] for r in rows if r.get("cid")}


def get_discovery_leads(driver, org_id: str) -> List[Dict[str, Any]]:
    """All discovery-sourced leads for an org (for export)."""
    with driver.session() as session:
        rows = session.execute_read(_discovery_leads_tx, org_id)
    return _records_to_dicts(rows)
```

3. Add the tx functions (mirror the existing `_read_leads_by_ids_tx` style):

```python
def _set_superseded_tx(tx, org_id, value):
    res = tx.run(
        "MATCH (l:Lead {org_id: $org_id, source: 'apollo', apollo_origin: 'discovery'}) "
        "SET l.superseded = $value RETURN count(l) AS n",
        org_id=org_id, value=(True if value else None),
    )
    return res.single()["n"]


def _delete_superseded_tx(tx, org_id):
    res = tx.run(
        "MATCH (l:Lead {org_id: $org_id, source: 'apollo', apollo_origin: 'discovery'}) "
        "WHERE l.superseded = true DETACH DELETE l RETURN count(l) AS n",
        org_id=org_id,
    )
    return res.single()["n"]


def _existing_contact_ids_tx(tx, org_id, include_superseded):
    cypher = (
        "MATCH (l:Lead {org_id: $org_id}) "
        "WHERE l.apollo_contact_id IS NOT NULL "
        + ("" if include_superseded else "AND coalesce(l.superseded, false) = false ")
        + "RETURN l.apollo_contact_id AS cid"
    )
    return [r.data() for r in tx.run(cypher, org_id=org_id)]


def _discovery_leads_tx(tx, org_id):
    return list(tx.run(
        "MATCH (l:Lead {org_id: $org_id, source: 'apollo', apollo_origin: 'discovery'}) RETURN l",
        org_id=org_id,
    ))
```

> Setting `superseded = null` (not `false`) on clear keeps the property absent for non-replace leads, matching the `coalesce(l.superseded, false)` reads. If you instead store `false`, update the reads accordingly — pick one and keep it consistent.

> **Agent-view exclusion** (spec §5.7): lead-read queries in Scout/Profiler/Signals must filter `coalesce(l.superseded,false)=false`. Enumerating those read sites is **out of scope for 35a** and belongs in 35b/its own task — record it as a TODO in the commit body. (Discovery leads stay visible by default; the only consumer that must exclude superseded *now* is the dedup reader above.)

- [ ] **Step 4: Run the tests, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_ingestion.py -k "origin or superseded or contact_ids" -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/connectors/ingestion.py backend/tests/unit/test_connectors_ingestion.py
git commit -m "feat(be): ingestion discovery fields + superseded swap + dedup/export reads"
```

---

### Task 6: `runs.py` — discovery run lifecycle + proportional stale threshold + index

**Files:**
- Modify: `backend/app/services/connectors/runs.py`
- Test: `backend/tests/unit/test_connectors_runs.py:` (append)

- [ ] **Step 1: Write the failing test** (mirror the enrich-run tests; `fake_mongo` fixture already in this file)

```python
# append to backend/tests/unit/test_connectors_runs.py
from app.services.connectors import runs


def test_discovery_run_lifecycle(fake_mongo):
    rid = runs.create_discovery_run(fake_mongo, "org1", "u1", icp_id="i1",
                                    icp_fingerprint="abc", mode="keep", max_leads=50)
    runs.mark_discovery_processing(fake_mongo, rid)
    runs.complete_discovery_run(
        fake_mongo, rid,
        counts={"searched": 10, "qualified": 8, "selected": 5, "revealed": 5,
                "verified": 3, "unverified": 2, "created": 5, "matched": 0,
                "skipped_duplicates": 2, "errors": []},
        credits_consumed=5, status="completed",
    )
    doc = runs.get_discovery_run(fake_mongo, "org1", rid)
    assert doc["status"] == "completed"
    assert doc["counts"]["created"] == 5
    assert doc["credits_consumed"] == 5
    assert doc["progress_percent"] == 100.0


def test_discovery_stale_threshold_scales_with_max_leads():
    young = {"status": "processing", "max_leads": 200, "updated_at": runs._now()}
    assert runs._is_stale_discovery_run(young) is False
```

- [ ] **Step 2: Run it, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_runs.py -k discovery -v`
Expected: FAIL — `create_discovery_run` not defined.

- [ ] **Step 3: Implement**

In `backend/app/services/connectors/runs.py`, add the collection constant near the existing ones:

```python
DISCOVERY_RUNS_COLLECTION = "Connector_Discovery_Runs"
_DISCOVERY_STALE_BASE_SECONDS = 120
_DISCOVERY_STALE_PER_LEAD_SECONDS = 8
```

Add a collection accessor mirroring `_runs_coll`:

```python
def _discovery_coll(mongo):
    return mongo["Profiler"][DISCOVERY_RUNS_COLLECTION]
```

Add the lifecycle helpers (mirror the enrich-run helpers; `_now`, `_update_*` patterns):

```python
def create_discovery_run(mongo, org_id: str, user_id: str, *, icp_id: Optional[str],
                         icp_fingerprint: str, mode: str, max_leads: int) -> str:
    run_id = str(uuid.uuid4())
    now = _now()
    _discovery_coll(mongo).insert_one({
        "run_id": run_id, "org_id": org_id, "user_id": user_id,
        "icp_id": icp_id, "icp_fingerprint": icp_fingerprint,
        "mode": mode, "max_leads": max_leads,
        "status": "queued",
        "counts": {"searched": 0, "qualified": 0, "selected": 0, "revealed": 0,
                   "verified": 0, "unverified": 0, "created": 0, "matched": 0,
                   "skipped_duplicates": 0, "errors": []},
        "credits_consumed": 0,
        "created_at": now, "updated_at": now, "started_at": None, "finished_at": None,
        "message": None,
    })
    return run_id


def _update_discovery(mongo, run_id: str, **fields) -> None:
    fields["updated_at"] = _now()
    _discovery_coll(mongo).update_one({"run_id": run_id}, {"$set": fields})


def mark_discovery_processing(mongo, run_id: str) -> None:
    _update_discovery(mongo, run_id, status="processing", started_at=_now())


def update_discovery_progress(mongo, run_id: str, *, counts: Dict[str, Any], credits_consumed: int) -> None:
    counts = dict(counts)
    counts["errors"] = list(counts.get("errors", []))[:_MAX_ERRORS]
    _update_discovery(mongo, run_id, counts=counts, credits_consumed=credits_consumed)


def complete_discovery_run(mongo, run_id: str, *, counts: Dict[str, Any],
                           credits_consumed: int, status: str = "completed") -> None:
    counts = dict(counts)
    counts["errors"] = list(counts.get("errors", []))[:_MAX_ERRORS]
    _update_discovery(mongo, run_id, status=status, counts=counts,
                      credits_consumed=credits_consumed, finished_at=_now())


def fail_discovery_run(mongo, run_id: str, message: str) -> None:
    _update_discovery(mongo, run_id, status="failed",
                      message=message[:_MAX_ERROR_MESSAGE_LEN], finished_at=_now())


def get_discovery_run(mongo, org_id: str, run_id: Optional[str]) -> Dict[str, Any]:
    flt: Dict[str, Any] = {"org_id": org_id}
    if run_id:
        flt["run_id"] = run_id
    doc = _discovery_coll(mongo).find_one(flt, sort=[("created_at", -1)])
    if not doc:
        raise ConnectorEnrichRunNotFoundError("No discovery run found for org_id")
    doc.pop("_id", None)
    counts = doc.get("counts") or {}
    selected = int(counts.get("selected") or 0)
    revealed = int(counts.get("revealed") or 0)
    denom = max(selected, 1)
    doc["progress_percent"] = round(min(100.0, (revealed / denom) * 100.0), 2) \
        if str(doc.get("status")) in ("processing", "queued") else 100.0
    return doc


def latest_completed_discovery_run(mongo, org_id: str) -> Optional[Dict[str, Any]]:
    doc = _discovery_coll(mongo).find_one(
        {"org_id": org_id, "status": {"$in": ["completed", "completed_empty", "partial"]}},
        sort=[("finished_at", -1)],
    )
    if doc:
        doc.pop("_id", None)
    return doc


def sum_discovery_credits(mongo, org_id: str) -> int:
    total = 0
    for d in _discovery_coll(mongo).find({"org_id": org_id}, {"credits_consumed": 1}):
        total += int(d.get("credits_consumed") or 0)
    return total


def get_active_discovery_run(mongo, org_id: str) -> Optional[Dict[str, Any]]:
    return _discovery_coll(mongo).find_one(
        {"org_id": org_id, "status": {"$in": ["queued", "processing"]}},
        sort=[("created_at", -1)],
    )


def _is_stale_discovery_run(run_doc: Dict[str, Any]) -> bool:
    if str(run_doc.get("status", "")).lower() not in ("queued", "processing"):
        return False
    reference = (_parse_iso(run_doc.get("updated_at")) or _parse_iso(run_doc.get("started_at"))
                 or _parse_iso(run_doc.get("created_at")))
    if reference is None:
        return True
    window = _DISCOVERY_STALE_BASE_SECONDS + _DISCOVERY_STALE_PER_LEAD_SECONDS * int(run_doc.get("max_leads") or 50)
    return (datetime.now(timezone.utc) - reference).total_seconds() >= window


def fail_stale_discovery_runs(mongo, org_id: str) -> Optional[Dict[str, Any]]:
    """Fail a stale queued/processing discovery run; return it so the caller can
    clear any superseded tags it left. No-op when the active run is healthy."""
    active = get_active_discovery_run(mongo, org_id)
    if active and _is_stale_discovery_run(active):
        _update_discovery(mongo, active["run_id"], status="failed",
                          message="Run auto-failed: stale with no progress within the staleness window.",
                          finished_at=_now())
        logger.warning("Failed stale discovery run org_id=%s run_id=%s", org_id, active.get("run_id"))
        return active
    return None
```

Extend `_ensure_connectors_indexes` to add the discovery indexes:

```python
    discovery = mongo["Profiler"][DISCOVERY_RUNS_COLLECTION]
    discovery.create_index([("org_id", 1), ("status", 1)])
    discovery.create_index([("org_id", 1), ("created_at", -1)])
    discovery.create_index("run_id", unique=True)
```

Ensure `Dict`, `Any`, `Optional` are imported in `runs.py` (they are, per existing helpers).

- [ ] **Step 4: Run the tests, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_runs.py -k discovery -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/connectors/runs.py backend/tests/unit/test_connectors_runs.py
git commit -m "feat(be): discovery run lifecycle, proportional stale failover, indexes"
```

---

### Task 7: `warmup.py` — ICP completeness, active-ICP resolution, fingerprint inputs

**Files:**
- Create: `backend/app/services/connectors/warmup.py`
- Test: `backend/tests/unit/test_connectors_warmup.py` (create)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_connectors_warmup.py
from app.services.connectors import warmup


def _complete_icp():
    return {"id": "i1", "primary_region": "NA", "industry": ["SaaS"],
            "company_size": ["11-50"], "buyer_role": ["VP Sales"], "fit_confidence": "high",
            "created_at": "2026-06-01T00:00:00Z"}


def test_icp_is_complete_true():
    ok, missing = warmup.icp_is_complete(_complete_icp())
    assert ok is True and missing is None


def test_icp_is_complete_reports_first_missing_section():
    icp = _complete_icp(); icp["industry"] = []
    ok, missing = warmup.icp_is_complete(icp)
    assert ok is False and missing == "industry"


def test_get_active_icp_picks_by_id_then_most_recent(fake_mongo):
    fake_mongo["Profiler"]["Company_Profile"].insert_one({
        "profile_type": "company", "org_id": "org1",
        "customer_profiles": {"icps": [
            {"id": "old", "created_at": "2026-01-01T00:00:00Z", "industry": ["X"]},
            {"id": "new", "created_at": "2026-06-01T00:00:00Z", "industry": ["Y"]},
        ]},
    })
    assert warmup.get_active_icp(fake_mongo, "org1", "old")["id"] == "old"
    assert warmup.get_active_icp(fake_mongo, "org1", None)["id"] == "new"
```

(`fake_mongo` is the in-memory Mongo fake used across connector tests — reuse the existing fixture; if it lives in `conftest.py`, it's auto-available.)

- [ ] **Step 2: Run it, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_warmup.py -v`
Expected: FAIL — module `warmup` not found.

- [ ] **Step 3: Implement the file (completeness + active ICP)**

```python
# backend/app/services/connectors/warmup.py
"""Apollo warmup readiness + ICP helpers (spec §5.4, §5.5)."""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

# Required ICP fields in display order; the first empty one is the "missing section".
_REQUIRED_ICP_FIELDS: List[str] = [
    "primary_region", "industry", "company_size", "buyer_role", "fit_confidence",
]


def _is_filled(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, (list, str)):
        return len(value) > 0
    return True


def icp_is_complete(icp: Optional[Dict[str, Any]]) -> Tuple[bool, Optional[str]]:
    """True when every required ICP field is populated; else (False, first-missing)."""
    if not icp:
        return False, _REQUIRED_ICP_FIELDS[0]
    for field in _REQUIRED_ICP_FIELDS:
        if not _is_filled(icp.get(field)):
            return False, field
    return True, None


def _company_profile_doc(mongo, org_id: str) -> Dict[str, Any]:
    return mongo["Profiler"]["Company_Profile"].find_one(
        {"profile_type": "company", "org_id": org_id}
    ) or {}


def _icps_for_org(mongo, org_id: str) -> List[Dict[str, Any]]:
    doc = _company_profile_doc(mongo, org_id)
    cp = doc.get("customer_profiles") or {}
    icps = cp.get("icps") if isinstance(cp, dict) else None
    return [i for i in (icps or []) if isinstance(i, dict)]


def get_active_icp(mongo, org_id: str, icp_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Resolve the ICP to discover against: by id, else most-recently-created."""
    icps = _icps_for_org(mongo, org_id)
    if not icps:
        return None
    if icp_id:
        for icp in icps:
            if str(icp.get("id")) == str(icp_id):
                return icp
    return max(icps, key=lambda i: str(i.get("created_at") or ""))
```

- [ ] **Step 4: Run the tests, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_warmup.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/connectors/warmup.py backend/tests/unit/test_connectors_warmup.py
git commit -m "feat(be): warmup ICP completeness + active-ICP resolution"
```

---

### Task 8: `warmup.py` — four milestone checks + `get_warmup_status`

**Files:**
- Modify: `backend/app/services/connectors/warmup.py`
- Test: `backend/tests/unit/test_connectors_warmup.py:` (append)

- [ ] **Step 1: Write the failing test**

```python
# append to backend/tests/unit/test_connectors_warmup.py
def _seed_all(fake_mongo, org_id="org1", user_id="u1"):
    fake_mongo["Profiler"]["Company_Profile"].insert_one({
        "profile_type": "company", "org_id": org_id,
        "customer_profiles": {"icps": [_complete_icp()]}})
    fake_mongo["Signals"]["signals"].insert_one({"org_id": org_id, "id": "s1"})
    fake_mongo["Scout_Agent"]["Market_Intelligence"].insert_one({"org_id": org_id})
    fake_mongo["Profiler"]["ICP_config"].insert_one({"user_id": user_id, "icps": {"suggestedICPs": [1]}})


def test_warmup_all_four_unlock(fake_mongo):
    _seed_all(fake_mongo)
    out = warmup.get_warmup_status(fake_mongo, "org1", "u1")
    assert out["ready_count"] == 4 and out["unlocked"] is True and out["missing"] == []


def test_warmup_missing_signals(fake_mongo):
    _seed_all(fake_mongo)
    fake_mongo["Signals"]["signals"].delete_many({})
    out = warmup.get_warmup_status(fake_mongo, "org1", "u1")
    assert out["signals_generated"] is False and out["unlocked"] is False
    assert any(m["step"] == "signals_generated" for m in out["missing"])


def test_warmup_check_error_degrades_to_false(monkeypatch, fake_mongo):
    _seed_all(fake_mongo)
    def boom(*a, **k):
        raise RuntimeError("mongo down")
    monkeypatch.setattr(warmup, "_signals_generated", boom)
    out = warmup.get_warmup_status(fake_mongo, "org1", "u1")
    assert out["signals_generated"] is False  # degraded, no exception


def test_warmup_profiler_analyzed_false_when_suggested_icps_empty(fake_mongo):
    _seed_all(fake_mongo)
    # An ICP_config wrapper present but with an empty suggestedICPs must NOT count as analyzed.
    fake_mongo["Profiler"]["ICP_config"].delete_many({})
    fake_mongo["Profiler"]["ICP_config"].insert_one({"user_id": "u1", "icps": {"suggestedICPs": []}})
    out = warmup.get_warmup_status(fake_mongo, "org1", "u1")
    assert out["profiler_analyzed"] is False and out["unlocked"] is False
```

- [ ] **Step 2: Run it, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_warmup.py -k warmup_ -v`
Expected: FAIL — `get_warmup_status` not defined.

- [ ] **Step 3: Implement**

Append to `backend/app/services/connectors/warmup.py`:

```python
_MILESTONES = [
    ("icp_configured", "ICP — fully configured", "icp"),
    ("signals_generated", "Signals — first run", "signals"),
    ("scout_completed", "Scout — first market research", "scout"),
    ("profiler_analyzed", "Profiler — initial ICP analysis", "profiler"),
]


def _icp_configured(mongo, org_id: str, user_id: str) -> bool:
    for icp in _icps_for_org(mongo, org_id):
        if icp_is_complete(icp)[0]:
            return True
    return False


def _signals_generated(mongo, org_id: str, user_id: str) -> bool:
    return mongo["Signals"]["signals"].find_one({"org_id": org_id}) is not None


def _scout_completed(mongo, org_id: str, user_id: str) -> bool:
    return mongo["Scout_Agent"]["Market_Intelligence"].find_one({"org_id": org_id}) is not None


def _profiler_analyzed(mongo, org_id: str, user_id: str) -> bool:
    doc = mongo["Profiler"]["ICP_config"].find_one({"user_id": user_id})
    if not doc:
        return False
    icps = doc.get("icps")
    # ICP_config stores `icps` as `{"suggestedICPs": [...]}`. A truthy-but-empty wrapper
    # ({"suggestedICPs": []}) must NOT count as analyzed, so inspect the nested list.
    if isinstance(icps, dict):
        return bool(icps.get("suggestedICPs"))
    return bool(icps)  # tolerate a bare-list shape


_CHECK_FNS = {
    "icp_configured": _icp_configured,
    "signals_generated": _signals_generated,
    "scout_completed": _scout_completed,
    "profiler_analyzed": _profiler_analyzed,
}


def get_warmup_status(mongo, org_id: str, user_id: str) -> Dict[str, Any]:
    """Fan across the four stores via the single Mongo client. Each check is
    wrapped: a query error degrades that milestone to False (never raises)."""
    import logging
    logger = logging.getLogger(__name__)
    result: Dict[str, Any] = {}
    missing: List[Dict[str, str]] = []
    ready = 0
    for key, label, hint in _MILESTONES:
        try:
            ok = bool(_CHECK_FNS[key](mongo, org_id, user_id))
        except Exception as e:  # noqa: BLE001 — degrade, don't 500 the whole signal
            logger.warning("warmup check %s failed (org_id=%s): %s", key, org_id, e)
            ok = False
        result[key] = ok
        if ok:
            ready += 1
        else:
            missing.append({"step": key, "label": label, "deep_link_hint": hint})
    result["ready_count"] = ready
    result["unlocked"] = ready == 4
    result["missing"] = missing
    return result
```

- [ ] **Step 4: Run the tests, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_warmup.py -k warmup_ -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/connectors/warmup.py backend/tests/unit/test_connectors_warmup.py
git commit -m "feat(be): warmup four-milestone readiness with per-check degradation"
```

---

### Task 9: `discovery.py` — `build_search_filters` + `icp_fingerprint`

**Files:**
- Create: `backend/app/services/connectors/discovery.py`
- Test: `backend/tests/unit/test_connectors_discovery.py` (create)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_connectors_discovery.py
import pytest
from app.services.connectors import discovery
from app.core.exceptions import IcpUnderspecifiedError


def _icp():
    return {"id": "i1", "primary_region": "NA", "industry": ["SaaS", "Fintech"],
            "company_size": ["11-50", "51-200"], "buyer_role": ["VP Sales", "Head of Growth"],
            "fit_confidence": "high", "location": ["United States"]}


def test_build_search_filters_maps_icp_to_api_search_params():
    f = discovery.build_search_filters(_icp())
    assert f["person_titles"] == ["VP Sales", "Head of Growth"]
    assert f["organization_num_employees_ranges"] == ["11-50", "51-200"]
    assert f["q_organization_keywords"] == "SaaS Fintech"   # keyword match, not tag ids
    assert f["person_locations"] == ["United States"]
    assert "organization_industry_tag_ids" not in f


def test_build_search_filters_rejects_underspecified_icp():
    with pytest.raises(IcpUnderspecifiedError):
        discovery.build_search_filters({"primary_region": "NA"})


def test_icp_fingerprint_is_stable_and_change_sensitive():
    a = discovery.icp_fingerprint(_icp())
    b = discovery.icp_fingerprint(dict(_icp()))  # re-serialised, same semantics
    icp2 = _icp(); icp2["industry"] = ["SaaS"]
    c = discovery.icp_fingerprint(icp2)
    assert a == b and a != c
    # volatile fields don't change the fingerprint
    icp3 = _icp(); icp3["created_at"] = "whenever"; icp3["status"] = "draft"
    assert discovery.icp_fingerprint(icp3) == a
```

- [ ] **Step 2: Run it, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_discovery.py -k "filters or fingerprint" -v`
Expected: FAIL — module `discovery` not found.

- [ ] **Step 3: Implement**

```python
# backend/app/services/connectors/discovery.py
"""Apollo ICP-discovery pipeline helpers (spec §5.2). Pure functions; no I/O
except the LLM call in rerank_candidates."""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict, List, Optional

from app.core.exceptions import IcpUnderspecifiedError
from app.services.connectors.warmup import icp_is_complete

logger = logging.getLogger(__name__)

# Fields that define an ICP's identity for change detection (spec §5.7).
_FINGERPRINT_FIELDS = [
    "primary_region", "industry", "company_size", "buyer_role",
    "fit_confidence", "location", "additional_context",
]


def _canon(value: Any) -> Any:
    if isinstance(value, list):
        return sorted(str(v).strip().lower() for v in value if v is not None)
    if isinstance(value, str):
        return value.strip().lower()
    return value


def icp_fingerprint(icp: Dict[str, Any]) -> str:
    """SHA-1 of canonical JSON over the semantic fields (volatile fields excluded).

    SHA-1 here is a plain (non-security) hash: the fingerprint is persisted on the run
    doc and surfaced via /status, so a compact stable key beats storing/re-serialising
    the full normalized JSON on every comparison.
    """
    canon = {f: _canon(icp.get(f)) for f in _FINGERPRINT_FIELDS}
    blob = json.dumps(canon, sort_keys=True, default=str)
    return hashlib.sha1(blob.encode("utf-8")).hexdigest()


def build_search_filters(icp: Dict[str, Any]) -> Dict[str, Any]:
    """Map a complete ICP to Apollo api_search params. Raises IcpUnderspecifiedError
    if the ICP fails the completeness bar (avoids an unbounded, credit-burning search).

    Industry maps to q_organization_keywords (keyword match on names) — NOT
    organization_industry_tag_ids, which needs a numeric tag-ID table we don't have
    (spec §5.2). The step-3 funnel drops industry mismatches the keyword filter lets through.
    """
    ok, missing = icp_is_complete(icp)
    if not ok:
        raise IcpUnderspecifiedError(f"ICP is missing '{missing}' — too underspecified for discovery.")
    # NB: buyer_role maps to person_titles only — NOT person_seniorities. Apollo's
    # person_seniorities filter expects enum values (c_suite/vp/director/manager/...),
    # whereas buyer_role is free text ("VP Sales"); free text sent as a seniority is
    # silently ignored. Mapping common roles -> seniority enums is a future enhancement
    # (this is a deliberate, documented divergence from spec §5.2's "person_seniorities").
    filters: Dict[str, Any] = {
        "person_titles": list(icp.get("buyer_role") or []),
        "organization_num_employees_ranges": list(icp.get("company_size") or []),
        "q_organization_keywords": " ".join(str(i) for i in (icp.get("industry") or [])),
    }
    locations = list(icp.get("location") or [])
    if not locations and icp.get("primary_region"):
        locations = [icp["primary_region"]]
    if locations:
        filters["person_locations"] = locations
    return filters
```

> The exact Apollo param **names** above are confirmed against live `/docs` during integration (spec open item). If a name differs, change it here only — the funnel + tests are name-agnostic except this function.

- [ ] **Step 4: Run the tests, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_discovery.py -k "filters or fingerprint" -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/connectors/discovery.py backend/tests/unit/test_connectors_discovery.py
git commit -m "feat(be): discovery build_search_filters + icp_fingerprint"
```

---

### Task 10: `discovery.py` — free funnel (`passes_hard_dimensions`, `score_icp_fit`)

**Files:**
- Modify: `backend/app/services/connectors/discovery.py`
- Test: `backend/tests/unit/test_connectors_discovery.py:` (append)

- [ ] **Step 1: Write the failing test**

```python
# append to backend/tests/unit/test_connectors_discovery.py
def _cand(**kw):
    base = {"id": "p1", "has_email": True, "title": "VP Sales",
            "organization": {"industry": "SaaS", "estimated_num_employees": 80}}
    base.update(kw)
    return base


def test_passes_hard_dimensions_true_for_in_icp_candidate():
    assert discovery.passes_hard_dimensions(_cand(), _icp()) is True


def test_zero_overlap_title_drops_candidate():
    assert discovery.passes_hard_dimensions(_cand(title="Warehouse Operative"), _icp()) is False


def test_no_has_email_is_not_a_hard_dimension_here():
    # has_email filtering happens in the funnel orchestration, not in this fn
    assert discovery.passes_hard_dimensions(_cand(has_email=False), _icp()) is True


def test_score_icp_fit_orders_better_matches_higher():
    strong = discovery.score_icp_fit(_cand(), _icp())
    weak = discovery.score_icp_fit(_cand(organization={"industry": "Mining", "estimated_num_employees": 5}), _icp())
    assert strong > weak
```

- [ ] **Step 2: Run it, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_discovery.py -k "hard_dimensions or icp_fit or has_email" -v`
Expected: FAIL — `passes_hard_dimensions` not defined.

- [ ] **Step 3: Implement**

Append to `discovery.py`:

```python
# company_size buckets are Apollo-style "min-max" strings; map to a numeric range.
def _size_range(bucket: str):
    bucket = str(bucket).replace(",", "").strip()
    if "-" in bucket:
        lo, _, hi = bucket.partition("-")
        try:
            return int(lo), (int(hi) if hi.strip() else 10 ** 9)
        except ValueError:
            return None
    if bucket.endswith("+"):
        try:
            return int(bucket[:-1]), 10 ** 9
        except ValueError:
            return None
    return None


def _norm_set(values) -> set:
    return {str(v).strip().lower() for v in (values or []) if v}


def passes_hard_dimensions(candidate: Dict[str, Any], icp: Dict[str, Any]) -> bool:
    """Drop only on ZERO overlap against a hard ICP dimension (spec §5.2 step 3):
    title/seniority vs buyer_role, org industry vs industry[], org size vs company_size[].
    A dimension that's absent on the candidate is not a drop (Apollo data is sparse)."""
    org = candidate.get("organization") or {}

    roles = _norm_set(icp.get("buyer_role"))
    title = str(candidate.get("title") or "").strip().lower()
    seniority = str(candidate.get("seniority") or "").strip().lower()
    if roles and (title or seniority):
        if not any(r in title or r in seniority or title in r for r in roles):
            return False

    industries = _norm_set(icp.get("industry"))
    cand_industry = str(org.get("industry") or "").strip().lower()
    if industries and cand_industry:
        if not any(i in cand_industry or cand_industry in i for i in industries):
            return False

    emp = org.get("estimated_num_employees")
    size_buckets = [r for r in (_size_range(b) for b in (icp.get("company_size") or [])) if r]
    if size_buckets and isinstance(emp, (int, float)):
        if not any(lo <= emp <= hi for lo, hi in size_buckets):
            return False

    return True


def score_icp_fit(candidate: Dict[str, Any], icp: Dict[str, Any]) -> float:
    """Cheap deterministic fit score in [0,1] for ranking the funnel survivors
    (and the LLM-rerank fallback). Weighted: title 0.35, industry 0.35, size 0.15, geo 0.15
    (spec §5.2 step 3 lists geo as a scoring component alongside title/industry/size)."""
    org = candidate.get("organization") or {}
    score = 0.0

    roles = _norm_set(icp.get("buyer_role"))
    title = str(candidate.get("title") or "").strip().lower()
    if roles and title and any(r in title or title in r for r in roles):
        score += 0.35

    industries = _norm_set(icp.get("industry"))
    cand_industry = str(org.get("industry") or "").strip().lower()
    if industries and cand_industry and any(i in cand_industry or cand_industry in i for i in industries):
        score += 0.35

    emp = org.get("estimated_num_employees")
    size_buckets = [r for r in (_size_range(b) for b in (icp.get("company_size") or [])) if r]
    if size_buckets and isinstance(emp, (int, float)) and any(lo <= emp <= hi for lo, hi in size_buckets):
        score += 0.15

    icp_locs = _norm_set(list(icp.get("location") or [])
                         + ([icp["primary_region"]] if icp.get("primary_region") else []))
    cand_loc = " ".join(str(candidate.get(k) or "")
                        for k in ("country", "state", "city", "present_raw_address")).strip().lower()
    if icp_locs and cand_loc and any(loc in cand_loc for loc in icp_locs):
        score += 0.15

    return round(score, 3)
```

- [ ] **Step 4: Run the tests, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_discovery.py -k "hard_dimensions or icp_fit or has_email" -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/connectors/discovery.py backend/tests/unit/test_connectors_discovery.py
git commit -m "feat(be): discovery free funnel (hard-dimension drop + fit score)"
```

---

### Task 11: re-rank prompt + `rerank_candidates` (LLM with deterministic fallback)

**Files:**
- Create: `backend/prompts/connectors/apollo_discovery_rerank.md.j2`
- Modify: `backend/app/services/connectors/discovery.py`
- Test: `backend/tests/unit/test_connectors_discovery.py:` (append)

- [ ] **Step 1: Author the prompt file**

First open an existing prompt to copy the exact frontmatter convention:
Run: `RUNPY -c "import pathlib; print(pathlib.Path('backend/prompts/signals').glob('*.j2').__next__().read_text()[:400])"`

Then create `backend/prompts/connectors/apollo_discovery_rerank.md.j2` mirroring that frontmatter (version + declared inputs `icp` and `candidates`), with this body:

```jinja
You are ranking sales prospects by fit to an Ideal Customer Profile (ICP).

ICP:
- Buyer roles: {{ icp.buyer_role }}
- Industries: {{ icp.industry }}
- Company sizes: {{ icp.company_size }}
- Region: {{ icp.primary_region }}

Candidates (id, title, company industry, company size):
{{ candidates }}

Return ONLY a JSON array of candidate ids, best fit first, no commentary.
Example: ["p1","p2","p3"]
```

- [ ] **Step 2: Write the failing test**

```python
# append to backend/tests/unit/test_connectors_discovery.py
class _FakeLLM:
    def __init__(self, content):
        self._content = content
    def invoke(self, _prompt):
        class R: pass
        r = R(); r.content = self._content; return r


def test_rerank_uses_llm_order_then_caps(monkeypatch):
    monkeypatch.setattr(discovery, "_render_rerank_prompt", lambda icp, cands: "PROMPT")
    cands = [_cand(id="p1"), _cand(id="p2"), _cand(id="p3")]
    out = discovery.rerank_candidates(_FakeLLM('["p3","p1","p2"]'), cands, _icp(), max_leads=2)
    assert [c["id"] for c in out] == ["p3", "p1"]


def test_rerank_falls_back_to_fit_score_on_llm_error(monkeypatch):
    monkeypatch.setattr(discovery, "_render_rerank_prompt", lambda icp, cands: "PROMPT")
    class _Boom:
        def invoke(self, _): raise RuntimeError("llm down")
    cands = [_cand(id="weak", organization={"industry": "Mining", "estimated_num_employees": 5}),
             _cand(id="strong")]
    out = discovery.rerank_candidates(_Boom(), cands, _icp(), max_leads=2)
    assert out[0]["id"] == "strong"  # deterministic fit-score fallback
```

- [ ] **Step 3: Run it, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_discovery.py -k rerank -v`
Expected: FAIL — `rerank_candidates` not defined.

- [ ] **Step 4: Implement**

Append to `discovery.py`:

```python
def _render_rerank_prompt(icp: Dict[str, Any], candidates: List[Dict[str, Any]]) -> str:
    """Render the re-rank prompt via the registry. Isolated so tests can patch it."""
    from app.core import prompts as prompt_registry
    compact = [
        {"id": c.get("id"),
         "title": c.get("title"),
         "industry": (c.get("organization") or {}).get("industry"),
         "size": (c.get("organization") or {}).get("estimated_num_employees")}
        for c in candidates
    ]
    return prompt_registry.render(
        "apollo_discovery_rerank", icp=icp, candidates=json.dumps(compact),
    ).body


def _fit_fallback(candidates: List[Dict[str, Any]], icp: Dict[str, Any], max_leads: int) -> List[Dict[str, Any]]:
    return sorted(candidates, key=lambda c: score_icp_fit(c, icp), reverse=True)[:max_leads]


def rerank_candidates(llm, candidates: List[Dict[str, Any]], icp: Dict[str, Any],
                      *, max_leads: int) -> List[Dict[str, Any]]:
    """Pick the top `max_leads` candidates to reveal. Uses the LLM to order them by
    ICP fit; on ANY LLM/parse failure, degrades deterministically to score_icp_fit
    (spec §5.2 step 4). Never raises."""
    if len(candidates) <= max_leads:
        return list(candidates)
    by_id = {str(c.get("id")): c for c in candidates}
    try:
        prompt = _render_rerank_prompt(icp, candidates)
        raw = llm.invoke(prompt)
        content = getattr(raw, "content", raw)
        order = json.loads(content if isinstance(content, str) else str(content))
        ranked = [by_id[str(i)] for i in order if str(i) in by_id]
        # Append any candidate the LLM omitted, fit-ordered, then cap.
        seen = {str(c.get("id")) for c in ranked}
        ranked.extend(c for c in _fit_fallback(candidates, icp, len(candidates)) if str(c.get("id")) not in seen)
        return ranked[:max_leads]
    except Exception as e:  # noqa: BLE001
        logger.warning("LLM re-rank failed; using deterministic fit fallback: %s", e)
        return _fit_fallback(candidates, icp, max_leads)
```

- [ ] **Step 5: Run the tests, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_discovery.py -k rerank -v`
Expected: PASS. If `prompt_registry.render` raises "unknown prompt" in a non-fallback test, confirm the prompt file's frontmatter matches the sibling convention from Step 1 and that `init_registry()` discovers `prompts/connectors/` (add a one-line registry test: `render("apollo_discovery_rerank", icp={}, candidates="[]")` after `init_registry()`).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/connectors/discovery.py backend/prompts/connectors/apollo_discovery_rerank.md.j2 backend/tests/unit/test_connectors_discovery.py
git commit -m "feat(be): LLM re-rank with deterministic fit fallback + prompt"
```

---

### Task 12: `orchestrator.py` — extend `connect_apollo` (ICP gate + master-key probe)

**Files:**
- Modify: `backend/app/services/connectors/orchestrator.py`
- Test: `backend/tests/unit/test_connectors_orchestrator.py:` (append)

- [ ] **Step 1: Write the failing test**

```python
# append to backend/tests/unit/test_connectors_orchestrator.py
from app.core.exceptions import ProfileIncompleteError, MasterKeyRequiredError, ApolloAPIError
from app.services.connectors import orchestrator
from app.models.connectors import ApolloConnectRequest


def test_connect_blocks_when_profile_incomplete(monkeypatch, patched, fake_mongo):
    monkeypatch.setattr(orchestrator.warmup, "_icps_for_org", lambda m, o: [])  # no complete ICP
    with pytest.raises(ProfileIncompleteError):
        orchestrator.connect_apollo(fake_mongo, ApolloConnectRequest(org_id="org1", user_id="u1", api_key="good"))


def test_connect_probe_403_is_master_key_required(monkeypatch, fake_mongo):
    monkeypatch.setattr(orchestrator.warmup, "_icps_for_org", lambda m, o: [_complete_icp_dict()])
    class _Probe:
        def __init__(self, *a, **k): pass
        def search_people(self, *a, **k): raise ApolloAPIError("403 Forbidden")
    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _Probe)
    with pytest.raises(MasterKeyRequiredError):
        orchestrator.connect_apollo(fake_mongo, ApolloConnectRequest(org_id="org1", user_id="u1", api_key="regular"))
```

> **Test-helper note (applies to Tasks 12–15):** `_FakeBT`, the `patched` fixture, the `apollo_mod` alias, and `fake_mongo` **already exist** at the top of `test_connectors_orchestrator.py` (used by the existing connect/enrich/import tests) — reuse them, do **not** redefine. `_complete_icp_dict()` does **not** exist yet; add this module-level helper once near the top of the file:
> ```python
> def _complete_icp_dict():
>     return {"id": "i1", "primary_region": "NA", "industry": ["SaaS"],
>             "company_size": ["11-50"], "buyer_role": ["VP Sales"], "fit_confidence": "high",
>             "created_at": "2026-06-01T00:00:00Z"}
> ```
> (If any of the pre-existing fixtures are absent in the expected form, stop — see Kill criteria.)

- [ ] **Step 2: Run it, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_orchestrator.py -k "connect_blocks or master_key" -v`
Expected: FAIL — current `connect_apollo` does neither check.

- [ ] **Step 3: Implement**

In `orchestrator.py`, add imports:
```python
from app.services.connectors import warmup
from app.services.connectors import discovery
from app.core.exceptions import (
    ProfileIncompleteError, MasterKeyRequiredError, DiscoveryInProgressError,
    ApolloAPIError, ConnectorCredentialsInvalidError, ConnectorNotConnectedError, BrewraError,
)
```
This is an **additive** import edit — do not replace the existing import block. Verified against the current source: `orchestrator.py` **already imports** `ApolloCreditsExhaustedError` (from `app.core.exceptions`) and `normalize_apollo_record` (from `app.services.connectors.normalize`, used as a bare name by `_run_import`/`_run_enrich`), and already defines `INGEST_CHUNK_SIZE`; `runs.py` already defines `_MAX_ERRORS`, `_MAX_ERROR_MESSAGE_LEN`, `_parse_iso`, `_now`. `_run_discover` (Task 14) reuses all of these by their existing names — **preserve them, do not re-import or redefine**, and de-dupe any line this snippet repeats.

Replace `connect_apollo` with the gated version (mirror the existing connect, which validates + saves):

```python
def connect_apollo(mongo, request: ApolloConnectRequest) -> Dict[str, Any]:
    # Check 1 — profile completeness (UC6). Reuses the warmup ICP logic.
    if not any(warmup.icp_is_complete(icp)[0] for icp in warmup._icps_for_org(mongo, request.org_id)):
        # report the first missing section of the most-recent ICP (or the first required field)
        icps = warmup._icps_for_org(mongo, request.org_id)
        missing = warmup.icp_is_complete(icps[-1] if icps else None)[1] or "icp"
        raise ProfileIncompleteError(missing_section=missing)

    # Check 2 — master-key + search capability via a free 1-record api_search probe.
    connector = apollo_mod.ApolloConnector(request.api_key)
    try:
        connector.search_people({}, page=1, per_page=1)
    except ApolloAPIError as e:
        # _request raises ApolloAPIError on 403 (insufficient plan / not a master key)
        raise MasterKeyRequiredError(str(e))
    # 401 -> ConnectorCredentialsInvalidError propagates (handled -> 400 "Invalid key")

    credentials.save_credentials(mongo, request.org_id, "apollo", request.api_key, status="connected")
    return {"connected": True, "status": "connected"}
```

- [ ] **Step 4: Run the tests, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_orchestrator.py -k "connect" -v`
Expected: PASS (including the existing connect tests — if an existing connect test now fails because it lacks a complete ICP, update that fixture to seed one).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/connectors/orchestrator.py backend/tests/unit/test_connectors_orchestrator.py
git commit -m "feat(be): connect gate — ICP completeness (409) + master-key probe (403)"
```

---

### Task 13: `orchestrator.py` — `start_apollo_discover` (single-flight + 422)

**Files:**
- Modify: `backend/app/services/connectors/orchestrator.py`
- Test: `backend/tests/unit/test_connectors_orchestrator.py:` (append)

- [ ] **Step 1: Write the failing test**

```python
# append to backend/tests/unit/test_connectors_orchestrator.py
from app.core.exceptions import DiscoveryInProgressError, IcpUnderspecifiedError
from app.models.connectors import ApolloDiscoverRequest


def test_start_discover_queues_and_returns_run_id(monkeypatch, fake_mongo):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.warmup, "get_active_icp", lambda m, o, i: _complete_icp_dict())
    monkeypatch.setattr(orchestrator.runs, "get_active_discovery_run", lambda m, o: None)
    bt = _FakeBT()
    out = orchestrator.start_apollo_discover(object(), fake_mongo,
            ApolloDiscoverRequest(org_id="org1", user_id="u1", mode="keep"), bt)
    assert out["status"] == "queued" and out["run_id"]
    assert len(bt.tasks) == 1


def test_start_discover_409_when_active_run(monkeypatch, fake_mongo):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.warmup, "get_active_icp", lambda m, o, i: _complete_icp_dict())
    monkeypatch.setattr(orchestrator.runs, "fail_stale_discovery_runs", lambda m, o: None)
    monkeypatch.setattr(orchestrator.runs, "get_active_discovery_run", lambda m, o: {"run_id": "x"})
    with pytest.raises(DiscoveryInProgressError):
        orchestrator.start_apollo_discover(object(), fake_mongo,
            ApolloDiscoverRequest(org_id="org1", user_id="u1", mode="keep"), _FakeBT())


def test_start_discover_422_when_icp_underspecified(monkeypatch, fake_mongo):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.warmup, "get_active_icp", lambda m, o, i: {"primary_region": "NA"})
    monkeypatch.setattr(orchestrator.runs, "get_active_discovery_run", lambda m, o: None)
    with pytest.raises(IcpUnderspecifiedError):
        orchestrator.start_apollo_discover(object(), fake_mongo,
            ApolloDiscoverRequest(org_id="org1", user_id="u1", mode="keep"), _FakeBT())
```

- [ ] **Step 2: Run it, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_orchestrator.py -k start_discover -v`
Expected: FAIL — `start_apollo_discover` not defined.

- [ ] **Step 3: Implement**

Add to `orchestrator.py`:

```python
def start_apollo_discover(driver, mongo, request: "ApolloDiscoverRequest", background_tasks, *, llm=None) -> Dict[str, Any]:
    credentials.get_api_key(mongo, request.org_id, "apollo")  # ensure connected (404 otherwise)

    icp = warmup.get_active_icp(mongo, request.org_id, request.icp_id)
    fingerprint = discovery.icp_fingerprint(icp or {})
    discovery.build_search_filters(icp or {})  # raises IcpUnderspecifiedError (422) early

    # Retire a hung run first; if the killed run was a `replace`, clear its orphaned
    # superseded tags so those leads don't stay tagged (spec §5.7).
    stale = runs.fail_stale_discovery_runs(mongo, request.org_id)
    if stale and stale.get("mode") == "replace":
        ingestion.clear_superseded_discovery_leads(driver, request.org_id)
    if runs.get_active_discovery_run(mongo, request.org_id):
        raise DiscoveryInProgressError("A discovery run is already in progress for this org.")

    max_leads = min(request.max_leads or MAX_LEADS_DEFAULT, MAX_LEADS_HARD_CAP)
    run_id = runs.create_discovery_run(
        mongo, request.org_id, request.user_id,
        icp_id=(icp or {}).get("id"), icp_fingerprint=fingerprint,
        mode=request.mode, max_leads=max_leads,
    )
    background_tasks.add_task(
        _run_discover, driver, mongo, request.org_id, request.user_id, run_id,
        icp, request.mode, max_leads, llm,
    )
    return {"run_id": run_id, "status": "queued"}
```

> `llm` defaults to `None` so the queue-time tests below need not pass it; the router (Task 17) passes the real `Depends(get_llm)`. With `llm=None`, `rerank_candidates` degrades to the deterministic fit ranking — a missing LLM never blocks a run.

Add the constants near the top of `orchestrator.py` (next to `IMPORT_RECORD_CAP`):
```python
SEARCH_SCAN_CAP = 500
MAX_LEADS_DEFAULT = 50
MAX_LEADS_HARD_CAP = 200
REVEAL_RATE_DELAY = 0.3  # seconds between sequential people/match reveals (plan-tuned; respects Apollo rate limits)
```

- [ ] **Step 4: Run the tests, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_orchestrator.py -k start_discover -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/connectors/orchestrator.py backend/tests/unit/test_connectors_orchestrator.py
git commit -m "feat(be): start_apollo_discover — single-flight + ICP gate, queue run"
```

---

### Task 14: `orchestrator.py` — `_run_discover` (the funnel) + replace swap

**Files:**
- Modify: `backend/app/services/connectors/orchestrator.py`
- Test: `backend/tests/unit/test_connectors_orchestrator.py:` (append)

- [ ] **Step 1: Write the failing test** (FakeConnector with search + match)

```python
# append to backend/tests/unit/test_connectors_orchestrator.py
class _DiscoFakeConnector:
    def __init__(self, *a, **k): pass
    def search_people(self, filters, *, page=1, per_page=100):
        if page > 1:
            return {"people": [], "pagination": {"page": page, "total_pages": 1}}
        return {"people": [
            {"id": "p1", "has_email": True, "title": "VP Sales",
             "organization": {"industry": "SaaS", "estimated_num_employees": 80}},
            {"id": "p2", "has_email": False, "title": "VP Sales",
             "organization": {"industry": "SaaS", "estimated_num_employees": 80}},  # dropped: no email
        ], "pagination": {"page": 1, "total_pages": 1}}
    def match_person(self, pid, **k):
        return ({"id": pid, "email": f"{pid}@x.com", "email_status": "verified",
                 "organization": {"name": "X", "primary_domain": "x.com"}}, 1)


def test_run_discover_reveals_only_has_email_and_ingests(monkeypatch, fake_mongo):
    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _DiscoFakeConnector)
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.ingestion, "get_existing_apollo_contact_ids", lambda *a, **k: set())
    captured = {}
    monkeypatch.setattr(orchestrator.ingestion, "upsert_imported_leads",
                        lambda *a, **k: captured.update(k) or {"created": len(a[3]), "matched": 0, "errors": []})
    # llm rerank: identity (small candidate set <= max_leads anyway)
    rid = runs.create_discovery_run(fake_mongo, "org1", "u1", icp_id="i1",
                                    icp_fingerprint="fp", mode="keep", max_leads=50)
    orchestrator._run_discover(object(), fake_mongo, "org1", "u1", rid, _complete_icp_dict(), "keep", 50)
    doc = runs.get_discovery_run(fake_mongo, "org1", rid)
    assert doc["status"] == "completed"
    assert doc["counts"]["revealed"] == 1          # p2 dropped (has_email False)
    assert doc["credits_consumed"] == 1
    assert captured["apollo_origin"] == "discovery"


def test_run_discover_replace_swaps_with_no_loss(monkeypatch, fake_mongo):
    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _DiscoFakeConnector)
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.ingestion, "get_existing_apollo_contact_ids", lambda *a, **k: set())
    monkeypatch.setattr(orchestrator.ingestion, "upsert_imported_leads",
                        lambda *a, **k: {"created": 1, "matched": 0, "errors": []})
    order = []
    monkeypatch.setattr(orchestrator.ingestion, "tag_superseded_discovery_leads",
                        lambda d, o: order.append("tag") or 3)
    monkeypatch.setattr(orchestrator.ingestion, "delete_superseded_discovery_leads",
                        lambda d, o: order.append("delete") or 3)
    rid = runs.create_discovery_run(fake_mongo, "org1", "u1", icp_id="i1",
                                    icp_fingerprint="fp", mode="replace", max_leads=50)
    orchestrator._run_discover(object(), fake_mongo, "org1", "u1", rid, _complete_icp_dict(), "replace", 50)
    assert order == ["tag", "delete"]   # tag before run, delete only after ingest


def test_run_discover_partial_credit_wall_ingests_then_records_counts(monkeypatch, fake_mongo):
    """On a mid-reveal credit wall: ingest what was revealed FIRST (so counts are accurate),
    set low_credit (UC10), then record the run `partial` with post-ingest counts."""
    from app.core.exceptions import ApolloCreditsExhaustedError

    class _CreditWall:
        def __init__(self, *a, **k): pass
        def search_people(self, filters, *, page=1, per_page=100):
            if page > 1:
                return {"people": [], "pagination": {"page": page, "total_pages": 1}}
            return {"people": [
                {"id": "p1", "has_email": True, "title": "VP Sales",
                 "organization": {"industry": "SaaS", "estimated_num_employees": 80}},
                {"id": "p2", "has_email": True, "title": "VP Sales",
                 "organization": {"industry": "SaaS", "estimated_num_employees": 80}},
            ], "pagination": {"page": 1, "total_pages": 1}}
        def match_person(self, pid, **k):
            if pid == "p1":
                return ({"id": "p1", "email": "p1@x.com", "email_status": "verified",
                         "organization": {"name": "X", "primary_domain": "x.com"}}, 1)
            raise ApolloCreditsExhaustedError("out of credits")

    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _CreditWall)
    monkeypatch.setattr(orchestrator.apollo_mod, "_sleep", lambda *a, **k: None)  # no real throttle in tests
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.ingestion, "get_existing_apollo_contact_ids", lambda *a, **k: set())
    monkeypatch.setattr(orchestrator.ingestion, "upsert_imported_leads",
                        lambda *a, **k: {"created": len(a[3]), "matched": 0, "errors": []})
    low = {}
    monkeypatch.setattr(orchestrator.credentials, "set_low_credit", lambda m, o, p, v: low.update({"v": v}))
    rid = runs.create_discovery_run(fake_mongo, "org1", "u1", icp_id="i1",
                                    icp_fingerprint="fp", mode="keep", max_leads=50)
    orchestrator._run_discover(object(), fake_mongo, "org1", "u1", rid, _complete_icp_dict(), "keep", 50)
    doc = runs.get_discovery_run(fake_mongo, "org1", rid)
    assert doc["status"] == "partial"
    assert doc["counts"]["created"] == 1     # p1 ingested despite the wall (post-ingest counts, not zero)
    assert doc["credits_consumed"] == 1
    assert low["v"] is True                  # UC10 flag set on the only reachable credit path


def test_run_discover_replace_partial_restores_on_credit_wall(monkeypatch, fake_mongo):
    """Partial `replace` (credit wall mid-reveal) RESTORES prior discovery leads (clear, NOT
    delete) so the pool is never reduced below its pre-run count (spec AC4, no-loss)."""
    from app.core.exceptions import ApolloCreditsExhaustedError

    class _CreditWall:
        def __init__(self, *a, **k): pass
        def search_people(self, filters, *, page=1, per_page=100):
            if page > 1:
                return {"people": [], "pagination": {"page": page, "total_pages": 1}}
            return {"people": [
                {"id": "p1", "has_email": True, "title": "VP Sales",
                 "organization": {"industry": "SaaS", "estimated_num_employees": 80}},
                {"id": "p2", "has_email": True, "title": "VP Sales",
                 "organization": {"industry": "SaaS", "estimated_num_employees": 80}},
            ], "pagination": {"page": 1, "total_pages": 1}}
        def match_person(self, pid, **k):
            if pid == "p1":
                return ({"id": "p1", "email": "p1@x.com", "email_status": "verified",
                         "organization": {"name": "X", "primary_domain": "x.com"}}, 1)
            raise ApolloCreditsExhaustedError("out of credits")

    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _CreditWall)
    monkeypatch.setattr(orchestrator.apollo_mod, "_sleep", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.credentials, "set_low_credit", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.ingestion, "get_existing_apollo_contact_ids", lambda *a, **k: set())
    monkeypatch.setattr(orchestrator.ingestion, "upsert_imported_leads",
                        lambda *a, **k: {"created": 1, "matched": 0, "errors": []})
    calls = []
    monkeypatch.setattr(orchestrator.ingestion, "tag_superseded_discovery_leads", lambda d, o: calls.append("tag") or 3)
    monkeypatch.setattr(orchestrator.ingestion, "clear_superseded_discovery_leads", lambda d, o: calls.append("clear") or 3)
    monkeypatch.setattr(orchestrator.ingestion, "delete_superseded_discovery_leads", lambda d, o: calls.append("delete") or 3)
    rid = runs.create_discovery_run(fake_mongo, "org1", "u1", icp_id="i1",
                                    icp_fingerprint="fp", mode="replace", max_leads=50)
    orchestrator._run_discover(object(), fake_mongo, "org1", "u1", rid, _complete_icp_dict(), "replace", 50)
    doc = runs.get_discovery_run(fake_mongo, "org1", rid)
    assert doc["status"] == "partial"
    assert calls == ["tag", "clear"]   # restored (no-loss), NOT committed via delete
    assert "delete" not in calls
```

- [ ] **Step 2: Run it, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_orchestrator.py -k run_discover -v`
Expected: FAIL — `_run_discover` not defined.

- [ ] **Step 3: Implement**

Add to `orchestrator.py` (mirror `_run_enrich`'s try/except + credential-error handling):

```python
def _run_discover(driver, mongo, org_id, user_id, run_id, icp, mode, max_leads, llm=None) -> None:
    """Background body: search -> free funnel -> LLM re-rank -> reveal -> quality gate -> ingest.
    In `replace` mode: tag old discovery leads superseded first; delete only after a clean ingest."""
    counts = {"searched": 0, "qualified": 0, "selected": 0, "revealed": 0,
              "verified": 0, "unverified": 0, "created": 0, "matched": 0,
              "skipped_duplicates": 0, "errors": []}
    credits = 0
    tagged = False
    try:
        api_key = credentials.get_api_key(mongo, org_id, "apollo")
        connector = apollo_mod.ApolloConnector(api_key)
        runs.mark_discovery_processing(mongo, run_id)

        if mode == "replace":
            ingestion.tag_superseded_discovery_leads(driver, org_id)
            tagged = True

        filters = discovery.build_search_filters(icp)
        existing = ingestion.get_existing_apollo_contact_ids(driver, org_id, include_superseded=False)

        # 1-2: search + paginate up to the scan cap; 3a: drop no-email + dupes.
        candidates: List[Dict[str, Any]] = []
        page = 1
        while len(candidates) < SEARCH_SCAN_CAP:
            body = connector.search_people(filters, page=page, per_page=100)
            people = body.get("people") or []
            counts["searched"] += len(people)
            for p in people:
                if not p.get("has_email"):
                    continue
                cid = str(p.get("id")) if p.get("id") is not None else None
                if cid and cid in existing:
                    counts["skipped_duplicates"] += 1
                    continue
                candidates.append(p)
            total_pages = int((body.get("pagination") or {}).get("total_pages") or 1)
            if page >= total_pages or not people:
                break
            page += 1

        # 3b: hard-dimension drop; 4: LLM re-rank to top max_leads.
        candidates = [c for c in candidates if discovery.passes_hard_dimensions(c, icp)]
        counts["qualified"] = len(candidates)
        selected = discovery.rerank_candidates(llm, candidates, icp, max_leads=max_leads)
        counts["selected"] = len(selected)
        runs.update_discovery_progress(mongo, run_id, counts=counts, credits_consumed=credits)

        # 5-6: reveal sequentially; keep any revealed email, tag verified/unverified.
        records: List[Dict[str, Any]] = []
        for i, cand in enumerate(selected):
            if i:
                # `apollo_mod._sleep` is the module-level `_sleep = time.sleep` alias (apollo.py) —
                # stateless (no backoff/retry state), and module-level precisely so tests patch it
                # to a no-op. Reusing it for the inter-reveal throttle is intentional, not a misuse.
                apollo_mod._sleep(REVEAL_RATE_DELAY)  # throttle between reveals (Apollo rate limits)
            try:
                person, spent = connector.match_person(str(cand.get("id")))
            except ApolloCreditsExhaustedError:
                # Credit wall mid-reveal — this is the ONLY path that raises this error
                # (search is credit-free), so the low-credit flag (UC10) must be set HERE,
                # not in an outer handler. Ingest what we revealed FIRST so `counts` reflects
                # the created/matched leads, THEN record the run with the post-ingest counts.
                credentials.set_low_credit(mongo, org_id, "apollo", True)
                if records:
                    _ingest_discovery(driver, org_id, user_id, run_id, records, counts)
                # A partial run is closer to a failure than a success: in `replace` mode RESTORE
                # the prior discovery leads (clear, NOT delete) so the pool never drops below its
                # pre-run count (spec AC4, no-loss). Re-revealed people merge onto their existing
                # (now-restored) node via upsert; un-re-revealed leads are simply un-tagged. Done
                # unconditionally on `tagged` — even if the wall hit before any successful reveal.
                if tagged:
                    ingestion.clear_superseded_discovery_leads(driver, org_id)
                runs.complete_discovery_run(mongo, run_id, counts=counts, credits_consumed=credits, status="partial")
                return
            credits += spent
            counts["revealed"] += 1
            if not person or not person.get("email"):
                continue
            if person.get("email_status") == "verified":
                counts["verified"] += 1
            else:
                counts["unverified"] += 1
            rec = normalize_apollo_record(person)
            records.append(rec)
            runs.update_discovery_progress(mongo, run_id, counts=counts, credits_consumed=credits)

        # 7: ingest.
        if records:
            _ingest_discovery(driver, org_id, user_id, run_id, records, counts)

        if tagged:
            ingestion.delete_superseded_discovery_leads(driver, org_id)  # commit the swap

        status = "completed" if counts["created"] or counts["matched"] else "completed_empty"
        if credits > 0:
            credentials.set_low_credit(mongo, org_id, "apollo", False)  # a clean revealing run clears the flag
        runs.complete_discovery_run(mongo, run_id, counts=counts, credits_consumed=credits, status=status)

    except ConnectorCredentialsInvalidError as e:
        credentials.set_status(mongo, org_id, "apollo", "error")
        if tagged:
            ingestion.clear_superseded_discovery_leads(driver, org_id)
        runs.fail_discovery_run(mongo, run_id, f"Apollo credentials invalid: {e}")
    # NOTE: no outer `except ApolloCreditsExhaustedError` — it is unreachable. The only
    # statement that can raise it is `match_person` inside the reveal loop, which is already
    # caught by the inner handler above (which returns). search_people is credit-free.
    except BrewraError as e:
        if tagged:
            ingestion.clear_superseded_discovery_leads(driver, org_id)
        runs.fail_discovery_run(mongo, run_id, str(e))
    except Exception as e:  # noqa: BLE001
        logger.error("Apollo discovery failed (org_id=%s run_id=%s): %s", org_id, run_id, e)
        if tagged:
            ingestion.clear_superseded_discovery_leads(driver, org_id)
        runs.fail_discovery_run(mongo, run_id, str(e))


def _ingest_discovery(driver, org_id, user_id, run_id, records, counts) -> None:
    result = ingestion.upsert_imported_leads(
        driver, org_id, user_id, records,
        file_id=run_id, source="apollo", apollo_origin="discovery",
        discovery_run_id=run_id, chunk_size=INGEST_CHUNK_SIZE,
    )
    counts["created"] += result["created"]
    counts["matched"] += result["matched"]
    counts["errors"].extend(result["errors"])
```

> **LLM access (resolved):** the background task can't use the `get_llm` Request dependency, so the LLM is **threaded as a parameter** — router `Depends(get_llm)` → `start_apollo_discover(..., llm=llm)` → `add_task(_run_discover, ..., llm)` → `rerank_candidates(llm, ...)`. `llm` defaults to `None`; with `None` (or on any failure) `rerank_candidates` degrades to the deterministic fit ranking, so a missing LLM never blocks a run. No global singleton, no placeholder code.

- [ ] **Step 4: Run the tests, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_orchestrator.py -k run_discover -v`
Expected: PASS (4 tests). All four use small candidate sets (≤ `max_leads`), so `rerank_candidates` returns them without calling the LLM — no `llm` arg needed (it defaults to `None`). The two credit-wall tests patch `apollo_mod._sleep` to a no-op so the inter-reveal throttle doesn't add real wall-clock.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/connectors/orchestrator.py backend/tests/unit/test_connectors_orchestrator.py
git commit -m "feat(be): _run_discover funnel + no-loss replace swap"
```

---

### Task 15: `orchestrator.py` — status (credit + ICP-change), discovery-status, export; `credentials.set_low_credit`

**Files:**
- Modify: `backend/app/services/connectors/orchestrator.py`, `backend/app/services/connectors/credentials.py`
- Test: `backend/tests/unit/test_connectors_orchestrator.py:`, `backend/tests/unit/test_connectors_credentials.py:` (append/create)

> This task bundles independent pieces — `set_low_credit` (credentials), the extended `get_apollo_status`, `get_apollo_discovery_status`, and `export_discovery_leads`. **Commit each as its own logical commit** rather than one batch, for reviewability.

- [ ] **Step 1: Write the failing tests**

```python
# append to backend/tests/unit/test_connectors_orchestrator.py
def test_status_reports_icp_changed_and_credits(monkeypatch, fake_mongo):
    monkeypatch.setattr(orchestrator.credentials, "get_credentials",
                        lambda m, o, p: {"status": "connected", "connected_at": "t0", "low_credit": False})
    monkeypatch.setattr(orchestrator.warmup, "get_active_icp", lambda m, o, i: _complete_icp_dict())
    monkeypatch.setattr(orchestrator.runs, "latest_completed_discovery_run",
                        lambda m, o: {"icp_fingerprint": "OLD", "finished_at": "t1"})
    monkeypatch.setattr(orchestrator.runs, "sum_discovery_credits", lambda m, o: 42)
    out = orchestrator.get_apollo_status(fake_mongo, "org1")
    assert out["connected"] is True
    assert out["credits_consumed_total"] == 42
    assert out["icp_changed_since_last_discovery"] is True   # current fp != "OLD"
    assert out["last_discovery_at"] == "t1"


def test_export_discovery_leads_csv(monkeypatch):
    monkeypatch.setattr(orchestrator.ingestion, "get_discovery_leads",
                        lambda d, o: [{"name": "A", "email": "a@x.com", "title": "VP", "email_status": "verified"}])
    blob, content_type = orchestrator.export_discovery_leads(object(), "org1", fmt="csv")
    assert "name,email" in blob.splitlines()[0]
    assert "A,a@x.com" in blob
    assert content_type == "text/csv"
```

```python
# backend/tests/unit/test_connectors_credentials.py
from app.services.connectors import credentials


def test_set_low_credit(fake_mongo):
    credentials.save_credentials(fake_mongo, "org1", "apollo", "k")
    credentials.set_low_credit(fake_mongo, "org1", "apollo", True)
    assert credentials.get_credentials(fake_mongo, "org1", "apollo")["low_credit"] is True
```

- [ ] **Step 2: Run, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_orchestrator.py -k "status_reports or export" backend/tests/unit/test_connectors_credentials.py -v`
Expected: FAIL — `set_low_credit` / `export_discovery_leads` not defined; status lacks new fields.

- [ ] **Step 3: Implement**

In `credentials.py`:
```python
def set_low_credit(mongo, org_id: str, provider: str, value: bool) -> None:
    _coll(mongo).update_one(
        {"org_id": org_id, "provider": provider},
        {"$set": {"low_credit": bool(value), "updated_at": _now()}},
    )
```

In `orchestrator.py`, replace `get_apollo_status` with the extended version and add the others:
```python
def get_apollo_status(mongo, org_id: str) -> Dict[str, Any]:
    doc = credentials.get_credentials(mongo, org_id, "apollo")
    if not doc:
        return {"connected": False, "status": "disconnected", "connected_at": None,
                "credits_consumed_total": 0, "last_run_credits": 0, "low_credit": False,
                "last_discovery_at": None, "last_discovery_icp_fingerprint": None,
                "icp_changed_since_last_discovery": False}
    last = runs.latest_completed_discovery_run(mongo, org_id)
    last_fp = (last or {}).get("icp_fingerprint")
    current_icp = warmup.get_active_icp(mongo, org_id, None)
    current_fp = discovery.icp_fingerprint(current_icp) if current_icp else None
    return {
        "connected": True,
        "status": doc.get("status", "connected"),
        "connected_at": doc.get("connected_at"),
        "credits_consumed_total": runs.sum_discovery_credits(mongo, org_id),
        "last_run_credits": int((last or {}).get("credits_consumed") or 0),
        "low_credit": bool(doc.get("low_credit", False)),
        "last_discovery_at": (last or {}).get("finished_at"),
        "last_discovery_icp_fingerprint": last_fp,
        "icp_changed_since_last_discovery": bool(last_fp and current_fp and last_fp != current_fp),
    }


def get_apollo_discovery_status(mongo, org_id: str, run_id: Optional[str]) -> Dict[str, Any]:
    return runs.get_discovery_run(mongo, org_id, run_id)


def export_discovery_leads(driver, org_id: str, *, fmt: str = "json"):
    """Return (body, content_type). Bounded, non-streaming. CSV is a flat projection."""
    leads = ingestion.get_discovery_leads(driver, org_id)
    if fmt == "csv":
        import csv, io
        cols = ["name", "first_name", "last_name", "email", "email_status", "title",
                "seniority", "company_name", "company_domain", "phone", "linkedin_url", "location"]
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(cols)
        for ld in leads:
            w.writerow([ld.get(c, "") for c in cols])
        return buf.getvalue(), "text/csv"
    import json as _json
    return _json.dumps({"leads": leads}, default=str), "application/json"
```

- [ ] **Step 4: Run, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_orchestrator.py -k "status_reports or export" backend/tests/unit/test_connectors_credentials.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/connectors/orchestrator.py backend/app/services/connectors/credentials.py backend/tests/unit/test_connectors_orchestrator.py backend/tests/unit/test_connectors_credentials.py
git commit -m "feat(be): apollo status (credits/icp-change), discovery-status, export, low_credit setter"
```

---

### Task 16: Models — MOVED to Task 1b — SKIP

> ⛔ The connector models were relocated to **Task 1b** (right after Task 1) to resolve a forward dependency (Tasks 13–17 import them). **Do not execute the steps below** — they are the original, now-superseded content, kept only for traceability. Skip to Task 17.

<details><summary>Original Task 16 content (superseded by Task 1b)</summary>

**Files:**
- Modify: `backend/app/models/connectors.py`
- Test: `backend/tests/unit/test_connectors_models.py` (create)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_connectors_models.py
from app.models.connectors import (
    ApolloDiscoverRequest, ApolloDiscoverResponse, ApolloWarmupResponse, ApolloStatusResponse,
)


def test_discover_request_defaults():
    r = ApolloDiscoverRequest(org_id="o", user_id="u")
    assert r.mode == "keep" and r.icp_id is None and r.max_leads is None


def test_status_response_has_new_fields():
    s = ApolloStatusResponse(connected=True, status="connected", credits_consumed_total=0,
                             last_run_credits=0, low_credit=False, icp_changed_since_last_discovery=False)
    assert s.low_credit is False


def test_warmup_response_shape():
    w = ApolloWarmupResponse(icp_configured=True, signals_generated=False, scout_completed=True,
                             profiler_analyzed=True, ready_count=3, unlocked=False,
                             missing=[{"step": "signals_generated", "label": "Signals", "deep_link_hint": "signals"}])
    assert w.ready_count == 3
```

- [ ] **Step 2: Run, expect failure**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_models.py -v`
Expected: FAIL — names not importable.

- [ ] **Step 3: Implement** (append to `app/models/connectors.py`; extend the existing `ApolloStatusResponse`)

```python
from typing import List, Optional, Literal


class ApolloDiscoverRequest(BaseModel):
    org_id: str
    user_id: str
    icp_id: Optional[str] = None
    mode: Literal["keep", "replace"] = "keep"
    max_leads: Optional[int] = None


class ApolloDiscoverResponse(BaseModel):
    run_id: str
    status: str


class DiscoveryCounts(BaseModel):
    searched: int = 0
    qualified: int = 0
    selected: int = 0
    revealed: int = 0
    verified: int = 0
    unverified: int = 0
    created: int = 0
    matched: int = 0
    skipped_duplicates: int = 0
    errors: List[Any] = []


class ApolloDiscoverStatusResponse(BaseModel):
    run_id: str
    org_id: str
    status: str
    mode: str
    counts: DiscoveryCounts
    credits_consumed: int = 0
    progress_percent: float = 0.0
    icp_fingerprint: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    message: Optional[str] = None


class WarmupMissing(BaseModel):
    step: str
    label: str
    deep_link_hint: str


class ApolloWarmupResponse(BaseModel):
    icp_configured: bool
    signals_generated: bool
    scout_completed: bool
    profiler_analyzed: bool
    ready_count: int
    unlocked: bool
    missing: List[WarmupMissing] = []
```

Replace the existing `ApolloStatusResponse` with:
```python
class ApolloStatusResponse(BaseModel):
    connected: bool
    status: str
    connected_at: Optional[str] = None
    credits_consumed_total: int = 0
    last_run_credits: int = 0
    low_credit: bool = False
    last_discovery_at: Optional[str] = None
    last_discovery_icp_fingerprint: Optional[str] = None
    icp_changed_since_last_discovery: bool = False
```

Ensure `Any` is imported (`from typing import Any`).

- [ ] **Step 4: Run, expect pass**

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_models.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/connectors.py backend/tests/unit/test_connectors_models.py
git commit -m "feat(be): connector models for discover/warmup + extended status"
```

</details>

---

### Task 17: Router — wire endpoints + startup orphan-tag sweep

**Files:**
- Modify: `backend/app/routers/connectors.py`, `backend/app/main.py`
- Test: `backend/tests/integration/test_connectors_routes.py` (create or append; use FastAPI `TestClient`)

- [ ] **Step 1: Write the failing test** (mirror the existing route-test style; if none exists, use `TestClient(app)` with dependency overrides for `get_mongo`/`get_neo4j_driver`/`get_llm`)

```python
# backend/tests/integration/test_connectors_routes.py
from fastapi.testclient import TestClient
from app.main import app
from app.core.dependencies import get_mongo, get_neo4j_driver, get_llm


def test_warmup_route(monkeypatch):
    from app.services.connectors import warmup as warmup_mod
    monkeypatch.setattr(warmup_mod, "get_warmup_status",
                        lambda m, o, u: {"icp_configured": True, "signals_generated": False,
                                         "scout_completed": True, "profiler_analyzed": True,
                                         "ready_count": 3, "unlocked": False,
                                         "missing": [{"step": "signals_generated", "label": "S", "deep_link_hint": "signals"}]})
    app.dependency_overrides[get_mongo] = lambda: object()
    client = TestClient(app)
    resp = client.get("/connectors/apollo/warmup", params={"org_id": "o", "user_id": "u"})
    assert resp.status_code == 200
    assert resp.json()["ready_count"] == 3
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Run, expect failure**

Run: `RUNPY -m pytest backend/tests/integration/test_connectors_routes.py -v`
Expected: FAIL — 404 (route not registered).

- [ ] **Step 3: Implement the routes**

In `backend/app/routers/connectors.py`, add (mirror the existing `/apollo/enrich` + `/apollo/enrich/status` handlers; import `get_llm`, the new models, and `Response`):

```python
from fastapi import Response
from app.core.dependencies import get_llm
from app.models.connectors import (
    ApolloDiscoverRequest, ApolloDiscoverResponse, ApolloDiscoverStatusResponse, ApolloWarmupResponse,
)
from app.services.connectors import warmup as warmup_service


@router.post("/apollo/discover", response_model=ApolloDiscoverResponse)
async def apollo_discover(
    request: ApolloDiscoverRequest,
    background_tasks: BackgroundTasks,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    llm=Depends(get_llm),
):
    """Queue an ICP-driven Apollo discovery run."""
    return connectors_service.start_apollo_discover(driver, mongo, request, background_tasks, llm=llm)


@router.get("/apollo/discover/status", response_model=ApolloDiscoverStatusResponse)
async def apollo_discover_status(
    org_id: str = Query(...),
    run_id: Optional[str] = Query(None),
    mongo=Depends(get_mongo),
):
    return connectors_service.get_apollo_discovery_status(mongo, org_id, run_id)


@router.get("/apollo/warmup", response_model=ApolloWarmupResponse)
async def apollo_warmup(
    org_id: str = Query(...),
    user_id: str = Query(...),
    mongo=Depends(get_mongo),
):
    return warmup_service.get_warmup_status(mongo, org_id, user_id)


@router.get("/apollo/leads/export")
async def apollo_leads_export(
    org_id: str = Query(...),
    fmt: str = Query("json", alias="format"),  # external query key stays ?format=; avoid shadowing builtin `format`
    driver=Depends(get_neo4j_driver),
):
    body, content_type = connectors_service.export_discovery_leads(driver, org_id, fmt=fmt)
    return Response(content=body, media_type=content_type)
```

Update `start_apollo_discover` (Task 13) to accept `*, llm` and pass it into `_run_discover` (Task 14), which forwards it to `discovery.rerank_candidates`. The existing `/apollo/connect` and `/apollo/status` routes are unchanged in signature — they now call the extended service functions automatically.

- [ ] **Step 4: Add the startup orphan-tag sweep**

In `backend/app/main.py` lifespan, after `_ensure_connectors_indexes(...)`, add a best-effort sweep:

```python
    if app.state.clients.client is not None and app.state.clients.driver is not None:
        try:
            from app.services.connectors import orchestrator as _conn
            _conn.sweep_orphan_superseded(app.state.clients.driver, app.state.clients.client)
        except Exception as e:
            logger.error("Apollo superseded-tag sweep (lifespan) failed: %s", e)
```

And add `sweep_orphan_superseded` to `orchestrator.py`:

```python
def sweep_orphan_superseded(driver, mongo) -> None:
    """Startup safety net: clear superseded tags left by a `replace` run killed mid-swap.
    Scoped to orgs that have actually run `replace` (the only mode that tags superseded) —
    avoids an unfiltered distinct over the whole collection; for each, clear only when no
    discovery run is currently active (no legitimate in-flight swap)."""
    org_ids = mongo["Profiler"][runs.DISCOVERY_RUNS_COLLECTION].distinct("org_id", {"mode": "replace"})
    for org_id in org_ids:
        if not runs.get_active_discovery_run(mongo, org_id):
            ingestion.clear_superseded_discovery_leads(driver, org_id)
```

- [ ] **Step 5: Run, expect pass**

Run: `RUNPY -m pytest backend/tests/integration/test_connectors_routes.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/connectors.py backend/app/main.py backend/app/services/connectors/orchestrator.py backend/tests/integration/test_connectors_routes.py
git commit -m "feat(be): wire discover/warmup/export routes + startup superseded sweep"
```

---

### Task 18: Pipeline integration test (transport-level Apollo mock)

**Files:**
- Test: `backend/tests/unit/test_connectors_discovery_integration.py` (create)

- [ ] **Step 1: Write the test** (mock only the transport seam `apollo._http_request`; let the real connector + funnel + run-doc logic execute; mock Mongo with the in-memory fake and Neo4j ingestion with a spy)

```python
# backend/tests/unit/test_connectors_discovery_integration.py
from app.services.connectors import apollo as apollo_mod, orchestrator, runs


def _route(method, url, **kwargs):
    if url.endswith("/mixed_people/api_search"):
        page = (kwargs.get("json") or {}).get("page", 1)
        if page == 1:
            return _Resp(200, {"people": [
                {"id": f"p{i}", "has_email": True, "title": "VP Sales",
                 "organization": {"industry": "SaaS", "estimated_num_employees": 80}} for i in range(3)
            ], "pagination": {"page": 1, "total_pages": 1}})
        return _Resp(200, {"people": [], "pagination": {"page": page, "total_pages": 1}})
    if url.endswith("/people/match"):
        pid = (kwargs.get("json") or {}).get("id")
        return _Resp(200, {"person": {"id": pid, "email": f"{pid}@x.com", "email_status": "verified",
                                      "organization": {"name": "X", "primary_domain": "x.com"}},
                           "credits_consumed": 1})
    return _Resp(404, {})


class _Resp:
    def __init__(self, code, body): self.status_code = code; self._b = body; self.text = ""
    def json(self): return self._b


def test_full_pipeline_counts_and_credits(monkeypatch, fake_mongo):
    monkeypatch.setattr(apollo_mod, "_http_request", _route)
    monkeypatch.setattr(apollo_mod, "_sleep", lambda _s: None)
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.ingestion, "get_existing_apollo_contact_ids", lambda *a, **k: set())
    created = {"n": 0}
    monkeypatch.setattr(orchestrator.ingestion, "upsert_imported_leads",
                        lambda *a, **k: created.__setitem__("n", created["n"] + len(a[3])) or
                                        {"created": len(a[3]), "matched": 0, "errors": []})

    icp = {"id": "i1", "primary_region": "NA", "industry": ["SaaS"], "company_size": ["51-200"],
           "buyer_role": ["VP Sales"], "fit_confidence": "high"}
    rid = runs.create_discovery_run(fake_mongo, "org1", "u1", icp_id="i1",
                                    icp_fingerprint="fp", mode="keep", max_leads=50)

    class _StubLLM:  # rerank: identity order (<= max_leads)
        def invoke(self, _): 
            class R: content = '["p0","p1","p2"]'
            return R()
    orchestrator._run_discover.__wrapped__ if hasattr(orchestrator._run_discover, "__wrapped__") else None
    orchestrator._run_discover(object(), fake_mongo, "org1", "u1", rid, icp, "keep", 50, llm=_StubLLM())

    doc = runs.get_discovery_run(fake_mongo, "org1", rid)
    assert doc["counts"]["searched"] == 3
    assert doc["counts"]["revealed"] == 3
    assert doc["counts"]["verified"] == 3
    assert doc["credits_consumed"] == 3
    assert doc["status"] == "completed"
    assert created["n"] == 3
```

> This test asserts the spec's acceptance criteria 2 & 3 end-to-end: `credits_consumed (3) == revealed (3) <= selected <= max_leads`, and the run records credits. Adjust `_run_discover`'s signature to accept `llm` as the trailing param (Task 14 note).

- [ ] **Step 2: Run, expect pass** (after Task 14's llm-param wiring)

Run: `RUNPY -m pytest backend/tests/unit/test_connectors_discovery_integration.py -v`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/unit/test_connectors_discovery_integration.py
git commit -m "test(be): transport-level apollo discovery pipeline integration test"
```

---

### Task 19: Full suite + live shape verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole connector + warmup test set**

Run:
```bash
RUNPY -m pytest backend/tests/unit/test_connectors_apollo.py backend/tests/unit/test_connectors_normalize.py backend/tests/unit/test_connectors_ingestion.py backend/tests/unit/test_connectors_runs.py backend/tests/unit/test_connectors_warmup.py backend/tests/unit/test_connectors_discovery.py backend/tests/unit/test_connectors_orchestrator.py backend/tests/unit/test_connectors_models.py backend/tests/unit/test_connectors_credentials.py backend/tests/unit/test_connectors_discovery_integration.py backend/tests/integration/test_connectors_routes.py backend/tests/unit/test_connectors_exceptions.py -v
```
Expected: all PASS.

- [ ] **Step 2: Verify response shapes against a running backend** (per repo backend-first rule — needed before 35b)

Boot the app locally and confirm the new endpoints' JSON with `curl`/`/docs`:
- `GET /connectors/apollo/warmup?org_id=...&user_id=...`
- `GET /connectors/apollo/status?org_id=...`
- `POST /connectors/apollo/discover` → `GET /connectors/apollo/discover/status?org_id=...&run_id=...`
- `GET /connectors/apollo/leads/export?org_id=...&format=csv`

Capture the exact JSON shapes — they become the zod contracts in plan 35b. Record any field-name surprises here.

- [ ] **Step 3: Confirm the live Apollo filter param names** (spec open item)

Against Apollo `/docs`, confirm the `mixed_people/api_search` param names used in `discovery.build_search_filters` (`person_titles`, `organization_num_employees_ranges`, `q_organization_keywords`, `person_locations`). Fix any mismatch in that one function and re-run Task 9 tests.

- [ ] **Step 4: Commit any fixes from Steps 2-3**

```bash
git add -p backend/app/services/connectors/discovery.py   # only the files you touched
git commit -m "fix(be): align discovery to verified Apollo/endpoint shapes"
```

---

## Self-Review

- **Spec coverage:** §5.1 (search/match) → Tasks 2-3; §5.2 funnel → Tasks 9-11, 14; §5.3 run model → Task 6; §5.4 warmup → Tasks 7-8, 17; §5.5 connect gate → Task 12; §5.6 credit/status → Task 15; §5.7 ICP-change + replace swap + export → Tasks 6/9 (fingerprint), 14 (swap), 5/15 (export); §5.8 lead fields → Tasks 4-5; §5.9 endpoints → Task 17; §5.10 models → **Task 1b**, exceptions (incl. `ApolloSearchError → 502`) → Task 1; §10 testing → every task + Task 18. **Not in 35a (recorded):** agent-view `superseded` exclusion across Scout/Profiler/Signals reads (Task 5 note → 35b/follow-up), and FE work (35b).
- **Ordering:** models (Task 1b) and exceptions (Task 1) run before their importers (Tasks 12–17); see the Execution-order block. Task 16 is a skip-pointer to 1b.
- **Placeholder scan:** the former LLM-access seam is now fully resolved — `llm` is threaded as a parameter (router → `start_apollo_discover` → `_run_discover` → `rerank_candidates`), defaulting to `None` with a deterministic fallback; no placeholder code remains. The Apollo filter param names are confirmed against live `/docs` in Task 19 Step 3 (a contained, single-function change).
- **Type consistency:** `start_apollo_discover(..., background_tasks, *, llm=None)` and `_run_discover(driver, mongo, org_id, user_id, run_id, icp, mode, max_leads, llm=None)` — `llm` threaded consistently across Tasks 13, 14, 17, 18. `counts` dict shape identical in `runs.create_discovery_run`, `_run_discover`, and the `DiscoveryCounts` model (`errors: List[Dict[str,Any]]`). `match_person` returns `(person|None, credits)` (Tasks 3, 14, 18). `get_existing_apollo_contact_ids(..., include_superseded=False)` consistent (Tasks 5, 14). `fail_stale_discovery_runs` returns the stale doc and its `mode == "replace"` triggers `clear_superseded_discovery_leads` (Tasks 6, 13).
- **Regression:** every existing-file-modifying task re-runs that file's full test module before commit (Regression-rule block) — no silent regression waits for Task 19.
