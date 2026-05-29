# Spec 21 — Frontend Phase 4: Feature Scaffolding + Shell Extraction

**Status:** Design — round 2 (round-1 reviews by glm-5.1 + opus synthesized at `docs/reviews/21-frontend-phase-4-scaffolding-shell-design-synthesis-2.md`)
**Date:** 2026-05-29 (round 1), 2026-05-29 (round 2 revisions)
**Type:** Phase spec (sub-split into 4a + 4b)
**Paired plan:** _none yet — Phase 4a and 4b each ship their own plan (`plans/21a-frontend-phase-4a-scaffolding.md`, `plans/21b-frontend-phase-4b-shell-extraction.md`)_
**Parent:** `specs/14-frontend-refactoring-master-plan-design.md` (§4 Phase 4)

---

## §1 Goal and context

### 1.1 Goal

Establish the `src/features/` structure, the conventions every later feature phase (5–12) consumes, and the app **shell** that features render inside. This is the pivot phase: Phases 0–3 prepared the foundation (safety net, LOC pass, strict TS, lint/format, preflight, data layer); Phase 4 lays down the target skeleton and proves it by extracting the first real unit — the shell — into it.

Two distinct kinds of work live here, so the phase **sub-splits into 4a and 4b** (§1.4):

- **4a — Scaffolding + conventions.** Purely additive: new files and `eslint.config.js`/`knip.json`/`package.json` config edits, **no source-module moves**. Creates the `features/` root, the per-feature template + scaffolder, the README/ADR conventions, the `<FeatureErrorBoundary>`, and the cross-feature dependency-rule lint config (with its resolver). Near-zero risk.
- **4b — Shell extraction.** A parity-preserving migration: move the layout + route-guard code out of `src/components/` into `src/features/shell/`, promote the two app-wide state primitives (`AuthContext`, `TenantContext`) into `src/shared/`, and rewire `App.tsx`'s imports. Visual regression and behavior stay frozen.

### 1.2 Starting state (post-Phase-3, 2026-05-29)

Phase 3 landed `src/shared/api/` (the fetch client, zod contracts, `queryClient`, `queryKeys`, the single `RateLimiter`) and migrated the auth/tenant/company-profile read+write paths onto TanStack Query. The relevant pre-Phase-4 facts (verified against the tree):

| Aspect | Current state |
|---|---|
| `src/features/` | **Does not exist.** Phase 4 creates it. |
| `src/shared/` | Exists with `api/` only (`client.ts`, `contracts/`, `queryClient.ts`, `queryKeys.ts`, `rateLimiter.ts`, `README.md`, `__tests__/`). |
| `docs/adr/` | **Does not exist.** Phase 4 creates it. |
| Shell components | `src/components/layout/{Sidebar,Header,Layout,ProfileDialog}.tsx` (exactly 4 files); route guard at `src/components/ProtectedRoute.tsx`; app-level `src/components/PWAInstallPrompt.tsx`. |
| Contexts | `src/contexts/{AuthContext,SidebarContext,TenantContext}.tsx` (exactly 3 files). `TenantContext` imports `AuthContext` (Tenant depends on Auth). |
| `useAuth` hook | `src/hooks/useAuth.ts` is **not** a thin AuthContext wrapper — it composes `useFirebaseAuth` (AuthContext) **+ `useTenant` (TenantContext) + `jwtManager`** to mint the session JWT. (Drives the §3.2 decision to leave it in `src/hooks/` for Phase 4.) |
| Context consumer spread | `AuthContext` importers ≈ **25** (incl. `App.tsx` and `useAuth.ts`); `useTenant` references ≈ **12**; direct `TenantContext` importers ≈ **9**. The two sets overlap (e.g. `ProtectedRoute`, `Header`, `Sidebar`, `ProfileDialog`, `useAuth.ts`, `TenantSelection`). `SidebarContext`: ~2 real consumers. Exact site list is enumerated by 21b's plan. |
| `App.tsx` | Root nests `QueryClientProvider > AuthProvider > TenantProvider > SidebarProvider > TooltipProvider`; inside that, `<BrowserRouter>` wraps a flat `<Routes>` table; after `</BrowserRouter>` (still inside `TooltipProvider`) render `Toaster`/`Sonner`/`PWAInstallPrompt`. Protected routes wrap in `<ProtectedRoute requireTenant>`. **`Layout.tsx` is not referenced in `App.tsx`** — it is imported by ~11 page files and composed per-page, not at the route level. |
| `src/components/ui/` | shadcn primitives. `ui/sidebar.tsx` declares a **module-private** `useSidebar()` (not exported) — a name twin of the app's exported `useSidebar` (`contexts/SidebarContext.tsx`). No import-site collision is possible; the trap is only editing the wrong one inside `ui/sidebar.tsx` (logged `TD-FE` in 4b). |
| Lint | ESLint flat-config with `import-x/order` (Phase 2b), via the installed **`eslint-plugin-import-x`** (registered under the `import-x` plugin key). **No `import-x/resolver` is configured.** No cross-feature dependency rules yet. |
| Preflight | Chain wired (Phase 2c) as `typecheck → lint → format:check → test → build → bundle:check → test:e2e → knip --strict` (verified against `package.json`). 21a re-runs it as its step 0. |
| knip | `knip.json` uses production-mode entries (`"src/**/*.{ts,tsx}!"`) and ignores only `src/components/ui/**`. Under `knip --strict`, an exported symbol that nothing consumes fails the gate (see §2.5). |

