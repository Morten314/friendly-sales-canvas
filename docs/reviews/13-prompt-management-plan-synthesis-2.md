---
synthesizes_review: docs/reviews/13-prompt-management-plan-review-2.md
artifact: plans/13-prompt-management.md
artifact_type: plan
reactor_model: claude-opus-4-7
date: 2026-05-25
round: 2
---

## Round Recommendation

no

Reason: Both High findings agreed and applied; one Medium deferred with explicit non-blocker rationale; remaining items are Low/Nit or substantively addressed.

## Agreed Findings

- **High — Task 11 Step 10 deletes baselines that Step 8 imports.** Confirmed bug. Step 10 originally deleted `tests/_baselines/llm_config_prompt_strings.py` while Step 8's `test_llm_config_migration_equivalence.py` imports from it. Fixed by removing the baseline-file deletion from Step 10 (and the matching `git rm` from Step 12's commit command). Added explicit note that the baselines file and the one-shot equivalence test are retired together after one release cycle, not separately.
- **High — No automated byte-equality guard for non-llm_config migrations.** Agreed. Added a byte-parity check to each migration task's "Verify register" step:
  - Task 8 Step 3 (ICP): checks `icp_generator` against `ICP_GENERATOR_TEMPLATE.format()`, with spot-check instructions for the other four.
  - Task 9 Step 7 (signals): checks the non-conditional `signals_signal_ask_groq` (conditional prompts left to golden-fixture review since reproducing the legacy orchestrator-side assembly byte-for-byte is messy).
  - Task 10 Step 3 (market_research): checks `research_market_1`, spot-check others.
  - Task 12 Step 2 (market_scoring): reconstructs the legacy inline f-string in the parity script.
- **Medium — `signals_leads_section` callable but include-only.** Round 1 disputed, round 2 re-raised with sharper framing. Agreed on the *documentation* fix: added item 11 to Task 14's `docs/PROMPTS.md` outline covering service-scoped include-only sub-templates and the `_section`/`_section_fallback` naming convention. Did not change loader rules or move files — the testability win from registering them as callable still holds.
- **Medium — `test_prompts_golden.py` still calls `init_registry` at import time.** Wrapped the module-level `init_registry` call in try/except so collection-time boot failures don't poison pytest discovery. On failure, `_REGISTERED = []` and `_COLLECTION_ERROR` carries the message. Added a non-parametrized `test_prompt_registry_boots()` that always runs and surfaces the error. Existing autouse `_reinit_production_registry` fixture skips re-init when `_COLLECTION_ERROR is not None`.
- **Medium — Task 5 skips full-suite regression check.** Added Step 6 ("Run full suite to verify nothing else broke") before Task 5's commit. Renumbered the commit to Step 7.
- **Low — `_prompt_meta_from` is public API with private naming.** Agreed. Renamed to `prompt_meta_from` (dropped leading underscore) everywhere in the plan — function definition in `app/core/prompts.py`, call sites in `_llm_helpers.py`, and migration call sites in Tasks 8-12.
- **Low — No automated guard against wrong brace un-doubling.** Added item 7 to the verbatim-extraction protocol (Task 8 Step 1): a `grep -nE '(^|[^{])\{[a-zA-Z_][a-zA-Z0-9_]*\}([^}]|$)'` check for orphan single-brace placeholders after each `.md.j2` is created.
- **Low — Task 8 Step 6 doesn't show complete rewrites for `icp_research_3` and `icp_research_4`.** Replaced the "Repeat the same shape" hand-wave with full code blocks. `icp_research_3` preserves `buyingSignals` + `currentData` validation; `icp_research_4` preserves `icpRefinementRecommendations` + `currentData` validation — both match the legacy bodies in `icp/orchestrator.py:143-223`.
- **Nit — `_LANGCHAIN_PROMPT_NAMES` hardcoded.** Added a 3-line comment noting the set is hardcoded against the four known LangChain consumers and should be updated if Phase 0 surfaces additional ones.

## Disagreed Findings

(none — even the round-1-disputed `signals_leads_section` finding gets partial agreement now via documentation)

## Deferred Findings

- **Medium — Task 7 combines factory infrastructure with lifespan wiring.** Reviewer explicitly notes "Not a blocker — just a decomposition improvement." Splitting Task 7 into 7a (factory + helper) and 7b (lifespan + registrations) would add another commit (15→16 tasks) and require renumbering Tasks 8-15. The current Task 7 has 11 well-named steps that an executor or reviewer can navigate within a single commit; the two concerns are co-located in `_llm_helpers.py` and `app/main.py` respectively, so file-by-file diff review is natural. Trigger to pull forward: if Task 7's commit is rejected in code review for being too broad in scope.

## Severity Disagreements

(none)

## Open Questions

- **Nit #11 (pip install failure).** Trivial concern around `pip install -r requirements.txt` having no stated fallback in Task 2 Step 2. Did not add anything — the abort criteria section already covers "halt and report" generically, and jinja2 is so ubiquitous that install failure is implausible. Reviewer flagged this as Nit; leaving as-is.
- **Plan size growth.** The plan is now ~3,700 lines (started at 3,485, added ~200 lines across both review rounds). Still readable but well past the "skill" recommendation for plan size. No action — this is appropriate for the migration's scope (15 tasks, ~25 prompts touched, 4 services migrated).
