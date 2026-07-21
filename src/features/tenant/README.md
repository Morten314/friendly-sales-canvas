# `tenant` feature

## Purpose

Lets an authenticated user select their active tenant before entering the protected app.

## Public surface

Re-exported from `index.ts`:

- `tenantRoutes` — feature routes (`/tenant-selection`, protected, no tenant requirement).

## Key files

- `pages/TenantSelectionPage.tsx` — tenant picker
- `hooks/useTenants.ts` — tenant-list hook (currently a mock list — see TECH_DEBT TD-FE-55)
- `routes.tsx`, `index.ts`

## Dependency notes

- App-wide tenant context primitive lives in `@/shared/tenant`.
- May import another feature only via its `index.ts`.
