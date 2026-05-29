---
artifact: plans/23a-apollo-lead-integration-backend.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
---

## Findings

### [High] No kill criteria or abort conditions for the plan as a whole

**Location:** entire plan; "Before you start" section (line 24–39) is the only abort point

The plan has one stated abort: "If red on a clean checkout, stop and report" (line 39). There is no criteria for abandoning the plan mid-execution. If Task 4 (`ApolloConnector`) reveals that the Apollo API doesn't behave as assumed (endpoint paths, response shapes, auth headers), or if Task 5's UNWIND Cypher hits a Neo4j version incompatibility, the executor has no guidance on whether to pivot or halt. At minimum, the plan should state: "If the Apollo API surface is materially incompatible with the assumed endpoints/field names, stop and escalate before continuing to Tasks 5–14."

### [High] Enrichment match-result alignment via `zip` is unverified and has no fallback

**Location:** Task 8, `orchestrator.py` line 2268 (`for lead, match in zip(chunk, matches)`) and Self-review open item 2 (line 2882)

The `_run_enrich` function pairs Apollo `bulk_match` results with input leads by positional `zip`. The self-review acknowledges this as an open item (line 2882) but the plan ships no fallback. If Apollo returns matches out-of-order or omits slots for non-matches, enrichment data will be written to the **wrong leads** — a data corruption bug, not just a missing feature. The plan should either (a) confirm index alignment before implementing (a pre-work spike), or (b) build the safer keyed-lookup (match by returned `id`/`email`) from the start, given the severity of a miswrite.

### [High] No regression runs between tasks — existing-suite breaks surface only at Task 13

**Location:** Task verification steps (all tasks run only their own new tests); Task 13 (line 2811) is the first full-suite run

Each task runs its new tests in isolation. A change in Task 5 (`ingestion.py`) that breaks an existing leads test won't surface until Task 13 (the final verification task, ~8 tasks later). The plan should either (a) recommend running `python -m pytest -q` after every task (not just the new test file), or (b) explicitly accept this risk by noting it in the Conventions section. Given the plan targets an agentic executor, option (a) is cheap insurance — a full-suite run takes seconds against mocks.

### [Medium] Cross-package import of a private function creates hidden coupling

**Location:** Task 5, `ingestion.py` line 1067 (`from app.services.leads.normalization import _process_neo4j_lead_records`)

`ingestion.py` imports `_process_neo4j_lead_records` (underscore-prefixed, private) from the leads package. This function expects Neo4j records shaped as `{["l"]: <Node>}` (verified at `normalization.py:10`: `lead_node = record["l"]`). The `get_leads_by_ids` function in `ingestion.py` runs `MATCH (l:Lead ...) RETURN l`, which produces this shape — so it works today. But if the leads package refactors this function (renames it, changes the expected record key), the connector package breaks silently. The plan should either (a) surface this dependency explicitly (a note in the module table or a re-export from `leads/__init__.py`), or (b) inline the ~20-line deserializer into `ingestion.py` to eliminate the cross-package private import.

### [Medium] Spec deviation from §12.1's "one-line edit" claim is acknowledged but underweighted

**Location:** Task 12 deviation note (line 2715), spec §12.1 (line 362–363)

The spec says "the only edit to an existing file is a one-line `include_router` in `main.py`." The plan edits four existing files: `exceptions.py` (Task 1), `main.py` (Task 11), `models/leads.py` (Task 12), and `services/leads/persistence.py` (Task 12). Task 12 acknowledges this deviation. However, the `exceptions.py` edit (Task 1) is also a deviation that isn't called out — it appends new exception leaves, which is an additive edit to an existing file, not the "one-line `include_router`" the spec promised. All four edits are backward-compatible and additive, so the deviation is low-risk, but the plan should acknowledge the full set of deviations from spec §12.1, not just Task 12's.

### [Medium] Plan doesn't state recovery strategy for mid-task failures

**Location:** Conventions section (lines 15–22), Task structure (all tasks)

Each task follows a TDD cycle with expected failure/pass outputs. But if a task's Step 4 (verification) fails for an unexpected reason (e.g., the implementation passes the new test but breaks an import path for another module), the plan has no stated path. Acceptable: "If a verification step fails unexpectedly, stop and report to the operator." The plan's implicit assumption is that each task is atomically correct, but the real risk is partial breakage that the task-scoped tests don't catch.

### [Medium] `test_connectors_wiring.py` test for `_ensure_connectors_indexes` is fragile

**Location:** Task 11, Step 1, line 2661 (`assert hasattr(main_mod, "_ensure_connectors_indexes")`)

This test checks that `app.main` has a `_ensure_connectors_indexes` attribute, which only passes if the import `from app.services.connectors import _ensure_connectors_indexes` has been added to `main.py`. But the test doesn't verify that the lifespan *calls* it — only that the name exists in the module namespace. A stronger test would start the app with a mock Mongo and verify the index function was invoked during lifespan startup. The current test passes even if the import is added but the lifespan call is forgotten.

