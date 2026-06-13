---
artifact: worktree-spec35a-apollo-discovery
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-12
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Findings

### [Medium] `_existing_contact_ids_tx` reads `r.data()` but returns raw Neo4j records

**Location:** `backend/app/services/connectors/ingestion.py:_existing_contact_ids_tx` + `get_existing_apollo_contact_ids`

The tx function returns `[r.data() for r in tx.run(cypher, ...)]`, producing plain dicts. But `get_existing_apollo_contact_ids` then accesses `r.get("cid")` — which works fine on dicts. However, the caller set comprehension filters `r.get("cid")`, and the function's return annotation says `set` but the actual return type is `set[str]`. The concern is that `_existing_contact_ids_tx` is the *only* tx function in the file that calls `.data()` explicitly; all others (`_discovery_leads_tx`, `_read_leads_by_ids_tx`) return raw Neo4j `Record` objects and let `_records_to_dicts` or the caller handle conversion. This inconsistency won't cause a runtime bug (both paths work), but it breaks the pattern established by siblings and makes the module harder to reason about. If a future contributor sees `_discovery_leads_tx` returning raw records and `_existing_contact_ids_tx` returning dicts, they may introduce a double-`.data()` call or a missed conversion.

### [Medium] `passes_hard_dimensions` substring matching on titles produces false positives/negatives

**Location:** `backend/app/services/connectors/discovery.py:passes_hard_dimensions` (line ~106)

The hard-dimension check uses `r in title or title in r` for role matching. This is a bidirectional *substring* check:
- False positive: ICP role `"VP"` would match candidate title `"DevOps Engineer"` (because `"VP"` is a substring of `"DevOps"`).
- False positive: ICP role `"Head of Growth"` would match candidate title `"Head"` (because `"Head"` is a substring of `"Head of Growth"` via `title in r`).
- False negative (less likely): ICP role `"CRO"` won't match candidate title `"Chief Revenue Officer"` — but this is inherent to free-text matching and documented.

For MVP this is acceptable per spec §5.2 ("Exact weights/thresholds are a plan-time decision within this drop contract"), but it should be tracked as a known limitation. The `score_icp_fit` function uses the same pattern, so the scoring is consistently lenient. At low candidate volumes this won't waste significant credits; at scale, a tokenized match would be an improvement.

### [Medium] `connect_apollo` calls `_icps_for_org` twice when no complete ICP exists

**Location:** `backend/app/services/connectors/orchestrator.py:connect_apollo` (lines 47–52)

The function calls `warmup._icps_for_org(mongo, request.org_id)` to build the list for the `any(...)` check, and then — when the check fails — calls it *again* to determine the missing section. This is two identical Mongo reads on the reject path. At MVP scale this is harmless, but it's a trivial de-dup: capture `icps` once and reuse it.

### [Medium] `completed_empty` status when `records` exist but all are matches (no creates)

**Location:** `backend/app/services/connectors/orchestrator.py:_run_discover` (line ~463)

```python
status = "completed" if counts["created"] or counts["matched"] else "completed_empty"
```

The spec says `completed_empty` fires when `created == 0` (§5.3). But the condition here checks `created or matched`. If a run reveals candidates that all match existing leads (counted as `matched`, not `created`), the status will be `completed` — which is correct per the literal spec text ("`completed_empty` fires when `created == 0`"). However, the condition `counts["created"] or counts["matched"]` will be `completed` when matched > 0, and `completed_empty` only when both are zero. This is actually the *right* behavior (matches mean leads landed), but it subtly diverges from the spec's literal "`completed_empty` when `created == 0`" — a run with `matched=5, created=0` returns `completed`, not `completed_empty`. Worth a spec clarification or an inline comment.

### [Low] `DiscoveryCounts.errors` type annotation `List[Dict[str, Any]]` but ingest can append strings before the fix

**Location:** `backend/app/models/connectors.py:DiscoveryCounts`

The model declares `errors: List[Dict[str, Any]] = []` (dicts with `{stage, message}`), and `_ingest_discovery` in orchestrator wraps strings into dicts before appending. But `ingestion.upsert_imported_leads` returns `{"errors": [str, ...]}` — bare strings. If a future code path appends to `counts["errors"]` without the wrapper (the test `test_discover_status_response_validates_with_ingest_errors` was specifically added to catch this regression), the `ApolloDiscoverStatusResponse` Pydantic model would raise a validation error on the route. The current implementation handles this correctly in `_ingest_discovery`, but the contract between `ingestion.upsert_imported_leads` (returns bare strings) and `DiscoveryCounts.errors` (expects dicts) is fragile. A defensive coercion in `update_discovery_progress` or `complete_discovery_run` (wrapping any bare string) would prevent the class of bug the test guards against.

