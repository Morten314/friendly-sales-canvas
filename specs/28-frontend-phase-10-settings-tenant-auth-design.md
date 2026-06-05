# Spec 28 — Frontend Phase 10: settings + tenant + auth feature extraction

> Part of the Spec 14 frontend-refactoring master plan (§4, Phase 10). This is the design intent
> for extracting the login, tenant-selection, and settings surfaces into three feature folders.
> Authored while Phase 8 (signals + strategist) is in flight on a parallel branch — see §9.

## §1 Goal and context

### 1.1 Goal

Relocate the Login, TenantSelection, and Settings/CompanyProfile surfaces out of the flat
`src/pages/` + `src/components/settings/` layout into three feature folders —
`src/features/auth/`, `src/features/tenant/`, `src/features/settings/` — following the
feature-extraction convention established in Phases 5–8. **This is a behavior-preserving
structural move.** No data-layer modernization, no API changes, no UX changes.

### 1.2 Master-plan supersession (ADR-0002)

Spec 14's Phase 10 block (§4, lines 510–525) predates ADR-0002 and is partly stale:

- It speculated that `AuthContext` might live in `shell/` and that the auth feature would "span two
  folders." **Resolved:** ADR-0002 (Phase 4a, physical move in 4b) placed `AuthContext` in
  `src/shared/auth/` and `TenantContext` in `src/shared/tenant/`. Both are verified present on
  `master`. Phase 10 **consumes** these shared primitives; it does **not** re-extract or move them.
- Per Spec 14 line 521, the company-profile API contract types live in `src/shared/api/` (from
  Phase 3) — confirmed. Phase 10 defines nothing locally.

The frozen master-plan text is not amended (per the spec-driven-flow convention); this spec is the
current authority for Phase 10.

### 1.3 Actual starting state (`master` @ `0f0b96c`, Phase 7 merged)

- `src/shared/auth/` — `AuthContext.tsx` (`AuthProvider`, `useAuth` → `login`, `signup`,
  `fetchOrgId`, `currentUser`), `index.ts`. (No `firebase.ts` here yet — still at `lib/firebase.ts`; §5 moves it.)
- `src/shared/tenant/` — `TenantContext.tsx` (`TenantProvider`, `useTenant` → `selectTenant`,
  `selectedTenant`), `index.ts`. (`TenantContext` depends on `AuthContext` — `shared → shared`.)
- `src/shared/api/` — `client.ts` (`apiGet`/`apiPost` + JWT injection), `contracts/` (incl.
  `auth.ts`, `TenantListSchema`/`TenantContract`, `CompanyProfileSchema`,
  `CompanyProfileResponse`, `CompanyProfileSaveResponseSchema`), `queryKeys.ts`
  (`qk.tenants`, `qk.companyProfile`).
- `src/app/routes.tsx` — the append-only feature-route registry composed into `App.tsx` via
  `{featureRoutes}`.
- Sources to move: `pages/{Login,TenantSelection,Settings}.tsx`, `pages/{useLogin,useTenants}.ts`,
  `components/settings/{CompanyProfile,UserProfile,AgentProfile}.tsx`, and their `__tests__`.
  **`components/settings/useCompanyProfile.ts` does NOT move** — frozen mission-control consumes it
  (§2.2, §3.1).

### 1.4 What is already done (no work here)

- **The data layer is already on the TanStack Query + zod + shared-client convention** (Phase 3 /
  Spec 20): `useLogin`/`useSignup` are `useMutation`; `useTenants` is `useQuery`;
  `useCompanyProfile`/`useSaveCompanyProfile` are `useQuery`/`useMutation` reading `CompanyProfileSchema`
  via `apiGet`/`apiPost`. **Phase 10 relocates these hooks unchanged.**
- Contexts already in `shared/` (§1.2). Route registry already exists.

## §2 Scope

### 2.1 In scope

Three feature folders, each a vertical slice (page + hooks + `routes.tsx` + `index.ts` + `README.md`
+ relocated `__tests__`):

| Feature | Moves in | From |
|---|---|---|
| `features/auth/` | `pages/LoginPage.tsx`, `hooks/useLogin.ts` (`useLogin`+`useSignup`) | `pages/Login.tsx` (277), `pages/useLogin.ts` (53) |
| `features/tenant/` | `pages/TenantSelectionPage.tsx`, `hooks/useTenants.ts` (mock kept) | `pages/TenantSelection.tsx` (101), `pages/useTenants.ts` (19) |
| `features/settings/` | `pages/SettingsPage.tsx`, `components/{CompanyProfile,UserProfile,AgentProfile}.tsx` | `pages/Settings.tsx` (291), `components/settings/{CompanyProfile,UserProfile,AgentProfile}.tsx` |

