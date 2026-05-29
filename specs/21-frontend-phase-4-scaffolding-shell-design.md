# Spec 21 — Frontend Phase 4: Feature Scaffolding + Shell Extraction

**Status:** Design — round 1 (no reviews yet)
**Date:** 2026-05-29
**Type:** Phase spec (sub-split into 4a + 4b)
**Paired plan:** _none yet — Phase 4a and 4b each ship their own plan (`plans/21a-frontend-phase-4a-scaffolding.md`, `plans/21b-frontend-phase-4b-shell-extraction.md`)_
**Parent:** `specs/14-frontend-refactoring-master-plan-design.md` (§4 Phase 4)

---

## §1 Goal and context

### 1.1 Goal

Establish the `src/features/` structure, the conventions every later feature phase (5–12) consumes, and the app **shell** that features render inside. This is the pivot phase: Phases 0–3 prepared the foundation (safety net, LOC pass, strict TS, lint/format, preflight, data layer); Phase 4 lays down the target skeleton and proves it by extracting the first real unit — the shell — into it.

Two distinct kinds of work live here, so the phase **sub-splits into 4a and 4b** (§1.4):

- **4a — Scaffolding + conventions.** Purely additive: new files and ESLint config edits, **no code moves**. Creates the `features/` root, the per-feature template + scaffolder, the README/ADR conventions, the `<FeatureErrorBoundary>`, and the cross-feature dependency-rule lint config. Near-zero risk.
- **4b — Shell extraction.** A parity-preserving migration: move the layout/route-shell code out of `src/components/layout/` + `src/components/ProtectedRoute.tsx` + `src/contexts/` into `src/features/shell/`, and promote the two app-wide state primitives (`AuthContext`, `TenantContext`) into `src/shared/`. Visual regression and behavior stay frozen.

### 1.2 Starting state (post-Phase-3, 2026-05-29)

Phase 3 landed `src/shared/api/` (the fetch client, zod contracts, `queryClient`, `queryKeys`, the single `RateLimiter`) and migrated the auth/tenant/company-profile read+write paths onto TanStack Query. The relevant pre-Phase-4 facts:

| Aspect | Current state |
|---|---|
| `src/features/` | **Does not exist.** Phase 4 creates it. |
| `src/shared/` | Exists with `api/` only (`client.ts`, `contracts/`, `queryClient.ts`, `queryKeys.ts`, `rateLimiter.ts`, `README.md`, `__tests__/`). |
| `docs/adr/` | **Does not exist.** Phase 4 creates it. |
| Shell components | `src/components/layout/{Sidebar,Header,Layout,ProfileDialog}.tsx`; route guard at `src/components/ProtectedRoute.tsx`; app-level `src/components/PWAInstallPrompt.tsx`. |
| Contexts | `src/contexts/{AuthContext,SidebarContext,TenantContext}.tsx`; `AuthContext` has a wrapper hook at `src/hooks/useAuth.ts`. `TenantContext` imports `AuthContext` (Tenant depends on Auth). |
| Context consumer spread | `AuthContext`/`useAuth`: **28** importers across pages, components (signals, market-research), hooks. `TenantContext`/`useTenant`: **14**. `SidebarContext`: ~2 real consumers (App provider + layout). |
| `App.tsx` | Root nests providers `QueryClientProvider > AuthProvider > TenantProvider > SidebarProvider > TooltipProvider > BrowserRouter > Routes`; routes are flat; protected routes wrap in `<ProtectedRoute requireTenant>`; `Toaster`/`Sonner`/`PWAInstallPrompt` render after `<Routes>`. **`Layout.tsx` is not referenced in `App.tsx`** — the shell frame is composed per-page, not at the route level. |
| `src/components/ui/` | shadcn primitives. shadcn's own `sidebar.tsx` defines an internal `useSidebar` — a **name collision** with our app's `SidebarContext`'s consumers (logged as `TD-FE` in 4b; the two are unrelated). |
| Lint | ESLint flat-config with `import/order` (Phase 2b). `eslint-plugin-import` already installed. No cross-feature dependency rules yet. |
| Preflight | `typecheck → lint → format:check → test → build → bundle:check → test:e2e → knip --strict` (Phase 2c). All green. |

### 1.3 Decisions reached during brainstorming

Six master-plan-deferred questions (§8 of Spec 14) and the phase shape were resolved during this brainstorm. All amend Spec 14 — see §4.

