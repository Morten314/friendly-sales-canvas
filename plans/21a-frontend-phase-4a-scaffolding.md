# Frontend Phase 4a — Scaffolding + Conventions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay down the `src/features/` structure, the conventions every later feature phase consumes, the `<FeatureErrorBoundary>`, the feature scaffolder, the ADR set, and the cross-feature dependency-lint rules (with a resolver) — **purely additively**, moving no source modules.

**Architecture:** New files plus surgical edits to `frontend/eslint.config.js`, `frontend/knip.json`, and `frontend/package.json` only. The lint rules are vacuous until `features/shell/` exists in Phase 4b, so a temporary positive-enforcement probe proves they are not silently no-op. `FeatureErrorBoundary` has no consumer until Phase 5, so it is knip-ignored with a tech-debt entry. ADRs live at the **monorepo-root** `docs/adr/`; all `src/*`, `eslint.config.js`, `knip.json`, `package.json`, `scripts/*` paths are under `frontend/`.

**Tech Stack:** React 18 + Vite + TypeScript (strict), ESLint flat-config with `eslint-plugin-import-x` (+ a new `eslint-import-resolver-typescript`), Vitest + Testing Library + MSW, knip (`--strict`, production mode), `tsx` for scripts.

**Source spec:** `specs/21-frontend-phase-4-scaffolding-shell-design.md` §2 (and §1, §4, §7, §8). This plan covers **4a only**; 4b ships separately as `plans/21b-frontend-phase-4b-shell-extraction.md` and must not begin until 4a is merged to `master`.

**Conventions for every task below:**
- Run all `npm` commands from `frontend/` (there is no root-level `package.json`).
- Commit messages use `type(scope):` form; **no `Co-Authored-By` footer**; no `[N/M]` suffixes.
- After each task's commit, the working tree must leave `tsc --noEmit`, `eslint . --max-warnings 0`, and `npx knip --strict --no-progress` green (the affected subset, at minimum).

**Abort criteria (whole-plan — escalate to a human, do not retry or work around):** the per-task STOP conditions handle "fix this step and continue"; these three mean the *plan* cannot proceed as written and need a human decision:
1. Task 0's baseline `npm run preflight` is RED **before any 4a change** (the tree is broken upstream of 4a).
2. Task 5's resolver addition disturbs `import-x/order` in a way that **cannot be contained to the `import-x/order` config** (it would force out-of-scope source reordering — 4a is additive-only).
3. Any **existing source module shows as moved/deleted** in Task 8's `git diff --stat` (that is 4b's work, not 4a's).
Everything else — a pre-existing cycle (Task 5 Step 4), the index-only spike failing (Task 6), a probe left behind — has an in-plan resolution and does **not** abort.

---

## Task 0: Branch + green baseline

**Files:** none (verification only).

- [ ] **Step 1: Create the work branch off `master`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master
git pull --ff-only        # if a remote master exists; skip if it errors offline
git checkout -b phase-4a-scaffolding
```

- [ ] **Step 2: Confirm the starting tree matches the spec's "starting state" (§1.2)**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
test ! -d src/features && echo "OK: src/features absent"
ls src/shared            # expect: api  (only)
ls src/contexts          # expect: AuthContext.tsx  SidebarContext.tsx  TenantContext.tsx
ls src/components/layout # expect: Header.tsx  Layout.tsx  ProfileDialog.tsx  Sidebar.tsx
test ! -d ../docs/adr && echo "OK: docs/adr absent (monorepo root)"
```
Expected: `src/features` absent, `docs/adr` absent, the listed files present. If any differ, STOP and reconcile against the spec before continuing.

