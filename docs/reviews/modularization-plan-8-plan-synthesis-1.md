---
synthesizes_review: docs/reviews/modularization-plan-8-plan-review-1.md
artifact: plans/modularization-plan-8.md
artifact_type: plan
reactor_model: claude-opus-4-7
date: 2026-05-24
round: 1
---

## Round Recommendation

**no**

Reason: All High findings agreed (the Task 3 self-import bug is a real correctness issue; the missing plan-level kill criteria is a one-sentence addition). All Mediums either agreed with minor scope adjustment or partial agreement. Two Nits disagreed on substantive grounds (project convention for embedded self-review; "placeholder" framing is illustrative not literal). Revisions are mechanical — no new design surface opened.

## Agreed Findings

- **[High] No plan-level kill criteria.** Real gap. Add a sentence to the "Abort criterion" paragraph: "If the decomposition pattern fails on a service after reasonable diagnosis effort, halt the branch and escalate to the operator. Already-completed sequences are individually green and may be cherry-picked to `master` at the operator's discretion — the branch does not need to be all-or-nothing."

- **[High] Task 3 Step 3 self-import bug.** Verified — the `scoring.py` template at lines 326-335 imports `_lead_to_score_row` from `normalization`, but per spec §3.6 and the Task 3 Step 1 identification list, `_lead_to_score_row` lives in `scoring.py` (the module being defined). A literal-following agent gets a circular-or-self import. Fix by removing the `_lead_to_score_row` import line and replacing with the parenthetical comment as a code comment: `# from app.services.market_scoring.normalization import (<helpers used by scoring functions, if any — verify during extraction>)`.

- **[Medium] Tasks 17, 18, 19 (signals) underspecified.** Real concern — signals is the hardest service and gets the least procedural detail. Expand Tasks 17-19 to match the detail level of Tasks 2, 3, 9, 10, 13 (full grep commands, file templates, `__init__.py` update blocks). Tasks 14-15 (`icp/`) get a partial expansion: keep the "same pattern as Task X" abbreviation but add an explicit callout that `icp/` has three `_`-prefix re-exports (`_ensure_icp_indexes`, `_reserve_unique_icp_id`, `_release_icp_id`) that market_research/ doesn't, and the Task 13 work already landed them in persistence — Tasks 14-15 don't add new exception re-exports.

- **[Medium] No explicit rollback instruction.** Add one sentence to the abort criterion: "On test failure: do not commit. Either fix forward (re-edit the files and re-run pytest) or `git checkout -- .` to discard the attempt and re-read the step. Never commit a red state to the branch."

- **[Medium] `data_sources/` commit count deviates from spec.** The plan correctly justifies 3 commits instead of spec's 4 (per-commit greenness violation if step 1 is partial-rename), but the spec still says 21-22 total. Resolve both ends: (1) add a "Spec deviations" subsection at the top of the plan listing the data_sources collapse, (2) amend `specs/2026-05-23-backend-service-decomposition-phase-h-design.md` §4.2 commit-count summary to match (20 total, data_sources 3 commits) — this is a small annotation, not a spec rewrite.

- **[Medium] Parallelizability not noted.** Real omission — the plan recommends subagent-driven-development which supports parallel dispatch, but doesn't say sequences B-E can run in parallel. Add a "Parallelizability" subsection after "Order of attack": "Sequences B-E (`data_sources/`, `market_research/`, `icp/`, `signals/`) are mutually independent — they touch different service files, different routers, different test files, and don't share mutable state. After Sequence A validates the pattern, B-E may be dispatched to parallel subagents. Within each sequence, tasks must remain serial (scaffold → extraction → closeout)."

- **[Low] Task 20 "20 commits" target ambiguous.** Change "Plan estimates **20 commits** total" to "Plan estimates **19-20 commits** total (Task 20 is conditional cleanup; omit if Task 16-19 leave `signals/` in a clean final state)."

- **[Low] __pycache__ cleanup as troubleshooting note.** Partial agreement — disagree with making cleanup mandatory in each scaffold task (5 noise lines for a low-probability issue), agree with adding a brief troubleshooting note. Add one line to each scaffold task (Tasks 1, 5, 8, 12, 16) right after the `git mv` step: "**If pytest fails with mysterious `ImportError` after the move:** `rm -rf backend/app/services/__pycache__` and retry — stale `.pyc` files can shadow the new package."

- **[Low] Pre-flight DI grep wording is misleading.** The `^`-anchored regex can't match inside-function assignments; the parenthetical "false positives like inline assignments inside functions" is technically wrong. Replace with: "expected: zero matches. Any match is a module-level global assignment and violates the Phase F DI assumption — surface to operator before halting."

- **[Nit] Task 8 / 12 / 14 / 16 Step 4 combines pytest and commit.** Real inconsistency with Tasks 1-4 pattern. Split each into Step 4 (run pytest) + Step 5 (commit) for consistency.

## Disagreed Findings

- **[Low] TD-006 fix mixes two concerns in Task 4.** Disagree — the reviewer's own recommendation is "No change needed — flagged for awareness only." The spec explicitly mandates folding TD-006 into the closeout commit (§2.1 item 3), and the commit message already leads with "close TD-006". Marked as noted, no revision.

- **[Nit] Self-review section embedded in plan.** Disagree on the suggestion to move it. The self-review is a useful integrity check that travels with the plan; embedding it lets future readers see what the plan author verified before declaring the plan complete. The reviewer themself flagged this as "not blocking — just noting." Keeping it in place.

- **[Nit] Placeholder scan claim slightly overstated.** Disagree on the framing. Task 9 Step 2's `# ... extracted code ...` and `_save_market_research_report` example are explicitly framed as illustrative templates for a helper the implementor must surface during extraction — the spec §3 tables already acknowledge "helper names assigned during implementation" for exactly this case. This isn't a placeholder failure in the "TODO, fill in later" sense. No revision; the self-review claim stands.

## Deferred Findings

(none)

## Severity Disagreements

(none — all severities accepted as assigned)

## Open Questions

(none — all findings resolved into agree / partial-agree / disagree)
