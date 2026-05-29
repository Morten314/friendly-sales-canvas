# ADR-0002 — Cross-cutting client state and components live in `src/shared/`

**Status:** Accepted
**Date:** 2026-05-29

## Context

The frontend refactor (Spec 14) introduces a `src/features/` structure where each feature owns its pages, components, hooks, and services, and a `src/shared/` layer for genuinely cross-cutting code. Three pieces of app-wide React state and one cross-cutting component needed a home, and Spec 14 left their placement open (§8 Q11, Q13):

- `AuthContext` — Firebase auth session + org identity, imported by ~25 sites across nearly every feature area.
- `TenantContext` — the active-org/tenant selection, imported by ~12 sites; depends on `AuthContext`.
- `SidebarContext` — sidebar collapse/mobile-open state, used only by the app shell.
- `FeatureErrorBoundary` — a component that wraps every feature's top-level route.

Spec 14 had tentatively planned to move `TenantContext` alongside the `tenant/` feature in Phase 10. The deciding question is **kind**, not consumer count: is each piece a feature's presentation, or app-wide infrastructure?

## Decision

We will place app-wide cross-cutting state and components in `src/shared/`, not in any feature:

- `AuthContext` → `src/shared/auth/` (with `index.ts`).
- `TenantContext` → `src/shared/tenant/` (with `index.ts`) — promoted in **Phase 4b**, not Phase 10.
- `FeatureErrorBoundary` → `src/shared/components/`.

`SidebarContext` is the exception: it is **shell-local UI state**, not cross-cutting domain state, so it moves into `src/features/shell/` (the shell owns it).

Phase 10 builds the **auth/tenant UIs** (Login, TenantSelection) that _consume_ the shared primitives; it does not move the state.

## Consequences

- A feature cannot become a coupling hub by owning app-wide state that everything else imports — the dependency rule (`shared ↛ features`) keeps the arrow pointing one way.
- `TenantContext` moves once (Phase 4b) instead of twice; per Spec 14 §2 (MVP, velocity) one clean move beats a two-step migration. `TenantContext` imports `AuthContext`; both in `shared/` makes that a `shared → shared` import (allowed).
- Spec 14's original Phase-10 context-move narrative is superseded (see the dated annotations on Spec 14 §4 Phase 10/11).
- **Alternatives considered and rejected:**
  - _Place the contexts in `features/shell/` (or a `features/auth`, `features/tenant`)._ Rejected: makes that feature a hub every other feature reaches into, inverting the dependency rule; `shell` would then be imported by 25+ sites.
  - _Defer `TenantContext` to Phase 10 (per Spec 14 as written)._ Rejected: a two-step move (contexts → temp home → shared) costs more churn than promoting once now, with no offsetting benefit at MVP stage.
