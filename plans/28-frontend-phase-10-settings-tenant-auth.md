# Phase 10 — settings + tenant + auth feature extraction · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relocate the Login, TenantSelection, and Settings/CompanyProfile surfaces into `src/features/{auth,tenant,settings}/`, behind the converged per-feature shape (route registry + `<FeatureErrorBoundary>` + `index.ts`), and promote two cross-cutting modules (`firebase.ts`, `useCompanyProfile`) into `src/shared/`. Behavior, routes, and visuals are frozen — this is a pure structural move (the data layer is already on TanStack Query + zod, Phase 3).

**Architecture:** Two `shared/` infra moves first (enabling), then one vertical slice per feature (move files → fix imports → `routes.tsx` + `index.ts` → register in `app/routes.tsx` → remove the inline route from `App.tsx`). Each feature's `App.tsx` edit lands with its move so every commit stays green.

**Tech Stack:** React 18, Vite, TypeScript (strict), React Router v6, TanStack Query, Vitest + RTL + MSW, ESLint (`import-x`), Prettier.

---

## Conventions & execution rules (read first — these override habits)

- **All commands run from `frontend/`.** This repo has no root `package.json`.
- **Branch:** `worktree-phase-10-settings-tenant-auth` (already created off `master`). Worktree path:
  `/projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/phase-10-settings-tenant-auth`. Run git
  via `git -C <worktree>` — `cd <repo-root>` lands in the **main** checkout (on `phase-8`), not here.
- **Inner loop per task:** `npm run verify` (typecheck + lint + `vitest run --changed`) **plus**
  `npx prettier --check <touched files>` — `verify` does **not** run prettier, and import rewrites
  drift formatting. Full serial `npm run preflight` (adds build + Playwright + VR + knip) runs **only**
  at the merge gate (Task 8).
- **Do NOT run `npm run preflight:par` or standalone `npm run test:e2e`** while the Phase 8 session may
  share this box — CPU + `:5173` contention flakes the VR snapshots (TD-FE-29). Per-task gate = `verify`.
- **Surgical commits:** `git add` only the listed paths (parallel agents share the tree). Never `git add -A`.
- **Use `git mv`** for relocations (preserves history + keeps the index clean).
- **Divergence from Spec 28 §7/§9** ("batch `App.tsx` into one late commit"): this plan edits `App.tsx`
  **per feature** (Tasks 5–7), because moving a page `App.tsx` imports requires updating `App.tsx` in
  the same commit to keep the stage green. This does **not** worsen the Phase 8 merge — git merges the
  *final* `App.tsx` state, so the import-cluster conflict (§9) is identical whether done in one commit
  or three. The `<Routes>`-block removals remain non-overlapping with Phase 8's.
- **TD-FE numbers (47/48/49) are provisional** — Phase 8 also allocates ≥47; whichever merges second
  renumbers (Spec 28 §10).

## File structure (target — Spec 28 §3, §5, §5b)

```
src/features/
  auth/
    pages/LoginPage.tsx                 # from pages/Login.tsx
    hooks/useLogin.ts                   # from pages/useLogin.ts (useLogin + useSignup)
    hooks/__tests__/useLogin.test.tsx
    routes.tsx                          # "/" and "/login" → LoginPage
    index.ts                            # export { authRoutes }
    README.md
  tenant/
    pages/TenantSelectionPage.tsx       # from pages/TenantSelection.tsx
    hooks/useTenants.ts                 # from pages/useTenants.ts (MOCK_TENANTS, unchanged)
    hooks/__tests__/useTenants.test.tsx
    routes.tsx                          # "/tenant-selection" (ProtectedRoute)
    index.ts                            # export { tenantRoutes }
    README.md
  settings/
    pages/SettingsPage.tsx              # from pages/Settings.tsx
    components/{CompanyProfile,UserProfile,AgentProfile}.tsx   # from components/settings/
    components/__tests__/CompanyProfile.test.tsx
    routes.tsx                          # "/settings" (ProtectedRoute requireTenant)
    index.ts                            # export { settingsRoutes }
    README.md
src/shared/auth/firebase.ts             # from lib/firebase.ts
src/shared/company-profile/
  useCompanyProfile.ts                  # from components/settings/ (useCompanyProfile + useSaveCompanyProfile)
  __tests__/useCompanyProfile.test.tsx
  index.ts                              # export { useCompanyProfile, useSaveCompanyProfile }
```

