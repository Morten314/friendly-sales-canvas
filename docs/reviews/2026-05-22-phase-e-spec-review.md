# Review: Backend Modularization Phase E — Test Improvements Design

**Reviewed spec:** `specs/2026-05-22-backend-test-improvements-phase-e-design.md`
**Reviewer:** Kilo (automated)
**Date:** 2026-05-22
**Verdict:** Well-structured spec with clear scope and good worked examples. Several factual corrections needed, one design risk worth addressing, and some scope gaps.

---

## 1. Factual Accuracy Checks

### Verified correct

| Claim | Actual | Status |
|---|---|---|
| Phase D created a typed-exception hierarchy in `app/core/exceptions.py` | 162-line file with 29 classes (5 bases + 20 leaves + 2 retained + ServiceError) | Correct |
| 9 service files to unit-test | 9 files in `app/services/` match the listed names | Correct |
| Tests import from `tests.identities` | `tests/identities.py` exports `TEST_USER_ID`, `TEST_ORG_ID`, `TEST_LEAD_ID_1`, etc. | Correct |
| Integration tests mock at `app.core.clients.*` layer | `tests/conftest.py` patches `app.core.clients.driver`, `app.core.clients.client`, etc. | Correct |
| `Research_Market_1..5` exist in `app/services/market_research.py` | Functions at lines 50, 169, 305, 532, 746 | Correct |
| Exception hierarchy has 20 Phase D leaves + ServiceError + 2 retained | 14 NotFoundError + 5 ValidationError + 1 ConflictError + ServiceError + BudgetExhaustedError + ICPIdRegistryError = 23 total (20 leaves + ServiceError + 2 retained) | Correct |

### Corrections needed

| Claim | Actual | Issue |
|---|---|---|
| "93 existing tests" (§4, §6, throughout) | **89 test functions** across `tests/` (verified by `grep -c "def test_"`) | Test count is wrong. Phase D review also flagged this (it said 89 back then). The spec should use the verified count: 89 existing. After Phase E: 89 + ~110-130 = ~200-220. |
| "~24 JSON files" in `captured/` (§2.1) | The table in §3.3 lists: 10 market_research + ~10 icp_research + 4 search_signals + 2 signal_ask = ~26 files. But the spec also says "~20 files in `tests/fixtures/captured/`" in §4 commit 2. | Count is internally inconsistent. Pick one number (26 from the table is the most detailed) and use it consistently. |
| "Existing 93 still pass" (§4 commits 1, 2) | 89, not 93 | Same as above. |
| "all 20 Phase D leaves + ServiceError + the 2 retained classes" for `pytest.raises` coverage (§6 hard criteria) | There are 14 NotFoundError leaves, 5 ValidationError leaves, 1 ConflictError leaf, 1 ServiceError, 2 retained = **23 classes total**. But 5 of the 14 NotFoundError leaves may map to services not getting unit tests (e.g., `ProfileNotFoundError` is in `profiles.py` which is covered, but `UsersDocumentNotFoundError` may be internal to `documents.py`). | The spec says "20 Phase D leaves" — the actual count from `exceptions.py` is 20 leaves (14 + 5 + 1). But the acceptance criterion should count them exactly: 20 leaves + ServiceError + BudgetExhaustedError + ICPIdRegistryError = 23 target classes for `pytest.raises` coverage. |
| `asyncio.run()` approach for async tests (§3.2) | The spec says "Avoids adding a `pytest-asyncio` plugin dependency." But `asyncio.run()` creates a **new event loop** per call. Multiple `asyncio.run()` calls in the same test process are safe in Python 3.10+, but `asyncio.run()` cannot be called inside an already-running event loop. If any test helper or fixture ever starts an event loop (unlikely today but possible), this pattern breaks. | Not factually wrong, but the rationale is incomplete. Document the constraint explicitly: "works because unit tests have no running event loop." Also note that `asyncio.run()` is slightly slower than reusing a loop; for ~120 tests this is negligible but worth noting. |

---

## 2. Structural Issues

### 2.1 Syrupy snapshots don't exist for the LLM-driven tests

§3.5 and §4 commit 12 describe re-baselining syrupy snapshots after the integration-test rewire. But syrupy is **not installed** in the backend environment — it's not in `requirements.txt` or any dependency manifest. The `__snapshots__/` directory exists with `.ambr` files for `test_auth_org`, `test_icp`, and `test_profiles` only.

The tests that use snapshots (`test_auth_org.py`, `test_icp.py`, `test_profiles.py`) import `snapshot` as a pytest fixture provided by syrupy. The spec's rewire targets `test_market_research.py`, `test_icp.py`, and `test_signals.py` — but `test_market_research.py` and `test_signals.py` do **not** use syrupy snapshots at all.

