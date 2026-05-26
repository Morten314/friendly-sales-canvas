---
synthesizes_review: docs/reviews/15a-frontend-phase-0a-inventory-plan-review-1.md
artifact: plans/15a-frontend-phase-0a-inventory.md
artifact_type: plan
reactor_model: claude-opus-4-7
date: 2026-05-26
round: 1
---

## Round Recommendation

**no**

Reason: Both reviewer-High findings agreed with severity disagreements (downgraded to Medium and Low respectively) — neither blocks a plan-ready determination. All remaining items are correctness-cheap or spec-compliance polish. No revision opens new design surface; the largest single change is a function-internal rewrite of `countStaticRefs` that doesn't alter interface or output.

## Agreed Findings

- **[H1] No plan-level abort criteria.** Adding a short "Abort criteria" section between the Architecture paragraph and Task 0: "If any single task fails after two independent debug attempts, pause and report to the operator for a go/no-go decision. If Task 9 CI cannot go green within 3 pushes, log findings to `docs/TECH_DEBT.md` and report to operator." Severity disagreement — see below.

- **[H2] Missing regression verification between package.json-mutating tasks.** Adding a one-line note to Task 5 Step 6 explicitly stating that Task 6's 3× Playwright runs during NFR measurement serve as the regression gate for the devDep additions in Tasks 4 and 5. The reviewer's two options were (a) add explicit re-run or (b) document the implicit gate; option (b) is cheaper and the implicit gate is already strong. Severity disagreement — see below.

- **[M1] `time_dev_start` has no timeout — can hang indefinitely.** Adding a 60-second wall-clock timeout to the `while` loop in `time_dev_start`. If exceeded, the function prints the vite log to stderr and exits with an error. Prevents the 10–20 min NFR script from becoming an indefinite hang.

- **[M2] `time_cmd` uses bash interpolation inside Python f-string.** Changing both `time_cmd` and `time_dev_start` to pass values via `sys.argv` instead of `${var}` interpolation: `python3 -c "import sys; print(f'{float(sys.argv[1]) - float(sys.argv[2]):.3f}')" "$end" "$start"`. Severity disagreement — see below.

- **[M3] Fully serial when Tasks 5/6 are independent of 3/4.** Adding a "Parallelization opportunities" note to the Architecture paragraph: after Task 2 completes, the chains `[3 → 4 → 7]` and `[5]` and `[6]` are independent and can be dispatched in parallel under subagent-driven execution. Caveat: Tasks 4 and 5 both run `npm install`, so if executed in a shared working tree they serialize on the lockfile; in subagent worktrees they run truly parallel. Severity disagreement — see below.

- **[M4] No recovery guidance for `npm run build` failure (Task 5 Step 3).** Adding an explicit "If build fails: STOP. Do not proceed to Step 4. Investigate the build error before continuing" line after the build command. Without this, an empty/incomplete `dist/` would silently produce a misleading bundle baseline.

- **[L1] "Nine commits" should be "Eight commits".** Architecture paragraph contradicts Task 9 Step 1's "8 commits". Changing to "Eight commits on one branch."

- **[L2] Bundle baseline script includes `.html` and `.svg` beyond spec scope.** Spec §2.3 specifies `.js` and `.css` only. Tightening the regex in `capture-bundle-baseline.ts` from `/\.(js|css|html|svg)$/` to `/\.(js|css)$/`. Phase 2c can extend the script if it wants full shipped-size accounting; the spec is the source of truth here.

- **[L3] `countStaticRefs` is O(files) ripgrep invocations.** Refactoring `build-audit-scorecard.ts` to run ripgrep once with `--no-heading --line-number` extracting all `from '…'`/`from "…"` import statements across `src/` and `e2e/`, then aggregating per-target-path counts in-memory. Reduces ~300 process spawns to 1, runtime from minutes to sub-second. Also more robust to weird filenames (no per-file regex composition).

## Disagreed Findings

- **[N1] Comment block 4 lines vs spec's "2-line".** Spec §2.5 says "2-line comment block" but spec §2.6 line 178 also says "a one-line example in the comment block at `playwright.config.ts` documents [the Docker fallback]." The two spec asks (re-baseline command + Docker fallback example) cannot fit in 2 lines together — the spec is internally loose about the exact size. The plan's 6-line block covers both spec requirements: the re-baseline command and the macOS/Windows Docker fallback. The reviewer notes the plan's version "is more helpful" — that's the deciding factor. Leaving as is.

## Deferred Findings

None. All findings either accepted or disagreed.

## Severity Disagreements

- **[H1] No plan-level abort criteria → Medium, not High.** The risk is "agent thrashes for unbounded time," not "plan breaks the codebase." Subagent-driven execution has an implicit operator-in-the-loop between tasks (the parent agent reviews); inline execution has the user present. The practical blast radius is bounded by attention span, not by an unchecked failure mode. The mitigation is cheap and worth adding, but the severity framing as High overstates the risk relative to typical High findings (factual errors, contradictions, security-relevant).

- **[H2] Missing regression verification → Low, not High.** All three devDeps added in Tasks 4–5 (`knip`, `gzip-size`, `tsx`) are tooling-only — none are imported into the production code or Playwright config. The theoretical regression risk is near-zero. Task 6's 3× Playwright runs do provide an empirical safety net. The reviewer's structural point ("implicit safety nets are fragile to reordering") is valid, but the reorder risk is itself low because the plan's dependency narrative is explicit. Documenting the implicit gate addresses the structural concern without overstating the practical risk.

- **[M2] Bash interpolation into Python f-string → Nit, not Medium.** `python3 -c 'import time; print(time.time())'` always returns plain decimal floats — no observable code path produces scientific notation or an error message that would make the bash-substituted Python a syntax error. The pattern is ugly but functional. Applying the reviewer's recommended fix anyway because it's cheap and more robust to future changes, but the severity as Medium overstates the practical risk.

- **[M3] Parallelization opportunities → Low, not Medium.** Serial execution adds maybe 10–15 minutes to a multi-hour plan. Not a correctness issue, just an optimization for subagent-driven execution mode. Adding the note is cheap; severity framing as Medium overstates the cost of leaving it.

## Open Questions

1. **Whether to ship a parallelization-aware execution recommendation in the writing-plans handoff message.** The plan's header recommends `superpowers:subagent-driven-development`. The Parallelization opportunities note (from [M3]) identifies which task groups are independent. The subagent-driven-development skill itself may already handle dispatch ordering — if so, the plan's note is informational only. If not, the operator may want to manually dispatch the parallel groups. Trigger to revisit: if execution observably bottlenecks on serial dispatch where it didn't need to.

2. **Whether the abort-criteria threshold of "3 pushes for Task 9 CI" should be tighter.** A failing CI debug loop can burn an hour per push (CI runtime + investigation). 3 pushes = up to ~3 hours of potentially wasted time before pause-and-report. A tighter threshold (e.g., 2 pushes) would shorten the unbounded-debug window but might also trigger premature pauses on transient infra failures. The plan ships with 3 as a starting value; can be tuned after first real execution.