### [Medium] Parallelizable tasks are serialized by accident

**Location:** Task ordering (Tasks 1–7)

Tasks 1 (exceptions), 2 (models), and 3 (normalize) are fully independent — no shared imports, no shared state. Tasks 4 (apollo), 6 (credentials), and 7 (runs) each depend only on Task 1. Task 5 (ingestion) depends on Task 3. If the plan targets `subagent-driven-development` (as the header suggests), these could be dispatched in parallel waves: Wave 1: Tasks 1, 2, 3; Wave 2: Tasks 4, 5, 6, 7. The current strict serial ordering is correct but unnecessarily slow for parallel execution. The plan should either (a) annotate dependency edges explicitly, or (b) group tasks into parallelizable waves.

### [Low] `FakeTx` in Task 5 uses fragile string-matching on Cypher templates

**Location:** Task 5, `test_connectors_ingestion.py`, line 990 (`if "CREATE (l:Lead" in c[0]`) and line 1018 (`if "lead_id: row.lead_id" in c[0]`)

The test distinguishes CREATE vs UPDATE vs ENRICH calls by substring-matching the generated Cypher template. If someone reformats the template (whitespace change, reordering a SET clause), the test breaks on a false negative. This is acceptable for a unit test against a known template in the same PR, but fragile across refactors. A more robust approach: tag each Cypher template with a comment marker (e.g., `/* import-create */`) and match on that.

### [Low] `conftest.py` already eagerly imports `app.main` — Task 10's TestClient setup may double-import

**Location:** Task 10 test file (line 2439, `from app.main import app`), `tests/conftest.py` line 68 (`from app.main import app as _app`)

The root conftest eagerly imports `app.main` and registers dependency overrides. Task 10's test creates a fresh `TestClient(app)` and installs its own dependency overrides in an autouse fixture. The autouse fixture (line 2444) installs overrides and pops them on teardown. However, if any other test in the same session has already modified `app.dependency_overrides`, the pop may remove the wrong entry. The root conftest has a session-scoped leak detector (line 193), so this would be caught — but the Task 10 test's manual override management is redundant with the root conftest's `mock_neo4j`/`mock_mongo` fixtures. The plan should either use the existing fixtures or explicitly note why the manual approach is preferred (the manual approach allows per-test monkeypatching of the service layer, which the conftest fixtures don't support).

### [Low] Task 14 (live verification) has no acceptance/failure criteria

**Location:** Task 14, lines 2836–2861

Task 14 describes a manual verification process (start the backend, inspect `/docs`, curl endpoints). But it doesn't state what happens if the shapes don't match expectations. If `curl /connectors/apollo/status` returns an unexpected key or a 500, is the plan "failed" or "needs fixing before the FE plan"? The task should state an explicit acceptance gate, e.g., "If any endpoint returns a shape inconsistent with the Pydantic response models, the discrepancy must be resolved and the relevant task(s) re-verified before proceeding."

### [Low] `normalize_apollo_record` has no validation of the `raw` input type

**Location:** Task 3, `normalize.py`, line 497 (`def normalize_apollo_record(raw: Dict[str, Any])`)

The function annotations say `Dict[str, Any]` but the body accesses `raw.get(...)` and `raw["id"]` without verifying `raw` is actually a dict. If Apollo returns an unexpected type (e.g., `None` for a contact entry), `raw.get("organization")` on `None` would raise `AttributeError`. The function handles `org` not being a dict (line 505–506) but doesn't guard against `raw` itself being `None` or a list. A one-line guard (`if not isinstance(raw, dict): raw = {}`) at the top would prevent a mysterious background-task crash.

### [Nit] Task 3's `__init__.py` content is shown as ` ```python\n ``` ` (empty code block)

**Location:** Task 3, Step 3, line 412

The empty `__init__.py` is represented as a code block with no content, which is correct (empty file). Minor: the plan could simply say "Create as an empty file" without the code block for clarity.

### [Nit] Commit message style inconsistency — one omits scope

**Location:** Task 13, Step 3, line 2831 (`"test(be): green full suite after apollo connector"`)

Task 13's conditional commit message includes the `test(be):` scope prefix, which is consistent. All other commit messages also follow the `type(be):` convention. No actual inconsistency found on closer inspection — all 14 tasks use the correct format.

### [Nit] Module map table includes `_ensure_connectors_indexes` on both `credentials.py` and `__init__.py` rows

**Location:** Module map table, lines 52 and 55

The table correctly notes that `credentials.py` defines `_ensure_connectors_indexes` and `__init__.py` re-exports it. This is the house pattern and is correct — just noting the duplication is intentional.
