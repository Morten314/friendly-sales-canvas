---
artifact: plans/44-admin-ops-console.md
artifact_type: plan
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-29
round: 1
---

## Context

Review performed with each load-bearing claim checked against the live codebase (`backend/app/routers/`, `app/routers/v2/`, `app/core/dependencies.py`, `app/services/org_auth/orgs.py`, `app/services/health.py`, `app/models/org_auth.py`, `backend/tests/conftest.py`; FE: `shared/api/client.ts`, `shared/api/pagination.ts`, `shared/api/queryKeys.ts`, `shared/auth/AuthContext.tsx`, `shared/components/`, `test/msw/`). Most backend plumbing and FE primitives are verified-correct (see Observations). The findings cluster around one capability whose underlying endpoint assumption is wrong (Leads), plus two "Spec divergences" whose stated rationales are factually incorrect. The plan is otherwise well-sequenced, appropriately sized, and test-first throughout.

## Findings

### [Critical] OrgDetailPage Leads tab fans out `/leads?user_id=`, but `/leads` is keyed by required `org_id` (and is deprecated + 500-capped) — the entire Leads tab 422s at runtime

**Location:** Task 5, `services/admin.ts` → `fetchOrgLeads` (lines 806–813: ``apiGet(`leads?user_id=${enc(uid)}`, …)``); Task 6 → `useOrgLeads(orgId, userIds)` (lines 1001–1008); Task 8 → `OrgDetailPage` Leads tab + the `userIds.length === 0` guard (lines 1265, 1297–1303); divergence #3 (lines 1739–1740).

`GET /leads` (`app/routers/leads.py:20`) declares `org_id: str = Query(...)` (required) and takes **no** `user_id` param — the service is `get_leads_for_org(driver, org_id=org_id)`. It is also marked **deprecated** (`Deprecation: true`, successor `/api/v2/leads`) with a **silent 500 cap**. So every `fetchOrgLeads` call `leads?user_id=<uid>` fails with **422 Unprocessable Entity** (missing required `org_id`), `apiGet`'s zod parse throws, and the Leads tab renders its error state for every org. The capability is non-functional, not merely degraded.

The premise is wrong in two further ways: leads are **org-scoped, not user-scoped**, so the multi-user fan-out (`Promise.all` over `userIds`) is both broken *and* unnecessary — one call per org suffices. Fix: replace the Leads data source with a single `GET /api/v2/leads?org_id=<orgId>` (v2, `app/routers/v2/leads.py:12`, returns the `PaginatedResponse` envelope `{items,total,limit,offset}`), parse with `paginatedSchema(z.unknown())`, and drop the `userIds` fan-out + the "No users mapped" guard. This also removes the need for divergence #3 (see next).

### [Medium] Divergence #1 rationale is false — v2 `GET /api/v2/user-documents?org_id=` exists, so the Documents inspection tab is achievable and was dropped on an incorrect premise

**Location:** "Spec divergences" #1 (line 1738: *"the current routers expose no org-scoped … user-documents endpoint … Inspection is scoped to the three confirmed endpoints; the other two are dropped"*); README "Scope notes" (lines 1653–1654); Task 8 scope note (line 1234).

`GET /api/v2/user-documents?org_id=` exists (`app/routers/v2/data_sources.py:11`, `list_user_documents(mongo, org_id, …)` → `PaginatedResponse[UserDocumentEntry]`). So the Documents inspection tab is not blocked by a missing endpoint — the plan's stated reason for excluding it ("no org-scoped read endpoint exists") is incorrect. (Data Sources may genuinely lack a simple org-scoped list — `data_sources.py` exposes only `/upload-document` and `/document-status` — so half of the bundled claim holds.) Either re-include a Documents tab against the v2 user-documents endpoint, or change the rationale to an honest scope-cut ("out of scope for MVP"), so the divergence record isn't misleading. As written, a future reader will believe a Documents tab is impossible when it isn't.

### [Medium] Divergence #3 rationale is invalid — `user_ids` was added to `/admin/orgs` to enable the broken `/leads?user_id=` fan-out

