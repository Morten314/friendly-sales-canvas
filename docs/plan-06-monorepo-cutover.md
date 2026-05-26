# Plan 06 — Monorepo cutover and old-repo retirement

**Status:** draft (concept) — 2026-05-26
**Predecessors:** Plan 01 (folder→branch), Plan 02 (monorepo fork — executed 2026-05-08), Plan 05 (PWA reconciliation — never formalized; partially subsumed here)

## Scope

Complete the fork transition: collapse the temp-week tracker branches, repoint deployments at the monorepo, archive the old `tech-brewra/PWA-multi-tenancy` and `tech-brewra/backend` repos, and establish the post-cutover branch model.

## Current state (verified 2026-05-26)

- Monorepo `brewra-gtm-intelligence` is the working repo. `master` is the active trunk; ~2.5 weeks of plan-04 through plan-13 work (backend modularization phases B–L, prompt management) sit on it.
- All four target branches exist on origin: `master`, `develop`, `production`, `pwa-master-history`. Tags `fork-point-2026-05-08` and `pre-monorepo-fork-2026-05-08` are anchored on monorepo, PWA origin, and backend origin.
- Old `tech-brewra/PWA-multi-tenancy` last seen at `8ea8bfe` (no writes since fork from monorepo side).
- Old `tech-brewra/backend` last seen at `95705f2` — far behind monorepo's backend (no modularization, no plan-13).
- Deploys are still wired to the OLD repos: Render `brewera` service builds from old backend; Vercel deploys old PWA. `frontend/vercel.json` rewrites `/api/*` → `https://backend-11kr.onrender.com`.
- Plan 05 was never formalized. `develop` vs `production` differ by 96 files / ~16k LOC; `master` vs `develop` differ by 442 files (master has dragged ahead with backend modularization and plans/specs/audits, develop has FE work master doesn't).
- `pwa` and `backend` git remotes still configured in monorepo (point at on-disk old repos); `scripts/sync.sh` still present.

## Tasks

Grouped by phase. Execute roughly in order; some steps within a phase can parallelize.

### Phase A — Final sync & frontend reconciliation (subsumes Plan 05)

1. Run `bash scripts/sync.sh --dry-run` to surface anything outstanding from old PWA/backend tips.
2. Run `bash scripts/sync.sh` for real, so monorepo's `develop`/`production` are at parity with the old repos.
3. Decide canonical frontend state. Per `docs/plan-05-pwa-reconciliation.md`: develop is the direction of travel. Two options:
   - (a) Merge `develop` → `master`, then port forward the production-only features: `/deals` route + `Deals.tsx`, "Strategist" sidebar nav, 4 market-intelligence drawer pairs (`MarketRankings`, `MarketSegments`, `SwotAnalysis`, `TechnologyDrivers`), `src/lib/profilerCache.ts`.
   - (b) Declare master's current frontend (pre-fork develop snapshot) as canonical and drop the production-only features.
4. Resolve dangling `MarketRankings` import in `frontend/src/pages/MarketResearch.tsx` (file referenced but absent in develop).
5. Land the reconciled frontend on `master` as a single commit.

### Phase B — Repoint deployments

6. Reconfigure Render service `brewera`: point at `dicemanx/brewra-gtm-intelligence`, set root directory `backend/`, branch `master` (or `production` if adopting that model — see Phase D). Keep `autoDeploy: false` or flip deliberately.
7. Reconfigure Vercel project: point at `dicemanx/brewra-gtm-intelligence`, root directory `frontend/`, production branch `master` (or `production`).
8. Smoke-test:
   - Trigger Render redeploy; hit `https://backend-11kr.onrender.com/docs` and one root endpoint.
   - Push a no-op to verify Vercel build; load the deployed FE and confirm an authenticated API call succeeds.
   - The 6 FE call sites that bypass the proxy (see `docs/Deployment Infrastructure and Notes.md`) still hardcode the Render URL — no FE change needed unless the backend domain changes.

### Phase C — Tear down fork-pattern scaffolding

9. Tag the cutover moment: `git tag monorepo-cutover-2026-05-26 master && git push origin monorepo-cutover-2026-05-26`.
10. Delete tracker branches: `git push origin --delete develop production` + local `git branch -D develop production`.
11. Decide on `pwa-master-history` — recommend keeping as long-term archive per Plan 02 spec.
12. `git rm scripts/sync.sh && git commit -m "chore: remove sync.sh (cutover complete)"`.
13. `git remote remove pwa && git remote remove backend`.
14. Decide on local `refactor` branch — recommend deleting if its 5 commits are not load-bearing.

### Phase D — Post-cutover branch model

15. Create `dev` branch off `master`; push to origin. Decide whether to also create `stage` now or defer.
16. Rewrite `BRANCHES.md` for `master` / `dev` (/ `stage`) model; drop all temp-week, sync, tracker-branch language.
17. Update `CLAUDE.md` and `AGENTS.md`:
    - Replace the "Monorepo Branch Model (during temp week)" section with the new model.
    - Remove the "Sync workflow" subsection under "AI-Native Development".
    - Strip tracker-branch hygiene gotcha.
18. Update `README.md` — drop "temporary parallel-branch state during fork transition" wording and the `bash scripts/sync.sh` line under "Common commands".

### Phase E — Retire old repos

19. Brewra-dev onboarding decision (blocking — see Open Questions #2). Either communicate the new workflow, or confirm they have stopped contributing.
20. `gh repo archive tech-brewra/PWA-multi-tenancy` — read-only on GitHub, recoverable.
21. `gh repo archive tech-brewra/backend` — same.
22. `rm -rf /projects/Brewra/PWA-multi-tenancy /projects/Brewra/backend` (recoverable from archived GitHub repos).

### Phase F — Cleanup & verification

23. Verify acceptance:
    - Only `brewra-gtm-intelligence/` and `genesis-strategy/` (and `.claude/`) remain under `/projects/Brewra/`.
    - Render and Vercel both serve from monorepo; live URLs respond.
    - `git remote -v` shows only `origin`.
    - `git branch -a` shows `master`, `dev` (and `stage` if created), and `pwa-master-history` only.
24. Mark `docs/plan-05-pwa-reconciliation.md` superseded by this plan, or move to `docs/historical/`.
25. Optional: write `plans/14-monorepo-cutover.md` as a retrospective with actual SHAs and decisions made.

## Open questions (resolve before executing)

| # | Question | Affects |
|---|---|---|
| 1 | Has Plan 05 reconciliation been done off-camera, or do we still need to merge develop→master and port production-only features? | Phase A scope. |
| 2 | Are Brewra devs still actively pushing to old PWA `master` and old `backend` `main`? | Step 1 urgency, step 19 communication. |
| 3 | Target branch model: `master`+`dev` or `master`+`dev`+`stage`? | Step 15. |
| 4 | Keep `pwa-master-history` as archive or delete? | Step 11. |
| 5 | Keep local `refactor` branch? | Step 14. |
| 6 | Render/Vercel production branch — `master` (one-branch deploy) or `production` (branch-promotion model)? | Steps 6, 7, 15. |

## Recovery

Given MVP / 0-user state, rollback ceremony is minimal:

- All tasks are reversible until step 20–22 (GitHub repo archive + local rm). Even those are reversible: `gh repo unarchive`, re-clone.
- Tag `fork-point-2026-05-08` on monorepo and `pre-monorepo-fork-2026-05-08` on PWA + backend origins remain as ultimate anchors.
- If deploys break after Phase B, revert the Render/Vercel project source back to the old repos — they are still on GitHub until Phase E.
