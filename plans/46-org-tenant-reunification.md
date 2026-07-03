# Org / Tenant Reunification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the frontend `tenant` abstraction into the single authoritative backend `org` (sourced from `GET /org`), recover data stranded under non-canonical org-ids, and enforce a bijective 1:1 user↔org model so the divergence cannot recur.

**Architecture:** Frontend resolves org through one `useOrgId()` hook backed by an `AuthContext` that treats `GET /org` as authoritative (WS1+WS2). The `tenant` module, its provider, its mock-backed selection route, and the hardcoded `{id:"brewra"}` auto-select are deleted. Backend `connect_user_to_org` is hardened to enforce the invariant (WS4), and a dry-run-first Render script re-points stranded `org_id` data across Neo4j/Mongo/Pinecone (WS3).

**Tech Stack:** Frontend — React 18, TypeScript, Vite, TanStack Query, Vitest, React Testing Library. Backend — FastAPI, Python 3.12, MongoDB (`Org_Management`), Neo4j, Pinecone, pytest.

**Spec:** `specs/46-org-tenant-reunification-design.md` (round-1 reviewed + synthesized).

## Global Constraints

- **MVP, 0 live users** — optimize for velocity; no backwards-compat shims, no feature flags, no migration ceremony.
- **One org per user (bijective 1:1)** — a user has exactly one org, an org has exactly one user. This is a hard product requirement, not optional hardening.
- **`org_id` is authoritative from `GET /org`** — never from a persisted `tenant`; never trust a stale cache over a fresh fetch.
- **Valid `org_id` = a UUID present in `Org_Management.orgs.org_list`.** uid-shaped / malformed values are invalid.
- **Frontend gate:** per-task run `npm run verify` (typecheck + lint + changed tests) from `frontend/`, and `npx prettier --check` on touched files (verify omits format:check). Full `npm run preflight` before merge. Use `fireEvent`, **not** `@testing-library/user-event` (undeclared in this repo). Use `npm run typecheck`, never bare `tsc`.
- **Backend gate:** run tests with `backend/.venv/bin/python -m pytest <path> -q` from `backend/`. **This worktree has no `backend/.venv`** — before backend tasks, symlink it from the main checkout: `ln -s /projects/Brewra/brewra-gtm-intelligence/backend/.venv /projects/Brewra/brewra-gtm-intelligence/.claude/worktrees/org-tenant-reunification/backend/.venv` (create the venv in the main checkout first if absent). `patch-where-used` per `backend/TESTING.md`. Do **not** touch root-level `backend/test_*.py` (those are live prod probes).
- **Commits:** `type(scope): subject` (`feat(fe):`, `refactor(fe):`, `feat(be):`, `chore(be):`, `test(be):`). No `Co-Authored-By` footer. One logical step per commit.
- **Branch:** `worktree-org-tenant-reunification` (already cut from `origin/master`).

## Rollout sequence (deploy order ≠ code order)

The tasks below are ordered for a green, reviewable branch. **Operational rollout** is: (1) run WS3 `reconcile_orgs.py --report` on Render and review; (2) ship WS1+WS2 (Tasks 1-6) — the forward-fix that unblocks users; (3) run WS3 `--apply` (Task 9) after review; (4) deploy WS4 enforcement (Task 7) once data is clean. Task 7 enforcement must not be live before the `--apply` cleanup, or existing violations would reject legitimate calls.

## File Structure

**Frontend — created:**
- `frontend/src/shared/auth/useOrgId.ts` — the single org resolver.
- `frontend/src/shared/auth/__tests__/useOrgId.test.tsx` — resolver tests.
- `frontend/src/app/clearStaleTenantKeys.ts` — one-time `localStorage` sweep of `selectedTenant_*`.
- `frontend/src/app/__tests__/clearStaleTenantKeys.test.ts` — sweep tests.

**Frontend — modified:**
- `shared/auth/AuthContext.tsx` — `GET /org` authoritative (WS2).
- `shared/auth/index.ts` — export `useOrgId`.
- `shared/auth/useAuthToken.ts`, `features/market-research/components/lead-stream/LeadsTable.tsx`, `features/customers/components/lead-stream/LeadStream.tsx`, `features/signals/pages/SignalsPage.tsx` — resolution sites → `useOrgId()`.
- `features/shell/components/Header.tsx`, `features/shell/components/ProfileDialog.tsx` — display `orgName ?? orgId` from `useAuth()`.
- `features/shell/components/Sidebar.tsx`, `features/auth/hooks/useLogin.ts` — drop tenant lifecycle calls.
- `features/shell/ProtectedRoute.tsx` — auth-only gate.
- The 11 `features/*/routes.tsx` that pass `requireTenant` — drop the prop.
- `App.tsx` — remove `<TenantProvider>`; `main.tsx` (or App) — call the sweep once.
- `app/routes.tsx` (or wherever `featureRoutes` aggregates) — drop the tenant route.

**Frontend — deleted:**
- `shared/tenant/` (TenantContext.tsx, index.ts), `features/tenant/` (whole feature incl. `useTenants`/`MOCK_TENANTS`, `TenantSelectionPage`, routes, tests).

**Backend — modified:**
- `app/services/org_auth/orgs.py` — harden `connect_user_to_org` (WS4).
- `backend/tests/unit/test_org_auth.py` — WS4 tests.

**Backend — created:**
- `backend/scripts/reconcile_orgs.py` — WS3 dry-run-first reconciliation.
- `backend/tests/unit/test_reconcile_orgs.py` — WS3 planning + apply logic tests (mocked clients).

---

### Task 1: WS2 — `GET /org` authoritative in AuthContext

Make `AuthContext` always fetch `GET /org` on auth resolution, let the fresh value win over any cached value, keep the cache only as an optimistic/fallback value, and never block first paint on the fetch. This is the correctness foundation for `useOrgId()`.

