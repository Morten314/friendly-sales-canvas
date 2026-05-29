---
artifact: specs/20-frontend-phase-3-api-data-layer-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 2
---

## Context

Round 1 review (review-1) and synthesis-1 corrected factual call-site-count errors and closed several design gaps (error taxonomy, skipAuth narrowing, bare-fetch migration strategy, Q2 resolution). This round reviews the revised spec against a fresh codebase verification of every major claim. All round-1 corrections are confirmed applied and accurate.

## Findings

### [High] Login navigation target and post-login flow mismatch

**Location:** §3.8 ("`onSuccess` → navigate to `/tenant-selection`"), §2.3 frozen interfaces ("Auth flow … Preserved as-is")

The spec states the `useLogin` mutation's `onSuccess` navigates to `/tenant-selection`. The actual `Login.tsx` code (lines 87–109) does the following after `await login(email, password)`:

1. Gets `auth.currentUser`
2. Calls `fetchOrgId(user.uid)` — fetches org metadata from the backend
3. Calls `selectTenant(...)` with fetched-or-fallback data
4. Navigates to **`/mission-control`**, not `/tenant-selection`

The spec's proposed `onSuccess → /tenant-selection` is either (a) a factual error about current behavior or (b) an intentional behavioral change that contradicts the §2.3 frozen interface ("Auth flow … Preserved as-is"). Additionally, `fetchOrgId` + `selectTenant` + `pendingFullName` localStorage management (lines 72–106) are significant post-login steps that the spec's `mutationFn delegates to AuthContext.login` description omits. The mutation either needs to wrap the entire flow (login + fetchOrgId + selectTenant) or `onSuccess` needs to include these steps — the spec should decide which.

**Suggestion:** §3.8 should (1) correct the navigation target to `/mission-control` or explicitly justify changing it, (2) describe what the `mutationFn` wraps beyond `AuthContext.login` (at minimum: fetchOrgId + selectTenant), and (3) address `pendingFullName` localStorage handling (currently inside Login.tsx).

### [High] Auth 404-tolerance mechanism unexplained — `apiFetch` throws on non-2xx

**Location:** §3.8 ("The 404-tolerant / JWT-optional behavior is preserved exactly"), §3.3 (client.ts wraps `apiFetchJson`), §1.2 table (`apiFetch` "throws on non-2xx")

`JWTManager.generateToken` and `refreshAccessToken` both tolerate 404 responses (JWT is optional; the backend commonly returns 404 for `/auth/token` and `/auth/refresh`). Today this works because they use bare `fetch()` and check `response.status`.

The spec routes these calls through `client.ts` → `apiFetchJson` → `apiFetch`. But `apiFetch` throws on non-2xx (`api.ts`: `if (!response.ok) throw`). A 404 would throw before reaching any zod parse, surfacing as TanStack Query's `error` state — breaking the "JWT-optional, 404-tolerant" behavior.

The spec says "preserved exactly" but does not explain the mechanism. The `skipAuth` flag only bypasses JWT injection; it doesn't change the non-2xx throw behavior.

**Suggestion:** §3.8 (or §3.3) must specify how 404 tolerance is preserved when routing through `apiFetch`. Options include: (a) the `skipAuth` path also uses a non-throwing fetch (bypasses `apiFetch` entirely, using bare `fetch` with only rate-limit + zod), (b) `client.ts` catches 404 specifically for auth calls and returns a sentinel, or (c) `apiFetch` gains an option to not throw on specific statuses. The spec should pick one and explain the mechanism.

### [Medium] §7 Q6 is stale — references "2 ApiService call sites" that don't exist

**Location:** §7 Q6 ("The 2 `ApiService` call sites — enumerate and confirm the shared-client equivalents")

Round 1 synthesis confirmed `ApiService` has **0** consumers and §3.9 was corrected accordingly. But §7 Q6 still asks the plan author to "enumerate and confirm" 2 call sites. This open question is contradictory with §3.9 and should be removed or replaced.

