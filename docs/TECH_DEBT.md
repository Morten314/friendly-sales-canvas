# Brewra — Technical Debt Register

Running list of debt items the team has consciously accepted. Each entry: what was done, what should be done, why we deferred, and the trigger that should pull it forward.

---

## TD-001 — Test fixtures are hand-crafted, not captured from real responses

**Date logged:** 2026-05-08
**Origin:** Characterization-test brainstorm (`specs/2026-05-08-characterization-tests-design.md`)

**Current state:**
Backend characterization tests use **hand-crafted fixture dicts** for all endpoints — including LLM-driven ones (`POST /api/market-research`, `POST /api/icp-research`, `POST /api/generate-signals-batch`, `POST /api/signal_Ask`). The fixtures represent a minimal structural sketch of the response shape, authored by hand.

**What it should be:**
A **hybrid**: hand-crafted fixtures for simple CRUD endpoints, captured-once fixtures for the LLM-driven endpoints. A `backend/tests/capture_fixtures.py` script would hit the live (or local) backend with a dedicated test `org_id`, record real LLM responses to JSON, and freeze them as the canonical fixtures. Re-run intentionally when prompts change.

**Why we deferred:**
- Velocity. The first wave of refactoring is days away; capture-script setup adds a half-day before any tests can be written.
- B-grade fixtures still catch the most common refactor regressions (response shape, status codes, mocked side-effects).
- We can upgrade incrementally — each LLM endpoint can be re-fixtured later without reworking the test structure.

**What we lose by staying on B:**
- Hand-crafted LLM fixtures don't reflect the actual prompt-output shape the system produces today. If a refactor preserves contract but accidentally changes prompt logic, hand-fixtures may still pass; captured fixtures would catch the drift.
- Hand-crafted fixtures for nested LLM JSON are tedious and easy to under-spec (the test asserts a smaller structure than reality).

**Pull-forward triggers:**
- First refactor that touches `backend/services.py` LLM-call functions (`Research_Market_*`, `icp_research_*`, `search_signals_scout`/`_profiler`).
- First time a test passes locally but production diverges — i.e., a real "the fixtures lied" incident.
- When LLM provider/model changes (Groq, Together) — captured fixtures would re-baseline the system at the new model's output shape.

**Owner:** TBD (likely whoever first hits a "fixtures lied" incident).

**Resolved 2026-05-22 by Phase E (`refactor-backend-modularization-phase-e`).** `backend/tests/capture_fixtures.py` produces ~24 deterministic JSON captures in `backend/tests/fixtures/captured/`. Three integration test files (`test_market_research.py`, `test_icp.py`, `test_signals.py`) now consume these via `load_captured(...)`. Re-capture triggers are documented in the script header.

---

## TD-002 — No direct unit tests for service functions

**Date logged:** 2026-05-22
**Origin:** Phase C code review N7 (`docs/code-review-backend-modularization-phase-c.md`); Phase D design §2.2 (`specs/2026-05-22-backend-modularization-phase-d-design.md`).

**Current state:**
All backend tests exercise services *through* the FastAPI `TestClient` and assert on HTTP status codes / JSON bodies. There are no tests that call service functions directly and assert on their return values or raised exceptions.

**What it should be:**
Service functions get a layer of direct unit tests — `pytest.raises(LeadNotFoundError)` style — complementing the existing integration tests. Especially valuable for the three Phase C service extractions (`trigger_or_get_market_scores`, `get_market_scores_status`, `get_lead_market_score_descriptions`) and any future service that's reused outside HTTP.

**Why we deferred:**
- Phase D establishes the precondition (services raise typed exceptions instead of `HTTPException`), but adding the tests in the same phase would balloon scope.
- Existing 93 tests already cover HTTP-level behavior; adding service-level tests is a quality improvement, not a regression fix.

**What we lose by staying as-is:**
- A bug introduced *inside* a service function (logic, query construction) is only caught if the integration test happens to exercise that path with the right data.
- Refactors inside a service are riskier than they should be — no fast feedback loop independent of FastAPI.
- The typed-exception convention is harder to enforce without tests pinning it.

