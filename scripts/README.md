# `frontend/scripts/` — developer scripts and re-baseline conventions

This folder holds standalone TypeScript scripts invoked by `npm run …` from `frontend/`. Most are one-shot audits and baselines that get re-run when an explicit phase calls for it. Two of them — the bundle comparator and the bundle baseline — have a conventional workflow worth documenting.

## Script inventory

- `build-audit-scorecard.ts` — Phase 0 LOC scorecard generator
- `build-lint-probe.ts` — Phase 2b pre-execution lint probe
- `build-strict-probe.ts` — Phase 2a pre-execution strict-TS probe
- `capture-bundle-baseline.ts` — writes the bundle baseline JSON (Phase 0 baseline; re-run by `bundle:rebaseline`)
- `check-bundle-budget.ts` — compares current `dist/` against the bundle baseline; advisory mode (always exits 0 on the comparator-success path)
- `measure-baselines.sh` — Phase 0 baseline orchestrator (NFR)
- `preflight.sh` — wrapper for `npm run preflight`
- `scaffold-feature.ts` — Phase 4a feature scaffolder; creates `src/features/<kebab-name>/` with `types.ts`, `index.ts`, `README.md`
- `scan-inline-blocks.ts` — utility for detecting repeated inline code patterns

## Scaffolding a feature

```bash
cd frontend
npm run scaffold:feature -- <kebab-name>
```

Creates `src/features/<kebab-name>/` with the canonical always-present files (`types.ts`, `index.ts`, `README.md`) from the per-feature template. It does **not** create `pages/components/hooks/services/` — add those on demand (no empty dirs, no `.gitkeep`).

Guard rails: refuses to overwrite an existing feature folder; rejects non-kebab-case names; **warns but does not block** if the name is not on the living naming map in `src/features/README.md`. Add the feature's name to that map before scaffolding a planned feature.

## Bundle re-baseline workflow

The bundle baseline at `docs/audits/2026-05-26-frontend-bundle-baseline.json` is the reference the comparator (`npm run bundle:check`) compares each build against. When a PR legitimately grows the bundle (e.g., Phase 3 lands TanStack Query, a future feature adds a heavy dep), the developer re-baselines:

```bash
cd frontend
npm run bundle:rebaseline
```

This runs `vite build` then overwrites the baseline JSON with the current build. **Commit the regenerated baseline as part of the same PR that grew the bundle.** Commit message convention: `chore(fe): re-baseline bundle for <reason>` (or a body line explaining the growth — e.g., "added TanStack Query for Phase 3 data layer").

The bundle comparator is currently in advisory mode (Phase 2c spec §1.3 resolution 1) — it prints deltas but exits 0. Re-baselining is therefore a discipline convention, not a hard requirement; the comparator will never block a PR. Future hardening (Phase 14) may flip this.

## VR re-baseline workflow

The Playwright visual-regression snapshots live in `frontend/e2e/**-snapshots/`. The threshold is set globally in `playwright.config.ts` (`expect.toHaveScreenshot.maxDiffPixelRatio: 0.02` — 2%). When an intentional UI change is being introduced:

```bash
cd frontend
npm run test:e2e:update-snapshots
```

Playwright regenerates the PNG snapshots to match the new UI. **Commit the regenerated PNGs in the same commit as the code change.** Commit message convention: `chore(fe): re-baseline VR for <reason>`, or include a body line explaining the visual change. The reviewer of the PR confirms the visual change was intentional by inspecting the new PNG files.

During the refactor phases (0–14 per master Spec 14), §2.2 forbids visual redesign. A VR failure is presumed to be a regression bug and investigated — re-baselining is the exception, not the rule, and the commit message should explain why the sub-pixel diff was unavoidable. Post-refactor, re-baselining becomes routine for intentional design changes.

## Cross-platform note for VR snapshots

VR snapshots are pixel-sensitive across host operating systems. To re-baseline on macOS or Windows, run inside the Playwright Docker image so PNGs are stable against the Linux CI/dev baseline:

```bash
docker run --rm -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.59.1-jammy \
  bash -c "npm ci && npm run test:e2e:update-snapshots"
```

(Same note is in `playwright.config.ts` comments next to the `toHaveScreenshot` block.)
