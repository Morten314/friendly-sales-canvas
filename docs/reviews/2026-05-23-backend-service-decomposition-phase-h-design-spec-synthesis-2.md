---
synthesizes_review: docs/reviews/2026-05-23-backend-service-decomposition-phase-h-design-spec-review-2.md
artifact: specs/2026-05-23-backend-service-decomposition-phase-h-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-23
round: 2
---

## Round Recommendation

**no**

Reason: All Critical and High findings verified against the codebase and agreed; revisions are concrete table additions, grep broadenings, and one removed conditional. The one Medium disagreement is defended on substantive grounds (existing test coverage adequately exercises the lazy-import paths). No new design surface opened by the revisions.

## Agreed Findings

- **[Critical] §3.7 omits `_reserve_unique_icp_id` and `_release_icp_id`.** Verified — `customer_profile.py` lazy-imports `_reserve_unique_icp_id` at lines 20, 139, 217 and `_release_icp_id` at line 354, all inside function bodies. Add both rows to the §3.7 exception table with caller `app/services/customer_profile.py` and reason "atomic ID-reservation/release helpers shared with customer-profile service."

- **[High] §3.7 omits `_get_latest_market_score_rows`.** Verified — `tests/unit/test_market_scoring.py:372` imports it directly. Add row to §3.7 table with caller `tests/unit/test_market_scoring.py` and reason "direct unit test of pagination contract."

- **[High] §3.7 misidentifies `_run_market_scoring_for_org`'s external caller.** Verified — `routers/market_scoring.py:14` uses `from app.services import market_scoring as market_scoring_service` (module-level reference, not a direct `_run_market_scoring_for_org` import). The intra-module `background_tasks.add_task(_run_market_scoring_for_org, ...)` becomes an intra-package call after decomposition. The actual external importer is `tests/unit/test_market_scoring.py:19`. Fix the "Imported by" column to cite the test file instead of the router. Re-export still required.

- **[High] §5.4 grep pattern misses `from app.routers import documents`.** Verified — `app/main.py:141,145` uses exactly this form. My pattern `(from |import )(app\.routers\.documents|...)` matches `from app.routers.documents import X` but not `from app.routers import documents`. Replace the §5.4 grep with the broader form: `grep -rn "documents" backend/app/main.py backend/app/routers/ backend/app/services/customer_profile.py backend/tests/` and manually classify hits. Add explicit reminder that `app/main.py:141,145` are load-bearing rename sites.

- **[Medium] Per-service commit counts inconsistent with template.** Walking the template honestly: market_scoring=4, data_sources=4, market_research=4, icp=4, signals=5-6 → total **21-22 commits**, not 23-25. Update §4.2 numbers and the per-service breakdowns accordingly.

- **[Medium] `signals/` LOC estimates leave ~370 LOC unaccounted (28%).** Accept the gap rather than fabricating tighter numbers — imports, docstrings, blanks, and yet-to-discover inline helpers fill it. Add a note in §3.2: "Estimates are conservative for `signals/`; the implementor may discover additional helpers during decomposition that don't map cleanly to the proposed submodules. Distribute by best judgment; the `~400 LOC per file` ceiling no longer applies as a constraint (dropped from §6 in round 1)."

- **[Medium] Claude-variant pre-flight outcome can be resolved now.** Verified — `tests/unit/test_signals.py:24,29,117,273` cover `generate_signals_batch_claude` and `signal_ask_claude` as live backend-dispatcher wrappers (e.g., `test_generate_signals_batch_claude_happy_path` asserts the dispatch with `llm_backend='claude'`). They are not dead code. Resolve the spec by removing the "delete if dead" branch from §3.2's implementor note; keep only "live wrappers — keep in `orchestrator.py` unchanged." This also voids the related Medium concern about a ≥236 floor carve-out.

- **[Medium] `tags=[...]` rename changes OpenAPI/Swagger grouping; should be explicit.** Tags are not in the §2.3 "HTTP surface stability" exclusion list, so the rename isn't technically a constraint violation. But it does shift the Swagger UI grouping from "documents" to "data_sources" — a visible cosmetic surface change. Add to §2.1 item 2: "**Note:** `tags=[\"documents\"]` and `tags=[\"v2\", \"documents\"]` become `tags=[\"data_sources\"]` and `tags=[\"v2\", \"data_sources\"]`. This shifts the OpenAPI `/docs` grouping — an intentional cosmetic change consistent with the package rename."

- **[Low] §3.7 pre-flight grep uses `<domain>` placeholder.** Add a one-line note after the grep command: "Replace `<domain>` with each of `signals`, `icp`, `market_research`, `documents`, `market_scoring`."

- **[Low] §3.1 example doesn't show `_`-prefixed exception pattern.** Add one illustrative line to the example, e.g.:
  ```python
  # services/market_scoring/__init__.py — illustrating §3.7 exception
  from app.services.market_scoring.persistence import _ensure_market_scoring_indexes
  from app.services.market_scoring.scoring import _run_market_scoring_for_org
  ```
  Either keep the existing signals/ example and add a separate market_scoring/ example, or annotate the existing example with a comment pointing to §3.7.

- **[Low] `capture_fixtures.py` external consumer not mentioned.** Verified — `tests/capture_fixtures.py:86,108,130` imports `Research_Market_*`, `icp_research_*`, and `search_signals` from their service packages. Add to §5.3: "Note: `tests/capture_fixtures.py` is a manually-run script (not exercised by `pytest -q`). Re-export breakage for `search_signals`, `Research_Market_1..5`, or `icp_research_1..4` surfaces only when the capture script is run. The §3.X public-symbol enumerations cover these — no additional safety net needed beyond a one-time post-phase capture-script smoke run."

- **[Low] "scaffold" terminology imprecise in §4.2.** Reword Step 1 to "Move service file into package:" instead of "scaffold `<domain>/` package:" — the primary action is the move, package creation is incidental.

- **[Nit] `scripts/test_claude_batch_and_market_research.py` not mentioned.** Verified — line 32 imports `get_company_profile_for_org` (a public symbol). Will continue working via the re-export. Add a brief note alongside the capture_fixtures.py addition above: "Plus `backend/scripts/test_claude_batch_and_market_research.py:32` imports `get_company_profile_for_org` from `market_scoring` — covered by the public-symbol re-export."

- **[Nit] §3.3 lists `_reserve_unique_icp_id` and `_release_icp_id` without §3.7 cross-reference.** Resolved by the Critical fix (adding both symbols to §3.7). Add a parenthetical to the §3.3 persistence row: "`_reserve_unique_icp_id`, `_release_icp_id` (re-exported per §3.7)."

## Disagreed Findings

- **[Medium] Lazy imports in `customer_profile.py` won't be caught by per-commit pytest.** Disagree. `tests/unit/test_customer_profile.py` already exercises the create/update/list/delete customer-profile functions (the file contains 9 `mocker.patch("app.services.icp._ensure_icp_indexes")` calls — confirmed by Phase G's TD-007 inventory). When those tests call the functions whose bodies lazy-import `_reserve_unique_icp_id` / `_release_icp_id`, the import statement executes; if the symbol isn't re-exported from `icp/__init__.py`, an `ImportError` fires immediately. The risk the reviewer describes ("won't surface until runtime in production") is conditional on no test exercising the path — but tests do exercise these paths. The Critical-finding fix (adding the symbols to §3.7) plus the existing test coverage makes the per-commit pytest verification sufficient. No additional smoke test needed.

## Deferred Findings

(none)

## Severity Disagreements

(none — all severities accepted as assigned)

## Open Questions

(none — all findings resolved into agree / disagree / agree-with-different-resolution)