1. **Sub-split 4a / 4b** (§1.4). Decided here (Spec 14 §4 listed Phase 4 as a single row). Mirrors Phase 0's one-spec/two-plans precedent.
2. **Q11 (AuthContext home) → `src/shared/auth/`.** Spec 14 offered only `shell/` vs `auth/`. A 28-consumer context is cross-cutting state, not a feature's property; placing it in `features/shell/` would make the shell a dependency hub for 27 non-shell consumers. `src/shared/` — the home for code consumed by ≥2 features — is the correct placement, consistent with the api layer already living in `shared/api/`.
3. **`TenantContext` → `src/shared/tenant/` now (not Phase 10).** Same rationale (14 cross-cutting consumers). Spec 14 had Tenant moving with the `tenant/` feature in Phase 10; that's superseded. Phase 10 builds the *TenantSelection UI*, consuming the shared primitive.
4. **`SidebarContext` → `src/features/shell/`.** It is shell-local UI state (sidebar collapse), not cross-cutting domain state — the shell owns it.
5. **Q13 (FeatureErrorBoundary home) → `src/shared/components/`.** Cross-cutting component wrapping every feature route; belongs in `shared/`, consistent with decisions 2–3.
6. **Q16 (cross-feature lint enforcement) → `eslint-plugin-import` rules** (`import/no-internal-modules` + `import/no-restricted-paths` + `import/no-cycle`). Already installed; no new tool. `dependency-cruiser` remains the documented fallback if these prove insufficient.
7. **Q5 (shared promotion criteria) → ≥2-feature rule.** A hook/util/type graduates to `shared/` only when ≥2 features demonstrably import it; no speculative promotion. API infra is shared by definition.
8. **Q6 (naming map) → kebab-case** (§2.2): `features/{market-research, mission-control, customers, signals, strategist, scout, settings, tenant, auth, shell}`; `profiler` reserved pending Phase 9. `shared/{api, auth, tenant, hooks, lib, types, components}`.
9. **Q7 (ADR template) → slim 3-part** (Context / Decision / Consequences).
10. **Feature folders are created lazily** (§2.1) by the scaffolder as each phase needs them, not pre-created as empty dirs. "Skeleton exists" means the `features/` root + conventions + working scaffolder, not ten empty folders.

### 1.4 Sub-split (4a + 4b)

| Sub-phase | Mission | Risk | Ships as |
|---|---|---|---|
| **4a** | Scaffolding + conventions: `features/` root, per-feature template, scaffolder, `features`/`shared` READMEs, `<FeatureErrorBoundary>`, ADR template + first ADRs, cross-feature lint rules, lock `components/ui/`. **Additive only.** | Near-zero (no code moves; lint rules vacuous until a feature exists) | `plans/21a-frontend-phase-4a-scaffolding.md`, branch `phase-4a-scaffolding` |
| **4b** | Shell extraction: move shell code → `features/shell/`; promote `AuthContext`+`TenantContext` → `shared/`; rewire `App.tsx`; extract the route shell. **Parity-preserving migration.** | Moderate (import-rewrite blast radius; visual/behavior parity) | `plans/21b-frontend-phase-4b-shell-extraction.md`, branch `phase-4b-shell-extraction` |

4b is the **first consumer** of 4a's conventions: `features/shell/` is the first feature folder, so the lint rules (dormant in 4a) first bite in 4b, and the per-feature template is first instantiated by the shell. Extracting the shell here dogfoods the scaffolding before Phase 5's harder extraction. Per Spec 14 §5.7, 4a and 4b are independently revertible; a 4b failure does not unwind 4a.

### 1.5 Out of scope (logged as `TD-FE-<n>` if surfaced)

- **No feature extraction beyond the shell.** Market-research et al. are Phases 5–12. 4b moves only shell/route-frame code and the two state primitives.
- **No new product features, no visual redesign, no behavior change.** Routes (§2.3) and rendering stay frozen; visual regression stays green.
- **No TanStack migration of new surfaces.** Auth/tenant already migrated in Phase 3; 4b moves their context files, it does not re-architect data flow.
- **No centralization of the per-page `Layout` composition.** 4b preserves the existing render pattern (move files, keep wiring) unless 21b's plan proves a centralization is provably visual-neutral; default is preserve.
- **No `src/styles/` move** (Spec 14 §3.1; deferred to Phase 11).
- **No promotion of other `src/hooks`/`src/lib`/`src/utils` into `shared/`** — that's Phase 11. 4b promotes only `AuthContext` and `TenantContext` (plus their hooks) because the shell extraction forces the decision.
- **No `frontend/AGENTS.md`/`frontend/CLAUDE.md`** (Spec 14 §2.2). Root files are amended only if a deviation makes existing guidance stale (it does not, for 4a/4b).

---

## §2 Phase 4a — Scaffolding + conventions (additive)

