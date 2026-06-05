---
artifact: worktree-phase-10-settings-tenant-auth
artifact_type: impl
verdict: clean
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-05
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Spec: `specs/28-frontend-phase-10-settings-tenant-auth-design.md`. Plan: `plans/28-frontend-phase-10-settings-tenant-auth.md`. Both loaded from the branch (not yet on `master`). The branch also includes their review intermediates under `docs/reviews/`.

## Findings

### [Nit] Inconsistent barrel-file comment verbosity across new modules

**Location:** `frontend/src/features/auth/index.ts` (3 lines with "Cross-feature consumers" guidance), `frontend/src/features/tenant/index.ts` (2 lines, no guidance), `frontend/src/features/settings/index.ts` (2 lines, no guidance)

The `auth/index.ts` barrel includes a "Cross-feature consumers import from …, never a deep path" guidance comment. The other two feature barrels and the new `shared/company-profile/index.ts` omit it. Minor inconsistency — all four are new files introduced by this branch. The existing `shared/auth/index.ts` barrel (1 line, no comment) matches the shorter style, so `auth/index.ts` is the outlier.

### [Nit] Dead-code cleanup in SettingsPage.tsx exceeds plan scope (beneficial)

**Location:** `frontend/src/features/settings/pages/SettingsPage.tsx` — 68 lines of commented-out legacy `Settings` implementation removed

Plan Task 5 Step 3 specifies "Delete the stale commented-out imports in `Settings.tsx` (lines 10–12)." The actual diff removes the entire commented-out legacy component (lines 1–68), not just the 3-line import block the plan called out. This is unambiguously beneficial dead-code removal (all removed lines were commented out, zero behavioral impact), but it exceeds what the plan specified.

### [Low] `firebase.ts` not re-exported from `shared/auth/index.ts` creates a split import surface

**Location:** `frontend/src/shared/auth/index.ts` exports only `AuthProvider` and `useAuth`; `frontend/src/shared/auth/firebase.ts` is not re-exported

The spec explicitly states this is intentional ("The module need not be re-exported from `shared/auth/index.ts` (internal to the foundation)."), and `useLogin.ts` correctly imports from the deep path `@/shared/auth/firebase`. However, this creates a split import surface for `shared/auth`: consumers import `useAuth` from `@/shared/auth` but `auth` from `@/shared/auth/firebase`. Future contributors who need `auth.currentUser` access may not discover the deep path without searching the codebase. Consider documenting this in the `shared/auth/` README or adding a named re-export when Phase 11 consolidates `jwt.ts`/`useAuth.ts` into the same directory.
