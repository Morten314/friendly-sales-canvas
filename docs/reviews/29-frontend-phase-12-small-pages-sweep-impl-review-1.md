---
artifact: worktree-phase-12-small-pages-sweep
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-05
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Branch `worktree-phase-12-small-pages-sweep` lives in worktree `.claude/worktrees/phase-12-small-pages-sweep`. Spec 29 and plan 29 were both loaded from the branch's own `specs/` and `plans/` directories (they are part of the diff).

## Findings

### [Medium] `FolderGrid` receives `artefacts` prop not specified in plan — spec deviation

**Location:** `frontend/src/features/artifacts/components/FolderGrid.tsx:13` (prop `artefacts: ArtefactItem[]`), `frontend/src/features/artifacts/pages/ArtifactsPage.tsx:127` (passing `artefacts={artefacts}`)

Plan 29 Task 11 defines `FolderGridProps` as `{ folders, activeFolder, onFolderSelect }` — three props. The implementation adds a fourth prop `artefacts` so the component can compute per-folder counts internally. The spec §4 table also omits `artefacts` from the FolderGrid row. The README at `features/artifacts/README.md:16` does note the deviation ("`FolderGrid` also takes the `artefacts` array beyond Spec 29 §4's prop list"), which is good documentation practice, but this is still a spec deviation that was not run through a spec amendment or plan-review cycle.

The deviation itself is reasonable — the count computation (`artefacts.filter((a) => a.folder === folder).length`) was inline in the original monolith and lifting it into the component preserves behavior without adding complexity. However, per the spec-driven flow, material interface changes should be reflected in the spec or explicitly waived in a synthesis before implementation.

### [Medium] `ArtefactStats` computes four `.filter()` passes on every render

**Location:** `frontend/src/features/artifacts/components/ArtefactStats.tsx:31,43,57`

The component calls `.filter()` four times on the `artefacts` array to compute status counts (total, new, viewed, updated). For the current mock data (3 items) this is irrelevant, but this is a pattern that should use `useMemo` or compute counts once in the parent and pass them down when the artefacts array grows. The plan (Task 10) says to "move the expressions verbatim" so this is faithful to the plan, but it propagates a pre-existing O(n) × 4 pattern into a standalone component.

### [Low] `InsightsPage` has no `usePageTitle` call — title is never set

**Location:** `frontend/src/features/insights/pages/InsightsPage.tsx`

Unlike the other three relocated pages (`CalendarPage`, `ReportsPage`, `ArtifactsPage`), `InsightsPage` does not call `usePageTitle`. The spec §3.1 notes this: "not `insights`, which has no page-title mechanism". This is a pre-existing omission faithfully preserved during relocation (frozen behavior per §2.3). The render smoke test at `InsightsPage.test.tsx` correctly avoids asserting on `document.title`. Not a Phase 12 issue, but worth noting for when Insights gets its product polish pass.

### [Low] `ReportsPage` effect closure over `isChatOpen` creates stale toggle

**Location:** `frontend/src/features/reports/pages/ReportsPage.tsx:23-43`

The `useEffect` that registers `presenterChat` and `presenterCreateDemo` listeners has `[isChatOpen]` as its dependency array. The `handlePresenterChat` callback reads `isChatOpen` directly (not via a ref or setState callback), so toggling chat works but re-registers all listeners on every toggle. This is pre-existing behavior preserved verbatim — not introduced by Phase 12 — but the relocation is an opportunity to note it.

### [Low] `artefactPdf.ts` generates structurally invalid PDF output

**Location:** `frontend/src/features/artifacts/lib/artefactPdf.ts:16-122`

The `createSimplePDF` function generates a hardcoded PDF skeleton with fake `xref` offsets (`0000000009`, `0000000058`, etc.) and a fixed `/Length 2000` that doesn't match the actual stream content. The resulting file is not a valid PDF — PDF readers may open it through error-recovery heuristics but the byte offsets are fabricated. The `generateAndDownloadPDF` function creates a Blob and triggers a download of this data.

This is pre-existing behavior moved verbatim (the plan explicitly says "move verbatim"), and the unit test correctly validates the minimal contract (`startsWith("%PDF")` and `length > 100`). The functionality is arguably acceptable for a mock/placeholder feature, but it should be flagged for when real PDF generation is needed.

### [Low] Test for `phase12-routes.test.ts` relies on React element internal structure

**Location:** `frontend/src/app/__tests__/phase12-routes.test.ts:7-9`

The route-registry test casts `featureRoutes` elements to `{ props?: { path?: string } }`, reaching into React's internal element representation. This is brittle to React API changes but is an accepted pattern given the test's purpose (detecting missing route spreads). The plan (Task 14 Step 2) explicitly acknowledges this tradeoff and provides a fallback.

### [Nit] `types.ts` has a leading comment with the word "moved" but the convention comment says "cut verbatim"

**Location:** `frontend/src/features/artifacts/types.ts:1`

The comment reads "moved verbatim from the page" while the plan says "cut verbatim". Minor inconsistency — no functional impact.

### [Nit] `mockArtefacts.ts` has a `// Mock data for demonstration` comment

**Location:** `frontend/src/features/artifacts/data/mockArtefacts.ts:5`

Spec §4 describes this as "mock seed data" — the comment is fine as-is but "Mock data for demonstration" is slightly redundant given the file's location in `data/mockArtefacts.ts`. Pre-existing text moved verbatim.

### [Nit] `artefactPresentation.tsx` has a `default` case returning `FileText` that TypeScript already exhaustively checks

**Location:** `frontend/src/features/artifacts/lib/artefactPresentation.tsx:27-29`

The `getTypeIcon` switch has a `default` case returning `FileText`. Since `ArtefactItem["type"]` is a union of six string literals, TypeScript's exhaustive checking would catch a missing case. The `default` is harmless but suppresses the exhaustiveness benefit. Pre-existing code moved verbatim.

### [Nit] `ReportsPage` still contains `console.log` debug statements

**Location:** `frontend/src/features/reports/pages/ReportsPage.tsx:24,29,34,39`

Four `console.log` statements with `===` delimiters (`"=== PRESENTER CHAT TRIGGERED FROM HEADER ==="`, etc.) were moved verbatim. Pre-existing debug noise, not introduced by Phase 12. Spec §2.3 frozen-behavior rule covers this.
