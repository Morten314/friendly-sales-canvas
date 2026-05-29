---
synthesizes_review: docs/reviews/20-frontend-phase-3-api-data-layer-plan-review-1.md
artifact: plans/20-frontend-phase-3-api-data-layer.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-05-29
round: 1
---

## Round Recommendation

no

Reason: All eight findings are agreed (six) or correctly disagreed/downgraded (two). The single genuine High (F1 — missing save→invalidate→refetch test, which spec §3.6 explicitly enumerates) is a localized test addition that opens no new design surface and requires no re-design. F2's "High" is downgraded to Low because DoD item 4's test requirement (the two `authEndpoint` R7 assertions) is already satisfied by Tasks 6 + 12; a Login-wrapper test is additive. All other findings are Low/Nit. Nothing Critical/High remains unresolved, so the plan is sound to execute after these mechanical (test + doc + Edit-readiness) corrections.

## Agreed Findings

- **F1 [High] — no `useSaveCompanyProfile` test.** Verified: Task 8/10 tests cover only the GET path + rendering; the mutation's POST → `onSuccess` invalidation → refetch is untested, but spec §3.6 explicitly lists "save → invalidates → refetch" as a required test and DoD item 3 requires the `useMutation` be tested. Added a save-mutation integration test to `useCompanyProfile.test.tsx`: render both hooks under one `QueryClient`, MSW-intercept the POST + a counting GET handler, `mutateAsync`, assert the GET refires (invalidation → refetch).
- **F2 [Low — see severity disagreement] — no `useLogin`/`useSignup` test.** Added a focused `src/pages/__tests__/useLogin.test.tsx` that mocks `useAuth`/`useTenant`/firebase `auth` and asserts the delegation order (`login` → `fetchOrgId` → `selectTenant`) plus error propagation. Additive coverage, not a DoD gap (see Severity Disagreements).
- **F3 [Medium] — `profileData` override `useEffect` removal undocumented + Settings fetch orphaned.** Verified against `Settings.tsx`: `fetchProfileData("company")` (`:105`, called at `:181`/`:193`) really fetches `GET /api/profile/company?user_id=…` and spreads the result via `commonProps` (`:218,:224`). After the rewire CompanyProfile ignores it → orphaned work. Task 9 now (a) explicitly states the `profileData`-override effect (orig `:235–290`) is intentionally removed (query supersedes the prop), and (b) records **TD-FE-11** for the orphaned Settings company-branch fetch. `Settings.tsx` itself stays untouched this phase because the same generic `profileData` prop still feeds the non-migrated `UserProfile`/`AgentProfile`.
- **F4 [Low — see severity disagreement] — line-number anchors fragile.** Strengthened Task 12 Steps 2–3 by quoting the **exact current `generateToken`/`refreshAccessToken` blocks** as the `Edit` `old_string` (line-number-independent), and added a one-line note that line numbers throughout the plan are navigation aids while the quoted text / "from X through Y" descriptions are the operative anchors.
- **F5 [Medium] — Settings keeps fetching ignored company-profile data.** Same root cause as F3; consolidated. TD-FE-11 records it; no Settings code change this phase (the prop still serves `UserProfile`/`AgentProfile`).
- **F6 [Low] — `npm run test -- CompanyProfile` matches both files.** Verified: the substring filter also matches `useCompanyProfile.test.tsx`. Task 10 Step 2 reworded to accept the broad match (it runs all Slice-1 CompanyProfile tests — hook + component — all green) and to state the real expected count.
- **F7 [Low] — RTL install ordering.** Verified: §0 listed Task 11 as depending only on Tasks 5 + 6, but `useTenants.test.tsx` uses `renderHook` from RTL installed in Task 8. §0 Parallelism updated: Task 11 (and every RTL-using test task — 10, 11) also depends on Task 8.
- **F9 [Nit] — dropped `console.log`s undocumented.** Task 9 now notes the verbose debug `console.log`s in the original `handleSave` are intentionally dropped in the rewrite (aligns with the repo's known console-noise debt), not an accident.

## Disagreed Findings

- **F8 [Nit] — `_props` obscures retained props.** Leave as `_props`. The component consumes **none** of `onProfileUpdate`/`isEditMode`/`profileData` after the rewire, so `_props` is the accurate signal ("nothing here is read"). Destructuring three `_`-prefixed names (`_onProfileUpdate`, …) is noisier and falsely implies each prop is individually meaningful. The `_`-prefix-whole-param form matches the repo's existing convention (`_userId`, `_error`, `_refreshError`) and is lint-clean.

## Deferred Findings

None.

## Severity Disagreements

- **F2 (reviewer: High → mine: Low).** Agree the finding (the Login wrapper has no unit test); disagree it is High. DoD item 4's test requirement is precisely "passing unit tests for the `authEndpoint` path — at minimum the two R7 assertions," which Tasks 6 (no-`getAuthHeader`) and 12 (404→`null`) already satisfy. The spec's deliberate verification posture for the Login mutation is manual smoke sign-off (R2; Task 16 Step 2 "Login → /mission-control"). The added delegation test is cheap, valuable, additive coverage — not a missing DoD deliverable.
- **F4 (reviewer: Medium → mine: Low).** Agree line numbers drift; disagree it is Medium. Task 12 already pairs each line range with a "from `const response = await fetch(...)` through `return this.token;`" descriptive anchor, and Task 15 quotes the exact current markdown text as the replacement target — so the operative `Edit` anchors are text, not line numbers, and a drift would fail-to-match (loud) rather than mis-edit (silent). Acting anyway by quoting exact Before-blocks for Task 12 to make them directly `Edit`-ready.

## Open Questions

- **Duplicate company-profile fetch (Settings `user_id` GET vs CompanyProfile `org_id` GET).** TD-FE-11 defers collapsing this to the Settings extraction (Phase 4) — the cleaner fix (lift the fetch into the shared query, or drop the company branch of `fetchProfileData`) also needs `UserProfile`/`AgentProfile` to migrate off the shared `profileData` prop. Flagged so the operator can pull it forward into Phase 3 if they'd rather not ship a known-redundant fetch; default is defer (out of Phase 3's stated scope; behavior is correct, just wasteful).
