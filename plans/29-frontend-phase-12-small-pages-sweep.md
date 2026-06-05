# Phase 12 — small-pages sweep · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relocate the five remaining un-claimed `src/pages/` surfaces (`Calendar`, `Insights`, `Reports`, `Artifacts`, `NotFound`) into per-feature folders, decompose `Artifacts.tsx` (729 LOC), and rewire routing — with zero behavior change. Implements Spec 29 / Spec 14 §4 Phase 12.

**Architecture:** Each page becomes a route-named feature folder (`features/{calendar,insights,reports,artifacts}`) with a `pages/<X>Page.tsx`, an append-only `routes.tsx` (`ProtectedRoute` + `FeatureErrorBoundary`), an `index.ts` barrel, and a `README.md`. `NotFound` moves into `features/shell`. Routes are wired by appending to `src/app/routes.tsx`; the migrated pages' inline `<Route>`s are removed from `App.tsx`. `Artifacts` is split into types / data / lib / components + a thin orchestrator page.

**Tech Stack:** React 18, Vite, TypeScript, react-router-dom v6 (`<Route>` element arrays), Vitest + Testing Library, shadcn-ui. No data layer (these are presentational surfaces).

---

## Conventions & execution rules (read first — these override habits)

- **Branch & merge.** Work on `worktree-phase-12-small-pages-sweep`, branched off `master` (`0f0b96c`). The whole phase merges **once**, `--no-ff`, after the Stage 5 serial preflight is green (human-approved). Do **not** merge per-stage. The branch is local/unshared, so a failed stage may be discarded with `git reset --hard <last-green-checkpoint>` rather than reverted.
- **Worktree git.** This executes in `.claude/worktrees/phase-12-small-pages-sweep`. Run every git op from that directory (or `git -C <worktree-abs-path> …`) — a bare `cd <repo-root>` lands in the **main checkout** (currently the active phase-8 branch), not this worktree.
- **Surgical commits in a shared tree.** Phases 8 and 10 share this working tree's `.git`. **Never `git add -A`.** Stage only the explicit paths each task names. One logical step = one commit.
- **Commit messages.** `type(scope):` form (`refactor(fe):`, `feat(fe):`, `test(fe):`, `chore(fe):`, `docs:`). No `[N/M]` suffixes. **No `Co-Authored-By` footer.** Body only when the *why* isn't obvious from the diff.
- **Inner loop (per task).** From `frontend/`: `npm run verify` (= `typecheck && lint && test:changed` — **incremental**, only changed-graph tests). Because `verify` omits `format:check`, also run `npx prettier --check <touched .ts/.tsx files>` — but **never** prettier `docs/TECH_DEBT.md` (outside the FE prettier gate; prettier corrupts its unfenced markdown).
- **Do NOT run `npm run knip` before Stage 5.** Each feature barrel's export is consumed in the same task (no hook-first window is expected), but reserve `knip` for the merge preflight regardless, per house convention. `verify` does not run knip.
- **Vitest flake.** If the full suite flakes on async `waitFor` tests under CPU contention (phases 8/10 are active), rerun with `npm run test -- --no-file-parallelism` (100% green; not a defect). Do not weaken assertions.
- **Stage gate (cross-cutting regression guard).** `verify` is incremental (`test:changed`), so a relocation that broke a test *outside* the changed graph wouldn't surface until the final `preflight`. (Grep confirms only `App.tsx` imports the five pages and no test imports them, so the practical risk is low — but it is structural.) At the **multi-task stage boundaries (end of Stage 1 and end of Stage 3)** run the **full** Vitest suite — `npm run test` (all files; `-- --no-file-parallelism` if it flakes) — before starting the next stage, so an early regression surfaces at the stage that caused it rather than 13 tasks later.
- **Parity is the contract.** No behavior, route, storage-key, event-name, or pixel change. User-facing copy is frozen (Spec 29 §2.3) — including the `⚡ Activator` / `📊 Presenter` / `Artefacts` titles and Insights' existing `<h1>Reports</h1>` quirk. Renaming a React **component identifier** (e.g. `Artefacts` → `ArtifactsPage`) is code, not copy, and is allowed.
- **`react-router-dom` import ordering.** ESLint `import/order` enforces alphabetical ordering **within** the `@/features/*` group of `src/app/routes.tsx`. Insert each new `import { xRoutes } from "@/features/x";` in alphabetical position; the `featureRoutes` **array** order is insertion-order (append) and is not lint-enforced. Run `lint` to confirm.
- **Abort / escalation.** Per-step parity + per-stage `git reset --hard <last-green-checkpoint>` are the recovery primitives. *Per-task:* if a single task fails its gate three times with no clear fix, stop and escalate to the human controller. *Global criteria:* (a) if **Stage 3 (Artifacts decomposition)** can't reach green, `git reset --hard` to the **Task 4 checkpoint** and ship Phase 12 as **relocation-only** — decomposition was an additive choice that overlaps Phase 13, and relocation alone satisfies the empty-`pages/` goal; (b) if the final `preflight` can't go green, or more than ~3 tasks escalate, **suspend the phase** and revisit Spec 29 rather than landing a partial/behavior-changing cut. The branch is unshared, so suspension costs only the discarded work.
- **Parallelizable (subagent mode).** Tasks 1, 2, 3 (calendar/insights/reports relocations) are mutually independent except for the shared edits to `src/app/routes.tsx` and `src/App.tsx`; if run concurrently they will trivially conflict on those two files. Prefer **serial** execution for these three to keep the route-registry edits clean. The Artifacts decomposition (Tasks 5–11) is strictly serial (each consumes the prior extraction).

---

## File structure (target — Spec 29 §3, §4)

```
src/features/calendar/
├── pages/CalendarPage.tsx        # from src/pages/Calendar.tsx (route /calendar; "⚡ Activator")
├── pages/__tests__/CalendarPage.test.tsx
├── routes.tsx                    # calendarRoutes
├── index.ts
└── README.md
src/features/insights/            # …/InsightsPage.tsx (route /insights) + routes/index/README/test
src/features/reports/             # …/ReportsPage.tsx  (route /reports; "📊 Presenter") + routes/index/README/test
src/features/artifacts/
├── pages/ArtifactsPage.tsx       # orchestrator (was Artefacts, 729 LOC) — state, effects, handlers, derived folders/filteredArtefacts, layout
├── pages/__tests__/ArtifactsPage.test.tsx
├── types.ts                      # ArtefactItem
├── data/mockArtefacts.ts         # mockArtefacts seed array ONLY (folders is derived in the page)
├── lib/artefactPdf.ts            # generateAndDownloadPDF + createSimplePDF
├── lib/__tests__/artefactPdf.test.ts
├── lib/artefactPresentation.tsx  # getTypeIcon / getStatusIcon
├── components/LibraryCard.tsx    # relocation of the existing named inner component
├── components/ArtefactStats.tsx  # NEW component, lifted from inline JSX
├── components/FolderGrid.tsx     # NEW component, lifted from inline JSX
├── routes.tsx                    # artifactsRoutes
├── index.ts
└── README.md
src/features/shell/
├── NotFound.tsx                  # relocated from src/pages/NotFound.tsx
└── index.ts                      # + export { default as NotFound }
```

