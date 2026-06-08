# `src/features/` — feature modules

Each user-facing capability lives in its own folder here. The frontend refactor (master Spec 14) extracted the legacy `src/pages` / `src/components` code into these folders one feature at a time.

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

| Feature           | Phase                                        |
| ----------------- | -------------------------------------------- |
| `artifacts`       | 12                                           |
| `auth`            | 10 (UI) — primitive lives in `shared/auth`   |
| `calendar`        | 12                                           |
| `customers`       | 7                                            |
| `insights`        | 12                                           |
| `market-research` | 5                                            |
| `mission-control` | 6                                            |
| `reports`         | 12                                           |
| `scout`           | 9                                            |
| `settings`        | 10                                           |
| `shell`           | 4b                                           |
| `signals`         | 8                                            |
| `strategist`      | 8                                            |
| `tenant`          | 10 (UI) — primitive lives in `shared/tenant` |

There is intentionally **no `features/profiler/`** — Spec 14 §8 Q10 was resolved by distributing Profiler across `customers` + `mission-control` + `shared/profiler`. The ICP-merge algorithm lives in `@/shared/profiler`; the inline view-model mapper in `ICPManager.tsx` is a container data-transform upheld by Plan-25 T21. `features/scout/` is intentionally thin (Spec 30 §1.1): it holds only the Scout deployment surface; Scout chat and shared infrastructure live in `shared/`. Both decisions are recorded as TD-FE-60. The small-page names (`calendar`, `insights`, `reports`, `artifacts`) were appended later (rows above). The scaffolder only _warns_ (does not block) on a name that is not yet on this map.

> **`deals` is NOT a feature.** `src/pages/Deals.tsx` _was_ the Strategist page; it became `features/strategist/pages/StrategistPage.tsx`. The `/deals` URL is retained only as a redirect to `/your-ai-team/strategist/workspace`. Spec 14 §12's listing of `Deals.tsx` as a small-page is therefore stale — it's strategist territory (TD-FE-48).

## Dependency rules (enforced by `eslint.config.js`, Spec 14 §3.3)

- `features/<X>` may import from `features/<X>` (self), `shared/`, `components/ui/`, and npm packages.
- `features/<X>` may import from `features/<Y>` **only via** `features/<Y>/index.ts` — never a deep path. Reaching into another feature's internals is a lint error.
- Circular feature dependencies are forbidden. If two features need each other, the shared surface moves to `src/shared/`.
- **Transitional exception (Phases 4b–12):** importing from not-yet-migrated legacy dirs (`src/contexts`, `src/hooks`, `src/lib`, `src/utils`, `src/pages`) is permitted and expected; the lint config does **not** forbid it. Cleanup is verified in Phases 11–12, at which point the rule may be tightened to forbid legacy-dir imports from `features/`.

## Public-surface convention

Cross-feature consumption goes through `index.ts`. A feature's internals (everything not re-exported from `index.ts`) are private.

## Route registry

Each feature that owns routes exposes them from `<feature>/routes.tsx` as an array of keyed `<Route>` elements, re-exported from `index.ts` (`export { <feature>Routes } from "./routes";`). `src/app/routes.tsx` composes them append-only — a feature phase adds one `...<feature>Routes` line there and never edits App.tsx's `<Routes>` table. App.tsx renders `{featureRoutes}` inside `<Routes>`. Route wrapping (`ProtectedRoute`, `FeatureErrorBoundary`) lives in the feature's own `routes.tsx`.

## Intra-feature imports are relative

Within a feature, import your own modules with **relative paths** (`./`, `../`). Reserve the `@/features/<X>/…` alias for **cross-feature** imports — which must target the index only (`@/features/<X>`), enforced by `import-x/no-internal-modules` (see Dependency rules). This keeps "self imports" out of the cross-feature lint's scope.

## Architecture decisions

Architecture decisions affecting this layer are recorded as ADRs — see [docs/adr/](../../../docs/adr/README.md).
