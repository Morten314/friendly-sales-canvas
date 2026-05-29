---
artifact: plans/20-frontend-phase-3-api-data-layer.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 2
---

## Context

Round 2. Round 1 produced 8 findings (2 High, 3 Medium, 2 Low, 1 Nit); the plan's §X and inline edits confirm all were addressed (synthesis-1 F1 save→invalidate test added to Task 8, F2 useLogin delegation test added to Task 13, F3/F5 TD-FE-11 added to Task 9, F4 text-match anchors added to Task 12, F6/F7 parallelism guidance clarified, F8 declined with reasoning). This review checks the round-2 plan for residual and newly introduced issues.

The plan is long (2359 lines) because it inlines complete file contents for every new module. This is a deliberate trade-off favoring execution precision over review brevity. No token-pressure caveats apply to the findings below; all are substantive.

## Findings

### [Medium] TenantSelection rewire orphans `TenantContext.availableTenants` — not recorded as tech debt

**Location:** Task 11 Step 3 (TenantSelection.tsx rewire), "Files modified" manifest

Task 11 removes the `setAvailableTenants(mockTenants)` call from TenantSelection and replaces it with a `useTenants` TanStack query. The plan correctly notes "TenantSelection is the only reader of the old `availableTenants` context state (verified)." But the consequence — that `TenantContext.availableTenants` and `setAvailableTenants` become permanently dead state (initialized to whatever the context defaults to, never populated, never read) — is not recorded anywhere. No TD-FE entry is added, and the plan's "Files modified" list for Task 11 does not mention `TenantContext.tsx`.

A future agent encountering `TenantContext` would see `availableTenants` / `setAvailableTenants` and reasonably assume they serve a purpose. The plan's §X "Out-of-scope deferrals" section does not mention this orphan.

**Recommendation:** Add a TD-FE entry (TD-FE-12) recording that `TenantContext.availableTenants` / `setAvailableTenants` are dead state after Task 11, to be collapsed when Phase 10 introduces a real tenant endpoint and removes the context field entirely. Alternatively, add a brief note to the plan's §X deferrals list.

### [Medium] Task 12 deletes `getApiBaseUrl` without verifying zero importers first

**Location:** Task 12 Step 3 ("remove the now-unused `getApiBaseUrl` helper")

The plan asserts `getApiBaseUrl` "has zero references" and removes it, relying on the subsequent typecheck/lint to catch any stragglers. But Task 14 (deleting `src/services/api.ts`) demonstrates the safer pattern: Step 1 runs `rg -l "services/api" src` to re-confirm 0 importers *before* the deletion step. Task 12 should follow the same discipline.

The risk is that some file outside `jwt.ts` imports `getApiBaseUrl` (e.g., a test helper, a storybook config, an MSW handler). If such a reference exists, the typecheck catches it — but only *after* the deletion is staged, and the executing agent must then unstaged and investigate. An upfront `rg` check avoids this.

**Recommendation:** Add a Step 3a (before deletion): `rg "getApiBaseUrl" frontend/src` — expected: no output. If anything prints, stop and investigate before removing the helper.

### [Low] File extension mismatch for `useTenants` test file

**Location:** Task 11 "Files:" header vs Step 2

The task's "Files" manifest lists `src/pages/__tests__/useTenants.test.ts` (`.ts`), but Step 2's heading says `src/pages/__tests__/useTenants.test.tsx` and its opening note explicitly states "(`.tsx` — the wrapper contains JSX)." The file content contains `<QueryClientProvider>` (JSX), so `.tsx` is correct. The "Files:" manifest entry is wrong.

An executing agent that pre-creates files from the manifest would use `.ts`, and Vitest/TypeScript would fail on the JSX content. The Step 5 commit command does not include the test file extension explicitly (it uses a glob `frontend/src/pages/__tests__/useTenants.test.tsx` — note `.tsx`), which would miss a `.ts` file.

**Recommendation:** Fix the "Files:" manifest entry to `.tsx`.

### [Low] Task 9 commits the CompanyProfile rewire with no component-level verification

**Location:** Task 9 Step 5 (commit) vs Task 10 (component test arrives later)

The CompanyProfile rewire is a significant edit: it replaces the data-fetching mechanism (bare `fetch` in `useEffect` → `useQuery` hook), drops the `profileData` prop override `useEffect`, removes 6+ imports, and changes how form state is seeded. The commit is made after typecheck + lint only. No component test yet exists (Task 10 creates it in the next commit), and the hook test from Task 8 validates hooks in isolation, not the integration.

If the rewire breaks rendering (e.g., a stale variable reference, a query that never resolves under the component's `enabled` guard), the first automated signal is Task 10. The intermediate commit is "blind."

This is acceptable given the feature-branch model (Task 16 preflight catches regressions), but it means a `git bisect` landing on the Task 9 commit would show a broken component with no test to pinpoint the cause.

**Recommendation:** Either combine Tasks 9 and 10 into one commit (rewire + test together), or run `npm run dev` and manually verify the settings page renders after Step 4 before committing.

### [Nit] `useCompanyProfile` queryFn silently resolves all non-ZodError failures to `null`

**Location:** Task 8 Step 2, hook `queryFn` catch block

The `catch` block returns `null` for any non-`ZodError`, including HTTP 500s, network timeouts, and CORS errors. The JSDoc documents this ("any other HTTP/network error resolves to `null` → the component renders the empty form"), which is accurate and behavior-preserving. But a more explicit note that *server errors (5xx) are also silenced* would help a future reader who expects `isError` to surface for genuine failures.

No action required; noted for awareness.

### [Nit] Task 2 Step 1 instruction is ambiguous about source of truth for the moved class

**Location:** Task 2 Step 1 ("Copy the entire current body of `src/lib/rateLimitManager.ts` … The complete file:")

The step instructs "Copy the entire current body … verbatim" (suggesting re-reading the live file), then provides the complete target file inline. If `rateLimitManager.ts` has been modified between plan writing and execution, the agent must decide whether to use the inlined version (plan-authored) or re-read the current file (potentially diverged). The abort trigger #2 (characterization test goes red) covers the case where the divergence matters, but the instruction itself is contradictory.

**Recommendation:** Clarify: "The inlined file below is the authoritative target. If the current `rateLimitManager.ts` has diverged, reconcile before proceeding — abort trigger #2 will catch a mismatch."
