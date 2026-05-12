# Characterization-Test Safety Net — Design Spec

**Date:** 2026-05-08
**Status:** Approved (pending user spec review)
**Origin:** Brainstorm conversation, 2026-05-08
**Purpose:** Establish a characterization-test safety net that protects critical, currently-working functionality during the major refactors planned for the coming days/weeks.

---

## 1. Purpose & framing

We are about to do major changes to code structure, architecture, and large refactors of `backend/api.py` (4,441 LOC monolith) and `backend/services.py` (~2,540 LOC). Without a safety net, refactor regressions will break critical user flows silently and only surface days later in user-visible bugs.

Per Michael Feathers' framing, **characterization tests describe the system's current behavior** (not the desired behavior). They are a snapshot of "what the system does today" so refactors can be evaluated against a stable baseline. Failures during refactor → either revert the change, or accept the snapshot deliberately.

**Constraints:**
- 0 live users (MVP, pre-launch). Velocity > deployment ceremony per CLAUDE.md.
- No existing test framework in the monorepo (current `backend/test_*.py` files are live integration probes against production, not real tests).
- Polyglot rule: BE and FE test suites stay completely separate. No shared utilities.

---

## 2. Scope

### 2.1 In scope — Backend (HTTP characterization)

The 13 critical-and-working features from `docs/analysis/detailed-analysis/FUNCTIONALITY_INVENTORY.md`, exposed via these endpoints:

- **Auth/org:** `POST /api/auth/*` (Firebase token endpoints — only the routes that exist today, not the missing JWT validation), `GET /api/org`, `POST /api/connect_org`, `POST /api/registration`, `GET /api/registration`
- **Profiles:** `GET/POST /api/profile/{type}` for `org`, `user`, `scout`, `profiler`, `agent_name`
- **ICP:** `GET/POST /api/customer_profile`, `DELETE /api/customer_profile/icp/{icp_id}`, `GET /api/icp`, `POST /api/customer_profile/from_suggested_icp`, `DELETE /api/icp/recommended/{icp_id}`, `POST /api/icp-research`
- **Market research:** `POST /api/market-research` (5 components)
- **Signals:** `POST /api/generate-signals-batch`, `GET /api/fetch-signals`, `POST /api/signal_action`, `POST /api/signal_Ask`
- **Leads & CRM:** `GET/POST/PUT/DELETE /api/leads`, `POST /api/leads/batch-upload`, `GET /api/leads/by-file`, `DELETE /api/leads/by-file/{file_id}`, `GET /api/leads/stream/status`, `POST /api/leads/market-scores`, `GET /api/leads/market-scores/status`, `GET /api/leads/{id}/market-score-descriptions`
- **Documents:** `POST /api/upload-document`, `GET /api/user-documents`, `GET /api/document-status/{file_key}`, `DELETE /api/data-source/{file_id}`, `PUT /api/data-source/{file_id}`

### 2.2 In scope — Frontend (Playwright smoke pack)

**5 user journeys:**
1. Login → tenant-selection redirect → mission-control loads
2. CSV lead upload → leads appear in Scout lead stream
3. Signal feed loads → click accept → action persists
4. Market Research → kick off all 5 components → results render
5. ICP create via Mission Control → appears in saved list

**5 stub-page smoke checks (page-load + visual regression only, not user journeys):**
- `/calendar` (Activator)
- `/reports`
- `/insights`
- `/artifacts` (includes asserting the `createSimplePDF` download fires)
- `/agent-hub` — locks in the current bug-as-feature behavior (route renders `<Signals />` instead of `AgentHub.tsx` per inventory § 11)

### 2.3 In scope — Visual regression

**30 screenshot goldens total**, distributed:
- 5 stub pages × 1 = 5
- Journey 1 (login → tenant → mission): 4 states
- Journey 2 (CSV → leads): 5 states
- Journey 3 (signals → accept): 4 states
- Journey 4 (market research × 5 components): 8 states
- Journey 5 (ICP create): 4 states

Canonical environment: **WSL2/Linux + chromium**. Single browser project. No multi-OS matrix.

### 2.4 Out of scope (explicit)

