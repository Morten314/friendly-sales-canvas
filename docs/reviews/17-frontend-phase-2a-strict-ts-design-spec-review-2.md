---
artifact: specs/17-frontend-phase-2a-strict-ts-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-27
round: 2
---

## Context

Round 1 identified 12 findings (1 High, 4 Medium, 4 Low, 3 Nit). The spec was revised to address most of them: the Wave C count is now ~36 (was ~51), LOC anchor corrected to 67,469, Steps 5/6 merged, `useRef<T>(null)` guidance added, `import type` circular-import note added, bare `_` pre-existing usage addressed, TS7016 risk added as R10, and escape-hatch file-path deviation noted. This review is a fresh pass on the revised spec, checking whether round-1 fixes are sound and surfacing anything previously missed.

## Findings

### [High] Escape-hatch hard cap still contradicts master plan's explicit "no hard cap" instruction

**Location:** §3 Step 3 "Escape-hatches policy (two-tier cap with user checkpoint at the hard cap)" and §1.1 bullet 5

The master plan (Spec 14 §4 Phase 2a row, line 298) states: **"No hard cap up front: Phase 2a's own spec sets an initial cap based on the actual error count surfaced during planning; Phase 13's audit re-evaluates every entry and removes the no-longer-needed ones. The number 10 was a placeholder in round 1 — drop the predetermined cap."**

The spec was revised from round 1's auto-abort-at-10 to a user-checkpoint-at-10 with three options (raise / defer / abort). This is softer, but it still introduces a hard cap that triggers a phase-halting decision point. The master plan's instruction is unambiguous: "drop the predetermined cap" and let Phase 13 audit handle re-evaluation. The spec should either (a) remove the hard cap entirely and rely solely on TD-FE registration as the tracking mechanism (which aligns with the master plan's posture), or (b) explicitly override the master plan with a documented rationale for why a cap is needed despite the master plan saying it isn't.

The soft cap (5 → auto-raise to 10 with TD-FE registration) is reasonable as a tracking threshold. The hard cap at 10 with phase-halting is the problem.

### [Medium] Escape-hatch cap calibrated against TS7006 only, but applied globally across Wave B + C

**Location:** §3 Step 3, paragraph beginning "The 5/10 thresholds are calibrated against the 83 TS7006 (implicit-any) baseline"; §3 Step 4 line "Cap is global to Phase 2a — entries added in Wave B count against Wave C's budget"

The justification says "5 ≈ 6% of TS7006" and "10 ≈ 12% of TS7006" — but the cap is global to Phase 2a, shared between Wave B (83 errors) and Wave C (36 errors). If the cap is global, it should be calibrated against the combined scope (119 errors), making 5 ≈ 4.2% and 10 ≈ 8.4%. Alternatively, if the calibration against TS7006 is intentional because most escape hatches are expected to come from implicit-any sites, state that assumption explicitly. As written, the reader must infer why TS7006 alone is the denominator.

### [Medium] One commit per dead-shadcn file is over-granular for zero-risk deletions

**Location:** §3 Step 1a "one commit per file"

Each of the 15 dead-shadcn deletions is a trivial `rm` followed by a 6-check verification. Phase 1 already confirmed these files have zero inbound references. Giving each its own commit produces 15 commits for mechanically identical operations — adding review noise without proportional review benefit. Batching 3–5 files per commit (e.g., by functional group or alphabetically) would reduce Step 1a to 3–5 commits while still allowing granular revert if a surprise inbound is found. The 6-check output can go in the commit body for traceability. The current granularity bloats the branch's commit history (estimated 30–40+ commits across the phase) without a stated justification.

### [Medium] Escape-hatch two-tier mechanism is overengineered for the likely scenario

**Location:** §3 Step 3, the full "Escape-hatches policy" block (lines 213–234)

The mechanism has five escalation levels: (1) entries 1–5 silently added, (2) 5th entry triggers TD-FE registration and auto-raise, (3) entries 6–10 added without additional TD-FE, (4) 10th entry triggers phase halt, (5) human picks from three options. This is a significant procedural apparatus for a fallback mechanism. Given the spec's own analysis (461 errors, 83 implicit-anys, well-understood histogram), the probability of needing 10 escape hatches is low. A simpler approach — e.g., "log each escape hatch with justification; if count exceeds 5, register a TD-FE capturing the pattern; no hard cap" — would provide the same traceability without the escalation ladder. The current design reads as if it was built for a much higher-risk scenario than the data supports.

### [Medium] Scorecard "reviewable surface" is undefined and unconstrained

**Location:** §3 Step 5, "Diff-size totals" bullet: "Soft target: ~1,000 lines reviewable surface. Overage is informational, not a gate."

Three problems: (a) "reviewable surface" is not defined — does it include generated probe JSONs, the escape-hatches file, audit artifacts? Those inflate the count without being true review burden. (b) "Informational, not a gate" means the target provides no actual constraint — what actionable information does it provide? (c) There's no upper bound. If the phase produces 3,000 lines of reviewable diff, the scorecard notes it as an overage and nothing happens. Either give the target teeth (e.g., "overage triggers a review-split discussion") or remove it to avoid false precision.

### [Medium] §2.3 "tighten" wording doesn't account for return-type narrowing changing downstream inference

**Location:** §2.3 Frozen interfaces, line "Signatures may *tighten* (adding parameter types, narrowing return types) but no rename, no removal, no semantic change."

Wave B's implicit-any fixes will narrow function return types from effectively `any` (inferred) to concrete types. This "tightening" changes downstream type inference at every call site — functions that previously accepted `any` returns now receive a narrower type, which may surface new strict errors in files the implementer hasn't touched. The spec treats this as acceptable ("no semantic change" at the runtime level), but at the type level, narrowing a return from `any` to `SomeType` is a semantic change for callers. The posture rules in §2.4 should explicitly acknowledge that Wave B may cascade into unmodified files and clarify that cascading type errors are in scope (the file-by-file commit grain handles this — each cascade gets its own commit). Currently this is implicit in R4 but not stated in the frozen-interfaces contract.

### [Low] "Top 8 files = 70% of errors" is actually ~74%

**Location:** §1.3 table, "Concentration" row

The listed counts (144 + 80 + 25 + 22 + 18 + 18 + 17 + 16 = 340) divided by 461 = 73.7%. Stating "70%" is close but under-represents the concentration. For a spec that otherwise tracks exact counts (461, 67,469 LOC, 238 inline anys), the rounding is inconsistent. "~74%" or the exact fraction would match the spec's precision standard.

### [Low] `tsconfig.node.json` dismissal justified by "agent-readiness" instead of build behavior

**Location:** §2.2, line "non-strict there has no agent-readiness implication"

Phase 2a is about type safety, not agent readiness. The relevant question is whether `tsconfig.node.json` being non-strict could cause `vite build` to fail during the preflight chain. Since `vite.config.ts` and tooling scripts use `tsconfig.node.json`, and `vite build` invokes `esbuild` (which transpiles without typechecking), the dismissal is technically correct — but the justification should reference the build pipeline's behavior, not an unrelated concept. As written, a reader might wonder what "agent readiness" has to do with TypeScript strictness.

### [Low] No mid-phase rollback strategy beyond "revert"

**Location:** §5 Risks R6 (Step 1a), R5 (red typecheck mid-phase)

R6 says "revert that one commit; do not proceed until the inbound is identified." R5 says "acceptable: `master` stays green." But there's no general rollback procedure for mid-phase failures in Waves A–C. If Wave A commit #8 breaks something that only manifests during Wave C (e.g., a type deletion that seemed safe but a later semantic fix reveals was wrong), does the implementer revert to Step 1b (flag flip) and redo Wave A, or revert the entire branch? The spec should state a default: revert the offending commit and re-fix, or revert to the last clean Step-5 checkpoint (which doesn't exist until the end). Adding a "re-verify after each wave" step (a quick `tsc --noEmit` count, not a full preflight) would give natural rollback points without slowing execution.

