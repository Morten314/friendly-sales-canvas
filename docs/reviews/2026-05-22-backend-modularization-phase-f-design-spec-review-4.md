---
artifact: specs/2026-05-22-backend-modularization-phase-f-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-22
round: 4
---

## Context

Round 4 review after synthesis 3 incorporated all round 3 findings (3 synchronous router-callable functions in market_scoring, 7 `_get_market_score_collections` callers, two-layer router→service→bg pattern, `_persist_market_score_for_lead` pre-existing `score_coll=None`, corrected cross-commit caller counts, transitive dependency mapping, split 15a/15b). This round verifies those updates and looks for remaining issues.

The spec is now 758 lines. The round 3 High findings have been substantially addressed — §3.6 now shows the correct two-layer pattern, the function dependency table is comprehensive, and commit 15 is explicitly scoped for a 15a/15b split.

## Findings

### [High] §3.6 paragraph incorrectly says `process_file_to_embeddings` takes `driver` parameter

**Location:** §3.6 — final paragraph (line 463)

> The same general shape (clients passed in, threaded through internal helpers) applies to `process_file_to_embeddings` in `services/documents.py` — it takes `(driver, mongo, s3, pinecone, …)` and threads them through its internal calls.

Verified against the source: `process_file_to_embeddings` (documents.py:161-350) accesses `clients.client` (Mongo, lines 171, 296, 321, 338), `clients.s3_client` (line 189), and `clients.pc` (line 277). It does **not** access `clients.driver` anywhere in its function body. The post-Phase-F signature should be `process_file_to_embeddings(mongo, s3, pinecone, file_key, user_id, file_name, org_id, file_id)` — no `driver`.

This is more than a typo: if the plan-writer adds `driver` to the signature, the `upload_document_file` function at line 527 (which calls `background_tasks.add_task(process_file_to_embeddings, ...)`) would need to inject and forward `driver` unnecessarily, and the documents router would need `Depends(get_neo4j_driver)` for an endpoint that never uses Neo4j.

**Recommendation:** Change to `it takes (mongo, s3, pinecone, …)`.

### [High] Commit 10 row incorrectly claims "background-task wiring through `_run_market_scoring_for_org` call from the router"

**Location:** §4.2 commit table — commit 10 row (line 539)

> Includes background-task wiring through `_run_market_scoring_for_org` call from the router.

Commit 10 converts `leads.py`. There is no background-task wiring in `leads.py` — `BackgroundTasks` does not appear in `leads.py` at all (verified by grep). `_run_market_scoring_for_org` lives in `market_scoring.py` (commit 15), not `leads.py`. The leads router (`routers/leads.py`) is a simple CRUD router with no background tasks.

This appears to be a copy-paste artifact from the commit 15 description. The commit 10 row should describe what leads actually does: 10 usage sites across `clients.driver` (Neo4j sessions) + `clients.client` (Mongo for some paths) + `upsert_node` import. The background-task pattern for leads is non-existent.

**Recommendation:** Remove the background-task claim from the commit 10 row. Replace with accurate description of leads' scope.

### [Medium] §3.6 worked example shows `score_single_lead_against_market(llm2, ...)` but current call uses keyword arguments

**Location:** §3.6 worked example code block (line 457)

The spec shows:
```python
scoring_payload = score_single_lead_against_market(llm2, ...)    # threads llm2 through
```

Current code at line 730-733:
```python
scoring_payload = score_single_lead_against_market(
    lead=lead,
    company_profile=company_profile,
    market_reports=market_reports,
)
```

Current signature: `score_single_lead_against_market(lead, company_profile, market_reports)`.

After Phase F, the new signature is `score_single_lead_against_market(llm2, lead, company_profile, market_reports)`. The worked example is correct in intent — `llm2` is prepended as the first positional arg. But the `...` elides the three keyword arguments that the current code passes. The worked example should show the full call for clarity:

```python
scoring_payload = score_single_lead_against_market(llm2, lead, company_profile, market_reports)
```

This is minor but the `...` could mislead during implementation into thinking additional args changed beyond just prepending `llm2`.

### [Medium] §3.6 function table doesn't include `score_single_lead_against_market`'s `llm2` parameter in the "Direct clients accessed" column

**Location:** §3.6 function dependency table (line 418)

The table says `score_single_lead_against_market` has direct client access: `llm_config.llm2` (line 555). This is correct. But the "sync (called from bg task)" kind label doesn't convey that after Phase F, this function's signature becomes `score_single_lead_against_market(llm2, lead, company_profile, market_reports)` — `llm2` is a new first positional parameter. The worked example code block below the table does show `llm2` being passed, but the table itself doesn't make it obvious that the function gains a parameter (the "Direct clients accessed" column shows the *current* state, not the post-Phase-F signature delta).

