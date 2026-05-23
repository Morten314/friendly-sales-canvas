# Brewra — Technical Debt Register

Running list of debt items the team has consciously accepted. Each entry: what was done, what should be done, why we deferred, and the trigger that should pull it forward.

Numbering is preserved across resolutions — TD-001/002/003 (resolved by Phases E and F) were removed on 2026-05-23; their IDs are not reused so commit/spec references stay traceable.

---

## TD-004 — Captured LLM fixtures are stubs, not real responses

**Date logged:** 2026-05-22
**Origin:** Phase E implementation review (`docs/reviews/2026-05-22-phase-e-implementation-review.md` §H1).

**Current state:**
`backend/tests/fixtures/captured/*.json` (24 files) are placeholder stubs with `"_stub": true` and a 4–6 key minimal shape. They were produced by hand during Phase E because `ANTHROPIC_API_KEY`, `TOGETHER_API_KEY`, and `TAVILY_API_KEY` were not available in the implementation environment. Unit and integration tests assert against this stub shape rather than real LLM output.

**What it should be:**
Run `cd backend && python tests/capture_fixtures.py` on a machine with all three API keys set. The script overwrites each stub with a real LLM response (10–30+ keys typical). Verify the suite still passes against the real shapes; update assertions or models if drift is exposed.

**Why we deferred:**
- The Phase E refactor was structured so that the capture script, the test harness, and the assertion sites are all in place — only the JSON content is stubbed. Switching to real captures is a content swap, not a code change.
- Running the script requires live API credentials with budget; doing it inside the test-writing phase would gate test-writing on key procurement.

**What we lose by staying as-is:**
- Tests don't assert against actual response shape. A service parsing change that produces a different real output can pass tests silently ("the fixtures lied"). This is the exact risk the now-retired TD-001 was meant to retire.
- The `test_icp.ambr` snapshot encodes stub shape, not real shape — it will need re-baselining after the first real capture.

**Pull-forward triggers:**
- First time someone with API keys runs the suite locally and observes a mismatch between stub assertions and real service behavior.
- Before any production release that depends on the captured-fixture acceptance criterion.
- When the capture pipeline (`tests/capture_fixtures.py`) is modified — re-run to validate the change end-to-end.

**Owner:** CTO (has API key access).

---

## TD-005 — v1 list endpoints expose `count` as page size, not DB total

**Date logged:** 2026-05-23
**Origin:** Phase G code review on Task 3 (`feat(be): add /v2/user-documents paginated endpoint + deprecate v1 [phase G, commit 3/8]`).

