# ADR-0008 — Editable-state features defer full TanStack migration

**Status:** Accepted

## Context
Phase 3 adopted TanStack Query as the server-state layer and proved the pattern on auth/tenant/settings. Several feature surfaces (market-research, signals, customers read-orchestration) couple editable draft state to their fetch logic — a loading-phase state machine that reads editable data to decide transitions — which resists a declarative `useQuery` migration.

## Decision
Those features keep imperative `fetch` + `localStorage`/`sessionStorage` for now rather than force an unsafe migration. The decoupling (move fetch results into a query layer; hydrate editable drafts from it via an explicit reset/merge boundary) is deferred.

## Consequences
The "single source of server-state truth" (master-plan §6.9) is partially met. Tracked as TD-FE-19/21/41/43/49/53/65; `useMarketResearchData.ts` decomposition (TD-FE-65) is blocked on this decoupling.
