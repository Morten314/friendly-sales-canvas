---
synthesizes_review: docs/reviews/11-backend-flat-service-decomposition-phase-k-design-spec-review-2.md
artifact: specs/11-backend-flat-service-decomposition-phase-k-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-25
round: 2
---

## Round Recommendation

no

Reason: No Critical or High findings remain. The Medium finding is a small factual correction to a prose sentence in §5; the Low/Nit items are documentation polish. None opens new design surface that would warrant another review round.

## Agreed Findings

- **Medium 1 — §5 falsely claims signals patches exist.** Verified: `grep mocker.patch.*get_leads_for_org backend/tests/` returns 4 hits all in `test_market_scoring.py` (lines 53, 81, 295, 324); zero in `test_signals.py`. Revising the §5 closing paragraph to mention only `test_market_scoring` and drop the `signals` claim.

- **Low 2 — §6.3 submodule-bypass grep misses two patterns.** Agree — the current grep catches `from app.services.X.Y import Z` but not `from app.services.X import Y` (submodule-object import) or `import app.services.X.Y`. Adding a second grep line to §6.3 that catches these alternative bypass patterns.

- **Low 3 — `services/health.py` test gap not flagged.** Agree — the spec currently says "no test suite for `probe_llm`" without explicitly accepting this as tech debt. Adding a one-line note to §3 Sequence F that this is intentional MVP scope (debug-only smoke probe with no business logic).

- **Low 4 — "Option A" reference has no alternatives discussion.** Agree — the spec uses "Option A" as a label without explaining what was rejected. Adding a one-sentence note to §2 describing the alternative (single atomic commit decomposing all six in one go) and why Option A was chosen (per-sequence rollback granularity, smaller per-commit blast radius).

- **Nit 5 — Pre-flight grep doesn't filter to `.py`.** Reversing the round-1 deferral on this one. The fix is trivial (`--include='*.py'`) and the reviewer raising it twice signals it's worth doing rather than carrying as ongoing noise.

- **Nit 6 — Sequence E circular-import check uses self-referencing arrow.** Agree — `prospect_pipeline.py → prospect_pipeline.py` reads like a copy-paste error even with the parenthetical. Rephrasing to "No cross-submodule calls within Sequence E; `score_prospect` calls `extract_number`, both within `prospect_pipeline.py`."

## Disagreed Findings

(None.)

## Deferred Findings

- **Nit 7 — TD-008 phase-label drift in `docs/TECH_DEBT.md`.** Agree the parenthetical in TD-008's pull-forward trigger is stale (Phase J was lazy-imports, not flat-service decomposition; Phase K is what TD-008 was waiting on). This is correctly identified as a TECH_DEBT.md issue, not a Phase K spec issue. Deferred from this synthesis — should be fixed in a separate TECH_DEBT.md update, ideally as part of the Phase K implementation commits or shortly after Phase K lands. Trigger to revisit: when TECH_DEBT.md is next opened for editing.

## Severity Disagreements

(None.)

## Open Questions

(None.)
