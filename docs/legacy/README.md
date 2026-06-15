# Legacy / archived documentation

Frozen, superseded docs moved out of the active tree during the **2026-06-15
documentation-staleness cleanup**. Nothing here describes current behavior. The
authoritative sources are the code itself, `docs/architecture/BACKEND.md`,
`CLAUDE.md` / `AGENTS.md`, and the per-feature `frontend/src/**/README.md` files.
These files are retained for historical reference (and remain in git history
regardless).

## `pwa-frontend/` — pre-cutover PWA frontend guides (19 files)

Setup / integration / debugging guides copied verbatim from the legacy
`PWA-multi-tenancy` repo into `frontend/` root during the monorepo cutover
(committed 2026-05-28). They describe the **pre-refactor** frontend layout
(`src/lib/*`, `src/pages/*`, `src/components/{market-research,signals,common}/*`),
which the 14-phase Spec-14 refactor replaced with the `features/` + `shared/`
structure. Every code path they reference is gone — treat them as PWA lineage,
not how-to guides.

- **PWA / service worker:** `PWA_SETUP`, `PWA_DIAGNOSTIC`, `PRODUCTION_PWA`,
  `DEV_VS_PREVIEW_PWA`, `QUICK_DIAGNOSTIC`, `CLEAR_SERVICE_WORKER`,
  `TEST_PWA_INSTALL`, `REFRESH_FLOW_EXPLANATION`, `REFRESH_FLOW_VERIFICATION`
- **API / integration:** `JWT_INTEGRATION_GUIDE`, `CRM_API_INTEGRATION_GUIDE`,
  `REAL_WORLD_API_EXAMPLES`, `RATE_LIMIT_SOLUTION`, `frontend-config`
- **Scout (pre-refactor component tree):** `SCOUT_API_REQUEST_SCHEMAS`,
  `SCOUT_COMPONENT_SCHEMAS`, `SCOUT_COMPONENTS_JSON_STRUCTURE`,
  `SCOUT_LEAD_STREAM_CONNECTION`
- **Branch model:** `BRANCHES.md` — the dead PWA `develop`/subtree-split model.
  The live monorepo branch model is the repo-root `BRANCHES.md`.

## `ANALYSIS_MARKET_ICP_RESEARCH_ISSUES.md` — pre-modularization backend analysis

A one-time analysis of the market/ICP research paths written against the old flat
`backend/services.py` monolith; every `services.py:NNN` / `llm_config.py:NNN`
citation is now dead after the Phase F–L modularization. Still useful as a
narrative of the research-prompt issues — for current structure see
`docs/architecture/BACKEND.md` and `docs/PROMPTS.md`.