### [Low] `warmup.py` imports `sys` for dynamic function lookup — unnecessarily obscure

**Location:** `backend/app/services/connectors/warmup.py:get_warmup_status` (line ~98)

The function uses `_this_module = sys.modules[__name__]` and `getattr(_this_module, "_" + key)` to resolve check functions dynamically. The plan's version used a static `_CHECK_FNS` dict, which is clearer and more maintainable. The dynamic approach saves one dict definition but adds cognitive overhead and a `sys` import. Not a bug, but the static dict is strictly better for readability and IDE support.

### [Low] `_delete_superseded_tx` Cypher has no space before `DETACH DELETE`

**Location:** `backend/app/services/connectors/ingestion.py:_delete_superseded_tx`

```python
"WHERE l.superseded = true DETACH DELETE l RETURN count(l) AS n",
```

This is valid Cypher (whitespace isn't required between `true` and `DETACH`), but it's visually confusing — looks like `trueDETACH` at a glance. Adding a newline or space before `DETACH DELETE` would improve readability.

### [Nit] Export CSV doesn't escape fields containing commas

**Location:** `backend/app/services/connectors/orchestrator.py:export_discovery_leads`

The `csv.writer` handles quoting per RFC 4180, so fields containing commas will be properly quoted. This is correct — no finding. (Noted during review as a potential concern, verified safe.)

### [Nit] `fake_mongo` fixture extracted to `conftest.py` — good structural improvement

The `fake_mongo` fixture was originally duplicated across individual test files. It's now centralized in `backend/tests/unit/conftest.py`, which is the right call. The `_FakeCollection._flat_match` helper correctly supports `$in` operators needed by `find_one({"status": {"$in": [...]}})`.

### [Nit] Prompt template uses Jinja2 `{{ icp.buyer_role }}` which renders as Python list repr

**Location:** `backend/prompts/connectors/apollo_discovery_rerank.md.j2`

`{{ icp.buyer_role }}` will render as `['VP Sales', 'Head of Growth']` (Python list repr). This is functional for LLM consumption, but `{{ icp.buyer_role | join(', ') }}` would produce cleaner output. Low impact on LLM quality; purely cosmetic.

### [Nit] Test helper `_DiscoFakeConnector` duplicated in orchestrator test file

**Location:** `backend/tests/unit/test_connectors_orchestrator.py`

`_DiscoFakeConnector` is defined once and reused across four tests — good. But `_CreditWall` is defined twice (once for `test_run_discover_partial_credit_wall_ingests_then_records_counts` and once for `test_run_discover_replace_partial_restores_on_credit_wall`) with identical logic. Could be a module-level fixture, but acceptable at this scale.

## Adherence Summary

**Spec adherence:** High. The implementation covers all spec §5 backend requirements:
- Discovery pipeline (search → free funnel → LLM re-rank → reveal → quality gate → ingest) is complete and matches the 7-step design.
- Warmup readiness fans across the four Mongo stores with per-check degradation.
- Connect gate (ICP completeness + master-key probe) is implemented.
- ICP-change detection via `icp_fingerprint` (SHA-1 of canonical JSON) is implemented.
- No-loss replace swap (tag → run → delete on success / clear on failure) is implemented with the startup orphan sweep.
- Credit awareness (reactive `low_credit`, `credits_consumed_total`) is implemented.
- Export (JSON + CSV) is implemented.
- All endpoint routes are wired in `app/routers/connectors.py`.

**Plan adherence:** High. All 19 tasks are executed in order. The implementation follows the plan's file structure, test locations, and commit granularity. Minor divergence: `warmup.py` uses `sys.modules` dynamic lookup instead of the plan's static `_CHECK_FNS` dict — functionally equivalent.

**Acceptance criteria check:**
- AC1: `completed` with `created ≥ 1` or `completed_empty` with counts — implemented.
- AC2: `credits_consumed ≤ revealed ≤ selected ≤ max_leads` — enforced by sequential reveal loop and early exit.
- AC3: `credits_consumed` recorded per run — implemented.
- AC4: Replace never reduces pool below pre-run count — enforced by tag-before-run, delete-only-after-ingest, clear-on-failure.
- AC5: Warmup `unlocked == true` + ICP completeness required — enforced in `start_apollo_discover`.
- AC6: Source filter and unverified badge — frontend scope (plan 35b), backend fields (`email_status`, `apollo_origin`, `source`) are in place.

**Testing:** Comprehensive. 127-line route integration test, 319-line orchestrator unit test (up from ~200), 121-line discovery unit test, 77-line warmup test, 72-line pipeline integration test. Tests cover the happy path, credit-wall partials, replace no-loss swap, empty runs, credential failures, and the ingest-errors-as-dicts regression. Patch-where-used pattern is consistently applied.
