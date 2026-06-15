# `customers` feature

## Purpose

The `/customers` surface — the **Profiler agent** UI (page title `👤 Profiler - Brewra`):
three tabs (ICP Intelligence / Lead Stream / Chat with Profiler). Extracted from
`src/pages/Customers.tsx` + `src/components/customers/*` and the relocated
`ProfilerChatWithHistory` (master Spec 14 §4; Spec 26 / plan 26). Spec 14's
Phase 7 source list (`ICPSummaryOpportunity`, `SuggestedICPsGallery`) was stale — both were
dead code already deleted; Spec 26 is the authority for what moved.

## Public surface

Locked in T18 (`index.ts`). Cross-feature consumers import only via `@/features/customers`,
never a deep path. Today the surface is routes-only; exports are added lazily if a consumer needs them.

| Export            | Kind   | Source       | Description                                                                                       |
| ----------------- | ------ | ------------ | ------------------------------------------------------------------------------------------------- |
| `customersRoutes` | routes | `routes.tsx` | The `/customers` route array (mounted by `src/app/routes.tsx`), `<FeatureErrorBoundary>`-wrapped. |

## Key files

- `pages/CustomersPage.tsx` — route shell; three tabs; the `window`-event header bridge; inner `<ErrorBoundary>` around tabs (now `./components/ErrorBoundary` — relocated).
- `components/ErrorBoundary.tsx` — local error boundary (relocated from `components/common/ErrorBoundary`).
- `components/icp-intelligence/EditDropdownMenu.tsx` — dropdown edit menu (relocated from `components/market-research/`; TD-FE-63).
- `components/icp-intelligence/SuggestedICPCards.tsx` — Profiler ICP container; reads via the service/hook layer (T11), writes via mutation hooks (T16); decomposed T12.
- `components/icp-intelligence/{SuggestedICPCard,CurrentIcpsTable}.tsx` — extracted render units (T12).
- `components/icp-intelligence/icpMapping.ts` — pure flexible-`/icp` mappers/normalizers (T9).
- `components/icp-intelligence/suggestedIcpStorage.ts` — pure optimistic-`localStorage` helpers (T10).
- `components/icp-intelligence/ICPIntelligence.tsx` — thin wrapper; `profilerRefresh` header-event handler.
- `components/lead-stream/LeadStream.tsx` — renders real org leads from `GET /api/v2/leads` (via `useLeads`); lead-source filter/badge; expandable per-row "N relevant signals" affordance (via `useSignalLeadMap`); exports `LeadStreamPanel` + `getLeadCountForICP` (stub, TD-FE-69).
- `components/chat/ProfilerChatWithHistory.tsx` — relocated Profiler chat shell; imports the `ContextChat` substrate from `@/shared/chat` (relocated then renamed; TD-FE-45 resolved).
- `contracts.ts` — permissive zod for `/icp` + `customer_profile` (T4).
- `types.ts` — feature-local types (`ExistingICP`, `SuggestedICP`, `ICPCardStatus`, `ICPAnalysis`, …) (T8).
- `hooks/*` — TanStack read (`useCustomerProfile`, `useSuggestedIcps`) + write (`useSaveCustomerProfile`, `useAcceptSuggestedIcp`, `useRejectSuggestedIcp` / `useDeleteCurrentIcp`) hooks.
- `services/customers.ts` — read/write API call layer.
- `routes.tsx` / `index.ts` — route registry + public surface.

## Dependency notes

- May import from: `@/features/customers/*` (self, relative), `@/shared/*`, `@/components/ui/*`, npm.
- May import another feature **only** via its `index.ts` (`@/features/<other>`), never a deep path.
- May import: `@/features/customers/*` (self), `@/shared/*`, `@/components/ui/*`, npm. Legacy paths have been updated: `@/lib/api` → `@/shared/api/transport`; `@/hooks/usePageTitle` → `@/shared/hooks/usePageTitle`; `@/hooks/use-toast` → `@/components/ui/use-toast`; `@/components/common/ErrorBoundary` → `./components/ErrorBoundary` (now local); `@/components/market-research/EditDropdownMenu` → `./components/icp-intelligence/EditDropdownMenu` (now local). `@/shared/types/escape-hatches` and `@/shared/lib/cacheUtils` are already on their final paths. The chat substrate imports from `@/shared/chat`.
- Keeps its **own** `/icp` + `customer_profile` read — does not adopt mission-control's `useICPs` (TD-FE-42).

## Pending handoffs

| Component(s)                                             | Target / resolution                                                    | Phase                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------- |
| `ContextChat` substrate (was `SignalsContextChat`)       | Relocated to `src/shared/chat/` (Phase 8); renamed Phase 9 (TD-FE-61). | 8 relocates; 9 renames |
| `ProfilerChatWithHistory` ↔ `ScoutChatWithHistory` dedup | Relocated unchanged; differ by 244 lines.                              | 9 dedups               |
| Customers vs mission-control ICP read                    | Both read `/api/icp` + `customer_profile` independently (TD-FE-42).    | 9 may consolidate      |

## Deferred (TD-FE-41…45)

Optimism stays in `localStorage` (41); read overlaps `useICPs` (42); `profiler_recommendedICPs`/session-cache read orchestration not cache-native (43); window-event bridge untyped (44); chat substrate now in `@/shared/chat` (45 resolved).
