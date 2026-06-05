# Spec 29 — Frontend Phase 12: small-pages sweep

**Status:** Design — round 1
**Date:** 2026-06-05
**Type:** Phase spec (implements Spec 14 §4 Phase 12)
**Paired plan:** `plans/29-frontend-phase-12-small-pages-sweep.md` (written after this spec converges)
**Branch:** `worktree-phase-12-small-pages-sweep` (off `master` @ `0f0b96c`)
**Predecessor:** Phase 7 (customers, Spec 26 / plan 26) merged to `master` 2026-06-04 (`4421589`).
**Concurrency:** Phases 8 (signals + strategist, spec/plan `27`) and 10 (settings + tenant + auth, spec `28`) are **in flight in parallel** at spec-write time. Per Spec 14 §4's dependency table, Phase 12 is an **independent leaf-page sweep** with no hard dependency on 8, 9, 10, or 11 — it is designed here to merge cleanly alongside them. NN `29` is the next free slot across `master` + all active phase branches (8=27, 10=28).

---

## §1 Goal and context

### 1.1 Goal

Relocate every remaining product page under `src/pages/` that is **not** claimed by another phase into its own per-feature folder under `src/features/`, following the converged per-feature shape from Phases 4–7 (append-only route-registry entry, `<FeatureErrorBoundary>` wrap, public `index.ts` surface, README). Behavior, routes, and visuals are frozen (Spec 14 §2.3). This phase exists to leave `src/pages/` empty of leaf pages so **Phase 11's empty-`pages/` verification can pass** (Spec 14 §4: Phase 12 "must precede 11's empty-`pages/` check").

The one substantive code change beyond relocation is the **decomposition of `Artifacts.tsx` (729 LOC)** into a thin page plus focused modules (user-directed; see §4).

### 1.2 Scope correction — `Deals.tsx` is the Strategist surface (Phase 8), not a Phase 12 small page

Spec 14's Phase 12 source list names `src/pages/Deals.tsx`. In the current code `Deals.tsx` is **the Strategist product surface**, not a generic "deals" page: it sets `usePageTitle("🧭 Strategist - Brewra")`, renders `StrategistWorkspace` + `StrategistLeadStream` + `StrategistRecommendations`, hydrates from `sessionStorage.strategistContext`, and is routed at `/your-ai-team/strategist/:tab` (with `/deals` redirecting there). Strategist is **Phase 8's** territory ("signals + strategist", spec 27).

Therefore `Deals.tsx` is **out of Phase 12 scope**. Spec 14's list is a frozen record of intent (per the spec-driven-flow convention) and is not amended here; **this spec is the authority** for what Phase 12 actually moves. Logged as a master-plan delta at merge (Spec 14 §5.5).

### 1.3 Actual starting state (`src/pages/` on `master`)

| Page | LOC | Owner | Disposition |
|---|---|---|---|
| `Calendar.tsx` (title "⚡ Activator") | 169 | **Phase 12** | → `features/calendar` |
| `Insights.tsx` | 246 | **Phase 12** | → `features/insights` |
| `Reports.tsx` (title "📊 Presenter") | 299 | **Phase 12** | → `features/reports` |
| `Artifacts.tsx` (component `Artefacts`) | 729 | **Phase 12** | → `features/artifacts` (decomposed, §4) |
| `NotFound.tsx` | 24 | **Phase 12** | → `features/shell` (§5) |
| `Signals.tsx` | 1,544 | Phase 8 | not touched here |
| `Deals.tsx` | — | Phase 8 (Strategist) | not touched here (§1.2) |
| `ScoutDeployment.tsx` | — | Phase 9 | not touched here |
| `Login.tsx`, `Settings.tsx`, `TenantSelection.tsx` | — | Phase 10 | not touched here |

All five Phase-12 pages are **presentational / local-state surfaces with no data layer** (verified: zero `apiFetch`/`enhancedApi`/`useQuery`/`fetch(`/`@/lib`/`@/services`/`@/contexts` imports). This is what makes Phase 12 collision-free with Phases 8/10 on the shared data/test-infra files (§6).

### 1.4 Already done (no work here)

- The append-only route registry `src/app/routes.tsx` exists (Phase 4b).
- `FeatureErrorBoundary` exists at `src/shared/components` (`@/shared/components`).
- `src/features/shell` exists and exports `Layout`, `ProtectedRoute`, `SidebarProvider`.
- shadcn primitives live at `@/components/ui/*` and stay there (not a Phase-12 concern).

---

## §2 Scope

### 2.1 In scope