- Critical features at 0% completion (JWT backend validation, GTM strategy sequence persistence, outreach send, scheduled signal generation, persistent job queue) — nothing to characterize.
- Mock-data-only flows: Profiler Lead Stream, Strategist Recommendations, Strategist Lead Stream (all read hardcoded mock arrays per inventory).
- Performance / load testing.
- LLM prompt-quality regression detection.
- Multi-tenancy *enforcement* tests (would require real Mongo/Neo4j with two seeded orgs; the `WHERE org_id` filter is mocked away in this design).
- Cross-OS golden matrix.
- CI gating (local-only, on demand per Q7=A).
- Anything in `PWA-multi-tenancy/development/` or `PWA-multi-tenancy/production/`. Tests target the monorepo `/frontend/` only.

---

## 3. Architecture & directory layout

```
brewra-gtm-intelligence/
├── backend/
│   ├── tests/
│   │   ├── conftest.py              # pytest fixtures: TestClient, dependency overrides, mocks
│   │   ├── identities.py            # canonical TEST_USER_ID, TEST_ORG_ID, etc.
│   │   ├── fixtures/
│   │   │   ├── leads.py             # hand-crafted fixture builders
│   │   │   ├── signals.py
│   │   │   ├── market_research.py   # minimal LLM response sketches (TD-001)
│   │   │   ├── icp.py
│   │   │   └── profiles.py
│   │   ├── test_auth_org.py
│   │   ├── test_profiles.py
│   │   ├── test_icp.py
│   │   ├── test_market_research.py
│   │   ├── test_signals.py
│   │   ├── test_leads.py
│   │   ├── test_market_scoring.py
│   │   ├── test_documents.py
│   │   └── __snapshots__/           # syrupy snapshot files
│   ├── pytest.ini
│   └── requirements-test.txt
│
├── frontend/
│   ├── e2e/
│   │   ├── fixtures/
│   │   │   ├── identities.ts        # mirrors backend/tests/identities.py
│   │   │   ├── auth.ts              # mock login state, tenant payload
│   │   │   ├── api-mocks.ts         # canned /api/* responses for page.route()
│   │   │   └── seed-data.ts         # lead/signal/ICP test payloads
│   │   ├── helpers/
│   │   │   ├── login.ts             # loginAsTestUser + mockFirebaseLogin
│   │   │   └── mask-dynamic.ts      # mask timestamps/UUIDs for screenshot stability
│   │   ├── journeys/
│   │   │   ├── 01-login-tenant-mission.spec.ts
│   │   │   ├── 02-csv-upload-leads.spec.ts
│   │   │   ├── 03-signals-feed-action.spec.ts
│   │   │   ├── 04-market-research-5-components.spec.ts
│   │   │   └── 05-icp-create.spec.ts
│   │   ├── stubs/
│   │   │   ├── calendar.spec.ts
│   │   │   ├── reports.spec.ts
│   │   │   ├── insights.spec.ts
│   │   │   ├── artifacts.spec.ts
│   │   │   └── agent-hub.spec.ts
│   │   └── __screenshots__/         # 30 goldens, chromium-linux
│   ├── playwright.config.ts
│   └── package.json                 # adds: test:e2e, test:e2e:headed, test:e2e:update-snapshots, test:e2e:ui
│
└── docs/
    └── TECH_DEBT.md                 # TD-001 — fixture upgrade path
```

**Architectural decisions:**

1. Backend tests use FastAPI's `TestClient` (in-process). No HTTP server boot. Dependency injection via `app.dependency_overrides` and `pytest-mock.patch` at the **module path where the symbol is used** (not where it's defined).
2. Frontend tests use Playwright with `page.route()` interception. Vite dev server runs on port 5173 (Playwright `webServer` config auto-spawns it per session). Every `/api/*` call is intercepted before it hits the real proxy target — no backend required.
3. No shared test infrastructure between BE and FE. Per polyglot rule.
4. Snapshot files committed to git: `backend/tests/__snapshots__/` (syrupy) + `frontend/e2e/__screenshots__/` (Playwright PNG goldens).
5. Single-browser-project Playwright config (chromium only, Linux canonical).

---

## 4. Backend test mechanics

### 4.1 Tech stack

- `pytest` + `pytest-mock` (test runner + mocking)
- `httpx` + FastAPI's `TestClient` (in-process HTTP)
- `syrupy` (snapshot testing — `.ambr` files)
- `anyio` (async support; FastAPI uses it natively)

### 4.2 Dependency-override pattern

`api.py` instantiates Neo4j, Mongo, Pinecone, S3, and LLM clients at import time. Naive monkey-patching is fragile. Cleaner: patch the **module path where the symbol is used**, both in `backend.api` and `backend.services`.

