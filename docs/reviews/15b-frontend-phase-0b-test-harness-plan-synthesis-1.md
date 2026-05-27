---
synthesizes_review: docs/reviews/15b-frontend-phase-0b-test-harness-plan-review-1.md
artifact: plans/15b-frontend-phase-0b-test-harness.md
artifact_type: plan
reactor_model: claude-opus-4-7
date: 2026-05-27
round: 1
---

## Round Recommendation

no

Reason: All revisions are surgical (replace one test assertion, add one intermediate step, tighten 3 paragraphs of text, remove 1 duplicate line); the plan's structural dimensions (sequencing, decomposition, abort criteria) the reviewer marked "strong/good" are untouched.

## Agreed Findings

- **High 1 [MSW pipeline test fragility].** Verified: in MSW v2 Node, `onUnhandledRequest: 'error'` raising-and-rejection behavior is brittle across MSW patch versions and jsdom fetch implementations. The robust replacement is to listen on `server.events.on('request:unhandled', ...)` — a documented, version-stable MSW v2 API. Fix to Task 1 Step 7: replace the second assertion's body with the event-listener pattern (the test still verifies the same invariant — MSW saw the unhandled path — but doesn't depend on the rejection-vs-resolution semantics of the fetch call). Also reword Step 8 troubleshooting to drop the "rejection might not fire" hypothesis (no longer applicable once the assertion uses the event API).
- **Medium 3 [Gap-journey api-mocks.ts shared-file conflict].** Verified: parallel execution of Tasks 7 and 8 in separate worktrees could conflict on `frontend/e2e/fixtures/api-mocks.ts` if both hit a wiring bug. Fix to the "Parallelization opportunities" paragraph: state that Tasks 7 and 8 must serialize relative to each other in subagent-driven mode (each can still parallel with Tasks 2–6, which never touch e2e fixtures). Cost is ~10s of serialization between two fast Playwright tasks.
- **Medium 2 [No regression gate between Tasks 1 and 6 for cross-test interference].** Verified: while Vitest's default per-file worker isolation prevents most leakage, there's a real risk that fake-timer or module-state pollution surfaces only when the full suite runs (currently Task 9). Fix: insert a single intermediate `npm run test` (full suite) check as a new sub-step at the end of Task 4 (midpoint of the characterization run). Cost is ~2s; catches interference 2 commits earlier in the worst case.
- **Medium 4 [RTL installed but unused at 0b].** Verified: `@testing-library/react` ships in Task 1's install but no Phase 0b test uses it. The spec lists it for harness baseline; future phases consume it. Fix: add a 1-line note to Task 1's rationale paragraph — "RTL is installed as part of the harness baseline per spec §3.1; no Phase 0b test consumes it (Phases 5–10 component tests will)."
- **Medium 6 [Task 6 scope expansion beyond spec §3.3].** Verified: spec §3.3 lists "queuing, rolling-window cap, sliding-window release, concurrent enqueues." Plan adds retry-path + isRateLimitError fan-out + clearQueue + helper-forward tests. Fix: add a clarifying paragraph to Task 6's rationale explaining the expansion ("characterization aims to lock all reachable behavior, not just spec-mentioned behavior; Phase 3+ refactors will touch the auth/data layer and could silently regress the retry path"). **No test removal** — the disagreement with the reviewer's implicit "should be trimmed" is documented under Disagreed below.
- **Low 1 [Task 11 Step 4 duplicate file entry].** Verified: the NFR JSON file is listed twice (once `A`, once `M`). Fix: remove the `A` line; keep only the `M` line at the bottom (since Phase 0a created the file, only modification status is correct).
- **Low 2 [Task 0 Step 3 missing timing guidance].** Verified: other tasks have explicit timing budgets; Task 0 Step 3 omits behavior when wall time exceeds the ~90–120s expectation. Fix: add a 1-line guidance — "If preflight takes >180s but is green, note the time in the impl-review handoff and proceed; investigate only if red."

## Disagreed Findings

- **Medium 5 [Spec drift tracking lacks concrete trigger/owner].** Reviewer asks for TD-FE entries or spec-amendment tasks for the three drifts. CLAUDE.md "Spec-driven flow" is explicit: "Specs and plans are a frozen record of intent, not current truth. Don't update specs/plans to reflect post-merge drift; the code is authoritative for current behavior." A spec-amendment task would violate this. For the rateLimitManager 30-vs-4 discrepancy specifically (the only one with potential tech-debt character — the other two are documentation oversights), a TD-FE entry post-merge is appropriate. **Partial agreement:** tighten the plan's "Open Questions for Post-Merge Follow-Up" section to specify (a) rateLimitManager → TD-FE entry post-merge with trigger "Phase 3 touches the auth/data layer," (b) the other two drifts (utils.ts second export, marketScoreDescriptions prose) need no action — they're documentation oversights and the tests cover the actual behavior. The current free-floating "proposed" language tightens to actionable.
- **Low 3 [Hardcoded date in NFR JSON path].** The `docs/audits/2026-05-26-frontend-nfr-baseline.json` filename is a deliberate naming convention — the file is the **canonical** NFR baseline timeline keyed by phase (Phase 2c will append `after_phase_2c` to the same file). Same convention applies to `2026-05-26-frontend-baseline.md` (audit scorecard) and the bundle baseline JSON. The "hardcoded date" reflects when the original anchor was captured, not when re-measurements run; that's the intent, not a bug. Not changing.
- **Nit 2 [Commit message Spec reference format].** Phase 0a commits used the shorthand `Spec 15 §N.M`; the reviewer suggests `Spec 15 (frontend-phase-0) §N.M`. Keeping consistency with Phase 0a is more valuable than verbose precision (git log is searchable by `Spec 15` already).
- **Nit 3 [Task 9 chain-ordering debate is academic].** The paragraph documents *why* the literal "append" interpretation was chosen over the fail-fast alternative. This is exactly the kind of decision context that helps future agents (e.g., when Phase 2c reorders the chain for budget). Keeping.

## Deferred Findings

N/A.

## Severity Disagreements

- **High 2 [measure-baselines.sh full replacement is fragile].** Substance agreed: full-file replacements are structurally brittle to plan-vs-code drift. **Severity disagreement: this is Medium-Low for THIS plan, not High.** Three reasons: (1) the plan author read the current `measure-baselines.sh` content at plan-writing time (visible in the plan's context — the script is reproduced verbatim with the 0b additions); (2) Phase 0a merged 1 day before plan-writing with no follow-up commits touching the script; (3) the engineer applying the change can verify with `git diff` before committing. The reviewer's proposed "targeted diff" alternative is messier than the full replacement because the JSON-write block needs significant restructuring (read-merge instead of overwrite), not a simple append. **Fix:** add a 1-line guard at Task 10 Step 1 ("Before applying, run `git diff HEAD -- frontend/scripts/measure-baselines.sh` to confirm the on-disk content matches the plan's expected base — if drift is present, reconcile manually rather than overwriting") — this addresses the structural concern without restructuring the task. Effective severity after fix: Low.

## Open Questions

None remaining. The reviewer's checklist-coverage summary (sequencing, risk front-loading, decomposition, recovery, verification, drift, parallelizability, overengineering) was uniformly positive — the findings are revisions to surface details, not signals that the plan's structure needs rework.