Plus **one infra move**: `lib/firebase.ts` → `src/shared/auth/firebase.ts` (§5).
Plus `App.tsx` + `app/routes.tsx` rewiring (§4) and the stale-comment fix in
`lib/types/escape-hatches.ts` (path list referencing moved files).

### 2.2 Out of scope (logged to `docs/TECH_DEBT.md` as `TD-FE-<n>`, provisional from TD-FE-47 — see §10)

- **`lib/jwt.ts` + `hooks/useAuth.ts`** (the composite hook minting JWTs, consumed by
  mission-control + market-research) — broad cross-feature reach; their `lib → shared` promotion is
  **Phase 11**'s mandate. Moving them here would force edits into frozen feature folders.
- **`components/settings/useCompanyProfile.ts` stays put.** It is imported by frozen mission-control
  (`CompanyProfileForm.tsx:6`, `MissionControlPage.tsx:11`, + a `vi.mock` in `MissionControlPage.test.tsx:46`)
  as well as by settings. Moving it would break a frozen feature. The relocated
  `features/settings/components/CompanyProfile.tsx` consumes it from `@/components/settings/useCompanyProfile`
  (the same feature→flat-`components/` pattern mission-control already uses — lint-clean). Promotion to
  `shared/` (updating both consumers) is **Phase 11**'s job. See §3.1, TD-FE-48.