```python
# backend/tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

@pytest.fixture
def mock_neo4j(mocker):
    mock_driver = MagicMock()
    mock_session = MagicMock()
    mock_driver.session.return_value.__enter__.return_value = mock_session
    mocker.patch("backend.api.neo4j_driver", mock_driver)
    mocker.patch("backend.services.neo4j_driver", mock_driver)
    return {"driver": mock_driver, "session": mock_session}

@pytest.fixture
def mock_mongo(mocker):
    mongo = MagicMock()
    mocker.patch("backend.api.mongo_client", mongo)
    mocker.patch("backend.services.mongo_client", mongo)
    return mongo

@pytest.fixture
def mock_llm_chain(mocker):
    mock_chain = MagicMock()
    mocker.patch("backend.services.agent_chain", mock_chain)
    return mock_chain

@pytest.fixture
def mock_s3(mocker):
    mocker.patch("backend.api.s3_client", MagicMock())

@pytest.fixture
def mock_pinecone(mocker):
    mocker.patch("backend.api.pinecone_index", MagicMock())

@pytest.fixture
def mock_tavily(mocker):
    mocker.patch("backend.services.tavily_search", MagicMock())

@pytest.fixture
def client(mock_neo4j, mock_mongo, mock_llm_chain, mock_s3, mock_pinecone, mock_tavily):
    from backend.main import app
    with TestClient(app) as c:
        yield c
```

### 4.3 Per-test pattern (hybrid: snapshot + explicit + side-effect)

```python
# backend/tests/test_leads.py
def test_create_lead_returns_201_and_writes_to_neo4j(client, mock_neo4j, snapshot):
    payload = {
        "user_id": "test_user_123",
        "org_id": "test_org_abc",
        "company_name": "Acme",
        "contact_name": "Jane Doe",
        "email": "jane@acme.test",
    }

    response = client.post("/api/leads", json=payload)

    # Explicit: status, headers
    assert response.status_code == 201
    assert response.headers["content-type"] == "application/json"

    # Snapshot: response body, with UUID/timestamp scrubbing
    body_scrubbed = scrub_dynamic(response.json(), keys=["lead_id", "created_at"])
    assert body_scrubbed == snapshot

    # Side-effect: which Cypher pattern ran (substring match — refactor-tolerant)
    cypher_calls = [c.args[0] for c in mock_neo4j["session"].run.call_args_list]
    assert any("CREATE (l:Lead" in q for q in cypher_calls), \
        "Refactor must preserve CREATE on Lead"
```

### 4.4 Snapshot scrubbing

A helper in `conftest.py` recursively replaces non-deterministic fields with stable placeholders before snapshot comparison.

**Default scrub keys:** `lead_id`, `icp_id`, `signal_id`, `file_id`, `file_key`, `created_at`, `updated_at`, `timestamp`, `_id`, `task_id`. Test-specific keys added per file.

### 4.5 Background tasks

FastAPI's `BackgroundTasks` runs synchronously inside `TestClient` after the response is sent. Tests assert on the mocked Mongo/Neo4j calls that happened during the background task — no special async handling needed.

```python
def test_market_scoring_triggers_background_task(client, mock_mongo, mock_llm_chain):
    response = client.post("/api/leads/market-scores", json={...})
    assert response.status_code == 202
    assert mock_mongo.return_value.Scout_Agent.scoring_status.update_one.called
```

### 4.6 Side-effect verification rules

For each write endpoint, the test asserts the **category** of side-effect, not the literal call. This is the key for refactor tolerance.

| Endpoint | Side-effect we assert | We do NOT assert |
|---|---|---|
| `POST /api/leads` | `mock_neo4j["session"].run` called with `CREATE (l:Lead` substring | Exact Cypher string |
| `POST /api/leads/batch-upload` | Multiple `CREATE (l:Lead` calls + Mongo `update_one` for tracking doc | Exact Cypher / Mongo filter |
| `POST /api/customer_profile` | Mongo `insert_one` to customer_profile collection | Which Mongo db (refactor may consolidate) |
| `POST /api/upload-document` | S3 `put_object` with right `Bucket` + `Key` | Exact body bytes |
| `POST /api/leads/market-scores` | Mongo `update_one` to `scoring_status` (background task fired) | Full task progression |
| `POST /api/signal_action` | Either Mongo `update_one` (accept) or `delete_one` (reject) on signals | Full Mongo filter shape |

### 4.7 Test count budget (~58 BE tests)

