# Org Null-Safety + Profiler/ICP Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the `orgId || "brewra"` / `?? "org-123"` placeholder-tenant fallbacks and the unguarded org-resolution race, and fix three adjacent Profiler/ICP data-integrity defects, so org-scoped UI never renders or writes against a null/placeholder org and deleted/absent ICPs behave correctly.

**Architecture:** Frontend-heavy. WS1 rebuilds org resolution in `AuthContext` into an explicit three-state machine (`orgStatus`) and gates the heavy org-scoped routes on a resolved-with-org outcome, then removes every placeholder-tenant literal and guards the transitive lead-upload write. WS2/WS4 are localized React-Query/handler fixes. WS3 is the one cross-stack change: a backend content-signature dismissed-set for recommended ICPs plus a small FE reject-flow fix.

**Tech Stack:** React 18 + Vite + TypeScript + TanStack Query + Firebase auth (frontend, `vitest` + Testing Library + MSW); FastAPI + PyMongo (backend, `pytest` + `pytest-mock` + `MagicMock` Mongo doubles). Design spec: `specs/48-org-null-safety-profiler-integrity-design.md`.

## Global Constraints

- **Business state:** MVP, 0 live users. No feature flags, no compat shims, no data migration. Aggressive changes are fine (`CLAUDE.md` "Business State").
- **Monorepo tooling:** run FE commands from `frontend/`, BE from `backend/`. There is no root `package.json`.
- **FE per-task gate:** `npm run verify` (typecheck + lint + `test:changed`) + `npx prettier --check` on touched files, run from `frontend/`. Full `npm run preflight` only at the merge gate.
- **BE test gate:** `pytest` from `backend/`, **patch-where-used** (`backend/TESTING.md`). Never run the root-level live-probe `backend/test_*.py`.
- **Vitest is `globals: false`** — every test file imports `{ describe, it, expect, vi, beforeEach, afterEach }` from `"vitest"` explicitly. MSW is wired in `src/test/setup.ts` with `onUnhandledRequest: "error"` — any un-mocked network call fails the test.
- **Cross-feature imports go through a feature's `index.ts` barrel only** (enforced by `import-x` lint). Do not deep-import across `src/features/*` or from `features/*` into `shared/*`.
- **Placeholder-org policy (this plan's core decision):** replace `orgId || "brewra"` with `orgId ?? ""` (not raw nullable `orgId`), per spec WS1(b) ("`?? ""` is fine — an empty string makes the query defer"). Empty string keeps the `string` type (no ripple through hook signatures), is falsy so `enabled: !!orgId` read-guards defer, and is caught by the write-guards in Tasks 4–5. The **route gate (Task 2) is the primary correctness mechanism**; `?? ""` + read-defer + write-guards are defense-in-depth.
- **Commit style:** `type(scope):` subjects (`feat(fe):`, `fix(fe):`, `feat(be):`), one commit per task/logical step, no `[N/M]` suffixes. Commit only — **do not push** (push auto-deploys via `render.yaml`); the human runs the merge gate.
- **Branch:** all tasks land on one short-lived branch off `master` (e.g. `48-org-null-safety`), merged `--no-ff` after green `npm run preflight`.
- **Line numbers are pre-edit hints, not addresses.** Every `file:line` in this plan is relative to `master` at plan-time. A task that reworks a block shifts every later line in that file — most notably **Task 7's `loadProfilerPagePayload` rewrite changes the block length, so Task 7's own Step 4/Step 5 line refs and *all* of Task 11's `SuggestedICPCards.tsx` line refs (run after Task 7) are stale.** Always re-locate an edit point by its **named symbol / quoted content anchor** (each step gives one), then verify the surrounding lines match before editing — never trust the raw line number after a prior same-file edit.
- **Failure handling:** on any unrecoverable task failure (a step that cannot be made to pass after root-causing), STOP — leave the branch as-is and report to the human. Do not skip the task, attempt a partial merge, or force a re-run.

---

## File Structure

**New files**
- `frontend/src/features/shell/OrgResolutionStates.tsx` — three tiny presentational states (resolving skeleton / reconnecting / no-org) used by `ProtectedRoute` when `requireOrg`.
- `frontend/src/shared/auth/__tests__/AuthContext.orgResolution.test.tsx` — WS1(a) resolution-state-machine tests.
- `backend/app/services/icp/dismissal.py` — pure signature + dismissed-set helpers for WS3.
- `backend/tests/unit/test_icp_dismissal.py` — WS3 signature/dedup unit tests.

**Modified files** (exact edit points cited per task)
- `frontend/src/shared/auth/AuthContext.tsx` (T1) — full rewrite of the resolution layer.
- `frontend/src/features/shell/ProtectedRoute.tsx` (T2) — add `requireOrg`.
- `frontend/src/features/{mission-control,customers,market-research}/routes.tsx` (T2) — pass `requireOrg`.
- 11 files carrying the 22 `|| "brewra"` literals (T3), 3 chat-write files + `ProfileDialog.tsx` (T4).
- `frontend/src/features/mission-control/components/data-sources/{useLeadStream.ts,DataSourcesManager.tsx,DataSourceUploader.tsx}` (T5).
- `frontend/src/features/customers/components/lead-stream/LeadStream.tsx` (T6).
- `frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx` (T7, T11).
- `frontend/src/features/mission-control/components/icp/ICPManager.tsx` (T8).
- `backend/app/services/icp/persistence.py` (T10).
- `frontend/src/shared/company-profile/useCompanyProfile.ts` (T12).
- `frontend/src/features/mission-control/components/company-profile/{companyProfileMapping.ts,CompanyProfileForm.tsx}` (T13).

---

## WS1 — Eliminate org-fallback literals + gate on resolved org (fixes #2, #4)

### Task 1: AuthContext — explicit three-state org resolution

**Files:**
- Modify: `frontend/src/shared/auth/AuthContext.tsx` (full resolution-layer rewrite)
- Test: `frontend/src/shared/auth/__tests__/AuthContext.orgResolution.test.tsx` (new)

**Interfaces:**
- Produces (consumed by Task 2 and any org-scoped surface): the `useAuth()` value gains `orgStatus: OrgStatus` (`"pending" | "resolved" | "no-org" | "transient"`), `orgResolved: boolean` (= `orgStatus === "resolved" || orgStatus === "no-org"`), and `retryOrgResolution: () => void`. `orgId` stays `string | null`. `fetchOrgId(userId)` keeps its `Promise<{ orgId; orgName }>` signature (still awaited by `useLogin`).
- Consumes: `buildApiUrl("org")` from `@/shared/api/transport`; `auth` from `./firebase`; `onAuthStateChanged` etc. from `firebase/auth`. localStorage cache keys `org_id_<uid>` / `org_name_<uid>` (unchanged).

Resolution outcomes (spec WS1a):
1. **resolved** — `GET /org` 2xx with `org_id`, or a warm cache surviving a transient failure.
2. **no-org** — authoritative 404 or 2xx-without-org (the onboarding gap).
3. **transient** — timeout / 5xx / network, and **no** usable cached org. A warm cached org does NOT fall to (3) — it stays `resolved` and retries in the background (round-3 F1).
Bounded auto-retry (3 attempts, linear backoff, 9s per-attempt timeout) converts a hang into (3); after the ceiling, `orgStatus` stays `transient` with a manual `retryOrgResolution()` affordance (round-3 F2). A late resolution for a superseded user is discarded via a monotonic generation ref (round-3 F2 stale-async guard).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/shared/auth/__tests__/AuthContext.orgResolution.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let authCb: (u: unknown) => void = () => {};
vi.mock("../firebase", () => ({ auth: { currentUser: null } }));
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
  const { orgId, orgStatus, orgResolved } = useAuth();
  return <div>{`status:${orgStatus} org:${orgId ?? "none"} resolved:${String(orgResolved)}`}</div>;
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe("AuthContext org resolution state machine", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("resolves with org on a 2xx GET /org (no cache)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "success", org_id: "real-org", org_name: "Real" }),
      }),
    );
    renderProbe();
    authCb({ uid: "u1" });
    await waitFor(() =>
      expect(screen.getByText("status:resolved org:real-org resolved:true")).toBeInTheDocument(),
    );
  });

  it("routes an authoritative 404 (no cache) to the no-org outcome", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "not found" }),
    );
    renderProbe();
    authCb({ uid: "u1" });
    await waitFor(() =>
      expect(screen.getByText("status:no-org org:none resolved:true")).toBeInTheDocument(),
    );
  });

  it("routes a persistent network failure (no cache) to the transient outcome", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    renderProbe();
    authCb({ uid: "u1" });
    await waitFor(
      () => expect(screen.getByText("status:transient org:none resolved:false")).toBeInTheDocument(),
      { timeout: 4000 },
    );
  });

  it("keeps a warm cached org mounted through a transient failure (no teardown)", async () => {
    localStorage.setItem("org_id_u1", "cached-org");
    localStorage.setItem("org_name_u1", "Cached");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: "cold" }));
    renderProbe();
    authCb({ uid: "u1" });
    await waitFor(
      () => expect(screen.getByText("status:resolved org:cached-org resolved:true")).toBeInTheDocument(),
      { timeout: 4000 },
    );
  });

  it("discards a resolution for a superseded user (generation guard)", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const uid = new URL(url, "http://x").searchParams.get("user_id");
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ status: "success", org_id: `org-${uid}`, org_name: uid }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderProbe();
    authCb({ uid: "u1" });
    authCb({ uid: "u2" });
    await waitFor(() => expect(screen.getByText(/org:org-u2/)).toBeInTheDocument());
    expect(screen.queryByText(/org:org-u1/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/shared/auth/__tests__/AuthContext.orgResolution.test.tsx`
Expected: FAIL — `orgStatus` / `orgResolved` are `undefined` on the context value; the no-org / transient / cached assertions do not match.

- [ ] **Step 3: Rewrite the resolution layer of `AuthContext.tsx`**

Replace the whole file with the version below. It preserves `login`/`signup`/`logout`/`fetchOrgId` and the `{!loading && children}` render gate, and adds the three-state machine, bounded retry, timeout, generation guard, and cache-survives-transient rule.

```tsx
import type { User } from "firebase/auth";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import type { ReactNode } from "react";
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

import { auth } from "./firebase";

import { buildApiUrl } from "@/shared/api/transport";

/**
 * Org-resolution outcome (spec 48 WS1a). `pending` is the pre-resolution state;
 * `resolved` = has an org (real GET /org success OR a warm cache surviving a
 * transient blip); `no-org` = authoritative 404 / 2xx-without-org (onboarding
 * gap); `transient` = timeout/5xx/network with NO usable cache (reconnecting).
 * The route gate (ProtectedRoute requireOrg) mounts org-scoped UI ONLY on the
 * has-org predicate `orgResolved && orgId` — never on `orgResolved` alone.
 */
export type OrgStatus = "pending" | "resolved" | "no-org" | "transient";

const GET_ORG_TIMEOUT_MS = 9000; // per-attempt hard ceiling (a cold Render free instance can exceed 8s)
const GET_ORG_MAX_ATTEMPTS = 3; // bounded auto-retry; after this, sit in `transient` with a manual retry
const GET_ORG_RETRY_BASE_MS = 400; // linear backoff base: 400ms, 800ms between attempts

interface AuthContextType {
  currentUser: User | null;
  orgId: string | null;
  orgName: string | null;
  orgStatus: OrgStatus;
  orgResolved: boolean;
  retryOrgResolution: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchOrgId: (userId: string) => Promise<{ orgId: string | null; orgName: string | null }>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

type OrgOutcome =
  | { kind: "org"; orgId: string; orgName: string | null }
  | { kind: "no-org" }
  | { kind: "transient" };

/** One GET /org attempt, bounded by an AbortController timeout. Never throws. */
async function attemptGetOrg(userId: string): Promise<OrgOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GET_ORG_TIMEOUT_MS);
  try {
    const response = await fetch(`${buildApiUrl("org")}?user_id=${userId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    if (response.status === 404) return { kind: "no-org" };
    if (!response.ok) return { kind: "transient" }; // 5xx / other non-2xx
    const data = await response.json();
    if (data.status === "success" && data.org_id) {
      return { kind: "org", orgId: data.org_id, orgName: data.org_name || null };
    }
    return { kind: "no-org" }; // 2xx but no usable org → authoritative onboarding gap
  } catch {
    return { kind: "transient" }; // network error or timeout (abort)
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgStatus, setOrgStatus] = useState<OrgStatus>("pending");
  const [loading, setLoading] = useState(true);
  // Bumped on every user change / logout so a late-arriving resolution for a
  // superseded user is discarded instead of mutating state for the wrong user
  // (spec 48 WS1a stale-async guard).
  const orgGenerationRef = useRef(0);

  const signup = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    orgGenerationRef.current += 1; // invalidate any in-flight resolution
    await signOut(auth);
    setOrgId(null);
    setOrgName(null);
    setOrgStatus("pending");
    if (currentUser?.uid) {
      localStorage.removeItem(`org_id_${currentUser.uid}`);
      localStorage.removeItem(`org_name_${currentUser.uid}`);
    }
  };

  const resolveOrg = useCallback(
    async (userId: string): Promise<{ orgId: string | null; orgName: string | null }> => {
      const generation = orgGenerationRef.current;
      const isStale = () => orgGenerationRef.current !== generation;

      // Optimistic cache: a warm cached org paints instantly AND survives a
      // transient confirm-failure (spec 48 WS1a round-3 F1).
      const cachedOrgId = localStorage.getItem(`org_id_${userId}`);
      const cachedOrgName = localStorage.getItem(`org_name_${userId}`);
      const haveCache = Boolean(cachedOrgId);
      if (haveCache) {
        setOrgId(cachedOrgId);
        setOrgName(cachedOrgName);
        setOrgStatus("resolved"); // provisional resolved on the cached org
      } else {
        setOrgStatus("pending");
      }

      for (let attempt = 1; attempt <= GET_ORG_MAX_ATTEMPTS; attempt++) {
        const outcome = await attemptGetOrg(userId);
        if (isStale()) return { orgId: cachedOrgId, orgName: cachedOrgName };

        if (outcome.kind === "org") {
          setOrgId(outcome.orgId);
          setOrgName(outcome.orgName);
          setOrgStatus("resolved");
          localStorage.setItem(`org_id_${userId}`, outcome.orgId);
          if (outcome.orgName) localStorage.setItem(`org_name_${userId}`, outcome.orgName);
          else localStorage.removeItem(`org_name_${userId}`);
          return { orgId: outcome.orgId, orgName: outcome.orgName };
        }

        if (outcome.kind === "no-org") {
          // Authoritative: a real 404 / 2xx-without-org overrides any cache.
          setOrgId(null);
          setOrgName(null);
          setOrgStatus("no-org");
          localStorage.removeItem(`org_id_${userId}`);
          localStorage.removeItem(`org_name_${userId}`);
          return { orgId: null, orgName: null };
        }

        // transient: keep a warm cache mounted (no teardown); otherwise show
        // the reconnecting state while we retry.
        if (!haveCache) setOrgStatus("transient");
        if (attempt < GET_ORG_MAX_ATTEMPTS) {
          await sleep(GET_ORG_RETRY_BASE_MS * attempt);
          if (isStale()) return { orgId: cachedOrgId, orgName: cachedOrgName };
        }
      }

      // Auto-retry ceiling reached, still transient.
      if (haveCache) {
        setOrgStatus("resolved"); // warm cache survives; do not tear down
        return { orgId: cachedOrgId, orgName: cachedOrgName };
      }
      setOrgStatus("transient"); // reconnecting / manual retry
      return { orgId: null, orgName: null };
    },
    [],
  );

  // Back-compat alias: useLogin awaits this after form login.
  const fetchOrgId = resolveOrg;

  const retryOrgResolution = useCallback(() => {
    const user = auth.currentUser;
    if (user?.uid) void resolveOrg(user.uid);
  }, [resolveOrg]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      orgGenerationRef.current += 1; // supersede any in-flight resolution
      setCurrentUser(user);
      if (user?.uid) {
        setOrgStatus("pending");
        void resolveOrg(user.uid);
      } else {
        setOrgId(null);
        setOrgName(null);
        setOrgStatus("pending");
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [resolveOrg]);

  const orgResolved = orgStatus === "resolved" || orgStatus === "no-org";

  const value = {
    currentUser,
    orgId,
    orgName,
    orgStatus,
    orgResolved,
    retryOrgResolution,
    login,
    signup,
    logout,
    fetchOrgId,
    loading,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
```

- [ ] **Step 4: Run the new tests + the existing AuthContext test to verify they pass**

Run: `cd frontend && npx vitest run src/shared/auth/__tests__/`
Expected: PASS — the new `AuthContext.orgResolution.test.tsx` and the pre-existing `AuthContext.orgAuthoritative.test.tsx` (stale→fresh still wins; cache kept on failure) both green.

- [ ] **Step 5: Typecheck + lint + commit**

Run: `cd frontend && npm run typecheck && npm run lint && npx prettier --write src/shared/auth/AuthContext.tsx src/shared/auth/__tests__/AuthContext.orgResolution.test.tsx`

```bash
git add frontend/src/shared/auth/AuthContext.tsx frontend/src/shared/auth/__tests__/AuthContext.orgResolution.test.tsx
git commit -m "feat(fe): model org resolution as an explicit three-state machine"
```

---

### Task 2: Org-scoped route gate — `ProtectedRoute requireOrg` + resolution states

**Files:**
- Create: `frontend/src/features/shell/OrgResolutionStates.tsx`
- Modify: `frontend/src/features/shell/ProtectedRoute.tsx`
- Modify: `frontend/src/features/mission-control/routes.tsx`, `frontend/src/features/customers/routes.tsx`, `frontend/src/features/market-research/routes.tsx`
- Test: `frontend/src/features/shell/__tests__/ProtectedRoute.test.tsx` (extend)

**Interfaces:**
- Consumes: `useAuth()` `{ currentUser, loading, orgStatus, retryOrgResolution }` (Task 1).
- Produces: `<ProtectedRoute requireOrg>` mounts children only on the has-org outcome (`orgStatus === "resolved"`); `pending` → skeleton, `transient` → reconnecting UI with a retry button, `no-org` → "contact your admin". Non-org routes keep `<ProtectedRoute>` (auth-only) unchanged. `admin`, `settings`, `scout`, `strategist`, `calendar`, `insights`, `reports`, `artifacts` are deliberately NOT org-gated (admin must work with no org to create/map orgs).

- [ ] **Step 1: Write the failing tests (extend `ProtectedRoute.test.tsx`)**

Add these cases to `frontend/src/features/shell/__tests__/ProtectedRoute.test.tsx`. The file's `authState` hoisted mock (already present) needs two new fields; update its initializer and `afterEach` reset, then add the `requireOrg` describe block:

```tsx
// update the existing hoisted mock initializer:
const authState = vi.hoisted(() => ({
  currentUser: null as { uid: string } | null,
  loading: false,
  orgStatus: "resolved" as "pending" | "resolved" | "no-org" | "transient",
  retryOrgResolution: vi.fn(),
}));
// update afterEach to also reset:
//   authState.orgStatus = "resolved";

describe("ProtectedRoute requireOrg gate", () => {
  function renderOrgGated(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/mission-control"
            element={
              <ProtectedRoute requireOrg>
                <div>org content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("renders children on the has-org (resolved) outcome", () => {
    authState.currentUser = { uid: "u1" };
    authState.orgStatus = "resolved";
    renderOrgGated("/mission-control");
    expect(screen.getByText("org content")).toBeInTheDocument();
  });

  it("shows the no-org state (not org content) on the authoritative no-org outcome", () => {
    authState.currentUser = { uid: "u1" };
    authState.orgStatus = "no-org";
    renderOrgGated("/mission-control");
    expect(screen.queryByText("org content")).not.toBeInTheDocument();
    expect(screen.getByText(/isn't set up yet/i)).toBeInTheDocument();
  });

  it("shows the reconnecting state (not org content, not no-org) on a transient outcome", () => {
    authState.currentUser = { uid: "u1" };
    authState.orgStatus = "transient";
    renderOrgGated("/mission-control");
    expect(screen.queryByText("org content")).not.toBeInTheDocument();
    expect(screen.queryByText(/isn't set up yet/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("does NOT gate a plain ProtectedRoute (no requireOrg) on org status", () => {
    authState.currentUser = { uid: "u1" };
    authState.orgStatus = "no-org";
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <div>settings content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("settings content")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/shell/__tests__/ProtectedRoute.test.tsx`
Expected: FAIL — `ProtectedRoute` ignores `requireOrg`; the no-org / reconnecting text and the has-org gating do not exist.

- [ ] **Step 3: Create `OrgResolutionStates.tsx`**

Create `frontend/src/features/shell/OrgResolutionStates.tsx`:

```tsx
import { Button } from "@/components/ui/button";

/** Shell-level shown while org resolution is still pending (spec 48 WS1a). */
export function OrgResolving() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

/**
 * Transient (timeout/5xx/network, no usable cache). A mapped user on a cold or
 * flaky backend — NOT an unprovisioned user — so never the "contact admin" copy
 * (spec 48 WS1f). Bounded auto-retry has stopped; offer a manual retry.
 */
export function OrgReconnecting({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
      <h2 className="text-lg font-semibold">Having trouble reaching your workspace</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        We couldn&apos;t confirm your workspace. This is usually temporary.
      </p>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}

/** Authoritative no-org (real 404 / 2xx-without-org — the onboarding gap). */
export function NoOrgState() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-6">
      <h2 className="text-lg font-semibold">Your workspace isn&apos;t set up yet</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Your account isn&apos;t linked to a workspace. Please contact your admin.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Add `requireOrg` to `ProtectedRoute.tsx`**

Replace the file body with:

```tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { NoOrgState, OrgReconnecting, OrgResolving } from "./OrgResolutionStates";

import { useAuth } from "@/shared/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Org-scoped surfaces: mount children ONLY on the has-org outcome. */
  requireOrg?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireOrg = false }) => {
  const { currentUser, loading: authLoading, orgStatus, retryOrgResolution } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return <OrgResolving />;
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireOrg) {
    // Gate on the HAS-ORG predicate, never on `orgResolved` alone (which is also
    // true for the no-org outcome) — spec 48 WS1a round-3 F3.
    if (orgStatus === "pending") return <OrgResolving />;
    if (orgStatus === "transient") return <OrgReconnecting onRetry={retryOrgResolution} />;
    if (orgStatus === "no-org") return <NoOrgState />;
    // orgStatus === "resolved" → fall through to children
  }

  return <>{children}</>;
};

export default ProtectedRoute;
```

- [ ] **Step 5: Wire `requireOrg` into the three heavy org-scoped route trees**

In each file below, add the `requireOrg` prop to the `<ProtectedRoute>` that wraps the page. Exact edits:

`frontend/src/features/mission-control/routes.tsx` — change `<ProtectedRoute>` (wrapping `<MissionControlPage />`) to `<ProtectedRoute requireOrg>`.

`frontend/src/features/customers/routes.tsx` — change `<ProtectedRoute>` (wrapping `<CustomersPage />`) to `<ProtectedRoute requireOrg>`.

`frontend/src/features/market-research/routes.tsx` — change the `<ProtectedRoute>` wrapping `<MarketResearchPage />` (the `scout-tab` route) to `<ProtectedRoute requireOrg>`. Leave the two `<Navigate>` redirect routes unchanged.

- [ ] **Step 6: Run tests + typecheck + lint**

Run: `cd frontend && npx vitest run src/features/shell/__tests__/ && npm run typecheck && npm run lint`
Expected: PASS. (The `routes.smoke.test.tsx` mock returns `orgId: "org-xyz"` but no `orgStatus`; add `orgStatus: "resolved"` to that mock's `useAuth` return so `requireOrg` routes still mount — update `frontend/src/features/shell/__tests__/routes.smoke.test.tsx` accordingly, then re-run.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/shell/OrgResolutionStates.tsx frontend/src/features/shell/ProtectedRoute.tsx frontend/src/features/shell/__tests__/ frontend/src/features/{mission-control,customers,market-research}/routes.tsx
git commit -m "feat(fe): gate org-scoped routes on the has-org resolution outcome"
```

---

### Task 3: Remove every `orgId || "brewra"` literal (replace with `orgId ?? ""`)

**Files (22 sites across 11 files):**
- Modify: `frontend/src/features/settings/components/CompanyProfile.tsx:53`
- Modify: `frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx:301,310,311,313,348,382,443,525,705`
- Modify: `frontend/src/features/mission-control/components/data-sources/DataSourcesManager.tsx:31,103,168`
- Modify: `frontend/src/features/mission-control/components/icp/ICPManager.tsx:48`
- Modify: `frontend/src/features/mission-control/components/company-profile/CompanyProfileForm.tsx:52`
- Modify: `frontend/src/features/mission-control/pages/MissionControlPage.tsx:55`
- Modify: `frontend/src/features/market-research/hooks/useMarketResearchData.ts:335`
- Modify: `frontend/src/features/market-research/components/intelligence/{regulatory-compliance/RegulatoryComplianceSection.tsx:55, market-entry/MarketEntrySection.tsx:83, market-size/MarketSizeSection.tsx:97, industry-trends/IndustryTrendsSection.tsx:91, competitor-landscape/CompetitorLandscapeSection.tsx:75}`

**Interfaces:** No signature changes. Every `const orgIdToUse = orgId || "brewra"` becomes `const orgIdToUse = orgId ?? ""`; the two other forms are `SuggestedICPCards.tsx:301,310,311,313,705` (inline `orgId || "brewra"` arguments) → `orgId ?? ""`. Consuming read hooks already gate `enabled: … && !!orgId` (verified: `useICPs`, `useCustomerProfile`, `useDataSources`, and Task 12 adds it to `useCompanyProfile`), so `""` defers. Write paths are guarded in Tasks 4–5.

- [ ] **Step 1: Replace the literal at all 22 sites**

The change is uniform: `|| "brewra"` → `?? ""` (and drop the `// Fallback to 'brewra' …` comment). For the `const orgIdToUse = orgId || "brewra";` sites, the result is `const orgIdToUse = orgId ?? "";`. For the five inline `SuggestedICPCards.tsx` argument sites (`:301,:310,:311,:313`, `:705`), replace the `orgId || "brewra"` token in place with `orgId ?? ""`. Apply to every file/line listed above.

- [ ] **Step 2: Verify the sweep is complete via grep**

Run: `cd frontend && grep -rn 'orgId || "brewra"\|orgId||"brewra"\|"brewra"' src --include=*.ts --include=*.tsx | grep -v __tests__`
Expected: **only** `src/features/shell/components/ProfileDialog.tsx` remains (its `"brewra.com"` cosmetic literal — handled in Task 4). Zero `orgId || "brewra"` hits. If any other hit remains, fix it before proceeding.

- [ ] **Step 3: Typecheck + lint**

Run: `cd frontend && npm run typecheck && npm run lint`
Expected: PASS — `orgId ?? ""` is `string`, so no consumer-signature ripple.

- [ ] **Step 4: Run the affected existing tests**

Run: `cd frontend && npx vitest run src/features/mission-control src/features/customers src/features/market-research src/features/settings`
Expected: PASS. Note `DataSourcesManager.test.tsx` / `SuggestedICPCards.*.test.tsx` mock `useAuth` with a concrete `orgId` (`"brewra"`/`"org1"`), so `?? ""` is a no-op there and they stay green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "fix(fe): replace orgId || \"brewra\" placeholder-tenant fallback with ?? \"\" (defers)"
```

---

### Task 4: Guard placeholder-org chat writes + ProfileDialog cosmetic literal

**Files:**
- Modify: `frontend/src/shared/chat/ContextChat.tsx:97,176`
- Modify: `frontend/src/features/market-research/components/scout-chat/ScoutChatPanel.tsx:259`
- Modify: `frontend/src/features/shell/components/ProfileDialog.tsx:18`
- Test: `frontend/src/shared/chat/__tests__/ContextChat.test.tsx` (create if absent) or extend existing chat test

**Interfaces:** The three `org_id: orgId ?? "org-123"` write bodies must not POST a placeholder when `orgId` is null. Guard the caller: bail early with a toast when `!orgId`, and send the real `orgId` otherwise.

- [ ] **Step 1: Write a failing test for the ContextChat guard**

Create `frontend/src/shared/chat/__tests__/ContextChat.orgGuard.test.tsx` (mirror the MSW/QueryClient house pattern; mock `@/shared/auth` with `orgId: null`). Assert that submitting a prompt while `orgId` is null does **not** fire `POST` to the ask endpoint (MSW `onUnhandledRequest: "error"` will fail the test if a request escapes; assert via a spy handler that it was never called). Because the exact ask endpoint + submit affordance are component-specific, capture calls with:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContextChat } from "../ContextChat"; // adjust to the real export
import { server } from "@/test/msw/server";

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ orgId: null, currentUser: { uid: "u1" } }),
  useOrgId: () => null,
}));

function wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => vi.restoreAllMocks());

describe("ContextChat org guard", () => {
  it("does not POST an ask when orgId is null", async () => {
    const asked = vi.fn();
    // Register a catch handler; if it fires, the guard failed.
    server.use(
      http.post(/\/signal_ask.*/, () => {
        asked();
        return HttpResponse.json({});
      }),
    );
    render(<ContextChat context={{ prompt: "hi" }} />, { wrapper: wrap }); // adjust props to the real API
    // Trigger whatever submits the ask (button / Enter). Adjust selector to the component.
    const submit = screen.queryByRole("button", { name: /send|ask/i });
    if (submit) fireEvent.click(submit);
    expect(asked).not.toHaveBeenCalled();
  });
});
```

> Implementer note: adjust the import path, props, endpoint regex, and submit selector to `ContextChat`'s actual API when you read the file. The assertion (no POST when `orgId` null) is the invariant.

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/shared/chat/__tests__/ContextChat.orgGuard.test.tsx`
Expected: FAIL — the ask currently POSTs `org_id: "org-123"`.

- [ ] **Step 3: Add the guards**

`ContextChat.tsx` — at both call sites (`:95` block and `:175` block), add before `askMutation.mutateAsync({...})`:

```tsx
if (!orgId) return; // never POST a placeholder tenant (spec 48 WS1b)
```
and change `org_id: orgId ?? "org-123"` → `org_id: orgId` at `:97` and `:176`.

`ScoutChatPanel.tsx` — before building `requestOptions` (around `:251`), add:

```tsx
if (!orgId) {
  // never POST a placeholder tenant (spec 48 WS1b)
  return;
}
```
and change `org_id: orgId ?? "org-123"` → `org_id: orgId` at `:259`.

`ProfileDialog.tsx:18` (cosmetic) — change:

```tsx
const organizationDomain = orgId ? `${orgId}.com` : "";
```
Then read `frontend/src/features/shell/components/__tests__/ProfileDialog.test.tsx:41` — it asserts `"brewra.com"`. Update that assertion to match the mock's `orgId` (e.g. if the mock provides `orgId: "org-xyz"`, assert `"org-xyz.com"`; if it provides no org, assert the domain link is absent/empty). Keep the change cosmetic-only.

- [ ] **Step 4: Run tests + typecheck + lint + commit**

Run: `cd frontend && npx vitest run src/shared/chat src/features/shell && npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add frontend/src/shared/chat frontend/src/features/market-research/components/scout-chat/ScoutChatPanel.tsx frontend/src/features/shell/components/ProfileDialog.tsx frontend/src/features/shell/components/__tests__/ProfileDialog.test.tsx
git commit -m "fix(fe): guard chat org_id writes against null; drop org-123/brewra.com placeholders"
```

---

### Task 5: Lead-upload transitive null-org guard

**Files:**
- Modify: `frontend/src/features/mission-control/components/data-sources/useLeadStream.ts` (options type `:103-108`; `uploadCsvBatch` `:323`; `deleteLeadsByFile` `:196`)
- Modify: `frontend/src/features/mission-control/components/data-sources/DataSourcesManager.tsx:242` (pass an `orgReady` flag) and `:31`
- Modify: `frontend/src/features/mission-control/components/data-sources/DataSourceUploader.tsx:98` (disable when org not ready)
- Test: `frontend/src/features/mission-control/components/data-sources/__tests__/useLeadStream.orgGuard.test.tsx` (new)

**Interfaces:**
- `UseLeadStreamOptions.orgIdToUse` becomes `string` still (fed `orgId ?? ""` from `DataSourcesManager` after Task 3), and `uploadCsvBatch` / `deleteLeadsByFile` refuse to fire when `!orgIdToUse`. This closes the #2 data-split write vector transitively (spec WS1d) — removing the literal alone would only shift the write from `"brewra"` to `""`.
- `DataSourceUploader` gains an optional `disabled?: boolean`; the "Add leads" button is disabled when the org isn't ready.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/mission-control/components/data-sources/__tests__/useLeadStream.orgGuard.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLeadStream } from "../useLeadStream";

// Mock the hook's only react-query dependency so no QueryClient/network is
// needed (its initial-load effect calls refetch(), which fires even when the
// query is disabled).
vi.mock("../../../hooks/useLeadStreamStatus", () => ({
  useLeadStreamStatus: () => ({
    data: [],
    isLoading: false,
    refetch: vi.fn().mockResolvedValue({ data: [] }),
  }),
}));
// Bypass CSV validation/type-sniff so the flow reaches the org guard (not a
// validation early-return). Provide every named export the hook imports.
vi.mock("../csvHelpers", () => ({
  validateCsvFormat: vi.fn().mockResolvedValue({ valid: true }),
  getLeadImportKind: () => "csv",
  sniffExcelBinarySignature: vi.fn().mockResolvedValue(false),
  normalizeCsv: (s: string) => s,
  parseErrorMessage: (s: string) => s,
}));

const toast = vi.fn();
const getAuthHeader = vi.fn().mockResolvedValue("");

afterEach(() => vi.restoreAllMocks());

describe("useLeadStream upload guard", () => {
  it("refuses to POST a batch upload when the org is unresolved (empty orgIdToUse)", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const { result } = renderHook(() =>
      useLeadStream({ currentUser: { uid: "u1" } as never, orgIdToUse: "", getAuthHeader, toast }),
    );
    act(() =>
      result.current.setSelectedLeadFile(new File(["a,b\n1,2"], "leads.csv", { type: "text/csv" })),
    );
    await act(async () => {
      await result.current.handleUploadLeadCsv();
    });
    // No batch-upload POST fired; a destructive toast explained why (the org guard).
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("leads/batch-upload"))).toBe(
      false,
    );
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/features/mission-control/components/data-sources/__tests__/useLeadStream.orgGuard.test.tsx`
Expected: FAIL — `uploadCsvBatch` currently only guards `!userId`, so it proceeds to POST with `org_id: ""`.

- [ ] **Step 3: Add the null-org guard in `useLeadStream.ts` (the lead-upload chain)**

In `uploadCsvBatch` (right after `const leadOrgId = orgIdToUse;` at `:325`), add:

```ts
if (!leadOrgId) {
  // Refuse to write leads under a null/placeholder org — the #2 data-split
  // vector, reached transitively via DataSourcesManager's coalesced prop
  // (spec 48 WS1d).
  throw new Error("Your workspace is still loading. Please try again in a moment.");
}
```

In `deleteLeadsByFile` (after `const leadOrgId = orgIdToUse;` at `:196`), add the same `if (!leadOrgId) throw new Error("Your workspace is still loading. Please try again in a moment.");` guard.

`handleUploadLeadCsv` already wraps `uploadCsvBatch` in try/catch and toasts `parseErrorMessage(error.message)` with `variant: "destructive"` — so the thrown guard surfaces as a destructive toast (satisfying the test). No change needed there.

- [ ] **Step 3b: Guard the sibling document/PDF upload writes in `DataSourcesManager.tsx`**

WS1(d) also names the direct org-scoped uploads in the same file. After Task 3 the local coalesces at `:103` / `:168` are `orgId ?? ""`, so `uploadFileToBackend` and `uploadUrlToBackend` would `formData.append("org_id", "")` (`:111` / `:177`) when unresolved. In each function, right after `const orgIdToUse = orgId ?? "";`, add:

```ts
if (!orgIdToUse) {
  // Never write a document under a null/placeholder org (spec 48 WS1d).
  throw new Error("Your workspace is still loading. Please try again in a moment.");
}
```

Both functions already `throw new Error("User not authenticated")` on a missing uid and throw on a non-2xx response, so their existing caller error-handling surfaces this the same way.

- [ ] **Step 4: Disable the upload control until the org is ready**

`DataSourceUploader.tsx` — add an optional prop and apply it to the submit button (`:98`):

```tsx
// props interface: add `disabled?: boolean;`
<Button onClick={onUpload} disabled={disabled || !selectedLeadFile || isUploadingLeads}>
```

`DataSourcesManager.tsx` — the component is only mounted under the `requireOrg` gate (Task 2), so `orgId` is non-null here in the normal flow; the disable is defense-in-depth for a mid-session user change. Pass `disabled={!orgId}` to `<DataSourceUploader … />` (around `:1583`). (`orgId` is already destructured at `:30`.)

- [ ] **Step 5: Run tests + typecheck + lint + commit**

Run: `cd frontend && npx vitest run src/features/mission-control/components/data-sources && npm run typecheck && npm run lint`
Expected: PASS (existing `DataSourcesManager.test.tsx` mocks `orgId: "brewra"`, so the uploader isn't disabled there).

```bash
git add frontend/src/features/mission-control/components/data-sources
git commit -m "fix(fe): refuse lead upload/delete until org is resolved (transitive null-org guard)"
```

---

### Task 6: LeadStream — distinguish "org resolving / loading" from "genuinely zero leads"

**Files:**
- Modify: `frontend/src/features/customers/components/lead-stream/LeadStream.tsx:74` (the empty-state guard)
- Test: `frontend/src/features/customers/components/lead-stream/__tests__/LeadStream.test.tsx` (extend)

**Interfaces:** `useLeads(orgId)` is `enabled: !!orgId`; a disabled query has `isLoading === false` and `fetchStatus === "idle"` with `data === undefined`. The empty card must not show while the query is deferred/loading — only on a genuine `total === 0` result.

- [ ] **Step 1: Write the failing test (extend `LeadStream.test.tsx`)**

Add a case that mounts `LeadStreamPanel` with `orgId` null (mock `useOrgId` / `useAuth` to return null) and asserts the empty "No prospect data yet" card is **not** shown (a deferred query must not read as "zero leads"):

```tsx
it("does not show the empty card while org is unresolved (deferred query)", async () => {
  // Local override of the module mock for this test:
  vi.doMock("@/shared/auth", () => ({ useOrgId: () => null }));
  vi.doMock("@/shared/auth/AuthContext", () => ({
    useAuth: () => ({ orgId: null, currentUser: { uid: "u1" } }),
  }));
  const { LeadStreamPanel: Panel } = await import("../LeadStream");
  render(<Panel />, { wrapper });
  // The disabled query never resolves; the empty card must not appear.
  expect(screen.queryByText("No prospect data yet")).toBeNull();
});
```

> Implementer note: because this file mocks `@/shared/auth` at module top with `"org1"`, use a separate test file `LeadStream.orgDeferred.test.tsx` with the null mock instead of `vi.doMock` if re-mocking proves awkward — the invariant is: `orgId` null ⇒ no empty card.

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/features/customers/components/lead-stream`
Expected: FAIL — the current guard `!leadsQuery.isLoading && leads.length === 0` is true for a disabled query (isLoading false, leads empty), so the empty card renders.

- [ ] **Step 3: Fix the empty-state guard in `LeadStream.tsx`**

At `:53-57`, `orgId` is already resolved (`orgIdProp ?? hookOrgId`). Change the empty-state condition (`:74`) so the card shows only when the query has actually settled with a real zero result — i.e. an org is present and the query is not fetching:

```tsx
const orgUnresolved = !orgId;
// … existing leads/visibleLeads memos …

if (orgUnresolved || leadsQuery.isLoading || leadsQuery.isFetching) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </CardContent>
    </Card>
  );
}

