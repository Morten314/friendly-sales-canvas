# ADR-0004 — Market-research TanStack cache is memory-only

**Status:** Accepted
**Date:** 2026-05-31

## Context

The legacy market-research page backs its data with a hand-rolled `localStorage` cache (`CACHE_DURATION = 5 min`, per-component keys, manual `?_cb&_r` cache-busting). Phase 5b replaces the data-access layer with TanStack Query (`useResearchComponent` / `useRegenerateResearch` over the shared client). We must decide whether the new cache persists across reloads (a TanStack persister into `localStorage`/IndexedDB) or lives only in memory. Spec 24 §8 Q9 left this open. The product is pre-launch MVP with 0 live users.

## Decision

We will use a **memory-only** TanStack cache — no persister — for market-research, consistent with the Phase-3 `queryClient` defaults (`staleTime` 5 min, `gcTime` 10 min, `retry` 1, no persister). A full reload re-fetches.

Within that cache, `useRegenerateResearch` populates the regenerated result via `queryClient.setQueryData(qk.marketResearchComponent(orgId, componentName), data)` on success — **not** `invalidateQueries`. The component's `useResearchComponent` is mounted and active, so invalidating would mark it stale and fire a second background POST (`refresh:false`) through the shared 30/min rate limiter, which could also overwrite the just-regenerated report with a server-stale one.

## Consequences

- Simpler than a persister; matches Phase-3 behavior and MVP-velocity priorities (resolves §8 Q9 toward simplicity).
- A reload re-fetches market-research (accepted, R7). This puts more calls through the single 30/min rate limiter than the old 5-min localStorage cache did. Sufficiency is not meaningfully testable pre-launch (0 users), so the **revisit trigger is the post-launch measurement itself**: if real usage hits the limiter, reconsider a persister or a longer `staleTime`.
- `setQueryData`-on-success means a regenerate is reflected in the UI with no extra request. Revisit this write pattern only if a future write genuinely needs server reconciliation after the mutation (then `invalidateQueries` may be warranted).
- **Accepted limitation — `user_id` is not in the query key.** The key is `["market-research", "component", orgId, componentName]` — keyed on `orgId` + `componentName`, not `user_id` (which the POST body carries). If a different user ever operates under the same `orgId` (re-login, multi-user org), the memory cache could serve data fetched with the previous `user_id` without re-POSTing. Risk is nil at MVP (0 users; the endpoint is org-scoped and the backend does not validate auth), and this is consistent with `useCompanyProfile`, which also keys only on `orgId`. Trigger to revisit: when user-scoped data or real auth enforcement lands, add `user_id` to the key (cache evicts on re-login, acceptable since memory-only re-fetches anyway).
- **Scope note.** This ADR governs the new TanStack data layer. The legacy page-level `localStorage` cache is **not yet removed** — Phase 5b descoped the page rewire (the page's market-research access is entangled with editable UI state, a cascade `previousContext`, and timestamp-merge reconciliation, not a thin fetch wrapper). That removal moves to the page decomposition (5c) / section extraction (5d–5h), where the sections take ownership of per-component data through these hooks. See `docs/TECH_DEBT.md`.
