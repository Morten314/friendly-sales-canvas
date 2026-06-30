---
synthesizes_review: docs/reviews/44-admin-ops-console-plan-review-1-glm-5.2.md
artifact: plans/44-admin-ops-console.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-30
round: 1
---

## Round Recommendation

no

Reason: The one Critical is fixed in-place against now-verified endpoint signatures; the remaining revisions reuse the established inspection-tab pattern and reduce surface (drop fan-out), so no Critical/High remains and no significant new design surface was opened.

## Agreed Findings

- **[Critical] Leads tab targets the wrong endpoint.** Verified: `leads.py:20` is `get_all_leads(org_id: str = Query(...))` — `org_id` required, **no `user_id`**, deprecated + 500-capped; `v2/leads.py` exposes `GET /api/v2/leads?org_id=` → `PaginatedResponse`. My `fetchOrgLeads(userIds)` would 422 on every call. Revised Task 5 (`fetchOrgLeads(orgId)` → single `v2/leads?org_id=` via `paginatedSchema`), Task 6 (`useOrgLeads(orgId)`, dropped `userIds`), Task 8 (dropped the fan-out + "No users mapped" guard), and divergence #3.
- **[Medium] Divergence #1 rationale false — `GET /api/v2/user-documents?org_id=` exists.** Verified `v2/data_sources.py` (`list_user_documents` → `PaginatedResponse[UserDocumentEntry]`). I only checked v1 routers. **Re-added a Documents inspection tab** (no new backend): Task 5 `fetchUserDocuments(orgId)`, Task 6 `useUserDocuments(orgId)`, Task 8 Documents tab, query key `adminUserDocuments`. Divergence #1 rewritten: 5→4 tabs, only Data Sources dropped.
- **[Medium] Divergence #3 rationale invalid.** Corrected: `user_ids` on `/admin/orgs` is now display-only (shown in the Org Detail header), explicitly **not** used for leads (org-scoped). No code path calls `/leads` with a user id.
- **[Low] No explicit abort criteria.** Added an "Abort condition" line to Global Constraints (stop-and-report if a new endpoint's live shape can't be confirmed or a reused endpoint 4xxs; names the trigger the mandated skills already honor).
- **[Low] Pages 7–10 serialized though independent.** Added a Parallelization note before Task 7 (pages are independent after Tasks 3/5/6; 11–12 follow).

## Disagreed Findings

None. All five findings verified correct against live code.

## Deferred Findings

- **Data Sources inspection tab.** Genuinely has no org-scoped *list* endpoint (`data_sources.py` is upload/status/delete only) — confirmed half of the reviewer's own bundled finding. Deferred as out-of-scope (recorded honestly in divergence #1, not as "impossible"). Trigger: an org-scoped data-sources list endpoint is added to the backend.

## Severity Disagreements

- **[Critical] Leads endpoint:** agree with the severity. It is runtime-breaking (422 → error state for every org), not merely degraded — Critical is correct.

## Open Questions

None. Note (no action): the Leads and Documents tabs fetch only the first page (`limit=500`) of the v2 envelope — acceptable for an ops spot-check, consistent with the current-view posture used for registrations export; whole-dataset paging in those tabs is out of scope.