if (leads.length === 0) {
  return (
    /* the existing "No prospect data yet" empty card, unchanged */
  );
}
```

Keep the existing empty-card JSX; only move it behind the new `leads.length === 0` check that now runs *after* the loading/unresolved guard.

- [ ] **Step 4: Run tests + typecheck + lint + commit**

Run: `cd frontend && npx vitest run src/features/customers/components/lead-stream && npm run typecheck && npm run lint`
Expected: PASS — existing tests (leads render; empty state on `total:0`; expand; load-more) still green because they resolve with `orgId: "org1"`.

```bash
git add frontend/src/features/customers/components/lead-stream
git commit -m "fix(fe): show loading (not the empty card) while LeadStream org/query is unresolved"
```

---

## WS2 — Profiler Current-ICPs: honor empty-vs-error (fixes #3)

### Task 7: `loadProfilerPagePayload` empty-vs-error + refetch cache purge + snapshot reconcile

**Files:**
- Modify: `frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx` (`loadProfilerPagePayload` `:109-138`; `refetchCustomerProfileIcps` empty branch `:353-356`; snapshot short-circuit `:465-472`; import of `removeOrgLocalStorage`)
- Test: `frontend/src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCards.currentIcps.test.tsx` (new)

**Interfaces:**
- Consumes `fetchCustomerProfileIcps(uid, org)` which throws on backend-unavailable and returns `[]` on empty-success (via `fetchIcpsRowsForOrg`, `profileIcpsExtract.ts:127-130` — verified). The loader must gate the stale `customerProfile` cache fallback on **read failure**, not on `icps.length === 0`.
- Uses org-cache helpers `getOrgLocalStorage`, `setOrgLocalStorage` (already imported `:53`) + `removeOrgLocalStorage` (add to that import).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCards.currentIcps.test.tsx` (MSW house pattern; mock `@/shared/auth` `{ currentUser: { uid: "u1" }, orgId: "org1" }`):

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SuggestedICPCards } from "../SuggestedICPCards";
import { getOrgCacheKey } from "@/shared/lib/cacheUtils";
import { server } from "@/test/msw/server";

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

