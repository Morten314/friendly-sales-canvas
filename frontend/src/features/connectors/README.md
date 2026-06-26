# connectors (Apollo discovery)

Owns the Apollo ICP-driven lead discovery frontend: data layer (zod contracts + TanStack Query
hooks against `/connectors/apollo/*`), the Mission Control Data Sources tile + connect modal (with post-connection key
update + disconnect via the tile's gear menu),
warmup progress + app-wide unlock toast, the discovery flow (re-discovery guard, keep/replace/
download prompt, run + status polling, tile states), and the agent-view lead source filter + badge.

## Public surface (index.ts)

- `ApolloTile` — mounted by mission-control's Data Sources tab.
- `useApolloUnlockToast` — mounted once at the app shell; fires the Locked→Unlocked toast.
- `LEAD_SOURCE_OPTIONS` / `LeadSourceFilter` — for the Scout/Profiler source filter.

## Backend contract

See `plans/35b-apollo-discovery-frontend.md` (contract table). Backend is spec 35a (merged).

This feature is the frontend's only caller of the Apollo `/connectors/apollo/*` endpoints, and it
wires a subset of them. Notably, **`POST /connectors/apollo/enrich` (and its `enrich/status` poll)
is not called by any frontend surface** — it is backend-only and currently unreachable from the UI
(verified 2026-06-26). No frontend action spends Apollo reveal credits via enrich; the only UI-wired
credit-spending path is discovery (`/connectors/apollo/discover`). Endpoint reference:
`backend/API_ENDPOINTS_SUMMARY.md` (A6).
