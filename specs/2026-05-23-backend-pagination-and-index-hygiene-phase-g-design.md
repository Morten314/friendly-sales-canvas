# Backend Pagination + Index Hygiene Phase G — v2 API Convention

**Date:** 2026-05-23
**Status:** Approved for plan-writing (pending user spec review)
**Branch (planned):** `refactor-backend-pagination-and-index-hygiene-phase-g` off `master`
**Predecessors:** Phase A (`/specs/2026-05-12-backend-modularization-design.md`), Phase B (`/specs/2026-05-21-backend-modularization-phase-b-design.md`), Phase C (`/specs/2026-05-22-backend-modularization-phase-c-design.md`), Phase D (`/specs/2026-05-22-backend-modularization-phase-d-design.md`), Phase E (`/specs/2026-05-22-backend-test-improvements-phase-e-design.md`), Phase F (`/specs/2026-05-22-backend-modularization-phase-f-design.md`)
**Consumes:** Phase F §8 items #2 (pagination convention) and #3 (`create_index`-on-hot-path audit) from `/specs/2026-05-22-backend-modularization-phase-f-design.md`.

---

## 1. Summary

Phase G establishes the project's first paginated-list convention. Every list-returning HTTP endpoint gets a `/api/v2/` sibling that returns an envelope `{items, total, limit, offset}` with default `limit=50` and a hard cap of `500`. Internal service helpers that today fetch unbounded lists (`_get_latest_market_score_rows`, every Cypher `MATCH ... RETURN` that returns rows) gain `limit`/`offset` parameters with sensible defaults — pagination becomes a service-layer primitive, not just an HTTP concern.

In parallel, the two remaining hot-path `create_index` clusters move to lifespan. `lead_stream_coll.create_index(...)` (today inside `batch_upload_leads`, runs per upload) becomes `_ensure_leads_indexes(mongo)` called from `lifespan`. The `icp` registry indexes (today inside `_reserve_unique_icp_id`) become `_ensure_icp_indexes(mongo)` called from `lifespan`. This completes the index-construction-site consolidation Phase F started for `market_scoring`.

The v1 routes stay at their current paths with their current bare-list shape; this phase marks them deprecated via the RFC 8594 `Deprecation` header plus an RFC 5988 `Link: rel="successor-version"` pointing at the v2 path. A future Phase H deletes them once the FE has migrated to v2. No FE work happens in this phase — the FE keeps consuming v1 unchanged.

Test count rises from the Phase F baseline of 203 to approximately 242, driven by per-v2-endpoint tests (envelope shape, `limit`/`offset` correctness, hard-cap clamping, total accuracy) plus lifespan index-ensure smoke tests. The 6 v1 deprecation-header assertions are folded into existing happy-path tests, so they don't add to the test count — see §5.5.

---

## 2. Scope

### 2.1 In scope

1. **New `PaginatedResponse[T]` generic** in `app/models/pagination.py` (new file), re-exported from `app/models/__init__.py`. Uses Pydantic v2 `BaseModel + Generic[T]` natively. Field constraints: `total: int = Field(ge=0)`, `limit: int = Field(ge=1, le=500)`, `offset: int = Field(ge=0)`.

2. **New `app/routers/v2/` subpackage** mounted at `prefix="/v2"` in `app/main.py`. One router file per domain that has list endpoints. Every v2 route is tagged `tags=["v2", "<domain>"]` so FastAPI `/docs` groups them under a v2 heading. The 6 v2 endpoints:
   - `GET /v2/leads` → `PaginatedResponse[Dict[str, Any]]`
   - `GET /v2/leads/by-file` → `PaginatedResponse[Dict[str, Any]]`
   - `GET /v2/user-documents` → `PaginatedResponse[UserDocumentEntry]`
   - `GET /v2/icp` → `PaginatedResponse[Dict[str, Any]]` (v2 router injects `agent_chain` via `Depends(get_agent_chain)` since `list_icps` requires it; user-scoped, not org-scoped — see note below)
   - `GET /v2/registration` → `PaginatedResponse[RegistrationResponse]` (admin-only — see note below)
   - `GET /v2/fetch-signals` → `PaginatedResponse[Dict[str, Any]]` (user-scoped, not org-scoped — see note below)

   `GET /org` is **not** in scope — `list_orgs` (`org_auth.py:10`) returns a single org dict for one user, not a paginated list.

   **`/v2/registration` admin-only.** `list_registrations` (`org_auth.py:156`) calls `collection.find().sort("timestamp", -1)` with no filter — it returns every registration in the database (separate `Registration_DB` from the main `Profiler` DB). The registration records have no `org_id` or `user_id` field in the current data model. Phase G preserves this cross-tenant behavior (no scoping added) because Phase G is explicitly not changing tenant schemas (§2.3). The v2 envelope is still useful for paginated browsing of the admin view. Adding a `user_id` or `org_id` scoping parameter is deferred to Phase H if the endpoint ever needs to be user-facing.

   **`/v2/fetch-signals` is user-scoped, not org-scoped.** Every other v2 list endpoint filters by `org_id` for multi-tenancy. `fetch_signals` (`signals.py:913`) filters by `user_id`. The v2 sibling preserves this — signals are user-scoped in the current data model, not org-scoped, and re-scoping would be a data-model change out of Phase G's scope (§2.3).

   **`/v2/icp` is also user-scoped, not org-scoped.** `list_icps` filters by `user_id` at `icp.py:820` (`collection.find_one({"user_id": user_id})`) and fetches the canonical company profile at `icp.py:849` (`MATCH (c:CompanyProfile) RETURN c LIMIT 1`) without an `org_id` filter. Same rationale as fetch-signals — ICPs are a user-account artifact in the current data model. Phase G preserves this scoping.

   The 6 v1 routes fall into two shape categories that need different post-Phase-G adaptation (see §3.4):

   | v1 endpoint | Current `response_model` | Shape |
   |---|---|---|
   | `/leads` | `List[Dict[str, Any]]` | bare list |
   | `/leads/by-file` | `List[Dict[str, Any]]` | bare list |
   | `/registration` | `List[RegistrationResponse]` | bare list |
   | `/user-documents` | `ListUserDocumentsResponse` | `{status, count, files: [...]}` |
   | `/icp` | `ICPListResponse` | `{suggestedICPs: [...]}` |
   | `/fetch-signals` | `FetchSignalsResponse` | `{status, count, signals: [...]}` |

3. **Service-layer `limit`/`offset` params** on all list-returning service functions. Each returns `tuple[list[ItemDict], int]` (items, total) — no new dataclass. Mongo queries get `.skip(offset).limit(limit)`; Cypher queries get `SKIP $offset LIMIT $limit` with a mandatory `ORDER BY` clause for deterministic pagination (no longer a conditional flag — see §3.2). For Neo4j services, the items query and the count query share a single `with driver.session() as s:` block — one session, two `s.run(...)` calls.

4. **Internal-helper bounding.** Non-HTTP helpers that today iterate unbounded result sets get explicit `limit`/`offset` params with sensible defaults:
   - `_get_latest_market_score_rows(driver, mongo, org_id, limit=500, offset=0)`
   - `_run_market_scoring_for_org` background task calls `get_leads_for_org(driver, org_id, limit=5000, offset=0)`. The 5000 cap (today already explicit at the call site per CLAUDE.md "Gotchas") stays. The `order_by_recent=True` kwarg is dropped because `ORDER BY` is now mandatory in the Cypher (see §3.2).