function renderCards() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<SuggestedICPCards refreshTrigger={1} />, { wrapper });
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("SuggestedICPCards Current-ICPs empty-vs-error", () => {
  it("on an empty-success profile read, does NOT re-hydrate stale Current ICPs from cache", async () => {
    // Stale cache from a prior session:
    localStorage.setItem(
      getOrgCacheKey("customerProfile", "org1"),
      JSON.stringify([{ id: "old-1", industry: "Legacy" }]),
    );
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({ icps: [] })), // 2xx empty-success
      http.get("/api/customer_profile", () => HttpResponse.json({ icps: [] })),
      http.get("/api/v2/icp", () => HttpResponse.json({ items: [], total: 0, limit: 500, offset: 0 })),
    );
    renderCards();
    // The stale "Legacy" ICP must not appear (empty-success ⇒ empty table).
    await waitFor(() => expect(screen.queryByText(/Legacy/i)).not.toBeInTheDocument());
  });

  it("on a read FAILURE (5xx), falls back to the cache (keeps last-known Current ICPs)", async () => {
    localStorage.setItem(
      getOrgCacheKey("customerProfile", "org1"),
      JSON.stringify([{ id: "old-1", industry: "CachedIndustry", segment: "Seg" }]),
    );
    server.use(
      http.get("/api/profile/company", () => new HttpResponse(null, { status: 500 })),
      http.get("/api/customer_profile", () => new HttpResponse(null, { status: 500 })),
      http.get("/api/v2/icp", () => HttpResponse.json({ items: [], total: 0, limit: 500, offset: 0 })),
    );
    renderCards();
    await waitFor(() => expect(screen.getByText(/CachedIndustry/i)).toBeInTheDocument());
  });
});
```

> Implementer note: `mapCustomerProfileICPToExisting` renders the mapped fields; adjust the asserted text (`Legacy` / `CachedIndustry`) to whatever the Current-ICPs card surfaces for those rows when you read the mapper. The invariant is empty-success⇒no cache, read-failure⇒cache.

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCards.currentIcps.test.tsx`
Expected: FAIL on the first case — the current gate `if (icps.length === 0)` re-hydrates the stale cache on empty-success.

