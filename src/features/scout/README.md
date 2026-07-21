# `scout` feature

Scout's single distinct surface: the **ScoutDeployment** page (`/scout-deployment`).

Scout's research surface is **market-research** and its chat lives in
`features/market-research/components/scout-chat/` (the `ScoutChatWithHistory` wrapper,
built on the shared `ChatWithHistory` shell from `@/shared/chat`). This folder therefore holds only the
deployment page + the form component it renders — intentionally thin (Spec 30 §1.1,
§7). No standalone `features/profiler/` exists: Profiler is distributed across
`customers` + `mission-control` + `shared/profiler` (TD-FE-60).

## Public surface

- `scoutRoutes` — registered (append-only) in `src/app/routes.tsx`.

## Key files

- `pages/ScoutDeploymentPage.tsx` — the page (wraps the form in `Layout`).
- `components/ScoutDeployment.tsx` — the deployment form.
