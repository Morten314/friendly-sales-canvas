# Internal Ops Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Brewra-internal ops console at `/admin/*` (React feature `src/features/admin/`) that replaces the two legacy backend HTML tools, backed by two new read endpoints.

**Architecture:** A lazy-loaded per-feature module reusing `shared/auth`, `shared/api` (transport + zod contracts + TanStack Query), and shadcn/ui. Two new backend endpoints live in a dedicated `app/routers/admin.py` + `app/services/admin/` mounted at `prefix="/admin"`. All other capabilities reuse existing endpoints. Backend ships first; FE contracts are written against live-verified shapes.

**Tech Stack:** FastAPI / Pydantic / pymongo / neo4j / Pinecone (backend); React 18 + Vite + TypeScript + TanStack Query + zod + React Router + shadcn/ui (frontend); pytest (backend), vitest + MSW (frontend).

**Spec:** `specs/44-admin-ops-console-design.md` (+ review/synthesis round 1 in `docs/reviews/`).

## Global Constraints

- **Branch:** all work on `spec-44-admin-ops-console` (already cut off `master`). Commit surgically by path — never `git add -A` (parallel sessions share the tree).
- **Commit messages:** `type(scope):` format (`feat(be):`, `feat(fe):`, `test(be):`, `chore(fe):`, `docs(plans):`). **No `Co-Authored-By` footer.** No `[N/M]` suffixes.
- **No global `/api` in the app:** routers define their own prefix; the `/api` base is added by the FE (`API_BASE_URL = "/api"` in `transport.ts`). Backend route `/admin/orgs` is reached from the FE as endpoint string `"admin/orgs"`.
- **Backend-first sequencing:** build endpoint → run it → `curl`/`/docs` to confirm the JSON shape → only then write the FE zod contract against the confirmed shape.
- **Backend tests:** run with `backend/.venv/bin/python -m pytest <path> -q` (no `PYTHONPATH`). Patch-where-used (see `backend/TESTING.md`): patch the symbol on the module that imported it, not where it's defined. Dependency injection is overridden via `app.dependency_overrides[get_x] = lambda: mock`.
- **FE per-task verify:** `npm run typecheck` (the npm script — **not** bare `npx tsc`, the root tsconfig is a no-op stub) and `npm run verify` (typecheck + lint + changed tests). Run `npx prettier --check <touched files>` per task (the per-task `verify` omits format:check). All commands run **inside `frontend/`**.
- **FE merge gate:** serial `npm run preflight` (typecheck, lint, format:check, vitest, build, bundle:check, Playwright+VR, knip --strict) green before merge.
- **FE import rule:** cross-feature imports go through a feature's `index.ts` only (enforced by `import-x`). Admin imports shared code from `@/shared/*` and `@/features/shell`.
- **Auth reality:** the backend does not validate auth; the admin email allowlist is a cosmetic client-side guardrail, not a security boundary (spec §3). Do not add backend authz.
- **MongoDB org store shape (verified):** DB `Org_Management`; collection `orgs` is a single doc `{_id:"orgs", org_list:[org_id,...], org_names:{org_id:name}, created_at, updated_at}`; collection `users` is a single doc `{_id:"users", user_mappings:{user_id:org_id}, ...}`.
- **Abort condition:** if a new endpoint's live shape can't be confirmed (Task 1 step 8 / Task 2 step 6) or a reused endpoint returns an unexpected 4xx, **stop and report** — do not guess the contract. The mandated `executing-plans` / `subagent-driven-development` skills report-and-wait on failure by default; this names the explicit trigger.

---

## File Structure

**Backend (new):**
- `backend/app/models/admin.py` — `AdminOrgSummary`, `HealthProbe`, `AdminHealthResponse`.
- `backend/app/services/admin/__init__.py` — re-exports `list_all_orgs`, `aggregate_health`.
- `backend/app/services/admin/orgs.py` — `list_all_orgs(mongo)`.
- `backend/app/services/admin/health.py` — `probe_mongo`, `probe_neo4j`, `probe_pinecone`, `probe_llm_health`.
- `backend/app/routers/admin.py` — `GET /orgs`, `GET /health`.
- `backend/app/main.py` — one `include_router(admin.router, prefix="/admin")` line (modify).
- `backend/tests/test_admin.py` — endpoint tests.

**Frontend (new feature `src/features/admin/`):**
- `index.ts`, `routes.tsx`, `README.md`, `types.ts`, `adminAllowlist.ts`
- `guards/AdminGuard.tsx` (+ `guards/__tests__/AdminGuard.test.tsx`)
- `components/AdminLayout.tsx`
- `services/admin.ts`
- `hooks/useAdminOrgs.ts`, `hooks/useSystemHealth.ts`, `hooks/useRegistrations.ts`, `hooks/useOrgActions.ts`, `hooks/useOrgInspection.ts` (+ `hooks/__tests__/useAdminOrgs.test.tsx`)
- `pages/TenantsOverviewPage.tsx` (+ `pages/__tests__/TenantsOverviewPage.test.tsx`), `pages/OrgDetailPage.tsx`, `pages/RegistrationsPage.tsx`, `pages/SystemHealthPage.tsx`

**Frontend (modify):**
- `src/shared/api/queryKeys.ts` — add admin keys.
- `src/app/routes.tsx` — register `adminRoutes`.

**Cleanup:**
- Delete `backend/admin_panel.html`, `backend/registration_admin_panel.html`.

---

## Task 1: Backend — `GET /admin/orgs`

**Files:**
- Create: `backend/app/models/admin.py`
- Create: `backend/app/services/admin/__init__.py`
- Create: `backend/app/services/admin/orgs.py`
- Create: `backend/app/routers/admin.py`
- Modify: `backend/app/main.py` (add include_router)
- Test: `backend/tests/test_admin.py`

**Interfaces:**
- Produces: `list_all_orgs(mongo) -> list[dict]`; route `GET /admin/orgs` → `List[AdminOrgSummary]` where `AdminOrgSummary = {org_id: str, org_name: str|None, user_count: int, user_ids: list[str]}` (`extra="allow"`).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_admin.py`:

```python
"""Tests for the internal ops-console endpoints (spec 44)."""
from contextlib import contextmanager
from unittest.mock import MagicMock


@contextmanager
def _override(provider, instance):
    from app.main import app
    app.dependency_overrides[provider] = lambda: instance
    try:
        yield
    finally:
        app.dependency_overrides.pop(provider, None)


def _mongo_with_org_docs(orgs_doc, users_doc):
    """MongoClient-shaped mock where db['orgs'] / db['users'] each return a
    collection mock with the right find_one result."""
    orgs_col = MagicMock()
    orgs_col.find_one.return_value = orgs_doc
    users_col = MagicMock()
    users_col.find_one.return_value = users_doc
    db = MagicMock()
    db.__getitem__.side_effect = lambda name: {"orgs": orgs_col, "users": users_col}[name]
    mongo = MagicMock()
    mongo.__getitem__.return_value = db  # mongo["Org_Management"] -> db
    return mongo


