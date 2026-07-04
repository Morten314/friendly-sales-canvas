---
artifact: worktree-spec-47-lead-fetch-limit
artifact_type: impl
verdict: clean
reviewer_model: glm-5.2
date: 2026-07-03
round: 1
base_ref: master
spec_loaded: true
plan_loaded: false
---

## Context

- Branch reviewed by ref (`master..worktree-spec-47-lead-fetch-limit`); not checked out.
- Change-context source: `git log -p master..<branch>` (4 commits, ~50 KB — under the 200 KB budget, no commit bodies dropped). All four commit messages read in full.
- Spec loaded: `specs/47-admin-lead-fetch-limit-design.md` (read from the branch via `git show`, since the spec file is new on this branch and absent on `master`). No plan file exists for this feature (implemented directly off the spec); adherence checking is against the spec only.
- Config files loaded: `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/knip.json`, `frontend/eslint.config.js`, `frontend/package.json`. No root-level or backend `pyproject.toml` / `setup.cfg` / ruff / mypy config exists — backend has no linter/type-checker wired (per AGENTS.md), so there are no false-premise invariants to honor there.
- New files are all reachable: `SettingsPage` is lazy-imported in `routes.tsx` (knip entry), `useAppSettings`/`updateAppSettings` consumed by the page, `admin.ts` fns consumed by the hooks, `AppSettingsSchema`/type consumed by `services` + `types`, `qk.adminSettings` consumed. No knip dead-export risk.

## Findings

### [Nit] Success state on the Settings page persists across subsequent edits

**Location:** `frontend/src/features/admin/pages/SettingsPage.tsx:67` (`{update.isSuccess && <p ...>Saved.</p>}`)

After a successful save the TanStack mutation stays in `isSuccess`. If the operator then edits the input again (e.g. to a new value, or even to an invalid one), the green "Saved." banner remains visible alongside the input until the next save resolves. Consider resetting the mutation state on input change (`update.reset()` in the `onChange`, or gate the banner on `data` freshness). Purely cosmetic; the underlying save/invalidation flow is correct.

## Observations (no action)

- The spec §6 asked for success/failure surfaced via `sonner` toast "matching the feature's existing error handling." The implementer instead used inline `<p className="text-red-600">…` / green text — which is the **actual** existing convention in the admin feature (`SystemHealthPage.tsx` uses the identical inline-error pattern, and no `sonner`/`toast` import exists anywhere under `frontend/src/features/admin/`). The spec's toast claim was inaccurate; following the real codebase convention was the right call. No change needed.
- The spec's testing section lists `GET /admin/settings` 401/403 cases. These are deferred in `test_settings_endpoints.py` (with a docstring noting the router-level `require_admin` gate is shared and unit-tested in `test_admin.py`). The gate is genuinely router-level and shared, so re-testing it per-endpoint is redundant — the deferral is reasonable. Behavior coverage (default-when-unset, stored-value, upsert, 422 bounds) is solid on both the endpoint and unit layers.
- `batch.py` / `search.py` dropped the old defensive `else` branch that re-parsed a non-dict `pre_data` and set `company_profile`. Verified that by the leads-fetch point `pre_data` is guaranteed to be a dict (the existing-headlines block at `batch.py:113-121` / `search.py:194-203` normalizes it in all branches, including the `except`), so the `if isinstance(pre_data, dict)` guard at the new callsite is always true. The removed code was dead; the simplification is correct, not a regression.
- `get_app_settings` (store) and `fetch_org_leads_for_signals` both catch broad `Exception` and degrade to defaults/empty. This is explicitly mandated by the spec ("never break callers") and is the correct posture for optional enrichment data. Flagged for awareness only.
- `fetch_org_leads_for_signals` performs a sync Mongo read + sync Neo4j fetch inline within the async `search.py`/`batch.py` paths (no `asyncio.to_thread`), whereas `lead_map.py` wraps its `get_app_settings` read in `asyncio.to_thread`. Pre-existing behavior (the old `get_leads_for_org` call was also synchronous there); not introduced by this change, and out of spec scope.
- `TD-014` tech-debt entry (commit `018f5a5`) accurately records the deferred single-Claude-call payload growth (50 signals × ≤500 leads) with a clear trigger — matches the spec's Risks #1 commitment.
