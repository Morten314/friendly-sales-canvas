# `insights` feature

The Insights dashboard surface (route `/insights`). Presentational / local-state only — no data layer.

## Public surface

- `insightsRoutes` — registry entry (`/insights`, `ProtectedRoute requireTenant` + `FeatureErrorBoundary`), composed by `src/app/routes.tsx`.

## Key files

- `pages/InsightsPage.tsx` — the page (relocated from `src/pages/Insights.tsx`). Note: its top heading is the literal text "Reports" (pre-existing copy, frozen).

## Dependency notes

- Imports `Layout` from `@/features/shell` and `FeatureErrorBoundary` from `@/shared/components`. No `usePageTitle`.