| Module | Tests |
|---|---|
| `test_auth_org.py` | ~6 |
| `test_profiles.py` | ~5 |
| `test_icp.py` | ~10 |
| `test_market_research.py` | ~6 |
| `test_signals.py` | ~8 |
| `test_leads.py` | ~12 |
| `test_market_scoring.py` | ~3 |
| `test_documents.py` | ~8 |

Expected runtime: **<10 seconds locally** (everything mocked, in-process).

Module sum: 6+5+10+6+8+12+3+8 = 58 (rounded down to 55 if some modules under-need tests; the spec budget is "around 55-60").

---

## 5. Frontend test mechanics

### 5.1 Tech stack

- `@playwright/test`
- Built-in `page.route()` for HTTP interception
- Built-in `expect(page).toHaveScreenshot()` for visual regression
- Single browser project: chromium on WSL2/Linux

### 5.2 Playwright config

```typescript
// frontend/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 4,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium-linux', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
      animations: 'disabled',
    },
  },
});
```

### 5.3 Firebase auth handling — two strategies

| Test type | Strategy | Why |
|---|---|---|
| **Journey 1** (login → tenant → mission) | `page.route()` intercepts `identitytoolkit.googleapis.com` and returns canned Firebase token. Real Firebase SDK runs, real `AuthContext` updates, real redirects fire. | The redirect chain *is* what we're characterizing. |
| **Journeys 2-5 + all stub tests** | `page.addInitScript()` seeds `localStorage` with fake auth + tenant data before page load. Skip the login form. | Saves ~10s per test; auth isn't what we're testing. |

```typescript
// frontend/e2e/helpers/login.ts
export async function loginAsTestUser(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'mock_jwt_token');
    localStorage.setItem('user_id', 'test_user_123');
    localStorage.setItem('org_id', 'test_org_abc');
    localStorage.setItem('selected_tenant', JSON.stringify({
      id: 'test_org_abc', name: 'Test Org',
    }));
  });
}

export async function mockFirebaseLogin(page: Page) {
  await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        idToken: 'mock_firebase_token',
        email: 'test@brewra.test',
        localId: 'test_user_123',
        registered: true,
      }),
    });
  });
}
```

### 5.4 API mocking pattern

Central registry of canned responses keyed by endpoint, with optional per-test overrides.

```typescript
// frontend/e2e/fixtures/api-mocks.ts
export const apiMocks = {
  '/api/org': { orgs: [{ id: 'test_org_abc', name: 'Test Org' }] },
  '/api/profile/company': { /* ... */ },
  '/api/leads': { leads: [/* 3 fixture leads */], total: 3 },
  '/api/fetch-signals': { signals: [/* 5 fixture signals */] },
  '/api/customer_profile': { profiles: [/* 2 fixture ICPs */] },
  // ...
};

export async function installApiMocks(page: Page, overrides = {}) {
  const merged = { ...apiMocks, ...overrides };
  for (const [path, response] of Object.entries(merged)) {
    await page.route(`**${path}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }
}
```

### 5.5 Example journey test

```typescript
// frontend/e2e/journeys/03-signals-feed-action.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';