**Files:**
- Modify: `frontend/src/shared/auth/AuthContext.tsx` (`fetchOrgId` ~65-113; `onAuthStateChanged` effect ~115-145)
- Test: `frontend/src/shared/auth/__tests__/AuthContext.orgAuthoritative.test.tsx` (create)

**Interfaces:**
- Consumes: `buildApiUrl("org")` from `@/shared/api/transport`; firebase `auth` from `./firebase`.
- Produces: unchanged `useAuth()` shape (`{ currentUser, orgId, orgName, login, signup, logout, fetchOrgId, loading }`). Behavior change only: `orgId`/`orgName` reflect the authoritative `GET /org` result, overwriting a stale cache.

- [ ] **Step 1: Write the failing test**

```tsx
// AuthContext.orgAuthoritative.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Drive onAuthStateChanged with a fake logged-in user.
let authCb: (u: unknown) => void = () => {};
vi.mock("../firebase", () => ({ auth: {} }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    authCb = cb;
    return () => {};
  },
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
}));

import { AuthProvider, useAuth } from "../AuthContext";

function Probe() {
  const { orgId } = useAuth();
  return <div>org:{orgId ?? "none"}</div>;
}

describe("AuthContext GET /org authoritative", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("overwrites a stale cached org with the fresh GET /org value", async () => {
    localStorage.setItem("org_id_u1", "stale-org");
    localStorage.setItem("org_name_u1", "Stale");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", org_id: "fresh-uuid", org_name: "Fresh" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    authCb({ uid: "u1" });

    // optimistic cache first, then fresh wins
    await waitFor(() => expect(screen.getByText("org:fresh-uuid")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("org_id_u1")).toBe("fresh-uuid");
  });

  it("keeps the cached org when GET /org fails", async () => {
    localStorage.setItem("org_id_u1", "cached-org");
    localStorage.setItem("org_name_u1", "Cached");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: "down" }));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    authCb({ uid: "u1" });

    await waitFor(() => expect(screen.getByText("org:cached-org")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/shared/auth/__tests__/AuthContext.orgAuthoritative.test.tsx`
Expected: FAIL — first test shows `org:stale-org` (cache-first, never re-fetches).

- [ ] **Step 3: Rewrite `fetchOrgId` to be authoritative (optimistic cache, fresh wins, cache fallback)**

Replace the body of `fetchOrgId` (currently returns cache early at ~71-75):

```tsx
const fetchOrgId = useCallback(
  async (userId: string): Promise<{ orgId: string | null; orgName: string | null }> => {
    // Optimistic: surface any cached value immediately so first paint isn't blocked.
    const cachedOrgId = localStorage.getItem(`org_id_${userId}`);
    const cachedOrgName = localStorage.getItem(`org_name_${userId}`);
    if (cachedOrgId) {
      setOrgId(cachedOrgId);
      if (cachedOrgName) setOrgName(cachedOrgName);
    }

    try {
      const response = await fetch(`${buildApiUrl("org")}?user_id=${userId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        console.error("Failed to fetch org data:", response.status, response.statusText);
        return { orgId: cachedOrgId, orgName: cachedOrgName }; // keep optimistic cache
      }
      const data = await response.json();
      if (data.status === "success" && data.org_id) {
        const fetchedOrgId: string = data.org_id;
        const fetchedOrgName: string | null = data.org_name || null;
        setOrgId(fetchedOrgId);
        setOrgName(fetchedOrgName);
        localStorage.setItem(`org_id_${userId}`, fetchedOrgId);
        if (fetchedOrgName) localStorage.setItem(`org_name_${userId}`, fetchedOrgName);
        else localStorage.removeItem(`org_name_${userId}`);
        return { orgId: fetchedOrgId, orgName: fetchedOrgName };
      }
      return { orgId: cachedOrgId, orgName: cachedOrgName };
    } catch (error) {
      console.error("Error fetching org data:", error);
      return { orgId: cachedOrgId, orgName: cachedOrgName };
    }
  },
  [],
);
```

- [ ] **Step 4: Make the auth effect always reconcile**

In the `onAuthStateChanged` effect, replace the cache-first branch (currently only calls `fetchOrgId` when no cache exists) so it always reconciles:

```tsx
if (user?.uid) {
  // fetchOrgId sets an optimistic value from cache, then reconciles against GET /org
  void fetchOrgId(user.uid);
} else {
  setOrgId(null);
  setOrgName(null);
}
setLoading(false);
```

First paint is not blocked: `setLoading(false)` runs synchronously in the callback and `fetchOrgId` reconciles in the background; org-scoped query keys refetch when `orgId` flips (keys embed `orgId`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/shared/auth/__tests__/AuthContext.orgAuthoritative.test.tsx`
Expected: PASS (both).

- [ ] **Step 6: Verify + commit**

Run: `cd frontend && npm run typecheck && npx prettier --check src/shared/auth/AuthContext.tsx`

```bash
git add frontend/src/shared/auth/AuthContext.tsx frontend/src/shared/auth/__tests__/AuthContext.orgAuthoritative.test.tsx
git commit -m "feat(fe): make GET /org authoritative in AuthContext (anti-stale)"
```

---

### Task 2: WS1 — `useOrgId()` resolver hook

The single, named org resolver every surface will use. Wraps `useAuth().orgId` so there is one seam for org resolution.

**Files:**
- Create: `frontend/src/shared/auth/useOrgId.ts`
- Modify: `frontend/src/shared/auth/index.ts` (export it)
- Test: `frontend/src/shared/auth/__tests__/useOrgId.test.tsx` (create)

**Interfaces:**
- Consumes: `useAuth()` from `./AuthContext`.
- Produces: `useOrgId(): string | null` — the authoritative org id (`null` until auth resolves). Display consumers that also need the name read `useAuth().orgName` directly.

- [ ] **Step 1: Write the failing test**