### 1.3 Decisions reached during brainstorming

Six master-plan-deferred questions (§8 of Spec 14) and the phase shape were resolved. All amend Spec 14 — see §4. The full rationale for the cross-cutting-placement decisions (items 2–5) is recorded canonically in **ADR-0002** (§2.8), not restated across the spec.

1. **Sub-split 4a / 4b** (§1.4). Decided here (Spec 14 §4 listed Phase 4 as a single row). Mirrors Phase 0's one-spec/two-plans precedent.
2. **Q11 (AuthContext home) → `src/shared/auth/`.** Auth session is **cross-cutting infrastructure consumed app-wide** — the same category as `shared/api/`, not a feature's property. The deciding factor is *kind* (cross-cutting state/infrastructure vs. a feature's presentation), not consumer count. See ADR-0002.
3. **`TenantContext` → `src/shared/tenant/` now (not Phase 10).** Same rationale (cross-cutting active-org state). Spec 14 had Tenant moving with the `tenant/` feature in Phase 10; that's superseded — Phase 10 builds the *TenantSelection UI*, consuming the shared primitive. See ADR-0002.
4. **`SidebarContext` → `src/features/shell/`.** Shell-local UI state (sidebar collapse), not cross-cutting domain state — the shell owns it.
5. **Q13 (FeatureErrorBoundary home) → `src/shared/components/`.** Cross-cutting component wrapping every feature route; same "consumed app-wide" logic as items 2–3. See ADR-0002.
6. **Q16 (cross-feature lint enforcement) → `eslint-plugin-import-x`** (the installed plugin; rules `import-x/no-restricted-paths`, `import-x/no-internal-modules`, `import-x/no-cycle`). **This requires configuring an import resolver** (a new dev-dep, `eslint-import-resolver-typescript`) so the rules can resolve `@/` aliases — see §2.6. `dependency-cruiser` remains Spec 14's documented fallback if the index-only constraint can't be expressed cleanly.
7. **Q5 (shared promotion criteria) → ≥2-feature rule.** A hook/util/type graduates to `shared/` only when ≥2 features demonstrably import it; no speculative promotion. API infra is shared by definition.
8. **Q6 (naming map) → kebab-case** (§2.2), covering Phases 5–10's features; the map is living (later phases append). `profiler` reserved pending Phase 9.
9. **Q7 (ADR template) → slim 3-part** (Context / Decision / Consequences).
10. **Feature folders are created lazily** by the scaffolder, with only the always-present files (`types.ts`, `index.ts`, `README.md`) — no empty `pages/components/hooks/services/` dirs and no `.gitkeep` (§2.1/§2.4).

### 1.4 Sub-split (4a + 4b)

| Sub-phase | Mission | Risk | Ships as |
|---|---|---|---|
| **4a** | Scaffolding + conventions: `features/` root, per-feature template, scaffolder, `features`/`shared` READMEs, `<FeatureErrorBoundary>`, ADR template + first ADRs, cross-feature lint rules **+ resolver**, lock `components/ui/`. **Additive only.** | Near-zero (no source moves; lint rules vacuous until a feature exists, but proven non-vacuous by a positive test — §2.6) | `plans/21a-frontend-phase-4a-scaffolding.md`, branch `phase-4a-scaffolding` |
| **4b** | Shell extraction: move shell frame + guard → `features/shell/`; promote `AuthContext`→`shared/auth/`, `TenantContext`→`shared/tenant/`; rewire `App.tsx` imports. `useAuth.ts` stays in `src/hooks/`. **Parity-preserving migration.** | Moderate (import-rewrite blast radius; visual/behavior parity) | `plans/21b-frontend-phase-4b-shell-extraction.md`, branch `phase-4b-shell-extraction` |

4b is the **first consumer** of 4a's conventions: `features/shell/` is the first feature folder, so the lint rules (vacuous in 4a) first bite in 4b, and the per-feature template is first instantiated by the shell. Extracting the shell here dogfoods the scaffolding before Phase 5's harder extraction. Per Spec 14 §5.7, 4a and 4b are independently revertible; a 4b failure does not unwind 4a.

### 1.5 Out of scope (logged as `TD-FE-<n>` if surfaced)

- **No feature extraction beyond the shell.** Market-research et al. are Phases 5–12. 4b moves only the shell frame/guard and the two state primitives.
- **No new product features, no visual redesign, no behavior change.** Routes (Spec 14 §2.3 frozen interfaces) and rendering stay frozen; visual regression stays green.
- **No TanStack migration of new surfaces.** Auth/tenant already migrated in Phase 3; 4b moves their context files, it does not re-architect data flow.
- **No route-table relocation.** The `<Routes>` table stays in `App.tsx` (§3.3) — it is not extracted into `features/shell/`.
- **No `useAuth.ts` rehoming.** It composes two contexts; its final home is deferred to Phase 10/11 (§3.2, §8.2).
- **No `src/styles/` move** (Spec 14 §3.1; deferred to Phase 11).
- **No promotion of other `src/hooks`/`src/lib`/`src/utils` into `shared/`** — that's Phase 11.
- **`PWAInstallPrompt.tsx` stays put** in `src/components/` (app-level chrome). Firm position; a deviation is the plan's to log.
- **No `frontend/AGENTS.md`/`frontend/CLAUDE.md`** (Spec 14 §2.2).

