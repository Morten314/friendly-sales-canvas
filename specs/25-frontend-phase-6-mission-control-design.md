# Spec 25 — Frontend Phase 6: mission-control feature extraction

**Status:** Design — reconciled with plan-writing recon 2026-06-03 (review rounds 1–2 synthesized; see `docs/reviews/25-frontend-phase-6-mission-control-design-spec-synthesis-1.md`, `…-synthesis-2.md`)
**Date:** 2026-06-03
**Type:** Phase spec (Phase 6 of master Spec 14 §4)
**Paired plan:** `plans/25-frontend-phase-6-mission-control.md` — **written**; **one plan, executed sequentially** (see §7). Facts verified during plan-writing are folded back into this spec (data-source endpoint, lint starting state, read-hook typing, the two `DataSource` shapes) — flagged _(reconciled)_ inline.

---

## §1 Goal and context

### 1.1 Goal

Extract the **mission-control** surface (`src/pages/MissionControl.tsx` + `src/components/mission-control/*`) into `src/features/mission-control/`, mirroring the market-research extraction (Phase 5, Spec 24). The phase decomposes three monster files, migrates their **read** paths to TanStack Query, wraps the feature in an error boundary, sweeps dead code, and lands the cross-feature enabling infra (route registry + the deferred `index.ts`-only lint) that the rest of the 6–12 stretch depends on.

This phase ships as **one spec → one plan → one branch (`phase-6-mission-control`) → one `--no-ff` merge**. The stages in §7 are sequential **green checkpoints** inside the single plan (Spec 14 §5.7), not separately-merged sub-phases.

### 1.2 Starting state (measured 2026-06-03)

| File | LOC | Role |
|---|---:|---|
| `src/pages/MissionControl.tsx` | 4,371 | page shell; 3 tabs (`profile` / `customer-profile` / `sources`); company-profile form; connector-approval workflows |
| `src/components/mission-control/DataSourcesManager.tsx` | 3,941 | lead/data-source uploads, lead-stream status polling, source CRUD |
| `src/components/mission-control/ICPManager.tsx` | 3,320 | ICP CRUD + profiler-accepted-ICP merge |
| **Total** | **11,632** | no sub-components; both managers are monolithic leaf components |

Salient facts that shape this spec:

