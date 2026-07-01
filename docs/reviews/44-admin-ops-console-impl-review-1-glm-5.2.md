---
artifact: spec-44-admin-ops-console
artifact_type: impl
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-30
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Change-context source: `git log -p master..spec-44-admin-ops-console` (16 commits: 2 spec, 2 plan, 2 backend impl + 1 backend test, 9 frontend impl, 1 legacy-HTML cleanup). The combined `git log -p` patch was ~234 KB, over the ~200 KB budget; the bulk is the plan/spec doc bodies (1769 + 208 lines) and the two deleted legacy HTML tools (1572 lines), not the implementation code. Per the truncation rule, commit **messages** and the full `--stat` were retained; the implementation source was read directly via `git show <branch>:<path>` (branch state, not dropped bodies), so no implementation diff body was actually lost — only the doc/HTML-deletion bodies were bypassed.

Config files loaded from the branch (invariant-bearing): `frontend/tsconfig.json`, `frontend/package.json`, `frontend/eslint.config.js`, `frontend/knip.json`, `backend/pyproject.toml`. Repo-root `tsconfig.json` absent (frontend owns TS config).

Spec adherence was checked against `specs/44-admin-ops-console-design.md` (round-1 revised) and plan against `plans/44-admin-ops-console.md` (round-1 revised: Leads→v2 org-scoped, Documents tab added). The implementation follows the plan revisions, not the original spec text, where they diverge — correct, since the plan is the execution-intent record.

Endpoint existence verified on `master`: `GET /v2/leads?org_id=` (paginated, `backend/app/routers/v2/leads.py`) and `GET /v2/user-documents?org_id=` (paginated, `backend/app/routers/v2/data_sources.py`) both exist and match the shapes the FE hooks parse. `probe_llm` and the `get_llm2`/`get_mongo`/`get_neo4j_driver`/`get_pinecone` dependency providers exist on `master` with the signatures the router uses.

Filename slug note: this file uses `44-admin-ops-console` (not the literal branch-stripped `spec-44-admin-ops-console`) to sit alongside the existing `44-admin-ops-console-{design-spec,plan}-review-1` files for this same artifact.

## Findings

### [Medium] LLM health probe timeout (5.0s) is shared and likely too tight, producing false "timeout" badges for a healthy-but-slow model

**Location:** `backend/app/routers/admin.py:270` (`_PROBE_TIMEOUT_S = 5.0`), used by `_run_probe` at `backend/app/routers/admin.py:273-279`, applied to the LLM probe at `backend/app/routers/admin.py:298`.

The single `_PROBE_TIMEOUT_S = 5.0` governs all four probes equally. Three of them (Mongo `ping`, Neo4j `verify_connectivity`, Pinecone `list_indexes`) are sub-second connectivity calls where 5s is generous. The fourth — `probe_llm_health` → `probe_llm` (`backend/app/services/health.py`) — issues a real generation request (`"Generate a simple JSON: {\"test\": \"hello\"}"`) against the production model the app actually runs, currently Together-served **Qwen3-235B-A22B-Instruct-2507-tput** (the model `get_llm2` returns). A 235B round-trip for even a trivial prompt can plausibly exceed 5s, especially on a cold connection or under provider load. The spec's stated intent for D2 is that the panel *reflects whether the LLM the product runs is reachable* (spec §6 item 2, §D2); a too-tight timeout on exactly that probe inverts the signal — a healthy LLM renders as an amber "timeout" badge, which is the panel's single most important status.

Recommendation: give probes individual timeouts (e.g. 2–3s for the connectivity pings, 10–15s for the LLM generation), or replace the LLM *generation* probe with a cheaper liveness signal (a `max_tokens=1`/echo invoke, or a non-generation availability check) so the timeout reflects "is it up" rather than "did it finish a full generation in 5s". As written, the panel's LLM row is the least trustworthy of the four.

### [Medium] Spec-mandated TECH_DEBT entry for the open admin endpoints / cosmetic guard was not recorded

**Location:** `docs/TECH_DEBT.md` (not modified by the branch — `git diff --name-only master...spec-44-admin-ops-console` shows no `TECH_DEBT.md`); spec references at `specs/44-admin-ops-console-design.md:104` and `:184` ("record as a TECH_DEBT entry — promote to a real backend allowlist when there are live users"; "Tracked as accepted debt").

The spec explicitly calls for recording the accepted compromise as a TECH_DEBT entry, and `AGENTS.md` reinforces this ("add a new entry whenever you accept a quality compromise future agents/devs need to know about"). The compromise is real and intentional: `GET /admin/orgs` and `GET /admin/health` are mounted with no auth at all, and the FE `AdminGuard` is a cosmetic email-allowlist gate the backend does not honor (the data endpoints stay open, by design, per the repo's trust-client-IDs reality). The guard file (`adminAllowlist.ts`) and README both correctly note this is not a security boundary, but the *register* entry — the mechanism that ensures a future agent promotes it before live users arrive — was not added. Without the entry, the trigger ("when there are live users") has no home and will be silently missed. Recommendation: add a TECH_DEBT entry naming the open `/admin/*` surface + cosmetic guard, the target state (backend-enforced allowlist), the deferral reason (0 users), and the promotion trigger.

### [Low] Hook/contract test coverage is partial relative to the spec's testing section

**Location:** `frontend/src/features/admin/hooks/__tests__/` (only `useAdminOrgs.test.tsx`); spec testing list at `specs/44-admin-ops-console-design.md:162-166` ("Hooks — zod contract parses the real response shape").

The spec's FE testing list calls for zod-contract parsing across the hooks. Implemented tests cover `AdminGuard` (all four states — good), `useAdminOrgs` (parse), and `TenantsOverviewPage` search. Not covered: `useSystemHealth` (the one hook whose contract is brand-new to this feature, vs `useAdminOrgs` which mirrors a backend model also exercised by the backend tests), `useRegistrations`/the v2-paginated `RegistrationPageSchema`, and the inspection hooks. The most valuable missing one is `useSystemHealth`, since its `HealthProbe` shape (`status` ∈ ok/error/timeout, `latency_ms`, `detail`) is unique to this feature and drives the badge UI. The backend side is well covered (`test_admin.py` exercises orgs shape, empty-doc, health aggregate, and one-dep-down-doesn't-500). Recommendation: add at minimum a `useSystemHealth` contract test (and ideally a `useRegistrations` paginated-envelope parse test); the rest are defensible to defer given the inspection endpoints return `z.unknown()`.

## Observations (no action)

- `OrgDetailPage` (`frontend/src/features/admin/pages/OrgDetailPage.tsx:235-238`) fires all four inspection queries on mount regardless of which tab is active. For an internal spot-check tool at manual-refresh cadence this over-fetch is negligible; flagging for awareness only.
- `_run_probe` wraps each probe in `asyncio.wait_for(asyncio.to_thread(...))`; on timeout the request returns correctly (spec's no-hang requirement is met), but `to_thread` work cannot be cancelled mid-flight, so the underlying connectivity/generation call continues in the default executor thread until it completes or fails. Immaterial at ops-tool request volume — noted, not actionable.
- The Documents tab and the omitted "Data Sources" tab are the same concept (`/v2/user-documents` *is* the org-scoped data-sources list endpoint). The `README.md` justification ("no org-scoped list endpoint exists") is imprecise — the endpoint it cites as absent is the one the Documents tab consumes — but the resulting single-tab behavior is correct and sensible. Wording only.
- The console surfaces pre-existing write endpoints (`POST /org`, `POST /connect_org`) via the Tenants toolbar. These are intended parity capabilities (spec §A), not new exposure introduced by this change.