---

## §2 Phase 4a — Scaffolding + conventions (additive)

All of 4a is new files plus edits to `eslint.config.js`, `knip.json`, and `package.json`. No source module moves. `npm run preflight` stays green: lint rules are vacuous (no `features/` content yet, §2.6) and the new `FeatureErrorBoundary` is knip-ignored until Phase 5 consumes it (§2.5).

### 2.1 `features/` skeleton + per-feature template

Create `src/features/` containing only `README.md` (§2.2) at the start. **Feature folders are not pre-created.** Each phase generates its folder via the scaffolder (§2.4); 4b generates `shell/`.

The canonical per-feature template (what the scaffolder emits):

```
src/features/<feature>/
├── types.ts        # feature types
├── README.md       # purpose, public surface, key files, dependency notes
└── index.ts        # public re-exports (the cross-feature surface)
```

`pages/`, `components/`, `hooks/`, `services/` are **created on demand** by the owning phase when it first needs them — no empty dirs, no `.gitkeep`. `types.ts`, `README.md`, `index.ts` are always present. (Decided per §1.3 item 10; §8.2 closed.)

### 2.2 `src/features/README.md` (conventions)

The features-root README documents, for both agents and humans:

- **Per-feature template** (§2.1) and the on-demand subfolders.
- **Naming map (kebab-case), living and authoritative.** Phases 5–10 features: `auth`, `customers`, `market-research`, `mission-control`, `scout`, `settings`, `shell`, `signals`, `strategist`, `tenant`. `profiler` is **reserved** — Phase 9 decides scout/profiler (Spec 14 §8 Q10). The map covers Phases 5–10; **Phase 12's small-page names (e.g. `calendar`, `deals`, `insights`, `reports`, `artifacts`) are appended by Phase 12** when it runs. Each feature phase adds its name before scaffolding. Backend uses snake_case; the frontend uses kebab-case per JS convention.
- **Dependency rules** (Spec 14 §3.3), restated:
  - `features/<X>` may import from `features/<X>`, `shared/`, `components/ui/`, npm packages.
  - `features/<X>` may import from `features/<Y>` **only via** `features/<Y>/index.ts`.
  - Circular feature dependencies are forbidden; if two features need each other, the shared surface moves to `src/shared/`.
  - **Transitional exception (Phases 4b–12):** importing from not-yet-migrated legacy dirs (`src/contexts`, `src/hooks`, `src/lib`, `src/utils`, `src/pages`) is permitted and expected; the lint config does not forbid them (§2.6). **Cleanup is verified in Phases 11–12** — their done-when checks that `features/` hold no imports from those legacy dirs, at which point the zone rule may be tightened to forbid them.
- **Public-surface convention** — cross-feature consumption goes through `index.ts`; reaching into another feature's internals is a lint error.

### 2.3 `src/shared/README.md` (promotion criteria)

A new shared-root README (distinct from `src/shared/api/README.md`) documenting **when code graduates into `shared/`**:

- **The ≥2-feature rule.** A hook, utility, or type is promoted to `shared/` only once **two or more features demonstrably import it**. A single-consumer utility stays in its feature.
- **No speculative promotion.** A feature needing a not-yet-shared utility keeps a local copy until a second consumer appears; the later phase that introduces the second consumer promotes it (Spec 14 §7 R5).
- **API infrastructure is shared by definition** — `shared/api/` needs no ≥2 demonstration.
- **Cross-cutting state primitives** (`shared/auth/`, `shared/tenant/`) and **cross-cutting components** (`shared/components/`) follow the same "consumed app-wide infrastructure" logic; their placement is recorded in ADR-0002 (§2.8).
- The `shared/` subfolders: `api/` (Phase 3), `auth/` + `tenant/` + `components/` (Phase 4), and `hooks/` / `lib/` / `types/` (populated in Phase 11). `ui-patterns/` is created only if Phase 13 surfaces repeated patterns.

### 2.4 Feature scaffolder script

`frontend/scripts/scaffold-feature.ts`, run via `tsx` (already in deps; matches `scripts/check-bundle-budget.ts`, `scripts/capture-bundle-baseline.ts`).

- **Invocation:** `npm run scaffold:feature -- <kebab-name>` (script entry added to `package.json`).
- **Behavior:** creates `src/features/<name>/` with `types.ts` (header comment only), `index.ts` (empty re-export stub), and `README.md` filled from a template with the feature name. It does **not** create `pages/components/hooks/services/` (lazy — §2.1).
- **Guard rails:** refuses to overwrite an existing feature folder; validates kebab-case; **warns (does not block)** if the name is not on the living naming map.
- Documented in `frontend/scripts/README.md` (extends the Phase 2c file).

### 2.5 `<FeatureErrorBoundary>` → `src/shared/components/`

Create `src/shared/components/FeatureErrorBoundary.tsx` (a React class error boundary) and `src/shared/components/index.ts`.

