---
artifact: plans/modularization-plan-6.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-22
round: 1
---

## Context

Plan reviewed in full (2174 lines) against its backing spec `specs/2026-05-22-backend-modularization-phase-f-design.md` (759 lines). No token pressure; both documents read completely.

## Findings

### [High] Spec §3.7 fallback pattern has a silent positional-arg binding bug for `get_leads_for_org` — plan patches it but cross-cutting touch required

**Location:** Task 10, Steps 3 and 6 (lines 1227–1265); spec §3.7 (line 487)

The spec shows the fallback form `get_leads_for_org(driver=None, org_id=None, …)` and states that unconverted callers in `signals.py` and `market_scoring.py` call `get_leads_for_org(org_id, limit=5000, order_by_recent=True)` and "hit the fallback." This is wrong: positional binding maps `org_id` (a string) → `driver`, so `if driver is None` is `False`, and the function tries to call `.session()` on a string.

The plan correctly identifies this caveat (line 1240: "The fallback would then run on `org_id` as the driver, which is broken") and fixes it by keyword-promoting the 4 call sites in `signals.py` and `market_scoring.py` within this same commit (Step 6). This fix is a cross-cutting change: Task 10 modifies files (`signals.py`, `market_scoring.py`) whose full conversion is deferred to Tasks 14 and 15. If the implementing agent skips the caveat paragraph or treats Step 6 as optional, the test suite will catch it — but the error message ("`AttributeError: 'str' object has no attribute 'session'`") is less helpful than the plan's own diagnosis.