Modified shared files: `src/app/routes.tsx` (append 4 imports + 4 spreads), `src/App.tsx` (remove 4 imports + 4 `<Route>`s; re-point `NotFound` import), `docs/TECH_DEBT.md` (append provisional TD-FE-47…49).

---

# Stage 1 — Pure page relocations (calendar · insights · reports)

Spec 29 §7 stages 1–3. Each page is independent and has no data layer. Per task: move the file (preserving history), rename the default export to `<X>Page`, create the feature's `routes.tsx` / `index.ts` / `README.md`, wire `app/routes.tsx`, remove the page from `App.tsx` (one commit), then add a render smoke test (second commit).

## Task 1: Relocate `Calendar` → `features/calendar`

**Files:**
- Move → Create: `frontend/src/features/calendar/pages/CalendarPage.tsx` (from `frontend/src/pages/Calendar.tsx`)
- Create: `frontend/src/features/calendar/routes.tsx`
- Create: `frontend/src/features/calendar/index.ts`
- Create: `frontend/src/features/calendar/README.md`
- Create: `frontend/src/features/calendar/pages/__tests__/CalendarPage.test.tsx`
- Modify: `frontend/src/app/routes.tsx`
- Modify: `frontend/src/App.tsx`
- Delete (via move): `frontend/src/pages/Calendar.tsx`

- [ ] **Step 1: Move the file (history-preserving).**

```bash
git mv frontend/src/pages/Calendar.tsx frontend/src/features/calendar/pages/CalendarPage.tsx
```

- [ ] **Step 2: Rename the default export.** In `CalendarPage.tsx`, rename the component and its export (body unchanged):

```ts
// was: const Calendar = () => {  …unchanged body…  };  export default Calendar;
const CalendarPage = () => {
  // …unchanged body (keeps usePageTitle("⚡ Activator - Brewra"), local useState, ui)…
};

export default CalendarPage;
```
No import paths inside the file change — it imports only `@/components/ui/*`, `@/features/shell` (`Layout`), and `@/hooks/usePageTitle`, all of which are still valid from the new location.

- [ ] **Step 3: Create `routes.tsx`.**

```tsx
import { Route } from "react-router-dom";

import CalendarPage from "./pages/CalendarPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

export const calendarRoutes = [
  <Route
    key="calendar"
    path="/calendar"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Calendar">
          <CalendarPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
```

- [ ] **Step 4: Create `index.ts`.**

```ts
// Public surface for the `calendar` feature. Composed by src/app/routes.tsx.
export { calendarRoutes } from "./routes";
```

- [ ] **Step 5: Create `README.md`.**

```markdown
# `calendar` feature

The Activator surface (route `/calendar`). Presentational / local-state only — no data layer.

## Public surface
- `calendarRoutes` — registry entry (`/calendar`, `ProtectedRoute requireTenant` + `FeatureErrorBoundary`), composed by `src/app/routes.tsx`.

## Key files
- `pages/CalendarPage.tsx` — the page (relocated from `src/pages/Calendar.tsx`).

## Dependency notes
- Imports `Layout` from `@/features/shell`, `FeatureErrorBoundary` from `@/shared/components`, and the legacy `@/hooks/usePageTitle` (promoted to `@/shared/hooks` in Phase 11 — TD-FE-47).
```

- [ ] **Step 6: Wire `src/app/routes.tsx`.** Add the import in alphabetical position (calendar precedes customers) and append the spread:

```ts
import { calendarRoutes } from "@/features/calendar";
import { customersRoutes } from "@/features/customers";
import { marketResearchRoutes } from "@/features/market-research";
import { missionControlRoutes } from "@/features/mission-control";

export const featureRoutes = [
  ...marketResearchRoutes,
  ...missionControlRoutes,
  ...customersRoutes,
  ...calendarRoutes,
];
```

- [ ] **Step 7: Remove `Calendar` from `App.tsx`.** Delete the import line `import Calendar from "./pages/Calendar";` and this block (the route is now served via `{featureRoutes}`):

```tsx
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute requireTenant>
                      <Calendar />
                    </ProtectedRoute>
                  }
                />
```

- [ ] **Step 8: Verify + format.** From `frontend/`:

```
npm run verify
npx prettier --check src/features/calendar/pages/CalendarPage.tsx src/features/calendar/routes.tsx src/features/calendar/index.ts src/app/routes.tsx src/App.tsx
```
Expected: PASS. (`lint` confirms the import ordering in `app/routes.tsx`.)

- [ ] **Step 9: Commit the relocation.**

```bash
git add frontend/src/features/calendar/pages/CalendarPage.tsx frontend/src/features/calendar/routes.tsx frontend/src/features/calendar/index.ts frontend/src/features/calendar/README.md frontend/src/app/routes.tsx frontend/src/App.tsx
git commit -m "refactor(fe): relocate Calendar page into features/calendar"
```

- [ ] **Step 10: Write the render smoke test.**

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import CalendarPage from "../CalendarPage";

