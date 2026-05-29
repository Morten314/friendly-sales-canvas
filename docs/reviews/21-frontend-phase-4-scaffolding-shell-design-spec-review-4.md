---
artifact: specs/21-frontend-phase-4-scaffolding-shell-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 4
---

## Context

Round-4 review of the spec after three prior review rounds and two syntheses. The document under review is the post-synthesis-3 revision, which incorporated fixes for all Critical/High findings from rounds 1–3 (C1: `useSidebar` export fact corrected; H1: `react-refresh` override expansion placed in 4a; H2: `useAuth` naming hazard documented; H3: dead-code strip during move; M1–M4/L2/L3/N2 fixes applied). Reviewed against the same `frontend/src/` tree on `master`.

## Findings

### Medium

#### M1: §3.7 knip.json entry is misleading — describes a non-change as conditional

**Location:** §3.7 "Files touched (4b)" table, `knip.json` row

> Edit — remove the `src/shared/components/**` ignore **only if** Phase 5 (not 4b) consumes the boundary; otherwise unchanged in 4b

This reads as though 4b conditionally edits `knip.json`. In reality, 4b never removes the ignore — Phase 5 does. The entry is noise in a files-touched table whose purpose is to list what 4b actually changes. A reader scanning the table for 4b's diff footprint would incorrectly count `knip.json` as a touched file. The entry should either be removed from the 4b table (since 4b makes no change) or replaced with a one-liner stating "No change in 4b — ignore removal deferred to Phase 5."

#### M2: §3.2 "bidirectional folder coupling" rationale for keeping `useAuth` in `hooks/` is imprecise

**Location:** §3.2, paragraph 1

> It composes `AuthContext` + `TenantContext` + `jwtManager` (§1.2), so it belongs in neither `shared/auth/` nor `shared/tenant/` without creating a bidirectional folder coupling.

Placing `useAuth` in `shared/auth/` would create a `shared/auth → shared/tenant` dependency (since `useAuth` calls `useTenant`), but not a *bidirectional* one — `shared/tenant` does not import from `shared/auth`. The real concern is cross-shared-subfolder dependency (auth depending on tenant), not bidirectional coupling. The conclusion (leave in `hooks/`) is sound — a composed utility spanning two shared domains doesn't naturally belong in either — but the rationale should accurately name the concern. A future reader weighing whether to promote `useAuth` into `shared/` might overestimate the coupling risk if they read "bidirectional."

### Low

#### L1: §2.5 FeatureErrorBoundary "logs error info" doesn't specify the logging mechanism

**Location:** §2.5, first bullet

> on a thrown render error it renders a feature-scoped fallback (one feature's crash does not blank the app) and logs error info.

The contract doesn't say what "logs error info" means — `console.error`, an error reporting service, or a callback prop. For a pre-launch MVP, `console.error` is the obvious default, but the spec should be explicit or defer the choice to the plan so the implementation doesn't guess. The error boundary's `componentDidCatch` signature gives it `error` + `errorInfo`; the spec should at minimum state whether the logging is fire-and-forget (`console.error`) or pluggable (a prop/callback). This matters because Phase 5+ features will wrap their routes in this boundary, and the logging contract affects how feature authors reason about error visibility.

#### L2: §3.5 "Visual regression (2%)" threshold appears without context

**Location:** §3.5, first bullet

> Visual regression (2%, Phase 2c) guards the shell's rendering — pixel-identical.

The "2%" is a pixel-diff threshold but this isn't stated. A reader unfamiliar with the Phase 2c VR setup would have to look up the tool configuration to understand what the number means. A parenthetical like "(2% pixel-diff threshold, per Phase 2c VR config)" would be clearer. Minor, but this is the only quantitative acceptance criterion in §3.5 and its units are implicit.

#### L3: §3.2 barrel contents mention "auth types" and "tenant types" without enumeration

**Location:** §3.2, penultimate bullet

> `shared/auth/index.ts` exposes `AuthProvider`, `useAuth` (the AuthContext hook), auth types. `shared/tenant/index.ts` exposes `TenantProvider`, `useTenant`, tenant types.

The named exports (`AuthProvider`, `useAuth`, `TenantProvider`, `useTenant`) are concrete. "Auth types" and "tenant types" are not enumerated. Since the context files are moved as-is (minus the dead-code strip), the barrel re-exports whatever types the existing files export. This is probably fine, but the plan author has to inspect the source files to know what "auth types" means. If the intent is "re-export everything the context file already exports," a statement like "plus any types already exported from the context file" would be more precise than the bare "auth types."

#### L4: §2.4 scaffolder README template content is unspecified

**Location:** §2.4, second bullet

> `README.md` filled from a template with the feature name.

The spec doesn't describe what the template contains beyond "the feature name." §2.1 says each feature README should have "purpose, public surface, key files, dependency notes" — but is the scaffolder expected to pre-populate these sections as stubs, or just write a header with the name? Given that §2.2 is the authoritative conventions doc, the scaffolder template's relationship to it matters: does the template reproduce §2.2's structure as placeholders (recommended) or produce a minimal file that the feature author fills from scratch? One sentence clarifying this would help the plan author.

### Nit

#### N1: §2.9 files-touched table ordering could be clearer

**Location:** §2.9

The table lists 15 files in a logical but not immediately scannable order. Grouping by directory (all `src/features/` together, all `src/shared/` together, all `frontend/` config together, all `docs/` together) would make it faster to verify completeness against a post-4a diff. Not functionally important — the table is already accurate and complete.

#### N2: §1.4 sub-split table "Ships as" column references plan filenames that follow a clear convention

**Location:** §1.4 table

The plan filenames (`plans/21a-frontend-phase-4a-scaffolding.md`, `plans/21b-frontend-phase-4b-shell-extraction.md`) and branch names (`phase-4a-scaffolding`, `phase-4b-shell-extraction`) are well-chosen and consistent with the 0a/0b precedent. No issue — noting that the naming convention is clear and follows established patterns.

#### N3: Synthesis-3 open question about `react-refresh` override and barrel co-exports is implicitly resolved

**Location:** synthesis-3 "Open Questions"

Synthesis-3 flagged: "Does `shell/index.ts`'s co-export of `Layout` (component) + `useAppSidebar` (hook) + `ProtectedRoute` (component) trip `react-refresh/only-export-components` even with the H1 override?" The answer is yes, the override silences it — `react-refresh/only-export-components` checks file paths against the override zones, and `shell/index.ts` is in `src/features/**`, which 4a's override covers. The spec doesn't restate this resolution explicitly, but the H1 fix (§2.6 item 4) addresses it. No spec change needed; noting for traceability.
