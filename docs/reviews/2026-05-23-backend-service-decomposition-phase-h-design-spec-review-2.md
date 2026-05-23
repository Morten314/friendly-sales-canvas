---
artifact: specs/2026-05-23-backend-service-decomposition-phase-h-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-23
round: 2
---

## Context

This is a second-pass review of a spec that was revised after round 1 findings and synthesis. The spec shows substantial improvement: the Critical findings from round 1 (contradictory re-export rules, missing exception enumeration, duplicate commit templates) have been resolved. This review focuses on remaining issues, new gaps surfaced by verifying claims against the actual codebase, and residual inconsistencies in the revised text.

## Findings

### [Critical] §3.7 exception list omits `_reserve_unique_icp_id` and `_release_icp_id`

**Location:** §3.7 table (line 190–199)

`app/services/customer_profile.py` lazy-imports two `_`-prefixed symbols from `app.services.icp` at four call sites (lines 20, 139, 217 for `_reserve_unique_icp_id`; line 354 for `_release_icp_id`). These are outside the `icp/` package and are not being decomposed this phase. After extraction, these imports must resolve through `icp/__init__.py`. Because the imports are lazy (inside function bodies, not at module top-level), an `ImportError` won't surface at startup or during pytest collection — only at runtime when a customer-profile function is called. The per-commit verification strategy in §4.3 (pytest) is unlikely to exercise these code paths unless tests explicitly call customer-profile functions.

§3.7 currently lists only three exceptions: `_ensure_market_scoring_indexes`, `_ensure_icp_indexes`, and `_run_market_scoring_for_org`. Add `_reserve_unique_icp_id` and `_release_icp_id` with caller `app/services/customer_profile.py`.

### [High] §3.7 exception list omits `_get_latest_market_score_rows`

**Location:** §3.7 table (line 190–199)

`tests/unit/test_market_scoring.py:372` imports `_get_latest_market_score_rows` via `from app.services.market_scoring import _get_latest_market_score_rows`. This is an external import of a `_`-prefixed symbol that must be re-exported from `market_scoring/__init__.py`. The §3.7 pre-flight check instruction is sound (`grep -rn "from app.services.<domain> import _" backend/`) but the table itself should be complete so the implementor can cross-check. Add `_get_latest_market_score_rows` with caller `tests/unit/test_market_scoring.py`.

### [High] §3.7 misidentifies `_run_market_scoring_for_org`'s external caller

**Location:** §3.7 table, row for `_run_market_scoring_for_org` (line 198)

The table states this symbol is imported by `app/routers/market_scoring.py`. The router does not import it — it uses a module-level reference pattern: `from app.services import market_scoring as market_scoring_service`, then calls public functions via `market_scoring_service.trigger_or_get_market_scores(...)`. The `_run_market_scoring_for_org` reference at `services/market_scoring.py:340` is an intra-module call (`background_tasks.add_task(_run_market_scoring_for_org, ...)`). After decomposition, this becomes an intra-package reference (orchestrator → scoring). The actual external importers are:
- `tests/unit/test_market_scoring.py:19` (direct import)
- `tests/unit/test_leads.py:63` (mentioned in a comment; verify if actual import exists)

Fix the "Imported by" column. The re-export is still needed (test files import it), but the rationale should be accurate.

### [High] §5.4 grep pattern misses the critical main.py router-import lines

**Location:** §5.4 mitigation grep (line 265)

The pattern `(from |import )(app\.services\.documents|app\.routers\.documents|app\.routers\.v2\.documents)` matches `from app.routers.documents import X` but not `from app.routers import documents` or `from app.routers.v2 import documents as documents_v2` — because the captured text after `from ` is `app.routers import documents`, not `app.routers.documents`. These are exactly the two lines in `app/main.py` (lines 141 and 145) that must change during the rename:

```python
from app.routers import documents                    # line 141
from app.routers.v2 import documents as documents_v2 # line 145
```

The `\"documents\"` alternation in the grep catches `tags=["documents"]` but not bare identifier `documents` after `import`. Fix by adding alternations for the `import <name>` form, or replace the entire grep with a broader pattern like:

```bash
grep -rn "documents" backend/app/main.py backend/app/routers/ backend/tests/
```

and manually classify the hits.

### [Medium] Per-service commit counts are internally inconsistent with the template

**Location:** §4.2 commit-count summary (line 234)

The parenthetical for `market_research/` says "5 commits (steps 1-5 minus an empty step 5)" — if step 5 is empty/removed, that yields 4 commits, not 5. Similarly, `icp/` is listed as "5 commits" but has "no closeout commit needed" per the step 5 closeout list, which also yields 4 commits. Walking the template for all five services:

| Service | Template steps | Commits |
|---|---|---|
| market_scoring | 1, 2, normalization/scoring split, 5 | 4 |
| data_sources | 1, 2, loaders/pipeline split, 5 | 4 |
| market_research | 1, 2, 3, 4 | 4 |
| icp | 1, 2, 3, 4 | 4 |
| signals | 1, 2, 3, 4, 5 | 5–6 |

Total: 21–22, not "approximately 23–25" as stated. Either the per-service counts need adjustment, or the total does.

### [Medium] LOC estimates for `signals/` leave ~370 LOC (28%) unaccounted

**Location:** §3.2 table (lines 116–123)

