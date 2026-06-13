---
artifact: plans/35a-apollo-discovery-backend.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-12
round: 1
---

## Findings

### Critical — Task 13 depends on model `ApolloDiscoverRequest` defined in Task 16 (forward dependency)

**Location:** Task 13 Step 1 (line ~1498) imports `ApolloDiscoverRequest` from `app.models.connectors`. Task 16 (line ~1913) defines it.

Task 13's test creates `ApolloDiscoverRequest(org_id="org1", user_id="u1", mode="keep")` and Task 13's implementation accepts `request: "ApolloDiscoverRequest"` (forward-reference string). Neither will execute until Task 16 ships the model. Task 15's status test similarly imports `ApolloDiscoverRequest`. **Task 16 must be moved before Task 13**, or the model definitions must be split out into an earlier task. As written, an agent executing linearly will hit an `ImportError` at Task 13 and block.

### Critical — Test code references undefined helpers across task boundaries

**Location:** Tasks 12–14 (lines ~1415, ~1498, ~1598)

Multiple test fixtures and helpers are used without definition:

- **`_FakeBT()`** (Task 13, line ~1507) — a fake `BackgroundTasks` used in two tests, never defined. The implementer must infer its interface (`tasks` list attribute, `add_task` method).
- **`_complete_icp_dict()`** (Tasks 12–14, lines ~1418, ~1505, ~1624) — referenced as "add a small local helper returning a complete ICP, like Task 7's `_complete_icp`." But Task 7's `_complete_icp()` is a local function in `test_connectors_warmup.py`, not importable. Each test file needs its own copy, and the plan provides no code for it.
- **`patched` fixture** (Task 12, line ~1415) — used as a test parameter but never defined.
- **`apollo_mod`** (Task 12, line ~1416, and throughout) — used as `orchestrator.apollo_mod` and `monkeypatch.setattr(apollo_mod, ...)`. The plan never shows the import/alias that makes this available.

An agent executing linearly will hit `NameError` on each of these.

### High — Task 14 LLM seam includes dead placeholder code that risks being committed literally

**Location:** Task 14 Step 3 (lines ~1702–1704)

The implementation snippet contains:
```python
llm = mongo  # placeholder replaced below
from app.core.dependencies import _llm_singleton  # not real — see note
```