**Left in place (not Phase 10):** `lib/jwt.ts`, `hooks/useAuth.ts` (Phase 11);
`components/settings/ScoutDeployment.tsx` + `pages/ScoutDeployment.tsx` (Phase 9). So
`components/settings/` retains only `ScoutDeployment.tsx` after this phase.

---

# Stage 0 — Enabling: infra moves to `shared/`

## Task 0: Install deps + clean baseline

**Files:** none (environment).

- [ ] **Step 1: Install.** Run from `frontend/`:

```bash
npm install
```

- [ ] **Step 2: Baseline verify.** Run from `frontend/`:

```bash
npm run verify
```

Expected: PASS (master is green). If it fails, STOP and report — do not start on a red baseline.

## Task 1: Relocate `firebase.ts` → `shared/auth/`

**Files:**
- Move: `src/lib/firebase.ts` → `src/shared/auth/firebase.ts`
- Modify: `src/shared/auth/AuthContext.tsx:12`, `src/pages/useLogin.ts:3`, `src/pages/__tests__/useLogin.test.tsx:15`

- [ ] **Step 1: Move the file.** Run from `frontend/`:

```bash
git mv src/lib/firebase.ts src/shared/auth/firebase.ts
```

- [ ] **Step 2: Update `AuthContext.tsx` import (intra-shared, relative).**

In `src/shared/auth/AuthContext.tsx` line 12, replace:

```ts
import { auth } from "@/lib/firebase";
```

with:

```ts
import { auth } from "./firebase";
```

- [ ] **Step 3: Update `useLogin.ts` import (still at `pages/` this stage).**

In `src/pages/useLogin.ts` line 3, replace `import { auth } from "@/lib/firebase";` with:

```ts
import { auth } from "@/shared/auth/firebase";
```

- [ ] **Step 4: Update the test mock path.**

In `src/pages/__tests__/useLogin.test.tsx` line 15, replace:

```ts
vi.mock("@/lib/firebase", () => ({ auth: { currentUser: { uid: "u1" } } }));
```

with:

```ts
vi.mock("@/shared/auth/firebase", () => ({ auth: { currentUser: { uid: "u1" } } }));
```

- [ ] **Step 5: Verify.** Run from `frontend/`:

```bash
npm run verify
npx prettier --check src/shared/auth/AuthContext.tsx src/shared/auth/firebase.ts src/pages/useLogin.ts src/pages/__tests__/useLogin.test.tsx
```

Expected: PASS. (`src/lib/firebase.ts` had only these importers; grep confirms no others.)

- [ ] **Step 6: Commit.**

```bash
git add src/shared/auth/firebase.ts src/shared/auth/AuthContext.tsx src/pages/useLogin.ts src/pages/__tests__/useLogin.test.tsx
git commit -m "refactor(fe): relocate firebase config into shared/auth"
```

## Task 2: Promote `useCompanyProfile` → `shared/company-profile/`

**Files:**
- Move: `src/components/settings/useCompanyProfile.ts` → `src/shared/company-profile/useCompanyProfile.ts`
- Move: `src/components/settings/__tests__/useCompanyProfile.test.tsx` → `src/shared/company-profile/__tests__/useCompanyProfile.test.tsx`
- Create: `src/shared/company-profile/index.ts`
- Modify: `src/components/settings/CompanyProfile.tsx:6`, `src/features/mission-control/components/company-profile/CompanyProfileForm.tsx:6`, `src/features/mission-control/pages/MissionControlPage.tsx:11`, `src/features/mission-control/pages/__tests__/MissionControlPage.test.tsx:46`

- [ ] **Step 1: Move the hook + its test.** Run from `frontend/`:

```bash
mkdir -p src/shared/company-profile/__tests__
git mv src/components/settings/useCompanyProfile.ts src/shared/company-profile/useCompanyProfile.ts
git mv src/components/settings/__tests__/useCompanyProfile.test.tsx src/shared/company-profile/__tests__/useCompanyProfile.test.tsx
```

(The hook's own imports are all `@/shared/api/*` absolute and stay valid. The test's `../useCompanyProfile` relative resolves correctly post-move.)

- [ ] **Step 2: Create the public surface.**

Create `src/shared/company-profile/index.ts`:

```ts
// Public surface for the shared company-profile data hooks.
// Consumed by features/settings and features/mission-control.
export { useCompanyProfile, useSaveCompanyProfile } from "./useCompanyProfile";
```

- [ ] **Step 3: Update consumer 1 — `CompanyProfile.tsx` (still at `components/settings/` this stage).**

In `src/components/settings/CompanyProfile.tsx` line 6, replace:

```ts
import { useCompanyProfile, useSaveCompanyProfile } from "./useCompanyProfile";
```

with:

```ts
import { useCompanyProfile, useSaveCompanyProfile } from "@/shared/company-profile";
```

- [ ] **Step 4: Update consumer 2 — mission-control `CompanyProfileForm.tsx` (§2.3 exception).**

In `src/features/mission-control/components/company-profile/CompanyProfileForm.tsx` line 6, replace:

```ts
import { useCompanyProfile } from "@/components/settings/useCompanyProfile";
```

with:

```ts
import { useCompanyProfile } from "@/shared/company-profile";
```

- [ ] **Step 5: Update consumer 3 — mission-control `MissionControlPage.tsx` + its test mock (§2.3 exception).**

In `src/features/mission-control/pages/MissionControlPage.tsx` line 11, replace
`import { useCompanyProfile } from "@/components/settings/useCompanyProfile";` with:

```ts
import { useCompanyProfile } from "@/shared/company-profile";
```

In `src/features/mission-control/pages/__tests__/MissionControlPage.test.tsx` line 46, replace
`vi.mock("@/components/settings/useCompanyProfile", () => ({` with:

```ts
vi.mock("@/shared/company-profile", () => ({
```

(Also update the descriptive comment at `:14` that names the old path, if present.)

- [ ] **Step 6: Verify.** Run from `frontend/`:

```bash
npm run verify
npx prettier --check src/shared/company-profile/useCompanyProfile.ts src/shared/company-profile/index.ts src/shared/company-profile/__tests__/useCompanyProfile.test.tsx src/components/settings/CompanyProfile.tsx src/features/mission-control/components/company-profile/CompanyProfileForm.tsx src/features/mission-control/pages/MissionControlPage.tsx src/features/mission-control/pages/__tests__/MissionControlPage.test.tsx
```

Expected: PASS (changed-scoped Vitest runs the moved hook test + the mission-control page test).

- [ ] **Step 7: Commit.**

```bash
git add src/shared/company-profile/ src/components/settings/CompanyProfile.tsx src/features/mission-control/components/company-profile/CompanyProfileForm.tsx src/features/mission-control/pages/MissionControlPage.tsx src/features/mission-control/pages/__tests__/MissionControlPage.test.tsx
git commit -m "refactor(fe): promote useCompanyProfile to shared/company-profile (settings + mission-control consumers)"
```

---

# Stage 1 — `auth` feature

## Task 3: Scaffold the `auth` skeleton

**Files:**
- Create: `src/features/auth/README.md`, `src/features/auth/index.ts` (placeholder)

- [ ] **Step 1: Create `README.md`.**

Create `src/features/auth/README.md`:

```markdown
# `auth` feature

Login + signup UI (Firebase email/password). Consumes the `shared/auth` context
(`AuthProvider`, `useAuth`) and `shared/tenant` (`selectTenant`); the AuthContext and Firebase
config live in `shared/auth/` (ADR-0002), not here. Public surface: `authRoutes` (`/`, `/login`).
```

