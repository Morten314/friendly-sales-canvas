---
artifact: phase-3-api-data-layer
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Findings

### [Low] Dead code in `jwt.ts` catch block — `error.message.includes("404")` is unreachable

**Location:** `frontend/src/lib/jwt.ts:66`

After the migration to `authEndpointRequest`, a 404 response is handled by the `if (!result.ok)` / `if (result.status === 404)` path at lines 41–48 and never throws. The catch block at line 64 therefore cannot receive an error whose message includes `"404"`. The `error.message.includes("404")` branch at line 66 is dead code.

This is not a behavioral bug — the catch correctly handles genuine `TypeError` (network failures) and falls through to `return null` for everything else. But a future reader might infer that 404s can reach this catch, which is no longer true. Consider removing the `error.message.includes("404")` disjunct to avoid confusion, or adding a comment noting it's preserved for the unlikely case where the rate limiter itself throws with a 404-related message.

### [Low] `orgId` interpolated into query strings without encoding

**Location:** `frontend/src/components/settings/useCompanyProfile.ts:26`, `:44`

`profile/company?org_id=${orgId}` is constructed via template literal. If `orgId` ever contained `&`, `=`, `#`, or other URI-significant characters, the query string would break. This is inherited from the pre-migration code (`CompanyProfile.tsx` used the same interpolation), and current org IDs in the system are simple strings (`"brewra"` etc.), so the risk is theoretical. However, `client.ts`'s normal path (`apiFetchJson`) passes the endpoint string through to `apiFetch`, which also doesn't encode — so the shared client layer propagates the assumption. A `encodeURIComponent(orgId)` at the call site (or a URL-building helper in `client.ts`) would make the shared layer robust for future callers.

### [Nit] `Login.tsx` uses local `loading` state instead of mutation's `isPending`

**Location:** `frontend/src/pages/Login.tsx:28, 34–35`

The component creates `loginMutation` and `signupMutation` (which expose `isPending`) but still drives the submit button's disabled/text state from a manual `const [loading, setLoading] = useState(false)` wrapped in `try/finally`. This works correctly and preserves pre-migration behavior. However, the spec's §3.8 describes mutations as giving the component "`isPending` / `error` ergonomics" — Login uses neither, instead relying on its own local state for loading and the catch block for errors. A future cleanup could replace the local state with `loginMutation.isPending || signupMutation.isPending`.

### [Nit] Redundant constructor argument in rate limiter singleton

**Location:** `frontend/src/shared/api/rateLimiter.ts:199`

`new RateLimitManager({ maxRequestsPerMinute: RATE_LIMIT_RPM })` — the constructor's default for `maxRequestsPerMinute` is already `RATE_LIMIT_RPM` (line 35). The explicit override is a no-op. Not harmful, but a reader might wonder if a non-default value is being set.

### [Nit] Verbose console logging in production request paths

**Location:** `frontend/src/shared/api/rateLimiter.ts:94–96, 104–106, 111, 120–122`

Every rate-limited request logs `🚀 Making API request…` and rate-limit hits log `⏳ Rate limit reached…`. These are inherited from the pre-migration `lib/rateLimitManager.ts` (same console.log calls, same lines). Now that the shared limiter is in the critical path for every TanStack Query fetch, these will fire on every API call in production. At MVP scale (0 users) this is negligible, but the shared layer is the wrong place for per-request console output. A future cleanup could gate these behind a debug flag or remove them entirely.