The table accounts for ~930 LOC across six submodules; the source file is 1297 LOC. The ~370 LOC gap (28%) is the largest proportional gap across all five services. The remaining code likely consists of imports, module-level constants, inline helpers that don't map cleanly to the proposed submodules, and whitespace/docstrings. The "approx" qualifier covers estimation uncertainty, but a 28% gap on the hardest service (done last) suggests the decomposition may surface more code to distribute than the submodule breakdown anticipates. Either tighten the estimates by accounting for the gap, or add a note acknowledging the uncertainty range for this service specifically.

### [Medium] Dead Claude-variant deletion may conflict with the ≥236 test-count floor

**Location:** §3.2 implementor note (line 127), §6 acceptance criteria (line 286)

§3.2 instructs the implementor to confirm whether `generate_signals_batch_claude` and `signal_ask_claude` are still reachable from routers and delete them if dead. If these functions have dedicated test coverage (tests that call them directly), deletion would reduce the test count below the ≥236 acceptance floor. The criterion says "No test removed unless the commit message explicitly justifies it" — dead-code removal is a valid justification, but the ≥236 numeric floor would still be violated. Add a carve-out: "If dead Claude variants and their tests are removed, the floor adjusts downward by the number of removed tests; commit message must enumerate what was removed."

### [Medium] `tags=["documents"]` rename changes OpenAPI/Swagger grouping — not acknowledged

**Location:** §2.1 item 2 (line 39), §2.3 constraints (line 63)

§2.1 item 2 lists "any `tags=["documents"]` attribute" as part of the rename ripple. The actual router files have `tags=["documents"]` (routers/documents.py:25) and `tags=["v2", "documents"]` (routers/v2/documents.py:8). Renaming these to `"data_sources"` changes the OpenAPI schema grouping, which is a visible surface change for API consumers and the Swagger UI. §2.3 says "HTTP surface stability" covers "No route paths, no response_model types, no query/body params change" — tags are not in this list, so the constraint is technically not violated. But the change should be explicitly acknowledged as an intentional cosmetic surface change, not left implicit.

### [Medium] Lazy imports in `customer_profile.py` won't be caught by per-commit pytest

**Location:** §3.7 (line 190–199), §4.3 (line 240–242)

The `_reserve_unique_icp_id` and `_release_icp_id` imports in `customer_profile.py` are lazy (inside function bodies). The per-commit verification strategy relies on `pytest -q` passing. If no test exercises the customer-profile code paths that call these functions, a missing re-export won't be caught until runtime in production. The spec should note this risk and suggest either: (a) running the unit tests for `customer_profile` as an additional verification step, or (b) adding a one-line smoke test that imports and calls the relevant functions with mocked dependencies.

### [Low] §3.7 pre-flight grep uses `<domain>` placeholder without substitution note

**Location:** §3.7 pre-flight check (line 200)

The command `grep -rn "from app.services.<domain> import _" backend/` uses `<domain>` as a placeholder. The angle brackets could be interpreted as shell redirection by an inexperienced implementor, or run literally (finding nothing). Add a note: "Replace `<domain>` with `signals`, `icp`, `market_research`, `documents`, or `market_scoring`."

### [Low] §3.1 `__init__.py` example doesn't demonstrate the `_`-prefixed exception pattern

**Location:** §3.1 example code (lines 89–110)

The example shows re-exports for public symbols only. Since §3.7 establishes that some `_`-prefixed symbols must also be re-exported, adding one illustrative line to the example would clarify the convention. For instance:

```python
from app.services.signals.persistence import _some_internal_exported  # §3.7 exception
```

This is a documentation clarity issue, not a correctness issue — the §3.7 table is the authoritative reference.

### [Low] `capture_fixtures.py` imports are not mentioned in verification or risk sections

**Location:** §4.3, §5.3

`tests/capture_fixtures.py` imports public symbols from three decomposed services: `signals.search_signals`, `market_research.Research_Market_1..5`, `icp.icp_research_1..4`. These imports aren't exercised by `pytest -q` (capture fixtures are run manually). If a re-export is missed for any of these symbols, the error surfaces only when someone runs the capture script. Not worth adding to per-commit verification, but worth noting in §5.3 as a known gap in the automated safety net.

### [Low] §4.2 "scaffold" terminology could be more precise

**Location:** §4.2 step 1 (line 221)

"Scaffold `<domain>/` package: `git mv services/<domain>.py services/<domain>/orchestrator.py`" — the word "scaffold" typically means creating a directory structure, but the actual operation is a `git mv` (which creates the target directory as a side-effect) followed by creating `__init__.py`. Rewording to "Move service file into package: ..." would be clearer about the primary action.

### [Nit] No mention of `scripts/test_claude_batch_and_market_research.py`

**Location:** §2.2 out of scope, §5.3 re-export drift

`backend/scripts/test_claude_batch_and_market_research.py:32` imports `get_company_profile_for_org` from `app.services.market_scoring`. This is a standalone script, not a pytest test. It won't break (the symbol is public and will be re-exported), but it's another external consumer not mentioned in the spec. Worth a brief mention as a non-test external consumer.

### [Nit] §3.3 places `_reserve_unique_icp_id` and `_release_icp_id` in `persistence.py` but doesn't list them

**Location:** §3.3 table, `persistence.py` row (line 138)

The persistence row lists: `list_icps, delete_recommended_icp, _ensure_icp_indexes, _reserve_unique_icp_id, _release_icp_id`. These last two are correctly placed in persistence.py (they do MongoDB atomic operations), but they should be cross-referenced with the §3.7 exception list. Currently the §3.3 table implies they're internal, but they're external — this mismatch contributes to the §3.7 gap identified above.
