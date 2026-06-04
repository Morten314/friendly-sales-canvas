---
artifact: worktree-phase-6-mission-control
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-04
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Reviewed in worktree at `.claude/worktrees/phase-6-mission-control`. Branch has 27 commits, ~8,432 insertions / ~8,371 deletions across 70 files. Aggregate diff reviewed (not commit-by-commit). Spec 25 and Plan 25 both loaded for adherence checking.

## Findings

### [High] `DataSourcesManager` barely decomposed — still 3,497 LOC

**Location:** `frontend/src/features/mission-control/components/data-sources/DataSourcesManager.tsx` (3,497 lines)

Plan Task 19 (stage 5) targeted splitting DataSourcesManager into `LeadStreamTable`, `DataSourceUploader`, `SourceForm` and reducing DataSourcesManager to a thin container. The three children exist and are reasonably extracted (120, 105, 285 LOC respectively). However, DataSourcesManager itself is still 3,497 LOC — the overwhelming bulk of the original monolith's write paths, state management, and inline JSX remains in the container. By contrast, `ICPManager` was successfully reduced to 406 LOC. The diff shows the extraction happened for the children but the container was not actually thinned: DataSourcesManager still owns upload pipelines, polling, source CRUD handlers, 20+ `useState` hooks, and extensive inline JSX that wasn't moved into the children. Plan stage 5 gate states "data-sources tab decomposed; reads on hooks; writes deferred; journey 02 + VR green" — reads *are* on hooks, but the structural decomposition gate is not meaningfully met at 3,497 LOC.

This is the same risk the spec flagged (R1 — "DataSourcesManager upload entanglement") and the plan's R1 mitigation ("keep upload helpers inline if extraction over-runs"). The mitigation was applied correctly, but the result is that stage 5's decomposition claim is thin.

### [Medium] `ConnectorApprovals` is 3,060 LOC — the second-largest file in the feature

**Location:** `frontend/src/features/mission-control/components/company-profile/ConnectorApprovals.tsx` (3,060 lines)

The connector-approval cluster was extracted from MissionControl as one monolithic component. It contains 8 platform-specific auth modal copies (Salesforce, HubSpot, Slack, Pipedrive, Zoho, LinkedIn, X/Twitter, Google Analytics, Mixpanel) each with near-identical login → approve/deny → state management logic. The spec acknowledged this was a "heaviest single carve" (§3, §7 stage 4), and the plan correctly deferred refactoring the write paths. However, 3,060 LOC in one component is a significant maintainability concern. TD-FE-39 correctly flags the cluster as "dead code" until connectors are wired, but the file is still massive and imported.

### [Medium] Duplicate `mapApiData*` transforms between `MissionControlPage` and `CompanyProfileForm`

**Location:**
- `MissionControlPage.tsx:68-93` (`mapApiDataForBackup`)
- `CompanyProfileForm.tsx:50-80` (`mapApiDataToFormState`)

Both functions perform the same snake_case/camelCase field mapping from an `UntypedBackendApiResponse` into a 16-field form shape. They differ only in that the page version returns `null` for empty/user-mismatched payloads while the form version does the same check identically. The plan (Task 15 Step 1) specified moving the form's mapping into the component and the page keeps its own "read-driven backup write" mapping, but the two are now exact duplicates. When the backend contract evolves, both must be updated in lockstep.

### [Medium] `_isSaving` prefixed-dead variable in ICPManager

**Location:** `frontend/src/features/mission-control/components/icp/ICPManager.tsx:26`

```ts
const [_isSaving, setIsSaving] = useState(false);
```

The `_isSaving` state is never read (only `setIsSaving` is called). The `@typescript-eslint/no-unused-vars` rule with `varsIgnorePattern: "^_"` makes this pass lint, but it's a dead variable that TD-FE-40 already notes. `setIsSaving` is called in the save path but the resulting state is never consumed for any UI rendering. This is cosmetic but worth cleaning up at merge (remove both the state and the setter calls, or wire it to a spinner — TD-FE-40 already captures the latter).

### [Medium] Plan-deviated: `ProfilerMergeView` not created (plan T21), which is fine, but the README documents this as a "Decision" without a corresponding spec amendment

**Location:** `frontend/src/features/mission-control/README.md:65-70`

The plan's Task 21 called for extracting `ProfilerMergeView` as a third ICP child component. The README correctly records the decision not to create it (the merge is a data transform, not a render region). This is a sound engineering judgment. However, the spec's §3 architecture tree and §7 stage 6 both name `ProfilerMergeView` explicitly, and no spec amendment was made. Per the repo's frozen-record convention, specs are not updated post-merge — but this decision should be noted for Phase 9 when it reads §6.

### [Low] `IcpWizard` at 952 LOC is the largest single child component

**Location:** `frontend/src/features/mission-control/components/icp/IcpWizard.tsx` (952 lines)

The wizard is a self-contained add/edit form with multi-field inline steps. 952 LOC is substantial but justified by the plan's design (it owns the entire wizard flow including validation, region/industry multi-selects, and the save POST). Not a decomposition miss — noted for awareness.

### [Low] `LeadStreamTable` is a pure presentational component that passes `deletingFileId` + `showLeadUpload` to gate its own delete button — could be simplified

**Location:** `frontend/src/features/mission-control/components/data-sources/LeadStreamTable.tsx:18-27`

The table receives `deletingFileId` and `showLeadUpload` purely to disable its own per-row delete button. A simpler API would be a single `canDelete: boolean` prop, collapsing two boolean-ish props into one. This is a minor API surface concern and doesn't affect behavior.

### [Low] `MissionControlPage` still owns read-driven side effects that duplicate CompanyProfileForm's hydration path

**Location:** `MissionControlPage.tsx:160-257`

The page runs four separate `useEffect` blocks that derive data-sources state, customer-profile completeness, localStorage backup, and profiler-cache commits from the same `useCompanyProfile` data that CompanyProfileForm also reads. The page and the form share one TanStack cache entry, so there's no double-fetch, but the two modules have overlapping derivations from the same data. This is noted as intentional in the code comments (the page owns cross-tab concerns, the form owns editable state), but it creates a fragile boundary where both sides must agree on the API payload shape.

### [Nit] `connectorTypes.ts` imports `type { Database }` from `lucide-react` for the icon field type

**Location:** `frontend/src/features/mission-control/components/company-profile/connectorTypes.ts:1`

Using `typeof Database` (a Lucide icon component) as a field type in the `DataSource` and `Connector` interfaces means these types can't be serialized to JSON or used outside a React rendering context. This matches the original code and is noted as a pre-existing pattern, not a Phase 6 regression.

### [Nit] Two `DataSource` interfaces in the feature with different shapes (by design)

**Location:**
- `frontend/src/features/mission-control/types.ts:27` — lean read-list shape (9 fields)
- `frontend/src/features/mission-control/components/company-profile/connectorTypes.ts:9` — rich connector shape (20+ fields)

Both named `DataSource`. The spec and README explicitly document this decision (§3, README "Decisions"). Importers currently disambiguate by import path. Phase 7 consumers will need to be careful about which they import. TD-FE-39 tracks potential unification.
