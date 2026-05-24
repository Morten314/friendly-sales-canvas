---
synthesizes_review: docs/reviews/refactor-backend-service-decomposition-phase-h-impl-review-2.md
artifact: refactor-backend-service-decomposition-phase-h
artifact_type: impl
reactor_model: claude-opus-4-7
date: 2026-05-24
round: 2
---

## Round Recommendation

no

Reason: Two Mediums are agreed and are simple bloat removals (drop 5 unused re-exports + update 2 test files); all other findings are spec-excluded Lows or explicitly-non-actionable Nits.

## Agreed Findings

- **[Medium] data_sources/__init__.py re-exports 3 internal helpers** — Remove `load_document`, `grapher`, `process_prospect_list` from the package's re-exports and `__all__`; update `backend/tests/unit/test_data_sources.py` top-level imports to pull these from `app.services.data_sources.loaders` directly. Verified callers: only that one test file imports them via the package path (`mocker.patch(...)` already uses the submodule path).
- **[Medium] market_scoring/__init__.py re-exports 2 internal helpers** — Remove `get_market_reports_for_org` and `score_single_lead_against_market` from the package's re-exports and `__all__`; update `backend/tests/unit/test_market_scoring.py` top-level imports to pull these from `app.services.market_scoring.orchestrator` directly. Verified callers: only that test file (the router uses 3 different symbols; `scoring.py` already accesses them via `orchestrator.X(...)` namespace prefix). Update `market_scoring/__init__.py` docstring to drop the two stale entries.

## Disagreed Findings

- **[Low] ICP_FUNCTIONS / COMPONENT_FUNCTIONS dispatch dicts in orchestrator** — The reviewer's own conclusion is "No issue right now"; this is an observation about future-refactor cost, not an actionable finding. The dicts live in `orchestrator.py` because they reference worker functions by name — that *is* their correct home per the spec's "patch where it's used" discipline. No action.

## Deferred Findings

- **[Low] Lazy circular import in market_scoring/scoring.py → orchestrator** — Defer: the spec considered structural decomposition of the orchestrator/scoring/persistence triangle out of Phase H scope. Trigger to revisit: any future refactor that moves `score_single_lead_against_market`, `_persist_market_score_for_lead`, or `get_market_reports_for_org` to a different submodule — at that point the lazy import should go away naturally. Docstring already documents the cycle.
- **[Low] Duplicated JSON-parsing pattern across signals/icp/market_research parsing.py** — Defer: spec §2.2 explicitly excluded consolidating LLM-output helpers into a shared `_llm_helpers.py` for Phase H. Trigger to revisit: a future "extract shared LLM utilities" pass (would naturally cover the three `_*_agent_output` helpers and the three JSON-cleanup blocks together).
- **[Nit] data_sources/ imports still reference app.models.documents** — Defer: reviewer explicitly says "No action needed." The Pydantic models legitimately describe document-shaped uploads; the service rename was about disambiguating from project documentation, not about the data model itself. Trigger: a future models-layer reorganization, not Phase H.
- **[Nit] TD-006 closure-note date 2026-05-24 vs spec date 2026-05-23** — Reviewer explicitly says "this is fine." The closure note correctly records execution date, not spec-authoring date. No action.
- **[Nit] signals/orchestrator.py at 744 LOC** — Reviewer explicitly says "Not a bug." Spec §6 dropped the ~400 LOC/submodule ceiling; the residual is large because `search_signals`, `signal_ask`, `signal_ask_claude`, `_generate_signals_batch_impl`, and `fetch_signals` each contain substantial inline data-munging logic that isn't separable into prompts/llm/parsing/persistence layers. Trigger: a future "decompose long functions" pass orthogonal to the package-extraction work of Phase H.

## Severity Disagreements

N/A — agreed Mediums genuinely warrant Medium (public-surface drift from spec); other findings' severities are accepted.

## Open Questions

- After the two Medium fixes, the cumulative public-surface enforcement on `__init__.py` files becomes worth a single test (e.g., a `test_public_surface.py` that asserts `set(service.__all__) == set(spec_§3.x_listed_symbols)`). Worth opening as a follow-up tech-debt item? Out of scope for this synthesis but flagging for operator decision.