Not blocking, but a note like "→ gains `llm2` as first arg" in the table would help the plan-writer.

### [Medium] §3.7 fallback code still uses deferred `from app.core import clients` — redundant during coexistence

**Location:** §3.7 fallback code blocks (lines 478-479, 487-488)

Carried forward from round 3 Low finding. The fallback pattern shows:
```python
if pc is None:
    from app.core import clients
    pc = clients.pc
```

But every service file that uses this fallback already has `from app.core import clients` at the module top level (these imports aren't removed until commit 16). The deferred import is dead code during commits 4–15 — `clients` is already in scope. The fallback should simply be `pc = clients.pc`.

This isn't harmful (Python handles redundant imports fine), but it adds boilerplate to every fallback site and could confuse a plan-writer into thinking the deferred import is load-bearing. It's not — it's purely defensive against a scenario that can't occur during the coexistence period.

**Recommendation:** Simplify to `pc = clients.pc` (no deferred import). The module-level import guarantees `clients` is in scope through commit 15.

### [Low] Commit 15 "Plan to split into 15a/15b upfront" but §4.1 header says "~16 commits"

**Location:** §4.1 header (line 517), §4.3 header (line 554), commit 15 row (line 544)

The spec says "~16 commits" in multiple places. If commit 15 splits into 15a/15b, that's 17 commits. The "~" prefix accommodates this, but the §4.3 header says "Cleanup (1 commit)" and numbers it "16." — if 15 becomes 15a+15b, the cleanup becomes commit 17. The commit-message format `refactor(be): <description> [phase F, commit N/16]` would also need updating.

Not blocking — the "~" handles it — but the plan-writer should be aware that the N in "commit N/16" may become N/17.

### [Nit] §2.1 item 7 still describes background-task pattern as "routers acquire clients via `Depends()` and pass them positionally to the task function"

**Location:** §2.1 item 7 (line 33)

This is the simplified one-layer description. §3.6 now correctly shows the two-layer pattern (router → synchronous service → `bg.add_task`). But §2.1 item 7's summary still implies a direct router → bg.add_task flow. A reader who starts at §2.1 and doesn't read §3.6 carefully will have the wrong mental model.

**Recommendation:** Update item 7 to say "routers acquire clients via `Depends()` and pass them to service functions, which forward them to `bg.add_task` calls" — matching the §3.6 reality.

## Verified Claims (round 3 findings addressed)

- **Round 3 High #1 (3 sync router-callable functions):** Addressed. §3.6 now shows `trigger_or_get_market_scores`, `get_market_scores_status`, `get_lead_market_score_descriptions` with the two-layer router→service→bg pattern. The function dependency table (lines 407-421) lists all 11 functions with their access patterns.

- **Round 3 High #2 (7 internal `_get_market_score_collections` callers):** Addressed. Line 461 explicitly states "7 internal call sites (lines 198, 224, 273, 358, 443, 605, 651) plus 1 external caller in lifespan." Verified against source: the 7 internal + 1 external count is correct.

- **Round 3 High #3 (two-layer router→service→bg pattern):** Addressed. §3.6 "After" code block now shows the router calling `trigger_or_get_market_scores(request, background_tasks, driver, mongo, llm2)` and the service function forwarding to `bg.add_task`. The "Before" block shows the current indirection too.

- **Round 3 Medium #1 (`_persist_market_score_for_lead` pre-existing `score_coll=None`):** Addressed. Line 424 explicitly states the parameter stays and is "unrelated to the §3.7 fallback pattern."

- **Round 3 Medium #2 (customer_profile → icp "7 sites" vs 15 line numbers):** Addressed. Line 509 now correctly states "11 call sites" with a breakdown by function and notes the 4 import-only lines separately.

- **Round 3 Medium #3 (2 `get_leads_for_org` call sites in market_scoring, not 1):** Addressed. Line 507 now states "**2 sites**: line 377 in `get_market_scores_status`, line 658 in `_run_market_scoring_for_org`."

- **Round 3 Medium #4 (transitive `_get_lead_identity_from_neo4j` dependency):** Addressed. The function table (line 410) lists `_get_lead_identity_from_neo4j` as a helper with `clients.driver` access, and the commit 15 row (line 544) mentions the transitive dependency.

- **Round 3 Nit #1 (Optional type hints on S3/Pinecone):** Addressed. `ClientBundle` now has `s3_client: Any` and `pc: Pinecone` (non-Optional) with inline comments noting they're always constructed.

- **Round 3 Nit #2 (inconsistent dependencies.py formatting):** Addressed. All providers now use multi-line formatting.

## Previously verified claims still accurate

- 12 service files (14 total, 2 excluded), ~94 usage sites, graph_chat router 5 sites, query() closure, vision excluded, S3/Pinecone unconditional, chain/chain2 conditional on graph, test count 195.
