---
synthesizes_review: docs/reviews/31-frontend-phase-11-shared-utility-extraction-design-spec-review-1.md
artifact: specs/31-frontend-phase-11-shared-utility-extraction-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-05
round: 1
---

## Round Recommendation

maybe

Reason: All round-1 findings are agreed and revised against live greps — the Criticals (C1/C2) resolve by extending the already-reviewed `cn` co-location pattern, and the `ui/`-conflict surface is now verified exhaustive (exactly 3 symbols), so no Critical/High and no new design surface remains; a round 2 is optional insurance given round 1 exposed author blind spots in zone-conflict detection (operator's call under the velocity posture).

## Agreed Findings

All findings verified true against live import greps on `master` @ `182cb8e`. The root cause is shared: the round-1 draft counted **feature folders only**, which hid the locked-`ui/` consumers and the lead-stream-residue consumer.

- **C1 (`use-mobile` ui-zone conflict).** Verified: `components/ui/sidebar.tsx:13` imports `useIsMobile`. Moving it to `features/shell/` would break `ui ↛ features`. Revised §1.3 + §4: `use-mobile` → `components/ui/use-mobile.tsx` (co-locate, same as `cn`); §5.1 now covers it.
- **C2 (`use-toast` ui-zone conflict).** Verified: `ui/toaster.tsx:9` + the `ui/use-toast.ts:1` shim import from `@/hooks/use-toast`. Revised §1.3 + §4: `use-toast` → `components/ui/use-toast.ts` (real hook replaces the shim at that path); removed from class A; §5.1 covers it.
- **H2 (`lib/api` count).** Verified: 19 import sites across **4** features (customers, market-research, mission-control, strategist) + `shared/api/client`, `shared/auth/AuthContext`, residue, `test/msw` — not "7 features." §1.3 row corrected.
- **M1 (`lib/jwt` count).** Verified: also consumed by `LeadsTable` (residue) + the `useAuth` hook + tests; feature-count of 2 was right, total undercounted. §1.3 row corrected (disposition `→ shared/auth/` unchanged).
- **M2 / N2 / L1 (§5.1 ContextChat error).** Verified: `ContextChat.tsx:19` imports only `sanitizeAnswerText`, not `cn`. §5.1 rewritten — `cn`'s non-ui consumers are Header/Sidebar/IcpWizard (→ `@/components/ui/utils`); ContextChat + SignalCard are `sanitizeAnswerText` consumers (→ `@/shared/lib`).
- **M3 (ADR for the other two).** Resolved by **generalizing ADR-0005** to "ui-layer-consumed utilities live in `components/ui/`" (cn + use-toast + use-mobile) rather than three ADRs. §5.1 + §14 updated.
- **M4 (§3 aspirational).** §3 now names the three current `ui/` violations and states the target is *reached* by co-locating all three; added a §8 verification that `ui/` imports no `@/hooks|@/lib|@/utils` path.
- **H1 (§5.2 "single consumer" wrong).** Verified: 4 `mission-control` sites + 1 residue + test mocks. §5.2 repointing surface corrected. (Severity downgraded — see below.)
- **L2 (auth/residue ordering).** Added a §6 "cross-stage import dependency" note + §9 11b note: 11b repoints `LeadsTable`'s `useAuth`/`jwt`/`api` import lines **in place** (residue file relocates in 11d).
- **L3 (knip clean-gate).** §10 now states `knip` gates only at the final preflight, never per-stage.
- **N1 (§9 11c conflated risk).** §9 re-split into 5 stages: ui-layer co-locations (11c, well-bounded) separated from the lead-stream residue trace (11d).
- **N3 (defensive parenthetical).** Removed from §4 class B.

Extra verification done during synthesis (beyond the review): enumerated the **complete** set of `components/ui/` → legacy imports — exactly `cn`, `useToast`, `useIsMobile`. No fourth zone conflict exists, so the resolution set is exhaustive.

## Disagreed Findings

None. Every factual claim in the review held up under live-grep verification; manufacturing disagreement would be sycophancy toward the prior draft.

## Deferred Findings

None. All findings were in-scope, low-cost, and applied this round. (The lead-stream full consumer trace remains a plan-stage task by original design — §6 — not a deferred review finding.)

## Severity Disagreements

- **H1 (`useAuth` count) — agree finding, disagree severity (Medium, not High).** The disposition (`→ shared/auth/` via the auth-infra exception) is unaffected; only the "single consumer / one import" prose was wrong. It is a repointing-checklist accuracy fix, not a design-changing defect.
- **H2 (`lib/api` count) — agree finding, lean Medium (not High).** Same basis: the disposition (`→ shared/api/transport.ts`) is unchanged, and §1.3 already flags counts as provisional estimates the plan re-validates. It is the most-wrong number in the draft, so the correction matters for work-sizing — but it does not alter a design decision. (Noted, not contested hard, since it is fixed regardless.)
- C1/C2 severity (Critical): accepted. They were genuine disposition errors that would have forced a mid-implementation replan when the lint wall was hit; "Critical" for a spec whose entire job is correct dispositions is fair.

## Open Questions

- **`use-toast` placement nuance (non-blocking).** The fix replaces the 3-line `ui/use-toast.ts` re-export shim with the real hook implementation at that path. The plan should confirm no consumer relies on the shim's exact re-export shape (`{ useToast, toast }`) beyond what the moved implementation exports — expected trivial, but worth a glance during 11c.
- **Round-2 scope, if run.** Given the conflict surface and all counts are now empirically verified, a round 2 would mainly re-check that the applied dispositions are internally consistent and that ADR-0005's generalized framing reads cleanly — a light pass, not a full re-review.
