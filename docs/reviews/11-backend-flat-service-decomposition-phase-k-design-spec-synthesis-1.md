---
synthesizes_review: docs/reviews/11-backend-flat-service-decomposition-phase-k-design-spec-review-1.md
artifact: specs/11-backend-flat-service-decomposition-phase-k-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-25
round: 1
---

## Round Recommendation

yes

Reason: Two Critical findings (Sequence F references a nonexistent function; Sequence B's commit boundary forces a red-pytest window) require structural rewrites of §3 Sequence F and §2 per-sequence commit structure. Re-review after revision is warranted to catch any new issues introduced by those rewrites.

## Agreed Findings

- **Critical 1 — Sequence F references nonexistent `get_timeframe_comparison`.** Verified: `backend/app/services/pipeline.py` (74 LOC) contains `compute_sales_pipeline` and `probe_llm` only; `grep -r get_timeframe_comparison backend/` returns zero matches. Revising §3 Sequence F to list the actual functions and §1 table accordingly.

- **Critical 2 — Sequence B commits 2→3 create unavoidable red-pytest window.** Agree on substance. Minor mechanism nit: `mocker.patch` on a missing attribute raises `AttributeError` at patch decoration time (it does not silently no-op as the review states), but the conclusion is the same — pytest is red between commits 2 and 3, violating the spec's own green-after-every-commit rule. Revising §2 to make Sequence B a 2-commit sequence: scaffold, then a combined split-and-patch-path commit. Other sequences remain 2-commit (scaffold + split) since they have no patch paths to update.

- **High 3 — Acceptance criterion cites `test_lazy_service_import` which does not exist.** Verified: the actual Phase J lazy-import test is `test_no_unannotated_lazy_service_imports` in `backend/tests/unit/test_no_lazy_service_imports.py`. Revising §6 to use the correct name and path.

- **High 4 — Sequence F submodule `neo4j.py` is misnamed.** Connected to Critical 1: once Sequence F's actual contents (`compute_sales_pipeline` Neo4j read + `probe_llm` langchain probe) are reflected, naming the single submodule `neo4j.py` is wrong. Revising — see Open Questions for the choice between renaming to `operations.py` vs splitting into `neo4j.py` + `llm_probe.py`.

- **Medium 6 — Line numbers in §4 patch inventory are off by one.** Verified: actual `_reserve_unique_icp_id` patches are at lines 49, 92, 129, 188 (not 48, 91, 128, 187). `_release_icp_id` at 244, 262 is correct. Revising the inventory table.

- **Medium 7 — Scaffold commit omits `mkdir` step.** Verified: `git mv` does not create intermediate directories. Revising §2 step 1 to include `mkdir backend/app/services/<svc>` prior to the `git mv`.

- **Medium 8 — `graph_chat/scoring.py` name understates scope.** Five of seven functions are audio transcription, LinkedIn enrichment, and string extraction; only two relate directly to scoring. Renaming to a name that captures the full prospect-processing pipeline (proposing `prospect_pipeline.py`; will confirm during revision).

- **Medium 9 — No per-sequence rollback strategy.** Adding a one-line rollback note to §2: if pytest fails after any commit, `git reset --hard HEAD~1` reverts; diagnose before re-attempting rather than editing the working tree.

- **Low 10 — "Largest-first" execution order lacks rationale.** Adding one sentence to §2: largest-first surfaces structural problems early (when there is room to revise the sequence design); smaller sequences benefit from patterns established by the larger ones.

- **Low 11 — §6 "v1 router" reference is context-dependent.** Adding a brief note pointing at `backend/app/routers/v1/` to distinguish from `v2/`. The "no v1 regressions" criterion exists because v1 routers still serve production traffic alongside v2 — making that visible in §6.

- **Nit 13 — `pipeline.py` LOC stated as ~100, actual is 74.** Verified. Revising §1 table.

Additional agreed item from severity disagreement on High 5: adding a one-line note to §2 stating the uniform-structure decision explicitly (all 6 services package-converted regardless of size) so the cost/benefit is visible to future readers.

## Disagreed Findings

- **High 5 — Sequence F overengineered for a 74-LOC file.** The decision to package-convert all 6 flat services regardless of size was made deliberately during brainstorming and is reflected throughout §1 and §2. The motivation is structural uniformity: heterogeneous layouts (some packages, some flat files) create cognitive overhead during navigation and grep. The spec correctly captures this choice. The finding presupposes that overhead-to-content ratio should drive per-service decomposition decisions; that philosophy was considered and rejected in favor of uniformity. The reviewer's secondary point — that the rationale should be visible in the spec — is fair and is addressed in the Agreed list above.

## Deferred Findings

- **Low 12 — `get_ranked_prospects` returns formatted string, not data.** The review itself notes this "is not a decomposition error per the spec's own taxonomy." It is a pre-existing data/presentation entanglement that Phase K propagates without introducing. Out of Phase K scope. Trigger to revisit: when graph_chat is independently scheduled for data/presentation separation, or when a downstream consumer needs the structured form.

- **Nit 14 — Pre-flight grep uses basic `grep`, not `ripgrep`.** The basic `grep -r "mocker\.patch.*app\.services\.<svc>" backend/tests/` is correct for the stated purpose: `backend/tests/` contains Python source only, so `--include='*.py'` adds no value and `.pyc` noise is not a realistic concern in this directory. Tool-choice preference is not worth a revision round-trip. Trigger to revisit: if spec readers find themselves rewriting the command in practice.

## Severity Disagreements

- **High 5 — Sequence F overengineered:** severity should be Low, not High. The substance is a fair observation (overhead is real for a 74-LOC file), but the underlying decision is deliberate. High severity implies the decision warrants reconsideration; it does not — uniformity across the 6 services is the stated goal. What remains is a documentation gap: the spec should make the uniformity rationale explicit. That is a Low polish item, not a High design flaw. Documentation gap is being addressed in the Agreed list.

## Open Questions

- **Sequence F submodule layout (resolving High 4):** Two options on the table:
  1. Single submodule `operations.py` containing both `compute_sales_pipeline` and `probe_llm` (matches the spec's existing aversion to over-splitting; `pipeline/operations.py` + `__init__.py` re-exports).
  2. Two submodules: `neo4j.py` (`compute_sales_pipeline`) and `llm_probe.py` (`probe_llm`), preserving categorical honesty at the cost of two small files.
  Will resolve during revision; flagging here for re-review attention.

- **Sequence B commit structure (resolving Critical 2):** Two options:
  1. Merge commits 2 and 3 into a single split-and-patch-path commit (Sequence B becomes 2 commits total). Simpler; avoids transient state; breaks the "every sequence has the same step granularity" symmetry.
  2. Keep three commits but add temporary `_reserve_unique_icp_id` / `_release_icp_id` re-exports in `customer_profile/__init__.py` during commit 2, removed in commit 3 alongside the patch-path update. Preserves step symmetry across sequences; introduces transient code that exists only to keep the gate green.
  Preferring Option 1 (simpler, no transient state); flagged for re-review.

- **`test_no_unannotated_lazy_service_imports` semantics:** the test exists, but its exact lint surface (what counts as a violation) was not verified against Phase K's expected post-state. Will verify during revision that "must pass after Phase K" is a real, meaningful criterion — not a no-op for this set of changes.
