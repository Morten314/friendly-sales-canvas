---
synthesizes_review: docs/reviews/phase-2c-preflight-bundle-impl-review-1.md
artifact: phase-2c-preflight-bundle
artifact_type: impl
reactor_model: claude-opus-4-7
date: 2026-05-29
round: 1
---

## Round Recommendation

no

Reason: All findings are Low or Nit; the one actionable code finding (Finding 1) landed as a one-line fix in commit `7ba0319`. Nothing remains that warrants another review round.

## Agreed Findings

- **Finding 1 (Low) — `loadBaseline` missing `total_size_gzip_bytes` validation.** Fixed in commit `7ba0319`: added `typeof (parsed as Baseline).total_size_gzip_bytes !== "number"` to the guard at `frontend/scripts/check-bundle-budget.ts:125-131` and expanded the reason string to `missing expected fields (total_size_bytes, total_size_gzip_bytes, chunks)`. Typecheck + 21/21 tests still pass. The missing-fields fixture short-circuits on `total_size_bytes` first (its absence), so existing tests are unaffected and the assertion `expect(result.reason).toContain("missing expected fields")` still holds.
- **Finding 4 (Nit) — Spec §3.5 estimated ~150 LOC, actual is 247.** Observation only, no code action. The overshoot is from `compareAndPrint`'s console-formatting verbosity (table rows, padding, conditional sections), not scope creep. Noted for spec-estimate calibration in future phases.
- **Finding 5 (Nit) — `.prettierignore` commit wasn't in the plan's task list.** Observation only, no code action. Commit `4b39840` was the right place to land the exclusion. Worth carrying into Phase 14's spec or any future plan that adds intentionally-malformed fixtures: the plan should call out the prettier exclusion step explicitly. Recorded here so future plan-writers don't repeat the gap.

## Disagreed Findings

- **Finding 2 (Low) — `walkDist` redundant `stat()` call.** The reviewer is technically correct that `contents.length` would yield the same `size_bytes` without the extra syscall. However, `walkDist`'s body intentionally mirrors `frontend/scripts/capture-bundle-baseline.ts:16-46` line-for-line — the Task 4 code-quality reviewer explicitly flagged this consistency as load-bearing ("matches `capture-bundle-baseline.ts:36-37` exactly, and consistency between the two scripts is more valuable than saving one stat call on ≤5 files"). Changing only `walkDist` would create a stylistic split between two sibling walkers; changing both is out of scope for Phase 2c (would amend Phase 0's capture script). The reviewer's own characterization — "negligible for the current ~5-file dist" — supports leaving it.

## Deferred Findings

- **Finding 3 (Nit) — `compareAndPrint` re-computes `baseName()` in added/removed filters.** Real but trivial: ~5 extra regex calls per advisory run. The proposed alternative (iterate `currentByKey` entries directly, or build a `Set<string>` of keys) would save those calls but adds a small layer of indirection at the read site. Cost/benefit is genuinely a wash for the current chunk count, and the comparator only runs once per preflight invocation. Defer to: a future polish pass (Phase 14 hardening, or whenever someone is touching `compareAndPrint` for an unrelated reason). Not worth a standalone commit in Phase 2c.

## Severity Disagreements

(none)

## Open Questions

(none)
