---
synthesizes_review: docs/reviews/35a-apollo-discovery-backend-plan-review-1.md
artifact: plans/35a-apollo-discovery-backend.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-12
round: 1
---

## Round Recommendation

yes

Reason: Every Critical/High is agreed and fixed, but the fixes restructured task ordering (models → Task 1b), rewrote the LLM seam across four tasks, and added a new exception + cross-cutting rules — enough new surface that one confirmation pass is warranted, even though no finding remains open.

## Agreed Findings

- **[Critical] Forward model dependency (Task 13 imports models from Task 16)** — Relocated all connector models to a new **Task 1b** (immediately after Task 1); added an **Execution-order & dependencies** block; Task 16 is now a clearly-marked skip-pointer (collapsed `<details>`) so a linear executor doesn't define the models twice.
- **[Critical] Undefined test helpers across task boundaries** — Added a concrete `_complete_icp_dict()` definition and a **Test-helper note** (applies to Tasks 12–15) stating that `_FakeBT`, the `patched` fixture, the `apollo_mod` alias, and `fake_mongo` already exist in `test_connectors_orchestrator.py` and must be reused, not redefined; a missing fixture is now a Kill-criteria stop.
- **[High] Task 14 LLM dead placeholder code** — Rewrote the snippet to remove `llm = mongo` and the fake `_llm_singleton` import; the LLM is now **threaded as a parameter** (`llm=None` default, deterministic fit fallback) across the router → `start_apollo_discover` → `_run_discover` → `rerank_candidates`. The cleanup is in the code block itself, not a prose afterthought.
- **[High] No kill criteria** — Added a **Kill criteria (stop and escalate)** block (two failed attempts; false assumptions about fixtures/registry/LLM; material Apollo param mismatch).
- **[High] Missing `ApolloSearchError` (spec §5.10)** — Added to Task 1 (`status_code=502`, `code="apollo_search_error"`) with a test assertion; documented that its synchronous HTTP surface is minimal (the discovery run records search failures on the run doc, not via HTTP), so it exists for spec parity + any future sync caller.
- **[High] No regression testing between tasks** — Added a **Regression rule** block + reinforced it in the self-review: any task modifying an existing module re-runs that module's full test set before committing.
- **[Medium] Missing `person_seniorities` mapping** — Resolved by **documenting the deliberate omission**: Apollo's `person_seniorities` is an enum filter (c_suite/vp/director/…), while `buyer_role` is free text, so free text sent as a seniority is silently ignored; `buyer_role` → `person_titles` only, with a role→seniority-enum map noted as a future enhancement. (Diverges from the reviewer's "split" suggestion for a correctness reason.)
- **[Medium] `fail_stale_discovery_runs` return unused** — Task 13 now captures the returned stale doc and, when `mode == "replace"`, calls `clear_superseded_discovery_leads` so a killed mid-swap run's orphan tags are cleared at discover-time (not only on restart).
- **[Medium] Task 5 mixes four concerns** — Resolved via **per-sub-part commits** (note added) rather than a full renumber: the four sub-parts are committed as separate logical commits for reviewability/blast-radius.
- **[Medium] Task 15 mixes five concerns** — Same: a note requires committing `set_low_credit`, extended status, discovery-status, and export as separate logical commits.
- **[Medium] Missing `REVEAL_RATE_DELAY`** — Added the constant (`0.3s`) and an inter-reveal `apollo_mod._sleep(REVEAL_RATE_DELAY)` throttle (skipped before the first reveal) in `_run_discover`.
- **[Low] No geo scoring in `score_icp_fit`** — Added a geo component (ICP `location[]`/`primary_region` vs candidate country/state/city); rebalanced weights to title 0.35 / industry 0.35 / size 0.15 / geo 0.15. Existing ordering tests still hold.
- **[Low] `_records_to_dicts` not confirmed** — Task 5 note confirms it already exists in `ingestion.py` (backs `get_leads_by_ids`); reuse it, stop if absent.
- **[Low] Plan fully serial** — The Execution-order block names the parallelizable independent set (`1, 1b, 2, 3, 4, 6, 7`) for subagent-driven execution.
- **[Nit] `sweep_orphan_superseded` unfiltered `distinct()`** — Scoped the distinct to `{"mode": "replace"}` (the only mode that tags superseded), with a comment.
- **[Nit] `DiscoveryCounts.errors: List[Any]`** — Changed to `List[Dict[str, Any]]` with a `[{stage, message}]` comment (matches spec §5.3).
- **[Nit] SHA-1 fingerprint undocumented** — Added the "plain hash, not security; persisted + surfaced so a compact key beats re-serialising" justification to `icp_fingerprint`'s docstring.

## Disagreed Findings

None. Two findings were resolved differently than the reviewer's literal suggestion but the substance was accepted: `person_seniorities` (documented omission for an Apollo-enum reason, rather than a mapping that would be silently ignored) and the Task 5/15 splits (per-sub-part commits, rather than renumbered tasks — same reviewability benefit, far less churn).

## Deferred Findings

- **Agent-view `superseded` exclusion across Scout/Profiler/Signals reads** — already scoped out of 35a in the plan (Task 5 note) and surfaced as an open question below; trigger: the 35b/lead-read wiring task. Not newly deferred this round.

## Severity Disagreements

None — all assigned severities accepted (the two Criticals were genuinely blocking for a linear executor; the Highs were correct).

## Open Questions

- **Prompt-registry discovery of `prompts/connectors/`** (Task 11) — whether `init_registry()` auto-discovers a new prompt subdirectory and what frontmatter keys it requires is unverified; Task 11 includes a registry-render check and the Kill criteria cover a non-discovering registry, but it's the most likely first-run surprise.
- **Existing orchestrator test fixtures** — the plan now asserts `_FakeBT`/`patched`/`apollo_mod`/`fake_mongo` pre-exist; if the actual harness differs (e.g. `fake_mongo` lives only in a specific conftest scope), several Task 12–15 tests need fixture adaptation. Covered by Kill criteria but flagged.
- **Live Apollo `api_search` param names** (Task 19 Step 3) — still the single largest external unknown; contained to `build_search_filters`, but a structural mismatch (numeric tag-IDs mandatory) would be an escalate, not a rename.
