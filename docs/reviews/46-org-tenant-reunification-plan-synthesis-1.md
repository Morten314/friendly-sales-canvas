---
synthesizes_review: docs/reviews/46-org-tenant-reunification-plan-review-1-glm-5.2.md
artifact: plans/46-org-tenant-reunification.md
artifact_type: plan
reactor_model: claude-opus-4-8[1m]
date: 2026-07-03
round: 1
---

## Round Recommendation

no

Reason: All seven findings agreed and revised into the plan; the lone High is resolved by verification (WS4 is only reachable via admin/reconciliation, never normal flow, so the atomic merge is safe) — no High remains and no revision opened new design surface.

## Agreed Findings

- **#1 (single-branch merge vs. staged WS4 gate):** Verified `connect_user_to_org` is reachable only via the admin console (`features/admin/services/admin.ts` → `POST /connect_org`) and the reconciliation script — never in the normal user/login flow. WS4 enforcement is therefore safe to ship in the atomic merge. Revised the Rollout sequence + Global Constraints to **drop the false "WS4 must not be live before `--apply`" gate**; keep the single-branch atomic merge; the only ordering that matters is `--report`→review→`--apply` on Render, which is operational, not a branch split.
- **#2 (`--report` hollow until Task 9):** Moved `_scan_data_orgs` (read-only) into **Task 8**, so `--report` produces real output as the first rollout action; Task 9 now adds only the destructive `--apply`. Removed the "may return `{}`" stub note.
- **#3 (Pinecone repoint is org-scoped → cross-user corruption pre-1:1):** Added a safety guard — `repoint_pinecone` runs **only for a `from_org` that is not any user's canonical org** (a truly orphaned namespace, e.g. the `brewra` slug / `A5Bfx` uid). Any `from_org` that is canonical for some user is **deferred to a logged manual step**, and `--report` labels each stray namespace Pinecone-safe vs. manual.
- **#4 (test import paths won't resolve):** Relocated the testable logic to `app/services/org_auth/reconcile.py`; `backend/scripts/reconcile_orgs.py` becomes a thin CLI that imports it. Tests import `from app.services.org_auth.reconcile import …` (house style, run-from-`backend`), eliminating the `backend.scripts`/missing-`__init__.py` problem.
- **#5 (Mongo collection list named, not enumerated):** Enumerated the verified org-keyed collections and mandated a **single shared `_MONGO_ORG_COLLECTIONS` constant** (referencing the existing persistence-module constants) used by both `--report` scan and `--apply`, plus an explicit audit step so the destructive set is reviewable and cannot drift between report and apply.
- **#6 (independent backend tasks serial by default):** Added a parallelization note — the FE chain (Tasks 1-6) and the backend workstreams (Tasks 7; 8-9) are independent and may run concurrently under subagent-driven/executing-plans, matching the repo's concurrent-worktree practice.
- **#7 (thin routing-rewrite regression signal):** Strengthened Task 5 Step 6 with an app-shell/protected-route smoke render (mounts a couple of `requireTenant`-stripped routes) in addition to the ProtectedRoute unit test, typecheck, and grep — catches mis-wired navigation before the merge-time e2e.

## Disagreed Findings

None. Each finding was verified against the codebase and holds.

## Deferred Findings

None.

## Severity Disagreements

None. #1 is a genuine structural self-contradiction (High is fair); its resolution is a one-section simplification, but the finding correctly caught a plan defect that would have derailed rollout.

## Open Questions

- **Lead Market Scores storage:** the market scores surfaced in the RCA live on Neo4j `:Lead` nodes (covered by `repoint_neo4j`), not a distinct Mongo collection — so the enumerated Mongo set may be complete, but the Task 8/9 audit step must confirm no separate `Lead_Market_Scores` Mongo collection is org-keyed. Surfaced, resolved at implementation via the audit step + `--report` per-store counts.
- **New-user org assignment path:** org assignment appears to be an admin-console action (`create_org` + `connect_org`), not an automatic signup step. If a future automatic signup→connect path is added, it must call `connect_user_to_org` with the strict default (which it satisfies by construction). Not blocking.
