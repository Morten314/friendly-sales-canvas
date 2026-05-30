---
synthesizes_review: docs/reviews/24a-frontend-phase-5a-relocate-plan-review-1.md
artifact: plans/24a-frontend-phase-5a-relocate.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-05-30
round: 1
---

## Round Recommendation

no

Reason: All findings are Medium-or-below; each is resolved in-place by a concrete, cheap revision, nothing High/Critical remains, and no revision opens new design surface — a re-review round is not warranted for this mechanical relocation plan.

## Agreed Findings

- **[High → Medium] §3 "Done when" not amended (Task 6 Step 2 / Task 7 Step 4 item 6).** Verified against the spec: §3 "Done when" (line 137) literally requires "E2E (`journeys/04`) + visual + Vitest + `npm run preflight` green," and the same "visual" parity assertion recurs at §11 DoD item 5 (line 263), with §8 (line 230) naming visual regression "the primary guard." The plan's §9 delta (Task 6 Step 2) amends only §1.2/§8/R4, so §3 and §11 keep contradicting the decision, and Task 7 Step 4 item 6 silently drops "visual." Revising Task 6 Step 2 to (a) qualify the "visual" token in §3 line 137 and §11 item 5 line 263 in place (→ "visual parity via behavioral E2E + Vitest; no MR pixel VR — §9 delta"), (b) make the §9-delta supersession sentence list the full set (§1.2, §3, §8, §11, R4), and (c) align Task 7 Step 4 item 6 to reference that amendment instead of dropping "visual."

- **[Medium] sed rewrite can hit non-import strings (Task 2 Step 2).** Adding a precision backstop after the rewrite: confirm every occurrence of the new `@/features/market-research/components/<f>` path sits on an `import`/`from` line (flag any match inside a comment/string/log before committing). `tsc` catches broken imports but not a corrupted string literal, so for a "zero behavioral change" plan this closes the gap.

- **[Medium → Low] Hard-coded date `2026-05-30` (Task 5 Step 3).** Revising both TD-FE lines to stamp the execution date dynamically (`$(date +%F)`), matching the plan's existing dynamic read of the next free TD-FE number. The asymmetry (dynamic number, static date) is the real smell.

- **[Medium] Ambiguous regression attribution from the lighter baseline (Task 0 Step 3 / Task 7 Step 1).** Adding the explicit triage rule: if Task 7 reds on a step skipped at the Task-0 baseline (`build`/`bundle:check`/`test:e2e`), re-run that exact step on `master` first; if `master` also reds, it is pre-existing and does not block 5a (and is not abort-criterion 2).

- **[Low] Wrong section citation (Task 0 Step 5 heading).** Verified against the spec: §1.5 (line 60) is "Scope"; §1.3.5 (line 39, decision item 5) is the leave-in-place decision. Correcting "spec §1.5" → "spec §1.3.5", keeping §7 — also matching the plan's own Architecture citation (line 7, "§1.3.5/§7").

- **[Low] Frozen-prose boundary ambiguity (Task 6 Step 1).** Adding an explicit clause that the §4 status-table rows are metadata (mutable), not frozen Phase-narrative prose — so a cautious implementer does not skip the pending→done correction (which spec §9.2 / line 241 explicitly directs).

- **[Low] knip on empty scaffolding has no fallback (Task 1 Step 2).** Adding a one-line contingency: if knip flags the empty `index.ts`/`types.ts`, verify the knip `entry`/`project` globs cover `src/features/**` (a Phase-4 convention) rather than masking with an ignore. (Reinforced by the known knip behaviour that `--production` entry patterns are an exact used-files set, not a graph walk.)

- **[Nit] Substring naming-map grep (Task 0 Step 2).** Tightening `grep -q 'market-research'` toward the naming-map's specific entry format; noting that the scaffolder's own not-on-map warning (Task 1 Step 1) is the authoritative backstop, so this is a precision polish.

## Disagreed Findings

- **[Nit] Self-review section placement (lines 540–545).** Leaving as is — the reviewer's premise is not supported by the exemplars. The "Self-review notes (plan author)" section carries no `- [ ]` steps and no `## Task N` heading, so a subagent-driven executor (which runs Task sections) cannot mis-execute it as procedure; the reviewer concurs it is "not functionally harmful." The claimed convention ("some plans in this repo place author notes before Task 0") does not hold for the immediate predecessors: `21a` places "Self-review notes (plan author)" at line 1071 of 1075 and `21b` at line 649 of 654 — both at the very end, identical to `24a` (line 540 of 546). `24a` therefore *follows* the established convention; moving it would make it the outlier.

## Deferred Findings

None.

## Severity Disagreements

- **Finding 1 — Medium, not High.** Agree with the substance entirely (and have widened the fix to cover §3 + §11, beyond the single §3 line the reviewer cited). But it is a spec-text-consistency completeness gap, not a code/behavior/execution defect: the plan already implements the correct behavioral-only guard, logs the TD-FE, and amends the substantive cross-cutting sections (§8/R4/§1.2); only the formal done-when echoes (§3, §11) and the Task 7 checklist line lag. The fix is mechanical. Real and worth fixing before merge, but it does not rise to High for a mechanical relocation.
- **Finding 3 — Low, not Medium.** Agree with the substance. An inaccurate date in the debt register has minimal blast radius and no execution impact; the fix is trivial. Low is the honest severity.

## Open Questions

None. (Findings 1 and 5 were verified directly against `specs/24-frontend-phase-5-market-research-design.md`; finding 9 against `plans/21a`/`21b`. An earlier transient glitch garbled the spec read mid-session; a clean re-read confirmed the spec file on disk is fully intact — no tampering or corruption.)
