# `shell` feature

## Purpose

The application frame that authenticated features render inside: the sidebar, header, page layout, and profile dialog, plus the route guard. The shell renders only on authenticated screens — Login and TenantSelection do not use `Layout`.

## Public surface

Re-exported from `index.ts`; consume only these, only via `@/features/shell`:

- `Layout` — the page frame (header + sidebar + content slot). Composed per-page by feature pages.
- `ProtectedRoute` — route guard; redirects unauthenticated users to `/login` and auto-selects a tenant when `requireTenant` is set but none is chosen.
- `SidebarProvider` — provides the app sidebar (mobile-open) state. Nested in `App.tsx`.
- `useAppSidebar` — the app sidebar hook (renamed from the internal `useSidebar` to avoid the shadcn `ui/sidebar` name-twin — see TECH_DEBT TD-FE).
- `DeploymentData` (type) — surfaced for `MarketResearch` (retained for that surface).
- `NotFound` — the 404 page, mounted as the catch-all route in `App.tsx`.
- `PWAInstallPrompt` — the PWA install banner, rendered app-wide in `App.tsx`.

Internals (`components/Header`, `components/Sidebar`, `components/ProfileDialog`, `SidebarContext`) are **not** re-exported. The `<Routes>` table is **not** here — it stays in `App.tsx` (it must know every feature's page; putting it in the shell would invert the dependency rule).

## Key files

- `index.ts` — public re-exports (the cross-feature surface above)
- `components/Layout.tsx`, `components/Header.tsx`, `components/Sidebar.tsx`, `components/ProfileDialog.tsx` — the frame
- `components/PWAInstallPrompt.tsx` — PWA install banner (relocated from legacy root; barrel-exported via `index.ts`)
- `ProtectedRoute.tsx` — route guard
- `SidebarContext.tsx` — sidebar (mobile-open) state
- `types.ts` — feature-local types

## Dependency notes

- Consumes `@/shared/auth` (`useAuth`), `@/shared/tenant` (`useTenant`, `Tenant`), `@/components/ui/*`, and npm packages.
- Does **not** import from other features. App-wide state lives in `@/shared`, not here (ADR-0002).
