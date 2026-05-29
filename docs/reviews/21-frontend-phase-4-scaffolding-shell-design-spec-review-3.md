---
artifact: specs/21-frontend-phase-4-scaffolding-shell-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 3
---

## Context

Reviewed against the current `frontend/src/` tree on `master`. All factual claims in §1.2 were spot-checked against live files (contexts, layout components, shared/, eslint.config.js, knip.json, package.json, App.tsx, ProtectedRoute.tsx, hooks/useAuth.ts, ui/sidebar.tsx). Import-site counts were verified by grep. This is a round-2 spec review (the document under review is already revised from round-1 feedback).

## Findings

### Critical

#### C1: Factual error — `ui/sidebar.tsx` `useSidebar` IS exported, not module-private

**Location:** §1.2 table row `src/components/ui/`, line 36 of the spec; repeated in §2.7 and §3.6

The spec states:

> `ui/sidebar.tsx` declares a **module-private** `useSidebar()` (not exported)

This is false. `ui/sidebar.tsx` line 734 includes `useSidebar` in its `export { ... }` block. The function is declared at line 35 as a plain `function useSidebar()` but is explicitly exported at the module level.

Consequence: the spec's conclusion "No import-site collision is possible" is also wrong — a collision IS possible because both `@/components/ui/sidebar` and `@/contexts/SidebarContext` export a `useSidebar`. Currently no file imports `useSidebar` from `ui/sidebar`, so there's no *active* collision, but the risk assessment is based on an incorrect premise. The §3.6 rename to `useAppSidebar` remains the right call but is understated in urgency — it should be characterized as resolving a real export-name collision, not merely adding "cheap clarity." The §3.6 TD-FE entry should note that `ui/sidebar.tsx`'s `useSidebar` is a public export.

### High

#### H1: Missing `eslint.config.js` override update in 4b will break `--max-warnings 0`

**Location:** §3.7 "Files touched (4b)" table; §3.8 done-when

The current `eslint.config.js` has an override zone (lines 85–89) that disables `react-refresh/only-export-components` for `src/contexts/**`. This exists because context files co-export hooks alongside Provider components (e.g., `useAuth` + `AuthProvider`).

When 4b moves `AuthContext.tsx` → `shared/auth/`, `TenantContext.tsx` → `shared/tenant/`, and `SidebarContext.tsx` → `features/shell/`, none of the new paths match `src/contexts/**`. The rule is configured as `["warn", { allowConstantExport: true }]`, and `lint` runs with `--max-warnings 0`. All three moved context files would trigger warnings → preflight red.

§3.7's files-touched table does not list `eslint.config.js` for 4b. The done-when does not account for this. The fix is to either: (a) expand the override to cover `src/shared/{auth,tenant}/**` and `src/features/shell/**` (or `src/shared/**` + `src/features/**`), or (b) restructure the context files to separate hook and provider exports (more invasive, better long-term). At minimum, the plan needs an explicit step for this.

#### H2: `useAuth` naming collision between `AuthContext` and `hooks/useAuth` not discussed

**Location:** §1.2 table, §3.2

Two different modules export a function named `useAuth`:

- `src/contexts/AuthContext.tsx` exports `useAuth` — returns `{ currentUser, orgId, orgName, login, signup, logout, fetchOrgId, loading }`
- `src/hooks/useAuth.ts` exports `useAuth` — composes the above + `useTenant` + `jwtManager`, returns `{ ...firebaseAuth, orgId, orgName, jwtToken, isGeneratingToken, logout }`

25 files import `useAuth` from `contexts/AuthContext`; 4 files import `useAuth` from `hooks/useAuth`. The spec discusses the `useSidebar` naming twin at length (§1.2, §2.7, §3.6) but never mentions the `useAuth` collision, which is arguably more impactful — these are two *different behaviors* sharing a name, and consumers must know which one they're getting. When `AuthContext.tsx` moves to `shared/auth/`, this collision persists; if a future phase also moves `hooks/useAuth.ts` into `shared/`, the collision becomes intra-directory.

Recommendation: flag this in the spec with at least a note in §3.2 or a TD-FE entry. The §3.4 barrel (`shared/auth/index.ts`) exposes `useAuth` (the context hook); any consumer wanting the composed hook must import from `@/hooks/useAuth`. This is workable but should be documented as a known naming hazard.

#### H3: ~185 lines of commented-out dead code in `AuthContext.tsx` would be carried into `shared/auth/`

**Location:** §3.2, §3.7

`src/contexts/AuthContext.tsx` has lines 1–185 entirely commented out (an older implementation with hardcoded test values). The active implementation starts at line 187. The spec proposes moving this file verbatim into `shared/auth/AuthContext.tsx` — which would carry 185 lines of dead commented-out code into the new canonical location.

