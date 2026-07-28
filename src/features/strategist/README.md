# `strategist` feature

## Purpose

The Strategist orchestration surface at `/your-ai-team/strategist/:tab` (page title
`🧭 Strategist - Brewra`): a two-tab sequence-builder — **Workspace** (the default tab;
renders the live `StrategistWorkspace` when a hydrated lead context exists, otherwise
`StrategistRecommendations`) and **Your Lead Stream** (`StrategistLeadStream`). Extracted
from `src/pages/Deals.tsx` + `src/components/strategist/*` (master Spec 14 §4;
Spec 28). Strategist has **no dedicated backend** — it hydrates from
`sessionStorage.strategistContext` (written by Scout's chat handoff) and clears it on read.

## Public surface

Locked in T18 (`index.ts`). Cross-feature consumers import only via `@/features/strategist`,
never a deep path. Today the surface is routes-only.

| Export             | Kind   | Source       | Description                                                                                                                                                                       |
| ------------------ | ------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strategistRoutes` | routes | `routes.tsx` | The `/your-ai-team/strategist/:tab` route + the `/your-ai-team/strategist` root redirect + the legacy `/deals` redirect (both → `…/workspace`), `<FeatureErrorBoundary>`-wrapped. |

## Key files

- `pages/StrategistPage.tsx` — route shell; the two-tab `<Tabs>` controller; reads + clears `sessionStorage.strategistContext` on mount; routes tab changes via `navigate`.
- `components/StrategistWorkspace.tsx` — the live workspace (renders on the default `workspace` tab when a lead context is present). **Relocated as-is** (see note below).
- `components/StrategistRecommendations.tsx` — the empty/landing state shown on the workspace tab when no lead context was handed off.
- `components/StrategistLeadStream.tsx` — the "Your Lead Stream" tab panel.
- `types.ts` — feature-local types (`StrategistContext`: the `sessionStorage` handoff shape — `leads[]`, `opportunity?`, `icp?`, `triggerPrompt`).
- `routes.tsx` / `index.ts` — route registry + public surface.

## Relocated-as-is note (`StrategistWorkspace`)

`StrategistWorkspace` was relocated **verbatim** (only the stale HANDOFF
annotation was stripped). It is **live and reachable** — it renders on `StrategistPage`'s
default `workspace` tab whenever a lead context is hydrated. It is, however, a large
component making a raw direct-backend `GET ${BACKEND_BASE_URL}/chat/` fetch that bypasses
the `/api` proxy. Both the component decomposition and moving that fetch into a
service/hook **remain deferred** (TD-FE-47) — the relocation kept scope to moving,
not rewriting.

## Dependency notes

- May import from: `@/features/strategist/*` (self, relative), `@/shared/*`, `@/components/ui/*`, npm.
- May import another feature **only** via its `index.ts` (`@/features/<other>`), never a deep path.
- Legacy paths have been updated: `@/hooks/usePageTitle` → `@/shared/hooks/usePageTitle`; `@/lib/api` → `@/shared/api/transport` (`BACKEND_BASE_URL`, in `StrategistWorkspace`).
