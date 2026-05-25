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
| `pipeline.py` | 74 |

These were deferred through Phases H–J because structural decomposition of the larger services was higher-leverage. With Phase J complete and the codebase's import conventions stabilized, the TD-008 pull-forward trigger has fired: converting these six files to packages is the natural next step.

**Scope:** Convert all six flat services to packages. No TD-008 LOC reduction, no TD-009 docstring audit — those remain a follow-on phase.

**Scope exclusion — underscore-prefixed helpers.** Four flat files with leading underscores remain under `backend/app/services/` and are intentionally out of scope for Phase K:

| File | LOC |
|---|---:|
| `_llm_helpers.py` | 233 |
| `_retrieval.py` | 113 |
| `_claude_budget.py` | 101 |
| `_neo4j_helpers.py` | 71 |

These are private cross-cutting utilities consumed by multiple service packages (e.g., `icp/`, `signals/`, `market_research/` all import from `_llm_helpers`). Package-converting them would either (a) create cyclic-style dependencies across service packages, or (b) require lifting them out of `services/` into a separate utility module — both of which are larger refactors than the mechanical decomposition Phase K is scoped to. They keep their underscore convention and flat structure; a future phase can address them if and when their LOC or coupling becomes a problem.

**Uniform structure decision:** All six *public* (non-underscore) flat services are package-converted regardless of LOC. The smallest target (`pipeline.py`, 74 LOC) does not justify the package overhead on its own merits, but heterogeneous service layouts — some packages, some flat files — create persistent cognitive overhead during navigation and grep. The uniformity benefit outweighs the per-file overhead.

---

## §2 Architecture

**Approach:** Option A — per-service sequences (A–F), Phase H pattern. Each service gets its own commit sequence; sequences execute in order, largest-first.

**Execution order rationale:** Largest sequences first surfaces structural problems early, while there is still room to revise the sequence design; smaller sequences then benefit from patterns established by the larger ones.

| Seq | Service | LOC | Mock concerns | Commits |
|-----|---------|----:|---------------|--------:|
| A | `leads` | 465 | None | 2 |
| B | `customer_profile` | 385 | 6 patch paths (merged into split commit) | 2 |
| C | `profiles` | 236 | None | 2 |
| D | `org_auth` | 210 | None | 2 |
| E | `graph_chat` | 209 | None | 2 |
| F | `pipeline` | 74 | None (but adds preamble commit, see §3.6) | 3 |

**Per-sequence commit structure:**

1. **Scaffold commit** — `mkdir backend/app/services/<svc>`, then `git mv backend/app/services/<svc>.py backend/app/services/<svc>/__init__.py`. (`git mv` does not create intermediate directories; the `mkdir` step is required.) The moved file becomes the package `__init__.py` unchanged. Run `pytest`; must be green before proceeding.
2. **Split commit** — create submodules, move functions, rewrite internal imports per mock-semantics rules. For Sequence B, this commit *also* updates the 6 `mocker.patch` strings in `test_customer_profile.py` (see §4) — the patch-path update and the structural split are bundled into one commit because performing them separately would leave pytest red between commits. Run `pytest`; must be green.

**Rollback:** If pytest fails after any commit, `git reset --hard HEAD~1` reverts the commit. Diagnose the failure and re-plan before re-attempting — do not edit the working tree to "fix forward" past a failed gate.

**Sequence F note:** Sequence F has an additional preamble commit (commit 0) that extracts `probe_llm` from `pipeline.py` into a new `services/health.py` flat file. See §3 Sequence F for the rationale and the resulting 3-commit structure.

---

## §3 Submodule model

**Circular-import check (all sequences):** Each split was checked for cross-submodule call chains that would create import cycles. Findings:

- **Sequence A (leads):** `persistence.py` → `normalization.py` (one-way: `_process_neo4j_lead_records`). `orchestrator.py` is independent. No cycle.
- **Sequence B (customer_profile):** Single submodule (`orchestrator.py`); no internal cross-imports possible.
- **Sequence C (profiles):** Single submodule (`persistence.py`); no internal cross-imports.
- **Sequence D (org_auth):** `orgs.py` and `registrations.py` contain disjoint function sets; no cross-calls in the current code. No cycle.
- **Sequence E (graph_chat):** `prospect_pipeline.py` → `prospect_pipeline.py` only (`score_prospect` calls `extract_number`, both in the same submodule). `neo4j.py` is independent. No cycle.
- **Sequence F (pipeline):** Single submodule (`neo4j.py`); no internal cross-imports.

No sequence requires inter-submodule cycle resolution.

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

