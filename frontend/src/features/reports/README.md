# `reports` feature

The Presenter surface (route `/reports`). Presentational / local-state only — no data layer.

## Public surface

- `reportsRoutes` — registry entry (`/reports`, `ProtectedRoute requireTenant` + `FeatureErrorBoundary`), composed by `src/app/routes.tsx`.

## Key files

- `pages/ReportsPage.tsx` — the page (relocated from `src/pages/Reports.tsx`).

## Dependency notes

- Imports `Layout` from `@/features/shell`, `FeatureErrorBoundary` from `@/shared/components`, and `usePageTitle` from `@/shared/hooks/usePageTitle` (promoted — TD-FE-57).