test('signals feed loads, accept persists, snapshot stable', async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page);

  const actionRequest = page.waitForRequest('**/api/signal_action');

  await page.goto('/your-ai-team/scout/signals');
  await expect(page.getByText('Signals')).toBeVisible();

  await expect(page).toHaveScreenshot('signals-feed-loaded.png', {
    mask: maskDynamic(page),
  });

  await page.getByRole('button', { name: /accept/i }).first().click();

  const req = await actionRequest;
  const payload = req.postDataJSON();
  expect(payload.action).toBe('accept');
  expect(payload.org_id).toBe('test_org_abc');

  await expect(page).toHaveScreenshot('signals-feed-post-accept.png', {
    mask: maskDynamic(page),
  });
});
```

### 5.6 Visual regression mechanics

- Goldens stored under `frontend/e2e/__screenshots__/<test-file>/<screenshot-name>-chromium-linux.png`
- Update with `npm run test:e2e -- --update-snapshots`. Never blanket-update; review the diff visually.
- `maskDynamic(page)` returns `Locator[]` for known volatile selectors: `[data-testid="timestamp"]`, `.spinner`, `[data-testid*="generated-id"]`.
- Maintenance: periodically prune orphaned screenshots when tests are deleted (Playwright won't auto-prune).

### 5.7 Test count budget (~10 FE tests, 30 goldens)

- 5 journey specs × 1 test each = 5 tests
- 5 stub specs × 1 test each = 5 tests
- Total: **~10 FE tests**, **30 goldens**
- Expected runtime: **60-120 seconds** locally

### 5.8 New `package.json` scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:update-snapshots": "playwright test --update-snapshots",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## 6. Test data, fixtures, mocks

### 6.1 Stable identities (cross-stack)

```python
# backend/tests/identities.py
TEST_USER_ID = "test_user_123"
TEST_ORG_ID = "test_org_abc"
TEST_LEAD_ID_1 = "lead_00000000-0000-0000-0000-000000000001"
TEST_ICP_ID_1 = "icp_00000000-0000-0000-0000-000000000001"
TEST_SIGNAL_ID_1 = "sig_00000000-0000-0000-0000-000000000001"
TEST_FILE_KEY = "test_org_abc/test_file_key.pdf"
```

`frontend/e2e/fixtures/identities.ts` mirrors these strings exactly. **Cross-stack consistency rule:** when an API contract changes, both sides update in the same atomic commit (per CLAUDE.md monorepo rule).

### 6.2 Fixture organization (per resource, builder pattern)

```python
# backend/tests/fixtures/leads.py
def lead(**overrides) -> dict:
    base = {
        "lead_id": TEST_LEAD_ID_1,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "company_name": "Acme Corp",
        "contact_name": "Jane Doe",
        "email": "jane@acme.test",
        "industry": "SaaS",
        "stage": "Discovery",
        "created_at": "2026-05-08T10:00:00Z",
    }
    return {**base, **overrides}

def lead_list(n: int = 3) -> list[dict]:
    return [lead(lead_id=f"lead_{i:08d}") for i in range(n)]

def csv_upload_payload() -> bytes:
    return b"company_name,contact_name,email\nAcme,Jane,jane@acme.test\n"
```

FE mirrors via `frontend/e2e/fixtures/seed-data.ts`. Field names and types must agree across BE/FE. Intentional duplication per polyglot rule.

### 6.3 LLM endpoint fixtures (B-grade per Q6, marked TD-001)

Hand-crafted minimal sketches in three layers of decreasing fidelity:

1. **Pydantic-driven shape** when the endpoint has `response_model` (rare per CLAUDE.md).
2. **Inferred shape from FE consumer code** when no `response_model` — read what `MarketResearch.tsx`, `Signals.tsx`, etc. expect.
3. **Skeleton stubs** when consumer is unclear: `{"status": "ok", "data": [...]}`.

```python
# backend/tests/fixtures/market_research.py
def market_research_component_1_response() -> dict:
    return {
        "component_name": "market_size_opportunity",
        "status": "completed",
        "result": {
            "title": "Market Size & Opportunity",
            "summary": "Global SaaS GTM market estimated at $X billion...",
            "key_findings": ["Finding 1", "Finding 2", "Finding 3"],
            "sources": [{"url": "https://example.test", "title": "Source 1"}],
        },
        "cached": False,
        "timestamp": "2026-05-08T10:00:00Z",
    }
```

These fixtures are intentionally minimal. They will not catch every regression. **TD-001 documents the upgrade path** (capture-once script for LLM endpoints).

### 6.4 Mocks for external services

| Service | Mock behavior |
|---|---|
| Neo4j driver | `MagicMock()`, session().run() returns canned record lists per test |
| Mongo client | `MagicMock()`, db.collection.find/insert/update/delete return canned docs |
| Pinecone | `MagicMock()`, .query() returns empty match list |
| S3 (boto3) | `MagicMock()`, put_object/delete_object succeed silently |
| LangChain `agent_chain` | `MagicMock()`, .run() returns canned JSON strings |
| Tavily | Wrapped in agent_chain mock; rarely needs separate mock |
| RapidAPI LinkedIn | Dead code per inventory; not mocked, not tested |

---

## 7. Operations & maintenance

### 7.1 One-time setup (~2-4 hours)

1. Create directory layout per § 3.
2. `pip install -r backend/requirements-test.txt` (pytest, syrupy, pytest-mock, httpx, anyio).
3. Author `backend/tests/conftest.py` with the dependency-override fixtures.
4. `cd frontend && npm install -D @playwright/test && npx playwright install chromium --with-deps`.
5. Author `frontend/playwright.config.ts` + helpers (`login.ts`, `mask-dynamic.ts`, `api-mocks.ts`).

### 7.2 Running tests

```bash
# Backend (from /backend/)
pytest tests/                          # full suite
pytest tests/test_leads.py             # one file
pytest tests/test_leads.py::test_create_lead -v
pytest --snapshot-update tests/        # accept snapshot diffs (deliberate use)
pytest -k "scoring" tests/             # filter by name