- [ ] **Step 2: Create placeholder `index.ts`** (finalized in Task 4):

```ts
// Public surface for the `auth` feature.
export {};
```

- [ ] **Step 3: Verify + commit.** Run from `frontend/`:

```bash
npm run verify
git add src/features/auth/README.md src/features/auth/index.ts
git commit -m "chore(fe): scaffold auth feature skeleton"
```

## Task 4: Relocate Login + wire the route registry

**Files:**
- Move: `src/pages/Login.tsx` → `src/features/auth/pages/LoginPage.tsx`; `src/pages/useLogin.ts` → `src/features/auth/hooks/useLogin.ts`; `src/pages/__tests__/useLogin.test.tsx` → `src/features/auth/hooks/__tests__/useLogin.test.tsx`
- Create: `src/features/auth/routes.tsx`; finalize `src/features/auth/index.ts`
- Modify: `src/app/routes.tsx`, `src/App.tsx`

- [ ] **Step 1: Move the files.** Run from `frontend/`:

```bash
mkdir -p src/features/auth/pages src/features/auth/hooks/__tests__
git mv src/pages/Login.tsx src/features/auth/pages/LoginPage.tsx
git mv src/pages/useLogin.ts src/features/auth/hooks/useLogin.ts
git mv src/pages/__tests__/useLogin.test.tsx src/features/auth/hooks/__tests__/useLogin.test.tsx
```

- [ ] **Step 2: Fix `LoginPage.tsx` imports + rename the component.**

In `src/features/auth/pages/LoginPage.tsx`: the relative imports now break (the file moved two levels
deep). Rewrite them — `../components/ui/*` → `@/components/ui/*`, `../hooks/use-toast` →
`@/hooks/use-toast`, and `./useLogin` → `../hooks/useLogin`:

```ts
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

import { useLogin, useSignup } from "../hooks/useLogin";
```

(Keep `import { useAuth } from "@/shared/auth";` and the `lucide-react`/`react`/`react-router-dom`
imports as-is.) Then rename the component: line 23 `const Login: React.FC = () => {` →
`const LoginPage: React.FC = () => {`, and line 277 `export default Login;` → `export default LoginPage;`.

- [ ] **Step 3: `useLogin.ts` — no import change.** Its imports (`@/shared/auth/firebase`, `@/shared/auth`,
  `@/shared/tenant`, `@tanstack/react-query`) are all absolute and remain valid after the move. Leave as-is.

- [ ] **Step 4: `useLogin.test.tsx` — no import change.** Its `../useLogin` (line 17) resolves to
  `features/auth/hooks/useLogin`; the `vi.mock` paths are absolute (already fixed in Task 1). Leave as-is.

- [ ] **Step 5: Create `routes.tsx`.**

Create `src/features/auth/routes.tsx`:

```tsx
import { Route } from "react-router-dom";

import LoginPage from "./pages/LoginPage";

import { FeatureErrorBoundary } from "@/shared/components";

/** Auth route surface (public entry). Composed (append-only) by `src/app/routes.tsx`. */
export const authRoutes = [
  <Route
    key="root"
    path="/"
    element={
      <FeatureErrorBoundary featureName="Auth">
        <LoginPage />
      </FeatureErrorBoundary>
    }
  />,
  <Route
    key="login"
    path="/login"
    element={
      <FeatureErrorBoundary featureName="Auth">
        <LoginPage />
      </FeatureErrorBoundary>
    }
  />,
];
```

- [ ] **Step 6: Finalize `index.ts`** (replace the placeholder):

```ts
// Public surface for the `auth` feature.
// Cross-feature consumers import from "@/features/auth", never a deep path.
export { authRoutes } from "./routes";
```

- [ ] **Step 7: Register in `src/app/routes.tsx`** (append-only; keep imports alphabetical for `import/order`).

Add the import (alphabetically first) and spread `...authRoutes` into the array:

