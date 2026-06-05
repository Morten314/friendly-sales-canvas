---
artifact: plans/29-frontend-phase-12-small-pages-sweep.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-05
round: 1
---

## Findings

### [Medium] Per-step `verify` is incremental; cross-cutting regressions surface only at the preflight gate

**Location:** "Conventions & execution rules" line 19 (`npm run verify` = `typecheck && lint && test:changed`); Task 14 Step 2 (`npm run preflight`)

Each task's gate runs `npm run verify`, which is `typecheck && lint && test:changed` — an **incremental** test that only covers tests whose dependency graph includes changed files. A relocation that breaks an unrelated test file (for example, a snapshot or integration test that imports from `src/pages/Calendar.tsx` by path) would not be caught until Task 14's full `preflight`. That means a regression introduced in Task 1 could silently propagate through 13 tasks before surfacing. The plan and spec both acknowledge this tradeoff (spec §8: "a green per-stage `verify` therefore does **not** prove all pre-existing tests still pass"), but the gap is structural: the plan is 14 tasks long and the only full-suite run is the final gate.

**Mitigating factors:** these are mechanical relocations removing files from `src/pages/`; nothing else should be importing from those paths (spec §1.3 confirms the pages are leaf surfaces with no dependents). The `typecheck` step would catch broken imports within the relocated file itself. The risk is low in practice but the plan doesn't make the executor aware that early regressions may be invisible until the end.

### [Low] No explicit global kill criteria for the overall plan

**Location:** "Conventions & execution rules" §"Abort / escalation" (line 24)

The plan specifies per-task escalation (three failures on one task → stop and escalate to human). It does not state a global abort condition — e.g., "if `preflight` fails, the branch is abandoned" or "if more than 3 tasks escalate, the phase is blocked." This is acceptable given the low-risk, mechanical nature of the work and the `git reset --hard` recovery primitive (line 15), but a human controller receiving an escalation at Task 9 (mid-decomposition) has no guidance on whether to continue, restart Stage 3 from the Task 4 checkpoint, or abandon the branch entirely.

### [Low] Render smoke tests verify component mounting, not route integration

**Location:** Tasks 1–4 Step 10 (render smoke tests); Task 12 Step 6 (NotFound test)

Each render test mocks `Layout` and renders the page component directly (e.g., `render(<CalendarPage />)`). This confirms the component mounts and renders its content, but does not verify the route resolves through `app/routes.tsx` → `featureRoutes` → `ProtectedRoute` + `FeatureErrorBoundary`. A typo in the route registry (wrong import name, missing spread) would pass the smoke test but break the actual route. The `typecheck` step catches compile-time wiring errors, and the full `preflight` includes e2e tests, but the per-task verification has a gap between "component renders" and "route works end-to-end."

### [Low] Artifacts README (Task 4) documents files that don't exist until Stage 3

**Location:** Task 4 Step 5, README.md content (lines 599–616)

The `features/artifacts/README.md` created in Task 4 (Stage 2) lists `types.ts`, `data/mockArtefacts.ts`, `lib/artefactPdf.ts`, `lib/artefactPresentation.tsx`, and `components/{LibraryCard,ArtefactStats,FolderGrid}.tsx` under "Key files." None of these files exist yet — they're created in Tasks 5–11 (Stage 3). The README describes the target state, not the state at creation time. Since READMEs are developer-facing documentation and not consumed by tooling, this is cosmetic. But a developer reading the README between Stage 2 and Stage 3 would find it describes a structure that doesn't match the filesystem. An alternative would be to write a minimal README in Stage 2 and update it after Task 11 completes, or to add a note that the listed files are created in the decomposition stage.

### [Nit] Tasks 1–3 are near-identical 12-step templates (~400 lines of repetition)

**Location:** Tasks 1 (lines 67–224), 2 (lines 225–377), 3 (lines 379–533)

Each relocation task follows the same 12-step template: move, rename export, create routes.tsx, create index.ts, create README.md, wire routes.tsx, remove from App.tsx, verify, commit, write test, run test, commit test. The plan spells out each step in full code blocks for all three tasks, resulting in ~400 lines of near-identical instructions (only the page name, route path, title string, and alphabetical insertion point differ). For agentic execution this explicitness is defensible (eliminates ambiguity), but for a human reviewer it means scanning repetitive content to find the one substantive section (Artifacts decomposition, Stage 3). A parametric task template with per-task parameters would halve the plan length without losing precision.

### [Nit] LibraryCard props interface (Task 9) is speculative pending source inspection

**Location:** Task 9 Step 1 (lines 910–927); parenthetical at line 928

The `LibraryCardProps` interface lists 11 props (artefact, expandedArtefact, editingArtefact, editName, onArtefactClick, onEditClick, onDeleteClick, onSaveEdit, onCancelEdit, onDownloadClick, onEditNameChange). The plan itself notes at line 928: "(Confirm the exact captured set during extraction — the props above mirror the page's `useState`/handlers from Spec 29 §4; adjust to the actual closure.)" This is honest but means the task may require non-trivial adjustment if the actual closure set differs. No action needed — the caveat is sufficient — but an executor should be aware the interface is approximate, not authoritative.
