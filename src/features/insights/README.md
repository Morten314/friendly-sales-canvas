# `insights` feature

## Purpose

Analytics / business-intelligence insights dashboard.

## Public surface

Re-exported from `index.ts`:

- `insightsRoutes` — feature routes (`/insights`, protected, requires tenant).

## Key files

- `pages/InsightsPage.tsx` — insights dashboard
- `routes.tsx`, `index.ts`

## Dependency notes

- Presentational/mock surface (no backend yet — see TECH_DEBT TD-FE-59).
- May import another feature only via its `index.ts`.