- [ ] **Step 3: Establish a green preflight baseline**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```
Expected: PASS end-to-end (`typecheck → lint → format:check → test → build → bundle:check → test:e2e → knip --strict`). This is heavy (it runs Playwright). If it is RED **before any change**, STOP — the baseline is broken and not 4a's problem to fix silently; report which step failed.

If `test:e2e` is slow or flaky, you may run the lighter subset for this baseline — `npm run typecheck && npm run lint && npm run test` — and rely on Task 8's full preflight as the real gate. 4a is additive (no source moves), so it cannot plausibly break `build`/`bundle:check`/`test:e2e`; if Task 8's full preflight then reds on a step this subset skipped, first re-check whether the failure pre-existed 4a before treating it as a 4a regression.

No commit (verification only).

---

## Task 1: Conventions READMEs (`features/`, `shared/`, `ui/` lock)

**Files:**
- Create: `frontend/src/features/README.md`
- Create: `frontend/src/shared/README.md`
- Create: `frontend/src/components/ui/README.md`

> These are the only contents of `src/features/` after 4a (no feature folders yet — those are scaffolded on demand). Implements spec §2.2, §2.3, §2.7.

- [ ] **Step 1: Write `src/features/README.md`**

````markdown
# `src/features/` — feature modules

Each user-facing capability lives in its own folder here. Phases 5–12 of the frontend refactor (master Spec 14) extract the legacy `src/pages` / `src/components` code into these folders one feature at a time. Phase 4b populates the first one (`shell/`).

## Per-feature template

A feature is scaffolded by `npm run scaffold:feature -- <kebab-name>` (see `frontend/scripts/README.md`). The scaffolder emits exactly:

```
src/features/<feature>/
├── types.ts      # feature-local types
├── index.ts      # public re-exports — the cross-feature surface
└── README.md     # purpose, public surface, key files, dependency notes
```

`pages/`, `components/`, `hooks/`, `services/` are created **on demand** by the owning phase when first needed. Do **not** pre-create empty directories and do **not** add `.gitkeep`. `types.ts`, `index.ts`, `README.md` are always present.

## Naming map (kebab-case — living and authoritative)

Add a feature's name here **before** scaffolding it. Backend uses snake_case; the frontend uses kebab-case per JS convention.

| Feature | Phase |
|---|---|
| `auth` | 10 (UI) — primitive lives in `shared/auth` from Phase 4b |
| `customers` | 7 |
| `market-research` | 5 |
| `mission-control` | 6 |
| `scout` | 8 |
| `settings` | 11 |
| `shell` | 4b |
| `signals` | 6 |
| `strategist` | 8 |
| `tenant` | 10 (UI) — primitive lives in `shared/tenant` from Phase 4b |

`profiler` is **reserved** — Phase 9 decides the scout/profiler split (Spec 14 §8 Q10). Phase 12's small-page names (e.g. `calendar`, `deals`, `insights`, `reports`, `artifacts`) are appended **by Phase 12** when it runs. The scaffolder only *warns* (does not block) on a name that is not yet on this map.

## Dependency rules (enforced by `eslint.config.js`, Spec 14 §3.3)

- `features/<X>` may import from `features/<X>` (self), `shared/`, `components/ui/`, and npm packages.
- `features/<X>` may import from `features/<Y>` **only via** `features/<Y>/index.ts` — never a deep path. Reaching into another feature's internals is a lint error.
- Circular feature dependencies are forbidden. If two features need each other, the shared surface moves to `src/shared/`.
- **Transitional exception (Phases 4b–12):** importing from not-yet-migrated legacy dirs (`src/contexts`, `src/hooks`, `src/lib`, `src/utils`, `src/pages`) is permitted and expected; the lint config does **not** forbid it. Cleanup is verified in Phases 11–12, at which point the rule may be tightened to forbid legacy-dir imports from `features/`.

## Public-surface convention

Cross-feature consumption goes through `index.ts`. A feature's internals (everything not re-exported from `index.ts`) are private.
````

- [ ] **Step 2: Write `src/shared/README.md`**

````markdown
# `src/shared/` — cross-cutting code shared across features

Code lands here when it is genuinely shared infrastructure, not one feature's property.

## Promotion criteria

- **The ≥2-feature rule.** A hook, utility, or type graduates to `shared/` only once **two or more features demonstrably import it**. A single-consumer utility stays in its feature.
- **No speculative promotion.** A feature needing a not-yet-shared utility keeps a local copy until a second consumer appears; the later phase that introduces the second consumer does the promotion (Spec 14 §7 R5).
- **API infrastructure is shared by definition** — `shared/api/` needs no ≥2 demonstration.
- **Cross-cutting client-state primitives** (`shared/auth/`, `shared/tenant/`) and **cross-cutting components** (`shared/components/`) follow the same "consumed app-wide infrastructure" logic. Their placement is recorded in `docs/adr/0002-cross-cutting-client-state-and-components-live-in-shared.md`.

## Subfolders

- `api/` — fetch client, zod contracts, query client/keys, the single rate limiter (Phase 3).
- `auth/`, `tenant/` — app-wide React context primitives (Phase 4b).
- `components/` — cross-cutting components, e.g. `FeatureErrorBoundary` (Phase 4a).
- `hooks/`, `lib/`, `types/` — populated in Phase 11 as the ≥2-feature rule is met.
- `ui-patterns/` — created only if Phase 13 surfaces repeated patterns.

## Dependency rule

`shared/` must **not** import from `features/` (enforced by `import-x/no-restricted-paths`). Shared code is consumed by features, never the reverse.
````

- [ ] **Step 3: Write `src/components/ui/README.md`**

````markdown
# `src/components/ui/` — shadcn / Radix primitives (locked)

These are generated shadcn-ui primitives built on Radix. They are owned by **no feature**.

- **Do not** import from `@/features/**` or `@/shared/**` here — `components/ui/` sits below the app's own code (enforced by `import-x/no-restricted-paths` in `eslint.config.js`). It may import only npm packages, other `ui/` primitives, and `@/lib/utils`.
- This folder is `knip`-ignored and exempt from `react-refresh/only-export-components` (it intentionally co-exports variants and hooks).

## Name-twin warning

`ui/sidebar.tsx` **exports** `SidebarProvider` (line 730) and `useSidebar` (line 734) — the **same names** the app's own sidebar state (`src/contexts/SidebarContext.tsx`, moving to `src/features/shell/` in Phase 4b) exports. The collision is currently *inactive* (no file imports those names from `ui/sidebar`), but it is real. The app's sidebar hook is exposed publicly as **`useAppSidebar`** from `@/features/shell` (Phase 4b) to avoid the clash. When wiring the app's collapsible sidebar, import the **app** `SidebarProvider`/`useAppSidebar` from `@/features/shell`, not the shadcn primitives from `@/components/ui/sidebar`.
````

- [ ] **Step 4: Verify the new files lint and format clean, then commit**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run format:check
npx knip --strict --no-progress
```
Expected: both PASS (markdown is not linted by ESLint; `format:check` covers it via Prettier; knip is unaffected by markdown). If `format:check` flags the new files, run `npm run format` and re-check.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/features/README.md frontend/src/shared/README.md frontend/src/components/ui/README.md
git commit -m "docs(fe): add features/, shared/ and ui-lock conventions READMEs"
```

---

## Task 2: ADR template + canonical placement ADR

**Files:**
- Create: `docs/adr/0001-adr-template.md` (creates `docs/adr/` at the monorepo root)
- Create: `docs/adr/0002-cross-cutting-client-state-and-components-live-in-shared.md`

> Implements spec §2.8. `docs/adr/` is at the **monorepo root** (alongside `docs/reviews/`, `docs/audits/`), not under `frontend/`.

- [ ] **Step 1: Write `docs/adr/0001-adr-template.md`**

````markdown
# ADR-NNNN — <short title in the imperative>

**Status:** Proposed | Accepted | Superseded by ADR-MMMM
**Date:** YYYY-MM-DD

## Context

What forces are at play — the technical, product, and team constraints that make a decision necessary. State the problem, not the solution.

## Decision

The change we are making, in active voice ("We will …"). One decision per ADR.

## Consequences

What becomes easier and what becomes harder as a result. Include follow-on work, risks accepted, and anything a future reader must not undo without a superseding ADR.

---

_This is the slim 3-part ADR form (Context / Decision / Consequences) adopted for Brewra (Spec 21 §2.8, Q7). MADR and Nygard's fuller templates were considered and rejected as too heavy for a pre-launch MVP. Number ADRs sequentially; never reuse a number. To reverse a decision, write a new ADR and set this one's status to "Superseded by ADR-MMMM"._
````

- [ ] **Step 2: Write `docs/adr/0002-cross-cutting-client-state-and-components-live-in-shared.md`**

````markdown
# ADR-0002 — Cross-cutting client state and components live in `src/shared/`

**Status:** Accepted
**Date:** 2026-05-29

## Context

The frontend refactor (Spec 14) introduces a `src/features/` structure where each feature owns its pages, components, hooks, and services, and a `src/shared/` layer for genuinely cross-cutting code. Three pieces of app-wide React state and one cross-cutting component needed a home, and Spec 14 left their placement open (§8 Q11, Q13):

- `AuthContext` — Firebase auth session + org identity, imported by ~25 sites across nearly every feature area.
- `TenantContext` — the active-org/tenant selection, imported by ~12 sites; depends on `AuthContext`.
- `SidebarContext` — sidebar collapse/mobile-open state, used only by the app shell.
- `FeatureErrorBoundary` — a component that wraps every feature's top-level route.

Spec 14 had tentatively planned to move `TenantContext` alongside the `tenant/` feature in Phase 10. The deciding question is **kind**, not consumer count: is each piece a feature's presentation, or app-wide infrastructure?

## Decision

We will place app-wide cross-cutting state and components in `src/shared/`, not in any feature:

- `AuthContext` → `src/shared/auth/` (with `index.ts`).
- `TenantContext` → `src/shared/tenant/` (with `index.ts`) — promoted in **Phase 4b**, not Phase 10.
- `FeatureErrorBoundary` → `src/shared/components/`.

`SidebarContext` is the exception: it is **shell-local UI state**, not cross-cutting domain state, so it moves into `src/features/shell/` (the shell owns it).

Phase 10 builds the **auth/tenant UIs** (Login, TenantSelection) that *consume* the shared primitives; it does not move the state.

## Consequences

- A feature cannot become a coupling hub by owning app-wide state that everything else imports — the dependency rule (`shared ↛ features`) keeps the arrow pointing one way.
- `TenantContext` moves once (Phase 4b) instead of twice; per Spec 14 §2 (MVP, velocity) one clean move beats a two-step migration. `TenantContext` imports `AuthContext`; both in `shared/` makes that a `shared → shared` import (allowed).
- Spec 14's original Phase-10 context-move narrative is superseded (see the dated annotations on Spec 14 §4 Phase 10/11).
- **Alternatives considered and rejected:**
  - *Place the contexts in `features/shell/` (or a `features/auth`, `features/tenant`).* Rejected: makes that feature a hub every other feature reaches into, inverting the dependency rule; `shell` would then be imported by 25+ sites.
  - *Defer `TenantContext` to Phase 10 (per Spec 14 as written).* Rejected: a two-step move (contexts → temp home → shared) costs more churn than promoting once now, with no offsetting benefit at MVP stage.
````

- [ ] **Step 3: Verify format and commit**

Run (these are monorepo-root docs, outside the frontend Prettier scope — check them directly rather than via the frontend `format:check`):
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx prettier --check ../docs/adr/*.md
```
Expected, either outcome is fine: (a) it checks the files — if it reports issues, fix with `npx prettier --write ../docs/adr/*.md` and re-run; or (b) it errors with "No configuration found" — the root-level docs are outside any Prettier config, so skip formatting them. Do **not** run the frontend-scoped `npm run format:check` for these root docs.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/adr/0001-adr-template.md docs/adr/0002-cross-cutting-client-state-and-components-live-in-shared.md
git commit -m "docs(adr): add slim ADR template and ADR-0002 (cross-cutting state in shared)"
```

---

## Task 3: `<FeatureErrorBoundary>` + tests + knip ignore + TD-FE-14

**Files:**
- Create: `frontend/src/shared/components/FeatureErrorBoundary.tsx`
- Create: `frontend/src/shared/components/index.ts`
- Test: `frontend/src/shared/components/__tests__/FeatureErrorBoundary.test.tsx`
- Modify: `frontend/knip.json`
- Modify: `docs/TECH_DEBT.md`

> Implements spec §2.5. TDD: write the test first, watch it fail, implement, watch it pass.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/components/__tests__/FeatureErrorBoundary.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FeatureErrorBoundary } from "@/shared/components/FeatureErrorBoundary";

// A child that throws during render, to trip the boundary.
function Boom(): never {
  throw new Error("boom");
}

afterEach(() => vi.restoreAllMocks());

describe("FeatureErrorBoundary", () => {
  it("renders children normally when they do not throw", () => {
    render(
      <FeatureErrorBoundary>
        <div>child-content</div>
      </FeatureErrorBoundary>,
    );
    expect(screen.getByText("child-content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the fallback when a child throws, without blanking the app", () => {
    // React logs the caught error to console.error; suppress the noise.
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <Boom />
      </FeatureErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("child-content")).not.toBeInTheDocument();
  });

  it("does not catch errors thrown outside its own subtree", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // `Boom` is a sibling, NOT a descendant of the boundary. With no ancestor
    // boundary, the render throws — proving the error escaped this boundary
    // rather than being swallowed by it.
    expect(() =>
      render(
        <>
          <FeatureErrorBoundary>
            <div>safe-sibling</div>
          </FeatureErrorBoundary>
          <Boom />
        </>,
      ),
    ).toThrow("boom");
  });

  it("logs via console.error and invokes the onError hook when a child throws", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();
    render(
      <FeatureErrorBoundary onError={onError}>
        <Boom />
      </FeatureErrorBoundary>,
    );
    expect(consoleSpy).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run src/shared/components/__tests__/FeatureErrorBoundary.test.tsx
```
Expected: FAIL — cannot resolve `@/shared/components/FeatureErrorBoundary` (module does not exist yet).

- [ ] **Step 3: Implement `FeatureErrorBoundary.tsx`**

Create `frontend/src/shared/components/FeatureErrorBoundary.tsx`:

```tsx
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface FeatureErrorBoundaryProps {
  children: ReactNode;
  /** Optional feature name, woven into the default fallback copy. */
  featureName?: string;
  /** Optional custom fallback UI; overrides the default when provided. */
  fallback?: ReactNode;
  /** Optional pluggable reporter, called in addition to console.error. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface FeatureErrorBoundaryState {
  hasError: boolean;
}

/**
 * Class error boundary that scopes a thrown render error to one feature.
 * A crash in the wrapped subtree renders a local fallback instead of
 * blanking the whole app. Used from Phase 5 to wrap each feature's
 * top-level routed component.
 */