All of 4a is new files plus edits to `eslint.config.js`. No existing source file moves. `npm run preflight` stays green because the new lint rules are vacuous (no `features/` content yet — see §2.6).

### 2.1 `features/` skeleton + per-feature template

Create `src/features/` containing only `README.md` (§2.2) at the start. **Feature folders are not pre-created.** Each phase generates its folder via the scaffolder (§2.4) when it runs; 4b generates `shell/`. This avoids committing empty directories (which git does not track) and stale placeholder folders.

The canonical per-feature template (what the scaffolder emits):

```
src/features/<feature>/
├── pages/          # routed page components
├── components/     # feature-internal components
├── hooks/          # feature-internal hooks
├── services/       # feature-specific data calls (thin; most data goes through shared/api)
├── types.ts        # feature types
├── README.md       # purpose, public surface, key files, dependency notes
└── index.ts        # public re-exports (the cross-feature surface)
```

`pages/`, `components/`, `hooks/`, `services/` are created on demand by the owning phase — a feature with no internal hooks does not get an empty `hooks/`. `types.ts`, `README.md`, `index.ts` are always present.

### 2.2 `src/features/README.md` (conventions)

The features-root README documents, for both agents and humans:

- **Per-feature template** (§2.1) and which subfolders are optional.
- **Naming map (kebab-case)** — the canonical feature names:
  `auth`, `customers`, `market-research`, `mission-control`, `scout`, `settings`, `shell`, `signals`, `strategist`, `tenant`. `profiler` is **reserved** — Phase 9 decides whether scout/profiler are one feature or siblings (Spec 14 §8 Q10). Backend uses snake_case; the frontend uses kebab-case per JS convention.
- **Dependency rules** (Spec 14 §3.3), restated:
  - `features/<X>` may import from `features/<X>`, `shared/`, `components/ui/`, npm packages.
  - `features/<X>` may import from `features/<Y>` **only via** `features/<Y>/index.ts`.
  - Circular feature dependencies are forbidden; if two features need each other, the shared surface moves to `src/shared/`.
  - **Transitional exception (Phases 4b–12):** importing from not-yet-migrated legacy dirs (`src/contexts`, `src/hooks`, `src/lib`, `src/utils`, `src/pages`) is permitted and expected; those imports disappear as each dir empties. The lint config does not forbid them (§2.6).
- **Public-surface convention** — cross-feature consumption goes through `index.ts`; reaching into another feature's internals is a lint error.

### 2.3 `src/shared/README.md` (promotion criteria)

A new shared-root README (distinct from the existing `src/shared/api/README.md`) documenting **when code graduates into `shared/`**:

- **The ≥2-feature rule.** A hook, utility, or type is promoted to `shared/` only once **two or more features demonstrably import it**. A single-consumer utility stays inside its feature.
- **No speculative promotion.** A feature that needs a not-yet-shared utility keeps a local copy (or its own version) until a second consumer appears; the later phase that introduces the second consumer performs the promotion. This avoids wrong abstractions (Spec 14 §7 R5).
- **API infrastructure is shared by definition** — every feature consumes it; `shared/api/` needs no ≥2 demonstration.
- **State primitives** (`shared/auth/`, `shared/tenant/`) and cross-cutting components (`shared/components/`) follow the same "consumed app-wide" logic; their placement is recorded in ADR-0002 (§2.8).
- The `shared/` subfolders: `api/` (Phase 3), `auth/` + `tenant/` + `components/` (Phase 4), and `hooks/` / `lib/` / `types/` (populated in Phase 11). `ui-patterns/` is created only if Phase 13 surfaces repeated patterns.

### 2.4 Feature scaffolder script

`frontend/scripts/scaffold-feature.ts`, run via `tsx` (already in deps; matches `scripts/check-bundle-budget.ts` and `scripts/capture-bundle-baseline.ts`).

- **Invocation:** `npm run scaffold:feature -- <kebab-name>` (script entry added to `frontend/package.json`).
- **Behavior:** creates `src/features/<name>/` with `types.ts` (empty, with a header comment), `index.ts` (empty re-export stub), and `README.md` filled from a template with the feature name. `pages/`/`components/`/`hooks/`/`services/` are created on first use, not by the scaffolder (or created with a `.gitkeep` only if 21a's plan prefers — plan author's call, §8.2).
- **Guard rails:** refuses to overwrite an existing feature folder; validates the name is kebab-case and is on the naming map (or warns if not).
- Documented in `frontend/scripts/README.md` (extends the file Phase 2c created).

### 2.5 `<FeatureErrorBoundary>` → `src/shared/components/`

