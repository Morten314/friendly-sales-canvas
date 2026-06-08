# `calendar` feature

## Purpose

Task calendar and activator-chat interface for campaign scheduling.

## Public surface

Re-exported from `index.ts`:

- `calendarRoutes` — feature routes (`/calendar`, protected, requires tenant).

## Key files

- `pages/CalendarPage.tsx` — calendar UI
- `routes.tsx`, `index.ts`

## Dependency notes

- Presentational/mock surface (no backend yet — see TECH_DEBT TD-FE-59).
- May import another feature only via its `index.ts`.
