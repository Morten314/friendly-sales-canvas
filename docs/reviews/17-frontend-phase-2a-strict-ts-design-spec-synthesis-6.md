---
synthesizes_review: docs/reviews/17-frontend-phase-2a-strict-ts-design-spec-review-6.md
artifact: specs/17-frontend-phase-2a-strict-ts-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-27
round: 6
---

## Round Recommendation

no

Reason: All 3 findings agreed; one [Low] characterization correction and two [Nit] wording fixes. No new design surface; the gate property already holds.

## Agreed Findings

- **[Low] `<any>` regex catches single-argument generics — spec's exclusion claim is partly wrong.** Verified live: `rg -n '<any>' -g '*.ts' -g '*.tsx' src/` returns 25 matches in the current tree, all of which are single-argument generics (`Promise<any>`, `useState<any>(null)`, `ComponentType<any>`, etc.). `Record<string, any>` and `Map<string, any>` patterns (4 in the tree) are genuinely excluded because they don't contain the literal `<any>` substring. The spec's round-5 characterization listed `Promise<any>`, `Array<any>`, `Partial<any>` as excluded — incorrect, all three are caught. The gate property still holds (same regex on both sides), but the reader-facing description should be accurate. Correcting §1.3 to: "does not count `any` in multi-argument generic positions (e.g., `Record<string, any>`, `Map<string, any>`) — single-argument generic positions like `Promise<any>` are incidentally matched by the `<any>` alternative and are already included in the 238 count." Removing the "Actual prevalence is higher" overstatement since single-arg generics are not under-counted.
- **[Nit] §1.1 dead-shadcn parenthetical misattributes failure to strict mode.** The 15 dead shadcn files fail with TS2307 ("cannot find module") because Phase 1 removed their npm deps — a module-resolution failure that occurs under any tsconfig setting, strict or not. The current parenthetical "(they fail to compile under strict and have zero inbound references)" implies strict mode is the cause. Replacing with: "(they fail to compile with TS2307 missing-module errors from Phase 1's npm-dep removal and have zero inbound references)."
- **[Nit] §3 Step 1b co-commit justification overstated.** The current claim "reverting any one of the three without the others would leave the repo in an inconsistent state" is too strong — reverting just the root-config housekeeping edit (edit 3) while keeping the flag flip and script fix has zero functional impact (the root config is standalone with `"files": []`). Only the flag-flip/script-fix pair is functionally interlocked. Narrowing the claim: "the spec keeps these in one commit because the flag flip (edit 1) and the script fix (edit 2) are functionally interlocked — reverting one without the other leaves the repo in an inconsistent state. The root-config cleanup (edit 3) rides along for atomicity since the three edits all configure the same typecheck surface, not because reverting it alone would cause inconsistency."

## Disagreed Findings

(None.)

## Deferred Findings

(None.)

## Severity Disagreements

(None — Low for the characterization correction (reader-facing accuracy, gate unaffected) and Nit for the two wording fixes are all appropriate.)

## Open Questions

(None — all 3 findings categorized and resolved through revisions to the spec.)