This is a cleanup opportunity that should be at least acknowledged. Options: (a) strip the dead block during the move (trivial, low risk since it's all commented out), (b) log a TD-FE for Phase 11 cleanup. Given the spec's principle that 4b is parity-preserving, option (b) is defensible, but the spec should explicitly note the dead code and make a deliberate choice rather than silently carrying it forward.

### Medium

#### M1: TD-FE numbering not anchored — `TD-FE-14` in done-while is fragile

**Location:** §3.8 item 6

The done-when says "TD-FE-14 logged for the sidebar name twin." The numbering assumes 4a's knip-ignore entry takes a prior number, but neither the spec nor the current `docs/TECH_DEBT.md` states what the current max `TD-FE-<n>` is. If any TD-FE entries are added between spec approval and 4b execution (e.g., during 4a implementation), the number would shift.

Recommendation: use "next free TD-FE number" in the spec and let the plan assign the concrete number at execution time. Or anchor the current max in the spec's starting-state table.

#### M2: Index-only lint enforcement mechanism deferred as a spike with uncertain outcome

**Location:** §2.6 item 2, §8.2 item 1

The spec identifies "feature A imports feature B only via `B/index.ts`" as a core architectural constraint but defers the enforcement mechanism to a 21a plan spike. Three mechanisms are listed (`no-internal-modules` + allow-list, per-pair `no-restricted-paths` zones, `dependency-cruiser`) and all are described as having friction.

This is the most architecturally significant lint rule in the entire spec, and its feasibility is uncertain. If the spike fails, the spec falls back to `dependency-cruiser` (a new tool), adding scope to 4a. The done-when gates on a "positive enforcement test" but doesn't specify what happens if no mechanism works cleanly — does 4a block, or does it ship without index-only enforcement and log a TD-FE?

Recommendation: add an explicit fallback outcome to §2.6 item 2 and the done-when — e.g., "if no mechanism passes the positive test, log TD-FE for index-only enforcement and ship 4a with zone boundaries only."

#### M3: §2.6 self-referential correction suggests drafting instability

**Location:** §2.6 "Prerequisite — resolver (load-bearing)"

The text says:

> this corrects §1.3.6's earlier "no new tool" framing

§1.3 item 6 already says "this requires configuring an import resolver (a new dev-dep, `eslint-import-resolver-typescript`)" — so §1.3.6 itself is already corrected. The §2.6 parenthetical is a correction of an earlier draft that no longer exists in the text. This is a minor drafting artifact but could confuse a reader checking §1.3.6 for the old framing.

Recommendation: remove the self-referential correction or make it an inline note about the evolution.

#### M4: No mention of `SidebarProvider` from `ui/sidebar.tsx` co-existing with app's `SidebarProvider`

**Location:** §3.1, §3.4, §3.6

`ui/sidebar.tsx` exports a `SidebarProvider` (shadcn's collapsible sidebar primitive). The app's `SidebarContext.tsx` also exports a `SidebarProvider`. These are different components with the same export name from different modules. The spec discusses the `useSidebar` twin but not the `SidebarProvider` twin. After 4b, `shell/index.ts` re-exports the app's `SidebarProvider` — any consumer importing `SidebarProvider` from `@/features/shell` gets the app version, but a consumer reaching into `@/components/ui/sidebar` would get shadcn's version.

This is not a practical collision (no current consumer is confused), but it's a second name twin the spec should acknowledge for completeness alongside the `useSidebar` discussion.

### Low

#### L1: Scaffolder warns but doesn't block on non-map names — misspelling risk

**Location:** §2.4

The scaffolder "warns (does not block) if the name is not on the living naming map." This means a typo like `scuot` would create `features/scuot/` without enforcement. For a codebase that values agent-readability and predictable naming, a stricter default (block, with `--force` override) would be safer. The current design optimizes for flexibility over guardrails.

#### L2: `knip.json` starting-state description is incomplete

**Location:** §1.2 "knip" row

The spec says `knip.json` "uses production-mode entries (`src/**/*.{ts,tsx}!`) and ignores only `src/components/ui/**`." The actual `knip.json` also has `ignoreDependencies: ["tailwindcss-animate", "tsx"]` and additional entry patterns (`!src/test/**`, `!src/**/__tests__/**`, test/spec file exclusions, `e2e/**/*.spec.ts`, `scripts/*.ts`). The incomplete description could mislead a plan author about knip's scope.

#### L3: Layout importer count is "~11" but exactly verifiable as 11

**Location:** §1.2 `App.tsx` row

The spec says Layout is "imported by ~11 page files." Grep confirms exactly 11 unique active imports (Settings.tsx has one commented-out and one active import). The "~" prefix is unnecessary imprecision for a directly verifiable count.

### Nit

#### N1: §1.2 uses "≈" for import-site counts that are exactly verifiable

**Location:** §1.2 "Context consumer spread" row

"AuthContext importers ≈ 25", "useTenant references ≈ 12", "direct TenantContext importers ≈ 9", "SidebarContext: ~2 real consumers." All of these can be verified exactly by grep (26 AuthContext matches, 10 TenantContext importers, 2 SidebarContext hook consumers). The approximate notation is fine for a spec but slightly undersells the spec's verification rigor.

#### N2: §9 references review documents that are part of the spec's own review pipeline

**Location:** §9 "Companion documents"

The section lists `docs/reviews/21-frontend-phase-4-scaffolding-shell-design-spec-review-1.md`, `…-review-2.md`, and `…-synthesis-2.md` as companion documents. These are the spec's own review artifacts. Listing them as companions is not wrong, but it creates a circular reference (the review references the spec, the spec references the review). Consider labeling them as "review pipeline artifacts" rather than lumping them with substantive companions like Spec 14 and Spec 20.
