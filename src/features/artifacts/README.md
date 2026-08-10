# `artifacts` feature

The Artefacts library surface (route `/artifacts`). Presentational / local-state only — no data layer; mock seed data.

## Public surface

- `artifactsRoutes` — registry entry (`/artifacts`, `ProtectedRoute requireTenant` + `FeatureErrorBoundary`), composed by `src/app/routes.tsx`.

## Key files

- `pages/ArtifactsPage.tsx` — orchestrator (state, the two `window` CustomEvent listeners, handlers, derived `folders`/`visibleFiles`, breadcrumb + search). Browsing model: root shows folders + unfiled files; a folder shows its files; opening a file replaces the list with the full-width detail view. Searching flattens the tree.
- `types.ts` — `ArtefactItem`.
- `data/mockArtefacts.ts` — mock seed data (`folders` is derived in the page, not seeded).
- `lib/artefactPdf.ts` — `buildArtefactPdfDoc` / `buildArtefactPdfBlob` / `generateAndDownloadPDF` (jsPDF).
- `lib/artefactPresentation.tsx` — `getTypeIcon` / `getStatusIcon`.
- `components/FolderList.tsx`, `ArtefactRow.tsx`, `ArtefactDetail.tsx` — file-explorer view pieces: folder rows at the root, one compact row per stored file, and a full-width detail view hosting the editable sheet.

## Dependency notes

- Imports `Layout` from `@/features/shell`, `FeatureErrorBoundary` from `@/shared/components`, `usePageTitle` from `@/shared/hooks/usePageTitle` (promoted — TD-FE-57).
- Listens on `window` for `CustomEvent("artifactsSearch")` / `CustomEvent("addArtefact")` (header search + add-artefact). Untyped global-event coupling — TD-FE-58.
