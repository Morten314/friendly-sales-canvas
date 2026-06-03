# Spec 25 — Frontend Phase 6: mission-control feature extraction

**Status:** Design — round 1
**Date:** 2026-06-03
**Type:** Phase spec (Phase 6 of master Spec 14 §4)
**Paired plan:** `plans/25-frontend-phase-6-mission-control.md` — _not yet written; **one plan, executed sequentially** (see §7)_

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
- **Data layer:** 21 raw `fetch()` sites, **zero** TanStack. `localStorage company_profile_{uid}` is a failover store (read+write across MissionControl + DataSourcesManager); `sessionStorage slackSourceToConnect` is a Slack-OAuth bridge. No `CACHE_DURATION`/`_cb`/`_r` cache-busting.
- **Dead code:** ICPManager carries ~1,000+ LOC of commented-out legacy (an old localStorage-era component shadow).
- **Profiler coupling:** ICPManager merges profiler-accepted ICP metadata via `@/utils/profilerAcceptedIcpDisplay.ts`, which `customers/SuggestedICPCards` also imports. That util + the ICP read surface are what Phase 7 (customers) and Phase 9 (scout + profiler) inherit.
- **Escape-hatches in play:** `UntypedBackendApiResponse` (MissionControl), `UntypedProfilerIcpRecord` (ICPManager), `UntypedBackendDocument` (DataSourcesManager).
- **Parity net (strong, unlike Phase 5):** behavioral E2E covers all three monsters — journey `01-login-tenant-mission` (page load, with VR snapshot `04-mission-control-loaded`), `02-csv-upload-leads` (DataSourcesManager), `05-icp-create` (ICPManager, with VR snapshot `01-mission-control-empty-icp`).
- **Existing reusable hook:** `useCompanyProfile(orgId)` (TanStack, Phase 3) at `src/components/settings/useCompanyProfile.ts`, currently consumed only by settings.

### 1.3 Relation to the master plan

Implements master Spec 14 §4 "Phase 6 — Feature: mission-control" and its "First enabling task" subsection (route registry + TD-FE-15 lint, added 2026-06-03). Hard dependencies per Spec 14 §4: Phase 5 + foundation only (both done). Phase 7 (customers) consumes this feature's `index.ts`; Phase 9 (scout + profiler) reads the Profiler-disposition section (§6).

---

## §2 Scope

### 2.1 In scope

- Cross-feature **enabling infra**: per-feature route registry (`src/app/routes.tsx`, append-only) + finalize the `index.ts`-only cross-feature lint (`import-x/no-internal-modules`, forbid-form) — resolves **TD-FE-15**.
- Scaffold `src/features/mission-control/` and relocate the three files into it (parity move).
- Wrap the routed page in `<FeatureErrorBoundary>`.
- Delete ICPManager's ~1k LOC of commented-dead code.
- Promote `profilerAcceptedIcpDisplay.ts` → `src/shared/`.
- **Read-path** TanStack migration: ICP list, data-sources + lead-stream status, company-profile (via reuse — §4).
- Structural decomposition of all three monsters into single-purpose components + hooks.
- `index.ts` public surface, `README.md`, and the Profiler-disposition section (§6).

### 2.2 Out of scope (deferred to TD-FE, allocated at the finalize stage)

