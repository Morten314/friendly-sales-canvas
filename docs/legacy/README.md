# Legacy / archived documentation

Superseded docs kept out of the active tree. The authoritative sources are the code
itself, `docs/architecture/BACKEND.md`, `CLAUDE.md` / `AGENTS.md`, and the per-feature
`frontend/src/**/README.md` files.

## `ANALYSIS_MARKET_ICP_RESEARCH_ISSUES.md` — pre-modularization backend analysis

A one-time analysis of the market/ICP research paths written against the old flat
`backend/services.py` monolith; every `services.py:NNN` / `llm_config.py:NNN` citation
is now dead after the Phase F–L modularization. Still useful as a narrative of the
research-prompt issues — for current structure see `docs/architecture/BACKEND.md` and
`docs/PROMPTS.md`.

## Removed: pre-cutover PWA frontend guides (2026-06-15)

20 setup / integration / debugging guides (`PWA_*`, `SCOUT_*`, `REFRESH_FLOW_*`,
`JWT_INTEGRATION_GUIDE`, `CRM_API_INTEGRATION_GUIDE`, `RATE_LIMIT_SOLUTION`,
`REAL_WORLD_API_EXAMPLES`, `CORS_FIX_README`, `frontend-config`, and a dead frontend
`BRANCHES.md`) were copied from the legacy `PWA-multi-tenancy` repo into `frontend/`
root at cutover, briefly archived here, then **deleted**. They described the
pre-refactor `src/lib` / `src/pages` / `src/components` layout that the Spec-14 refactor
replaced, and no code path referenced them. Recoverable from this branch's git history
and from the `PWA-multi-tenancy` repo if ever needed.
