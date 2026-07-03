---
artifact: worktree-org-tenant-reunification
artifact_type: impl
verdict: findings
reviewer_model: glm-5.2
date: 2026-07-03
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Change context: `git log -p master..worktree-org-tenant-reunification` (17 commits). The combined patch was **320 KB** (over the ~200 KB budget); rather than drop commit bodies, the substantive code was read directly from the branch ref via `git show` (all 17 commit messages are retained above / in `git log`). No commit bodies were dropped from the review — the budget overrun came from the large `backend/app/services/org_auth/reconcile.py` + its 556-line test file plus the spec/plan/review docs, all of which were inspected directly.

Spec (`specs/46-org-tenant-reunification-design.md`) and plan (`plans/46-org-tenant-reunification.md`) were both loaded (round-1 reviewed + synthesized). This impl branch carries the spec/plan/review commits plus the 11 implementation commits (`3071124` → `d450f27`).

Config files loaded: `frontend/package.json` (engines + scripts: `preflight` = typecheck→lint→format→vitest→build→bundle:check→e2e→knip; `verify` = typecheck+lint+test:changed; `typecheck` = `tsc --noEmit -p tsconfig.app.json`), `frontend/knip.json` (present, `entry` configured). No repo-root `package.json`/`pyproject.toml` (polyglot repo, per AGENTS.md). Backend has no linter/ruff config.

Note: the final-review fix commit `a37586a` explicitly resolved two findings I raised in the round-1 plan review (Pinecone cross-user namespace corruption, and the unenumerated Mongo collection list) — `apply_report` now *always* defers org-scoped stores (Pinecone + `Company_Profile`/`Connector_Credentials`) to a manual operator step, and `_MONGO_ORG_COLLECTIONS` / `_MONGO_ORG_ONLY_COLLECTIONS` are concretely enumerated. Those are not re-raised below.

## Findings

### [Low] `useAuthToken` mints the JWT once and never re-mints when `orgId` changes — token can carry a stale org

**Location:** `frontend/src/shared/auth/useAuthToken.ts` — first `useEffect` (guard `if (firebaseAuth.currentUser && orgId && !jwtToken)`).

The generation effect is gated on `!jwtToken`, so a token is minted exactly once. On the exact bug path this spec exists to fix — a user with a **stale** `org_id_<uid>` cache — `AuthContext.fetchOrgId` optimistically `setOrgId(staleCache)` before the authoritative `GET /org` resolves. `useAuthToken` sees a truthy `orgId` (the stale value), mints the JWT against it, and sets `jwtToken`. When `GET /org` returns the fresh org and `orgId` flips stale→fresh, the first effect re-runs but `!jwtToken` is now false, so it does **not** re-mint; the second effect doesn't clear (orgId is truthy throughout). The token therefore carries the stale org until logout — directly contradicting the code's own comment ("keeps it consistent with the resolved org … never a persisted/stale tenant").

The JWT is not backend-validated (AGENTS.md "Auth reality check"), so this is cosmetic, hence Low. If it ever matters, regenerate when `orgId` changes (drop the `!jwtToken` guard or key the token to `orgId`).

### [Low] `apply_report` silently skips stray-bearing users whose canonical mapping is missing

**Location:** `backend/app/services/org_auth/reconcile.py` — `apply_report`, `if not canonical: continue`.

A user present in `report.migrations` (i.e. the `--report` found stray data for them) but whose `user_mappings` entry is absent at apply time is skipped with no log. For a reconciliation tool whose entire value proposition is visibility (the spec leans heavily on "logged, reviewable, before/after counts"), a silent skip of a stray-bearing user is an observability hole — the operator gets an `APPLIED`/`DEFER` line for every other user but nothing for this one, so it reads as "done" when it isn't. Emit a `SKIPPED user=… (no canonical mapping)` line so the operator can see the gap.

### [Low] `connect_user_to_org` reverse-uniqueness is a read-then-write TOCTOU

**Location:** `backend/app/services/org_auth/orgs.py` — `connect_user_to_org` (the `for mapped_user, mapped_org in user_mappings.items()` scan followed by the `update_one`).

The reverse-uniqueness check scans the in-memory `user_mappings` then writes back the whole doc; two concurrent connects targeting the same existing org could both pass the scan and both write. This is not on an automated high-concurrency path — registration mints a fresh UUID org per user, so the only way to hit it is two operator-driven `connect_user_to_org` calls to the same pre-existing org simultaneously — so Low at MVP scale (0 users, single FastAPI process). Flagging for the register; if concurrency ever lands, the check needs an atomic conditional update (`update_one` with a `$where`/filter guard) rather than read-then-write.

### [Nit] `fetchOrgId` is silent on a 200-with-non-success body, unlike the `!response.ok` path

**Location:** `frontend/src/shared/auth/AuthContext.tsx` — `fetchOrgId`, the `if (data.status === "success" && data.org_id)` branch's implicit else.

When `response.ok` is false there's an explicit `console.error`. When the response is 200 but `data.status !== "success"` (or `data.org_id` is absent), the function returns the cached value with no log at all. The two failure shapes are handled symmetrically in behavior (keep cache) but asymmetrically in diagnostics. For an anti-stale path, an unexplained "stuck on cache" deserves at least a `console.warn` so a future "why isn't my org updating?" is debuggable.

## Observations (no action)

- The two round-1 plan-review findings (Pinecone namespace cross-user corruption; unenumerated Mongo collection list) were both resolved by the final-review fix commit `a37586a` and verified in code — not re-raised.
- The plan-review import-path concern is resolved: `tests/unit/test_reconcile_orgs.py` imports via `from app.services.org_auth.reconcile import ...` (house style, run-from-backend), not the broken `from backend.scripts...`. `reconcile_orgs.py` is a thin CLI over the testable service module — good separation.
- WS4 status-code contract is correct and locked at both layers: `ConflictError→409`, `ValidationError→400` handlers in `app/main.py:97-106`, plus router-level tests in `test_auth_org.py` (`test_post_connect_org_rejects_non_uuid_org_id` → 400, owned-by-another → 409). `POST /connect_org` correctly does **not** expose `migrate` (defaults `False`).
- `ClientBundle` field names (`.driver` / `.client` / `.pc`) match `apply_report`/`load_inputs` usage exactly; the docstring callout is accurate.
- Idempotency is genuinely covered by a stateful test (`test_apply_is_idempotent_second_run_moves_zero_and_always_defers_org_scoped`) across two `apply_report` calls, not just asserted — and org-scoped deferral is tested in three distinct shapes (unclaimed non-canonical, shared canonical namespace, ambiguous multi-user stray).
- SignalsPage still reads `currentUser` from a separate `useAuth()` call (line 48) and LeadStream correctly drops a `currentUser` it never needed — no dangling references; `LeadsTable`'s `resolveUserIdOrgId` memo cleanly shed its three-fallback chain to a single `orgId` dep.
- The staged-rollout caveat from the plan ("WS4 enforcement must not be live before `--apply`") is conservative rather than blocking: WS4 only guards the *write* path, and registration mints a fresh UUID + empty mapping that passes all three checks, so deploying WS4 alongside the FE fix does not reject any legitimate automated flow. No action needed — recorded so the next reviewer doesn't re-flag it.
- Diff hygiene is clean: one logical step per commit, no unrelated changes, and `4ac4f20` (removing the orphaned tenant zod contract + query key) is correct completion of success-criterion #2 rather than scope creep.
- No hardcoded secrets/placeholders introduced; the Pinecone index name is hardcoded the same way as the existing codebase (`_retrieval.py`), consistent with current convention.