1. Relocate `Calendar`, `Insights`, `Reports`, `Artifacts` into route-named feature folders (per the §3 shape), with default-export pages, per-feature `routes.tsx`, `index.ts`, and `README.md`.
2. Relocate `NotFound` into `features/shell` and re-export it from `features/shell/index.ts` (§5).
3. Decompose `Artifacts.tsx` (729 LOC) into a thin page + modules (§4).
4. Rewire routing: append the four new route arrays to `src/app/routes.tsx`; remove the four migrated pages' imports + inline `<Route>` blocks from `src/App.tsx`; re-point the `NotFound` import to `@/features/shell` (§5).
5. Per-page render smoke tests (Vitest/RTL) + a unit test for the extracted Artefacts PDF utility (§8).

### 2.2 Out of scope (logged to `docs/TECH_DEBT.md` as provisional `TD-FE-<n>`, see §10)

- **Promoting `usePageTitle`** (and any other legacy `@/hooks` imports these pages carry) to `src/shared/` — that is **Phase 11's** job. Per Spec 14 §4 line 541 ("features … let Phase 11 promote — do not pre-extract"), Phase 12 leaves these imports pointing at the legacy `@/hooks/usePageTitle` path.
- **Refactoring the Artefacts `window` `CustomEvent` coupling** (`artifactsSearch` / `addArtefact`, §2.3) into a typed/shared mechanism — preserved verbatim, flagged as debt.
- **Wiring real data** for any of these surfaces — they are mock/placeholder pages by current design; mock seed data is treated as page content, not migrated to a backend.
- Any further LOC reduction beyond the directed Artifacts split (the rest are already small) — defer to **Phase 13** (post-modularization LOC audit).
- Pages owned by other phases (§1.3).

### 2.3 Frozen interfaces (per Spec 14 §2.3)

- **Routes unchanged:** `/calendar`, `/insights`, `/reports`, `/artifacts` (all `ProtectedRoute requireTenant`), and the `path="*"` NotFound catch-all.
- **User-facing copy unchanged:** the "⚡ Activator", "📊 Presenter", and "Artefacts" titles and all visible strings stay verbatim (product copy, not renamed by this phase).
- **Artefacts window-event contract preserved exactly:** listens on `window` for `CustomEvent("artifactsSearch")` and `CustomEvent("addArtefact")` (the global header search box + add-artefact action dispatch these). Same event names, same payload handling, same add/remove-listener lifecycle.
- **No visual change** to any page.

---

## §3 Target structure

Each migrated page becomes a route-named feature folder (the layout chosen with the user: per-page, route-aligned names, matching the existing `signals` / `customers` / `mission-control` convention):

```
src/features/calendar/
  pages/CalendarPage.tsx          # relocated Calendar.tsx, default export
  routes.tsx                      # calendarRoutes: [<Route path="/calendar"> wrapped]
  index.ts                        # export { calendarRoutes } from "./routes"
  README.md
src/features/insights/   …/pages/InsightsPage.tsx   + routes.tsx (insightsRoutes /insights)  + index.ts + README.md
src/features/reports/    …/pages/ReportsPage.tsx    + routes.tsx (reportsRoutes /reports)     + index.ts + README.md
src/features/artifacts/  …/pages/ArtifactsPage.tsx  + routes.tsx (artifactsRoutes /artifacts) + index.ts + README.md
                          + types.ts + data/ + lib/ + components/   (decomposition, §4)
src/features/shell/
  NotFound.tsx                    # relocated; re-exported from existing index.ts (§5)
```

Each `routes.tsx` follows the established wrap verbatim (cf. `features/mission-control/routes.tsx`):

```tsx
export const calendarRoutes = [
  <Route key="calendar" path="/calendar" element={
    <ProtectedRoute requireTenant>
      <FeatureErrorBoundary featureName="Calendar">
        <CalendarPage />
      </FeatureErrorBoundary>
    </ProtectedRoute>
  } />,
];
```

`featureName` strings: `"Calendar"`, `"Insights"`, `"Reports"`, `"Artifacts"` (the boundary label is developer-facing; product titles in §2.3 are untouched).

### 3.1 Dependency posture

Each feature imports only: `@/components/ui/*` (shadcn), `@/features/shell` (`Layout`, `ProtectedRoute` via its public barrel), `@/shared/components` (`FeatureErrorBoundary`), and the legacy `@/hooks/usePageTitle` (left in place for Phase 11; §2.2). **No cross-feature imports, no data layer, no MSW handlers, no contracts, no query keys.** This is the property that keeps the phase parallel-safe (§6).

---

## §4 Artifacts decomposition

`Artifacts.tsx` (`Artefacts`, 729 LOC) splits into focused units. Behavior, the mock data, the window-event contract, and all visible output are unchanged — this is a structural extraction only.

