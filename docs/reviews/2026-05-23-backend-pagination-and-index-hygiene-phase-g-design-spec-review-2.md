---
artifact: specs/2026-05-23-backend-pagination-and-index-hygiene-phase-g-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-23
round: 2
---

## Context

Round 2 review. The spec was revised between round 1 and this round — several round-1 findings have been addressed:

- **ICP index source location** (round-1 Critical #1): The spec now correctly identifies `_ensure_icp_id_registry_indexes` as an existing standalone helper at `icp.py:1095-1098` and describes the work as rename + signature change, not extraction (§3.5). The collection-name casing bug (`ICP_ID_Registry` vs `ICP_ID_REGISTRY`) is also fixed in §3.5.

- **`/v2/registration` cross-tenant gap** (round-1 High #2): §2.1 #2 now explicitly documents the admin-only nature, notes the absence of `org_id`/`user_id` scoping, and defers a scoping parameter to Phase H. Acknowledged.

- **`list_icps` complexity** (round-1 High #3): §4.2 commit 4 now specifies that tuple extraction happens at the outermost level of `list_icps`, not inside `normalize_icp_response`, with a worked description of both the cached and generation paths.

- **`refresh=true` + offset edge case** (round-1 High #4): Not addressed. The spec still has §2.1 #7 documenting the behavior but no validation or offset-reset rule.

- **`list_leads_by_file` sort key** (round-1 Medium #5): §4.2 commit 7 now says `ORDER BY l.created_at DESC` by analogy with `get_leads_for_org`. Addressed.

- **Silent 500-row cap disclosure** (round-1 Medium #8): §2.3 now has an explicit "Acknowledged behavior change" paragraph. Addressed.

- **`fetch_signals` user-scoping divergence** (round-1 Medium #7): §2.1 #2 now has an explicit note about user-scoping vs org-scoping. Addressed.

- **Test-count arithmetic** (round-1 Medium #12): Still says "~245" (203 + ~42). The arithmetic gives 248, but the spec says "approximately" and "precise count finalized at implementation time," which is tolerable.

- **Neo4j connection claim** (round-1 Low #13): Still says "one Bolt connection, two `s.run(...)` calls" at §3.2. Not addressed, but §2.1 #3 now says "one session, two `s.run(...)` calls" which is more accurate. The §3.2 code example says `with driver.session() as s:` — correct. Minor residual imprecision in the prose.

- **v1 registration example** (round-1 Medium #11): Still absent from §3.4. Not addressed.

This review focuses on new findings and items not resolved since round 1.

## Findings

### Critical

#### 1. ICP index relocation misses four callsites in `customer_profile.py`

**Location:** §3.5, §2.1 #5, §4.1 commit 2

The spec says (§3.5): "Delete the two existing internal callsites that defensively call the helper before touching the registry: `icp.py:816` (inside `list_icps`) and `icp.py:1051` (inside the `_reserve_unique_icp_id` flow)."

`icp.py:1051` is inside `delete_recommended_icp`, not `_reserve_unique_icp_id` — the spec misattributes the location for the second time despite the round-1 correction of the parent function. More importantly, there are **four additional callsites** the spec does not mention:

- `customer_profile.py:22` — inside `create_customer_profile`
- `customer_profile.py:142` — inside `update_customer_profile`
- `customer_profile.py:221` — inside `list_customer_profiles`
- `customer_profile.py:359` — inside `delete_customer_profile`

All four use lazy imports (`from app.services.icp import _ensure_icp_id_registry_indexes`) and call it before touching `ICP_ID_REGISTRY`. If Phase G renames `_ensure_icp_id_registry_indexes` → `_ensure_icp_indexes` and changes its parameter from `db` to `mongo`, these four callsites will break at runtime with either `ImportError` (renamed function) or `AttributeError` (wrong parameter type) unless they are also updated. The spec's rename plan only covers `icp.py` internal callers.

Additionally, `tests/unit/test_customer_profile.py` has **8 mock patches** of `app.services.icp._ensure_icp_id_registry_indexes` (lines 54, 80, 95, 133, 169, 194, 235, 247, 261). These must also be updated to the new name, or the tests will fail with a patch-target-mismatch error.

The acceptance criterion §7.1 #4 (`git grep "\.create_index\(" ... | grep -v "_ensure_.*_indexes"`) would pass even with the broken `customer_profile.py` imports (since those call the helper, not `create_index` directly), so the grep check would not catch this.

**Fix:** The spec must enumerate all six callsites (2 in `icp.py`, 4 in `customer_profile.py`) plus the 8 test mock patches. §4.1 commit 2 must include updating `customer_profile.py` imports and the test patches.

### High

#### 2. `market_scoring.py:417` `.find()` already has a `.limit()` — spec describes adding one that exists

**Location:** §3.6, §4.3 commit 8

The spec says: "`score_coll.find(run_score_filter, …)` at `market_scoring.py:417` gains an explicit `limit=5000` matching the run's lead set."

The actual code at line 416-420 shows:

```python
recent_docs = list(
    score_coll.find(run_score_filter, {"lead_id": 1, ...})
    .sort("updated_at", -1)
    .limit(recent_items_limit)
)
```

The `.limit(recent_items_limit)` call already exists. `recent_items_limit` is a parameter of the enclosing function `get_market_scores_status(driver, mongo, user_id, org_id, run_id, recent_items_limit)` at line 361. This is **not** the unbounded find the spec describes. The spec's proposed change (adding `limit=5000`) would either duplicate an existing limit or replace a parameterized limit with a hardcoded one, neither of which is correct.

**Fix:** Remove this item from §3.6 and §4.3 commit 8. The `.find()` at line 417 is already bounded by its caller. If the spec intends to audit `get_market_scores_status`'s callers to ensure they pass reasonable values for `recent_items_limit`, that should be stated separately.

#### 3. `get_stream_status` is an unbounded list endpoint not mentioned in scope

**Location:** §2.1 (endpoint inventory), §4.2 (commit list)

`get_stream_status` (`leads.py:357-377`) iterates an unbounded MongoDB cursor (`coll.find({"org_id": org_id}).sort("uploaded_at", -1)`) and returns `{"files": [...]}`. This is a list-returning endpoint served via an HTTP route (`/leads/stream-status` in `routers/leads.py`). It is not listed in §2.1's endpoint table, not included in the 6 v2 endpoints, and no commit addresses it.

The spec's §2.1 says "Every list-returning HTTP endpoint gets a `/api/v2/` sibling" — but `get_stream_status` returns an unbounded list and is excluded without explanation. Either include it or add it to §2.2 out-of-scope with a justification.

#### 4. Test baseline of 203 is unverifiable — actual count appears to be ~195

**Location:** §1, §5, §7.3

The spec repeatedly references a "Phase F baseline of 203" tests. My exploration count (via `grep -c "def test_"`) gives **195 tests** across all test files. If the Phase F baseline is stale (tests may have been removed or the count was wrong), the "~245" target derived from it is also wrong.

**Fix:** Run `pytest --collect-only -q` at plan-writing time and pin the actual baseline. Replace all "203" references with the verified count.

### Medium

#### 5. `refresh=true` + `offset > 0` edge case remains unaddressed

**Location:** §2.1 #7

Raised in round 1 (High #4). The spec documents the behavior ("LLM cost is paid once per refresh request regardless of which page is requested") but still provides no guard against `refresh=true` + `offset > 0` producing zero-item responses after a full LLM invocation. At minimum, the spec should state that this is an accepted wasteful edge case and not worth guarding against given that ICP generation produces ~5-10 items.

#### 6. v1 `/icp` docstring says "Returns up to 500 ICPs" but ICP generation typically produces 5-10

**Location:** §3.4 ICP v1 route example

The docstring for the deprecated v1 `/icp` route says: "Returns up to 500 ICPs (silent cap). The cap is new; LLM-driven generation historically returned a small handful, so the cap is effectively dormant." This is fine as documentation but misleading — a reader might infer that the ICP collection could approach 500 items. The cached payload is per-user and typically contains 5-10 ICPs. Consider rewording to "Returns the user's ICP list (typically 5-10 items; hard cap of 500)".

#### 7. `list_icps` has no `org_id` filter — paginating a user-scoped but org-unfiltered cache

**Location:** §4.2 commit 4, §2.1 #2 (`GET /v2/icp`)

`list_icps` filters by `user_id` only (line 820: `collection.find_one({"user_id": user_id})`). The LLM generation path fetches the company profile without any `org_id` filter (line 849: `MATCH (c:CompanyProfile) RETURN c LIMIT 1`). This is the same scoping concern as signals (user-scoped, not org-scoped) and the spec correctly preserves it — but unlike `fetch_signals`, the spec does not call this out for `/v2/icp`. Add a note similar to the signals scoping note.

#### 8. §3.5 ICP helper rename: `db` → `mongo` parameter change requires callers to pass `mongo["Profiler"]` differently

**Location:** §3.5

The current `_ensure_icp_id_registry_indexes(db)` takes a database handle (`db = mongo["Profiler"]`), and all callers pre-extract `db` before calling it. The renamed `_ensure_icp_indexes(mongo)` takes the full MongoClient and accesses `mongo["Profiler"]["ICP_ID_REGISTRY"]` internally. This is a signature change, not just a rename — callers that today pass `db` must be updated to pass `mongo` instead. The spec acknowledges this for the two `icp.py` callers but the `customer_profile.py` callers (see Critical #1) also pre-extract `db` and would need the same change.

#### 9. `has_more` swap-in listed as Phase I+ but the current double-query pattern has no measurement gate

**Location:** §8 Phase I+ item 4

The spec lists `has_more` as a future optimization "if a tenant's lists grow large enough that the second query (count) becomes hot" with trigger "a `count_documents()` or `RETURN count(l)` lands in a Datadog top-N slow-query list." But there is no Datadog or APM instrumentation in the backend (no such dependency exists). The trigger is aspirational — it will never fire. Either acknowledge this is a "do it when we feel pain" heuristic or commit to adding a query-duration log line in Phase G that could be grepped later.

### Low

#### 10. §4.2 commit 7 says `list_leads_by_file` had "no ordering before" — correct, but the sort key choice is implicit

**Location:** §4.2 commit 7 notes column

The spec says `list_leads_by_file` gets `ORDER BY l.created_at DESC`. The function currently has no ORDER BY at all (`leads.py:346-349`). Adding a sort key is necessary for pagination, and `created_at DESC` is a reasonable default matching `get_leads_for_org`. This is fine but not explicitly stated as a design decision — it's buried in the commit notes column. A one-line statement in §3.2 or §3.6 would make it discoverable.

#### 11. v1 route examples use `response: Response` parameter but the `Response` import is not shown

**Location:** §3.4 all four v1 route examples

Each v1 route example adds `response: Response` as a parameter to set deprecation headers. The `from fastapi import Response` import is not shown in any example. This is standard FastAPI, so any implementer would know to add it, but the examples are otherwise complete (imports, signatures, bodies) — the missing import breaks the pattern.

#### 12. §3.3 mount code shows `prefix="/v2"` on both `include_router` and per-router `APIRouter(prefix=...)`

**Location:** §3.3

The mount pattern is: `app.include_router(leads_v2.router, prefix="/v2")` and each router declares `APIRouter(prefix="/leads", ...)`. This produces paths like `/v2/leads`. This is correct and clearly explained. But the v2 routers use **relative** prefixes (`prefix="/leads"`) while v1 routers appear to use different prefix patterns — the spec should confirm that the v1 routers won't conflict with the `/v2/` namespace (they won't, since v1 has no `/v2/` prefix, but an explicit note would prevent confusion).

#### 13. §3.4 v1 `/icp` route example shows `async def` but notes the body is synchronous — this matches current code

**Location:** §3.4 ICP v1 route example

The example has `async def get_or_create_icp_config(...)` with a comment explaining `list_icps` is sync. This matches the current router pattern at `routers/icp.py`. Not an issue — just confirming the spec is accurate here.

### Nit

#### 14. §3.5 code comment says "rename of the existing `_ensure_icp_id_registry_indexes(db)` helper at `icp.py:1095-1098`" — this is now accurate after round-1 fix

**Location:** §3.5

Round 1 flagged the spec as saying the indexes were inline inside `_reserve_unique_icp_id`. The current spec correctly identifies the standalone helper. Acknowledged as resolved.

#### 15. §4.1 commit 2 LOC estimate says "(~50 LOC.)" covering lifespan helpers, index deletion, and 2 integration tests

**Location:** §4.1 commit 2

With the additional work required for `customer_profile.py` (Critical #1), this estimate should increase. Four import changes + parameter adjustments + 8 test mock-patch renames adds ~20-30 lines. Updated estimate: ~70-80 LOC.

#### 16. Acceptance §7.1 #3 greps for `Deprecation.*=.*"true"` — may need case-insensitive flag

**Location:** §7.1 #3

The grep uses `Deprecation.*=.*"true"` which assumes double quotes. If an implementer uses single quotes (`'true'`), the grep fails. Low risk since the spec's code examples consistently use double quotes, but `grep -iE` would be more robust.

#### 17. §2.1 #9 mentions Pinecone `create_index` at `documents.py:271` is left as-is — this is correctly scoped out

**Location:** §2.1 #9

The spec correctly identifies that this is a Pinecone vector-index admin operation, not a Mongo-collection-index hot-path call, and excludes it. No issue.