- [ ] **Step 3: Rework the loader to track `readFailed`**

In `loadProfilerPagePayload`, replace the try/catch + gate (`:109-138`) with:

```tsx
  let icps: ExistingICP[] = [];
  let readFailed = false;
  if (uid) {
    try {
      const rows = await fetchCustomerProfileIcps(uid, orgIdToUse);
      if (rows.length > 0) {
        icps = rows.map((icp: UntypedProfilerIcpRecord, i: number) =>
          mapCustomerProfileICPToExisting(icp, i),
        );
      }
    } catch {
      readFailed = true; // backend unavailable — distinct from empty-success
    }
  }
  if (readFailed) {
    // Resilience cache ONLY on a real read failure — a successful-but-empty read
    // renders an empty Current-ICPs table (spec 48 WS2, empty-vs-error).
    try {
      const customerProfileData = getOrgLocalStorage("customerProfile", orgIdToUse);
      if (customerProfileData) {
        const parsed = JSON.parse(customerProfileData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          icps = parsed.map((icp: UntypedProfilerIcpRecord, i: number) =>
            mapCustomerProfileICPToExisting(icp, i),
          );
        }
      }
    } catch {
      /* ignore */
    }
  }
```

- [ ] **Step 4: Purge the cache on empty-success in `refetchCustomerProfileIcps`**

