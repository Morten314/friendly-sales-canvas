# Brewra — Resolved Technical Debt (Archive)

Fully-resolved frontend tech-debt entries, moved here from `docs/TECH_DEBT.md` to keep the active register focused. Entry text and numbering are preserved verbatim — IDs are never reused. Open and carried-forward entries (including partially-resolved ones) remain in the main register. Index: see the table at the top of `docs/TECH_DEBT.md`.

---

## TD-FE-1 — Deferred orphan-route investigation: /tenant-selection

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 (plans/16-frontend-phase-1-loc-reduction.md), Step 4 (orphan-route sub-pass).

**Current state:**
`App.tsx` defines `<Route path="/tenant-selection" element={<ProtectedRoute><TenantSelection /></ProtectedRoute>}`.
The route is not linked from `src/components/layout/Sidebar.tsx`. The 6-check kit (orphan variant):
  rg-basename: 0 (no Sidebar.tsx reference to /tenant-selection)
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0 (no references outside App.tsx itself)
  route-walk: none
  test-imports: none

**Why deferred:**
`/tenant-selection` is an auth/onboarding flow route — the app is expected to redirect here programmatically
post-login when the user has no tenant selected. It is intentionally absent from the Sidebar nav.
Conservative posture for auth/tenant/protected-route wrappers per Spec 16 §2.3.

**Pull-forward trigger:**
Phase 13 (post-modularization LOC pass) re-evaluates with strict TS context and richer test coverage;
verify the redirect chain (login → /tenant-selection → mission-control) is covered by e2e before
considering removal.

**Owner:** TBD.

**Resolved (Phase 13 13a-vi, 2026-06-06):** kept — /tenant-selection relocated to src/features/tenant/routes.tsx (tenantRoutes); reached via programmatic post-login redirect and covered by e2e/journeys/01-login-tenant-mission.spec.ts (the named pull-forward trigger). Intentionally unlisted from Sidebar (auth/onboarding flow). Re-confirmed reachable.

---

## TD-FE-2 — Deferred orphan-route investigation: /scout-deployment

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 (plans/16-frontend-phase-1-loc-reduction.md), Step 4 (orphan-route sub-pass).

**Current state:**
`App.tsx` defines `<Route path="/scout-deployment" element={<ProtectedRoute requireTenant><ScoutDeploymentPage /></ProtectedRoute>}`.
The route is not linked from `src/components/layout/Sidebar.tsx`. The 6-check kit (orphan variant):
  rg-basename: 0 (no Sidebar.tsx reference to /scout-deployment)
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0 (no references outside App.tsx itself)
  route-walk: none
  test-imports: none

**Why deferred:**
`ScoutDeploymentPage` (`src/pages/ScoutDeployment.tsx`) is a live component wrapping
`src/components/settings/ScoutDeployment.tsx`. The `ScoutDeploymentDetails` sub-component is also
actively rendered inside `MarketResearch.tsx`. The page may be intentionally accessible via direct URL
only (admin/configuration path, not a regular user nav destination). Removing the route while the
component is live warrants Brewra-dev confirmation.

**Pull-forward trigger:**
Confirm with Brewra devs whether `/scout-deployment` is intentionally unlisted from the Sidebar
(admin-URL pattern) or is dead product surface. If dead: remove the Route element and run 6-check
kit on `src/pages/ScoutDeployment.tsx` for full dead-file removal.

**Owner:** TBD.

**Resolved (Phase 13 13a-vi, 2026-06-06):** kept — /scout-deployment relocated to src/features/scout/routes.tsx; ScoutDeploymentPage wraps the live ScoutDeployment form and ScoutDeploymentDetails renders inside IntelligenceTab. Intentional direct-URL/admin surface, not dead. Re-confirmed reachable.

---

## TD-FE-3 — Deferred unused exports: src/lib/ (firebase, api, leadStreamHeatmapSession, missionProfilerSessionCache)

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 (plans/16-frontend-phase-1-loc-reduction.md), Step 5.

**Current state:**
Knip flags these symbols in `src/lib/` files as unused exports:
  - `src/lib/firebase.ts` — `default` (default export of the Firebase `app` instance; named `auth` export is live)
  - `src/lib/api.ts` — `API_BASE_URL`, `ApiFetchOptions`, `ICP_BACKEND_URL`
  - `src/lib/leadStreamHeatmapSession.ts` — `leadStreamHeatmapCacheKey`
  - `src/lib/missionProfilerSessionCache.ts` — `ProfilerSessionSnapshot`

Per-symbol rg + test-import check returned no live inbound references (API_BASE_URL appears only in
commented-out code in DataHistoryDialog.tsx).

**Why deferred:**
All files are under `src/lib/` — conservative posture per Spec 16 §2.3. The lib/ area is the
utility/abstraction layer; removing exports here before Phase 13 modularization could silently break
import patterns not yet visible to knip (dynamic import, late binding, or re-export chains).
Note: the export-keyword-only operation applied aggressively in Step 5 for `components/signals/` (commits 2e086f7, f47b204) was held conservative here per the Spec 16 §2.3 lib/ boundary, not the per-symbol risk. Phase 13 can revisit by applying the same drop-export-keyword op if the conservative posture relaxes.

**Pull-forward trigger:**
Phase 13 (post-modularization LOC pass) with strict TS context may relax the conservative-posture
barrier. Confirm no dynamic consumers before removal.

**Owner:** TBD.

**Resolved (Phase 13 13a-ii, 2026-06-06):** removed `export default app` from firebase.ts / dropped `export` from `API_BASE_URL`, `ICP_BACKEND_URL` in transport.ts (both internal-only) / kept `ApiFetchOptions` export (live consumer: `src/shared/api/client.ts`) / dropped `export` from `leadStreamHeatmapCacheKey` (internal-only) / dropped `export` from `ProfilerSessionSnapshot` (internal-only).

---

## TD-FE-4 — Deferred unused export: src/hooks/use-toast.ts

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 (plans/16-frontend-phase-1-loc-reduction.md), Step 5.

**Current state:**
Knip flags these symbols in `src/hooks/use-toast.ts` as unused exports:
  - `reducer` — internal state reducer exported at line 74; only used internally at line 134

Note: `toast` was also flagged by knip but is retained — it IS re-exported via
`src/components/ui/use-toast.ts` (`export { useToast, toast }`) and consumed downstream.

Per-symbol rg + test-import check: `reducer` has zero inbound references outside the file.

**Why deferred:**
File is under `src/hooks/` — conservative posture per Spec 16 §2.3.

**Pull-forward trigger:**
Phase 13 (post-modularization LOC pass) with strict TS context.

**Owner:** TBD.

**Resolved (Phase 13 13a-ii, 2026-06-06):** dropped `export` from `reducer` in `src/components/ui/use-toast.ts`; symbol is internal-only (called only by `dispatch` inside the same file); shadcn-locked dir but dropping export of a non-standard-shadcn-public symbol is safe and does not alter the public surface.

---

## TD-FE-5 — Deferred unused exports: src/utils/apiUtils.ts

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 (plans/16-frontend-phase-1-loc-reduction.md), Step 5.

**Current state:**
Knip flags these symbols in `src/utils/apiUtils.ts` as unused exports:
  - `forceFreshData`
  - `isDataFresh`
  - `marketResearchApiCallWithCacheBust`
  - `rateLimitedApiCall`
  - `simpleApiCall`

Per-symbol rg: `isDataFresh` appears in `MarketResearch.tsx` but only as a locally-defined shadow
variable (not imported from apiUtils.ts). The other four have zero inbound references.

**Why deferred:**
File is under `src/utils/` — conservative posture per Spec 16 §2.3.

**Pull-forward trigger:**
Phase 13 (post-modularization LOC pass) with strict TS context may relax the conservative-posture
barrier. Verify no remaining call sites that use a version-shadowing import pattern.

**Owner:** TBD.

**Resolved (Phase 13 13a-ii, 2026-06-06):** removed `forceFreshData`, `isDataFresh`, `marketResearchApiCallWithCacheBust`, `rateLimitedApiCall` from `src/features/market-research/lib/apiUtils.ts` (zero inbound, not called internally) / dropped `export` from `simpleApiCall` (internal-only; called by live `marketResearchApiCall`). `isDataFresh` was confirmed not imported from apiUtils anywhere — the MarketResearch.tsx shadow-var noted in TD was a local declaration, not an import.

---

## TD-FE-6 — Deferred unused exports: src/utils/profilerAcceptedIcpDisplay.ts

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 (plans/16-frontend-phase-1-loc-reduction.md), Step 5.

**Current state:**
Knip flags these symbols in `src/utils/profilerAcceptedIcpDisplay.ts` as unused exports:
  - `ProfilerAcceptedIcpDisplayMeta`
  - `isProfilerPlaceholderIcp`
  - `mergeProfilerAcceptedIcpDisplayIfPlaceholder`

Per-symbol rg + test-import check returned zero inbound references outside the file.