The prose note (line ~1776) says to "delete the two placeholder lines" and use a parameter approach instead. But the **code block itself** — which is what an agent will paste — contains the dead code. An agent executing literally will commit `from app.core.dependencies import _llm_singleton` (which doesn't exist) and `llm = mongo` (which is semantically wrong). The correct implementation should be provided directly in the snippet, not as a cleanup instruction in a note.

### High — No kill criteria or abort conditions stated anywhere in the plan

**Location:** Plan-wide absence.

The plan has 19 tasks and no section on when to stop. Under what conditions should the implementer halt and escalate? For example: if Apollo's `api_search` param names differ materially (the "open item" deferred to Task 19 Step 3), if the `fake_mongo`/`fake_driver` fixtures don't exist in the expected form, if the prompt registry doesn't discover `prompts/connectors/`, or if the `_run_discover` background task can't access the LLM. Each of these has a right answer, but the plan offers no guidance on when to ask vs. guess. A single "if a task fails after two implementation attempts, report to human and wait" rule would suffice.

### High — Missing `ApolloSearchError` from spec §5.10

**Location:** Task 1 (line ~47); spec §5.10 (line ~247 of spec).

Spec §5.10 explicitly lists: *"New exceptions reusing the connector mapping: `ProfileIncompleteError → 409`, `ApolloSearchError → 502` (search-specific transport failures)."* Task 1 defines four exceptions (`ProfileIncompleteError`, `DiscoveryInProgressError`, `IcpUnderspecifiedError`, `MasterKeyRequiredError`) but omits `ApolloSearchError`. This is a spec coverage gap.

### High — No regression testing between tasks

**Location:** Plan-wide; only Task 19 (line ~2253) runs the full suite.

Each task runs only its own new tests. The plan never instructs the agent to re-run the existing connector test suite after modifying `orchestrator.py`, `ingestion.py`, `runs.py`, `apollo.py`, or `normalize.py`. Tasks 5, 12, 14, and 15 modify existing files with existing tests. A silent regression in `upsert_imported_leads` (Task 5) or `connect_apollo` (Task 12) would not surface until Task 19 — 14 tasks later. Adding "run existing tests for the modified file" to the verification step of each task would close this.

### Medium — Missing `person_seniorities` mapping in `build_search_filters`

**Location:** Task 9 Step 3 (line ~1102); spec §5.2 (line ~132 of spec).

Spec §5.2 says: *"person_titles/person_seniorities ← buyer_role[]"*. The plan's `build_search_filters` maps `buyer_role` only to `person_titles`. If `buyer_role` values include seniority-level terms (e.g., "Director", "C-Level"), they would be missed as `person_seniorities`. Either the plan should split the mapping or document why seniority is omitted.

### Medium — `fail_stale_discovery_runs` return value unused — superseded tags not cleared at discover-time

**Location:** Task 13 Step 3 (line ~1550); spec §5.7 (line ~220 of spec).

Spec §5.7 states orphan-tag cleanup happens *"on app startup and at the top of each `POST /discover`"*. Task 13 calls `runs.fail_stale_discovery_runs(mongo, request.org_id)` which returns the failed run doc (the function signature at line ~725 returns `Optional[Dict[str, Any]]`), but the caller discards the return value. A stale `replace` run that was killed mid-swap would have its run marked `failed` but its `superseded` tags would persist until the next app restart. The fix is: if `fail_stale_discovery_runs` returns a run with `mode == "replace"`, call `clear_superseded_discovery_leads`.

### Medium — Task 5 (ingestion) mixes four concerns in a single task

**Location:** Task 5 (line ~400).

Task 5 adds: (a) `apollo_origin`/`discovery_run_id` on upsert, (b) superseded tag/clear/delete helpers, (c) a dedup-pool reader, (d) an export reader. Each is a distinct scope with distinct test cases. Splitting into two tasks — "discovery fields on upsert" and "superseded + read helpers" — would improve reviewability and reduce the blast radius of a mid-task failure.

### Medium — Task 15 mixes five concerns

**Location:** Task 15 (line ~1792).

Task 15 adds: (a) extended status with credit/ICP-change fields, (b) discovery-status reader, (c) export function, (d) `credentials.set_low_credit`, (e) new status test + new credentials test. Each is independent. `set_low_credit` is a one-liner that could be its own task; the status extension and export are separate concerns.

### Medium — Missing `REVEAL_RATE_DELAY` / inter-reveal delay

**Location:** Task 14 (line ~1708); spec §5.2 config table (line ~150 of spec).

Spec §5.2 lists `REVEAL_RATE_DELAY` as a config constant: *"inter-reveal delay to respect Apollo enrichment rate limits."* The plan defines `SEARCH_SCAN_CAP`, `MAX_LEADS_DEFAULT`, `MAX_LEADS_HARD_CAP` (Task 13, line ~1568) but omits `REVEAL_RATE_DELAY`. The reveal loop in Task 14 has no `sleep` between sequential `match_person` calls. The existing Apollo connector has `_sleep` for 429 backoff, but no proactive rate-limiting between reveals. With `max_leads=50`, this could hit Apollo rate limits and cascade into 429 backoff loops.

### Low — No geo/location scoring in `score_icp_fit`

**Location:** Task 10 Step 3 (line ~1237); spec §5.2 step 3 (line ~136 of spec).

Spec §5.2 mentions *"geo match"* as a scoring component alongside title, industry, and size. The plan's `score_icp_fit` weights are title 0.4, industry 0.4, size 0.2 — no geo component. Minor because the `person_locations` filter in `build_search_filters` pre-filters by location, but the scoring doesn't reward candidates whose location better matches the ICP's region/locations.

### Low — `_records_to_dicts` helper used but not defined

**Location:** Task 5 Step 3 (line ~504), `get_discovery_leads` calls `_records_to_dicts(rows)`.

This helper is not defined in the Task 5 snippet. It presumably exists elsewhere in `ingestion.py` (the file already has `_records_to_dicts` from prior work), but the plan should confirm this rather than assuming.

### Low — Plan fully serial despite parallelizable tasks

**Location:** Plan-wide.

Tasks 1 (exceptions), 2 (search_people), 3 (match_person), 4 (normalize), 6 (runs), and 7 (warmup) are all independent. They could execute in parallel, reducing wall-clock time significantly. The plan's header references `subagent-driven-development` but doesn't identify the parallelization opportunity. Not blocking, but a missed speed gain.

### Nit — `sweep_orphan_superseded` uses `distinct()` on potentially large collection

**Location:** Task 17 Step 4 (line ~2153).

`mongo["Profiler"][runs.DISCOVERY_RUNS_COLLECTION].distinct("org_id")` returns all distinct org_ids. At MVP scale this is fine, but `distinct()` on an unbounded collection without a query filter is an anti-pattern. Consider adding a filter for `status: { $in: ["queued", "processing"] }` or limiting to recently-updated runs.

### Nit — `DiscoveryCounts` model uses `List[Any]` for `errors` field

**Location:** Task 16 Step 3 (line ~1979).

`errors: List[Any] = []` — the spec §5.3 says errors holds `[{stage, message}]` objects. A typed `List[Dict[str, str]]` or a small `DiscoveryError` model would be more precise. At MVP this is acceptable but worth noting.

### Nit — SHA-1 used for fingerprinting (correct, but worth documenting the choice)

**Location:** Task 9 Step 3 (line ~1096).

The plan uses `hashlib.sha1` for `icp_fingerprint`. The spec §5.7 explicitly notes this is "used as a plain hash, not for security." The plan doesn't repeat this justification. Minor — the choice is correct per spec — but a one-line comment would prevent a future reviewer from flagging it.
