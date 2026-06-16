---
artifact: phase-37-tech-debt-paydown
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.2
date: 2026-06-15
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

- Reviewed the aggregate net change `git diff master...phase-37-tech-debt-paydown` (28 commits, ~1989 insertions / 1738 deletions, 79 files), not commit-by-commit. Spec `specs/37-tech-debt-paydown-design.md` and plan `plans/37-tech-debt-paydown.md` loaded for adherence; Wave-0 confirmations note (`docs/reviews/37-wave0-confirmations.md`) reviewed.
- **Backend gate not run locally:** `backend/.venv` is a broken symlink to an interpreter absent in this checkout (`/home/agent/.local/share/uv/python/cpython-3.12.12…`), so `backend/tests/` pytest could not be executed here. Backend correctness (TD-005/-012/-71 + the v1→v2 test migrations) was assessed by diff inspection; the serial preflight + `backend/tests/` gate is the implementer's responsibility per the plan's merge gate. Frontend behavior tests were assessed by reading the new/edited test modules (no FE runner available in this checkout either).
- Adherence is strong: every in-scope entry from spec §2.1 maps to a shipped change, and the plan's discrepancy-ledger corrections (regulatory path, three default copies, `setUserLocalStorage` routing, v1-route deletion with test migration, TD-FE-36 reclassification, TD-FE-25 read-only-only) are all reflected in the diff. The two correctness bugs (TD-FE-64 CSV, TD-FE-23 chartType) are fixed and tested. No scope creep observed; the only deviation is the `setIsSaving` no-op branch the plan explicitly offered (Finding L1).

## Findings

### [Low] `setIsSaving` no-op leaves dead call sites and a misleading comment

**Location:** `frontend/src/features/mission-control/components/data-sources/useDocumentSync.ts:60`; `frontend/src/features/mission-control/components/data-sources/DataSourcesManager.tsx:87,306,569,727,751,777,1010,1168`

The dead `_isSaving` state was removed as planned, but because `DataSourcesManager` calls `setIsSaving(...)` at 8 sites (true before upload/delete, false after), the hook now exposes `setIsSaving` as a permanent no-op (`const setIsSaving: DocumentSyncApi["setIsSaving"] = () => {};`). The `isSaving` value is never read anywhere (grep-confirmed), so this is behavior-preserving and the plan explicitly sanctioned this branch. Two residual issues remain: (1) the hook comment claims "The saving flag itself is owned by the consumer (DataSourcesManager)" — false, the consumer owns no such flag, it calls a no-op; (2) 8 `setIsSaving(...)` call sites in `DataSourcesManager` are now silently dead, which will mislead future readers into thinking there is saving-state tracking. The actionable minimum is fixing the comment; the cleaner fix is dropping the interface field + the 8 call sites (out of this phase's scope).

### [Low] New profile read hooks bypass the shared transport / rate limiter

**Location:** `frontend/src/features/settings/services/profile.ts:7-18`; consumers `hooks/useUserProfile.ts`, `hooks/useAgentProfile.ts`

`fetchOwnProfile` uses raw `fetch`, matching the original `SettingsPage` behavior it was extracted from, so this is not a regression. But the sibling hook `useCompanyProfile` (and the rest of the data layer) routes through `apiFetch` (`src/shared/api/transport.ts`), which attaches auth headers and enforces the 30 req/min rate limiter. The two new `useQuery` hooks sit outside that transport, so they neither attach headers (harmless — the backend trusts `user_id` params per CLAUDE.md) nor count against the limiter. Inconsistent with the surrounding pattern; worth routing through `apiFetch` in a follow-up so the settings reads aren't a transport exception.

### [Low] SettingsPage page-level loading indicator was removed

**Location:** `frontend/src/features/settings/pages/SettingsPage.tsx` (`loading` state + "Loading profile data…" branch deleted)

Dropping the orphan company fetch + `profileData` prop flow (TD-FE-11) also removed the page-level `loading` gate that rendered "Loading profile data…" before the profile component. `UserProfile`/`AgentProfile` now self-fetch via their own hooks, so on profile selection the form renders immediately seeded empty, then re-populates when the query resolves. Minor UX regression (brief empty-form flash); acceptable for MVP and out of the entry's stated scope, but the loading affordance is genuinely gone rather than relocated to the components.

### [Nit] Dead v1-shape legacy fallback retained in `fetchDataSources`

**Location:** `frontend/src/features/mission-control/services/missionControl.ts:23-27`

After `items` is empty, the service still falls back to `legacy.files ?? legacy.documents ?? legacy.data` — the bare-array shapes the **deleted** v1 `/user-documents` route used to return. The v2 envelope always carries `items`, so this branch is now unreachable defensive code, and it's slightly inconsistent with TD-005 (which removed the v1 shape) landing in the same phase. Harmless and pre-existing; noting only because the comment still references "a legacy v1 `files` array."

### [Nit] Unused `enabled` parameter on the new profile hooks

**Location:** `frontend/src/features/settings/hooks/useUserProfile.ts:9`, `hooks/useAgentProfile.ts:9`

Both hooks declare `enabled = true` and gate with `enabled && !!userId`, but neither call site (`useUserProfile(currentUser?.uid)`, `useAgentProfile(currentUser?.uid)`) ever passes it, and `!!userId` already disables the query without a user. The param is dead surface area.

### [Nit] `AgentConfigForm` changed the agent-name field label from "Agent Name" to "Agent"

**Location:** `frontend/src/shared/agent-config/AgentConfigForm.tsx` (the `<Label htmlFor="agentName">Agent</Label>`)

The original `AgentProfile.tsx` labelled this field "Agent Name"; the unified form shortens it to "Agent" (and its test asserts `getByText("Agent")`). Intentional simplification, not a bug, but it is a small copy regression on a user-visible label that the unification task didn't call out.

### [Nit] Stray double blank lines where v1 response models were removed

**Location:** `backend/app/models/data_sources.py:49-50`; `backend/app/models/signals.py:54-55`

Removing `ListUserDocumentsResponse` / `FetchSignalsResponse` left an extra blank line at each site. Cosmetic; not prettier-gated on the backend.

### [Nit] `ComplianceVisualCard` `chartType`-fallback path is tested only in the non-expanded branch

**Location:** `frontend/src/features/market-research/components/intelligence/regulatory-compliance/__tests__/ComplianceVisualCard.test.tsx:65-83`

The new test renders a `chartType`-keyed card with `isExpanded={false}`, exercising the non-expanded dispatch. The expanded branch has 9 `chartType` reads that share the identical `card.type ?? card.chartType` normalization, so they are very likely fine — but the `chartType`-keyed contract is only asserted on one of the two render paths. A second assertion with `isExpanded` would close the gap.

### [Nit] `refresh()` on SignalsPage is fire-and-forget with no error handling

**Location:** `frontend/src/features/signals/hooks/useSignalLeadMap.ts:55-60`; `frontend/src/features/signals/pages/SignalsPage.tsx:690` (`void refreshLeadMap()`)

`refresh()` awaits `fetchSignalLeadMap(..., { refresh: true })` and `setQueryData`s the result with no try/catch; the page invokes it via `void`. Per the plan's deliberate decision this control is dormant until `/signal-lead-map_claude` deploys (TD-FE-73), so today a click produces a 404 → unhandled promise rejection (silent in prod, noisy in dev console). Plan-sanctioned omission (no `disabled`/loading/error UX was explicitly deferred to the endpoint ship), noting only that "no UX" still leaves an unhandled rejection rather than a clean no-op.
