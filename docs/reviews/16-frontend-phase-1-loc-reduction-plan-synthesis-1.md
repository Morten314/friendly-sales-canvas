---
synthesizes_review: docs/reviews/16-frontend-phase-1-loc-reduction-plan-review-1.md
artifact: plans/16-frontend-phase-1-loc-reduction.md
artifact_type: plan
reactor_model: claude-opus-4-7
date: 2026-05-27
round: 1
---

## Round Recommendation

no

Reason: All 5 agreed findings (2 Medium, 3 Low) revised in this round; remaining items are 1 Nit (deferred with explicit trigger) and 1 Nit (reviewer themselves acknowledged is non-actionable per frozen-intent policy). No Critical or High findings outstanding.

## Agreed Findings

- **Finding 1 [Medium]: Missing escape hatch for `knip --strict` vs shadcn/ui findings.** Revised Task 7.2 Step 2 to add a third recovery option (b): if failing findings are confined to `src/components/ui/`, add `"src/components/ui/**"` to `frontend/knip.json`'s `ignore` array. This is the spec-mandated path for shadcn findings per Spec 16 §2.2 + §8 (shadcn primitives stay in place — removing would violate the Phase 4 lock, reverting the gate punishes the whole codebase for an out-of-scope category). Knip `ignore` entries don't generate configuration hints, so done-when item 3 remains satisfied. Order of preference updated to (a) in-scope fix > (b) shadcn-ignore fold > (c) revert+TD-FE.

- **Finding 2 [Medium]: Per-area LOC baseline assumed available from Phase 0a but not verified.** Added Task 0b Step 4: verify Phase 0a's `docs/audits/2026-05-26-frontend-baseline.md` contains the Tier 1 per-area table (grep for the heading) before Phase 1 work proceeds. Also added a fallback path in Task 7.1 Step 2: if the Tier 1 table is missing, check out Phase 0a's baseline commit SHA (recorded in Task 0b Step 4), run the per-area aggregation script against that tree, capture as the "before" column, restore the working tree.

- **Finding 3 [Low]: Step 4-prep Python script uses `str | None` syntax (Python 3.10+).** Added `from __future__ import annotations` immediately after the docstring in the heredoc. PEP 563 lets the same syntax work on Python 3.9. Zero additional cost.

- **Finding 4 [Low]: `scan-inline-blocks.ts` builtins set incomplete for a PWA codebase.** Expanded the `builtins` Set in `frontend/scripts/scan-inline-blocks.ts` from ~30 identifiers to ~70, adding common web API globals: `Request`, `Response`, `Headers`, `URL`, `URLSearchParams`, `AbortController`, `AbortSignal`, `TextEncoder`, `TextDecoder`, `Blob`, `File`, `FormData`, `FileReader`, `WebSocket`, `EventSource`, `crypto`, `structuredClone`, `Event`, `CustomEvent`, `MessageEvent`, `ErrorEvent`, `HTMLElement`, `Element`, `Node`, `Document`, `Window`, `MutationObserver`, `IntersectionObserver`, `ResizeObserver`, `PerformanceObserver`, `navigator`, `performance`, `location`, `history`, `screen`, `queueMicrotask`, `requestAnimationFrame`, `cancelAnimationFrame`, `caches`, `indexedDB`, `WeakMap`, `WeakSet`, `TypeError`, `RangeError`, `SyntaxError`, `ReferenceError`, `alert`, `confirm`, `prompt`, plus `React` (since React names appear as referenced identifiers in extracted blocks even when imported at file level).

- **Finding 5 [Low]: README replacement template describes `knip --strict` before it's wired.** Two-part revision: (a) Removed `→ knip --strict` from Task 2.1 Step 5's README template; added a forward-looking parenthetical noting that Phase 1's final commit adds it. (b) Added Task 7.2 Step 1b to update the README's preflight-chain comment to add `→ knip --strict` and delete the parenthetical, folded into the same Step 4 commit (git add + commit body amended to include `frontend/README.md`). File Structure section updated to reflect README is modified by both Task 2.1 and Task 7.2.

## Disagreed Findings

- **Finding 7 [Nit]: Spec line 6 says "(not yet written)" for the plan.** No revision. The reviewer themselves explicitly noted "Per AGENTS.md's frozen-intent policy, the spec stays as-is — this is expected behavior, not a defect. Noted for completeness only." CLAUDE.md confirms: "Specs and plans are a frozen record of intent, not current truth." The plan-write transition does not modify the spec.

## Deferred Findings

- **Finding 6 [Nit]: Orphan-route grep assumes `path="..."` attribute syntax, not JSX expressions.** Reviewer themselves notes "In practice, most routes use string literals, and any missed routes would be caught by the broader 6-check kit's plain-text ripgrep. Effect is near-zero." Verified intent against the actual App.tsx earlier — the file uses standard string-literal imports throughout, suggesting standard string-literal route patterns. Deferring with trigger: if Task 4-orphan-routes' `wc -l /tmp/phase-1-routes.txt` returns zero or substantially fewer routes than the App.tsx Route count suggests, the executor should manually `grep -nE 'path=\{' src/App.tsx` to catch JSX-expression cases.

## Severity Disagreements

(None — agreed with the reviewer's severity on all 5 agreed findings.)

## Open Questions

(None — all findings categorized and either revised, disagreed, or deferred with explicit triggers.)
