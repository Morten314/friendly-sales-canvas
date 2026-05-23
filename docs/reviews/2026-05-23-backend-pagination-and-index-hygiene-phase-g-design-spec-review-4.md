---
artifact: specs/2026-05-23-backend-pagination-and-index-hygiene-phase-g-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-23
round: 4
---

## Context

Round 4 review. The spec has been revised across three prior rounds; many findings are resolved. This review focuses on (a) genuinely new findings not caught in rounds 1-3, (b) prior findings that remain unaddressed, and (c) verifying that prior-round fixes were applied correctly. I read the full spec (756 lines), all three prior reviews, the round-3 synthesis, and verified claims against the current codebase (`app/routers/`, `app/services/`, `app/main.py`, `tests/`).

## Findings

### [High] §3.2 Mongo example uses wrong database and collection for `list_user_documents`

**Location:** §3.2, Mongo example code block (line ~224-236)

The spec shows:

```python
collection = mongo["Profiler"]["Documents"]
```

The actual service at `documents.py:596-597` uses:

```python
db = mongo["File_Processing"]
collection = db["file_status"]
```

The database is `File_Processing`, not `Profiler`. The collection is `file_status`, not `Documents`. An implementer following this example literally would query a nonexistent collection and return an empty result (or error) at runtime. The spec's §2.1 #2 endpoint table, §3.3 router table, and §3.4 v1 route example are all consistent with the correct endpoint path `/user-documents` — only the service-layer code example has the wrong database/collection.

**Suggestion:** Replace `mongo["Profiler"]["Documents"]` with `mongo["File_Processing"]["file_status"]` in the §3.2 Mongo example. Also add a brief note that each Mongo service may use a different database (the general pattern is `mongo[<db_name>][<collection_name>]`), and the implementer should verify against the current code.

### [High] Test baseline of 203 is stale — actual count is 195

**Location:** §1 ("from the Phase F baseline of 203"), §5 ("203 (Phase F baseline)"), §7.3 ("203 (Phase F baseline)")

