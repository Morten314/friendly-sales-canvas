---
artifact: plans/20-frontend-phase-3-api-data-layer.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
---

## Findings

### [High] No test coverage for `useSaveCompanyProfile`

**Location:** Task 8 (hooks created), Task 10 (component test)

Task 8 creates `useSaveCompanyProfile` — a `useMutation` that POSTs via the shared client and invalidates the company-profile query on success. The hook test (`useCompanyProfile.test.tsx`) only covers `useCompanyProfile` (GET path). The component test (`CompanyProfile.test.tsx`) only asserts rendering (form heading appears, empty form on 404). Neither test exercises the save-mutation path: POST → `onSuccess` invalidation → refetch.

Spec DoD item 3 requires "CompanyProfile uses `useQuery` + `useMutation`, zod-validated, with a Vitest + RTL + MSW test." The GET path is tested; the mutation path is not. A save that silently breaks (e.g., `onSuccess` invalidation key mismatch, zod parse failure on the POST response) would not be caught by any automated check.

**Recommendation:** Add at least one test to `useCompanyProfile.test.tsx` that renders the save hook, MSW-intercepts the POST, asserts the invalidation, and confirms the query refetches.

### [High] No test coverage for `useLogin` / `useSignup` mutations

**Location:** Task 13

Task 13 creates `useLogin` (wrapping `login` → `fetchOrgId` → `selectTenant` → `pendingFullName` handling) and `useSignup` (wrapping `signup` → localStorage write). Neither has a test file. The plan introduces no `src/pages/__tests__/useLogin.test.tsx` or equivalent.

Spec DoD item 4 requires "Login uses `useMutation`" with "passing unit tests for the `authEndpoint` path." The auth transport itself is tested in Task 12 (JWT endpoint), but the Login mutation wrapper — which is the actual consumer an end-user triggers — has zero verification. A breakage in the post-login sequence (e.g., `fetchOrgId` rejection, `selectTenant` not called) would surface only during Task 16's manual smoke.

**Recommendation:** Add a `useLogin.test.tsx` that mocks `useAuth`/`useTenant` and verifies the mutation calls `login`, then `fetchOrgId`, then `selectTenant` in order, and handles errors. Even a focused unit test that confirms the delegation sequence is intact would close this gap.

### [Medium] `profileData` prop override useEffect silently removed

**Location:** Task 9 Step 2 (CompanyProfile.tsx rewire)

The plan replaces CompanyProfile lines 1–451, which removes the `profileData` useEffect (current lines 235–290). This useEffect accepted profile data passed from `Settings.tsx` (via `commonProps` spread at `Settings.tsx:224`) and overwrote local form state when the prop changed.

`Settings.tsx:92` still has its own `fetchProfileData` state and still passes `profileData` in `commonProps`. After the rewire, Settings continues fetching and passing the prop, but CompanyProfile ignores it entirely (`_props`). The plan's props-interface comment explains the decision ("the query supersedes the prop"), but:

1. The removal of the useEffect is not listed in the "Files modified" manifest or called out in the task description — a reviewer scanning the diff would need to infer it from the line range.
2. `Settings.tsx`'s `fetchProfileData` is now a wasted fetch for the "company" profile type. This should be logged as a `TD-FE` entry so Phase 4/Settings extraction knows to retire it.

The plan's §X deviation note covers the localStorage retirement but not this prop-flow severance.

**Recommendation:** Add a sentence to Task 9 noting that the `profileData` prop override useEffect is removed (query supersedes it) and that `Settings.tsx`'s company-profile fetch is now redundant — log as `TD-FE`.

### [Medium] Line-number anchors are fragile and will drift

**Location:** Task 9 Step 2 ("lines 1–451"), Task 12 Steps 2–3 ("lines 40–72", "lines 128–149"), Task 15 Steps 1–4 (spec-14 lines 32, 107, 330, 331, 333, 339, 687, 692)

