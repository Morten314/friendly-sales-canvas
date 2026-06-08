# ADR-0007 — Advisory-over-hard-fail gate posture (pre-launch)

**Status:** Accepted

## Context
At MVP / 0 live users, flaky or machine-dependent hard-fail gates erode trust faster than they catch regressions. Several candidate gates arose during the refactor: bundle-size budget, NFR wall-time thresholds, a stale-doc grep gate, and a zero-raw-fetch feature gate.

## Decision
Default to advisory (warn, never block) for noisy/machine-dependent checks while pre-launch. `bundle:check` is advisory; NFR wall-time gating was dropped (Phase 2c); the stale-doc gate was not built (replaced by a one-time cleanup); the zero-raw-fetch gate was relaxed to advisory. Deterministic gates (typecheck, lint, vitest, build, knip, visual regression) stay hard-fail in `preflight`.

## Consequences
Fewer false-merge-blocks; some regressions (bundle growth) caught by eye, not enforcement. Reconsider hard thresholds post-launch with real data.