- **Write/mutation paths** — ICP CRUD, data-source CRUD, company-profile save, connector approve/deny remain raw `fetch`. Migrated in a later mutation pass (Phase 7-era / Phase 13), mirroring TD-FE-21/27/31.
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
├── services/                          # API call layer (read endpoints)
├── contracts.ts                       # zod schemas for the read envelopes
├── types.ts                           # feature-local types (DataSource, ICP, ConnectorApproval, …)
├── index.ts                           # public surface — Phase 7 consumes this
└── README.md
```

**Dependency rules (Spec 14 §3.3):** may import `@/features/mission-control/*` (self), `@/shared/*`, `@/components/ui/*`, npm; transitionally (Phases 4b–12) the legacy dirs (`@/hooks`, `@/lib`, `@/utils`, `@/components/settings/*`, …). Cross-feature consumers import only via `@/features/mission-control` (the index). The reuse of `useCompanyProfile` from `components/settings/` is a **legacy-dir** import (settings is not yet a feature), permitted by the transitional exception.

---

## §4 Data layer (read → TanStack; writes deferred)

### 4.1 Reads migrated this phase

| Read | Endpoint (confirm live before wiring) | Hook |
|---|---|---|
| ICP list | `GET /api/customer_profile?org_id=…` (and `?user_id=…` variant) | `useICPs` (feature-local) |
| Data sources + lead-stream status | `GET /leads/stream/status` (+ source list) | `useDataSources` / `useLeadStreamStatus` (feature-local) |
| Company profile | `GET /api/profile/company?org_id=…` | **reuse `useCompanyProfile`** (see 4.3) |

Hooks are built **before** the components that consume them are decomposed (Spec 14 R3, hook-first). zod schemas land in `contracts.ts`; `.parse` at the fetch boundary. Per CLAUDE.md polyglot rule, confirm each response shape against a live backend call before writing FE types (no auto-generated client).

### 4.2 Writes / cache deferred (TD-FE)

Write/mutation paths stay on raw `fetch` this phase; the `localStorage company_profile_{uid}` failover and the `slackSourceToConnect` sessionStorage bridge are retained. These are logged as TD-FE at the finalize stage (same posture as Phase 5's advisory gate).

### 4.3 Company-profile read — reuse decision

Mission-control reuses the existing `useCompanyProfile(orgId)` (TanStack, Phase 3) via a transitional import from `src/components/settings/`, rather than duplicating the read or promoting the hook now. Rationale: no duplication; consistent with promoting only `profilerAcceptedIcpDisplay` this phase; promotion of `useCompanyProfile` to `src/shared/api` is its own move once a second *migrated* consumer exists (Phase 10 settings / Phase 11). A TD-FE records the promotion candidate (it is read by settings + mission-control, and a market-research path duplicates it — see TD-FE-13's note).

---

## §5 Public surface (`index.ts`)

Exports the minimum cross-feature surface Phase 7 (customers) needs:

- the **ICP type(s)** (the shape a customers consumer reads), and
- the **`useICPs` read hook**.

The ICP **mutation** surface is deferred with the write paths (§2.2); Phase 7 receives reads + types now, and the write surface lands when the ICP write path migrates. `profilerAcceptedIcpDisplay` is consumed from `@/shared` (promoted in stage 2), **not** re-exported here. No deep paths: the §2.1 lint enforces index-only cross-feature import from this phase forward.

---

## §6 Profiler disposition (coordination artifact for Phases 7 & 9)

Per Spec 14 §4 Phase 6, this section is the authoritative handoff record. Phase 7 amends it as customers-side decisions land; Phase 9 reads it before planning and resolves open items.

| Item | Current (pre-6) | Phase-6 home | Intended final home |
|---|---|---|---|
| `profilerAcceptedIcpDisplay.ts` (merge/display helpers) | `src/utils/` | **→ `src/shared/`** (stage 2) | shared |
| `profileIcpsExtract.ts` (`extractIcpsDataFromFlexibleApiResponse`) | `src/utils/` | mission-control-local (or stays legacy, imported transitionally) | revisit Phase 9/11 |
| `missionProfilerSessionCache.ts` | `src/lib/` | mission-control-local | revisit Phase 9/11 |
| ICP profiler-merge logic | inline in ICPManager | stays in mission-control `components/icp/`; customers reads via `index.ts` + the shared util | Phase 9 resolves |
| `UntypedProfilerIcpRecord` typing | escape-hatch | unchanged (Phase 13) | real contract type |

Profiler is **not** a feature yet; Phase 9 owns the scout/profiler split and the `ProfilerChatWithHistory`/`ScoutChatWithHistory` dedup. Phase 6 only promotes the one genuinely-shared display util and records the rest here.

---

## §7 Execution stages (the single plan, in order)

Each stage is a green checkpoint (preflight green, journeys + VR intact) and a commit-series within the one branch. A failed stage reverts to the last green stage (Spec 14 §5.7) without reverting the whole phase.

1. **Enabling infra.** Per-feature route registry: each feature exposes routes via `routes.tsx` (re-exported from `index.ts`); a thin `src/app/routes.tsx` composes them append-only so phases never edit a shared `<Routes>` table. Convert the existing market-research route as the worked example (which removes `App.tsx`'s deep page import, so the lint then passes cleanly). Finalize the `index.ts`-only lint (forbid-form `import-x/no-internal-modules`; verify the 4a probe: deep `@/features/<x>/…` from outside is flagged, the `@/features/<x>` index import is allowed, and the ~95 legitimate relative/external deep imports are not). Resolve TD-FE-15; update Spec 14 §8 Q16. Document the registry convention in `src/features/README.md`.

2. **Scaffold + relocate (parity).** Scaffold `features/mission-control/` (`types.ts`/`index.ts`/`README.md`); mechanically move the three files into `pages/` + `components/` (and register mission-control's route in the stage-1 `src/app/routes.tsx`); wrap the route in `<FeatureErrorBoundary featureName="Mission Control">`; **delete ICPManager's ~1k LOC commented-dead code**; promote `profilerAcceptedIcpDisplay.ts` → `src/shared/` and repoint its importers (mission-control + `customers/SuggestedICPCards`); repoint all moved-file imports. No logic change; journeys `01`/`02`/`05` + VR green.

3. **Read-path data layer.** `contracts.ts` (zod) + `services/` + read hooks `useICPs`, `useDataSources`/`useLeadStreamStatus`; wire the company-profile read to the reused `useCompanyProfile`. MSW handlers for each. Hook-first; components not yet decomposed.

4. **MissionControl.tsx decomposition.** Extract the 3-tab router into `MissionControlPage.tsx`; lift the company-profile form and the connector-approval cluster into `components/company-profile/`; consume the stage-3 hooks. The `customer-profile` and `sources` tabs render the (to-be-decomposed) ICP and data-source subtrees.

5. **DataSourcesManager decomposition.** Split into `components/data-sources/`: uploader (drag-drop + file refs), lead-stream status table, generic source form. Write paths stay raw `fetch` (deferred).

6. **ICPManager decomposition + finalize.** Split into `components/icp/`: list + filter, add/edit wizard, profiler-merge view. Then: lock `index.ts` (ICP type + `useICPs`), write `README.md` + the §6 Profiler-disposition section, confirm zero `// DEAD CODE`/stray annotations, allocate the deferred **TD-FE** entries (next free after TD-FE-32), and run the full serial `npm run preflight` for the single merge.

---

## §8 Error handling, testing & parity

- **Error boundary:** new `<FeatureErrorBoundary featureName="Mission Control">` at the page level. **No per-section boundaries** — Phase 5's settled convention (the page/route-level boundary suffices; per-section would be redundant and inconsistent).
- **Parity guards every stage:** behavioral journeys `01` (page + VR), `02` (DataSourcesManager), `05` (ICPManager + VR) stay green; the 2% VR threshold holds (decomposition is structural/byte-parity, so snapshots should not move).
- **New unit tests:** Vitest + RTL for each decomposed component and each new hook; MSW handlers for the migrated reads. Hooks get direct tests (loading/error/success); components get render + interaction tests.
- **Merge gate:** serial `npm run preflight` (typecheck + lint + format + Vitest + build + bundle + e2e/VR + `knip --strict`) at the single `--no-ff` merge. Run `npm run verify` as the inner loop between stages.
- **Concurrency note:** run Phase 6 to completion before starting Phase 8/10 (the "sequential" choice). The enabling infra (stage 1) is on the same branch and reaches `master` at the Phase-6 merge, so any later concurrent work consumes the route registry + lint from `master` after this phase lands.

---

## §9 Dead code & deferred tech debt

- **ICPManager dead code:** ~1,000+ LOC of commented legacy (old localStorage component shadow) — deleted in stage 2, confirmed gone at finalize. Do not carry forward.
- **TD-FE entries to allocate at finalize** (next free numbers after TD-FE-32), each with current-state / should-be / trigger:
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
5. `profilerAcceptedIcpDisplay.ts` in `src/shared/`, both importers repointed.
6. ICPManager dead code deleted; zero stray `// DEAD CODE`/annotation markers.
7. `README.md` + Profiler-disposition section written; deferred TD-FE allocated.
8. Vitest + RTL unit tests for new hooks/components; journeys `01`/`02`/`05` + VR green; serial `npm run preflight` green.
9. Spec 14 §4 status row: Phase 6 → done (applied at merge).

---

## §11 Risks & mitigations

- **R1 — DataSourcesManager upload entanglement.** The uploader couples to lead-stream polling + file refs; decomposition may reveal tighter coupling than the map shows. *Mitigation:* stage 5 is its own checkpoint; if extraction over-runs, the upload helpers stay inline (their shared extraction is already deferred to Phase 11) and only the surrounding structure is split.
- **R2 — Profiler-merge boundary.** Promoting `profilerAcceptedIcpDisplay` while customers is still legacy risks a reshape when Phase 7 migrates. *Mitigation:* it is a small, pure display util with ≥2 current consumers; the §6 disposition records the boundary and Phase 9 holds final authority.
- **R3 — Single large branch.** One branch for ~11.6k LOC of change is a big diff. *Mitigation:* stage checkpoints keep each commit-series green and revertable (§5.7); the strong journey+VR net (all three monsters covered) catches behavior drift continuously.
- **R4 — `useCompanyProfile` reach into settings.** A legacy-dir import into not-yet-extracted settings. *Mitigation:* permitted by the transitional exception; logged as a promotion TD-FE so Phase 10/11 unwinds it.

## §12 Open questions

- Whether `profileIcpsExtract.ts` is genuinely mission-control-only (the map shows only a MissionControl consumer) — confirm during stage 3; if a second consumer appears, treat like `profilerAcceptedIcpDisplay`.
- Exact `/leads/stream/status` and `/customer_profile` response shapes — confirm live (stage 3) before zod contracts.

---

## §13 Companion documents

- Master plan: `specs/14-frontend-refactoring-master-plan-design.md` (§4 Phase 6, §3.3, §5.7, §8 Q16).
- Precedent: `specs/24-frontend-phase-5-market-research-design.md` (extraction pattern, deferred-data-layer posture).
- `docs/TECH_DEBT.md` — TD-FE-15 (resolved here), TD-FE-9/10 (escape-hatches), TD-FE-13 (company-profile host), and the new Phase-6 entries.
