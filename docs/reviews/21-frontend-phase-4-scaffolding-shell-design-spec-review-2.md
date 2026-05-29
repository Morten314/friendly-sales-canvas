---
artifact: specs/21-frontend-phase-4-scaffolding-shell-design.md
artifact_type: spec
verdict: findings
reviewer_model: claude-opus-4-8
date: 2026-05-29
round: 2
---

## Context

Independent second fresh-eyes pass, run as a clean-context subagent (no access to the author's reasoning), with findings re-verified against the live `frontend/` tree by the orchestrator. This is **not** a response to a synthesis — no synthesis has occurred yet; `review-1` (`reviewer_model: zai-coding-plan/glm-5.1`) and this `review-2` are two parallel reviewers in the first review cycle. Both should be addressed together in synthesis.

This pass emphasizes **code-verified** claims. It surfaces four Critical defects that `review-1` did not catch (wrong ESLint plugin name, missing import resolver, `useAuth.ts` mischaracterization, and a `knip --strict` break of 4a's own done-when), each confirmed by inspecting `package.json`, `eslint.config.js`, `knip.json`, and the source. Where this review overlaps or contradicts `review-1`, it is noted inline for the synthesis step. Each finding is tagged **[VERIFIED]** (checked against code) or **[JUDGMENT]** (analytical).

## Findings

### [Critical] §2.6/§1.2/§1.3.6/§4/§8.1 — Enforcement plugin is named wrong throughout: the repo has `eslint-plugin-import-x`, not `eslint-plugin-import` [VERIFIED]

**Location:** §1.2 ("`eslint-plugin-import` already installed"), §1.3 item 6, §2.6 (all three rules), §8.1 Q16, §4 ("the lint-tool line → `eslint-plugin-import`").

`frontend/package.json` declares `eslint-plugin-import-x@~4.15.0` (resolved 4.15.2); plain `eslint-plugin-import` is **absent** from `node_modules`. `eslint.config.js` imports `importX from "eslint-plugin-import-x"`, registers it under the `"import-x"` key, and already uses `import-x/order`. `import-x` is a performance fork with its **own plugin namespace** — the rules must be written `import-x/no-internal-modules`, `import-x/no-restricted-paths`, `import-x/no-cycle`, not `import/...`. A plan author copying §2.6 verbatim produces a config that throws "definition for rule not found" (or silently no-ops). The error also propagates into a Spec 14 amendment (§4), writing the wrong fact into the master plan. The capability claim survives — those rule files all exist in import-x — only the package/rule names are wrong.

**Fix:** Global replace `eslint-plugin-import` → `eslint-plugin-import-x` and `import/<rule>` → `import-x/<rule>` across §1.2, §1.3.6, §2.6, §3.3-amendment, §4, §8.1.

### [Critical] §2.6 — No import resolver is configured, so the `@/`-aliased dependency rules likely no-op; needs a new resolver dependency (contradicting the "no new tool" framing) [VERIFIED + JUDGMENT]

**Location:** §2.6.1 ("scoped to police only `@/features/*` paths"), §2.6.3 (`no-cycle`), §3.4 ("the lint rule now enforces this"), §1.3.6 ("Already installed; no new tool").

`eslint.config.js` has **no `settings` block and no `import-x/resolver`** (verified: no resolver key, no `eslint-import-resolver-*` package installed). `import-x/order` tolerates this because ordering is largely lexical, but `no-internal-modules`, `no-restricted-paths`, and `no-cycle` must **resolve** a specifier to a file path to reason about depth/zones/cycles. With `@/` being a TS/Vite alias and no resolver wired in, import-x cannot map `@/features/shell/components/Sidebar` to a real file — it likely treats `@/...` as an unresolved bare specifier and **skips it**. The spec asserts the rules "first enforce in 4b" as if free; without a resolver they may enforce nothing. A no-op rule is *also* green, giving false confidence that silently carries through Phases 5–12.

**Fix:** 4a must add `settings: { "import-x/resolver": { typescript: { project: "tsconfig.app.json" }, node: true } }` and install `eslint-import-resolver-typescript` (a real new dev-dep — §1.3.6's "no new tool" is inaccurate). 4a's done-when must include a **positive test that a deliberate deep `@/features/...` import is actually flagged**, not merely "lint green."

### [Critical] §1.2/§3.2 — `useAuth.ts` is not an AuthContext wrapper: it composes AuthContext **and** TenantContext (+ jwtManager), which breaks the §3.2 placement and introduces a shared cycle [VERIFIED]

**Location:** §1.2 ("`AuthContext` has a wrapper hook at `src/hooks/useAuth.ts`"), §3.2 ("`src/hooks/useAuth.ts` → `src/shared/auth/useAuth.ts` (co-located with the context it wraps)").

Verified `src/hooks/useAuth.ts`: it calls `useFirebaseAuth()` (AuthContext) **and `useTenant()` (TenantContext)** and `jwtManager`, returning a merged session/JWT object — a JWT-generation hook that depends on tenant selection, not an auth-context wrapper. Consequences the spec gets wrong: (1) placing it in `shared/auth/` makes `shared/auth` import `shared/tenant`, and since §3.2 already has `tenant → auth`, you get `shared/auth/useAuth → shared/tenant → shared/auth/AuthContext` — a **module cycle across the two shared subfolders** that `no-cycle` (once C2 is fixed) may flag, contradicting the spec's clean one-direction narrative; (2) "co-located with the context it wraps" is false (it wraps two).

**Fix:** Correct §1.2/§3.2 to describe `useAuth.ts` accurately, and decide its home with the real dependency in view — e.g., it lives in neither `auth/` nor `tenant/` and takes both as inputs, or the resulting `shared/auth ↔ shared/tenant` coupling is explicitly accepted and `no-cycle` scoped to tolerate it. (Note: TD-FE-12 already flags `TenantContext.availableTenants` as dead post-Phase-3 — the plan touching TenantContext should fold or defer that.)

### [Critical] §2.10/§3.8 — `knip --strict` will turn preflight RED on 4a's own additive files; 4a cannot meet its "preflight green" done-when as written [VERIFIED + JUDGMENT]

**Location:** §2 intro ("preflight stays green because the new lint rules are vacuous"), §2.5 (`FeatureErrorBoundary` "first used in Phase 5"; "4b does not wrap the shell in it"), §2.10 item 7, §3.8 item 7, §1.2 (preflight ends with `knip --strict`).

Verified `knip.json`: `entry` uses `"src/**/*.{ts,tsx}!"` (production `!` mode — an exact "used files" set, not a graph-walking root; corroborated by the project's own knip note), and `ignore` covers only `src/components/ui/**`. Under `knip --strict`, every export in a production-matched file must be consumed and every file reachable. So in **4a**: `src/shared/components/FeatureErrorBoundary.tsx` is used by nobody until Phase 5 → flagged as an unused export → `knip --strict` exits non-zero → **preflight RED**. The barrel `src/shared/components/index.ts` re-exporting it doesn't satisfy "used" if nothing imports the barrel. The spec's "preflight stays green" claim addresses only lint and ignores knip — the actual blocker. §2.10/§3.8 make "preflight green" a done-when that 4a, as specified, cannot satisfy.

**Fix:** 4a's plan must pick one and state it: (a) add `FeatureErrorBoundary` + barrel to `knip.json` `ignore` until Phase 5 consumes it (log a TD-FE to un-ignore later); (b) have something consume it in 4b (contradicts §2.5); or (c) confirm whether a Vitest import counts (test files are knip-excluded, so likely not). This deserves an explicit subsection, not silence.

### [High] §1.2/§3.2/§3.7/R1 — Context consumer counts are inflated, and several "consumers" are files that 4b itself moves [VERIFIED]

**Location:** §1.2 ("AuthContext/useAuth: 28 ... TenantContext/useTenant: 14"), §3.2 ("~28"/"~14"), §3.7 ("~40 import sites (28 auth + 14 tenant)"), R1.

Verified counts: files importing from `contexts/AuthContext` ≈ **25** (incl. `App.tsx` and `useAuth.ts` itself); union of "imports `useAuth` from either source" ≈ **29**. `useTenant` references = **12** files; direct `contexts/TenantContext` imports = **9**. So "auth=28" is high by ~3 and "tenant=14" is high by 2–5; the "~40 sites = 28+14" arithmetic double-counts because the sets overlap (`ProtectedRoute`, `Header`, `Sidebar`, `ProfileDialog`, `useAuth.ts`, `useLogin.ts`, `TenantSelection` touch both) → true union ≈ **~30**. Worse, several "consumers" live in `components/layout/` + `ProtectedRoute.tsx` — files **4b moves into `shell/` wholesale** — so they are not external rewrite sites at all; the true *external* path-rewrite count is lower still.

**Fix:** Re-count; state exact numbers; split into (a) files that move into shell, (b) external files needing an `@/contexts/...` → `@/shared/...` rewrite, (c) overlap. Give the plan author a precise file list, not "~40."

### [High] §3.3/§3.4/§1.4 — "Extract the route shell into `shell/AppRoutes.tsx`" is incoherent with per-page Layout and inverts the dependency direction [VERIFIED + JUDGMENT]

**Location:** §1.2 ("`Layout.tsx` is not referenced in `App.tsx`"), §3.3 ("Extract the `<Routes>` table into `shell/AppRoutes.tsx`"), §3.4 (`AppRoutes` in the public surface).

Verified: `Layout` is imported by **11 page files** (Artifacts, Calendar, Customers, Deals, Insights, MarketResearch, MissionControl, Reports, ScoutDeployment, Settings, Signals) and is **not** referenced in `App.tsx`. So the extracted `<Routes>` is a pure route table that renders `<ProtectedRoute><MarketResearch/></ProtectedRoute>` etc., while each page reaches back into `@/features/shell` for `Layout` to wrap itself. Moving `<Routes>` into `features/shell/` therefore makes `shell/AppRoutes.tsx` import 11 page components — i.e., **shell depends on (future) features**, inverting the §3.3 dependency rule and making shell a churn hub that every Phase 5–12 page-move must edit. Listing `AppRoutes` as part of shell's "public surface" (§3.4) is dubious: it is an app-root concern referencing every feature, the opposite of an encapsulated API, and only `App.tsx` consumes it.

**Fix:** Strongly consider leaving `<Routes>` in `App.tsx` (or a top-level `src/routes.tsx` that is *not* inside any feature — the one place allowed to know all features). If it must move to shell, (a) acknowledge the transitional `shell → pages` back-references, (b) drop `AppRoutes` from the public-surface framing, (c) state each later feature phase edits the route table.

### [High] §3.4 vs §1.3.2 — `shell/index.ts` exports `Layout` to 11 page consumers, making shell a hub — contradicting the anti-hub rationale used to justify Q11 [JUDGMENT]

**Location:** §3.4 (`shell/index.ts` re-exports `Layout`), §1.3.2 ("placing [AuthContext] in `features/shell/` would make the shell a dependency hub for 27 non-shell consumers").

The spec's central argument for moving auth/tenant to `shared/` is "don't make shell a hub." But `Layout` stays in shell and is consumed by 11 pages (→ 11 features) via `shell/index.ts` — making shell a hub for `Layout` for every feature, the same pattern §1.3.2 rejects. The rationale is applied selectively. The real objection to AuthContext-in-shell is *coupling direction / cross-cutting state*, not raw consumer count; a reviewer of Phase 10 will hit this inconsistency.

**Fix:** Re-base the §1.3.2 rationale on coupling direction / cross-cutting *state* rather than consumer count, and acknowledge shell legitimately exposes `Layout` app-wide (presentational, not state).

### [High] §4 — Amending the frozen Phase 10/11 narrative blocks of Spec 14 conflicts with Spec 14's own freeze rule; the spec inherits an unresolved freeze-vs-reconcile tension [VERIFIED — cross-spec]

**Location:** §4 ("On the 4b branch ... §4 Phase 10 block — rewrite ...; §4 Phase 11 block — note ...").

Spec 14 §4 states "Phase descriptions below are intentionally not amended after a phase ships — they're a frozen record of intent," and CLAUDE.md says specs are "a frozen record of intent, not current truth." Yet Spec 14 R7 says "keep the master spec reconciled." Spec 14 is itself inconsistent here, and Spec 21 §4 directs rewriting the frozen Phase 10/11 *narrative* blocks without resolving it. A plan author won't know if that edit is allowed. (Amending the §4 status table and the §8 open-questions list is uncontested — those are living.)

**Fix:** Resolve explicitly: prefer amending only the status table + §8 list, and record the AuthContext-home / Tenant-timing decisions in ADR-0002 (which this spec already creates) rather than rewriting frozen prose. If R7 truly wins, say so and cite it. (Overlaps review-1's ADR-alternatives Medium and this review's M3.)

### [Medium] §2.6.1 — `no-internal-modules` is a global forbid-deep-by-default rule with an exception list, not a "scoped to features" rule; the allow-list is large and fragile [VERIFIED schema + JUDGMENT]

**Location:** §2.6.1 ("scoped to police only `@/features/*` paths ... The `allow` list must whitelist all existing deep-import patterns").

The rule's schema accepts `{ allow }` or `{ forbid }` globs but has no "only apply to these importers" primitive. To "only police `@/features/*`," the `allow` list must enumerate **every other deep-import shape in the codebase** (`@/components/ui/*`, `@/components/*`, `@/lib/*`, `@/hooks/*`, `@/utils/*`, `@/contexts/*`, `@/shared/api/*`, `@/shared/api/contracts/*`, deep relatives, …). That is fragile and grows every phase (the spec's "etc." hides this), and interacts with C2 (without a resolver the `@/` globs may not match anyway). (Overlaps review-1's Medium on the allow-list maintenance trap.)

**Fix:** Acknowledge it's global-with-exceptions; evaluate whether `no-restricted-paths` (which takes `target`/`from`/`except` and can express "nothing may import `features/*/!(index)`") is the better primary fit for index-only enforcement. Require 21a's plan to produce the full allow-list plus a regression test.

### [Medium] §2.6.3 — The `no-cycle` pre-check is sound but mis-aimed: it depends on the resolver (C2), and the relevant cycle is one 4b *creates* (C3), not a pre-existing tree cycle [VERIFIED + JUDGMENT]

**Location:** §2.6.3 ("run eslint with only this rule in report mode ... If pre-existing cycles exist ...").

Without the C2 resolver, a `no-cycle` run over `@/` imports finds zero cycles — a false all-clear. And the concrete cycle is the `shared/auth/useAuth → shared/tenant → shared/auth` one introduced by 4b (C3), not a current-tree cycle the 4a pre-check would surface.

**Fix:** State that the resolver (C2) is a prerequisite for a meaningful pre-check, and that the auth/tenant co-location (C3) must be evaluated against `no-cycle` in 4b.

### [Medium] §1.3/§2.8/§4/R4 — The same decision is recorded in three prose locations (spec §1.3, ADR-0002, Spec 14 amendment) — ceremony-heavy and a staleness surface [JUDGMENT]

**Location:** §1.3 items 2–5, §2.8 (ADR-0002), §4, R4.

For a pre-launch MVP optimizing for velocity, restating the "auth/tenant → shared, Tenant-now" rationale in three places invites drift.

**Fix:** Make ADR-0002 canonical; have §4 and §1.3 point to it rather than restate. (Resolves part of H4 and overlaps review-1's ADR-alternatives finding — consider adding an "Alternatives: defer to Phase 10" line to ADR-0002 as review-1 suggests.)

### [Medium] §3.5/§3.8 — Guard-behavior parity (the most logic-heavy moved file) is attributed to visual regression, but VR can't catch a wrong redirect [VERIFIED + JUDGMENT]

**Location:** §3.5 ("auth guard, tenant guard ... behave as before" under a VR-led safety net), §3.8 item 7.

`ProtectedRoute`'s `requireTenant` redirect is behavioral; a 2% pixel threshold won't detect a wrong redirect, and Login/TenantSelection don't even render the shell (no `Layout`), so VR exercises the shell only on authenticated screens.

**Fix:** Attribute guard parity to the specific Playwright journeys (e.g. login → tenant → mission-control), confirm the `requireTenant` redirect is asserted there, and add a journey step if it isn't.

### [Medium] §2.1 vs §2.4 vs §8.2 — Three different commitment levels on whether the scaffolder creates `pages/components/hooks/services` [VERIFIED in-spec]

**Location:** §2.1 ("created on demand by the owning phase"), §2.4 ("not by the scaffolder (or `.gitkeep` if 21a's plan prefers)"), §8.2 item 1 (deferred, "Default: lazy").

The same micro-decision is stated flatly, hedged, and deferred in three places. (Overlaps review-1's Low on the same contradiction.)

**Fix:** Decide once (lazy; always-present files only; no `.gitkeep`) and remove the hedges, or keep it deferred and stop asserting in §2.1 — not both.

### [Medium] §3.3 — `App.tsx` nesting is paraphrased loosely for a "verbatim" parity move [VERIFIED]

**Location:** §1.2 ("`Toaster`/`Sonner`/`PWAInstallPrompt` render after `<Routes>`"), §3.3 ("renders `<BrowserRouter><AppRoutes/></BrowserRouter>`, then `Toaster`/... as today").

Verified actual tree: `Toaster`/`Sonner`/`PWAInstallPrompt` render *after* `</BrowserRouter>` but *inside* `<TooltipProvider>` (and the other providers). "After `<Routes>`" is true but imprecise; the load-bearing detail for a "verbatim" move is they sit outside BrowserRouter, inside TooltipProvider.

**Fix:** Pin the exact current tree in §3.3 so "verbatim" is unambiguous.

### [Low] §1.2 — "All green" preflight is an unverified runtime claim [JUDGMENT]

**Location:** §1.2 preflight row ("All green."). The chain *order* is **[VERIFIED]** correct against `package.json`. The green *state* isn't checked here and isn't load-bearing.

**Fix:** Soften to "chain wired per §1.2," or make 21a's plan re-run preflight as step 0.

### [Low] §3.6/§3.7/R5 — The shadcn `useSidebar` collision is narrower than stated: shadcn's `useSidebar` is **not exported** [VERIFIED]

**Location:** §1.2, §2.7, §3.6, R5.

Verified: `src/components/ui/sidebar.tsx` declares `function useSidebar()` with **no `export`**, while `src/contexts/SidebarContext.tsx` exports `useSidebar`. shadcn's is module-private, so there is **no import-name collision at consumer sites** — the "edits the wrong one" risk is confined to editing within `ui/sidebar.tsx`. (Contradicts review-1's High H2, which says the barrel "actively exports the colliding name" and recommends exporting `useAppSidebar` now. The collision is real but cannot reach consumers via import; reconcile in synthesis — renaming the app hook to `useAppSidebar` is still reasonable hygiene, just lower urgency than review-1 frames.)

**Fix:** Rescope R5/§3.6 to "editing within `ui/sidebar.tsx`"; note shadcn's is unexported. TD-FE entry still worth logging (next number is TD-FE-14).

### [Low] §2.2 — The naming map omits Phase 12's small-page feature names [JUDGMENT]

**Location:** §2.2 ("the canonical feature names"), §1.3.8.

The map covers Phases 5–10 only; Phase 12's small pages (calendar/deals/insights/reports/artifacts) get feature folders whose names aren't listed, yet the README is billed as canonical.

**Fix:** Note the map covers Phases 5–10 and Phase 12 names are TBD, or add them. Low priority given lazy folder creation.

### [Nit] §2.9 — Files table omits creating the `docs/adr/` directory itself

The table lists `docs/adr/0001…` and `0002…` but not the directory; trivial, but the table is billed as a complete inventory. (Matches review-1's Low.)

### [Nit] §2.10 item 9 — "source file" is ambiguous

"No existing source file moved" — the `git diff --stat` phrasing disambiguates, but "source file" alone could be read to exclude tests/config/markdown. (Matches review-1's Low.)

## Verified sound (scrutinized, no action)

- Provider nesting order (§1.2/§3.3) — **[VERIFIED]** correct; `TenantContext` genuinely imports `useAuth` from AuthContext, so "order is load-bearing" holds.
- `Layout.tsx` not referenced in `App.tsx` (§1.2) — **[VERIFIED]** (but see H2/H3 for downstream incoherence).
- `tsx` in deps + `check-bundle-budget.ts` / `capture-bundle-baseline.ts` exist (§2.4) — **[VERIFIED]**.
- Preflight chain order + VR 2% threshold (§1.2/§3.5) — **[VERIFIED]** matches `package.json` / `playwright.config.ts`.
- `features/`, `docs/adr/`, `shared/components/` absent today (§1.2); `contexts/` = `{Auth,Sidebar,Tenant}`, `layout/` = `{Sidebar,Header,Layout,ProfileDialog}` (§3.1) — **[VERIFIED]**.
- 0a/0b precedent (Spec 15) — **[VERIFIED]**; Spec 21's one-spec/two-plans mirror is structurally faithful.
- The 4a/4b sub-split and the shared-vs-feature placement *design* — **[JUDGMENT]** well-argued; the core architecture is sound. The defects are in execution detail (tooling names, resolver, knip, counts, route-shell location), not the strategy.

## Plan-readiness summary

**Not plan-ready.** Blocking before 21a/21b plans: the four Critical findings — wrong plugin name (broken config), missing resolver (rules silently no-op + a denied new dependency), `useAuth` mischaracterization (breaks the migration story + a shared cycle), and the knip-RED that 4a's own "preflight green" done-when cannot satisfy. Fix-before-plans (cheap): H1 (recount), H2/H3 (route-shell-as-hub + Layout-hub inconsistency — needs a real decision on where `<Routes>` lives), H4 (freeze-vs-amend). The lint-enforcement section (§2.6) — the phase's only non-trivial new machinery — is currently built on a wrong package name and a missing resolver; combined with review-1's dangling `§2.3` cross-references, this spec needs one mandatory revision pass before plans.
