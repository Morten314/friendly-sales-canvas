# Apollo Lead Integration — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend-only Apollo.io connector that lets a customer (a) import their Apollo Contacts into the existing `Lead` graph and (b) enrich selected leads with Apollo data (fill-only-empty), both as on-demand `BackgroundTasks`, dedup'd by email/domain.

**Architecture:** A new self-contained `app/services/connectors/` package (sibling to `leads/`, `market_scoring/`) holding a concrete `ApolloConnector` (the only Apollo-aware code), a provider-agnostic Neo4j ingestion layer (atomic UNWIND-batched fill-only-empty + Company MERGE), per-org credential storage, and run/batch tracking. Imports reuse the existing `Lead_Stream_Files` "synthetic file" surface (so `GET /leads/stream/status`, `GET/DELETE /leads/by-file` light up for free); enrichment uses a new `Connector_Enrich_Runs` run-doc that mirrors the market-scoring run pattern (queued→processing→completed, stale-run failover). One new router `app/routers/connectors.py` is mounted in `main.py`. The frontend plan is **deferred** (spec §12.2) — this plan ships a curl-/`/docs`-verifiable API only.

**Tech Stack:** Python 3.12, FastAPI (app factory + `Depends` DI + `BackgroundTasks`), Neo4j (`neo4j` driver, `session.execute_write`), MongoDB (`pymongo`, `Profiler` DB), `requests` (already a dependency) for Apollo HTTP, `pytest` + `unittest.mock` (conftest `mock_neo4j`/`mock_mongo` dependency-override fixtures).

**Spec:** `specs/23-apollo-lead-integration-design.md` (two clean review rounds). Read §4–§6, §8, §9, and the §5.3/§5.4/§5.5 primitives before starting. Paired deferred plan: `plans/23b-apollo-lead-integration-frontend.md` (not written until the FE refactor completes).

---

## Conventions for every task

- **Run from the backend subdir.** All Python/pytest commands assume `cd /projects/Brewra/brewra-gtm-intelligence/backend` first (per `CLAUDE.md`: `pip`/`pytest`/`python` only inside `/backend/`). The repo root has no `pyproject.toml`/`pytest.ini`.
- **Tests** use `BREWRA_SKIP_DB_INIT` (set by `tests/conftest.py`) so no real DB I/O happens at import. External clients are injected; substitute mocks via `app.dependency_overrides` (router tests) or by passing fakes directly (service/unit tests). See `backend/TESTING.md` — **patch where the symbol is *used*, not where it is *defined*.**
- **Canonical test identities:** `from tests.identities import TEST_ORG_ID, TEST_USER_ID, TEST_LEAD_ID_1, TEST_LEAD_ID_2`.
- **Commits:** conventional `type(scope):` with scope `be` (e.g. `feat(be):`). One commit per task. **No `Co-Authored-By` footer.** Prefer small, frequent commits.
- **No new pip dependencies.** `requests` is already in `backend/requirements.txt` (verified). Do not add `httpx`, `responses`, or `mongomock`.
- **MVP security posture (spec §2.2):** customer Apollo keys are stored unencrypted as a documented conscious risk. Do **not** add auth/encryption/tenant-authz. Do not paste `backend/config.py` or any key into commits/PRs.
- **Regression gate per task.** After a task's new-test step passes, run the **whole** suite (`cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest -q`) **before committing** — not just the new file. It is seconds against mocks and surfaces a break in Task 5/11/12 immediately instead of only at Task 13.

### Execution discipline & abort

- **Stop and report on the unpredicted.** Every task states expected failure/pass output. If any step fails in a way the plan does *not* predict (e.g. the new test passes but an unrelated import breaks, or an existing test goes red), **stop and report to the operator** — do not improvise a fix that drifts from the plan.
- **Escalate on a materially-incompatible Apollo surface.** Task 4 assumes specific Apollo endpoints (`/labels`, `/contacts/search`, `/people/bulk_match`), the `x-api-key` header, and response shapes (`contacts`/`pagination`/`labels`/`matches`). If a live/fixture check shows the surface is materially different, **stop and escalate before starting Tasks 5–14** — normalize/ingestion/orchestrator all build on it.
- **Escalate on Neo4j incompatibility.** If Task 5's UNWIND/`FOREACH`/`coalesce` Cypher is rejected by the target Neo4j engine (a real engine error, not a test-mock artifact), stop and escalate rather than rewriting the write strategy ad hoc.

### Before you start

- [ ] **Create a feature branch off `master`** (per `CLAUDE.md` discipline):

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master && git pull
git checkout -b feat/apollo-connector-backend
```

- [ ] **Confirm the baseline is green:**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest -q
```
Expected: all existing tests pass (baseline). If red on a clean checkout, stop and report.

---

## Module map (what gets created)

| File | Responsibility |
|---|---|
| `app/core/exceptions.py` *(edit, additive)* | New connector exception leaves subclassing existing bases (auto-routed by `main.py` handlers via MRO). |
| `app/models/connectors.py` *(new)* | Pydantic request/response models for the router. |
| `app/services/connectors/normalize.py` *(new)* | Pure: Apollo raw record → canonical lead dict; email/domain normalization. `CANONICAL_FIELDS`. |
| `app/services/connectors/apollo.py` *(new)* | Concrete `ApolloConnector` — the only Apollo-aware code. HTTP funnel + 429 backoff; `validate_credentials`, `list_collections`, `fetch_contacts`, `bulk_match`. |
| `app/services/connectors/ingestion.py` *(new)* | Provider-agnostic Neo4j writes: atomic UNWIND fill-only-empty + match-hierarchy dedup + Company MERGE; import (match-or-create) and enrich (fill-by-lead_id) paths; `get_leads_by_ids`. |
| `app/services/connectors/credentials.py` *(new)* | `Connector_Credentials` get/set/delete + `_ensure_connectors_indexes`. |
| `app/services/connectors/runs.py` *(new)* | Import-batch lifecycle (reuses `Lead_Stream_Files`) + enrich run-doc lifecycle (`Connector_Enrich_Runs`) with stale-run failover. |
| `app/services/connectors/orchestrator.py` *(new)* | Router-facing service functions + the two `BackgroundTasks` bodies (`_run_import`, `_run_enrich`). |
| `app/services/connectors/__init__.py` *(new)* | Public re-exports (house pattern) incl. `_ensure_connectors_indexes`, `_run_import`, `_run_enrich`. |
| `app/routers/connectors.py` *(new)* | `APIRouter(prefix="/connectors")` — connect/status/disconnect/lists/import/enrich/enrich-status. |
| `app/main.py` *(edit, additive)* | Lifespan `_ensure_connectors_indexes` call + `include_router(connectors.router)`. |
| `app/services/leads/persistence.py` + `app/models/leads.py` *(edit, additive)* | Surface `matched_count`/`source`/`capped` on the stream-status read so import batches show created-vs-matched (spec §5.5). |

> **Note on `orchestrator.py`:** Spec §4's table maps the *seams* (apollo/normalize/ingestion/runs/credentials), not the glue. `orchestrator.py` holds the router-facing service functions + task bodies, matching the `leads/` and `market_scoring/` packages which both have an `orchestrator.py`. It is the connector's only stateful-orchestration module; `ingestion.py` stays pure writes and `runs.py` stays pure tracking, as the spec requires.

> **Deviations from spec §12.1.** §12.1 says "the only edit to an existing file is a one-line `include_router` in `main.py`." That under-counts. This plan makes **four** additive, backward-compatible edits to existing files: `app/core/exceptions.py` (Task 1 — append connector exception leaves), `app/main.py` (Task 11 — `include_router` **plus** a lifespan `_ensure_connectors_indexes` import+call), `app/models/leads.py` and `app/services/leads/persistence.py` (Task 12 — optional stream-status fields + passthrough). None change existing behavior; all are required to deliver §5.5's created-vs-matched surface and the index/wiring.

