---
synthesizes_review: docs/reviews/21b-frontend-phase-4b-shell-extraction-plan-review-1.md
artifact: plans/21b-frontend-phase-4b-shell-extraction.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-05-29
round: 1
---

## Round Recommendation

no

Reason: The three Mediums are recovery-guidance/clarity items (downgraded to Low and fixed); one Nit (F9) misreads the spec and is declined with a citation; two findings (F6, F10) the reviewer self-resolves as "acceptable / no action"; everything else is Low/Nit and applied. No Critical/High remains and no revision opened new design surface.

## Agreed Findings

- **[Medium→Low] F1 No global abort criteria:** Added a whole-branch "Abort criteria" block after the conventions — the four hard blockers (4a not merged; baseline red; dead-block strip unreconcilable; VR cause unfindable) plus the "report at the last green commit, do not force-push/amend/revert without sign-off" hygiene.
- **[Medium→Low] F2 VR failure has no escalation path:** Extended Task 6 Step 3 — if the VR diff's cause is unclear after investigation, STOP and report with the `*-diff.png`; do not merge past it (and named the `eslint --fix` import-order side effect as a candidate cause).
- **[Medium→Low] F3 `useAppSidebar` knip contingency open-ended:** Rewrote Task 6 Step 2 to be decisive — **preferred** path is defer the alias to its Phase-5 consumer (guaranteed to clear knip; a documented §3.4/§3.8-item-5 deviation needing sign-off); the `@public` tag is demoted to "not preferred" because knip tag-filtering generally needs a `knip.json` `tags` entry that §3.7 forbids.
- **[Low] F4 Fragile `sed '1,186d'` range:** Replaced with the pattern-based `sed '/^import type { User }/,$!d'` (deletes the leading comment block regardless of its length), keeping the `head -1` STOP guard, which also catches the empty-file case if the anchor is absent.
- **[Low] F5 sed covers only two relative depths:** Clarified that Task 4 Step 4's `-e` clauses are **audit-derived, not fixed** — add a clause for any other depth Task 0 Step 5 surfaced; the trailing grep + `tsc` are the backstops.
- **[Low] F7 App.tsx edit prose-only, not scriptable:** Added a sanity-check after the hand-edit (`grep -c 'from "@/features/shell"'` → 1; no stale `./components/ProtectedRoute`/`./contexts/` sources; `git diff` shows only the import block changed).
- **[Nit] F8 `DeploymentData` not in done-when:** Added `grep -q 'DeploymentData' src/features/shell/index.ts` to Task 8 Step 1, with a note that the `useAppSidebar` grep failing signals the documented Task-6 deviation rather than a defect.
- **[Nit] F11 Task 3 defensive re-fix could mask a Task 2 miss:** Added "re-run Task 2 Step 6's stale-reference grep to confirm the miss was isolated, not a systemic sed gap" to Task 3 Step 1.

## Disagreed Findings

- **F9 [Nit] TD-FE scope broader than §3.6.** The finding misreads the spec. §3.6 names the sidebar twin, but **§3.8 item 6 explicitly requires** the TD-FE to cover "the sidebar name twins (`useSidebar` + `SidebarProvider`) **and the `useAuth` collision** (§3.2)" — and §3.2 (H2) itself says the `useAuth` hazard is "Logged as a `TD-FE`." Bundling both in one entry is spec-mandated, not drift. No change.
- **F6 [Low] Task 4 is a large atomic commit.** No revision warranted — the reviewer concludes "Acceptable tradeoff," and I concur: splitting Task 4 would produce broken moved-but-not-rewired intermediate commits, violating the per-commit-`tsc`-green discipline the plan is built on. The commit is a pure no-logic migration, so a `git bisect` landing here is unambiguous. The plan already documents this rationale (Task 4 header).
- **F10 [Nit] Task 1 could parallel Task 2.** No revision — the reviewer explicitly states "No action needed." The serial order is the deliberate one-green-commit-at-a-time discipline; parallelizing two ~1-minute directory creations across separate commits adds coordination overhead for no real gain.

## Deferred Findings

None — every agreed finding was cheap and in scope, so all were applied this round.

## Severity Disagreements

- **F1 — Low, not Medium.** Agree finding. The per-task STOP conditions already prevent the plan from proceeding into a silently-broken state; a collected abort block is a clarity/hygiene improvement. It carries slightly more weight here than in 4a (4b is a real migration, not additive), but it remains documentation-level. Applied anyway.
- **F2 — Low, not Medium.** Agree finding. The VR gate is part of preflight, which already blocks the merge on failure — nothing bad ships regardless. The gap was *guidance for the stuck executor*, not a hole through which a regression could escape. Applied.
- **F3 — Low, not Medium.** Agree finding. It reduces executor-decision variance on a contingency that is **expected never to fire** (knip resolves the re-export to the consumed `useSidebar` origin). Real but low-stakes; made decisive anyway.

## Open Questions

- If the Task 6 knip contingency *does* fire in practice (knip flags the unconsumed `useAppSidebar` alias), the cleanest long-term fix is the **full internal rename** — `useSidebar`→`useAppSidebar` in `SidebarContext.tsx` plus its two internal callers (`Header`, `Sidebar`) — which satisfies both knip and the §3.4 surface with no deviation. The plan deliberately does **not** pre-adopt this, because it revisits spec §3.6's explicit "defer the internal rename" choice; that call belongs to the spec owner / impl review, not this synthesis. Flagged so it isn't rediscovered cold during execution.