Add `removeOrgLocalStorage` to the `@/shared/lib/cacheUtils` import at `:53`. In the empty branch (`:353-356`), clear the stale cache:

```tsx
      if (rows.length === 0) {
        setExistingICPs([]);
        try {
          removeOrgLocalStorage("customerProfile", orgIdToUse);
        } catch {
          /* ignore */
        }
        return [];
      }
```

- [ ] **Step 5: Reconcile Current ICPs on the snapshot short-circuit**

In the snapshot short-circuit (`:465-472`), the snapshot's `existingICPs` may be stale. Set it provisionally from the snapshot but reconcile against the authoritative empty-vs-error read:

```tsx
          if (snap && (snapNew.length > 0 || snapRefined.length > 0)) {
            setExistingICPs(snap.existingICPs as ExistingICP[]); // provisional (fast paint)
            setRefinedICPs(snapRefined);
            setNewICPs(snapNew);
            setCardStatuses(snap.cardStatuses as Record<string, ICPCardStatus>);
            setLoading(false);
            // Current ICPs must reflect the authoritative read (deleted-elsewhere
            // must disappear); recommendations still come from the fast snapshot.
            void refetchCustomerProfileIcps(); // empty-success ⇒ [], read-failure ⇒ keep (spec 48 WS2)
            return;
          }
```

(`refetchCustomerProfileIcps` is defined via `useCallback` above and is in scope in the effect.)

- [ ] **Step 6: Run tests + typecheck + lint + commit**

Run: `cd frontend && npx vitest run src/features/customers/components/icp-intelligence && npm run typecheck && npm run lint`
Expected: PASS (existing `SuggestedICPCards.read/write.test.tsx` still green).

```bash
git add frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx frontend/src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCards.currentIcps.test.tsx
git commit -m "fix(fe): honor empty-vs-error for Profiler Current ICPs (no stale re-hydration)"
```

---

### Task 8: ICPManager — clear the org resilience cache on a zero-ICP save

**Files:**
- Modify: `frontend/src/features/mission-control/components/icp/ICPManager.tsx:83-85` (the zero-ICP early return)
- Test: `frontend/src/features/mission-control/components/icp/__tests__/icpManagerCache.test.ts` (new)

