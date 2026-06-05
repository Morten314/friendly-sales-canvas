# `calendar` feature

The Activator surface (route `/calendar`). Presentational / local-state only — no data layer.

## Public surface

- `calendarRoutes` — registry entry (`/calendar`, `ProtectedRoute requireTenant` + `FeatureErrorBoundary`), composed by `src/app/routes.tsx`.

## Key files

- `pages/CalendarPage.tsx` — the page (relocated from `src/pages/Calendar.tsx`).

## Dependency notes

- Imports `Layout` from `@/features/shell`, `FeatureErrorBoundary` from `@/shared/components`, and the legacy `@/hooks/usePageTitle` (promoted to `@/shared/hooks` in Phase 11 — TD-FE-57).
