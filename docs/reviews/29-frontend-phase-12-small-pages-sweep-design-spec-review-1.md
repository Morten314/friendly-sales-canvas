---
artifact: specs/29-frontend-phase-12-small-pages-sweep-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-05
round: 1
---

## Findings

### High — §4 decomposition table misidentifies `folders` as a seed array

**Location:** §4, row `data/mockArtefacts.ts` — "`mockArtefacts` seed array + `folders` seed (page content; no backend)"

The table says `data/mockArtefacts.ts` should contain both `mockArtefacts` and a `folders` seed. In the current code, `folders` is **computed at runtime** from the artefacts array:

```ts
const folders = [...new Set(artefacts.filter((a) => a.folder).map((a) => a.folder!))];
```

It is not a separate static seed. The implementer following this table would incorrectly create a `folders` export that duplicates derived data, or be confused about what to extract. The correct content for `data/mockArtefacts.ts` is just the `mockArtefacts` array; the folders computation belongs in `ArtifactsPage.tsx` (or a derived-data helper if one is extracted).

---

### High — §3.1 dependency posture overstates `usePageTitle` coverage

**Location:** §3.1 — "Each feature imports only: … the legacy `@/hooks/usePageTitle`"

The section presents `@/hooks/usePageTitle` as a uniform dependency across all four relocated features. Verified against source: `Calendar.tsx`, `Reports.tsx`, and `Artifacts.tsx` all import `usePageTitle`. **`Insights.tsx` does not** — it has no `usePageTitle` import and no page-title mechanism at all. The blanket statement in §3.1 should be qualified (e.g., "three of the four features import `@/hooks/usePageTitle`"). Notably, TD-FE-47 correctly scopes itself to "calendar/reports/artifacts" — only §3.1 is over-broad.

---

### Medium — §1.3 inventory omits non-page `src/pages/` residents

**Location:** §1.3 — the `src/pages/` table

The table lists only page-component files. The actual `src/pages/` directory also contains:
- `__tests__/useLogin.test.tsx` and `__tests__/useTenants.test.tsx`
- `useLogin.ts` (53 LOC) and `useTenants.ts` (19 LOC)

These are Phase 10 hooks and their tests — not Phase 12's concern — but they will remain in `src/pages/` after all phases merge. They directly affect Phase 11's "empty-`pages/`" verification goal. Surfacing them here (even as "not touched, Phase 10 owns") would prevent a surprise at the Phase 11 gate.

---

### Medium — §7/§8 gate descriptions elide `test:changed` vs full-suite distinction

**Location:** §7 ("each stage is independently green (`npm run verify` + `prettier --check`)") and §8 ("Gate: per-task `npm run verify`")

`npm run verify` actually runs `npm run typecheck && npm run lint && npm run test:changed` — it executes only changed-file tests, not the full Vitest suite. The full test suite (plus e2e, knip, bundle check) lives in `npm run preflight`, reserved for the merge gate. The spec should make this distinction explicit so the implementer understands that passing `verify` per-stage does not guarantee all pre-existing tests still pass. A clarifying sentence like "`verify` is incremental (`test:changed`); the full suite runs at `preflight`" would suffice.

---

### Medium — §4 `ArtefactStats` and `FolderGrid` are inline JSX extractions, not named components

**Location:** §4, decomposition table rows for `components/ArtefactStats.tsx` and `components/FolderGrid.tsx`

The table presents these alongside `LibraryCard`, which is a named inner component (~140 LOC, line 445). But `ArtefactStats` and `FolderGrid` don't exist as named components — they are inline JSX blocks embedded in the `return` statement. The implementer needs to know these are **new-component extractions** from embedded markup, not simple relocations. This also affects the ~200 LOC target for the resulting `ArtifactsPage.tsx`: the stats grid and folder section share closure over `artefacts`, `activeFolder`, `setActiveFolder`, and `searchQuery`, so props will need to be drilled into the extracted components. The LOC estimate should be validated after extraction rather than assumed.

---

### Low — §3 route template omits import statements

**Location:** §3, code example for `calendarRoutes`

The template shows `ProtectedRoute`, `FeatureErrorBoundary`, and `CalendarPage` in use but doesn't include the import lines. The mission-control precedent at `features/mission-control/routes.tsx` shows the correct pattern (`import { ProtectedRoute } from "@/features/shell"; import { FeatureErrorBoundary } from "@/shared/components";`). Including imports in the template would improve plan-readiness and reduce the chance of the implementer importing from the wrong barrel path.

---

### Low — §1.1 opening claim is slightly misleading on first read

**Location:** §1.1 — "This phase exists to leave `src/pages/` empty of leaf pages so Phase 11's empty-`pages/` verification can pass"

This reads as if `src/pages/` will be empty after Phase 12. §11 correctly qualifies ("only pages owned by Phases 8/9/10 remain, pending their merges"), but a reader who doesn't reach §11 may form the wrong expectation. Suggest softening to "leave `src/pages/` empty of Phase-12 leaf pages".

---

### Low — §7 stage 7 finalize should note `knip` behavior after relocation

**Location:** §7, stage 7 — "run full `npm run preflight` on an idle box"

`npm run preflight` includes `knip` (dead-code detection). After relocating four page files and removing their imports from `App.tsx`, `knip` may flag transitional findings (e.g., the old import paths becoming unused before the new feature-barrel imports are wired). Most will be expected, but a one-line note would prevent the implementer from treating knip output as a blocker.

---

### Nit — British/American spelling handled correctly

**Location:** §4 throughout — `Artefacts` (component) vs `Artifacts` (filename/feature folder)

The file is `Artifacts.tsx`, the component is named `Artefacts`, and the spec uses both spellings contextually. This is intentional (§2.3 freezes user-facing copy; the component name `Artefacts` is product copy). Correctly handled.

---

### Nit — §2.2 references Spec 14 by line number

**Location:** §2.2 — "per Spec 14 §4 line 541"

Precise line-number references are fragile under edits to Spec 14. Consider referencing by section heading instead for durability.
