---
artifact: specs/11-backend-flat-service-decomposition-phase-k-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-25
round: 1
---

## Findings

### Critical — Sequence F references nonexistent function `get_timeframe_comparison`

**Location:** §3 "Sequence F — pipeline", module tree and `__init__.py` comment

The spec lists `get_timeframe_comparison` as one of two functions in `pipeline.py`, alongside `compute_sales_pipeline`. The actual `backend/app/services/pipeline.py` (74 LOC) contains `compute_sales_pipeline` and `probe_llm` — there is no `get_timeframe_comparison` anywhere in the codebase (verified by `grep -r get_timeframe_comparison backend/`).

This means:
- The `__init__.py` re-export list is wrong.
- The submodule content description is wrong.
- The submodule file `neo4j.py` is named and described as "pure Neo4j reads" but `probe_llm` invokes an LLM via langchain — it is not a Neo4j operation at all.

A plan derived from this spec would fail at the `git mv` + split step for Sequence F, because the function it expects to move does not exist.

### Critical — Sequence B commits 2→3 create an unavoidable red-pytest gap

**Location:** §2 "Per-sequence commit structure", items 2 and 3; §4 "Sequence B patch inventory"

The spec mandates "Run `pytest`; must be green before proceeding" after every commit. For Sequence B:

- **Commit 2 (split):** moves all four functions into `orchestrator.py`. The `__init__.py` now does `from .orchestrator import upsert_customer_profile, ...` — it re-exports the four public functions. It does **not** re-export `_reserve_unique_icp_id` or `_release_icp_id`, because those are private ICP-package symbols imported inside `orchestrator.py` via `from app.services.icp import ...`.
- **After commit 2:** the names `_reserve_unique_icp_id` and `_release_icp_id` are no longer in `customer_profile.__init__.__dict__`. The six test patches at `app.services.customer_profile._reserve_unique_icp_id` (lines 49, 92, 129, 188) and `app.services.customer_profile._release_icp_id` (lines 244, 262) will silently fail to intercept — `mocker.patch` on a non-existent attribute still succeeds but patches nothing meaningful, and the tests will hit the real ICP functions (which require a live Mongo connection in CI), causing failures.
- **Commit 3 (patch-path fix):** updates the six strings to `app.services.customer_profile.orchestrator._reserve_unique_icp_id`, which is correct.

The problem: between commits 2 and 3, pytest is red. This directly violates the spec's own green-after-every-commit rule.

**Fix options:**
1. Merge commits 2 and 3 into a single commit for Sequence B (split + patch-path update together).
2. In commit 2, temporarily re-export `_reserve_unique_icp_id` and `_release_icp_id` from `__init__.py` so the old patch paths still resolve, then remove the temporary re-exports in commit 3 alongside the patch-path update.

### High — Acceptance criterion references `test_lazy_service_import` which does not exist

**Location:** §6 acceptance criteria, item 3

> "Phase J lazy-import linter (`test_lazy_service_import`) passes."

A grep for `test_lazy_service_import` across `backend/tests/` returns zero matches. This acceptance criterion is unverifiable as written. Either the test name is wrong, the test was never created, or the reference is stale.

### High — Sequence F submodule `neo4j.py` is misnamed given actual contents

**Location:** §3 "Sequence F — pipeline"

The spec names the submodule `neo4j.py` and describes both functions as "pure Neo4j reads." The actual second function is `probe_llm`, which:
- Imports `langchain_core.messages.HumanMessage` locally.
- Invokes an LLM via `llm2.invoke(messages)`.
- Returns a status dict, not a Neo4j result.

Placing an LLM smoke-probe in a file called `neo4j.py` is a categorization error that will confuse future readers. Either:
- Rename the submodule to something generic (e.g., `pipeline.py` or `queries.py`), or
- Split into two submodules (e.g., `neo4j.py` for `compute_sales_pipeline` and a separate file for `probe_llm`), or
- Accept `probe_llm` is too small to warrant its own submodule and document the naming compromise.

### High — Sequence F is overengineered for a 74-LOC file

**Location:** §1 table (pipeline ~100 LOC), §3 "Sequence F — pipeline"

Converting a single 74-line file containing two small functions into a package directory with `__init__.py` + `neo4j.py` creates three files where one existed. The overhead of the package structure (`__init__.py` re-exports, import indirection, directory traversal) exceeds the complexity of the original file. This is the kind of decomposition that should be deferred unless there's a concrete near-term growth plan for `pipeline.py`.

