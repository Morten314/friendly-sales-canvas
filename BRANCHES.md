# Branches

The monorepo cutover is **complete**. `master` is the single integration trunk; all work happens on short-lived branches that merge back.

| Branch | Role | Policy |
|---|---|---|
| `master` | Stable trunk / single integration branch. | No direct feature commits — branch off `master`, review when warranted, merge back with `--no-ff`. Direct commits reserved for trivial doc/typo fixes. |
| legacy (`develop`, `production`, `refactor`, `pwa-*`, `pwa-master-history`) | Dormant pre-cutover history. | **Read-only — do not commit.** Retained a few months for issue triage / rollback and business reasons, then pruned. Not active development targets. |

## Discipline rules

- Feature/phase work happens on a short-lived branch named `phase-N-*` (or feature-named), cut off `master`, merged back via `--no-ff` after a green local `npm run preflight` (see "AI-Native Development" in CLAUDE.md). Review depth is judgment: plan execution, multi-commit refactors, and non-trivial logic warrant it; trivial fixes don't. Delete branches after merge.
- The legacy branches are a frozen safety net from the fork/cutover, not sync or commit targets.

## Legacy branches (retained dormant)

`develop`, `production`, `refactor`, `pwa-*`, and `pwa-master-history` are pre-cutover history, kept read-only for a few months for issue triage, rollback, and business reasons, then pruned. They are not sync or active-development targets.

## Recovery anchors

- Tag `pre-monorepo-fork-2026-05-08` (PWA + backend origins at fork moment).
- Tag `fork-point-2026-05-08` (monorepo `master` initial post-import state).
- `pwa-master-history` (full PWA pre-fork history with original SHAs).