```ts
import { authRoutes } from "@/features/auth";
import { customersRoutes } from "@/features/customers";
import { marketResearchRoutes } from "@/features/market-research";
import { missionControlRoutes } from "@/features/mission-control";

export const featureRoutes = [
  ...marketResearchRoutes,
  ...missionControlRoutes,
  ...customersRoutes,
  ...authRoutes,
];
```

- [ ] **Step 8: Remove the legacy auth wiring from `src/App.tsx`.**

Delete the import (line 9): `import Login from "./pages/Login";`. Delete the two inline routes:

```tsx
<Route path="/" element={<Login />} />
<Route path="/login" element={<Login />} />
```

The `/` and `/login` URLs now resolve through `{featureRoutes}`.

- [ ] **Step 9: Verify.** Run from `frontend/`:

```bash
npm run verify
npx prettier --check src/features/auth/pages/LoginPage.tsx src/features/auth/routes.tsx src/features/auth/index.ts src/app/routes.tsx src/App.tsx
```

Expected: PASS. Typecheck confirms `App.tsx` no longer references the moved module.

- [ ] **Step 10: Commit.**

```bash
git add src/features/auth/ src/app/routes.tsx src/App.tsx
git commit -m "refactor(fe): extract Login into features/auth + route registry"
```

---

# Stage 2 — `tenant` feature

## Task 5: Scaffold + relocate TenantSelection + wire the route registry

**Files:**
- Create: `src/features/tenant/README.md`, `src/features/tenant/routes.tsx`, `src/features/tenant/index.ts`
- Move: `src/pages/TenantSelection.tsx` → `src/features/tenant/pages/TenantSelectionPage.tsx`; `src/pages/useTenants.ts` → `src/features/tenant/hooks/useTenants.ts`; `src/pages/__tests__/useTenants.test.tsx` → `src/features/tenant/hooks/__tests__/useTenants.test.tsx`
- Modify: `src/app/routes.tsx`, `src/App.tsx`

- [ ] **Step 1: Create `README.md`.**

Create `src/features/tenant/README.md`:

```markdown
# `tenant` feature

Tenant-selection UI. Consumes `shared/tenant` (`useTenant`, `selectTenant`) and `shared/auth`.
`useTenants` currently serves a mock list (no "list tenants" backend endpoint; real model is
one-org-per-user via `/org`) — see TD-FE-48. Public surface: `tenantRoutes` (`/tenant-selection`).
```

- [ ] **Step 2: Move the files.** Run from `frontend/`:

```bash
mkdir -p src/features/tenant/pages src/features/tenant/hooks/__tests__
git mv src/pages/TenantSelection.tsx src/features/tenant/pages/TenantSelectionPage.tsx
git mv src/pages/useTenants.ts src/features/tenant/hooks/useTenants.ts
git mv src/pages/__tests__/useTenants.test.tsx src/features/tenant/hooks/__tests__/useTenants.test.tsx
```

- [ ] **Step 3: Fix `TenantSelectionPage.tsx` imports + rename the component.**

In `src/features/tenant/pages/TenantSelectionPage.tsx`, rewrite the relative imports —
`../components/ui/*` → `@/components/ui/*`, `./useTenants` → `../hooks/useTenants`:

```ts
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useTenants } from "../hooks/useTenants";
```

(Keep `@/shared/auth`, `@/shared/tenant`, `lucide-react`, `react`, `react-router-dom` as-is.) Rename:
line 14 `const TenantSelection: React.FC = () => {` → `const TenantSelectionPage: React.FC = () => {`,
and line 101 `export default TenantSelection;` → `export default TenantSelectionPage;`.

- [ ] **Step 4: `useTenants.ts` + its test — no import change.** `useTenants.ts` imports
  `@tanstack/react-query` and `@/shared/api/*` (absolute); the test's `../useTenants` resolves post-move. Leave both as-is.

- [ ] **Step 5: Create `routes.tsx`.**

Create `src/features/tenant/routes.tsx`:

