---
synthesizes_review: docs/reviews/36-signal-lead-mapping-and-source-labeling-plan-review-1.md
artifact: plans/36-signal-lead-mapping-and-source-labeling.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-15
round: 1
---

## Round Recommendation

no

Reason: No Critical/High. All findings are Medium/Low/Nit and resolved by textual/scoping revisions that open no new design surface; the one Medium scope item (the LeadStream pager) is explicitly deferred at MVP. Safe to proceed to implementation (round 2 optional).

## Agreed Findings

(Each line is the revision being made.)

- **[Medium] LeadStream "N relevant signals" is count-only, not expandable (AC #7 / §5.7-A2).** Verified: Task 18 rendered a bare count while Task 15 (LeadsTable) renders headlines + one-line `why`; AC #7 says "(expandable)" and §5.7-A2 says "the same affordance." Rewrote Task 18 to render a per-row expand toggle that reveals the signal headlines + `why` (mirroring `LeadIntelligencePanel`), and updated its test to click-expand and assert the headline appears.
- **[Medium] No plan-level abort criteria.** Added an "Abort / escalation triggers" section: live mapping JSON can't be reconciled with `SignalLeadMapResponseSchema` (stop before Phase D); truncated-JSON recovery unreliable on real output (stop before FE depends on it); a touched backend pytest module / `typecheck` red with no obvious local fix (don't stack tasks on a red base).
- **[Low] orgId resolved inconsistently across the two lead tables.** Verified: LeadsTable is tenant-aware (`selectedTenant?.id ?? authOrgId`) while LeadStream used auth-only `useAuth().orgId`, so an active tenant override could feed `useSignalLeadMap` different orgs. Revised Task 17 to resolve `orgIdProp ?? selectedTenant?.id ?? authOrgId` via `useTenant`, matching LeadsTable; added the `@/shared/tenant` mock to the LeadStream tests.
- **[Low] Live-backend + `ANTHROPIC_API_KEY` prerequisite buried at Task 11 Step 5.** Verified: `_claude_budget.CLAUDE_API_KEY` has no fallback, so live-shape capture needs a keyed running backend. Added an up-front Conventions bullet, and clarified the FE zod contract is **spec-derived (§5.3)** so FE work is not hard-blocked — Step 5 is confirmation.
- **[Low] Per-step verification was success-only.** Changed every backend "verify pass" step to run the **whole touched test module** (dropped the `-k`/`::` narrowing) so a regression in an adjacent existing test surfaces per-task, not only at the final gate. (FE steps already run whole files.)
- **[Low] Task 12 re-shows an already-existing import.** Verified: `signals.ts` already imports `apiGet, apiPost`. Revised Task 12 Step 3b to extend only the `../contracts` import and explicitly NOT re-add `apiGet, apiPost` (avoids a duplicate-import error).
- **[Low] queryKey-includes-userId+orgId untested (spec §8).** Added a direct assertion to Task 13's test: `qk.signalLeadMap("org1","u1")` equals `["signals","lead-map","org1","u1"]`.
- **[Low] Parallelizable task groups unmarked.** Added a "Parallelization (optional)" note: Tasks 1–3 and 14–15 are independent, but in this shared sandbox must fan out across **separate worktrees**, never concurrent edits on one branch/tree.
- **[Nit] Stale task-number header in `connectors/index.ts`.** Verified the current header maps exports to a prior plan's "Task 10/12/13/14." Revised Task 5 Step 4 to a whole-body replace that drops the stale comments and uses an accurate one-line header.

## Disagreed Findings

- **[Nit] Reuse the existing `_override_mongo` helper in Task 11.** Disagree with the remedy as written: `_override_mongo` overrides only `get_mongo`, but the new route also depends on `get_neo4j_driver` — wrapping the context-manager helper around a separate manual driver override is *less* readable than the uniform manual override of both deps. Kept the manual approach; added a one-line comment explaining both deps are overridden because the route needs both. (The style observation is fair; the specific fix doesn't cleanly apply.)

## Deferred Findings

- **[Medium] LeadStream ships first-page-only, dropping the spec's pager (§5.7-A2).** Agreed the directive was silently dropped. Deferred at MVP: first-page-only (`limit=50`) is consistent with the sibling market-research LeadsTable's single-fetch and proportionate at 0 users; the v2 endpoint already accepts `limit`/`offset`, so a pager is a purely additive follow-up. Revised the plan to state the deferral **explicitly** (Task 16 note) and corrected the Self-Review's misleading "pagination first-page" coverage claim — closing the *silent*-drop the reviewer correctly flagged. **Trigger:** an org exceeds ~50 leads, or real users land.

## Severity Disagreements

- **[Medium → Low] No plan-level abort criteria.** Agree with the finding; severity Low. The mapping endpoint degrades gracefully (Claude failure → empty mapping, never 500) and the per-task gates already stop on red, so there is no correctness cliff — explicit abort triggers are process hygiene, added regardless.
- **[Medium → Low] First-page-only LeadStream.** Agree the finding; the *silent* drop warranted Medium, but once made explicit and deferred (this round), residual severity is Low at MVP volume.
- **[Medium → Low] Count-only LeadStream signals.** Agree the finding; lean Low (presentational expandability; the data join already works) — fixed regardless.

## Open Questions

None unresolved. F4 is reconciled on the org axis (both surfaces now tenant-aware); the userId axis is `useAuth().currentUser.uid` inside `useSignalLeadMap` for both, which is already consistent.
