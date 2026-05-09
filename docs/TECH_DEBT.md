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
