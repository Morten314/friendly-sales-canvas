---
artifact: specs/28-frontend-phase-10-settings-tenant-auth-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-04
round: 1
---

## Findings

### [High] Cross-feature import of `useCompanyProfile` by mission-control violates spec's own frozen-interface rule

**Location:** §2.3 ("Frozen interfaces"), §3.1 ("Dependency posture"), §3 target structure

The spec states (§2.3): "Other feature folders: `features/{…,mission-control,…}`. Phase 10 imports only their public `index.ts` if needed." And (§3.1): "No cross-feature imports."

But `features/mission-control/` currently imports `useCompanyProfile` from the *source* path Phase 10 plans to vacate:

- `features/mission-control/components/company-profile/CompanyProfileForm.tsx:6` — `import { useCompanyProfile } from "@/components/settings/useCompanyProfile"`
- `features/mission-control/pages/MissionControlPage.tsx:11` — same import
- `features/mission-control/pages/__tests__/MissionControlPage.test.tsx:46` — `vi.mock("@/components/settings/useCompanyProfile", …)`

Phase 10 moves `useCompanyProfile.ts` from `components/settings/` → `features/settings/hooks/`. Those mission-control imports will break at build time. Yet §2.3 says mission-control is frozen ("do not modify").

This is the single biggest gap. The spec needs an explicit resolution. Options:

1. **Promote `useCompanyProfile` to `shared/`** (e.g., `shared/api/hooks/useCompanyProfile.ts` or `shared/settings/`). Since it's consumed by two features, it's arguably cross-cutting infrastructure, not settings-private. This avoids touching mission-control.
2. **Allow a narrow exception** to the frozen rule: update the three mission-control import paths mechanically (no logic changes). Document this as an exception in the plan.
3. **Defer the hook move**: relocate only the page and component files; leave `useCompanyProfile.ts` at `components/settings/` until Phase 11 (shared promotion), which would already touch `lib/jwt.ts` and `hooks/useAuth.ts` in the same layer.

Option 1 is the cleanest architecturally; option 3 is the safest if the reviewer wants zero frozen-folder edits.

### [High] `vi.mock("@/lib/firebase")` in `useLogin.test.tsx` not listed as an importer to update

**Location:** §5 ("The one infra move — `firebase.ts` → `shared/auth/`")

The spec says `lib/firebase.ts` has "exactly two importers" (`shared/auth/AuthContext.tsx` and `pages/useLogin.ts`) and that "Update both importers" is the scope. This is correct for runtime imports.

However, `pages/__tests__/useLogin.test.tsx:15` contains:

```ts
vi.mock("@/lib/firebase", () => ({ auth: { currentUser: { uid: "u1" } } }));
```

When `firebase.ts` moves to `shared/auth/firebase.ts`, this mock path becomes stale and the test will either fail or silently mock the wrong module (depending on Vitest module resolution). The spec's §8 says "Relocated test files move with their code (import-path updates only)" but doesn't specifically call out the mock-path update, and §5's "two importers" claim doesn't account for it.

**Fix:** Add the test mock to §5's list of paths to update, or explicitly note in §8 that mock paths are covered by the general "import-path updates only" clause.

### [Medium] §9 conflict analysis phrasing is confusing about Phase 8's current state

**Location:** §9 ("Parallel-execution & merge safety")

The spec says: "Phase 8 removed `import Signals` (which sits between `import Settings` and `import TenantSelection`)." On the current `master` branch (which Phase 10 bases off), `import Signals` is still present at `App.tsx:14`. Phase 8 hasn't merged yet — it removes `import Signals` on its own branch.

The conflict analysis is correct (Phase 8 removes line 14; Phase 10 removes lines 9, 13, 15; overlap in the import cluster). But the phrasing makes it sound like Phase 8's removal is already on `master`, which could mislead a reader who checks the current state.

**Fix:** Clarify that Phase 8 removes `import Signals` on its branch (not yet merged to `master`), so on Phase 10's base the import is still present and the conflict materializes only at the merge gate.