Create `src/shared/components/FeatureErrorBoundary.tsx` (a React class error boundary) and `src/shared/components/index.ts`.

- **Contract:** wraps a feature's top-level routed component; on a thrown render error it renders a fallback UI (feature-scoped, so one feature's crash does not blank the whole app) and logs error info for debugging.
- **Usage:** defined in 4a, **first used in Phase 5** (each feature phase wraps its top-level routed component). 4b does **not** wrap the shell in it — the shell is the frame, not a wrapped feature; the boundary sits between the shell and feature content from Phase 5 onward.
- **Unit tests** (Vitest + RTL, run by the existing `test` preflight step), verifying:
  (a) catches a thrown error in a child and renders the fallback;
  (b) renders children normally when no error is thrown, and does **not** intercept errors thrown outside its subtree;
  (c) surfaces/logs error information (assert the logging hook is invoked).
- An untested boundary defeats its fault-isolation purpose, so tests are part of 4a's done-when.

### 2.6 ESLint dependency rules

Add to `eslint.config.js` (using already-installed `eslint-plugin-import`):

1. **`import/no-internal-modules`** — scoped to police only `@/features/*` paths: allow `@/features/<Y>/index` (and `@/features/<Y>` resolving to its index), forbid deeper `@/features/<Y>/<internal>`. **The `allow` list must whitelist all existing deep-import patterns** (`@/components/ui/*`, `@/shared/api/*`, `@/lib/*`, etc.) so the rule does not regress current imports. With `features/` empty, the rule matches nothing today.
2. **`import/no-restricted-paths`** — zone rules:
   - `src/shared/**` may **not** import from `src/features/**`.
   - `src/components/ui/**` may **not** import from `src/features/**` or `src/shared/**`.
   - These zones are **not** symmetric: nothing here forbids `features → legacy-dir` imports (the transitional exception in §2.2). Only the two zones above are restricted.
3. **`import/no-cycle`** — forbids circular imports. **Pre-check required (21a plan):** run `eslint` with only this rule in report mode against the current tree first. If pre-existing cycles exist, either fix the trivial ones in 4a or log them `TD-FE-<n>` and scope/defer `no-cycle` so **4a still merges green**. 4a's "trivial green merge" promise is not sacrificed to surface latent cycles; that cleanup is its own work item if non-trivial.

Lint stays in the existing `lint` preflight step (`eslint . --max-warnings 0`); 4a adds rules, not a new gate. The rules are **dormant** (vacuous) in 4a and **first enforce** in 4b when `features/shell/` exists.

### 2.7 Lock `src/components/ui/`

Add `src/components/ui/README.md` (short) declaring the directory off-limits: it holds shadcn/Radix primitives only, owned by no feature, and may not import from `features/` or `shared/` (enforced by §2.6 zone rule). Note the shadcn-`useSidebar` vs app-`SidebarContext` name collision here for future readers (cross-referenced from the 4b `TD-FE` entry, §3.6).

### 2.8 ADR template + first ADRs

Create `docs/adr/` with:

- **`0001-adr-template.md`** — slim form: **Context / Decision / Consequences** (+ a status line: Proposed/Accepted/Superseded). MADR and Nygard's fuller forms were considered and rejected for a pre-launch MVP — the slim form keeps ADRs cheap enough to actually write.
- **`0002-cross-cutting-client-state-and-components-live-in-shared.md`** — records the architectural decision behind §1.3 items 2–5: app-wide React contexts (`AuthContext`, `TenantContext`) and cross-cutting components (`FeatureErrorBoundary`) live in `src/shared/`, not inside any feature, and `TenantContext` is promoted in Phase 4b rather than Phase 10. Consequence: Phase 10 builds the auth/tenant **UIs** consuming the shared primitives; the shell is not an auth hub.

Additional ADRs accrue in later phases. The ADR convention is consolidated in Phase 14.

### 2.9 Files touched (4a)

| File | Change |
|---|---|
| `src/features/README.md` | New — conventions, naming map, dependency rules, public-surface rule |
| `src/shared/README.md` | New — promotion criteria |
| `src/shared/components/FeatureErrorBoundary.tsx` | New — error boundary component |
| `src/shared/components/index.ts` | New — public re-export |
| `src/shared/components/__tests__/FeatureErrorBoundary.test.tsx` | New — unit tests |
| `src/components/ui/README.md` | New — off-limits / shadcn-only note |
| `frontend/scripts/scaffold-feature.ts` | New — feature scaffolder (tsx) |
| `frontend/scripts/README.md` | Edit — document `scaffold:feature` |
| `docs/adr/0001-adr-template.md` | New — slim ADR template |
| `docs/adr/0002-cross-cutting-client-state-and-components-live-in-shared.md` | New — first real ADR |
| `frontend/eslint.config.js` | Edit — add `import/no-internal-modules`, `import/no-restricted-paths`, `import/no-cycle` (pre-checked) |
| `frontend/package.json` | Edit — add `scaffold:feature` script |
| `specs/14-frontend-refactoring-master-plan-design.md` | Edit — amendments (§4 of this spec), in a dedicated `docs(spec-14):` commit |

