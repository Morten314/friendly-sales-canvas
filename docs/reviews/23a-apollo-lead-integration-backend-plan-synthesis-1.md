---
synthesizes_review: docs/reviews/23a-apollo-lead-integration-backend-plan-review-1.md
artifact: plans/23a-apollo-lead-integration-backend.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-05-29
round: 1
---

## Round Recommendation

no

Reason: The one genuine High (F2 — `zip` match-alignment miswrite) is resolved in-plan with a length-mismatch write-guard plus a required pre-implementation alignment confirmation; everything else is a contained decoupling, process/clarity additions, or Low/Nit. No finding is disagreed-but-real, deferred-but-load-bearing, or opens new design surface needing re-review.

## Agreed Findings

- **F2 (High) — enrichment `zip` alignment is a data-miswrite risk.** Revise Task 8 `_run_enrich`: add a hard guard — `if len(matches) != len(chunk)`, treat the whole chunk as **unmatched** and record an error (never positional-zip onto mismatched counts). Elevate the bulk_match order-alignment check from a Self-review "open item" to a **required Task-8 pre-step** with an explicit contingency: if Apollo does not return request-order, slot-per-input results, switch from positional `zip` to a keyed lookup before relying on it. This removes the wrong-lead write under the most likely failure (count mismatch / omitted slots) and forces the ordering assumption to be confirmed, not assumed.
- **F1 (High→Medium) — no global abort/escalation criteria.** Add an "Execution discipline & abort" subsection to Conventions: if the Apollo API surface (endpoints/auth header/response shapes) is materially incompatible with the assumed contract, **stop and escalate before Tasks 5–14**; likewise if Task 5's UNWIND Cypher hits a Neo4j version incompatibility.
- **F3 (High→Medium) — no regression run between tasks.** Add a Conventions rule: after each task's new-test step passes, run the full `python -m pytest -q` **before committing** (cheap against mocks; surfaces a break in Task 5/11/12 immediately rather than at Task 13).
- **F4 (Medium) — cross-package private import.** Revise Task 5: inline a small private deserializer (`_records_to_dicts`, ~12 lines) in `ingestion.py` instead of importing `leads.normalization._process_neo4j_lead_records` (explicitly marked private / not-re-exported in `leads/__init__.py`). Eliminates the silent cross-package coupling; minor duplication is the lesser evil for package independence.
- **F5 (Medium→Low) — incomplete spec-deviation accounting.** Replace Task 12's partial note with one consolidated "Deviations from spec §12.1" list covering all four edited existing files: `exceptions.py` (append leaves), `main.py` (`include_router` **and** the lifespan index call — itself beyond §12.1's "one-line" claim), `models/leads.py`, `services/leads/persistence.py`. All additive/backward-compatible.
- **F6 (Medium) — no mid-task failure recovery path.** Fold into the F1 "Execution discipline & abort" subsection: if any step fails in a way the plan doesn't predict (e.g. new test passes but an unrelated import breaks), stop and report rather than improvise.
- **F9 (Low) — fragile Cypher substring-matching in `FakeTx`.** Tag each Cypher constant in `ingestion.py` with a stable block-comment marker (e.g. `/* connector:import-update */`, `/* connector:import-create */`, `/* connector:enrich-update */`) and match tests on the marker, not free-form substrings. Self-documents the templates too.
- **F11 (Low) — Task 14 has no acceptance gate.** Add: if any endpoint returns a shape inconsistent with its Pydantic response model, the discrepancy must be resolved and the relevant task(s) re-verified before proceeding (and before the deferred FE plan is authored).
- **F12 (Low) — `normalize_apollo_record` doesn't guard `raw` type.** Add `if not isinstance(raw, dict): raw = {}` at the top + a test case for a `None`/non-dict row (prevents a mystery background-task `AttributeError` on a malformed Apollo entry).
- **F13 (Nit) — empty `__init__.py` shown as an empty code block.** Tidy Task 3 Step 3 wording to "create an empty file" without the empty fenced block.

## Disagreed Findings

- **F14 (Nit) — commit-message scope.** No action: the reviewer self-resolved this on closer inspection ("No actual inconsistency found"). All 14 commits use `type(be):`.
- **F15 (Nit) — `_ensure_connectors_indexes` on two module-map rows.** No action: the reviewer confirms this is the intentional house pattern (define in `credentials.py`, re-export in `__init__.py`), exactly as in `leads/` and `market_scoring/`.

## Deferred Findings

(none)

## Severity Disagreements

- **F1 — agree finding, Medium not High.** Missing abort guidance is a process gap, not a correctness defect; every task is independently verifiable and the Apollo-surface uncertainty is already captured as a Self-review open item. Worth adding now (hence Agreed), but not High.
- **F3 — agree finding, Medium not High.** Late-surfacing breakage is a slowdown, not a correctness hole — Task 13's full-suite run is a backstop. Per-task regression runs are cheap insurance worth adopting, but the risk ceiling is bounded.
- **F7 — agree finding, Low not Medium.** The `hasattr` wiring test is weak, but a true lifespan-invocation test is **harness-constrained**: under `BREWRA_SKIP_DB_INIT` (set by conftest) `build_clients` returns `client=None`, so the lifespan's `if app.state.clients.client is not None:` block — which contains the index call — is skipped entirely. Resolution: strengthen the assertion to an identity check (`app.main._ensure_connectors_indexes is credentials._ensure_connectors_indexes`, catching a stray/forgotten import) and document the harness limitation. A full lifespan-driven test is low payoff for the added fixture complexity.
- **F8 — agree finding, Low not Medium.** Serialized ordering is correct and safe; parallel waves are an execution-speed optimization, not a plan defect. Resolution: add a "Dependency graph / parallelization waves" annotation (Wave 1: Tasks 1,2,3 · Wave 2: Tasks 4,5,6,7 · then 8 → 9 → 10 → 11 → 12 → 13 → 14) as guidance for subagent-driven execution, keeping the serial list as canonical.

## Open Questions

- **F2 residual (carried as a required impl pre-step, not a re-review item):** Apollo `/people/bulk_match` result ordering must be confirmed empirically against a recorded fixture. The added length-guard prevents miswrites on count mismatch, but same-count-reordered results would still misalign — the Task-8 pre-step must confirm request-order/slot-per-input or switch to keyed lookup before write.
- **F4 alternative:** inlining the deserializer (chosen) vs. promoting a public `get_leads_by_ids` into the leads package. Chose inline for connector self-containment; revisit if the leads package later needs the same by-ids read (then extract a shared public reader).
- **F10 (clarification, not a change):** Task 10 keeps its manual `dependency_overrides` (plain `object()` driver/mongo) deliberately — the router tests stub the service layer (`connectors_service.<fn>`) and never touch driver/mongo, so the conftest `mock_neo4j`/`mock_mongo` MagicMocks add nothing. A one-line note will record this rather than switch fixtures.
