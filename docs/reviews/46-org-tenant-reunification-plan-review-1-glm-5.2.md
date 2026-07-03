---
artifact: plans/46-org-tenant-reunification.md
artifact_type: plan
verdict: findings
reviewer_model: glm-5.2
date: 2026-07-03
round: 1
---

## Findings

### [High] Single-branch atomic merge contradicts the staged rollout that gates WS4 behind `--apply`

**Location:** `## Global Constraints` → "Branch"; `## Rollout sequence` step (4); Task 7; Task 9.

The plan mandates a single branch (`worktree-org-tenant-reunification`) and the repo's cross-stack atomicity rule lands all tasks as one merge. But the rollout says: "(4) deploy WS4 enforcement (Task 7) once data is clean" and explicitly "Task 7 enforcement must not be live before the `--apply` cleanup, or existing violations would reject legitimate calls." A single-branch deploy is atomic — you cannot deploy Tasks 1-6 (the FE forward-fix) without also deploying Task 7 (WS4 enforcement). So "deploy WS4 last" is infeasible as written: the moment the merged branch ships, WS4 is live, before `--apply` (Task 9) has run.

This is an internal contradiction that changes the execution structure, not a wording slip. Resolve one of: (a) split WS4 onto a follow-up branch gated behind a completed `--apply`; (b) merge only after `--report`→`--apply` has run on Render; or (c) drop the "must not be live before `--apply`" claim — but only after verifying WS4 is actually safe pre-`--apply` (note: `connect_user_to_org` only guards the *write* path, and new-user registration creates a fresh UUID + empty mapping, so it likely passes all three checks; if so, the stated hazard is overstated and the gate is unnecessary). The plan currently asserts a hard constraint its own branch model violates.

### [Medium] Task 8's `--report` is hollow until Task 9 — defeats front-loading the read-only safety check

**Location:** Task 8, Step 3 (`_load_inputs` / `_scan_data_orgs`) and the trailing note "for Task 8 it may return `{}`"; `## Rollout sequence` step (1).

`_scan_data_orgs` is stubbed to return `{}` in Task 8 and "implemented alongside apply in Task 9." With empty `data_orgs_by_user`, `build_report` finds no strays and `--report` prints "(nothing to reconcile)" — i.e. the deliverable of Task 8 (a working read-only report) is non-functional. Yet rollout step (1) is "run `reconcile_orgs.py --report` on Render and review" *before* anything else ships. That first, risk-surfacing action cannot produce real output until Task 9 is merged and deployed. The unit test only exercises the pure `build_report` with hand-fed data, so the hollow scan isn't caught.

The read-only scan is precisely what `--report` exists for. Move `_scan_data_orgs` into Task 8 (it's read-only — no reason it must wait for the destructive Task 9), so `--report` is genuinely runnable as the first rollout action.

### [Medium] Pinecone repoint is org-namespace-scoped, not user-scoped — cross-user data-corruption risk pre-enforcement

**Location:** Task 9, Step 3 (`repoint_pinecone`, `apply_report`).

`repoint_neo4j` and `repoint_mongo` both filter by `user_id`, so they move only the target user's rows. `repoint_pinecone(index, from_ns, to_ns)` does not — it copies the *entire* `from_ns` namespace then `delete(delete_all=True, namespace=from_ns)`. Pinecone namespaces are keyed by `org_id` only (per AGENTS.md), with no `user_id`. During `--apply` (which runs *before* WS4 enforcement guarantees the 1:1 invariant — that's the premise of the reconciliation), an `org_id` can be canonical for user A and stray for user B. Repointing B's stray `from_org` namespace would copy+delete A's canonical vectors too, silently corrupting A. The seed case (slug `brewra`, `A5Bfx` uid — neither a canonical UUID) sidesteps this, but the plan presents `repoint_pinecone` as general. Add a guard: skip/defer Pinecone for any `from_org` that is *any* user's canonical org, or treat Pinecone as a separate manual step (the spec already flagged Pinecone as the least-clean store). As written, the Pinecone branch of `--apply` is unsafe in the general case.

### [Medium] Reconciliation test import paths won't resolve under the stated invocation