def test_admin_orgs_returns_orgs_with_user_counts(client):
    from app.core.dependencies import get_mongo
    orgs_doc = {"_id": "orgs", "org_list": ["o1", "o2"], "org_names": {"o1": "Acme"}}
    users_doc = {"_id": "users", "user_mappings": {"u1": "o1", "u2": "o1", "u3": "o2"}}
    mongo = _mongo_with_org_docs(orgs_doc, users_doc)

    with _override(get_mongo, mongo):
        resp = client.get("/admin/orgs")

    assert resp.status_code == 200
    body = resp.json()
    by_id = {o["org_id"]: o for o in body}
    assert by_id["o1"]["org_name"] == "Acme"
    assert by_id["o1"]["user_count"] == 2
    assert sorted(by_id["o1"]["user_ids"]) == ["u1", "u2"]
    assert by_id["o2"]["org_name"] is None
    assert by_id["o2"]["user_count"] == 1


def test_admin_orgs_empty_when_no_orgs_doc(client):
    from app.core.dependencies import get_mongo
    mongo = _mongo_with_org_docs(None, None)
    with _override(get_mongo, mongo):
        resp = client.get("/admin/orgs")
    assert resp.status_code == 200
    assert resp.json() == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/.venv/bin/python -m pytest backend/tests/test_admin.py -q`
Expected: FAIL — `404 Not Found` (route not registered) / import errors.

- [ ] **Step 3: Create the model**

Create `backend/app/models/admin.py`:

```python
"""Models for the internal ops-console endpoints (spec 44)."""
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class AdminOrgSummary(BaseModel):
    # The orgs document is loosely structured; allow extras (spec §6 item 1).
    model_config = ConfigDict(extra="allow")
    org_id: str
    org_name: Optional[str] = None
    user_count: int = 0
    user_ids: List[str] = []


class HealthProbe(BaseModel):
    name: str
    status: str  # "ok" | "error" | "timeout"
    detail: Optional[str] = None
    latency_ms: Optional[float] = None


class AdminHealthResponse(BaseModel):
    probes: List[HealthProbe]
```

- [ ] **Step 4: Create the service**

Create `backend/app/services/admin/orgs.py`:

```python
"""Admin ops — list all orgs from the single Org_Management documents."""
from typing import Any, Dict, List


def list_all_orgs(mongo) -> List[Dict[str, Any]]:
    """Read the single `{_id:"orgs"}` and `{_id:"users"}` documents and return
    one summary per org. Unpaginated single-doc read (spec §6 item 1)."""
    db = mongo["Org_Management"]
    orgs_doc = db["orgs"].find_one({"_id": "orgs"}) or {}
    users_doc = db["users"].find_one({"_id": "users"}) or {}

    org_list: List[str] = orgs_doc.get("org_list", [])
    org_names: Dict[str, str] = orgs_doc.get("org_names", {})
    user_mappings: Dict[str, str] = users_doc.get("user_mappings", {})

    users_by_org: Dict[str, List[str]] = {}
    for user_id, org_id in user_mappings.items():
        users_by_org.setdefault(org_id, []).append(user_id)

    result: List[Dict[str, Any]] = []
    for org_id in org_list:
        uids = users_by_org.get(org_id, [])
        result.append({
            "org_id": org_id,
            "org_name": org_names.get(org_id),
            "user_count": len(uids),
            "user_ids": uids,
        })
    return result
```

Create `backend/app/services/admin/__init__.py`:

```python
"""admin service — public API (spec 44)."""
from app.services.admin.orgs import list_all_orgs

__all__ = ["list_all_orgs"]
```

- [ ] **Step 5: Create the router**

Create `backend/app/routers/admin.py`:

```python
"""Internal ops-console router. Mounted at prefix='/admin' (spec 44)."""
from typing import List

from fastapi import APIRouter, Depends

from app.core.dependencies import get_mongo
from app.models.admin import AdminOrgSummary
from app.services.admin import list_all_orgs

router = APIRouter(tags=["admin"])


@router.get("/orgs", response_model=List[AdminOrgSummary])
async def admin_list_orgs(mongo=Depends(get_mongo)):
    return list_all_orgs(mongo)
```

- [ ] **Step 6: Register the router in main**

In `backend/app/main.py`, after the `connectors.router` include (the last `include_router` block), add:

```python
from app.routers import admin

app.include_router(admin.router, prefix="/admin")
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `backend/.venv/bin/python -m pytest backend/tests/test_admin.py -q`
Expected: PASS (2 passed).

- [ ] **Step 8: Verify the live shape**

Run a local backend and confirm the JSON shape (records it for the FE contract in Task 9):
Run: `cd backend && .venv/bin/python -m uvicorn main:app --port 8001 &` then `curl -s localhost:8001/admin/orgs | head -c 400`
Expected: a JSON array of `{org_id, org_name, user_count, user_ids}` objects (or `[]`). Note the exact keys; stop the server afterward.

- [ ] **Step 9: Commit**

```bash
git add backend/app/models/admin.py backend/app/services/admin/ backend/app/routers/admin.py backend/app/main.py backend/tests/test_admin.py
git commit -m "feat(be): add GET /admin/orgs ops endpoint"
```

---

## Task 2: Backend — `GET /admin/health`

**Files:**
- Create: `backend/app/services/admin/health.py`
- Modify: `backend/app/services/admin/__init__.py` (export `aggregate_health` probes)
- Modify: `backend/app/routers/admin.py` (add `/health`)
- Modify: `backend/tests/test_admin.py` (add health tests)

**Interfaces:**
- Consumes: `probe_llm` from `app/services/health.py`; dependency providers `get_mongo`, `get_neo4j_driver`, `get_pinecone`, `get_llm2`.
- Produces: route `GET /admin/health` → `AdminHealthResponse = {probes: [{name, status, detail?, latency_ms?}]}`. Each probe runs under a 5s timeout.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_admin.py`:

```python
def test_admin_health_aggregates_all_probes(client):
    from app.core.dependencies import (
        get_mongo, get_neo4j_driver, get_pinecone, get_llm2,
    )
    from app.main import app

    mongo = MagicMock()
    mongo.admin.command.return_value = {"ok": 1.0}
    driver = MagicMock()
    driver.verify_connectivity.return_value = None
    pc = MagicMock()
    pc.list_indexes.return_value = []
    llm2 = MagicMock()
    llm2.invoke.return_value = MagicMock(content='{"test": "hello"}')

    app.dependency_overrides[get_mongo] = lambda: mongo
    app.dependency_overrides[get_neo4j_driver] = lambda: driver
    app.dependency_overrides[get_pinecone] = lambda: pc
    app.dependency_overrides[get_llm2] = lambda: llm2
    try:
        resp = client.get("/admin/health")
    finally:
        for p in (get_mongo, get_neo4j_driver, get_pinecone, get_llm2):
            app.dependency_overrides.pop(p, None)

    assert resp.status_code == 200
    probes = {p["name"]: p for p in resp.json()["probes"]}
    assert set(probes) == {"mongo", "neo4j", "pinecone", "llm"}
    assert probes["mongo"]["status"] == "ok"


def test_admin_health_one_dep_down_does_not_500(client):
    from app.core.dependencies import (
        get_mongo, get_neo4j_driver, get_pinecone, get_llm2,
    )
    from app.main import app

    mongo = MagicMock()
    mongo.admin.command.side_effect = RuntimeError("mongo unreachable")
    driver = MagicMock()
    pc = MagicMock()
    pc.list_indexes.return_value = []
    llm2 = MagicMock()
    llm2.invoke.return_value = MagicMock(content="{}")

    app.dependency_overrides[get_mongo] = lambda: mongo
    app.dependency_overrides[get_neo4j_driver] = lambda: driver
    app.dependency_overrides[get_pinecone] = lambda: pc
    app.dependency_overrides[get_llm2] = lambda: llm2
    try:
        resp = client.get("/admin/health")
    finally:
        for p in (get_mongo, get_neo4j_driver, get_pinecone, get_llm2):
            app.dependency_overrides.pop(p, None)

    assert resp.status_code == 200
    probes = {p["name"]: p for p in resp.json()["probes"]}
    assert probes["mongo"]["status"] == "error"
    assert "unreachable" in (probes["mongo"]["detail"] or "")