5. **Index relocation to lifespan.** Line numbers reflect the Phase F baseline at spec-writing time. The implementor should re-verify each via `git grep` rather than relying on exact line numbers — Phase G's own earlier commits may shift lines before the rename commit lands.
   - `_ensure_leads_indexes(mongo)` extracted from `batch_upload_leads` (`leads.py:219-220`).
   - `_ensure_icp_indexes(mongo)` — rename of the existing `_ensure_icp_id_registry_indexes(db)` helper at `icp.py:1095-1098`, with parameter changed from `db` to `mongo` to match the Phase F lifespan-helper convention. Six existing callsites are deleted (lifespan now owns the call): `icp.py:816` (inside `list_icps`), `icp.py:1051` (inside `delete_recommended_icp`), and `customer_profile.py:22, 142, 221, 359` (inside `create_customer_profile`, `update_customer_profile`, `list_customer_profiles`, `delete_customer_profile` respectively — each via a lazy `from app.services.icp import _ensure_icp_id_registry_indexes` import). All six callers today extract `db = mongo["Profiler"]` (or `profiler_db`) before calling, so the parameter-shape change applies uniformly. Fourteen test-mock-patch targets must also be renamed: `tests/unit/test_customer_profile.py:54,80,95,133,169,194,235,247,261` (nine) and `tests/unit/test_icp.py:109,125,235,250,268` (five). See Risk #8 for the lazy-import detection note.
   - Both invoked from `app/main.py` lifespan, gated on `app.state.clients.client is not None`, alongside the existing `_ensure_market_scoring_indexes`.

6. **v1 deprecation markers.** Every v1 list route gains:
   - Response header `Deprecation: true` (RFC 8594).
   - Response header `Link: </api/v2/<path>>; rel="successor-version"` (RFC 5988 + 8594).
   - A `**Deprecated:**` note in the route docstring naming the v2 path.

   v1 response shape preserved (same `response_model` as today). The route sources its data from the new `(items, total)` service signature and adapts:
   - **Bare-list v1 routes** (`/leads`, `/leads/by-file`, `/registration`) return only the `items` element of the tuple; the `total` is discarded.
   - **Wrapper-shape v1 routes** (`/user-documents`, `/icp`, `/fetch-signals`) reconstruct their existing wrapper dict from `items` — see §3.4 for the worked patterns.

   All v1 routes that previously did unbounded fetches now silently cap at 500 rows via the new service default. The one exception is `/fetch-signals`, which already accepts a `?limit=N` query param (FE passes `limit=10`); v1 preserves that param and threads it through to the new service signature.

7. **`list_icps` refresh-flag interaction.** Pagination applies uniformly regardless of `refresh` value. When `refresh=true` the LLM regenerates the canonical ICP set first, then `limit`/`offset` slice the result. LLM cost is paid once per refresh (or first-request cache-miss) regardless of which page is requested. The combination `refresh=true` + `offset > 0` (or cache-miss + `offset > 0`) is an accepted wasteful edge case — pays full LLM cost for a zero-or-near-zero-item page — but not worth guarding against: typical ICP cardinality is 5-10, well under the default `limit=50`, so `offset > 0` is never reached in practice. ICP pagination is an envelope-convention play (API shape uniformity across v2 endpoints), not a performance play — LLM cost and response-size are determined by the full ICP set, not by the requested page. The slice happens after materialization.

8. **`fetch_signals` default.** v2 endpoint accepts `limit` (default `10`, max `500`) and `offset` (default `0`). The default of `10` is preserved from current behavior (FE explicitly passes `limit=10` today).

9. **Tests.** Per §5: new tests for v2 envelope shape, `limit`/`offset` correctness, hard-cap clamping at 500, total accuracy. v1 tests gain a deprecation-header assertion (folded into existing happy-path tests, not split out). Pagination model unit tests. Lifespan index-ensure smoke tests. Pinecone `create_index` at `documents.py:271` is **left as-is** — it is pre-gated by `pc.list_indexes()` and is a Pinecone-vector-index admin operation, not a Mongo-collection-index hot-path call.

### 2.2 Out of scope (deferred to Phase H+)

**Most-likely Phase H:**

