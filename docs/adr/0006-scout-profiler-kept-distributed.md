# ADR-0006 — Scout/Profiler kept distributed; no `features/profiler/`

**Status:** Accepted

## Context
Scout and Profiler share ~80% of backend logic (prompt-persona split). The refactor's §3.1 left open whether the frontend should be one feature with two personas or two sibling features. Phase 9 extracted Scout into a thin `features/scout/`; Profiler functionality was already distributed across `features/customers/`, `features/mission-control/`, and `src/shared/profiler/`.

## Decision
No `features/profiler/` folder. Profiler stays distributed across customers + mission-control + `shared/profiler/`. The shared chat substrate (`ChatWithHistory` in `src/shared/chat/`) backs both Scout and Profiler chat.

## Consequences
Profiler has no single home — a reader looks in three places. Accepted as intentional asymmetry; revisit if Profiler grows a standalone routed surface. Tracked as TD-FE-60.
