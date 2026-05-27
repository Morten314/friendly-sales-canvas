---
synthesizes_review: docs/reviews/phase-0a-inventory-impl-review-1.md
artifact: phase-0a-inventory
artifact_type: impl
reactor_model: claude-opus-4-7
date: 2026-05-27
round: 1
---

## Round Recommendation

no

Reason: One Medium finding has a trivial one-line markdown fix; remaining items are Low (deferred to Phase 2c) or Nit (reviewer's own conclusion: no change needed).

## Agreed Findings

- **Finding 1 [Medium] — Missing LeadStream duplicate annotation in scorecard.** Verified: `frontend/src/components/customers/LeadStream.tsx` is the real 432-line implementation; `frontend/src/components/market-research/LeadStream.tsx` is a 0-line empty file (knip flags it as dead, scorecard reports 1 LOC due to trailing-newline counting). Plan Task 7 Step 5 augmentation table specified "`LeadStream` if duplicated under market-research/ — flag the duplicate"; the implementer missed this row. Fix: annotate the `market-research/LeadStream.tsx` row in the Tier 2 annex with a note describing it as an empty vestige (slightly more accurate than "duplicate" since the file has no code) and pointing to the real implementation at `customers/LeadStream.tsx`. One-line markdown edit to `docs/audits/2026-05-26-frontend-baseline.md` line 74.

## Disagreed Findings

N/A — all findings are technically correct.

## Deferred Findings

- **Finding 2 [Low] — NFR baseline `cpu_model: "06/97"`.** Substance agreed: the sandbox VM's `/proc/cpuinfo` lacks a normal "model name" field, so the fallback regex in `measure-baselines.sh` extracts the CPU family/model number tuple instead of a brand string. **Deferred to Phase 2c.** Reason: the cpu_model field is cosmetic per spec §1.3 / spec 14 §4 line 221 (Phase 2c re-measures preflight wall time against the actually-wired chain and sets budgets). Fixing it now would require modifying `frontend/scripts/measure-baselines.sh` and re-running the 10-20 min NFR capture solely to update one metadata field; that work is the same work Phase 2c does anyway. **Trigger for revisiting:** when Phase 2c's plan modifies `measure-baselines.sh`, fix the Linux CPU model extraction (try `awk -F': ' '/model name/{print $2; exit}'`; if `/proc/cpuinfo` still has nothing, fall through cleanly to `uname -m`).

## Severity Disagreements

N/A.

## Open Questions

- **Phase 1 LOC baseline anchor.** Finding 3 notes 76,052 (scorecard) vs 75,894 (spec §1.3). The reviewer concludes "the scorecard's machine-generated count is the authoritative baseline for Phase 1." Spec §1.3 already documents this expectation in its "Note on staleness" paragraph (line 37 of master spec 14: "The starting-state table here is a point-in-time anchor, not a continuously-updated reference"). No further action needed unless Phase 1's spec explicitly cites the older 75,894 figure as a target — in which case Phase 1's spec author should reconcile by referencing the audit scorecard (which is the canonical post-0a baseline).