**Pull-forward triggers:**
- First bug found in a service that the integration tests missed because mock setup hid it.
- First non-HTTP caller (background task, CLI command, LangChain chain) that calls a service and exposes a behavior the integration tests don't.
- When `_get_market_score_collections` or similar helper needs to be tested independently to validate a query change.

**Owner:** TBD.

**Resolved 2026-05-22 by Phase E (`refactor-backend-modularization-phase-e`).** `backend/tests/unit/` adds ~110-130 direct unit tests across 9 service files. Each typed-exception leaf in `app/core/exceptions.py` is asserted via `pytest.raises(...)`. `pytest tests/unit/` runs in under 2s.

---

## TD-003 — Startup hooks use deprecated `@app.on_event` API

**Date logged:** 2026-05-22
**Origin:** Phase C code review C2 (`docs/code-review-backend-modularization-phase-c.md`); Phase D design §8 item 6.

**Current state:**
`app/main.py` uses `@app.on_event("startup")` for `_ensure_market_scoring_indexes` (added in Phase C). The pre-existing `clients.graph.refresh_schema()` runs at module-import time (even more dated). FastAPI 0.93+ recommends a `lifespan` context manager and emits a deprecation warning for `on_event`. The test suite shows this warning (count rose from 9 to 11 after Phase C).

**What it should be:**
A single `@asynccontextmanager`-decorated `lifespan` function passed to `FastAPI(lifespan=...)` that wraps both the Neo4j schema refresh and the Mongo index creation, guarded by `BREWRA_SKIP_DB_INIT` / `clients.client is None`.

**Why we deferred:**
- Phase C scope was cleanup closure; Phase D scope is the exception convention. A `lifespan` migration is its own small phase to keep diffs reviewable.
- Migrating only the new hook while leaving the pre-existing one untouched would make `main.py` more inconsistent, not less.

**What we lose by staying as-is:**
- 2 deprecation warnings per test run (will become errors when FastAPI removes `on_event`).
- Pattern inconsistency for future contributors — module-level startup vs `on_event` vs `lifespan` is three forms in one file.

**Pull-forward triggers:**
- FastAPI release notes announce removal of `on_event` (any major version bump in `requirements.txt`).
- Next time someone needs to add a startup or shutdown hook — do the migration alongside it.

**Owner:** TBD.

---

## TD-004 — Captured LLM fixtures are stubs, not real responses

**Date logged:** 2026-05-22
**Origin:** Phase E implementation review (`docs/reviews/2026-05-22-phase-e-implementation-review.md` §H1).

**Current state:**
`backend/tests/fixtures/captured/*.json` (24 files) are placeholder stubs with `"_stub": true` and a 4–6 key minimal shape. They were produced by hand during Phase E because `ANTHROPIC_API_KEY`, `TOGETHER_API_KEY`, and `TAVILY_API_KEY` were not available in the implementation environment. Unit and integration tests assert against this stub shape rather than real LLM output.

**What it should be:**
Run `cd backend && python tests/capture_fixtures.py` on a machine with all three API keys set. The script overwrites each stub with a real LLM response (10–30+ keys typical). Verify the suite still passes against the real shapes; update assertions or models if drift is exposed.

**Why we deferred:**
- The Phase E refactor was structured so that the capture script, the test harness, and the assertion sites are all in place — only the JSON content is stubbed. Switching to real captures is a content swap, not a code change.
- Running the script requires live API credentials with budget; doing it inside the test-writing phase would gate test-writing on key procurement.

**What we lose by staying as-is:**
- Tests don't assert against actual response shape. A service parsing change that produces a different real output can pass tests silently ("the fixtures lied"). This is the exact risk TD-001 was meant to retire.
- The `test_icp.ambr` snapshot encodes stub shape, not real shape — it will need re-baselining after the first real capture.

**Pull-forward triggers:**
- First time someone with API keys runs the suite locally and observes a mismatch between stub assertions and real service behavior.
- Before any production release that depends on the captured-fixture acceptance criterion in `docs/TECH_DEBT.md` TD-001.
- When the capture pipeline (`tests/capture_fixtures.py`) is modified — re-run to validate the change end-to-end.

**Owner:** CTO (has API key access).
