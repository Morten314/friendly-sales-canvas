# `customers` feature

## Purpose

The `/customers` surface — the **Profiler agent** UI (page title `👤 Profiler - Brewra`):
three tabs (ICP Intelligence / Lead Stream / Chat with Profiler). Extracted from
`src/pages/Customers.tsx` + `src/components/customers/*` and the relocated
`ProfilerChatWithHistory` in Phase 7 (master Spec 14 §4; Spec 26 / plan 26). Spec 14's
Phase 7 source list (`ICPSummaryOpportunity`, `SuggestedICPsGallery`) was stale — both were
dead-deleted in Phase 1; Spec 26 is the authority for what moved.

## Public surface

Locked in T18 (`index.ts`). Cross-feature consumers import only via `@/features/customers`,
never a deep path. Today the surface is routes-only; exports are added lazily if Phase 9 needs them.

| Export            | Kind   | Source       | Description                                                                                       |
| ----------------- | ------ | ------------ | ------------------------------------------------------------------------------------------------- |
| `customersRoutes` | routes | `routes.tsx` | The `/customers` route array (mounted by `src/app/routes.tsx`), `<FeatureErrorBoundary>`-wrapped. |

## Key files

- `pages/CustomersPage.tsx` — route shell; three tabs; the `window`-event header bridge; inner legacy `<ErrorBoundary>` around tabs (relocated T2).
- `components/icp-intelligence/SuggestedICPCards.tsx` — Profiler ICP container; reads via the service/hook layer (T11), writes via mutation hooks (T16); decomposed T12.
- `components/icp-intelligence/{SuggestedICPCard,CurrentIcpsTable}.tsx` — extracted render units (T12).
- `components/icp-intelligence/icpMapping.ts` — pure flexible-`/icp` mappers/normalizers (T9).
- `components/icp-intelligence/suggestedIcpStorage.ts` — pure optimistic-`localStorage` helpers (T10).
- `components/icp-intelligence/ICPIntelligence.tsx` — thin wrapper; `profilerRefresh` header-event handler.
- `components/lead-stream/LeadStream.tsx` — pure mock panel; exports `LeadStreamPanel` + `getLeadCountForICP`.
- `components/chat/ProfilerChatWithHistory.tsx` — relocated Profiler chat shell; imports the `ContextChat` substrate from `@/shared/chat` (relocated Phase 8; renamed Phase 9; TD-FE-45 resolved).
- `contracts.ts` — permissive zod for `/icp` + `customer_profile` (T4).
- `types.ts` — feature-local types (`ExistingICP`, `SuggestedICP`, `ICPCardStatus`, `ICPAnalysis`, …) (T8).
- `hooks/*` — TanStack read (`useCustomerProfile`, `useSuggestedIcps`) + write (`useSaveCustomerProfile`, `useAcceptSuggestedIcp`, `useRejectSuggestedIcp` / `useDeleteCurrentIcp`) hooks.
- `services/customers.ts` — read/write API call layer.
- `routes.tsx` / `index.ts` — route registry + public surface.

## Dependency notes

- May import from: `@/features/customers/*` (self, relative), `@/shared/*`, `@/components/ui/*`, npm.
- May import another feature **only** via its `index.ts` (`@/features/<other>`), never a deep path.
- Transitional (Phases 4b–12) legacy imports retained: `@/lib/api`, `@/shared/types/escape-hatches`, `@/hooks/usePageTitle`, `@/hooks/use-toast`, `@/shared/lib/cacheUtils`, `@/components/common/ErrorBoundary`, and `@/components/market-research/EditDropdownMenu` (legacy dir not yet migrated). The chat substrate now imports from `@/shared/chat` — a proper shared module, no longer a transitional/legacy path.
- Keeps its **own** `/icp` + `customer_profile` read — does not adopt mission-control's `useICPs` (TD-FE-42).

## Pending handoffs

| Component(s)                                             | Target / resolution                                                    | Phase                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------- |
| `ContextChat` substrate (was `SignalsContextChat`)       | Relocated to `src/shared/chat/` (Phase 8); renamed Phase 9 (TD-FE-61). | 8 relocates; 9 renames |
| `ProfilerChatWithHistory` ↔ `ScoutChatWithHistory` dedup | Relocated unchanged; differ by 244 lines.                              | 9 dedups               |
| Customers vs mission-control ICP read                    | Both read `/api/icp` + `customer_profile` independently (TD-FE-42).    | 9 may consolidate      |

## Deferred (TD-FE-41…45)

Optimism stays in `localStorage` (41); read overlaps `useICPs` (42); `profiler_recommendedICPs`/session-cache read orchestration not cache-native (43); window-event bridge untyped (44); chat substrate now in `@/shared/chat` (45 resolved).