// Layout pulls in router/sidebar/auth; stub it to render children directly.
vi.mock("@/features/shell", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("CalendarPage", () => {
  it("mounts and sets the Activator page title", () => {
    const { container } = render(<CalendarPage />);
    expect(container).not.toBeEmptyDOMElement();
    expect(document.title).toBe("⚡ Activator - Brewra");
  });
});
```

- [ ] **Step 11: Run the test.**

Run: `npm run test -- src/features/calendar/pages/__tests__/CalendarPage.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 12: Commit the test.**

```bash
git add frontend/src/features/calendar/pages/__tests__/CalendarPage.test.tsx
git commit -m "test(fe): add CalendarPage render smoke test"
```

## Task 2: Relocate `Insights` → `features/insights`

**Files:**
- Move → Create: `frontend/src/features/insights/pages/InsightsPage.tsx` (from `frontend/src/pages/Insights.tsx`)
- Create: `frontend/src/features/insights/routes.tsx`, `index.ts`, `README.md`
- Create: `frontend/src/features/insights/pages/__tests__/InsightsPage.test.tsx`
- Modify: `frontend/src/app/routes.tsx`, `frontend/src/App.tsx`
- Delete (via move): `frontend/src/pages/Insights.tsx`

- [ ] **Step 1: Move.**

```bash
git mv frontend/src/pages/Insights.tsx frontend/src/features/insights/pages/InsightsPage.tsx
```

- [ ] **Step 2: Rename the default export** (body unchanged; note Insights has no `usePageTitle` and renders an existing `<h1>Reports</h1>` — frozen copy):

```ts
const InsightsPage = () => {
  // …unchanged body…
};

export default InsightsPage;
```

- [ ] **Step 3: Create `routes.tsx`.**

```tsx
import { Route } from "react-router-dom";

import InsightsPage from "./pages/InsightsPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

export const insightsRoutes = [
  <Route
    key="insights"
    path="/insights"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Insights">
          <InsightsPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
```

- [ ] **Step 4: Create `index.ts`.**

```ts
// Public surface for the `insights` feature. Composed by src/app/routes.tsx.
export { insightsRoutes } from "./routes";
```

- [ ] **Step 5: Create `README.md`.**

```markdown
# `insights` feature

The Insights dashboard surface (route `/insights`). Presentational / local-state only — no data layer.

## Public surface
- `insightsRoutes` — registry entry (`/insights`, `ProtectedRoute requireTenant` + `FeatureErrorBoundary`), composed by `src/app/routes.tsx`.

## Key files
- `pages/InsightsPage.tsx` — the page (relocated from `src/pages/Insights.tsx`). Note: its top heading is the literal text "Reports" (pre-existing copy, frozen).

## Dependency notes
- Imports `Layout` from `@/features/shell` and `FeatureErrorBoundary` from `@/shared/components`. No `usePageTitle`.
```

- [ ] **Step 6: Wire `src/app/routes.tsx`** (insights precedes market-research alphabetically):

```ts
import { calendarRoutes } from "@/features/calendar";
import { customersRoutes } from "@/features/customers";
import { insightsRoutes } from "@/features/insights";
import { marketResearchRoutes } from "@/features/market-research";
import { missionControlRoutes } from "@/features/mission-control";

export const featureRoutes = [
  ...marketResearchRoutes,
  ...missionControlRoutes,
  ...customersRoutes,
  ...calendarRoutes,
  ...insightsRoutes,
];
```

- [ ] **Step 7: Remove `Insights` from `App.tsx`.** Delete `import Insights from "./pages/Insights";` and:

```tsx
                <Route
                  path="/insights"
                  element={
                    <ProtectedRoute requireTenant>
                      <Insights />
                    </ProtectedRoute>
                  }
                />
```

- [ ] **Step 8: Verify + format.**

```
npm run verify
npx prettier --check src/features/insights/pages/InsightsPage.tsx src/features/insights/routes.tsx src/features/insights/index.ts src/app/routes.tsx src/App.tsx
```
Expected: PASS.

- [ ] **Step 9: Commit the relocation.**

```bash
git add frontend/src/features/insights/pages/InsightsPage.tsx frontend/src/features/insights/routes.tsx frontend/src/features/insights/index.ts frontend/src/features/insights/README.md frontend/src/app/routes.tsx frontend/src/App.tsx
git commit -m "refactor(fe): relocate Insights page into features/insights"
```

- [ ] **Step 10: Write the render smoke test** (Insights has no title hook; assert its rendered `<h1>`):

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import InsightsPage from "../InsightsPage";

vi.mock("@/features/shell", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("InsightsPage", () => {
  it("mounts and renders its top heading", () => {
    render(<InsightsPage />);
    // Pre-existing copy: the Insights page's <h1> text is literally "Reports".
    expect(screen.getByRole("heading", { level: 1, name: "Reports" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Run the test.**

Run: `npm run test -- src/features/insights/pages/__tests__/InsightsPage.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 12: Commit the test.**

```bash
git add frontend/src/features/insights/pages/__tests__/InsightsPage.test.tsx
git commit -m "test(fe): add InsightsPage render smoke test"
```

## Task 3: Relocate `Reports` → `features/reports`

**Files:**
- Move → Create: `frontend/src/features/reports/pages/ReportsPage.tsx` (from `frontend/src/pages/Reports.tsx`)
- Create: `frontend/src/features/reports/routes.tsx`, `index.ts`, `README.md`
- Create: `frontend/src/features/reports/pages/__tests__/ReportsPage.test.tsx`
- Modify: `frontend/src/app/routes.tsx`, `frontend/src/App.tsx`
- Delete (via move): `frontend/src/pages/Reports.tsx`

- [ ] **Step 1: Move.**

```bash
git mv frontend/src/pages/Reports.tsx frontend/src/features/reports/pages/ReportsPage.tsx
```

- [ ] **Step 2: Rename the default export** (body unchanged; keeps `usePageTitle("📊 Presenter - Brewra")`):

```ts
const ReportsPage = () => {
  // …unchanged body…
};

export default ReportsPage;
```

- [ ] **Step 3: Create `routes.tsx`.**

```tsx
import { Route } from "react-router-dom";

import ReportsPage from "./pages/ReportsPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

export const reportsRoutes = [
  <Route
    key="reports"
    path="/reports"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Reports">
          <ReportsPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
```

- [ ] **Step 4: Create `index.ts`.**

```ts
// Public surface for the `reports` feature. Composed by src/app/routes.tsx.
export { reportsRoutes } from "./routes";
```

- [ ] **Step 5: Create `README.md`.**

```markdown
# `reports` feature

The Presenter surface (route `/reports`). Presentational / local-state only — no data layer.

## Public surface
- `reportsRoutes` — registry entry (`/reports`, `ProtectedRoute requireTenant` + `FeatureErrorBoundary`), composed by `src/app/routes.tsx`.

## Key files
- `pages/ReportsPage.tsx` — the page (relocated from `src/pages/Reports.tsx`).

## Dependency notes
- Imports `Layout` from `@/features/shell`, `FeatureErrorBoundary` from `@/shared/components`, and the legacy `@/hooks/usePageTitle` (promoted in Phase 11 — TD-FE-47).
```

- [ ] **Step 6: Wire `src/app/routes.tsx`** (reports follows missionControl in the import group — alphabetical `reports` after `mission-control`, before none):

```ts
import { calendarRoutes } from "@/features/calendar";
import { customersRoutes } from "@/features/customers";
import { insightsRoutes } from "@/features/insights";
import { marketResearchRoutes } from "@/features/market-research";
import { missionControlRoutes } from "@/features/mission-control";
import { reportsRoutes } from "@/features/reports";

export const featureRoutes = [
  ...marketResearchRoutes,
  ...missionControlRoutes,
  ...customersRoutes,
  ...calendarRoutes,
  ...insightsRoutes,
  ...reportsRoutes,
];
```

- [ ] **Step 7: Remove `Reports` from `App.tsx`.** Delete `import Reports from "./pages/Reports";` and:

```tsx
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute requireTenant>
                      <Reports />
                    </ProtectedRoute>
                  }
                />
```

- [ ] **Step 8: Verify + format.**

```
npm run verify
npx prettier --check src/features/reports/pages/ReportsPage.tsx src/features/reports/routes.tsx src/features/reports/index.ts src/app/routes.tsx src/App.tsx
```
Expected: PASS.

- [ ] **Step 9: Commit the relocation.**

```bash
git add frontend/src/features/reports/pages/ReportsPage.tsx frontend/src/features/reports/routes.tsx frontend/src/features/reports/index.ts frontend/src/features/reports/README.md frontend/src/app/routes.tsx frontend/src/App.tsx
git commit -m "refactor(fe): relocate Reports page into features/reports"
```

- [ ] **Step 10: Write the render smoke test.**

```tsx
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ReportsPage from "../ReportsPage";

vi.mock("@/features/shell", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("ReportsPage", () => {
  it("mounts and sets the Presenter page title", () => {
    const { container } = render(<ReportsPage />);
    expect(container).not.toBeEmptyDOMElement();
    expect(document.title).toBe("📊 Presenter - Brewra");
  });
});
```

- [ ] **Step 11: Run the test.**

Run: `npm run test -- src/features/reports/pages/__tests__/ReportsPage.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 12: Commit the test.**

```bash
git add frontend/src/features/reports/pages/__tests__/ReportsPage.test.tsx
git commit -m "test(fe): add ReportsPage render smoke test"
```

- [ ] **Stage 1 gate — full suite.** Before Stage 2, run the full Vitest suite to catch any cross-cutting regression from the three relocations:

```
npm run test
```
Expected: PASS (rerun `-- --no-file-parallelism` if it flakes under contention).

---

# Stage 2 — Artifacts relocation (verbatim skeleton)

Spec 29 §7 stage 4. Move `Artifacts.tsx` into `features/artifacts/pages/ArtifactsPage.tsx` **verbatim** (one big file), wire routing, drop from `App.tsx`. No decomposition yet — that is Stage 3. This keeps a green checkpoint before the split.

## Task 4: Relocate `Artifacts` → `features/artifacts`

**Files:**
- Move → Create: `frontend/src/features/artifacts/pages/ArtifactsPage.tsx` (from `frontend/src/pages/Artifacts.tsx`)
- Create: `frontend/src/features/artifacts/routes.tsx`, `index.ts`, `README.md`
- Create: `frontend/src/features/artifacts/pages/__tests__/ArtifactsPage.test.tsx`
- Modify: `frontend/src/app/routes.tsx`, `frontend/src/App.tsx`
- Delete (via move): `frontend/src/pages/Artifacts.tsx`

- [ ] **Step 1: Move.**

```bash
git mv frontend/src/pages/Artifacts.tsx frontend/src/features/artifacts/pages/ArtifactsPage.tsx
```

- [ ] **Step 2: Rename the default export only.** Rename the component identifier `Artefacts` → `ArtifactsPage` and its `export default` (the file's internal `ArtefactItem`, `mockArtefacts`, `LibraryCard`, handlers, and the `usePageTitle("Artefacts - Brewra")` title string stay **unchanged** — these move in Stage 3 / are frozen copy):

```ts
const ArtifactsPage = () => {
  // …unchanged body (ArtefactItem-typed state, the two window CustomEvent effects,
  //  handlers, derived filteredArtefacts + folders, LibraryCard, layout)…
};

export default ArtifactsPage;
```

- [ ] **Step 3: Create `routes.tsx`.**

```tsx
import { Route } from "react-router-dom";

import ArtifactsPage from "./pages/ArtifactsPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

export const artifactsRoutes = [
  <Route
    key="artifacts"
    path="/artifacts"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Artifacts">
          <ArtifactsPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
```

- [ ] **Step 4: Create `index.ts`.**

```ts
// Public surface for the `artifacts` feature. Composed by src/app/routes.tsx.
export { artifactsRoutes } from "./routes";
```

- [ ] **Step 5: Create `README.md`.**

```markdown
# `artifacts` feature

The Artefacts library surface (route `/artifacts`). Presentational / local-state only — no data layer; mock seed data. **The "Key files" list is finalized in Task 11**, after the page is decomposed.

## Public surface
- `artifactsRoutes` — registry entry (`/artifacts`, `ProtectedRoute requireTenant` + `FeatureErrorBoundary`), composed by `src/app/routes.tsx`.

## Key files
- `pages/ArtifactsPage.tsx` — the page (relocated from `src/pages/Artifacts.tsx`; decomposed in Stage 3).

## Dependency notes
- Imports `Layout` from `@/features/shell`, `FeatureErrorBoundary` from `@/shared/components`, legacy `@/hooks/usePageTitle` (Phase 11 — TD-FE-47).
- Listens on `window` for `CustomEvent("artifactsSearch")` / `CustomEvent("addArtefact")` (header search + add-artefact). Untyped global-event coupling — TD-FE-48.
```

- [ ] **Step 6: Wire `src/app/routes.tsx`** (artifacts is first alphabetically in the `@/features/*` group):

```ts
import { artifactsRoutes } from "@/features/artifacts";
import { calendarRoutes } from "@/features/calendar";
import { customersRoutes } from "@/features/customers";
import { insightsRoutes } from "@/features/insights";
import { marketResearchRoutes } from "@/features/market-research";
import { missionControlRoutes } from "@/features/mission-control";
import { reportsRoutes } from "@/features/reports";

export const featureRoutes = [
  ...marketResearchRoutes,
  ...missionControlRoutes,
  ...customersRoutes,
  ...calendarRoutes,
  ...insightsRoutes,
  ...reportsRoutes,
  ...artifactsRoutes,
];
```

- [ ] **Step 7: Remove `Artifacts` from `App.tsx`.** Delete `import Artifacts from "./pages/Artifacts";` and:

```tsx
                <Route
                  path="/artifacts"
                  element={
                    <ProtectedRoute requireTenant>
                      <Artifacts />
                    </ProtectedRoute>
                  }
                />
```

- [ ] **Step 8: Verify + format.**

```
npm run verify
npx prettier --check src/features/artifacts/pages/ArtifactsPage.tsx src/features/artifacts/routes.tsx src/features/artifacts/index.ts src/app/routes.tsx src/App.tsx
```
Expected: PASS.

- [ ] **Step 9: Commit the relocation.**

```bash
git add frontend/src/features/artifacts/pages/ArtifactsPage.tsx frontend/src/features/artifacts/routes.tsx frontend/src/features/artifacts/index.ts frontend/src/features/artifacts/README.md frontend/src/app/routes.tsx frontend/src/App.tsx
git commit -m "refactor(fe): relocate Artifacts page into features/artifacts"
```

- [ ] **Step 10: Write the render smoke test.**

```tsx
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ArtifactsPage from "../ArtifactsPage";

vi.mock("@/features/shell", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("ArtifactsPage", () => {
  it("mounts and sets the Artefacts page title", () => {
    const { container } = render(<ArtifactsPage />);
    expect(container).not.toBeEmptyDOMElement();
    expect(document.title).toBe("Artefacts - Brewra");
  });
});
```

- [ ] **Step 11: Run the test.**

Run: `npm run test -- src/features/artifacts/pages/__tests__/ArtifactsPage.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 12: Commit the test.**

```bash
git add frontend/src/features/artifacts/pages/__tests__/ArtifactsPage.test.tsx
git commit -m "test(fe): add ArtifactsPage render smoke test"
```

---

# Stage 3 — Artifacts decomposition

Spec 29 §4 / §7 stage 5. Strictly serial: each task extracts one unit from `ArtifactsPage.tsx` and re-imports it. After each task the page still compiles and the Stage-2 render test still passes (parity). Extract in dependency order so each new file's imports already exist: `types` → `data` → `lib/artefactPdf` → `lib/artefactPresentation` → `components/LibraryCard` → `components/ArtefactStats` → `components/FolderGrid`.

## Task 5: Extract `types.ts` (`ArtefactItem`)

**Files:**
- Create: `frontend/src/features/artifacts/types.ts`
- Modify: `frontend/src/features/artifacts/pages/ArtifactsPage.tsx`

- [ ] **Step 1: Create `types.ts`** by cutting the `ArtefactItem` interface verbatim from `ArtifactsPage.tsx`:

```ts
// Feature-local types for `artifacts` (cut verbatim from the page).
export interface ArtefactItem {
  // …exact fields from the original interface — move, do not retype from memory…
}
```

- [ ] **Step 2: Import it back in `ArtifactsPage.tsx`.** Remove the inline `interface ArtefactItem { … }` and add at the top of the local imports:

```ts
import type { ArtefactItem } from "../types";
```

- [ ] **Step 3: Verify + format.**

```
npm run verify
npx prettier --check src/features/artifacts/types.ts src/features/artifacts/pages/ArtifactsPage.tsx
```
Expected: PASS (the Stage-2 render test still passes).

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/features/artifacts/types.ts frontend/src/features/artifacts/pages/ArtifactsPage.tsx
git commit -m "refactor(fe): extract artifacts ArtefactItem type"
```

## Task 6: Extract `data/mockArtefacts.ts` (seed array only)

**Files:**
- Create: `frontend/src/features/artifacts/data/mockArtefacts.ts`
- Modify: `frontend/src/features/artifacts/pages/ArtifactsPage.tsx`

> **Parity note (Spec 29 §4, review F1):** move **only** the `mockArtefacts` array. The `folders` value is **derived at runtime** (`const folders = [...new Set(artefacts.filter((a) => a.folder).map((a) => a.folder!))];`) and **stays in the page** — do not turn it into a seed export.

- [ ] **Step 1: Create `data/mockArtefacts.ts`** by cutting the `mockArtefacts` literal verbatim:

```ts
import type { ArtefactItem } from "../types";

export const mockArtefacts: ArtefactItem[] = [
  // …exact seed objects, moved verbatim…
];
```

- [ ] **Step 2: Import it back** in `ArtifactsPage.tsx` (remove the inline `const mockArtefacts = [...]`):

```ts
import { mockArtefacts } from "../data/mockArtefacts";
```
Confirm the `const folders = [...new Set(...)]` line remains in the component body.

- [ ] **Step 3: Verify + format.**

```
npm run verify
npx prettier --check src/features/artifacts/data/mockArtefacts.ts src/features/artifacts/pages/ArtifactsPage.tsx
```
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/features/artifacts/data/mockArtefacts.ts frontend/src/features/artifacts/pages/ArtifactsPage.tsx
git commit -m "refactor(fe): extract artifacts mock seed data"
```

## Task 7: Extract `lib/artefactPdf.ts` (+ unit test)

**Files:**
- Create: `frontend/src/features/artifacts/lib/artefactPdf.ts`
- Create: `frontend/src/features/artifacts/lib/__tests__/artefactPdf.test.ts`
- Modify: `frontend/src/features/artifacts/pages/ArtifactsPage.tsx`

- [ ] **Step 1: Create `lib/artefactPdf.ts`** by moving `generateAndDownloadPDF` and `createSimplePDF` verbatim (these are defined inside the component today — lift them to module scope and export). `createSimplePDF(artefact)` returns the PDF string (`return pdfData`); `generateAndDownloadPDF(artefact)` builds a `Blob`, an anchor, and calls `.click()`:

```ts
import type { ArtefactItem } from "../types";

export const createSimplePDF = (artefact: ArtefactItem): string => {
  // …exact body, returns the PDF string (pdfData)…
};

export const generateAndDownloadPDF = (artefact: ArtefactItem): void => {
  const pdfContent = createSimplePDF(artefact);
  // …exact body: new Blob([pdfContent], { type: "application/pdf" }) → anchor → link.click()…
};
```

- [ ] **Step 2: Import them back** in `ArtifactsPage.tsx` (remove the two inline function definitions; `handleDownloadClick` still calls `generateAndDownloadPDF`):

```ts
import { generateAndDownloadPDF } from "../lib/artefactPdf";
```

- [ ] **Step 3: Write the unit test** (uses a real seed item, so no fabricated shape):

```ts
import { describe, expect, it } from "vitest";

import { mockArtefacts } from "../../data/mockArtefacts";
import { createSimplePDF } from "../artefactPdf";

describe("createSimplePDF", () => {
  it("returns a non-trivial PDF document string", () => {
    const pdf = createSimplePDF(mockArtefacts[0]);
    expect(pdf.startsWith("%PDF")).toBe(true);
    expect(pdf.length).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 4: Verify + format + run the new test.**

```
npm run verify
npm run test -- src/features/artifacts/lib/__tests__/artefactPdf.test.ts
npx prettier --check src/features/artifacts/lib/artefactPdf.ts src/features/artifacts/lib/__tests__/artefactPdf.test.ts src/features/artifacts/pages/ArtifactsPage.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit (lib).**

```bash
git add frontend/src/features/artifacts/lib/artefactPdf.ts frontend/src/features/artifacts/pages/ArtifactsPage.tsx
git commit -m "refactor(fe): extract artifacts PDF generator into lib/artefactPdf"
```

- [ ] **Step 6: Commit (test).**

```bash
git add frontend/src/features/artifacts/lib/__tests__/artefactPdf.test.ts
git commit -m "test(fe): add artefactPdf unit test"
```

## Task 8: Extract `lib/artefactPresentation.tsx` (icon mappers)

**Files:**
- Create: `frontend/src/features/artifacts/lib/artefactPresentation.tsx`
- Modify: `frontend/src/features/artifacts/pages/ArtifactsPage.tsx`

- [ ] **Step 1: Create `lib/artefactPresentation.tsx`** by moving `getTypeIcon` and `getStatusIcon` verbatim (they return JSX → `.tsx`; move the lucide-icon imports they use):

```tsx
import { /* …exact lucide icons used by the two mappers… */ } from "lucide-react";

import type { ArtefactItem } from "../types";

export const getTypeIcon = (type: ArtefactItem["type"]) => {
  // …exact body…
};

export const getStatusIcon = (status: ArtefactItem["status"]) => {
  // …exact body…
};
```

- [ ] **Step 2: Import them back** in `ArtifactsPage.tsx` (remove the two inline definitions and any lucide imports now used only by them):

```ts
import { getStatusIcon, getTypeIcon } from "../lib/artefactPresentation";
```

- [ ] **Step 3: Verify + format.**

```
npm run verify
npx prettier --check src/features/artifacts/lib/artefactPresentation.tsx src/features/artifacts/pages/ArtifactsPage.tsx
```
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/features/artifacts/lib/artefactPresentation.tsx frontend/src/features/artifacts/pages/ArtifactsPage.tsx
git commit -m "refactor(fe): extract artifacts icon mappers"
```

## Task 9: Extract `components/LibraryCard.tsx` (named-component relocation)

**Files:**
- Create: `frontend/src/features/artifacts/components/LibraryCard.tsx`
- Modify: `frontend/src/features/artifacts/pages/ArtifactsPage.tsx`

`LibraryCard` already exists as a named inner component (it closes over page state: `expandedArtefact`, `editingArtefact`, `editName`, and the `handle*` callbacks). Lift it to its own file and pass that closure as **props**.

- [ ] **Step 1: Create `components/LibraryCard.tsx`.** Move the component body; convert the captured values to a props interface:

```tsx
import type { ArtefactItem } from "../types";
import { getStatusIcon, getTypeIcon } from "../lib/artefactPresentation";
// …ui imports the card body uses (Card, CardContent, Button, Input, Badge, lucide icons)…

interface LibraryCardProps {
  artefact: ArtefactItem;
  expandedArtefact: string | null;
  editingArtefact: string | null;
  editName: string;
  onArtefactClick: (id: string) => void;
  onEditClick: (artefact: ArtefactItem, event: React.MouseEvent) => void;
  onDeleteClick: (id: string, event: React.MouseEvent) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDownloadClick: (artefact: ArtefactItem) => void;
  onEditNameChange: (value: string) => void;
}

export const LibraryCard = ({ artefact /* …rest of props… */ }: LibraryCardProps) => {
  // …exact JSX, with captured identifiers replaced by the props above…
};
```
(Confirm the exact captured set during extraction — the props above mirror the page's `useState`/handlers from Spec 29 §4; adjust to the actual closure.)

- [ ] **Step 2: Use it in `ArtifactsPage.tsx`** — remove the inline `const LibraryCard = …` and render the imported one with the props wired:

```tsx
import { LibraryCard } from "../components/LibraryCard";
// …in the artefacts.map(...) render:
// <LibraryCard artefact={artefact} expandedArtefact={expandedArtefact} … onArtefactClick={handleArtefactClick} … />
```

- [ ] **Step 3: Verify + format.**

```
npm run verify
npx prettier --check src/features/artifacts/components/LibraryCard.tsx src/features/artifacts/pages/ArtifactsPage.tsx
```
Expected: PASS (Stage-2 render test still green).

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/features/artifacts/components/LibraryCard.tsx frontend/src/features/artifacts/pages/ArtifactsPage.tsx
git commit -m "refactor(fe): extract artifacts LibraryCard component"
```

## Task 10: Extract `components/ArtefactStats.tsx` (new component from inline JSX)

**Files:**
- Create: `frontend/src/features/artifacts/components/ArtefactStats.tsx`
- Modify: `frontend/src/features/artifacts/pages/ArtifactsPage.tsx`

The four summary stat cards are **inline JSX** in the page `return` (not a component today). Lift the block into a new component that takes the `artefacts` array as a prop and computes its own counts.

- [ ] **Step 1: Create `components/ArtefactStats.tsx`.**

```tsx
import { Card, CardContent } from "@/components/ui/card";

import type { ArtefactItem } from "../types";

interface ArtefactStatsProps {
  artefacts: ArtefactItem[];
}

export const ArtefactStats = ({ artefacts }: ArtefactStatsProps) => {
  // …the four <Card> stat blocks, exact JSX, with `artefacts.length` and the
  //   other counts computed from the `artefacts` prop (move the expressions verbatim)…
};
```

- [ ] **Step 2: Use it in `ArtifactsPage.tsx`** — replace the inline stat-cards block with `<ArtefactStats artefacts={artefacts} />`:

```tsx
import { ArtefactStats } from "../components/ArtefactStats";
```

- [ ] **Step 3: Verify + format.**

```
npm run verify
npx prettier --check src/features/artifacts/components/ArtefactStats.tsx src/features/artifacts/pages/ArtifactsPage.tsx
```
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/features/artifacts/components/ArtefactStats.tsx frontend/src/features/artifacts/pages/ArtifactsPage.tsx
git commit -m "refactor(fe): extract artifacts ArtefactStats component"
```

## Task 11: Extract `components/FolderGrid.tsx` (new component from inline JSX)

**Files:**
- Create: `frontend/src/features/artifacts/components/FolderGrid.tsx`
- Modify: `frontend/src/features/artifacts/pages/ArtifactsPage.tsx`

The folders grid + active-folder header is **inline JSX** in the page `return`. Lift it into a component that receives the derived `folders`, the `activeFolder` state, and `onFolderSelect` as props (the page keeps owning `folders`/`activeFolder`).

- [ ] **Step 1: Create `components/FolderGrid.tsx`.**

```tsx
// …ui + lucide imports the folders block uses…

interface FolderGridProps {
  folders: string[];
  activeFolder: string | null;
  onFolderSelect: (folder: string | null) => void;
}

export const FolderGrid = ({ folders, activeFolder, onFolderSelect }: FolderGridProps) => {
  // …exact JSX for the `folders.length > 0` grid + active-folder header,
  //   with setActiveFolder(...) calls replaced by onFolderSelect(...)…
};
```

- [ ] **Step 2: Use it in `ArtifactsPage.tsx`** — replace the inline folders block with `<FolderGrid folders={folders} activeFolder={activeFolder} onFolderSelect={setActiveFolder} />`:

```tsx
import { FolderGrid } from "../components/FolderGrid";
```

- [ ] **Step 3: Verify + format, and confirm the page shrank.**

```
npm run verify
npx prettier --check src/features/artifacts/components/FolderGrid.tsx src/features/artifacts/pages/ArtifactsPage.tsx
wc -l src/features/artifacts/pages/ArtifactsPage.tsx
```
Expected: PASS. `ArtifactsPage.tsx` is now the orchestrator (state, two `window` effects, handlers, derived `filteredArtefacts` + `folders`, and the assembled layout). LOC is validated here — Spec 29's ~200 target is a guide, not a gate.

- [ ] **Step 4: Finalize the Artifacts `README.md`.** Now that the files exist, replace the "Key files" section with the real structure and drop the "finalized in Task 11" note from the intro line:

```markdown
## Key files
- `pages/ArtifactsPage.tsx` — orchestrator (state, the two `window` CustomEvent listeners, handlers, derived `filteredArtefacts`/`folders`, layout).
- `types.ts` — `ArtefactItem`.
- `data/mockArtefacts.ts` — mock seed data (`folders` is derived in the page, not seeded).
- `lib/artefactPdf.ts` — `createSimplePDF` / `generateAndDownloadPDF`.
- `lib/artefactPresentation.tsx` — `getTypeIcon` / `getStatusIcon`.
- `components/LibraryCard.tsx`, `ArtefactStats.tsx`, `FolderGrid.tsx` — view pieces.
```

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/features/artifacts/components/FolderGrid.tsx frontend/src/features/artifacts/pages/ArtifactsPage.tsx frontend/src/features/artifacts/README.md
git commit -m "refactor(fe): extract artifacts FolderGrid component"
```

- [ ] **Step 6: Stage 3 gate — full suite.** Before Stage 4, run the full Vitest suite (cross-cutting guard — the first full run after the seven-step decomposition):

```
npm run test
```
Expected: PASS (rerun `-- --no-file-parallelism` if it flakes under contention).

---

# Stage 4 — NotFound → shell

Spec 29 §5 / §7 stage 6.

## Task 12: Relocate `NotFound` into `features/shell`

**Files:**
- Move → Create: `frontend/src/features/shell/NotFound.tsx` (from `frontend/src/pages/NotFound.tsx`)
- Modify: `frontend/src/features/shell/index.ts`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/features/shell/__tests__/NotFound.test.tsx`
- Delete (via move): `frontend/src/pages/NotFound.tsx`

> The `<Route path="*" element={<NotFound />} />` catch-all **stays in `App.tsx`** (it must remain the last route; it is not order-safe inside `featureRoutes`). Only the component's home and the import source change.

- [ ] **Step 1: Move.**

```bash
git mv frontend/src/pages/NotFound.tsx frontend/src/features/shell/NotFound.tsx
```
The file content is unchanged (it imports only `react` + `react-router-dom`; default export stays `NotFound`).

- [ ] **Step 2: Export from `shell/index.ts`.** Append:

```ts
export { default as NotFound } from "./NotFound";
```

- [ ] **Step 3: Re-point the import in `App.tsx`.** Replace `import NotFound from "./pages/NotFound";` with the shell barrel import (place it with the other `@/` imports per import/order):

```ts
import { NotFound } from "@/features/shell";
```
Leave the `<Route path="*" element={<NotFound />} />` line as-is.

- [ ] **Step 4: Verify + format.**

```
npm run verify
npx prettier --check src/features/shell/NotFound.tsx src/features/shell/index.ts src/App.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit the relocation.**

```bash
git add frontend/src/features/shell/NotFound.tsx frontend/src/features/shell/index.ts frontend/src/App.tsx
git commit -m "refactor(fe): relocate NotFound into features/shell"
```

- [ ] **Step 6: Write the render smoke test** (NotFound uses `useLocation`, so wrap in a router):

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { NotFound } from "@/features/shell";

describe("NotFound", () => {
  it("renders the 404 message", () => {
    render(
      <MemoryRouter initialEntries={["/does-not-exist"]}>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "404" })).toBeInTheDocument();
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run the test.**

Run: `npm run test -- src/features/shell/__tests__/NotFound.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 8: Commit the test.**

```bash
git add frontend/src/features/shell/__tests__/NotFound.test.tsx
git commit -m "test(fe): add NotFound render smoke test"
```

---

# Stage 5 — Finalize

Spec 29 §7 stage 7 / §10.

## Task 13: Append provisional TD-FE entries

**Files:**
- Modify: `frontend/../docs/TECH_DEBT.md` (repo-root `docs/TECH_DEBT.md`)

> **Do NOT run prettier on `docs/TECH_DEBT.md`.** Append surgically; do not reformat existing entries. Numbers are **provisional** (master high-water is TD-FE-46; phases 8/10 may also be allocating) — the integrator reconciles the actual integers at merge.

- [ ] **Step 1: Append three entries** at the end of the TD-FE section (adjust numbers if 47–49 are taken by a sibling phase at merge):

```markdown
## TD-FE-47 — Phase 12 features still import legacy `@/hooks/usePageTitle`

State: `features/calendar`, `features/reports`, `features/artifacts` import `usePageTitle` from the legacy `@/hooks/usePageTitle`. Should be `@/shared/hooks`. Deferred: Spec 14 §4 staging rule — Phase 11 promotes shared hooks; features must not pre-extract. Trigger: Phase 11.

## TD-FE-48 — Artefacts cross-component coupling via untyped `window` CustomEvents

State: `features/artifacts/pages/ArtifactsPage.tsx` listens on `window` for `CustomEvent("artifactsSearch")` and `CustomEvent("addArtefact")` (dispatched by the header). Untyped, global, hard to test. Should be a typed feature/shared mechanism. Deferred: out of scope for a parity relocation. Trigger: Artefacts gets real data, or a shared search/event bus lands.

## TD-FE-49 — Small-page surfaces are mock/placeholder (no backend)

State: `features/{calendar,insights,reports,artifacts}` render hardcoded mock data with no API. Should be wired to real endpoints. Deferred: these products are not built yet. Trigger: each product's backend exists.
```

- [ ] **Step 2: Commit.**

```bash
git add docs/TECH_DEBT.md
git commit -m "docs: log Phase 12 deferred TD-FE entries"
```

## Task 14: Final merge gate — serial preflight

**Files:** none (verification + handoff).

- [ ] **Step 1: Confirm `src/pages/` holds no Phase-12 pages.**

```bash
ls frontend/src/pages
```
Expected: `Calendar/Insights/Reports/Artifacts/NotFound.tsx` are gone. Remaining entries (`Signals.tsx`, `Deals.tsx`, `ScoutDeployment.tsx`, `Login.tsx`, `Settings.tsx`, `TenantSelection.tsx`, `useLogin.ts`, `useTenants.ts`, `__tests__/`) belong to Phases 8/9/10 and are intentionally untouched.

- [ ] **Step 2: Add a route-registry integration test** (closes the smoke-test gap from review F3: per-page render tests mount components directly and don't prove the route is wired into `featureRoutes` — a missing `...xRoutes` spread is invisible to `typecheck` and to those tests). Create `frontend/src/app/__tests__/phase12-routes.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { featureRoutes } from "@/app/routes";

describe("Phase 12 routes are registered in featureRoutes", () => {
  it.each(["/calendar", "/insights", "/reports", "/artifacts"])("registers %s", (path) => {
    const found = featureRoutes.some(
      (el) => (el as { props?: { path?: string } }).props?.path === path,
    );
    expect(found).toBe(true);
  });
});
```
Run: `npm run test -- src/app/__tests__/phase12-routes.test.ts` → Expected: PASS (4 cases). If importing `featureRoutes` pulls heavy sibling feature modules and the test is slow/brittle, fall back to importing each feature's own `xRoutes` barrel and asserting its `path` (loses missing-spread coverage — note it). Commit:

```bash
git add frontend/src/app/__tests__/phase12-routes.test.ts
git commit -m "test(fe): assert Phase 12 routes are registered in featureRoutes"
```

- [ ] **Step 3: Kill any orphan preview server, then run the serial preflight on an idle box.** From `frontend/`:

```
pkill -f "vite preview" || true
npm run preflight
```
Expected: PASS (`typecheck`, `lint`, `format:check`, full Vitest, `build`, `bundle:check` (advisory), `test:e2e`, `knip`). If `knip` flags transitional findings, confirm they are the relocated paths and expected — not new dead code. If Vitest flakes under contention, rerun `npm run test -- --no-file-parallelism`. **Use serial `preflight`, never `preflight:par`, while phases 8/10 share the machine.**

- [ ] **Step 4: Hand off for the human-approved merge.** Report preflight result. At merge (synthesize-impl-review, Spec 14 §5.5), the integrator appends a Spec 14 Phase-12 post-merge amendment recording the **`Deals.tsx` scope correction** (Spec 29 §1.2) — Spec 14 is **not** edited mid-phase (it is a shared file the parallel phases also amend at their own merges).

---

## Done when (Spec 29 §11)

- `Calendar`/`Insights`/`Reports`/`Artifacts` live under route-named `src/features/*` (page + `routes.tsx` + `index.ts` + `README.md` + render test); `NotFound` lives in `features/shell` and is exported from its barrel.
- `src/pages/` holds no Phase-12 pages.
- `ArtifactsPage.tsx` is the thin orchestrator; `types`/`data`/`lib`/`components` are split out per Spec 29 §4; `folders` and `filteredArtefacts` stay derived in the page.
- Routes `/calendar`, `/insights`, `/reports`, `/artifacts`, and the `*` catch-all resolve and render unchanged, each wrapped in `FeatureErrorBoundary`.
- 5 render tests + the `artefactPdf` unit test + the `featureRoutes` registry test pass; `verify` + scoped `prettier --check` green per task; the full Vitest suite runs at the Stage 1 and Stage 3 gates; serial `preflight` green at the final gate.
- Provisional TD-FE-47…49 appended to `docs/TECH_DEBT.md` (surgically).

## Self-review against the spec (verification)

- **§2.1 in scope** → Tasks 1–4 (relocations), 5–11 (Artifacts decomposition), 12 (NotFound), 13 (TD). ✓
- **§3 structure / §3.1 deps** → each feature's `routes.tsx`/`index.ts`/`README.md` + the import-only-from-`shell`/`shared`/legacy-`usePageTitle` posture. ✓
- **§4 decomposition (incl. review F1/F5)** → Task 6 keeps `folders` derived in the page; Tasks 10/11 flag `ArtefactStats`/`FolderGrid` as new inline-JSX lifts with prop-drilling; LOC validated in Task 11, not asserted. ✓
- **§5 routing / NotFound catch-all stays in App.tsx** → Tasks 1/2/3/4 (append registry, drop App routes), 12 (NotFound import re-point, catch-all left in place). ✓
- **§6 parallel-safety** → surgical per-path commits; shared-file edits (`app/routes.tsx`, `App.tsx`, `shell/index.ts`, `TECH_DEBT.md`) isolated to their tasks; serial execution for the route-registry edits. ✓
- **§8 testing/gate (incl. review F1/F3)** → render smoke tests + `artefactPdf` unit test + `featureRoutes` registry test (catches missing-spread wiring); per-task incremental `verify` + scoped prettier; **full Vitest at the Stage 1 & 3 gates** (cross-cutting guard); serial `preflight` at merge. ✓
- **§2.3 frozen** → titles/copy untouched; only component identifiers renamed; `window` event names preserved. ✓
- **Type consistency** → `ArtefactItem` (Task 5) is the single type imported by `data` (T6), `lib/artefactPdf` (T7), `lib/artefactPresentation` (T8), `components/*` (T9–11). `createSimplePDF` signature consistent between T7 lib and test. Route-array names (`calendarRoutes`/`insightsRoutes`/`reportsRoutes`/`artifactsRoutes`) consistent between each `routes.tsx`, `index.ts`, and `app/routes.tsx`. ✓

## Execution handoff

Plan complete and saved to `plans/29-frontend-phase-12-small-pages-sweep.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration (via superpowers:subagent-driven-development). Tasks 1–3 are independent but share `app/routes.tsx`/`App.tsx`, so run them serially; Stage 3 (T5–T11) is strictly serial.
2. **Inline Execution** — execute tasks in this session with checkpoints (via superpowers:executing-plans).

The repo pipeline also runs `/review-plan` → `/synthesize-plan-review` before implementation.
