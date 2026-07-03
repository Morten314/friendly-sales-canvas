---
synthesizes_review: docs/reviews/46-org-tenant-reunification-impl-review-1-glm-5.2.md
artifact: worktree-org-tenant-reunification
artifact_type: impl
reactor_model: claude-opus-4-8[1m]
date: 2026-07-03
round: 1
---

## Round Recommendation

no

Reason: All four findings are Low/Nit and verified correct for this codebase; three are cheap, low-risk fixes applied now, one is deferred with a stated trigger. No High/Critical remains and no fix opens new design surface, so no re-review round is warranted. (The reviewer also confirmed the two round-1 plan-review Highs — Pinecone cross-user corruption + unenumerated Mongo collections — were already resolved by `a37586a`.)

## Agreed Findings

- **#1 [Low] `useAuthToken` mints the JWT once and never re-mints on `orgId` change.** Confirmed: the generation effect is gated on `!jwtToken` and the clear effect only fires on `!orgId`, so a stale→fresh `orgId` flip leaves a token minted against the stale org — directly contradicting the effect's own "or org changes" comment. Cosmetic (the JWT is not backend-validated per the "Auth reality check"), but it contradicts the spec's anti-stale intent and the code's own comment. Fix: collapse the two effects into one keyed on `[currentUser, orgId]` (drop the `!jwtToken` guard and the `jwtToken` dep) so the token regenerates whenever `orgId` changes and clears on logout/no-org; a `cancelled` cleanup flag prevents an out-of-order set on rapid changes.
- **#2 [Low] `apply_report` silently skips a stray-bearing user whose canonical mapping is absent at apply time.** Confirmed: `if not canonical: continue` emits nothing, so for a tool whose value is visibility the operator reads "done" when a user was skipped. Fix: emit a `SKIPPED user=… (no canonical mapping)` line before `continue`.
- **#4 [Nit] `fetchOrgId` is silent on a 200-with-non-success body**, unlike the `!response.ok` path which `console.error`s. Confirmed: the implicit else of `if (data.status === "success" && data.org_id)` returns the cache with no diagnostic. Fix: add a `console.warn` there so a future "why isn't my org updating?" is debuggable.

## Disagreed Findings

None. Each finding was verified against the branch and holds for this codebase.

## Deferred Findings

- **#3 [Low] `connect_user_to_org` reverse-uniqueness is a read-then-write TOCTOU.** Real, but unreachable in practice at MVP: registration mints a fresh UUID org per user, and the only path to a colliding write is two concurrent operator-driven `connect_user_to_org` calls to the same pre-existing org, against a single FastAPI process with 0 live users. Fixing it properly needs an atomic conditional update (`update_one` with a filter/`$where` guard) rather than read-then-write; doing that now is unwarranted complexity. Deferred with a `TECH_DEBT` entry. **Trigger:** real concurrency lands (multi-worker deploy) or an automated (non-admin) path can call `connect_user_to_org`.

## Severity Disagreements

None. Agree with all four assigned severities (#1/#2/#3 Low, #4 Nit): #1 is cosmetic because the JWT is unvalidated; #2/#4 are observability-only; #3 is not on any reachable concurrent path at MVP.

## Open Questions

None.