### [Medium] `useCompanyProfile.ts` source path is imprecise

**Location:** §2.1 table, "From" column

The table lists `useCompanyProfile.ts (56)` as a "From" source, but doesn't give the full path. The file lives at `components/settings/useCompanyProfile.ts`, not in `pages/` (the section header suggests pages). A reader implementing the plan might look for it in the wrong directory.

Previous phases' specs have been precise about source paths (e.g., `pages/Login.tsx (277)`). Adding `components/settings/useCompanyProfile.ts (56)` to the "From" cell would prevent confusion.

### [Medium] No mention of `Settings.tsx` commented-out imports

**Location:** §2.1, §3, §7 stage 3

`pages/Settings.tsx` has both commented-out imports (lines 10–12) and active imports (lines 73–75) for `{CompanyProfile,UserProfile,AgentProfile}` from `@/components/settings/*`. The commented-out block will become stale in a different way after the move (it references the old path). While commented-out code has no runtime effect, it could confuse a reader who searches for old import paths. The spec doesn't mention whether to update or delete these stale comments during the move.

This is minor in practice (commented code) but worth a note in §7 stage 3 to either update or delete them.

### [Low] `shared/auth/` starting-state inventory should note absence of `firebase.ts`

**Location:** §1.3 ("Actual starting state")

The spec lists `src/shared/auth/` contents: "`AuthContext.tsx`, `index.ts`". Since §5 is specifically about moving `firebase.ts` into this directory, noting its current absence (still at `lib/firebase.ts`) would make the starting-vs-target contrast clearer. A reader scanning §1.3 to understand the starting state might wonder whether `firebase.ts` is already there.

### [Low] §3.1 dependency posture doesn't mention `features/mission-control → components/settings/useCompanyProfile`

**Location:** §3.1 ("Dependency posture")

The dependency posture lists three feature→shared dependency chains (auth, tenant, settings) and notes "No cross-feature imports." As documented in the [High] finding above, this is incorrect: mission-control imports `useCompanyProfile` from the settings source path. Even if the spec chooses to treat this as a pre-existing violation (it imports from the flat `components/` path, not from a feature), the dependency posture should acknowledge the external consumer.

### [Low] §6 boundary table could note `pages/ScoutDeployment.tsx` explicitly

**Location:** §6 ("Settings ↔ Scout boundary")

The table correctly assigns `ScoutDeployment` to Phase 9 and notes it lives in `components/settings/ScoutDeployment.tsx`. But `pages/ScoutDeployment.tsx` also exists and imports from `components/settings/ScoutDeployment`. While the prose says "leave in place," it only mentions the component, not the page wrapper. A note that both files stay (page stays in `pages/`, component stays in `components/settings/`) would prevent any ambiguity.

### [Nit] `npm run verify` referenced but not defined in the spec

**Location:** §7 ("Execution stages"), §11 ("Done when")

Stage descriptions reference `npm run verify` and `npm run preflight` as verification commands. These are defined in the broader project (previous phases established them), so this isn't a real gap — just noting that a reader without that context would need to look up the definitions.

### [Nit] Line counts in §2.1 match actual files exactly

**Location:** §2.1 table

Login.tsx = 277 ✓, TenantSelection.tsx = 101 ✓, Settings.tsx = 291 ✓, useLogin.ts = 53 ✓, useTenants.ts = 19 ✓, useCompanyProfile.ts = 56 ✓. The spec's inventory is precise.

### [Nit] §11 "Done when" — `components/settings/` retains only `ScoutDeployment.tsx`

**Location:** §11

The "Done when" checklist says `components/settings/` "retains only `ScoutDeployment.tsx` (Phase 9)." This is correct but also implicitly means the `__tests__/` directory inside `components/settings/` must be relocated (the tests for CompanyProfile and useCompanyProfile move to `features/settings/__tests__/`). The spec mentions "relocated tests" in the first bullet but doesn't call out the directory-level consequence here.