> **Dependency graph / parallelization waves.** The task list below is the canonical serial order, but for `subagent-driven-development` the dependencies allow parallel waves:
> - **Wave 1 (independent):** Task 1 (exceptions), Task 2 (models), Task 3 (normalize).
> - **Wave 2 (each depends only on Wave 1):** Task 4 (apollo → 1), Task 5 (ingestion → 3), Task 6 (credentials → 1), Task 7 (runs → 1).
> - **Then strictly serial:** Task 8 (→ 4,5,6,7) → Task 9 (→ 8) → Task 10 (→ 9) → Task 11 (→ 10) → Task 13 (→ all) → Task 14 (→ 13). Task 12 is independent of 8–11 and can run any time after Task 3.
> Tasks within a wave create distinct new files (Task 1's only existing-file edit is isolated), so they don't collide.

---

## Task 1: Connector exceptions (additive)

**Files:**
- Modify: `app/core/exceptions.py` (append new leaves)
- Test: `tests/unit/test_connectors_exceptions.py`

These subclass the existing status-family bases, so the handlers already registered in `app/main.py` route them automatically via Python's exception MRO — **no `main.py` handler edit needed.**

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test_connectors_exceptions.py`:

```python
"""Connector exception leaves must subclass the right status-family bases
so app/main.py's existing handlers route them by MRO."""
from app.core.exceptions import (
    NotFoundError,
    ServiceError,
    ValidationError,
    ConnectorNotConnectedError,
    ConnectorCredentialsInvalidError,
    ApolloAPIError,
    ApolloCreditsExhaustedError,
    ConnectorEnrichRunNotFoundError,
)


def test_not_connected_is_404_family():
    assert issubclass(ConnectorNotConnectedError, NotFoundError)


def test_enrich_run_not_found_is_404_family():
    assert issubclass(ConnectorEnrichRunNotFoundError, NotFoundError)


def test_invalid_credentials_is_400_family():
    assert issubclass(ConnectorCredentialsInvalidError, ValidationError)


def test_apollo_api_error_is_500_family():
    assert issubclass(ApolloAPIError, ServiceError)


def test_credits_exhausted_is_500_family():
    assert issubclass(ApolloCreditsExhaustedError, ServiceError)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_exceptions.py -v`
Expected: FAIL — `ImportError: cannot import name 'ConnectorNotConnectedError'`.

- [ ] **Step 3: Append the exceptions**

Append to the end of `app/core/exceptions.py`:

```python


# ─── Connector leaves (Apollo + future adapters) ───

class ConnectorNotConnectedError(NotFoundError):
    """No stored credentials for the given (org_id, provider). → 404."""


class ConnectorEnrichRunNotFoundError(NotFoundError):
    """No connector enrichment run found for the given org_id/run_id. → 404."""


class ConnectorCredentialsInvalidError(ValidationError):
    """A supplied connector API key was rejected by the provider on validation. → 400."""


class ApolloAPIError(ServiceError):
    """Unexpected failure talking to the Apollo API (non-credit, non-auth). → 500."""


class ApolloCreditsExhaustedError(ServiceError):
    """Apollo reported the account is out of enrichment credits. → 500.
    Background tasks catch this and end the run `partial` rather than surfacing 500."""
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_exceptions.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/core/exceptions.py backend/tests/unit/test_connectors_exceptions.py
git commit -m "feat(be): add connector exception leaves for apollo integration"
```

---

## Task 2: Pydantic models

**Files:**
- Create: `app/models/connectors.py`
- Test: `tests/unit/test_connectors_models.py`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test_connectors_models.py`:

```python
"""Connector request/response model contracts."""
import pytest
from pydantic import ValidationError as PydanticValidationError

from app.models.connectors import (
    ApolloConnectRequest,
    ApolloEnrichRequest,
    ApolloImportRequest,
)


def test_connect_request_requires_api_key():
    req = ApolloConnectRequest(org_id="o", user_id="u", api_key="k")
    assert req.api_key == "k"
    with pytest.raises(PydanticValidationError):
        ApolloConnectRequest(org_id="o", user_id="u")  # missing api_key


def test_import_request_optional_filters_default_none():
    req = ApolloImportRequest(org_id="o", user_id="u")
    assert req.list_id is None
    assert req.label is None


def test_enrich_request_reveal_defaults():
    req = ApolloEnrichRequest(org_id="o", user_id="u", lead_ids=["l1", "l2"])
    assert req.reveal_personal_emails is True
    assert req.reveal_phone_number is False
    assert req.lead_ids == ["l1", "l2"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.connectors'`.

- [ ] **Step 3: Create the models**

Create `app/models/connectors.py`:

```python
"""Pydantic request/response models for the Apollo connector router."""
from typing import List, Optional

from pydantic import BaseModel


# ─── Connection ───

class ApolloConnectRequest(BaseModel):
    org_id: str
    user_id: str
    api_key: str


class ApolloConnectResponse(BaseModel):
    connected: bool
    status: str


class ApolloStatusResponse(BaseModel):
    connected: bool
    status: str
    connected_at: Optional[str] = None


class DisconnectResponse(BaseModel):
    status: str
    message: str


# ─── Lists ───

class ApolloListEntry(BaseModel):
    id: str
    name: str


class ApolloListsResponse(BaseModel):
    lists: List[ApolloListEntry]


# ─── Import ───

class ApolloImportRequest(BaseModel):
    org_id: str
    user_id: str
    list_id: Optional[str] = None   # Apollo list/label ID that FILTERS the search
    label: Optional[str] = None     # Brewra batch DISPLAY NAME (Lead_Stream_Files.filename)


class ApolloImportResponse(BaseModel):
    file_id: str
    status: str


# ─── Enrichment ───

class ApolloEnrichRequest(BaseModel):
    org_id: str
    user_id: str
    lead_ids: List[str]
    reveal_personal_emails: bool = True
    reveal_phone_number: bool = False


class ApolloEnrichResponse(BaseModel):
    run_id: str
    status: str


class ApolloEnrichStatusResponse(BaseModel):
    run_id: str
    org_id: str
    status: str
    total: int
    processed: int
    updated: int
    unmatched: int
    failed: int
    progress_percent: float
    errors: List[str]
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_models.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/models/connectors.py backend/tests/unit/test_connectors_models.py
git commit -m "feat(be): add apollo connector pydantic models"
```

---

## Task 3: Normalization (Apollo raw → canonical lead dict)

**Files:**
- Create: `app/services/connectors/__init__.py` (empty for now — package marker)
- Create: `app/services/connectors/normalize.py`
- Test: `tests/unit/test_connectors_normalize.py`

`normalize.py` is pure (no I/O). It defines `CANONICAL_FIELDS` (the fill-only-empty set) and converts one Apollo contact/person JSON object into a flat record carrying: the canonical fields, derived dedup keys (`email_norm`, `company_domain_norm`), `apollo_contact_id`, and `apollo_raw` (the full record JSON-encoded to a **string** — Neo4j cannot store nested maps; `leads/normalization._process_neo4j_lead_records` re-parses JSON-looking strings on read).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test_connectors_normalize.py`:

```python
"""Pure normalization: Apollo raw record -> canonical lead dict."""
import json

from app.services.connectors.normalize import (
    CANONICAL_FIELDS,
    normalize_apollo_record,
    normalize_domain,
    normalize_email,
)


def test_normalize_email_lowers_and_trims():
    assert normalize_email("  John.Doe@Example.COM ") == "john.doe@example.com"
    assert normalize_email("") is None
    assert normalize_email(None) is None


def test_normalize_domain_strips_scheme_path_www():
    assert normalize_domain("https://www.Example.com/about") == "example.com"
    assert normalize_domain("Example.com") == "example.com"
    assert normalize_domain("") is None
    assert normalize_domain(None) is None


def test_normalize_record_maps_core_fields():
    raw = {
        "id": "apollo-123",
        "first_name": "Jane",
        "last_name": "Roe",
        "title": "VP Sales",
        "seniority": "vp",
        "email": "Jane.Roe@ACME.com",
        "linkedin_url": "https://linkedin.com/in/janeroe",
        "city": "Berlin",
        "state": "BE",
        "country": "Germany",
        "organization": {"name": "Acme GmbH", "primary_domain": "acme.com"},
        "phone_numbers": [{"sanitized_number": "+49123"}],
    }
    rec = normalize_apollo_record(raw)
    assert rec["apollo_contact_id"] == "apollo-123"
    assert rec["first_name"] == "Jane"
    assert rec["last_name"] == "Roe"
    assert rec["name"] == "Jane Roe"
    assert rec["title"] == "VP Sales"
    assert rec["email"] == "Jane.Roe@ACME.com"          # raw value preserved
    assert rec["email_norm"] == "jane.roe@acme.com"      # derived dedup key
    assert rec["company_name"] == "Acme GmbH"
    assert rec["company_domain"] == "acme.com"
    assert rec["company_domain_norm"] == "acme.com"
    assert rec["phone"] == "+49123"
    assert rec["location"] == "Berlin, BE, Germany"
    # every canonical field is present (None when absent)
    for f in CANONICAL_FIELDS:
        assert f in rec
    # raw is preserved as a JSON STRING (Neo4j-storable)
    assert isinstance(rec["apollo_raw"], str)
    assert json.loads(rec["apollo_raw"])["id"] == "apollo-123"


def test_company_domain_falls_back_to_email_domain():
    raw = {"id": "x", "email": "sam@beta.io", "organization": {"name": "Beta"}}
    rec = normalize_apollo_record(raw)
    assert rec["company_domain_norm"] == "beta.io"


def test_missing_fields_are_none_not_keyerror():
    rec = normalize_apollo_record({"id": "y"})
    assert rec["apollo_contact_id"] == "y"
    assert rec["email"] is None
    assert rec["email_norm"] is None
    assert rec["company_domain_norm"] is None
    assert rec["name"] is None


def test_non_dict_input_is_tolerated():
    # A malformed Apollo row (None / list) must not crash the background task.
    rec = normalize_apollo_record(None)
    assert rec["apollo_contact_id"] is None
    assert rec["email"] is None
    assert normalize_apollo_record(["x"])["name"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_normalize.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.connectors'`.

- [ ] **Step 3: Create the package marker + normalize.py**

Create `app/services/connectors/__init__.py` as an **empty file** (no content — real re-exports land in Task 9).

Create `app/services/connectors/normalize.py`:

```python
"""Pure normalization helpers — Apollo raw record -> Brewra canonical lead dict.

No I/O. The output dict is consumed by ingestion.py. `apollo_raw` is JSON-encoded
to a string because Neo4j properties cannot hold nested maps; the leads read-path
(`leads/normalization._process_neo4j_lead_records`) re-parses JSON-looking strings.
"""
import json
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

# The fill-only-empty canonical set written flat onto the Lead node (spec §5.1).
CANONICAL_FIELDS: List[str] = [
    "name",
    "first_name",
    "last_name",
    "email",
    "title",
    "seniority",
    "company_name",
    "company_domain",
    "phone",
    "linkedin_url",
    "location",
]


def normalize_email(value: Optional[str]) -> Optional[str]:
    """lower(trim(email)); empty/None -> None."""
    if not value or not isinstance(value, str):
        return None
    cleaned = value.strip().lower()
    return cleaned or None


def normalize_domain(value: Optional[str]) -> Optional[str]:
    """Strip scheme/path/`www.`, lowercase. empty/None -> None."""
    if not value or not isinstance(value, str):
        return None
    raw = value.strip().lower()
    if not raw:
        return None
    if "://" in raw:
        raw = urlparse(raw).netloc or urlparse(raw).path
    raw = raw.split("/")[0]
    if raw.startswith("www."):
        raw = raw[4:]
    return raw or None


def _domain_from_email(email_norm: Optional[str]) -> Optional[str]:
    if not email_norm or "@" not in email_norm:
        return None
    return email_norm.split("@", 1)[1] or None


def _compose_name(first: Optional[str], last: Optional[str], full: Optional[str]) -> Optional[str]:
    if full and str(full).strip():
        return str(full).strip()
    parts = [p for p in [first, last] if p and str(p).strip()]
    return " ".join(str(p).strip() for p in parts) or None


def _first_phone(raw: Dict[str, Any]) -> Optional[str]:
    phones = raw.get("phone_numbers") or []
    if isinstance(phones, list):
        for p in phones:
            if isinstance(p, dict):
                num = p.get("sanitized_number") or p.get("raw_number") or p.get("number")
                if num:
                    return str(num)
    direct = raw.get("phone") or raw.get("sanitized_phone")
    return str(direct) if direct else None


def _location(raw: Dict[str, Any]) -> Optional[str]:
    parts = [raw.get("city"), raw.get("state"), raw.get("country")]
    parts = [str(p).strip() for p in parts if p and str(p).strip()]
    return ", ".join(parts) or None


def normalize_apollo_record(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Map one Apollo contact/person object to a flat canonical record.

    NOTE: exact Apollo field names are confirmed against recorded fixtures at
    implementation time (spec open question). Mapping is `.get()`-tolerant so a
    missing field yields None rather than KeyError.
    """
    if not isinstance(raw, dict):
        raw = {}
    org = raw.get("organization") or {}
    if not isinstance(org, dict):
        org = {}

    email = raw.get("email")
    email_norm = normalize_email(email)

    company_name = org.get("name") or raw.get("organization_name")
    company_domain_raw = (
        org.get("primary_domain")
        or org.get("website_url")
        or raw.get("organization_domain")
    )
    company_domain = normalize_domain(company_domain_raw)
    company_domain_norm = company_domain or normalize_domain(_domain_from_email(email_norm))

    record: Dict[str, Any] = {
        "name": _compose_name(raw.get("first_name"), raw.get("last_name"), raw.get("name")),
        "first_name": raw.get("first_name"),
        "last_name": raw.get("last_name"),
        "email": email,
        "title": raw.get("title"),
        "seniority": raw.get("seniority"),
        "company_name": company_name,
        "company_domain": company_domain,
        "phone": _first_phone(raw),
        "linkedin_url": raw.get("linkedin_url"),
        "location": _location(raw),
        # derived dedup keys + bookkeeping
        "email_norm": email_norm,
        "company_domain_norm": company_domain_norm,
        "apollo_contact_id": str(raw["id"]) if raw.get("id") is not None else None,
        "apollo_raw": json.dumps(raw, default=str),
    }
    return record
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_normalize.py -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/connectors/__init__.py backend/app/services/connectors/normalize.py backend/tests/unit/test_connectors_normalize.py
git commit -m "feat(be): add apollo record normalization (canonical mapping + dedup keys)"
```

---

## Task 4: ApolloConnector (HTTP funnel, retry/backoff, endpoints)

**Files:**
- Create: `app/services/connectors/apollo.py`
- Test: `tests/unit/test_connectors_apollo.py`

`apollo.py` is the only module that knows Apollo exists. All HTTP goes through one module-level seam `_http_request(...)` (a thin `requests.request` wrapper) so tests patch a single site (`app.services.connectors.apollo._http_request`) per `TESTING.md`. Backoff sleeps through `_sleep` (patchable). Credit-free validation uses `GET /labels` — **never** a match/enrich call.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test_connectors_apollo.py`:

```python
"""ApolloConnector against fake HTTP responses (no live API).
The single network seam is app.services.connectors.apollo._http_request."""
import pytest

from app.core.exceptions import (
    ApolloAPIError,
    ApolloCreditsExhaustedError,
    ConnectorCredentialsInvalidError,
)
from app.services.connectors import apollo as apollo_mod
from app.services.connectors.apollo import ApolloConnector


class FakeResp:
    def __init__(self, status_code=200, json_body=None, text=""):
        self.status_code = status_code
        self._json = json_body if json_body is not None else {}
        self.text = text

    def json(self):
        return self._json


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch):
    """Never actually sleep during backoff tests."""
    monkeypatch.setattr(apollo_mod, "_sleep", lambda _s: None)


def test_validate_credentials_uses_labels_get_not_a_match_call(monkeypatch):
    calls = []

    def fake_http(method, url, **kwargs):
        calls.append((method, url))
        return FakeResp(200, {"labels": []})

    monkeypatch.setattr(apollo_mod, "_http_request", fake_http)
    ApolloConnector("key").validate_credentials()

    assert len(calls) == 1
    method, url = calls[0]
    assert method == "GET"
    assert url.endswith("/labels")  # credit-free; not /people/bulk_match


def test_validate_credentials_401_raises_invalid(monkeypatch):
    monkeypatch.setattr(apollo_mod, "_http_request", lambda *a, **k: FakeResp(401, text="unauthorized"))
    with pytest.raises(ConnectorCredentialsInvalidError):
        ApolloConnector("bad").validate_credentials()


def test_429_retries_then_succeeds(monkeypatch):
    seq = [FakeResp(429, text="slow down"), FakeResp(429), FakeResp(200, {"labels": [{"id": "1", "name": "A"}]})]
    monkeypatch.setattr(apollo_mod, "_http_request", lambda *a, **k: seq.pop(0))
    lists = ApolloConnector("key").list_collections()
    assert lists == [{"id": "1", "name": "A"}]
    assert seq == []  # all three consumed


def test_429_exhausts_retries_raises(monkeypatch):
    monkeypatch.setattr(apollo_mod, "_http_request", lambda *a, **k: FakeResp(429, text="rate limited"))
    with pytest.raises(ApolloAPIError):
        ApolloConnector("key").list_collections()


def test_402_raises_credits_exhausted(monkeypatch):
    monkeypatch.setattr(apollo_mod, "_http_request", lambda *a, **k: FakeResp(402, text="insufficient credits"))
    with pytest.raises(ApolloCreditsExhaustedError):
        ApolloConnector("key").bulk_match([{"email": "a@b.com"}], reveal_personal_emails=True, reveal_phone_number=False)


def test_fetch_contacts_paginates_and_yields_pages(monkeypatch):
    pages = {
        1: {"contacts": [{"id": "1"}, {"id": "2"}], "pagination": {"page": 1, "total_pages": 2}},
        2: {"contacts": [{"id": "3"}], "pagination": {"page": 2, "total_pages": 2}},
    }

    def fake_http(method, url, **kwargs):
        page = kwargs["json"]["page"]
        return FakeResp(200, pages[page])

    monkeypatch.setattr(apollo_mod, "_http_request", fake_http)
    collected = list(ApolloConnector("key").fetch_contacts(list_id="L1"))
    assert [len(p) for p in collected] == [2, 1]
    assert collected[0][0]["id"] == "1"


def test_bulk_match_rejects_oversized_chunk(monkeypatch):
    monkeypatch.setattr(apollo_mod, "_http_request", lambda *a, **k: FakeResp(200, {"matches": []}))
    with pytest.raises(ValueError):
        ApolloConnector("key").bulk_match(
            [{"email": f"{i}@x.com"} for i in range(11)],
            reveal_personal_emails=True,
            reveal_phone_number=False,
        )


def test_bulk_match_sends_reveal_flags_and_details(monkeypatch):
    captured = {}

    def fake_http(method, url, **kwargs):
        captured["url"] = url
        captured["json"] = kwargs["json"]
        return FakeResp(200, {"matches": [{"id": "m1"}]})

    monkeypatch.setattr(apollo_mod, "_http_request", fake_http)
    out = ApolloConnector("key").bulk_match(
        [{"email": "a@b.com"}], reveal_personal_emails=True, reveal_phone_number=False
    )
    assert out == [{"id": "m1"}]
    assert captured["url"].endswith("/people/bulk_match")
    assert captured["json"]["reveal_personal_emails"] is True
    assert captured["json"]["reveal_phone_number"] is False
    assert captured["json"]["details"] == [{"email": "a@b.com"}]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_apollo.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.connectors.apollo'`.

- [ ] **Step 3: Create apollo.py**

Create `app/services/connectors/apollo.py`:

```python
"""Concrete Apollo.io connector — the only Apollo-aware code in the backend.

All HTTP funnels through the module-level `_http_request` seam (thin requests
wrapper) so tests patch one site. 429s are retried with exponential backoff via
the patchable `_sleep`. The API key is passed in (from credentials.py), never
read from config.
"""
import logging
import random
import time
from typing import Any, Dict, Iterator, List, Optional

import requests

from app.core.exceptions import (
    ApolloAPIError,
    ApolloCreditsExhaustedError,
    ConnectorCredentialsInvalidError,
)

logger = logging.getLogger(__name__)

APOLLO_BASE_URL = "https://api.apollo.io/api/v1"
CONTACTS_PAGE_SIZE = 100
BULK_MATCH_CHUNK = 10

# 429 backoff (spec §8): base 1s, factor 2, max 30s, jitter, <=5 retries.
_BACKOFF_BASE_SECONDS = 1.0
_BACKOFF_FACTOR = 2.0
_BACKOFF_MAX_SECONDS = 30.0
_MAX_RETRIES = 5

_DEFAULT_TIMEOUT = 30

# Patchable seams (tests override these two names on this module).
_sleep = time.sleep


def _http_request(method: str, url: str, **kwargs) -> requests.Response:
    """Thin wrapper over requests.request — the single network seam."""
    return requests.request(method, url, **kwargs)


class ApolloConnector:
    """Concrete connector. Documented method surface (spec §4): validate_credentials,
    fetch_contacts, bulk_match, list_collections. No ABC in v1."""

    def __init__(self, api_key: str, *, timeout: int = _DEFAULT_TIMEOUT):
        self._api_key = api_key
        self._timeout = timeout

    def _headers(self) -> Dict[str, str]:
        return {
            "x-api-key": self._api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Issue one Apollo call with 429 backoff; raise typed exceptions on error."""
        url = f"{APOLLO_BASE_URL}{path}"
        delay = _BACKOFF_BASE_SECONDS
        last_status = None
        for attempt in range(_MAX_RETRIES + 1):
            resp = _http_request(
                method,
                url,
                headers=self._headers(),
                params=params,
                json=json,
                timeout=self._timeout,
            )
            last_status = resp.status_code
            if resp.status_code == 429:
                if attempt >= _MAX_RETRIES:
                    break
                sleep_for = min(delay, _BACKOFF_MAX_SECONDS) + random.uniform(0, 0.5)
                logger.warning("Apollo 429 on %s; backing off %.2fs (attempt %d)", path, sleep_for, attempt + 1)
                _sleep(sleep_for)
                delay *= _BACKOFF_FACTOR
                continue
            if resp.status_code in (401, 403):
                raise ConnectorCredentialsInvalidError(
                    f"Apollo rejected the API key ({resp.status_code})."
                )
            if resp.status_code == 402 or (
                resp.status_code == 422 and "credit" in (resp.text or "").lower()
            ):
                raise ApolloCreditsExhaustedError(
                    f"Apollo credits exhausted ({resp.status_code})."
                )
            if resp.status_code >= 400:
                raise ApolloAPIError(
                    f"Apollo API error ({resp.status_code}) on {path}: {(resp.text or '')[:300]}"
                )
            return resp.json() or {}
        raise ApolloAPIError(
            f"Apollo API still rate-limited after {_MAX_RETRIES} retries on {path} (last status {last_status})."
        )

    # ─── Public surface ───

    def validate_credentials(self) -> None:
        """Credit-free auth check (GET /labels). Raises on a bad key."""
        self._request("GET", "/labels")

    def list_collections(self) -> List[Dict[str, str]]:
        """Return the customer's Apollo lists/labels as [{id, name}], paginated internally."""
        out: List[Dict[str, str]] = []
        page = 1
        while True:
            body = self._request("GET", "/labels", params={"page": page, "per_page": 100})
            labels = body.get("labels") or body.get("data") or []
            for lab in labels:
                if isinstance(lab, dict) and lab.get("id") is not None:
                    out.append({"id": str(lab["id"]), "name": str(lab.get("name") or lab["id"])})
            pagination = body.get("pagination") or {}
            total_pages = int(pagination.get("total_pages") or 1)
            if page >= total_pages or not labels:
                break
            page += 1
        return out

    def fetch_contacts(self, list_id: Optional[str] = None) -> Iterator[List[Dict[str, Any]]]:
        """Yield pages (lists) of raw Apollo contact dicts from /contacts/search.

        list_id filters by Apollo label; omit to pull all of the org's contacts.
        """
        page = 1
        while True:
            payload: Dict[str, Any] = {"page": page, "per_page": CONTACTS_PAGE_SIZE}
            if list_id:
                payload["label_ids"] = [list_id]
            body = self._request("POST", "/contacts/search", json=payload)
            contacts = body.get("contacts") or []
            if contacts:
                yield contacts
            pagination = body.get("pagination") or {}
            total_pages = int(pagination.get("total_pages") or 1)
            if page >= total_pages or not contacts:
                break
            page += 1

    def bulk_match(
        self,
        entries: List[Dict[str, Any]],
        *,
        reveal_personal_emails: bool,
        reveal_phone_number: bool,
    ) -> List[Dict[str, Any]]:
        """Match up to 10 person-detail dicts via /people/bulk_match.

        Returns the `matches` list, index-aligned with `entries` (Apollo returns a
        slot per input; a no-match slot is null/empty).
        """
        if len(entries) > BULK_MATCH_CHUNK:
            raise ValueError(f"bulk_match accepts at most {BULK_MATCH_CHUNK} entries per call")
        body = self._request(
            "POST",
            "/people/bulk_match",
            json={
                "details": entries,
                "reveal_personal_emails": reveal_personal_emails,
                "reveal_phone_number": reveal_phone_number,
            },
        )
        return body.get("matches") or []
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_apollo.py -v`
Expected: PASS (8 passed).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/connectors/apollo.py backend/tests/unit/test_connectors_apollo.py
git commit -m "feat(be): add ApolloConnector (http funnel, 429 backoff, contacts/labels/bulk_match)"
```

---

## Task 5: Ingestion (atomic fill-only-empty + dedup + Company MERGE)

**Files:**
- Create: `app/services/connectors/ingestion.py`
- Test: `tests/unit/test_connectors_ingestion.py`

This is the net-new write primitive (spec §5.3). Two public functions share one fill-clause + Company-MERGE fragment (so enrichment touches Company identically, per §5.2):

- `upsert_imported_leads(...)` — **import**: per chunk, in one write transaction, fill-only-empty UPDATE existing leads matched by `email_norm` → `apollo_contact_id`; CREATE the residue (new `lead_id`, `file_id` set **only here**). Intra-batch duplicates are collapsed first.
- `enrich_fill_leads(...)` — **enrich**: fill-only-empty by **target `lead_id`** (the lead we sent to Apollo); never creates. Unmatched (Apollo returned nothing) leads are filtered out by the caller before this is called.

The match/create *decision* runs in Python (`_dedupe_import_records`) and inside the transaction function, so it is unit-testable with a small fake driver that actually executes the tx body. Cypher field names come from the fixed `CANONICAL_FIELDS` allowlist (safe to f-string; no user-controlled identifiers).

> **Interpretation note (spec §5.3/§6.1):** the §5.3 *match hierarchy* (email → apollo_contact_id → create/unmatched) governs the **import** write. For **enrich**, the Apollo result is already bound to a specific Brewra `lead_id` (the lead we sent to `bulk_match`), so the write is keyed by `lead_id`; "unmatched" means Apollo returned no person for that entry, which the orchestrator (Task 8) filters out before calling `enrich_fill_leads`. Both paths share the same coalesce fill-clause + Company-MERGE, satisfying §5.2's "same ingestion upsert path."

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test_connectors_ingestion.py`:

```python
"""Ingestion partition/dedup + tx behavior against a fake Neo4j driver that
actually runs the transaction function body."""
from app.services.connectors import ingestion
from app.services.connectors.ingestion import _dedupe_import_records, get_leads_by_ids
from tests.identities import TEST_ORG_ID, TEST_USER_ID


class FakeTx:
    """Records tx.run calls; returns canned 'matched idx' rows keyed off the Cypher
    comment marker, so the test never depends on free-form Cypher text (review F9)."""
    def __init__(self, matched_idxs):
        self.calls = []
        self._matched = set(matched_idxs)

    def run(self, query, **params):
        self.calls.append((query, params))
        rows = params.get("rows", [])
        if "connector:import-update" in query:
            return [{"idx": r["idx"]} for r in rows if r["idx"] in self._matched]
        if "connector:enrich-update" in query:
            # enrich matches by lead_id; the fake treats every target lead as present
            return [{"idx": r["idx"]} for r in rows]
        return []  # import-create returns nothing


class FakeSession:
    def __init__(self, tx):
        self._tx = tx

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute_write(self, fn, *a, **k):
        return fn(self._tx, *a, **k)

    def execute_read(self, fn, *a, **k):
        return fn(self._tx, *a, **k)


class FakeDriver:
    def __init__(self, tx):
        self._tx = tx

    def session(self):
        return FakeSession(self._tx)


def _rec(idx, email_norm=None, apollo_id=None):
    return {
        "name": f"n{idx}", "first_name": None, "last_name": None,
        "email": (email_norm or None), "title": None, "seniority": None,
        "company_name": None, "company_domain": None, "phone": None,
        "linkedin_url": None, "location": None,
        "email_norm": email_norm, "company_domain_norm": None,
        "apollo_contact_id": apollo_id, "apollo_raw": "{}",
    }


def test_dedupe_keeps_first_per_email_then_contact_id():
    recs = [_rec(0, email_norm="a@x.com"), _rec(1, email_norm="a@x.com"), _rec(2, apollo_id="c9")]
    out = _dedupe_import_records(recs)
    assert len(out) == 2
    assert out[0]["email_norm"] == "a@x.com"
    assert out[1]["apollo_contact_id"] == "c9"


def test_dedupe_keeps_records_without_any_key():
    recs = [_rec(0), _rec(1)]  # no email, no apollo id
    out = _dedupe_import_records(recs)
    assert len(out) == 2  # nothing to dedup on -> both kept


def test_import_creates_residue_and_counts_matches():
    # idx 0 matches an existing lead; idx 1 does not -> created.
    tx = FakeTx(matched_idxs={0})
    driver = FakeDriver(tx)
    records = [_rec(0, email_norm="a@x.com"), _rec(1, email_norm="b@x.com")]
    result = ingestion.upsert_imported_leads(
        driver, TEST_ORG_ID, TEST_USER_ID, records, file_id="file-1", source="apollo", chunk_size=500
    )
    assert result["matched"] == 1
    assert result["created"] == 1
    assert result["errors"] == []
    # A CREATE query ran carrying exactly the residue row with a minted lead_id.
    create_calls = [c for c in tx.calls if "connector:import-create" in c[0]]
    assert len(create_calls) == 1
    created_rows = create_calls[0][1]["rows"]
    assert len(created_rows) == 1
    assert created_rows[0]["email_norm"] == "b@x.com"
    assert created_rows[0]["lead_id"]  # minted


def test_import_all_matched_creates_nothing():
    tx = FakeTx(matched_idxs={0, 1})
    driver = FakeDriver(tx)
    records = [_rec(0, email_norm="a@x.com"), _rec(1, email_norm="b@x.com")]
    result = ingestion.upsert_imported_leads(
        driver, TEST_ORG_ID, TEST_USER_ID, records, file_id="file-1"
    )
    assert result["matched"] == 2
    assert result["created"] == 0
    assert [c for c in tx.calls if "connector:import-create" in c[0]] == []


def test_enrich_fill_updates_by_lead_id():
    tx = FakeTx(matched_idxs=set())  # enrich-update returns all rows regardless
    driver = FakeDriver(tx)
    rec = _rec(0, email_norm="a@x.com")
    rec["lead_id"] = "lead-7"
    result = ingestion.enrich_fill_leads(driver, TEST_ORG_ID, [rec], source="apollo")
    assert result["updated"] == 1
    # the enrich query is identified by its marker and matches by lead_id
    enrich_calls = [c for c in tx.calls if "connector:enrich-update" in c[0]]
    assert len(enrich_calls) == 1
    assert enrich_calls[0][1]["rows"][0]["lead_id"] == "lead-7"


def test_get_leads_by_ids_builds_query(monkeypatch):
    captured = {}

    class _Sess:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def run(self, q, **p):
            captured["q"] = q
            captured["p"] = p
            return []

    class _Drv:
        def session(self): return _Sess()

    # _records_to_dicts is defined in ingestion; patch where used.
    monkeypatch.setattr(ingestion, "_records_to_dicts", lambda r: [])
    get_leads_by_ids(_Drv(), TEST_ORG_ID, ["l1", "l2"])
    assert captured["p"]["org_id"] == TEST_ORG_ID
    assert captured["p"]["lead_ids"] == ["l1", "l2"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_ingestion.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.connectors.ingestion'`.

- [ ] **Step 3: Create ingestion.py**

Create `app/services/connectors/ingestion.py`:

```python
"""Provider-agnostic lead/company writes for connectors (spec §5.2, §5.3).

Operates on the normalized canonical dict (not on a connector type). Holds no
run-doc/connector state. Fill-only-empty is implemented as atomic UNWIND-batched
Cypher (`CASE WHEN existing IS NULL/'' THEN incoming`), explicitly NOT
read-modify-write (which is not atomic under concurrent runs).
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.connectors.normalize import CANONICAL_FIELDS

logger = logging.getLogger(__name__)

# Fill-only-empty: overwrite ONLY when the existing value is null/empty AND an
# incoming value exists. Field names come from the fixed CANONICAL_FIELDS allowlist.
_FILL_CLAUSE = ",\n    ".join(
    f"l.{f} = CASE WHEN (l.{f} IS NULL OR l.{f} = '') AND row.{f} IS NOT NULL "
    f"THEN row.{f} ELSE l.{f} END"
    for f in CANONICAL_FIELDS
)

# Plain assignment for newly created nodes (no existing value to protect).
_CREATE_SET_CLAUSE = ",\n    ".join(f"l.{f} = row.{f}" for f in CANONICAL_FIELDS)

# Company MERGE-by-domain + Has_Lead link. Runs per (row, l) after a WITH.
_COMPANY_MERGE = """
FOREACH (_ IN CASE WHEN row.company_domain_norm IS NOT NULL AND row.company_domain_norm <> ''
                   THEN [1] ELSE [] END |
    MERGE (c:Company {org_id: $org_id, domain_norm: row.company_domain_norm})
    ON CREATE SET c.domain = row.company_domain, c.name = row.company_name, c.created_at = $now
    MERGE (c)-[:Has_Lead]->(l)
)
"""

# Import: match existing leads by email_norm then apollo_contact_id, fill-only-empty.
_IMPORT_UPDATE_CYPHER = f"""
/* connector:import-update */
UNWIND $rows AS row
MATCH (l:Lead {{org_id: $org_id}})
WHERE (row.email_norm IS NOT NULL AND row.email_norm <> ''
       AND toLower(trim(coalesce(l.email, ''))) = row.email_norm)
   OR (row.apollo_contact_id IS NOT NULL AND row.apollo_contact_id <> ''
       AND l.apollo_contact_id = row.apollo_contact_id)
SET {_FILL_CLAUSE},
    l.apollo_contact_id = coalesce(l.apollo_contact_id, row.apollo_contact_id),
    l.email_norm = coalesce(l.email_norm, row.email_norm),
    l.company_domain_norm = coalesce(l.company_domain_norm, row.company_domain_norm),
    l.source = coalesce(l.source, $source),
    l.apollo_raw = coalesce(row.apollo_raw, l.apollo_raw),
    l.last_imported_at = $now
WITH DISTINCT row, l
{_COMPANY_MERGE}
RETURN DISTINCT row.idx AS idx
"""

# Import: create the residue (no existing match). file_id set ONLY here (spec §5.3).
_IMPORT_CREATE_CYPHER = f"""
/* connector:import-create */
UNWIND $rows AS row
CREATE (l:Lead {{lead_id: row.lead_id, org_id: $org_id}})
SET l.user_id = $user_id,
    {_CREATE_SET_CLAUSE},
    l.email_norm = row.email_norm,
    l.company_domain_norm = row.company_domain_norm,
    l.apollo_contact_id = row.apollo_contact_id,
    l.apollo_raw = row.apollo_raw,
    l.source = $source,
    l.file_id = $file_id,
    l.stage = 'Initial Outreach',
    l.created_at = $now,
    l.last_imported_at = $now
WITH l, row
{_COMPANY_MERGE}
"""

# Enrich: fill-only-empty onto a KNOWN target lead_id; never creates.
_ENRICH_UPDATE_CYPHER = f"""
/* connector:enrich-update */
UNWIND $rows AS row
MATCH (l:Lead {{org_id: $org_id, lead_id: row.lead_id}})
SET {_FILL_CLAUSE},
    l.apollo_contact_id = coalesce(l.apollo_contact_id, row.apollo_contact_id),
    l.email_norm = coalesce(l.email_norm, row.email_norm),
    l.company_domain_norm = coalesce(l.company_domain_norm, row.company_domain_norm),
    l.source = coalesce(l.source, $source),
    l.apollo_raw = coalesce(row.apollo_raw, l.apollo_raw),
    l.last_enriched_at = $now
WITH row, l
{_COMPANY_MERGE}
RETURN row.idx AS idx
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _chunks(items: List[Any], size: int):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def _dedupe_import_records(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Collapse intra-batch duplicates: keep first per email_norm, then per
    apollo_contact_id. Records with neither key are always kept."""
    seen_email = set()
    seen_contact = set()
    out: List[Dict[str, Any]] = []
    for rec in records:
        email = rec.get("email_norm")
        contact = rec.get("apollo_contact_id")
        if email:
            if email in seen_email:
                continue
            seen_email.add(email)
        elif contact:
            if contact in seen_contact:
                continue
            seen_contact.add(contact)
        out.append(rec)
    return out


def _import_chunk_tx(tx, org_id, user_id, chunk, file_id, source, now):
    """Atomic: fill-only-empty UPDATE matched leads, then CREATE the residue."""
    result = tx.run(_IMPORT_UPDATE_CYPHER, rows=chunk, org_id=org_id, source=source, now=now)
    matched_idxs = {record["idx"] for record in result}
    to_create = [r for r in chunk if r["idx"] not in matched_idxs]
    for rec in to_create:
        rec["lead_id"] = str(uuid.uuid4())
    if to_create:
        tx.run(
            _IMPORT_CREATE_CYPHER,
            rows=to_create,
            org_id=org_id,
            user_id=user_id,
            file_id=file_id,
            source=source,
            now=now,
        )
    return {"matched": len(matched_idxs), "created": len(to_create)}


def _enrich_chunk_tx(tx, org_id, chunk, source, now):
    result = tx.run(_ENRICH_UPDATE_CYPHER, rows=chunk, org_id=org_id, source=source, now=now)
    return {"updated": len({record["idx"] for record in result})}


def upsert_imported_leads(
    driver,
    org_id: str,
    user_id: str,
    records: List[Dict[str, Any]],
    *,
    file_id: str,
    source: str = "apollo",
    chunk_size: int = 500,
) -> Dict[str, Any]:
    """Import: dedup, then per-chunk atomic match-or-create. Returns counts."""
    deduped = _dedupe_import_records(records)
    for i, rec in enumerate(deduped):
        rec["idx"] = i
    now = _now()
    matched = created = 0
    errors: List[str] = []
    for chunk in _chunks(deduped, chunk_size):
        try:
            with driver.session() as session:
                out = session.execute_write(
                    _import_chunk_tx, org_id, user_id, chunk, file_id, source, now
                )
            matched += out["matched"]
            created += out["created"]
        except Exception as e:  # noqa: BLE001 — isolate a bad chunk, keep importing
            errors.append(str(e)[:300])
            logger.error("Import chunk failed (org_id=%s file_id=%s): %s", org_id, file_id, e)
    return {"matched": matched, "created": created, "errors": errors[:10]}


def enrich_fill_leads(
    driver,
    org_id: str,
    records: List[Dict[str, Any]],
    *,
    source: str = "apollo",
    chunk_size: int = 500,
) -> Dict[str, Any]:
    """Enrich: fill-only-empty by target lead_id. Each record must carry lead_id."""
    for i, rec in enumerate(records):
        rec["idx"] = i
    now = _now()
    updated = 0
    errors: List[str] = []
    for chunk in _chunks(records, chunk_size):
        try:
            with driver.session() as session:
                out = session.execute_write(_enrich_chunk_tx, org_id, chunk, source, now)
            updated += out["updated"]
        except Exception as e:  # noqa: BLE001
            errors.append(str(e)[:300])
            logger.error("Enrich chunk failed (org_id=%s): %s", org_id, e)
    return {"updated": updated, "errors": errors[:10]}


def _records_to_dicts(results) -> List[Dict[str, Any]]:
    """Deserialize Neo4j `RETURN l` Lead records into plain dicts (JSON-looking
    string properties re-parsed). Inlined to keep the connector package free of a
    private cross-package import from leads.normalization (review F4)."""
    leads: List[Dict[str, Any]] = []
    for record in results:
        lead_dict = dict(record["l"].items())
        processed: Dict[str, Any] = {}
        for key, value in lead_dict.items():
            if isinstance(value, str) and value.strip().startswith(("{", "[")):
                try:
                    processed[key] = json.loads(value)
                except json.JSONDecodeError:
                    processed[key] = value
            else:
                processed[key] = value
        leads.append(processed)
    return leads


def get_leads_by_ids(driver, org_id: str, lead_ids: List[str]) -> List[Dict[str, Any]]:
    """Load Lead nodes by id within an org (for building enrichment match entries)."""
    if not lead_ids:
        return []
    with driver.session() as session:
        result = session.run(
            """
            MATCH (l:Lead {org_id: $org_id})
            WHERE l.lead_id IN $lead_ids
            RETURN l
            """,
            org_id=org_id,
            lead_ids=lead_ids,
        )
        return _records_to_dicts(result)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_ingestion.py -v`
Expected: PASS (7 passed).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/connectors/ingestion.py backend/tests/unit/test_connectors_ingestion.py
git commit -m "feat(be): add connector ingestion (atomic fill-only-empty, dedup, company merge)"
```

---

## Task 6: Credentials (per-org store + connector indexes)

**Files:**
- Create: `app/services/connectors/credentials.py`
- Test: `tests/unit/test_connectors_credentials.py`

Stores one doc per `(org_id, provider)` in `Profiler.Connector_Credentials`. Unencrypted by design (spec §5.4 — conscious MVP risk). `_ensure_connectors_indexes` creates indexes for both connector collections (credentials + enrich runs), called once from the lifespan.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test_connectors_credentials.py`:

```python
"""Credential store against a fake Mongo (dict-backed collection)."""
import pytest

from app.core.exceptions import ConnectorNotConnectedError
from app.services.connectors import credentials
from tests.identities import TEST_ORG_ID


class FakeCollection:
    def __init__(self):
        self.docs = []
        self.indexes = []

    def create_index(self, keys, **kwargs):
        self.indexes.append((keys, kwargs))

    def update_one(self, flt, update, upsert=False):
        for d in self.docs:
            if all(d.get(k) == v for k, v in flt.items()):
                d.update(update.get("$set", {}))
                d.update(update.get("$setOnInsert", {}))
                return
        if upsert:
            doc = dict(flt)
            doc.update(update.get("$set", {}))
            doc.update(update.get("$setOnInsert", {}))
            self.docs.append(doc)

    def find_one(self, flt):
        for d in self.docs:
            if all(d.get(k) == v for k, v in flt.items()):
                return dict(d)
        return None

    def delete_one(self, flt):
        before = len(self.docs)
        self.docs = [d for d in self.docs if not all(d.get(k) == v for k, v in flt.items())]

        class _R:
            deleted_count = before - len(self.docs)
        return _R()


class _Proxy:
    """Profiler[<coll>] -> FakeCollection (stable per name)."""
    def __init__(self, store):
        self._store = store

    def __getitem__(self, coll_name):
        return self._store.setdefault(coll_name, FakeCollection())


class FakeMongo:
    def __init__(self):
        self._store = {}

    def __getitem__(self, _db_name):
        return _Proxy(self._store)


def test_save_then_get():
    m = FakeMongo()
    credentials.save_credentials(m, TEST_ORG_ID, "apollo", "secret-key")
    doc = credentials.get_credentials(m, TEST_ORG_ID, "apollo")
    assert doc["api_key"] == "secret-key"
    assert doc["status"] == "connected"
    assert doc["connected_at"]


def test_get_api_key_raises_when_missing():
    m = FakeMongo()
    with pytest.raises(ConnectorNotConnectedError):
        credentials.get_api_key(m, TEST_ORG_ID, "apollo")


def test_get_api_key_returns_stored():
    m = FakeMongo()
    credentials.save_credentials(m, TEST_ORG_ID, "apollo", "k2")
    assert credentials.get_api_key(m, TEST_ORG_ID, "apollo") == "k2"


def test_delete_credentials():
    m = FakeMongo()
    credentials.save_credentials(m, TEST_ORG_ID, "apollo", "k3")
    assert credentials.delete_credentials(m, TEST_ORG_ID, "apollo") is True
    assert credentials.get_credentials(m, TEST_ORG_ID, "apollo") is None


def test_set_status():
    m = FakeMongo()
    credentials.save_credentials(m, TEST_ORG_ID, "apollo", "k4")
    credentials.set_status(m, TEST_ORG_ID, "apollo", "error")
    assert credentials.get_credentials(m, TEST_ORG_ID, "apollo")["status"] == "error"


def test_ensure_indexes_idempotent():
    m = FakeMongo()
    credentials._ensure_connectors_indexes(m)  # should not raise
    credentials._ensure_connectors_indexes(m)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_credentials.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.connectors.credentials'`.

- [ ] **Step 3: Create credentials.py**

Create `app/services/connectors/credentials.py`:

```python
"""Per-org connector credential storage (Mongo Profiler.Connector_Credentials).

One doc per (org_id, provider). Stored unencrypted by deliberate MVP posture
(spec §5.4 — conscious risk acceptance; do NOT add encryption/authz here).
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.core.exceptions import ConnectorNotConnectedError

CREDENTIALS_COLLECTION = "Connector_Credentials"
ENRICH_RUNS_COLLECTION = "Connector_Enrich_Runs"


def _coll(mongo):
    return mongo["Profiler"][CREDENTIALS_COLLECTION]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_connectors_indexes(mongo) -> None:
    """Create Mongo indexes for the connector collections.
    Idempotent — `create_index` is a no-op when an equivalent index exists.
    """
    if mongo is None:
        return
    creds = mongo["Profiler"][CREDENTIALS_COLLECTION]
    creds.create_index([("org_id", 1), ("provider", 1)], unique=True)

    runs = mongo["Profiler"][ENRICH_RUNS_COLLECTION]
    runs.create_index([("org_id", 1), ("status", 1)])
    runs.create_index([("org_id", 1), ("created_at", -1)])
    runs.create_index("run_id", unique=True)


def save_credentials(mongo, org_id: str, provider: str, api_key: str, status: str = "connected") -> Dict[str, Any]:
    now = _now()
    _coll(mongo).update_one(
        {"org_id": org_id, "provider": provider},
        {
            "$set": {
                "org_id": org_id,
                "provider": provider,
                "api_key": api_key,
                "status": status,
                "updated_at": now,
            },
            "$setOnInsert": {"connected_at": now},
        },
        upsert=True,
    )
    return {"org_id": org_id, "provider": provider, "status": status, "connected_at": now}


def get_credentials(mongo, org_id: str, provider: str) -> Optional[Dict[str, Any]]:
    doc = _coll(mongo).find_one({"org_id": org_id, "provider": provider})
    if doc:
        doc.pop("_id", None)
    return doc


def get_api_key(mongo, org_id: str, provider: str = "apollo") -> str:
    doc = get_credentials(mongo, org_id, provider)
    if not doc or not doc.get("api_key"):
        raise ConnectorNotConnectedError(f"No {provider} credentials connected for this org.")
    return str(doc["api_key"])


def set_status(mongo, org_id: str, provider: str, status: str) -> None:
    _coll(mongo).update_one(
        {"org_id": org_id, "provider": provider},
        {"$set": {"status": status, "updated_at": _now()}},
    )


def delete_credentials(mongo, org_id: str, provider: str) -> bool:
    result = _coll(mongo).delete_one({"org_id": org_id, "provider": provider})
    return bool(getattr(result, "deleted_count", 0))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_credentials.py -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/connectors/credentials.py backend/tests/unit/test_connectors_credentials.py
git commit -m "feat(be): add per-org connector credential store + indexes"
```

---

## Task 7: Run tracking (import batches + enrich run-docs)

**Files:**
- Create: `app/services/connectors/runs.py`
- Test: `tests/unit/test_connectors_runs.py`

Import batches reuse `Profiler.Lead_Stream_Files` (same collection `batch_upload_leads` writes), adding `source`, `matched_count`, `capped`. Enrich runs use a new `Profiler.Connector_Enrich_Runs` doc mirroring the market-scoring run-doc, with `_is_stale_queued_run` failover (300s). All writes go through `runs.py`; ingestion stays pure.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test_connectors_runs.py`:

```python
"""Import-batch + enrich run-doc lifecycle against a fake Mongo collection."""
import pytest

from app.core.exceptions import ConnectorEnrichRunNotFoundError
from app.services.connectors import runs
from tests.identities import TEST_ORG_ID, TEST_USER_ID


class FakeCollection:
    def __init__(self):
        self.docs = []

    def insert_one(self, doc):
        self.docs.append(dict(doc))

    def update_one(self, flt, update, upsert=False):
        for d in self.docs:
            if all(d.get(k) == v for k, v in flt.items()):
                d.update(update.get("$set", {}))
                return
        if upsert:
            doc = dict(flt)
            doc.update(update.get("$set", {}))
            self.docs.append(doc)

    def find_one(self, flt, sort=None):
        def _match(d):
            for k, v in flt.items():
                if isinstance(v, dict) and "$in" in v:
                    if d.get(k) not in v["$in"]:
                        return False
                elif d.get(k) != v:
                    return False
            return True

        matches = [d for d in self.docs if _match(d)]
        if sort:
            key, direction = sort[0]
            matches.sort(key=lambda d: d.get(key) or "", reverse=(direction < 0))
        return dict(matches[0]) if matches else None


class _Proxy:
    def __init__(self, store):
        self._store = store

    def __getitem__(self, coll_name):
        return self._store.setdefault(coll_name, FakeCollection())


class FakeMongo:
    def __init__(self):
        self._store = {}

    def __getitem__(self, _db_name):
        return _Proxy(self._store)


def test_import_batch_create_then_complete():
    m = FakeMongo()
    file_id = runs.create_import_batch(m, TEST_ORG_ID, TEST_USER_ID, "My Apollo Batch")
    assert file_id
    coll = m["Profiler"]["Lead_Stream_Files"]
    doc = coll.find_one({"file_id": file_id})
    assert doc["processing_status"] == "processing"
    assert doc["source"] == "apollo"
    assert doc["filename"] == "My Apollo Batch"

    runs.complete_import_batch(
        m, file_id, total_rows=10, created_count=7, matched_count=3, error_count=0, capped=False
    )
    doc = coll.find_one({"file_id": file_id})
    assert doc["processing_status"] == "completed"
    assert doc["created_count"] == 7
    assert doc["matched_count"] == 3
    assert doc["capped"] is False


def test_import_batch_fail():
    m = FakeMongo()
    file_id = runs.create_import_batch(m, TEST_ORG_ID, TEST_USER_ID, "X")
    runs.fail_import_batch(m, file_id, "bad key")
    doc = m["Profiler"]["Lead_Stream_Files"].find_one({"file_id": file_id})
    assert doc["processing_status"] == "failed"
    assert "bad key" in doc["message"]


def test_enrich_run_create_process_complete():
    m = FakeMongo()
    run_id = runs.create_enrich_run(m, TEST_ORG_ID, TEST_USER_ID, total=5)
    assert run_id
    runs.mark_enrich_processing(m, run_id)
    runs.update_enrich_progress(m, run_id, processed=3, updated=2, unmatched=1, failed=0, errors=[])
    runs.complete_enrich_run(m, run_id, processed=5, updated=4, unmatched=1, failed=0, errors=[])
    doc = runs.get_enrich_run(m, TEST_ORG_ID, run_id)
    assert doc["status"] == "completed"
    assert doc["processed"] == 5
    assert doc["updated"] == 4
    assert doc["unmatched"] == 1
    assert doc["progress_percent"] == 100.0


def test_get_enrich_run_missing_raises():
    m = FakeMongo()
    with pytest.raises(ConnectorEnrichRunNotFoundError):
        runs.get_enrich_run(m, TEST_ORG_ID, "nope")


def test_stale_queued_run_detection():
    assert runs._is_stale_queued_run(
        {"status": "queued", "started_at": None, "created_at": "2000-01-01T00:00:00+00:00", "updated_at": None}
    ) is True
    assert runs._is_stale_queued_run({"status": "processing"}) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_runs.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.connectors.runs'`.

- [ ] **Step 3: Create runs.py**

Create `app/services/connectors/runs.py`:

```python
"""Connector run/batch tracking — separate from writes (ingestion.py).

Import batches reuse Profiler.Lead_Stream_Files (so the existing by-file CRUD +
stream-status surface lights up); enrich runs use Profiler.Connector_Enrich_Runs,
mirroring the market-scoring run-doc + stale-run failover (spec §5.5).
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.exceptions import ConnectorEnrichRunNotFoundError

logger = logging.getLogger(__name__)

LEAD_STREAM_FILES_COLLECTION = "Lead_Stream_Files"
ENRICH_RUNS_COLLECTION = "Connector_Enrich_Runs"

_STALE_AFTER_SECONDS = 300


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


# ─── Import batches (Lead_Stream_Files) ───

def _files_coll(mongo):
    return mongo["Profiler"][LEAD_STREAM_FILES_COLLECTION]


def create_import_batch(mongo, org_id: str, user_id: str, filename: str) -> str:
    """Mint a file_id and insert a 'processing' Lead_Stream_Files doc (apollo source)."""
    file_id = str(uuid.uuid4())
    now = _now()
    _files_coll(mongo).insert_one({
        "file_id": file_id,
        "user_id": user_id,
        "org_id": org_id,
        "filename": filename,
        "source": "apollo",
        "uploaded_at": now,
        "processing_status": "processing",
        "total_rows": 0,
        "created_count": 0,
        "matched_count": 0,
        "error_count": 0,
        "capped": False,
        "last_processed_at": now,
    })
    return file_id


def update_import_filename(mongo, file_id: str, filename: str) -> None:
    _files_coll(mongo).update_one({"file_id": file_id}, {"$set": {"filename": filename}})


def update_import_progress(mongo, file_id: str, *, created_count: int, matched_count: int, error_count: int) -> None:
    _files_coll(mongo).update_one(
        {"file_id": file_id},
        {"$set": {
            "created_count": created_count,
            "matched_count": matched_count,
            "error_count": error_count,
            "last_processed_at": _now(),
        }},
    )


def complete_import_batch(
    mongo, file_id: str, *, total_rows: int, created_count: int, matched_count: int,
    error_count: int, capped: bool, message: Optional[str] = None,
) -> None:
    fields = {
        "processing_status": "completed",
        "total_rows": total_rows,
        "created_count": created_count,
        "matched_count": matched_count,
        "error_count": error_count,
        "capped": capped,
        "last_processed_at": _now(),
    }
    if message:
        fields["message"] = message
    _files_coll(mongo).update_one({"file_id": file_id}, {"$set": fields})


def fail_import_batch(mongo, file_id: str, message: str) -> None:
    _files_coll(mongo).update_one(
        {"file_id": file_id},
        {"$set": {"processing_status": "failed", "message": message, "last_processed_at": _now()}},
    )


# ─── Enrich runs (Connector_Enrich_Runs) ───

def _runs_coll(mongo):
    return mongo["Profiler"][ENRICH_RUNS_COLLECTION]


def _is_stale_queued_run(run_doc: Dict[str, Any], stale_after_seconds: int = _STALE_AFTER_SECONDS) -> bool:
    if str(run_doc.get("status", "")).lower() != "queued":
        return False
    if run_doc.get("started_at"):
        return False
    reference = _parse_iso(run_doc.get("updated_at")) or _parse_iso(run_doc.get("created_at"))
    if reference is None:
        return True
    return (datetime.now(timezone.utc) - reference).total_seconds() >= stale_after_seconds


def create_enrich_run(mongo, org_id: str, user_id: str, total: int) -> str:
    run_id = str(uuid.uuid4())
    now = _now()
    _runs_coll(mongo).insert_one({
        "run_id": run_id,
        "org_id": org_id,
        "user_id": user_id,
        "status": "queued",
        "total": total,
        "processed": 0,
        "updated": 0,
        "unmatched": 0,
        "failed": 0,
        "errors": [],
        "created_at": now,
        "updated_at": now,
        "started_at": None,
        "finished_at": None,
    })
    return run_id


def _update_run(mongo, run_id: str, **fields) -> None:
    fields["updated_at"] = _now()
    _runs_coll(mongo).update_one({"run_id": run_id}, {"$set": fields})


def mark_enrich_processing(mongo, run_id: str) -> None:
    _update_run(mongo, run_id, status="processing", started_at=_now())


def update_enrich_progress(mongo, run_id: str, *, processed: int, updated: int, unmatched: int, failed: int, errors: List[str]) -> None:
    _update_run(mongo, run_id, processed=processed, updated=updated, unmatched=unmatched, failed=failed, errors=errors[:10])


def complete_enrich_run(mongo, run_id: str, *, processed: int, updated: int, unmatched: int, failed: int, errors: List[str], status: str = "completed") -> None:
    _update_run(
        mongo, run_id, status=status, processed=processed, updated=updated,
        unmatched=unmatched, failed=failed, errors=errors[:10], finished_at=_now(),
    )


def fail_enrich_run(mongo, run_id: str, message: str) -> None:
    _update_run(mongo, run_id, status="failed", errors=[message[:300]], finished_at=_now())


def fail_stale_enrich_runs(mongo, org_id: str) -> None:
    """Mark a stale queued/processing run for the org as failed (market-scoring pattern)."""
    coll = _runs_coll(mongo)
    active = coll.find_one(
        {"org_id": org_id, "status": {"$in": ["queued", "processing"]}},
        sort=[("created_at", -1)],
    )
    if active and _is_stale_queued_run(active):
        now = _now()
        coll.update_one(
            {"run_id": active["run_id"]},
            {"$set": {
                "status": "failed",
                "errors": ["Run auto-failed: remained queued without starting."],
                "updated_at": now,
                "finished_at": now,
            }},
        )
        logger.warning("Failed stale enrich run org_id=%s run_id=%s", org_id, active.get("run_id"))


def get_enrich_run(mongo, org_id: str, run_id: Optional[str]) -> Dict[str, Any]:
    flt: Dict[str, Any] = {"org_id": org_id}
    if run_id:
        flt["run_id"] = run_id
    doc = _runs_coll(mongo).find_one(flt, sort=[("created_at", -1)])
    if not doc:
        raise ConnectorEnrichRunNotFoundError("No enrichment run found for org_id")
    doc.pop("_id", None)
    total = int(doc.get("total") or 0)
    processed = int(doc.get("processed") or 0)
    denom = max(total, 1)
    doc["progress_percent"] = round(min(100.0, (processed / denom) * 100.0), 2)
    return doc
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_runs.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/connectors/runs.py backend/tests/unit/test_connectors_runs.py
git commit -m "feat(be): add connector run tracking (import batches + enrich run-docs + stale failover)"
```

---

## Task 8: Orchestrator (service functions + background-task bodies)

**Files:**
- Create: `app/services/connectors/orchestrator.py`
- Test: `tests/unit/test_connectors_orchestrator.py`

The glue: router-facing functions (`connect_apollo`, `get_apollo_status`, `disconnect_apollo`, `list_apollo_lists`, `start_apollo_import`, `start_apollo_enrich`, `get_apollo_enrich_status`) plus the two `BackgroundTasks` bodies (`_run_import`, `_run_enrich`). It accesses the sibling modules **through module imports** (`from app.services.connectors import apollo as apollo_mod`, etc.) so a single patch on `orchestrator.apollo_mod.ApolloConnector` / `orchestrator.ingestion` intercepts every caller (patch-where-used, `TESTING.md`).

> **Required pre-step (spec open item, elevated per plan-review F2): confirm `bulk_match` result alignment.** Before implementing `_run_enrich`'s write-back, confirm against a recorded Apollo `/people/bulk_match` response that results come back **in request order, one slot per input** (null for a no-match). The code below pairs results to leads positionally and adds a hard `len(matches) != len(chunk)` guard that **skips a chunk rather than miswrite**. If the fixture shows Apollo returns **same-count-but-reordered** or keyed results (which the length guard cannot catch), switch the pairing from `zip` to a keyed lookup (correlate on a per-entry token / returned `id`) **before** relying on it. A wrong-lead write is data corruption, not a missing feature.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test_connectors_orchestrator.py`:

```python
"""Orchestrator service functions + task bodies with fakes for every sibling seam."""
import pytest

from app.core.exceptions import ConnectorCredentialsInvalidError, ConnectorNotConnectedError
from app.services.connectors import orchestrator
from app.models.connectors import (
    ApolloConnectRequest,
    ApolloEnrichRequest,
    ApolloImportRequest,
)
from tests.identities import TEST_ORG_ID, TEST_USER_ID, TEST_LEAD_ID_1, TEST_LEAD_ID_2


class FakeConnector:
    instances = []

    def __init__(self, api_key, **kw):
        self.api_key = api_key
        self.validated = False
        FakeConnector.instances.append(self)

    def validate_credentials(self):
        if self.api_key == "bad":
            raise ConnectorCredentialsInvalidError("nope")
        self.validated = True

    def list_collections(self):
        return [{"id": "L1", "name": "List One"}]

    def fetch_contacts(self, list_id=None):
        # validate-on-use: a bad key surfaces on the first call (generator body)
        if self.api_key == "bad":
            raise ConnectorCredentialsInvalidError("bad")
        yield [{"id": "c1", "email": "a@x.com"}, {"id": "c2", "email": "b@x.com"}]

    def bulk_match(self, entries, *, reveal_personal_emails, reveal_phone_number):
        # echo a match per entry that has an email; otherwise no match
        return [{"id": "m" + str(i), "email": e.get("email")} if e.get("email") else None
                for i, e in enumerate(entries)]


@pytest.fixture(autouse=True)
def _reset():
    FakeConnector.instances = []
    yield


@pytest.fixture
def patched(monkeypatch):
    """Patch the ApolloConnector seam the orchestrator reaches through."""
    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", FakeConnector)
    yield


class _FakeBT:
    def __init__(self):
        self.tasks = []

    def add_task(self, fn, *args, **kwargs):
        self.tasks.append((fn, args, kwargs))


# ─── connection ───

def test_connect_validates_and_saves(monkeypatch, patched):
    saved = {}
    monkeypatch.setattr(orchestrator.credentials, "save_credentials",
                        lambda m, o, p, k, **kw: saved.update({"org": o, "key": k}) or {"status": "connected"})
    out = orchestrator.connect_apollo(object(), ApolloConnectRequest(org_id=TEST_ORG_ID, user_id=TEST_USER_ID, api_key="good"))
    assert out["connected"] is True
    assert saved["key"] == "good"


def test_connect_bad_key_raises_and_does_not_save(monkeypatch, patched):
    calls = []
    monkeypatch.setattr(orchestrator.credentials, "save_credentials", lambda *a, **k: calls.append(1))
    with pytest.raises(ConnectorCredentialsInvalidError):
        orchestrator.connect_apollo(object(), ApolloConnectRequest(org_id=TEST_ORG_ID, user_id=TEST_USER_ID, api_key="bad"))
    assert calls == []


def test_status_disconnected(monkeypatch):
    monkeypatch.setattr(orchestrator.credentials, "get_credentials", lambda m, o, p: None)
    out = orchestrator.get_apollo_status(object(), TEST_ORG_ID)
    assert out == {"connected": False, "status": "disconnected", "connected_at": None}


def test_lists_requires_connection(monkeypatch, patched):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key",
                        lambda m, o, p="apollo": (_ for _ in ()).throw(ConnectorNotConnectedError("x")))
    with pytest.raises(ConnectorNotConnectedError):
        orchestrator.list_apollo_lists(object(), TEST_ORG_ID)


def test_lists_returns_collections(monkeypatch, patched):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    out = orchestrator.list_apollo_lists(object(), TEST_ORG_ID)
    assert out == {"lists": [{"id": "L1", "name": "List One"}]}


# ─── import scheduling ───

def test_start_import_requires_connection(monkeypatch):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key",
                        lambda m, o, p="apollo": (_ for _ in ()).throw(ConnectorNotConnectedError("x")))
    bt = _FakeBT()
    with pytest.raises(ConnectorNotConnectedError):
        orchestrator.start_apollo_import(object(), object(),
                                         ApolloImportRequest(org_id=TEST_ORG_ID, user_id=TEST_USER_ID), bt)


def test_start_import_mints_batch_and_schedules(monkeypatch):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    monkeypatch.setattr(orchestrator.runs, "create_import_batch", lambda m, o, u, name: "file-xyz")
    bt = _FakeBT()
    out = orchestrator.start_apollo_import(object(), object(),
                                           ApolloImportRequest(org_id=TEST_ORG_ID, user_id=TEST_USER_ID, label="My Batch"), bt)
    assert out == {"file_id": "file-xyz", "status": "queued"}
    assert bt.tasks and bt.tasks[0][0] is orchestrator._run_import


# ─── enrich scheduling ───

def test_start_enrich_creates_run_and_schedules(monkeypatch):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    monkeypatch.setattr(orchestrator.runs, "fail_stale_enrich_runs", lambda m, o: None)
    monkeypatch.setattr(orchestrator.runs, "create_enrich_run", lambda m, o, u, total: "run-1")
    bt = _FakeBT()
    out = orchestrator.start_apollo_enrich(object(), object(),
                                           ApolloEnrichRequest(org_id=TEST_ORG_ID, user_id=TEST_USER_ID, lead_ids=[TEST_LEAD_ID_1, TEST_LEAD_ID_2]), bt)
    assert out == {"run_id": "run-1", "status": "queued"}
    assert bt.tasks[0][0] is orchestrator._run_enrich


# ─── task body: import ───

def test_run_import_happy_path(monkeypatch, patched):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    progress = {}
    monkeypatch.setattr(orchestrator.runs, "update_import_progress", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.runs, "update_import_filename", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.runs, "complete_import_batch",
                        lambda m, fid, **k: progress.update(k))
    monkeypatch.setattr(orchestrator.ingestion, "upsert_imported_leads",
                        lambda *a, **k: {"created": 2, "matched": 0, "errors": []})

    orchestrator._run_import(object(), object(), TEST_ORG_ID, TEST_USER_ID, "file-1", list_id="L1", label="My Batch")
    assert progress["created_count"] == 2
    assert progress["total_rows"] == 2
    assert progress["capped"] is False


def test_run_import_bad_key_fails_batch(monkeypatch, patched):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "bad")
    monkeypatch.setattr(orchestrator.credentials, "set_status", lambda *a, **k: None)
    failed = {}
    monkeypatch.setattr(orchestrator.runs, "fail_import_batch", lambda m, fid, msg: failed.update({"msg": msg}))
    # label given + no list_id -> first connector call is fetch_contacts, which raises on "bad"
    orchestrator._run_import(object(), object(), TEST_ORG_ID, TEST_USER_ID, "file-1", list_id=None, label="X")
    assert "msg" in failed


# ─── task body: enrich ───

def test_run_enrich_happy_path(monkeypatch, patched):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    monkeypatch.setattr(orchestrator.runs, "mark_enrich_processing", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.runs, "update_enrich_progress", lambda *a, **k: None)
    completed = {}
    monkeypatch.setattr(orchestrator.runs, "complete_enrich_run", lambda m, rid, **k: completed.update(k))
    monkeypatch.setattr(orchestrator.ingestion, "get_leads_by_ids",
                        lambda d, o, ids: [{"lead_id": TEST_LEAD_ID_1, "email": "a@x.com", "first_name": "A"}])
    monkeypatch.setattr(orchestrator.ingestion, "enrich_fill_leads",
                        lambda *a, **k: {"updated": 1, "errors": []})

    orchestrator._run_enrich(object(), object(), TEST_ORG_ID, TEST_USER_ID, "run-1",
                             [TEST_LEAD_ID_1], reveal_personal_emails=True, reveal_phone_number=False)
    assert completed["updated"] == 1
    assert completed["status"] == "completed"


def test_run_enrich_count_mismatch_skips_chunk_no_miswrite(monkeypatch, patched):
    # bulk_match returning fewer results than inputs must NOT positional-zip (review F2).
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    monkeypatch.setattr(orchestrator.runs, "mark_enrich_processing", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.runs, "update_enrich_progress", lambda *a, **k: None)
    completed = {}
    monkeypatch.setattr(orchestrator.runs, "complete_enrich_run", lambda m, rid, **k: completed.update(k))
    monkeypatch.setattr(orchestrator.ingestion, "get_leads_by_ids",
                        lambda d, o, ids: [{"lead_id": "L1", "email": "a@x.com"}, {"lead_id": "L2", "email": "b@x.com"}])
    wrote = []
    monkeypatch.setattr(orchestrator.ingestion, "enrich_fill_leads",
                        lambda *a, **k: wrote.append(a) or {"updated": 0, "errors": []})

    class _MismatchConnector(FakeConnector):
        def bulk_match(self, entries, *, reveal_personal_emails, reveal_phone_number):
            return [{"id": "only-one"}]  # 1 result for 2 inputs

    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _MismatchConnector)

    orchestrator._run_enrich(object(), object(), TEST_ORG_ID, TEST_USER_ID, "run-1",
                             ["L1", "L2"], reveal_personal_emails=True, reveal_phone_number=False)
    assert completed["unmatched"] == 2
    assert completed["updated"] == 0
    assert wrote == []  # never attempted a write
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_orchestrator.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.connectors.orchestrator'`.

- [ ] **Step 3: Create orchestrator.py**

Create `app/services/connectors/orchestrator.py`:

```python
"""Apollo connector orchestration — router-facing service functions + the two
BackgroundTasks bodies. Sibling modules are reached via module imports so a
single test patch intercepts every caller (patch-where-used; TESTING.md).
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import BackgroundTasks

from app.core.exceptions import (
    ApolloCreditsExhaustedError,
    BrewraError,
    ConnectorCredentialsInvalidError,
)
from app.models.connectors import (
    ApolloConnectRequest,
    ApolloEnrichRequest,
    ApolloImportRequest,
)
from app.services.connectors import apollo as apollo_mod
from app.services.connectors import credentials
from app.services.connectors import ingestion
from app.services.connectors import runs
from app.services.connectors.normalize import normalize_apollo_record

logger = logging.getLogger(__name__)

IMPORT_RECORD_CAP = 25_000  # spec §8 hard per-import cap
INGEST_CHUNK_SIZE = 500


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Connection ───

def connect_apollo(mongo, request: ApolloConnectRequest) -> Dict[str, Any]:
    """Validate the key (credit-free) then store it. Raises on a bad key (no save)."""
    connector = apollo_mod.ApolloConnector(request.api_key)
    connector.validate_credentials()  # raises ConnectorCredentialsInvalidError on bad key
    credentials.save_credentials(mongo, request.org_id, "apollo", request.api_key, status="connected")
    return {"connected": True, "status": "connected"}


def get_apollo_status(mongo, org_id: str) -> Dict[str, Any]:
    doc = credentials.get_credentials(mongo, org_id, "apollo")
    if not doc:
        return {"connected": False, "status": "disconnected", "connected_at": None}
    return {
        "connected": doc.get("status") == "connected",
        "status": str(doc.get("status") or "disconnected"),
        "connected_at": doc.get("connected_at"),
    }


def disconnect_apollo(mongo, org_id: str) -> Dict[str, Any]:
    removed = credentials.delete_credentials(mongo, org_id, "apollo")
    return {
        "status": "disconnected" if removed else "not_connected",
        "message": "Apollo disconnected." if removed else "No Apollo connection to remove.",
    }


def list_apollo_lists(mongo, org_id: str) -> Dict[str, Any]:
    api_key = credentials.get_api_key(mongo, org_id, "apollo")  # raises if not connected
    connector = apollo_mod.ApolloConnector(api_key)
    return {"lists": connector.list_collections()}


# ─── Import ───

def start_apollo_import(driver, mongo, request: ApolloImportRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    credentials.get_api_key(mongo, request.org_id, "apollo")  # ensure connected (raises 404 otherwise)
    filename = request.label or f"Apollo import {_now()}"
    file_id = runs.create_import_batch(mongo, request.org_id, request.user_id, filename)
    background_tasks.add_task(
        _run_import, driver, mongo, request.org_id, request.user_id, file_id, request.list_id, request.label,
    )
    return {"file_id": file_id, "status": "queued"}


def _run_import(driver, mongo, org_id, user_id, file_id, list_id, label) -> None:
    """Background body: pull Apollo contacts → normalize → ingest → finalize batch."""
    try:
        api_key = credentials.get_api_key(mongo, org_id, "apollo")
        connector = apollo_mod.ApolloConnector(api_key)

        # If no explicit label and a list was chosen, name the batch after the list.
        if not label and list_id:
            try:
                for lst in connector.list_collections():
                    if lst["id"] == str(list_id):
                        runs.update_import_filename(mongo, file_id, lst["name"])
                        break
            except BrewraError as e:
                logger.warning("Could not resolve Apollo list name (file_id=%s): %s", file_id, e)

        total_rows = created = matched = error_count = 0
        capped = False
        for page in connector.fetch_contacts(list_id=list_id):
            if total_rows >= IMPORT_RECORD_CAP:
                capped = True
                break
            remaining = IMPORT_RECORD_CAP - total_rows
            page = page[:remaining]
            records = [normalize_apollo_record(raw) for raw in page]
            result = ingestion.upsert_imported_leads(
                driver, org_id, user_id, records, file_id=file_id, source="apollo", chunk_size=INGEST_CHUNK_SIZE,
            )
            created += result["created"]
            matched += result["matched"]
            error_count += len(result["errors"])
            total_rows += len(page)
            runs.update_import_progress(
                mongo, file_id, created_count=created, matched_count=matched, error_count=error_count,
            )

        message = None
        if capped:
            message = f"Reached the {IMPORT_RECORD_CAP:,}-record import cap; narrow by Apollo list to import the rest."
        runs.complete_import_batch(
            mongo, file_id, total_rows=total_rows, created_count=created, matched_count=matched,
            error_count=error_count, capped=capped, message=message,
        )
    except ConnectorCredentialsInvalidError as e:
        credentials.set_status(mongo, org_id, "apollo", "error")
        runs.fail_import_batch(mongo, file_id, f"Apollo credentials invalid: {e}")
    except BrewraError as e:
        runs.fail_import_batch(mongo, file_id, str(e))
    except Exception as e:  # noqa: BLE001
        logger.error("Apollo import failed (org_id=%s file_id=%s): %s", org_id, file_id, e)
        runs.fail_import_batch(mongo, file_id, str(e))


# ─── Enrichment ───

def start_apollo_enrich(driver, mongo, request: ApolloEnrichRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    credentials.get_api_key(mongo, request.org_id, "apollo")  # ensure connected
    runs.fail_stale_enrich_runs(mongo, request.org_id)
    run_id = runs.create_enrich_run(mongo, request.org_id, request.user_id, total=len(request.lead_ids))
    background_tasks.add_task(
        _run_enrich, driver, mongo, request.org_id, request.user_id, run_id,
        request.lead_ids, request.reveal_personal_emails, request.reveal_phone_number,
    )
    return {"run_id": run_id, "status": "queued"}


def get_apollo_enrich_status(mongo, org_id: str, run_id: Optional[str]) -> Dict[str, Any]:
    return runs.get_enrich_run(mongo, org_id, run_id)


def _build_match_entry(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Strongest identifier per spec §6.1: apollo_contact_id (exact) else identity fields."""
    contact_id = lead.get("apollo_contact_id")
    if contact_id:
        return {"id": str(contact_id)}
    entry: Dict[str, Any] = {}
    for key in ("email", "first_name", "last_name"):
        if lead.get(key):
            entry[key] = lead[key]
    if lead.get("company_name"):
        entry["organization_name"] = lead["company_name"]
    if lead.get("company_domain"):
        entry["domain"] = lead["company_domain"]
    return entry


def _run_enrich(driver, mongo, org_id, user_id, run_id, lead_ids, reveal_personal_emails, reveal_phone_number) -> None:
    """Background body: load leads → bulk_match in 10s → fill-only-empty write-back."""
    try:
        api_key = credentials.get_api_key(mongo, org_id, "apollo")
        connector = apollo_mod.ApolloConnector(api_key)
        leads = ingestion.get_leads_by_ids(driver, org_id, lead_ids)

        processed = updated = unmatched = failed = 0
        errors: List[str] = []
        runs.mark_enrich_processing(mongo, run_id)

        for i in range(0, len(leads), apollo_mod.BULK_MATCH_CHUNK):
            chunk = leads[i:i + apollo_mod.BULK_MATCH_CHUNK]
            entries = [_build_match_entry(lead) for lead in chunk]
            try:
                matches = connector.bulk_match(
                    entries,
                    reveal_personal_emails=reveal_personal_emails,
                    reveal_phone_number=reveal_phone_number,
                )
            except ApolloCreditsExhaustedError:
                runs.complete_enrich_run(
                    mongo, run_id, processed=processed, updated=updated, unmatched=unmatched,
                    failed=failed, errors=errors + ["Apollo credits exhausted."], status="partial",
                )
                return

            # Misalignment guard (review F2): bulk_match returns one slot per input in
            # request order. If the count differs, do NOT positional-zip (that would
            # write enrichment onto the WRONG leads) — treat the chunk as unmatched.
            if len(matches) != len(chunk):
                processed += len(chunk)
                unmatched += len(chunk)
                errors.append(
                    f"bulk_match returned {len(matches)} results for {len(chunk)} inputs; "
                    "chunk skipped to avoid miswrite."
                )
                runs.update_enrich_progress(
                    mongo, run_id, processed=processed, updated=updated,
                    unmatched=unmatched, failed=failed, errors=errors,
                )
                continue

            enrich_records: List[Dict[str, Any]] = []
            for lead, match in zip(chunk, matches):
                processed += 1
                if not match:
                    unmatched += 1
                    continue
                rec = normalize_apollo_record(match)
                rec["lead_id"] = lead["lead_id"]
                enrich_records.append(rec)

            if enrich_records:
                result = ingestion.enrich_fill_leads(driver, org_id, enrich_records, source="apollo", chunk_size=INGEST_CHUNK_SIZE)
                updated += result["updated"]
                failed += len(result["errors"])
                errors.extend(result["errors"])

            runs.update_enrich_progress(
                mongo, run_id, processed=processed, updated=updated, unmatched=unmatched, failed=failed, errors=errors,
            )

        runs.complete_enrich_run(
            mongo, run_id, processed=processed, updated=updated, unmatched=unmatched, failed=failed, errors=errors,
        )
    except ConnectorCredentialsInvalidError as e:
        credentials.set_status(mongo, org_id, "apollo", "error")
        runs.fail_enrich_run(mongo, run_id, f"Apollo credentials invalid: {e}")
    except BrewraError as e:
        runs.fail_enrich_run(mongo, run_id, str(e))
    except Exception as e:  # noqa: BLE001
        logger.error("Apollo enrich failed (org_id=%s run_id=%s): %s", org_id, run_id, e)
        runs.fail_enrich_run(mongo, run_id, str(e))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_orchestrator.py -v`
Expected: PASS (12 passed).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/connectors/orchestrator.py backend/tests/unit/test_connectors_orchestrator.py
git commit -m "feat(be): add apollo connector orchestrator (service fns + import/enrich task bodies)"
```

---

## Task 9: Package public API (`__init__.py` re-exports)

**Files:**
- Modify: `app/services/connectors/__init__.py` (replace the empty marker)
- Test: `tests/unit/test_connectors_package.py`

Follows the house pattern (`leads/__init__.py`, `market_scoring/__init__.py`): re-export router-facing functions + the `_`-prefix symbols external callers need (`_ensure_connectors_indexes` for the lifespan; `_run_import`/`_run_enrich` for patch targets).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test_connectors_package.py`:

```python
"""The connectors package re-exports its public + lifespan/test surface."""
import app.services.connectors as connectors


def test_public_surface_re_exported():
    for name in (
        "connect_apollo",
        "get_apollo_status",
        "disconnect_apollo",
        "list_apollo_lists",
        "start_apollo_import",
        "start_apollo_enrich",
        "get_apollo_enrich_status",
        "_ensure_connectors_indexes",
        "_run_import",
        "_run_enrich",
    ):
        assert hasattr(connectors, name), f"missing re-export: {name}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_package.py -v`
Expected: FAIL — `AssertionError: missing re-export: connect_apollo`.

- [ ] **Step 3: Replace `__init__.py`**

Replace the contents of `app/services/connectors/__init__.py`:

```python
"""connectors service — public API.

First third-party lead-source connector (Apollo). Submodules:
  - apollo.py:        ApolloConnector (the only Apollo-aware code)
  - normalize.py:     Apollo raw -> canonical lead dict (pure)
  - ingestion.py:     provider-agnostic Neo4j writes (atomic fill-only-empty + dedup + Company MERGE)
  - credentials.py:   per-org credential store + _ensure_connectors_indexes
  - runs.py:          import-batch + enrich run-doc tracking (stale-run failover)
  - orchestrator.py:  router-facing service fns + the two BackgroundTasks bodies

_-prefix re-exports for external callers: _ensure_connectors_indexes
(app/main.py lifespan), _run_import / _run_enrich (BackgroundTasks targets /
test patch sites). Per patch-where-used, tests target the caller's namespace.
"""

from app.services.connectors.orchestrator import (
    connect_apollo,
    get_apollo_status,
    disconnect_apollo,
    list_apollo_lists,
    start_apollo_import,
    start_apollo_enrich,
    get_apollo_enrich_status,
    _run_import,
    _run_enrich,
)
from app.services.connectors.credentials import _ensure_connectors_indexes

__all__ = [
    "connect_apollo",
    "get_apollo_status",
    "disconnect_apollo",
    "list_apollo_lists",
    "start_apollo_import",
    "start_apollo_enrich",
    "get_apollo_enrich_status",
    "_ensure_connectors_indexes",
    "_run_import",
    "_run_enrich",
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_connectors_package.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/services/connectors/__init__.py backend/tests/unit/test_connectors_package.py
git commit -m "feat(be): expose connectors package public + lifespan/test surface"
```

---

## Task 10: Router (`/connectors/apollo/*`)

**Files:**
- Create: `app/routers/connectors.py`
- Test: `tests/test_connectors.py` (router/integration, uses TestClient + dependency-override fixtures)

Blocking-Apollo endpoints (`/connect`, `/lists`) are sync `def` (FastAPI runs them in its threadpool so `requests` doesn't block the event loop). Import/enrich are `async def` and schedule `BackgroundTasks`. The router calls the service through the package facade (`connectors_service.<fn>`), so tests patch `connectors_service.<fn>` (the name the router actually calls). The router tests use a lightweight manual `dependency_overrides` (plain `object()` for driver/mongo) rather than the conftest `mock_neo4j`/`mock_mongo` fixtures **on purpose** (review F10): these tests stub the service layer entirely, so driver/mongo are never touched and a MagicMock would add nothing.

- [ ] **Step 1: Write the failing test**

Create `tests/test_connectors.py`:

```python
"""Router wiring for /connectors/apollo/* via TestClient + dependency overrides."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.dependencies import get_mongo, get_neo4j_driver
from app.services import connectors as connectors_service
from tests.identities import TEST_ORG_ID, TEST_USER_ID, TEST_LEAD_ID_1


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def _override_clients():
    app.dependency_overrides[get_neo4j_driver] = lambda: object()
    app.dependency_overrides[get_mongo] = lambda: object()
    yield
    app.dependency_overrides.pop(get_neo4j_driver, None)
    app.dependency_overrides.pop(get_mongo, None)


def test_connect_calls_service(client, monkeypatch):
    monkeypatch.setattr(connectors_service, "connect_apollo",
                        lambda mongo, req: {"connected": True, "status": "connected"})
    r = client.post("/connectors/apollo/connect",
                    json={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID, "api_key": "k"})
    assert r.status_code == 200
    assert r.json() == {"connected": True, "status": "connected"}


def test_status(client, monkeypatch):
    monkeypatch.setattr(connectors_service, "get_apollo_status",
                        lambda mongo, org_id: {"connected": False, "status": "disconnected", "connected_at": None})
    r = client.get(f"/connectors/apollo/status?org_id={TEST_ORG_ID}")
    assert r.status_code == 200
    assert r.json()["connected"] is False


def test_disconnect(client, monkeypatch):
    monkeypatch.setattr(connectors_service, "disconnect_apollo",
                        lambda mongo, org_id: {"status": "disconnected", "message": "Apollo disconnected."})
    r = client.request("DELETE", f"/connectors/apollo/connect?org_id={TEST_ORG_ID}")
    assert r.status_code == 200
    assert r.json()["status"] == "disconnected"


def test_lists(client, monkeypatch):
    monkeypatch.setattr(connectors_service, "list_apollo_lists",
                        lambda mongo, org_id: {"lists": [{"id": "L1", "name": "One"}]})
    r = client.get(f"/connectors/apollo/lists?org_id={TEST_ORG_ID}")
    assert r.status_code == 200
    assert r.json()["lists"][0]["id"] == "L1"


def test_import_returns_file_id(client, monkeypatch):
    monkeypatch.setattr(connectors_service, "start_apollo_import",
                        lambda driver, mongo, req, bt: {"file_id": "f1", "status": "queued"})
    r = client.post("/connectors/apollo/import",
                    json={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID, "label": "Batch"})
    assert r.status_code == 200
    assert r.json() == {"file_id": "f1", "status": "queued"}


def test_enrich_returns_run_id(client, monkeypatch):
    monkeypatch.setattr(connectors_service, "start_apollo_enrich",
                        lambda driver, mongo, req, bt: {"run_id": "r1", "status": "queued"})
    r = client.post("/connectors/apollo/enrich",
                    json={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID, "lead_ids": [TEST_LEAD_ID_1]})
    assert r.status_code == 200
    assert r.json() == {"run_id": "r1", "status": "queued"}


def test_enrich_status(client, monkeypatch):
    monkeypatch.setattr(connectors_service, "get_apollo_enrich_status",
                        lambda mongo, org_id, run_id: {
                            "run_id": "r1", "org_id": TEST_ORG_ID, "status": "completed",
                            "total": 1, "processed": 1, "updated": 1, "unmatched": 0, "failed": 0,
                            "progress_percent": 100.0, "errors": [], "started_at": None, "finished_at": None,
                        })
    r = client.get(f"/connectors/apollo/enrich/status?org_id={TEST_ORG_ID}&run_id=r1")
    assert r.status_code == 200
    assert r.json()["progress_percent"] == 100.0


def test_connect_validation_error_maps_to_400(client, monkeypatch):
    from app.core.exceptions import ConnectorCredentialsInvalidError

    def _raise(mongo, req):
        raise ConnectorCredentialsInvalidError("bad key")

    monkeypatch.setattr(connectors_service, "connect_apollo", _raise)
    r = client.post("/connectors/apollo/connect",
                    json={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID, "api_key": "bad"})
    assert r.status_code == 400
```

> **Patch-target rationale:** the router below calls `connectors_service.connect_apollo(...)` (the package facade), so the test patches `connectors_service.<fn>` — the exact name the router resolves at call time. Patching `orchestrator.<fn>` would NOT intercept, because the package re-export bound its own reference at import. This is the patch-where-used rule from `TESTING.md`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/test_connectors.py -v`
Expected: FAIL — routes 404 (router not mounted yet) / import error for the router.

- [ ] **Step 3: Create the router**

Create `app/routers/connectors.py`:

```python
"""Apollo connector endpoints: connect/status/disconnect/lists/import/enrich.

Endpoints that make a blocking Apollo call (/connect, /lists) are sync `def` so
FastAPI runs them in its threadpool (requests must not block the event loop).
Import/enrich schedule BackgroundTasks and return immediately.
"""
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query

from app.core.dependencies import get_mongo, get_neo4j_driver
from app.models.connectors import (
    ApolloConnectRequest,
    ApolloConnectResponse,
    ApolloEnrichRequest,
    ApolloEnrichResponse,
    ApolloEnrichStatusResponse,
    ApolloImportRequest,
    ApolloImportResponse,
    ApolloListsResponse,
    ApolloStatusResponse,
    DisconnectResponse,
)
from app.services import connectors as connectors_service

router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.post("/apollo/connect", response_model=ApolloConnectResponse)
def connect_apollo(request: ApolloConnectRequest, mongo=Depends(get_mongo)):
    """Validate the customer's Apollo API key (credit-free) and store it."""
    return connectors_service.connect_apollo(mongo, request)


@router.get("/apollo/status", response_model=ApolloStatusResponse)
def apollo_status(org_id: str = Query(...), mongo=Depends(get_mongo)):
    return connectors_service.get_apollo_status(mongo, org_id)


@router.delete("/apollo/connect", response_model=DisconnectResponse)
def disconnect_apollo(org_id: str = Query(...), mongo=Depends(get_mongo)):
    """Remove stored Apollo credentials. Credentials are keyed by (org_id, provider)."""
    return connectors_service.disconnect_apollo(mongo, org_id)


@router.get("/apollo/lists", response_model=ApolloListsResponse)
def apollo_lists(org_id: str = Query(...), mongo=Depends(get_mongo)):
    """The customer's Apollo lists (labels) for the import picker."""
    return connectors_service.list_apollo_lists(mongo, org_id)


@router.post("/apollo/import", response_model=ApolloImportResponse)
async def apollo_import(
    request: ApolloImportRequest,
    background_tasks: BackgroundTasks,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
):
    """Queue a background import. Progress is polled via GET /leads/stream/status."""
    return connectors_service.start_apollo_import(driver, mongo, request, background_tasks)


@router.post("/apollo/enrich", response_model=ApolloEnrichResponse)
async def apollo_enrich(
    request: ApolloEnrichRequest,
    background_tasks: BackgroundTasks,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
):
    """Queue a background enrichment run over the selected lead_ids."""
    return connectors_service.start_apollo_enrich(driver, mongo, request, background_tasks)


@router.get("/apollo/enrich/status", response_model=ApolloEnrichStatusResponse)
async def apollo_enrich_status(
    org_id: str = Query(...),
    run_id: Optional[str] = Query(None),
    mongo=Depends(get_mongo),
):
    return connectors_service.get_apollo_enrich_status(mongo, org_id, run_id)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/test_connectors.py -v`
Expected: PASS (8 passed).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/routers/connectors.py backend/tests/test_connectors.py
git commit -m "feat(be): add /connectors/apollo router (connect/status/lists/import/enrich)"
```

---

## Task 11: Wire into the app factory (`main.py`)

**Files:**
- Modify: `app/main.py` (lifespan index call + `include_router`)
- Test: `tests/test_connectors_wiring.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_connectors_wiring.py`:

```python
"""The connectors router is mounted and the lifespan ensures connector indexes."""
from app.main import app


def test_connectors_routes_registered():
    paths = {route.path for route in app.routes}
    assert "/connectors/apollo/connect" in paths
    assert "/connectors/apollo/import" in paths
    assert "/connectors/apollo/enrich" in paths


def test_lifespan_binds_ensure_connectors_indexes():
    # The lifespan calls _ensure_connectors_indexes; assert main.py imported the REAL
    # function object (catches a forgotten/renamed import — review F7). A full
    # lifespan-invocation test is not feasible here: under BREWRA_SKIP_DB_INIT
    # (conftest) clients.client is None, so the lifespan's index block is skipped.
    import app.main as main_mod
    from app.services.connectors import credentials
    assert main_mod._ensure_connectors_indexes is credentials._ensure_connectors_indexes
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/test_connectors_wiring.py -v`
Expected: FAIL — routes missing / `_ensure_connectors_indexes` not on `app.main`.

- [ ] **Step 3: Edit main.py**

In `app/main.py`, add the connectors index import alongside the other `_ensure_*` imports near the top (after `from app.services.icp import _ensure_icp_indexes`):

```python
from app.services.connectors import _ensure_connectors_indexes
```

In the `lifespan` body, add the connectors index call inside the existing `if app.state.clients.client is not None:` block (after `_ensure_icp_indexes(app.state.clients.client)`):

```python
        _ensure_connectors_indexes(app.state.clients.client)
```

At the bottom of `main.py`, alongside the other `include_router` calls, add:

```python
from app.routers import connectors

app.include_router(connectors.router)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/test_connectors_wiring.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/main.py backend/tests/test_connectors_wiring.py
git commit -m "feat(be): mount connectors router + ensure connector indexes in lifespan"
```

---

## Task 12: Surface created-vs-matched on stream status (additive leads edit)

**Files:**
- Modify: `app/models/leads.py` (`StreamFileEntry`: add optional `source`, `matched_count`, `capped`)
- Modify: `app/services/leads/persistence.py` (`get_stream_status` passes the new fields through)
- Test: `tests/unit/test_leads_stream_status_apollo_fields.py`

Spec §5.5 wants import batches to show `created_count` **vs** `matched_count` (and `capped`) through the existing `GET /leads/stream/status`. The current `get_stream_status` builds an explicit dict that drops unknown fields, and `StreamFileEntry` has no such fields — so they must be added. This is backward-compatible (all optional with defaults); CSV batches simply have `source=None`/`matched_count=0`/`capped=False`.

> **Deviation note from spec §12.1** ("the only edit to an existing file is a one-line `include_router`"): faithfully surfacing §5.5's created-vs-matched distinction requires these two additive, backward-compatible edits to the leads module (plus the `main.py` wiring in Task 11). They add optional response fields and a passthrough; they change no existing behavior. Recorded here so the deviation is explicit.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test_leads_stream_status_apollo_fields.py`:

```python
"""get_stream_status surfaces the apollo import fields (source/matched_count/capped)."""
from app.services.leads import get_stream_status
from app.models.leads import StreamFileEntry
from tests.identities import TEST_ORG_ID


class FakeCursor(list):
    def sort(self, *a, **k):
        return self


class FakeColl:
    def __init__(self, docs):
        self._docs = docs

    def find(self, flt):
        return FakeCursor(self._docs)


class FakeMongo:
    def __init__(self, docs):
        self._docs = docs

    def __getitem__(self, _db):
        return {"Lead_Stream_Files": FakeColl(self._docs)}


def test_stream_status_includes_apollo_fields():
    docs = [{
        "file_id": "f1", "filename": "My Apollo Batch", "uploaded_at": "t",
        "last_processed_at": "t2", "total_rows": 10, "created_count": 7,
        "error_count": 0, "processing_status": "completed",
        "source": "apollo", "matched_count": 3, "capped": False,
    }]
    out = get_stream_status(FakeMongo(docs), TEST_ORG_ID)
    entry = out["files"][0]
    assert entry["source"] == "apollo"
    assert entry["matched_count"] == 3
    assert entry["capped"] is False


def test_stream_file_entry_defaults_for_csv():
    # A CSV doc with none of the new fields validates with defaults.
    entry = StreamFileEntry(file_id="f2")
    assert entry.source is None
    assert entry.matched_count == 0
    assert entry.capped is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_leads_stream_status_apollo_fields.py -v`
Expected: FAIL — `KeyError: 'source'` (passthrough missing) and/or validation on `StreamFileEntry.source`.

- [ ] **Step 3a: Extend the model**

In `app/models/leads.py`, add three optional fields to `StreamFileEntry` (after `processing_status`):

```python
    source: Optional[str] = None
    matched_count: int = 0
    capped: bool = False
```

- [ ] **Step 3b: Pass the fields through**

In `app/services/leads/persistence.py`, inside `get_stream_status`, extend the `item` dict (after the `processing_status` line) with:

```python
            "source": doc.get("source"),
            "matched_count": doc.get("matched_count", 0),
            "capped": doc.get("capped", False),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest tests/unit/test_leads_stream_status_apollo_fields.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add backend/app/models/leads.py backend/app/services/leads/persistence.py backend/tests/unit/test_leads_stream_status_apollo_fields.py
git commit -m "feat(be): surface apollo import source/matched_count/capped on stream status"
```

---

## Task 13: Full suite green + import smoke

**Files:** none (verification only)

- [ ] **Step 1: Run the whole backend suite**

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && python -m pytest -q`
Expected: all tests pass (existing + the new connector tests). No collection errors.

- [ ] **Step 2: Import smoke (no DB)**

Confirm the app imports cleanly with DB init skipped (mirrors conftest):

Run: `cd /projects/Brewra/brewra-gtm-intelligence/backend && BREWRA_SKIP_DB_INIT=1 python -c "import app.main; print('routes:', sum(1 for r in app.main.app.routes if getattr(r, 'path', '').startswith('/connectors')))"`
Expected: prints `routes: 7` (the seven `/connectors/apollo/*` routes).

- [ ] **Step 3: Commit (only if Step 1/2 forced a change)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A && git commit -m "test(be): green full suite after apollo connector"
```

---

## Task 14: Live response-shape verification (per CLAUDE.md)

**Files:** none (manual verification; do this against a locally-running backend before the FE plan is ever written)

`CLAUDE.md`: *"update the backend first, verify the response shape with a live call, then implement the frontend."* The frontend plan is deferred (spec §12.2), but the response shapes must be confirmed now so the deferred FE contracts are grounded.

> **Acceptance gate (review F11).** If any endpoint returns a JSON shape inconsistent with its Pydantic response model (unexpected key, missing key, or a 5xx on a well-formed request), the discrepancy **must be resolved and the relevant task(s) re-verified** before this plan is considered done and before the deferred FE plan (`23b`) is authored.

- [ ] **Step 1: Start the backend locally**

Run (in a dedicated shell): `cd /projects/Brewra/brewra-gtm-intelligence/backend && uvicorn app.main:app --reload --port 8000`
(If real DB credentials aren't available locally, set the env so the app still boots; DB-touching calls will error, but `/docs` and request/response *shapes* are still inspectable.)

- [ ] **Step 2: Inspect the OpenAPI surface**

Open `http://localhost:8000/docs` and confirm the **connectors** tag lists all seven endpoints with the expected request/response models (`ApolloConnectResponse`, `ApolloStatusResponse`, `ApolloListsResponse`, `ApolloImportResponse`, `ApolloEnrichResponse`, `ApolloEnrichStatusResponse`, `DisconnectResponse`).

- [ ] **Step 3: Curl the read endpoints (shape check)**

```bash
curl -s "http://localhost:8000/connectors/apollo/status?org_id=test_org_abc" | python -m json.tool
```
Expected JSON keys: `connected`, `status`, `connected_at`.

- [ ] **Step 4: Record the confirmed shapes**

Note the confirmed JSON shapes for the deferred FE plan (`plans/23b-apollo-lead-integration-frontend.md`) — append to spec §7 when the FE plan is authored. No code change here.

---

## Self-review (run after all tasks)

Checked against `specs/23-apollo-lead-integration-design.md`:

- **§4 module table** → Tasks 3–9 create `normalize.py`, `apollo.py`, `ingestion.py` (pure writes), `runs.py` (tracking), `credentials.py`, `__init__.py`, plus the house-consistent `orchestrator.py` (glue) — no `base.py`/ABC. ✅
- **§5.1 canonical fields + `apollo_raw`** → `CANONICAL_FIELDS` + JSON-string `apollo_raw` (Task 3). ✅
- **§5.2 Company MERGE-by-domain + `Has_Lead`, shared by import & enrich** → `_COMPANY_MERGE` reused by both Cypher paths (Task 5). ✅
- **§5.3 match hierarchy (email → apollo_contact_id → create/unmatched), atomic UNWIND coalesce fill-only-empty, `file_id` on create only** → `_IMPORT_UPDATE_CYPHER`/`_IMPORT_CREATE_CYPHER`/`_ENRICH_UPDATE_CYPHER` + `_dedupe_import_records` (Task 5). `file_id` set only in CREATE. ✅
- **§5.4 unencrypted credentials, credit-free validation (`GET /labels`)** → `credentials.py` + `validate_credentials` uses `/labels` (Tasks 4, 6). ✅
- **§5.5 import = synthetic file (`Lead_Stream_Files`, created vs matched), enrich = `Connector_Enrich_Runs` + stale failover** → `runs.py` + Task 12 surfacing (Tasks 7, 12). ✅
- **§6 API surface** (connect/status/disconnect[no user_id]/lists/import/enrich/enrich-status; sync `def` for blocking calls; `list_id` filters, `label` is display name) → Task 10 router + Task 8 orchestrator. ✅
- **§6.1 flows** (import UNWIND ~500 chunks; enrich `id=apollo_contact_id` else identity fields, batches of 10, reveal flags) → `_run_import`/`_run_enrich`/`_build_match_entry` (Task 8). ✅
- **§8 error handling** (bad key, disconnect mid-run via next-call detection, 429 backoff base1s×2 max30s ≤5, credits exhausted → partial, per-row isolation, 25k cap with `capped=true` + message, idempotent re-runs) → Tasks 4, 7, 8. ✅
- **§9 testing** (normalize unit, connector vs fixtures, ingestion vs mock driver, credentials/runs, endpoint happy-path + stale failover) → Tasks 3–10. ✅ (No live Apollo calls in CI.)
- **§12.1 backend-only, additive** → edits to existing files: `exceptions.py` (append), `main.py` (wiring), `leads` model+persistence (additive passthrough). Full deviation set consolidated in the §12.1 deviation note (module map) per plan-review F5. ✅

**Open items to confirm at implementation (carried from spec):**
1. Exact Apollo field names for `/contacts/search`, `/people/bulk_match`, `/labels` responses — confirm against recorded fixtures; `normalize_apollo_record` and `apollo.py` parsing are `.get()`-tolerant but may need key tweaks (spec §6 / §6.1 open question).
2. `bulk_match` result ordering — `_run_enrich` pairs results to leads positionally and now hard-guards on `len(matches) != len(chunk)` (skips the chunk rather than miswrite). The remaining same-count-reorder risk is covered by the **required Task-8 pre-step**: confirm request-order/slot-per-input against a recorded fixture and switch to a keyed lookup if not. See Task 8.
3. UNWIND chunk size (500) and the 25,000 import cap are tunable product constants (`INGEST_CHUNK_SIZE`, `IMPORT_RECORD_CAP`) — confirm against staging Neo4j with a perf budget (spec open question: 10k contacts < 5 min).

---

## Execution Handoff

(Filled in by the controller after the user picks an execution approach — subagent-driven vs inline.)