- **Contract:** wraps a feature's top-level routed component; on a thrown render error it renders a feature-scoped fallback (one feature's crash does not blank the app) and logs error info.
- **Usage:** defined in 4a, **first used in Phase 5**. 4b does not wrap the shell in it (the shell is the frame, not a wrapped feature).
- **knip handling (required, else 4a preflight goes RED).** Because `FeatureErrorBoundary` has no consumer until Phase 5 and `knip --strict` runs in production mode (§1.2), 4a **adds `src/shared/components/**` to `knip.json`'s `ignore`** and logs a `TD-FE` to remove that ignore when Phase 5 imports the boundary. (Vitest tests exercise it, but test files are knip-excluded, so they don't satisfy knip's "used" check.)
- **Unit tests** (Vitest + RTL, existing `test` step) verifying: (a) catches a thrown child error and renders the fallback; (b) renders children normally and does **not** intercept errors outside its subtree; (c) invokes the error-logging hook.

### 2.6 ESLint dependency rules (+ required resolver)

Add to `eslint.config.js`, using the installed `eslint-plugin-import-x` (registered as `import-x`; already provides `import-x/order` from Phase 2b).

**Prerequisite — resolver (load-bearing).** The config currently has **no `import-x/resolver`**. The path-based rules below must resolve `@/` aliases (and relatives) to real files; without a resolver they silently match nothing and pass as a false green. So 4a installs **`eslint-import-resolver-typescript`** (a new dev-dep — this corrects §1.3.6's earlier "no new tool" framing) and sets `settings['import-x/resolver']` against `tsconfig.app.json`. 21a's plan validates the resolver works alongside the existing flat-config `import-x/order` before relying on the new rules.

**Rules:**

1. **Zone boundaries — `import-x/no-restricted-paths` (definite).**
   - `src/shared/**` may **not** import from `src/features/**`.
   - `src/components/ui/**` may **not** import from `src/features/**` or `src/shared/**`.
   - Deliberately asymmetric: nothing here restricts `features → legacy-dir` (the §2.2 transitional exception).
2. **Cross-feature index-only — mechanism is a 21a spike, not a given.** The constraint "feature A imports feature B only via `B/index`" is the intended enforcement, but expressing it generically is fiddly: `import-x/no-internal-modules` is a *global* forbid-deep rule needing an exhaustive `allow`-list for every other deep-import shape (`@/components/ui/*`, `@/shared/api/*`, `@/lib/*`, …), and a per-feature-pair `no-restricted-paths` zone is verbose. 21a's plan picks the mechanism (or falls back to `dependency-cruiser` for this one constraint, per Spec 14 §3.3). **Acceptance gate (in 4a done-when): a positive enforcement test** — a deliberate `@/features/<X>/<deep>` cross-feature import is flagged — AND no regression on any existing import.
3. **`import-x/no-cycle`** — forbids circular imports (depends on the resolver, item above). **Pre-check (21a):** run with only this rule in report mode against the current tree; pre-existing cycles are fixed-if-trivial or logged `TD-FE` and the rule scoped/deferred so **4a merges green**.

Lint stays in the existing `lint` step (`eslint . --max-warnings 0`); 4a adds rules + a resolver + a positive test, not a new gate. Rules are vacuous until `features/shell/` exists (4b); the positive test guarantees they are not silently no-op.

### 2.7 Lock `src/components/ui/`

Add `src/components/ui/README.md` (short): shadcn/Radix primitives only, owned by no feature, may not import from `features/` or `shared/` (enforced by §2.6 zone). Note the `ui/sidebar.tsx` `useSidebar` name-twin (module-private; no import collision — see §3.6) so a future editor doesn't conflate it with the app hook.

### 2.8 ADR template + first ADRs

Create `docs/adr/` (new directory) with:

- **`0001-adr-template.md`** — slim form: **Context / Decision / Consequences** (+ a status line: Proposed/Accepted/Superseded). MADR and Nygard's fuller forms were considered and rejected for a pre-launch MVP — the slim form keeps ADRs cheap enough to write.
- **`0002-cross-cutting-client-state-and-components-live-in-shared.md`** — the **canonical record** for §1.3 items 2–5: app-wide React contexts (`AuthContext`, `TenantContext`) and cross-cutting components (`FeatureErrorBoundary`) live in `src/shared/`, not in a feature; `TenantContext` is promoted in Phase 4b, not Phase 10. **Includes an "Alternatives considered"** note (place in `shell/`; defer Tenant to Phase 10) and why they were rejected (placing app-wide state in a feature makes that feature a coupling hub; a two-step move costs more than one). Consequence: Phase 10 builds the auth/tenant **UIs** consuming the shared primitives. §1.3 and §4 point here rather than restating the rationale.

### 2.9 Files touched (4a)

| File | Change |
|---|---|
| `src/features/README.md` | New — conventions, living naming map, dependency rules, public-surface rule |
| `src/shared/README.md` | New — promotion criteria |
| `src/shared/components/FeatureErrorBoundary.tsx` | New — error boundary component |
| `src/shared/components/index.ts` | New — public re-export |
| `src/shared/components/__tests__/FeatureErrorBoundary.test.tsx` | New — unit tests |
| `src/components/ui/README.md` | New — off-limits / shadcn-only note |
| `frontend/scripts/scaffold-feature.ts` | New — feature scaffolder (tsx) |
| `frontend/scripts/README.md` | Edit — document `scaffold:feature` |
| `docs/adr/0001-adr-template.md` | New (creates `docs/adr/`) — slim ADR template |
| `docs/adr/0002-cross-cutting-client-state-and-components-live-in-shared.md` | New — canonical placement ADR + alternatives |
| `frontend/eslint.config.js` | Edit — add `import-x/no-restricted-paths`, index-only rule, `import-x/no-cycle`, **and `settings['import-x/resolver']`** |
| `frontend/knip.json` | Edit — add `src/shared/components/**` to `ignore` (until Phase 5; TD-FE to revert) |
| `frontend/package.json` | Edit — add `scaffold:feature` script + `eslint-import-resolver-typescript` dev-dep |
| `docs/TECH_DEBT.md` | Edit — `TD-FE` for the knip-ignore-to-remove-at-Phase-5 |
| `specs/14-frontend-refactoring-master-plan-design.md` | Edit — 4a-branch amendments (§4), dedicated `docs(spec-14):` commit |

### 2.10 Phase 4a done-when

1. `src/features/README.md` and `src/shared/README.md` exist per §2.2–§2.3.
2. `scaffold-feature.ts` works; `npm run scaffold:feature -- <name>` documented.
3. `FeatureErrorBoundary` exists with passing unit tests (§2.5); `knip --strict` green (boundary ignored, TD-FE logged).
4. ESLint dependency rules + resolver added; `eslint . --max-warnings 0` green; **a positive enforcement test confirms a deliberate cross-feature deep import is flagged** (not merely "lint passes"); `no-cycle` pre-check resolved.
5. `src/components/ui/README.md` declares the lock.
6. `docs/adr/0001` + `0002` written.
7. `npm run preflight` green on `phase-4a-scaffolding` immediately before merge.
8. Spec 14 4a-branch amendments (§4) merged in a dedicated `docs(spec-14):` commit.
9. **No existing source module moved** — `git diff --stat` shows only additions plus the `eslint.config.js`/`knip.json`/`package.json`/spec-14 edits.

---

## §3 Phase 4b — Shell extraction (parity-preserving)

4b moves the app frame + route guard into `features/shell/` and the two state primitives into `shared/`, rewires `App.tsx`'s imports, and updates external import sites — with no behavior or visual change. `features/shell/` is generated by the 4a scaffolder.

### 3.1 Shell sources & destination

**Pre-move audit (21b plan, step 0):** confirm `src/components/layout/` contains exactly the four files below and `src/contexts/` exactly the three contexts (verified at spec time; re-confirm before deleting the dirs, to catch anything added between spec and execution).

Move into `src/features/shell/` (preserving content; adjust only import paths):

| Source | Destination |
|---|---|
| `src/components/layout/Sidebar.tsx` | `src/features/shell/components/Sidebar.tsx` |
| `src/components/layout/Header.tsx` | `src/features/shell/components/Header.tsx` |
| `src/components/layout/Layout.tsx` | `src/features/shell/components/Layout.tsx` |
| `src/components/layout/ProfileDialog.tsx` | `src/features/shell/components/ProfileDialog.tsx` |
| `src/components/ProtectedRoute.tsx` | `src/features/shell/ProtectedRoute.tsx` (route guard; consumes auth + tenant state — 21b verifies the exact surface) |
| `src/contexts/SidebarContext.tsx` | `src/features/shell/SidebarContext.tsx` (exported as `useAppSidebar` via `index.ts` — §3.6) |

`src/components/PWAInstallPrompt.tsx` **stays put** (§1.5). `src/components/layout/` is deleted once empty.

### 3.2 State primitives → `src/shared/` (and `useAuth` stays)

| Source | Destination | External rewrite sites |
|---|---|---|
| `src/contexts/AuthContext.tsx` | `src/shared/auth/AuthContext.tsx` (+ `src/shared/auth/index.ts`) | the AuthContext importers that are **not** themselves moving into shell |
| `src/contexts/TenantContext.tsx` | `src/shared/tenant/TenantContext.tsx` (+ `src/shared/tenant/index.ts`) | the TenantContext importers not moving into shell |

- **`src/hooks/useAuth.ts` is NOT moved.** It composes `AuthContext` + `TenantContext` + `jwtManager` (§1.2), so it belongs in neither `shared/auth/` nor `shared/tenant/` without creating a bidirectional folder coupling. It stays in `src/hooks/` for Phase 4, updating its imports to `@/shared/auth` + `@/shared/tenant` (a legacy→shared import, allowed transitionally). Its final home is deferred to Phase 10/11 (§8.2).
- `shared/auth/index.ts` exposes `AuthProvider`, `useAuth` (the AuthContext hook), auth types. `shared/tenant/index.ts` exposes `TenantProvider`, `useTenant`, tenant types.
- `TenantContext` imports `AuthContext`; both in `shared/` makes that `shared → shared` (allowed).
- **Scope note (from R2:H1):** several "consumers" of these contexts are files 4b moves into `shell/` (`ProtectedRoute`, `Header`, `Sidebar`, `ProfileDialog`) — their imports become intra-shell/`@/shared` and are handled by the move, not separate rewrites. The true external-rewrite set (files that stay put and only change an import path) is smaller than the raw importer count; 21b enumerates it. The rewrite is mechanical and `tsc --noEmit`-checked; staged move→rewrite→delete so each commit stays green.

### 3.3 `App.tsx` rewire (route table stays put)

The `<Routes>` table **stays in `App.tsx`**. It references every feature's page, so it is an app-root concern — the one place allowed to know all features. Extracting it into `features/shell/` would force `shell/` to import 11 page components, inverting the dependency rule (§3.3 in Spec 14) and making the shell a churn hub (rejected — see synthesis-2 R2:H2). 4b therefore changes **only `App.tsx`'s imports**, not its route structure:

- `AuthProvider` ← `@/shared/auth`; `TenantProvider` ← `@/shared/tenant`; `SidebarProvider` + `ProtectedRoute` ← `@/features/shell`.
- The exact tree is preserved verbatim: `QueryClientProvider > AuthProvider > TenantProvider > SidebarProvider > TooltipProvider` → `<BrowserRouter><Routes>…</Routes></BrowserRouter>` → `Toaster`/`Sonner`/`PWAInstallPrompt` (after `</BrowserRouter>`, inside `TooltipProvider`). Provider nesting order is **load-bearing** (`TenantContext` depends on `AuthContext`).
- Pages keep composing `Layout` per-page, now importing it from `@/features/shell` (transitional legacy→feature import until each page migrates in Phases 5–12).

**"Route shell" clarification (Spec 14 §4 Phase 4 wording):** what moves to `shell/` is the route **guard** (`ProtectedRoute`) and the frame (`Layout`/`Header`/`Sidebar`), not the route **table**. 4a's Spec 14 amendment clarifies this (§4).

### 3.4 `shell/index.ts` public surface

`shell/index.ts` re-exports: `Layout`, `useAppSidebar` (the app sidebar hook, renamed for clarity — §3.6), `ProtectedRoute`, `SidebarProvider`. Internals (`Header`, `Sidebar`, `ProfileDialog`) are not re-exported. `AppRoutes` is **not** part of the surface (the route table stays in `App.tsx`, §3.3). The §2.6 lint rules enforce this against future cross-feature imports of shell.

### 3.5 Parity constraints & safety net

- **Visual regression (2%, Phase 2c)** guards the shell's *rendering* — pixel-identical. A VR failure is a regression, not a re-baseline trigger (Spec 14 §2.2). Note the shell renders only on authenticated screens (Login/TenantSelection don't use `Layout`).
- **Guard *behavior* parity is a Playwright-journey concern, not VR.** A wrong `requireTenant` redirect won't show in pixels. 21b confirms the existing journeys (login → tenant → mission-control) assert the auth/tenant redirect behavior, and adds a step if the redirect isn't covered.
- **Routes frozen** (Spec 14 §2.3): URLs unchanged; only the modules behind them move.
- The full preflight chain gates the merge; the import-rewrite is type-checked end-to-end.