**Why deferred:**
File is under `src/utils/` — conservative posture per Spec 16 §2.3.

**Pull-forward trigger:**
Phase 13 (post-modularization LOC pass) with strict TS context.

**Owner:** TBD.

**Resolved (Phase 13 13a-ii, 2026-06-06):** removed `isProfilerPlaceholderIcp` and `mergeProfilerAcceptedIcpDisplayIfPlaceholder` from `src/shared/profiler/profilerAcceptedIcpDisplay.ts` (zero external inbound; `isProfilerPlaceholderIcp` became fully dead once its only internal caller was deleted) / dropped `export` from `ProfilerAcceptedIcpDisplayMeta` (zero external named imports; used internally as a type parameter by `saveProfilerAcceptedIcpDisplayMeta` and `mergeProfilerAcceptedIcpDisplay`).

---

## TD-FE-7 — Deferred unused exports: src/components/ui/ (shadcn-locked primitives)

**Date logged:** 2026-05-27
**Origin:** Spec 16 Phase 1 (plans/16-frontend-phase-1-loc-reduction.md), Step 5.
Spec 16 §2.2 and §8 explicitly lock `src/components/ui/` from Phase 4 onward.

**Current state:**
Knip flags unused exports in 14 shadcn-ui primitive files:
  - `sonner.tsx` — `toast`
  - `avatar.tsx` — `AvatarImage`
  - `badge.tsx` — `BadgeProps`, `badgeVariants`
  - `alert.tsx` — `AlertTitle`
  - `select.tsx` — `SelectGroup`, `SelectLabel`, `SelectScrollDownButton`, `SelectScrollUpButton`, `SelectSeparator`
  - `dialog.tsx` — `DialogClose`, `DialogOverlay`, `DialogPortal`
  - `table.tsx` — `TableCaption`, `TableFooter`
  - `dropdown-menu.tsx` — `DropdownMenuCheckboxItem`, `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuShortcut`
  - `alert-dialog.tsx` — `AlertDialogOverlay`, `AlertDialogPortal`, `AlertDialogTrigger`
  - `drawer.tsx` — `DrawerOverlay`, `DrawerPortal`, `DrawerTrigger`
  - `command.tsx` — `CommandDialog`, `CommandSeparator`, `CommandShortcut`
  - `sheet.tsx` — `SheetClose`, `SheetDescription`, `SheetFooter`, `SheetOverlay`, `SheetPortal`, `SheetTrigger`
  - `button.tsx` — `ButtonProps`
  - `textarea.tsx` — `TextareaProps`

These are shadcn-ui generated primitives. The extra sub-components are exported by the shadcn
scaffolding convention even when not yet consumed by this project. Removing them would diverge
the files from the upstream shadcn source and complicate future shadcn upgrades.

**Why deferred:**
`src/components/ui/` is shadcn-locked per Spec 16 §2.2 — any unused primitives flagged by knip
stay in place. Removing upstream-scaffold exports here provides minimal LOC savings while creating
maintenance drag on future shadcn version bumps.
Note: per-file comparison against upstream shadcn-ui source was not performed in Phase 1. Phase 4's shadcn consolidation should verify each primitive against upstream before deciding what to consolidate vs prune.

**Pull-forward trigger:**
If Brewra forks shadcn components (copies them out of the upstream pattern into fully local files),
these exports can be pruned. Or if the unused sub-components remain untouched past Phase 4 and a
deliberate audit confirms they will never be used.

**Owner:** TBD.

**Resolved (Phase 13 13a-iii, 2026-06-06):** pruned breadcrumb.tsx, chart.tsx, pagination.tsx (528 LOC, zero importers confirmed via alias + relative grep across src/ and e2e/); kept all other 34 ui primitives intact including the 14 files with unused sub-exports listed above — those sub-exports were left untouched to preserve the shadcn upgrade path (re-addable via `npx shadcn add`). Note: chart.tsx was NOT imported by MiniPieChart/MiniLineChart — those import recharts directly.

**2026-05-27 update — remediation mechanism:**
The Phase 4 lock is now expressed as `"ignore": ["src/components/ui/**"]` in `frontend/knip.json`
rather than per-file `defer-export` annotations. Behavioral semantics are unchanged (files
remain in the codebase, locked from Phase 1 cleanup, deferred to Phase 4 shadcn consolidation),
but knip now reports zero findings against the directory in either mode, simplifying the
merge-gate config.

Pull-forward trigger is unchanged: Phase 4 shadcn primitive consolidation.

---

## TD-FE-13 — Repoint hardcoded backend host `backend-11kr` → `brewra-gtm-intelligence`