```

- [ ] **Step 2: Run to verify failure**

Run: `backend/.venv/bin/python -m pytest backend/tests/test_admin.py -q`
Expected: FAIL — `/admin/health` returns 404.

- [ ] **Step 3: Create the probes service**

Create `backend/app/services/admin/health.py`:

```python
"""Admin ops — dependency health probes (spec 44 §6 item 2).

Each probe is sync and returns a dict shaped like HealthProbe. The router
wraps each in a per-probe timeout so an up-but-slow dependency surfaces as a
degraded badge rather than hanging the request.
"""
import time
from typing import Any, Dict

from app.services.health import probe_llm


def _ok(name: str, start: float) -> Dict[str, Any]:
    return {"name": name, "status": "ok", "latency_ms": round((time.perf_counter() - start) * 1000, 1)}


def _err(name: str, exc: Exception) -> Dict[str, Any]:
    return {"name": name, "status": "error", "detail": str(exc)}


def probe_mongo(mongo) -> Dict[str, Any]:
    start = time.perf_counter()
    try:
        mongo.admin.command("ping")
        return _ok("mongo", start)
    except Exception as exc:  # noqa: BLE001 — probe must not raise
        return _err("mongo", exc)


def probe_neo4j(driver) -> Dict[str, Any]:
    start = time.perf_counter()
    try:
        driver.verify_connectivity()
        return _ok("neo4j", start)
    except Exception as exc:  # noqa: BLE001
        return _err("neo4j", exc)


def probe_pinecone(pc) -> Dict[str, Any]:
    start = time.perf_counter()
    try:
        pc.list_indexes()
        return _ok("pinecone", start)
    except Exception as exc:  # noqa: BLE001
        return _err("pinecone", exc)


def probe_llm_health(llm2) -> Dict[str, Any]:
    start = time.perf_counter()
    result = probe_llm(llm2)  # {"status": "success"|"error", ...}
    if result.get("status") == "success":
        return _ok("llm", start)
    return {"name": "llm", "status": "error", "detail": result.get("error", "unknown")}
```

Update `backend/app/services/admin/__init__.py`:

```python
"""admin service — public API (spec 44)."""
from app.services.admin.health import (
    probe_llm_health,
    probe_mongo,
    probe_neo4j,
    probe_pinecone,
)
from app.services.admin.orgs import list_all_orgs

__all__ = [
    "list_all_orgs",
    "probe_mongo",
    "probe_neo4j",
    "probe_pinecone",
    "probe_llm_health",
]
```

- [ ] **Step 4: Add the route**

In `backend/app/routers/admin.py`, update imports and add the endpoint:

```python
import asyncio
from typing import Awaitable, Callable, Dict, List

from fastapi import APIRouter, Depends

from app.core.dependencies import (
    get_llm2,
    get_mongo,
    get_neo4j_driver,
    get_pinecone,
)
from app.models.admin import AdminHealthResponse, AdminOrgSummary
from app.services.admin import (
    list_all_orgs,
    probe_llm_health,
    probe_mongo,
    probe_neo4j,
    probe_pinecone,
)

router = APIRouter(tags=["admin"])

_PROBE_TIMEOUT_S = 5.0


async def _run_probe(name: str, fn: Callable, *args) -> Dict:
    try:
        return await asyncio.wait_for(asyncio.to_thread(fn, *args), timeout=_PROBE_TIMEOUT_S)
    except asyncio.TimeoutError:
        return {"name": name, "status": "timeout", "detail": f"probe exceeded {_PROBE_TIMEOUT_S}s"}
    except Exception as exc:  # noqa: BLE001
        return {"name": name, "status": "error", "detail": str(exc)}


@router.get("/orgs", response_model=List[AdminOrgSummary])
async def admin_list_orgs(mongo=Depends(get_mongo)):
    return list_all_orgs(mongo)


@router.get("/health", response_model=AdminHealthResponse)
async def admin_health(
    mongo=Depends(get_mongo),
    driver=Depends(get_neo4j_driver),
    pc=Depends(get_pinecone),
    llm2=Depends(get_llm2),
):
    probes = await asyncio.gather(
        _run_probe("mongo", probe_mongo, mongo),
        _run_probe("neo4j", probe_neo4j, driver),
        _run_probe("pinecone", probe_pinecone, pc),
        _run_probe("llm", probe_llm_health, llm2),
    )
    return AdminHealthResponse(probes=probes)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `backend/.venv/bin/python -m pytest backend/tests/test_admin.py -q`
Expected: PASS (4 passed).

- [ ] **Step 6: Verify the live shape**

Run: `cd backend && .venv/bin/python -m uvicorn main:app --port 8001 &` then `curl -s localhost:8001/admin/health | head -c 400`
Expected: `{"probes":[{"name":"mongo","status":...},...]}`. Stop the server afterward.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/admin/ backend/app/routers/admin.py backend/tests/test_admin.py
git commit -m "feat(be): add GET /admin/health aggregate probe endpoint"
```

---

## Task 3: Frontend — contracts + query keys

**Files:**
- Create: `frontend/src/features/admin/types.ts`
- Modify: `frontend/src/shared/api/queryKeys.ts`

**Interfaces:**
- Produces: zod schemas + inferred types `AdminOrgSummary`, `AdminOrgList`, `SystemHealth`, `Registration`, `OrgResponse`; `qk.adminOrgs()`, `qk.adminHealth()`, `qk.adminRegistrations(limit, offset)`, `qk.adminOrgByUser(userId)`, `qk.adminCompanyProfile(orgId)`, `qk.adminCustomerProfiles(orgId)`, `qk.adminOrgLeads(orgId)`.

- [ ] **Step 1: Write the contracts**

Create `frontend/src/features/admin/types.ts`:

```ts
import { z } from "zod";

// GET /admin/orgs — confirmed shape from Task 1 step 8.
export const AdminOrgSummarySchema = z
  .object({
    org_id: z.string(),
    org_name: z.string().nullable().optional(),
    user_count: z.number().default(0),
    user_ids: z.array(z.string()).default([]),
  })
  .passthrough();
export type AdminOrgSummary = z.infer<typeof AdminOrgSummarySchema>;
export const AdminOrgListSchema = z.array(AdminOrgSummarySchema);

// GET /admin/health
export const HealthProbeSchema = z.object({
  name: z.string(),
  status: z.string(),
  detail: z.string().nullable().optional(),
  latency_ms: z.number().nullable().optional(),
});
export const SystemHealthSchema = z.object({ probes: z.array(HealthProbeSchema) });
export type SystemHealth = z.infer<typeof SystemHealthSchema>;
export type HealthProbe = z.infer<typeof HealthProbeSchema>;

// GET /api/v2/registration items + POST /registration
export const RegistrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  timestamp: z.string(),
});
export type Registration = z.infer<typeof RegistrationSchema>;

// POST /org, POST /connect_org, GET /org?user_id= — loosely typed (extra="allow").
export const OrgResponseSchema = z
  .object({
    status: z.string().optional(),
    user_id: z.string().nullable().optional(),
    org_id: z.string().nullable().optional(),
    org_name: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
  })
  .passthrough();