### 2.10 Phase 4a done-when

1. `src/features/README.md` and `src/shared/README.md` exist with the content in §2.2–§2.3.
2. `scaffold-feature.ts` works: generates a valid feature folder from the template; `npm run scaffold:feature -- <name>` documented in `scripts/README.md`.
3. `FeatureErrorBoundary` exists in `src/shared/components/` with passing unit tests covering the three behaviors in §2.5.
4. ESLint dependency rules added and `eslint . --max-warnings 0` green (with the §2.6.3 cycle pre-check resolved).
5. `src/components/ui/README.md` declares the lock.
6. `docs/adr/0001` + `0002` written.
7. `npm run preflight` green on `phase-4a-scaffolding` immediately before merge.
8. Master Spec 14 amendments (§4) merged in a dedicated `docs(spec-14):` commit on the 4a branch.
9. **No existing source file moved** — `git diff --stat` shows only additions plus the `eslint.config.js`/`package.json`/spec-14 edits.

---

## §3 Phase 4b — Shell extraction (parity-preserving)

4b moves the app frame into `features/shell/` and the two app-wide state primitives into `shared/`, rewires `App.tsx`, and updates all import sites — with no behavior or visual change. `features/shell/` is generated by the 4a scaffolder.

### 3.1 Shell sources & destination

Move into `src/features/shell/` (preserving content; adjust only import paths):

| Source | Destination |
|---|---|
| `src/components/layout/Sidebar.tsx` | `src/features/shell/components/Sidebar.tsx` |
| `src/components/layout/Header.tsx` | `src/features/shell/components/Header.tsx` |
| `src/components/layout/Layout.tsx` | `src/features/shell/components/Layout.tsx` |
| `src/components/layout/ProfileDialog.tsx` | `src/features/shell/components/ProfileDialog.tsx` |
| `src/components/ProtectedRoute.tsx` | `src/features/shell/ProtectedRoute.tsx` (route guard; consumes auth + tenant state — 21b plan verifies the exact dependency set) |
| `src/contexts/SidebarContext.tsx` | `src/features/shell/SidebarContext.tsx` |

`src/components/PWAInstallPrompt.tsx` stays put (app-level chrome rendered by `App.tsx`, not part of the route shell) unless 21b's plan finds reason to move it (then log the decision). `src/components/layout/` is deleted once empty.

### 3.2 State primitives → `src/shared/`

| Source | Destination | Import sites to rewire |
|---|---|---|
| `src/contexts/AuthContext.tsx` | `src/shared/auth/AuthContext.tsx` (+ `src/shared/auth/index.ts`) | ~28 |
| `src/hooks/useAuth.ts` | `src/shared/auth/useAuth.ts` (co-located with the context it wraps; re-exported from `shared/auth/index.ts`) | (subset of the 28) |
| `src/contexts/TenantContext.tsx` | `src/shared/tenant/TenantContext.tsx` (+ `src/shared/tenant/index.ts`) | ~14 |

- `shared/auth/index.ts` exposes `AuthProvider`, `useAuth`, and any auth types consumers need. `shared/tenant/index.ts` exposes `TenantProvider`, `useTenant`, tenant types.
- `TenantContext` imports `AuthContext`; both in `shared/` makes that a `shared → shared` import (allowed). Consumers import from `@/shared/auth` / `@/shared/tenant` — the rewire is mechanical path substitution caught by `tsc --noEmit` and the test suite.
- This is the largest mechanical change in the phase. 21b's plan stages it (e.g., move + barrel-export, then codemod/rewrite import sites, then delete old paths) so each commit stays green.

### 3.3 Route shell + `App.tsx` rewire

- Extract the `<Routes>` table into `src/features/shell/AppRoutes.tsx` (verbatim JSX move — same component tree, same route URLs per §2.3), re-exported via `shell/index.ts`.
- `App.tsx` becomes the thin composition root: nests `QueryClientProvider` + `AuthProvider` (`@/shared/auth`) + `TenantProvider` (`@/shared/tenant`) + `SidebarProvider` (`@/features/shell`) + `TooltipProvider`, renders `<BrowserRouter><AppRoutes/></BrowserRouter>`, then `Toaster`/`Sonner`/`PWAInstallPrompt` as today.
- The provider **nesting order is preserved** (`Auth > Tenant > Sidebar > Tooltip`) — `TenantContext` depends on `AuthContext`, so order is load-bearing.
- **Default: preserve the per-page `Layout` composition** (§1.5). 21b's plan maps exactly what stays in `App.tsx` vs moves to `shell/`; centralizing `Layout` at the route level is out of scope unless provably visual-neutral.