**Resolved:** 2026-06-02 — repointed all active references to `https://brewra-gtm-intelligence.onrender.com` and collapsed the runtime app code to a single `BACKEND_BASE_URL` source of truth in `frontend/src/lib/api.ts` (consumed by `API_BASE_URL`, `ICP_BACKEND_URL`, and the 5 former direct-fetch call sites). `vite.config.ts` (one local `backendUrl` const, both proxies) and `vercel.json` (literal) cannot import the TS const and retain the host literal as the two unavoidable mirror points. The 2 dead commented-out occurrences in `DataHistoryDialog.tsx` were deleted. Backend `backend/test_*.py` probes and the doc references (CLAUDE.md/AGENTS.md gotchas, frontend/CORS_FIX_README.md, scripts/safety_net/*) were left for a separate docs/backend pass — they don't affect the running app. Note: confirmed live 2026-06-02 (POST /market-research → 200, `data` carries executiveSummary/keyUpdates/visualDataCards/regionalData/strategicRecommendations). The user provided the host as `http://`; HTTPS is used (the PWA is https → http backend would be mixed-content-blocked).

**Date logged:** 2026-05-29
**Origin:** Plan 20 Phase 3 manual smoke (plans/20-frontend-phase-3-api-data-layer.md, Task 16 Step 2). The
live capture confirmed `https://brewra-gtm-intelligence.onrender.com` is the working backend
(`GET /profile/company?org_id=brewra` → 200, body validates against `CompanyProfileSchema`), while the
hardcoded `https://backend-11kr.onrender.com` is **suspended** (HTTP 503). The frontend still points every
backend reference at the suspended old host.

**Current state:**
`backend-11kr.onrender.com` is hardcoded in **12 live spots** (frontend-scoped grep, excludes
`node_modules`/`dist`/tests), in three tiers:

- **Config / proxy** (routes the whole app) — 5:
  - `frontend/vercel.json:5` — production Vercel rewrite `/api/$1 → <host>/$1`
  - `frontend/vite.config.ts:27` — dev-server `/api` proxy target
  - `frontend/vite.config.ts:52` — `vite preview` `/api` proxy target
  - `frontend/src/lib/api.ts:13` — `API_BASE_URL` production direct fallback
  - `frontend/src/lib/api.ts:25` — `ICP_BACKEND_URL` (feeds `buildIcpUrl`)
- **Hardcoded direct fetches** (bypass the Phase 3 shared data layer) — 5:
  - `frontend/src/components/market-research/ChatWithScout.tsx:89` — `GET /chat/`
  - `frontend/src/components/market-research/StrategistWorkspace.tsx:855` — `GET /chat/`
  - `frontend/src/components/market-research/AIPromptingInterface.tsx:215` — `GET /ask`
  - `frontend/src/components/market-research/DataHistoryDialog.tsx:950` — local `API_BASE_URL` const
  - `frontend/src/components/market-research/RegulatoryComplianceSection.tsx:729` — direct
    `GET /profile/company` (duplicates `useCompanyProfile`)
- **Cosmetic** — 1: `frontend/src/pages/MarketResearch.tsx:4002` (error-message string).
- Plus 2 commented-out occurrences in `DataHistoryDialog.tsx:29,616` (dead, deletable).

Smoke evidence (2026-05-29): the new host serves `/profile/company` (200, contract-valid). `/auth/token`
and `/auth/refresh` return 404 on the new host (and did on the old) — the JWT endpoints never existed, so
the "JWT optional" path already absorbs this; **repointing introduces no auth regression**.

**What it should be:**
Replace all 12 active references with `https://brewra-gtm-intelligence.onrender.com`. Prefer collapsing the
host to a **single source of truth** (one env var, e.g. `VITE_API_BACKEND_URL`, or one exported const)
rather than re-duplicating a literal across `vercel.json`, `vite.config.ts` (×2), `lib/api.ts` (×2), and the
5 call sites — so the next host move is a one-line change. Verify after: dev proxy, `vite preview` proxy,
Vercel rewrite, `/icp`, `/chat/`, `/ask`, and the direct `RegulatoryComplianceSection` profile fetch all
resolve to the new host. Then remove the now-obsolete `sbx` sandbox allow rule for `backend-11kr` (sandbox
hygiene only — it never affected production).

Deeper debt surfaced alongside: the 5 direct fetches bypass `src/shared/api/`; repointing them is a stopgap.
They should eventually route through the shared client (the `RegulatoryComplianceSection` `/profile/company`
fetch in particular duplicates `useCompanyProfile`). Fold into the Phase 5–7 market-research migrations
rather than this repoint.

**Why we deferred:**
- Out of scope for Plan 20 Phase 3, which consolidated only the CompanyProfile/tenant/auth/Login data layer
  and explicitly left `lib/api.ts`'s hardcoded host unchanged.
- The repoint is a cross-cutting infra change (production Vercel rewrite + two proxy configs + 5 call sites)
  that warrants its own focused commit and a decision on whether `brewra-gtm-intelligence.onrender.com` is
  the permanent home or an interim before a `brewra.com`-backed custom domain.

**What we lose by staying as-is:**
- The deployed frontend (Vercel) and local `npm run dev`/`preview` all proxy to a **suspended** backend, so
  every API call currently fails end-to-end. Pre-launch (0 live users) this is not a user-facing outage, but
  the deployed app is non-functional against its API until either the old host is un-suspended or this lands.

**Pull-forward trigger:**
- Before any real use of the deployed app, and **before launch** — the current host is suspended.
- When `brewra-gtm-intelligence.onrender.com` is confirmed the permanent backend home (vs a custom domain).
- Bundle with removal of the `sbx policy allow network backend-11kr.onrender.com` sandbox rule.

**Owner:** TBD (deploy owner).

---

## TD-FE-14 — knip-ignore on `src/shared/components/**` until Phase 5 consumes `FeatureErrorBoundary`

**Date logged:** 2026-05-29
**Origin:** Plan 21a Phase 4a (plans/21a-frontend-phase-4a-scaffolding.md), Task 3.

**Current state:**
`src/shared/components/**` is in `knip.json`'s `ignore` array. `FeatureErrorBoundary` and its `index.ts`
re-export have **no production consumer** until Phase 5 wraps the first feature route in it. Under
`knip --strict` (production mode, `src/**/*.{ts,tsx}!` entries), an exported-but-unconsumed symbol fails the
gate. Vitest tests exercise the boundary, but test files are knip-excluded, so they do not satisfy knip's
"used" check. The ignore suppresses the false positive until a real consumer exists.

**What it should be:**
Remove `"src/shared/components/**"` from `knip.json`'s `ignore` once Phase 5 imports `FeatureErrorBoundary`
to wrap a feature's top-level routed component. The export then has a production consumer and knip passes
without the ignore.

**Pull-forward trigger:**
Phase 5 (first feature extraction) — its plan's done-when removes this ignore and confirms `knip --strict`
stays green.

**Owner:** TBD.

**Resolved:** 2026-05-30 (Plan 24a Phase 5a, Task 5). Phase 5a wraps the market-research route in
`FeatureErrorBoundary` (`App.tsx`); `"src/shared/components/**"` removed from `knip.json` `ignore` and
`knip --strict` stays green.

---

## TD-FE-15 — Cross-feature index-only lint enforcement deferred (zone boundaries only)

**Date logged:** 2026-05-29
**Origin:** Plan 21a Phase 4a (plans/21a-frontend-phase-4a-scaffolding.md), Task 6.

**Current state:**
`eslint.config.js` enforces the cross-zone boundaries (`shared ↛ features`, `ui ↛ features|shared`) but **not**
the "import feature B only via `B/index.ts`" rule. The Task 6 spike tried `import-x/no-internal-modules` with an
allow-list: the **positive probe passed** (it flagged a deep `@/features/<x>/internal` import while allowing the
`@/features/<x>` index import), but the **no-regression check failed** — the rule forbids _all_ deep imports by
default, so it flagged 95 pre-existing, legitimate imports: ~85 relative deep paths (`./pages/Login`,
`../helpers/login`, `../fixtures/*`, …) plus external package subpaths (`firebase/auth`, `react-dom/client`,
`vitest/config`, `msw/node`, `@testing-library/jest-dom/vitest`). The allow-list cannot enumerate those cleanly
— external subpaths are unbounded. Per Spec 21 §2.6 item 2, 4a ships zone boundaries only rather than blocking
on an uncertain mechanism. (The positive probe did confirm the import-x engine + resolver evaluate
`src/features/**` — the rule fired there — so the zone rules are vacuous only for lack of real features, not
silently disabled.)

**What it should be:**
Express "cross-feature imports go only through `index.ts`". Re-attempt once real features exist (Phases 5–6),
gating on the same positive probe. Angles surfaced by this spike:

- Invert `import-x/no-internal-modules` to its **`forbid`** form (e.g. `forbid: ["@/features/*/*",
  "@/features/*/**"]`), which forbids only deep-feature paths and leaves other deep imports (relative, external
  subpaths) alone — sidestepping the unbounded allow-list. Confirm it does not also catch the `@/features/<x>`
  index.
- Or adopt `dependency-cruiser` for this one constraint (Spec 14 §3.3 fallback).

**Pull-forward trigger:**
Phase 5 or 6 (second real feature exists, so a genuine cross-feature import can be tested) — whichever first
adds a feature that imports another feature.

**Owner:** TBD.

**Resolved:** Phase 6 (stage 1b) — `import-x/no-internal-modules` (forbid `@/features/*/!(index)`, `@/features/*/!(index)/**`) added to `frontend/eslint.config.js`; same-feature imports converted to relative; cross-feature import is index-only.

---

## TD-FE-18 — market-research dead code (8 files, no live importer) awaiting the 5i sweep

**Resolved:** 2026-06-03 (Plan 24i Phase 5i dead-code sweep). All 8 files deleted in commit `31c6ef7` — `CompetitorAnalysis`, `CompetitorAnalysisDrawer`, `ComponentStatusLoadingScreen`, `DataHistoryDialog`, `EmergingTrends`, `EmergingTrendsDrawer`, `RecentMarketResearch`, `ScoutCapabilities` — with `tsc` + `knip --strict` confirmed green on the phase branch and on merged `master` (`d88b813`). Original entry preserved below.

**Date logged:** 2026-05-30
**Origin:** Plan 24a Phase 5a (plans/24a-frontend-phase-5a-relocate.md), Task 0 import trace.

**Current state:**
The 5a whole-dir import trace found 8 files in `src/components/market-research/` with **zero live importers** (knip does not flag them because `knip.json` `entry` makes every `src/**` file a production entry): `CompetitorAnalysis.tsx`, `CompetitorAnalysisDrawer.tsx` (only importer is dead `CompetitorAnalysis`), `ComponentStatusLoadingScreen.tsx`, `DataHistoryDialog.tsx`, `EmergingTrends.tsx`, `EmergingTrendsDrawer.tsx` (only importer is dead `EmergingTrends`), `RecentMarketResearch.tsx`, `ScoutCapabilities.tsx`. They are annotated `// DEAD CODE → delete in 5i` in place (5a Task 4).

**What it should be:**
5a is mechanical/parity, so it does **not** delete them (deletion is Spec 24 §7's 5i dead-code-sweep scope). 5i deletes all 8 and confirms `knip --strict` + `tsc` stay green. (`CompetitorAnalysisDrawer` and `EmergingTrendsDrawer` were repointed in 5a Task 2 to import the moved `AIPromptingInterface` via `@/features/...` so `tsc` stays green while they await deletion.)

**Pull-forward trigger:**
Spec 24 §7 (sub-phase 5i). Earlier only if one of these files becomes a build/parity liability before 5i.

**Owner:** TBD.

---

## TD-FE-22 — MarketEntrySection owns a data fetch but has no `<FeatureErrorBoundary>` wrapping

**Resolved:** 2026-06-03 (Plan 24i Phase 5i close). Decision finalized per the 2026-06-02 update below: **no section-level boundary**. The intelligence surface is already wrapped one level up (`IntelligenceTab.tsx` → `<FeatureErrorBoundary featureName="Market Intelligence">`) plus the `App.tsx` route-level boundary; per-section boundaries would be redundant and inconsistent across the five sibling sections (5d–5h all inherited the same choice). No code change. Original entry preserved below.

**Date logged:** 2026-06-01
**Origin:** Plan 24d Phase 5d impl review round 1 (`docs/reviews/phase-5d-market-entry-impl-review-1.md` Nit "No `<FeatureErrorBoundary>` wrapping"). Plan Task 4 Step 5 marked the boundary **optional**.

**Current state:**
`MarketEntrySection` now owns its own data fetch via `useMarketEntry` (5d moved the read path into the section), but the section itself is not wrapped in `<FeatureErrorBoundary>`. A render/parse crash inside market-entry would propagate up to the intelligence tab rather than being contained to the section. A page-level boundary already exists (the market-research route is wrapped — see Spec 24 §2 / TD-FE-14 resolution), so a crash is caught at the page, not the whole app — but not isolated to the one section.

**What it should be:**
Optionally wrap `MarketEntrySection` (or each extracted section, as a 5e–5h pattern) in `@/shared/components`'s `FeatureErrorBoundary` so a single section's fetch/render failure degrades only that section. Cheap to add (one wrapper) if section-level isolation is judged worth it.

**Why we deferred:**
- Plan 24d Task 4 Step 5 explicitly marked it optional, and a page-level boundary already provides app-level containment at 0 live users (pre-launch gate posture: advisory over hard-fail).
- Better decided once as a consistent pattern across all five sections (5d–5h) than bolted onto market-entry alone.

**What we lose by staying as-is:**
- A market-entry render/parse crash takes down the whole intelligence tab (caught at the page boundary) rather than being isolated to the section.

**Pull-forward trigger:**
- The 5e–5h section extractions — decide section-level `FeatureErrorBoundary` as a uniform pattern there — or earlier if a market-entry crash is observed disrupting the rest of the intelligence tab.

**Owner:** TBD.

**Update (2026-06-02, Plan 24e / 5e):** Decision made for the uniform pattern — **no section-level boundary added.** The intelligence surface is already wrapped one level up (`IntelligenceTab.tsx` wraps `<MarketIntelligenceSections>` in `<FeatureErrorBoundary featureName="Market Intelligence">`, plus the `App.tsx` route-level "Market Research" boundary). Per-section boundaries would be redundant with that and inconsistent across siblings. `RegulatoryComplianceSection` (5e) follows the same no-section-boundary convention as `MarketEntrySection` (5d). This TD remains open only as the record of that decision; close it (or the remaining 5f–5h sections inherit the same choice) at 5i.

---

## TD-FE-32 — Feature phase-number disagreement: master Spec 14 §4 vs features/README naming map

**Resolved:** 2026-06-03 (Phase 6 pre-planning). Reconciled `frontend/src/features/README.md`'s naming map to the master Spec 14 §4 phase sequence — the authoritative, kept-current source per Spec 14 §7 R7 (§4 is internally consistent: Phase 8 = signals + strategist, Phase 9 = scout + profiler, Phase 10 = settings + tenant + auth). Changes: `signals` 6→8, `scout` 8→9, `settings` 11→10 (`strategist`=8, `customers`=7, `mission-control`=6, `auth`/`tenant`=10 already agreed). The by-name handoff convention (Spec 24 §7) stays the robust default. Original entry preserved below.

**Resolved:** Phase 14 W5 (2026-06-08) — `frontend/scripts/scaffold-feature.ts`'s `NAMING_MAP` synced to the 14 feature folders (the code-side mirror of the README naming map this entry tracked), with a Vitest test added to keep them from drifting again.

**Date logged:** 2026-06-03
**Origin:** Phase 5 close (24i). Surfaced (not caused) by Phase 5 — recorded at the Phase 5 close per Spec 24 §9 delta 4.

**Current state:**
Master Spec 14 §4 numbers the feature phases signals=8, scout=9, settings=10; `frontend/src/features/README.md`'s naming map numbers them signals=6, scout=8, settings=11. This is pre-existing drift between the two sources, surfaced (not caused) by Phase 5. To stay unambiguous, handoff tables (e.g. Spec 24 §7) reference target features **by name**, never by phase number.

**What it should be:**
One source of truth for feature→phase numbering, with the master plan and the `features/README.md` naming map reconciled to agree.

**Why we deferred:**
- Reconciling is a cross-cutting edit affecting Phases 6–13 planning; it is out of scope for 5i (finalize-only).
- Recorded at the Phase 5 close (Spec 24 §9 delta 4).

**Pull-forward trigger:**
- The next phase that plans against the numbering (Phase 6/7 pre-planning) reconciles it, or whichever phase first hits an ambiguity the by-name convention cannot resolve.

**Owner:** TBD.

---

## TD-FE-51 — `components/market-research/` retains `ScoutChatPanel.tsx` + `types.ts` legacy residue

**Date logged:** 2026-06-05
**Origin:** Phase 8 (scout-chat relocation). The scout-chat relocation moved `ScoutChatWithHistory` and its deps into `features/market-research`, but left `ScoutChatPanel.tsx` and `types.ts` behind in the legacy `components/market-research/` directory.

**Current state:**
`components/market-research/` still contains `ScoutChatPanel.tsx` and `types.ts`, consumed by the relocated scout-chat now living in `features/market-research`. The relocation crossed the feature boundary but did not fully drain the legacy directory.

**What it should be:**
`ScoutChatPanel.tsx` and `types.ts` fully migrated into the `features/market-research` feature, with the legacy `components/market-research/` directory emptied/removed.

**Why we deferred:**
Phase 8's authority was the signals/strategist + scout-chat relocation; fully draining the legacy market-research directory overlaps the shared-chat dedup work sequenced later.

**Pull-forward trigger:**
Phase 9 shared-chat dedup / Phase 13.

**Owner:** TBD.

**Resolved (Phase 9):** 2026-06-05. `ScoutChatPanel.tsx` and `types.ts` were relocated into `features/market-research/components/scout-chat/` as part of Phase 9 Task 6. The legacy `components/market-research/` directory retains 6 other files (tracked separately as TD-FE-63), but the two files this entry tracked have moved. Original entry preserved above.

---

## TD-FE-54 — `lib/jwt.ts` + `hooks/useAuth.ts` still live in legacy `src/lib/`/`src/hooks/` rather than `shared/auth/`

**Date logged:** 2026-06-05
**Origin:** Phase 10 (Task 6). `lib/jwt.ts` and `hooks/useAuth.ts` were left in their legacy locations; Phase 10 promoted `firebase.ts` into `shared/auth/` but did not move these two files because mission-control and market-research features consume them and those features are not yet modularised.

**Current state:**
`src/lib/jwt.ts` and `src/hooks/useAuth.ts` are imported by several features that have not yet been extracted (mission-control, market-research). Moving them to `shared/auth/` before those call sites are updated would require touching a large surface outside Phase 10's scope.

**What it should be:**
Both files should live in `src/shared/auth/` alongside `firebase.ts`, with a barrel `src/shared/auth/index.ts` exporting all three. All call sites (mission-control, market-research, and any remaining legacy imports) should be updated to import from `@/shared/auth`. At the same time, reconcile the split import surface flagged in impl-review-1: `firebase.ts`'s `auth` export is currently reachable only via the deep path `@/shared/auth/firebase` (the barrel exports only `AuthProvider`/`useAuth`, intentionally per Spec 28 §5), so a consumer needing `auth.currentUser` must discover the deep path. When consolidating, decide whether to surface `auth` through the barrel or document the deep path in a `shared/auth/` README.

**Why we deferred:**
Phase 10 scope was settings + tenant + auth-file relocation only; rewiring all consumers of `jwt.ts`/`useAuth.ts` would pull in mission-control and market-research extraction work that belongs to Phase 11.

**What we lose by staying as-is:**
Auth-related utilities are split across two directories (`src/lib/`, `src/hooks/`, and `src/shared/auth/`), making the auth boundary harder to reason about and increasing the risk of duplicate or diverging auth logic.

**Pull-forward trigger:**
Phase 11 auth-infra consolidation.

**Owner:** TBD.

**Resolved (Phase 11):** 2026-06-05. jwt → src/shared/auth/jwt.ts; useAuth → src/shared/auth/useAuthToken.ts (renamed to resolve the name collision with the Firebase useAuth); both re-exported from shared/auth/index.ts.

---

## TD-FE-57 — Phase 12 features still import legacy `@/hooks/usePageTitle`

**Current state:**
`features/calendar`, `features/reports`, and `features/artifacts` import `usePageTitle` from the legacy `@/hooks/usePageTitle` rather than a `@/shared/hooks` home.

**Why we deferred:**
Spec 14 §4's staging rule — Phase 11 promotes shared hooks; feature phases must not pre-extract shared infra ahead of it.

**Pull-forward trigger:**
Phase 11 (shared-hooks promotion).

**Owner:** TBD.

**Resolved (Phase 11):** 2026-06-05. usePageTitle → src/shared/hooks/usePageTitle.ts; all 6 feature pages repointed.

## TD-FE-62 — `src/utils/leadStreamChatContext.ts` remains in `utils/`

**Date logged:** 2026-06-05
**Origin:** Phase 9 (scout + profiler extraction). `leadStreamChatContext.ts` is scout lead-stream plumbing that may be shared with Strategist; its ownership was not resolved in Phase 9.

**Current state:**
`src/utils/leadStreamChatContext.ts` lives in the legacy `utils/` directory. It is scout lead-stream plumbing and may be consumed by Strategist as well; ownership between `features/market-research/`, `features/signals/`, and `features/strategist/` is unclear.

**What it should be:**
Moved to whichever feature owns lead-stream chat context, or promoted to `src/shared/` if it is genuinely cross-feature. The `utils/` legacy dir is a Phase 11 cleanup target overall.

**Why we deferred:**
Phase 9's authority was the scout/profiler extraction; resolving lead-stream ownership (which touches Strategist) is outside that scope.

**Pull-forward trigger:**
Lead-stream ownership settled (likely Phase 11 shared-utility extraction or a dedicated lead-stream phase).

**Owner:** TBD.

**Resolved (Phase 11):** 2026-06-05. leadStreamChatContext → src/features/market-research/lib/leadStreamChatContext.ts (sole-consumer feature; not shared).

---

## TD-FE-63 — `components/market-research/` retains 6 files after Phase 9's partial drain

**Date logged:** 2026-06-05
**Origin:** Phase 9 (Task 6 — relocate ScoutChatPanel + types). Phase 9 moved `ScoutChatPanel.tsx` and `types.ts` (TD-FE-51 resolved), but 6 files remain in the legacy `components/market-research/` directory because they have cross-feature coupling that Phase 9 did not have authority to resolve.

**Current state:**
`components/market-research/` still contains: `ScoutLeadStream.tsx`, `EditDropdownMenu.tsx`, and the `lead-stream/` sub-folder (`LeadStreamTab.tsx`, `LeadsTable.tsx`, `OpportunityDashboard.tsx`, `leadData.ts`). These files are cross-feature-coupled: `leadData.ts` is consumed by Strategist and `src/lib`; `EditDropdownMenu.tsx` is consumed by `features/customers/`.

**What it should be:**
Lead-stream UI (`ScoutLeadStream.tsx`, `lead-stream/` sub-folder) → `features/customers/` (or a dedicated lead-stream feature). `leadData.ts` → `src/shared/` (consumed cross-feature). `EditDropdownMenu.tsx` → `src/shared/` or `features/customers/`. The legacy `components/market-research/` directory should be fully drained.

**Why we deferred:**
Cross-feature coupling means these moves require coordinating with customers and strategist; that is Phase 11 / a dedicated customers-lead-stream phase territory, not Phase 9's scout+profiler scope.

**Pull-forward trigger:**
A customers/lead-stream phase or Phase 11 shared-utility extraction.

**Owner:** TBD.

**Resolved (Phase 11):** 2026-06-05. components/market-research/ fully drained: leadData → shared/lib; ScoutLeadStream + lead-stream/{LeadStreamTab,LeadsTable,OpportunityDashboard} + the 3 score libs → features/market-research; EditDropdownMenu → features/customers.

---

## TD-FE-11 — Orphaned Settings company-profile fetch after CompanyProfile TanStack migration

**Date logged:** 2026-05-29
**Origin:** Plan 20 Phase 3 (plans/20-frontend-phase-3-api-data-layer.md), Task 9.

**Current state:**
`Settings.tsx` fetches profile data generically via `fetchProfileData(profileType)` (`:105`), called on
profile selection (`:193`) and user change (`:181`), and passes the result to the rendered profile
component via `commonProps.profileData` (`:218,:224`). After Phase 3, `CompanyProfile` reads its data from
`useCompanyProfile` (a TanStack query keyed on `org_id`) and ignores the `profileData` prop, so for the
"company" selection `fetchProfileData("company")` (a `GET /api/profile/company?user_id=…`) still runs but
its result is discarded — a redundant network call. The same generic prop still feeds the non-migrated
`UserProfile`/`AgentProfile`, so `Settings.tsx` is left unchanged.

**Why deferred:**
Removing the company branch / lifting it into the shared query requires `UserProfile` and `AgentProfile` to
also migrate off the shared `profileData` prop — out of Phase 3's stated scope (CompanyProfile/tenant/auth/
Login only). Behavior is correct, only wasteful; at MVP scale (0 users) the cost is negligible.

**Pull-forward trigger:**
Settings extraction (Phase 4), or the phase that migrates `UserProfile`/`AgentProfile` — collapse the
duplicate fetch (Settings `user_id` GET vs CompanyProfile `org_id` GET) into the shared query and drop the
orphaned prop flow then.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** UserProfile + AgentProfile now self-fetch via their own query hooks, so the generic `profileData` prop flow and the orphan `GET /api/profile/company?user_id=…` Settings fetch were dropped — company-profile reads go through `useCompanyProfile` alone. Commit `550ea80`.

---

## TD-FE-12 — Dead TenantContext.availableTenants/setAvailableTenants after TenantSelection migration

**Date logged:** 2026-05-29
**Origin:** Plan 20 Phase 3 (plans/20-frontend-phase-3-api-data-layer.md), Task 11.

**Current state:**
`TenantContext` (`src/shared/tenant/TenantContext.tsx`, relocated from `src/contexts/` in Phase 10) declares `availableTenants: Tenant[]` state and
`setAvailableTenants`, and exposes both on its context value. After Phase 3, `TenantSelection` (the only
reader/writer) renders from the `useTenants` query instead, so neither is populated or read anymore. They
remain assigned into the context value, so there is no lint/knip break — just permanently dead state.

**Why deferred:**
Removing the field from `TenantContextType` + the provider is a context-API change owned by the shell/auth
phases, not Phase 3 (which only migrates the read pattern). Harmless until then.

**Pull-forward trigger:**
Phase 10 (introduces the real tenant endpoint — it will repopulate `availableTenants` from the API or drop
the field) or Phase 4 (shell extraction). Remove the dead field then.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** the dead `availableTenants`/`setAvailableTenants` fields were dropped from `TenantContextType` and the provider value. Commit `3a7fb7c`.

---

## TD-FE-20 — market-research trends/scout-chat tab has no e2e behavioral coverage

**Date logged:** 2026-06-01
**Origin:** Plan 24c Phase 5c (plans/24c-frontend-phase-5c-page-decomposition.md), Task 5 — surfaced during the TrendsTab extraction review.

**Current state:**
`frontend/e2e/journeys/04-market-research-5-components.spec.ts` only `page.goto("/your-ai-team/scout/marketintelligence")` and asserts the 5-component market-intelligence load. It never clicks the `trends` (`chatwithscout`) `TabsTrigger` and never lands on the scout-chat surface, nor the `analysis` (`leadstream`) tab. So `journeys/04` is a behavioral parity guard for the **intelligence** tab only — the `trends` and `analysis` branches have no e2e coverage. This gap **pre-dates Phase 5** (the journey never covered those tabs) and was confirmed non-regressive at the 5c TrendsTab extraction (Task 5 verified by tsc + byte-identical lift + the unchanged controlled `TabsTrigger`). Both the spec-compliance and code-quality reviewers judged it LOW / non-blocking for the structural-only move.

**What it should be:**
A small trends-trigger click-through assertion in `journeys/04` (click the `chatwithscout` tab → assert the Scout-chat surface renders) — and ideally an analysis-tab assertion — closing the parity gap on the two legacy-routing tabs. Adding behavioral e2e is out of structural-only 5c scope; the natural home is Phase 7 (customers/scout claim the lead-stream + scout-chat components and migrate their data layer), or sooner if a trends/analysis regression is suspected.

**Pull-forward trigger:**
Phase 7 (scout-chat / lead-stream migration), or earlier if a trends/analysis-tab regression is suspected. Note: this is advisory per the repo's pre-launch gate posture (advisory-over-hard-fail at 0 users) — not a merge blocker for 5c.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** `journeys/04` now clicks the trends (chatwithscout) and analysis tabs and asserts each surface renders, closing the parity gap on the two legacy-routing tabs. Commit `ae12d04`.

---

## TD-FE-23 — Compliance Analytics cards key on `card.type` but backend emits `chartType`

**Date logged:** 2026-06-02
**Origin:** Plan 24e Phase 5e final holistic impl review — surfaced (not introduced) when `ComplianceVisualCard` was extracted into an isolated, testable unit.

**Current state:**
`ComplianceVisualCard.tsx` (and the original inline code it was lifted from) switches the chart renderer on `card.type` (`"bar-chart"` / `"pie-chart"` / `"line-chart"` / `"timeline"` / `"percentage"`). The live backend (`POST /market-research`, `component_name = "regulatory & compliance highlights"`, confirmed 2026-06-02 against `https://brewra-gtm-intelligence.onrender.com`) returns `visualDataCards[]` whose chart-type field is named **`chartType`**, not `type`. With `card.type === undefined`, every backend card falls through to the `!card.type` icon + the bar-chart-style default render — so the Compliance Analytics section has effectively always rendered its hardcoded default cards rather than the backend's `visualDataCards`. This is **pre-existing** behavior (the container's `visualDataCards = regulatoryData?.visualDataCards || [defaults]` fallback + the `type` switch were byte-identical before 5e); the decomposition only made it visible and unit-testable.

**What it should be:**
Normalize the field in `ComplianceVisualCard` (e.g. `const chartType = card.type ?? card.chartType;` and switch on that), or adapt the shape in `useRegulatoryCompliance` / `regulatoryHelpers` (a `deriveVisualDataCards` mapper). Confirm the exact backend field set first (live `/market-research` call — no auto-generated client per CLAUDE.md). Add a `ComplianceVisualCard` unit test asserting a `chartType`-keyed card renders the right chart once normalized.

**Why we deferred:**
- Out of scope for 5e, whose mandate was a byte-identical structural decomposition (visual parity guarded by behavioral E2E + Vitest, NOT pixel VR) — changing the chart-type resolution would be a behavior change, explicitly disallowed mid-extraction (Plan 24e abort criterion 3).
- It is pre-existing and not a regression; the section renders coherent (default) cards today.

**What we lose by staying as-is:**
- The Compliance Analytics charts show hardcoded defaults instead of the backend's real `visualDataCards`, even when the backend returns populated data.

**Pull-forward trigger:**
- When real `visualDataCards` need to render (pre-launch data-fidelity pass), or the 24i market-research phase-close sweep, or alongside any backend market-research contract typing work.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** `ComplianceVisualCard` now resolves the chart kind from the backend's `chartType` field (live-confirmed) so populated `visualDataCards` render their real charts instead of the hardcoded defaults. Commit `3787f87`.

---

## TD-FE-24 — Regulatory default data duplicated across ~5 sites

**Date logged:** 2026-06-02
**Origin:** Plan 24e Phase 5e impl review round 1 (`docs/reviews/phase-5e-regulatory-compliance-impl-review-1.md`, finding #1) + synthesis round 1.

**Current state:**
The hardcoded fallback datasets in the regulatory feature are copy-pasted verbatim across multiple code sites:
- Default **regional data** (EU/US/China/UK rows) and default **visual data cards** (Compliance Adoption Rates / Regulatory Timeline / Risk Indicators) appear in `RegulatoryComplianceSection.tsx` in three places — the render-time `regionalData`/`visualDataCards = regulatoryData?.* || [defaults]` derivations, inside `handleModify`, and inside the init `useEffect`.
- Default **strategic recommendations** lists are hardcoded in `StrategicRecommendationsSection.tsx` non-editing fallbacks (the three `mitigateRegulatoryRisks`/`competitivePositioning`/`goToMarketStrategy` `<li>` blocks).
A default change must be made in 3–5 places simultaneously. This is **pre-existing** (byte-identical to the `master` monolith) and was an explicit Plan 24e Task 2 scope decision (the plan considered lifting `deriveVisualDataCards`/`deriveRegionalData` into `regulatoryHelpers.ts` and declined, to keep the decomposition a pure structural move).

**What it should be:**
A single source for the defaults — a `regulatoryDefaults.ts` constants module (or `deriveVisualDataCards`/`deriveRegionalData`/`deriveStrategicRecommendations` in `regulatoryHelpers.ts`) consumed by every fallback site, with unit tests asserting the default shape.

**Why we deferred:**
- Pre-existing duplication, not introduced by 5e; consolidating it would be a behavior-touching change beyond 5e's byte-identical decomposition mandate (abort criterion 3).
- Plan 24e Task 2 deliberately scoped it out.

**What we lose by staying as-is:**
- A maintenance trap: editing one default and missing the other 2–4 copies yields inconsistent fallbacks across edit/non-edit/init paths.

**Pull-forward trigger:**
- A defaults-consolidation follow-up, or the 24i market-research phase-close sweep, or whenever a regulatory default actually needs to change.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** the duplicated regional-data / visual-data-cards / strategic-recommendations defaults were deduped into one module consumed by every fallback site. Commit `c715339`.

---

## TD-FE-25 — Read-only Strategic Recommendations ignores `localStrategicRecommendations` (state-coherence quirk)

**Date logged:** 2026-06-02
**Origin:** Plan 24e Phase 5e impl review round 1 (finding #2) + synthesis round 1.

**Current state:**
`StrategicRecommendationsSection.tsx` renders the three recommendation lists from `regulatoryData?.strategicRecommendations?.{mitigateRegulatoryRisks,competitivePositioning,goToMarketStrategy}` (or hardcoded fallbacks) in **non-editing** mode, and from `localStrategicRecommendations` only in **editing** mode. After a user edits the recommendations and exits edit mode, the read-only view can revert to the API/default data, visually discarding the local edits. This is **pre-existing** and byte-identical to the `master` monolith (verified: read-only read `regulatoryData?.strategicRecommendations?.X` at 3 sites; `localStrategicRecommendations` used only in the edit path). It is also **inconsistent** with `ExecutiveSummarySection`, which correctly falls back through `currentExecutiveSummary = localExecutiveSummary || regulatoryData?.executiveSummary || executiveSummary` in both modes.

**Open question (resolve before fixing):** unlike the five editable string fields (which each have an `on*Change` parent callback), `localStrategicRecommendations` appears to have **no parent-bound change callback**, so strategic edits may never round-trip to the parent/API even via `handleRegulatoryComplianceSaveChanges`. This determines whether the correct fix is "read `localStrategicRecommendations` first in the read-only path" or "wire a persist callback so edits survive a real save+refetch" (or both).

**What it should be:**
Align the read-only fallback chain with `ExecutiveSummarySection` (`local* || regulatoryData?.* || defaults`), and/or wire strategic-recommendation edits to a parent callback so they persist.

**Why we deferred:**
- Pre-existing behavior; changing the read-only data source is a behavior change disallowed mid-decomposition (Plan 24e abort criterion 3 / byte-identical mandate).

**What we lose by staying as-is:**
- Edited strategic recommendations can silently disappear from the read-only view after save; the section behaves inconsistently with the sibling Executive Summary section.

**Pull-forward trigger:**
- Pre-launch data-fidelity pass (alongside TD-FE-23's `visualDataCards`/`chartType` gap — same theme), or the 24i sweep.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** the read-only Strategic Recommendations view now reads `localStrategicRecommendations` first (local → regulatoryData → defaults), matching `ExecutiveSummarySection`, so local edits survive exiting edit mode. Commit `0c41347`.

---

## TD-FE-26 — Dead non-user-scoped `localStorage` writes in RegulatoryComplianceSection

**Date logged:** 2026-06-02
**Origin:** Plan 24e Phase 5e impl review round 1 (finding #4) + synthesis round 1.

**Current state:**
The container runs five effects writing `localStorage.setItem("regulatory_executiveSummary"/"regulatory_euAiActDeadline"/…, value)` — **non-user-scoped** raw keys. But the `useState` initializers read these values via `getUserLocalStorage("regulatory_executiveSummary", currentUser?.uid)` — **user-scoped** keys (a different keyspace). The raw writes can therefore never be read back; they write to dead keys. (The JSON-blob writes for the Scout API at save time correctly use `setUserLocalStorage(..., currentUser?.uid)`.) This is **pre-existing** (5 occurrences on `master`), carried forward byte-identically by 5e.

**What it should be:**
Either route the five write effects through `setUserLocalStorage(key, value, currentUser?.uid)` (so they share the keyspace the initializers read), or delete them if the cache-rehydrate-on-mount behavior isn't wanted. Removing them is behavior-neutral (they're already dead).

**Why we deferred:**
- Pre-existing dead writes, not introduced by 5e; 5e carried the effects forward unchanged as part of the byte-identical decomposition.

**What we lose by staying as-is:**
- Misleading code (five effects that look like they persist editable fields but write to keys nothing reads); minor wasted writes on every edit keystroke.

**Pull-forward trigger:**
- A localStorage/caching cleanup pass or the 24i market-research phase-close sweep.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** the regulatory write effects were scoped through `setUserLocalStorage(..., currentUser?.uid)` to share the initializers' keyspace, and the dead non-user-scoped `_json` writes were dropped. Commit `b48844a`.

---

## TD-FE-29 — Full preflight gate stays serial; parallel runner is opt-in (flakes e2e under concurrent-session load)

**Date logged:** 2026-06-02
**Origin:** Preflight perf items 4–5 (follow-on to the merged perf quick-wins). `frontend/scripts/preflight.mjs` parallelizes the gate but is wired as `npm run preflight:par` (opt-in), NOT the default `npm run preflight`.

**Current state:**
Three commands: `npm run preflight` = serial `&&` chain (the merge gate); `npm run verify` = typecheck+lint+test (the fast inner loop); `npm run preflight:par` = full gate parallelized via `scripts/preflight.mjs` (dependency-aware build→bundle/e2e, bounded by `PREFLIGHT_JOBS`, fail-fast). Parallel is opt-in by measurement: it runs build + vitest (4 workers) + e2e + lint concurrently, and stacked on a second worktree's preflight it pushed box load to ~20/23 cores — inflating every task 3–4× and **flaking the e2e visual snapshot** (`02-post-login-state.png`: 86% pixel diff + render timeout), a false failure that would block a merge. In the same back-to-back run the SERIAL gate passed e2e 14/14 at load ~8, isolating the cause to the parallel load-spike, not a regression. Parallel-full only wins on an idle box (~1.5–2×).

**Why we deferred (serial stays the default gate):**
- The team runs concurrent worktree sessions; a gate that's fast solo but flaky-under-concurrency is a net loss — a false e2e failure costs more (a wasted full re-run + investigation) than the serial gate's extra minutes.
- Hardening the VR e2e against contention is its own focused change, separate from the gate-structure work.

**What it should be / pull-forward trigger:**
- Make the VR e2e contention-robust — Playwright retries on the VR specs, a higher `toHaveScreenshot` stabilization timeout, a lower default `PREFLIGHT_JOBS`, or scheduling e2e in its own non-concurrent wave so it never renders under a CPU spike — then flip `preflight` → `preflight:par`. Trigger: the serial merge-gate wall-clock becomes a real bottleneck, or concurrent-worktree development ends (single-session steady state).

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** the VR e2e was hardened against contention (Playwright retries on the VR specs + a higher `toHaveScreenshot` stabilization timeout), closing the flake this entry tracked. Commit `5011f96`. (The `preflight` → `preflight:par` default flip remains a separate judgment call; the contention-robustness this entry was gated on is done.)

---

## TD-FE-42 — Customers `/icp` + `customer_profile` read overlaps mission-control `useICPs`; two independent read paths with nothing to catch a divergent `/api/icp` shape change

**Date logged:** 2026-06-04
**Origin:** Phase 7 (Tasks 5–7). The customers feature introduced its own `/icp` and `customer_profile` read service + hooks alongside the mission-control `useICPs` hook, which also reads `/api/icp`. No shared contract layer exists to catch a divergent backend shape change.

**Current state:**
`services/customers.ts` + `useCustomerProfile` + `useSuggestedIcps` form one read path for `/icp` and `customer_profile`. `useICPs` in mission-control is a second independent read path for `/api/icp`. Both use the same endpoint but define their own zod schemas independently; a shape change in the backend breaks one without necessarily surfacing in the other's types.

**What it should be:**
A single canonical zod schema + service function for `/api/icp` shared by both consumers, so a shape change is caught at one definition site and propagates to all callers.

**Why we deferred:**
Consolidation would require touching mission-control during a customers-scoped extraction phase — out of scope for Phase 7. Pre-launch velocity posture.

**What we lose by staying as-is:**
Silent divergence risk: a `/api/icp` response shape change may break one consumer but not the other's TypeScript, delaying detection until runtime.

**Pull-forward trigger:**
Phase 9 consolidation / Phase 13.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** a real zod schema was added at the shared ICP read boundary (`fetchIcpsRowsForOrg`), giving the `/api/icp` read one validated definition site so a divergent shape is caught once. Commit `6ba7101`.

---

## TD-FE-50 — `signalsChatContext` sessionStorage handoff is untyped

**Date logged:** 2026-06-05
**Origin:** Phase 8 (signals relocation). The signals → scout/profiler chat handoff writes `sessionStorage.setItem("signalsChatContext", JSON.stringify(...))` with no shared type contract.

**Current state:**
The signals-to-chat handoff serialises an untyped payload via `sessionStorage.setItem("signalsChatContext", JSON.stringify(...))`; the consuming chat surface reads and parses it with no shared TypeScript type describing the shape.

**What it should be:**
A shared, typed contract for the `signalsChatContext` payload (a named interface/type imported by both the producer and consumer), so the handoff shape is statically checkable.

**Why we deferred:**
The untyped handoff works at MVP scale; introducing the shared contract is best done alongside the chat-surface work where both ends are touched.

**Pull-forward trigger:**
When the signals→chat handoff is given a typed contract (deferred beyond Phase 9; Phase 9 chose not to type it to stay behavior-preserving).

**Note:** Phase 9 deliberately did not add the typed contract — the shared-chat dedup was behavior-preserving and typing the handoff is a contract addition beyond that scope.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** the session handoff was given a shared typed contract imported by both producer and consumer, landed in the same commit that renamed `SignalsChatContext` → `ChatContext`. Commit `76bf000`.

---

## TD-FE-52 — No strategist Playwright/VR journey; coverage is behavioral-only

**Date logged:** 2026-06-05
**Origin:** Phase 8 (strategist relocation). Strategist shipped with Vitest render tests only; no Playwright journey or visual-regression baseline was added (Spec 27 §8 gap).

**Current state:**
Strategist coverage is behavioral-only (Vitest render tests). The workspace is visually rich — a two-panel dashboard plus chat plus a sequence timeline — and has no Playwright end-to-end journey and no pixel/VR baseline.

**What it should be:**
A strategist Playwright journey and a visual-regression baseline covering the two-panel workspace, chat, and sequence timeline, so visual regressions are caught.

**Why we deferred:**
Behavioral-only coverage is the accepted pre-launch advisory-gate default; pixel/VR baselines are added when a surface churns visually or during a dedicated pre-launch VR sweep.

**Pull-forward trigger:**
Strategist visual churn or a pre-launch VR sweep.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** a strategist workspace Playwright journey + VR baseline were added (two-panel workspace, chat, sequence timeline). Commit `339e5e9`.

---

## TD-FE-56 — `features/settings/components/AgentProfile.tsx` and `features/scout/components/ScoutDeployment.tsx` are near-duplicate forms

**Date logged:** 2026-06-05
**Origin:** Phase 10 (Task 5). `AgentProfile.tsx` was relocated into `features/settings/components/` during Phase 10; `ScoutDeployment.tsx` remains in the legacy `src/components/settings/` location. Both render agent/deployment configuration forms with substantial structural overlap but no shared base component.

**Current state:**
`src/features/settings/components/AgentProfile.tsx` and `src/features/scout/components/ScoutDeployment.tsx` are near-duplicate form components. They share field layout, save/cancel patterns, and profile-data binding logic but are maintained as independent files with no shared abstraction. (Phase 9 relocated `ScoutDeployment.tsx` from `src/components/settings/` into `features/scout/components/`; the forms are still not unified.)

**What it should be:**
Phase 9 relocated `ScoutDeployment.tsx` into `features/scout/components/` (the relocation half of this item is **done**). The two components should now be evaluated for unification into a single parameterised form component (or a shared form primitive), eliminating the remaining duplication.

**Why we deferred:**
Deduplication requires Phase 9's scout extraction to be complete so the correct home for the unified component is clear. Merging them before Phase 9 would land the result in the wrong directory.

**What we lose by staying as-is:**
Fixes or UI changes to one form must be manually mirrored to the other. Divergence risk grows with every modification.

**Pull-forward trigger:**
Phase 9 relocated the form into `features/scout/` (done); the remaining trigger is a settings/scout form-unification pass.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** `AgentProfile` and `ScoutDeployment` were unified onto a shared `AgentConfigForm`, eliminating the near-duplicate form. Commit `779d180`.

---

## TD-FE-61 — `SignalsChatContext` type name retained after component renamed to `ContextChat`

**Date logged:** 2026-06-05
**Origin:** Phase 9 (Task 1 — rename `SignalsContextChat` → `ContextChat`). The component was renamed but the context-shape type was deliberately left as `SignalsChatContext` to avoid a wide consumer churn.

**Current state:**
`src/shared/chat/ContextChat.tsx` exports the component as `ContextChat` and the context-shape type as `SignalsChatContext`. The type name reflects the old component name and carries a "Signals" prefix that no longer matches the generic shared substrate.

**What it should be:**
The type should be renamed to `ChatContext` (or similar) so the exported type name matches the component name and the generic-substrate framing.

**Why we deferred:**
Renaming the type requires touching all consumers (`SignalsChatContext` is the prop type at every `ContextChat` call site + the `signalsChatContext` sessionStorage key). Phase 9 chose not to widen scope beyond behavior-preserving moves.

**Pull-forward trigger:**
Next time `src/shared/chat` types are touched (e.g. when typing the `signalsChatContext` sessionStorage handoff — TD-FE-50).

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** the context-shape type was renamed `SignalsChatContext` → `ChatContext` across all consumers, landed in the same commit that typed the session handoff (TD-FE-50). Commit `76bf000`.

---

## TD-FE-64 — CSV smart-quote normalization is a no-op (`normalizeCsvAsciiDoubleQuotes`)

**Date logged:** 2026-06-06
**Origin:** Discovered during the Phase 13b seam-test pass (extraction of `csvHelpers.ts` from `DataSourcesManager`). Pre-existing — the code was moved verbatim; the bug predates Phase 13.

**Current state:**
`frontend/src/features/mission-control/components/data-sources/csvHelpers.ts` (the `normalizeCsvAsciiDoubleQuotes` helper, ~line 11) replaces curly/smart double-quotes with the codepoint U+201D (RIGHT DOUBLE QUOTATION MARK) instead of the ASCII straight double-quote U+0022. The function's own docstring states the intent is to convert curly quotes to ASCII `"` so RFC-4180 quote handling works. Because the replacement target is itself a curly quote, the normalization is effectively a no-op: downstream delimiter detection and quoted-field splitting (which look for U+0022) never see a straight quote, so CSVs containing curly quotes (e.g. Excel/Word exports) can have multiline quoted fields fail to merge and column counts break.

**Why deferred:**
Phase 13b is behavior-preserving structural decomposition only (Spec 32 §5.2). Fixing this is a logic change that alters CSV-parsing behavior and warrants its own deliberate change + validation, not a slip-in during a structural split. The decomposition preserved the (buggy) behavior exactly.

**Fix:**
Change the replacement string in `csvHelpers.ts` from the U+201D character to an ASCII U+0022 `"`; then un-skip the two documenting tests in `__tests__/csvHelpers.test.ts` (added in Phase 13b, commit `0e8ffec`) that already assert the corrected behavior.

**Pull-forward trigger:**
A CSV-import correctness pass, or any report of curly-quoted CSV fields mis-parsing on upload.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** the replacement target was corrected to the ASCII straight quote (U+0022) so curly-quoted CSV fields normalize and parse, and the two documenting tests were un-skipped. Commit `6c66263`.

---

## TD-FE-66 — useDocumentSync cleanup (pre-existing patterns relocated in Phase 13b)

**Date logged:** 2026-06-07
**Origin:** impl-review-2 of Phase 13 (docs/reviews/phase-13-loc-reduction-pass-2-impl-review-2.md + synthesis-2). Pre-existing code relocated verbatim during the 13b DataSourcesManager decomposition; deferred because fixing it is a logic change, out of scope for behavior-preserving decomposition.

**Current state (`frontend/src/features/mission-control/components/data-sources/useDocumentSync.ts`):**
1. `checkProcessingFilesStatus` wraps its body in `setDataSources((cur) => {...})` purely to READ current state, returns `cur` unchanged (forcing an unnecessary re-render), and fires `forEach` + `void (async () => ...)` `checkDocumentStatus` calls with NO concurrency control — N concurrent status checks can race on `setDataSources`. The idiomatic fix is a ref/query-cache read + a concurrency guard.
2. `_isSaving` (~line 48): `const [_isSaving, setIsSaving] = useState(false)` — the value is never read anywhere in the tree (only `setIsSaving` is called by the parent's `handleSaveSource`); the isSaving mechanism is dead state.
3. Debug `console.log` density in this module (~18 calls) — kept verbatim (removing them is a behavior change; thin them in a logging-audit pass).

**Why deferred:** Phase 13 decomposition was behavior-preserving only (Spec 32 §5.2); all three are pre-existing and relocating them verbatim was correct. The hook boundary is now the natural fix site.

**Pull-forward trigger:** the next change that touches `useDocumentSync` (e.g. a data-source processing-status bug, or a render-perf pass), or a TD-FE-19/21 data-layer pass.

**Resolved (Phase 37, 2026-06-16):** concurrent document-status checks are now guarded by a ref-held in-flight set (replacing the read-only `setDataSources` wrapper), and the dead `_isSaving` state + debug logs were removed. Commits `0cc24fc` (in-flight guard) and `abb1dce` (dead `_isSaving` + logs).

---

## TD-FE-67 — single-page v2 reads still cap items at 500; `total` not surfaced

**Date logged:** 2026-06-08
**Origin:** Spec 34 (frontend v1→v2 API migration). The three migrated reads
(`fetchDataSources`, `fetchSignals`, `fetchSuggestedIcps`) request a single page
(`limit=500`/`10`, `offset=0`) and consume only `items`.

**Current state:** items are still capped at the page `limit`; `total` is present
on the v2 wire but is not extracted, typed, or rendered (no consumer renders a
count). The v1 `count` lie is gone (the FE no longer reads it), but the >500
truncation is exposed-not-eliminated.

**What it should be:** when a count display or a list exceeding 500 rows is
needed, widen the service return types to carry `total` and add either fetch-all
looping or real pagination UX (page controls / infinite scroll), keyed on the
v2 `limit`/`offset`.

**Why deferred:** 0 users; nothing renders a count today; threading an unused
`total` would either break the bare-array consumer or add untyped dead surface
(Spec 34 §2, review synthesis round 1).

**Pull-forward trigger:** a count needs rendering, or an org approaches 500
documents / signals / ICPs.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** the v2 reads now type and surface the paginated `total` from the envelope, so a count is available to consumers without the bare-array break. Commit `fd1239f`.

---

## TD-FE-70 — customers Lead Stream is first-page-only (no pager)

**Date logged:** 2026-06-15
**Origin:** Plan 36 Task 16 (`useLeads` / `fetchLeads`) + spec 36 §5.7-A2.

**Current state:** `useLeads` calls `fetchLeads` which calls `GET /api/v2/leads`
with `firstPageParams(50)` (`limit=50, offset=0`) and renders a flat list in
`LeadStream.tsx`. There is no "load more" button, infinite scroll, or page
controls. Matches the sibling `LeadsTable` single-fetch pattern (market-research).

**What it should be:** paginated / "load more" per spec §5.7-A2. The v2 endpoint
already accepts `limit` and `offset`; the `PaginatedResponse` envelope carries
`total`. A "load more" affordance would fetch the next page and append to the
list.

**Why deferred:** 0 users; no org is near 50 leads; adding pagination UX would be
disproportionate to current scale and out of plan 36 scope.

**Pull-forward trigger:** an org's lead count approaches or exceeds 50, or real
users land and the truncated list is noticed.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** the Lead Stream now paginates with a load-more affordance that fetches the next v2 page (`limit`/`offset`) and appends. Commit `1e85640`.

---

## TD-FE-71 — signal↔lead map prompt matches on data the payload doesn't send

**Date logged:** 2026-06-15
**Origin:** Plan 36 (signal↔lead relevance mapping). Impl-review round 1,
finding 1. Ref: `docs/reviews/phase-36-signal-lead-mapping-impl-synthesis-1.md`.

**Current state:** `_signals_for_prompt` in
`backend/app/services/signals/lead_map.py` serializes only `{signal_id,
headline}` per signal, but the `signals_lead_map.md.j2` MATCHING RULES instruct
the model to match on "an explicit company mention in the signal" — those
mentions live in the signal's `description`/`snippet`/`sourceLabel`, none of
which are sent. The model is therefore restricted to headline-only matching;
prompt and payload disagree. No error and id hygiene is unaffected (invented ids
are still dropped) — a recall-quality gap, not a defect.

**What it should be:** prompt and payload agree — either narrow the MATCHING
RULES to headline-only (a 1-line prompt edit) or extend `_signals_for_prompt` to
include a trimmed `snippet`/`description` slice so company mentions are actually
available to match on.

**Why deferred:** 0 users; the MVP Business State explicitly waives
relevance-quality SLAs; and signal headlines routinely carry the company name,
so headline matching already partially satisfies the rule. Tuning recall before
there is real signal/lead data to measure against is premature.

**Pull-forward trigger:** the first relevance-quality tuning pass against real
signals + leads, or a report that the mapping misses obvious company matches.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** the `signals_lead_map.md.j2` MATCHING RULES were narrowed to the headline actually sent in the payload, so prompt and payload agree. Commit `e94cfca`.

---

## TD-FE-72 — signal↔lead map `refresh` escape hatch is unreachable from the UI

**Date logged:** 2026-06-15
**Origin:** Plan 36 (signal↔lead relevance mapping). Impl-review round 1, finding
2 (refresh half); spec 36 §5.4. Ref:
`docs/reviews/phase-36-signal-lead-mapping-impl-synthesis-1.md`.

**Current state:** `useSignalLeadMap` calls `fetchSignalLeadMap(userId, orgId)`
with no opts, so the request always sends `refresh: false`, and no UI surfaces a
recompute action. The backend `refresh=true` path (force a recompute past the
per-(org, user) fingerprint cache) is therefore inert end-to-end. A cached
mapping — including a structurally-truncated partial recovered by
`_recover_mapping_entries` — is served on every fingerprint hit and cannot be
busted from the FE until the org's signal/lead id-set changes (edits to lead
fields, with no id change, also do not bust it).

**What it should be:** a recompute/refresh affordance on a surface that shows the
mapping, calling `fetchSignalLeadMap(userId, orgId, { refresh: true })`, per spec
36 §5.4's escape-hatch intent.

**Why deferred:** 0 users; a mapping that is stale until the id-set changes is
low-impact at MVP; a refresh control is a FE feature beyond plan 36's mapping
scope. (Caching the recovered partial is itself intentional degrade-gracefully
behavior — see the synthesis; the gap is the missing FE recompute, not the
cache.)

**Pull-forward trigger:** the first real org reports a stale or low-quality
mapping that will not self-correct, or the mapping surfaces are prioritised for a
demo.

**Owner:** TBD.

**Resolved (Phase 37, 2026-06-16):** a recompute control was added that calls `fetchSignalLeadMap(..., { refresh: true })` to bust the per-(org, user) fingerprint cache. Commit `00c2021`. Operational caveat: code-complete but dormant in prod until `/signal-lead-map_claude` deploys (same gate as TD-FE-73).

---