export type OrgResponse = z.infer<typeof OrgResponseSchema>;
```

- [ ] **Step 2: Add the query keys**

In `frontend/src/shared/api/queryKeys.ts`, add these entries to the `qk` object (before the closing `}`):

```ts
  adminOrgs: () => ["admin", "orgs"] as const,
  adminHealth: () => ["admin", "health"] as const,
  adminRegistrations: (limit: number, offset: number) =>
    ["admin", "registrations", limit, offset] as const,
  adminOrgByUser: (userId: string) => ["admin", "org-by-user", userId] as const,
  adminCompanyProfile: (orgId: string) => ["admin", "company-profile", orgId] as const,
  adminCustomerProfiles: (orgId: string) => ["admin", "customer-profiles", orgId] as const,
  adminOrgLeads: (orgId: string) => ["admin", "org-leads", orgId] as const,
  adminUserDocuments: (orgId: string) => ["admin", "user-documents", orgId] as const,
```

- [ ] **Step 3: Typecheck + format**

Run (inside `frontend/`): `npm run typecheck && npx prettier --check src/features/admin/types.ts src/shared/api/queryKeys.ts`
Expected: no type errors; prettier reports both files formatted (if not, run `npx prettier --write` on them and re-check).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/admin/types.ts frontend/src/shared/api/queryKeys.ts
git commit -m "feat(fe): add admin ops-console contracts and query keys"
```

---

## Task 4: Frontend — AdminGuard + allowlist

**Files:**
- Create: `frontend/src/features/admin/adminAllowlist.ts`
- Create: `frontend/src/features/admin/guards/AdminGuard.tsx`
- Test: `frontend/src/features/admin/guards/__tests__/AdminGuard.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ currentUser, loading }` from `@/shared/auth`.
- Produces: `isAdminEmail(email)`, `ADMIN_EMAILS`; `<AdminGuard>{children}</AdminGuard>` — spinner while loading, `<Navigate to="/">` when unauthenticated or not allowlisted, else renders children.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/admin/guards/__tests__/AdminGuard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AdminGuard } from "../AdminGuard";

const mockUseAuth = vi.fn();
vi.mock("@/shared/auth", () => ({ useAuth: () => mockUseAuth() }));

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <div>admin content</div>
            </AdminGuard>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminGuard", () => {
  it("shows a spinner while auth is loading", () => {
    mockUseAuth.mockReturnValue({ currentUser: null, loading: true });
    renderAt("/admin");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("redirects to / when unauthenticated", () => {
    mockUseAuth.mockReturnValue({ currentUser: null, loading: false });
    renderAt("/admin");
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("redirects to / when email is not in the allowlist", () => {
    mockUseAuth.mockReturnValue({ currentUser: { email: "stranger@example.com" }, loading: false });
    renderAt("/admin");
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("renders children for an allowlisted email", () => {
    mockUseAuth.mockReturnValue({ currentUser: { email: "gaurav@brewra.com" }, loading: false });
    renderAt("/admin");
    expect(screen.getByText("admin content")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (inside `frontend/`): `npx vitest run src/features/admin/guards/__tests__/AdminGuard.test.tsx`
Expected: FAIL — cannot resolve `../AdminGuard`.

- [ ] **Step 3: Write the allowlist**

Create `frontend/src/features/admin/adminAllowlist.ts`:

```ts
// Cosmetic internal-access guardrail, NOT a security boundary (spec 44 §3).
// Roster changes require a commit + frontend redeploy (a VITE_* var would not
// avoid this — Vite inlines env vars at build time). Emails compared lowercase.
export const ADMIN_EMAILS = new Set<string>(["gaurav@brewra.com"]);

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase());
}
```

- [ ] **Step 4: Write the guard**

Create `frontend/src/features/admin/guards/AdminGuard.tsx`:

```tsx
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { isAdminEmail } from "../adminAllowlist";

import { useAuth } from "@/shared/auth";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div role="status" className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!currentUser || !isAdminEmail(currentUser.email)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run (inside `frontend/`): `npx vitest run src/features/admin/guards/__tests__/AdminGuard.test.tsx`
Expected: PASS (4 passed).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/admin/adminAllowlist.ts frontend/src/features/admin/guards/
git commit -m "feat(fe): add admin email-allowlist route guard"
```

---

## Task 5: Frontend — services

**Files:**
- Create: `frontend/src/features/admin/services/admin.ts`

**Interfaces:**
- Consumes: `apiGet`/`apiPost` from `@/shared/api/client`; `paginatedSchema` from `@/shared/api/pagination`; schemas from `../types`.
- Produces: `fetchAdminOrgs()`, `fetchSystemHealth()`, `fetchRegistrations(limit, offset)`, `createRegistration(body)`, `createOrg(orgName)`, `connectUserToOrg(userId, orgId)`, `lookupOrgByUser(userId)`, `fetchCompanyProfile(orgId)`, `fetchCustomerProfiles(orgId)`, `fetchOrgLeads(orgId)`, `fetchUserDocuments(orgId)`.

- [ ] **Step 1: Write the services**

Create `frontend/src/features/admin/services/admin.ts`:

```ts
import { z } from "zod";

import {
  AdminOrgListSchema,
  OrgResponseSchema,
  RegistrationSchema,
  SystemHealthSchema,
  type AdminOrgSummary,
  type OrgResponse,
  type Registration,
  type SystemHealth,
} from "../types";

import { apiGet, apiPost } from "@/shared/api/client";
import { paginatedSchema } from "@/shared/api/pagination";

const enc = encodeURIComponent;
const Unknown = z.unknown();

export function fetchAdminOrgs(): Promise<AdminOrgSummary[]> {
  return apiGet("admin/orgs", AdminOrgListSchema);
}

export function fetchSystemHealth(): Promise<SystemHealth> {
  return apiGet("admin/health", SystemHealthSchema);
}

const RegistrationPageSchema = paginatedSchema(RegistrationSchema);
export type RegistrationPage = z.infer<typeof RegistrationPageSchema>;

export function fetchRegistrations(limit: number, offset: number): Promise<RegistrationPage> {
  // v2 paginated envelope — NOT the deprecated/capped v1 GET /registration (spec §5 C).
  return apiGet(`v2/registration?limit=${limit}&offset=${offset}`, RegistrationPageSchema);
}

export function createRegistration(body: { name: string; email: string }): Promise<Registration> {
  return apiPost("registration", body, RegistrationSchema);
}

export function createOrg(orgName: string): Promise<OrgResponse> {
  return apiPost("org", { org_name: orgName }, OrgResponseSchema);
}

export function connectUserToOrg(userId: string, orgId: string): Promise<OrgResponse> {
  return apiPost("connect_org", { user_id: userId, org_id: orgId }, OrgResponseSchema);
}

export function lookupOrgByUser(userId: string): Promise<OrgResponse> {
  return apiGet(`org?user_id=${enc(userId)}`, OrgResponseSchema);
}

// Inspection (read-only). Endpoints are loosely typed — parse tolerantly.
export function fetchCompanyProfile(orgId: string): Promise<unknown> {
  return apiGet(`profile/company?org_id=${enc(orgId)}`, Unknown);
}

export function fetchCustomerProfiles(orgId: string): Promise<unknown> {
  return apiGet(`customer_profile?org_id=${enc(orgId)}`, Unknown);
}

export function fetchOrgLeads(orgId: string): Promise<unknown[]> {
  // Leads are ORG-scoped. Use the v2 paginated envelope — NOT the
  // deprecated/500-capped v1 `GET /leads` (which also requires org_id, not
  // user_id). First page only; the ops view is a spot-check, not an export.
  return apiGet(`v2/leads?org_id=${enc(orgId)}&limit=500&offset=0`, paginatedSchema(Unknown)).then(
    (env) => env.items as unknown[],
  );
}

export function fetchUserDocuments(orgId: string): Promise<unknown[]> {
  // Org-scoped uploaded documents (v2 paginated envelope). First page only.
  return apiGet(
    `v2/user-documents?org_id=${enc(orgId)}&limit=500&offset=0`,
    paginatedSchema(Unknown),
  ).then((env) => env.items as unknown[]);
}
```

- [ ] **Step 2: Typecheck + format**

Run (inside `frontend/`): `npm run typecheck && npx prettier --check src/features/admin/services/admin.ts`
Expected: no type errors; file formatted.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/admin/services/admin.ts
git commit -m "feat(fe): add admin ops-console API services"
```

---

## Task 6: Frontend — hooks

**Files:**
- Create: `frontend/src/features/admin/hooks/useAdminOrgs.ts`
- Create: `frontend/src/features/admin/hooks/useSystemHealth.ts`
- Create: `frontend/src/features/admin/hooks/useRegistrations.ts`
- Create: `frontend/src/features/admin/hooks/useOrgActions.ts`
- Create: `frontend/src/features/admin/hooks/useOrgInspection.ts`
- Test: `frontend/src/features/admin/hooks/__tests__/useAdminOrgs.test.tsx`

**Interfaces:**
- Consumes: services from `../services/admin`; `qk` from `@/shared/api/queryKeys`.
- Produces: `useAdminOrgs()`, `useSystemHealth()`, `useRegistrations(limit, offset)`, `useCreateRegistration()`, `useCreateOrg()`, `useConnectUserToOrg()`, `useOrgByUser(userId, enabled)`, `useCompanyProfile(orgId)`, `useCustomerProfiles(orgId)`, `useOrgLeads(orgId)`, `useUserDocuments(orgId)`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/admin/hooks/__tests__/useAdminOrgs.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useAdminOrgs } from "../useAdminOrgs";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useAdminOrgs", () => {
  it("fetches and parses the org list", async () => {
    server.use(
      http.get("/api/admin/orgs", () =>
        HttpResponse.json([{ org_id: "o1", org_name: "Acme", user_count: 2, user_ids: ["u1", "u2"] }]),
      ),
    );
    const { result } = renderHook(() => useAdminOrgs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].org_name).toBe("Acme");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (inside `frontend/`): `npx vitest run src/features/admin/hooks/__tests__/useAdminOrgs.test.tsx`
Expected: FAIL — cannot resolve `../useAdminOrgs`.

- [ ] **Step 3: Write the query hooks**

Create `frontend/src/features/admin/hooks/useAdminOrgs.ts`:

```ts
import { useQuery } from "@tanstack/react-query";

import { fetchAdminOrgs } from "../services/admin";

import { qk } from "@/shared/api/queryKeys";

export function useAdminOrgs() {
  return useQuery({ queryKey: qk.adminOrgs(), queryFn: fetchAdminOrgs });
}
```

Create `frontend/src/features/admin/hooks/useSystemHealth.ts`:

```ts
import { useQuery } from "@tanstack/react-query";

import { fetchSystemHealth } from "../services/admin";

import { qk } from "@/shared/api/queryKeys";

export function useSystemHealth() {
  return useQuery({ queryKey: qk.adminHealth(), queryFn: fetchSystemHealth, retry: false });
}
```

Create `frontend/src/features/admin/hooks/useRegistrations.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createRegistration, fetchRegistrations } from "../services/admin";

import { qk } from "@/shared/api/queryKeys";

export function useRegistrations(limit: number, offset: number) {
  return useQuery({
    queryKey: qk.adminRegistrations(limit, offset),
    queryFn: () => fetchRegistrations(limit, offset),
  });
}

export function useCreateRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string }) => createRegistration(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "registrations"] }),
  });
}
```

Create `frontend/src/features/admin/hooks/useOrgActions.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { connectUserToOrg, createOrg, lookupOrgByUser } from "../services/admin";

import { qk } from "@/shared/api/queryKeys";

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orgName: string) => createOrg(orgName),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.adminOrgs() }),
  });
}

