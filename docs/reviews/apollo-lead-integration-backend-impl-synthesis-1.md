---
synthesizes_review: docs/reviews/apollo-lead-integration-backend-impl-review-1.md
artifact: feat/apollo-lead-integration-backend
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-05-29
round: 1
---

## Round Recommendation

no

Reason: No Critical/High findings. The two Mediums are spec-/reporting-correctness gaps fixable with small in-place changes (no new design surface); the rest are Low/Nit, one disagreed (reverting it would reintroduce a defect already fixed in execution), two deferred polish items.

## Agreed Findings

- **F1 (Medium) — stale failover ignores stuck `processing` runs (`runs.py`).** Verified: the spec (§5.5/§8: "a new run marks an abandoned **queued/processing** run failed") and the `fail_stale_enrich_runs` docstring both promise queued **and** processing, but `_is_stale_queued_run` returns `False` for anything not `"queued"`. This is a genuine spec-compliance gap (I had deferred it during execution on the "mirrors `market_scoring`" rationale — that was wrong; the connector spec is authoritative and explicitly names processing). Fix: generalize the staleness check so a `"processing"` run is also stale when its `updated_at` (which a healthy run advances per 10-lead chunk, so a live run is never stomped) is older than `_STALE_AFTER_SECONDS`; keep the queued path as-is. Add a test for the processing-stale branch.
- **F2 (Medium) — enrich run-accounting doesn't reconcile when a selected lead no longer exists (`orchestrator._run_enrich`).** Verified: `total` is set to `len(request.lead_ids)` at `create_enrich_run`, but the loop iterates `ingestion.get_leads_by_ids(...)`, which silently omits deleted/foreign ids; `processed` only counts loaded leads, so a `"completed"` run can report `processed/progress_percent < 100` with no explanation. Fix: after loading, compute `missing = len(lead_ids) - len(leads)` and fold it into `failed` with a capped per-id error (`"Lead <id> not found in org"`) so the counters reconcile to `total`. Add a test.
- **F3 (Low) — `_build_match_entry` can return `{}`, burning an Apollo credit on a guaranteed no-match (`orchestrator`).** Verified: a lead with no `apollo_contact_id`/`email`/name/company yields an empty entry that `bulk_match` still bills. Fix: skip leads whose match entry is empty and count them as `unmatched` before the `bulk_match` call. Add a test.

## Disagreed Findings

- **F4 (Low) — "narrow `except Exception` back to `except BrewraError`" in `_run_import`'s cosmetic list-name lookup.** Disagree with the remediation. The broad catch is the *deliberate fix* applied during execution (commit `69fd7a3`): a transient `requests` network error (e.g. `ConnectionError`) is **not** a `BrewraError`, so narrowing would re-fail an otherwise-successful import over a purely cosmetic filename lookup — re-introducing the Critical defect this code was written to prevent. The step's only purpose is a nicer batch display name; failing the whole import for it is wrong regardless of exception type. A genuine bug in `list_collections` surfaces through the `/connectors/apollo/lists` endpoint, not silently through import. Keeping `except Exception`. (The reviewer rated it Low and already acknowledged the deviation was intentional and acceptable.)

## Deferred Findings

- **F5 (Low) — `_now()` duplicated across `ingestion`/`credentials`/`runs`/`orchestrator`.** Defer. Each connector module is intentionally self-contained (cleaner isolated unit tests), and the duplication is a single trivial one-liner. Consolidating into `normalize.py` (intra-package, no cycle) is valid optional polish. Trigger: if the helper grows beyond one line, or a 5th module needs it.
- **F6 (Nit) — `FakeCollection`/`FakeMongo` defined separately in the credentials and runs tests.** Defer. The two fakes differ in capability (`runs` adds `$in`/`sort`); extracting a shared `tests/unit/conftest.py` fixture is low-value churn now. Trigger: a 3rd test module needing the same fake, at which point extract the superset.

## Severity Disagreements

- **F2 — agree finding, severity is arguably Low not Medium.** The frontend that would render a "completed at 75%" bar is deferred (spec §12.2), and there is no data-integrity risk — only a cosmetic counter gap on the run-doc. Still fixing it because run-accounting should reconcile to `total` regardless of who consumes it, and the fix is cheap.
- **F1 — agree with Medium.** It is a clear spec-compliance violation. Operational impact is bounded (a stuck `processing` run lingers as a ghost but does **not** block new runs — `start_apollo_enrich` does not gate on an existing active run), so it is not High.

## Open Questions

- **Processing stale threshold.** Reuse `_STALE_AFTER_SECONDS` (300s) for the processing branch too? A healthy enrich advances `updated_at` per 10-lead chunk, so 300s without an update is a reliable "stuck" signal — but confirm against staging if very large enrichments with long 429-backoff windows are expected (could warrant a longer processing threshold).
- **F2 fix shape.** Fold missing leads into `failed` (with per-id error) — needs **no** model change — vs. adding a distinct `skipped` counter to the run-doc and `ApolloEnrichStatusResponse` (cleaner semantics, one new field). Proposing the `failed`-fold to avoid a contract change; confirm if a dedicated `skipped` field is preferred.
