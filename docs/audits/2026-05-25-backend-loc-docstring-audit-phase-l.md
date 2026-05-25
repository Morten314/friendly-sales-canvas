# Backend LOC + Docstring Audit — Phase L

**Date:** 2026-05-25
**Scope:** backend/app/ (91 files, 10,403 LOC baseline)
**Method:** Per-file review using the 12 opportunity categories from spec §4.
**Branch:** refactor-backend-loc-docstring-audit-phase-l (off master 7bd2797)
**Baseline:** 248 pytest tests passing, 19 snapshots, 64 pyflakes warnings (`docs/audits/2026-05-25-phase-l-pyflakes-baseline.txt`).

Discovery grep counts (Step 2):
- Cat 2 (stale Phase/commit refs): 25 matches across 12 files (matches spec)
- Cat 5 (`db = mongo[...]`): 32 matches across 11 files (spec called out 11 sites in `data_sources/{persistence,pipeline}.py` — verified)
- Cat 6 (`update_one` in `market_scoring/`): 13 matches; 10 in `scoring.py` at lines 48, 55, 69, 83, 97, 112, 162, 173, 192, 208 (matches spec)
- Cat 7 (`MATCH (c:CompanyProfile` and `MATCH (p:CompanyProfile`): 14 matches; K4 fetch-one-profile read sites resolve to 9 distinct sites across 6 files (drift vs spec's "8 sites across 5 files" — see Cross-cutting Cat 7 below for the corrected count).

## Summary

| Status | Count | LOC est. |
|---|---:|---:|
| Audited, clean | 53 | — |
| Execute (Stage 3) | 38 | ~ -227 |
| Investigated → promoted to execute | TBD (Stage 2) | TBD |
| Investigated → deferred | TBD (Stage 2) | — |
| Design-discussion (future work) | 6 | — |

**Spec target gap:** spec §2 estimates -370 to -460 LOC. The audit-grounded, per-K-summed `execute` total is ~ -227 LOC. Gap: ~ -143 to -233 LOC. The shortfall reflects that the spec's K-known-win LOC estimates were aspirational and assumed deeper per-site removal than per-site verification supported (e.g., K2 budgeted ~70 LOC compression across two near-identical prompt pairs, but the actual diff is ~6 lines of schema-rule overlay across each pair; K3 collapse of 5 near-duplicates yields ~50 LOC instead of the spec's higher hope; K1 dropped from a hoped ~ -16 to a confirmed-safe ~ -10 once the 7-name normalization block was split to investigate). Stage 2 investigation may close part of the gap if `investigate` findings promote to execute (the `services/market_scoring/orchestrator.py` 7-name normalization block alone could add ~ -7 LOC if it promotes, and the Cat 5 expansion across 7 additional service files could add ~ -15 LOC if it promotes).

