---
synthesizes_review: docs/reviews/18-frontend-phase-2b-eslint-prettier-plan-review-1.md
artifact: plans/18-frontend-phase-2b-eslint-prettier.md
artifact_type: plan
reactor_model: claude-opus-4-7
date: 2026-05-28
round: 1
---

## Round Recommendation

no

Reason: All agreed revisions are in-scope refinements (committing to a binding default for Wave B, replacing the diff-stat stub with explicit commands, aligning Wave A threshold to spec); none open new design surface that would benefit from a round 2.

## Agreed Findings

- **H2 — Wave B auto-fix strategy unresolved.** Reviewer is right that the plan-stage decision (header line 122) says "per-rule" but the task bodies offer two paths and discuss tradeoffs. Committing to **combined `eslint --fix` as the binding default**, with per-rule split only if total diff exceeds 500 lines. Header decision #3 + Task 4.prep + Tasks 4.1–4.4 updated accordingly. This sidesteps M5 (v9 `--rule` syntax uncertainty) entirely.
- **M1 — Per-wave diff-stat scorecard stub.** Replacing the `# ... iterate per wave's commit range` comment with explicit commands: for each wave, identify start/end commits via `git log --grep='^<subject-pattern>' --format=%H`, then `git diff --stat <start>~..<end> | tail -1`. Task 7.2 Step 1 gets the full per-wave loop.
- **M2 — Split-threshold interpretation contradicts spec.** Reviewer is right — the plan doubled the spec's 250-line threshold to 500 without justification. Reverting Task 3.prep Step 3 to use the spec's 250 directly on `insertions + deletions`.
- **M3 — Hardcoded dates in artifact filenames.** Partial agreement: the convention (date = plan-writing date, anchored throughout, scorecard re-dated at merge) matches Phase 2a's precedent and the executor expects it. Adding a one-line note at the top of the File Structure section that all `2026-05-28` references are the plan-writing-date anchor; if execution spans days, executor uses the original date for re-probe artifacts and re-dates only the final scorecard.
- **M4 — Wave B `eslint --fix` may re-format Prettier-formatted code.** Reviewer is right that this expected interaction isn't surfaced in Wave B tasks. Adding a one-paragraph note in Task 4.prep that benign whitespace deltas on Prettier-touched lines are expected per Spec 18 posture rule 9 and not a Wave B violation.
- **M5 — ESLint v9 `--rule` flag uncertainty.** Resolved by H2's binding decision (combined `eslint --fix`). The `--rule` per-rule isolation path is removed from Task 4.1 entirely; the alternative-fallback discussion in Task 4.prep is trimmed.
- **L1 — `eslint --format json` stderr suppression in Task 4.end.** Replacing `2>/dev/null` with `2>&1 1>>/tmp/...` pattern to preserve stderr to a log file while still piping stdout JSON to python3. One-line fix.
- **L2 — `classifyArea` directory assumptions.** Adding a one-line comment to the function noting the `else` fallback returns the raw top-level name (already true; making it explicit). Probe is informational, not gate-enforcing — no structural change.
- **L3 — `rules-of-hooks` task ordering vs Wave D loop.** Clarifying in Task 6.rules-of-hooks that this task runs **last in Wave D** (after Task 6.loop's per-file fixes complete) because the structural restructure is the highest-risk Wave D edit. Adding an "Order" note at the top of Task 6.rules-of-hooks.
- **L4 — `tsx` prerequisite verification.** Adding `npx tsx --version` to Task 0b Step 1 (alongside the existing preflight check). One-line addition.
- **L5 — Task 3.7 config file existence check.** Moving the `ls *.config.* 2>/dev/null` pre-check from the note into Step 1's actual command sequence as a required pre-check. The `prettier --write` line then iterates only over files confirmed to exist.
- **N1 — Relative `cd ..` paths.** Agreed Nit; matches Phase 2a's pattern. No revision (mixed CWD usage is conventional in the plan's bash blocks and the executor reads top-to-bottom).
- **N2 — Verbose commit message templates.** Agreed Nit; the verbose bodies provide impl-review context. No revision.
- **N3 — Self-review section non-standard.** Removing the "Self-Review Notes" section (lines 3199–3211). It's planner-meta-commentary not actionable for the executor; the spec-coverage was already verified inline during plan writing.

## Disagreed Findings

(none — all findings either agreed or severity-adjusted)

## Deferred Findings

(none)

## Severity Disagreements

- **H1 — Plan inlines ~310 lines of `build-lint-probe.ts`.** Agree with the finding (the helper is a non-trivial code block embedded in the plan). **Disagree with severity (High → Low).** Reasoning:
  - The writing-plans skill explicitly says "Complete code in every step — if a step changes code, show the code" — inlining the helper follows the skill's own guidance, not a deviation.
  - Phase 2a precedent (`build-strict-probe.ts`) inlined its helper identically and shipped cleanly.
  - The helper is verified by Steps 2–6 of Task 1.0b (the helper's outputs are inspected against expected shape, top-N file counts, and per-rule deltas vs Spec §1.3 anchors); a bug in the inlined code surfaces at Step 2 of the same commit and aborts before propagating.
  - The helper is throwaway-style (used once per wave checkpoint), not a long-lived API; the "if it has a bug, the plan has a bug" concern is mitigated by Step 0's verification gating.
  
  Not arguing the helper is *necessarily* correct — arguing the embedded-source-with-verification pattern is the right shape for plans of this kind. Severity-correcting to Low; no plan revision required beyond what M1/M2/M4 will incidentally improve.

## Open Questions

(none — all findings are addressed by the agreed revisions or by severity adjustment)
