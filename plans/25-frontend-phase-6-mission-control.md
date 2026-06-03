# Phase 6 — mission-control feature extraction · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the mission-control surface (`src/pages/MissionControl.tsx` + `src/components/mission-control/*`, 11,632 LOC across 3 monoliths) into `src/features/mission-control/`, migrate its read paths to TanStack Query, wrap it in an error boundary, sweep ICPManager's dead code, and land the cross-feature enabling infra (per-feature route registry + the `index.ts`-only lint, TD-FE-15) the 6–12 stretch depends on.

**Architecture:** One branch (`phase-6-mission-control`), one `--no-ff` merge. Six sequential green checkpoints (Spec 14 §5.7), each a commit-series: (1) enabling infra, (2) scaffold+relocate+promote, (3) read-path data layer, (4) MissionControl decomposition, (5) DataSourcesManager decomposition, (6) ICPManager decomposition + finalize. Mirrors the Phase 5 (market-research, Spec 24) extraction. Reads → TanStack via the existing `@/shared/api/client` + zod pattern; **writes/mutations stay raw `fetch` (deferred to a later mutation pass — TD-FE)**.

**Tech Stack:** React 18 + Vite + TypeScript (strict), `@tanstack/react-query` (memory-only client, `@/shared/api/queryClient`), zod contracts parsed at the fetch boundary (`@/shared/api/client`), Vitest + RTL + MSW (`@/test/msw/server`), Playwright e2e + VR (journeys 01/02/05), ESLint flat config (`eslint-plugin-import-x` ~4.15), knip --strict, React Router v6 (declarative `<Routes>`).

**Paired spec:** `specs/25-frontend-phase-6-mission-control-design.md` (converged through 2 review rounds). Read it before starting.

---

## Conventions & execution rules (read first — these override habits)