```tsx
import { Route } from "react-router-dom";

import TenantSelectionPage from "./pages/TenantSelectionPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/** Tenant-selection route surface. Composed (append-only) by `src/app/routes.tsx`. */
export const tenantRoutes = [
  <Route
    key="tenant-selection"
    path="/tenant-selection"
    element={
      <ProtectedRoute>
        <FeatureErrorBoundary featureName="Tenant">
          <TenantSelectionPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
```

- [ ] **Step 6: Create `index.ts`:**

```ts
// Public surface for the `tenant` feature.
export { tenantRoutes } from "./routes";
```

- [ ] **Step 7: Register in `src/app/routes.tsx`** (append `...tenantRoutes`; add the import alphabetically):

```ts
import { authRoutes } from "@/features/auth";
import { customersRoutes } from "@/features/customers";
import { marketResearchRoutes } from "@/features/market-research";
import { missionControlRoutes } from "@/features/mission-control";
import { tenantRoutes } from "@/features/tenant";

export const featureRoutes = [
  ...marketResearchRoutes,
  ...missionControlRoutes,
  ...customersRoutes,
  ...authRoutes,
  ...tenantRoutes,
];
```

- [ ] **Step 8: Remove the legacy tenant wiring from `src/App.tsx`.**

Delete the import `import TenantSelection from "./pages/TenantSelection";`. Delete the inline route block:

```tsx
<Route
  path="/tenant-selection"
  element={
    <ProtectedRoute>
      <TenantSelection />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 9: Verify.** Run from `frontend/`:

```bash
npm run verify
npx prettier --check src/features/tenant/pages/TenantSelectionPage.tsx src/features/tenant/routes.tsx src/features/tenant/index.ts src/app/routes.tsx src/App.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit.**

```bash
git add src/features/tenant/ src/app/routes.tsx src/App.tsx
git commit -m "refactor(fe): extract TenantSelection into features/tenant + route registry"
```

---

# Stage 3 — `settings` feature

## Task 6: Scaffold + relocate Settings + components + wire the route registry

**Files:**
- Create: `src/features/settings/README.md`, `src/features/settings/routes.tsx`, `src/features/settings/index.ts`
- Move: `src/pages/Settings.tsx` → `src/features/settings/pages/SettingsPage.tsx`; `src/components/settings/{CompanyProfile,UserProfile,AgentProfile}.tsx` → `src/features/settings/components/`; `src/components/settings/__tests__/CompanyProfile.test.tsx` → `src/features/settings/components/__tests__/CompanyProfile.test.tsx`
- Modify: `src/app/routes.tsx`, `src/App.tsx`

- [ ] **Step 1: Create `README.md`.**

Create `src/features/settings/README.md`:

```markdown
# `settings` feature

Settings page with Company / User / Agent profile sections. Consumes `shared/auth` (`useAuth`),
`shared/api` (client + contracts), and `shared/company-profile` (`useCompanyProfile`). Renders inside
the shell `Layout`. Public surface: `settingsRoutes` (`/settings`).
```

- [ ] **Step 2: Move the files.** Run from `frontend/`:

```bash
mkdir -p src/features/settings/pages src/features/settings/components/__tests__
git mv src/pages/Settings.tsx src/features/settings/pages/SettingsPage.tsx
git mv src/components/settings/CompanyProfile.tsx src/features/settings/components/CompanyProfile.tsx
git mv src/components/settings/UserProfile.tsx src/features/settings/components/UserProfile.tsx
git mv src/components/settings/AgentProfile.tsx src/features/settings/components/AgentProfile.tsx
git mv src/components/settings/__tests__/CompanyProfile.test.tsx src/features/settings/components/__tests__/CompanyProfile.test.tsx
```

(`components/settings/` now retains only `ScoutDeployment.tsx` — Phase 9.)

- [ ] **Step 3: Fix `SettingsPage.tsx` imports + rename the component + delete stale comments.**

In `src/features/settings/pages/SettingsPage.tsx`, the three settings components moved into this
feature — repoint lines 73–75 from `@/components/settings/*` to relative `../components/*`:

```ts
import { AgentProfile } from "../components/AgentProfile";
import { CompanyProfile } from "../components/CompanyProfile";
import { UserProfile } from "../components/UserProfile";
```