**Suggestion:** Delete Q6. There are no call sites to enumerate; §3.9's disposition (verify-unused → delete) is complete.

### [Medium] CompanyProfile's `profileData` prop interaction not addressed

**Location:** §3.6

`CompanyProfile.tsx` has two `useEffect` blocks: the primary fetch-on-mount (lines 81–233, fetching from backend) and a secondary effect (lines 236–290) that watches a `profileData` prop and overwrites component state when the prop changes. The spec addresses only the fetch-on-mount pattern and localStorage caching. After migration to `useQuery`, the `profileData` prop's interaction with the query data needs consideration: does the prop still drive state? Is it superseded by the query? Does the component receive a prop that's now redundant?

**Suggestion:** §3.6 should state whether the `profileData` prop flow is preserved, eliminated (query supersedes it), or merged. If the prop comes from a parent that also fetches, this could indicate a duplicate-fetch situation that TanStack Query should resolve.

### [Medium] `contracts/auth.ts` must handle 404 response body gracefully

**Location:** §3.5, §3.8, `contracts/auth.ts` entry in §3.1 tree

Related to the 404-tolerance finding above: even if the throw-on-non-2xx issue is resolved, `contracts/auth.ts`'s zod schema needs to account for the 404 response body (which may be empty, HTML, or a JSON error object — not a token response). If the schema only models the success shape, any zod parse on a 404 body will throw `ZodError`.

The spec should clarify whether `contracts/auth.ts` is a union schema (success | 404-sentinel), whether the parse is skipped on 404, or whether 404 handling happens before the zod parse is reached.

**Suggestion:** Add a sentence to §3.8 or the `contracts/auth.ts` entry specifying how the schema handles non-success auth responses.

### [Medium] `skipAuth` flag naming is a footgun

**Location:** §3.3 ("`client.ts` exposes a `skipAuth` option flag")

Negative-signal naming (`skipAuth: true`) invites misuse: a future developer encountering a JWT-related bug may reach for `skipAuth` to "fix" it on any endpoint, not just auth endpoints. The flag exists for exactly one reason (preventing refresh recursion), not as a general-purpose auth bypass.

**Suggestion:** Consider positive-signal naming that describes the *reason* rather than the *action* — e.g., `isAuthEndpoint: true` or `authFlow: true` — so callers understand it's a restricted-purpose flag, not a general escape hatch. This is a §7 plan question if the spec doesn't want to prescribe the name.

### [Low] §3.6 commit-shape detail belongs in the plan

**Location:** §3.6 "Commit shape" sub-section

The 6-item commit sequence (scaffold → queryClient → contracts → hooks → rewire → tests) is implementation ordering that belongs in the plan, not the spec. The spec's job is to define the end-state and acceptance criteria; the plan decomposes it into ordered steps. Other slices (§3.7, §3.8) don't include commit-shape detail, making §3.6 inconsistent.

**Suggestion:** Remove or shorten the commit-shape section to a one-line note ("suggested slice ordering: shared primitives first, then hooks, then component rewire, then tests") and let the plan specify the exact commit boundaries.

### [Low] SuggestedICPCards omitted from migration-awareness notes

**Location:** §2.2 (out-of-scope list)

`SuggestedICPCards.tsx` is the second-largest consumer of `apiFetch`/`apiFetchJson` (3 calls across lines 1073, 1216, 1376). It's not migrated in this phase (correct — it's a feature component), but it's also not listed in §2.2's out-of-scope items or §1.2's table. As the phase that establishes the shared fetch path, noting where the remaining `apiFetch` consumers live helps the plan author and future phase authors.

**Suggestion:** Add SuggestedICPCards to §2.2 or §1.2 as a known `apiFetch` consumer not in scope, alongside the 4 market-research components.

### [Nit] Save-POST line citation slightly imprecise

**Location:** §3.6 ("CompanyProfile.tsx:57 GET, :387 save")

The save POST spans lines 387–393; citing just ":387" is close but incomplete. Not actionable — the plan will verify exact locations — but worth noting for precision.