### 3.4 `shell/index.ts` public surface

`shell/index.ts` re-exports the shell's public surface for cross-feature/app-root consumption: `Layout`, `useSidebar` (the app's sidebar hook — not shadcn's), `ProtectedRoute`, `AppRoutes`, `SidebarProvider`. Internals (`Header`, `Sidebar`, `ProfileDialog`) are **not** re-exported — they're shell-internal. The lint rule (§2.6) now enforces this for any future cross-feature import of shell.

### 3.5 Parity constraints & safety net

- **Visual regression must stay green** at the 2% threshold (Phase 2c). The shell renders pixel-identically; a VR failure is a regression, not a re-baseline trigger (Spec 14 §2.2).
- **Routes frozen** (§2.3): URLs unchanged; only the modules behind them move.
- **Behavior frozen**: auth guard, tenant guard, sidebar collapse, profile dialog all behave as before.
- The full preflight chain (typecheck + lint + format + Vitest + build + bundle:check + Playwright/VR + knip) gates the merge. The import-rewrite is type-checked end-to-end; Playwright + VR catch any render-tree drift from the `App.tsx`/route-shell change.

### 3.6 `shell/README.md` + `TD-FE` (naming collision)

- Populate `src/features/shell/README.md`: purpose (the app frame features render inside), public surface (§3.4), key files, dependency notes (consumes `shared/auth`, `shared/tenant`, `components/ui`).
- Log **`TD-FE-<n>`** for the `SidebarContext` (app sidebar collapse) vs shadcn `useSidebar` (in `components/ui/sidebar.tsx`) name collision — two unrelated concepts sharing a hook name. Disposition: rename the app hook (e.g. `useAppSidebar`) is deferred; the entry records the trap so a future agent doesn't conflate them.

### 3.7 Files touched (4b)

| File | Change |
|---|---|
| `src/features/shell/**` | New — `components/{Sidebar,Header,Layout,ProfileDialog}.tsx`, `ProtectedRoute.tsx`, `SidebarContext.tsx`, `AppRoutes.tsx`, `index.ts`, `README.md` (moved-in content + barrel + doc) |
| `src/shared/auth/**` | New — `AuthContext.tsx`, `useAuth.ts`, `index.ts` (moved in) |
| `src/shared/tenant/**` | New — `TenantContext.tsx`, `index.ts` (moved in) |
| `src/components/layout/` | Deleted (emptied) |
| `src/components/ProtectedRoute.tsx`, `src/contexts/{AuthContext,SidebarContext,TenantContext}.tsx`, `src/hooks/useAuth.ts` | Deleted (moved) |
| `src/App.tsx` | Edit — imports from new locations; `<Routes>` → `<AppRoutes/>` |
| ~40 import sites (28 auth + 14 tenant, overlapping) | Edit — import-path rewrite |
| `docs/TECH_DEBT.md` | Edit — `TD-FE` for the sidebar name collision |

### 3.8 Phase 4b done-when

1. `src/features/shell/` populated per §3.1/§3.3/§3.4 with a `README.md`; `src/components/layout/` deleted.
2. `AuthContext`+`useAuth` in `src/shared/auth/`, `TenantContext` in `src/shared/tenant/`, each with an `index.ts`; old `src/contexts/{Auth,Tenant}` + `src/hooks/useAuth.ts` deleted. `src/contexts/` no longer holds Auth/Tenant/Sidebar.
3. All import sites resolve to the new locations; `tsc --noEmit` green.
4. `App.tsx` rewired; provider nesting order preserved; routes unchanged.
5. Cross-feature lint rules enforce against `shell/` with no violations.
6. `TD-FE` entry logged for the sidebar name collision.
7. `npm run preflight` green on `phase-4b-shell-extraction` immediately before merge — **including pixel-parity visual regression**.

---

## §4 Master Spec 14 amendments

Amendments split across the two branches so Spec 14 tracks reality as each sub-phase lands (§5.5 / R7): decision/convention amendments land in 4a; the amendments that assert the contexts have *physically moved to `shared/`* land in 4b (true only after 4b merges). Each is its own dedicated `docs(spec-14):` commit, separate from code commits (Spec 14 §5.7).