```tsx
// useOrgId.test.tsx
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../AuthContext", () => ({ useAuth: vi.fn() }));
import { useAuth } from "../AuthContext";
import { useOrgId } from "../useOrgId";

describe("useOrgId", () => {
  it("returns the auth org id", () => {
    vi.mocked(useAuth).mockReturnValue({ orgId: "org-123" } as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => useOrgId());
    expect(result.current).toBe("org-123");
  });

  it("returns null before auth resolves", () => {
    vi.mocked(useAuth).mockReturnValue({ orgId: null } as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => useOrgId());
    expect(result.current).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/shared/auth/__tests__/useOrgId.test.tsx`
Expected: FAIL — `useOrgId` not found.

- [ ] **Step 3: Implement the hook + export**

```ts
// frontend/src/shared/auth/useOrgId.ts
import { useAuth } from "./AuthContext";

/**
 * Single source of truth for the current org id. Backed by AuthContext, which
 * treats GET /org as authoritative (see spec 46 WS2). Never resolves from a
 * persisted tenant. Returns null until auth resolves.
 */
export function useOrgId(): string | null {
  return useAuth().orgId;
}
```

Add to `frontend/src/shared/auth/index.ts`:

```ts
export { useOrgId } from "./useOrgId";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/shared/auth/__tests__/useOrgId.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify + commit**

Run: `cd frontend && npm run typecheck && npx prettier --check "src/shared/auth/useOrgId.ts"`

```bash
git add frontend/src/shared/auth/useOrgId.ts frontend/src/shared/auth/index.ts frontend/src/shared/auth/__tests__/useOrgId.test.tsx
git commit -m "feat(fe): add useOrgId() single org resolver"
```

---

### Task 3: WS1 — Rewire org-resolution sites to `useOrgId()`

Replace tenant-first resolution in the three read surfaces and the JWT arg. After this task, no product resolution path reads `selectedTenant`.

**Files:**
- Modify: `features/market-research/components/lead-stream/LeadsTable.tsx` (import line 73; `selectedTenant` line 376; resolution lines 377, 400, 411, 582)
- Modify: `features/customers/components/lead-stream/LeadStream.tsx` (import 32; `selectedTenant` 44; resolution 47)
- Modify: `features/signals/pages/SignalsPage.tsx` (import 43; `selectedTenant` 50; resolution 58)
- Modify: `shared/auth/useAuthToken.ts` (import 6; `selectedTenant` 10; use 20)
- Test: extend the existing `LeadsTable` / `LeadStream` / `SignalsPage` test files.

**Interfaces:**
- Consumes: `useOrgId()` (Task 2).
- Produces: these surfaces resolve `org_id` solely from `useOrgId()`.

- [ ] **Step 1: Write the failing regression test (LeadsTable — the reported bug)**

Add to the existing `LeadsTable` test file (`features/market-research/components/lead-stream/__tests__/…`):

```tsx
it("resolves org from auth, ignoring any stale selectedTenant localStorage", async () => {
  localStorage.setItem("selectedTenant_u1", JSON.stringify({ id: "brewra", name: "Brewra" }));
  // useOrgId (mocked) returns the real org; assert the leads query uses it, not "brewra".
  // ...render LeadsTable with useOrgId mocked to "b75ce29e"...
  await waitFor(() =>
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ org_id: "b75ce29e" })),
  );
  expect(fetchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ org_id: "brewra" }));
});
```

(Mirror the file's existing render harness and fetch-spy pattern; mock `@/shared/auth`'s `useOrgId` to return `"b75ce29e"`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/market-research/components/lead-stream`
Expected: FAIL — resolves `"brewra"` from the stale tenant.

- [ ] **Step 3: Rewire LeadsTable**

- Remove `import { useTenant } from "@/shared/tenant";` (line 73); add `import { useOrgId } from "@/shared/auth";` (co-locate with the existing `useAuthToken` import).
- Replace `const { selectedTenant } = useTenant();` (376) with `const orgId = useOrgId();`.
- Line 377: `const leadMapOrgId = orgId ?? "";`
- Lines 400-411 (the `useMemo` building `ctx`): source org from `orgId` instead of `selectedTenant?.id ?? authOrgId`. Since `useOrgId()` is already authoritative (WS2 folds in the `GET /org` fetch), drop the `fetchOrgId` fallback branch and the `localStorage.getItem("org_id_…")` fallback; the memo becomes `if (!userId || !orgId) return null; return { userId, orgId };` with deps `[currentUser?.uid, orgId]`.
- Line 582: `const hasOrgContext = Boolean(orgId);`

- [ ] **Step 4: Rewire LeadStream, SignalsPage, useAuthToken**

