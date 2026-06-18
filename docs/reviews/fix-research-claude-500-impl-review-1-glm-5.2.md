---
artifact: fix-research-claude-500
artifact_type: impl
verdict: clean
reviewer_model: glm-5.2
date: 2026-06-18
round: 1
base_ref: master
spec_loaded: false
plan_loaded: false
---

## Context

**Inputs:** The operator dismissed the input prompt, so I proceeded with the
required `<branch>` resolved to the only branch carrying implementation work
(the checked-out `fix-research-claude-500`) and used the documented fallbacks
for every optional input: `<base>` → `master` (exists as a git ref); reviewer
model → self-reported `zai-coding-plan/glm-5.2` (token `glm-5.2`); spec/plan →
auto-discovery; round → auto-determined.

**Change-context source:** `git log -p master..fix-research-claude-500` — a
single commit (`e5f3d92`), 8,272 bytes total. Well under the ~200 KB patch
budget — **no commit bodies dropped; every commit message retained**. Touched
files (4): `backend/app/services/icp/orchestrator.py`,
`backend/app/services/market_research/parsing.py`,
`backend/tests/unit/test_icp.py`, `backend/tests/unit/test_market_research.py`.

**Config files loaded:** none applicable. The touched subproject is `backend/`,
which has no `pyproject.toml`/`setup.cfg`/`Makefile`/`.ruff.toml`/`mypy.ini`
(it uses `requirements.txt`, per AGENTS.md), and the repo root has no
`tsconfig`/`knip`/`package.json`/`pyproject.toml`. Frontend configs exist
(`frontend/{tsconfig*.json,knip.json,package.json}`) but **frontend is untouched
by this branch**, so they are out of scope.

**Spec/plan (adherence):** No slug-matched `specs/fix-research-claude-500.md` or
`plans/fix-research-claude-500.md` exists. The auto-discovery MRU fallback would
resolve to `specs/37-tech-debt-paydown-design.md` / `plans/37-tech-debt-paydown.md`,
which are topically unrelated to a research-parsing hotfix. Per the
intrinsic-quality-only rule, **adherence checking is skipped**. (Pass explicit
paths when invoking to enable it.)

**Verification performed:**
- Traced `_extract_research_json` (`app/services/_llm_helpers.py:226`) by hand
  against both regression payloads: under the old defaults
  (`trim_braces=False, strip_final_answer=False`) the wrapped outputs raise
  `JSONDecodeError`; under the new settings they parse to the asserted values.
- Ran the two new tests via the backend `.venv`: **2 passed** in 0.08s.
- Enumerated all 6 `_extract_research_json`/`_extract_icp_json` callsites
  (`icp/orchestrator.py:52,84,106,142,180`, `market_research/parsing.py:25`,
  `signals/parsing.py:28`, `signals/lead_map.py:130`); confirmed only the two
  the commit touches were previously unfixed, and every Claude-path callsite is
  now robust.

## Findings

_None above Nit. The fix is minimal, correct, complete, and accompanied by
behavior-based regression tests that reproduce the production 500._

## Observations (no action)

- `icp_research_1` (`backend/app/services/icp/orchestrator.py:75`) still lacks
  the per-component `JSONDecodeError` retry loop that `icp_research_2..4` carry;
  the outer `_run_icp_research_impl` retry (`max_retries=2`, orchestrator.py:303)
  is the backstop. This is a pre-existing asymmetry intentionally left untouched
  by this minimal hotfix — flagged for awareness only.
- The new tests also assert `prompt_meta["name"]`; this couples lightly to the
  observability metadata shape, but the primary assertions (parsed payload
  fields) are behavior-based and refactor-safe.
- `_extract_research_json`'s `strip_final_answer` matches the literal substring
  `"Final Answer:"` (case-sensitive), but `trim_braces=True` is the load-bearing
  safety net and already handles arbitrary prose/fence wrapping — confirmed by
  the icp regression test, which uses a non-`"Final Answer:"` prose lead and
  still parses correctly.
