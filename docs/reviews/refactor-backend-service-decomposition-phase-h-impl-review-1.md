---
artifact: refactor-backend-service-decomposition-phase-h
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-24
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Findings

### [High] signals/orchestrator.py retains ~29 direct Mongo operations — persistence extraction incomplete

**Location:** `backend/app/services/signals/orchestrator.py` (888 lines), lines 213, 230, 287, 329, 338, 369, 427, 483, 492, 532, 541, 619, 735

The orchestrator for signals contains significant inline Mongo I/O that should have been extracted to `persistence.py` per spec §3.2 (persistence.py: `record_signal_action` (public) + Mongo read helpers, ~120 LOC expected). The actual `persistence.py` has only 2 functions (107 LOC) — `record_signal_action` and `_load_signals_for_user`. Missing extractions:

- Signal insertion via `collection.insert_one` (lines 329, 483, 532)
- Headline-track updates via `track_collection.update_one` (lines 338, 492, 541)
- Existing-headline reads via `track_collection.find_one` (lines 213, 230, 369)
- ICP config reads via `icp_collection.find_one` (lines 287, 427)
- Document reads via `collection.find_one` in `signal_ask`/`signal_ask_claude` (lines 619, 735)

The signal-save + headline-track-update block is copy-pasted 4 times across `run_signals_research` and `_generate_signals_batch_impl`. This should be a single helper in persistence.py.

### [High] signals/orchestrator.py contains unextracted inline prompt templates

**Location:** `backend/app/services/signals/orchestrator.py:663-696, 784-810`

`signal_ask` (line 663) and `signal_ask_claude` (line 784) each contain ~30-line f-string prompt templates that were not extracted to `prompts.py`. Per spec §3.2, `prompts.py` should contain "Inline MAIN_PROMPT_TEMPLATE + persona prompt blocks". The actual `prompts.py` only has `_SCOUT_PROMPT_TEMPLATE` and `_PROFILER_PROMPT_TEMPLATE` — the signal_ask prompts are missing.

Additionally, the "leads_text" and "existing_headlines_text" section builders (lines 129-170) are prompt-construction logic living in the orchestrator body rather than in `prompts.py`.

### [High] icp/persistence.py → orchestrator reverse dependency

**Location:** `backend/app/services/icp/persistence.py:40`

`list_icps()` lazily imports `ICP_generator` from `app.services.icp.orchestrator` (line 40), creating a cycle: `persistence → orchestrator → persistence`. This violates spec §3.1 dependency direction ("No cycles possible if discipline holds"). The lazy import breaks the cycle at load time, but the structural coupling means `list_icps()` is not truly a persistence function — it's an orchestrator function that does persistence as a side effect. The comment acknowledges the issue: *"Lazy imports to avoid circular dependency: persistence -> orchestrator -> persistence"*.

### [Medium] market_scoring leaf-to-leaf and leaf-to-orchestrator lazy-import cycles

**Location:** `backend/app/services/market_scoring/scoring.py:65`, `backend/app/services/market_scoring/persistence.py:67`

- `scoring.py` lazily imports from `orchestrator` (line 65) — a leaf importing the root.
- `persistence.py` lazily imports `_lead_to_score_row` from `scoring` (line 67) — a leaf-to-leaf dependency.

Combined, the effective dependency graph is `orchestrator → persistence → (lazy) scoring → (lazy) orchestrator`. All cycles are broken at load time, but the spec's leaf-independence contract ("All four leaves are independent of each other") is violated at the logical level.

### [Medium] market_research/icp/signals orchestrators use from-import instead of module-import + namespace-prefix

**Location:**
- `backend/app/services/market_research/orchestrator.py:19`
- `backend/app/services/icp/orchestrator.py:27-29`
- `backend/app/services/signals/orchestrator.py:29-38`

All three services use `from .persistence import X` / `from .llm import Y` in their orchestrators. The market_scoring orchestrator correctly uses `from app.services.market_scoring import persistence` + `persistence.X(...)` namespace-prefix calls. Spec §3.8 mandates module-import + namespace-prefix for "any moved-and-patched symbol." Tests patch leaf-module symbols directly (e.g., `app.services.icp.persistence._ensure_icp_indexes`), which will not intercept orchestrator-side calls made via the from-imported name.

For icp specifically, `test_icp.py` patches `_ensure_icp_indexes`, `_reserve_unique_icp_id`, `_release_icp_id` at `.persistence.X` paths — these patches would fail to intercept if orchestrator calls them via a from-imported name. Currently, these symbols are only called from external consumers (main.py lifespan, customer_profile.py lazy imports), not from within the icp orchestrator, so the issue is latent rather than active.

### [Medium] Stale __init__.py docstrings across 4 of 5 services

**Location:**
- `backend/app/services/market_scoring/__init__.py:1-6` — says "package skeleton" and "code lives in orchestrator.py for now"
- `backend/app/services/signals/__init__.py:1-6` — says "package skeleton" and "subsequent commits extract persistence.py, prompts.py, llm.py, and parsing.py"
- `backend/app/services/market_research/__init__.py:1-5` — same stale wording
- `backend/app/services/icp/__init__.py:1-10` — says "Subsequent commits extract prompts.py, llm.py, parsing.py" but those already exist

Only `data_sources/__init__.py` has an updated docstring describing the final state ("commit 7/20 final form"). The other four describe an intermediate state that no longer exists. Future readers will be confused about which submodules are populated.

### [Low] signals/orchestrator.py is 888 lines — significantly larger than spec estimate

**Location:** `backend/app/services/signals/orchestrator.py`

The spec estimated `orchestrator.py` at ~350 LOC for signals. The actual file is 888 lines, largely because persistence and prompt extraction were incomplete (see the two High findings above). The other four services' orchestrators are appropriately sized.

### [Low] signals/llm.py and parsing.py share a duplicated URL regex

**Location:** `backend/app/services/signals/llm.py:37,44`, `backend/app/services/signals/parsing.py`

The URL pattern `r'https?://[^\s<>"{}|\\^`\[\]]+'` is duplicated between llm.py and parsing.py. Should be a shared constant in one of the two, or in a small `_patterns.py` helper.

### [Nit] data_sources router docstring references "Document upload"

**Location:** `backend/app/routers/data_sources.py:1`

The v1 router docstring says "Document upload, status, and data-source management endpoints." The word "Document" is a holdover from the pre-rename naming. Function names inside data_sources/ still contain "document" (e.g., `upload_document_file`), which is expected per spec §2.2 out-of-scope ("Renaming public function names"), but the router docstring could be cleaner.