**On the 4a branch** (decisions + conventions, all locked at spec approval):

- **§3.1 target layout** — add `shared/auth/`, `shared/tenant/`, `shared/components/` to the `src/shared/` block (target state; physical move is 4b).
- **§3.3 dependency rules** — add the transitional `features → legacy-dir` allowance clause (§2.2 here) so the rule set matches what 4a configures.
- **§4 status table** — replace the `4 — Feature scaffolding + shell extraction` row with `4a — Scaffolding + conventions` and `4b — Shell extraction` rows (status `pending`), mirroring the 0a/0b rows.
- **§4 Phase 4 block** — record the sub-split; update the AuthContext line (→ `shared/auth/`, not shell/auth); the FeatureErrorBoundary line (→ `shared/components/`); the lint-tool line (→ `eslint-plugin-import`); note feature folders are created lazily by the scaffolder.
- **§8 open questions** — mark **RESOLVED** (decisions, locked now): Q5 (≥2-feature promotion rule), Q6 (kebab-case naming map), Q7 (slim ADR), Q11 (`shared/auth/`), Q13 (`shared/components/`), Q16 (`eslint-plugin-import`). Q10 (scout vs scout+profiler) stays open for Phase 9; the naming map reserves `profiler`.

**On the 4b branch** (realized outcomes; land only when 4b makes them true):

- **§4 Phase 10 block** — rewrite: `AuthContext` and `TenantContext` already live in `src/shared/`; Phase 10 builds the Login (`auth/`) and TenantSelection (`tenant/`) **UIs** consuming them. The "AuthContext in shell ⇒ auth feature spans two folders" note is obsolete and removed.
- **§4 Phase 11 block** — note `shared/{auth,tenant,components}` already exist from Phase 4; Phase 11 promotes the *remaining* hooks/lib/types.

---

## §5 Per-phase workflow

Standard Spec 14 §5 cycle, run **twice** (once per sub-phase):

1. Brainstorm → this spec (covers both 4a and 4b)
2. `/review-spec` → `docs/reviews/21-frontend-phase-4-scaffolding-shell-design-spec-review-N.md`
3. `/synthesize-spec-review` → `…-spec-synthesis-N.md`; loop until nit-or-below
4. **4a:** `/writing-plans` → `plans/21a-frontend-phase-4a-scaffolding.md` → `/review-plan` → `/synthesize-plan-review` (loop) → `/executing-plans` → `/review-impl` → `/synthesize-impl-review` (loop) → human-approved merge of `phase-4a-scaffolding`
5. **4b:** `/writing-plans` → `plans/21b-frontend-phase-4b-shell-extraction.md` → review/synthesis (loop) → execute → impl review/synthesis (loop) → human-approved merge of `phase-4b-shell-extraction`
6. Controller runs `npm run preflight` locally before each merge (§5.3/§5.6); green merges to `master`, red blocks and reports.