### [Low] §1.3 table still implies `strictNullChecks` is explicit in `tsconfig.app.json`

**Location:** §1.3 table, row "Current `tsconfig.app.json` (5 explicit flags)"

The parenthetical note at the end of this row says `strictNullChecks` is "not explicitly listed in the app config — its effective value comes from `strict: false` and the composite root's override below." This is correct but the row's header says "5 explicit flags" and the table cell lists six values (the five explicit ones plus the `strictNullChecks` note). The round-1 review flagged this as a Nit. It's still present and still slightly misleading — a reader scanning the table quickly could count six items in a row labeled "5 explicit flags." A clearer structure would be to split the `strictNullChecks` note into a separate table row or footnote.

### [Nit] Escape-hatch `EscapeHatch*` prefix reads as namespace, not TODO marker (carried from round 1)

**Location:** §3 Step 3 escape-hatch code example, `export type EscapeHatchLeadFilter = any;`

The `// TODO(phase-13):` comment provides greppability, so the round-1 concern about naming is partially addressed. However, the `EscapeHatch` prefix itself reads as a module namespace (like `Icu` or `React`) rather than a temporary marker. A name like `UntypedLeadFilter` or `TODO_LeadFilter` would more immediately communicate "this is temporary and wrong" to a reader who encounters it at a call site without scrolling to the definition. The `// TODO(phase-13):` marker is only visible at the definition, not at import sites.