**Interfaces:** `removeOrgLocalStorage` is already imported (`:16`, used at `:106`); `orgIdToUse` is at component scope (`:48`, now `orgId ?? ""` after Task 3). When the last ICP is deleted (`icpsToSave.length === 0`), the early return skips the cache clear, leaving a stale `customerProfile` snapshot that WS2's fallback and Mission Control reads can resurrect. The clear is extracted into an exported pure helper `clearCustomerProfileCaches(orgIdToUse: string)` so it is unit-testable without driving the delete/save UI.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/mission-control/components/icp/__tests__/icpManagerCache.test.ts` — a deterministic unit test of the extracted helper:

```ts
import { afterEach, describe, expect, it } from "vitest";

import { getOrgCacheKey } from "@/shared/lib/cacheUtils";

import { clearCustomerProfileCaches } from "../ICPManager";

afterEach(() => localStorage.clear());

describe("clearCustomerProfileCaches (zero-ICP save path)", () => {
  it("removes the org customerProfile + pending resilience caches", () => {
    localStorage.setItem(getOrgCacheKey("customerProfile", "org1"), JSON.stringify([{ id: "x" }]));
    localStorage.setItem(getOrgCacheKey("customerProfile_pending", "org1"), JSON.stringify({ a: 1 }));

    clearCustomerProfileCaches("org1");

    expect(localStorage.getItem(getOrgCacheKey("customerProfile", "org1"))).toBeNull();
    expect(localStorage.getItem(getOrgCacheKey("customerProfile_pending", "org1"))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `cd frontend && npx vitest run src/features/mission-control/components/icp/__tests__/icpManagerCache.test.ts` → FAIL (`clearCustomerProfileCaches` is not exported yet).

- [ ] **Step 3: Extract the helper and call it from the zero-ICP branch (`ICPManager.tsx`)**

Add the exported helper near the top of `ICPManager.tsx` (module scope, after imports):

```tsx
/** Clear the org-scoped customer-profile resilience caches. Exported for the
 *  zero-ICP save path (spec 48 WS2) and unit tests. */
export function clearCustomerProfileCaches(orgIdToUse: string): void {
  try {
    removeOrgLocalStorage("customerProfile", orgIdToUse);
    removeOrgLocalStorage("customerProfile_pending", orgIdToUse);
  } catch {
    /* ignore */
  }
}
```

Then replace the zero-ICP early return (`:83-85`) with:

```tsx
    if (icpsToSave.length === 0) {
      // Deleting the last ICP must purge the org resilience caches so a later
      // empty-success read isn't overridden by a stale customerProfile snapshot
      // (spec 48 WS2 — pairs with SuggestedICPCards' empty-vs-error).
      clearCustomerProfileCaches(orgIdToUse);
      return true;
    }
```

- [ ] **Step 4: Run tests + typecheck + lint + commit**

Run: `cd frontend && npx vitest run src/features/mission-control/components/icp && npm run typecheck && npm run lint`

```bash
git add frontend/src/features/mission-control/components/icp
git commit -m "fix(fe): clear org customerProfile cache when the last ICP is deleted"
```

---

## WS3 — Recommended-ICP dismissal durability (fixes #1; cross-stack)

> WS3's backend (Tasks 9–10) and frontend (Task 11) carry **no HTTP-contract change** — the dismissed-set is stored and applied server-side transparently; the DELETE and GET `/icp` request/response shapes are unchanged. They land on the same branch and merge together (spec Rollout "one atomic change"), each as its own TDD commit.

### Task 9: Backend — ICP content-signature + dismissed-set helpers (pure module)

**Files:**
- Create: `backend/app/services/icp/dismissal.py`
- Test: `backend/tests/unit/test_icp_dismissal.py` (new)

**Interfaces (Produces, consumed by Task 10):**
- `compute_icp_signature(icp: dict) -> str` — canonical `"industry|segment"` from `icp["firmographics"]["industry"]` + `["segment"]`; returns `""` when **both** canonicalize to empty (empty ⇒ no suppression). Canonicalization: lowercase → strip punctuation → collapse whitespace → trim.
- `read_dismissed_signatures(document: dict | None) -> set[str]` — reads the `dismissedRecommendedSignatures` list off an `ICP_config` doc (missing/non-list ⇒ empty set), dropping empties.
- `with_signature_added(existing: set[str], signature: str) -> list[str]` — union helper returning a sorted list to persist (no-op for empty signature).
- `DISMISSED_FIELD = "dismissedRecommendedSignatures"` — the doc field name.

- [ ] **Step 1: Write the failing unit tests**

Create `backend/tests/unit/test_icp_dismissal.py`:

```python
"""Unit tests for app/services/icp/dismissal.py — content-signature dismissed-set."""
from app.services.icp.dismissal import (
    DISMISSED_FIELD,
    compute_icp_signature,
    read_dismissed_signatures,
    with_signature_added,
)


def _icp(industry="", segment=""):
    return {"firmographics": {"industry": industry, "segment": segment}}


def test_signature_canonicalizes_case_whitespace_punctuation():
    a = compute_icp_signature(_icp("Financial   Services!", "Mid-Market"))
    b = compute_icp_signature(_icp("financial services", "mid market"))
    assert a == b == "financial services|mid market"


def test_signature_stable_across_id_regeneration():
    # Same firmographics, different ids → same signature (the point of the fix).
    x = dict(_icp("SaaS", "SMB"), id="uuid-1")
    y = dict(_icp("SaaS", "SMB"), id="uuid-2")
    assert compute_icp_signature(x) == compute_icp_signature(y)


def test_empty_or_missing_firmographics_yields_empty_signature():
    assert compute_icp_signature(_icp("", "")) == ""
    assert compute_icp_signature({}) == ""
    assert compute_icp_signature({"firmographics": None}) == ""


def test_segment_only_still_produces_a_signature():
    assert compute_icp_signature(_icp("", "Enterprise")) == "|enterprise"


def test_read_dismissed_handles_missing_and_bad_shapes():
    assert read_dismissed_signatures(None) == set()
    assert read_dismissed_signatures({}) == set()
    assert read_dismissed_signatures({DISMISSED_FIELD: "nope"}) == set()
    assert read_dismissed_signatures({DISMISSED_FIELD: ["a|b", "", "c|d"]}) == {"a|b", "c|d"}


def test_with_signature_added_unions_and_ignores_empty():
    assert with_signature_added({"a|b"}, "c|d") == ["a|b", "c|d"]
    assert with_signature_added({"a|b"}, "") == ["a|b"]
    assert with_signature_added(set(), "x|y") == ["x|y"]
```

- [ ] **Step 2: Run to verify it fails** — `cd backend && python -m pytest tests/unit/test_icp_dismissal.py -q` → FAIL (module does not exist).

- [ ] **Step 3: Implement `dismissal.py`**

Create `backend/app/services/icp/dismissal.py`:

```python
"""Content-signature dismissed-set for recommended ICPs (spec 48 WS3).

Regeneration re-mints ICP ids (the LLM omits ids; _reserve_unique_icp_id mints a
fresh uuid), so an id-keyed dismissal can't survive a refresh. We instead key on
a canonicalized, lowest-variance content signature. `industry` is ~constant per
company, so `segment` is the effective discriminator — matching is best-effort
(both false-negative re-surface and false-positive over-suppression are accepted
at MVP; see the spec's residual-drift bar). An empty signature is never recorded
and never matched, so firmographics-less ICPs can't collapse onto a degenerate
key that suppresses them all.
"""
import re
from typing import Any, Dict, Optional, Set

DISMISSED_FIELD = "dismissedRecommendedSignatures"


def _canonicalize(value: Any) -> str:
    s = str(value or "").strip().lower()
    s = re.sub(r"[^\w\s]", "", s)   # strip punctuation
    s = re.sub(r"\s+", " ", s).strip()  # collapse internal whitespace
    return s


def compute_icp_signature(icp: Dict[str, Any]) -> str:
    """Canonical 'industry|segment' signature, or '' when both are empty."""
    firmographics = icp.get("firmographics") if isinstance(icp, dict) else None
    if not isinstance(firmographics, dict):
        firmographics = {}
    industry = _canonicalize(firmographics.get("industry"))
    segment = _canonicalize(firmographics.get("segment"))
    if not industry and not segment:
        return ""
    return f"{industry}|{segment}"


def read_dismissed_signatures(document: Optional[Dict[str, Any]]) -> Set[str]:
    if not isinstance(document, dict):
        return set()
    raw = document.get(DISMISSED_FIELD)
    if not isinstance(raw, list):
        return set()
    return {str(s) for s in raw if isinstance(s, str) and s}


def with_signature_added(existing: Set[str], signature: str) -> list:
    """Union `signature` into `existing`; empty signature is a no-op. Sorted for
    deterministic persistence."""
    result = set(existing)
    if signature:
        result.add(signature)
    return sorted(result)
```

- [ ] **Step 4: Run to verify it passes** — `cd backend && python -m pytest tests/unit/test_icp_dismissal.py -q` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/icp/dismissal.py backend/tests/unit/test_icp_dismissal.py
git commit -m "feat(be): add ICP content-signature dismissed-set helpers"
```

---

### Task 10: Backend — record signature on delete, filter regeneration by signature

**Files:**
- Modify: `backend/app/services/icp/persistence.py` — `delete_recommended_icp` (`:260-302`) and `list_icps` refresh path (the `update_one` at `:239`, i.e. the generate branch)
- Test: `backend/tests/unit/test_icp.py` (extend — add signature cases)

