# Plan 39 — Supporting-Documents Prompt Labeling — Implementation Review (round 1)

**Scope:** whole-branch review of the 6 implementation commits `a6de597..231edb5` on `fix-supporting-docs-labeling` (Tasks 1–6). Each task also passed an individual spec+quality review during subagent-driven execution; this is the cumulative cross-cutting review before merge.

**Reviewer model:** claude-opus-4-8.

---

## Strengths

- **The helper + partial + threading compose cleanly across all four surfaces.** `format_supporting_documents` is the single formatter; one guarded partial (`prompts/_shared/supporting_documents_section.md.j2`) is `{% include %}`-d by all 11 templates; each orchestrator computes `supporting_documents` once and threads it as a render var. The abstraction is genuinely shared, not copy-pasted.
- **The threading invariant holds on every dispatch path.** Market-research (`orchestrator.py:104-108`) and ICP (`orchestrator.py:214-217`) `_CLAUDE` lambdas keep `"claude"` positional (lands on `llm_backend`) and pass `supporting_documents` by keyword. Leaf signatures make the positional `"claude"` correct and the new arg additive; the default `=None` means any un-updated caller is safe.
- **D1 stamp-removal is complete and uniform.** All 4 signals exclude-list sites in `search.py` (scout dict, scout str, profiler dict/else, profiler str) strip `pinecone_context_queries` + `pinecone_supporting_context`; market-research and ICP stopped stamping the two keys and compute the render var instead.
- **D3 (profiler dropping docs) is fixed with a dedicated regression test** asserting the rendered prompt contains the doc content on the profiler branch that previously rebuilt `context_json` from only `{company_profile, icp_data}`.
- **Tests verify real rendered output, not mocks-of-themselves** (`chain_mock.invoke.call_args[0][0]["input"]` and the captured Claude payload). Market-research and ICP through-orchestrator tests are parametrized over `llm_backend ∈ {qwen, claude}`, exercising the real `_CLAUDE` lambda path.
- **The drift guard is real.** `test_supporting_docs_label_matches_partial` locates `{% if supporting_documents %}` in the partial and asserts the next line equals `_SUPPORTING_DOCS_LABEL` byte-for-byte — a future edit to either copy fails the test.
- **No external blast radius.** The only references to the edited functions outside the diff are `__init__.py` re-exports and docstrings — no call sites passing positional args.
- **Helper contract upheld:** pure (operates on `dict(row)` copies), total (`try/except` around `json.dumps`; `default=str` tolerates Decimal/numpy), returns `None` on empty/None, strips `text`/`page_content` only when metadata is a dict.
- **Consistency artifacts line up:** 11 templates bumped 1.0.0→1.1.0, partial stays 1.0.0; all 11 rendered fixtures contain the label and all 11 `_inputs` carry the key; the empty-retrieval guard test confirms uniform omission.

## Issues

### Critical (Must Fix)
None.

### Important (Should Fix)
None. The two per-task "Important-adjacent" gaps (claude-path threading argued only structurally; market-research exercising only component 1) are *closed* by the parametrized whole-branch tests at `test_market_research.py` and `test_icp.py`.

### Minor (Nice to Have)
- **`ask.py:147` — `supporting_documents` could be `None` inside the f-string.** Not reachable today: the branch is guarded by `if data_source_context:` and the helper only returns `None` for empty/None input. Cosmetic; an `or ""` fallback would harden it. (Note: the f-string is the plan-specified Task 5 code.)
- **Cross-surface threading style inconsistency (cosmetic).** Market-research passes the arg positionally to the lambda (`orchestrator.py:164`) while ICP passes by keyword (`orchestrator.py:307`). Both are correct given the lambda signatures, and both forms are what the plan specified for each surface. Readability nit only.
- **Carried per-task minors:** T1 test_retrieval.py omits a module docstring; non-dict-metadata passthrough untested (not live-reachable since `_fetch_pinecone_supporting_context` always yields dict metadata); T4 fixture `query` field with an empty mocked query list. All cosmetic.

## Recommendations
- Optionally add `or ""` at `ask.py:147` to future-proof against a `None` body if the upstream guard ever changes.
- Optionally normalize the market-research lambda call to keyword form to match ICP. Pure consistency.
- Neither is worth blocking on; fold into a later touch if convenient.

## Assessment

**Ready to merge?** Yes.

**Reasoning:** All planned functionality is present and consistent across the four surfaces plus the helper and partial; the keyword/positional threading invariant holds on both `_CLAUDE` paths and is covered by parametrized real-dispatch tests; D1 stamp-removal and the D3 profiler fix are complete with regression coverage; the label single-source + drift guard is genuinely effective; the only findings are non-reachable cosmetics. Full suite: 388 passed (373 baseline + 15 new), output pristine.
