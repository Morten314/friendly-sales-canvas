# Phase K — Flat Service Decomposition

**Date:** 2026-05-25
**Phase:** K (follows Phase J lazy-import cycle removal, completed 2026-05-25)
**Status:** Design approved, awaiting implementation plan

---

## §1 Context and motivation

Phases B–J decomposed five large service files into packages (`icp/`, `signals/`, `market_research/`, `market_scoring/`, `data_sources/`). Six flat files remain under `backend/app/services/`:

| File | LOC |
|---|---:|
| `leads.py` | 465 |
| `customer_profile.py` | 385 |
| `profiles.py` | 236 |
| `org_auth.py` | 210 |
| `graph_chat.py` | 209 |
| `pipeline.py` | ~100 |

These were deferred through Phases H–J because structural decomposition of the larger services was higher-leverage. With Phase J complete and the codebase's import conventions stabilised, the TD-008 pull-forward trigger has fired: converting these six files to packages is the natural next step.

**Scope:** Convert all six flat services to packages. No TD-008 LOC reduction, no TD-009 docstring audit — those remain a follow-on phase.

---

## §2 Architecture

**Approach:** Option A — per-service sequences (A–F), Phase H pattern. Each service gets its own commit sequence; sequences execute in order, largest-first.

**Execution order:**

| Seq | Service | LOC | Mock concerns |
|-----|---------|----:|---------------|
| A | `leads` | 465 | None |
| B | `customer_profile` | 385 | 6 patch paths to update |
| C | `profiles` | 236 | None |
| D | `org_auth` | 210 | None |
| E | `graph_chat` | 209 | None |
| F | `pipeline` | ~100 | None |

**Per-sequence commit structure:**

1. **Scaffold commit** — `git mv service.py service/__init__.py`, write stub `__init__.py` that re-exports everything. Run `pytest`; must be green before proceeding.
2. **Split commit** — create submodules, move functions, rewrite internal imports per mock-semantics rules. Run `pytest`; must be green.
3. **Patch-path commit** (Sequence B only) — update 6 `mocker.patch` strings in `test_customer_profile.py`. Run `pytest`; must be green.

---

## §3 Submodule model

### Sequence A — leads

```
leads/
├── __init__.py       # public re-exports (see §3.1)
├── orchestrator.py   # batch_upload_leads, delete_leads_by_file
├── persistence.py    # _ensure_leads_indexes, get_leads_for_org, create_lead,
│                     #   update_lead, delete_lead, list_leads_by_file, get_stream_status
└── normalization.py  # _process_neo4j_lead_records (private — not re-exported)
```

**§3.1 `__init__.py` re-exports:**
`_ensure_leads_indexes`, `get_leads_for_org`, `create_lead`, `update_lead`, `delete_lead`, `batch_upload_leads`, `list_leads_by_file`, `get_stream_status`, `delete_leads_by_file`

**Internal import rule:** `orchestrator.py` imports `_process_neo4j_lead_records` via `from .normalization import _process_neo4j_lead_records`. This symbol is not patched in any test — from-import is safe.

**Rationale:** `batch_upload_leads` (CSV/XLSX parsing + bulk Neo4j write) and `delete_leads_by_file` (Neo4j + Mongo multi-step delete) are orchestration flows. All other functions are direct DB reads/writes → persistence. `_process_neo4j_lead_records` is a private data-transformation helper.

---

### Sequence B — customer_profile

```
customer_profile/
├── __init__.py      # public re-exports (see §3.2)
└── orchestrator.py  # upsert_customer_profile, get_customer_profile,
                     #   create_from_suggested_icp, delete_icp_from_customer_profile
```

**§3.2 `__init__.py` re-exports:**
`upsert_customer_profile`, `get_customer_profile`, `create_from_suggested_icp`, `delete_icp_from_customer_profile`

**Why all 4 functions in one submodule:** Both write functions (`upsert_customer_profile`, `create_from_suggested_icp`) *and* the read function (`get_customer_profile`) call `_reserve_unique_icp_id`. Splitting them would require duplicating the icp import binding across two submodules and would split the 6 test patch paths across multiple addresses. Keeping all 4 in `orchestrator.py` gives one binding location and one patch-path prefix.

**ICP import in orchestrator.py:**
```python
from app.services.icp import _reserve_unique_icp_id, _release_icp_id
```
These remain module-level from-imports. The binding lives in `orchestrator.__dict__` — the "patch where used" rule is satisfied without needing module-import syntax.

---

### Sequence C — profiles

```
profiles/
├── __init__.py     # public re-exports (see §3.3)
└── persistence.py  # upsert_profile, get_profile,
                    #   cleanup_company_profiles, edit_profile_field
```

**§3.3 `__init__.py` re-exports:**
`upsert_profile`, `get_profile`, `cleanup_company_profiles`, `edit_profile_field`

All four functions are DB operations (Neo4j driver or Mongo). No orchestration layer. Tests inject mock drivers as arguments — no `mocker.patch` calls.

---

### Sequence D — org_auth

```
org_auth/
├── __init__.py       # public re-exports (see §3.4)
├── orgs.py           # list_orgs, create_org, connect_user_to_org
└── registrations.py  # list_registrations, create_registration
```