- **Route:** `/mission-control`, wrapped in `<ProtectedRoute requireTenant>`. Tabs switch via `?tab=` URL param. **Not** wrapped in `<FeatureErrorBoundary>` (market-research is — this phase adds it).
- **No cascade.** Unlike market-research's sequential `previousContext` chain, mission-control's fetches are **independent** (company profile, ICPs, data-sources/lead-stream status). This is the key simplifier: there is no cascade root to hollow, so the read-path migration is clean.
- **Data layer:** 19 active raw `fetch()` sites (2 more sit in ICPManager's commented dead code, removed in stage 2), **zero** TanStack. `localStorage company_profile_{uid}` is a failover store (read+write across MissionControl + DataSourcesManager); `sessionStorage slackSourceToConnect` is a Slack-OAuth bridge. No `CACHE_DURATION`/`_cb`/`_r` cache-busting. Reads (endpoints resolved at plan-writing): ICP rows via `GET /api/profile/company` → `GET /api/customer_profile`; data-source list `GET /api/user-documents`; lead-stream status `GET /api/leads/stream/status`; company profile `GET /api/profile/company`.
- **Dead code:** ICPManager carries ~1,500–1,600 lines of commented-out legacy (≈1,569 comment lines of 3,320; an old localStorage-era component shadow).
- **Profiler coupling:** ICPManager merges profiler-accepted ICP metadata via a cluster of three utils — `@/utils/profilerAcceptedIcpDisplay.ts`, `@/utils/profileIcpsExtract.ts`, `@/lib/missionProfilerSessionCache.ts` — **all three** of which `customers/SuggestedICPCards` also imports (verified: lines 74, 60/`fetchIcpsRowsForOrg`, 56). That cluster + the ICP read surface are what Phase 7 (customers) and Phase 9 (scout + profiler) inherit.
- **Escape-hatches in play:** `UntypedBackendApiResponse` (MissionControl), `UntypedProfilerIcpRecord` (ICPManager), `UntypedBackendDocument` (DataSourcesManager).
- **Parity net (strong, unlike Phase 5):** behavioral E2E covers all three monsters — journey `01-login-tenant-mission` (page load, with VR snapshot `04-mission-control-loaded`), `02-csv-upload-leads` (DataSourcesManager), `05-icp-create` (ICPManager, with VR snapshot `01-mission-control-empty-icp`).
- **Existing reusable hook:** `useCompanyProfile(orgId)` (TanStack, Phase 3) at `src/components/settings/useCompanyProfile.ts`, currently consumed only by settings.
- **Enabling-infra starting state _(reconciled at plan-writing)_:** routing is fully centralized in `src/App.tsx` (one `<Routes>` table) — there is **no `src/app/` dir and no per-feature `routes.tsx` yet**; market-research's route is wired via a deep page import. The `index.ts`-only cross-feature lint is **not implemented** — only `no-restricted-paths` zones + `no-cycle` exist in `eslint.config.js` (`eslint-plugin-import-x` ~4.15 is installed); `src/features/README.md` documents the deep-import ban but lint does not enforce it. So stage 1 **adds** the registry and the lint from scratch.

### 1.3 Relation to the master plan

Implements master Spec 14 §4 "Phase 6 — Feature: mission-control" and its "First enabling task" subsection (route registry + TD-FE-15 lint, added 2026-06-03). Hard dependencies per Spec 14 §4: Phase 5 + foundation only (both done). Phase 7 (customers) consumes this feature's `index.ts`; Phase 9 (scout + profiler) reads the Profiler-disposition section (§6).

---

## §2 Scope

### 2.1 In scope

- Cross-feature **enabling infra**: per-feature route registry (`src/app/routes.tsx`, **created this phase**, append-only) + **add** the `index.ts`-only cross-feature lint (`import-x/no-internal-modules`, forbid-form — it does not exist yet; only `no-restricted-paths` + `no-cycle` do) — resolves **TD-FE-15**. The forbid globs (`@/features/*/*`, `@/features/*/**`) also match same-feature alias deep imports, so intra-feature imports adopt a **relative-path convention** (the `@/features/<X>/…` alias is reserved for cross-feature, index-only); market-research's existing alias self-imports are converted to relative as part of stage 1.
- Scaffold `src/features/mission-control/` and relocate the three files into it (parity move).
- Wrap the routed page in `<FeatureErrorBoundary>`.
- Delete ICPManager's ~1,500–1,600 lines of commented-dead code.
- Promote the three shared profiler-ICP utils (`profilerAcceptedIcpDisplay.ts`, `profileIcpsExtract.ts`, `missionProfilerSessionCache.ts`) → `src/shared/profiler/` (a new subdir + barrel) — all three are imported by both mission-control and `customers/SuggestedICPCards`.
- **Read-path** TanStack migration: ICP list, data-sources + lead-stream status, company-profile (via reuse — §4).
- Structural decomposition of all three monsters into single-purpose components + hooks.
- `index.ts` public surface, `README.md`, and the Profiler-disposition section (§6).

### 2.2 Out of scope (deferred to TD-FE, allocated at the finalize stage)

- **Write/mutation paths** — ICP CRUD, data-source CRUD, company-profile save, connector approve/deny remain raw `fetch`. Migrated in a later mutation pass — the TD-FE entry (allocated at finalize) records the candidate phase; Spec 14 §4 has no dedicated mutation phase (Phase 13 is LOC reduction), so the trigger is whichever of a Phase 7 ICP-write migration or Phase 13 reaches it first. Mirrors TD-FE-21/27/31.
- **`localStorage company_profile_{uid}` failover** and the **`sessionStorage slackSourceToConnect`** OAuth bridge — retained as-is.
- **`useCompanyProfile` promotion** to `src/shared/api` — deferred to Phase 10 (settings extraction) / Phase 11.
- **DataSourcesManager upload helpers** shared extraction — deferred to Phase 11.
- **Profiler final resolution** (scout/profiler split, `ProfilerChatWithHistory` dedup) — Phase 9, per the Profiler-disposition section.
- **Escape-hatch retyping** (`Untyped*` → real contract types) — Phase 13 (carries TD-FE-9/10 posture).

### 2.3 Frozen interfaces (must stay green every stage)

- Route URL `/mission-control` and its `requireTenant` guard; the `?tab=` param behavior.
- The backend HTTP contract (no backend changes).
- Behavioral journeys `01`, `02`, `05` and their VR snapshots; the global 2% `maxDiffPixelRatio`.
- Auth/tenant flow.

---

## §3 Architecture target

```
src/features/mission-control/
├── pages/
│   └── MissionControlPage.tsx          # thin shell + 3-tab router (profile / customer-profile / sources)
├── components/
│   ├── company-profile/                # company-profile form + connector-approval cluster (ex-MissionControl.tsx)
│   ├── data-sources/                   # uploader, lead-stream table, generic source form (ex-DataSourcesManager)
│   └── icp/                            # ICP list/filter, add-edit wizard, profiler-merge view (ex-ICPManager)
├── hooks/                              # feature read-path hooks (useICPs, useDataSources, useLeadStreamStatus)
├── services/                          # API call layer (read endpoints; follows Phase 5 convention)
├── contracts.ts                       # zod schemas for the read envelopes
├── types.ts                           # feature-local types (DataSource, ICP, ConnectorApproval, …)
├── index.ts                           # public surface — Phase 7 consumes this
└── README.md
```

Tests live in co-located `__tests__/` dirs per the Phase 5 convention (e.g. `hooks/__tests__/`, `services/__tests__/`, `components/<area>/__tests__/`, plus a feature-root `__tests__/`).

**Dependency rules (Spec 14 §3.3):** may import `@/features/mission-control/*` (self), `@/shared/*`, `@/components/ui/*`, npm; transitionally (Phases 4b–12) the legacy dirs (`@/hooks`, `@/lib`, `@/utils`, `@/components/settings/*`, …). Cross-feature consumers import only via `@/features/mission-control` (the index). The reuse of `useCompanyProfile` from `components/settings/` is a **legacy-dir** import (settings is not yet a feature), permitted by the transitional exception. Per the new relative-self-import convention (§2.1), the feature's own internals are imported with relative paths, not the `@/features/mission-control/…` alias.

**Two `DataSource` shapes _(reconciled at plan-writing)_:** the feature `types.ts` `DataSource` is the **read-list** shape (from `GET /api/user-documents`, used by the data-sources tab). `MissionControl.tsx` separately uses a **richer** `DataSource` shape for the connector catalog (icon/platform/syncFrequency/…); the two are **not** unified this phase — the connector/write surface is deferred. Also: the company-profile "form" is **inline JSX** in `MissionControl.tsx` (~250 lines), not a pre-existing component — extracting it (stage 4) is the heaviest single carve, and only its **read** migrates to `useCompanyProfile` (`handleSave` stays raw).

---

## §4 Data layer (read → TanStack; writes deferred)

### 4.1 Reads migrated this phase

| Read | Endpoint (confirm live before wiring) | Hook |
|---|---|---|
| ICP list | `GET /api/profile/company?org_id=…` → `GET /api/customer_profile?org_id=…` (the two reads inside the shared `fetchIcpsRowsForOrg`) | `useICPs` — **reuses `fetchIcpsRowsForOrg` from `@/shared/profiler`** (parity with the customers consumer), not a fresh feature fetch |
| Lead-stream file status | `GET /api/leads/stream/status` | `useLeadStreamStatus` (feature-local; `apiGet` + loose zod) |
| Data-source list | `GET /api/user-documents?org_id=…` _(resolved at plan-writing; was unnamed)_ | `useDataSources` (feature-local; `apiGet` + loose zod) |
| Company profile | `GET /api/profile/company?org_id=…` | **reuse `useCompanyProfile`** (see 4.3) |

Endpoint paths above carry the `/api` Vite-proxy prefix (`vite.config.ts`). _(Reconciled:)_ the ICP and company-profile reads hardcode the literal `/api/…` string, while the data-source-list and lead-stream reads go through `buildApiUrl(...)` (prepends `/api` in dev/Vercel, raw Render URL in prod) — `useDataSources`/`useLeadStreamStatus` instead call the shared `apiGet`, which the proxy resolves the same way. Hooks are built **before** the components that consume them are decomposed (Spec 14 R3, hook-first). zod schemas land in `contracts.ts`; `.parse` at the fetch boundary. Per CLAUDE.md polyglot rule, confirm each response shape against a live backend call before writing FE types (no auto-generated client).

### 4.2 Writes / cache deferred (TD-FE)

Write/mutation paths stay on raw `fetch` this phase; the `localStorage company_profile_{uid}` failover and the `slackSourceToConnect` sessionStorage bridge are retained. These are logged as TD-FE at the finalize stage (same posture as Phase 5's advisory gate).

### 4.3 Company-profile read — reuse decision

Mission-control reuses the existing `useCompanyProfile(orgId)` (TanStack, Phase 3) via a transitional import from `src/components/settings/`, rather than duplicating the read or promoting the hook now. Rationale: no duplication; `useCompanyProfile` is shared with **settings** (not customers), and settings is not extracted until Phase 10 — so its promotion to `src/shared/api` is its own move once a second *migrated* consumer exists (Phase 10 settings / Phase 11), separate from the profiler-util cluster promoted this phase. A TD-FE records the promotion candidate (it is read by settings + mission-control, and a market-research path duplicates it — see TD-FE-13's note). Note _(reconciled)_: only the company-profile **read** (the mount `GET /api/profile/company`) moves to `useCompanyProfile`; `handleSave` (the `POST`) and the `localStorage` failover stay as-is (write deferred — §2.2).

### 4.4 Read-hook typing _(decided at plan-writing)_

The migrated reads return **raw, loosely-typed data**; the view-model mapping stays in the consuming components this phase (honest typing for a flexible, un-annotated backend):

- `useICPs` wraps the shared `fetchIcpsRowsForOrg` (`@/shared/profiler`, raw `fetch`, hits `profile/company` then `customer_profile`) and returns the **raw ICP rows (`unknown[]`)**. There is **no feature-local zod contract for ICPs** — the shared extractor does the shaping, and the ICP component maps rows → the `ICP` view-model via the `@/shared/profiler` helpers (the same path `customers` uses).
- `useDataSources` (`GET /api/user-documents`) returns the **raw documents (`unknown[]`)**; the ~20-field doc → `DataSource` mapping stays in the data-sources component (stage 5). `useLeadStreamStatus` (`GET /api/leads/stream/status`) returns the typed `LeadStreamFileApiRow[]`. Both go through `@/shared/api/client` `apiGet` + **loose zod** (`contracts.ts`, `.passthrough()`/`.nullish()`).

Tightening `useICPs`/`useDataSources` to return typed view-models (mapping pushed into the service) is a candidate follow-up, not done this phase.

---

## §5 Public surface (`index.ts`)

Exports the minimum cross-feature surface Phase 7 (customers) needs:

- the **ICP type(s)** (the shape a customers consumer reads), and
- the **`useICPs` read hook**.

The ICP **mutation** surface is deferred with the write paths (§2.2); Phase 7 receives reads + types now, and the write surface lands when the ICP write path migrates. _(Reconciled:)_ `useICPs` returns the **raw ICP rows** (`unknown[]`, via the shared `fetchIcpsRowsForOrg`); the exported `ICP` type is the FE **view-model** a consumer maps those rows into (using the `@/shared/profiler` helpers) — see §4.4. The three promoted profiler-ICP utils are consumed from `@/shared/profiler` (promoted in stage 2b), **not** re-exported here. No deep paths: the §2.1 lint enforces index-only cross-feature import from this phase forward.

---

## §6 Profiler disposition (coordination artifact for Phases 7 & 9)

Per Spec 14 §4 Phase 6, this section is the authoritative handoff record. Phase 7 amends it as customers-side decisions land; Phase 9 reads it before planning and resolves open items.

| Item | Current (pre-6) | Phase-6 home | Intended final home |
|---|---|---|---|
| `profilerAcceptedIcpDisplay.ts` (merge/display helpers) | `src/utils/` | **→ `src/shared/profiler/`** (stage 2b) | shared |
| `profileIcpsExtract.ts` (`extractIcpsDataFromFlexibleApiResponse`, `fetchIcpsRowsForOrg`) | `src/utils/` | **→ `src/shared/profiler/`** (stage 2b) | shared |
| `missionProfilerSessionCache.ts` | `src/lib/` | **→ `src/shared/profiler/`** (stage 2b) | shared |
| ICP profiler-merge logic | inline in ICPManager | stays in mission-control `components/icp/`; customers reads via `index.ts` + the shared util | Phase 9 resolves |
| `UntypedProfilerIcpRecord` typing | escape-hatch | unchanged (Phase 13) | real contract type |

Profiler is **not** a feature yet; Phase 9 owns the scout/profiler split and the `ProfilerChatWithHistory`/`ScoutChatWithHistory` dedup. All three profiler-ICP utils are shared by mission-control + `customers` (verified: `customers/SuggestedICPCards.tsx` imports from all three), so Phase 6 promotes the **whole cluster** to `src/shared/` and repoints the `customers` importer; Phase 9 resolves the remaining profiler-feature placement.

---

## §7 Execution stages (the single plan, in order)

Each stage is a green checkpoint (preflight green, journeys + VR intact) and a commit-series within the one branch. A failed stage reverts to the last green stage (Spec 14 §5.7) without reverting the whole phase.

1. **Enabling infra** — two separate commits/checkpoints (registry first, lint second) for a finer rollback boundary; the plan breaks these into tasks. **(1a) Route registry:** `src/app/routes.tsx` and per-feature `routes.tsx` are **created this phase** (neither exists today; market-research's route is currently a deep page import in `App.tsx`). Each feature exposes routes via `routes.tsx` (re-exported from `index.ts`); a thin `src/app/routes.tsx` composes them append-only so phases never edit a shared `<Routes>` table. Convert the existing market-research route as the worked example; this also removes `App.tsx`'s deep page import — the reason the registry lands before the lint (1b). Document the convention in `src/features/README.md`. **(1b) Lint:** **add** the `index.ts`-only lint (forbid-form `import-x/no-internal-modules`; `eslint-plugin-import-x` is already installed). There is **no pre-existing "4a probe" file** — 1b establishes the acceptance check: a deep `@/features/<x>/…` import from outside is flagged, the `@/features/<x>` index import is allowed, and the ~95 pre-existing legitimate relative/external deep imports are not. Because the forbid globs also match same-feature alias deep imports, market-research's alias self-imports are **converted to relative first** so the rule lands green. Resolve TD-FE-15; update Spec 14 §8 Q16.

2. **Scaffold + relocate (parity)** — two checkpoints for a finer revert boundary (the plan breaks these into tasks). **(2a) Relocate (intra-feature):** scaffold `features/mission-control/` (`types.ts`/`index.ts` + a minimal placeholder `README.md`, finalized in stage 6); mechanically move the three files into `pages/` + `components/` (and register mission-control's route in the stage-1 `src/app/routes.tsx`); wrap the route in `<FeatureErrorBoundary featureName="Mission Control">`; **delete ICPManager's ~1,500–1,600 lines of commented-dead code**; repoint all moved-file imports. **(2b) Promote cluster (touches `customers`):** promote the three shared profiler-ICP utils (`profilerAcceptedIcpDisplay.ts`, `profileIcpsExtract.ts`, `missionProfilerSessionCache.ts`) → `src/shared/profiler/` and repoint their importers (mission-control + the external `customers/SuggestedICPCards`). No logic change; journeys `01`/`02`/`05` + VR green after each checkpoint.

3. **Read-path data layer.** `contracts.ts` (zod) + `services/` + read hooks `useICPs`, `useDataSources`/`useLeadStreamStatus`; wire the company-profile read to the reused `useCompanyProfile`. MSW handlers for each. Hook-first; components not yet decomposed.

4. **MissionControl.tsx decomposition.** Extract the 3-tab router into `MissionControlPage.tsx`; lift the company-profile form and the connector-approval cluster into `components/company-profile/`; consume the stage-3 hooks. Tab→subtree mapping (verified in `MissionControl.tsx`): `profile` → `components/company-profile/`, `customer-profile` → `components/icp/` (ICPManager), `sources` → `components/data-sources/` (DataSourcesManager). At stage-4 completion the `customer-profile`/`sources` tabs still render the **undecomposed** (relocated) ICPManager and DataSourcesManager; stages 5 and 6 then decompose those into the `data-sources/` and `icp/` sub-trees.

5. **DataSourcesManager decomposition.** Split into `components/data-sources/`: uploader (drag-drop + file refs), lead-stream status table, generic source form. Write paths stay raw `fetch` (deferred).

6. **ICPManager decomposition + finalize.** Split into `components/icp/`: list + filter, add/edit wizard, profiler-merge view. Then: lock `index.ts` (ICP type + `useICPs`), **finalize** `README.md` (from the stage-2 placeholder) + the §6 Profiler-disposition section, confirm ICPManager's commented legacy blocks are fully gone, allocate the deferred **TD-FE** entries (next free after TD-FE-32), and run the full serial `npm run preflight` for the single merge.

---

## §8 Error handling, testing & parity

- **Error boundary:** new `<FeatureErrorBoundary featureName="Mission Control">` at the page level. **No per-section boundaries** — Phase 5's settled convention (the page/route-level boundary suffices; per-section would be redundant and inconsistent).
- **Parity guards every stage:** behavioral journeys `01` (page + VR), `02` (DataSourcesManager), `05` (ICPManager + VR) stay green; snapshots stay within the 2% VR threshold (decomposition is structural and visually neutral; minor bounding-box shifts from added wrapper elements are acceptable if visually identical).
- **New unit tests:** Vitest + RTL for each decomposed component and each new hook; MSW handlers for the migrated reads. Hooks get direct tests (loading/error/success); components get render + interaction tests.
- **Merge gate:** serial `npm run preflight` (typecheck + lint + format + Vitest + build + bundle + e2e/VR + `knip --strict`) at the single `--no-ff` merge. Run `npm run verify` (typecheck + lint + test — `package.json:18`) as the inner loop between stages.
- **Concurrency note:** run Phase 6 to completion before starting Phase 8/10 (the "sequential" choice). The enabling infra (stage 1) is on the same branch and reaches `master` at the Phase-6 merge, so any later concurrent work consumes the route registry + lint from `master` after this phase lands.

---

## §9 Dead code & deferred tech debt

- **ICPManager dead code:** ~1,500–1,600 lines of commented legacy (≈1,569 comment lines of 3,320; old localStorage component shadow) — **one contiguous block, lines 1–1634 of the file** (verified at plan-writing) — deleted in stage 2a, confirmed gone at finalize. Do not carry forward.
- **TD-FE entries to allocate at finalize** (verify the actual highest TD-FE number at finalize — TD-FE-32 is the spec-writing-time ceiling), each with current-state / should-be / trigger:
  1. mission-control **write/mutation paths** remain raw `fetch` (ICP CRUD, data-source CRUD, company-profile save, connector approve/deny) — later mutation pass.
  2. `localStorage company_profile_{uid}` failover + `sessionStorage slackSourceToConnect` bridge retained.
  3. `useCompanyProfile` **shared-promotion candidate** (settings + mission-control consumers; market-research path duplicates) — Phase 10/11.
  4. DataSourcesManager **upload helpers** shared extraction — Phase 11.
  5. mission-control **escape-hatches** (`UntypedBackendApiResponse`/`UntypedProfilerIcpRecord`/`UntypedBackendDocument`) retyping — Phase 13 (carry TD-FE-9/10).

---

## §10 Definition of done

On `master` after the single merge:

1. `src/features/mission-control/` populated; `src/pages/MissionControl.tsx` and `src/components/mission-control/*` gone.
2. Route resolves via the per-feature route registry; `/mission-control` URL + `requireTenant` unchanged; page wrapped in `<FeatureErrorBoundary>`.
3. `index.ts`-only cross-feature lint live and green (TD-FE-15 resolved); Spec 14 §8 Q16 updated.
4. Read paths (ICP list, data-sources/lead-stream, company-profile) on TanStack; `useCompanyProfile` reused; writes/localStorage carried as TD-FE.
5. The three profiler-ICP utils (`profilerAcceptedIcpDisplay.ts`, `profileIcpsExtract.ts`, `missionProfilerSessionCache.ts`) in `src/shared/profiler/`, all importers (mission-control + `customers`) repointed.
6. ICPManager's commented legacy blocks deleted (no commented-out component shadow remains); the feature carries no `// DEAD CODE`/`// HANDOFF` annotation markers (none expected — the dead code is commented blocks).
7. `README.md` + Profiler-disposition section written; deferred TD-FE allocated.
8. Vitest + RTL unit tests for new hooks/components; journeys `01`/`02`/`05` + VR green; serial `npm run preflight` green.
9. Spec 14 §4 status row: Phase 6 → done (applied at merge).

---

## §11 Risks & mitigations

- **R1 — DataSourcesManager upload entanglement.** The uploader couples to lead-stream polling + file refs; decomposition may reveal tighter coupling than the map shows. *Mitigation:* stage 5 is its own checkpoint; if extraction over-runs, the upload helpers stay inline (their shared extraction is already deferred to Phase 11) and only the surrounding structure is split.
- **R2 — Profiler-merge boundary.** Promoting the profiler-ICP util cluster while customers is still legacy risks a reshape when Phase 7 migrates. *Mitigation:* the three utils are small and pure, each with ≥2 current consumers (mission-control + `customers`); the §6 disposition records the boundary and Phase 9 holds final authority over the profiler feature.
- **R3 — Single large branch.** One branch for ~11.6k LOC of change is a big diff. *Mitigation:* stage checkpoints keep each commit-series green and revertable (§5.7); the strong journey+VR net (all three monsters covered) catches behavior drift continuously.
- **R4 — `useCompanyProfile` reach into settings.** A legacy-dir import into not-yet-extracted settings. *Mitigation:* permitted by the transitional exception; logged as a promotion TD-FE so Phase 10/11 unwinds it.

## §12 Open questions

- Top-level endpoint **paths** are now resolved (data-source list = `GET /api/user-documents`; lead-stream = `GET /api/leads/stream/status`; ICP = `GET /api/profile/company` → `GET /api/customer_profile`; company profile = `GET /api/profile/company`). Residual: **field-level** response shapes — confirm live (stage 3) before relying on any single field; the zod contracts are deliberately loose (`.passthrough()`/`.nullish()`) to tolerate drift.

---

## §13 Companion documents

- Master plan: `specs/14-frontend-refactoring-master-plan-design.md` (§4 Phase 6, §3.3, §5.7, §8 Q16).
- Precedent: `specs/24-frontend-phase-5-market-research-design.md` (extraction pattern, deferred-data-layer posture).
- `docs/TECH_DEBT.md` — TD-FE-15 (resolved here), TD-FE-9/10 (escape-hatches), TD-FE-13 (company-profile host), and the new Phase-6 entries.