### 3.6 `shell/README.md` + `TD-FE` (naming twin)

- Populate `src/features/shell/README.md`: purpose (the app frame features render inside), public surface (§3.4), key files, dependency notes (consumes `@/shared/auth`, `@/shared/tenant`, `@/components/ui`).
- Export the app sidebar hook as **`useAppSidebar`** from `shell/index.ts` (cheap clarity), even though there is no hard collision: shadcn's `ui/sidebar.tsx` `useSidebar` is module-private and cannot be imported. Log a **`TD-FE`** entry (next free number — 4a's knip-ignore entry claims the prior one) recording the name twin and that the rename to `useAppSidebar` is done at the barrel while the internal `SidebarContext.tsx` symbol rename is deferred.

### 3.7 Files touched (4b)

| File | Change |
|---|---|
| `src/features/shell/**` | New — `components/{Sidebar,Header,Layout,ProfileDialog}.tsx`, `ProtectedRoute.tsx`, `SidebarContext.tsx`, `index.ts`, `README.md` (moved-in content + barrel + doc). No `AppRoutes.tsx`. |
| `src/shared/auth/**` | New — `AuthContext.tsx`, `index.ts` (moved in) |
| `src/shared/tenant/**` | New — `TenantContext.tsx`, `index.ts` (moved in) |
| `src/hooks/useAuth.ts` | Edit — imports now from `@/shared/auth` + `@/shared/tenant` (file stays) |
| `src/components/layout/` | Deleted (emptied) |
| `src/components/ProtectedRoute.tsx`, `src/contexts/{AuthContext,SidebarContext,TenantContext}.tsx` | Deleted (moved) |
| `src/contexts/` | Deleted (empty) |
| `src/App.tsx` | Edit — imports only; `<Routes>` table unchanged in place |
| External import sites (per §3.2) | Edit — `@/contexts/...` → `@/shared/...` path rewrite |
| `knip.json` | Edit — remove the `src/shared/components/**` ignore **only if** Phase 5 (not 4b) consumes the boundary; otherwise unchanged in 4b |
| `docs/TECH_DEBT.md` | Edit — `TD-FE` (sidebar name twin; next free number after 4a's knip entry) |
| `specs/14-frontend-refactoring-master-plan-design.md` | Edit — 4b-branch amendments (§4) |

### 3.8 Phase 4b done-when

1. `src/features/shell/` populated per §3.1/§3.3/§3.4 with a `README.md`; `src/components/layout/` **deleted**.
2. `AuthContext` in `src/shared/auth/`, `TenantContext` in `src/shared/tenant/`, each with `index.ts`; old `src/contexts/*` deleted and **`src/contexts/` directory deleted**. `useAuth.ts` remains in `src/hooks/`, repointed to `@/shared/*`.
3. All import sites resolve to new locations; `tsc --noEmit` green.
4. `App.tsx` rewired (imports only); `<Routes>` table and provider nesting order unchanged; routes unchanged.
5. `shell/index.ts` exports `useAppSidebar`; cross-feature lint rules enforce against `shell/` with no violations.
6. `TD-FE-14` logged for the sidebar name twin.
7. `npm run preflight` green on `phase-4b-shell-extraction` immediately before merge — including pixel-parity visual regression and the guard-behavior journey assertions (§3.5).

---

## §4 Master Spec 14 amendments

Amendments split across the two branches so Spec 14 tracks reality as each sub-phase lands (§5.5 / R7). Each is its own dedicated `docs(spec-14):` commit, separate from code commits (Spec 14 §5.7). To respect Spec 14's "phase descriptions are a frozen record of intent" note, the **living sections** (status table, §8 open-questions list, §3.1/§3.3 structural references) are edited directly; the **frozen Phase 10/11 narrative blocks** are not rewritten — they receive a dated forward-annotation pointing to ADR-0002.

**On the 4a branch** (decisions + conventions, locked at spec approval):

- **§3.1 target layout** — add `shared/auth/`, `shared/tenant/`, `shared/components/` (target state; physical move is 4b).
- **§3.3 dependency rules** — add the transitional `features → legacy-dir` allowance clause (§2.2 here).
- **§4 status table** — replace the `4` row with `4a — Scaffolding + conventions` and `4b — Shell extraction` rows (status `pending`), mirroring 0a/0b.
- **§4 Phase 4 block** — record the sub-split; update the AuthContext line (→ `shared/auth/`); the FeatureErrorBoundary line (→ `shared/components/`); the lint-tool line (→ `eslint-plugin-import-x` **+ a resolver dependency**); **clarify "route shell"** = the `ProtectedRoute` guard + frame, *not* the `<Routes>` table (which stays in `App.tsx`); note feature folders are created lazily.
- **§8 open questions** — mark **RESOLVED**: Q5, Q6, Q7, Q11 (`shared/auth/`), Q13 (`shared/components/`), Q16 (`eslint-plugin-import-x`). Q10 stays open for Phase 9; the naming map reserves `profiler`.

**On the 4b branch** (realized outcomes):

- **§4 Phase 10 block** — append a dated annotation: "*Amended by Spec 21 (2026-05-29): `AuthContext`/`TenantContext` relocated to `src/shared/` in Phase 4b; this block's original Phase-10 context move is superseded — see ADR-0002. Phase 10 builds the Login/TenantSelection UIs consuming the shared primitives.*" (Original prose preserved, not rewritten.)
- **§4 Phase 11 block** — append a dated annotation: "*`shared/{auth,tenant,components}` already exist from Phase 4; Phase 11 promotes the remaining hooks/lib/types, and verifies `features/` hold no legacy-dir imports (see Spec 21 §2.2).*"

---

## §5 Per-phase workflow

Standard Spec 14 §5 cycle, run **twice** (once per sub-phase):

1. Brainstorm → this spec (covers both 4a and 4b)
2. `/review-spec` → `docs/reviews/21-frontend-phase-4-scaffolding-shell-design-spec-review-N.md`
3. `/synthesize-spec-review` → `…-synthesis-N.md`; loop until nit-or-below
4. **4a:** `/writing-plans` → `plans/21a-frontend-phase-4a-scaffolding.md` → `/review-plan` → `/synthesize-plan-review` (loop) → `/executing-plans` → `/review-impl` → `/synthesize-impl-review` (loop) → human-approved merge of `phase-4a-scaffolding`
5. **4b:** `/writing-plans` → `plans/21b-frontend-phase-4b-shell-extraction.md` → review/synthesis (loop) → execute → impl review/synthesis (loop) → human-approved merge of `phase-4b-shell-extraction`
6. Controller runs `npm run preflight` locally before each merge (§5.3/§5.6); green merges to `master`, red blocks and reports.

4a merges before 4b begins implementation (4b consumes 4a's conventions). The spec is shared; plans, branches, and impl-review cycles are per-sub-phase.

---

## §6 Definition of done (combined)

Phase 4 is done when **both** 4a (§2.10) and 4b (§3.8) are merged to `master`, and:

1. `src/features/` exists with a conventions README, a working scaffolder, and exactly one populated feature (`shell/`).
2. `src/shared/` has `auth/`, `tenant/`, `components/` (+ Phase-3 `api/`), each with an `index.ts`; `shared/README.md` documents promotion criteria.
3. `src/components/` no longer contains `layout/` or `ProtectedRoute.tsx`; `src/contexts/` is deleted; `src/hooks/useAuth.ts` remains (repointed to `@/shared/*`).
4. Cross-feature dependency lint rules + resolver are configured, proven non-vacuous by a positive test, and enforce against `shell/` with zero violations; `components/ui/` is locked.
5. `<FeatureErrorBoundary>` exists in `shared/components/` with passing tests (used from Phase 5; knip-ignored until then).
6. ADR template + ADR-0002 exist in `docs/adr/`.
7. `App.tsx` keeps the route table; only its imports changed; routes/behavior/visuals unchanged (VR + journeys green).
8. Spec 14 amended (§4) across the two branches.
9. `npm run preflight` green at both merges.

---

## §7 Risks and mitigations

### R1 — Lint rules silently no-op (4a)
Without a resolver, `import-x` path rules don't resolve `@/` aliases and pass as a false green, giving false confidence that carries through Phases 5–12.
**Mitigation:** §2.6 makes the resolver (`eslint-import-resolver-typescript` + `settings['import-x/resolver']`) a prerequisite, and 4a's done-when requires a **positive enforcement test** (a deliberate cross-feature deep import must be flagged), so a no-op rule cannot pass.

### R2 — `knip --strict` reds 4a's additive boundary (4a)
`FeatureErrorBoundary` has no consumer until Phase 5; production-mode knip flags it.
**Mitigation:** §2.5 knip-ignores `src/shared/components/**` in 4a with a `TD-FE` to revert at Phase 5.

### R3 — Import-rewrite blast radius (4b)
Repointing the external auth/tenant import sites risks a missed or wrong path.
**Mitigation:** `tsc --noEmit` fails on any bad import; staged move→rewrite→delete keeps commits green; the change is mechanical. Several apparent "sites" are files that move into `shell/` and need no separate rewrite (§3.2).

### R4 — `App.tsx` import rewire drifts the render tree (4b)
Changing providers' import sources or thinning `App.tsx` could subtly reorder the tree.
**Mitigation:** the `<Routes>` table and provider nesting order are preserved verbatim (§3.3); the route table is *not* relocated, so there is no new wrapper component. VR + Playwright journeys catch drift, including guard-redirect behavior.

### R5 — `shared/` placement diverges from the master plan (4b)
Promoting `TenantContext` in Phase 4 and placing both contexts in `shared/` deviates from Spec 14 as written.
**Mitigation:** recorded in ADR-0002 (with alternatives) and as dated Spec 14 annotations (§4). Phase 10 is correspondingly narrowed. Per Spec 14 §2 (MVP, velocity) and §5.5, one clean move now beats a two-step move.

### R6 — Index-only enforcement can't be expressed cleanly (4a)
Neither `no-internal-modules` (global + exhaustive allow-list) nor `no-restricted-paths` (per-pair zones) expresses "import feature B only via `B/index`" without friction.
**Mitigation:** §2.6 treats the mechanism as a 21a spike with `dependency-cruiser` as the Spec 14 fallback, gated by the positive enforcement test. Zone boundaries (`shared ↛ features`, `ui ↛ features|shared`) are unaffected and land regardless.

### R7 — 4a scaffolding proves wrong at Phase 5
The template is defined before a non-shell feature exercises it.
**Mitigation:** 4b's shell extraction is the immediate first consumer, exercising the template/scaffolder/lint/public-surface before Phase 5; gaps are fixed in 4b.

---

## §8 Open questions

### 8.1 Resolved in this spec (deferred from master §8)

- **Q5** shared promotion criteria → ≥2-feature rule (§2.3).
- **Q6** feature naming canonicalization → living kebab-case map (§2.2).
- **Q7** ADR template → slim 3-part (§2.8).
- **Q11** AuthContext home → `src/shared/auth/` (§3.2; ADR-0002).
- **Q13** FeatureErrorBoundary location → `src/shared/components/` (§2.5).
- **Q16** index.ts-only enforcement tool → `eslint-plugin-import-x` + resolver (§2.6); `dependency-cruiser` fallback for the index-only constraint.

### 8.2 Deferred to plans

1. **Index-only lint mechanism** — `import-x/no-internal-modules` (+ allow-list) vs a `no-restricted-paths` zone vs `dependency-cruiser`, validated by the positive enforcement test. → 21a plan (§2.6 R6).
2. **Resolver compatibility** — confirm `eslint-import-resolver-typescript` cooperates with the existing flat-config `import-x/order`. → 21a plan.
3. **`no-cycle` scope** — global vs `features/`-scoped, pending the pre-check. → 21a plan (§2.6).
4. **Exact external-rewrite site list** — enumerate the auth/tenant importers that stay put (vs. move into shell) and the rewrite mechanism (hand-edit vs ts-morph codemod). → 21b plan (§3.2).
5. **`ProtectedRoute` dependency set** — confirm the exact auth/tenant surface it consumes before the move. → 21b plan (§3.1).
6. **`useAuth.ts` final home** — stays in `src/hooks/` for Phase 4; a cross-context JWT/session hook's home is decided when Phase 10 (auth/tenant UIs) or Phase 11 (shared-utility extraction) settles. → Phase 10/11.

---

## §9 Companion documents

- `specs/14-frontend-refactoring-master-plan-design.md` — master plan; this phase amends §3.1, §3.3, §4 (status table + Phase 4 block; dated annotations on Phase 10/11), and §8 (Q5/Q6/Q7/Q11/Q13/Q16).
- `specs/15-frontend-phase-0-inventory-and-safety-net-design.md` — the one-spec/two-plans sub-split precedent (0a/0b) this spec mirrors.
- `specs/20-frontend-phase-3-api-data-layer-design.md` — predecessor; established `src/shared/api/` and the shared-layer conventions Phase 4 extends.
- `docs/reviews/21-frontend-phase-4-scaffolding-shell-design-spec-review-1.md`, `…-review-2.md`, `…-synthesis-2.md` — round-1 reviews (glm-5.1 + opus) and synthesis driving this round-2 revision.
- `docs/TECH_DEBT.md` — gains the knip-ignore (4a) and `TD-FE-14` sidebar-name-twin (4b) entries.
- Backend Phase K/L specs — the converged per-feature + `_helpers` shape the frontend `features/` + `shared/` mirror.
