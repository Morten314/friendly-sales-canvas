---
synthesizes_review: docs/reviews/2026-05-23-backend-pagination-and-index-hygiene-phase-g-design-spec-review-4.md
artifact: specs/2026-05-23-backend-pagination-and-index-hygiene-phase-g-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-23
round: 4
---

## Round Recommendation

yes

Reason: Three High findings verified against the codebase materially affect implementation correctness — §3.2's Mongo example names a nonexistent database/collection, §5.5's lifespan tests would silently pass on broken behavior due to Python `from X import Y` binding semantics, and §3.4's v1 `fetch_signals` example tightens validation in an unacknowledged way. Each requires concrete spec text changes that warrant re-review.

## Agreed Findings

- **[High] #1 — §3.2 Mongo example uses wrong database/collection.** Verified: `documents.py:596-597` uses `mongo["File_Processing"]["file_status"]`, not `mongo["Profiler"]["Documents"]` as the spec shows. Replace the §3.2 Mongo example's `collection = mongo["Profiler"]["Documents"]` with `db = mongo["File_Processing"]; collection = db["file_status"]`, and add a brief note above the example: "Each Mongo service uses a different database — the pattern is `mongo[<db>][<collection>]`; verify against the current code." Fold into Finding #7's database/collection table.
- **[High] #3 — §5.5 lifespan test patches wrong module path.** Verified: `main.py:28` uses `from app.services.market_scoring import _ensure_market_scoring_indexes`. Python's `from X import Y` creates a new binding in the importing module's namespace; `monkeypatch.setattr("app.services.leads._ensure_leads_indexes", ...)` has no effect on the binding lifespan actually calls. Fix §5.5: patch `app.main._ensure_leads_indexes` (the caller's binding), not `app.services.leads._ensure_leads_indexes`. Update both test examples in §5.5 accordingly. Add a brief note explaining the binding-semantics rationale so the implementor doesn't "fix" it back to the natural-looking-but-wrong target.
- **[High] #4 — §3.4 v1 `fetch_signals` example adds unacknowledged validation.** Verified: `routers/signals.py:67` is `limit: int = Query(10)` with no `ge`/`le`. The spec's §3.4 example shows `Query(10, ge=1, le=500)` — a behavior change (previously-accepted `limit=0` or `limit=10000` would now 422). Fix: change the §3.4 v1 example to `limit: int = Query(10)` (no constraints), matching current behavior. The v2 `/v2/fetch-signals` route at §3.3 already validates with `Query(10, ge=1, le=500)` — that stays. v1 behavior preserved, v2 gains validation. No §2.3 acknowledged-behavior-change entry needed (because we're not changing v1 behavior).
- **[Medium] #5 — §3.2 Mongo example oversimplifies, omits transformation.** Verified at `documents.py:600-628`: each cursor doc is transformed into a `file_item` dict (field extraction, `_id` removal, conditional inclusion). Add a one-line note after the §3.2 Mongo example: "The simplified `list(...)` shown here is illustrative — each service preserves its current per-document transformation pass (`list_user_documents` builds a `file_item` dict per row; `list_registrations` builds `RegistrationResponse` instances). `count_documents()` operates on the raw filter, not the transformed items — `total` is always the pre-transformation count."
- **[Medium] #6 — `list_registrations` returns typed `RegistrationResponse`.** Verified: `org_auth.py:156` returns `List[RegistrationResponse]` with per-doc Pydantic construction. Add a one-line note to §4.2 commit 6: "Service returns `tuple[list[RegistrationResponse], int]`, not `tuple[list[dict], int]` — same typed-return pattern as `_get_latest_market_score_rows` in §3.6. `count_documents()` and `.skip()/.limit()` run before the per-document Pydantic construction loop."
- **[Medium] #7 — Database/collection table missing for Mongo services.** Verified: three Mongo services use three different databases — `list_user_documents` (`File_Processing.file_status`), `list_registrations` (`Registration_DB.registrations`), `fetch_signals` (`Signals.signals`). Add a table to §3.2 immediately above the Mongo example block listing the (database, collection) pair for each paginated Mongo service. Folds Findings #1 (correct db/collection for documents) and #9 (signals) into one structural fix.
- **[Medium] #8 — v1 `/registration` example missing from §3.4.** Flagged in rounds 1 and 2 and still unaddressed. Add a minimal v1 `/registration` route example to §3.4 — bare-list pattern, no `org_id` filter (matching the cross-tenant admin nature), returns `List[RegistrationResponse]` directly. The example clarifies the `Registration_DB` database, the cross-tenant scoping, and the typed return — all three of which would otherwise rely on the implementor inferring from current code.
- **[Medium] #9 — `fetch_signals` uses `mongo["Signals"]["signals"]`.** Verified at `signals.py:915`. Folds into Finding #7's database/collection table.
- **[Low] #10 — `list_leads_by_file` service code not shown.** Add a one-line note in §3.2 after the `get_leads_for_org` "after" block: "`list_leads_by_file` follows the same pattern with `MATCH (l:Lead) WHERE l.org_id = $org_id AND l.file_id = $file_id`, `ORDER BY l.created_at DESC`, and a parallel `RETURN count(l) AS total` query in the same session." Prevents a guesswork moment at implementation time.
- **[Low] #11 — `refresh=true` cache-miss case.** Extend §2.1 #7 with one line: "Cache-miss on first request triggers the same full LLM cost regardless of `offset` — same wasteful edge case, same low-likelihood acceptance rationale (typical ICP cardinality 5-10, so `offset > 0` is never reached in practice)." Closes the round-3 open question.
- **[Low] #12 — `list_registrations` is sync, router is `async def`.** Verified at `org_auth.py:41` and `org_auth.py:156`. Same pattern as ICP, already noted at the §3.4 ICP example comment. Add an analogous one-line comment to the new §3.4 v1 `/registration` example (per Finding #8): "v2 router declares `async def` despite calling a sync service — same convention as v1 and the other v2 routers."

## Disagreed Findings

- **[High] #2 — Test baseline of 203 is stale, "actual count is 195".** Same as round-2 #4, disagreed for the same reason and re-verified for round 4: `cd backend && pytest --collect-only -q` returns `203 tests collected`. The reviewer's `grep -c "def test_"` method misses parameterized tests (`@pytest.mark.parametrize` expands at collection time, not source-grep time), class-based test methods, and fixture-generated tests. The baseline is correct. The spec already says "Exact count finalized at implementation time and pinned in the plan" which covers the implementation-time recount. No spec change.

## Deferred Findings

(none)

## Severity Disagreements

(none — agreed findings carry the reviewer's stated severity)

## Open Questions

- **Should `_ensure_market_scoring_indexes`'s existing lifespan test (added in Phase F) be audited for the same binding-semantics bug raised in Finding #3?** Phase F is shipped and its test passes — if the test patches `app.services.market_scoring._ensure_market_scoring_indexes`, it has the same false-positive issue. Not in Phase G scope, but worth a one-line note in §6 Risks or §8 Phase H+ inventory: "Audit the Phase F lifespan test for the same binding-semantics issue; fix in Phase H if affected." Operator preference.
- **For the new §3.2 database/collection table — should it list only the three paginated Mongo services covered by Phase G, or include all Mongo databases in the backend for future reference?** Phase G scope is the three; a comprehensive table risks scope creep. Recommend Phase-G-only.