export class FeatureErrorBoundary extends Component<
  FeatureErrorBoundaryProps,
  FeatureErrorBoundaryState
> {
  constructor(props: FeatureErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): FeatureErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("FeatureErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      const where = this.props.featureName ? ` loading ${this.props.featureName}` : "";
      return (
        <div
          role="alert"
          className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center"
        >
          <h2 className="text-lg font-semibold text-destructive">Something went wrong{where}.</h2>
          <p className="text-sm text-muted-foreground">
            This section failed to load. Try refreshing the page.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: Implement the public barrel `index.ts`**

Create `frontend/src/shared/components/index.ts`:

```ts
export { FeatureErrorBoundary } from "./FeatureErrorBoundary";
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run src/shared/components/__tests__/FeatureErrorBoundary.test.tsx
```
Expected: PASS (4 tests).

- [ ] **Step 6: Add the knip ignore (else `knip --strict` reds on the unconsumed export)**

`FeatureErrorBoundary` has no production consumer until Phase 5; the Vitest test is knip-excluded, so it does not count as usage. Edit `frontend/knip.json` — change the `ignore` array:

```json
  "ignore": ["src/components/ui/**", "src/shared/components/**"],
```

(The full file's other keys — `$schema`, `entry`, `project`, `ignoreDependencies` — are unchanged.)

- [ ] **Step 7: Verify `knip --strict` is green with the ignore**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx knip --strict --no-progress
```
Expected: PASS. (Without the Step 6 ignore this would report `FeatureErrorBoundary` as an unused export.)

- [ ] **Step 8: Log TD-FE-14 in `docs/TECH_DEBT.md`**

Append a new entry at the end of `docs/TECH_DEBT.md` (after TD-FE-13), preserving the `---` separator and the existing entry format:

```markdown

---

## TD-FE-14 — knip-ignore on `src/shared/components/**` until Phase 5 consumes `FeatureErrorBoundary`

**Date logged:** 2026-05-29
**Origin:** Plan 21a Phase 4a (plans/21a-frontend-phase-4a-scaffolding.md), Task 3.

**Current state:**
`src/shared/components/**` is in `knip.json`'s `ignore` array. `FeatureErrorBoundary` and its `index.ts`
re-export have **no production consumer** until Phase 5 wraps the first feature route in it. Under
`knip --strict` (production mode, `src/**/*.{ts,tsx}!` entries), an exported-but-unconsumed symbol fails the
gate. Vitest tests exercise the boundary, but test files are knip-excluded, so they do not satisfy knip's
"used" check. The ignore suppresses the false positive until a real consumer exists.

**What it should be:**
Remove `"src/shared/components/**"` from `knip.json`'s `ignore` once Phase 5 imports `FeatureErrorBoundary`
to wrap a feature's top-level routed component. The export then has a production consumer and knip passes
without the ignore.

**Pull-forward trigger:**
Phase 5 (first feature extraction) — its plan's done-when removes this ignore and confirms `knip --strict`
stays green.

**Owner:** TBD.
```

- [ ] **Step 9: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/shared/components/FeatureErrorBoundary.tsx \
        frontend/src/shared/components/index.ts \
        frontend/src/shared/components/__tests__/FeatureErrorBoundary.test.tsx \
        frontend/knip.json docs/TECH_DEBT.md
git commit -m "feat(fe): add FeatureErrorBoundary in shared/components (knip-ignored until Phase 5)"
```

---

## Task 4: Feature scaffolder + npm script + scripts README

**Files:**
- Create: `frontend/scripts/scaffold-feature.ts`
- Modify: `frontend/package.json` (add the `scaffold:feature` script)
- Modify: `frontend/scripts/README.md`

> Implements spec §2.4. Run via `tsx` (already a dep), mirroring `scripts/check-bundle-budget.ts` style (ESM, `node:` imports, `import.meta.dirname`, top-level `main().catch`).

- [ ] **Step 1: Write `frontend/scripts/scaffold-feature.ts`**

```ts
// frontend/scripts/scaffold-feature.ts
// Scaffolds a new feature folder under src/features/ with the canonical
// always-present files (types.ts, index.ts, README.md). Subfolders
// (pages/components/hooks/services) are created on demand — never here.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const FRONTEND_DIR = resolve(import.meta.dirname, "..");
const FEATURES_DIR = join(FRONTEND_DIR, "src", "features");

// Living naming map — keep in sync with src/features/README.md.
// `profiler` is reserved (Phase 9). Phase 12 appends its small-page names.
const NAMING_MAP = [
  "auth",
  "customers",
  "market-research",
  "mission-control",
  "scout",
  "settings",
  "shell",
  "signals",
  "strategist",
  "tenant",
];

const KEBAB_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function typesStub(name: string): string {
  return (
    `// Types for the \`${name}\` feature.\n` +
    `// Feature-local types live here; promote to src/shared/types/ only when a\n` +
    `// second feature imports them (the >=2-feature rule — see src/shared/README.md).\n`
  );
}

function indexStub(name: string): string {
  return (
    `// Public surface for the \`${name}\` feature.\n` +
    `// Re-export ONLY what other features may consume; internals stay unexported.\n` +
    `// Cross-feature consumers import from "@/features/${name}", never a deep path.\n` +
    `export {};\n`
  );
}

function readmeStub(name: string): string {
  return `# \`${name}\` feature

## Purpose

_TODO: one paragraph — what this feature does and the user-facing surface it owns._

## Public surface

_The cross-feature API, re-exported from \`index.ts\`. Other features import only these, only via \`@/features/${name}\`._

- _TODO_

## Key files

- \`index.ts\` — public re-exports (the cross-feature surface)
- \`types.ts\` — feature-local types
- _TODO: pages/, components/, hooks/, services/ as they are added_

## Dependency notes

- May import from: \`@/features/${name}/*\` (self), \`@/shared/*\`, \`@/components/ui/*\`, npm packages.
- May import another feature **only** via its \`index.ts\` (\`@/features/<other>\`), never a deep path.
- Transitional (Phases 4b–12): may import not-yet-migrated legacy dirs (\`@/contexts\`, \`@/hooks\`, \`@/lib\`, \`@/utils\`, \`@/pages\`).
`;
}

async function main(): Promise<void> {
  const name = process.argv[2];

  if (!name) {
    console.error("usage: npm run scaffold:feature -- <kebab-name>");
    process.exit(1);
  }

  if (!KEBAB_RE.test(name)) {
    console.error(`invalid feature name "${name}": must be kebab-case, e.g. market-research`);
    process.exit(1);
  }

  const featureDir = join(FEATURES_DIR, name);
  if (existsSync(featureDir)) {
    console.error(`feature "${name}" already exists at ${featureDir}; refusing to overwrite`);
    process.exit(1);
  }

  if (!NAMING_MAP.includes(name)) {
    console.warn(
      `warning: "${name}" is not on the naming map in src/features/README.md. ` +
        `Add it there before scaffolding a planned feature (continuing anyway).`,
    );
  }

  await mkdir(featureDir, { recursive: true });
  await writeFile(join(featureDir, "types.ts"), typesStub(name), "utf8");
  await writeFile(join(featureDir, "index.ts"), indexStub(name), "utf8");
  await writeFile(join(featureDir, "README.md"), readmeStub(name), "utf8");

  console.log(`scaffolded src/features/${name}/ (types.ts, index.ts, README.md)`);
  console.log("next: add pages/components/hooks/services/ on demand — no empty dirs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script to `frontend/package.json`**

In the `"scripts"` block, add the `scaffold:feature` entry (keep alphabetical-ish grouping; placing it after `"preview"` is fine):

```json
    "scaffold:feature": "tsx scripts/scaffold-feature.ts",
```

- [ ] **Step 3: Verify the scaffolder works (probe run → assert → clean up)**

The scaffolder is dev tooling; verify it by running it on a throwaway name, asserting the output, then deleting the probe. (Phase 4b is the real first consumer — it scaffolds `shell/`.)

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run scaffold:feature -- scaffold-probe
ls src/features/scaffold-probe          # expect: README.md  index.ts  types.ts
test ! -d src/features/scaffold-probe/components && echo "OK: no empty subdirs"
npx tsc --noEmit -p tsconfig.app.json   # the generated index.ts (export {}) must typecheck
```
Expected: three files created, no `components/` subdir, `tsc` green.

Now exercise the guard rails:
```bash
npm run scaffold:feature -- NotKebab        # expect: invalid-kebab error, exit 1
npm run scaffold:feature -- scaffold-probe  # expect: refusing-to-overwrite error, exit 1
npm run scaffold:feature -- not-on-map      # expect: a WARNING, but it still scaffolds
```
Expected: first two print an error and exit non-zero; the third prints the not-on-map warning and creates `src/features/not-on-map/`.

Clean up both probes, then confirm `src/features/` is back to only its README — so a crash mid-step cannot leave a probe behind for Task 8's `git diff` to catch much later:
```bash
rm -rf src/features/scaffold-probe src/features/not-on-map
ls src/features    # expect: README.md  (only)
```

- [ ] **Step 4: Document the scaffolder in `frontend/scripts/README.md`**

Add `scaffold-feature.ts` to the "Script inventory" list:

```markdown
- `scaffold-feature.ts` — Phase 4a feature scaffolder; creates `src/features/<kebab-name>/` with `types.ts`, `index.ts`, `README.md`
```

And add a usage section after the inventory:

````markdown
## Scaffolding a feature

```bash
cd frontend
npm run scaffold:feature -- <kebab-name>
```

Creates `src/features/<kebab-name>/` with the canonical always-present files (`types.ts`, `index.ts`, `README.md`) from the per-feature template. It does **not** create `pages/components/hooks/services/` — add those on demand (no empty dirs, no `.gitkeep`).

Guard rails: refuses to overwrite an existing feature folder; rejects non-kebab-case names; **warns but does not block** if the name is not on the living naming map in `src/features/README.md`. Add the feature's name to that map before scaffolding a planned feature.
````

- [ ] **Step 5: Verify lint/format/knip, then commit**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run lint
npm run format:check
npx knip --strict --no-progress
```
Expected: all PASS. (`scaffold-feature.ts` matches the `scripts/*.ts` knip entry, so it is a recognized entry; `tsx` is already in `ignoreDependencies`.)

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/scaffold-feature.ts frontend/package.json frontend/scripts/README.md
git commit -m "feat(fe): add feature scaffolder (scaffold:feature) + docs"
```

---

## Task 5: ESLint resolver + zone-boundary rules + react-refresh override + no-cycle pre-check

**Files:**
- Modify: `frontend/package.json` (add `eslint-import-resolver-typescript` dev-dep — via `npm install`)
- Modify: `frontend/eslint.config.js`

> Implements spec §2.6 items 1, 3, 4 and the resolver prerequisite. The cross-feature **index-only** rule (item 2) is a separate spike in Task 6. These rules are vacuous until `features/shell/` exists (4b); Task 6's probe proves they are not silently no-op.

- [ ] **Step 1: Install the resolver dev-dependency**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm install --save-dev eslint-import-resolver-typescript
```
This writes the resolved version into `package.json`/`package-lock.json`. (Expected major: v4, compatible with the installed `eslint-plugin-import-x ~4.15.0`.)

- [ ] **Step 2: Edit `frontend/eslint.config.js` — add the resolver, zone rules, no-cycle, and extend the react-refresh override**

Apply these four edits to the existing config (do not reorder existing keys; `eslintConfigPrettier` must remain last).

**(a)** In the main config object (the one with `files: ["**/*.{ts,tsx}"]`), add a `settings` key between `plugins` and `rules`:

```js
    settings: {
      "import-x/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.app.json",
        },
      },
    },
```

**(b)** In that same object's `rules`, after the existing `"import-x/order"` rule, add the zone-boundary and no-cycle rules:

```js
      // Phase 4a — cross-zone dependency boundaries (require the import-x/resolver above).
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/shared",
              from: "./src/features",
              message:
                "src/shared must not import from src/features — shared is consumed by features, not the reverse.",
            },
            {
              target: "./src/components/ui",
              from: "./src/features",
              message: "src/components/ui (shadcn primitives) must not import from src/features.",
            },
            {
              target: "./src/components/ui",
              from: "./src/shared",
              message: "src/components/ui (shadcn primitives) must not import from src/shared.",
            },
          ],
        },
      ],
      "import-x/no-cycle": "error",
```

**(c)** Extend the existing `react-refresh/only-export-components` override zone to cover `src/shared/**` and `src/features/**` (the 4b moved context files and feature barrels co-export a provider component + a hook the same way `src/contexts/**` does). Change the `files` array of the override block whose comment begins "Override zone: React contexts intentionally co-export their hooks…":

```js
  {
    files: [
      "src/contexts/**",
      "src/components/customers/LeadStream.tsx",
      "src/shared/**",
      "src/features/**",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
```

- [ ] **Step 3: Verify the resolver does not disturb `import-x/order` (spec §8.2 item 2)**

Run the full lint:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run lint
```
Expected: PASS with **zero** new `import-x/order` violations. The resolver feeds the path/cycle rules, not `import-x/order`'s grouping, so existing ordering should be unaffected.

**If `import-x/order` now reports violations** (the resolver reclassified `@/` imports): do **not** mass-reorder imports across the repo (that would break 4a's additive guarantee). Instead pin the grouping by adding `pathGroups` to the existing `import-x/order` rule so `@/**` keeps its current "internal" placement, then re-run `npm run lint` until green. Record the adjustment in this task's commit body. If the disturbance cannot be contained to the `import-x/order` config, STOP and report — reordering source files is out of 4a's additive scope and needs a decision.

- [ ] **Step 4: `no-cycle` pre-check — fix-if-trivial or scope/defer (spec §2.6 item 3)**

The `npm run lint` from Step 3 already ran `import-x/no-cycle` against the whole tree. Inspect its output for `import-x/no-cycle` errors:

- **Zero cycles:** done — proceed.
- **A few trivial cycles** (e.g. two files importing each other's types): break them (move the shared type, or use `import type`), re-run `npm run lint`, commit the fixes as part of this task.
- **Pre-existing structural cycles** that are not trivial to fix in 4a: scope the rule so 4a merges green — narrow it with an `ignore` option or move `import-x/no-cycle` into a `files`-scoped override targeting only `src/features/**` and `src/shared/**` (the zones 4a actually cares about) — and log a `TD-FE` (the next free number) recording the deferred cycles and where they live. Do **not** leave `npm run lint` red.

Document which branch you took in the commit body.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/package.json frontend/package-lock.json frontend/eslint.config.js
git commit -m "build(fe): add import-x resolver, zone-boundary + no-cycle lint rules, extend react-refresh override"
```

---

## Task 6: Cross-feature index-only enforcement (spike) + positive enforcement test

**Files:**
- Modify: `frontend/eslint.config.js` (add the index-only rule **if** the spike succeeds)
- (Temporary, deleted within this task) probe files under `frontend/src/features/`
- Modify (only on the fallback path): `docs/TECH_DEBT.md`

> Implements spec §2.6 item 2 + the §2.10 item 4 acceptance gate. The mechanism is a **spike**: the constraint "feature A imports feature B only via `B/index`" is fiddly to express generically. Try the primary candidate, prove it with a positive test **and** a no-regression check; if it can't be made clean, ship zone-boundaries only (Task 5) and log a TD-FE. Do **not** block 4a on an uncertain lint mechanism.

- [ ] **Step 1: Create the temporary enforcement probe**

These throwaway files simulate two features so the rule (vacuous with zero real features) can be exercised. Create:

`frontend/src/features/probe-a/index.ts`:
```ts
export const probeValue = 1;
```

`frontend/src/features/probe-a/internal.ts`:
```ts
export const deepValue = 2;
```

`frontend/src/features/probe-b/consumer.ts`:
```ts
// GOOD — cross-feature import via the public index (must NOT be flagged):
import { probeValue } from "@/features/probe-a";
// BAD — deep cross-feature import bypassing the index (MUST be flagged):
import { deepValue } from "@/features/probe-a/internal";

export const total = probeValue + deepValue;
```

- [ ] **Step 2: Add the primary candidate rule — `import-x/no-internal-modules` with an allow-list**

In `frontend/eslint.config.js`, add to the main object's `rules` (after `import-x/no-cycle`):

```js
      // Phase 4a — cross-feature index-only: deep imports are allowed everywhere
      // EXCEPT into another feature (`@/features/<x>/<deep>`). The allow-list
      // enumerates every legitimate deep-import shape; anything not matched —
      // notably deep feature paths — is flagged. (Spike: validated by the
      // probe in plan 21a Task 6; falls back to zone-boundaries-only if it
      // cannot be made clean.)
      "import-x/no-internal-modules": [
        "error",
        {
          allow: [
            "**/*.css",
            "@/components/**",
            "@/contexts/**",
            "@/hooks/**",
            "@/lib/**",
            "@/pages/**",
            "@/shared/**",
            "@/styles/**",
            "@/test/**",
            "@/utils/**",
            "@/features/*",
          ],
        },
      ],
```

(`@/features/*` allows importing a feature's index — one segment after `features/` — while a deeper `@/features/*/**` stays forbidden.)

- [ ] **Step 3: Run the positive test AND the no-regression check**

Run, on the probe only:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint src/features/probe-b/consumer.ts
```
Expected (PASS criterion): an `import-x/no-internal-modules` error on the `@/features/probe-a/internal` line, and **no** error on the `@/features/probe-a` (index) line.

Then the regression check — the new rule must not newly flag any existing import:
```bash
npx eslint . --max-warnings 0
```
Expected: PASS (green) — the same as before Task 6, modulo the two probe files. (If the probe files themselves cause unrelated errors, that's fine; focus on whether any **pre-existing** file is newly flagged by `no-internal-modules`.)

- [ ] **Step 4: Decide — keep the rule, or fall back**

- **Spike PASSED** (positive test flags the deep import, regression check stays green): keep the `no-internal-modules` rule. Delete the probe (Step 5) and commit (Step 6, primary path).
- **Spike FAILED** (the positive test doesn't flag cleanly, OR the regression check reds on a legitimate existing import that can't be added to the allow-list without also permitting deep feature imports): **remove** the `no-internal-modules` block added in Step 2 (revert `eslint.config.js` to its Task 5 state — zone boundaries only), delete the probe (Step 5), and log a TD-FE on the fallback path (Step 6, fallback path). The optional secondary mechanism (a per-feature-pair `import-x/no-restricted-paths` zone, or `dependency-cruiser` per Spec 14 §3.3) is **not** attempted in 4a — it is deferred with the TD-FE.

- [ ] **Step 5: Delete the probe (always — it must not be committed)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
rm -rf src/features/probe-a src/features/probe-b
```
Confirm `src/features/` again contains only `README.md`:
```bash
ls src/features    # expect: README.md
```

- [ ] **Step 6: Commit (primary OR fallback path)**

Run `npm run lint` first; expect green either way.

**Primary path (rule kept):**
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/eslint.config.js
git commit -m "build(fe): enforce cross-feature index-only imports via import-x/no-internal-modules"
```

**Fallback path (rule removed):** First append a TD-FE to `docs/TECH_DEBT.md` (use the next free number — `TD-FE-15` if Task 5 Step 4 logged none, otherwise the next after that):

```markdown

---

## TD-FE-15 — Cross-feature index-only lint enforcement deferred (zone boundaries only)

**Date logged:** 2026-05-29
**Origin:** Plan 21a Phase 4a (plans/21a-frontend-phase-4a-scaffolding.md), Task 6.

**Current state:**
`eslint.config.js` enforces the zone boundaries (`shared ↛ features`, `ui ↛ features|shared`) but **not** the
"import feature B only via B/index" rule. `import-x/no-internal-modules` could not be configured to flag deep
cross-feature imports without also flagging legitimate existing deep imports (or without passing the positive
enforcement probe cleanly). Per Spec 21 §2.6 item 2, 4a ships zone boundaries only rather than blocking on an
uncertain mechanism.

**What it should be:**
Express "cross-feature imports go only through `index.ts`" — re-attempt `import-x/no-internal-modules` once
more deep-import shapes are known (Phases 5–6 add real features), or adopt `dependency-cruiser` for this one
constraint (Spec 14 §3.3 fallback). Gate the choice on the same positive enforcement probe.

**Pull-forward trigger:**
Phase 5 or 6 (second real feature exists, so a genuine cross-feature import can be tested) — whichever first
adds a feature that imports another feature.

**Owner:** TBD.
```

Then:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/eslint.config.js docs/TECH_DEBT.md
git commit -m "build(fe): ship zone-boundary lint rules; defer cross-feature index-only (TD-FE-15)"
```

---

## Task 7: Spec 14 amendments (4a branch)

**Files:**
- Modify: `specs/14-frontend-refactoring-master-plan-design.md`

> Implements spec §4 "On the 4a branch". This is a **dedicated `docs(spec-14):` commit**, separate from code commits (Spec 14 §5.7). Edit only the **living** sections; do not rewrite frozen Phase-narrative prose.

- [ ] **Step 1: Read the target sections of Spec 14**

Open `specs/14-frontend-refactoring-master-plan-design.md` and locate: §3.1 (target layout), §3.3 (dependency rules), §4 (status table + Phase 4 block), §8 (open questions). Read them so the edits below land in the right places with matching style.

- [ ] **Step 2: Apply the 4a-branch amendments**

Make exactly these edits (per spec §4):

- **§3.1 target layout** — add `shared/auth/`, `shared/tenant/`, `shared/components/` to the target structure (note: target state; the physical move is 4b).
- **§3.3 dependency rules** — add the transitional clause: `features/<X>` may import from not-yet-migrated legacy dirs (`src/contexts`, `src/hooks`, `src/lib`, `src/utils`, `src/pages`) during Phases 4b–12; cleanup verified in Phases 11–12.
- **§4 status table** — replace the single `4` row with two rows: `4a — Scaffolding + conventions` and `4b — Shell extraction`, both status `pending`, mirroring the 0a/0b split.
- **§4 Phase 4 block** — record the sub-split; update the AuthContext line → `shared/auth/`; the FeatureErrorBoundary line → `shared/components/`; the lint-tool line → `eslint-plugin-import-x` **+ a resolver dependency (`eslint-import-resolver-typescript`)**; clarify that "route shell" = the `ProtectedRoute` guard + the `Layout`/`Header`/`Sidebar` frame, **not** the `<Routes>` table (which stays in `App.tsx`); note feature folders are created lazily by the scaffolder.
- **§8 open questions** — mark **RESOLVED**: Q5 (≥2-feature rule), Q6 (kebab-case naming map), Q7 (slim ADR), Q11 (`shared/auth/`), Q13 (`shared/components/`), Q16 (`eslint-plugin-import-x` + resolver). Leave Q10 open for Phase 9; note the naming map reserves `profiler`.

**Formatting exemplar (read Spec 14's surrounding rows first and match them).** The §4 status-table edit replaces the single `4` row with two rows in the table's existing column shape — mirroring the existing `0a`/`0b` split — e.g.:

```
| 4a | Scaffolding + conventions | pending | … |
| 4b | Shell extraction          | pending | … |
```

Use Spec 14's actual column headers/order and `0a`/`0b` row as the template. Apply the same "read the adjacent entries and blend in" discipline to the §3.1, §3.3, and §8 edits rather than inventing new formatting.

Do **not** rewrite the frozen Phase 10/11 narrative blocks — those receive dated annotations on the **4b** branch (plan 21b), not here.

- [ ] **Step 3: Verify and commit**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx prettier --check ../specs/14-frontend-refactoring-master-plan-design.md || true
```
(If Prettier's scope covers `../specs`, fix with `--write`; otherwise this doc is outside the frontend Prettier scope — no action.)

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add specs/14-frontend-refactoring-master-plan-design.md
git commit -m "docs(spec-14): amend for Phase 4 sub-split, shared-layer placement, lint tooling"
```

---

## Task 8: Final preflight + done-when verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full preflight on the branch**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```
Expected: PASS end-to-end. This is the §2.10 item 7 gate.

- [ ] **Step 2: Confirm "no source module moved" (§2.10 item 9)**

Run:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git diff --stat master...phase-4a-scaffolding
```
Expected: only **additions** (new files under `frontend/src/features/`, `frontend/src/shared/components/`, `frontend/scripts/scaffold-feature.ts`, `docs/adr/`) plus edits limited to `frontend/eslint.config.js`, `frontend/knip.json`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/scripts/README.md`, `docs/TECH_DEBT.md`, and `specs/14-…`. **No** file moved/deleted under `src/components/`, `src/contexts/`, or elsewhere. If any existing source module shows as moved or deleted, STOP — that belongs to 4b, not 4a.

- [ ] **Step 3: Walk the done-when checklist (spec §2.10)**

Confirm each, fixing any gap before declaring done:
1. `src/features/README.md` + `src/shared/README.md` exist (Task 1).
2. `scaffold-feature.ts` works; `npm run scaffold:feature -- <name>` documented (Task 4).
3. `FeatureErrorBoundary` exists with passing tests; `knip --strict` green via the ignore; TD-FE-14 logged (Task 3).
4. Resolver + zone rules added; `react-refresh` override covers `src/shared/**` + `src/features/**`; `eslint . --max-warnings 0` green; **the positive enforcement probe flagged a deliberate deep cross-feature import** (Task 6 primary path) — or zone-boundaries shipped with TD-FE-15 for index-only (Task 6 fallback); `no-cycle` pre-check resolved (Task 5 Step 4).
5. `src/components/ui/README.md` declares the lock (Task 1).
6. `docs/adr/0001` + `0002` written (Task 2).
7. `npm run preflight` green on `phase-4a-scaffolding` (Step 1).
8. Spec 14 4a-branch amendments merged in a dedicated `docs(spec-14):` commit (Task 7).
9. No existing source module moved (Step 2).

- [ ] **Step 4: Hand off for review + merge**

4a is complete on the branch. Per Spec 21 §5: run `/review-impl` → `/synthesize-impl-review` (loop until nit-or-below), then the controller runs `npm run preflight` once more and, on green, merges `phase-4a-scaffolding` → `master`. **4b must not begin until 4a is merged** (4b consumes 4a's conventions).

---

## Self-review notes (plan author)

- **Spec coverage:** §2.1 (Task 1+4), §2.2 (Task 1), §2.3 (Task 1), §2.4 (Task 4), §2.5 (Task 3), §2.6 items 1/3/4 (Task 5) + item 2 (Task 6), §2.7 (Task 1), §2.8 (Task 2), §2.9 files-touched (all covered), §2.10 done-when (Task 8), §4 4a-branch (Task 7).
- **Encoded risks / decisions for plan review:** (a) the index-only mechanism is a genuine spike — Task 6 gives a primary candidate + positive test + explicit fallback, per Spec 21 §2.6 / §8.2; (b) the resolver-vs-`import-x/order` interaction (Spec 21 §8.2 item 2) is verified in Task 5 Step 3 with a contained fix path; (c) ADRs and `TECH_DEBT.md` are at the **monorepo root**, while all build-config/source paths are under `frontend/` — confirmed against the tree.
- **TD-FE numbering:** 4a always logs `TD-FE-14` (knip ignore). It may log up to **two more**, both conditional and allocated in execution order: a no-cycle deferral (Task 5 Step 4, only if pre-existing structural cycles are found) and the index-only fallback (Task 6, only if the spike fails). So 4a emits one, two, or three TD-FE entries — `14`; `14`+`15`; or `14`+`15`+`16`. Each conditional task takes the next free number at execution time. 4b's sidebar-twin TD then takes whatever is next free after 4a's (`15`, `16`, or `17`) — don't hard-code it; read `docs/TECH_DEBT.md` (21b Task 5 does exactly this).
