---
artifact: feat/apollo-lead-integration-backend
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Branch `feat/apollo-lead-integration-backend` on worktree `wt-apollo23a`. 16 commits (2 docs, 14 implementation) adding ~5.6k LOC across 33 files. Spec at `specs/23-apollo-lead-integration-design.md`, plan at `plans/23a-apollo-lead-integration-backend.md`. No test runner available in the worktree (no venv/pytest) — findings are based on code reading only.

## Findings

### [Medium] Stale-run failover only auto-fails "queued" runs, not stuck "processing" runs

**Location:** `backend/app/services/connectors/runs.py:110-118` (`_is_stale_queued_run`) and `runs.py:167-185` (`fail_stale_enrich_runs`)

`fail_stale_enrich_runs` queries for runs with `status: {"$in": ["queued", "processing"]}` (line 171) but `_is_stale_queued_run` immediately returns `False` for anything not status `"queued"` (line 111). A run stuck in `"processing"` after a process crash will never be auto-failed. The docstring on `fail_stale_enrich_runs` says "Mark a stale queued/processing run" — the code contradicts its own docstring. The spec (§5.5, §8) explicitly says "stale queued/processing runs are failed by the next run."

**Fix:** Extend `_is_stale_queued_run` to also consider `"processing"` runs stale when they have a `started_at` timestamp older than `_STALE_AFTER_SECONDS` (or an `updated_at` that has stalled).

### [Medium] Enrich task silently drops non-existent leads — completed run shows <100% progress with no explanation

**Location:** `backend/app/services/connectors/orchestrator.py:175` (`_run_enrich`) and `runs.py:196-199` (`get_enrich_run` progress_percent)

`_run_enrich` calls `ingestion.get_leads_by_ids(driver, org_id, lead_ids)` which only returns leads that exist in Neo4j. If a lead was deleted between selection and processing, it silently disappears. The run's `total` (set at creation from `len(request.lead_ids)`) will exceed `processed + unmatched + failed`. The run ends `"completed"` with `progress_percent < 100%` and no error explaining the gap. To a frontend user, a "completed" run at 75% looks broken.

**Fix:** After loading leads, count missing = `len(lead_ids) - len(leads)` and either (a) add them to `failed` with an error like `"Lead <id> not found in org"`, or (b) add a `skipped` counter surfaced in the response.

### [Low] `_build_match_entry` can return an empty dict, burning an Apollo credit on a guaranteed-no-match

**Location:** `backend/app/services/connectors/orchestrator.py:154-167`

If a lead has no `apollo_contact_id`, no `email`, no `first_name`/`last_name`, no `company_name`, and no `company_domain`, the function returns `{}`. This empty dict is sent to `bulk_match`, which counts it as an entry and consumes a credit, but Apollo will never match it. The orchestrator correctly counts it as `unmatched`, so there's no data corruption — just wasted credits.

**Fix:** Skip leads with empty match entries (count them as `unmatched` before calling `bulk_match`).

### [Low] Plan deviation: `_run_import` label-resolution catches bare `Exception` where plan specified `BrewraError`

**Location:** `backend/app/services/connectors/orchestrator.py:97-98`

The plan (Task 8) specifies `except BrewraError as e:` for the cosmetic list-name lookup. The implementation uses `except Exception as e:`. A regression test (`test_run_import_label_lookup_network_error_does_not_fail_batch`) explicitly validates this broader catch against `RuntimeError`, confirming the deviation was intentional. While more defensive, this swallows unexpected exceptions (e.g., a bug in `list_collections`) at `logger.warning` level rather than letting them surface. Acceptable for MVP, but the broader catch should be narrowed back to `BrewraError` once the connector is stable.

### [Low] `_now()` helper duplicated identically across four modules

**Location:** `ingestion.py:98`, `credentials.py:19`, `runs.py:22`, `orchestrator.py:33`

The same `def _now() -> str: return datetime.now(timezone.utc).isoformat()` is copy-pasted into all four modules. Per the repo's polyglot conventions (no cross-package private imports), this is deliberate and each module is independently testable. However, `_now()` is a pure utility that could live in `normalize.py` (already the designated pure module) and be imported without creating a circular dependency — the other three modules already import from normalize for `CANONICAL_FIELDS`.

### [Nit] Test helper duplication — `FakeCollection` / `FakeMongo` defined separately in credentials and runs tests

**Location:** `tests/unit/test_connectors_credentials.py:9-58`, `tests/unit/test_connectors_runs.py:9-56`

Both files define nearly identical fake Mongo helpers. The runs version adds `sort` support and `$in` handling. Could be shared via a `tests/unit/conftest.py` or a `tests/helpers.py`, but the duplication is small and each version has slightly different capabilities. Not blocking.
