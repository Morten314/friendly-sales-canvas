---
synthesizes_review: docs/reviews/17-frontend-phase-2a-strict-ts-design-spec-review-4.md
artifact: specs/17-frontend-phase-2a-strict-ts-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-27
round: 4
---

## Round Recommendation

no

Reason: All 9 findings agreed and resolved with mechanical/clarifying revisions. The [Critical] internal contradiction was a round-3 follow-through gap that I missed; reconciling it does not open new design surface. The [High] regex syntax issue is a tooling correctness fix.

## Agreed Findings

- **[Critical] TD-FE cadence reconciliation.** Round-3 simplified the escape-hatch mechanism in §3 Step 3 and §4 item 5 to "only at the 5th entry, no further triggers." Four other sections (§1.1 line 20, §2.1 line 70, §5 R2, §3 Step 4 escape-hatches-policy line) still carry the round-2 "every batch of 5" wording. Revising all four to match the simplified policy: a single TD-FE registration at the 5th entry; entries beyond 5 logged in the file but trigger no further TD-FEs; Phase 13 audits all entries.
- **[High] Fix verification command syntax throughout.** Replacing every occurrence of `rg -nE ':\s*any\b\|as\s+any\b\|<any>' --include='*.ts' --include='*.tsx'` with the working ripgrep form: `rg -n ':\s*any\b|as\s+any\b|<any>' -g '*.ts' -g '*.tsx' src/`. The original command failed under both ripgrep (no `-E`; `\|` is a literal pipe in Rust regex; `--include` not a flag) and grep ERE mode (where `\|` is literal). The 238 baseline number was produced by `grep -rEn` during exploration; documenting it as `rg` and using a syntactically invalid alternation pattern would silently produce different results on a future run. Single canonical command everywhere it appears (§1.3 row, §3 Step 5, §4 items 6–7).
- **[Medium] "Seven sub-flags" → "eight sub-flags".** TypeScript's `strict: true` umbrella enables eight sub-flags. The spec lists eight but calls it seven in §1.1, §2.1, §3 Step 1b, and §4 item 1. Correcting to "eight sub-flags" consistently. Also acknowledging in §3 Step 1b that `noImplicitAny: true` in the explicit-flag list is redundant with the `strict: true` umbrella (kept for explicitness).
- **[Medium] Add explicit `@ts-*` suppression prohibition to §2.4 posture rules.** Adding posture rule 7: "Adding new `@ts-expect-error`, `@ts-ignore`, or `@ts-nocheck` suppressions is out of scope for Phase 2a — use the escape-hatches file with `Untyped*` types instead. The §4 item 7 done-when gate (`@ts-*` count ≤5) enforces this." Removes ambiguity that the absence-from-posture-rules effectively prohibits.
- **[Low] Simplify probe config or annotate the redundancy.** The throwaway probe config redundantly sets `noImplicitAny: true` and `strictNullChecks: true` (both implied by `strict: true`). Simplifying the JSON to `strict: true` plus the three flags actually independent of strict (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`). Adding an inline `// note:` comment explaining the relationship.
- **[Low] TD-FE entry for interim escape-hatch path.** Adding to §3 Step 5 scorecard: "If `src/lib/types/escape-hatches.ts` exists at phase end, register a TD-FE entry: 'Escape-hatch file at interim path — relocate to `src/shared/types/escape-hatches.ts` when Phase 4 creates `src/shared/`.' This makes the deferred relocation visible as an action item, not an implicit assumption."
- **[Low] Qualify `Untyped*` visibility claim re: import aliasing.** Revising §3 Step 3 line 257 to: "The `Untyped*` type prefix is mandatory — visible at most import sites (where the comment is not), it signals temporariness. Callers should not alias the prefix away (e.g., `import { UntypedX as Y }`); if the file grows to a count where aliasing risk is non-trivial, Phase 2b can add a lint rule to enforce."
- **[Nit] Replace "leaves before monsters" colloquialism.** §3 Step 2 and §3 Step 3 commit-grain headers: replacing "leaves before monsters" with "low-error files before high-error files."
- **[Nit] DRY the sub-flag enumeration.** Defining the full list of eight sub-flags once in §1.3 (a new row "Strict-mode sub-flag composition" under the absent-error-categories row). §1.1, §2.1, §3 Step 1b, §4 item 1 reference the §1.3 row rather than copy-pasting the list. Keeps the spec single-source-of-truth for the canonical sub-flag set.

## Disagreed Findings

(None.)

## Deferred Findings

(None.)

## Severity Disagreements

(None — the [Critical] severity on the internal contradiction is justified; everything else is reasonable.)

## Open Questions

(None — all 9 findings categorized and resolved through revisions to the spec.)