- **v1 route deletion.** Once FE has migrated to v2 (verified by `git grep "/api/<endpoint>"` returning zero non-v2 hits in `frontend/src/`), delete the v1 routes and their tests.
- **Security hardening** (Phase F §8 #1, was originally intended as Phase G scope; reprioritized to Phase H). Cypher injection parameterization, CORS off `*`, raw Cypher endpoint guard, `/leads` LIMIT enforcement as a security measure.

**Other carry-forward items:**

- `GET /leads/stream-status` v2 sibling. `get_stream_status` (`leads.py:357-377`, mounted at `routers/leads.py:83`) iterates `coll.find({"org_id": org_id}).sort("uploaded_at", -1)` unbounded and returns `{"files": [...]}`. It's an upload-tracking admin view — useful for surfacing in `/docs` once stream history grows, but at MVP scale (low file-upload cardinality per tenant) pagination is not yet load-bearing. Defer to Phase H/I alongside the other admin-tooling cleanups. Trigger: any tenant accumulates more than ~50 stream uploads.
- B4 small-pattern dedup audit (JSON detection ×6, company-profile-fetch ×8, `validate_url` ×2, `update_signal_track` ×3).
- `has_more` swap-in if the second (count) query becomes hot.
- Sort-key convention (`?sort=field:direction`) on v2 endpoints.
- TD-004 (run real LLM captures with API keys).
- Phase E review follow-ups: M1 (pytest-asyncio migration), M4 (pytest config + markers), L4 (CI staleness check for captured fixtures).
- Anthropic SDK migration.
- `tiktoken` for budget estimation.
- Redis-backed Claude budget.
- Inline prompts → `app/prompts/`.
- Shared `memory` audit.

### 2.3 Non-goals

- **No new endpoints beyond v2 siblings.** Every v2 route corresponds to an existing v1 route. No new functionality, no new query parameters beyond `limit` / `offset`.
- **No response-shape changes outside the envelope.** Item-dict shape stays identical between v1 and v2 (a `Lead` dict in v1 is the same `Lead` dict inside `v2.items`).
- **No DB schema changes.** Pagination is a query-construction concern only.
- **No removal of any service function.** Service functions gain parameters; signatures change additively, with one exception: `get_leads_for_org` drops the now-redundant `order_by_recent` parameter (mandatory `ORDER BY` in the new Cypher makes the flag dead — see §3.2 and §4.2 commit 7). The Phase F `=None` fallback pattern is not needed here — every caller is in the same phase and updates atomically with its callee.
- **No new dependencies.** `Generic[T]` is stdlib; Pydantic 2.13.4 already supports it.
- **No FE changes.** Brewra-dev team migrates FE callsites at their cadence in a separate effort.

**Acknowledged behavior changes (not non-goals):**

1. **Silent 500-row cap on v1 routes.** Five v1 routes — `/leads`, `/leads/by-file`, `/registration` (bare-list) and `/user-documents`, `/icp` (wrapper-shape) — gain a silent 500-row cap, replacing the previous unbounded fetch. This is a strictly-safer behavior change, not a shape change — clients receive the same dict shape, just truncated at 500 rows. Acceptable per CLAUDE.md "Business State" (0 live users); see Risk #1 for the mitigation. `/fetch-signals` is the one v1 route exempt from the silent cap — it already had an explicit `?limit=N` query param.
2. **Deterministic ordering on v1 `/leads` and `/leads/by-file`.** Both routes gain mandatory `ORDER BY l.created_at DESC` (newest first). Previously `/leads` returned arbitrary Cypher order when called without `order_by_recent=True` (the v1 route's default path), and `/leads/by-file` had no `ORDER BY` at all. Like the cap, this is strictly safer — pages of leads are now stable across reloads, and clients that previously relied on insertion-order coincidence see a consistent contract instead.
3. **v1 `/fetch-signals` retains its current unvalidated `limit` parameter** (`Query(10)` with no `ge`/`le`). v2 sibling adds `Query(10, ge=1, le=500)`. Tightening the v1 validation is deferred to Phase H alongside v1 route deletion (§8 #1) — the asymmetry exists for one phase only.

---

## 3. Architecture

### 3.1 `PaginatedResponse` generic

`app/models/pagination.py` (new file):

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

Re-exported from `app/models/__init__.py`:

```python
from app.models.pagination import PaginatedResponse  # noqa: F401
```

The `le=500` model-level constraint pairs with `Query(50, ge=1, le=500)` at the route layer. FastAPI returns 422 for `limit` values outside the range; the model-level constraint prevents a hand-constructed `PaginatedResponse` from carrying an illegal value.

The `le=500` constraint here is the authoritative cap; all other mentions of `500` in §1, §2.1, §3.3, and §7.2 derive from this definition. A future amendment changing the cap updates §3.1 first.

### 3.2 Service-layer signature pattern

Each paginated service function returns `tuple[list[dict], int]`. The total comes from a second query in the same DB session (Neo4j) or a second `count_documents()` call (Mongo).

**Neo4j — before** (Phase F baseline, `leads.py:18-39`):

```python
def get_leads_for_org(
    driver,
    org_id: str,
    limit: Optional[int] = None,
    order_by_recent: bool = False,
) -> List[Dict[str, Any]]:
    clauses = ["MATCH (l:Lead)", "WHERE l.org_id = $org_id", "RETURN l"]
    params: Dict[str, Any] = {"org_id": org_id}
    if order_by_recent:
        clauses.append("ORDER BY l.created_at DESC")
    if limit is not None:
        clauses.append("LIMIT $limit")
        params["limit"] = limit
    with driver.session() as session:
        results = session.run("\n".join(clauses), **params)
        return _process_neo4j_lead_records(results)
```

The function already accepts a `limit` (default `None` = unbounded) and an `order_by_recent` flag. Internal callers all pass `order_by_recent=True` with an explicit `limit`:

- `market_scoring.py:393` — `limit=5000` (bg task pre-count)
- `market_scoring.py:678` — `limit=5000` (bg task main loop)
- `signals.py:594` — `limit=100` (Scout signals research)
- `signals.py:732` — `limit=100` (Profiler signals research)

The only caller that omits `limit` (and so hits the unbounded path) is the v1 route at `routers/leads.py:23`.

**Neo4j — after**:

```python
def get_leads_for_org(
    driver,
    org_id: str,
    limit: int = 500,
    offset: int = 0,
) -> tuple[List[Dict[str, Any]], int]:
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

Three changes from the "before":
- **`limit` default goes from `None` (unbounded) to `500`** — strictly-safer; the previous unbounded fetch became the documented v1-route silent-cap behavior.
- **`offset` added** with default `0`.
- **`order_by_recent` dropped.** Paginated semantics require deterministic ordering, so `ORDER BY l.created_at DESC` is mandatory in the query — the flag is redundant. All four internal callers (`market_scoring.py:393,678`; `signals.py:594,732`) lose the `order_by_recent=True` kwarg in the same commit (commit 7 — `leads`).

`list_leads_by_file` (the other paginated Cypher service in commit 7) also adopts `ORDER BY l.created_at DESC`. It had no `ORDER BY` clause before — adding one is a new behavior, not a preservation. `created_at DESC` is chosen by analogy with `get_leads_for_org` so the two Lead-listing endpoints share a recency-ordered convention.

Both items and count queries run inside one `with driver.session() as s:` block — one session, two query executions.

`list_leads_by_file` follows the same pattern with `MATCH (l:Lead) WHERE l.org_id = $org_id AND l.file_id = $file_id`, `ORDER BY l.created_at DESC`, and a parallel `RETURN count(l) AS total` query in the same session.

**Mongo**:

The three paginated Mongo services use three different databases — verify against current code:

| Service | Database | Collection |
|---|---|---|
| `list_user_documents` | `File_Processing` | `file_status` |
| `list_registrations` | `Registration_DB` | `registrations` |
| `fetch_signals` | `Signals` | `signals` |

```python
async def list_user_documents(
    mongo, org_id: str,
    limit: int = 500, offset: int = 0,
) -> tuple[list[dict], int]:
    db = mongo["File_Processing"]
    collection = db["file_status"]
    flt = {"org_id": org_id}
    items = list(
        collection.find(flt).sort("uploaded_at", -1).skip(offset).limit(limit)
    )
    total = collection.count_documents(flt)
    return items, total
```

The simplified `list(...)` shown here is illustrative — each service preserves its current per-document transformation pass (`list_user_documents` builds a `file_item` dict per row; `list_registrations` builds `RegistrationResponse` instances). `count_documents()` operates on the raw filter, not the transformed items — `total` is always the pre-transformation count.

Each paginated Mongo query preserves its existing sort order in the post-Phase-G shape (the `.skip(offset)` call is inserted between `.sort()` and `.limit()`):

| Service | Sort key | Direction |
|---|---|---|
| `list_user_documents` | `uploaded_at` | descending (`-1`) |
| `list_registrations` | `timestamp` | descending (`-1`) |
| `fetch_signals` | `timestamp` | descending (`-1`) |

Sort orders are preserved from current code, not invented. Deterministic ordering matters for pagination — without an explicit `.sort()`, Mongo can return cursor pages in arbitrary order under concurrent inserts.

When `offset >= total`, both Neo4j and Mongo return an empty `items` list while `total` reflects the true count. The envelope `{items: [], total: N, limit: L, offset: O}` with `O >= N` is well-defined, not an error — consumers detect end-of-data by `offset + len(items) >= total` or by `len(items) < limit`.

### 3.3 v2 router pattern

(5 router files cover 6 v2 endpoints — `leads.py` handles both `/leads` and `/leads/by-file`; the other four files are one endpoint each.)

`app/routers/v2/` is a new subpackage. One file per converted domain.

```
app/routers/v2/
├── __init__.py
├── documents.py        # /v2/user-documents
├── icp.py              # /v2/icp
├── leads.py            # /v2/leads, /v2/leads/by-file
├── org_auth.py         # /v2/registration only (/org excluded — see §2.1 #2)
├── signals.py          # /v2/fetch-signals
```

Each v2 router uses `PaginatedResponse[T]`, declares its `tags=["v2", "<domain>"]`, accepts `limit` / `offset` query params with `Query(..., ge=..., le=...)` validation, and calls the same service function as v1:

```python
# app/routers/v2/leads.py
from typing import Any, Dict
from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_neo4j_driver
from app.models import PaginatedResponse
from app.services.leads import get_leads_for_org

router = APIRouter(prefix="/leads", tags=["v2", "leads"])


@router.get("", response_model=PaginatedResponse[Dict[str, Any]])
def get_all_leads(
    org_id: str = Query(...),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    driver=Depends(get_neo4j_driver),
):
    items, total = get_leads_for_org(driver, org_id, limit=limit, offset=offset)
    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)
```

`fetch_signals` is the one exception to the `Query(50, ...)` default — it uses `Query(10, ge=1, le=500)` (matches current FE behavior).

The remaining 5 routers follow the same shape as the `leads` example above. Their prefix, item type, and non-standard dependencies:

| Router file | Internal `prefix` | `PaginatedResponse[T]` `T` | Dependencies |
|---|---|---|---|
| `leads.py` | `/leads` (and a second route `@router.get("/by-file", ...)`) | `Dict[str, Any]` | `Depends(get_neo4j_driver)` |
| `documents.py` | `/user-documents` | `UserDocumentEntry` | `Depends(get_mongo)` |
| `icp.py` | `/icp` | `Dict[str, Any]` | `Depends(get_neo4j_driver)`, `Depends(get_mongo)`, `Depends(get_agent_chain)` |
| `org_auth.py` | `/registration` | `RegistrationResponse` | `Depends(get_mongo)` |
| `signals.py` | `/fetch-signals` | `Dict[str, Any]` | `Depends(get_mongo)` |

Note that `documents.py` uses `prefix="/user-documents"` (not `/documents`) so the final v2 path is `/v2/user-documents`, matching the v1 path. Similarly `org_auth.py` uses `prefix="/registration"`.

Mount in `app/main.py`:

```python
from app.routers.v2 import (
    documents as documents_v2,
    icp as icp_v2,
    leads as leads_v2,
    org_auth as org_auth_v2,
    signals as signals_v2,
)
...
app.include_router(leads_v2.router, prefix="/v2")
app.include_router(documents_v2.router, prefix="/v2")
app.include_router(icp_v2.router, prefix="/v2")
app.include_router(org_auth_v2.router, prefix="/v2")
app.include_router(signals_v2.router, prefix="/v2")
```

Each `<domain>_v2.router` already carries its own `prefix="/<domain>"`, so mounting under `/v2` gives the final paths `/v2/leads`, `/v2/user-documents`, etc.

### 3.4 v1 route shape with deprecation marker

Every v1 route keeps its existing `response_model` and sets the `Deprecation` and `Link` response headers. The shape of the body it returns depends on which of the two v1 categories the route belongs to (see §2.1 #2 table).

Each v1 route below gains `response: Response` as a parameter — `from fastapi import Response` is added to the existing `fastapi` import line in each router file.

**Bare-list v1 routes** (`/leads`, `/leads/by-file`, `/registration`) — return only the `items` element of the new tuple:

```python
# app/routers/leads.py — v1, kept alive this phase
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
    items, _ = get_leads_for_org(driver, org_id)  # uses limit=500 default
    return items
```

The docstring "Returns up to 500 leads (silent cap)" only applies verbatim to the three bare-list routes. The new silent cap is a deliberate, strictly-safer behavior change from today's unbounded fetch (see Risk #1).

**Wrapper-shape v1 routes** (`/user-documents`, `/icp`, `/fetch-signals`) — reconstruct the existing wrapper dict from the new tuple. Three concrete shapes:

```python
# app/routers/documents.py — v1 /user-documents
@router.get("/user-documents", response_model=ListUserDocumentsResponse)
async def list_user_documents_endpoint(
    response: Response,
    org_id: str = Query(...),
    mongo=Depends(get_mongo),
):
    """**Deprecated:** use `GET /api/v2/user-documents` for the paginated envelope.

    Returns up to 500 documents (silent cap; previously unbounded).
    """
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v2/user-documents>; rel="successor-version"'
    items, _ = await list_user_documents(mongo, org_id)
    return {"status": "success", "count": len(items), "files": items}
```

```python
# app/routers/icp.py — v1 /icp (preserves existing async declaration; the
# body remains synchronous since list_icps is sync — same as today)
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
    # Accept service defaults (limit=500, offset=0) for the silent-cap convention.
    # Typical ICP cardinality is 5-10, so the cap is effectively dormant.
    items, _ = list_icps(driver, mongo, agent_chain, user_id, refresh=refresh)
    return {"suggestedICPs": items}
```

```python
# app/routers/signals.py — v1 /fetch-signals (preserves existing limit query param,
# including its absence of ge/le validation — current code is Query(10) with no
# constraints; v2 sibling at §3.3 is where the ge=1/le=500 validation is added)
@router.get("/fetch-signals", response_model=FetchSignalsResponse)
async def fetch_signals_endpoint(
    response: Response,
    user_id: str = Query(...),
    limit: int = Query(10),
    mongo=Depends(get_mongo),
):
    """**Deprecated:** use `GET /api/v2/fetch-signals` for the paginated envelope."""
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v2/fetch-signals>; rel="successor-version"'
    items, _ = await fetch_signals(mongo, user_id, limit=limit)
    return {"status": "success", "count": len(items), "signals": items}
```

`/fetch-signals` is the only v1 route that does not get a silent-cap behavior change — it already had an explicit `limit` query parameter that the FE passes (`?limit=10`). The v1 route preserves the param and threads it through to the new service signature.

**v1 `/registration` example** — bare-list pattern, cross-tenant admin view (no `org_id` filter per §2.1 #2), returns `List[RegistrationResponse]` directly:

```python
# app/routers/org_auth.py — v1 /registration (cross-tenant admin view;
# preserves existing async declaration; the body is synchronous since
# list_registrations is sync — same as today)
@router.get("/registration", response_model=List[RegistrationResponse])
async def list_registrations_endpoint(
    response: Response,
    mongo=Depends(get_mongo),
):
    """**Deprecated:** use `GET /api/v2/registration` for the paginated envelope.

    Returns up to 500 registrations (silent cap; previously unbounded).
    Admin-only cross-tenant view — no org_id filter — see §2.1 #2.
    Reads from the separate `Registration_DB` database (not `Profiler`).
    """
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v2/registration>; rel="successor-version"'
    # no org_id filter — admin-only cross-tenant view per §2.1 #2
    items, _ = list_registrations(mongo)
    return items
```

### 3.5 Index relocation

One new helper (`_ensure_leads_indexes`) and one rename (`_ensure_icp_id_registry_indexes` → `_ensure_icp_indexes`), both matching the Phase F `_ensure_market_scoring_indexes(mongo)` signature pattern:

```python
# app/services/leads.py  (new)
def _ensure_leads_indexes(mongo) -> None:
    """Create Mongo indexes for Lead_Stream_Files.
    Idempotent — `create_index` is a no-op when an equivalent index exists.
    """
    coll = mongo["Profiler"]["Lead_Stream_Files"]
    coll.create_index("file_id", unique=True)
    coll.create_index([("user_id", 1), ("org_id", 1)])


# app/services/icp.py  (rename + reparameterize the existing helper at icp.py:1095-1098)
def _ensure_icp_indexes(mongo) -> None:
    """Create Mongo indexes for ICP_ID_REGISTRY. Idempotent."""
    registry = mongo["Profiler"]["ICP_ID_REGISTRY"]
    registry.create_index("id", unique=True)
    registry.create_index("id_type")
```

The leads helper is genuinely new — the inline `lead_stream_coll.create_index(...)` calls inside `batch_upload_leads` (`leads.py:219-220`) move into it and are deleted from the upload path.

The ICP helper is a **rename + signature change**, not an extraction. `_ensure_icp_id_registry_indexes(db)` already exists as a standalone helper at `icp.py:1095-1098` (the spec's earlier draft mis-described this as inline code inside `_reserve_unique_icp_id`). Three changes:

1. Rename `_ensure_icp_id_registry_indexes` → `_ensure_icp_indexes`.
2. Change the parameter from `db` (a database handle) to `mongo` (the full MongoClient), accessing `mongo["Profiler"]["ICP_ID_REGISTRY"]` to match the Phase F lifespan-helper convention. Note the collection name is `ICP_ID_REGISTRY` (all caps), not `ICP_ID_Registry`.
3. Delete the six existing callsites that defensively call the helper before touching the registry. Two are inside `icp.py`: `icp.py:816` (inside `list_icps` after `db = mongo["Profiler"]`) and `icp.py:1051` (inside `delete_recommended_icp`). Four more are inside `customer_profile.py`, each lazily imported to break the import cycle: `customer_profile.py:22` (inside `create_customer_profile`), `:142` (inside `update_customer_profile`), `:221` (inside `list_customer_profiles`), `:359` (inside `delete_customer_profile`). All six callers today extract a `mongo["Profiler"]` handle into a local before calling — five sites name it `db`, one site (`customer_profile.py:220`) names it `profiler_db`. After the rename, each site drops the helper call and passes the upstream `mongo` to subsequent code instead. Implementor must verify the local isn't reused by other code in the same function before deleting it — most aren't, but the dead-local check is mechanical (look for any other `db.<something>` or `profiler_db.<something>` reference in the function body). Once lifespan owns the call, all six imports of `_ensure_icp_id_registry_indexes` go away.
4. Update test mock-patch targets at the 14 sites listed in §2.1 #5 — `mocker.patch("app.services.icp._ensure_icp_id_registry_indexes")` becomes `mocker.patch("app.services.icp._ensure_icp_indexes")`. Without this, the tests fail with a patch-target-mismatch error at collection time.

After these changes, every `_reserve_unique_icp_id` invocation depends on lifespan having run (same as `_ensure_market_scoring_indexes` — established Phase F pattern). The `BREWRA_SKIP_DB_INIT=1` guard in lifespan covers the test-bypass case.

`app/main.py` lifespan grows by two lines:

```python
if app.state.clients.client is not None:
    _ensure_market_scoring_indexes(app.state.clients.client)
    _ensure_leads_indexes(app.state.clients.client)
    _ensure_icp_indexes(app.state.clients.client)
```

### 3.6 Internal-helper bounding

The non-HTTP-facing helpers that today iterate unbounded result sets get bounded explicitly:

- `_get_latest_market_score_rows(driver, mongo, org_id, limit=500, offset=0)` — currently iterates all market-score docs for an org. Post-Phase-G signature returns `tuple[List[LeadMarketScoreRow], int]` (not the generic `tuple[list[dict], int]` from §3.2 — this helper returns the typed `LeadMarketScoreRow` model). All internal callers in `market_scoring.py` update to unpack the tuple.
- `_run_market_scoring_for_org` background task calls `get_leads_for_org(driver, org_id, limit=5000, offset=0)` (drops the `order_by_recent=True` kwarg — `ORDER BY` is now mandatory in the Cypher; see §3.2). The 5000 cap (CLAUDE.md "Gotchas") stays explicit at the call site as it is today.

No external API exposes these helpers; they are free to change without a v2 sibling. (Note: an earlier spec draft listed `score_coll.find(run_score_filter, ...)` at `market_scoring.py:417` as needing an explicit `.limit(5000)`. That `.find()` already has `.limit(recent_items_limit)` parameterized by the enclosing `get_market_scores_status` caller — no change needed.)

---

## 4. Migration sequencing

Single feature branch off `master`: `refactor-backend-pagination-and-index-hygiene-phase-g`. **8 commits** (2 prep + 5 domain conversions + 1 internal-helpers). Each commit independently green; bisectable.

### 4.1 Prep (2 commits)

1. **Add `PaginatedResponse[T]` model.** New file `app/models/pagination.py`. Re-export from `app/models/__init__.py`. Add 3 unit tests in `tests/unit/test_pagination_model.py` (generic instantiation, validation rules, JSON round-trip). No router or service changes. (~30 LOC.)

2. **Move `create_index` calls to lifespan.** Seven sub-operations, all landing in one commit:
   1. Add new helper `_ensure_leads_indexes(mongo)` to `app/services/leads.py`.
   2. Rename + reparameterize `_ensure_icp_id_registry_indexes(db)` at `icp.py:1095-1098` to `_ensure_icp_indexes(mongo)`, accessing `mongo["Profiler"]["ICP_ID_REGISTRY"]`.
   3. Wire both into `app/main.py` lifespan, gated on `app.state.clients.client is not None`.
   4. Delete the inline `create_index` calls from `batch_upload_leads` at `leads.py:219-220`.
   5. Delete all six defensive callsites of the renamed ICP helper per §3.5 (two in `icp.py` at lines 816, 1051; four in `customer_profile.py` at lines 22, 142, 221, 359 — each with its lazy `from app.services.icp import ...` import).
   6. Update the 14 test mock-patch targets per §3.5 step 4.
   7. Add 2 integration tests asserting the helpers run during app startup.

   (~70-80 LOC.) The rename, callsite cleanup, and test patch renames must land in a single commit — splitting them creates a non-bisectable intermediate where `customer_profile.py` imports a function that no longer exists. No pagination work yet — this commit is pure index hygiene.

### 4.2 Per-domain conversions (5 commits, smallest → largest)

Each commit: update one service file (add `limit`/`offset` params, return `(items, total)` tuple), add the matching `app/routers/v2/<domain>.py` file, update the v1 route to use the new service signature and emit the deprecation headers, update tests.

| # | Commit | v1 endpoints touched | v1 shape | v2 endpoints added | Service fns | Notes |
|---|---|---|---|---|---|---|
| 3 | `documents` | `GET /user-documents` | wrapper-shape | `GET /v2/user-documents` | `list_user_documents` | Mongo-only. **Wrapper-shape v1** — `list_user_documents` today returns `{status, count, files}`; service signature changes to `tuple[list, int]` and the v1 route reconstructs the wrapper (§3.4). v2 returns `PaginatedResponse[UserDocumentEntry]`. |
| 4 | `icp` | `GET /icp` | wrapper-shape | `GET /v2/icp` | `list_icps` | Refresh flag stays; pagination applies after the (optional) LLM regeneration. **Wrapper-shape v1** — `list_icps` today returns `{suggestedICPs: [...]}`; service signature changes to `list_icps(..., limit: int = 500, offset: int = 0) -> tuple[list[dict], int]` (default `limit=500` matches the other services' silent-cap default; v2 route layer narrows to `Query(50, ge=1, le=500)`). The v1 route reconstructs `{suggestedICPs: items}` from the tuple. v2 router injects `agent_chain` via `Depends(get_agent_chain)`. **Pagination is in-memory** (unlike Mongo/Neo4j services where slicing happens at the query layer): both the cached path (`icp.py:842`) and the generation path (`icp.py:894`) end in a `return <dict_with_suggestedICPs>`. Phase G changes each return site individually rather than restructuring around a single return point — simpler given the existing early-return shape. At each site: `all_items = <result>["suggestedICPs"]; total = len(all_items); items = all_items[offset:offset+limit]; return items, total`. This preserves the `total ≠ len(items)` invariant the §5.1 envelope test asserts — `total` is the full pre-slice count, `items` is the page. |
| 5 | `signals` | `GET /fetch-signals` | wrapper-shape | `GET /v2/fetch-signals` | `fetch_signals` | Already has `limit=10`; gains `offset` + envelope. v2 default stays at `limit=10` to match current FE behavior. **Wrapper-shape v1** — `fetch_signals` today returns `{status, count, signals}` where `count = len(signals_list)` from a single `.find()`; service signature changes to `tuple[list, int]` and gains a new `collection.count_documents({"user_id": user_id})` call to compute `total` (the items-and-total convention requires it). v1 route reconstructs the wrapper while preserving its existing `?limit=N` query param (no silent cap). |
| 6 | `org_auth` | `GET /registration` | bare-list | `GET /v2/registration` | `list_registrations` | `GET /org` excluded — `list_orgs` returns a single dict, not a list. v2 router uses `PaginatedResponse[RegistrationResponse]`. Service returns `tuple[list[RegistrationResponse], int]`, not `tuple[list[dict], int]` — same typed-return pattern as `_get_latest_market_score_rows` in §3.6. `count_documents()` and `.skip()/.limit()` run before the per-document Pydantic construction loop. |
| 7 | `leads` | `GET /leads`, `GET /leads/by-file` | bare-list | `GET /v2/leads`, `GET /v2/leads/by-file` | `get_leads_for_org`, `list_leads_by_file` | Largest. Neo4j Cypher with `SKIP $offset LIMIT $limit`. Two endpoints in one commit. Both functions adopt `ORDER BY l.created_at DESC` (matching `get_leads_for_org`'s prior `order_by_recent=True` semantics; `list_leads_by_file` had no ordering before). Drops the `order_by_recent` parameter on `get_leads_for_org` (now redundant — `ORDER BY` is mandatory). Updates all four internal call sites in the same commit: `market_scoring.py:393,678` (keep `limit=5000`) and `signals.py:594,732` (keep `limit=100`); each loses the `order_by_recent=True` kwarg. |

Each conversion commit:

- Updates the service function signature: adds `limit: int = 500, offset: int = 0` (or `limit: int = 10` for `fetch_signals`), changes return type to `tuple[list[X], int]`.
- Updates every internal / background-task callsite to pass explicit values (or accept the defaults).
- Adds `app/routers/v2/<domain>.py` with the v2 route(s) returning `PaginatedResponse[T]`, tagged `["v2", "<domain>"]`.
- Updates `app/main.py` to `include_router(<domain>_v2.router, prefix="/v2")`.
- Updates the v1 route in `app/routers/<domain>.py` to use the new service signature (calls without kwargs → takes defaults → returns only `items`) and adds the `Deprecation` + `Link` response headers.
- Updates `tests/test_<domain>.py` to assert the deprecation header on v1 responses.
- Adds new tests in `tests/test_<domain>_v2.py` for envelope shape, `limit`/`offset` correctness, hard-cap clamping (422 on `limit=501`), and total accuracy.
- Updates `tests/unit/test_<domain>.py` to call services with the new tuple-return signature.

### 4.3 Internal-helper bounding (1 commit)

8. **`market_scoring` internal helpers.** `_get_latest_market_score_rows(driver, mongo, org_id, limit=500, offset=0)` gains explicit pagination args and returns `tuple[List[LeadMarketScoreRow], int]`. The background-task callsites pass their own explicit values. No HTTP surface change. (~50 LOC, down from ~60 after dropping the obsolete `market_scoring.py:417` `.find()` audit — that line is already bounded.)

### 4.4 Per-commit validation

```bash
cd backend && pytest tests/        # green
git diff --stat                    # sanity-check the diff size
git commit -m "<conventional msg> [phase G, commit N/8]"
```

### 4.5 Rollback

Every commit is `git revert`-safe. Commits 1–2 are additive (new model + lifespan helpers; v1 behavior unchanged after the `create_index` move because the helpers are idempotent). Commits 3–7 add v2 routes additively and modify v1 routes in a strictly-safer direction (silent 500 cap replaces unbounded). Commit 8 changes internal helper signatures only — no caller outside `market_scoring.py` is affected. Branch bisectable end-to-end.

---

## 5. Test patterns

### 5.1 v2 endpoint integration tests

Each v2 endpoint gets four tests in `tests/test_<domain>_v2.py`:

```python
# tests/test_leads_v2.py
def test_v2_leads_envelope_shape(client, mock_neo4j):
    """v2 returns {items, total, limit, offset}, not a bare list."""
    mock_neo4j["session"].run.side_effect = [
        [{"l": {"name": "X"}}],                    # items query
        MagicMock(single=lambda: {"total": 1}),    # count query
    ]
    response = client.get("/v2/leads?org_id=org_1")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "limit", "offset"}
    assert body["limit"] == 50
    assert body["offset"] == 0
    assert body["total"] == 1


def test_v2_leads_limit_offset_passthrough(client, mock_neo4j):
    """limit/offset query params reach the Cypher query."""
    response = client.get("/v2/leads?org_id=org_1&limit=10&offset=20")
    call_kwargs = mock_neo4j["session"].run.call_args_list[0].kwargs
    assert call_kwargs["limit"] == 10
    assert call_kwargs["offset"] == 20


def test_v2_leads_limit_above_cap_rejected(client):
    """limit > 500 returns 422 via Query(..., le=500)."""
    response = client.get("/v2/leads?org_id=org_1&limit=501")
    assert response.status_code == 422


def test_v2_leads_total_independent_of_limit(client, mock_neo4j):
    """total reflects DB count, not items length."""
    mock_neo4j["session"].run.side_effect = [
        [{"l": {"name": "X"}}, {"l": {"name": "Y"}}],
        MagicMock(single=lambda: {"total": 423}),
    ]
    body = client.get("/v2/leads?org_id=org_1&limit=2").json()
    assert len(body["items"]) == 2
    assert body["total"] == 423
```

### 5.2 v1 deprecation header

One assertion per v1 list endpoint, folded into the existing happy-path test in `tests/test_<domain>.py`:

```python
def test_v1_leads_emits_deprecation_header(client, mock_neo4j):
    response = client.get("/leads?org_id=org_1")
    assert response.headers.get("Deprecation") == "true"
    assert 'rel="successor-version"' in response.headers.get("Link", "")
    assert "/api/v2/leads" in response.headers["Link"]
```

### 5.3 Unit tests for paginated services

```python
# tests/unit/test_leads.py
def test_get_leads_for_org_returns_items_and_total(mock_session):
    driver, session = mock_session
    session.run.side_effect = [
        [{"l": {"name": "Lead A"}}, {"l": {"name": "Lead B"}}],
        MagicMock(single=lambda: {"total": 7}),
    ]
    items, total = services.leads.get_leads_for_org(driver, "org_1", limit=10, offset=0)
    assert len(items) == 2
    assert total == 7


def test_get_leads_for_org_default_limit_is_500(mock_session):
    driver, session = mock_session
    session.run.side_effect = [[], MagicMock(single=lambda: {"total": 0})]
    services.leads.get_leads_for_org(driver, "org_1")  # no kwargs
    first_call_kwargs = session.run.call_args_list[0].kwargs
    assert first_call_kwargs["limit"] == 500
    assert first_call_kwargs["offset"] == 0
```

### 5.4 `PaginatedResponse` model tests

```python
# tests/unit/test_pagination_model.py
def test_paginated_response_with_dict_items():
    resp = PaginatedResponse[Dict[str, Any]](
        items=[{"id": 1}, {"id": 2}],
        total=100, limit=50, offset=0,
    )
    assert resp.items[0]["id"] == 1
    assert resp.total == 100


def test_paginated_response_limit_validation():
    with pytest.raises(ValidationError):
        PaginatedResponse[Dict](items=[], total=0, limit=501, offset=0)


def test_paginated_response_json_round_trip():
    resp = PaginatedResponse[Dict](items=[{"x": 1}], total=1, limit=50, offset=0)
    assert PaginatedResponse[Dict].model_validate_json(resp.model_dump_json()) == resp
```

### 5.5 Lifespan index-ensure tests

Patch targets must reference `app.main._ensure_leads_indexes` (and `app.main._ensure_icp_indexes`), not `app.services.<module>._ensure_*`. `app/main.py` does `from app.services.leads import _ensure_leads_indexes` (see §3.5), which creates a new binding in `app.main`'s namespace — the lifespan function calls *that* binding, not the source-module binding. Patching `app.services.leads._ensure_leads_indexes` rebinds the source module's name but leaves `app.main`'s existing reference pointing at the original function, so the test would silently pass against unchanged behavior. Do not "fix" the patch target back to the more natural-looking `app.services.leads._ensure_leads_indexes`.

```python
# tests/test_lifespan.py
def test_lifespan_calls_ensure_leads_indexes(monkeypatch):
    called = []
    monkeypatch.setattr(
        "app.main._ensure_leads_indexes",
        lambda mongo: called.append("leads"),
    )
    # FastAPI TestClient runs lifespan on context-manager __enter__.
    with TestClient(app):
        pass
    assert "leads" in called


def test_lifespan_skipped_when_mongo_none(monkeypatch):
    # When BREWRA_SKIP_DB_INIT=1, clients.client is None and the ensure
    # helpers are not called. Patch targets are app.main._ensure_*, not
    # app.services.<module>._ensure_* — see binding-semantics note above.
    ...
```

Test count: 203 (Phase F baseline) + ~24 v2 endpoint tests (6 endpoints × 4) + ~10 unit tests for services + 3 pagination model tests + 2 lifespan tests → **~242**. The 6 v1 deprecation-header assertions don't add to the count — they're folded into existing happy-path tests (per §2.1 #9), adding assertions to tests already counted in the 203 baseline. Exact count finalized at implementation time and pinned in the plan.

---

## 6. Risks

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| 1 | v1 `/leads` silent 500-row cap surprises a consumer with >500 leads | Low (0 live users) × Medium impact | Documented in v1 route docstring + spec announcement. Deprecation header signals the path forward. Acceptable at MVP per CLAUDE.md "Business State". v2 path already available. |
| 2 | Every paginated list now runs two queries (items + count), so DB load doubles per list call. The two queries are non-atomic — a concurrent write between them can leave `total` out of step with `len(items)` within a single response (Neo4j sessions are not transaction boundaries; Mongo's `.find()` + `.count_documents()` are likewise independent operations). | Medium (impact at scale) × Low (current scale) | At MVP scale (sub-10k rows per tenant, low concurrent-write rate) both the cost and consistency concerns are negligible. The future `has_more` swap-in (§8 #5) eliminates both classes simultaneously — dropping the count query removes the doubled load and the non-atomic-pair consistency gap in one move. |
| 3 | Pydantic v2 `PaginatedResponse[Generic[T]]` rendering quirks in FastAPI OpenAPI schema | Low | Pydantic 2.13.4 and FastAPI both support parameterized generics in `response_model`. Generic-instantiation test (§5.4) catches regressions. If OpenAPI rendering breaks for a specific `T`, fall back to a per-domain concrete subclass (`class LeadPaginatedResponse(PaginatedResponse[LeadDict])`). |
| 4 | Inline `create_index` removal breaks a unit test that bypasses lifespan and exercises the hot path | Low | Before commit 2, grep `tests/unit/` for any test exercising `batch_upload_leads` or `_reserve_unique_icp_id` directly. Either add manual index setup to those tests or convert them to use the TestClient (which triggers lifespan). |
| 5 | Cypher `SKIP $offset LIMIT $limit` returns inconsistent rows across pages when `ORDER BY` is missing | Medium (correctness) | Every paginated Cypher query in §3 includes an explicit `ORDER BY` clause. Spec §7.1 grep enforces this. |
| 6 | Commit 7 (`leads`) breaks four cross-domain callers in one shot when it drops `order_by_recent` from `get_leads_for_org` | Low | The signature change is mechanical (the kwarg is just removed). All four call sites — `market_scoring.py:393,678` and `signals.py:594,732` — are updated in the same commit per §4.2. The tests in those domains catch a missed update via `TypeError: unexpected keyword argument 'order_by_recent'`. Behavior preserved: every caller already passed `order_by_recent=True`, and `ORDER BY l.created_at DESC` is now mandatory in the Cypher. |
| 7 | FE breaks because it consumed v1 + new code accidentally hits v2 with a wrong query string | Low | v1 paths unchanged; v2 mounted under a separate prefix. FE has to deliberately change a URL to switch. Acceptance §7.1 includes a grep against `frontend/src/` to confirm no v2 paths have been added in this phase. |
| 8 | Renaming a private helper misses lazy-importer callsites in other modules (this round-2 issue) | Medium (correctness) | Before any rename of a private helper that crosses service boundaries, run `git grep -nE "from app\.services\.<module> import _[a-z]" backend/` and `git grep -nE "mocker\.patch\(.app\.services\.<module>\._" backend/tests/` to enumerate every lazy importer and every test mock-patch target. Phase G's `_ensure_icp_id_registry_indexes` rename is the worked example — six service-layer callsites (two in `icp.py`, four in `customer_profile.py`) and fourteen test patches across two files. Apply the same audit to any future rename. |

---

## 7. Acceptance criteria

### 7.1 Hard (greppable / measurable)

```bash
# 1. PaginatedResponse model exists and is generic
git grep "class PaginatedResponse" backend/app/models/pagination.py     # 1 hit
git grep "PaginatedResponse\[" backend/app/routers/v2/                  # 6+ hits (one per v2 route)

# 2. v2 routes mounted for every target endpoint
git grep -E "router\.get\(.*PaginatedResponse" backend/app/routers/v2/  # 6+ hits
git grep "include_router.*v2.*prefix" backend/app/main.py               # 5 hits (one per domain — documents, icp, leads, org_auth, signals)

# 3. Every v1 list route emits the deprecation header
git grep -E "Deprecation.*=.*\"true\"" backend/app/routers/ | grep -v v2/  # 6+ hits
git grep -E "successor-version" backend/app/routers/ | grep -v v2/         # 6+ hits

# 4. No inline create_index calls in service hot paths
git grep -nE "\.create_index\(" backend/app/services/ \
  | grep -v "_ensure_.*_indexes"                                        # empty

# 5. Every paginated Cypher query has ORDER BY before SKIP/LIMIT
#    (-B3 covers the multi-line query shape in §3.2 where ORDER BY sits
#     one line above SKIP/LIMIT; tighten to -B5 if a paginated query
#     ever inserts intermediate clauses between ORDER BY and SKIP/LIMIT.)
git grep -B3 -E "SKIP \$offset LIMIT \$limit" backend/app/services/ \
  | grep -E "ORDER BY"                                                  # one hit per paginated query

# 6. Lifespan calls all three _ensure_*_indexes helpers
git grep "_ensure_.*_indexes" backend/app/main.py                       # 3 hits

# 7. No v2 paths consumed by frontend yet (deliberate — FE migrates separately)
git grep -E "/api/v2/" frontend/src/                                    # empty

# 8. Tests pass
cd backend && pytest tests/                                             # green; ~242 tests
```

### 7.2 Soft (verifiable manually)

- `app/models/pagination.py` exists with `PaginatedResponse[T]` generic; re-exported from `app/models/__init__.py`.
- `app/routers/v2/` subpackage exists with one router file per converted domain (5 files: `documents.py`, `icp.py`, `leads.py`, `org_auth.py`, `signals.py`).
- Every v2 route declares `tags=["v2", "<domain>"]`.
- `app/services/leads.py` exports `_ensure_leads_indexes(mongo)`; `app/services/icp.py` exports `_ensure_icp_indexes(mongo)`.
- `_reserve_unique_icp_id` and `batch_upload_leads` no longer call `create_index` inline.
- v1 list-route docstrings include the `**Deprecated:**` note pointing at the v2 path.
- The 6 v2 endpoints accept `limit` (default 50, max 500; `fetch_signals` default 10) and `offset` (default 0) with FastAPI `Query(..., ge=..., le=...)` validation.
- The Neo4j paginated service functions use a single `with driver.session() as s:` block for both items and count queries.
- `get_leads_for_org` no longer accepts an `order_by_recent` parameter; all four former call sites (`market_scoring.py:393,678`; `signals.py:594,732`) have been updated.
- v2 registration route uses `PaginatedResponse[RegistrationResponse]`; v2 user-documents uses `PaginatedResponse[UserDocumentEntry]` — both reflect the typed item models, not `Dict[str, Any]`.
- The three wrapper-shape v1 routes (`/user-documents`, `/icp`, `/fetch-signals`) keep their existing `response_model` and reconstruct the wrapper dict from the new tuple-returning service.
- Every v1 list endpoint's response body is structurally identical to its pre-Phase-G shape (same keys, same types) when called with the same parameters — only the 500-row silent cap and deterministic ordering differ from prior behavior. v1 tests assert the existing shape via `response_model` declarations.

### 7.3 Phase complete when

- All 8 commits land on `master`.
- Test count rises from 203 (Phase F baseline) to approximately 242 (precise count finalized at implementation time and pinned in the plan).
- This spec's §8 captures the deferred items the next phase will consider.

---

## 8. Phase H+ Inventory (carry-forward)

Phase G consumes Phase F §8 items #2 (pagination convention) and #3 (`create_index`-on-hot-path audit). The remaining backlog plus new Phase G follow-ups:

### Most-likely Phase H

1. **v1 route deletion.** Once FE has migrated to v2 (verified by `git grep "/api/<endpoint>"` returning zero non-v2 hits in `frontend/src/`), delete the v1 routes and their tests. Trigger: zero FE callsites against the v1 paths.
2. **Security hardening** (Phase F §8 #1, was originally intended as Phase G scope). Cypher injection parameterization (`graph_chat.voice_graph`/`text_graph`, `profiles.py:87,94,104`), CORS off `*`, raw Cypher endpoint guard, `/leads` LIMIT enforcement as a security measure. Aligns with "before launch" gate per CLAUDE.md "Business State".
3. **Codify the `from X import Y` lifespan-patch-target convention** in `AGENTS.md` (or a `backend/TESTING_CONVENTIONS.md`) so future phases don't rediscover the binding-semantics gotcha from §5.5 (patch the `app.main._ensure_*` binding, not the source-module binding). Also audit the existing Phase F `_ensure_market_scoring_indexes` lifespan test for the same bug — if it patches `app.services.market_scoring._ensure_market_scoring_indexes` instead of `app.main._ensure_market_scoring_indexes`, the test silently passes against unchanged behavior. Trigger: next phase that adds a lifespan helper, or this fix if the Phase F test is already broken.

### Phase I+ candidates

4. **B4 small-pattern dedup audit.** JSON detection ×6, company-profile-fetch ×8, `validate_url` ×2, `update_signal_track` ×3.
5. **`has_more` swap-in for the count query.** If a tenant's lists grow large enough that the second query (count) becomes hot, swap to `fetch limit+1` + `has_more` semantics. v2 envelope adds an optional `has_more` field; `total` becomes optional. Trigger: count-query latency becomes noticeable in profiling or operational logs. (No APM/Datadog in the backend today — this is a "revisit when the pain shows up in `pytest --durations` or hand-profiling" heuristic, not a metric-driven gate.)
6. **Sort-key convention.** `?sort=field:direction` on v2 list endpoints. Adds `ORDER BY` selection to paginated services. Trigger: first FE request that needs configurable sort beyond the per-endpoint default.
7. **TD-004 — real LLM captures.** Run `capture_fixtures.py` with full API keys; replace 24 stubs in `tests/fixtures/captured/*.json`. CTO owns.
8. **Phase E review follow-ups:** M1 (pytest-asyncio migration), M4 (pytest config + markers + `make test-unit` / `make test-integration`), L4 (CI staleness check for captured fixtures).
9. **Anthropic SDK migration.** Replace bare `requests.post` in Claude paths.
10. **`tiktoken` for budget estimation.**
11. **Redis-backed Claude budget.**
12. **Inline prompts → `app/prompts/`.**
13. **Shared `memory` audit.**

---

## 9. Filename conventions

- **Spec (this document):** `/specs/2026-05-23-backend-pagination-and-index-hygiene-phase-g-design.md`.
- **Plan (next, after spec approval):** `/plans/modularization-plan-7.md` (continuing the modularization-plan numbering).
- **Branch:** `refactor-backend-pagination-and-index-hygiene-phase-g`.
- **Commit-message format:** `<type>(be): <description> [phase G, commit N/8]` matching Phase A–F precedent. Conventional-commit type per change: `feat(be)` for v2 routes, `refactor(be)` for service-signature changes, `chore(be)` for index relocation, `test(be)` for test-only commits if any.
