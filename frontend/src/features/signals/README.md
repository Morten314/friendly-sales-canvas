# `signals` feature

## Purpose

The `/signals` surface — the unified signal feed (page title `📡 Signals - Brewra`):
a card stream of scout/profiler signals with accept/reject decisions, per-signal
next-best-actions, and a context-chat handoff to the shared chat substrate. Extracted
from `src/pages/Signals.tsx` (1,544 LOC) + `src/components/signals/*`
(master Spec 14 §4; Spec 27). The `/agent-hub` URL aliases the same page.

## Public surface

Locked in T18 (`index.ts`). Cross-feature consumers import only via `@/features/signals`,
never a deep path. Today the surface is routes-only; exports are added lazily if a consumer needs them.

| Export          | Kind   | Source       | Description                                                                                                    |
| --------------- | ------ | ------------ | -------------------------------------------------------------------------------------------------------------- |
| `signalsRoutes` | routes | `routes.tsx` | The `/signals` + `/agent-hub` route array (mounted by `src/app/routes.tsx`), `<FeatureErrorBoundary>`-wrapped. |

## Key files

- `pages/SignalsPage.tsx` — route shell + the feed orchestration: imperative `loadSignals`, editable `signals` `useState`, optimistic add/remove, the 5s `pendingRejections` undo timer, the `signalsStateChanged` window-event refetch, and the `sessionStorage.signalsChatContext` chat handoff.
- `components/SignalCard.tsx` — single signal card render unit (headline / snippet / sources / NBAs / contextual suggestions).
- `components/SignalsEmptyState.tsx` — empty + loading states (exports `SignalsEmptyState` + `SignalsLoadingState`).
- `components/SignalChatPanel.tsx` — the in-page signal chat panel.
- `components/signalCards.ts` — pure card builders/normalizers (`buildSignalCardsFromFetchData`, …) that fold the snake/camel-aliased backend shape into `SignalCard`.
- `hooks/useFetchSignals.ts` / `hooks/useGenerateSignalsBatch.ts` — TanStack read/generate hooks wrapping `services/signals.ts` (pre-positioned; see TD-FE-53).
- `hooks/useSignalAcceptance.ts` — `localStorage`-backed accepted/rejected decision state (see TD-FE-49).
- `services/signals.ts` — page-only `fetch-signals` (GET) + `generate-signals-batch` (POST) API call layer.
- `contracts.ts` — permissive zod for the two page-only endpoints (`z.object({}).passthrough()`; see TD-FE-53).
- `types.ts` — feature-local signal/card types (`Agent`, `SignalCard`, `NBAItem`, `ContextualSuggestion`, `SourceCitation`).
- `routes.tsx` / `index.ts` — route registry + public surface.

## Data layer

- **Signal Ask / Signal action** (the chat ask + accept/reject mutations) go through the **shared** `@/shared/chat` hooks (`useSignalAsk` / `useSignalAction`) — the same TanStack hooks the chat substrate uses, so the page and the substrate share one mutation path.
- **Page-only** `fetch-signals` / `generate-signals-batch` go through `services/signals.ts` (not shared — nothing else reads them).
- **`useSignalAcceptance`** (the `signals_<uid>_accepted` / `_rejected` keys) stays on `localStorage` as **primary state**, not cache — these are user decisions, not a server mirror (TD-FE-49).
- The page's data flow is **NOT yet TanStack-migrated** — `loadSignals` stays imperative with editable `useState`, optimistic mutations, the undo timer, and event-driven refetch; the read/generate hooks above are pre-positioned but currently unused (TD-FE-53).

## Dependency notes

- May import from: `@/features/signals/*` (self, relative), `@/shared/*`, `@/components/ui/*`, npm.
- May import another feature **only** via its `index.ts` (`@/features/<other>`), never a deep path.
- Legacy paths have been updated: `@/hooks/use-toast` → `@/components/ui/use-toast`; `@/lib/api` → `@/shared/api/transport`. `@/shared/types/escape-hatches` (`UntypedBackendSignal`) is already on its final path.
