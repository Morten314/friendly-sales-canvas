---
synthesizes_review: worktree-spec-47-lead-fetch-limit-impl-review-1-glm-5.2.md
artifact: worktree-spec-47-lead-fetch-limit
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-07-04
round: 1
---

## Round Recommendation

no

Reason: The review verdict was already `clean` — a single **[Nit]** and six no-action observations, no Critical/High/Medium. The nit was verified correct against the shipped code and fixed (a two-line `onChange` guard plus a regression test); no design surface changed and the branch is unmerged. No further review round is warranted; the branch is merge-ready.

## Agreed Findings

- **[Nit] Stale "Saved." banner persists across subsequent edits — fixed.** Verified against the shipped code: `SettingsPage.tsx` rendered `{update.isSuccess && <p …>Saved.</p>}` while the `onChange` only called `setValue`, so TanStack's mutation stayed in `isSuccess` and the green banner remained after the operator edited the input again (until the next save resolved). Cosmetic — the save/invalidation flow itself was correct. **Fix made:** `onChange` now calls `update.reset()` when `update.isSuccess || update.isError`, clearing the stale result banner on the next edit; added a regression test ("clears the saved confirmation when the value is edited again"). All four `SettingsPage` tests pass; FE typecheck + lint clean on the touched files.

## Disagreed Findings

None — the sole finding was checked against the actual branch code and holds.

## Deferred Findings

None. The fix is a two-line guard on an unmerged branch; no reason to defer.

## Severity Disagreements

None. `[Nit]` is apt: purely cosmetic, no data-loss, no functional or security impact, and it self-corrects on the next save. Correctly below actionable severity.

## Observations (reviewer's no-action items — each re-verified, concurred)

- **`sonner` toast vs inline text (spec §6).** Confirmed no `sonner`/`toast` import exists anywhere under `frontend/src/features/admin/`; `SystemHealthPage.tsx` uses the identical inline red/green `<p>` pattern. The spec's "toast" claim was inaccurate; following the real feature convention (inline) was correct. No action.
- **`GET /admin/settings` 401/403 not re-tested per-endpoint.** `require_admin` is a router-level dependency shared by all `/admin` routes and is unit-tested in `test_admin.py` (`test_require_admin_*`); `test_settings_endpoints.py` documents the deferral in its module docstring. Re-testing the shared gate per-route is redundant. Behavior coverage (default-when-unset, stored-value, upsert, 422 bounds) is solid across the endpoint + unit layers. No action.
- **Dropped `else` branch in `search.py`/`batch.py`.** Independently verified: by the leads-fetch callsite `pre_data` is guaranteed to be a dict — the existing-headlines block (`search.py:194-203`, `batch.py:113-121`) normalizes it to a dict in every branch, including the `except`. The removed re-parse/`company_profile` fallback was dead; the simplification is correct, not a regression. No action.
- **Broad `except Exception` in `get_app_settings` and `fetch_org_leads_for_signals`.** Spec-mandated ("never break callers"; leads are optional enrichment). Correct posture. No action.
- **Sync Mongo/Neo4j read inline in the async `search.py`/`batch.py` paths** (vs `lead_map.py` wrapping `get_app_settings` in `asyncio.to_thread`). Pre-existing — the prior `get_leads_for_org` call at those sites was already synchronous/inline; not introduced by this change and out of spec scope. Noted, not changed.
- **`TD-014` accuracy.** The tech-debt entry (commit `018f5a5`) correctly records the deferred single-Claude-call payload growth (50 signals × ≤500 leads) with a concrete trigger, matching the spec's Risks #1 commitment. No action.

## Notes

- **Review-artifact location.** The glm-5.2 round-1 review lived only in the main checkout (`/projects/Brewra/brewra-gtm-intelligence/docs/reviews/`, untracked). It has been copied onto this branch alongside this synthesis so the review + synthesis pair is committed together, matching the existing committed review docs and the prior worktree-review precedent.
