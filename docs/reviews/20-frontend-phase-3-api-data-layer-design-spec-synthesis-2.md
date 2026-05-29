---
synthesizes_review: docs/reviews/20-frontend-phase-3-api-data-layer-design-spec-review-2.md
artifact: specs/20-frontend-phase-3-api-data-layer-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-05-29
round: 2
---

## Round Recommendation

yes

Reason: Round 2 surfaced two verified High findings (Login post-login flow + nav target; 404-tolerance broken by `apiFetch`'s throw). The fixes materially respecify the auth transport (a non-throwing `authEndpoint` path, zod-on-2xx-only) and the Login/signup mutations — significant new design surface a round-3 review should confirm before planning.

## Agreed Findings

- **F1 [High] — Login flow / nav target.** Verified: `Login.tsx:88-109` runs `login()` → `fetchOrgId(uid)` → `selectTenant({...})` → `pendingFullName` handling → `navigate("/mission-control")`; signup is a separate branch (no navigation). §3.8 corrected: `useLogin`'s `mutationFn` wraps the full post-login sequence (not just `AuthContext.login`), `onSuccess` → **`/mission-control`**; `useSignup` wraps signup + `pendingFullName` + toast + switch-to-login. Wrapper kept thin so the `fetchOrgId`/`selectTenant` coupling stays relocatable for Phase 4/10.
- **F2 [High] — 404-tolerance vs `apiFetch` throw.** Verified: `apiFetch` (`api.ts:73-83`) throws on any non-2xx; `generateToken` (`jwt.ts:49-56`) maps 404→`null`. §3.3/§3.8 corrected: the auth calls use a dedicated **`authEndpoint`** path that applies the shared rate-limiter + a **non-throwing** fetch (not `apiFetch`) and zod-parses **only 2xx** bodies — preserving each method's status semantics (`generateToken` 404→`null`; `refreshAccessToken` throw→`clearTokens`).
- **F3 [Medium] — CompanyProfile `profileData` prop.** Verified: `CompanyProfile.tsx:33,36` takes `profileData?: UntypedBackendProfile`; reviewer cites a secondary effect (~`:236-290`). §3.6 now requires the plan to resolve the prop's interaction with `useQuery` (query supersedes / prop overrides / parent duplicate-fetch collapses).
- **F("stale Q6") [Medium] — §7 Q6 stale.** Removed: `ApiService` has 0 consumers (§3.9), so there is nothing to "enumerate." §7 renumbered.
- **F5 [Medium] — `contracts/auth.ts` 404 body.** §3.5/§3.8 now state the auth schema models only the success (2xx) token response and is parsed only on 2xx; a 404 short-circuits before zod (ties to F2's non-throwing path). Not a success|error union.
- **F6 [Medium] — `skipAuth` naming footgun.** Renamed to **`authEndpoint`** (positive, purpose-describing) across §3.3/§3.8/R7/§7. The flag marks a restricted-purpose auth-management call (gating both JWT-bypass and the non-throwing/404-tolerant transport), not a general escape hatch.
- **F7 [Low] — commit-shape in spec.** §3.6's 6-item commit list condensed to a one-line "suggested ordering"; exact commit boundaries deferred to the plan (consistent with §3.7/§3.8).
- **F8 [Low] — other `apiFetch` consumers unlisted.** §2.2 now records the full 8-call population: SuggestedICPCards (×3 → Phase 7), ICPManager (×1 → Phase 6), and the 4 market-research components (×1 each → Phase 5); none migrate in Phase 3.
- **F9 [Nit] — save-POST line citation.** Softened to `:387–393`.

## Disagreed Findings

None — every finding verified correct against the code.

## Deferred Findings

N/A — all findings resolved this round.

## Severity Disagreements

- **F6 (reviewer: Medium → mine: Low-leaning).** The naming is a genuine footgun but has no functional impact; acted on regardless, so the distinction is immaterial to the outcome. Noted rather than silently changed.

## Open Questions

- **Auth-transport asymmetry (new §7 Q9).** The plan must confirm the shared non-throwing `authEndpoint` helper preserves the *different* status semantics of `generateToken` (404→`null` sentinel, other non-2xx→`null` via catch) and `refreshAccessToken` (any non-2xx→throw→`clearTokens`). A single helper that flattens both to one behavior would silently change auth handling.
- **Implementation latitude.** The spec specifies the `authEndpoint` path's *behavior* (shared limiter + non-throwing + no JWT + zod-on-2xx). Whether the plan realizes it as a branch inside `client.ts` or by wrapping `JWTManager`'s existing bare `fetch` with the shared limiter + zod is left open — both satisfy the behavior; the plan picks the lower-risk one.
