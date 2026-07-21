# `mission-control` feature

## Purpose

The mission-control surface: the routed Mission Control page — company-profile setup, ICP definition,
and data-source/connector management — plus the Profiler's ICP/persona surface. Extracted from
`src/pages/MissionControl.tsx` + `src/components/mission-control/*` (master Spec 14 §4;
Spec 25).

## Public surface

Locked in T22 (`index.ts`). Cross-feature consumers import only via `@/features/mission-control`
(the barrel), never a deep path. Anticipated primary consumer: `customers`.

| Export                 | Kind   | Source             | Description                                                                                                |
| ---------------------- | ------ | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `missionControlRoutes` | routes | `routes.tsx`       | The feature's route registry array (mounted by `src/app/routes.tsx`), wrapped in `<FeatureErrorBoundary>`. |
| `ICP`                  | type   | `types.ts`         | The canonical Ideal-Customer-Profile shape consumed cross-feature (e.g. customers).                        |
| `useICPs`              | hook   | `hooks/useICPs.ts` | ICP results-read hook (TanStack Query; returns raw rows, consumer maps via `@/shared/profiler`).           |

## Key files

- `pages/MissionControlPage.tsx` — routed Mission Control shell; relocated T5, wrapped in `<FeatureErrorBoundary>` T6, decomposed to a thin shell (T15 CompanyProfileForm + T16 ConnectorApprovals extracted) T17.
- `components/company-profile/CompanyProfileForm.tsx` — company-profile form; reads via `useCompanyProfile` (T15).
- `components/company-profile/ConnectorApprovals.tsx` + `connectorTypes.ts` — connector-approval cluster (T16); connector writes deferred (raw fetch).
- `components/data-sources/DataSourcesManager.tsx` — data-sources container; reads on `useDataSources`/`useLeadStreamStatus` (T18), decomposed T19.
- `components/data-sources/{LeadStreamTable,DataSourceUploader,SourceForm}.tsx` — data-sources children (T19); `dataSourceBadges.tsx` + `leadStreamStatus.ts` — lifted pure helpers (T19).
- `components/icp/ICPManager.tsx` — ICP container; reads on `useICPs` (T20), decomposed T21; profiler-merge data-transform lives in its mapping effect (see Decisions).
- `components/icp/{IcpList,IcpWizard}.tsx` — ICP children (T21): presentational list + self-contained add/edit wizard.
- `contracts.ts` — Zod schemas for the read responses (T10).
- `types.ts` — feature-local types (`ICP`, `FitConfidence`, `DataSource`, `DataSourceType`, `DataSourceStatus`, `LeadStreamFileApiRow`) (T10).
- `hooks/{useICPs,useDataSources,useLeadStreamStatus}.ts` — read hooks (TanStack Query) (T13/T14).
- `services/missionControl.ts` — read API call layer (T11).
- `routes.tsx` — route registry (T6).
- `index.ts` — public re-exports (the cross-feature surface) (T22).

## Dependency notes

- May import from: `@/features/mission-control/*` (self), `@/shared/*`, `@/components/ui/*`, npm packages.
- May import another feature **only** via its `index.ts` (`@/features/<other>`), never a deep path.
- Transitional (Phases 4b–12): may import not-yet-migrated legacy dirs (`@/contexts`, `@/hooks`, `@/lib`, `@/utils`, `@/pages`).
- Cross-feature consumers import only via `@/features/mission-control` (the index), never a deep path.

## Pending handoffs

These belong to **other** features and are NOT part of mission-control long-term. The owning phase relocates each.

| Component(s)                                                                                      | Target feature     | Claiming phase                                                                                                    |
| ------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| ICP profiler-merge display logic (`mergeProfilerAcceptedIcpDisplay` overlay in `components/icp/`) | customers/profiler | 9 — closed (confirm-and-document; algorithm already in `@/shared/profiler`, inline mapper upheld per Plan-25 T21) |
| `@/shared/profiler` util cluster (shared mission-control + customers)                             | customers          | 7 (already promoted in T8; relocation/ownership resolved as customers migrates)                                   |

## Profiler disposition

Authoritative record (Spec 25 §6); input for Phases 7 and 9.

| Artefact                                                                                    | Disposition                                                                                                                                                                              | Phase resolved |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `profileIcpsExtract`, `profilerAcceptedIcpDisplay`, `missionProfilerSessionCache`           | Promoted to `@/shared/profiler` — **done** (T8). Shared by mission-control + customers.                                                                                                  | 6 (T8) — done  |
| ICP profiler-merge logic (`mergeProfilerAcceptedIcpDisplay` in `ICPManager` mapping effect) | Stays in `components/icp/`. Algorithm is shared via `@/shared/profiler`; inline view-model mapper in `ICPManager.tsx` is a container data-transform (Plan-25 T21 upheld). No extraction. | 9 — done       |
| `UntypedProfilerIcpRecord` typing (escape-hatch `as` cast)                                  | Retyping deferred. Carries TD-FE-9/10 posture.                                                                                                                                           | 13             |

### Phase-7 resolution (customers side — amended 2026-06-04)

The customers side of the above table was resolved. The `@/shared/profiler` cluster stays **shared** (unchanged). Customers reads ICPs via its own `useCustomerProfile`/`useSuggestedIcps` hooks — it does **not** use mission-control's `useICPs` (the divergence is tracked as TD-FE-42). `ProfilerChatWithHistory` has been relocated to `features/customers/components/chat/`. `ContextChat` (was `SignalsContextChat`) was relocated to `src/shared/chat/` and later renamed (TD-FE-61). The profiler-merge display logic (`mergeProfilerAcceptedIcpDisplay`) and the `UntypedProfilerIcpRecord` escape-hatch are both unchanged — tracked under TD-FE-42 and the escape-hatch backlog.

### Phase-9 resolution (ICP-merge disposition — 2026-06-05)

Closed the Spec 25 §6 "Phase 9 resolves" open item by **confirm-and-document, no extraction**.

Verified facts:

- `mergeProfilerAcceptedIcpDisplay` lives in `src/shared/profiler/profilerAcceptedIcpDisplay.ts` and is
  exported from `@/shared/profiler`. There is NO `customers → mission-control` import for this logic.
- Both consumers (`features/customers/components/icp-intelligence/icpMapping.ts` and
  `features/mission-control/components/icp/ICPManager.tsx`) import the algorithm from `@/shared/profiler`.
- The inline view-model mapper in `ICPManager.tsx` (~lines 174–195) is a container data-transform that
  shapes ICP rows before rendering. It has no extractable render region. **Plan-25 T21 decision is upheld.**
- The ICP decomposition remains: `ICPManager` (container) + `IcpWizard` (add/edit form) + `IcpList`
  (presentational table/empty-state). No `ProfilerMergeView` was created; none is needed.

No code was changed for this item.

## Decisions

- **No `ProfilerMergeView` component (plan-25 T21).** The plan named a third ICP child
  for the profiler-accepted-ICP merge, but it was intentionally not created: the merge
  (`mergeProfilerAcceptedIcpDisplay` in the ICPManager mapping effect) is a container
  data-transform that shapes rows, not a render region — there is no UI to extract. The
  ICP decomposition is `ICPManager` (thin container) + `IcpWizard` (self-contained
  add/edit form) + `IcpList` (presentational table/empty-state).