- `LeadStream.tsx`: drop `useTenant` import; `const orgId = orgIdProp ?? useOrgId();` (replace line 47's `orgIdProp ?? selectedTenant?.id ?? authOrgId ?? null`).
- `SignalsPage.tsx`: drop `useTenant` import; `const orgId = useOrgId();` (replace line 58).
- `useAuthToken.ts`: drop `useTenant` import; replace `selectedTenant.id` (line 20) with the resolved org — `const orgId = useOrgId();` then `jwtManager.generateToken(firebaseAuth.currentUser, orgId ?? "")`. (Token is not backend-validated; kept consistent.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/market-research/components/lead-stream src/features/customers/components/lead-stream src/features/signals`
Expected: PASS.

- [ ] **Step 6: Verify + commit**

Run: `cd frontend && npm run verify && npx prettier --check "src/features/**/lead-stream/*.tsx" "src/features/signals/pages/SignalsPage.tsx" "src/shared/auth/useAuthToken.ts"`

```bash
git add frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx frontend/src/features/customers/components/lead-stream/LeadStream.tsx frontend/src/features/signals/pages/SignalsPage.tsx frontend/src/shared/auth/useAuthToken.ts frontend/src/features/**/__tests__
git commit -m "refactor(fe): resolve org via useOrgId in lead-stream/signals/token (kills tenant-first bug)"
```

---

### Task 4: WS1 — Rewire tenant display/lifecycle consumers

Header/ProfileDialog display the org name; Sidebar clears tenant on logout; useLogin sets tenant on login. Repoint display to `useAuth()` and drop the lifecycle calls.

**Files:**
- Modify: `features/shell/components/Header.tsx` (import 35; `selectedTenant` 54)
- Modify: `features/shell/components/ProfileDialog.tsx` (import 3; `selectedTenant` 14)
- Modify: `features/shell/components/Sidebar.tsx` (import 339; `clearTenant` 360)
- Modify: `features/auth/hooks/useLogin.ts` (import 5; `selectTenant` 12)
- Test: extend existing Header/ProfileDialog tests (assert `orgName ?? orgId` display + fallback).

**Interfaces:**
- Consumes: `useAuth()` (`orgName`, `orgId`, `logout`).
- Produces: no consumer of `@/shared/tenant` remains in `features/shell` or `features/auth`.

- [ ] **Step 1: Write the failing test (display fallback)**

```tsx
// Header test — org name with fallback to id
it("shows orgName, falling back to orgId when name is absent", () => {
  // mock useAuth -> { orgName: null, orgId: "org-xyz", ... }
  // render Header; assert "org-xyz" is shown where the workspace label renders
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/shell/components`
Expected: FAIL (still reads `selectedTenant`).

- [ ] **Step 3: Rewire display + lifecycle**

- `Header.tsx` / `ProfileDialog.tsx`: replace `const { selectedTenant } = useTenant();` with `const { orgName, orgId } = useAuth();`; replace displayed `selectedTenant?.name` (and any `selectedTenant?.id`) with `orgName ?? orgId ?? ""`. Remove the `useTenant` import (add `useAuth` if not present).
- `Sidebar.tsx`: remove `const { clearTenant } = useTenant();` and its call in the logout handler — `useAuth().logout()` already clears org state and its `org_*` cache keys. Remove the `useTenant` import.
- `useLogin.ts`: remove `const { selectTenant } = useTenant();` and the post-login `selectTenant(...)` call. Remove the `useTenant` import. Org now resolves from `GET /org` via `AuthContext`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/shell src/features/auth`
Expected: PASS.

- [ ] **Step 5: Verify + commit**

Run: `cd frontend && npm run verify && npx prettier --check "src/features/shell/components/Header.tsx" "src/features/shell/components/ProfileDialog.tsx" "src/features/shell/components/Sidebar.tsx" "src/features/auth/hooks/useLogin.ts"`

```bash
git add frontend/src/features/shell/components/Header.tsx frontend/src/features/shell/components/ProfileDialog.tsx frontend/src/features/shell/components/Sidebar.tsx frontend/src/features/auth/hooks/useLogin.ts frontend/src/features/shell/components/__tests__
git commit -m "refactor(fe): display org from auth, drop tenant lifecycle calls"
```

---

### Task 5: WS1 — Auth-only ProtectedRoute; drop `requireTenant`; unwrap TenantProvider; remove tenant route

Remove the hardcoded `{id:"brewra"}` auto-select and the tenant gate — the systemic origin of the bug — and stop mounting the tenant provider/route.

**Files:**
- Modify: `features/shell/ProtectedRoute.tsx` (remove tenant import + auto-select effect 18-26 + `tenantLoading` + `requireTenant` gate 43-49 + the prop)
- Modify: the 11 route files passing `requireTenant`: `features/{scout,market-research,signals,customers,mission-control,strategist,settings,calendar,reports,insights,artifacts}/routes.tsx`
- Modify: `App.tsx` (remove `TenantProvider` import + wrapper)
- Modify: `app/routes.tsx` (or the `featureRoutes` aggregator) — remove the tenant route entry
- Test: `features/shell/__tests__/ProtectedRoute.test.tsx` — assert authed user renders children with no tenant involved; unauthed redirects to `/login`.

**Interfaces:**
- Consumes: `useAuth()` only.
- Produces: `ProtectedRoute` signature becomes `{ children }` (no `requireTenant`).

- [ ] **Step 1: Write the failing test**

```tsx
// ProtectedRoute.test.tsx
it("renders children for an authed user without touching tenant", () => {
  // mock useAuth -> { currentUser: {uid:"u1"}, loading:false }
  // render <ProtectedRoute><div>ok</div></ProtectedRoute> inside a MemoryRouter
  expect(screen.getByText("ok")).toBeInTheDocument();
  expect(localStorage.getItem("selectedTenant_u1")).toBeNull(); // no auto-select
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/shell/__tests__/ProtectedRoute.test.tsx`
Expected: FAIL — `useTenant must be used within a TenantProvider` (or auto-select writes the key).

- [ ] **Step 3: Simplify ProtectedRoute**

```tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/shared/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
```

- [ ] **Step 4: Drop `requireTenant` from all 11 route files**

In each of the 11 `features/*/routes.tsx`, change `<ProtectedRoute requireTenant>` → `<ProtectedRoute>`. Grep to confirm none remain: `grep -rn "requireTenant" frontend/src` → only removed.

- [ ] **Step 5: Unwrap TenantProvider + remove tenant route**

- `App.tsx`: remove `import { TenantProvider } from "@/shared/tenant";` and the `<TenantProvider>…</TenantProvider>` wrapper (keep children).
- `app/routes.tsx` (or wherever `featureRoutes` is assembled): remove the tenant-selection route contribution (the entry from `features/tenant/routes.tsx`).

- [ ] **Step 6: Run tests + typecheck to verify**

Run: `cd frontend && npx vitest run src/features/shell/__tests__/ProtectedRoute.test.tsx && npm run typecheck`
Expected: PASS. (Typecheck still green: `shared/tenant` deletion happens in Task 6; here it's merely unreferenced except by the soon-deleted `features/tenant`.)

- [ ] **Step 7: Verify + commit**

Run: `cd frontend && npx prettier --check "src/features/shell/ProtectedRoute.tsx" "src/App.tsx" "src/app/routes.tsx" "src/features/*/routes.tsx"`

```bash
git add frontend/src/features/shell/ProtectedRoute.tsx frontend/src/App.tsx frontend/src/app/routes.tsx frontend/src/features/*/routes.tsx frontend/src/features/shell/__tests__/ProtectedRoute.test.tsx
git commit -m "refactor(fe): auth-only ProtectedRoute, drop requireTenant + tenant route/provider"
```

---

### Task 6: WS1 — Delete tenant modules + one-time localStorage sweep

Remove the now-orphaned `shared/tenant` and `features/tenant`, and sweep stale `selectedTenant_*` keys so no dead state lingers. This is the task that makes the collapse complete (success criterion #2).

**Files:**
- Delete: `frontend/src/shared/tenant/` (TenantContext.tsx, index.ts), `frontend/src/features/tenant/` (whole dir incl. tests)
- Create: `frontend/src/app/clearStaleTenantKeys.ts` + `frontend/src/app/__tests__/clearStaleTenantKeys.test.ts`
- Modify: `frontend/src/main.tsx` (call the sweep once at startup)
- Modify: any barrel that re-exported `features/tenant` (e.g. an `app/routes` import) — already handled in Task 5; confirm nothing imports the deleted dirs.

**Interfaces:**
- Consumes: nothing (pure `localStorage` sweep).
- Produces: `clearStaleTenantKeys(): void`.

- [ ] **Step 1: Write the failing test**

```ts
// clearStaleTenantKeys.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { clearStaleTenantKeys } from "../clearStaleTenantKeys";

describe("clearStaleTenantKeys", () => {
  beforeEach(() => localStorage.clear());

  it("removes selectedTenant_* keys and retains org_* keys", () => {
    localStorage.setItem("selectedTenant_u1", '{"id":"brewra"}');
    localStorage.setItem("selectedTenant_u2", '{"id":"x"}');
    localStorage.setItem("org_id_u1", "b75ce29e");
    localStorage.setItem("org_name_u1", "Brewra AI");
    clearStaleTenantKeys();
    expect(localStorage.getItem("selectedTenant_u1")).toBeNull();
    expect(localStorage.getItem("selectedTenant_u2")).toBeNull();
    expect(localStorage.getItem("org_id_u1")).toBe("b75ce29e");
    expect(localStorage.getItem("org_name_u1")).toBe("Brewra AI");
  });

  it("is idempotent (no throw when nothing matches)", () => {
    expect(() => clearStaleTenantKeys()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/app/__tests__/clearStaleTenantKeys.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the sweep**

```ts
// frontend/src/app/clearStaleTenantKeys.ts
/**
 * One-time cleanup of the retired tenant abstraction (spec 46 WS1). Removes any
 * `selectedTenant_*` localStorage keys left by the old TenantProvider; the
 * `org_id_*` / `org_name_*` auth-cache keys are retained. This module is the
 * only place the `selectedTenant` literal survives (success criterion #2).
 */
export function clearStaleTenantKeys(): void {
  const prefix = "selectedTenant_";
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) doomed.push(key);
  }
  // also the legacy non-suffixed key the old clearTenant() used
  doomed.push("selectedTenant");
  doomed.forEach((k) => localStorage.removeItem(k));
}
```

Call it once at startup in `main.tsx` (before `createRoot(...).render(...)`):

```ts
import { clearStaleTenantKeys } from "@/app/clearStaleTenantKeys";
clearStaleTenantKeys();
```

- [ ] **Step 4: Delete the tenant modules**

```bash
git rm -r frontend/src/shared/tenant frontend/src/features/tenant
```

- [ ] **Step 5: Run tests + typecheck + knip to verify nothing references the deleted dirs**

Run: `cd frontend && npx vitest run src/app/__tests__/clearStaleTenantKeys.test.ts && npm run typecheck`
Expected: PASS, no unresolved imports. Grep gate: `grep -rn "shared/tenant\|features/tenant\|useTenant\b" frontend/src` → only `clearStaleTenantKeys.ts` may contain the `selectedTenant` literal; no `useTenant`.

- [ ] **Step 6: Verify + commit**

Run: `cd frontend && npm run verify && npx prettier --check "src/app/clearStaleTenantKeys.ts" "src/main.tsx"`

```bash
git add frontend/src/app/clearStaleTenantKeys.ts frontend/src/app/__tests__/clearStaleTenantKeys.test.ts frontend/src/main.tsx
git commit -m "refactor(fe): delete tenant module + sweep stale selectedTenant keys (retires TD-FE-55)"
```

---

### Task 7: WS4 — Harden `connect_user_to_org` (bijective 1:1)

Enforce the invariant: reverse-uniqueness, no silent re-key (behind a service-only `migrate` flag), and UUID-shape validation. `POST /connect_org` keeps its strict default (no `migrate` field).

**Files:**
- Modify: `backend/app/services/org_auth/orgs.py` (`connect_user_to_org` ~113)
- Test: `backend/tests/unit/test_org_auth.py`

**Interfaces:**
- Consumes: `ValidationError`, `ConflictError` from `app.core.exceptions` (mapped to 400 / 409 in `app/main.py`).
- Produces: `connect_user_to_org(mongo, user_id, org_id, migrate: bool = False) -> Dict`. Router (`org_auth.py:24`) calls it with the default (`migrate=False`); WS3 calls it with `migrate=True`.

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/unit/test_org_auth.py` (follow the file's existing fake-mongo fixture pattern):

```python
import pytest
from app.core.exceptions import ConflictError, ValidationError
from app.services.org_auth import orgs as org_svc

VALID_ORG = "b75ce29e-344c-4e6c-964e-5ac236d0b49a"

def _mongo_with(users_map, org_list):
    # returns a fake mongo whose Org_Management.users / .orgs docs reflect the args
    ...

def test_connect_new_user_to_valid_org_succeeds():
    mongo = _mongo_with({}, [VALID_ORG])
    out = org_svc.connect_user_to_org(mongo, "newuid", VALID_ORG)
    assert out["org_id"] == VALID_ORG

def test_connect_rejects_non_uuid_org():
    mongo = _mongo_with({}, [VALID_ORG])
    with pytest.raises(ValidationError):
        org_svc.connect_user_to_org(mongo, "newuid", "A5BfxUidAsOrg")

def test_connect_rejects_org_not_in_org_list():
    mongo = _mongo_with({}, [VALID_ORG])
    with pytest.raises(ValidationError):
        org_svc.connect_user_to_org(mongo, "newuid", "11111111-1111-1111-1111-111111111111")

def test_connect_rejects_org_owned_by_another_user():
    mongo = _mongo_with({"other": VALID_ORG}, [VALID_ORG])
    with pytest.raises(ConflictError):
        org_svc.connect_user_to_org(mongo, "newuid", VALID_ORG)

def test_connect_rejects_silent_rekey_without_migrate():
    other = "22222222-2222-2222-2222-222222222222"
    mongo = _mongo_with({"u1": VALID_ORG}, [VALID_ORG, other])
    with pytest.raises(ConflictError):
        org_svc.connect_user_to_org(mongo, "u1", other)  # already mapped elsewhere

def test_connect_allows_rekey_with_migrate():
    other = "22222222-2222-2222-2222-222222222222"
    mongo = _mongo_with({"u1": VALID_ORG}, [VALID_ORG, other])
    out = org_svc.connect_user_to_org(mongo, "u1", other, migrate=True)
    assert out["org_id"] == other

def test_connect_idempotent_same_mapping():
    mongo = _mongo_with({"u1": VALID_ORG}, [VALID_ORG])
    out = org_svc.connect_user_to_org(mongo, "u1", VALID_ORG)  # unchanged
    assert out["org_id"] == VALID_ORG
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && .venv/bin/python -m pytest tests/unit/test_org_auth.py -q`
Expected: FAIL — no validation/rejection yet (all connects currently succeed).

- [ ] **Step 3: Implement the hardening**

Rewrite `connect_user_to_org`:

```python
import uuid

def _is_valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def connect_user_to_org(mongo, user_id: str, org_id: str, migrate: bool = False) -> Dict:
    """Connect a user to an org, enforcing the bijective 1:1 invariant.

    - org_id must be a UUID present in orgs.org_list.
    - reverse-uniqueness: the org must not already belong to a different user.
    - no silent re-key: if the user is already mapped to a different org,
      require migrate=True (service-internal; not exposed on POST /connect_org).
    """
    db = mongo["Org_Management"]
    users_collection = db["users"]
    orgs_collection = db["orgs"]

    # shape + membership validation
    if not _is_valid_uuid(org_id):
        raise ValidationError(f"org_id is not a valid UUID: {org_id!r}")
    orgs_doc = orgs_collection.find_one({"_id": "orgs"}) or {}
    if org_id not in orgs_doc.get("org_list", []):
        raise ValidationError(f"org_id not found in org_list: {org_id!r}")

    users_doc = users_collection.find_one({"_id": "users"})
    user_mappings = (users_doc or {}).get("user_mappings", {})

    # reverse-uniqueness: org owned by another user
    for mapped_user, mapped_org in user_mappings.items():
        if mapped_org == org_id and mapped_user != user_id:
            raise ConflictError(
                f"org {org_id} is already owned by another user"
            )

    # no silent re-key
    existing = user_mappings.get(user_id)
    if existing and existing != org_id and not migrate:
        raise ConflictError(
            f"user {user_id} is already mapped to {existing}; pass migrate=True to re-key"
        )

    user_mappings[user_id] = org_id
    if users_doc:
        users_collection.update_one(
            {"_id": "users"},
            {"$set": {"user_mappings": user_mappings, "updated_at": datetime.now(timezone.utc)}},
        )
    else:
        users_collection.insert_one(
            {"_id": "users", "user_mappings": {user_id: org_id},
             "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}
        )

    return {"status": "success",
            "message": f"User {user_id} connected to org {org_id}",
            "user_id": user_id, "org_id": org_id}
```

Add `from app.core.exceptions import ConflictError, ValidationError` (alongside the existing `OrgNotFoundError, UsersDocumentNotFoundError` import).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/unit/test_org_auth.py -q`
Expected: PASS (all).

- [ ] **Step 5: Confirm no router change needed**

`POST /connect_org` (`app/routers/org_auth.py:24`) still passes only `user_id` + `org_id`; `migrate` defaults `False`. Run the router test: `cd backend && .venv/bin/python -m pytest tests/test_auth_org.py -q` → PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/org_auth/orgs.py backend/tests/unit/test_org_auth.py
git commit -m "feat(be): enforce bijective 1:1 user<->org in connect_user_to_org"
```

---

### Task 8: WS3 — Reconciliation script `--report` (read-only)

A Render-run script that classifies every user's non-canonical org data and prints a migration plan, writing nothing. The plan-building logic is a pure function so it's unit-testable without live DBs.

**Files:**
- Create: `backend/scripts/reconcile_orgs.py`
- Test: `backend/tests/unit/test_reconcile_orgs.py`

**Interfaces:**
- Produces: `build_report(user_mappings: dict, org_list: list[str], data_orgs_by_user: dict[str, dict[str, int]]) -> ReconcileReport` where `data_orgs_by_user[user_id][org_id] = record_count`. `ReconcileReport` has `.migrations` (user → {from_org: count}), `.ambiguous` (list of `(user_id, reason)`), and `.render() -> str`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_reconcile_orgs.py
from backend.scripts.reconcile_orgs import build_report

VALID = "b75ce29e-344c-4e6c-964e-5ac236d0b49a"

def test_flags_noncanonical_data_for_migration():
    r = build_report(
        user_mappings={"A5Bfx": VALID},
        org_list=[VALID],
        data_orgs_by_user={"A5Bfx": {VALID: 396, "A5Bfx": 197, "brewra": 3}},
    )
    assert r.migrations["A5Bfx"] == {"A5Bfx": 197, "brewra": 3}  # canonical VALID excluded
    assert not r.ambiguous

def test_flags_user_whose_mapping_is_noncanonical_as_ambiguous():
    r = build_report(
        user_mappings={"u2": "u2"},            # mapping itself is a uid, not a UUID
        org_list=[VALID],
        data_orgs_by_user={"u2": {"u2": 10}},
    )
    assert ("u2", ) == tuple(a[0] for a in r.ambiguous)  # surfaced, not auto-migrated
    assert "u2" not in r.migrations

def test_clean_user_yields_no_migration():
    r = build_report({"u3": VALID}, [VALID], {"u3": {VALID: 5}})
    assert "u3" not in r.migrations
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/unit/test_reconcile_orgs.py -q`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `build_report` + a read-only `--report` main**

```python
# backend/scripts/reconcile_orgs.py
"""Read-only-by-default org reconciliation (spec 46 WS3). Run on Render.

  python backend/scripts/reconcile_orgs.py --report        # default, no writes
  python backend/scripts/reconcile_orgs.py --apply         # destructive (Task 9)
"""
from __future__ import annotations
import argparse
import uuid
from dataclasses import dataclass, field


def _is_uuid(v: str) -> bool:
    try:
        uuid.UUID(str(v)); return True
    except (ValueError, AttributeError, TypeError):
        return False


@dataclass
class ReconcileReport:
    migrations: dict[str, dict[str, int]] = field(default_factory=dict)  # user -> {from_org: count}
    ambiguous: list[tuple[str, str]] = field(default_factory=list)       # (user_id, reason)

    def render(self) -> str:
        lines = ["== Org reconciliation report =="]
        for user, froms in self.migrations.items():
            for org, n in froms.items():
                lines.append(f"  MIGRATE user={user}  {org} -> canonical  ({n} records)")
        for user, reason in self.ambiguous:
            lines.append(f"  AMBIGUOUS user={user}: {reason}")
        if not self.migrations and not self.ambiguous:
            lines.append("  (nothing to reconcile)")
        return "\n".join(lines)


def build_report(user_mappings, org_list, data_orgs_by_user) -> ReconcileReport:
    report = ReconcileReport()
    for user_id, canonical in user_mappings.items():
        # a user whose own mapping is non-canonical is decided by a human, not auto-migrated
        if not _is_uuid(canonical) or canonical not in org_list:
            report.ambiguous.append((user_id, f"mapping points to non-canonical org {canonical!r}"))
            continue
        strays = {
            org: count
            for org, count in data_orgs_by_user.get(user_id, {}).items()
            if org != canonical and count > 0
        }
        if strays:
            report.migrations[user_id] = strays
    return report


def _load_inputs(mongo, neo4j_driver):
    """Read user_mappings, org_list, and per-user data-org counts across stores. Read-only."""
    db = mongo["Org_Management"]
    user_mappings = (db["users"].find_one({"_id": "users"}) or {}).get("user_mappings", {})
    org_list = (db["orgs"].find_one({"_id": "orgs"}) or {}).get("org_list", [])
    # data_orgs_by_user: per user, count of records under each org_id, across Neo4j + Mongo (+ Pinecone).
    # Neo4j example (leads): MATCH (l:Lead) WHERE l.user_id=$uid RETURN l.org_id, count(*)
    data_orgs_by_user = _scan_data_orgs(mongo, neo4j_driver, user_mappings)
    return user_mappings, org_list, data_orgs_by_user


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="perform writes (default: report only)")
    args = ap.parse_args()
    from app.core.clients import build_clients  # lazy: only when run on Render
    clients = build_clients()
    user_mappings, org_list, data = _load_inputs(clients.mongo, clients.neo4j)
    report = build_report(user_mappings, org_list, data)
    print(report.render())
    if args.apply:
        apply_report(report, clients)   # Task 9
    else:
        print("\n(dry-run; re-run with --apply to migrate)")
```

`_scan_data_orgs` and `apply_report` are thin I/O; `_scan_data_orgs` is stubbed here (implemented alongside apply in Task 9) — for Task 8 it may return `{}` so `--report` runs, but the unit-tested contract is `build_report`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/unit/test_reconcile_orgs.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/reconcile_orgs.py backend/tests/unit/test_reconcile_orgs.py
git commit -m "feat(be): org reconciliation --report (read-only, dry-run)"
```

---

### Task 9: WS3 — Reconciliation script `--apply` (idempotent re-point)

Re-point each reviewed user's stray data onto their canonical org across Neo4j, Mongo, and Pinecone. Idempotent per user; logged.

**Files:**
- Modify: `backend/scripts/reconcile_orgs.py` (add `_scan_data_orgs`, `apply_report`, per-store repoint fns)
- Test: `backend/tests/unit/test_reconcile_orgs.py` (add apply-logic tests with mocked clients)

**Interfaces:**
- Consumes: `ReconcileReport` (Task 8); client handles (`mongo`, `neo4j` driver, `pinecone` index).
- Produces: `apply_report(report, clients) -> None`; `repoint_neo4j(driver, user_id, from_org, to_org) -> int`, `repoint_mongo(mongo, user_id, from_org, to_org) -> int`, `repoint_pinecone(index, from_ns, to_ns) -> int`.

- [ ] **Step 1: Write the failing tests (mocked clients)**

```python
def test_repoint_neo4j_issues_setter_cypher_scoped_to_user_and_org():
    calls = []
    class FakeSession:
        def run(self, q, **p): calls.append((q, p)); return type("R", (), {"single": lambda s: {"n": 3}})()
        def __enter__(self): return self
        def __exit__(self, *a): return False
    class FakeDriver:
        def session(self): return FakeSession()
    from backend.scripts.reconcile_orgs import repoint_neo4j
    n = repoint_neo4j(FakeDriver(), "A5Bfx", "brewra", "b75ce29e")
    assert n == 3
    q, p = calls[0]
    assert "SET" in q and "org_id" in q
    assert p == {"uid": "A5Bfx", "from_org": "brewra", "to_org": "b75ce29e"}

def test_repoint_mongo_updates_all_matching_docs():
    class FakeColl:
        def __init__(self): self.updated = None
        def update_many(self, flt, upd): self.updated = (flt, upd); return type("R", (), {"modified_count": 7})()
    # ... assert update_many filter {user_id, org_id: from_org} -> $set org_id: to_org, modified_count 7

def test_apply_is_idempotent_second_run_moves_zero():
    # given a report whose strays are already re-pointed, apply moves 0 (re-run safe)
    ...
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && .venv/bin/python -m pytest tests/unit/test_reconcile_orgs.py -q`
Expected: FAIL — repoint fns not defined.

- [ ] **Step 3: Implement the per-store repoint + apply**

```python
def repoint_neo4j(driver, user_id: str, from_org: str, to_org: str) -> int:
    cypher = (
        "MATCH (n) WHERE n.user_id = $uid AND n.org_id = $from_org "
        "SET n.org_id = $to_org RETURN count(n) AS n"
    )
    with driver.session() as s:
        rec = s.run(cypher, uid=user_id, from_org=from_org, to_org=to_org).single()
        return int(rec["n"]) if rec else 0


def repoint_mongo(mongo, user_id: str, from_org: str, to_org: str) -> int:
    total = 0
    # collections that partition by org_id (Scout_Agent + Profiler); enumerate explicitly
    for dbname, coll in _MONGO_ORG_COLLECTIONS:
        res = mongo[dbname][coll].update_many(
            {"user_id": user_id, "org_id": from_org},
            {"$set": {"org_id": to_org}},
        )
        total += res.modified_count
    return total


def repoint_pinecone(index, from_ns: str, to_ns: str) -> int:
    # Namespaces can't be renamed: copy vectors by id (upsert-by-id is idempotent), then delete source.
    moved = 0
    for ids in _iter_vector_ids(index, from_ns):          # page through the source namespace
        fetched = index.fetch(ids=ids, namespace=from_ns).vectors
        index.upsert(vectors=list(fetched.values()), namespace=to_ns)
        moved += len(fetched)
    if moved:
        index.delete(delete_all=True, namespace=from_ns)
    return moved


def apply_report(report, clients) -> None:
    for user_id, strays in report.migrations.items():
        canonical = _canonical_for(clients.mongo, user_id)   # user_mappings[user_id], re-read
        for from_org in list(strays):
            n4 = repoint_neo4j(clients.neo4j, user_id, from_org, canonical)
            nm = repoint_mongo(clients.mongo, user_id, from_org, canonical)
            npc = repoint_pinecone(clients.pinecone, from_org, canonical)
            print(f"APPLIED user={user_id} {from_org}->{canonical}: neo4j={n4} mongo={nm} pinecone={npc}")
```

Idempotency: `SET n.org_id` / `$set org_id` on rows already at `to_org` match nothing on re-run (the filter is `org_id = from_org`); Pinecone upsert-by-id overwrites in place. `_MONGO_ORG_COLLECTIONS`, `_iter_vector_ids`, `_canonical_for` are concrete module constants/helpers (enumerate the report's store list from the spec: market reports, lead scores, signals, file-processing status, customer profiles).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/unit/test_reconcile_orgs.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/reconcile_orgs.py backend/tests/unit/test_reconcile_orgs.py
git commit -m "feat(be): org reconciliation --apply (idempotent re-point across neo4j/mongo/pinecone)"
```

---

## Final verification (before merge)

- [ ] Frontend full gate: `cd frontend && npm run preflight` → green (typecheck, lint, format, vitest, build, knip, e2e/VR).
- [ ] Backend suite: `cd backend && .venv/bin/python -m pytest tests/unit/test_org_auth.py tests/unit/test_reconcile_orgs.py tests/test_auth_org.py -q` → green.
- [ ] Grep completeness (success criterion #2): `grep -rn "useTenant\b\|shared/tenant\|features/tenant" frontend/src` → none; `grep -rn "selectedTenant" frontend/src` → only `clearStaleTenantKeys.ts` + its test.
- [ ] `grep -rn "requireTenant" frontend/src` → none.
- [ ] Update `docs/TECH_DEBT.md`: mark TD-FE-55 resolved (tenant-selection + mock deleted).
- [ ] Rollout per the sequence above (report → FE fix deploy → apply → enable WS4 enforcement).

## Self-review notes

- **Spec coverage:** WS1 → Tasks 2-6; WS2 → Task 1; WS3 → Tasks 8-9; WS4 → Task 7. Success criteria #1 (stale tenant ignored) → Task 3 test; #2 (grep) → Task 6 + final grep; #3 (re-key propagation) → Task 1 test; #4 (reconcile) → Tasks 8-9; #5 (connect hardening) → Task 7; #6 (green gates) → Final verification.
- **Type consistency:** `useOrgId(): string | null` used identically in Tasks 2-3; `connect_user_to_org(mongo, user_id, org_id, migrate=False)` defined in Task 7 and referenced by WS3's `--apply` (Task 9) via `_canonical_for`/`connect_user_to_org(migrate=True)` for mapping changes; `build_report` / `ReconcileReport` signatures match between Tasks 8 and 9.
- **Out of scope (separate spec):** 100→500 Find-Matched-Leads cap + admin Settings page. **Deferred:** tightening the permissive `OrgResponse` model (FE `orgName ?? orgId` fallback covers it).