**Recommendation:**
- Audit which integration test files actually use syrupy snapshots before committing to a "re-baseline" step. Only `test_icp.py` among the rewire targets uses snapshots.
- If syrupy is a desired dependency, add it to `requirements.txt` explicitly. If not, remove the snapshot re-baseline language and use plain assertions.
- For `test_market_research.py` and `test_signals.py`, the rewire is just a mock-return-value swap — no snapshot involvement.

### 2.2 `mock_driver` fixture returns session, not driver — naming is confusing

§3.2 defines `mock_driver` but returns the **session** object (so tests can configure `session.run.return_value`). This is a deliberate design choice (tests need to configure the session, not the driver), but the name `mock_driver` is misleading. The existing integration tests in `conftest.py` already do this and return a dict `{"driver": mock_driver, "session": mock_session}` for clarity.

**Recommendation:** Either:
- Return a dict `{"driver": driver, "session": session}` like the integration tests do (but this changes every test's destructuring), or
- Rename to `mock_session` (since that's what's returned), and have tests that need the driver construct it separately, or
- Keep the name but add a clearer docstring: "Returns the *session* (not the driver) so tests can configure `session.run.return_value`."

### 2.3 `captured` fixture in `conftest.py` is just `load_captured` — unnecessary indirection

§3.2 defines a `captured` fixture that returns the `load_captured` function itself. This means tests would write `captured("market_research_market_size_groq")` — but they could just import `load_captured` directly at the top of the test file (as the worked examples in §5.2 already do).

The fixture adds no value over a direct import. The worked examples contradict the conftest definition.

**Recommendation:** Drop the `captured` fixture from `conftest.py`. Tests should `from tests.fixtures import load_captured` directly, as shown in §5.2. The conftest should only contain mock fixtures (`mock_driver`, `mock_mongo_client`).

### 2.4 The `inline/` fixture directory is claimed as "existing" but doesn't exist

§3.1 shows `fixtures/inline/` as "existing hand-crafted builders (kept)." But `backend/tests/fixtures/` currently contains only: `__init__.py`, `icp.py`, `leads.py`, `market_research.py`, `profiles.py`, `signals.py`. There is no `inline/` subdirectory — these files are directly in `fixtures/`.

**Recommendation:** Correct the directory layout to reflect reality. The existing fixture modules (`icp.py`, `leads.py`, etc.) are flat in `fixtures/`, not in `fixtures/inline/`.

### 2.5 `pytest.raises(LeadNotFoundError, match="Lead not found or access denied")` in worked example may not match

§5.1 `test_update_lead_raises_lead_not_found` asserts `match="Lead not found or access denied"`. This depends on the exact message string in the service. Phase D created the exception classes but the messages come from the migration commits. If the message is `f"Lead {lead_id} not found"` or something else, the test will fail.

**Recommendation:** Worked examples should either use a generic match (`match="not found"`) or note that the exact match string must be verified against the actual service code at implementation time. This is a minor point for a spec (examples are illustrative) but worth flagging since these will become real tests.

---

## 3. Design Suggestions

### 3.1 `asyncio.run()` is fragile — consider `pytest-asyncio` anyway

The spec explicitly avoids `pytest-asyncio` to avoid a dependency. But:
- `pytest-asyncio` is a single pip install and zero config (auto mode works for most cases).
- `asyncio.run()` is the "manual" approach and has subtle constraints (can't nest, creates/destroys loop per call).
- The services have **17 async functions** across `market_research.py`, `icp.py`, `signals.py`, and `documents.py`. Every test for these needs `asyncio.run()`.
- If any async service function ever calls `asyncio.gather()` or creates tasks internally, `asyncio.run()` handles it correctly — but if a future refactor introduces `asyncio.get_event_loop()`, it breaks.

**Recommendation:** The spec should acknowledge the trade-off more explicitly: "`asyncio.run()` is chosen to minimize dependencies. If async testing proves cumbersome (>20% of tests need it), add `pytest-asyncio` in a follow-up commit." This leaves the door open without committing now.

### 3.2 Capture script should validate fixture freshness

The capture script (§3.3) writes JSON files but doesn't validate that the captured output matches the expected shape. If an LLM provider changes its response format silently, the captured fixture could be a completely different structure, and tests using `load_captured()` would assert against garbage.

**Recommendation:** Add a lightweight validation step to the capture script:
- Each capture includes a `_meta` key with `{captured_at, llm_backend, model_version, component}`.
- The script has a `--validate` mode that loads existing fixtures and checks they have the expected top-level keys (e.g., `status`, `data` for market research).
- Or simpler: the script logs a SHA256 of each captured file; CI can detect drift on re-capture.

The spec's "re-capture triggers" section (§3.3) documents when to re-run, but not how to detect that a re-run is needed. Adding even a minimal checksum check would close this gap.

### 3.3 Missing: how do unit tests handle cross-service imports?

`customer_profile.py` imports from `app.services.icp` (`_ensure_icp_id_registry_indexes`, `_reserve_unique_icp_id`). Unit tests for `customer_profile` will need to mock these cross-service imports. The spec doesn't discuss this pattern.

**Recommendation:** Add a note to §3.2: "When service A imports a function from service B (e.g., `customer_profile → icp._reserve_unique_icp_id`), the unit test mocks the import at the caller's namespace (`mocker.patch('app.services.customer_profile._reserve_unique_icp_id')`)." This follows the same source-level patching convention but for inter-service calls.

### 3.4 Background-task tests need time/tick control

§5.3 shows `_run_market_scoring_for_org` tested by checking `update_one` call args. But the actual function likely writes a "running" status first, then a "completed"/"failed" status. The test asserts the final state by inspecting all `update_one` calls. This works but is fragile — if the function adds another `update_one` call (e.g., progress tracking), the test breaks.

**Recommendation:** Consider using `call_args_list` filtering more robustly, or add a helper: `def get_last_status_update(mock_collection, expected_status) -> dict`. This is a pattern that will repeat across background-task tests.

### 3.5 The `load_captured` function silently strips `.json` — document this

§3.4 shows `stem = name[:-5] if name.endswith(".json") else name`. This is convenient but could mask bugs — `load_captured("market_research_market_size")` and `load_captured("market_research_market_size.json")` produce the same result, which means a typo in the stem name (e.g., missing `_groq` suffix) silently loads the wrong file or raises `FileNotFoundError`.

**Recommendation:** Either drop the `.json` stripping (force callers to always use stem names without extension) or add a clear docstring warning. The current approach is fine but should be a conscious choice.

### 3.6 Commit 2 says "developer runs script locally with real keys, commits JSON outputs"

This is the correct approach, but the spec should note a risk: **the captured JSON files will contain LLM-generated text**. Depending on the LLM output, this could include:
- PII that was in the prompt (unlikely if seed payloads are synthetic, but worth checking).
- Long responses that bloat the repo.

**Recommendation:** Add a note: "Seed payloads in `fixtures/seed/` must use synthetic data only (no real user/company names). Captured outputs should be spot-checked for PII before committing. Add `*.large.json` to `.gitattributes` if any capture exceeds 50KB."

---

## 4. Missing Considerations

### 4.1 No mention of test ordering / isolation

Unit tests that share the `mock_driver` fixture could interfere if `mock_driver` is session-scoped (it's not — `@pytest.fixture` defaults to function scope). But the spec doesn't discuss scoping. The worked examples use function-scoped fixtures implicitly, which is correct. A brief note confirming function-scope by default would prevent a future contributor from "optimizing" to session-scope and introducing cross-test pollution.

### 4.2 No plan for when `app/services/*.py` signatures change during Phase E

Phase E is being designed before Phase D has fully landed (Phase D review exists but the branch may still be in progress). If any service function signature changes between now and Phase E implementation, the unit test signatures in this spec will be stale.

**Recommendation:** Add a prerequisite check to §4: "Before commit 3, re-run `grep -n "def " app/services/*.py` and verify function signatures match the worked examples. Update examples if Phase D post-review fixes changed any signatures."

### 4.3 Missing: `graph_chat.py` and `pipeline.py` are not unit-tested

These two service files are not in the unit-test plan. `graph_chat.py` has `voice_graph` and `text_graph` (the Cypher injection risk sites from AGENTS.md). `pipeline.py` is imported by a router. The spec excludes them from scope (they weren't in the Phase D migration set), but the rationale should be explicit.

**Recommendation:** Add a note to §2.2: "`graph_chat.py` and `pipeline.py` are not in the Phase D migration set and contain no typed-exception raises; they remain covered by integration tests only."

### 4.4 The capture script's `--components` flag needs clearer semantics

§3.3 shows `--components <comma-list>` but doesn't define the valid component names. Are they the Research_Market function names? The endpoint paths? The component display names ("market size & opportunity")? The implementer needs to know.

**Recommendation:** Add a brief table or reference: "Valid component names: `market_size`, `industry_trends`, `competitor_landscape`, `regulatory_compliance`, `market_entry` (for market_research); `icp_*` components TBD by discovery; `signals_scout`, `signals_profiler`, `signal_ask`."

### 4.5 No mention of test execution in CI

The spec says CI integration of `capture_fixtures.py` is out of scope (§2.2). But it doesn't mention whether `pytest tests/unit/` should be added to any CI config. If there's a CI pipeline (GitHub Actions, Render build hook, etc.), the unit-test directory needs to be included.

**Recommendation:** Add a soft acceptance criterion: "`pytest tests/unit/` can be run standalone in CI without requiring `tests/fixtures/captured/` to be populated first (i.e., captured fixtures must be committed to the branch)." This is already implied by committing the JSON, but stating it explicitly prevents a "CI runs capture script" mistake.

### 4.6 `ServiceError` acceptance criterion is vague

§6 hard criteria says "Every typed-exception leaf class... is asserted in at least one `pytest.raises(...)` call." `ServiceError` is used for three specific cases in `signals.py` (signal-delete race, missing API key, Claude API failure). The spec's §4 commit 11 mentions these. But `ServiceError` is a generic 500 class — if it gets used elsewhere in the future, the "at least one" criterion is already met.

**Recommendation:** Tighten the criterion: "Every typed-exception class with current raise sites has at least one `pytest.raises(...)` per distinct raise site." Or keep the current criterion but note it's a minimum floor.

---

## 5. Minor Nits

1. **§1 Summary says "Phase D's typed-exception hierarchy was the precondition."** Present tense would be clearer: "Phase D's typed-exception hierarchy **is** the precondition." (Phase D has landed.)

2. **§3.2 conftest code uses `@pytest.fixture`** but doesn't import `pytest`. The worked examples import it, but the conftest snippet doesn't show the import. Minor — add `import pytest` to the snippet.

3. **§3.3 capture script shows `--llm-backend {groq,claude,both}`** but the codebase uses "claude" to mean Anthropic Claude. Consider being explicit: `{groq,claude,both}` where `groq` = Together.ai's Llama model and `claude` = Anthropic's Claude Sonnet. A comment would help future readers who expect "together" as the flag name.

4. **§4 migration order rationale** says "commit 2 must precede 7, 8, 11." This is correct but should also mention commit 2 precedes **12** (the integration test rewire also uses captured fixtures).

5. **§5.1 test `test_batch_upload_leads_raises_on_empty_csv`** passes `mock_driver` and `mock_mongo_client` but doesn't use them in the test body. If `batch_upload_leads` raises before touching either mock, the fixture parameters are unnecessary. If it does touch them, the test should assert on the interaction. This is an example-quality issue, not a spec issue.

6. **§5.2 imports `from tests.identities import TEST_USER_ID, TEST_ORG_ID`** but `MarketRequest` also needs `component_name` and `data` — the example shows this correctly. Good.

7. **§6 soft criteria** says "a developer can run `pytest tests/unit/test_leads.py -v` and see all leads unit tests in under 500ms." This is reasonable for mock-based tests. But if the mock setup involves importing `app.main` (as the integration conftest does), it could be slow. The unit conftest should **not** import `app.main` — and the spec should note this constraint explicitly.

8. **§8 Phase F+ inventory** lists "Captured-fixture refresh policy" as a new item. This is good. Consider also adding: "Migration of remaining syrupy snapshots to captured fixtures" if snapshot-based tests grow.

9. **Typographical:** §3.1 directory tree shows `__snapshots__/` as "existing syrupy snapshots" — but only 3 of the 9 integration test files use snapshots. The tree should note this.

---

## 6. Summary of Recommendations

### Must-fix (factual correctness)
- Correct test count from 93 to **89** throughout.
- Reconcile fixture file count (~24 vs ~20 vs ~26 — use the §3.3 table count consistently).
- Fix the `fixtures/inline/` directory claim — existing fixture modules are flat in `fixtures/`.
- Audit which integration tests actually use syrupy snapshots before committing to snapshot re-baseline language.

### Should-fix (scope completeness)
- Add cross-service mock pattern guidance (§3.2 or new §3.6).
- Note that `graph_chat.py` and `pipeline.py` are explicitly excluded with rationale.
- Define valid `--components` values for the capture script.
- Add prerequisite check for service function signature stability.
- Confirm unit conftest must NOT import `app.main`.

### Nice-to-have (design quality)
- Consider adding `_meta` to captured fixtures for freshness validation.
- Drop the unused `captured` fixture from conftest (tests import `load_captured` directly).
- Clarify `asyncio.run()` constraints in the rationale.
- Add PII/repo-size note for captured fixture commits.
- Rename or clarify `mock_driver` fixture (returns session, not driver).
