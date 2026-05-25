---
artifact: specs/11-backend-flat-service-decomposition-phase-k-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-25
round: 2
---

## Context

Round 1 review identified 14 findings (2 Critical, 3 High, 4 Medium, 3 Low, 2 Nit). The spec has been substantially revised in response: Sequence F now correctly identifies `probe_llm` (not the nonexistent `get_timeframe_comparison`), extracts it to `health.py` before decomposition, bundles the Sequence B split + patch-path update into a single commit, fixes line-number references, adds `mkdir` to the scaffold step, renames `scoring.py` → `prospect_pipeline.py`, adds rollback guidance, and provides execution-order rationale. This round evaluates the current spec text against the current codebase.

## Findings

### Medium — §5 falsely claims `get_leads_for_org` patches exist in signals test suite

**Location:** §5 last paragraph

> "`get_leads_for_org` is patched in test suites for `market_scoring` and `signals` at the *caller-side* binding"

A grep of `backend/tests/unit/` for `mocker\.patch.*get_leads_for_org` returns 4 hits, all in `test_market_scoring.py` — zero in `test_signals.py`. The signals test file imports `get_leads_for_org` directly (line 18 of `test_signals.py`) but never patches it. The claim about signals patches is incorrect.

Impact: an implementer running the §4 pre-flight grep for signals would find no patches (as expected from the §4 inventory, which lists none for Sequence E) — but the §5 prose contradicts that result, causing unnecessary confusion or a time-wasting investigation.

Fix: change "test suites for `market_scoring` and `signals`" to "the `test_market_scoring` test suite".

### Low — §6.3 submodule-bypass grep misses submodule-import-without-from pattern

**Location:** §6 acceptance criteria, item 3

The grep:

```
grep -rE "from app\.services\.(leads|customer_profile|graph_chat|org_auth|profiles|pipeline)\.[a-z_]+ import"
```

catches `from app.services.leads.persistence import X` but not `from app.services.leads import persistence` (importing the submodule object itself) or `import app.services.leads.persistence` (dotted import of a submodule). Either of those would also bypass `__init__.py` re-exports and create a direct submodule dependency.

The risk is low — the spec's external-caller inventory in §5 shows no such imports today — but the acceptance criterion's grep gives a false sense of completeness. Adding a second grep pattern (e.g. `(?:import |from )app\.services\.(leads|...)\.[a-z_]+`) or using a more general regex would close the gap.

### Low — New `services/health.py` has no test coverage and spec does not flag it

**Location:** §3 "Sequence F — pipeline", `services/health.py` section

The spec creates a new public service file (`backend/app/services/health.py`) containing `probe_llm`, then notes "no test suite for `probe_llm`" without marking this as a gap or a follow-up item. The function is small and the route is a debug endpoint, so this is defensible for an MVP — but it's worth noting explicitly as accepted technical debt so a future agent doesn't assume the omission was accidental.

Suggestion: add a one-line note like "No tests for `probe_llm` — accepted; the function is a debug-only smoke probe with no business logic."

### Low — "Option A" reference has no discussion of alternatives

**Location:** §2 Architecture

> "Option A — per-service sequences (A–F), Phase H pattern."

The spec names this "Option A" but does not describe what Option B (or other alternatives) would have been. A reader cannot evaluate whether Option A was the right choice without knowing what was rejected. A single sentence describing the alternative (e.g., "Option B: decompose all six services in one atomic commit" or "Option B: batch all scaffolds then all splits") would suffice.

### Nit — Pre-flight grep command does not filter to `.py` files

**Location:** §4 "Pre-flight grep (all sequences)"

Carried from round 1. The suggested command `grep -r "mocker\.patch.*app\.services\.leads" backend/tests/` may match inside `__pycache__` directories or binary files. Adding `--include='*.py'` (or using `rg --type py`) would produce cleaner output. Functionally harmless since `backend/tests/` is unlikely to contain binary matches for this pattern, but a precision improvement.

### Nit — Sequence E circular-import check uses self-referencing arrow notation

**Location:** §3 "Circular-import check (all sequences)"

> "`prospect_pipeline.py` → `prospect_pipeline.py` only (`score_prospect` calls `extract_number`, both in the same submodule)"

The arrow notation `A → B` is used everywhere else to denote a cross-module dependency. `prospect_pipeline.py → prospect_pipeline.py` is a self-reference that could be confused with a copy-paste error. The parenthetical clarification helps, but a clearer phrasing would be "No cross-submodule calls within Sequence E; `score_prospect` calls `extract_number` within the same submodule."

### Nit — TD-008 pull-forward trigger description has phase-label drift

**Location:** §1 Context and motivation

The spec correctly states "the TD-008 pull-forward trigger has fired." However, `docs/TECH_DEBT.md` TD-008's pull-forward trigger reads: "After Phase J (decomposing remaining flat services) completes." Phase J turned out to be lazy-import cycle removal, not flat-service decomposition — Phase K does that work. The TD-008 entry's parenthetical is stale. This is a TD-008 issue, not a Phase K spec issue, but an implementer cross-referencing the two documents may be briefly confused about why the trigger "fired" when Phase J's description doesn't match.