Flagged in round 2 (High #4). Still unaddressed after three rounds. My `grep -c "def test_"` gives 195 test functions. If the Phase F baseline was 203, tests have been removed since; if 203 was always wrong, the derived target of ~245 is off by 8. The spec says "Exact count finalized at implementation time" (§7.3), so the delta matters more than the absolute number, but the "203" figure appears three times and will confuse a reader who cross-checks.

**Suggestion:** Run `pytest --collect-only -q` at plan-writing time and replace all "203" references with the verified count. The delta (N new tests) and target (baseline + N) should be derived from the verified baseline.

### [High] §5.5 lifespan test patches wrong module path — test won't detect the call

**Location:** §5.5, `test_lifespan_calls_ensure_leads_indexes`

The spec shows:

```python
monkeypatch.setattr(
    "app.services.leads._ensure_leads_indexes",
    lambda mongo: called.append("leads"),
)
```

But `app/main.py` imports the helper directly:

```python
from app.services.leads import _ensure_leads_indexes
```

(Proposed in §3.5.) Python's `from X import Y` creates a new binding in the importing module's namespace. `monkeypatch.setattr("app.services.leads._ensure_leads_indexes", ...)` replaces the attribute on the `leads` module, but `main.py`'s local `_ensure_leads_indexes` reference still points to the original function. The monkeypatch has no effect — the test would pass whether or not the lifespan actually calls the helper (a false-positive test).

The same issue applies to `_ensure_icp_indexes` and the existing `_ensure_market_scoring_indexes` (imported at `main.py:28` via `from app.services.market_scoring import _ensure_market_scoring_indexes`). If the existing lifespan test patches `app.services.market_scoring._ensure_market_scoring_indexes`, it has the same bug.

**Suggestion:** Patch the binding in the caller's namespace: `monkeypatch.setattr("app.main._ensure_leads_indexes", ...)`. Alternatively, have `main.py` import the module (`from app.services import leads as leads_service`) and call `leads_service._ensure_leads_indexes(...)`, then patch `app.services.leads._ensure_leads_indexes` — but the spec's proposed import style is `from app.services.leads import _ensure_leads_indexes`, so patching `app.main._ensure_leads_indexes` is the correct fix.

### [High] §3.4 v1 `fetch_signals` example adds validation constraints not in current code — unacknowledged v1 behavior change

**Location:** §3.4, v1 `/fetch-signals` route example

The spec shows:

```python
limit: int = Query(10, ge=1, le=500),
```

The current code at `routers/signals.py:67` is:

```python
limit: int = Query(10),
```

No `ge`/`le` constraints. The spec's example adds `ge=1, le=500` to the v1 route, which would cause 422 responses for previously-accepted values (`limit=0`, `limit=10000`, negative values). This is a v1 validation tightening, not listed in §2.3's acknowledged behavior changes. §2.3 non-goals says "No new query parameters beyond `limit` / `offset`" and "No response-shape changes" — adding validation constraints to an existing parameter is arguably not a new parameter, but it is a behavior change (previously-valid requests become 422).

**Suggestion:** Either (a) add this to §2.3's acknowledged behavior changes: "v1 `/fetch-signals` gains `ge=1, le=500` validation on its existing `limit` parameter; previously, any integer was accepted," or (b) leave the v1 route's `limit` validation unchanged (`limit: int = Query(10)`) and only apply the constraints to the v2 route.

### [Medium] §3.2 Mongo example oversimplifies `list_user_documents` — omits item transformation

**Location:** §3.2, Mongo example code block

The spec's example returns `list(collection.find(flt).sort(...).skip(...).limit(...))` — raw MongoDB documents. The actual service (`documents.py:600-623`) iterates the cursor and transforms each document into a processed `file_item` dict: field extraction (`file_id`, `file_name`, `status`, etc.), `_id` removal, conditional inclusion of `url`, `tags`, `description`. The `count_documents()` call must use the same filter as the `find()`, but `total` is unaffected by the transformation.

The simplified example is fine as a pattern illustration, but the implementer must understand that the transformation must be preserved and that `count_documents()` returns the count of raw matching documents while `items` are the transformed dicts. Without this note, an implementer might write `total = len(items)` (which works when offset=0 and limit >= total, but breaks for paginated queries where `len(items) < total`).

**Suggestion:** Add a brief note after the Mongo example: "The `list_user_documents` service transforms each raw document into a processed dict (field extraction, `_id` removal, conditional field inclusion). The transformation is preserved in the paginated version; `count_documents()` operates on the raw filter, not the transformed items."

### [Medium] `list_registrations` returns typed `RegistrationResponse` models — spec pattern assumes raw dicts

**Location:** §3.2 ("`tuple[list[ItemDict], int]`"), §4.2 commit 6

The spec's service-layer pattern uses `tuple[list[ItemDict], int]` as a generic placeholder. But `list_registrations` (`org_auth.py:156-178`) returns `List[RegistrationResponse]` — it iterates the cursor and constructs a Pydantic model per document (with `str(reg["_id"])`, `.isoformat()` for timestamps). The paginated service would return `tuple[list[RegistrationResponse], int]`, not `tuple[list[dict], int]`.

This is analogous to `_get_latest_market_score_rows` returning `tuple[List[LeadMarketScoreRow], int]` (noted in §3.6). But the spec doesn't call out `list_registrations` similarly. The implementer must: (1) run `count_documents()` before the transformation loop (or on the same filter), (2) apply `skip/limit` to the cursor before iterating, and (3) keep the per-document transformation intact.

**Suggestion:** Add a note to §4.2 commit 6: "Service returns `tuple[list[RegistrationResponse], int]`, not `tuple[list[dict], int]` — the per-document Pydantic construction is preserved. `count_documents()` and `skip/limit` are applied to the raw cursor; the transformation loop runs on the bounded result."

### [Medium] `list_registrations` database/collection not specified in service code

**Location:** §3.2, §4.2 commit 6

§2.1 #2 mentions "separate `Registration_DB` from the main `Profiler` DB" but the service-layer examples in §3.2 and §4.2 don't specify the database or collection for the paginated version. The actual code (`org_auth.py:162-163`) uses `mongo["Registration_DB"]["registrations"]`. The implementer must infer this from the current code.

With the §3.2 `list_user_documents` example already using the wrong database (High finding above), there's a pattern risk: the spec's Mongo examples are not reliable for database/collection names.

**Suggestion:** Add a table or note in §3.2 listing the database and collection for each Mongo service: `list_user_documents` → `File_Processing.file_status`, `list_registrations` → `Registration_DB.registrations`, `fetch_signals` → `Signals.signals`.

### [Medium] v1 `/registration` route example still missing from §3.4 — 4th round, unaddressed

**Location:** §3.4

Flagged in round 1 (Medium #11) and round 2 (noted in Context as "Still absent from §3.4. Not addressed."). §3.4 shows concrete v1+deprecation examples for four domains (leads, documents, icp, signals) but omits `registration`. This is the simplest conversion (bare-list Mongo) but also the one with the most subtle detail (cross-tenant, typed return, `Registration_DB`). Providing the example would force the spec to confront the database/collection and typed-return issues flagged above.

**Suggestion:** Add a v1 `registration` route example to §3.4. Even a minimal example would clarify the database, transformation, and lack of `org_id` filter.

### [Medium] `fetch_signals` uses `mongo["Signals"]["signals"]` — not `Profiler`

**Location:** §3.2, §4.2 commit 5

The actual service at `signals.py:915-916` uses `mongo["Signals"]["signals"]`, not `mongo["Profiler"]`. Like the `list_registrations` database divergence, this is not specified anywhere in the spec. The implementer must verify the database against the current code.

This is the third Mongo service using a non-`Profiler` database (documents uses `File_Processing`, registrations uses `Registration_DB`, signals uses `Signals`). A comprehensive database/collection table in §3.2 would address all three at once.

**Suggestion:** Same as the `list_registrations` finding — add a database/collection table to §3.2.

### [Low] §3.2 `list_leads_by_file` service code not shown — only mentioned

**Location:** §3.2 (line ~218)

The spec mentions `list_leads_by_file` in passing ("also adopts `ORDER BY l.created_at DESC`") but doesn't show the before/after service code. Only `get_leads_for_org` gets a full before/after treatment. `list_leads_by_file` has a different query shape (filters by `file_id` + `org_id`) and needs its own `SKIP`/`LIMIT`/`count` pattern. The implementer can infer from the `get_leads_for_org` example, but an explicit note about the filter and sort would prevent guesswork.

**Suggestion:** Add a brief note: "`list_leads_by_file` follows the same pattern with filter `MATCH (l:Lead) WHERE l.org_id = $org_id AND l.file_id = $file_id`, `ORDER BY l.created_at DESC`, and separate count query."

### [Low] §2.1 #7 `refresh=true` + `offset > 0` — accepted but the rationale could be stronger

**Location:** §2.1 #7

Flagged in round 1 (High #4) and round 2 (Medium #5). The spec now documents the behavior and explicitly states "not worth guarding against." This is a reasonable position. However, the rationale ("typical ICP cardinality is 5-10, well under the default `limit=50`, so `offset > 0` after a refresh is never reached in practice") only covers the `refresh=true` case. A cache-miss on first request also triggers the generation path, and if someone calls `/v2/icp?offset=10` on a cache miss, they pay full LLM cost for potentially zero items. The spec's position is defensible at MVP, but the cache-miss case is worth a one-line mention.

**Suggestion:** Add "Cache-miss on first request triggers the same full LLM cost regardless of offset" to §2.1 #7.

### [Low] `list_registrations` is `def` (sync) but the router declares `async def`

**Location:** `app/routers/org_auth.py:41`, §4.2 commit 6

The current router at `org_auth.py:41` declares `async def get_registrations(mongo=Depends(get_mongo))` but the service `list_registrations` is a synchronous function (`def list_registrations(mongo)`). This is the same pattern as ICP (noted in §3.4 v1 ICP example comment). The spec should note that the v2 `registration` router also declares `async def` despite calling a sync service, for consistency with the v1 pattern.

### [Nit] §3.5 step 3 uses "fourteen test-mock-patch targets" but the actual count should be verified

**Location:** §2.1 #5, §3.5 step 4

The spec says "Fourteen test-mock-patch targets must also be renamed: `tests/unit/test_customer_profile.py:54,80,95,133,169,194,235,247,261` (nine) and `tests/unit/test_icp.py:109,125,235,250,268` (five)." My grep confirms 9 in `test_customer_profile.py` and 5 in `test_icp.py` = 14 total. The spec is accurate.

### [Nit] §4.1 commit 2 LOC estimate says "(~70-80 LOC.)" — reasonable given the expanded scope

**Location:** §4.1 commit 2

Updated from round 1's "~50 LOC" to account for the `customer_profile.py` callsites (round 2 Critical #1). With 6 callsite updates + 4 import deletions + 14 test patch renames + 2 new lifespan helpers + 2 integration tests, 70-80 LOC is a reasonable estimate.