**Location:** "Spec divergences" #3 (lines 1739–1740: *"`/admin/orgs` returns `user_ids` per org … Needed so Org Detail's Leads tab can fan out `/leads?user_id=`"*); Task 1 `AdminOrgSummary` (line 67, lines 147–153).

The sole stated justification for adding `user_ids` to `/admin/orgs` is the Leads fan-out — which the Critical finding shows is the wrong design (leads are org-keyed). `user_ids` is harmless and arguably useful for display ("this org has N users: …"), but the recorded rationale is incorrect and points implementers at the broken fan-out. Correct the rationale (e.g. "shown in the Tenants table / Org Detail header for operator awareness") and ensure no code path still tries to use `user_ids` to call `/leads`.

### [Low] No explicit kill/abort criteria for the whole plan

**Location:** Global Constraints / Merge gate (lines 1728–1732).

The plan states per-task success signals and a preflight merge gate, but defines no condition under which the *effort* is abandoned (e.g. "if `/admin/orgs` shape can't be confirmed live, stop and report"). This is calibrated **Low** because the plan explicitly mandates `executing-plans` / `subagent-driven-development` (line 3), whose report-and-wait-on-failure behavior is the default safety net. Add one line naming the abort condition (or rely on the skill's report-and-wait) to make the recovery contract explicit.

### [Low] Pages 7–10 are independently parallelizable but serialized

**Location:** Task 7 (TenantsOverviewPage), Task 8 (OrgDetailPage), Task 9 (RegistrationsPage), Task 10 (SystemHealthPage).

Once contracts (Task 3), services (Task 5), and hooks (Task 6) land, the four pages have no interdependencies and no shared mutable state — they could be implemented in parallel branches. The plan runs them strictly serially. Not a correctness issue; flagging per the parallelizability checklist. If execution speed matters (or if dispatching to parallel agents), these four are the natural fan-out point. The cleanup (Task 12) and route-wiring (Task 11) must still come after all pages.

## Observations (no action)

- **The plan resolved three spec-review-1 findings directly:** (1) Registrations use the v2 paginated envelope (`fetchRegistrations`, lines 776–779, with an explicit "NOT the deprecated/capped v1" comment) — fixes the spec's registration-endpoint mismatch; (2) `probe_llm` is wired via the real `get_llm2` dependency (Task 2 interfaces, line 273) — fixes the spec's "probe_llm dependency wiring unspecified"; (3) per-probe `asyncio.wait_for` 5s timeout (lines 455–464) — fixes the spec's "guards errors, not timeouts." Good closure loop.
- **Test plumbing is sound.** The backend `client` fixture exists at `tests/conftest.py:183` (all-mocks TestClient); the plan's `app.dependency_overrides[get_*]` pattern matches the established approach and correctly overrides the fixture's base mocks per-test.
- **`/profile/company?org_id=` and `/customer_profile?org_id=` are confirmed working** — the former resolves through `GET /profile/{profile_type}` (`profiles.py:27`, accepts `org_id`, loose-typed), the latter is org-scoped (`customer_profile.py:18`). The plan's `z.unknown()` tolerant parsing for both is appropriate.
- **CSV export is well-scoped and safe:** formula-injection guard (`/^[=+\-@]/`) + "Export CSV (this page)" labelling (line 1395) resolves the spec-review export-ambiguity concern explicitly.
- **Health probes run in parallel** (`asyncio.gather` + `asyncio.to_thread`, lines 479–484) and the "one dep down does not 500" case is test-covered (lines 312–339).
- **`AdminGuard`'s loading-spinner branch is technically unreachable:** `AuthContext` renders children only when `!loading` (`AuthContext.tsx:154`), so by the time `<AdminGuard>` mounts, `loading` is already false. Harmless defensive code — no change needed.
- **No overengineering detected.** Scope is well-bounded, tasks are single-concern and reviewable, TDD is applied consistently (failing test → implement → green → commit). Commit granularity (one logical step per commit) follows the repo rule.
