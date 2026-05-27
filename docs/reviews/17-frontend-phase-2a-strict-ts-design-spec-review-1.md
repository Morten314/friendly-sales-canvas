---
artifact: specs/17-frontend-phase-2a-strict-ts-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-27
round: 1
---

## Findings

### [High] Escape-hatch hard cap contradicts master plan delegation model

**Location:** §3 Step 3 "Escape-hatches policy (two-tier)", also §1.1 bullet 5 and §4 item 5

The spec introduces soft cap 5 / hard cap 10 with abort-at-hard-cap semantics. Master plan (Spec 14 §4 Phase 2a row, line 298) explicitly states: "**No hard cap up front:** Phase 2a's own spec sets an initial cap based on the actual error count surfaced during planning; Phase 13's audit re-evaluates every entry and removes the no-longer-needed ones. The number 10 was a placeholder in round 1 — drop the predetermined cap."

Two problems: (a) the master plan delegates cap-setting to Phase 2a's spec but requires it be "based on the actual error count surfaced during planning" — the spec cites 461 errors but never justifies why 5/10 are the right thresholds for that count. (b) The abort-at-10 mechanism (Step 3: "Phase 2a aborts per Spec 14 §5.7") is a significant escalation from the master plan's intent, which was to let Phase 13's audit clean up whatever Phase 2a accumulates. If 10 out of 461 errors genuinely need escape hatches, aborting the entire phase is a disproportionate response.

**Suggestion:** Either justify the 5/10 thresholds against the error-count data, or adopt the master plan's original posture (no hard cap, Phase 13 re-evaluates) and use the TD-FE register as the tracking mechanism. If a cap is retained, the abort trigger should be higher (proportional to the error surface — perhaps 5% of the re-baseline count) or removed entirely in favor of TD-FE logging.

### [Medium] Wave C error count "~51" is misleading after Step 1a deletions

**Location:** §3 Step 4 heading: "Wave C: semantic stragglers (~51 errors, file-by-file commits)"

The listed error codes for Wave C (TS2345×8, TS2322×7, TS18046×8, TS18047×5, TS18048×2, TS2339×4, TS6196×2) sum to 36. The "~51" figure includes 15 TS2307 errors from dead-shadcn files — but Step 1a is supposed to eliminate all TS2307s before Step 4 runs. The spec itself acknowledges this: "should be 0 after Step 1a — re-verify on first Step-4 commit." The heading should say "~36 errors" (with the TS2307 re-verification note as a safety check, not a count contributor). This matters for plan estimation and commit-count projections.

### [Medium] "Six strict flags in tsconfig.app.json" — only five exist there

**Location:** §1.1 bullet 1, §2.1 first bullet, §3 Step 1b second bullet

