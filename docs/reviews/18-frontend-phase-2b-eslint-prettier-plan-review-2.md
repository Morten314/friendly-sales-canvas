---
artifact: plans/18-frontend-phase-2b-eslint-prettier.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-28
round: 2
---

## Context

Round 2 re-review after the plan author incorporated round-1 synthesis. The paired spec (`specs/18-frontend-phase-2b-eslint-prettier-design.md`, 563 lines, round 3 clean) was re-read in full for drift comparison. The plan grew from ~3,212 to 3,248 lines. Six of round 1's eight High/Medium findings were addressed; two carry forward (one unchanged, one partially). The plan's predecessor (Plan 17 / Phase 2a) established the wave-methodology precedent this plan inherits.

## Findings

### [High] `build-lint-probe.ts` source code still inlined verbatim (~310 lines) — round 1 carry-forward

**Location:** Task 1.0b Step 1, lines 411–722

Round 1 flagged this as High. The plan retains the full TypeScript source code for `build-lint-probe.ts` inline — including CLI arg parsing, area classification logic, ESLint/Prettier invocation, JSON roll-up, and artifact emission. This is implementation, not planning. The spec (§4 Step 0) describes the helper's contract ("Generate a `build-lint-probe.ts` helper that runs the above and produces a per-rule × per-area roll-up"), not the source code.

Risk: if the inlined code has a bug (e.g., `classifyArea` directory assumptions, `execFileSync` error handling, the JSON roll-up aggregation), the executor follows it verbatim. Plans should specify behavior and constraints, not write source code. The appropriate fix is to describe the helper's contract (CLI interface, inputs, 4 output artifacts, error-handling expectations, probe-config lifecycle) and let the executor implement it.

### [Medium] Post-Wave-A re-probe artifact is committed without gate value — overengineering

**Location:** Task 3.end Steps 6–7, lines 1746–1773

Task 3.end creates and commits a post-Wave-A re-probe (`docs/audits/2026-05-28-post-wave-a-frontend-phase-2b-lint-probe.{json,txt}`). The plan itself describes this as a "sanity check; informational" (line 144, 1752). The spec's Step 2 end-of-wave requires only format:check green + vitest green — no re-probe artifact. The post-Wave-B and post-Wave-C re-probes are justified because they drive the next wave's per-file ordering. The post-Wave-A re-probe has no such downstream consumer. Committing an informational artifact that feeds no gate adds a commit to the branch history and ~30 lines of plan text without gate value. Recommend either (a) run it as a local-only sanity check without committing, or (b) remove it entirely and rely on the format:check + vitest wave-end gate.

### [Medium] Wave B auto-fix defaults to combined sweep with a 500-line threshold, silently overriding the spec's per-rule default at 300

**Location:** Header "Plan-stage decisions" #3 (line 123); Task 4.prep Step 2 (lines 1827–1845); Task 4.1 (lines 1849–1919)

The spec §4 Step 3 states: "Per-rule batching: if a single rule's --fix output exceeds **300 line-changes** across the tree, split by area. Otherwise **one commit per rule**." The spec's implied default is per-rule commits with a 300-line-per-rule split threshold. The plan's decision #3 overrides this to a combined `eslint --fix` sweep as default, splitting only when the total combined diff exceeds 500 lines. This changes both the default granularity (combined vs per-rule) and the threshold (500 vs 300). The plan has authority to make this call (spec §7.3 defers batching decisions), but it does not acknowledge that it is overriding the spec's stated default. An executor who cross-references the spec would encounter an unexplained discrepancy. Recommend adding a one-line note to decision #3: "This overrides the spec §4 Step 3 per-rule default in favor of combined, because the spec's per-rule approach adds commit count without proportional review value when the combined diff is small."

### [Medium] Wave B auto-fix `eslint --fix` without `--rule` may apply fixes for rules the plan doesn't intend Wave B to own

**Location:** Task 4.1 Step 1, line 1857

The combined `eslint --fix` sweep runs without rule scoping. If any Wave C or Wave D rules happen to have auto-fixable violations (unlikely but possible for rules like `no-floating-promises` in trivial cases), the combined sweep would fix them silently, mixing them into the Wave B commit. The plan's per-commit gate (build + vitest + typecheck green) would catch runtime regressions, but the posture-rule-9 purity check ("only the rule's targeted output") would be violated. The split-path alternative (Tasks 4.2–4.3) uses `--rule` to scope, but the combined default does not. Recommend adding a post-fix spot-check step that confirms no Wave C/D rules were incidentally resolved (a grep of the diff for `no-floating-promises` / `no-misused-promises` / `exhaustive-deps` patterns), or explicitly accept the risk in the task body.

### [Low] Wave C loop has no defined action when the ~10-commit progress check shows non-monotonic decrease

**Location:** Task 5.loop Step 6, line 2493

The loop says: "After every ~10 commits, run `npm run lint ... | grep -E '(no-explicit-any|no-unsafe-)' | wc -l` to confirm the count is decreasing monotonically." If a Wave C fix inadvertently introduces a new violation (e.g., typing a parameter triggers a downstream `no-unsafe-*` cascade that the file-grain commit doesn't absorb), the count would increase. The plan states the expectation but not the remediation. A one-line addition would suffice: "If the count increases, the most recent commit likely introduced a cascade — revert it and apply a tighter fix per the Wave-C cascade recovery procedure in the plan header."

### [Low] Task 3.7 Step 2 uses `<config-files>` placeholder requiring manual substitution without a concrete fallback

**Location:** Task 3.7 Step 2, line 1638

The command `npx prettier --write e2e/ scripts/ <config-files>` requires the executor to substitute actual config filenames from Step 1's `ls *.config.*` output. Step 1 (line 1625) lists the expected files but the plan doesn't provide a concrete command that pipes Step 1's output into Step 2. This is a minor friction point — the executor must manually construct the command. A one-liner like `npx prettier --write e2e/ scripts/ $(ls *.config.* 2>/dev/null)` would eliminate the substitution step.

### [Low] Wave D `rules-of-hooks` fix is explicitly last, but no provision exists for a Wave D sub-decomposition trigger at execution time

**Location:** Task 6.rules-of-hooks, lines 2787–2848

The plan's header threshold gate (line 42) checks `no-floating-promises + no-misused-promises + exhaustive-deps > 300` at Step 0 and triggers Wave D sub-decomposition. But the `rules-of-hooks` violation (1 error) is not included in that count. If the single `rules-of-hooks` fix turns out to be a major structural problem requiring component decomposition across multiple files (e.g., extracting a child component that changes the render tree), the plan's abort criterion ("3 failed attempts → halt") would fire, but there's no softer escape. The fix itself may need to create new files (extracted component), which is a minor scope expansion not covered by the spec's "restructure the hook call" language. Minor — the abort criterion handles the failure case.

### [Nit] Commit message templates continue to be verbose — round 1 carry-forward

**Location:** Throughout

Round 1 noted this as Nit. The plan retains multi-paragraph commit message bodies. Not wrong; adds length without proportional review value. No action needed.

### [Nit] `cd ..` instead of absolute paths — round 1 carry-forward

**Location:** Throughout

Round 1 noted this as Nit. Pattern persists. Not harmful for an executor following the plan linearly.
