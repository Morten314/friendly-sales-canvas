# `src/features/` — feature modules

Each user-facing capability lives in its own folder here. Phases 5–12 of the frontend refactor (master Spec 14) extract the legacy `src/pages` / `src/components` code into these folders one feature at a time. Phase 4b populates the first one (`shell/`).

## Per-feature template

A feature is scaffolded by `npm run scaffold:feature -- <kebab-name>` (see `frontend/scripts/README.md`). The scaffolder emits exactly:

```
src/features/<feature>/
├── types.ts      # feature-local types
├── index.ts      # public re-exports — the cross-feature surface
└── README.md     # purpose, public surface, key files, dependency notes
```

`pages/`, `components/`, `hooks/`, `services/` are created **on demand** by the owning phase when first needed. Do **not** pre-create empty directories and do **not** add `.gitkeep`. `types.ts`, `index.ts`, `README.md` are always present.

## Naming map (kebab-case — living and authoritative)

Add a feature's name here **before** scaffolding it. Backend uses snake_case; the frontend uses kebab-case per JS convention.

| Feature           | Phase                                                      |
| ----------------- | ---------------------------------------------------------- |
| `auth`            | 10 (UI) — primitive lives in `shared/auth` from Phase 4b   |
| `customers`       | 7                                                          |
| `market-research` | 5                                                          |
| `mission-control` | 6                                                          |
| `scout`           | 8                                                          |
| `settings`        | 11                                                         |
| `shell`           | 4b                                                         |
| `signals`         | 6                                                          |
| `strategist`      | 8                                                          |
| `tenant`          | 10 (UI) — primitive lives in `shared/tenant` from Phase 4b |

`profiler` is **reserved** — Phase 9 decides the scout/profiler split (Spec 14 §8 Q10). Phase 12's small-page names (e.g. `calendar`, `deals`, `insights`, `reports`, `artifacts`) are appended **by Phase 12** when it runs. The scaffolder only _warns_ (does not block) on a name that is not yet on this map.

## Dependency rules (enforced by `eslint.config.js`, Spec 14 §3.3)

- `features/<X>` may import from `features/<X>` (self), `shared/`, `components/ui/`, and npm packages.
- `features/<X>` may import from `features/<Y>` **only via** `features/<Y>/index.ts` — never a deep path. Reaching into another feature's internals is a lint error.
- Circular feature dependencies are forbidden. If two features need each other, the shared surface moves to `src/shared/`.
- **Transitional exception (Phases 4b–12):** importing from not-yet-migrated legacy dirs (`src/contexts`, `src/hooks`, `src/lib`, `src/utils`, `src/pages`) is permitted and expected; the lint config does **not** forbid it. Cleanup is verified in Phases 11–12, at which point the rule may be tightened to forbid legacy-dir imports from `features/`.

## Public-surface convention

Cross-feature consumption goes through `index.ts`. A feature's internals (everything not re-exported from `index.ts`) are private.