**Current state:**
v1 paginated routes that still return a wrapped envelope (`{status, count, files}` for `/user-documents`, `{status, count, signals}` for `/fetch-signals`) compute `count` as `len(items)` after the service silently caps at 500. Pre–Phase G, the service was unbounded and `count` reflected the true DB count. Post–Phase G, for orgs with >500 documents/signals, `count` is silently truncated to 500 while the underlying service knows the real total (it's the discarded `_` in `items, _ = await service.list_*(...)`).

```python
# v1 /user-documents
items, _ = await documents_service.list_user_documents(mongo, org_id)
return {"status": "success", "count": len(items), "files": items}  # count maxes at 500
```

The deprecation docstring tells clients to migrate to v2, but does not say `count` semantics changed.

**What it should be:**
Either:
1. Pass `total` through: `items, total = ...; return {…, "count": total, …}` — keeps the wire field honest at the cost of `count != len(files)` when capped.
2. Add explicit docstring note: `count` is page size, not DB total — migrate to v2 for the true count.

Option 1 is one character of code; option 2 is two lines of prose. v1 is being deleted in Phase H regardless.

**Why we deferred:**
- The plan (`plans/modularization-plan-7.md`) specifies the `len(items)` form verbatim. Changing it during execution would have been a spec deviation.
- The plan's reasoning (preserving `count == len(files)` invariant) is defensible: v1 callers iterating `files` see exactly `count` items with no surprise — the deprecation header tells them to migrate to v2 for the true total.
- Affected endpoints: `/user-documents` and `/fetch-signals` only. The other v1 routes either return bare lists (`/registration`, `/leads`, `/leads/by-file`) or wrappers without `count` (`/icp` returns `{suggestedICPs: items}`).

**What we lose by staying as-is:**
- v1 clients with org-size >500 see a `count` that lies about reality. The deprecation header is the only signal pointing them at the fix.
- If Phase H v1-deletion slips, the gap widens — orgs grow past 500 over time and silent truncation becomes silent data loss to consumers that don't read the full page.

**Pull-forward triggers:**
- First v1 client reports a missing-document/missing-signal incident traceable to the 500-cap.
- Phase H planning — fold the docstring/return change into the v1-removal commit if both endpoints aren't fully migrated by then.
- Any FE bug ticket mentioning "we have N documents in S3 but the dashboard says 500."

**Owner:** TBD (likely whoever wires the FE to v2 first).

---

## TD-006 — `market_scoring.py` callers recompute `len(leads)` instead of using the returned `total`

**Date logged:** 2026-05-23
**Origin:** Phase G code review on Task 7 (`feat(be): add /v2/leads + /v2/leads/by-file paginated endpoints + drop order_by_recent [phase G, commit 7/8]`).

**Current state:**
Both callers of `get_leads_for_org` in `backend/app/services/market_scoring.py` (lines ~404 and ~690) discard `total` and recompute it from the page:

```python
leads, _ = get_leads_for_org(driver, org_id=org_id, limit=5000, offset=0)
total_leads = len(leads)
```

`get_leads_for_org` already runs a second Cypher query (`MATCH (l:Lead {org_id: $org_id}) RETURN count(l) AS total`) and returns the true count in the tuple. Recomputing via `len(leads)` is identical at ≤5000 leads, but for orgs with >5000 leads it under-reports the total — and even at smaller sizes it forces deserializing every record server-side just to length-check it.

**What it should be:**
```python
leads, total_leads = get_leads_for_org(driver, org_id=org_id, limit=5000, offset=0)
```

Two-character change at each callsite. Eliminates the wasted deserialization at small sizes and the under-reporting at large sizes.

**Why we deferred:**
- The plan (`plans/modularization-plan-7.md` Task 7 Step 5) specifies the `_; total_leads = len(leads)` form verbatim. Following it preserved review-trace consistency with the plan's text.
- The semantic difference only matters at orgs >5000 leads, which doesn't exist in MVP-stage data (0 live users).
- The `len(leads)` form is correct for the immediate use — progress-display denominator in a background scoring task that processes those exact leads. The "real total" wouldn't change the loop's behavior.

**What we lose by staying as-is:**
- Slight efficiency loss: count is computed twice (once via Cypher inside the service, once via `len()` in the caller).
- If org-size grows past 5000, `total_leads` becomes misleading — it caps at 5000 while the org has more.
- Future readers who see the discarded `_` may copy-paste the pattern elsewhere without realizing the total was free.

**Pull-forward triggers:**
- First org reaching >5000 leads (will require lifting the `limit=5000` cap regardless — fix the tuple-unpack at the same time).
- Any market-scoring progress-bar UX work that needs a denominator larger than the current page.
- Routine cleanup pass on `market_scoring.py`.

**Owner:** TBD.

---

## TD-007 — Cosmetic cruft from Phase G plan-verbatim test code

**Date logged:** 2026-05-23
**Origin:** Phase G code reviews on Tasks 2, 4, 6, 8 (multiple commits).

**Current state:**
Several Phase G tests and routers contain unused symbols that were transcribed verbatim from `plans/modularization-plan-7.md`'s code blocks. None affect behavior; all are 1-line fixes.

- `backend/tests/test_icp_v2.py:7` — `fake_result = {"suggestedICPs": [...]}` assigned and never referenced (data is inlined into the `patch(...)` call on the next line).
- `backend/tests/unit/test_market_scoring.py` — `test_get_latest_market_score_rows_returns_items_and_total` declares `monkeypatch` as a parameter but the test body uses `patch(...)` as a context manager; the fixture is never used.
- `backend/app/routers/v2/org_auth.py:1` — `from typing import List` imported but unused (the generic annotation lives on `PaginatedResponse[RegistrationResponse]`).
- `backend/tests/unit/test_customer_profile.py` — nine `mocker.patch("app.services.icp._ensure_icp_indexes")` calls remain in tests whose code paths no longer reach `_ensure_icp_indexes` (the calls were deleted from `customer_profile.py` in Phase G Task 2). The patches still bind a real symbol so they don't error, but they're dead setup — guarding against a call that never happens.

**What it should be:**
Delete the dead lines. ~13 lines across 4 files.

**Why we deferred:**
- All four items were flagged during Task code-quality review as **Minor** (non-blocking per the subagent-driven-development skill).
- The dead var, unused import, and unused `monkeypatch` parameter were copied verbatim from the plan's code blocks; the implementer correctly followed the plan rather than deviating mid-task.
- The dead `mocker.patch` calls in `test_customer_profile.py` predate the cleanup intent — they were updated in place (renamed) by `sed` per the plan's Step 9, rather than re-evaluated for relevance.

**What we lose by staying as-is:**
- Future readers will hit a "why is this here?" moment on each occurrence. The patches in `test_customer_profile.py` are the worst offender — they imply `_ensure_icp_indexes` is still reachable from `customer_profile.py` code paths when it isn't.
- Marginal pytest collection cost (negligible).

**Pull-forward triggers:**
- Next routine cleanup pass on `backend/tests/`.
- First future agent that gets confused by one of the dead patches and asks "is `_ensure_icp_indexes` still called from `customer_profile`?"
- Bundled with Phase H's v1-route deletion (which will remove related tests anyway).

**Owner:** TBD.