# Frontend (from /frontend/)
npm run test:e2e                       # full suite
npm run test:e2e -- journeys/03        # one journey
npm run test:e2e:headed                # watch the browser
npm run test:e2e:ui                    # interactive debugger
npm run test:e2e:update-snapshots      # accept visual diffs (deliberate use)
```

### 7.3 Expected timings

| Suite | Local time |
|---|---|
| Backend (~58 tests) | <10 s |
| Frontend (~10 tests) | 60–120 s |
| **Total** | ~2 min |

### 7.4 Refactor protocol (the actual user value)

1. **Before starting a refactor:** Run full suite. Confirm green. Baseline established.
2. **During the refactor:** Run frequently — every few hundred lines of structural change.
3. **When a test fails:**
   - Snapshot diff → exact field that changed; revert or accept deliberately.
   - Side-effect failure → refactor changed *what* the endpoint does; revert or accept.
   - Visual diff → review screenshot; usually styling side-effect.
4. **When you intentionally change behavior:** update snapshots/screenshots in the same commit. Commit message documents *why* the snapshot moved.
5. **When the refactor is done:** all tests green, all snapshot updates intentional and committed.

### 7.5 Maintenance / drift

- B-grade fixtures can lie (TD-001). Pull TD-001 forward when it bites.
- Snapshot cruft: every few weeks, scan `__snapshots__/` for orphaned keys; syrupy warns about unused snapshots.
- Visual goldens cruft: periodically prune `__screenshots__/` for deleted tests (Playwright won't auto-prune).
- Test code is code. Refactor test helpers when they grow ugly. Don't let the suite become a second monolith.

### 7.6 What this design explicitly does NOT do

- Does not test prompt quality (LLM output is unbounded).
- Does not test multi-tenancy *enforcement* (filter is mocked away; would need real DBs with two seeded orgs).
- Does not gate CI (Q7=A — local-only, on demand). If a developer skips running, no automation catches it.
- Does not test stub code beyond "page loads without crashing".
- Does not catch performance regressions, memory leaks, or the silent 5,000-lead scoring cap.

---

## 8. Decision summary

| Decision | Choice | Rationale |
|---|---|---|
| Surface | BE-heavy + thin FE smoke pack | BE is what's being refactored; FE journeys catch the integration glue |
| BE seam | Mock at client boundary | Locks HTTP contract; survives internal refactors |
| BE assertion style | Snapshot (body) + explicit (status, headers, side-effects) | Strict structural alarm + named documentation |
| FE tooling | Playwright + `page.route()` | Real React/Vite/routing, mocked backend |
| FE journeys | 5 journeys + 5 stub-page smoke tests | Critical-path coverage + lock placeholder pages |
| Visual regression | `toHaveScreenshot()`, 30 goldens, WSL2/Linux canonical | Pixel-diff actual rendered state |
| Fixture sourcing | Hand-crafted (B); capture-once (C) deferred as TD-001 | Velocity > fidelity for this stage |
| When | Local, on demand | No CI gate; dev runs `pytest` + `npm run test:e2e` before/after each refactor commit |
| Test count | ~58 BE + ~10 FE | Total <2 min locally |

---

## 9. Open items / known limitations

- **TD-001** logged in `docs/TECH_DEBT.md`: hand-crafted LLM fixtures will not catch prompt-output drift. Upgrade trigger documented.
- **No CI gate.** Discipline is the developer's responsibility. If a refactor commits land without running the suite, nothing catches it. Per Q7=A.
- **Single OS canonical.** Goldens are WSL2/Linux only. A contributor on macOS or native Windows will get spurious visual diffs and must regenerate locally on Linux to commit.
- **Multi-tenancy enforcement is not characterized** — the `WHERE org_id` filter is mocked away. A refactor that drops the filter clause silently will pass these tests.
- **The two-PWA reality.** Playwright tests target the monorepo `/frontend/` only. The `PWA-multi-tenancy/development/` and `PWA-multi-tenancy/production/` workspaces (Brewra-dev sources during the temp week) are out of scope and will not be characterized.

---

## 10. Next step

After user approval of this spec, invoke the **writing-plans skill** to produce an ordered implementation plan in `plans/NN-characterization-tests.md` (next available NN; current latest is 02).
