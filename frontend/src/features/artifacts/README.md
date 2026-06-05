# `artifacts` feature

The Artefacts library surface (route `/artifacts`). Presentational / local-state only — no data layer; mock seed data. **The "Key files" list is finalized in Task 11**, after the page is decomposed.

## Public surface
- `artifactsRoutes` — registry entry (`/artifacts`, `ProtectedRoute requireTenant` + `FeatureErrorBoundary`), composed by `src/app/routes.tsx`.

## Key files
- `pages/ArtifactsPage.tsx` — the page (relocated from `src/pages/Artifacts.tsx`; decomposed in Stage 3).

## Dependency notes
- Imports `Layout` from `@/features/shell`, `FeatureErrorBoundary` from `@/shared/components`, legacy `@/hooks/usePageTitle` (Phase 11 — TD-FE-47).
- Listens on `window` for `CustomEvent("artifactsSearch")` / `CustomEvent("addArtefact")` (header search + add-artefact). Untyped global-event coupling — TD-FE-48.