**Location:** Task 8 Step 1 (`from backend.scripts.reconcile_orgs import build_report`); Task 9 Step 1 (`from backend.scripts.reconcile_orgs import repoint_neo4j`); `## Global Constraints` → Backend gate ("run from `backend/`").

Tests are invoked as `cd backend && .venv/bin/python -m pytest ...`, i.e. CWD is `backend/`. With CWD=backend there is no importable `backend` package, and `backend/scripts/` has no `__init__.py` (confirmed: no existing test imports from `scripts/`). So `from backend.scripts.reconcile_orgs import ...` raises `ModuleNotFoundError` at collection. Use `from scripts.reconcile_orgs import ...` (and add `backend/scripts/__init__.py`), or invoke from the repo root. The existing `tests/unit/test_org_auth.py` shows the house style — `from app.services.org_auth import ...` (run-from-backend). Match it.

### [Low] Mongo repoint collection list is named, not enumerated

**Location:** Task 9 Step 3 (`repoint_mongo` → `_MONGO_ORG_COLLECTIONS`); "enumerate the report's store list from the spec."

For a destructive, store-spanning op, the exact `(db, collection)` tuples *are* the correctness — an omitted collection leaves data stranded silently, an extra one risks touching an unrelated store. The plan defers the concrete list to implementation with a prose pointer to the spec. Enumerate the list in the plan (Market Intelligence reports, Lead Market Scores, Signals, File Processing Status, Customer Profiles across `Scout_Agent` / `Profiler`) so it's reviewable and the `--report`/`--apply` counts reconcile against the same set.

### [Low] Independent backend tasks are serial by default, not by necessity

**Location:** Overall task ordering; `## Rollout sequence`.

WS4 (Task 7) and WS3 (Tasks 8-9) are backend-only with zero frontend dependency, and the FE chain (Tasks 1-6) is self-contained. Under `subagent-driven-development` / `executing-plans`, these two backend workstreams could run concurrently with the FE chain. The plan presents everything serially without flagging the parallelizable seam. Noting it would cut wall-clock and matches the repo's concurrent-worktree practice.

### [Low] Per-task regression signal for the routing rewrite is thin

**Location:** Task 5 (Step 4 changes 11 `routes.tsx`; Step 6 verifies via `ProtectedRoute.test.tsx` + `npm run typecheck`).

Task 5 rewrites 11 route files (dropping `requireTenant`) and unwraps `TenantProvider` / removes the tenant route, but the per-task regression check is a single ProtectedRoute unit test plus typecheck and a `requireTenant` grep. A mis-wired route (e.g. a route whose `requireTenant` removal also dropped a sibling prop, or the tenant route still referenced by a barrel) can pass typecheck and grep while breaking navigation. A quick app-shell render smoke (or running the affected feature's existing route test) at Step 6 would strengthen the regression signal before the heavier `preflight` e2e at merge.

## Observations (no action)

- FE task order (1→2→3→4→5→6) is in correct dependency order; each commit boundary is typecheck-green (Task 4 leaves `ProtectedRoute`/`TenantProvider` intact until Task 5; Task 5 leaves `shared/tenant` present until Task 6). The inter-task import states were checked and hold.
- Hidden prerequisites are well-surfaced: the backend `.venv` symlink instruction and the "sandbox can't reach prod DBs → operator runs in the Render shell" note are exactly the kind of unstated assumptions worth calling out.
- Spec drift is essentially nil — the plan faithfully encodes the synthesized spec (org-scoped query-key refetch on the stale→fresh flip, service-only `migrate`, Pinecone copy-by-id, the `selectedTenant` literal surviving only in `clearStaleTenantKeys`, the deliberate three-check WS4). The self-review notes accurately map all six success criteria.
- Abort/kill/recovery is delegated to the mandated `executing-plans` / `subagent-driven-development` report-and-wait skills (plan header); no separate abort criteria are required under that default.
- `ConflictError` and `ValidationError` are confirmed present in `app.core.exceptions`; `POST /connect_org` needs no change for WS4 (`migrate` defaults `False`) — the plan's "no router change" claim is verified.
- The destructive-op design (report-first, per-user, idempotent, before/after-logged, idempotent re-run moves zero) is sound for Neo4j/Mongo; the idempotency story only breaks down for Pinecone (see the Medium finding above).
