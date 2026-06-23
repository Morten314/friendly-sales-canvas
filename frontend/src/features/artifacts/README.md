# `artifacts` feature

The Artefacts library surface (route `/artifacts`). Presentational / local-state only — no data layer; mock seed data.

## Public surface

- `artifactsRoutes` — registry entry (`/artifacts`, `ProtectedRoute requireTenant` + `FeatureErrorBoundary`), composed by `src/app/routes.tsx`.

## Key files

- `pages/ArtifactsPage.tsx` — orchestrator (state, the two `window` CustomEvent listeners, handlers, derived `filteredArtefacts`/`folders`, layout).
- `types.ts` — `ArtefactItem`.
- `data/mockArtefacts.ts` — mock seed data (`folders` is derived in the page, not seeded).
- `lib/artefactPdf.ts` — `buildArtefactPdfDoc` / `buildArtefactPdfBlob` / `generateAndDownloadPDF` (jsPDF).
- `lib/artefactPresentation.tsx` — `getTypeIcon` / `getStatusIcon`.
- `components/LibraryCard.tsx`, `ArtefactStats.tsx`, `FolderGrid.tsx` — view pieces. `FolderGrid` also takes the `artefacts` array (beyond Spec 29 §4's prop list) to compute each folder's count, preserving the original behavior.

## Dependency notes

- Imports `Layout` from `@/features/shell`, `FeatureErrorBoundary` from `@/shared/components`, `usePageTitle` from `@/shared/hooks/usePageTitle` (promoted — TD-FE-57).
- Listens on `window` for `CustomEvent("artifactsSearch")` / `CustomEvent("addArtefact")` (header search + add-artefact). Untyped global-event coupling — TD-FE-58.