The spec consistently refers to flipping "six strict flags" in `tsconfig.app.json`. The actual file (verified at execution time) contains five: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitAny`, `noFallthroughCasesInSwitch`. `strictNullChecks` is only present in `tsconfig.json` (composite root) as an override. Setting `strict: true` in the app config *implies* `strictNullChecks: true`, and removing the composite root's `strictNullChecks: false` override completes the flip — so the technical approach is correct. But the wording should clarify that Step 1b flips five explicit flags in the app config and removes four overrides in the composite root (including `strictNullChecks`), rather than implying six flags exist in the app config.

### [Medium] LOC anchor disagrees with Phase 1 scorecard

**Location:** §1.3 table, row "Source LOC"

Spec states 67,475 LOC. The Phase 1 scorecard (`docs/audits/2026-05-27-frontend-loc-pass-1.md` line 18) records 67,469. The 6-LOC gap is trivial in isolation but undermines the spec's claim to be a precise anchor derived from Phase 1's output. Either the scorecard is wrong or the spec rounded; either way, they should agree. Step 0's re-baseline makes this moot for execution, but the design-time anchor should match the official record.

### [Medium] Step 5 / Step 6 boundary is confused

**Location:** §3 Step 5 last sentence: "If verification produces a clean checklist, the commit is the Step 6 scorecard."

Step 5 is "Verify done-when (one commit, may be empty)." Step 6 is "Final scorecard (one commit)." These are separate steps. If Step 5 passes clean, the text says "the commit is the Step 6 scorecard" — but then Step 6 would have no content and no commit. Either: (a) merge Steps 5 and 6 into one step (verify + scorecard in one commit), or (b) clarify that Step 5's "empty commit" is a verification checkpoint and Step 6 always produces its own scorecard commit. The current wording creates an ambiguity about whether two commits or one emerge from a clean pass.

### [Medium] Escape-hatch file path deviates from master plan without flagging

**Location:** §2.1 third bullet, §3 Step 3 escape-hatch code example

Master plan (Spec 14 §4 Phase 2a row) specifies `src/shared/types/escape-hatches.ts`. This spec places it at `src/lib/types/escape-hatches.ts` (because `src/shared/` doesn't exist until Phase 4) and notes "Phase 4 relocates the file to `src/shared/types/escape-hatches.ts` when `src/shared/` is created." The relocation plan is sound, but §7 (Companion documents) doesn't call this out as a deliberate deviation from the master plan's path. Future readers comparing Spec 14 and Spec 17 will see different paths and may assume one is wrong. Add a note to §7 or §2.1 explicitly acknowledging the divergence and the relocation plan.

### [Low] No discussion of `useRef<T>(null)` pattern under `strictNullChecks`

**Location:** §2.4 posture rule 2

The spec mentions `useRef(initialValue).current!` as an acceptable non-null assertion when `initialValue` is non-null. But the equally common `useRef<SomeType>(null)` pattern — where the ref starts null and is assigned later — is a frequent source of `strictNullChecks` errors in React codebases. The posture rules should explicitly state the allowed pattern (either type-narrow with a null guard, or use `useRef<SomeType | null>(null)` and guard). Without this, the implementer has to decide on a case-by-case basis whether `!` is acceptable for "assigned-after-mount" refs, which is exactly the kind of judgment the posture rules are meant to eliminate.

### [Low] No mention of circular-import risk when Wave B adds new type imports

**Location:** §3 Step 2 and Step 3 fix rules

Wave B's fix rules say "fix the source first" for array callbacks and "create a local `interface` or `type`" for object destructuring. When the proper type requires importing from another module, this can create circular dependencies (e.g., component A's parameter type imports from component B, which imports from A). The spec doesn't discuss this scenario. Options include: inlining the type locally, using `import type` (which is erased at compile time and less likely to cause runtime circular issues), or deferring to escape hatches. A one-line note in Wave B's fix rules would prevent the plan author from having to rediscover this.

### [Low] No discovery step for existing bare `_` parameters conflicting with `_argName` convention

**Location:** §2.4 posture rule 5

The spec mandates `_argName` (named underscore) over bare `_` for unused parameters. The codebase may already contain bare `_` parameters that predate this convention. Wave A (TS6133 sweep) would encounter these, but the fix rules only say to apply the `_argName` convention — they don't call for an initial scan to establish the scope of renames needed. If the codebase has many bare `_` uses, the Wave A commit diffs could be larger than expected. A note in Step 0's re-baseline (or a separate pre-flight grep) would quantify this.

### [Low] Third-party type declaration gaps not addressed as a risk

**Location:** §5 Risks table

The 461-error histogram doesn't include TS7016 ("could not find declaration file"), so this isn't currently an issue. However, the spec doesn't discuss what happens if a transitive dependency or a newly-installed Phase-1 package surfaces declaration gaps under strict mode. A brief risk entry (even just "acknowledged; no TS7016 in baseline, re-verify at Step 0") would close the gap.

### [Nit] Escape-hatch type alias naming doesn't signal temporariness

**Location:** §3 Step 3 escape-hatch code example

The example `export type EscapeHatchLeadFilter = any;` uses a descriptive-but-permanent-sounding name. Since Phase 13 re-evaluates these, a naming convention that signals temporary status (e.g., `TODO_LeadFilter`, `UntypedLeadFilter`, or even `AnyLeadFilter`) would make greppability and audit easier. The `EscapeHatch` prefix works but reads as a namespace rather than a TODO marker.

### [Nit] §1.3 table lists `strictNullChecks: false` as an effective value for `tsconfig.app.json` row

**Location:** §1.3 table, row "Current `tsconfig.app.json`"

The table says `strictNullChecks: false` as one of the app config's current states, but `strictNullChecks` isn't explicitly present in `tsconfig.app.json` — it's implied by `strict: false`. The table is technically accurate about the *effective* value, but listing it as if it's an explicit entry conflates the two configs. A footnote or parenthetical "(implied by `strict: false`)" would prevent confusion for readers comparing the table against the actual file.