**Recommendation:** Promote the keyword-promotion fix from Step 6 to a mandatory step with its own grep invariant, and add a note that this is a spec correction (spec §3.7's example is misleading for any caller using positional `org_id`).

### [High] Task 13 Step 4 defers a structural decision to execution time — plan lacks the answer

**Location:** Task 13, Step 4 (lines 1518–1538)

Step 4 contains a long "Decision" block that reads the actual icp-helper signatures at execution time and chooses between two approaches: (a) helpers take top-level `mongo` and index into it themselves, or (b) helpers take a pre-indexed `db` object. The plan says "read the helpers first" and "use the spec's intent but adapt to the actual code."

This uncertainty is honest but problematic for a plan that claims 16-17 independently-green commits. If the decision is (b), the "11 call sites" patch is essentially a no-op (customer_profile already passes `db`), and the task scope shrinks. If (a), every call site changes. The plan should resolve this before execution by reading the actual code and recording the decision.

### [High] Task 15a introduces §3.7 fallbacks for market_scoring helpers, contradicting spec §3.6

**Location:** Task 15a (lines 1646–1770); spec §3.6 function table (line 422)

Spec §3.6 states: "All internal market_scoring functions use the §3.4 simple form — no §3.7 fallback." This is true for a single commit 15. The plan splits into 15a/15b, which introduces a boundary where 15a-converted helpers are called by 15b-unconverted router-callable functions. The plan correctly adds fallbacks to bridge this gap (lines 1669–1679).

However, the spec's acceptance criterion §7.1 grep `def \w+\([^)]*\b(driver|mongo|llm2)=None` expects empty after commit 16. After 15a it will show 8 hits. If the spec's acceptance greps are run at the 15a boundary (e.g., during review), they will fail. The plan should note that these greps are only expected to pass after commit 16 (which it does for the final verification in Task 16 Step 10, but not for intermediate tasks).

### [Medium] No overall kill criteria or escalation protocol

**Location:** Entire plan; "Risks and rollback notes" section (lines 2164–2174)

Pre-flight has one abort condition (grep count divergence > ±2, line 46). The Risks section describes rollback mechanics. But there is no stated condition under which the entire plan gets abandoned. For a 16-17 commit plan, consider adding: "If more than 2 service conversions produce unexpected failures (not attributable to spec/code drift), pause and report to human for scope reassessment."

### [Medium] Spec-internal inconsistency on customer_profile call-site count (7 vs 11)

**Location:** Spec §4.2 commit 7 (says "7 call sites") and §4.2 commit 13 (says "7 call sites") vs spec §3.7 table (says "11 call sites"); plan Task 13 (line 1491, says "11 call sites")

The plan correctly follows §3.7's detailed table (11 call sites) over §4.2's summary (7). But the spec inconsistency remains unresolved. The plan should either note this as a spec erratum or the spec should be corrected before execution to avoid confusion.

### [Medium] Task 3 Step 7 commits a file that was never modified

**Location:** Task 3, Step 7 (line 651)

`git add backend/tests/conftest.py backend/tests/unit/conftest.py` — but Steps 2–3 only modify `backend/tests/conftest.py`. Step 1 says to "Modify: `backend/tests/unit/conftest.py`" in the file list (line 466), but no step actually writes to it. The task header also says "Modify: `backend/tests/unit/conftest.py` (add lightweight `mock_*_via_override` builders; existing source-patch fixtures stay)" — but these builders are never specified or implemented. Either the unit/conftest.py modification was deferred to per-task conversion commits, or it's missing work.

### [Medium] Task 11 re-touches `documents.py` without explicit risk flag

**Location:** Task 11, Step 2 (lines 1342–1344) and Step 5 (lines 1372–1390)

Commit 11 changes the `query()` function signature from `query(query_string)` to `query(driver, query_string, params=None)`. This requires updating `documents.py:38`, which was already fully converted in commit 9. The re-touch is correct (the function already has `driver` in scope from commit 9), but it's a cross-commit dependency that could surprise a reviewer: commit 9 appears to complete documents.py, yet commit 11 modifies it again. The plan should flag this in the Task 11 header (e.g., "Also re-touches `documents.py` for `query()` signature change").

### [Medium] Dual-construction window contradicts "merge each commit immediately" mitigation

**Location:** Task 2 architecture note (line 286); "Risks and rollback notes" (line 2168); spec §6 Risk 9

The plan runs all 16-17 commits on a feature branch (`refactor-backend-modularization-phase-f`) and merges at the end (Post-execution Step 3, line 2153). But the Risks section and spec §6 Risk 9 recommend merging each commit to `master` immediately to keep the dual-construction window short. The plan's branch structure and final merge step contradict this mitigation. If the intent is to merge per-commit, the post-execution merge step should be removed and each task should end with a merge. If the intent is a single-merge branch, the risk mitigation text should acknowledge the full-window duration.

### [Low] Task 1 Step 5 `hasattr` guard adds unnecessary fragility

**Location:** Task 1, Step 5 (lines 230–254)

The `_clients._bundle if hasattr(_clients, "_bundle") else _clients` pattern handles two paths depending on whether Step 3 was taken. Step 3 is marked "recommended" and its collapse removes the dual-construction risk (spec §6 Risk 1). Making Step 3 mandatory and removing the `hasattr` branch would simplify the code and eliminate a path that diverges from the spec's single-construction intent.

### [Low] Leak-detection fixture detects session-end leaks but not inter-test leaks

**Location:** Task 3, Step 3 (lines 587–605)

The `scope="session"` autouse fixture only checks `app.dependency_overrides == {}` at session teardown. A function-scoped fixture that forgets to `.pop()` its override will pollute every subsequent test in the session, but the detection fires only after all tests have run. A `scope="function"` autouse fixture (or a `pytest_runtest_teardown` hook) that checks after each test would catch the leaking test immediately. The session-scope version is acceptable as a safety net but provides weaker diagnostic signal.

### [Low] Bisectability spot-check is non-deterministic

**Location:** Post-execution sanity check (lines 2138–2147)

The `shuf -n 3` picks random commits. Different runs test different commits. Consider either specifying 3 concrete commit indices (e.g., commits 5, 10, 14) or running all commits.

### [Nit] Commit messages all say "16-or-17" instead of resolving upfront

**Location:** Every task's commit message (lines 61, 284, 460, etc.)

Whether 15 splits into 15a/15b is a decision that could be made before execution starts. The spec says "re-merge into single commit only if 15a's diff is <~200 LOC" — but this condition can be estimated from the plan's own scope description. Carrying "or-17" through every message adds noise.

### [Nit] Task 2 lifespan body contains inline `_get_market_score_collections` import and `create_index` calls that become stale after Task 15a

**Location:** Task 2, Step 2 (lines 393–399); Task 15a, Step 4 (lines 1744–1747)

Task 2 adds `from app.services.market_scoring import _get_market_score_collections` and four `create_index` calls inside lifespan. Task 15a replaces these with `from app.services.market_scoring import _ensure_market_scoring_indexes; _ensure_market_scoring_indexes(app.state.clients.client)`. This is correct sequencing but the Task 2 code is dead by Task 15a — a reviewer checking out commit 2 in isolation sees the inline version, and by commit 15a it's been replaced. Not a bug, but worth a cross-reference note.

### [Nit] Plan references `backend/app/routers/*.py` files without verifying they exist

**Location:** Tasks 4–15, each has "Modify: `backend/app/routers/<service>.py`"

The plan assumes a one-to-one mapping between services and routers. If any service's endpoints live in a shared router (e.g., a `leads.py` router that also handles profiles), the per-task router modification may be incomplete. The pre-flight greps verify service-side sites but not router structure. Adding a single router-structure verification grep in pre-flight would close this gap.
