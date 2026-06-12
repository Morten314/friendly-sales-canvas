---
artifact: plans/35a-apollo-discovery-backend.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-12
round: 2
---

## Context

Round 1 identified 17 findings across Critical–Nit. The plan was substantially revised: Task 1b split out to resolve the forward dependency, kill criteria and regression rules added, LLM placeholder code replaced with parameter threading, `ApolloSearchError` added, `REVEAL_RATE_DELAY` added, geo scoring included, parallelizable set identified, and `_complete_icp_dict()` test helper provided with code. This round examines the revised plan and the spec (`specs/35-apollo-discovery-design.md`) for remaining issues. All round-1 items were verified as addressed or explicitly documented-divergence; none are repeated here.

## Findings

### High — Partial-run credit-exhaustion path records stale pre-ingest counts

**Location:** Task 14 Step 3, `_run_discover` inner `except ApolloCreditsExhaustedError` (lines 1912–1918)

When credits are exhausted mid-reveal, the code calls `runs.complete_discovery_run(..., status="partial")` **before** `_ingest_discovery`. After ingest, `_ingest_discovery` mutates the shared `counts` dict (lines 1970–1972: `counts["created"] += result["created"]`, `counts["matched"] += result["matched"]`). But `complete_discovery_run` was already called with the pre-ingest counts where `created == 0` and `matched == 0`. The run doc permanently records zero created/matched despite leads being ingested.

The success path (lines 1932–1941) is correct — it ingests first, then calls `complete_discovery_run` with updated counts. The partial path should match this ordering: ingest → update run doc.

### High — `ApolloCreditsExhaustedError` caught but missing from orchestrator import block

**Location:** Task 12 Step 3 import block (lines 1633–1639) vs. Task 14 `_run_discover` except clauses (lines 1912, 1948)

`ApolloCreditsExhaustedError` is caught at two points in `_run_discover` but the Task 12 import block does not include it:

```python
from app.core.exceptions import (
    ProfileIncompleteError, MasterKeyRequiredError, DiscoveryInProgressError,
    ApolloAPIError, ConnectorCredentialsInvalidError, ConnectorNotConnectedError, BrewraError,
)
```

If this exception lives in `app.core.exceptions` (alongside the others), it needs adding here. If it lives in `apollo.py` (the existing connector module), it needs a separate import or a qualified reference like `apollo_mod.ApolloCreditsExhaustedError`. The existing orchestrator may already import it from the enrich flow, but the plan's snippet is the contract an agent will paste — an agent executing Task 12's import replacement will drop it.

### High — Outer `ApolloCreditsExhaustedError` handler is unreachable dead code

**Location:** Task 14 Step 3, lines 1948–1952

The outer `except ApolloCreditsExhaustedError` handler at line 1948 can never fire. The only code path that raises `ApolloCreditsExhaustedError` is `connector.match_person(...)` inside the reveal loop (line 1911), and that call is wrapped by the inner `except ApolloCreditsExhaustedError` at line 1912 which returns immediately. No other statement in the outer try block raises this exception (`search_people` does not raise it per Task 2).

Dead code is not harmful, but it's misleading: an agent or reviewer might reason about its behavior (e.g., "the outer handler clears superseded tags on credit exhaustion") when in fact credit exhaustion is always handled by the inner handler, which does NOT clear superseded tags (it deletes them on success, line 1917). Remove the outer handler or merge its logic into the inner one.

### Medium — `normalize_apollo_record` called bare without shown import

**Location:** Task 14 Step 3, line 1927

`rec = normalize_apollo_record(person)` is called as a bare function name. The orchestrator may already import this from the enrich flow, but the plan's Task 12 import additions don't include it. An agent applying Task 12's import block literally would lose it. Either add it to the import block or show the qualified reference (e.g., `normalize.normalize_apollo_record`).

### Medium — `format` parameter shadows Python builtin

**Location:** Task 17 Step 3, line 2331

```python
async def apollo_leads_export(
    org_id: str = Query(...),
    format: str = Query("json"),
    ...
```

`format` shadows the Python builtin. Not a runtime bug (FastAPI resolves it by parameter name), but it will trigger linter warnings and can cause confusion if any code in the function body uses `format()` as the builtin. The service function already uses `fmt` as the parameter name (line 2083); rename the route parameter to match.

### Medium — `_profiler_analyzed` gives false positive for empty `suggestedICPs` array

**Location:** Task 8 Step 3, `_profiler_analyzed` (lines 1126–1128)

```python
def _profiler_analyzed(mongo, org_id: str, user_id: str) -> bool:
    doc = mongo["Profiler"]["ICP_config"].find_one({"user_id": user_id})
    return bool(doc and doc.get("icps"))
```

If `icps` is `{"suggestedICPs": []}`, `doc.get("icps")` returns a truthy non-empty dict, so the check reports `True` even when no ICPs have been analyzed. The check should inspect the nested value (e.g., `doc.get("icps", {}).get("suggestedICPs")`). The test fixture (line 1067) seeds a non-empty value so this false positive path is untested. Severity depends on whether the real Mongo documents ever have `{"suggestedICPs": []}` — if the Profiler writes this shape on initial load, the warmup check would report profiler complete prematurely.

### Low — `low_credit` clearing condition diverges from spec wording

**Location:** Task 14 Step 3, line 1940; spec §5.6

The plan clears `low_credit` when `credits > 0` (at least one `match_person` consumed credits). The spec says: *"cleared on the next run that **successfully reveals ≥ 1 lead** without a credit error."* The difference: `credits > 0` counts candidates charged by Apollo, while "reveals ≥ 1 lead" could mean `revealed > 0` (which increments before the quality-gate check at line 1921). In practice these are equivalent because `match_person` returning `credits_consumed > 0` implies a person was returned (Apollo doesn't charge for null matches). Flagging for awareness rather than action.

### Low — `apollo_mod._sleep` repurposed as a general rate-limit delay

**Location:** Task 14 Step 3, line 1909

`apollo_mod._sleep(REVEAL_RATE_DELAY)` uses the existing connector's private `_sleep` function (added for 429 exponential backoff) as a proactive rate-limit delay between reveals. If `_sleep` has backoff-specific semantics (e.g., it tracks retry state, mutates connector state), this is semantically wrong. If it's a plain `time.sleep`, it's fine. The plan doesn't confirm. Using `time.sleep(REVEAL_RATE_DELAY)` directly or adding a dedicated `_throttle` helper would be safer.

### Low — Constants used but not defined in the plan, assumed existing

**Location:** Task 6 (`_MAX_ERRORS`, `_MAX_ERROR_MESSAGE_LEN`, `_parse_iso`, lines 823, 837, 884), Task 14 (`INGEST_CHUNK_SIZE`, line 1968)

These are used in new code but never defined. They presumably exist in the current `runs.py` and `orchestrator.py` from the enrich flow. Not a blocker — an agent executing in context would have them — but an agent starting from a fresh context or regenerating the file from the plan would hit `NameError`.

### Nit — Unused captured exception `e` in dead outer handler

**Location:** Task 14 Step 3, line 1948

```python
except ApolloCreditsExhaustedError as e:
```

The variable `e` is never used in the handler body. If the handler is removed per the dead-code finding above, this resolves itself. Otherwise, drop the `as e`.