(Keep `@/components/ui/*`, `@/features/shell` (`Layout`), `@/lib/types/escape-hatches`, `@/shared/auth`
as-is.) Delete the stale commented-out import block (lines 10–12, the old `@/components/settings/*`
comments). Rename: line 88 `const Settings = () => {` → `const SettingsPage = () => {`, line 291
`export default Settings;` → `export default SettingsPage;`.

- [ ] **Step 4: `CompanyProfile.tsx` — no further import change.** Its `useCompanyProfile` import was
  repointed to `@/shared/company-profile` in Task 2; all other imports are `@/…` absolute. Leave as-is.

- [ ] **Step 5: `UserProfile.tsx` and `AgentProfile.tsx` — no import change.** Both import only
  `@/components/ui/*`, `@/lib/types/escape-hatches`, `@/shared/auth` (absolute). Leave as-is.

- [ ] **Step 6: `CompanyProfile.test.tsx` — no import change.** Its `../CompanyProfile` resolves to the
  sibling-moved component; `@/test/msw/server` and `@/shared/auth` are absolute. Leave as-is.

- [ ] **Step 7: Create `routes.tsx`.**

Create `src/features/settings/routes.tsx`:

```tsx
import { Route } from "react-router-dom";

import SettingsPage from "./pages/SettingsPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/** Settings route surface. Composed (append-only) by `src/app/routes.tsx`. */
export const settingsRoutes = [
  <Route
    key="settings"
    path="/settings"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Settings">
          <SettingsPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
```

- [ ] **Step 8: Create `index.ts`:**

```ts
// Public surface for the `settings` feature.
export { settingsRoutes } from "./routes";
```

- [ ] **Step 9: Register in `src/app/routes.tsx`** (append `...settingsRoutes`; add the import alphabetically):

```ts
import { authRoutes } from "@/features/auth";
import { customersRoutes } from "@/features/customers";
import { marketResearchRoutes } from "@/features/market-research";
import { missionControlRoutes } from "@/features/mission-control";
import { settingsRoutes } from "@/features/settings";
import { tenantRoutes } from "@/features/tenant";

export const featureRoutes = [
  ...marketResearchRoutes,
  ...missionControlRoutes,
  ...customersRoutes,
  ...authRoutes,
  ...tenantRoutes,
  ...settingsRoutes,
];
```

- [ ] **Step 10: Remove the legacy settings wiring from `src/App.tsx`.**

Delete the import `import Settings from "./pages/Settings";`. Delete the inline route block:

