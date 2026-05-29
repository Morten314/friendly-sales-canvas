# `shell` feature

## Purpose

_TODO: one paragraph — what this feature does and the user-facing surface it owns._

## Public surface

_The cross-feature API, re-exported from `index.ts`. Other features import only these, only via `@/features/shell`._

- _TODO_

## Key files

- `index.ts` — public re-exports (the cross-feature surface)
- `types.ts` — feature-local types
- _TODO: pages/, components/, hooks/, services/ as they are added_

## Dependency notes

- May import from: `@/features/shell/*` (self), `@/shared/*`, `@/components/ui/*`, npm packages.
- May import another feature **only** via its `index.ts` (`@/features/<other>`), never a deep path.
- Transitional (Phases 4b–12): may import not-yet-migrated legacy dirs (`@/contexts`, `@/hooks`, `@/lib`, `@/utils`, `@/pages`).
