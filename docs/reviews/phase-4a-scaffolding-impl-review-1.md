---
artifact: phase-4a-scaffolding (commits ed9851b..e2667cf on master)
artifact_type: impl
verdict: clean
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
base_ref: ed9851b
spec_loaded: true
plan_loaded: true
---

## Context

The branch `phase-4a-scaffolding` was merged to `master` before this review was requested. The review covers commits `54bf8ac..e2667cf` (7 commits: 6 code + 1 spec-14 amendment), diffed against `ed9851b`.

The TD-FE-15 entry in `docs/TECH_DEBT.md` documents that the `import-x/no-internal-modules` spike passed the positive probe but failed the regression check (95 legitimate deep imports flagged). The fallback path was correctly taken — zone boundaries only, with a well-scoped TD-FE for Phase 5/6 to revisit.

The `import-x/order` groups were reordered from `["builtin", "external", "internal", "parent", "sibling", "index"]` to `["builtin", "external", "parent", "sibling", "index", "internal"]` — moving `internal` (`@/*` alias imports) last. This is a correct containment strategy (Plan 21a Task 5 Step 3) that avoids reordering any source imports, confirmed by lint passing clean with `--max-warnings 0`.

## Findings

### [Nit] `scaffold-feature.ts` naming map duplicated between script and README

**Location:** `frontend/scripts/scaffold-feature.ts:14-25` vs `frontend/src/features/README.md:98-111`

The `NAMING_MAP` array in the scaffolder script is an independent copy of the naming map in `features/README.md`. The plan acknowledges this with a comment ("keep in sync with src/features/README.md") and the README states "Add a feature's name here **before** scaffolding it," which makes the README authoritative and the script advisory (it warns, doesn't block). The dual-source is intentional for the MVP — the script's map exists to produce a helpful warning — but a future phase could read the README programmatically or extract the map to a shared JSON file. No action needed now.

### [Nit] `FeatureErrorBoundary` has no recovery mechanism

**Location:** `frontend/src/shared/components/FeatureErrorBoundary.tsx:42-59`

Once the boundary trips (`hasError: true`), there is no way to reset it without unmounting the entire boundary (e.g., via a key change from the parent). The spec's contract (§2.5) requires only "renders a feature-scoped fallback" and "logs error info via console.error" — no recovery requirement. The default fallback copy ("Try refreshing the page") accurately reflects this limitation. This is fine for Phase 5's use case (a crashed feature route warrants a full remount anyway), and adding a reset method would be gold-plating at this stage. Noted for awareness only.

### [Nit] Spec 14 §3.3 still references `eslint-plugin-import` (without `-x`) in prose

**Location:** `specs/14-frontend-refactoring-master-plan-design.md:182`

The enforcement-mechanism paragraph reads "Enforced by `import/no-cycle` from `eslint-plugin-import`" and "`eslint-plugin-import`'s `import/no-internal-modules` rule" — using the original plugin name rather than the installed `eslint-plugin-import-x`. The 4a amendments correctly resolved Q16 to `eslint-plugin-import-x` in §8, and the actual `eslint.config.js` uses `import-x` throughout, so this is a stale string in frozen prose, not a functional issue. The master plan's frozen-narrative convention means this paragraph is not amended post-hoc; Phase 5's spec or a future doc sweep can align it if desired.

### [Nit] `eslint.config.js` `import-x/no-cycle` is global, not features-scoped

**Location:** `frontend/eslint.config.js:92`

The plan (Task 5 Step 4) anticipated potentially scoping `import-x/no-cycle` to `src/features/**` + `src/shared/**` if pre-existing cycles were found. The implementation runs it globally, which implies zero pre-existing cycles were found during the pre-check (the lint passes clean). This is the ideal outcome. Noted only because a future addition of a cycle elsewhere in the tree (outside features/shared) would also be caught — arguably a feature, not a bug, since cycles are undesirable everywhere.