export function useConnectUserToOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; orgId: string }) =>
      connectUserToOrg(vars.userId, vars.orgId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.adminOrgs() }),
  });
}

export function useOrgByUser(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.adminOrgByUser(userId),
    queryFn: () => lookupOrgByUser(userId),
    enabled: enabled && !!userId,
    retry: false,
  });
}
```

Create `frontend/src/features/admin/hooks/useOrgInspection.ts`:

```ts
import { useQuery } from "@tanstack/react-query";

import {
  fetchCompanyProfile,
  fetchCustomerProfiles,
  fetchOrgLeads,
  fetchUserDocuments,
} from "../services/admin";

import { qk } from "@/shared/api/queryKeys";

export function useCompanyProfile(orgId: string) {
  return useQuery({
    queryKey: qk.adminCompanyProfile(orgId),
    queryFn: () => fetchCompanyProfile(orgId),
    enabled: !!orgId,
    retry: false,
  });
}

export function useCustomerProfiles(orgId: string) {
  return useQuery({
    queryKey: qk.adminCustomerProfiles(orgId),
    queryFn: () => fetchCustomerProfiles(orgId),
    enabled: !!orgId,
    retry: false,
  });
}

export function useOrgLeads(orgId: string) {
  return useQuery({
    queryKey: qk.adminOrgLeads(orgId),
    queryFn: () => fetchOrgLeads(orgId),
    enabled: !!orgId,
    retry: false,
  });
}