- **All FE tooling runs from `frontend/`.** `npm`/`vite`/`eslint`/`tsc` only there; there is no root `package.json`.
- **Branch & merge.** Work on `phase-6-mission-control` off `master`. The whole phase merges once, `--no-ff`, after the stage-6 serial preflight is green. Do not merge per-stage.
- **Surgical commits in a shared tree.** Other agents may share this working tree. **Never `git add -A`/`git add .`** Stage only the explicit paths each task names: `git add <path> <path> …`. If executing in a `.claude/worktrees/` worktree, use `git -C <worktree-abs-path> …` for every git op (a bare `cd <repo-root>` lands in the main `master` checkout, not the worktree).
- **Commit messages.** `type(scope):` form (`feat(fe):`, `refactor(fe):`, `chore(fe):`, `test(fe):`, `docs(fe):`). No `[N/M]` suffixes. **No `Co-Authored-By` footer.** Body optional (only when the *why* isn't obvious). One logical step = one commit (the plan already splits them).
- **Inner loop (between tasks):** `npm run verify` (= `typecheck && lint && test`, `package.json:18`). Fast; no build/e2e.
- **Stage gate (end of each stage):** `npm run verify` **plus** the relevant Playwright journeys + VR. Stage 1 keeps the market-research journeys green; stages 2–6 keep `01-login-tenant-mission`, `02-csv-upload-leads`, `05-icp-create` (and their VR snapshots `04-mission-control-loaded`, `01-mission-control-empty-icp`) green.
- **Before any e2e run in a worktree:** kill orphan Vite preview servers first (`pkill -f "vite preview" || true`; confirm nothing is listening on `:5173`). A stale preview server serving the wrong build produces false-green VR.
- **Final merge gate:** serial `npm run preflight` (typecheck + lint + format:check + test + build + bundle:check + test:e2e + knip --strict). Use the **serial** `preflight`, not `preflight:par` (the parallel runner spikes CPU and flakes the VR tests under contention).
- **Vitest flake note.** The committed config bounds concurrency via `maxWorkers: 4` (`vitest.config.ts`). If the full suite flakes async `waitFor` tests under sandbox CPU contention, re-run that file with `npx vitest run <path> --no-file-parallelism` — an **ad-hoc run flag only; do not commit a config change.**
- **`docs/TECH_DEBT.md` is outside the frontend prettier gate. Never prettier it.** Append entries surgically (the frontend `format:check` runs on `frontend/.` and won't touch root docs; a manual prettier run would corrupt its unfenced markdown).
- **Polyglot rule (CLAUDE.md):** confirm each backend read's live JSON shape (devtools Network tab or `curl` via the Vite `/api` proxy) before relying on a field — there is no generated client. The zod schemas in this plan are deliberately loose (`.passthrough()` + `.nullish()`); confirm-live is a stage-3 task, not a blocker.
- **Security posture:** MVP, 0 users. Do **not** add auth/authz/hardening, and do not act on the repo's Dependabot alerts.
- **Abort, escalation & recovery.** Each stage ends at a known **gate commit** (its last task's commit). **Stop and report to the operator — do not keep retrying** — if any of these hit: a stage gate that won't go green after **two** fix attempts; a Task-9 live-shape divergence the loose `.passthrough()` schemas cannot absorb (a backend contract fundamentally incompatible with the read hooks); or the scaffold script missing/producing unexpected output (Task 5). To roll a broken stage back to its last green point: `git reset --hard <that stage's gate commit>`, else report-and-wait. Mid-task failures are owned by the executor skill's BLOCKED handling (subagent-driven-development) — surface them, don't silently retry the same approach.
- **Line numbers are approximate anchors.** In the relocation/decomposition tasks (stages 2, 4–6) the cited line ranges are from the **pre-edit** files and drift as earlier tasks run. Locate code by the **quoted identifiers / JSX / import text** (stable), not the number — e.g. find the `<TabsContent value="profile">…</TabsContent>` block, or the `handle<Platform>Approve`/`handle<Platform>Deny` functions and `isConnectorDialogOpen` by name.

---

## File structure (what each new/changed unit owns)

**Created — enabling infra (stage 1):**
- `frontend/src/app/routes.tsx` — append-only feature route registry; aggregates each feature's `<Route>` array via its index barrel.
- `frontend/src/features/market-research/routes.tsx` — market-research's `<Route>` array (the worked example).

**Created — mission-control feature (stages 2–6):**
- `frontend/src/features/mission-control/` — `types.ts`, `index.ts`, `README.md` (scaffolded), `routes.tsx`, `contracts.ts`.
- `…/pages/MissionControlPage.tsx` — thin 3-tab shell (decomposed in stage 4).
- `…/components/company-profile/` — company-profile form + connector-approval cluster (stage 4).
- `…/components/data-sources/` — uploader, lead-stream table, source form, thin container (stage 5).
- `…/components/icp/` — ICP list/filter, add/edit wizard, profiler-merge view, thin container (stage 6).
- `…/hooks/` — `useICPs.ts`, `useDataSources.ts`, `useLeadStreamStatus.ts` (stage 3).
- `…/services/missionControl.ts` — read-endpoint fetchers (stage 3).
- `…/__tests__/` (and co-located `<dir>/__tests__/`) — Vitest/RTL/MSW (per Phase 5 convention).

**Created — shared (stage 2b):**
- `frontend/src/shared/profiler/` — the three promoted profiler-ICP utils + an `index.ts` barrel.

**Modified:**
- `frontend/src/App.tsx` — drop deep page imports + inline market-research/mission-control routes; render `{featureRoutes}`.
- `frontend/src/features/market-research/index.ts` — add `export { marketResearchRoutes }`.
- `frontend/src/features/market-research/**` — convert alias self-imports (`@/features/market-research/…`) to relative (stage 1b).
- `frontend/src/features/README.md` — document the route-registry + relative-self-import conventions.
- `frontend/eslint.config.js` — add `import-x/no-internal-modules` (index-only cross-feature lint).
- `frontend/src/shared/api/queryKeys.ts` — add `icps`, `dataSources`, `leadStreamStatus` keys.
- `frontend/src/components/customers/SuggestedICPCards.tsx` — repoint the 3 util imports to `@/shared/profiler` (stage 2b).
- `docs/TECH_DEBT.md` — resolve TD-FE-15 (stage 1b); allocate the deferred Phase-6 TD-FE entries (stage 6).
- `specs/14-frontend-refactoring-master-plan-design.md` — §8 Q16 (stage 1b) and §4 status row Phase 6 → done (at merge).

**Moved (git mv, parity — no logic change):**
- `src/pages/MissionControl.tsx` → `src/features/mission-control/pages/MissionControlPage.tsx`
- `src/components/mission-control/DataSourcesManager.tsx` → `src/features/mission-control/components/data-sources/DataSourcesManager.tsx`
- `src/components/mission-control/ICPManager.tsx` → `src/features/mission-control/components/icp/ICPManager.tsx`
- `src/utils/profilerAcceptedIcpDisplay.ts`, `src/utils/profileIcpsExtract.ts`, `src/lib/missionProfilerSessionCache.ts` → `src/shared/profiler/`

**Deleted:**
- ICPManager's commented-out legacy shadow (lines **1–1634** of the moved file).

---

# Stage 1 — Enabling infra

> Two checkpoints: **1a** route registry (registry first), **1b** lint (lint second). Order matters: the registry removes `App.tsx`'s deep `@/features/market-research/pages/MarketResearchPage` import, which the 1b lint would otherwise flag. Stage 1 keeps the **market-research** journeys green (mission-control is untouched here).

## Task 1: Per-feature route registry + convert the market-research route

**Files:**
- Create: `frontend/src/app/routes.tsx`
- Create: `frontend/src/features/market-research/routes.tsx`
- Modify: `frontend/src/features/market-research/index.ts`
- Modify: `frontend/src/App.tsx` (remove `import MarketResearchPage …` at line 22; remove the 3 market-research `<Route>` at lines 124–141; add the registry import + render)

Context: `App.tsx` is the single central `<Routes>` table (lines 36–167, React Router v6 declarative). Today the market-research route is wired with a **deep page import** (`@/features/market-research/pages/MarketResearchPage`, App.tsx:22) and wrapped in `<ProtectedRoute requireTenant>` + `<FeatureErrorBoundary featureName="Market Research">` (App.tsx:128–137). There is no `src/app/` dir and no per-feature `routes.tsx` yet — this task creates the convention.

- [ ] **Step 1: Create `frontend/src/features/market-research/routes.tsx`**

```tsx
import { Navigate, Route } from "react-router-dom";

import MarketResearchPage from "./pages/MarketResearchPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/**
 * Market-research route surface. Composed (append-only) by `src/app/routes.tsx`.
 * Each entry carries a stable `key` so React Router's createRoutesFromChildren
 * accepts the spread array. Self-imports use relative paths (`./pages/...`);
 * cross-feature deps come via index barrels (`@/features/shell`, `@/shared/...`).
 */
export const marketResearchRoutes = [
  <Route
    key="market-research-redirect"
    path="/market-research"
    element={<Navigate to="/your-ai-team/scout/marketintelligence" replace />}
  />,
  <Route
    key="scout-tab"
    path="/your-ai-team/scout/:tab"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Market Research">
          <MarketResearchPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
  <Route
    key="scout-index-redirect"
    path="/your-ai-team/scout"
    element={<Navigate to="/your-ai-team/scout/marketintelligence" replace />}
  />,
];
```

- [ ] **Step 2: Re-export it from the feature barrel.** Append to `frontend/src/features/market-research/index.ts`:

```ts
export { marketResearchRoutes } from "./routes";
```

- [ ] **Step 3: Create `frontend/src/app/routes.tsx`**

```tsx
/**
 * Append-only per-feature route registry (Spec 14 §4 "First enabling task").
 * Each feature contributes its `<Route>` array via its index barrel — never a
 * deep path — so feature phases append one line here and own their routes in
 * `<feature>/routes.tsx`, instead of editing App.tsx's shared `<Routes>` table.
 */
import { marketResearchRoutes } from "@/features/market-research";

export const featureRoutes = [...marketResearchRoutes];
```

- [ ] **Step 4: Wire it into `App.tsx`.** Remove the deep page import (App.tsx:22 `import MarketResearchPage from "@/features/market-research/pages/MarketResearchPage";`) and the three market-research `<Route>` entries (App.tsx:124–141). Add, with the other `@/` imports near the top:

```tsx
import { featureRoutes } from "@/app/routes";
```

Then render the registry inside `<Routes>`, immediately before the catch-all `<Route path="*" …>`:

```tsx
                {featureRoutes}
```

- [ ] **Step 5: Verify.** Run from `frontend/`:

```
npm run verify
```
Expected: PASS (typecheck + lint + test). The `@` alias resolves `@/app/routes` to `src/app/routes.tsx` (no tsconfig change needed). Then preview-build + smoke the market-research route still resolves:

```
pkill -f "vite preview" || true
npm run build && npm run test:e2e -- e2e/journeys
```
Expected: the market-research journey(s) PASS; route `/your-ai-team/scout/marketintelligence` renders via the registry.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/routes.tsx frontend/src/features/market-research/routes.tsx frontend/src/features/market-research/index.ts frontend/src/App.tsx
git commit -m "refactor(fe): add per-feature route registry; route market-research via it"
```

## Task 2: Document the route-registry + relative-self-import conventions

**Files:** Modify `frontend/src/features/README.md`

Context: the README already has a "Dependency rules" + "Public-surface convention" section. Add the two new conventions this phase establishes, so future feature phases follow them and the stage-1b lint is self-documenting.

- [ ] **Step 1: Append a "Route registry" subsection** to `frontend/src/features/README.md` (after "Public-surface convention"):

```md
## Route registry

Each feature that owns routes exposes them from `<feature>/routes.tsx` as an array of keyed `<Route>` elements, re-exported from `index.ts` (`export { <feature>Routes } from "./routes";`). `src/app/routes.tsx` composes them append-only — a feature phase adds one `...<feature>Routes` line there and never edits App.tsx's `<Routes>` table. App.tsx renders `{featureRoutes}` inside `<Routes>`. Route wrapping (`ProtectedRoute`, `FeatureErrorBoundary`) lives in the feature's own `routes.tsx`.

## Intra-feature imports are relative

Within a feature, import your own modules with **relative paths** (`./`, `../`). Reserve the `@/features/<X>/…` alias for **cross-feature** imports — which must target the index only (`@/features/<X>`), enforced by `import-x/no-internal-modules` (see Dependency rules). This keeps "self imports" out of the cross-feature lint's scope.
```

- [ ] **Step 2: Verify** there are no broken links/formatting:

```
npm run lint -- src/features/README.md || true
npx prettier --check src/features/README.md
```
Expected: prettier reports the file formatted (or run `npx prettier --write src/features/README.md` — README is inside the frontend prettier gate, unlike `docs/TECH_DEBT.md`).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/README.md
git commit -m "docs(fe): document route-registry and relative-self-import conventions"
```

## Task 3: Convert market-research alias self-imports to relative

**Files:** Modify `frontend/src/features/market-research/**` (every file that imports `@/features/market-research/…`)

Context: the stage-1b lint forbids `@/features/*/*` and `@/features/*/**`. Some market-research files import their own internals via the alias (e.g. `…/market-size/useMarketSize.ts` imports `@/features/market-research/hooks/useMarketResearch` and `@/features/market-research/services/marketResearch`; `…/market-size/types.ts` imports `@/features/market-research/contracts`; several `__tests__` files too). Those are legitimate self-imports the lint would otherwise flag. Convert them to relative **before** adding the rule, so lint is green the moment the rule lands.

- [ ] **Step 1: Enumerate the self-imports.** From `frontend/`:

```
grep -rn '@/features/market-research/' src/features/market-research/
```
Expected: a list of import sites (source + tests) referencing the feature's own subpaths.

- [ ] **Step 2: Convert each to a relative path.** For each hit, replace `@/features/market-research/<rest>` with the correct relative path from that file's location. Examples:
  - In `src/features/market-research/components/intelligence/market-size/useMarketSize.ts`: `@/features/market-research/hooks/useMarketResearch` → `../../../../hooks/useMarketResearch`; `@/features/market-research/services/marketResearch` → `../../../../services/marketResearch`.
  - In `src/features/market-research/components/intelligence/market-size/types.ts`: `@/features/market-research/contracts` → `../../../../contracts`.
  - Apply the same mechanical rule everywhere the grep flagged (count the directory depth from the importing file to the feature root, then descend). **Do not** convert `@/shared/…`, `@/components/ui/…`, `@/features/shell`, or npm imports — only `@/features/market-research/…` self-references.

- [ ] **Step 3: Confirm none remain.**

```
grep -rn '@/features/market-research/' src/features/market-research/
```
Expected: no output.

- [ ] **Step 4: Verify** nothing broke (import resolution + import-x/order may reorder groups):

```
npm run verify
```
Expected: PASS. If `import-x/order` complains, let `eslint --fix` reorder (relative imports group differently than the `@/` alias group): `npm run lint -- --fix src/features/market-research` then re-run `npm run verify`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/market-research
git commit -m "refactor(fe): use relative imports within the market-research feature"
```

## Task 4: Add the index-only cross-feature lint (resolve TD-FE-15)

**Files:**
- Modify: `frontend/eslint.config.js` (add `import-x/no-internal-modules` to the main `rules` block, ~lines 35–93)
- Modify: `docs/TECH_DEBT.md` (mark TD-FE-15 resolved — **append surgically, no prettier**)
- Modify: `specs/14-frontend-refactoring-master-plan-design.md` (§8 Q16)

Context: `eslint-plugin-import-x` (~4.15) is already installed and registered as the `import-x` plugin; the cross-feature deep-import ban is documented in `src/features/README.md` but **not** currently enforced by any rule (only `no-restricted-paths` zones + `no-cycle` exist). This task lands the rule. The "4a probe" referenced in the spec is the acceptance check in Step 3 (no pre-existing probe file exists).

- [ ] **Step 1: Add the rule.** In `frontend/eslint.config.js`, inside the main `rules: { … }` object (alongside `import-x/no-cycle`), add:

```js
      // Index-only cross-feature imports (TD-FE-15). A feature's internals are
      // private; cross-feature consumers import via "@/features/<X>" only.
      // Same-feature imports are relative (see src/features/README.md), so they
      // are not matched by these alias globs. ~95 pre-existing legitimate
      // relative/external deep imports are unaffected (they are not "@/features/*").
      "import-x/no-internal-modules": [
        "error",
        {
          forbid: ["@/features/*/*", "@/features/*/**"],
        },
      ],
```

- [ ] **Step 2: Run lint and resolve any violations.** From `frontend/`:

```
npm run lint
```
Expected: PASS. If any `no-internal-modules` violations appear:
  - **Same-feature** alias self-import → convert to relative (as Task 3; should already be done for market-research).
  - **Cross-feature** deep import → repoint through the target feature's index (`@/features/<X>`); add the needed symbol to that feature's `index.ts` if missing.
  - **`e2e/**` or `scripts/**`** violation (page objects deep-importing a feature) → if present, scope the rule to source only by also adding it inside a `{ files: ["src/**/*.{ts,tsx}"], rules: { … } }` block instead of the global rules (and remove it from the global block). Re-run `npm run lint`.

- [ ] **Step 3: Verify the probe (acceptance check).** Temporarily add, at the top of `frontend/src/App.tsx`, a deliberate bad import and a good one:

```tsx
import { useResearchComponent } from "@/features/market-research"; // GOOD — index, allowed
import { useResearchComponent as _bad } from "@/features/market-research/hooks/useMarketResearch"; // BAD — deep, must be flagged
```
Run `npm run lint`. Expected: exactly **one** `import-x/no-internal-modules` error, on the deep `…/hooks/useMarketResearch` line; the bare `@/features/market-research` line is clean. **Then remove both probe lines** and confirm `npm run lint` is green again.

- [ ] **Step 4: Resolve TD-FE-15 in the register.** In `docs/TECH_DEBT.md`, locate the TD-FE-15 entry and append a `**Resolved:**` line (surgical edit — do not reflow the file, do not run prettier on it), e.g.:

```
**Resolved:** Phase 6 (stage 1b) — `import-x/no-internal-modules` (forbid `@/features/*/*`, `@/features/*/**`) added to `frontend/eslint.config.js`; same-feature imports converted to relative; cross-feature import is index-only.
```

- [ ] **Step 5: Update Spec 14 §8 Q16.** In `specs/14-frontend-refactoring-master-plan-design.md` §8 Q16 (the index-only cross-feature lint question), mark it resolved/implemented in Phase 6, referencing `eslint.config.js` and TD-FE-15. Keep the edit minimal.

- [ ] **Step 6: Verify**

```
npm run verify
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/eslint.config.js docs/TECH_DEBT.md specs/14-frontend-refactoring-master-plan-design.md
git commit -m "feat(fe): enforce index-only cross-feature imports (resolve TD-FE-15)"
```

**Stage 1 gate:** `npm run verify` green; market-research journeys + VR green; lint enforces the boundary. App.tsx no longer deep-imports a feature page.

---

# Stage 2 — Scaffold, relocate (2a) + promote util cluster (2b)

> **2a** is intra-feature (low risk): scaffold, `git mv` the three monoliths, route via the registry with the error boundary, delete ICPManager dead code. **2b** touches `customers` (a Phase-7 file): promote the shared profiler-ICP cluster to `@/shared/profiler` and repoint importers. Separate checkpoints so a 2b break reverts only 2b. Parity move — **no logic change**; journeys 01/02/05 + VR green after each.

## Task 5: Scaffold the feature and relocate the three monoliths

**Files:**
- Run scaffolder → creates `frontend/src/features/mission-control/{types.ts,index.ts,README.md}`
- Move: the three files (see below)
- Modify: the moved files' internal imports of each other

- [ ] **Step 1: Scaffold.** From `frontend/`:

```
npm run scaffold:feature -- mission-control
```
Expected: `scaffolded src/features/mission-control/ (types.ts, index.ts, README.md)`, no naming-map warning (mission-control is on the map). The stubs (`types.ts` comment-only, `index.ts` with `export {};`, README placeholder) are finalized in later stages. **Fallback:** if the script is absent (check `npm run | grep scaffold`), create the three files by hand — `src/features/mission-control/{types.ts,index.ts,README.md}` (`index.ts` = `export {};`, `types.ts` = a header comment, `README.md` = a `# mission-control feature` placeholder) — and continue.

- [ ] **Step 2: Move the three files** (preserve history; use `git mv`). From `frontend/`:

```bash
mkdir -p src/features/mission-control/pages src/features/mission-control/components/data-sources src/features/mission-control/components/icp
git mv src/pages/MissionControl.tsx src/features/mission-control/pages/MissionControlPage.tsx
git mv src/components/mission-control/DataSourcesManager.tsx src/features/mission-control/components/data-sources/DataSourcesManager.tsx
git mv src/components/mission-control/ICPManager.tsx src/features/mission-control/components/icp/ICPManager.tsx
```
(If `src/components/mission-control/` is now empty, leave it; knip/lint don't fail on an empty dir, and `git` won't track it.)

- [ ] **Step 3: Rename the page component.** In `src/features/mission-control/pages/MissionControlPage.tsx`, rename the component `MissionControl` → `MissionControlPage` (the function/const declaration and the `export default`). This is a mechanical identifier rename within one file.

- [ ] **Step 4: Fix the page's imports of the two managers.** In `MissionControlPage.tsx`, the imports `@/components/mission-control/DataSourcesManager` (was line 20) and `@/components/mission-control/ICPManager` (was line 21) now point at moved files. Repoint to relative:

```tsx
import DataSourcesManager from "../components/data-sources/DataSourcesManager";
import ICPManager from "../components/icp/ICPManager";
```

- [ ] **Step 5: Find and fix any other importers of the moved files.** From `frontend/`:

```
grep -rn -e '@/pages/MissionControl' -e '@/components/mission-control/' -e 'pages/MissionControl"' src/ e2e/
```
Expected importers: `App.tsx` (the page — handled in Task 6) and the page's own manager imports (Step 4). Repoint any other hits (none expected). The moved files' remaining `@/…` alias imports (utils, ui, lib, shared) are unaffected by the move.

- [ ] **Step 6: Verify**

```
npm run verify
```
Expected: typecheck PASS. (Lint may flag `import-x/order` after the moves — run `npm run lint -- --fix src/features/mission-control` then re-verify.) The route is temporarily broken until Task 6 re-wires it; that's fine within the stage.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/mission-control frontend/src/pages frontend/src/components/mission-control
git commit -m "refactor(fe): relocate mission-control files into src/features/mission-control"
```

## Task 6: Route mission-control via the registry with a FeatureErrorBoundary

**Files:**
- Create: `frontend/src/features/mission-control/routes.tsx`
- Modify: `frontend/src/features/mission-control/index.ts`
- Modify: `frontend/src/app/routes.tsx`
- Modify: `frontend/src/App.tsx` (remove `import MissionControl …` at line 11; remove the inline `/mission-control` route at lines 52–59)

- [ ] **Step 1: Create `frontend/src/features/mission-control/routes.tsx`** — adds the `FeatureErrorBoundary` the route lacked:

```tsx
import { Route } from "react-router-dom";

import MissionControlPage from "./pages/MissionControlPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/** Mission-control route surface. Composed (append-only) by `src/app/routes.tsx`. */
export const missionControlRoutes = [
  <Route
    key="mission-control"
    path="/mission-control"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Mission Control">
          <MissionControlPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
```

- [ ] **Step 2: Re-export from the barrel.** In `frontend/src/features/mission-control/index.ts`, replace the scaffold's `export {};` with:

```ts
// Public surface for the `mission-control` feature.
// Cross-feature consumers (customers, Phase 7) import from "@/features/mission-control", never a deep path.
export { missionControlRoutes } from "./routes";
```
(The cross-feature read surface — `ICP` type + `useICPs` — is added when it exists, in stage 6.)

- [ ] **Step 3: Append to the registry.** In `frontend/src/app/routes.tsx`:

```tsx
import { marketResearchRoutes } from "@/features/market-research";
import { missionControlRoutes } from "@/features/mission-control";

export const featureRoutes = [...marketResearchRoutes, ...missionControlRoutes];
```

- [ ] **Step 4: Remove the inline route from App.tsx.** Delete the deep page import (App.tsx:11 `import MissionControl from "./pages/MissionControl";`) and the inline `<Route path="/mission-control" …>` block (App.tsx:52–59). The registry now supplies it.

- [ ] **Step 5: Verify route + parity.**

```
npm run verify
pkill -f "vite preview" || true
npm run build && npm run test:e2e -- e2e/journeys
```
Expected: `01-login-tenant-mission` (+ VR `04-mission-control-loaded`), `02-csv-upload-leads`, `05-icp-create` (+ VR `01-mission-control-empty-icp`) all PASS; `/mission-control` resolves with the error boundary in place.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/mission-control/routes.tsx frontend/src/features/mission-control/index.ts frontend/src/app/routes.tsx frontend/src/App.tsx
git commit -m "refactor(fe): route mission-control via feature registry with error boundary"
```

## Task 7: Delete ICPManager's commented-out legacy shadow

**Files:** Modify `frontend/src/features/mission-control/components/icp/ICPManager.tsx`

Context: lines **1–1633** are a fully commented-out earlier copy of the component (imports → component body → `// export default ICPManager;` at 1633); line 1634 is blank; the live code starts at line 1635 (`import { Plus, … } from "lucide-react";`). ~1,569 comment lines. The two "fetch sites" the spec mentions in commented code (≈ lines 238–240) live inside this block and go away with it.

- [ ] **Step 1: Delete lines 1–1634** of `ICPManager.tsx` so the file begins at the real import block (former line 1635). Confirm the first line is now `import { Plus, Trash2, Edit, X, Check, Target, Eye, ChevronsUpDown } from "lucide-react";`.

- [ ] **Step 2: Confirm no live code referenced the block** and the file still compiles + has no stray commented component:

```
grep -n 'export default ICPManager' src/features/mission-control/components/icp/ICPManager.tsx
grep -cn '^[[:space:]]*//' src/features/mission-control/components/icp/ICPManager.tsx
```
Expected: exactly one `export default ICPManager` (the live one, formerly ~line 3300+); the comment-line count drops to a small number (incidental inline comments only, not a contiguous shadow).

- [ ] **Step 3: Verify + parity.**

```
npm run verify
pkill -f "vite preview" || true
npm run build && npm run test:e2e -- e2e/journeys/05-icp-create.spec.ts
```
Expected: PASS; journey 05 + its VR snapshot green (ICPManager renders identically — only dead comments removed).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/mission-control/components/icp/ICPManager.tsx
git commit -m "chore(fe): delete ICPManager commented-out legacy shadow"
```

## Task 8: Promote the profiler-ICP util cluster to `@/shared/profiler` (2b)

**Files:**
- Move: the three utils → `frontend/src/shared/profiler/`
- Create: `frontend/src/shared/profiler/index.ts` (barrel)
- Modify importers: `SuggestedICPCards.tsx` (customers), `MissionControlPage.tsx`, `ICPManager.tsx`

Context: all three utils are imported by both mission-control and `customers/SuggestedICPCards.tsx`, so they belong in `src/shared/`. Importer/symbol map (verified):
- `profileIcpsExtract.ts` (exports `extractIcpsDataFromFlexibleApiResponse`, `fetchIcpsRowsForOrg`; **no imports** — clean move) — used by SuggestedICPCards (`fetchIcpsRowsForOrg`), MissionControlPage (`extractIcpsDataFromFlexibleApiResponse`), ICPManager (`extractIcpsDataFromFlexibleApiResponse`).
- `missionProfilerSessionCache.ts` (10 exports; **no imports** — clean move) — used by SuggestedICPCards (4 symbols) and MissionControlPage.
- `profilerAcceptedIcpDisplay.ts` (16 exports; imports **one** type-only `@/lib/types/escape-hatches` → `UntypedProfilerIcpRecord`, which stays as-is — `@/shared` may import `@/lib`, only `no-restricted-paths` forbids `shared←features`) — used by SuggestedICPCards (12 symbols) and ICPManager (2 symbols).

This is one atomic commit (intermediate states don't compile).

- [ ] **Step 1: Move the three files.** From `frontend/`:

```bash
mkdir -p src/shared/profiler
git mv src/utils/profileIcpsExtract.ts src/shared/profiler/profileIcpsExtract.ts
git mv src/utils/profilerAcceptedIcpDisplay.ts src/shared/profiler/profilerAcceptedIcpDisplay.ts
git mv src/lib/missionProfilerSessionCache.ts src/shared/profiler/missionProfilerSessionCache.ts
```

- [ ] **Step 2: Move any co-located tests.** Check and move:

```
grep -rln -e 'profileIcpsExtract' -e 'profilerAcceptedIcpDisplay' -e 'missionProfilerSessionCache' src/ 2>/dev/null
```
(`-r` over all of `src/` catches a co-located util test wherever it is nested.)
If any `*.test.ts` for these utils exist under `src/utils/__tests__` or `src/lib/__tests__`, `git mv` them to `src/shared/profiler/__tests__/` and update their import path to `../`.

- [ ] **Step 3: Create the barrel `frontend/src/shared/profiler/index.ts`** (mirrors the per-subdir `@/shared/<x>` convention):

```ts
// Shared profiler-ICP utilities — consumed by mission-control (Phase 6) and
// customers (Phase 7). Promoted from src/utils + src/lib in Phase 6 (Spec 25 §6).
export * from "./profileIcpsExtract";
export * from "./profilerAcceptedIcpDisplay";
export * from "./missionProfilerSessionCache";
```

- [ ] **Step 4: Repoint `customers/SuggestedICPCards.tsx`.** Replace its three import sources (was lines 51–56 `@/lib/missionProfilerSessionCache`, line 60 `@/utils/profileIcpsExtract`, lines 61–74 `@/utils/profilerAcceptedIcpDisplay`) so all those symbols import from `@/shared/profiler`. The cleanest form — one import block:

```tsx
import {
  ensureMissionProfilerScope,
  isProfilerCacheValid,
  getProfilerSnapshot,
  commitProfilerSnapshot,
  fetchIcpsRowsForOrg,
  mergeProfilerAcceptedIcpDisplay,
  saveProfilerAcceptedIcpDisplayMeta,
  copyProfilerDisplayMetaToProfileId,
  extractPersistedIcpIdFromSuggestedProfileResponse,
  extractIcpsArrayFromCustomerProfileResponse,
  mergeSuggestedIntoCustomerProfileApiRow,
  buildCustomerProfileSavePayload,
  mapCustomerProfileApiRowsToStoredIcps,
  resolveAcceptedPersistedIcpId,
  type SuggestedIcpCardFields,
  PROFILER_ICP_DISPLAY_KEY,
  removeProfilerAcceptedIcpDisplayMeta,
} from "@/shared/profiler";
```
Leave its other imports (`@/lib/api`, `@/lib/types/escape-hatches`, `@/shared/auth`, `@/utils/cacheUtils`) untouched.

- [ ] **Step 5: Repoint `MissionControlPage.tsx`.** Change its `@/lib/missionProfilerSessionCache` import (the multi-line block closing at old line 70) and `@/utils/profileIcpsExtract` import (old line 72, `extractIcpsDataFromFlexibleApiResponse`) to `@/shared/profiler` (merge into one import block from `@/shared/profiler`).

- [ ] **Step 6: Repoint `ICPManager.tsx`.** Change its `@/utils/profileIcpsExtract` (`extractIcpsDataFromFlexibleApiResponse`) and `@/utils/profilerAcceptedIcpDisplay` (`mergeProfilerAcceptedIcpDisplay`, `removeProfilerAcceptedIcpDisplayMeta`) imports to `@/shared/profiler`.

- [ ] **Step 7: Confirm no stale references** to the old paths:

```
grep -rn -e '@/utils/profileIcpsExtract' -e '@/utils/profilerAcceptedIcpDisplay' -e '@/lib/missionProfilerSessionCache' src/ e2e/
```
Expected: no output.

- [ ] **Step 8: Verify + parity** (touches customers — run the full inner loop + journeys):

```
npm run lint -- --fix src/shared/profiler src/components/customers src/features/mission-control
npm run verify
pkill -f "vite preview" || true
npm run build && npm run test:e2e -- e2e/journeys
```
Expected: PASS; journeys 01/02/05 + VR green (SuggestedICPCards and the managers behave identically — only import paths changed).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/shared/profiler frontend/src/utils frontend/src/lib frontend/src/components/customers/SuggestedICPCards.tsx frontend/src/features/mission-control
git commit -m "refactor(fe): promote profiler-ICP util cluster to src/shared/profiler"
```

**Stage 2 gate:** feature populated with relocated files; `/mission-control` routed via the registry with `<FeatureErrorBoundary>`; ICPManager dead code gone; cluster in `@/shared/profiler` with all importers repointed; journeys 01/02/05 + VR green.

---

# Stage 3 — Read-path data layer (hook-first)

> Build the read layer **before** decomposing the components that will consume it. Reads only: ICP rows, data-source list, lead-stream status, company-profile (reuse). Writes/mutations stay raw `fetch` (deferred). Each hook ships with a Vitest test using `server.use(http.get(...))`.

## Task 9: Confirm live response shapes (polyglot rule)

Context: CLAUDE.md requires confirming a backend read's live JSON shape before relying on fields. The Vite `/api` proxy targets the Render backend; the backend trusts query-param `user_id`/`org_id` (no JWT validation). The schemas below are loose, so this de-risks rather than blocks.

**Prerequisite:** the backend must be reachable (Render proxy or local) **and** a test org must have ≥1 uploaded document, ≥1 lead-stream file, and ≥1 ICP (so the shapes come back non-empty). If that is unavailable, record it as a **non-halting blocker** and proceed to Task 10 with the loose schemas as-is — confirm-live can be revisited before the stage-3 commit. Do not block the phase on it (per the conventions: confirm-live is not a merge blocker).

- [ ] **Step 1: Confirm the three reads.** With the app running (or via `curl` through the proxy/devtools Network tab), capture the JSON for:
  - `GET /api/customer_profile?org_id=<org>` (ICP rows) and `GET /api/profile/company?org_id=<org>` (the two reads inside `fetchIcpsRowsForOrg`).
  - `GET /api/user-documents?org_id=<org>` (data-source list).
  - `GET /api/leads/stream/status?user_id=<uid>&org_id=<org>` (lead-stream status).
- [ ] **Step 2: Note divergences.** If a top-level shape differs from the schemas in Task 10 (e.g. the data-source envelope key is neither `documents`/`files`/`data`, or lead-stream is neither `{files}` nor a bare array), record it and widen the schema/normalizer accordingly. No commit (verification step).

## Task 10: Contracts (zod) + feature types

**Files:**
- Create: `frontend/src/features/mission-control/contracts.ts`
- Modify: `frontend/src/features/mission-control/types.ts` (replace the scaffold stub)
- Create: `frontend/src/features/mission-control/__tests__/contracts.test.ts`

- [ ] **Step 1: Write `contracts.ts`**

```ts
import { z } from "zod";

/**
 * A lead-stream file row — GET /api/leads/stream/status. Loose: the backend
 * mixes `processing_status` / `status` / `tracking_status` aliases.
 * `.passthrough()` tolerates extra fields (confirm-live before relying on any
 * single one — Spec 25 §12).
 */
export const LeadStreamFileRowSchema = z
  .object({
    file_id: z.string(),
    filename: z.string(),
    uploaded_at: z.string().nullish(),
    last_processed_at: z.string().nullish(),
    total_rows: z.number().nullish(),
    created_count: z.number().nullish(),
    error_count: z.number().nullish(),
    processing_status: z.string().nullish(),
    status: z.string().nullish(),
    tracking_status: z.string().nullish(),
  })
  .passthrough();

/** GET /api/leads/stream/status returns `{ files: [...] }` or a bare array. */
export const LeadStreamStatusSchema = z.union([
  z.array(LeadStreamFileRowSchema),
  z.object({ files: z.array(LeadStreamFileRowSchema).nullish() }).passthrough(),
]);
export type LeadStreamStatusResponse = z.infer<typeof LeadStreamStatusSchema>;

/** A single uploaded document — kept opaque (the consumer maps ~20 snake/camel
 *  fields; see `UntypedBackendDocument`). The service returns these raw; the
 *  data-sources component maps them to `DataSource[]` (stage 5). */
export const UserDocumentSchema = z.object({}).passthrough();

/** GET /api/user-documents returns a bare array or `{ documents|files|data }`. */
export const DataSourceListSchema = z.union([
  z.array(UserDocumentSchema),
  z
    .object({
      documents: z.array(UserDocumentSchema).nullish(),
      files: z.array(UserDocumentSchema).nullish(),
      data: z.array(UserDocumentSchema).nullish(),
    })
    .passthrough(),
]);
export type DataSourceListResponse = z.infer<typeof DataSourceListSchema>;
```

- [ ] **Step 2: Write `types.ts`** (replace the scaffold comment-only stub). These are the canonical feature view-models; stages 5–6 replace the in-component duplicate declarations with imports from here.

```ts
// Types for the `mission-control` feature.

/** ICP view-model (mapped from the backend customer_profile rows). The public
 *  read surface (index.ts) exports this; the raw rows come from `useICPs`. */
export type FitConfidence = "high" | "medium" | "low";
export interface ICP {
  id: string;
  primaryRegion: string;
  location: string[];
  industry: string[];
  companySize: string[];
  buyerRole: string[];
  accountsOnWatchlist: string[];
  accountsToAvoid: string[];
  fitConfidence: FitConfidence;
  additionalContext: string;
  status: "saved";
  createdAt: Date;
}

/** Data-source read-list view-model (from GET /api/user-documents). NOTE: this
 *  is the simple shape used by the data-sources tab. MissionControl's
 *  connector-catalog uses a separate, richer `DataSource` shape — do NOT unify
 *  them here; the connector/write surface is deferred. */
export type DataSourceType = "url" | "file" | "system";
export type DataSourceStatus = "active" | "failed" | "processing" | "completed";
export interface DataSource {
  id: string;
  fileId?: string;
  type: DataSourceType;
  name: string;
  url?: string;
  fileName?: string;
  description?: string;
  tags: string[];
  status: DataSourceStatus;
  createdAt: Date;
}

/** A lead-stream file row as the backend returns it (GET /api/leads/stream/status). */
export interface LeadStreamFileApiRow {
  file_id: string;
  filename: string;
  uploaded_at?: string;
  last_processed_at?: string;
  total_rows?: number;
  created_count?: number;
  error_count?: number;
  processing_status?: string;
  status?: string;
  tracking_status?: string;
}
```

- [ ] **Step 3: Write `__tests__/contracts.test.ts`** — proves the loose schemas accept the live-shape variants:

```ts
import { describe, expect, it } from "vitest";

import { DataSourceListSchema, LeadStreamStatusSchema } from "../contracts";

describe("mission-control contracts", () => {
  it("LeadStreamStatusSchema accepts the {files} envelope", () => {
    const parsed = LeadStreamStatusSchema.parse({
      files: [{ file_id: "f1", filename: "leads.csv", total_rows: 10 }],
    });
    expect(Array.isArray(parsed) ? parsed : parsed.files).toHaveLength(1);
  });

  it("LeadStreamStatusSchema accepts a bare array", () => {
    const parsed = LeadStreamStatusSchema.parse([{ file_id: "f1", filename: "a.csv" }]);
    expect(parsed).toHaveLength(1);
  });

  it("DataSourceListSchema accepts a bare array and the documents envelope", () => {
    expect(DataSourceListSchema.parse([{ file_id: "d1" }])).toHaveLength(1);
    const env = DataSourceListSchema.parse({ documents: [{ file_id: "d1" }] });
    expect(Array.isArray(env) ? env : env.documents).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run the test (expect PASS — schemas already written):**

```
npx vitest run src/features/mission-control/__tests__/contracts.test.ts
```
Expected: PASS.

- [ ] **Step 5: Verify + commit**

```
npm run verify
```
```bash
git add frontend/src/features/mission-control/contracts.ts frontend/src/features/mission-control/types.ts frontend/src/features/mission-control/__tests__/contracts.test.ts
git commit -m "feat(fe): add mission-control read contracts and feature types"
```

## Task 11: Read service (`services/missionControl.ts`)

**Files:**
- Create: `frontend/src/features/mission-control/services/missionControl.ts`
- Create: `frontend/src/features/mission-control/services/__tests__/missionControl.test.ts`

Context: `apiGet(endpoint, schema)` (`@/shared/api/client`) rate-limits, fetches via the JWT-injecting client, then `schema.parse(json)` at the boundary. Pass endpoints **without** the `/api` prefix (the client/proxy adds it) — same as `useCompanyProfile` (`apiGet("profile/company?org_id=…", …)`). ICP rows reuse the shared `fetchIcpsRowsForOrg` (raw `fetch`, kept identical to the customers consumer), so they are **not** in this service.

- [ ] **Step 1: Write the service**

```ts
import { DataSourceListSchema, LeadStreamStatusSchema } from "../contracts";
import type { LeadStreamFileApiRow } from "../types";

import { apiGet } from "@/shared/api/client";

/**
 * GET /api/user-documents — the org's uploaded data-source documents. Backend
 * returns a bare array or `{ documents|files|data }`. Returns the raw document
 * objects; DataSourcesManager maps them to `DataSource[]` (mapping stays in the
 * component this phase — stage 5).
 */
export async function fetchDataSources(orgId: string): Promise<unknown[]> {
  const json = await apiGet(
    `user-documents?org_id=${encodeURIComponent(orgId)}`,
    DataSourceListSchema,
  );
  if (Array.isArray(json)) return json;
  return json.documents ?? json.files ?? json.data ?? [];
}

/** GET /api/leads/stream/status — uploaded lead-stream files + processing stats. */
export async function fetchLeadStreamStatus(
  userId: string,
  orgId: string,
): Promise<LeadStreamFileApiRow[]> {
  const qs = new URLSearchParams({ user_id: userId, org_id: orgId });
  const json = await apiGet(`leads/stream/status?${qs.toString()}`, LeadStreamStatusSchema);
  if (Array.isArray(json)) return json;
  return json.files ?? [];
}
```

- [ ] **Step 2: Write `services/__tests__/missionControl.test.ts`** (non-React MSW, mirrors the market-research service test):

```ts
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { fetchDataSources, fetchLeadStreamStatus } from "../missionControl";

import { server } from "@/test/msw/server";

describe("fetchDataSources", () => {
  it("unwraps the documents envelope", async () => {
    server.use(
      http.get("/api/user-documents", () =>
        HttpResponse.json({ documents: [{ file_id: "d1" }, { file_id: "d2" }] }),
      ),
    );
    expect(await fetchDataSources("org1")).toHaveLength(2);
  });

  it("returns a bare array as-is", async () => {
    server.use(http.get("/api/user-documents", () => HttpResponse.json([{ file_id: "d1" }])));
    expect(await fetchDataSources("org1")).toHaveLength(1);
  });
});

describe("fetchLeadStreamStatus", () => {
  it("returns the files array from the envelope", async () => {
    server.use(
      http.get("/api/leads/stream/status", () =>
        HttpResponse.json({ files: [{ file_id: "f1", filename: "leads.csv" }] }),
      ),
    );
    const rows = await fetchLeadStreamStatus("u1", "org1");
    expect(rows[0]?.filename).toBe("leads.csv");
  });
});
```

- [ ] **Step 3: Run (expect PASS):**

```
npx vitest run src/features/mission-control/services/__tests__/missionControl.test.ts
```

- [ ] **Step 4: Verify + commit**

```
npm run verify
```
```bash
git add frontend/src/features/mission-control/services
git commit -m "feat(fe): add mission-control read service (data-sources, lead-stream)"
```

## Task 12: Query keys

**Files:** Modify `frontend/src/shared/api/queryKeys.ts`

- [ ] **Step 1: Add three keys** to the `qk` object (additive; mirrors `marketResearchComponent`):

```ts
  icps: (orgId: string) => ["mission-control", "icps", orgId] as const,
  dataSources: (orgId: string) => ["mission-control", "data-sources", orgId] as const,
  leadStreamStatus: (userId: string, orgId: string) =>
    ["mission-control", "lead-stream-status", userId, orgId] as const,
```

- [ ] **Step 2: Verify** (this is shared infra — run the full inner loop, not just the feature):

```
npm run verify
```
Expected: PASS (no existing consumer of `qk` breaks; the keys are new).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/api/queryKeys.ts
git commit -m "feat(fe): add mission-control read query keys"
```

## Task 13: `useICPs` read hook

**Files:**
- Create: `frontend/src/features/mission-control/hooks/useICPs.ts`
- Create: `frontend/src/features/mission-control/hooks/__tests__/useICPs.test.tsx`

- [ ] **Step 1: Write the failing test first.**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useICPs } from "../useICPs";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useICPs", () => {
  it("returns the extracted ICP rows", async () => {
    // fetchIcpsRowsForOrg hits /api/profile/company then /api/customer_profile.
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})),
      http.get("/api/customer_profile", () =>
        HttpResponse.json({ icps: [{ id: "i1" }, { id: "i2" }] }),
      ),
    );
    const { result } = renderHook(() => useICPs("u1", "org1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it("is disabled without userId/orgId", () => {
    const { result } = renderHook(() => useICPs("", "org1"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
```

- [ ] **Step 2: Run it (expect FAIL — module missing):**

```
npx vitest run src/features/mission-control/hooks/__tests__/useICPs.test.tsx
```
Expected: FAIL ("Cannot find module '../useICPs'").

- [ ] **Step 3: Implement `useICPs.ts`** (reuses the shared `fetchIcpsRowsForOrg` — parity with the customers consumer):

```ts
import { useQuery } from "@tanstack/react-query";

import { qk } from "@/shared/api/queryKeys";
import { fetchIcpsRowsForOrg } from "@/shared/profiler";

/**
 * Read the org's ICP rows (GET /api/profile/company → /api/customer_profile,
 * shaped by the shared extractor). Returns the RAW rows; consumers map them via
 * the `@/shared/profiler` helpers (parity with the customers consumer). ICP
 * writes (CRUD) stay raw `fetch` this phase — deferred (TD-FE, finalize).
 */
export function useICPs(userId: string, orgId: string, enabled = true) {
  return useQuery({
    queryKey: qk.icps(orgId),
    enabled: enabled && !!userId && !!orgId,
    queryFn: () => fetchIcpsRowsForOrg(userId, orgId),
  });
}
```

- [ ] **Step 4: Run (expect PASS), then verify + commit.**

```
npx vitest run src/features/mission-control/hooks/__tests__/useICPs.test.tsx
npm run verify
```
```bash
git add frontend/src/features/mission-control/hooks/useICPs.ts frontend/src/features/mission-control/hooks/__tests__/useICPs.test.tsx
git commit -m "feat(fe): add useICPs read hook"
```

## Task 14: `useDataSources` + `useLeadStreamStatus` read hooks

**Files:**
- Create: `frontend/src/features/mission-control/hooks/useDataSources.ts` (+ `__tests__/useDataSources.test.tsx`)
- Create: `frontend/src/features/mission-control/hooks/useLeadStreamStatus.ts` (+ `__tests__/useLeadStreamStatus.test.tsx`)

- [ ] **Step 1: Write both failing tests.**

`hooks/__tests__/useDataSources.test.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useDataSources } from "../useDataSources";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useDataSources", () => {
  it("returns the documents array", async () => {
    server.use(
      http.get("/api/user-documents", () =>
        HttpResponse.json({ documents: [{ file_id: "d1" }] }),
      ),
    );
    const { result } = renderHook(() => useDataSources("org1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data).toHaveLength(1);
  });

  it("is disabled without orgId", () => {
    const { result } = renderHook(() => useDataSources(""), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
```

`hooks/__tests__/useLeadStreamStatus.test.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useLeadStreamStatus } from "../useLeadStreamStatus";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useLeadStreamStatus", () => {
  it("returns the files rows", async () => {
    server.use(
      http.get("/api/leads/stream/status", () =>
        HttpResponse.json({ files: [{ file_id: "f1", filename: "leads.csv" }] }),
      ),
    );
    const { result } = renderHook(() => useLeadStreamStatus("u1", "org1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data?.[0]?.filename).toBe("leads.csv");
  });

  it("is disabled without userId/orgId", () => {
    const { result } = renderHook(() => useLeadStreamStatus("", "org1"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
```

- [ ] **Step 2: Run both (expect FAIL — modules missing).**

```
npx vitest run src/features/mission-control/hooks/__tests__/useDataSources.test.tsx src/features/mission-control/hooks/__tests__/useLeadStreamStatus.test.tsx
```

- [ ] **Step 3: Implement both hooks.**

`hooks/useDataSources.ts`:
```ts
import { useQuery } from "@tanstack/react-query";

import { fetchDataSources } from "../services/missionControl";

import { qk } from "@/shared/api/queryKeys";

/** Read the org's data-source documents (GET /api/user-documents). Returns the
 *  raw documents; the data-sources component maps them to DataSource[] (stage 5). */
export function useDataSources(orgId: string, enabled = true) {
  return useQuery({
    queryKey: qk.dataSources(orgId),
    enabled: enabled && !!orgId,
    queryFn: () => fetchDataSources(orgId),
  });
}
```

`hooks/useLeadStreamStatus.ts`:
```ts
import { useQuery } from "@tanstack/react-query";

import { fetchLeadStreamStatus } from "../services/missionControl";

import { qk } from "@/shared/api/queryKeys";

/** Read uploaded lead-stream files + processing stats (GET /api/leads/stream/status). */
export function useLeadStreamStatus(userId: string, orgId: string, enabled = true) {
  return useQuery({
    queryKey: qk.leadStreamStatus(userId, orgId),
    enabled: enabled && !!userId && !!orgId,
    queryFn: () => fetchLeadStreamStatus(userId, orgId),
  });
}
```

- [ ] **Step 4: Run (expect PASS), verify, commit.**

```
npx vitest run src/features/mission-control/hooks/__tests__/useDataSources.test.tsx src/features/mission-control/hooks/__tests__/useLeadStreamStatus.test.tsx
npm run verify
```
```bash
git add frontend/src/features/mission-control/hooks/useDataSources.ts frontend/src/features/mission-control/hooks/useLeadStreamStatus.ts frontend/src/features/mission-control/hooks/__tests__/useDataSources.test.tsx frontend/src/features/mission-control/hooks/__tests__/useLeadStreamStatus.test.tsx
git commit -m "feat(fe): add useDataSources and useLeadStreamStatus read hooks"
```

**Stage 3 gate:** all three read hooks + service + contracts exist with green unit tests; `npm run verify` green. Components not yet decomposed (still consume their own fetches). Company-profile read needs no new hook — it reuses `useCompanyProfile` (`@/components/settings/useCompanyProfile`, a transitional legacy-dir import), wired when the form is extracted (stage 4).

---

# Stage 4 — MissionControl decomposition

> Decompose `MissionControlPage.tsx` (the ex-`MissionControl.tsx`, ~4,371 LOC) into a thin 3-tab shell + the company-profile cluster. Tab→subtree mapping (verified): `profile` → `components/company-profile/`, `customer-profile` → `components/icp/` (ICPManager — undecomposed until stage 6), `sources` → `components/data-sources/` (DataSourcesManager — undecomposed until stage 5). At stage-4 completion the `customer-profile`/`sources` tabs render the **relocated, undecomposed** managers. Convention (Phase 5): extracted components are default-export, read `currentUser`/`orgId` from `useAuth`, keep per-field callbacks. Parity: journeys 01/02/05 + VR green.

## Task 15: Extract `CompanyProfileForm` (read via `useCompanyProfile`; writes deferred)

**Files:**
- Create: `frontend/src/features/mission-control/components/company-profile/CompanyProfileForm.tsx`
- Create: `frontend/src/features/mission-control/components/company-profile/__tests__/CompanyProfileForm.test.tsx`
- Modify: `frontend/src/features/mission-control/pages/MissionControlPage.tsx` (remove the inline `profile`-tab form; render `<CompanyProfileForm />`)

Context (provenance in the pre-move `MissionControl.tsx`, now `MissionControlPage.tsx`): the `profile` tab is **inline JSX** (`<TabsContent value="profile">`, ~lines 1983–2230) over a single consolidated `companyProfile` state object (16 string fields, ~lines 251–268) plus `isSaving` (`:128`), `isLoadingProfile` (`:129`), `isCompanyProfileSaved` (`:125`). The mount load (`loadProfileData`, ~`:700–1001`) reads `GET /api/profile/company?org_id=…` (`:732`) with a localStorage cache pre-check (`isMissionControlCacheValid`/`getMissionControlCompanyProfileJson`) and maps via `applyCompanyProfileJsonToMissionControlUi`. `handleSave` (`:270`) POSTs the snake_case `profile_type:"company"` payload to `/api/profile/company` (`:319/:323`).

**Migration boundary:** the **read** (mount GET) → `useCompanyProfile(orgId)` (returns `CompanyProfileResponse | null`; non-Zod failures resolve to `null` = empty form, matching today's tolerant behavior). The **write** (`handleSave`) and the **localStorage failover** stay exactly as-is (deferred — TD-FE).

- [ ] **Step 1: Create `CompanyProfileForm.tsx`.** Move the `profile`-tab JSX (~1983–2230) and its supporting state/handlers into a default-export component. It owns:
  - `const { currentUser } = useAuth();` and the org id resolution the page used (mirror the page's `orgIdToUse`).
  - The `companyProfile` state object (16 fields) + per-field `setCompanyProfile` updates, `isSaving`, the save flow `handleSave` (kept as raw `fetch` POST — **write deferred**), and the localStorage failover (kept).
  - The **read**: `const { data: companyData } = useCompanyProfile(orgId);` then a `useEffect` that runs the existing `applyCompanyProfileJsonToMissionControlUi(companyData, setCompanyProfile, …)` mapping when `companyData` changes (preserve the localStorage pre-check as the initial seed). Remove the old mount `fetch('/api/profile/company')` + retry loop (replaced by the hook).
  - Props: none (reads context, like ICPManager). Export `export default function CompanyProfileForm()`.

- [ ] **Step 2: Render it from the shell.** In `MissionControlPage.tsx`, replace the inline `<TabsContent value="profile">…</TabsContent>` body with:

```tsx
          <TabsContent value="profile">
            <CompanyProfileForm />
          </TabsContent>
```
and add `import CompanyProfileForm from "../components/company-profile/CompanyProfileForm";`. Remove the now-dead state/handlers/effect that moved into the component (the page no longer owns `companyProfile`, `handleSave`, the profile load effect).

- [ ] **Step 3: Write a render/interaction test** `__tests__/CompanyProfileForm.test.tsx` — mounts the form behind a `QueryClientProvider` + the auth/tenant context (mirror how market-research section tests provide context), with `server.use(http.get("/api/profile/company", …))` returning a known profile, and asserts the fields hydrate. Add a save-path interaction test that stubs `http.post("/api/profile/company", …)` and asserts the POST fires (write path unchanged).

- [ ] **Step 4: Run the test, verify, parity.**

```
npx vitest run src/features/mission-control/components/company-profile
npm run verify
pkill -f "vite preview" || true
npm run build && npm run test:e2e -- e2e/journeys/01-login-tenant-mission.spec.ts
```
Expected: PASS; journey 01 + VR `04-mission-control-loaded` green (the company-profile tab renders identically).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mission-control/components/company-profile frontend/src/features/mission-control/pages/MissionControlPage.tsx
git commit -m "refactor(fe): extract CompanyProfileForm; migrate its read to useCompanyProfile"
```

## Task 16: Extract the connector-approval cluster

**Files:**
- Create: `frontend/src/features/mission-control/components/company-profile/ConnectorApprovals.tsx` (+ any small sub-components it needs)
- Modify: `frontend/src/features/mission-control/pages/MissionControlPage.tsx` (and/or `CompanyProfileForm.tsx`) to render it

Context: the connector-approval cluster is 16 per-platform approve/deny handlers (`handleSalesforceApprove`…`handleMixpanelDeny`, MissionControl ~`:1055–1636`), the catalog "add connector" handler (`handleConnectSource(connector)`, `:1735`), the connector catalog dialog (gated by `isConnectorDialogOpen`, rendered ~`:2248`), and the per-platform auth modals. It uses MissionControl's **richer** `DataSource`/`Connector` shapes (imported at `:111–121`/`:114`) — **not** the feature `types.ts` `DataSource`. These are connector/OAuth **write** flows → relocate cohesively, preserving behavior; do **not** refactor the write paths (deferred).

- [ ] **Step 1: Move the cluster** into `ConnectorApprovals.tsx` as a default-export component owning: the 16 approve/deny handlers, the per-platform modal state/JSX, the connector catalog dialog + `handleConnectSource`, and the local `dataSources`/`isConnectorDialogOpen` state they manipulate. Keep its existing `Connector`/richer-`DataSource` imports as-is (relative or `@/...` per where those types live — do not point them at the feature `types.ts`). Reads stay as they are; writes stay raw.

- [ ] **Step 2: Render it** where the `profile` tab previously rendered the connector UI (inside `CompanyProfileForm` or directly under the `profile` `TabsContent`, matching the original layout). Pass any callbacks the form/page need (e.g. an `onSourcesChanged` if the page reacted to connector adds; otherwise self-contained).

- [ ] **Step 3: Render test** — mount `ConnectorApprovals`, open the catalog dialog, assert a connector row renders and the approve modal toggles. No network assertions (writes deferred/unchanged).

- [ ] **Step 4: Verify + parity.**

```
npx vitest run src/features/mission-control/components/company-profile
npm run verify
pkill -f "vite preview" || true
npm run build && npm run test:e2e -- e2e/journeys/01-login-tenant-mission.spec.ts
```
Expected: PASS; journey 01 + VR green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mission-control/components/company-profile frontend/src/features/mission-control/pages/MissionControlPage.tsx
git commit -m "refactor(fe): extract connector-approval cluster into company-profile/"
```

## Task 17: Finalize the thin `MissionControlPage` shell

**Files:** Modify `frontend/src/features/mission-control/pages/MissionControlPage.tsx`; Create `…/pages/__tests__/MissionControlPage.test.tsx`

- [ ] **Step 1: Reduce the page to a shell.** It should now own only: `activeTab` state + the `?tab=` URL-param sync, the tab-lock guards (`isCustomerProfileLocked`/`isDataSourcesLocked` → block switching), the `<Tabs>`/`<TabsList>`/three `<TabsContent>` rendering `<CompanyProfileForm />` + `<ConnectorApprovals />` (profile), `<ICPManager />` (customer-profile), `<DataSourcesManager />` (sources). Remove any leftover state/helpers that belonged to the extracted clusters.

- [ ] **Step 2: Tab-routing test** `pages/__tests__/MissionControlPage.test.tsx` — render the page with context, assert each tab switches and mounts the right child (query by a stable testid/text from each child; mock children if needed to keep the test focused on routing).

- [ ] **Step 3: Verify + full parity.**

```
npx vitest run src/features/mission-control/pages
npm run verify
pkill -f "vite preview" || true
npm run build && npm run test:e2e -- e2e/journeys
```
Expected: journeys 01/02/05 + VR all green.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/mission-control/pages
git commit -m "refactor(fe): reduce MissionControlPage to a thin 3-tab shell"
```

**Stage 4 gate:** page is a thin shell; company-profile form (read on `useCompanyProfile`) + connector cluster extracted; managers still undecomposed; journeys 01/02/05 + VR green.

---

# Stage 5 — DataSourcesManager decomposition

> Split `components/data-sources/DataSourcesManager.tsx` (~3,941 LOC) into single-purpose components, wiring the **reads** to stage-3 hooks (`useDataSources`, `useLeadStreamStatus`). Writes (uploads, source CRUD) stay raw `fetch` (deferred). R1: the uploader couples to lead-stream polling + file refs — if extraction over-runs, keep the upload helpers inline (their shared extraction is already deferred to Phase 11) and split only the surrounding structure. Parity: journey `02-csv-upload-leads` green.
>
> **Stages 5 and 6 are mutually independent** — both depend only on stage 4 (the shell), not on each other — so they could split across worktrees if this phase were ever parallelized. This plan runs them sequentially on one branch by design (the chosen single-agent mode).

## Task 18: Replace in-component `DataSource`/row types with the feature types; wire reads

**Files:** Modify `frontend/src/features/mission-control/components/data-sources/DataSourcesManager.tsx`

- [ ] **Step 1: Use the canonical types.** Replace the in-file `interface DataSource`/`SourceType`/`SourceStatus`/`LeadStreamFileApiRow` declarations (DataSourcesManager ~`:58–89`) with imports from `../../types` (`DataSource`, `DataSourceType`, `DataSourceStatus`, `LeadStreamFileApiRow`). Keep the function-local `BadRow` (`:2249`) as-is. Keep the `CompanyProfile` mini-interface (`:91`) local.

- [ ] **Step 2: Wire the list read.** Replace `loadDataSourcesFromBackend`'s `fetch(buildApiUrl('user-documents?…'))` (`:419–460`) with `useDataSources(orgId)`; keep the existing `documents.map(doc => …) → DataSource[]` mapping (move it into a `useMemo`/effect over the hook's `data`). Remove the manual `getAuthHeader` for this read (the hook's client injects auth).

- [ ] **Step 3: Wire the lead-stream read.** Replace `refreshLeadStreamStatus`'s `fetch(buildApiUrl('leads/stream/status?…'))` (`:2659–2713`) with `useLeadStreamStatus(userId, orgId)`; keep `filterVisibleLeadStreamFiles(...)` over the hook's `data`. (Any polling cadence that existed can stay via the hook's `refetchInterval` if needed — but **read** only; do not migrate the upload POST.)

- [ ] **Step 4: Verify + parity.**

```
npm run verify
pkill -f "vite preview" || true
npm run build && npm run test:e2e -- e2e/journeys/02-csv-upload-leads.spec.ts
```
Expected: PASS; journey 02 green (the data-sources list + lead-stream table hydrate via hooks).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mission-control/components/data-sources/DataSourcesManager.tsx
git commit -m "refactor(fe): wire DataSourcesManager reads to useDataSources/useLeadStreamStatus"
```

## Task 19: Split out `LeadStreamTable`, `DataSourceUploader`, `SourceForm`

**Files:**
- Create: `…/components/data-sources/LeadStreamTable.tsx` (+ test)
- Create: `…/components/data-sources/DataSourceUploader.tsx` (+ test)
- Create: `…/components/data-sources/SourceForm.tsx` (+ test)
- Modify: `…/components/data-sources/DataSourcesManager.tsx` → thin container composing the three

For each sub-component, the boundary:

- **`LeadStreamTable`** — renders the lead-stream files table from `useLeadStreamStatus` data. Props: `{ files: LeadStreamFileApiRow[] }` (or consume the hook directly; prefer props for testability). No writes.
- **`DataSourceUploader`** — drag-drop + file-ref upload UI; the upload POST stays raw `fetch` (deferred). Props: the callbacks/state it needs (`onUploaded`, current `orgId`/`userId` from `useAuth`). Keep upload helpers inline if extraction reveals tight coupling (R1).
- **`SourceForm`** — the generic URL/source add form; create POST stays raw (deferred). Props: `{ onAdd }` or self-contained.

- [ ] **Step 1: Extract `LeadStreamTable`** (pure-render, easiest first). Move its JSX + the `filterVisibleLeadStreamFiles` usage. Add a render test feeding two rows; assert filenames render. Run `npx vitest run …/data-sources`, verify, commit (`refactor(fe): extract LeadStreamTable from DataSourcesManager`).
- [ ] **Step 2: Extract `DataSourceUploader`.** Move the uploader JSX + handlers (writes unchanged). Add a render test (renders dropzone; a stubbed file-select calls the upload handler). Verify + parity (journey 02) + commit (`refactor(fe): extract DataSourceUploader from DataSourcesManager`).
- [ ] **Step 3: Extract `SourceForm`.** Move the generic source-add form. Render test (fill URL → submit → `onAdd` fires). Verify + commit (`refactor(fe): extract SourceForm from DataSourcesManager`).
- [ ] **Step 4: Reduce `DataSourcesManager` to a container** composing `<DataSourceUploader/>`, `<LeadStreamTable/>`, `<SourceForm/>` + the data-source list (from `useDataSources`). Add/adjust a container test. **Full parity:**

```
npm run verify
pkill -f "vite preview" || true
npm run build && npm run test:e2e -- e2e/journeys
```
Expected: journeys 01/02/05 + VR green. Commit (`refactor(fe): reduce DataSourcesManager to a thin container`).

**Stage 5 gate:** data-sources tab decomposed; reads on hooks; writes deferred; journey 02 + VR green.

---

# Stage 6 — ICPManager decomposition + finalize

> Split `components/icp/ICPManager.tsx` (~1,687 LOC after the stage-2 dead-code delete) into ICP list/filter, add/edit wizard, profiler-merge view; wire the **read** to `useICPs`; lock the public surface; finalize docs; allocate TD-FE; run the serial preflight. Parity: journey `05-icp-create` + VR `01-mission-control-empty-icp` green.

## Task 20: Wire ICPManager's read to `useICPs`; use the feature ICP type

**Files:** Modify `frontend/src/features/mission-control/components/icp/ICPManager.tsx`

- [ ] **Step 1: Use the canonical ICP type.** Replace the in-file `interface ICP` + `type FitConfidence` (now near the top of the post-delete file) with `import type { ICP, FitConfidence } from "../../types";`. Keep `InlineStep` and the inline `validationErrors` shape local.
- [ ] **Step 2: Wire the read.** Replace ICPManager's live ICP fetch (the `apiFetch` + `extractIcpsDataFromFlexibleApiResponse` load) with `useICPs(userId, orgId)`; keep the existing mapping of the raw rows → `ICP[]` (the component already does this via `@/shared/profiler` helpers). Writes (ICP create/edit/delete) stay raw `fetch` (deferred).
- [ ] **Step 3: Verify + parity.**

```
npm run verify
pkill -f "vite preview" || true
npm run build && npm run test:e2e -- e2e/journeys/05-icp-create.spec.ts
```
Expected: PASS; journey 05 + VR `01-mission-control-empty-icp` green.
- [ ] **Step 4: Commit** (`refactor(fe): wire ICPManager read to useICPs and feature ICP type`).

## Task 21: Split out `IcpList`, `IcpWizard`, `ProfilerMergeView`

**Files:**
- Create: `…/components/icp/IcpList.tsx`, `IcpWizard.tsx`, `ProfilerMergeView.tsx` (+ tests)
- Modify: `…/components/icp/ICPManager.tsx` → thin container

Boundaries:
- **`IcpList`** — the saved-ICP list + filter UI, fed by the `ICP[]` derived from `useICPs`. Props: `{ icps: ICP[]; onEdit; onDelete }`.
- **`IcpWizard`** — the add/edit inline-step flow (`InlineStep`); create/update POST stays raw (deferred). Props: `{ initial?: ICP; onSaved }`.
- **`ProfilerMergeView`** — the profiler-accepted-ICP merge/display, using `@/shared/profiler` helpers (`mergeProfilerAcceptedIcpDisplay`, `removeProfilerAcceptedIcpDisplayMeta`). Props as needed.

- [ ] **Step 1: Extract `IcpList`** (render-focused). Render test (feed two ICPs; assert rows + filter). Verify + commit.
- [ ] **Step 2: Extract `IcpWizard`.** Render/interaction test (step through fields; submit calls `onSaved`; writes stubbed). Verify + parity (journey 05) + commit.
- [ ] **Step 3: Extract `ProfilerMergeView`.** Render test (a placeholder ICP merges display meta from the shared helper). Verify + commit.
- [ ] **Step 4: Reduce `ICPManager` to a container** composing the three + `useICPs`. Container test. **Full parity** (`npm run verify` + journeys 01/02/05 + VR). Commit (`refactor(fe): reduce ICPManager to a thin container`).

## Task 22: Lock the public surface (`index.ts`)

**Files:** Modify `frontend/src/features/mission-control/index.ts`

- [ ] **Step 1: Add the read surface** (keep `missionControlRoutes`):

```ts
// Public surface for the `mission-control` feature.
// Cross-feature consumers (customers, Phase 7) import from "@/features/mission-control", never a deep path.
export { missionControlRoutes } from "./routes";
export type { ICP } from "./types";
export { useICPs } from "./hooks/useICPs";
```
(The ICP **mutation** surface is deferred with the write paths; the three profiler-ICP utils are consumed from `@/shared/profiler`, not re-exported here.)

- [ ] **Step 2: Verify** (knip `entry: ["src/**/*.{ts,tsx}!"]` treats every src file as an entry, so the not-yet-consumed `ICP`/`useICPs` exports do **not** trip `knip --strict` — same as market-research's `index.ts`):

```
npm run verify
npm run knip
```
Expected: both PASS.

- [ ] **Step 3: Commit** (`feat(fe): lock mission-control public surface (ICP type + useICPs)`).

## Task 23: Finalize README + Profiler-disposition handoff

**Files:** Modify `frontend/src/features/mission-control/README.md`

- [ ] **Step 1: Write the README** mirroring market-research's structure: `# \`mission-control\` feature` → `## Purpose` (1 paragraph, cite Spec 14 §4 + Spec 25, and the source files extracted) → `## Public surface` (a table: `Export | Kind | Source | Description` for `missionControlRoutes`, `ICP`, `useICPs`) → `## Key files` (bulleted `path — description`, noting which stage added each) → `## Dependency notes` (may-import allowlist + the index-only ban) → `## Pending handoffs` (a table: `Component(s) | Target feature | Claiming phase` — ICP profiler-merge → Phase 9; the `@/shared/profiler` cluster shared with customers/Phase 7).
- [ ] **Step 2: Add the Profiler-disposition handoff section** (Spec 25 §6 — the authoritative record for Phases 7 & 9) as a `## Profiler disposition` table: the three promoted utils → `@/shared/profiler` (done, shared mission-control + customers); ICP profiler-merge logic → stays in `components/icp/`, customers reads via `index.ts` + the shared util, Phase 9 resolves; `UntypedProfilerIcpRecord` typing → Phase 13.
- [ ] **Step 3: Format + commit.**

```
npx prettier --write src/features/mission-control/README.md
npm run verify
```
```bash
git add frontend/src/features/mission-control/README.md
git commit -m "docs(fe): finalize mission-control README + profiler-disposition handoff"
```

## Task 24: Allocate deferred TD-FE entries

**Files:** Modify `docs/TECH_DEBT.md` (**append surgically — never prettier this file**)

- [ ] **Step 1: Find the current highest TD-FE number** (TD-FE-32 is the spec-writing-time ceiling; verify intervening phases didn't allocate more):

```
grep -oE 'TD-FE-[0-9]+' docs/TECH_DEBT.md | sort -t- -k3 -n | tail -1
```

- [ ] **Step 2: Append the next free numbers**, one entry each (current-state / should-be / why-deferred / trigger), surgically (no reflow, no prettier):
  1. mission-control **write/mutation paths** remain raw `fetch` (ICP CRUD, data-source CRUD, company-profile save, connector approve/deny) — later mutation pass (Phase 7 ICP-write migration or Phase 13, whichever reaches it first). Mirrors TD-FE-21/27/31.
  2. `localStorage company_profile_{uid}` failover + `sessionStorage slackSourceToConnect` bridge retained as-is.
  3. `useCompanyProfile` **shared-promotion candidate** (settings + mission-control consumers; a market-research path duplicates it) — Phase 10/11.
  4. DataSourcesManager **upload helpers** shared extraction — Phase 11.
  5. mission-control **escape-hatches** (`UntypedBackendApiResponse`/`UntypedProfilerIcpRecord`/`UntypedBackendDocument`) retyping — Phase 13 (carry TD-FE-9/10 posture).

- [ ] **Step 3: Commit** (`docs: allocate Phase 6 deferred TD-FE entries`). Stage only `docs/TECH_DEBT.md`.

## Task 25: Update Spec 14 status + final serial preflight + merge

**Files:** Modify `specs/14-frontend-refactoring-master-plan-design.md` (§4 status row); then merge.

- [ ] **Step 1: Confirm Definition of Done (Spec 25 §10).** Verify on the branch: feature populated; `src/pages/MissionControl.tsx` + `src/components/mission-control/*` gone (`ls` returns nothing/empty); route via registry with `<FeatureErrorBoundary>`; lint enforces index-only (TD-FE-15 resolved); reads on TanStack + `useCompanyProfile` reused; the three utils in `@/shared/profiler` with importers repointed; ICPManager commented shadow gone (`grep -c '^[[:space:]]*//'` small); README + handoff written; TD-FE allocated.
- [ ] **Step 2: Update the master status row.** In `specs/14-…design.md` §4, set Phase 6 → done (apply at merge per the frozen-record convention). Commit (`docs: mark Spec 14 Phase 6 done`). Stage only that file.
- [ ] **Step 3: Run the serial merge gate.** From `frontend/`:

```
pkill -f "vite preview" || true
npm run preflight
```
Expected: typecheck + lint + format:check + test + build + bundle:check + test:e2e + knip --strict all PASS. If a check fails, fix on the branch (new commit) and re-run; do not merge red.
- [ ] **Step 4: Finish the branch.** Use the **superpowers:finishing-a-development-branch** skill (verify tests → present options). For the merge: `git checkout master && git merge --no-ff phase-6-mission-control && git push origin master`.

**Stage 6 gate / phase done-when:** Spec 25 §10 satisfied; serial `npm run preflight` green; merged `--no-ff` to `master`.

---

## Self-review (run against Spec 25 before executing)

- **§2.1 in-scope coverage:** enabling infra (Tasks 1–4) ✓; scaffold+relocate (5–7) ✓; FeatureErrorBoundary (6) ✓; ICPManager dead code (7) ✓; promote 3 utils (8) ✓; read-path TanStack — ICP/data-sources/lead-stream (10–14, 18, 20) + company-profile reuse (15) ✓; decomposition of all three monsters (15–17, 19, 21) ✓; index.ts + README + §6 (22–23) ✓.
- **§2.2 out-of-scope:** writes/localStorage stay raw (15, 16, 18, 20, 21) and are logged as TD-FE (24) ✓; `useCompanyProfile` promotion deferred (24.3) ✓; upload helpers deferred (R1 note in stage 5, TD-FE 24.4) ✓.
- **§4.1 reads:** ICP (`useICPs`, reuse shared `fetchIcpsRowsForOrg`) ✓; lead-stream (`useLeadStreamStatus`) ✓; data-sources (`useDataSources`, endpoint resolved to `user-documents`) ✓; company-profile (reuse `useCompanyProfile`) ✓. Confirm-live = Task 9 ✓.
- **§5 public surface:** `ICP` type + `useICPs` only (Task 22) ✓; utils not re-exported ✓.
- **§7 stage order:** 1a→1b→2a→2b→3→4→5→6 preserved; registry-before-lint rationale honored ✓.
- **§8 testing/parity:** FeatureErrorBoundary (6); per-component RTL + per-hook MSW tests; journeys 01/02/05 + VR at every stage gate; serial preflight at merge ✓.
- **§9/§10/§3 architecture target tree:** every dir in §3 produced; `__tests__/` co-located per Phase 5 ✓.
- **Placeholder scan:** new files (routes, lint, contracts, types, services, hooks, tests) carry complete code; relocations/decompositions carry exact source-line provenance + boundaries + parity gates (existing code is moved, not re-pasted) — intentional for a parity extraction.
- **Type consistency:** `ICP`/`FitConfidence`, `DataSource`/`DataSourceType`/`DataSourceStatus`, `LeadStreamFileApiRow` defined in `types.ts` (Task 10) and consumed identically in services/hooks/components (Tasks 11–21); `qk.icps/dataSources/leadStreamStatus` defined (Task 12) and used in the hooks (13–14).
- **Open risk flagged for plan review:** `useICPs`/`useDataSources` return raw rows (`unknown[]`) — typed mapping stays in the consuming component (honest given the flexible backend; a reviewer may ask to push the mapping into the service). The two `DataSource` shapes (feature read-list vs MissionControl connector-catalog) are deliberately **not** unified (connector writes deferred).
