---
artifact: spec-48-org-null-safety-profiler-integrity
artifact_type: impl
verdict: findings
reviewer_model: glm-5.2
date: 2026-07-10
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Change context: `git log -p master..HEAD` — 24 commits, ~160 KB (under the 200 KB budget, so **no
commit bodies were dropped**; all messages + diffs read). 51 files, +1710/-175. The branch carries
the plan's 13 tasks **plus** ~11 review-driven follow-up commits (e.g. "stop login blocking on org
resolution", "close WS1d gap" for the Settings company-profile save, "complete WS4" error/retry UI,
e2e `/api/org` mock fix, LeadStream pagination-narrowing) — all in-scope, no creep.

Slug: keyed to `48-org-null-safety-profiler-intelligence` (the plan basename) for end-to-end
traceability with the spec/plan review series. This **differs from the branch-derived slug**
(`spec-48-org-null-safety-profiler-intelligence`); noted here per convention.

Config loaded: `frontend/package.json` (engines `node >=21.2.0`; `verify`/`preflight` incl.
`knip --strict`; `lint --max-warnings 0`; `typecheck` via `tsc --noEmit -p tsconfig.app.json`),
`frontend/tsconfig.app.json` (`strict`, `noUnusedLocals`, `noImplicitAny`; `noUncheckedIndexedAccess`
off). No repo-root or backend config touched. Project rubric `docs/review-rubric.md` loaded — `## all`
(patch-target semantics) applies; there is **no** `## impl` section.

Verification performed: `npm run typecheck` **PASS**; `npm run lint` (--max-warnings 0) **PASS**;
grep confirms **zero** remaining `orgId || "brewra"` / `orgId ?? "org-123"` in `src` (excl. tests).
Backend WS3 `pytest` could **not** be executed in this sandbox — the backend `.venv`'s `python`
symlink points at a non-existent `/home/agent/.../uv` interpreter — so `dismissal.py`/`persistence.py`
were reviewed statically only (their patch-targets and partial-`$set` durability were verified in
prior turns). Procedural caveat: single-model (`glm-5.2`) pass; the spec cleared three such rounds.

## Findings

### [Low] Concurrent recommended-ICP deletes can lose a dismissed signature (read-modify-write, not atomic)

**Location:** `backend/app/services/icp/persistence.py` `delete_recommended_icp` — `dismissed = read_dismissed_signatures(document)` → `with_signature_added(...)` → `update_one({"$set": {..., DISMISSED_FIELD: dismissed_list}})`.

The delete reads the whole doc, computes the new dismissed list in Python, then `$set`s the full
list — a read-modify-write. Two near-simultaneous deletes each read the pre-delete doc and overwrite
the field, so the second write clobbers the first's just-added signature (lost update); that
signature is then absent from the set and the dismissed ICP can re-surface on the next `refresh`.
This is reachable through the FE's own UX: rapid double-reject starts two 5s undo timers whose
DELETEs land concurrently. The same refresh path reads `existing_icp` once at the top of `list_icps`
and filters against that snapshot, so a delete racing a refresh can miss a freshly-dismissed
signature too. At MVP/0-users with the spec's explicit "best-effort" bar this is low-impact, but it
is a real hole in the WS3 durability guarantee (Goal #4). Suggest recording the signature with an
atomic `$addToSet` on `DISMISSED_FIELD` (alongside the existing `icps` `$set`) instead of
read-then-`$set`-the-whole-list, which closes the delete-side race without changing the filter.

### [Nit] `ProfileDialog` renders a dead `https://` link when there is no org

**Location:** `frontend/src/features/shell/components/ProfileDialog.tsx` — `organizationDomain = orgId ? \`${orgId}.com\` : ""`.

With no org the domain is `""`, so the managed-by anchor renders `href="https://"` with empty text —
a non-functional link (the test asserts exactly `a[href="https://"]`). Cosmetic-only (ProfileDialog),
but emitting a broken `https://` anchor is worse than omitting it; prefer rendering no link when
there is no domain.

### [Nit] `fetchOrgId` alias on `AuthContext` is now dead in production

**Location:** `frontend/src/shared/auth/AuthContext.tsx` (`const fetchOrgId = resolveOrg;`).

`useLogin` no longer awaits it (removed by the "stop login blocking" commit), so no production caller
remains; it's retained only "for existing external references (test mocks)." `knip` won't flag a
context property, so it won't fail the gate, but it is semantically dead and the back-compat
rationale is weak (tests should mock what's used). Either drop it (updating any test mock that still
references the name) or remove the now-inaccurate "useLogin awaits this" lineage from the comment.

## Observations (no action)

- The impl directly closed every prior review finding: the WS3 refresh test now pins
  `DISMISSED_FIELD not in set_arg` (generate write is a partial `$set`, verified — durability sound);
  the reject test imports `PROFILER_PENDING_RECOMMENDED_REJECT_KEY` with an explicit anti-vacuous
  "positive control"; and the extra "WS1d gap" commit guarded the Settings company-profile save path
  the spec/plan reviews flagged. `dismissal.py`'s `_canonicalize` replaces punctuation with a space
  rather than the plan's delete — a necessary fix, since the plan's version would have failed its own
  `"Mid-Market" → "mid market"` canonicalization test.
- Adherence is complete: WS1(a)–(f), WS2, WS3 (BE+FE atomic), and WS4 all land; the 22 `brewra` + 3
  `org-123` literals are gone (verified); the three-state machine, cache-survives-transient,
  bounded-retry, generation-guard, and `orgStatus`-keyed route gate all match the spec. The
  `resolveOrg` loop is correct across cache/transient/no-org/resolved branches.
- The impl correctly **diverged** from the plan's stale "useLogin awaits `fetchOrgId`" assumption:
  awaiting it there would have duplicated resolution and re-introduced the login-block the route gate
  eliminates; removing it (route gate = single waiter) is the right call and is tested.
- Test discipline is notably high throughout — tests document why they can't pass vacuously (snapshot
  short-circuit reconcile, generation-guard supersede, reject retention), settle background retry
  loops deterministically, and use real MSW handlers with `onUnhandledRequest:"error"` rather than
  opaque unhandled failures.
- Pre-existing `console.log` in `SuggestedICPCards.tsx` (e.g. the DELETE request log) is unchanged
  context, not introduced here — part of the known console.log debt; not a finding.
- `onAuthStateChanged` re-resolution for a same-user re-fire is safe: with a warm cache the
  synchronous cache branch sets `resolved` in the same tick as the `pending` set, so React batches to
  a net `resolved` (no spinner flash / route remount); cold-cache is the intended loading path.
