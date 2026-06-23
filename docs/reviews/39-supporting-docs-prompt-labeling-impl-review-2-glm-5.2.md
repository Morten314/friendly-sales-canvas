---
artifact: fix-supporting-docs-labeling
artifact_type: impl
verdict: clean
reviewer_model: glm-5.2
date: 2026-06-22
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

**Change-context source:** `git log -p master..fix-supporting-docs-labeling` — 6
implementation commits (`4aa67bd`…`231edb5`) plus separate docs/review commits.
The raw patch was ~257 KB (marginally over the ~200 KB budget); rather than drop
oldest commit bodies, I read every touched source/test file directly from the
branch and used the patch for commit messages + fixture deltas. All 6 commit
messages retained.

**Slug note:** the branch-name rule would yield slug `fix-supporting-docs-labeling`,
but the already-merged opus `impl-review-1` (and all spec/plan reviews + syntheses
for this feature) use the `39-supporting-docs-prompt-labeling` slug. I followed
the latter so this review shares a round with the opus input and is synthesizable
with it. The opus file carries no `round:` frontmatter, so it is skipped in the
R_max computation → R_max 0 → **round 1** (second reviewer joining the opus round).

**Config loaded:** no auto-include-list config present at repo root or `backend/`
(probed `pyproject.toml`, `setup.cfg`, `ruff.toml`, `.ruff.toml`, `mypy.ini` — all
absent). The only backend pytest config is `backend/pytest.ini` (carries the
pre-existing `asyncio_mode = …` "Unknown config option" warning — unrelated noise).

**Independent verification (not just trusting the opus "388 passed"):**
- Re-ran the full backend unit suite against the branch via the venv site-packages
  on the working system interpreter (the worktree `.venv` interpreter symlink
  dangles — `/home/agent/…` from the creating user is gone here). Result:
  **388 passed, 8 warnings in 13.6s** — matches the opus figure exactly; warnings
  are all pre-existing pydantic/langchain deprecations + the asyncio_mode note.
- Verified the plan's load-bearing `captured/`-divergence premise by grepping
  `tests/fixtures/captured/`: **no file contains either** `DATA SOURCES (uploaded
  documents)` **or** `SUPPORTING DOCUMENTS` — i.e. the plan was right and the spec
  was wrong that `captured/signal_ask_*.json` carry the label. No staleness risk.
- Read all 5 changed services, the new partial, all 11 template deltas, and all
  4 test modules; confirmed the threading invariant holds on both `_CLAUDE`
  dispatch paths and is directly asserted (see Observations).

**Plan-review closure:** all four findings from `…-plan-review-1-glm-5.2.md` were
closed during implementation — the Medium (claude-dispatch untested) is closed by
the parametrized `llm_backend ∈ {qwen, claude}` market/ICP tests that assert
`captured["backend"] == llm_backend`; the drift-guard Low is closed by
`test_supporting_docs_label_matches_partial`; the empty-retrieval Low is closed by
`test_run_signals_research_scout_omits_section_when_no_docs`; the `captured/`
Low is mooted by the grep above.

## Findings

None above Nit.

## Observations (no action)

- **`ask.py:147-148` — `supporting_documents` is non-`None` by construction.** The
  branch is guarded by `if data_source_context:` and `format_supporting_documents`
  returns `None` only for empty/`None` input or a `json.dumps` failure that
  `default=str` effectively cannot produce. The f-string can't render `"None"`.
  Code is correct as-is; the `or ""` the opus review floated would only harden a
  non-reachable path.
- **Threading-style inconsistency is safe.** Market-research threads
  `supporting_documents` positionally into the dispatch *lambda*
  (`orchestrator.py:164`); ICP threads it by keyword to the *bare* functions
  (`orchestrator.py:308`). Both are correct for their signatures and neither puts
  a positional before `llm_backend` — the only configuration the plan's hazard
  warning actually attaches to. Readability nit only.
- **Empty-retrieval omission is asserted on one surface only.**
  `…scout_omits_section_when_no_docs` covers signals; market/ICP rely on the
  shared partial's `{% if supporting_documents %}` guard plus the helper's
  `[]`/`None` → `None` contract (which IS unit-tested). A market/ICP-specific
  break would require an orchestrator to pass non-`None` docs for empty retrieval,
  which the shared `format_supporting_documents(pinecone_context)` call site makes
  impossible. Guarantee holds by construction; the opus review's "uniform omission"
  wording is accurate-by-construction though only directly asserted on signals.
- **Stale fake `version: "1.0.0"` in market/ICP per-component tests**
  (`test_market_research.py:83,113,167,194`, `test_icp.py:163,167,194,214,245`).
  These use hand-built fake `prompt_meta` dicts to assert propagation, not the real
  loader, so the values are arbitrary and not wrong; the real templates are now
  1.1.0. The plan explicitly left these. Cosmetic/misleading-at-a-glance only.
- **Diff hygiene is clean.** Six task-scoped commits (`feat(be)`/`refactor(be)`/
  `chore(be)`) matching the plan's one-commit-per-task contract, with spec/plan/
  review docs in separate commits. No unrelated changes mixed in, no scope creep.
- **D1/D3 fully closed and regression-guarded.** All four signals exclude-list
  sites strip both pinecone keys; market/ICP stopped stamping them and compute the
  render var instead; every surface test asserts `pinecone_supporting_context` /
  `pinecone_context_queries` absent from the rendered body; the profiler branch's
  D3 drop is covered by `…_profiler_includes_supporting_documents`.