**Internal import rule:** `persistence.py` imports `_process_neo4j_lead_records` via `from .normalization import _process_neo4j_lead_records`. The two call sites are inside `get_leads_for_org` (current `leads.py:49`) and `list_leads_by_file` (current `leads.py:379`), both of which are destined for `persistence.py` — `orchestrator.py`'s functions (`batch_upload_leads`, `delete_leads_by_file`) do not call it. The symbol is not patched in any test — from-import is safe.

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
├── __init__.py          # public re-exports (see §3.5)
├── neo4j.py             # create_prospect_node, get_ranked_prospects,
│                        #   run_cypher_query, add_engagement
└── prospect_pipeline.py # convert_audio_to_text, get_linkedin_followers,
                         #   get_linkedin_recent_activity, extract_linkedin_username,
                         #   calculate_prospect_score, extract_number, score_prospect
```

**§3.5 `__init__.py` re-exports:** all 11 public functions

`prospect_pipeline.py` contains the full prospect-scoring pipeline: audio transcription → LinkedIn enrichment → score calculation → LLM scoring. The name reflects the pipeline's scope rather than just its scoring tail — five of the seven functions in this module are enrichment/extraction steps, not scoring per se. `neo4j.py` contains all graph read/write operations. No unit tests, no `mocker.patch` calls.

External caller: `data_sources/loaders.py` imports `score_prospect` via `from app.services.graph_chat import score_prospect` — satisfied by `__init__.py` re-export, no edit needed.

---

### Sequence F — pipeline

**Pre-decomposition extraction (commit 0):**

`pipeline.py` currently contains two functions: `compute_sales_pipeline` (Neo4j stage-count aggregator) and `probe_llm` (LLM-availability smoke probe that invokes langchain). These two functions share no concerns — they were colocated only because the same router (`backend/app/routers/pipeline.py`) serves both. Lumping an LLM probe into a `pipeline/` package alongside a Neo4j read would propagate the existing categorical confusion rather than resolve it.

Commit 0 extracts `probe_llm` to a new flat service file `backend/app/services/health.py`. It then edits `backend/app/routers/pipeline.py`:

- Add a new top-of-file import: `from app.services.health import probe_llm`
- Preserve the existing `from app.services import pipeline as pipeline_service` import (still used by `compute_sales_pipeline`)
- Update the `/test-llm` handler body (line 24) from `pipeline_service.probe_llm(llm2)` to `probe_llm(llm2)`

The `/test-llm` route URL doesn't change; no client impact. After commit 0, `pipeline.py` contains only `compute_sales_pipeline`.

Commit 0 also updates `pipeline.py`'s module docstring (currently `"""Pipeline service: sales-pipeline aggregator + LLM probe."""`) to remove the "+ LLM probe" suffix — leaving the existing docstring intact after extraction would actively misrepresent the file's contents. This is the only docstring change Phase K requires; broader docstring work remains in TD-009 follow-on scope.

**Package layout (after commits 1–2):**

```
pipeline/
├── __init__.py  # re-exports compute_sales_pipeline
└── neo4j.py     # compute_sales_pipeline
```

Commit 1 scaffolds (`mkdir` + `git mv pipeline.py pipeline/__init__.py`); commit 2 splits `compute_sales_pipeline` out into `pipeline/neo4j.py` and updates `__init__.py` to re-export it.

**`services/health.py` (created in commit 0):**

The file is created by moving `probe_llm` from `pipeline.py` verbatim, preserving the existing lazy `from langchain_core.messages import HumanMessage` inside the function body. The lazy-import linter (see §6) only flags `from app.services.*` imports — `langchain_core` is not subject to it, so no annotation is needed.

`health.py` is intentionally created as a flat file, not a package. It currently contains a single function and has no near-term growth plan — adding a package wrapper for one function would be the kind of premature structure Phase K's uniformity rationale (see §1) does not justify (uniformity applies to the six *existing* flat services being decomposed; new services follow normal sizing rules).

No external callers besides the router; no test suite for `probe_llm`.

---

## §4 Mock-semantics rules

Only Sequence B has patched symbols. For all other sequences the tests use injected mock drivers — no `mocker.patch` interception concerns.

### Sequence B patch inventory

| Test file | Line(s) | Symbol | Current patch path |
|-----------|---------|--------|--------------------|
| `test_customer_profile.py` | 49, 92, 129, 188 | `_reserve_unique_icp_id` | `app.services.customer_profile._reserve_unique_icp_id` |
| `test_customer_profile.py` | 244, 262 | `_release_icp_id` | `app.services.customer_profile._release_icp_id` |

**During Sequence B commit 2**, the binding for both symbols moves from `customer_profile.py`'s module dict to `customer_profile/orchestrator.py`'s module dict. The same commit updates all 6 patch strings in `test_customer_profile.py` (structural split and patch-path update are bundled; see §2 commit structure for why):

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

Before executing each sequence, run the grep for that service's name — e.g. before Sequence A:
```bash
grep -r "mocker\.patch.*app\.services\.leads" backend/tests/
```
Replace `leads` with the relevant service name (`customer_profile`, `profiles`, `org_auth`, `graph_chat`, `pipeline`) for each sequence. Confirm the result matches the inventory in this spec. If unexpected patch paths appear, update the commit plan before proceeding.

---

## §5 External caller handling

External callers use two import patterns; both are satisfied by the `__init__.py` re-exports:

**Pattern A — direct symbol import** (`from app.services.<svc> import X`): the imported name is bound at the caller's module level. The `__init__.py` re-export makes `X` available as an attribute of the package, which is what `from ... import X` resolves against.

**Pattern B — module-level import** (`from app.services import <svc> as svc_alias` or `import app.services.<svc> as svc_alias`): the caller binds the whole package object and dereferences function calls as `svc_alias.X(...)`. For these to work, `X` must be an attribute of the package — which the `__init__.py` re-export accomplishes automatically (a `from .submodule import X` statement in `__init__.py` creates `X` as a module-level attribute of the package). The spec's re-export lists in §3.1–§3.5 are complete; no additional `__all__` declaration is required.

The single caller that requires an *edit* in Phase K is `routers/pipeline.py` (Sequence F commit 0 — see §3 Sequence F). All other callers continue to work unchanged because the import paths are preserved and the re-exports cover every symbol they reference.

**Known external callers (Pattern A — direct symbol imports):**

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

**Known external callers (Pattern B — module-level imports):**

| Caller | Import statement | Service | Handled by |
|--------|------------------|---------|-----------|
| `app/routers/customer_profile.py:5` | `from app.services import customer_profile as cp_service` | customer_profile | `__init__.py` re-exports expose all 4 functions as package attributes |
| `app/routers/profiles.py:5` | `from app.services import profiles as profiles_service` | profiles | `__init__.py` re-exports expose all 4 functions as package attributes |
| `app/routers/org_auth.py:8` | `from app.services import org_auth as org_auth_service` | org_auth | `__init__.py` re-exports expose all 5 functions as package attributes |
| `app/routers/graph_chat.py:14` | `from app.services import graph_chat as graph_chat_service` | graph_chat | `__init__.py` re-exports expose all 11 functions as package attributes |
| `app/routers/leads.py:15` | `import app.services.leads as leads_service` | leads | `__init__.py` re-exports expose all 9 functions as package attributes |
| `app/routers/pipeline.py:5,24` | `from app.services import pipeline as pipeline_service` | pipeline → health | **Edited in Sequence F commit 0** — after commit 0, `pipeline_service.probe_llm` no longer exists; router uses `from app.services.health import probe_llm` for that call site, while the `compute_sales_pipeline` call site continues to use `pipeline_service.compute_sales_pipeline(...)`. The existing module-level `from app.services import pipeline as pipeline_service` import is preserved. |

`get_leads_for_org` is patched in test suites for `market_scoring` and `signals` at the *caller-side* binding (e.g. `app.services.market_scoring.scoring.get_leads_for_org`) — not at the leads package path. Re-export does not affect those patches.

---

## §6 Acceptance criteria

1. `pytest` baseline recorded before Phase K begins (Task 0 of the plan): capture the passing count with `pytest --tb=no -q | tail -1` and note it in the plan's Task 0 completion note.
2. After each commit in each sequence: `pytest` passes with the same count.
3. After all 6 sequences:
   - **Submodule-bypass check** — `grep -rE "from app\.services\.(leads|customer_profile|graph_chat|org_auth|profiles|pipeline)\.[a-z_]+ import" backend/app/` returns no matches. This grep detects external imports of the form `from app.services.leads.persistence import X` that would bypass `leads/__init__.py` and reach into a submodule directly. (Module-level imports like `from app.services import leads as leads_service` and direct-symbol imports like `from app.services.leads import X` are *expected* and inherently use `__init__.py`; they're not what this grep is checking.)
   - Phase J lazy-import linter passes: `pytest backend/tests/unit/test_no_lazy_service_imports.py::test_no_unannotated_lazy_service_imports`. This test scans every `*.py` under `backend/app/services/` and flags any unannotated `from app.services...` import nested inside a function body — including the new submodules and `services/health.py` introduced by Phase K.
4. No v1 router or integration test regressions. ("v1 routers" are the flat routers under `backend/app/routers/*.py`, which still serve production traffic alongside the newer `backend/app/routers/v2/` set; both must continue to pass their respective tests after Phase K.)