The plan uses exact line numbers as primary anchors for code replacements. These are accurate against the current codebase but will break if any file is edited between plan writing and execution. Task 9 partially mitigates this with the descriptive anchor ("up to and including the closing `};` of `handleSave`"), but Tasks 12 and 15 rely on line numbers alone.

The risk is highest for Task 15 (spec-14 amendments), since spec files are living documents that may receive edits from parallel work. If the line numbers shift, the `Replace` instructions produce wrong edits.

**Recommendation:** For Tasks 12 and 15, add descriptive anchors alongside line numbers (e.g., "the `const response = await fetch(...)` block inside `generateToken`, currently lines 40–72"). This gives the executing agent a fallback when numbers don't match.

### [Medium] `Settings.tsx` continues fetching company-profile data that is now ignored

**Location:** Task 9 (CompanyProfile rewire), consequences for `src/pages/Settings.tsx`

After Task 9, `Settings.tsx:96-181` still runs `fetchProfileData("company")` on profile-type selection, storing the result in its own `profileData` state, which it passes via `commonProps`. CompanyProfile now ignores this prop. The Settings fetch is pure waste — a network call that produces no visible effect.

This is not a bug (no broken behavior), but it's undocumented dead work. The plan's "Files modified" list does not include `Settings.tsx`, and the §X deviation section does not mention it. A future agent looking at Settings' `fetchProfileData` would reasonably assume CompanyProfile consumes it.

**Recommendation:** Add a `TD-FE` note or a comment in the plan recording that `Settings.tsx`'s company-profile fetch is now orphaned and should be retired when Settings is extracted (Phase 4 or later).

### [Low] `npm run test -- CompanyProfile` matches both test files

**Location:** Task 10 Step 2

The command `npm run test -- CompanyProfile` is a Vitest filename filter. It matches both `CompanyProfile.test.tsx` (intended) and `useCompanyProfile.test.tsx` (from Task 8). Both should pass, so this is harmless, but the agent's "Expected: both PASS" is imprecise — it will see 5 tests (3 from useCompanyProfile + 2 from CompanyProfile), not 2.

**Recommendation:** Use `npm run test -- CompanyProfile.test.tsx` for precision, or accept the broader match and adjust the expected count.

### [Low] `@testing-library/react` dependency installed mid-plan but used by later tasks without dependency note

**Location:** Task 8 Step 1 (installs RTL), Task 10 (component test), Task 11 (hook test)

Task 8 Step 1 installs `@testing-library/react@^14.3.1`. Tasks 10 and 11 also use `render`/`renderHook`/`waitFor` from RTL. The parallelism guidance in §0 correctly makes Tasks 10 and 11 depend on Task 8 (via the Slice 1 dependency chain), so in sequential execution this is fine. But if an executing agent dispatches Task 11's `useTenants.test.tsx` (which uses `renderHook`) before Task 8's RTL install completes, the test will fail.

**Recommendation:** In §0 Parallelism guidance, note that Tasks 10 and 11 require `@testing-library/react` (installed in Task 8) and Tasks 11+ require it as well. This is already implicitly captured by the dependency chains but would be clearer if stated.

### [Nit] `_props` parameter name obscures which props are retained

**Location:** Task 9 Step 2 — replacement CompanyProfile code

The plan's replacement component signature is `export function CompanyProfile(_props: CompanyProfileProps)`. The underscore prefix is conventional for "unused," but the interface declares `onProfileUpdate`, `isEditMode`, and `profileData` — a reader must cross-reference the interface and the component body to determine whether any prop is consumed. A destructured `{ onProfileUpdate, isEditMode, profileData }` with prefixed unused names (`_onProfileUpdate`, etc.) would make the contract clearer.

### [Nit] Plan's `handleSave` drops verbose console.log statements from the original

**Location:** Task 9 Step 2 — replacement handleSave

The current `CompanyProfile.tsx:handleSave` (lines 349–450) contains extensive `console.log` debugging statements. The plan's replacement omits them entirely. This is likely intentional (cleanup), but the plan doesn't note it. An executing agent might wonder if the logs were dropped by accident.
