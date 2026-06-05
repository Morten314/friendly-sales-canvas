---
synthesizes_review: docs/reviews/28-frontend-phase-10-settings-tenant-auth-design-spec-review-1.md
artifact: specs/28-frontend-phase-10-settings-tenant-auth-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-05
round: 1
---

## Round Recommendation

maybe

Reason: All findings agreed and revised; the [High#1] resolution materially changed the dependency posture (a feature now consumes a hook from the flat `components/` layer), so a confirming round-2 is reasonable though likely to come back clean since the pattern already exists in mission-control.

## Agreed Findings

- **[High#1] mission-control breaks if `useCompanyProfile` moves.** Verified: `CompanyProfileForm.tsx:6`, `MissionControlPage.tsx:11`, and `MissionControlPage.test.tsx:46` (`vi.mock`) all import `@/components/settings/useCompanyProfile`. My spec's §2.3 (mission-control frozen) + §3.1 (no cross-feature imports) genuinely contradict the move. **Resolution: option 3 (defer the hook move)** — `useCompanyProfile.ts` stays at `components/settings/`; the relocated `features/settings/components/CompanyProfile.tsx` consumes it from the flat path (same feature→`@/components/settings/*` pattern mission-control already uses, lint-clean). This keeps Phase 10 at zero frozen-folder edits, consistent with the existing `jwt.ts`/`useAuth` deferrals. Revising §2.1 (drop `useCompanyProfile` from "moves in"), §2.2 (add as a Phase-11 deferral), §3 tree, §3.1 (acknowledge the mission-control consumer + transitional import), §10 (new TD-FE), §11 (`components/settings/` retains `useCompanyProfile.ts` + its test).
- **[High#2] `vi.mock("@/lib/firebase")` in `useLogin.test.tsx` not in §5's importer list.** Verified at `useLogin.test.tsx:15`. Revising §5 to list the test mock among the paths to update, and §8 to state mock paths are covered by the relocation. (Severity: see below.)
- **[Medium] §9 phrasing implies Phase 8's `import Signals` removal is already on `master`.** Verified: on `master` (Phase 10's base) `import Signals` is still present; Phase 8 removes it on its unmerged branch. Revising §9 to say the conflict materializes only at the merge gate.
- **[Medium] `useCompanyProfile.ts` source path imprecise (§2.1).** Resolved by [High#1]: the file no longer appears as a "moves in" row; where referenced, it is qualified as `components/settings/useCompanyProfile.ts`.
- **[Medium] Stale commented-out imports in `Settings.tsx` (lines 10–12).** Adding a note to §7 stage 3 to delete the stale commented import block during the move.
- **[Low] §1.3 should note `firebase.ts` is not yet in `shared/auth/`.** Adding "(`firebase.ts` still at `lib/firebase.ts` — see §5)" to the §1.3 `shared/auth/` line.
- **[Low] §3.1 omits the mission-control→`useCompanyProfile` external consumer.** Folded into the [High#1] §3.1 revision.
- **[Low] §6 should note `pages/ScoutDeployment.tsx` stays too.** Adding it to the §6 boundary note (both the page wrapper and the component stay for Phase 9).
- **[Nit] §11 `components/settings/__tests__` relocation consequence.** Revising §11: `components/settings/` retains `ScoutDeployment.tsx`, `useCompanyProfile.ts`, and `__tests__/useCompanyProfile.test.tsx`; only `CompanyProfile.test.tsx` moves.

## Disagreed Findings

- **[Nit] `npm run verify`/`preflight` not defined in the spec.** The reviewer concedes this "isn't a real gap" — the commands are established project-wide (root `CLAUDE.md`, Phases 5–8). A per-spec redefinition would duplicate the source of truth. No action.
- **[Nit] Line counts match exactly.** Positive confirmation, not a finding. No action.

## Deferred Findings

(none — every agreed finding is revised in this round; the *underlying* `useCompanyProfile` promotion is itself deferred to Phase 11, but the spec revision documenting that deferral happens now.)

## Severity Disagreements

- **[High#2] → Medium.** Agree with the finding; disagree with severity. A stale `vi.mock` path is a test-only failure caught immediately by `npm run verify` at the task it occurs in — zero shipped-code blast radius, fully covered by the "tests move with import-path updates" principle. Real, but Medium, not High.

## Open Questions

- **`useCompanyProfile` final home (Phase 11):** defaulting to **defer** (stays at `components/settings/`, consistent with `jwt.ts`/`useAuth`). The alternative — promote it to `shared/` *now* — is architecturally cleaner (it's consumed by two features) and is actually low-risk today: Phase 6 (mission-control) is already merged, and the in-flight Phase 8 does not touch `CompanyProfileForm.tsx`/`MissionControlPage.tsx`, so updating their 3 import lines would not cause a parallel-merge conflict. Flagging for the operator: confirm defer, or pull the shared-promotion forward into Phase 10.