If the TD-008 pull-forward trigger requires *all* flat services to become packages, the spec should state that explicitly so the cost-benefit is visible.

### Medium — Line numbers in §4 patch inventory are off by one

**Location:** §4 "Sequence B patch inventory", table rows for `_reserve_unique_icp_id`

The spec cites lines 48, 91, 128, 187 for the four `_reserve_unique_icp_id` patches. The actual file `backend/tests/unit/test_customer_profile.py` has these patches at lines 49, 92, 129, 188 — every number is off by one. The `_release_icp_id` line numbers (244, 262) are correct.

Line drift is expected over time, but this spec was presumably written against the current file. The discrepancy suggests the author may have been reading a slightly different version or counting from 0.

### Medium — Scaffold commit command omits `mkdir` step

**Location:** §2 "Per-sequence commit structure", item 1

> `git mv service.py service/__init__.py`

This fails if the target directory `service/` does not exist. `git mv` does not create intermediate directories. The scaffold commit must include a `mkdir` step before the `git mv`. For example:

```bash
mkdir backend/app/services/leads
git mv backend/app/services/leads.py backend/app/services/leads/__init__.py
```

The omission is mechanical and obvious, but an implementer following the spec literally will hit an error.

### Medium — `graph_chat/scoring.py` name is misleading

**Location:** §3 "Sequence E — graph_chat"

The submodule `scoring.py` contains: `convert_audio_to_text` (speech recognition), `get_linkedin_followers` (RapidAPI HTTP call), `get_linkedin_recent_activity` (RapidAPI HTTP call), `extract_linkedin_username` (regex), `calculate_prospect_score` (arithmetic), `extract_number` (regex), `score_prospect` (LLM call).

Only two of seven functions are scoring-related. The rest are audio transcription, LinkedIn enrichment, and text extraction. The name `scoring.py` understates the module's scope. A name like `enrichment.py`, `prospect_processing.py`, or `linkedin_and_scoring.py` would be more honest. Alternatively, this could be split further (e.g., `audio.py`, `linkedin.py`, `scoring.py`) — but the spec's own rationale for Sequence B suggests avoiding splits that create many tiny files.

### Medium — No per-sequence rollback strategy

**Location:** §2 "Per-sequence commit structure"

The spec prescribes a commit-per-step workflow with green-pytest gates but does not document what to do when a gate fails. Given that the scaffold step renames a file to `__init__.py` (destructive — the original flat file is gone), a failed split commit requires either `git reset` or manual reconstruction. A one-line note like "if pytest fails, `git reset --hard HEAD` to revert the commit" would prevent a scrambling implementer from manually editing the tree.

### Low — "Largest-first" execution order lacks dependency rationale

**Location:** §2 "Architecture", execution order table

The spec says sequences execute "largest-first" but does not explain *why* this order matters. Are there inter-sequence dependencies? Does failure on a large sequence early save more time than failing on a small one? A one-sentence rationale would help the reader understand whether the order is load-bearing or arbitrary.

### Low — §6.4 "v1 router" reference is context-dependent

**Location:** §6 acceptance criteria, item 4

> "No v1 router or integration test regressions."

This criterion is not self-contained. The spec does not define what "v1 router" means — it requires external knowledge of the project's router versioning convention. A brief definition or cross-reference would make this criterion independently verifiable.

### Low — `get_ranked_prospects` returns formatted string, not data

**Location:** §3 "Sequence E — graph_chat", `neo4j.py` listing

`get_ranked_prospects` is categorized under `neo4j.py` but it returns a human-formatted markdown string (`"📊 Prospects Ranked by Score\n\n..."`) rather than a structured result. This is a presentation concern mixed into a "graph read/write operations" module. Not a decomposition error per the spec's own taxonomy, but worth noting as a pre-existing code smell that this decomposition propagates rather than addresses.

### Nit — `pipeline.py` LOC stated as ~100, actual is 74

**Location:** §1 table

The table lists pipeline as "~100" LOC. Actual is 74 lines. The tilde gives plausible deniability, but 74 is 26% less than 100. For a spec that stakes its scope on LOC-based prioritization, the inaccuracy understates how small Sequence F's target is.

### Nit — Pre-flight grep command in §4 uses basic grep, not ripgrep

**Location:** §4 "Pre-flight grep (all sequences)"

The spec suggests `grep -r "mocker\.patch.*app\.services\.leads" backend/tests/`. This works but doesn't exclude `.pyc` files or binary matches. Using `grep -r --include='*.py'` or `rg` would be more precise. Trivial, but worth noting since the project already uses `rg` elsewhere.