- **Real tenant data.** `useTenants` keeps `MOCK_TENANTS`. There is no "list tenants" endpoint; the
  real model is one-org-per-user via `GET /org?user_id=` (already used by `useLogin`'s `fetchOrgId`).
  Whether a tenant-selection page should exist at all is a **product question**, not modularization.
- **`AgentProfile` ↔ `ScoutDeployment` dedup.** They are near-duplicate forms; `ScoutDeployment` is
  Phase 9 (scout) territory (§6). Dedup is a Phase 9 coordination item.

### 2.3 Frozen interfaces (per Spec 14 §2.3 — do not modify)

- Other feature folders: `features/{shell,market-research,mission-control,customers,signals,strategist}`.
  Phase 10 imports only their public `index.ts` if needed (it needs only `shell` for `Layout`/`ProtectedRoute`).
- `lib/jwt.ts`, `hooks/useAuth.ts`, `components/settings/useCompanyProfile.ts` (Phase 11 — §2.2).
- `components/settings/ScoutDeployment.tsx` and `pages/ScoutDeployment.tsx` (Phase 9 — §6).
- `shared/auth` and `shared/tenant` public surfaces are **consumed, not changed** — the only addition
  to `shared/` is `shared/auth/firebase.ts` (§5).

## §3 Target structure

```
src/features/
  auth/
    pages/LoginPage.tsx
    hooks/useLogin.ts            # useLogin, useSignup
    routes.tsx                   # "/" and "/login" → LoginPage
    index.ts
    README.md
    __tests__/useLogin.test.tsx
  tenant/
    pages/TenantSelectionPage.tsx
    hooks/useTenants.ts          # MOCK_TENANTS (unchanged)
    routes.tsx                   # "/tenant-selection" (ProtectedRoute)
    index.ts
    README.md
    __tests__/useTenants.test.tsx
  settings/
    pages/SettingsPage.tsx
    components/{CompanyProfile,UserProfile,AgentProfile}.tsx
    routes.tsx                   # "/settings" (ProtectedRoute requireTenant)
    index.ts
    README.md
    __tests__/CompanyProfile.test.tsx
src/shared/auth/firebase.ts      # moved from lib/firebase.ts
# NOTE: useCompanyProfile.ts (+ its test) stay at components/settings/ — consumed by frozen
#       mission-control; promotion to shared/ is Phase 11 (§2.2, TD-FE-48).
```

### 3.1 Dependency posture

- `features/* → shared/*` only. No cross-feature imports (enforced by `import-x/no-internal-modules`,
  TD-FE-15 pattern). The only feature→feature dependency is on `features/shell`'s public surface
  (`Layout`, `ProtectedRoute`, `SidebarProvider`) — already the established pattern.
- `auth/` → `shared/auth` (login/signup/fetchOrgId), `shared/tenant` (selectTenant),
  `shared/api/contracts/auth`, `shared/auth/firebase`.
- `tenant/` → `shared/tenant`, `shared/api` (`TenantListSchema`, `qk.tenants`).
- `settings/` → `shared/auth` (`useAuth`), `shared/api` (`apiGet`/`apiPost`, contracts,
  `qk.companyProfile`), `components/ui`, and `@/components/settings/useCompanyProfile` (transitional
  feature→flat-`components/` import; the hook is not moved — §2.2).
- **Known external consumer:** frozen `features/mission-control` imports `useCompanyProfile` from
  `@/components/settings/useCompanyProfile`. This pre-existing flat-layer import is left intact (it is
  feature→flat-`components/`, not feature→feature, so it does not break the no-cross-feature-import
  rule); Phase 11 promotes the hook to `shared/` and updates both consumers (TD-FE-48).

## §4 Data layer & route wiring

**Data layer:** no work — relocate the already-modernized hooks (§1.4) with import-path updates only.

**Routes:** each feature exports a `routes.tsx`; `src/app/routes.tsx` appends them to the
`featureRoutes` composition (append-only → clean parallel merge). `App.tsx` edits are limited to
**removing** the now-relocated inline routes + imports:

- remove `import Login` / `import Settings` / `import TenantSelection`;
- remove the `/`, `/login`, `/tenant-selection`, `/settings` `<Route>` blocks.

The `ScoutDeployment` import/route stays (Phase 9). All `App.tsx` + registry edits land in **one
final commit** to minimize the overlap window with Phase 8 (§9).

## §5 The one infra move — `firebase.ts` → `shared/auth/`

`lib/firebase.ts` (`export const auth`, `export default app`) has exactly two importers:
`shared/auth/AuthContext.tsx` (foundation) and `pages/useLogin.ts` (→ `features/auth`). It is auth
foundation, not auth-feature-private, so it moves to `src/shared/auth/firebase.ts` (co-located with
`AuthContext`). Update both importers; `shared/auth/AuthContext` → `./firebase` (intra-shared),
`features/auth/hooks/useLogin` → `@/shared/auth/firebase`. **Also update the test mock:**
`useLogin.test.tsx:15` has `vi.mock("@/lib/firebase", …)`, which becomes
`vi.mock("@/shared/auth/firebase", …)` when the test relocates to `features/auth/__tests__/`. The
module need not be re-exported from `shared/auth/index.ts` (internal to the foundation). `lib/jwt.ts`
stays put (§2.2).

## §6 Settings ↔ Scout boundary (coordination artifact for Phase 9)

`components/settings/` physically contains a Scout component that Phase 10 must **not** claim:

| Component | Renderer | Owner |
|---|---|---|
| `CompanyProfile`, `UserProfile`, `AgentProfile` | `Settings.tsx` (switch cases `company`/`user`/`agent_name`) | **Phase 10 (settings)** |
| `ScoutDeployment` | `pages/ScoutDeployment.tsx` (the scout route) | **Phase 9 (scout)** — leave in place |

Consequence: `components/settings/` is **not deleted** by Phase 10 — it retains `ScoutDeployment.tsx`
(plus `useCompanyProfile.ts`, §2.2) until later phases relocate them. **`pages/ScoutDeployment.tsx`**
(the page wrapper that renders `ScoutDeployment`) also stays in `pages/` for Phase 9. `AgentProfile`
is a generic settings form (agent name / tasks / instructions); it is not scout-coupled and belongs
to settings.

## §7 Execution stages (single branch, staged checkpoints)

Branch `worktree-phase-10-settings-tenant-auth` off `master` (already created). Single plan
(`plans/28-…`), ordered:

0. **Enabling:** move `lib/firebase.ts` → `shared/auth/firebase.ts`, update its 2 importers. Verify green.
1. **auth/:** scaffold skeleton; relocate Login + useLogin; `routes.tsx` (`/`, `/login`); `index.ts`;
   rewire `App.tsx` import → registry (deferred to stage 4 commit); move tests; verify.
2. **tenant/:** relocate TenantSelection + useTenants (mock); `routes.tsx`; `index.ts`; tests; verify.
3. **settings/:** relocate Settings + {CompanyProfile,UserProfile,AgentProfile} (NOT
   `useCompanyProfile.ts` — stays, §2.2); delete the stale commented-out imports in `Settings.tsx`
   (lines 10–12); `routes.tsx`; `index.ts`; move `CompanyProfile.test.tsx`; verify.
4. **Wire-up (one commit):** `App.tsx` route/import removals + `app/routes.tsx` registry additions +
   `escape-hatches.ts` comment fix.
5. **Docs:** three feature `README.md`s; finalize `docs/TECH_DEBT.md` TD-FE entries (§10).

Each stage = one or a few commits, surgically `git add`-ed by path (shared-tree discipline).
Inner loop is `npm run verify` + `prettier --check` on touched files; full `preflight` runs only at
the serial merge gate.

## §8 Error handling, testing & parity

- **Behavior-preserving.** No new tests required beyond keeping the relocated suites green; the
  `useCompanyProfile` tolerance behavior (ZodError surfaces; other failures → `null` → empty form)
  is preserved verbatim.
- Relocated test files move with their code (import-path updates only — **including `vi.mock` paths**,
  e.g. `useLogin.test.tsx`'s firebase mock, §5). The shared `http.get("/api/profile/company")` MSW
  handler stays in `src/test/msw/handlers.ts`.
- Parity check: login → tenant-selection → settings journeys behave identically; Playwright
  journeys (fixture-backed) stay green.

## §9 Parallel-execution & merge safety (Phase 8 concurrent)

Phase 10 is **fully independent of Phases 6–9** (Spec 14 §4 dependency table) and runs concurrently
with the in-flight Phase 8 (signals + strategist). Operating rules:

- **Base off `master`**, not `phase-8`. Phase 10 needs none of Phase 8's work (zero import coupling
  verified: no Phase-10 source imports `features/signals`, `features/strategist`, or `shared/chat`).
- **Only expected conflict: `App.tsx`.** On Phase 10's base (`master`) `import Signals` is still
  present at `App.tsx:14`, between `import Settings` (:13) and `import TenantSelection` (:15). Phase 8
  removes that line **on its own (unmerged) branch**; Phase 10 removes the two adjacent imports
  (`Settings`, `TenantSelection`, plus `Login`:9). The conflict therefore materializes only **at the
  merge gate**, in the import cluster — ~3 lines, mechanical (keep all removals). The `<Routes>`
  removals sit in different regions (no overlap). Batching Phase 10's `App.tsx` edits into one late
  commit (§7 stage 4) keeps the window minimal.
- All other shared surfaces are append-only and merge clean: `app/routes.tsx`,
  `shared/api/contracts/index.ts`, `shared/api/queryKeys.ts`, `test/msw/handlers.ts`.
- **Refresh via `git merge master`** after Phase 8 lands; integrate with a `--no-ff` merge. No rebase.
- **Do not run `preflight:par` or standalone `test:e2e`** while a Phase 8 session may share the box
  (CPU + `:5173` contention → false-green VR, per TD-FE-29). Merge gate = serial `npm run preflight`,
  controller-run, one branch at a time.
- **TD-FE number reconciliation:** Phase 8 will also allocate numbers ≥ 47. Whichever phase merges
  second renumbers its `docs/TECH_DEBT.md` entries to avoid collision (§10).

## §10 Provisional TD-FE allocations (numbers finalized at merge — reconcile vs Phase 8)

Highest committed is TD-FE-46 (master and phase-8). Provisional, starting at TD-FE-47:

- **TD-FE-47** — `lib/jwt.ts` + `hooks/useAuth.ts` not yet promoted to `shared/`; deferred to Phase 11.
- **TD-FE-48** — `components/settings/useCompanyProfile.ts` not moved (frozen mission-control consumes
  it via the flat path); promote to `shared/` and update both consumers in Phase 11.
- **TD-FE-49** — `TenantSelection` is mock multi-tenant UI; real model is one-org-per-user via `/org`.
  Revisit whether a selection page belongs (product question).
- **TD-FE-50** — `AgentProfile` ↔ `ScoutDeployment` near-duplicate forms; dedup when Phase 9 extracts scout.

## §11 Done when

- `features/{auth,tenant,settings}/` each have page + hooks + `routes.tsx` + `index.ts` + `README.md`
  + relocated tests; `src/pages/{Login,TenantSelection,Settings}.tsx`,
  `src/pages/{useLogin,useTenants}.ts`, and `src/components/settings/{CompanyProfile,UserProfile,AgentProfile}.tsx`
  no longer exist at their old paths. (`components/settings/useCompanyProfile.ts` intentionally remains — §2.2.)
- `firebase.ts` lives in `shared/auth/`; both runtime importers + the `useLogin` test mock updated.
- `components/settings/` retains `ScoutDeployment.tsx` (Phase 9) plus `useCompanyProfile.ts` and its
  `__tests__/useCompanyProfile.test.tsx` (§2.2); only `CompanyProfile.test.tsx` moves to `features/settings/`.
- `App.tsx` no longer defines the relocated routes; `app/routes.tsx` composes them.
- `npm run verify` green per stage; full serial `npm run preflight` green at the merge gate.
- Three TD-FE entries recorded.

## §12 Risks & mitigations

- **R1 — `App.tsx` merge conflict with Phase 8.** Likelihood high, impact trivial. Mitigation: one
  late `App.tsx` commit; mechanical resolution at the serial merge gate (§9).
- **R2 — TD-FE number collision with Phase 8.** Mitigation: provisional numbers; second-to-merge
  renumbers (§10).
- **R3 — accidental capture of `ScoutDeployment` into settings.** Mitigation: §6 boundary is explicit;
  it is imported only by `pages/ScoutDeployment.tsx`.
- **R4 — touching `lib/jwt.ts`/`hooks/useAuth.ts` and dragging frozen feature folders into scope.**
  Mitigation: §2.2/§2.3 freeze them for Phase 11.
