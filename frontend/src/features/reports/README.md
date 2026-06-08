# `reports` feature

## Purpose

Reporting and data-export surface.

## Public surface

Re-exported from `index.ts`:

- `reportsRoutes` — feature routes (`/reports`, protected, requires tenant).

## Key files

- `pages/ReportsPage.tsx` — reports UI
- `routes.tsx`, `index.ts`

## Dependency notes

- Presentational/mock surface (no backend yet — see TECH_DEBT TD-FE-59).
- May import another feature only via its `index.ts`.