**§3.4 `__init__.py` re-exports:**
`list_orgs`, `create_org`, `connect_user_to_org`, `list_registrations`, `create_registration`

Split by entity: org lifecycle management vs. registration management. Tests inject mock Mongo — no `mocker.patch` calls.

---

### Sequence E — graph_chat

```
graph_chat/
├── __init__.py  # public re-exports (see §3.5)
├── neo4j.py     # create_prospect_node, get_ranked_prospects,
│                #   run_cypher_query, add_engagement
└── scoring.py   # convert_audio_to_text, get_linkedin_followers,
                 #   get_linkedin_recent_activity, extract_linkedin_username,
                 #   calculate_prospect_score, extract_number, score_prospect
```

**§3.5 `__init__.py` re-exports:** all 11 public functions

`scoring.py` contains the full prospect-scoring pipeline: audio transcription → LinkedIn enrichment → score calculation → LLM scoring. `neo4j.py` contains all graph read/write operations. No unit tests, no `mocker.patch` calls.

External caller: `data_sources/loaders.py` imports `score_prospect` via `from app.services.graph_chat import score_prospect` — satisfied by `__init__.py` re-export, no edit needed.

---

### Sequence F — pipeline

```
pipeline/
├── __init__.py  # re-exports compute_sales_pipeline, get_timeframe_comparison
└── neo4j.py     # compute_sales_pipeline, get_timeframe_comparison
```

Both functions are pure Neo4j reads. No tests, no external service callers (only routers). Smallest sequence.

---

## §4 Mock-semantics rules

Only Sequence B has patched symbols. For all other sequences the tests use injected mock drivers — no `mocker.patch` interception concerns.

### Sequence B patch inventory

| Test file | Line(s) | Symbol | Current patch path |
|-----------|---------|--------|--------------------|
| `test_customer_profile.py` | 48, 91, 128, 187 | `_reserve_unique_icp_id` | `app.services.customer_profile._reserve_unique_icp_id` |
| `test_customer_profile.py` | 244, 262 | `_release_icp_id` | `app.services.customer_profile._release_icp_id` |

**After Sequence B commit 2**, the binding for both symbols moves from `customer_profile.py`'s module dict to `customer_profile/orchestrator.py`'s module dict. Commit 3 updates all 6 patch strings:

```python
# Before
mocker.patch("app.services.customer_profile._reserve_unique_icp_id", ...)
mocker.patch("app.services.customer_profile._release_icp_id")

# After
mocker.patch("app.services.customer_profile.orchestrator._reserve_unique_icp_id", ...)
mocker.patch("app.services.customer_profile.orchestrator._release_icp_id")
```

**Why this works:** `orchestrator.py` has `from app.services.icp import _reserve_unique_icp_id, _release_icp_id` at module level. Calls to these names inside orchestrator.py resolve through `orchestrator.__dict__`. Patching at `orchestrator._reserve_unique_icp_id` replaces that binding — all callers in orchestrator.py are intercepted. Standard "patch where used" rule.

### Pre-flight grep (all sequences)

Before executing each sequence, run:
```bash
grep -r "mocker\.patch.*app\.services\.<svc>" backend/tests/
```
Confirm the result matches the inventory in this spec. If unexpected patch paths appear, update the commit plan before proceeding.

---

## §5 External caller handling

All external `from app.services.<svc> import X` call sites are satisfied by the `__init__.py` re-exports. No external file requires editing in any sequence.

**Known external callers:**

| Caller | Symbol | Service | Handled by |
|--------|--------|---------|-----------|
| `app/main.py:29` | `_ensure_leads_indexes` | leads | `leads/__init__.py` re-export |
| `app/routers/v2/leads.py:7` | `get_leads_for_org`, `list_leads_by_file` | leads | `leads/__init__.py` re-export |
| `app/routers/v2/org_auth.py:6` | `list_registrations` | org_auth | `org_auth/__init__.py` re-export |
| `market_scoring/scoring.py:20` | `get_leads_for_org` | leads | `leads/__init__.py` re-export |
| `market_scoring/orchestrator.py:27` | `get_leads_for_org` | leads | `leads/__init__.py` re-export |
| `signals/search.py:23` | `get_leads_for_org` | leads | `leads/__init__.py` re-export |
| `signals/batch.py:22` | `get_leads_for_org` | leads | `leads/__init__.py` re-export |
| `data_sources/loaders.py:15` | `score_prospect` | graph_chat | `graph_chat/__init__.py` re-export |

`get_leads_for_org` is patched in test suites for `market_scoring` and `signals` at the *caller-side* binding (e.g. `app.services.market_scoring.scoring.get_leads_for_org`) — not at the leads package path. Re-export does not affect those patches.

---

## §6 Acceptance criteria

1. `pytest` baseline recorded before Phase K: all tests pass.
2. After each commit in each sequence: `pytest` passes with the same count.
3. After all 6 sequences:
   - `grep -r "from app\.services\.\(leads\|customer_profile\|graph_chat\|org_auth\|profiles\|pipeline\) import" backend/app/` — all call sites resolve through `__init__.py` re-exports.
   - Phase J lazy-import linter (`test_lazy_service_import`) passes.
4. No v1 router or integration test regressions.