4a merges before 4b begins implementation (4b consumes 4a's conventions). The spec is shared; plans, branches, and impl-review cycles are per-sub-phase.

---

## §6 Definition of done (combined)

Phase 4 is done when **both** 4a (§2.10) and 4b (§3.8) are merged to `master`, and:

1. `src/features/` exists with a conventions README, a working scaffolder, and exactly one populated feature (`shell/`).
2. `src/shared/` has `auth/`, `tenant/`, `components/` (+ the Phase-3 `api/`), each with an `index.ts`; `shared/README.md` documents promotion criteria.
3. `src/components/` no longer contains `layout/` or `ProtectedRoute.tsx`; `src/contexts/` no longer contains Auth/Tenant/Sidebar; `src/hooks/useAuth.ts` is gone.
4. Cross-feature dependency lint rules are configured and enforce against `shell/` with zero violations; `components/ui/` is locked.
5. `<FeatureErrorBoundary>` exists in `shared/components/` with passing tests (used from Phase 5).
6. ADR template + ADR-0002 exist in `docs/adr/`.
7. `App.tsx` is the thin composition root; routes/behavior/visuals unchanged (VR green).
8. Master Spec 14 amended (§4).
9. `npm run preflight` green at both merges.

---

## §7 Risks and mitigations

### R1 — Import-rewrite blast radius (4b, ~40 sites)
Moving `AuthContext`/`TenantContext` rewrites imports across ~40 files. A missed site or a wrong path breaks the build.
**Mitigation:** the rewrite is type-checked end-to-end (`tsc --noEmit` fails on any unresolved/incorrect import). Stage as move-then-rewrite-then-delete so intermediate commits stay green. The change is mechanical (path substitution), not logic.

### R2 — Route-shell extraction drifts the render tree (4b)
Extracting `<Routes>` into `shell/AppRoutes.tsx` and thinning `App.tsx` could subtly change the component tree (e.g., a misplaced provider) and alter rendering or guard behavior.
**Mitigation:** verbatim JSX move; provider nesting order explicitly preserved (§3.3). Playwright user-journey tests + 2% visual regression catch any drift. Default-preserve the per-page `Layout` composition (no centralization).

### R3 — Lint rules regress existing imports (4a)
`import/no-internal-modules` mis-scoped could flag legitimate deep imports (`@/components/ui/button`, `@/shared/api/client`); `import/no-cycle` could surface pre-existing cycles and turn `eslint .` red.
**Mitigation:** `no-internal-modules` is scoped to `@/features/*` only, with an `allow` list for current patterns (§2.6.1). `no-cycle` is pre-checked in report mode (§2.6.3); pre-existing cycles are fixed-if-trivial or logged `TD-FE` and the rule scoped/deferred so 4a merges green.

### R4 — `shared/` placement of contexts diverges from the master plan (4b)
Promoting `TenantContext` in Phase 4 (not Phase 10) and placing both contexts in `shared/` (not a feature) deviates from Spec 14 as originally written.
**Mitigation:** the divergence is recorded as ADR-0002 and as Spec 14 amendments (§4), with the 28/14-consumer evidence as rationale. Phase 10's scope is correspondingly narrowed (build UIs, not move contexts). Per Spec 14 §2 (MVP, velocity over ceremony) and §5.5, doing the clean move once now beats a two-step move.

### R5 — Sidebar name collision causes a wrong edit later
An agent conflates the app's `SidebarContext`/sidebar hook with shadcn's `useSidebar` and edits the wrong one.
**Mitigation:** `TD-FE` entry (§3.6) + the `components/ui/README.md` note (§2.7) document the trap. `shell/index.ts` exports the app hook under an unambiguous name; the rename is deferred but flagged.

### R6 — 4a scaffolding sits unused / template proves wrong at Phase 5
4a defines a template before any non-shell feature exercises it; Phase 5 might find it ill-fitting.
**Mitigation:** 4b is the immediate first consumer — extracting the shell exercises the template, scaffolder, lint rules, and public-surface convention before Phase 5. Anything the shell reveals as wrong is fixed in 4b (or logged), so Phase 5 inherits a validated template.

---

## §8 Open questions

### 8.1 Resolved in this spec (deferred from master §8)

- **Q5** shared promotion criteria → ≥2-feature rule (§2.3).
- **Q6** feature naming canonicalization → kebab-case map (§2.2).
- **Q7** ADR template → slim 3-part (§2.8).
- **Q11** AuthContext home → `src/shared/auth/` (§3.2).
- **Q13** FeatureErrorBoundary location → `src/shared/components/` (§2.5).
- **Q16** index.ts-only enforcement tool → `eslint-plugin-import` (§2.6); `dependency-cruiser` remains the documented fallback.

### 8.2 Deferred to plans

1. **Scaffolder folder strategy** — does `scaffold-feature.ts` create `pages/`/`components/`/`hooks/`/`services/` eagerly (with `.gitkeep`) or lazily? → 21a plan. Default: lazy (always-present files only).
2. **Exact `App.tsx` ↔ `shell/` boundary** — which providers/JSX stay in `App.tsx` vs move to `shell/`. → 21b plan maps it against the live file (§3.3).
3. **Import-rewrite mechanism** — hand-edit vs a one-off codemod (ts-morph) for the ~40 auth/tenant sites. → 21b plan.
4. **`ProtectedRoute` dependency set** — confirm exactly which auth/tenant surface it consumes before the move. → 21b plan (§3.1).
5. **`no-cycle` scope** — global vs `features/`-scoped, pending the §2.6.3 pre-check result. → 21a plan.

---

## §9 Companion documents

- `specs/14-frontend-refactoring-master-plan-design.md` — master plan; this phase amends §3.1, §3.3, §4 (status table + Phase 4/10/11 blocks), and §8 (Q5/Q6/Q7/Q11/Q13/Q16).
- `specs/15-frontend-phase-0-inventory-and-safety-net-design.md` — the one-spec/two-plans sub-split precedent (0a/0b) this spec mirrors.
- `specs/20-frontend-phase-3-api-data-layer-design.md` — predecessor; established `src/shared/api/` and the shared-layer conventions Phase 4 extends.
- `docs/TECH_DEBT.md` — gains the `TD-FE` sidebar-name-collision entry (§3.6).
- Backend Phase K/L specs — the converged per-feature + `_helpers` shape the frontend `features/` + `shared/` mirror.
