---
artifact: plans/24e-frontend-phase-5e-regulatory-compliance.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-01
round: 1
---

## Findings

### [Medium] Hook shape validation is textual only — mismatch surfaces at Task 11, not Task 3

**Location:** Task 3 Step 1–2 (hook test + implementation, ~lines 366–436); abort criterion 4 (~line 29); Task 11 Step 2 (~lines 648–657)

The plan correctly front-loads the riskiest step — does `ResearchComponentResponse.data` supply the section's `keyUpdates`/`visualDataCards`/`regionalData`/`strategicRecommendations` shape? — into Task 3. However, the validation is a **textual reconcile** (the blockquote at Task 3 Step 2: "If `data` cannot supply a field…STOP"). The hook test (Task 3 Step 1) only asserts `result.current.regulatoryData` is defined and `refresh`/`isRefreshing` exist — it does **not** assert that `regulatoryData.keyUpdates`, `regulatoryData.visualDataCards`, etc. are present. Because every section access uses the `regulatoryData?.field || defaults` pattern, a shape mismatch would silently render the hardcoded defaults rather than fail fast. The mismatch would not surface until Task 11 Step 2 drops the prop entirely, at which point 8 extraction commits have landed.

**Recommendation:** Add field-level assertions to the Task 3 hook test. After the `isLoading === false` assertion, check that the returned `regulatoryData` has the expected top-level keys (e.g., `expect(Object.keys(result.current.regulatoryData)).toContain('keyUpdates')`). Alternatively, add a unit test for the adapter mapping (`query.data?.data` → `UntypedBackendApiResponse`) in `regulatoryHelpers.test.ts` with a fixture matching the 5b MSW handler shape. This makes the abort-4 gate executable rather than advisory.

### [Medium] Full regression suite runs only at Task 12 — no intermediate test runs between tasks

**Location:** Decomposition template gate step (~line 43); individual task gate commands (e.g., Task 2 Step 4 ~line 346, Task 4 Step 3 ~line 463, Task 7 Step 3 ~line 541); Task 12 Step 2 (~line 700)

Each task's gate runs the new file's test + `tsc --noEmit` + `npm run lint`. The full Vitest suite (`npx vitest run` without a file filter) and `npm run preflight` appear only at Task 12. This means a regression in an existing test (caused by, say, an import-path change in Task 6 that breaks a test from Task 4) could accumulate silently across 6+ tasks before surfacing at Task 12, at which point bisecting is more expensive.

**Recommendation:** Add a periodic full-test checkpoint. Options: (a) run `npx vitest run` (without file filter) every 3 tasks, or (b) run it after Task 5 (the chart card — the densest extraction) and Task 9 (the regional table — the last "large" extraction), or (c) at minimum add a note in the decomposition template that if the agent has any doubt mid-extraction, running the full suite is cheap insurance. The current gate is defensible for a well-structured extraction where each task only touches its own sub-component + the container's imports, but the plan is also asking an agent to delete ~2,700 LOC of inline code over 10 tasks — one mis-removal could cascade.

### [Low] `useAuth()` availability assumed in Task 11 but not verified in Task 0

**Location:** Task 11 Step 2 (~line 654: `userIdToUse = useAuth().currentUser?.uid`); Task 0 Steps 1–4 (~lines 54–126)

Task 11 Step 2 needs `userId` and `orgId` to call `useRegulatoryCompliance`. The plan says to get `userId` from `useAuth().currentUser?.uid` and `orgIdToUse` from an existing variable (~line 129). Neither `useAuth`'s availability in the section's import scope nor the `orgId` variable's existence is verified in Task 0's prerequisite checks. If `useAuth` isn't importable from the section's new location (e.g., due to a dependency-zone constraint), or if `orgIdToUse` doesn't exist in the relocated file, this surfaces late.

**Recommendation:** Add a check in Task 0 Step 4 (seam audit): `grep -nE 'useAuth|orgId' "$F"` to confirm both are available. This is low severity because the transitional import exception allows `features/market-research` to import legacy dirs, and `useAuth` is typically a global import — but confirming takes one line in the audit.

### [Low] No per-step rollback instruction within tasks

**Location:** Decomposition template (~lines 38–45); abort criteria (~lines 25–32)

The plan provides excellent whole-branch abort criteria (5 conditions). It also says "the per-task STOP conditions handle 'fix this step and continue'" (~line 25). But it doesn't say what to do if, e.g., Task 5 Step 2 (implement ComplianceVisualCard) leaves the container in a broken intermediate state after a failed gate. The implicit path is "revert the uncommitted changes and retry," but this is never stated. For an agentic worker, explicit guidance like "if a gate fails, revert uncommitted changes (`git checkout -- .`), fix the approach, and re-attempt from the step's start" would remove ambiguity.

**Recommendation:** Add a one-line recovery note to the decomposition template: "If a gate fails, revert uncommitted changes and re-attempt the step; if the step cannot be made green after two attempts, STOP and escalate."

### [Nit] Barrel `index.ts` assumes default export without Task 0 confirmation

**Location:** Task 1 Step 2 (~lines 170–174)

The barrel uses `export { default as RegulatoryComplianceSection } from "./RegulatoryComplianceSection"`, which requires the section to `export default`. The parenthetical says "If the audit shows a named export, mirror that instead" — but the audit (Task 0 Step 4) doesn't explicitly check for default vs named export. The grep commands in Step 4 don't include `export default` or `export function RegulatoryComplianceSection`.

**Recommendation:** Add to Task 0 Step 4's audit commands: `grep -nE 'export (default |function |const )RegulatoryCompliance' "$F"`. Trivial to add; prevents a minor mismatch.