**Interfaces:**
- Consumes Task 9's `dismissal` module. `delete_recommended_icp` records the deleted ICP's signature into `document[DISMISSED_FIELD]` (persisted in the same `update_one`). `list_icps(refresh=True)` filters newly generated `suggestedICPs` against the doc's dismissed set (by signature) **before** the whole-doc `update_one`, and preserves `DISMISSED_FIELD` across that write.
- The `ICP_config` doc is keyed by `user_id`; `DISMISSED_FIELD` is a sibling of `icps`, so `{"$set": {"user_id", "icps", "prompt_meta"}}` leaves it intact automatically — the refresh path only needs to filter, not rewrite it. The delete path must add to it explicitly.

- [ ] **Step 1: Write the failing tests (extend `test_icp.py`)**

Add to `backend/tests/unit/test_icp.py` (imports: `from app.services.icp.dismissal import DISMISSED_FIELD, compute_icp_signature`):

```python
# --- WS3: dismissed-signature on delete -------------------------------------

def test_delete_recommended_icp_records_signature(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = {
        "user_id": TEST_USER_ID,
        "icps": {
            "suggestedICPs": [
                {"id": TEST_ICP_ID_1, "firmographics": {"industry": "SaaS", "segment": "SMB"}},
                {"id": TEST_ICP_ID_2, "firmographics": {"industry": "SaaS", "segment": "Enterprise"}},
            ]
        },
    }
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch("app.services.icp.persistence._release_icp_id")

    delete_recommended_icp(mock_mongo_client, TEST_ICP_ID_1, TEST_USER_ID)

    set_arg = coll.update_one.call_args[0][1]["$set"]
    assert "saas|smb" in set_arg[DISMISSED_FIELD]


# --- WS3: refresh filters out dismissed signatures --------------------------

def test_list_icps_refresh_filters_dismissed_signatures(mocker, mock_session, mock_mongo_client):
    coll = MagicMock()
    # Existing doc already dismissed the "saas|smb" signature.
    coll.find_one.return_value = {
        "user_id": TEST_USER_ID,
        "icps": {"suggestedICPs": []},
        DISMISSED_FIELD: ["saas|smb"],
    }
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    mocker.patch("app.services.icp.persistence._ensure_icp_indexes")
    mocker.patch("app.services.icp.persistence._reserve_unique_icp_id", side_effect=lambda db, **k: "new-id")
    mocker.patch("app.services.icp.persistence.fetch_company_profile", return_value={"industry": "SaaS"})
    # ICP_generator returns one dismissed + one fresh ICP.
    mocker.patch(
        "app.services.icp.persistence.ICP_generator",
        return_value=(
            {"suggestedICPs": [
                {"firmographics": {"industry": "SaaS", "segment": "SMB"}},       # dismissed
                {"firmographics": {"industry": "SaaS", "segment": "Enterprise"}}, # kept
            ]},
            {"name": "icp_generator", "version": "1.0.0"},
        ),
    )

    items, total = list_icps(
        mock_session._driver, mock_mongo_client, MagicMock(), TEST_USER_ID, refresh=True,
    )

    sigs = {compute_icp_signature(i) for i in items}
    assert "saas|smb" not in sigs
    assert "saas|enterprise" in sigs
    assert total == len(items)

    # Durability guarantee: the generate-branch write is a partial $set that must
    # NOT touch the sibling DISMISSED_FIELD (else every refresh would wipe prior
    # dismissals). Pin it so a future $set-widening / replace_one is caught here.
    set_arg = coll.update_one.call_args[0][1]["$set"]
    assert DISMISSED_FIELD not in set_arg
```

- [ ] **Step 2: Run to verify they fail** — `cd backend && python -m pytest tests/unit/test_icp.py -q -k "signature or dismissed"` → FAIL (no signature recording / filtering yet).

- [ ] **Step 3: Record the signature in `delete_recommended_icp`**

Add the import at the top of `persistence.py` (with the other `app.services.icp` imports):

```python
from app.services.icp.dismissal import (
    DISMISSED_FIELD,
    compute_icp_signature,
    read_dismissed_signatures,
    with_signature_added,
)
```

In `delete_recommended_icp`, after `deleted_icp` is found and before/at the `update_one` (`:283-287`), fold the signature into the persisted set:

```python
    dismissed = read_dismissed_signatures(document)
    dismissed_list = with_signature_added(dismissed, compute_icp_signature(deleted_icp))

    new_payload = {"suggestedICPs": updated_suggested}
    collection.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "icps": new_payload, DISMISSED_FIELD: dismissed_list}},
        upsert=True,
    )
    _release_icp_id(db, icp_id)
```

- [ ] **Step 4: Filter regeneration by signature in `list_icps`**

In the generate branch of `list_icps`, after `icp_result = normalize_icp_response(icp_result)` and before the `update_one` (`:214-222`), drop dismissed signatures. `existing_icp` was already read at the top of the function (`:189`):

```python
        # Suppress recommended ICPs the user has dismissed (by content signature).
        # Regeneration re-mints ids, so id-based suppression can't catch these;
        # the signature is stable across refresh (spec 48 WS3).
        dismissed = read_dismissed_signatures(existing_icp)
        if dismissed:
            kept = [
                icp for icp in icp_result.get("suggestedICPs", [])
                if compute_icp_signature(icp) not in dismissed
            ]
            icp_result = {"suggestedICPs": kept}
```