```tsx
<Route
  path="/settings"
  element={
    <ProtectedRoute requireTenant>
      <Settings />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 11: Verify.** Run from `frontend/`:

```bash
npm run verify
npx prettier --check src/features/settings/pages/SettingsPage.tsx src/features/settings/components/CompanyProfile.tsx src/features/settings/components/UserProfile.tsx src/features/settings/components/AgentProfile.tsx src/features/settings/routes.tsx src/features/settings/index.ts src/app/routes.tsx src/App.tsx
```

Expected: PASS.

- [ ] **Step 12: Commit.**

```bash
git add src/features/settings/ src/app/routes.tsx src/App.tsx
git commit -m "refactor(fe): extract Settings into features/settings + route registry"
```

---

# Stage 4 — Cleanup + tech-debt register

## Task 7: Fix stale path comment + record TD-FE entries

**Files:**
- Modify: `src/lib/types/escape-hatches.ts` (comment), `docs/TECH_DEBT.md`

- [ ] **Step 1: Update the stale path comment in `escape-hatches.ts`.**

In `src/lib/types/escape-hatches.ts` (around lines 67–68), the comment lists the old paths of
`UserProfile.tsx`, `AgentProfile.tsx`, and `CompanyProfile.tsx`. Update those paths to their new homes
(`src/features/settings/components/UserProfile.tsx`, `.../AgentProfile.tsx`, `.../CompanyProfile.tsx`).
This is a comment-only edit; no logic changes.

- [ ] **Step 2: Verify the comment edit.** Run from `frontend/`:

```bash
npm run verify
npx prettier --check src/lib/types/escape-hatches.ts
```

Expected: PASS.

- [ ] **Step 3: Append TD-FE entries to `docs/TECH_DEBT.md`** (provisional 47/48/49 — see Conventions;
  do NOT run prettier on this file — it is outside the FE prettier gate and prettier corrupts its
  markdown). Append three entries in the file's existing entry format:

  - **TD-FE-47** — `lib/jwt.ts` + `hooks/useAuth.ts` still in `lib/`/`hooks/` (consumed by
    mission-control + market-research); promote to `shared/` in Phase 11.
  - **TD-FE-48** — `tenant/useTenants` serves `MOCK_TENANTS`; no "list tenants" endpoint exists (real
    model is one-org-per-user via `GET /org`). Product question: should a tenant-selection page exist?
  - **TD-FE-49** — `settings/AgentProfile` ↔ `components/settings/ScoutDeployment` are near-duplicate
    forms; dedup when Phase 9 extracts scout.

- [ ] **Step 4: Commit.**

```bash
git add docs/TECH_DEBT.md src/lib/types/escape-hatches.ts
git commit -m "docs(tech-debt): record Phase 10 deferrals (TD-FE-47/48/49) + fix escape-hatches paths"
```

---

# Stage 5 — Merge gate (controller-run)

## Task 8: Full serial preflight + integrate

**Files:** none (verification + merge).

- [ ] **Step 1: Sanity — old paths gone, no stragglers.** Run from `frontend/`:

```bash
ls src/pages/Login.tsx src/pages/TenantSelection.tsx src/pages/Settings.tsx src/pages/useLogin.ts src/pages/useTenants.ts src/lib/firebase.ts src/components/settings/useCompanyProfile.ts 2>&1 | sort -u
git grep -n "@/lib/firebase\|@/components/settings/useCompanyProfile\|from \"\./pages/Login\|from \"\./pages/Settings\|from \"\./pages/TenantSelection" -- src ':!src/features/settings' ':!src/features/auth' ':!src/features/tenant'
```

Expected: the `ls` reports "No such file" for every old path; the `git grep` returns nothing.

- [ ] **Step 2: Refresh against `master` (if Phase 8 has merged since branch).** Run from the worktree:

```bash
git -C <worktree> fetch origin
git -C <worktree> merge master
```

Resolve the expected `App.tsx` import-cluster conflict (Spec 28 §9) by keeping **all** removals
(Phase 8's `Signals` removal + Phase 10's `Login`/`Settings`/`TenantSelection` removals). Re-run `npm run verify`.

- [ ] **Step 3: Full serial preflight (NOT `preflight:par`; ensure no other session shares the box).**
  Run from `frontend/`:

```bash
npm run preflight
```

Expected: PASS (typecheck + lint + Vitest full suite + build + Playwright journeys + VR + knip). If VR
flakes under load, re-run on an idle box — do not accept a red merge gate.

- [ ] **Step 4: Integrate** (controller, after green preflight):

```bash
git checkout master
git merge --no-ff worktree-phase-10-settings-tenant-auth
git push origin master
```

---

## Self-review notes (author)

- **Spec coverage:** §2.1 three features → Tasks 3–6; §5 firebase → Task 1; §5b useCompanyProfile →
  Task 2; §4 route registry/App.tsx → Tasks 4/5/6 steps 7–8/9–10; §6 ScoutDeployment left → Task 6
  step 2 note; §8 tests travel → no-change steps; §9 merge safety → Task 8; §10 TD-FE → Task 7.
- **Divergence logged:** per-feature `App.tsx` edits vs spec's "one late commit" (Conventions).
- **Type/name consistency:** `LoginPage`/`TenantSelectionPage`/`SettingsPage` default exports;
  `authRoutes`/`tenantRoutes`/`settingsRoutes` named exports, each re-exported from its `index.ts` and
  spread in `app/routes.tsx`.