| New module | Contents (current source) |
|---|---|
| `features/artifacts/types.ts` | `ArtefactItem` interface |
| `features/artifacts/data/mockArtefacts.ts` | `mockArtefacts` seed array + `folders` seed (page content; no backend) |
| `features/artifacts/lib/artefactPdf.ts` | `generateAndDownloadPDF` + `createSimplePDF` (self-contained ~140-LOC PDF generator) — pure, unit-tested |
| `features/artifacts/lib/artefactPresentation.tsx` | `getTypeIcon` / `getStatusIcon` (icon/label mappers) |
| `features/artifacts/components/LibraryCard.tsx` | the inner `LibraryCard` sub-component (compact + expanded views, ~140 LOC) |
| `features/artifacts/components/ArtefactStats.tsx` | the four summary stat cards |
| `features/artifacts/components/FolderGrid.tsx` | the folders grid + active-folder header |
| `features/artifacts/pages/ArtifactsPage.tsx` | orchestrator: the 6 `useState`, the 2 `window` `CustomEvent` effects, edit/delete/download handlers, `filteredArtefacts`, and the page layout (target ~200 LOC) |

The two `window` `CustomEvent` listeners (`artifactsSearch`, `addArtefact`) stay in `ArtifactsPage.tsx` exactly as today (frozen, §2.3) — their refactor is deferred debt (§2.2, §10).

---

## §5 Routing rewire & NotFound handling

- **`src/app/routes.tsx`** (append-only): add four imports (`calendarRoutes`, `insightsRoutes`, `reportsRoutes`, `artifactsRoutes` from their barrels) and spread them into the `featureRoutes` array. This is the single mechanism Phase 4b built so feature phases append rather than edit App.tsx's `<Routes>` table.
- **`src/App.tsx`:**
  - Remove the four now-migrated page imports (`Calendar`, `Insights`, `Reports`, `Artifacts`) and their inline `<Route …>` blocks (their routes now arrive via `{featureRoutes}`, already rendered in App.tsx).
  - Re-point the `NotFound` import from `./pages/NotFound` to `@/features/shell`.
  - **Keep the `<Route path="*" element={<NotFound />} />` catch-all in App.tsx as the terminal route.** It must remain *last*, and ordering inside the appended `featureRoutes` array is not guaranteed, so NotFound's route is intentionally **not** moved into the feature-routes mechanism — only the component's home and import source change.
- **`src/features/shell/index.ts`:** add `export { default as NotFound } from "./NotFound";`.

---

## §6 Parallel-safety & coordination (Phases 8 + 10 in flight)

Spec 14 §4 caps concurrency at 3 phases; 8 + 10 + 12 = exactly 3. Collision analysis against the shared files:

| File | Phase 12 edit | Phase 8 / 10 edit | Risk & handling |
|---|---|---|---|
| `src/pages/*` page files | removes 5 disjoint files | 8: Signals/Deals; 10: Login/Settings/Tenant | **none** — disjoint sets |
| `src/test/msw/handlers.ts`, `src/shared/api/{queryKeys,contracts}` | **none** (no data layer) | 8 edits these | **none** — Phase 12 never touches them |
| `src/app/routes.tsx` | append 4 imports + 4 spreads | 8/10 append their own | **trivial** — same-array "accept all additions" conflict by design |
| `src/App.tsx` | remove 4 imports + 4 routes; re-point NotFound | 8 removes Signals; 10 removes Login/Settings/Tenant | **low** — different, mostly non-adjacent lines; worst case a small conflict in the alphabetical import block |
| `src/features/shell/index.ts` | add 1 export (NotFound) | 10 *should not* touch shell (auth/tenant live in `shared/`) | **low** — single added line |
| `docs/TECH_DEBT.md` | append provisional entries | 8/10 append theirs | **low** — append surgically, **no reformat** (prettier corrupts its markdown); trivial conflict at merge |
| `specs/`, `plans/`, `docs/reviews/` | NN-`29` files | 8=27, 10=28 | **none** — distinct NN filenames |

Discipline:
- **Surgical commits by path** on `worktree-phase-12-small-pages-sweep` — never `git add -A` (shared working tree).
- Branch is off `master`; no rebase onto 8/10. Conflicts (route registry, App.tsx) are resolved at the **merge gate**, after 8/10 land, by the integrator.
- NN/TD-FE numbers are claimed-by-creation and kept provisional until merge (§10).

---

## §7 Execution stages (single branch, staged checkpoints)

One feature per stage; each stage is independently green (`npm run verify` + `prettier --check` on touched files) and committed:

1. **`calendar`** — relocate + routes.tsx + index.ts + README + render test; wire into `app/routes.tsx`; drop from App.tsx.
2. **`insights`** — same.
3. **`reports`** — same.
4. **`artifacts` — relocation skeleton** — move page to `features/artifacts/pages/ArtifactsPage.tsx` verbatim, add routes/index/README, wire routing, drop from App.tsx (still one big file; green).
5. **`artifacts` — decomposition** — extract `types` → `data` → `lib/artefactPdf` (+ unit test) → `lib/artefactPresentation` → `components/*`, shrinking the page to the orchestrator (§4). Each extraction its own commit.
6. **`shell` / NotFound** — relocate NotFound into shell, export from `index.ts`, re-point App.tsx import.
7. **Finalize** — confirm `src/pages/` holds no Phase-12 pages; README sweep; provisional TD-FE entries; run full `npm run preflight` **on an idle box** (avoid CPU-spiking the active phase-8/10 sandboxes).

Each commit message uses `type(fe):` style, no `[N/M]` suffix, no Co-Authored-By footer.

## §8 Error handling, testing & parity

- **Error handling:** each route wrapped in `FeatureErrorBoundary` (§3) — parity with Phases 5–7; previously these pages had none, so this is a net improvement, not a behavior change to existing happy paths.
- **Tests:** one render/smoke Vitest (RTL) per page asserting it mounts inside `Layout` and shows its title/landmark; one unit test for `artefactPdf` (deterministic string output for a fixed `ArtefactItem`). No MSW needed (no fetches). Run with `--no-file-parallelism` locally if the shared box is under contention (known vitest flake).
- **Parity:** no VR baseline is added (these are static surfaces; consistent with the Phase 5 visual-guard posture). Behavioral parity = routes resolve, pages render, Artefacts edit/delete/download/search/add behaviors unchanged.
- **Gate:** per-task `npm run verify` + `prettier --check`; full `npm run preflight` only at the merge gate.

## §9 Risks

1. **App.tsx / route-registry merge conflict with 8/10.** Mitigated: append-only registry by design; different App.tsx lines; resolved at the gate. *Low.*
2. **`features/shell/index.ts` touched by both 12 and 10.** Mitigated: phase 10's auth/tenant live in `shared/`, not shell; single-line add. *Low.*
3. **Artifacts decomposition introduces a behavior regression** (it's the only non-mechanical change). Mitigated: extract-in-place, keep the window-event contract and mock data byte-identical, render + PDF unit tests, per-extraction commits for easy bisect. *Medium → Low.*
4. **`usePageTitle` legacy import flagged by an import/boundary lint rule.** Mitigated: prior phases' pages import it the same way; `@/hooks/*` is a legacy top-level dir, not another feature, so `import-x/no-internal-modules` (`@/features/*/!(index)`) does not apply. *Low.*
5. **NN/TD-FE race with a sibling sandbox.** Mitigated: 29 verified free across all branches; claim by committing promptly; TD-FE provisional. *Low.*

## §10 Provisional TD-FE allocations (finalized at merge)

Numbers provisional from **TD-FE-47** (master high-water is 46; phases 8/10 may also be allocating — finalize the actual integers at merge to avoid collision):

- **TD-FE-47** — `usePageTitle` and other legacy `@/hooks` imports in the new `calendar`/`reports`/`artifacts` features remain on the legacy path; promote to `@/shared/hooks` in Phase 11.
- **TD-FE-48** — Artefacts cross-component coupling via untyped `window` `CustomEvent`s (`artifactsSearch`, `addArtefact`); replace with a typed/shared mechanism.
- **TD-FE-49** — Calendar/Insights/Reports/Artefacts are mock/placeholder surfaces with hardcoded seed data and no backend; wire real data when these products are built.

## §11 Done when

- `Calendar`, `Insights`, `Reports`, `Artifacts` live under route-named `src/features/*` with page + `routes.tsx` + `index.ts` + `README.md`; `NotFound` lives in `features/shell` and is exported from its barrel.
- `src/pages/` contains **no Phase-12 pages** (only pages owned by Phases 8/9/10 remain, pending their merges) — satisfying Phase 11's eventual empty-`pages/` check for this phase's share.
- `Artifacts.tsx` is decomposed per §4; `ArtifactsPage.tsx` is the thin orchestrator.
- Routes `/calendar`, `/insights`, `/reports`, `/artifacts`, and the `*` catch-all resolve and render unchanged; all wrapped in `FeatureErrorBoundary`.
- Per-page render tests + `artefactPdf` unit test pass; `npm run verify` and `prettier --check` green per stage; full `preflight` green at the gate.
- Provisional TD-FE entries appended to `docs/TECH_DEBT.md` (surgically, no reformat).
- Spec 14 Phase-12 `Deals.tsx` scope correction logged as a master-plan delta at merge.