(The subsequent `update_one` `$set` writes `user_id`/`icps`/`prompt_meta` only, so the sibling `DISMISSED_FIELD` on the doc is preserved untouched.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/unit/test_icp.py -q`
Expected: PASS — new signature tests green; the existing `delete_recommended_icp` / `list_icps` tests still pass (`test_delete_recommended_icp_happy_path` uses ICPs without firmographics → empty signature → `DISMISSED_FIELD` set to `[]`, which does not break its `remaining_count`/`success` assertions).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/icp/persistence.py backend/tests/unit/test_icp.py
git commit -m "feat(be): record dismissed ICP signatures and suppress them on regeneration"
```

---

### Task 11: Frontend — close the non-404 DELETE-failure hole in `finalizeRecommendedReject`

**Files:**
- Modify: `frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx` — `finalizeRecommendedReject` (`:688-741`) and the mount-effect expired-record path (`:754-756`)
- Modify: `frontend/src/features/customers/components/icp-intelligence/suggestedIcpStorage.ts:3` — export the pending-reject key constant (for the test import)
- Test: `frontend/src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCards.reject.test.tsx` (new)

**Interfaces:** `finalizeRecommendedReject(icpId, userId)` currently removes the pending-reject record at the top (`:690`) — before awaiting the DELETE (`:722`). On a non-404 failure it resets the card to `"suggested"` but the record is already gone, so no dismissal is recorded and the card silently returns on reload. Fix: remove the pending record only inside `applyDeleteSuccess` (success + 404), and on a non-404 failure keep the record (re-armed on the next mount) and keep the card visually rejected.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCards.reject.test.tsx` (real timers, per the sibling `SuggestedICPCards.write.test.tsx` note about `apiFetch`'s dynamic `import("./jwt")` + MSW interplay):

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SuggestedICPCards } from "../SuggestedICPCards";
import {
  PROFILER_DISMISSED_RECOMMENDED_IDS_KEY,
  PROFILER_PENDING_RECOMMENDED_REJECT_KEY,
} from "../suggestedIcpStorage";
import { Toaster } from "@/components/ui/toaster";
import { server } from "@/test/msw/server";

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

function renderCards() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
  return render(<SuggestedICPCards refreshTrigger={1} />, { wrapper });
}

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("SuggestedICPCards reject — non-404 DELETE failure keeps the pending record", () => {
  it("does NOT record a dismissal and keeps the pending record on a 500 DELETE", async () => {
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})),
      http.get("/api/customer_profile", () => HttpResponse.json({ icps: [] })),
      http.get("/api/v2/icp", () =>
        HttpResponse.json({ items: [{ id: "rec-1", title: "FinTech ICP" }], total: 1, limit: 500, offset: 0 }),
      ),
      http.delete("/api/icp/recommended/:id", () => new HttpResponse(null, { status: 500 })),
    );
    renderCards();
    await screen.findByText(/FinTech ICP/i, undefined, { timeout: 5000 });

    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    // Positive control: proves the pending key resolves (a wrong key fails HERE,
    // so the later retention assertion cannot pass vacuously).
    expect(localStorage.getItem(PROFILER_PENDING_RECOMMENDED_REJECT_KEY) ?? "").toContain("rec-1");

    // INTENTIONALLY SLOW: real timers + a ~6s wait for the 5s undo window. Fake
    // timers wedge on apiFetch's dynamic import("./jwt") + MSW microtask interplay
    // (see the sibling SuggestedICPCards.write.test.tsx note) — this is not a hang.
    await new Promise((r) => setTimeout(r, 6000));
    await waitFor(() =>
      expect(localStorage.getItem(PROFILER_DISMISSED_RECOMMENDED_IDS_KEY) ?? "").not.toContain("rec-1"),
    );
    // The pending record is retained (re-armed on next mount), not silently dropped.
    expect(localStorage.getItem(PROFILER_PENDING_RECOMMENDED_REJECT_KEY) ?? "").toContain("rec-1");
  }, 15000);
});
```

- [ ] **Step 2: Run to verify it fails** — `cd frontend && npx vitest run src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCards.reject.test.tsx` → FAIL (pending record removed at `:690`, so it's gone after the failed DELETE).

- [ ] **Step 3: Move the pending-record removal into the success path**

First, export the pending-reject key constant so the test imports it instead of a string literal (a rename then becomes an import error, not a silent vacuous pass): in `suggestedIcpStorage.ts:3`, add `export` to `const PROFILER_PENDING_RECOMMENDED_REJECT_KEY`.

Then in `finalizeRecommendedReject`:
- Delete the unconditional `removePendingRecommendedReject(icpId);` at `:690` (the first statement).
- Inside `applyDeleteSuccess`, add `removePendingRecommendedReject(icpId);` as its first line (so the record is cleared only on success / 404).
- In the `catch (e)` non-404 branch (`:729-737`), remove the `setCardStatuses(... "suggested" ...)` reset; leave the card `"rejected"` and the pending record in place so the next mount re-arms the finalize. Keep the destructive toast. The branch becomes:

```tsx
      } catch (e) {
        if (isRecommendedDeleteNotFound(e)) {
          applyDeleteSuccess();
          return;
        }
        // Keep the pending-reject record and the rejected card state: the DELETE
        // will be retried on the next mount rather than silently reverting and
        // losing the dismissal (spec 48 WS3 FE).
        toast({
          title: "Could not remove recommendation",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      }
```

- [ ] **Step 4: Stop the mount effect from dropping the record before retrying**

In the mount effect's expired-record branch (`:754-756`), remove the pre-emptive `removePendingRecommendedReject(item.icp_id);` so a retry that fails again does not lose the record (finalize's `applyDeleteSuccess` now owns removal):

```tsx
      if (remaining <= 0) {
        void finalizeRecommendedRejectRef.current(item.icp_id, uid);
      } else {
```

- [ ] **Step 5: Run tests + typecheck + lint + commit**

Run: `cd frontend && npx vitest run src/features/customers/components/icp-intelligence && npm run typecheck && npm run lint`
Expected: PASS — the existing `SuggestedICPCards.write.test.tsx` reject-happy-path (204/200 DELETE) still records the dismissal (success path still calls `recordDismissedRecommendedIcp` + `removePendingRecommendedReject`).

```bash
git add frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx frontend/src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCards.reject.test.tsx
git commit -m "fix(fe): retain pending reject on a non-404 DELETE failure (no silent re-surface)"
```

---

## WS4 — Company-profile FE resilience (fixes #5 FE half)

### Task 12: `useCompanyProfile` — stop swallowing 5xx→null; defer on null org

**Files:**
- Modify: `frontend/src/shared/company-profile/useCompanyProfile.ts` (`:20-36`)
- Test: `frontend/src/shared/company-profile/__tests__/useCompanyProfile.test.tsx` (extend)

**Interfaces:** The hook resolves a genuine 404 / empty 2xx to `null` (empty-form path preserved) but a transient 5xx / network / CORS error now propagates to react-query's `error` (retried once by the shared `queryClient` `retry: 1`, keeping last-known data). Also add the missing `!!orgId` read-defer guard (spec WS1c). The 404 is detected by parsing the transport's plain-`Error` message (`HTTP error! status: 404 …`), mirroring the existing `isRecommendedDeleteNotFound` house pattern.

- [ ] **Step 1: Write the failing tests (extend `useCompanyProfile.test.tsx`)**

Replace the existing `"resolves to null (not error) on a non-2xx"` test (it currently treats any non-2xx as null) and add a 5xx case:

```tsx
  it("resolves to null on a 404 (genuine no-profile → empty form)", async () => {
    server.use(http.get("/api/profile/company", () => new HttpResponse(null, { status: 404 })));
    const { result } = renderHook(() => useCompanyProfile("brewra"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("surfaces a 5xx as error (does NOT blank the form)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get("/api/profile/company", () => new HttpResponse(null, { status: 500 })));
    const { result } = renderHook(() => useCompanyProfile("brewra"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("defers (does not fetch) when orgId is empty", async () => {
    const { result } = renderHook(() => useCompanyProfile(""), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });
```

(The `wrapper()` uses a test-local `QueryClient` with `retry: false`, so the 5xx surfaces immediately.)

- [ ] **Step 2: Run to verify they fail** — `cd frontend && npx vitest run src/shared/company-profile` → FAIL (500 currently resolves to `null`; empty org still fetches).

- [ ] **Step 3: Fix the hook**

Rewrite `useCompanyProfile` in `useCompanyProfile.ts`:

```ts
/** True when the transport's `HTTP error! status: NNN …` Error is a 404 — a
 *  genuine "no profile yet" — vs. a transient 5xx/network/CORS failure. Mirrors
 *  the isRecommendedDeleteNotFound house pattern. */
function isHttpNotFound(e: unknown): boolean {
  return e instanceof Error && (/\b404\b/.test(e.message) || /not found/i.test(e.message));
}

export function useCompanyProfile(orgId: string, enabled = true) {
  return useQuery<CompanyProfileResponse | null>({
    queryKey: qk.companyProfile(orgId),
    enabled: enabled && !!orgId, // spec 48 WS1c: defer until org resolves
    queryFn: async () => {
      try {
        return await apiGet(
          `profile/company?org_id=${encodeURIComponent(orgId)}`,
          CompanyProfileSchema,
        );
      } catch (e) {
        if (e instanceof ZodError) throw e;
        if (isHttpNotFound(e)) return null; // no profile yet → empty form
        throw e; // 5xx / network / CORS → surface as error (retried by queryClient), never a blank form
      }
    },
  });
}
```

- [ ] **Step 4: Run tests + typecheck + lint + commit**

Run: `cd frontend && npx vitest run src/shared/company-profile && npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add frontend/src/shared/company-profile/useCompanyProfile.ts frontend/src/shared/company-profile/__tests__/useCompanyProfile.test.tsx
git commit -m "fix(fe): surface company-profile 5xx as error (stop blanking the form); defer on null org"
```

---

### Task 13: Remove the per-user guard on the org-owned company profile

**Files:**
- Modify: `frontend/src/features/mission-control/components/company-profile/companyProfileMapping.ts:39-41`
- Modify: `frontend/src/features/mission-control/components/company-profile/CompanyProfileForm.tsx:95` (the mirrored localStorage-failover guard)
- Test: `frontend/src/features/mission-control/components/company-profile/__tests__/CompanyProfileForm.test.tsx` (extend) — or a focused mapper test

**Interfaces:** The company profile is **org-owned**; a `user_id` mismatch must not blank it for another member of the same org. Remove the `if (data.user_id && data.user_id !== userId) return null;` guard from the mapper and the mirrored `if (localProfile.user_id === userId)` gate in the form's localStorage failover.

- [ ] **Step 1: Write the failing test**

Add a mapper test (the mapper is a pure function — easiest to assert). Create `frontend/src/features/mission-control/components/company-profile/__tests__/companyProfileMapping.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { mapApiDataToCompanyProfileFields } from "../companyProfileMapping";

describe("mapApiDataToCompanyProfileFields", () => {
  it("maps an org profile even when data.user_id differs from the caller (org-owned)", () => {
    const result = mapApiDataToCompanyProfileFields(
      { company_name: "Acme", user_id: "someone-else" },
      "current-user",
    );
    expect(result?.companyName).toBe("Acme");
  });

  it("still returns null for an empty payload", () => {
    expect(mapApiDataToCompanyProfileFields({}, "u1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `cd frontend && npx vitest run src/features/mission-control/components/company-profile/__tests__/companyProfileMapping.test.ts` → FAIL (first case returns null due to the `user_id` guard).

- [ ] **Step 3: Remove the guards**

`companyProfileMapping.ts` — delete lines `:39-41`:

```ts
  if (data.user_id && data.user_id !== userId) {
    return null;
  }
```

`CompanyProfileForm.tsx` — in `loadProfileFromLocalStorage` (`:94-127`), remove the `if (localProfile.user_id === userId) {` wrapper so a stored org profile hydrates regardless of the `user_id` field. Keep the inner mapping/`setCompanyProfile` logic; just unwrap the conditional (the local cache is user-namespaced by `getUserLocalStorage` already, so the value is the current user's own backup).

- [ ] **Step 4: Run tests + typecheck + lint + commit**

Run: `cd frontend && npx vitest run src/features/mission-control/components/company-profile && npm run typecheck && npm run lint`
Expected: PASS (existing `CompanyProfileForm.test.tsx` still green; the mapper no longer null-guards on user_id).

```bash
git add frontend/src/features/mission-control/components/company-profile
git commit -m "fix(fe): drop per-user guard on the org-owned company profile"
```

---

## Final verification (merge gate)

- [ ] **Full preflight** — `cd frontend && npm run preflight` (typecheck + lint + format:check + full vitest + build + bundle:check + e2e + knip). Green is required before merge.
- [ ] **Backend tests** — `cd backend && python -m pytest tests/unit -q` (WS3). Green required.
- [ ] **Manual spec cross-check** — confirm each spec section maps to a landed task (see coverage table below).
- [ ] **Merge** — the human runs the gate, then `git checkout master && git merge --no-ff 48-org-null-safety`. Do **not** push without explicit approval.

### Spec → task coverage

| Spec section | Task(s) |
|---|---|
| WS1(a) three-state resolution, timeout/retry, cache-survives-transient, stale-async guard, orgStatus footgun | 1 |
| WS1(a)/(e)/(f) route gate, per-surface loading, reconnecting + no-org states | 2 |
| WS1(b) remove 22 `\|\| "brewra"` | 3 |
| WS1(b) 3 `?? "org-123"` + ProfileDialog cosmetic | 4 |
| WS1(c) read-defer (`useCompanyProfile` guard; others already gated) | 12 (+ verified in 3) |
| WS1(d) transitive lead-upload guard + control disable | 5 |
| WS1(e) LeadStream loading-vs-empty | 6 |
| WS2 empty-vs-error loader + refetch purge + snapshot reconcile | 7 |
| WS2 ICPManager zero-ICP cache clear | 8 |
| WS3 signature helpers (BE) | 9 |
| WS3 record-on-delete + filter-on-refresh (BE) | 10 |
| WS3 finalizeRecommendedReject hole (FE) | 11 |
| WS4 useCompanyProfile 5xx→error | 12 |
| WS4 remove per-user profile guards | 13 |