export function useUserDocuments(orgId: string) {
  return useQuery({
    queryKey: qk.adminUserDocuments(orgId),
    queryFn: () => fetchUserDocuments(orgId),
    enabled: !!orgId,
    retry: false,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (inside `frontend/`): `npx vitest run src/features/admin/hooks/__tests__/useAdminOrgs.test.tsx`
Expected: PASS (1 passed).

- [ ] **Step 5: Typecheck + format + commit**

Run: `npm run typecheck && npx prettier --check src/features/admin/hooks/`

```bash
git add frontend/src/features/admin/hooks/
git commit -m "feat(fe): add admin ops-console data hooks"
```

---

> **Parallelization:** Tasks 7–10 (the four pages) are independent once Tasks 3, 5, 6 land — no shared mutable state. They may be implemented in parallel (a natural fan-out point for parallel agents). Tasks 11 (wiring) and 12 (cleanup) must follow all four pages.

## Task 7: Frontend — TenantsOverviewPage

**Files:**
- Create: `frontend/src/features/admin/pages/TenantsOverviewPage.tsx`
- Test: `frontend/src/features/admin/pages/__tests__/TenantsOverviewPage.test.tsx`

**Interfaces:**
- Consumes: `useAdminOrgs`, `useCreateOrg`, `useConnectUserToOrg`, `useOrgByUser`.
- Produces: default-exported `TenantsOverviewPage` — searchable org table (rows link to `/admin/tenants/:orgId`) + a management toolbar (New Org / Connect user→org / Look up org by user).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/admin/pages/__tests__/TenantsOverviewPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import TenantsOverviewPage from "../TenantsOverviewPage";

import { server } from "@/test/msw/server";

function renderPage(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TenantsOverviewPage", () => {
  it("filters the org table by the search box", async () => {
    server.use(
      http.get("/api/admin/orgs", () =>
        HttpResponse.json([
          { org_id: "o1", org_name: "Acme", user_count: 1, user_ids: ["u1"] },
          { org_id: "o2", org_name: "Globex", user_count: 0, user_ids: [] },
        ]),
      ),
    );
    renderPage(<TenantsOverviewPage />);
    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/search/i), "acme");
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.queryByText("Globex")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (inside `frontend/`): `npx vitest run src/features/admin/pages/__tests__/TenantsOverviewPage.test.tsx`
Expected: FAIL — cannot resolve `../TenantsOverviewPage`.

- [ ] **Step 3: Write the page**

Create `frontend/src/features/admin/pages/TenantsOverviewPage.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAdminOrgs } from "../hooks/useAdminOrgs";
import { useConnectUserToOrg, useCreateOrg, useOrgByUser } from "../hooks/useOrgActions";

export default function TenantsOverviewPage() {
  const { data: orgs, isLoading, isError } = useAdminOrgs();
  const [search, setSearch] = useState("");

  const createOrg = useCreateOrg();
  const connect = useConnectUserToOrg();
  const [newOrgName, setNewOrgName] = useState("");
  const [connUser, setConnUser] = useState("");
  const [connOrg, setConnOrg] = useState("");
  const [lookupUser, setLookupUser] = useState("");
  const [lookupActive, setLookupActive] = useState(false);
  const lookup = useOrgByUser(lookupUser, lookupActive);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgs ?? [];
    return (orgs ?? []).filter(
      (o) => (o.org_name ?? "").toLowerCase().includes(q) || o.org_id.toLowerCase().includes(q),
    );
  }, [orgs, search]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tenants</h1>

      <section className="grid gap-4 md:grid-cols-3">
        <form
          className="space-y-2 rounded border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (newOrgName.trim()) createOrg.mutate(newOrgName.trim(), { onSuccess: () => setNewOrgName("") });
          }}
        >
          <p className="font-medium">New org</p>
          <input className="w-full rounded border px-2 py-1" placeholder="Org name" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} />
          <button className="rounded bg-blue-600 px-3 py-1 text-white" disabled={createOrg.isPending}>Create</button>
          {createOrg.data?.org_id && <p className="text-xs text-green-700">Created {createOrg.data.org_id}</p>}
        </form>

        <form
          className="space-y-2 rounded border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (connUser.trim() && connOrg.trim()) connect.mutate({ userId: connUser.trim(), orgId: connOrg.trim() });
          }}
        >
          <p className="font-medium">Connect user → org</p>
          <input className="w-full rounded border px-2 py-1" placeholder="user_id" value={connUser} onChange={(e) => setConnUser(e.target.value)} />
          <input className="w-full rounded border px-2 py-1" placeholder="org_id" value={connOrg} onChange={(e) => setConnOrg(e.target.value)} />
          <button className="rounded bg-blue-600 px-3 py-1 text-white" disabled={connect.isPending}>Connect</button>
          {connect.isSuccess && <p className="text-xs text-green-700">Connected</p>}
        </form>

        <form
          className="space-y-2 rounded border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            setLookupActive(true);
          }}
        >
          <p className="font-medium">Look up org by user</p>
          <input className="w-full rounded border px-2 py-1" placeholder="user_id" value={lookupUser} onChange={(e) => { setLookupUser(e.target.value); setLookupActive(false); }} />
          <button className="rounded bg-blue-600 px-3 py-1 text-white">Look up</button>
          {lookupActive && lookup.data?.org_id && <p className="text-xs">org_id: {lookup.data.org_id}{lookup.data.org_name ? ` (${lookup.data.org_name})` : ""}</p>}
          {lookupActive && lookup.isError && <p className="text-xs text-red-600">No org found</p>}
        </form>
      </section>

      <input
        className="w-full max-w-sm rounded border px-3 py-2"
        placeholder="Search orgs…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load orgs.</p>}
      {!isLoading && !isError && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Org</th>
              <th className="py-2">org_id</th>
              <th className="py-2">Users</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.org_id} className="border-b hover:bg-gray-50">
                <td className="py-2">
                  <Link className="text-blue-600 hover:underline" to={`/admin/tenants/${encodeURIComponent(o.org_id)}`}>
                    {o.org_name ?? "(unnamed)"}
                  </Link>
                </td>
                <td className="py-2 font-mono text-xs">{o.org_id}</td>
                <td className="py-2">{o.user_count}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="py-3 text-gray-500" colSpan={3}>No orgs.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (inside `frontend/`): `npx vitest run src/features/admin/pages/__tests__/TenantsOverviewPage.test.tsx`
Expected: PASS (1 passed).

- [ ] **Step 5: Typecheck + format + commit**

Run: `npm run typecheck && npx prettier --check src/features/admin/pages/TenantsOverviewPage.tsx src/features/admin/pages/__tests__/TenantsOverviewPage.test.tsx`

```bash
git add frontend/src/features/admin/pages/TenantsOverviewPage.tsx frontend/src/features/admin/pages/__tests__/TenantsOverviewPage.test.tsx
git commit -m "feat(fe): add admin tenants-overview page"
```

---

## Task 8: Frontend — OrgDetailPage (inspection tabs)

**Files:**
- Create: `frontend/src/features/admin/pages/OrgDetailPage.tsx`

**Interfaces:**
- Consumes: `useParams` (`orgId`); `useAdminOrgs` (org name + `user_ids` for the header); `useCompanyProfile`, `useCustomerProfiles`, `useOrgLeads`, `useUserDocuments`.
- Produces: default-exported `OrgDetailPage` — tabbed read-only inspection: Company Profile / Customer Profiles / Leads / Documents. **Scope note:** the Data Sources tab is NOT included — no org-scoped *list* endpoint exists (`data_sources.py` is upload/status only); see plan "Spec divergences".

- [ ] **Step 1: Write the page**

Create `frontend/src/features/admin/pages/OrgDetailPage.tsx`:

```tsx
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAdminOrgs } from "../hooks/useAdminOrgs";
import {
  useCompanyProfile,
  useCustomerProfiles,
  useOrgLeads,
  useUserDocuments,
} from "../hooks/useOrgInspection";

type Tab = "company" | "customers" | "leads" | "documents";

function JsonPanel({ isLoading, isError, data }: { isLoading: boolean; isError: boolean; data: unknown }) {
  if (isLoading) return <p>Loading…</p>;
  if (isError) return <p className="text-red-600">Failed to load.</p>;
  return (
    <pre className="max-h-[60vh] overflow-auto rounded bg-gray-50 p-3 text-xs">
      {JSON.stringify(data ?? null, null, 2)}
    </pre>
  );
}

export default function OrgDetailPage() {
  const { orgId = "" } = useParams();
  const [tab, setTab] = useState<Tab>("company");

  const { data: orgs } = useAdminOrgs();
  const org = (orgs ?? []).find((o) => o.org_id === orgId);

  const company = useCompanyProfile(orgId);
  const customers = useCustomerProfiles(orgId);
  const leads = useOrgLeads(orgId);
  const documents = useUserDocuments(orgId);

  const tabs: { key: Tab; label: string }[] = [
    { key: "company", label: "Company Profile" },
    { key: "customers", label: "Customer Profiles" },
    { key: "leads", label: "Leads" },
    { key: "documents", label: "Documents" },
  ];
  const active = { company, customers, leads, documents }[tab];

  return (
    <div className="space-y-4">
      <Link to="/admin/tenants" className="text-sm text-blue-600 hover:underline">← All tenants</Link>
      <h1 className="text-2xl font-semibold">{org?.org_name ?? "(unnamed org)"}</h1>
      <p className="font-mono text-xs text-gray-500">{orgId}</p>
      {org && org.user_ids.length > 0 && (
        <p className="text-xs text-gray-500">Users: {org.user_ids.join(", ")}</p>
      )}

      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm ${tab === t.key ? "border-b-2 border-blue-600 font-medium" : "text-gray-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <JsonPanel isLoading={active.isLoading} isError={active.isError} data={active.data} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + format**

Run (inside `frontend/`): `npm run typecheck && npx prettier --check src/features/admin/pages/OrgDetailPage.tsx`
Expected: no type errors; file formatted.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/admin/pages/OrgDetailPage.tsx
git commit -m "feat(fe): add admin org-detail inspection page"
```

---

## Task 9: Frontend — RegistrationsPage

**Files:**
- Create: `frontend/src/features/admin/pages/RegistrationsPage.tsx`

**Interfaces:**
- Consumes: `useRegistrations`, `useCreateRegistration`.
- Produces: default-exported `RegistrationsPage` — paginated table (v2 envelope), add form, CSV export of the loaded page.

- [ ] **Step 1: Write the page**

Create `frontend/src/features/admin/pages/RegistrationsPage.tsx`:

```tsx
import { useState } from "react";

import { useCreateRegistration, useRegistrations } from "../hooks/useRegistrations";
import type { Registration } from "../types";

const PAGE_SIZE = 50;

function toCsv(rows: Registration[]): string {
  const esc = (v: string) => {
    const s = String(v ?? "");
    const needs = /[",\r\n]/.test(s) || /^[=+\-@]/.test(s); // RFC-4180 + formula guard
    const body = s.replace(/"/g, '""');
    return needs ? `"${/^[=+\-@]/.test(s) ? "'" + body : body}"` : body;
  };
  const header = ["id", "name", "email", "timestamp"];
  const lines = [header.join(",")];
  for (const r of rows) lines.push([r.id, r.name, r.email, r.timestamp].map(esc).join(","));
  return "﻿" + lines.join("\r\n");
}

export default function RegistrationsPage() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError } = useRegistrations(PAGE_SIZE, offset);
  const create = useCreateRegistration();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const rows = (data?.items ?? []) as Registration[];
  const total = data?.total ?? 0;

  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations-${offset}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Registrations</h1>

      <form
        className="flex flex-wrap items-end gap-2 rounded border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && email.trim())
            create.mutate({ name: name.trim(), email: email.trim() }, { onSuccess: () => { setName(""); setEmail(""); } });
        }}
      >
        <input className="rounded border px-2 py-1" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="rounded border px-2 py-1" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="rounded bg-blue-600 px-3 py-1 text-white" disabled={create.isPending}>Add</button>
      </form>

      <div className="flex items-center gap-3">
        <button className="rounded border px-3 py-1" onClick={download} disabled={rows.length === 0}>Export CSV (this page)</button>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>

      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to load registrations.</p>}
      {!isLoading && !isError && (
        <>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b"><th className="py-2">Name</th><th className="py-2">Email</th><th className="py-2">When</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b"><td className="py-2">{r.name}</td><td className="py-2">{r.email}</td><td className="py-2">{r.timestamp}</td></tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={3} className="py-3 text-gray-500">No registrations.</td></tr>}
            </tbody>
          </table>
          <div className="flex items-center gap-2">
            <button className="rounded border px-3 py-1" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Prev</button>
            <span className="text-sm">offset {offset}</span>
            <button className="rounded border px-3 py-1" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + format**

Run (inside `frontend/`): `npm run typecheck && npx prettier --check src/features/admin/pages/RegistrationsPage.tsx`
Expected: no type errors; file formatted.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/admin/pages/RegistrationsPage.tsx
git commit -m "feat(fe): add admin registrations page with CSV export"
```

---

## Task 10: Frontend — SystemHealthPage

**Files:**
- Create: `frontend/src/features/admin/pages/SystemHealthPage.tsx`

**Interfaces:**
- Consumes: `useSystemHealth`.
- Produces: default-exported `SystemHealthPage` — status badges per dependency.

- [ ] **Step 1: Write the page**

Create `frontend/src/features/admin/pages/SystemHealthPage.tsx`:

```tsx
import { useSystemHealth } from "../hooks/useSystemHealth";

const COLOR: Record<string, string> = {
  ok: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
  timeout: "bg-amber-100 text-amber-800",
};

export default function SystemHealthPage() {
  const { data, isLoading, isError, refetch, isFetching } = useSystemHealth();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">System Health</h1>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Checking…" : "Refresh"}
        </button>
      </div>

      {isLoading && <p>Loading…</p>}
      {isError && <p className="text-red-600">Failed to reach the health endpoint.</p>}
      {!isLoading && !isError && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(data?.probes ?? []).map((p) => (
            <div key={p.name} className="flex items-center justify-between rounded border p-3">
              <span className="font-medium capitalize">{p.name}</span>
              <span className="flex items-center gap-2">
                {p.latency_ms != null && <span className="text-xs text-gray-500">{p.latency_ms} ms</span>}
                <span className={`rounded px-2 py-0.5 text-xs ${COLOR[p.status] ?? "bg-gray-100 text-gray-700"}`}>
                  {p.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
      {data?.probes?.some((p) => p.status !== "ok") && (
        <div className="space-y-1 text-xs text-gray-600">
          {data.probes.filter((p) => p.detail).map((p) => (
            <p key={p.name}>
              <span className="font-medium">{p.name}:</span> {p.detail}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + format**

Run (inside `frontend/`): `npm run typecheck && npx prettier --check src/features/admin/pages/SystemHealthPage.tsx`
Expected: no type errors; file formatted.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/admin/pages/SystemHealthPage.tsx
git commit -m "feat(fe): add admin system-health page"
```

---

## Task 11: Frontend — layout, routes, barrel, registration

**Files:**
- Create: `frontend/src/features/admin/components/AdminLayout.tsx`
- Create: `frontend/src/features/admin/routes.tsx`
- Create: `frontend/src/features/admin/index.ts`
- Create: `frontend/src/features/admin/README.md`
- Modify: `frontend/src/app/routes.tsx`

**Interfaces:**
- Consumes: `AdminGuard`; lazy page components; `FeatureErrorBoundary` from `@/shared/components`.
- Produces: `adminRoutes` (exported from `index.ts`) spread into `featureRoutes`.

- [ ] **Step 1: Write the layout**

Create `frontend/src/features/admin/components/AdminLayout.tsx`:

```tsx
import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { FeatureErrorBoundary } from "@/shared/components";

const link = ({ isActive }: { isActive: boolean }) =>
  `block rounded px-3 py-2 text-sm ${isActive ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`;

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Brewra Ops</p>
        <nav className="space-y-1">
          <NavLink to="/admin/tenants" className={link}>Tenants</NavLink>
          <NavLink to="/admin/registrations" className={link}>Registrations</NavLink>
          <NavLink to="/admin/health" className={link}>System Health</NavLink>
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <FeatureErrorBoundary featureName="Admin">
          <Suspense fallback={<div className="p-6">Loading…</div>}>
            <Outlet />
          </Suspense>
        </FeatureErrorBoundary>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Write the routes (lazy / code-split)**

Create `frontend/src/features/admin/routes.tsx`:

```tsx
import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";

import AdminLayout from "./components/AdminLayout";
import { AdminGuard } from "./guards/AdminGuard";

// Lazy so the internal ops console is code-split out of the customer bundle (spec §2).
const TenantsOverviewPage = lazy(() => import("./pages/TenantsOverviewPage"));
const OrgDetailPage = lazy(() => import("./pages/OrgDetailPage"));
const RegistrationsPage = lazy(() => import("./pages/RegistrationsPage"));
const SystemHealthPage = lazy(() => import("./pages/SystemHealthPage"));

export const adminRoutes = [
  <Route
    key="admin"
    path="/admin"
    element={
      <AdminGuard>
        <AdminLayout />
      </AdminGuard>
    }
  >
    <Route index element={<Navigate to="/admin/tenants" replace />} />
    <Route path="tenants" element={<TenantsOverviewPage />} />
    <Route path="tenants/:orgId" element={<OrgDetailPage />} />
    <Route path="registrations" element={<RegistrationsPage />} />
    <Route path="health" element={<SystemHealthPage />} />
  </Route>,
];
```

- [ ] **Step 3: Write the barrel + README**

Create `frontend/src/features/admin/index.ts`:

```ts
// Public surface for the `admin` (internal ops console) feature.
export { adminRoutes } from "./routes";
```

Create `frontend/src/features/admin/README.md`:

```markdown
# `admin` feature — internal ops console

## Purpose

Brewra-internal operations console (spec 44). Replaces the legacy
`backend/admin_panel.html` + `registration_admin_panel.html`. Operated by
Brewra staff, not customers.

## Public surface

Re-exported from `index.ts`:

- `adminRoutes` — `/admin/*` routes (lazy/code-split, gated by `AdminGuard`).

## Access

`AdminGuard` (`guards/AdminGuard.tsx`) checks `useAuth().currentUser.email`
against `adminAllowlist.ts`. Cosmetic guardrail only — NOT a security
boundary (the backend does not validate auth). Roster changes require a
commit + redeploy.

## Key files

- `pages/` — TenantsOverview, OrgDetail (inspection tabs), Registrations, SystemHealth
- `services/admin.ts`, `hooks/`, `types.ts` (zod contracts)
- `components/AdminLayout.tsx`, `routes.tsx`

## Backend

- `GET /admin/orgs`, `GET /admin/health` (new, `app/routers/admin.py`).
- Reuses `/org`, `/connect_org`, `GET /api/v2/registration`, `POST /registration`,
  `/profile/company`, `/customer_profile`, `GET /api/v2/leads`, `GET /api/v2/user-documents`.

## Scope notes

- Org/user **write** actions (create org, connect user→org, lookup) live on
  the Tenants overview toolbar.
- Inspection tabs: Company Profile, Customer Profiles, Leads, Documents. Data
  Sources is omitted — no org-scoped *list* endpoint exists (`data_sources.py`
  is upload/status only).
```

- [ ] **Step 4: Register the routes**

In `frontend/src/app/routes.tsx`, add the import (alphabetical with the others) and spread it into `featureRoutes`:

```ts
import { adminRoutes } from "@/features/admin";
```

```ts
export const featureRoutes = [
  ...marketResearchRoutes,
  ...missionControlRoutes,
  ...customersRoutes,
  ...scoutRoutes,
  ...signalsRoutes,
  ...strategistRoutes,
  ...authRoutes,
  ...tenantRoutes,
  ...settingsRoutes,
  ...calendarRoutes,
  ...insightsRoutes,
  ...reportsRoutes,
  ...artifactsRoutes,
  ...adminRoutes,
];
```

- [ ] **Step 5: Typecheck, lint, format, changed tests**

Run (inside `frontend/`):
`npm run verify`
then `npx prettier --check src/features/admin/components/AdminLayout.tsx src/features/admin/routes.tsx src/features/admin/index.ts src/features/admin/README.md src/app/routes.tsx`
Expected: typecheck/lint pass, changed admin tests pass, files formatted.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/admin/components/ frontend/src/features/admin/routes.tsx frontend/src/features/admin/index.ts frontend/src/features/admin/README.md frontend/src/app/routes.tsx
git commit -m "feat(fe): wire admin ops console routes and layout"
```

---

## Task 12: Cleanup — remove legacy HTML tools

**Files:**
- Delete: `backend/admin_panel.html`
- Delete: `backend/registration_admin_panel.html`

- [ ] **Step 1: Confirm they are not served**

Run: `grep -rnE "admin_panel|registration_admin|FileResponse|StaticFiles" backend/app/ backend/main.py`
Expected: no match that serves these files (only unrelated substrings). If anything serves them, stop and remove that serving code in this task too.

- [ ] **Step 2: Delete the files**

Run: `git rm backend/admin_panel.html backend/registration_admin_panel.html`

- [ ] **Step 3: Backend tests still pass**

Run: `backend/.venv/bin/python -m pytest backend/tests/test_admin.py -q`
Expected: PASS (4 passed).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(be): remove legacy admin HTML tools superseded by /admin console"
```

---

## Merge gate (after all tasks)

- [ ] Run the full serial FE gate (inside `frontend/`): `npm run preflight` — expect green (typecheck, lint, format:check, vitest, build, bundle:check, Playwright+VR, knip --strict). If knip flags the new files as unused, confirm `adminRoutes` is spread in `src/app/routes.tsx` (that is the reachability anchor). If knip flags exported-but-unused **type aliases** (e.g. `HealthProbe`, `RegistrationPage`, or any schema exported in `types.ts` but consumed only within its own file), inline or drop the export — these are 2-minute tidies, not design changes.
- [ ] Run the backend admin tests once more: `backend/.venv/bin/python -m pytest backend/tests/test_admin.py -q`.
- [ ] Hand off for `/review-impl` → `/synthesize-impl-review` per the AI-Native flow before the `--no-ff` merge to `master`.

---

## Spec divergences encoded in this plan

1. **Inspection tabs reduced from 5 to 4 (only Data Sources dropped).** Spec §5 listed Company Profile, Customer Profiles, Lead Stream, Data Sources, Documents. Confirmed-live endpoints: Company Profile (`/profile/company`), Customer Profiles (`/customer_profile`), **Leads via `GET /api/v2/leads?org_id=`** (org-scoped, paginated), and **Documents via `GET /api/v2/user-documents?org_id=`** (paginated). Only **Data Sources** is dropped — `data_sources.py` exposes upload/status/delete but no org-scoped *list* endpoint. Re-add a Data Sources tab if/when such a list endpoint exists (net-new backend, out of scope).
2. **Org/user write actions placed on the Tenants overview toolbar**, not inside Org Detail. They are org-set-level actions (create org, connect user→org, look up org by user), so they belong at the list level; Org Detail is read-only inspection. (Spec §5 grouped them under "Org Detail (A+B)".)
3. **`/admin/orgs` returns `user_ids` per org** (in addition to `user_count`). This is display-only — shown in the Org Detail header for operator awareness. It is **not** used to fetch leads: leads are org-scoped (`GET /api/v2/leads?org_id=`), so there is no per-user fan-out. `user_count` is derived from `user_ids`.
