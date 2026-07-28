# `settings` feature

## Purpose

User, company, and agent profile configuration UI — the app's primary write surface for the org's company profile.

## Public surface

Re-exported from `index.ts`:

- `settingsRoutes` — feature routes (`/settings`, protected, requires tenant).

## Key files

- `pages/SettingsPage.tsx` — settings container
- `components/UserProfile.tsx`, `components/CompanyProfile.tsx`, `components/AgentProfile.tsx`
- `routes.tsx`, `index.ts`

## Dependency notes

- Company-profile data hooks (`useCompanyProfile`/`useSaveCompanyProfile`) come from `@/shared/company-profile`; contract types from `@/shared/api`.
- Profile props (`UserProfile`/`AgentProfile`/`CompanyProfile`) use the `UntypedBackendProfile` escape hatch (`@/shared/types/escape-hatches`) — the backend profile contract is not yet tightened (TD-FE-10); the company-profile read also carries a known orphaned-fetch seam (TD-FE-11).
- May import another feature only via its `index.ts`.
