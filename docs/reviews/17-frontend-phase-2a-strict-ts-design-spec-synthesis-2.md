---
synthesizes_review: docs/reviews/17-frontend-phase-2a-strict-ts-design-spec-review-2.md
artifact: specs/17-frontend-phase-2a-strict-ts-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-27
round: 2
---

## Round Recommendation

no

Reason: All 11 findings agreed and resolved by simplifying the escape-hatch mechanism (drop hard cap, drop user-checkpoint) plus mechanical clarifications; no critical/high residue, no new design surface opened.

## Agreed Findings

- **[High] Hard cap dropped entirely.** Revising §1.1 bullet 5, §2.1 escape-hatch bullet, §3 Step 3 escape-hatches block, §3 Step 5 verification checklist, §4 done-when item 5, §5 R2. New mechanism: a single soft cap of 5 entries. The 5th entry triggers a `TD-FE-<n>` registration capturing the pattern (per user's Q5 brainstorming choice). Each additional batch of 5 entries (entries 10, 15, 20…) triggers another TD-FE registration to capture the evolving pattern. No phase halt, no user checkpoint, no auto-abort. Phase 13's audit re-evaluates every entry per master spec line 298 ("Phase 13's audit re-evaluates every entry and removes the no-longer-needed ones"). The user-checkpoint mechanism from round-1 synthesis was a compromise that still imposed a halt master spec didn't want — round 2 surfaced this correctly.
- **[Medium] Cap calibration story.** Removing the "5 ≈ 6% of TS7006 / 10 ≈ 12%" percentage framing (the percentages were calibrated against an 83-error denominator but applied across the global B+C scope of 119, which doesn't math). Reframing the 5-entry threshold as "small enough that hitting it indicates a recurring pattern worth capturing as TD-FE; large enough to absorb a few genuine edge cases without ceremony." This is now the sole calibration justification since hard cap is gone.
- **[Medium] Shadcn deletion batching.** Revising §3 Step 1a to batch 15 deletions into 3 commits of 5 files each, alphabetically grouped: (a) `aspect-ratio`, `calendar`, `carousel`, `context-menu`, `form`; (b) `hover-card`, `input-otp`, `menubar`, `navigation-menu`, `radio-group`; (c) `resizable`, `slider`, `switch`, `toggle`, `toggle-group`. Each commit body contains the 6-check kit results for all 5 files in the batch. If any single file in a batch shows a non-zero hit, that file is excluded from the batch and handled per §3 Step 1a's surprise-inbound procedure (default: defer to TD-FE).
- **[Medium] Escape-hatch mechanism overengineering.** Same resolution as [High] — the simplified mechanism (one soft cap, no escalation ladder, no hard cap) directly addresses the overengineering finding.
- **[Medium] Scorecard diff-size target.** Revising §3 Step 5 scorecard item 7: dropping the "soft target ~1,000 lines" framing entirely. Replacement: "Diff size: total additions / deletions from `git diff --stat master..HEAD` reported verbatim in the scorecard, with the 15 dead-shadcn deletions called out separately so the reviewable surface is visible." No target, no gate — just reporting.
- **[Medium] §2.3 type-level cascade acknowledgment.** Adding a sentence to §2.3 after the "Public exports of `src/lib/`..." bullet: "Wave B's narrowing of `any` returns to concrete types changes type inference at downstream call sites — including in files this phase otherwise doesn't touch. This type-level cascade is in scope: each cascade gets its own commit per the file-by-file grain in §3 Step 3. R4 covers the operational handling."
- **[Low] Concentration percentage.** §1.3 "Concentration" row: "70%" → "~74%" (340/461 = 73.7%).
- **[Low] `tsconfig.node.json` dismissal wording.** §2.2 last bullet: replacing "no agent-readiness implication" with "esbuild transpiles `vite.config.ts` and tooling without typechecking, so its non-strict state does not affect the preflight chain. Phase 2c or Phase 4 may revisit if a build-time issue surfaces."
- **[Low] Wave-end checkpoints.** Adding to §3 between each wave a brief "wave-end checkpoint" step: run `tsc --noEmit | grep -c 'error TS'` and confirm the count dropped by the expected amount (Wave A: ~327, Wave B: ~83, Wave C: ~36). Quick check, not full preflight. If the count doesn't match expectations, the implementer pauses to investigate before the next wave. This gives natural rollback points without slowing execution.
- **[Low] §1.3 table strictNullChecks split.** Splitting the "Current `tsconfig.app.json` (5 explicit flags)" row into two table rows: one listing only the 5 explicit flags with their current `false` values; one separate row noting that `strictNullChecks` is not explicitly listed in the app config (its effective value derives from `strict: false` and the composite root's override).
- **[Nit] `Untyped*` prefix.** §3 Step 3 escape-hatch code example: renaming `EscapeHatchLeadFilter` → `UntypedLeadFilter`. The new prefix is more visible at import sites (where the `// TODO(phase-13):` marker is not visible). The `// TODO(phase-13):` definition-side marker stays mandatory.

## Disagreed Findings

(None.)

## Deferred Findings

(None.)

## Severity Disagreements

(None — all assigned severities reasonable on review.)

## Open Questions

(None — all 11 findings categorized and resolved through revisions to the spec.)
