---
synthesizes_review: docs/reviews/17-frontend-phase-2a-strict-ts-design-spec-review-5.md
artifact: specs/17-frontend-phase-2a-strict-ts-design.md
artifact_type: spec
reactor_model: claude-opus-4-7
date: 2026-05-27
round: 5
---

## Round Recommendation

no

Reason: All 6 findings agreed and resolved with mechanical revisions. The [Critical] is a one-line `package.json` script fix that makes the formal gate functional but does not change the methodology or open new design surface.

## Agreed Findings

- **[Critical] `npm run typecheck` checks zero files.** Verified live: `tsc --noEmit` against the root `tsconfig.json` (which has `"files": []` and references but no `"include"`) returns exit 0 with no files checked, while `tsc --noEmit -p tsconfig.app.json` returns exit 2 with 28 errors under the current non-strict baseline. The preflight chain invokes `npm run typecheck`, so every formal gate that depends on it is trivially satisfied. The wave-end checkpoints already use the correct `tsc -p tsconfig.app.json --noEmit` form, so the methodology's intermediate checks work — only the formal done-when gates are broken. Fix: add `package.json` script change to §2.1 in-scope (`"typecheck": "tsc --noEmit -p tsconfig.app.json"`); land it in §3 Step 1b's commit alongside the flag flip; update §3 Step 5 verification text and §4 items 3 + 8 to reflect that `npm run typecheck` now exercises the app config.
- **[Medium] Root tsconfig.json override removal is functionally irrelevant.** Verified: `tsconfig.app.json` is standalone (no `"extends"`); the root config's overrides only affect files in the root project, of which there are zero. The removal is IDE-alignment housekeeping, not a load-bearing typecheck change. Recasting §2.1 and §3 Step 1b language: the app-config flag flip is the functional change; the root-config override removal is co-committed housekeeping that prevents future readers from being confused by contradictory settings. The spec keeps the removal in scope but no longer presents it as on par with the app-config edit.
- **[Medium] No mid-phase test-suite health checkpoint.** §3 opening asserts "Vitest and Playwright continue to pass mid-phase" but only verifies `tsc` error counts at wave boundaries. R3's public-export protection (§2.3) covers `src/lib/`, `src/hooks/`, `src/utils/`, `src/contexts/` but not `src/components/`, `src/pages/`, `src/services/` — so a test importing an internal symbol from those areas could be silently broken by a Wave A deletion and not surface until Step 5. Adding `npx vitest run` to each wave-end checkpoint (Steps 2/3/4). Vitest runtime is seconds; the cost is low and catches test-breaking changes within one wave rather than at end-of-phase. Playwright stays at Step 5 only (its runtime is materially higher).
- **[Low] Inline-any regex undercounts generic-parameter `any` usage.** The regex `:\s*any\b|as\s+any\b|<any>` does not match `Record<string, any>`, `Promise<any>`, `Array<any>`, etc. The delta property still holds (same regex for §1.3 baseline and §4 item 6 gate), so no net-new `any` of the measured forms can slip through. But the "238 inline-any" baseline understates actual prevalence. Adding a clarifying note to §1.3: "This count covers `any` in type-annotation (`: any`), assertion (`as any`), and cast (`<any>`) positions only. It does not count `any` in generic type-argument positions (e.g., `Record<string, any>`, `Promise<any>`). Phase 2b's `@typescript-eslint/no-explicit-any` lint rule covers all positions."
- **[Low] Wave C TS2307 re-verification lacks an explicit remediation path.** §3 Step 4's opening re-verification doesn't specify what to do if TS2307 residue is non-zero. Adding: "If the residue is non-zero, the surviving file is a Step 1a deletion that didn't land (a 6-check-kit hit, or a deferral). Return to Step 1a's procedure for that file — either complete the deletion, refactor the inbound, or register a TD-FE entry. Do not handle TS2307 as a Wave C semantic error; the underlying cause is a dead-import, not a type-narrowing problem."
- **[Nit] tsconfig.node.json asymmetry note.** `tsconfig.node.json` already carries `strict: true` (with `noUnusedLocals: false` and `noUnusedParameters: false`) while `tsconfig.app.json` has `strict: false`. Phase 2a does not change the node config (out of scope per §2.2). Adding a one-line note to §1.3's `tsconfig.node.json` row that surfaces this asymmetry so a reader comparing the two configs doesn't have to derive it.

## Disagreed Findings

(None.)

## Deferred Findings

(None.)

## Severity Disagreements

(None — the [Critical] severity is justified given that every formal gate becomes non-functional; the [Medium]s and [Low]s sit at the right level.)

## Open Questions

(None — all 6 findings categorized and resolved through revisions to the spec.)
