# `tenant` feature

Tenant-selection UI. Consumes `shared/tenant` (`useTenant`, `selectTenant`) and `shared/auth`.
`useTenants` currently serves a mock list (no "list tenants" backend endpoint; real model is
one-org-per-user via `/org`) — see TD-FE-55. Public surface: `tenantRoutes` (`/tenant-selection`).
