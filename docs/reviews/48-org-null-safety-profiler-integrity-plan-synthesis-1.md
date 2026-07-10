---
synthesizes_review:
  - docs/reviews/48-org-null-safety-profiler-integrity-plan-review-1-glm-5.2.md
artifact: plans/48-org-null-safety-profiler-integrity.md
artifact_type: plan
reactor_model: opus-4-8-1m
date: 2026-07-09
round: 1
unresolved_high_or_critical: no
re_review_recommended: maybe
single_model_round: yes
---

## Round Recommendation

unresolved_high_or_critical: no
re_review_recommended: maybe
single_model_round: yes

Reason (unresolved): Five findings (one Medium, four Low); each was agreed and applied — none disagreed, deferred, or left unapplied.
Reason (re-review): Single-model (glm-5.2) round; findings are resolved and no significant new surface was opened, but a distinct model has not reviewed the plan (single-model floor) — a cross-model pass adds marginal assurance; nothing here blocks execution.

## Agreed Findings

The reviewer verified the plan's load-bearing claims against the code before filing (confirming all Task 10 BE patch targets resolve patch-where-used; that the generate-branch write is a partial `$set` at `persistence.py:239-243` so a sibling `DISMISSED_FIELD` genuinely survives refresh — the WS3 durability design is sound; that the existing `test_delete_recommended_icp_happy_path` and `AuthContext.orgAuthoritative.test.tsx` stay compatible). No finding contested the plan's substance; all five are robustness hardening, applied in place.

- **[Medium] Line-number citations drift across same-file block reworks (agreed, applied).** Confirmed the mechanism: Task 7 Step 3 rewrites the `loadProfilerPagePayload` block (`:109-138`) to a different length, shifting every later line in `SuggestedICPCards.tsx` — so Task 7's own Step 4 (`:353`) / Step 5 (`:465`) refs and *all* of Task 11's refs (`:688-741`, `:754-756`, run after Task 7) are stale by execution time. Added a Global Constraints rule: line numbers are pre-edit hints, not addresses — re-locate every edit by its named symbol / quoted content anchor (each step already provides one) and verify surrounding lines before editing, calling out the Task 7→Task 11 invalidation explicitly.
- **[Low] Task 11 hardcoded pending-reject localStorage key → vacuous-assertion risk (agreed, applied).** The dismissed-ids key was imported but the pending-reject key was a string literal. Added a plan step to `export` `PROFILER_PENDING_RECOMMENDED_REJECT_KEY` from `suggestedIcpStorage.ts:3` and import it in the test (a rename becomes an import error, not a silent pass). Also relabeled the first pending assertion as a *positive control* — it fails if the key is wrong, so the later retention assertion can never pass vacuously.
- **[Low] Task 10 refresh test never pins that `DISMISSED_FIELD` survives the generate write (agreed, applied).** The test asserted only on the returned `items`. Added an assertion that the generate-branch `update_one` `$set` does **not** contain `DISMISSED_FIELD`, so the sibling-preserved durability property is caught by the test if a future change widens the `$set` or switches to `replace_one` (rather than resting on reasoning).
- **[Low] No explicit abort/rollback criteria (agreed, applied).** Added a Global Constraints "Failure handling" line: on any unrecoverable task failure, STOP, leave the branch as-is, report to the human — no task-skip, partial merge, or forced re-run.
- **[Low] Task 11 reject test's real-timer ~6s wait / 15s timeout (agreed; applicable remedy applied).** Applied the finding's "flag it as intentionally slow" remedy — added a comment documenting the real-timer wait and *why* (fake timers wedge on `apiFetch`'s dynamic `import("./jwt")` + MSW microtask interplay, per the sibling `SuggestedICPCards.write.test.tsx`), so it is not mistaken for a hang. Did **not** switch to fake timers: the sibling test documents that they wedge on exactly this interplay, so that alternative is refuted. Injecting/shrinking the 5s window is a deferred option (Open Questions).

## Disagreed Findings

(none)

## Deferred Findings

(none)

## Severity Disagreements

(none — Medium for the cross-task line-drift and Low for the four test/robustness items are all reasonable as assigned.)

## Open Questions

- **Reducing the Task 11 real-timer wait (Finding 5's non-applied half).** The test eats ~6s of wall-clock because the reject undo-window is a hardcoded `5000ms`. Making the window duration injectable (a prod change) would let the test shrink it, but the sibling `write.test.tsx` already accepts the same 6s real wait for the same reason — deferred as YAGNI. **Trigger:** revisit if the vitest suite's wall-clock becomes a merge-gate problem.
- **Cross-model floor.** Per the reviewer's procedural note, the plan (like the spec) has only had single-model `glm-5.2` review; a distinct model reviewing the plan is the highest-value remaining assurance if any is wanted before execution — but no finding blocks proceeding.