Notes:
- "Execute LOC" est. ~ -227 includes the 7 known wins (K1–K7) only. Audit-surfaced minor findings (additional unused imports outside K1's named set, additional docstring drift) are counted as individual file entries but not double-counted into K-cluster numbers.
- K-cluster aggregate estimates: K1 ~ -10 LOC (confirmed-safe set), K2 ~ -70 LOC, K3 ~ -50 LOC (after helper), K4 ~ -39 LOC (after helper), K5 ~ -25 LOC (after helper), K6 ~ -8 LOC (after helper), K7 ~ -25 LOC (wording compression across 25 sites) — sum ~ -227 LOC. The Summary table row's "~165" in the previous draft was an earlier conservative figure that omitted K2/K3/K4 after-helper math; the corrected per-K-grounded estimate is ~ -227 LOC.

## Per-file findings

### backend/app/__init__.py (0 LOC)

Empty package marker. Clean.

### backend/app/core/__init__.py (0 LOC)

Empty package marker. Clean.

### backend/app/core/clients.py (68 LOC)

Clean. ClientBundle dataclass + build_clients factory; no duplication, no stale refs, no unused imports.

### backend/app/core/config.py (84 LOC)

Clean. Module-level env loading; comments are stable section dividers.

### backend/app/core/dependencies.py (56 LOC)

Clean. 9 tiny FastAPI getter wrappers; each is a thin one-liner over `request.app.state.*` — these are the FastAPI dependency-injection contract and are NOT trivial-wrapper candidates (Cat 8). They name app.state fields that FastAPI's DI mechanism requires.

### backend/app/core/exceptions.py (150 LOC)

Clean. Domain exception hierarchy; well-documented with status-code routing comments. No duplication.

### backend/app/core/llm_config.py (342 LOC)

- **Cat 3 (near-identical string literals) — execute. (K2)**
  Two near-identical prompt-template pairs:
  - `Cypher_gen_prompt` (88 lines) vs `Cypher_gen_prompt2` (84 lines) — both define the Cypher-generation prompt; `2` omits ~4 lines (fewer schema rules / minor schema-section variations).
  - `qa_prompt_template` (34 lines) vs `qa_prompt_template2` (28 lines) — both define the QA prompt; `2` omits ~6 lines (shorter framing).
  Strategy: extract a base template constant + overlay function that returns the variant with the additional schema-rule block included or excluded. Build `Cypher_Prompt`/`Cypher_Prompt2` and `qa_prompt`/`qa_prompt2` from the variants. Both pairs are constructed at module load and consumed only by `chain`/`chain2` in `build_llm_config`; no external callers depend on the literal text of either variant.
  Est. -70 LOC.

### backend/app/core/logging.py (9 LOC)

Clean. Centralized logger; no duplication.

### backend/app/main.py (187 LOC)

- **Cat 11 (redundant fallback / repeated pattern) — design-discussion.**
  Eight exception handlers (`_handle_not_found` through `_handle_service_error`) all share the same body: `logger.<level>(...); return JSONResponse(status_code=N, content={"detail": str(exc)})`. This could be collapsed via a registry: `STATUS_BY_EXC = {NotFoundError: (404, "debug"), ...}` + one generic handler.
  Tagged design-discussion: FastAPI exception-handler registration is per-class; consolidating loses the explicit per-exception method body the team has used as documentation. Punt.
  No execute action.

  Also: `from app.routers import X; app.include_router(X.router)` repeats 13× at module-bottom in interleaved import/include blocks. Could be a loop over a list of router module names. Tagged design-discussion (low value, slight cost to test patching). Punt.

### backend/app/models/__init__.py (1 LOC)

- **Cat 1 (unused import — false positive) — design-discussion.**
  Pyflakes flags `from app.models.pagination import PaginatedResponse` as unused but the line has `# noqa: F401` and is a deliberate package-API re-export consumed by `app.routers.v2.leads`, `v2.icp`, `v2.signals`, etc. (verified `from app.models import PaginatedResponse` callsites). Keep as-is.

### backend/app/models/customer_profile.py (76 LOC)

Clean. Pydantic models only.

### backend/app/models/data_sources.py (82 LOC)

- **Cat 1 (unused import) — execute. (K1)**
  `typing.Dict` is imported on line 2 but never referenced; the file uses `List`, `Optional`, `Any` only.
  Strategy: remove `Dict` from the `typing` import line.
  Est. -1 LOC.

### backend/app/models/graph_chat.py (30 LOC)

Clean. Pydantic models.

### backend/app/models/icp.py (53 LOC)

Clean. Pydantic models.

### backend/app/models/leads.py (91 LOC)

Clean. Pydantic models.

### backend/app/models/market_research.py (25 LOC)

Clean. Pydantic models.

### backend/app/models/market_scoring.py (75 LOC)

- **Cat 1 (unused import) — execute. (K1)**
  `typing.Any` imported on line 2 but never referenced.
  Strategy: remove `Any` from the `typing` import line.
  Est. -1 LOC.

### backend/app/models/org_auth.py (36 LOC)

Clean.

### backend/app/models/pagination.py (12 LOC)

Clean. Generic `PaginatedResponse[T]`.

### backend/app/models/pipeline.py (18 LOC)

- **Cat 1 (unused import) — execute. (K1)**
  `typing.Dict` imported on line 2 but never referenced; file uses `List`, `Optional` only.
  Strategy: remove `Dict` from the `typing` import line.
  Est. -1 LOC.

### backend/app/models/profiles.py (74 LOC)

Clean.

### backend/app/models/signals.py (76 LOC)

Clean.

### backend/app/routers/__init__.py (0 LOC)

Empty package marker. Clean.

### backend/app/routers/customer_profile.py (50 LOC)

Clean. Thin router.

### backend/app/routers/data_sources.py (128 LOC)

- **Cat 1 (unused imports) — execute. (K1)**
  - `fastapi.HTTPException` on line 4 — not referenced (router uses domain exceptions and the exception handlers).
  - `app.core.logging.logger` on line 15 — not referenced in any route handler body.
  Strategy: remove `HTTPException` from the `fastapi` import; remove the `logger` import entirely.
  Est. -2 LOC.

### backend/app/routers/graph_chat.py (91 LOC)

Clean. Thin router.

### backend/app/routers/icp.py (71 LOC)

Clean. Thin router.

### backend/app/routers/leads.py (116 LOC)

- **Cat 2 (stale Phase ref) — execute. (K7)**
  Line 28 docstring: "Returns up to 500 leads (silent cap). The cap is new — prior to Phase G ..." — the historical context references Phase G as a recent change. Now that Phases H, I, J, K have shipped, the wording is stale. Rewrite to describe present behavior (cap of 500 default).
  Est. -2 LOC (net wording compression).

### backend/app/routers/market_research.py (39 LOC)

Clean.

### backend/app/routers/market_scoring.py (57 LOC)

Clean.

### backend/app/routers/org_auth.py (54 LOC)

Clean.

### backend/app/routers/pipeline.py (25 LOC)

Clean.

### backend/app/routers/profiles.py (45 LOC)

Clean.

### backend/app/routers/signals.py (113 LOC)

- **Cat 2 (stale Phase ref) — execute. (K7)**
  Line 74 docstring: "deferred to Phase H alongside v1 route deletion." — Phase H has shipped; v1 routes are not deleted (per session memory the v1 surface is intentionally kept). Reword to describe present behavior rather than a deferred decision.
  Est. -1 LOC (net wording).

### backend/app/routers/v2/__init__.py (1 LOC)

- **Cat 2 (Phase-G spec-pointer in docstring) — design-discussion. (D3)**
  Single line: `"""v2 paginated API routers — see specs/2026-05-23-backend-pagination-and-index-hygiene-phase-g-design.md"""`. The spec-pointer is a file-name reference (informative), not stale prose. Leaving as-is is defensible; reword decision punted to future work — see Future-work table D3.

### backend/app/routers/v2/data_sources.py (19 LOC)

Clean.

### backend/app/routers/v2/icp.py (27 LOC)

Clean.

### backend/app/routers/v2/leads.py (32 LOC)

Clean.

### backend/app/routers/v2/org_auth.py (18 LOC)

Clean.

### backend/app/routers/v2/signals.py (20 LOC)

Clean.

### backend/app/services/__init__.py (0 LOC)

Empty package marker. Clean.

### backend/app/services/_claude_budget.py (101 LOC)

Clean. Budget/reservation primitives with thread lock; cohesive.

### backend/app/services/_llm_helpers.py (233 LOC)

- **Cat 2 (stale Phase ref) — execute. (K7)**
  Line 202 docstring: "historical quote-escaping was dropped during Phase I to unify all three ..." — the wording "Phase I to unify" is stale context; rewrite to describe current behavior (no quote-escaping; \n/\r escape only).
  Est. -1 LOC.

- **Cat 8 (single-use trivial wrapper) — investigate.**
  Verify that `_research_agent_output` is the only consumer of internal primitives (`_tavily_context_and_urls`, `_claude_messages_text`); if so, no action — the primitives are reused. Stage 2 will confirm.

### backend/app/services/_neo4j_helpers.py (71 LOC)

- **Cat 1 (unused import) — execute. (K1)**
  `typing.Any` imported on line 5 but never referenced in this file (function signatures use no `Any`).
  Strategy: remove `Any` from `typing` import.
  Est. -1 LOC.

  Also: this is the destination module for K4's extracted `fetch_company_profile` helper — see Cross-cutting Cat 7 below.

### backend/app/services/_retrieval.py (113 LOC)

Clean. Two helpers `_build_market_context_queries` + `_fetch_pinecone_supporting_context`; both consumed by 3+ services.

### backend/app/services/customer_profile/__init__.py (18 LOC)

- **Cat 1 (unused imports — pyflakes false positive) — design-discussion.**
  Pyflakes reports `upsert_customer_profile`, `get_customer_profile`, `create_from_suggested_icp`, `delete_icp_from_customer_profile` as unused. These ARE intentional package-API re-exports consumed by `app.routers.customer_profile` (via `from app.services import customer_profile as cp_service`). The pyflakes false positive is the same pattern as the deliberate `# noqa: F401` in `models/__init__.py` — recommend adding `# noqa: F401` per import (or `__all__`) to silence the warnings cleanly.
  Tag design-discussion: cosmetic (silences pyflakes warnings; no LOC change). Punt to TD-011 cleanup.

### backend/app/services/customer_profile/orchestrator.py (388 LOC)

- **Cat 7 (cross-file duplicate helper — fetch_company_profile) — execute. (K4)**
  3 inline Neo4j read sites at lines 31, 153, 319 — all using the canonical `MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1` pattern. Each is wrapped in a `with driver.session() as session:` block of 5–8 lines.
  Strategy: see Cross-cutting Cat 7. Replace each with a call to the new shared helper.
  Est. -15 LOC (3 sites × ~5 LOC each).

### backend/app/services/data_sources/__init__.py (42 LOC)

- **Cat 2 (stale Phase ref) — execute. (K7)**
  Lines 1, 3, 9: "Phase H commit 7/20 final form", "Renamed from documents/ in Phase H", "orchestrator.py was deleted in commit 7/20". Rewrite to describe present-time state of the package.
  Est. -3 LOC.

### backend/app/services/data_sources/loaders.py (124 LOC)

Clean. `load_document` + `process_documents_and_update_graph` + `process_prospect_list` — no duplication or stale refs.

### backend/app/services/data_sources/persistence.py (378 LOC)

- **Cat 5 (repeated DB-lookup boilerplate `db = mongo["File_Processing"]; collection = db["file_status"]`) — execute. (K6)**
  4 occurrences at lines 23, 49, 98, 340 (within `get_document_status`, `list_user_documents`, `delete_data_source`, `update_data_source`).
  Strategy: see Cross-cutting Cat 5. Replace with `coll = _get_file_collection(mongo)`.
  Est. -4 LOC.

### backend/app/services/data_sources/pipeline.py (446 LOC)

- **Cat 5 (repeated DB-lookup boilerplate) — execute. (K6)**
  7 occurrences at lines 44, 169, 194, 211, 288, 376, 407 (within `process_file_to_embeddings` and `upload_file_with_data`).
  Strategy: see Cross-cutting Cat 5. Replace with `coll = _get_file_collection(mongo)`.
  Est. -7 LOC.

  Combined with persistence.py: K6 total = 11 sites (matches spec); see Cross-cutting Cat 5 for K6 net (~ -8 LOC after helper insertion).

### backend/app/services/graph_chat/__init__.py (29 LOC)

Clean. Re-exports follow same pattern as other services; no pyflakes complaints on this file.

### backend/app/services/graph_chat/neo4j.py (66 LOC)

Clean. 4 Cypher helpers.

### backend/app/services/graph_chat/prospect_pipeline.py (131 LOC)

Clean. LinkedIn/audio helpers; cohesive.

### backend/app/services/health.py (15 LOC)

Clean. Minimal `probe_llm`.

### backend/app/services/icp/__init__.py (48 LOC)

Clean. Re-exports.

### backend/app/services/icp/llm.py (26 LOC)

Clean. Thin LLM-dispatch adapter.

### backend/app/services/icp/orchestrator.py (384 LOC)

- **Cat 7 (cross-file duplicate helper — fetch_company_profile) — execute. (K4)**
  1 explicit `def fetch_company_profile():` at line 286 wrapping the canonical org_id-or-fallback pattern (lines 291, 297).
  Strategy: see Cross-cutting Cat 7. Replace with shared-helper call.
  Est. -8 LOC.

### backend/app/services/icp/parsing.py (13 LOC)

Clean. 1-line alias module.

### backend/app/services/icp/persistence.py (350 LOC)

- **Cat 1 (unused imports — pyflakes confirmed) — execute. (K1)**
  Per `docs/audits/2026-05-25-phase-l-pyflakes-baseline.txt` lines 61–62:
  - line 23: `app.services._retrieval._build_market_context_queries`
  - line 23: `app.services._retrieval._fetch_pinecone_supporting_context`
  Both are confirmed unreferenced in this module's bodies (grep for `_build_market_context_queries` and `_fetch_pinecone_supporting_context` inside `icp/persistence.py` returns only the import line). Neither is patched via `app.services.icp.persistence.<name>` in the test suite.
  Strategy: remove both names from the `from app.services._retrieval import …` line.
  Est. -2 LOC.

- **Cat 7 (cross-file duplicate helper — fetch_company_profile) — execute. (K4)**
  1 site at line 211 using `MATCH (c:CompanyProfile) RETURN c LIMIT 1` (fallback variant without org_id filter) inside `delete_recommended_icp`'s helper path.
  Strategy: see Cross-cutting Cat 7.
  Est. -3 LOC.

- **Cat 3 (near-identical string literals — investigate).**
  Multiple ICP-normalization branches (`isinstance(icp.get("..."), list) else []` etc.) repeat ~10 lines of dict-key normalization. Tag investigate; behavior surface (which keys get a list default vs str default) needs per-site review.

### backend/app/services/icp/prompts.py (383 LOC)

- **Cat 2 (stale Phase ref) — execute. (K7)**
  Line 3 docstring: "Templates stay as inline Python strings per Phase H scope. Externalization to ..." — rewrite to describe present-time decision (inline) without time-stamping it to Phase H.
  Est. -2 LOC.

- **Cat 12 (long literals) — design-discussion.**
  ICP_GENERATOR_TEMPLATE + ICP_RESEARCH_1..4_TEMPLATE are large prompt literals. Externalization to YAML/JSON was deferred per Phase H scope. Punt — overlaps with TD-010.

### backend/app/services/leads/__init__.py (28 LOC)

- **Cat 1 (unused-export pyflakes false positives) — design-discussion.**
  Pyflakes flags `batch_upload_leads`, `delete_leads_by_file`, `_ensure_leads_indexes`, `get_leads_for_org`, `create_lead`, `update_lead`, `delete_lead` as unused. The `__init__.py` docstring explicitly documents these as the package-public surface, consumed by `app.routers.leads`, `app.main` (lifespan), and tests. Pyflakes reports them because `__init__.py` doesn't itself reference them and there's no `# noqa: F401` or `__all__` declaration.
  Tag design-discussion: cosmetic (silences pyflakes; no LOC change). Punt to TD-011.

### backend/app/services/leads/normalization.py (22 LOC)

Clean. Single private helper `_process_neo4j_lead_records`.

### backend/app/services/leads/orchestrator.py (219 LOC)

Clean. Local imports for pandas/uuid/tempfile/os are intentional (function-local to avoid import-time cost when batch_upload_leads is not called).

### backend/app/services/leads/persistence.py (219 LOC)

Clean. 7 CRUD/index functions; no duplication.

### backend/app/services/market_research/__init__.py (30 LOC)

- **Cat 2 (stale Phase ref) — execute. (K7)**
  Line 1: "market_research service — public API (Phase H Sequence C final form)." — Phase H label is stale. Rewrite to describe current public API neutrally.
  Est. -1 LOC.

### backend/app/services/market_research/llm.py (25 LOC)

Clean. Thin LLM-dispatch adapter.

### backend/app/services/market_research/orchestrator.py (288 LOC)

- **Cat 4 (near-duplicate functions) — execute. (K3)**
  `Research_Market_1`, `Research_Market_2`, `Research_Market_3`, `Research_Market_4`, `Research_Market_5` (lines 28–119 approx) — diff confirms each is byte-identical to the others except for the template constant (`RESEARCH_MARKET_<N>_TEMPLATE`) and the function name.
  Strategy: introduce `_run_research_component(template, agent_chain, pre_data, llm_backend) -> dict` containing the shared body. Replace each `Research_Market_<N>` with a 1-line dispatch wrapper that selects its template constant. Both `COMPONENT_FUNCTIONS` and `COMPONENT_FUNCTIONS_CLAUDE` dicts continue to reference the public Research_Market_<N> names so external callers (if any) and the lambda-based Claude variant stay intact.
  Behavior preservation: the shared body is byte-identical; the only change is the dispatch surface.
  Est. -50 LOC (5 functions × ~12 LOC each → 1 helper of ~14 LOC + 5 trivial wrappers of ~3 LOC each = ~29 LOC; net delta -50 LOC from a baseline of ~85 LOC).

- **Cat 7 (cross-file duplicate helper — fetch_company_profile) — execute. (K4)**
  1 explicit `def fetch_company_profile():` at line 228 (lines 232, 236). Same canonical pattern.
  Strategy: see Cross-cutting Cat 7.
  Est. -8 LOC.

### backend/app/services/market_research/parsing.py (16 LOC)

Clean. 1-line alias module.

### backend/app/services/market_research/persistence.py (42 LOC)

- **Cat 2 (stale Phase ref) — execute. (K7)**
  Line 14 docstring: "Extracted from run_market_research body during Phase H to centralize the ..." — rewrite as "Centralizes Mongo CRUD ..." (drop Phase reference).
  Est. -1 LOC.

### backend/app/services/market_research/prompts.py (718 LOC)

- **Cat 2 (stale Phase ref) — execute. (K7)**
  Line 8 docstring: "Templates stay as inline Python strings per Phase H scope. Externalization to ..." — same pattern as icp/prompts.py.
  Est. -2 LOC.

- **Cat 12 (long literals) — design-discussion.**
  5 RESEARCH_MARKET_<N>_TEMPLATE constants, each ~100–150 lines. Externalization deferred per Phase H scope. Punt — overlaps with TD-010.

### backend/app/services/market_scoring/__init__.py (49 LOC)

- **Cat 2 (stale Phase ref) — execute. (K7)**
  Line 1: "market_scoring service — public API (Phase H Sequence A final form)." Rewrite to describe public API neutrally.
  Est. -1 LOC.

### backend/app/services/market_scoring/normalization.py (160 LOC)

Clean. Pure data-shape helpers.

### backend/app/services/market_scoring/orchestrator.py (428 LOC)

- **Cat 1 (unused imports — confirmed safe pair) — execute. (K1)**
  Per `docs/audits/2026-05-25-phase-l-pyflakes-baseline.txt`:
  - line 17: `app.core.exceptions.BrewraError`
  - line 22: `app.models.market_scoring.LeadMarketScoreRow`
  Both are confirmed unreferenced in this module and unreferenced via test-patch (grep `mocker.patch` and `patch(` in `backend/tests/` for these two names against `app.services.market_scoring.orchestrator` returns no hits).
  Strategy: remove both imports.
  Est. -2 LOC.

- **Cat 1 (7-name normalization block) — investigate.**
  Per pyflakes line 29, 7 names from `app.services.market_scoring.normalization` are imported but unreferenced in this file: `_safe_json_to_obj`, `_normalize_non_empty_string`, `_canonicalize_key`, `_build_lookup_maps`, `_first_non_empty_value_from_keys`, `_parse_iso_datetime`, `_lead_to_score_row`.
  Verification question (Stage 2): does the test suite patch these 7 symbols on `app.services.market_scoring.orchestrator` such that removing them would break patch targets? Verify by grepping `mocker.patch` and `patch(` in `backend/tests/` for the 7 symbol names paired with the `app.services.market_scoring.orchestrator.<name>` module path. Resolution: if no test patches them via this module path, promote to K1 execute (~ -7 LOC). If patches exist via this module path, defer until the patch-where-used migration of TD-006 is complete.

### backend/app/services/market_scoring/persistence.py (121 LOC)

- **Cat 7 (cross-file duplicate helper — fetch_company_profile) — execute. (K4)**
  1 site at line 109 (`get_company_profile_for_org`) using the canonical `MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1` pattern.
  Strategy: see Cross-cutting Cat 7.
  Est. -3 LOC.

### backend/app/services/market_scoring/scoring.py (217 LOC)

- **Cat 6 (repeated `update_one` pattern) — execute. (K5)**
  10 `run_coll.update_one({"run_id": run_id}, {"$set": {...}})` sites at lines 48, 55, 69, 83, 97, 112, 162, 173, 192, 208 (matches spec). Each varies only by the `$set` payload and the optional `completed_at` field.
  Strategy: extract `_update_run(run_coll, run_id, **fields) -> None` that wraps the `update_one` call and stamps `updated_at` automatically. The 3 "status: failed + completed_at" sites become `_update_run(run_coll, run_id, status="failed", error=str(e), completed_at=now())`.
  Behavior preservation: identical `$set` semantics; `updated_at` is always added (it is already present at 7 of 10 sites — at the 3 remaining error-path sites adding it is benign).
  Est. -25 LOC (10 sites × ~7 LOC each = ~70 LOC raw → ~10 LOC after helper insertion).

### backend/app/services/org_auth/__init__.py (21 LOC)

Clean. Re-exports.

### backend/app/services/org_auth/orgs.py (152 LOC)

Clean. Mongo CRUD for orgs; `db = mongo["Org_Management"]` appears 3× but each is within a different function and the boilerplate is only 2 lines per site — below Cat 5 threshold for shared service.

### backend/app/services/org_auth/registrations.py (62 LOC)

Clean. 2 `db = mongo["Registration_DB"]` sites, below Cat 5 threshold.

### backend/app/services/pipeline/__init__.py (12 LOC)

- **Cat 2 (stale Phase ref) — execute. (K7)**
  Line 5: "(extracted in Phase K commit 11/13) because LLM-availability probing ..." — rewrite as "(lives in services/health.py)".
  Est. -1 LOC.

### backend/app/services/pipeline/neo4j.py (61 LOC)

Clean.

### backend/app/services/profiles/__init__.py (17 LOC)

Clean. Re-exports.

### backend/app/services/profiles/persistence.py (236 LOC)

Clean. Multiple `MATCH (p:CompanyProfile)` queries but each is semantically distinct (DELETE for replace-then-insert, ORDER BY id for cleanup, etc.) — NOT the K4 fetch-one-profile-read pattern. No Cat 7 finding here.

### backend/app/services/signals/__init__.py (54 LOC)

- **Cat 2 (stale Phase refs) — execute. (K7)**
  Line 1: "signals service — public API (Phase I final form)."
  Line 23: "orchestrator.py was deleted in Phase I commit 8/11 — there is no multi-step ..."
  Rewrite to describe present state.
  Est. -3 LOC.

### backend/app/services/signals/ask.py (275 LOC)

- **Cat 2 (stale Phase ref) — execute. (K7)**
  Line 1 docstring: "Signal Q&A — extracted from orchestrator.py in Phase I commit 7/11."
  Rewrite to describe what the module does without time-stamping the extraction.
  Est. -1 LOC.

- **Cat 7 (cross-file duplicate helper — fetch_company_profile) — execute. (K4)**
  2 inline sites at lines 44 (in `signal_ask`) and 133 (in `signal_ask_claude`) — both using `MATCH (p:CompanyProfile {org_id: $org_id}) RETURN p LIMIT 1`. Notably uses alias `p` instead of `c`; the helper signature must accept either alias style or normalize to one (the alias is local-scope only; the returned record-dict is what callers consume).
  Strategy: see Cross-cutting Cat 7. The helper returns the unwrapped profile dict; the `p`/`c` alias is cosmetic and not visible to consumers.
  Est. -10 LOC (2 sites × ~5 LOC each).

### backend/app/services/signals/batch.py (211 LOC)

- **Cat 2 (stale Phase ref) — execute. (K7)**
  Line 1 docstring: "Signal batch generation — extracted from orchestrator.py in Phase I commit 6/11."
  Rewrite.
  Est. -1 LOC.

- **Cat 3 (near-duplicate scout/profiler signal-generation loops) — investigate.**
  Two nearly identical `for i in range(2):` loops at lines ~165 and ~205, one generating scout signals and one profiler signals. The variation lies in: `pre_data` vs `profiler_pre_data`, agent string ("scout" vs "profiler"), and the headline-mirror branch. Stage 2: assess whether a small unify helper is byte-equivalent.

### backend/app/services/signals/llm.py (16 LOC)

Clean.

### backend/app/services/signals/parsing.py (92 LOC)

- **Cat 2 (stale Phase refs) — execute. (K7)**
  4 lines mention Phase H/I (lines 7, 11, 16, 28). Each describes current behavior in terms of historical decisions; rewrite to describe present semantics.
  Est. -2 LOC.

### backend/app/services/signals/persistence.py (181 LOC)

- **Cat 2 (stale Phase ref) — execute. (K7)**
  Line 5 docstring: "Phase H. All sync (use asyncio.to_thread at the call site for async ..."
  Rewrite without the "Phase H." prefix.
  Est. -1 LOC.

### backend/app/services/signals/prompts.py (328 LOC)

- **Cat 2 (stale Phase refs) — execute. (K7)**
  Line 3: "Templates stay as inline Python strings per Phase H scope. They are ..."
  Line 17: "Extracted from orchestrator.py during Phase H commits 18/20 and 20/20."
  Rewrite both.
  Est. -2 LOC.

- **Cat 12 (long literals) — design-discussion.**
  Scout + Profiler prompt literals each ~80–120 lines. Punt with TD-010.

### backend/app/services/signals/search.py (293 LOC)

- **Cat 2 (stale Phase refs) — execute. (K7)**
  Line 1: "Signal search core — extracted from orchestrator.py in Phase I commit 5/11."
  Line 158 (inline comment): "(extracted to signals.parsing during Phase H commit 19/20)"
  Rewrite both.
  Est. -2 LOC.

- **Cat 3 (scout/profiler persona branches) — design-discussion.**
  `search_signals` has two nested branches selecting scout-vs-profiler data extraction strategy and prompt template. These were deliberately unified per the Phase-I orchestrator deletion. Further consolidation would lose the readable persona-specific extraction logic. Punt — unifying further regresses readability for negligible LOC.

## Clean files (verdict only)

| File | LOC |
|---|---:|
| backend/app/__init__.py | 0 |
| backend/app/core/__init__.py | 0 |
| backend/app/core/clients.py | 68 |
| backend/app/core/config.py | 84 |
| backend/app/core/dependencies.py | 56 |
| backend/app/core/exceptions.py | 150 |
| backend/app/core/logging.py | 9 |
| backend/app/models/customer_profile.py | 76 |
| backend/app/models/graph_chat.py | 30 |
| backend/app/models/icp.py | 53 |
| backend/app/models/leads.py | 91 |
| backend/app/models/market_research.py | 25 |
| backend/app/models/org_auth.py | 36 |
| backend/app/models/pagination.py | 12 |
| backend/app/models/profiles.py | 74 |
| backend/app/models/signals.py | 76 |
| backend/app/routers/__init__.py | 0 |
| backend/app/routers/customer_profile.py | 50 |
| backend/app/routers/graph_chat.py | 91 |
| backend/app/routers/icp.py | 71 |
| backend/app/routers/market_research.py | 39 |
| backend/app/routers/market_scoring.py | 57 |
| backend/app/routers/org_auth.py | 54 |
| backend/app/routers/pipeline.py | 25 |
| backend/app/routers/profiles.py | 45 |
| backend/app/routers/v2/data_sources.py | 19 |
| backend/app/routers/v2/icp.py | 27 |
| backend/app/routers/v2/leads.py | 32 |
| backend/app/routers/v2/org_auth.py | 18 |
| backend/app/routers/v2/signals.py | 20 |
| backend/app/services/__init__.py | 0 |
| backend/app/services/_claude_budget.py | 101 |
| backend/app/services/_retrieval.py | 113 |
| backend/app/services/data_sources/loaders.py | 124 |
| backend/app/services/graph_chat/__init__.py | 29 |
| backend/app/services/graph_chat/neo4j.py | 66 |
| backend/app/services/graph_chat/prospect_pipeline.py | 131 |
| backend/app/services/health.py | 15 |
| backend/app/services/icp/__init__.py | 48 |
| backend/app/services/icp/llm.py | 26 |
| backend/app/services/icp/parsing.py | 13 |
| backend/app/services/leads/normalization.py | 22 |
| backend/app/services/leads/orchestrator.py | 219 |
| backend/app/services/leads/persistence.py | 219 |
| backend/app/services/market_research/llm.py | 25 |
| backend/app/services/market_research/parsing.py | 16 |
| backend/app/services/market_scoring/normalization.py | 160 |
| backend/app/services/org_auth/__init__.py | 21 |
| backend/app/services/org_auth/orgs.py | 152 |
| backend/app/services/org_auth/registrations.py | 62 |
| backend/app/services/pipeline/neo4j.py | 61 |
| backend/app/services/profiles/__init__.py | 17 |
| backend/app/services/profiles/persistence.py | 236 |
| backend/app/services/signals/llm.py | 16 |

Total clean: 53 files.

## Cross-cutting findings

### Cat 7: fetch_company_profile duplication — execute (K4)

9 distinct fetch-one-CompanyProfile-by-org_id read sites across 6 service files. Each is either an inline `with driver.session() as session: ... session.run("MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1", ...)` block, or a thin `def fetch_company_profile():` nested function wrapping the same pattern.

Sites (verified by grep):
| File | Line | Function context | Alias |
|---|---:|---|---|
| services/customer_profile/orchestrator.py | 31 | upsert_customer_profile | c |
| services/customer_profile/orchestrator.py | 153 | get_customer_profile (or sibling) | c |
| services/customer_profile/orchestrator.py | 319 | delete_icp_from_customer_profile (or sibling) | c |
| services/market_scoring/persistence.py | 109 | get_company_profile_for_org | c |
| services/market_research/orchestrator.py | 232+236 | `def fetch_company_profile()` (one fn, two cases) | c |
| services/icp/orchestrator.py | 291+297 | `def fetch_company_profile()` (one fn, two cases) | c |
| services/icp/persistence.py | 211 | delete_recommended_icp helper path (fallback no-org_id variant) | c |
| services/signals/ask.py | 44 | signal_ask | p |
| services/signals/ask.py | 133 | signal_ask_claude | p |

That is 9 distinct sites across 6 files; raw grep matches total 11 lines (the `def fetch_company_profile()` cases each have 2 MATCH lines for the org_id-or-fallback branch). Including `icp/persistence.py:211` which is a fallback-only no-org_id variant, the spec's "8 sites across 5 files" should read **9 sites across 6 files** — count drift documented here (signals/ask.py at 2 sites was undercounted in spec by 1; icp/persistence.py adds a fallback-only variant).

Strategy: extract `fetch_company_profile(driver, org_id: Optional[str] = None) -> Optional[dict]` to `services/_neo4j_helpers.py`. Returns the unwrapped profile dict (already JSON-decoded for the `socialMediaUrls` field if present), or None. Both the org_id-filtered and the fallback-no-filter behaviors are preserved by passing `org_id=None`. The `p` vs `c` alias is internal — consumers receive a dict.

Each callsite collapses from 5–10 lines to 1–2 lines:
```python
record = await asyncio.to_thread(fetch_company_profile, driver, request.org_id)
```

Estimated saving:
- customer_profile/orchestrator.py: -15 LOC (3 sites × 5)
- market_research/orchestrator.py: -8 LOC
- icp/orchestrator.py: -8 LOC
- icp/persistence.py: -3 LOC
- market_scoring/persistence.py: -3 LOC
- signals/ask.py: -10 LOC (2 sites × 5)
- Helper itself: +8 LOC (in `_neo4j_helpers.py`)

K4 net total: **~ -39 LOC**.

### Cat 5: `db = mongo["File_Processing"]; collection = db["file_status"]` — execute (K6)

11 sites across `services/data_sources/{persistence,pipeline}.py`. Each is the same 2-line boilerplate.

Sites:
- persistence.py: 23, 49, 98, 340 (4 sites)
- pipeline.py: 44, 169, 194, 211, 288, 376, 407 (7 sites)

Strategy: extract `_get_file_collection(mongo)` (private to `data_sources/`) returning the `file_status` Mongo collection. Each callsite collapses from 2 lines to 1.

```python
collection = _get_file_collection(mongo)
```

Placement: define in `services/data_sources/persistence.py` (top of file as a private helper); import-from-module in `pipeline.py` (`from app.services.data_sources.persistence import _get_file_collection`). Tests that patch `mongo` continue to work because the helper takes `mongo` as a parameter.

Estimated saving: 11 sites × 1 line = -11 LOC; helper +3 LOC. K6 net: **~ -8 LOC**.

### Cat 2: TD-009 stale Phase/commit references — execute (K7)

25 grep matches across 12 files. Each is a docstring or comment referencing the Phase letter (G/H/I/K) or commit number (e.g., "Phase I commit 5/11") in which the current code was extracted or reorganized. The references are historical context that no longer adds value now that those phases have shipped.

Strategy: rewrite each occurrence to describe present-time behavior, dropping the Phase/commit time-stamp. Examples:
- "extracted from orchestrator.py in Phase I commit 5/11" → "Signal search core."
- "market_research service — public API (Phase H Sequence C final form)" → "market_research service — public API."
- "(extracted in Phase K commit 11/13) because LLM-availability probing ..." → "(lives in services/health.py)."
- Inline comments referencing "Phase H/I commits" same pattern.

Per-file (matches Cat 2 entries above):
| File | Lines | Sites |
|---|---|---:|
| routers/leads.py | 28 | 1 |
| routers/signals.py | 74 | 1 |
| services/market_scoring/__init__.py | 1 | 1 |
| services/_llm_helpers.py | 202 | 1 |
| services/pipeline/__init__.py | 5 | 1 |
| services/market_research/__init__.py | 1 | 1 |
| services/market_research/prompts.py | 8 | 1 |
| services/market_research/persistence.py | 14 | 1 |
| services/data_sources/__init__.py | 1, 3, 9 | 3 |
| services/icp/prompts.py | 3 | 1 |
| services/signals/search.py | 1, 158 | 2 |
| services/signals/ask.py | 1 | 1 |
| services/signals/__init__.py | 1, 23 | 2 |
| services/signals/prompts.py | 3, 17 | 2 |
| services/signals/batch.py | 1 | 1 |
| services/signals/persistence.py | 5 | 1 |
| services/signals/parsing.py | 7, 11, 16, 28 | 4 |
| **Total** |  | **25** |

Net LOC: this is a wording rewrite, not a deletion sweep. The estimate per site is between -0 and -2 LOC (sometimes the rewrite is shorter, sometimes the same length); aggregate: **~ -25 LOC**.

This satisfies TD-009 (the docstring/comment drift sweep).

### Cat 1: K1 unused-import sweep — execute

Pyflakes-verified unused imports outside the package-re-export false positives. Each is a single-name removal, confirmed safe to drop in Stage 1.

| File | Line | Symbol | Verified by pyflakes |
|---|---:|---|---|
| models/data_sources.py | 2 | `typing.Dict` | yes |
| models/market_scoring.py | 2 | `typing.Any` | yes |
| models/pipeline.py | 2 | `typing.Dict` | yes |
| routers/data_sources.py | 4 | `fastapi.HTTPException` | yes |
| routers/data_sources.py | 15 | `app.core.logging.logger` | yes |
| services/_neo4j_helpers.py | 5 | `typing.Any` | yes |
| services/icp/persistence.py | 23 | `_build_market_context_queries`, `_fetch_pinecone_supporting_context` (both from `app.services._retrieval`) | yes |
| services/market_scoring/orchestrator.py | 17 | `app.core.exceptions.BrewraError` | yes |
| services/market_scoring/orchestrator.py | 22 | `app.models.market_scoring.LeadMarketScoreRow` | yes |

NOT in this K1 execute table (deferred to Stage 2 investigate):
- `services/market_scoring/orchestrator.py` line 29 (7-name normalization-block import) — see Stage 2 promoted/deferred table.

Hard count of confirmed-safe removable symbols: **10** (= 1+1+1+1+1+1+2+1+1 from the K1 table rows). Spec's "~16 symbols" anticipated the 7-name normalization block; with that block split to investigate, the confirmed-safe count is 10. If Stage 2 promotes the 7-name block, K1 final count becomes 17 (= 10 + 7).

K1 net LOC: each unused name removal trims either 1 LOC (single-name line) or 0 LOC (multi-name import, drops only the comma). Estimated **~ -7 to -10 LOC** (confirmed-safe set). Conservative target: **-10 LOC**. If the 7-name block promotes in Stage 2, add ~ -7 LOC.

NOT addressed by K1 (kept intentionally):
- `app/models/__init__.py:1` `PaginatedResponse` — has `# noqa: F401`, is a deliberate package-API re-export.
- `app/services/customer_profile/__init__.py:13` — 4 unused names, deliberate re-exports; recommend adding `# noqa: F401` per import or `__all__` (handled in K1 commit as a follow-up sub-action).
- `app/services/leads/__init__.py:16,20` — 7 unused names, deliberate re-exports; same `# noqa: F401` recommendation.

## Future work (design-discussion)

| # | Item | Rationale |
|---|---|---|
| D1 | `app/main.py` exception-handler consolidation via STATUS_BY_EXC registry | Loses explicit per-exception handler body that doubles as documentation; the 8 handlers are stable. Punt. |
| D2 | `app/main.py` `from app.routers import X; include_router(X.router)` block as a loop | Minor visual cleanup; cost: explicit module attribution lost for grep+test-patch use cases. Punt. |
| D3 | `app/routers/v2/__init__.py` spec-pointer reference (Phase G) | Single-line file-name reference (informative), not stale prose. Punt; reword optional. |
| D4 | `app/services/customer_profile/__init__.py` + `app/services/leads/__init__.py` `# noqa: F401` cleanup | Cosmetic (silences pyflakes false positives); zero LOC. Pursue as TD-011 follow-up. |
| D5 | Cat 12 — externalize prompt literals (`icp/prompts.py`, `signals/prompts.py`, `market_research/prompts.py`, `core/llm_config.py`) to YAML/JSON | Touches the public consumption surface of all 3 research services + Cypher chain. Overlaps with TD-010. Punt. |
| D6 | `signals/search.py` scout-vs-profiler persona unification | Further unification regresses persona-specific readability. Punt. |

## Promoted / deferred (Stage 2)

| Item | Reason for investigation |
|---|---|
| `services/_llm_helpers.py` line ~30 — verify single-consumer status of `_tavily_context_and_urls`, `_claude_messages_text` | Cat 8 check. |
| `services/icp/persistence.py` ICP-normalization branches (multi-key list/str defaults) | Cat 3 check — behavior surface depends on whether each key's list-default vs str-default is observable to callers. |
| `services/market_scoring/orchestrator.py` line 29 — 7-name normalization-block import (`_safe_json_to_obj`, `_normalize_non_empty_string`, `_canonicalize_key`, `_build_lookup_maps`, `_first_non_empty_value_from_keys`, `_parse_iso_datetime`, `_lead_to_score_row`) | Does the test suite patch any of these symbols on `app.services.market_scoring.orchestrator` such that removing the import would break patch targets? Verify by grepping `mocker.patch` and `patch(` in `backend/tests/` for each name paired with the `app.services.market_scoring.orchestrator.<name>` module path. Resolution: if no test patches via this module path, promote to K1 execute (est. ~ -7 LOC). If patches exist via this module path, defer until the patch-where-used migration of TD-006 is complete. |
| `services/signals/batch.py` scout/profiler `for i in range(2):` loops | Cat 3 — assess whether a small helper byte-preserves behavior. |
| Cat 5 expansion — non-File_Processing `mongo[X]` sites | Are the 21 non-File_Processing `mongo[X]` sites (`org_auth/orgs.py`, `org_auth/registrations.py`, `customer_profile/orchestrator.py`, `icp/persistence.py`, `leads/persistence.py`, `market_scoring/persistence.py`, `profiles/persistence.py`, `signals/persistence.py`) candidates for a generic `_get_collection(mongo, db, coll)` helper? Verify behavior shapes per-site and decide promote (would extend K6 scope by ~21 sites, est. ~ -15 LOC additional after helper) or defer (preserve readable per-service collection pinning). Defaulting to defer pending Stage 2 evidence. |

These will be resolved in Stage 2 (Task 2 / commit 2). The Summary table above shows `TBD (Stage 2)` for the "Investigated → promoted" and "Investigated → deferred" rows; Stage 2 will populate concrete counts.
