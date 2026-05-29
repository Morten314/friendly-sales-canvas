---
artifact: specs/20-frontend-phase-3-api-data-layer-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-28
round: 3
---

## Context

Round 3. All round-1 and round-2 findings verified as correctly applied: call-site counts (4 for `executeWithRateLimit`, 0 for `ApiService`, 8/6 for `apiFetch`), login navigation (`/mission-control`), `authEndpoint` flag (renamed from `skipAuth`), non-throwing auth transport, error taxonomy, CompanyProfile `profileData` prop flag, and Q2 resolution (array-tuple keys). Fresh codebase verification confirms every major claim in §1.2 matches the actual code. This review focuses on remaining gaps.

## Findings

### [Medium] CompanyProfile GET's non-2xx → null fallback is a hidden behavior change

**Location:** §3.6 ("useCompanyProfile(orgId) — useQuery that fetches via client.ts"), §3.3

`CompanyProfile.tsx:57-74` calls bare `fetch()` and handles `!response.ok` by returning `null` → empty form. This is the "no existing company profile" happy path. After migration through `apiFetchJson` → `client.ts`, `apiFetch` throws on any non-2xx (`api.ts:73-82`), so a non-2xx response becomes a `useQuery` error instead of empty data. The user sees an error state instead of an empty form. Network errors have the same effect (currently caught → null → empty form; after migration → query error).

The spec doesn't acknowledge this. If the backend returns non-2xx for "no profile exists" (likely given the current code explicitly handles it), the migration silently changes the UX for new users or users without a saved profile.

**Suggestion:** §3.6 should note that CompanyProfile's GET has a non-2xx → null fallback and require the plan author to verify the backend's response code for "no profile found" during the live-response capture (§3.5). If the response is non-2xx, the plan needs a strategy: either `client.ts` catches specific statuses for this endpoint, the query's `select` option maps errors to null, or the component treats error + no cached data as "empty form."

### [Low] No test requirement for auth/Login migration in DoD

**Location:** §3.8, §4

DoD item 3 specifies "a Vitest + RTL + MSW test" for CompanyProfile. DoD item 4 covers the auth/Login migration ("auth token/refresh POSTs route through the shared client and zod-validate; Login uses useMutation") but specifies no testing. The auth path is the trickiest part of this phase (`authEndpoint` exception, recursion risk R7, status-semantics asymmetry between `generateToken` and `refreshAccessToken`). The spec's own R7 mitigation mentions unit tests ("Unit tests assert (a) a refresh call does not invoke getAuthHeader, and (b) a 404 to generateToken yields null, not a thrown error"), yet the DoD doesn't require passing tests for this.

**Suggestion:** Add a DoD item or extend item 4 to require passing unit tests for the `authEndpoint` path (at minimum: the two assertions listed in R7). These tests are the primary guard against the recursion and status-semantics bugs the spec identifies as risks.

### [Low] §7 open questions list dilutes genuine decisions with settled defaults

**Location:** §7

Of 9 items, at least 4 state a clear default with no stated tension: Q1 ("Default: schema-arg on the client fetch helper"), Q5 ("default .parse (loud)"), Q6 (self-labeled "trivial"), Q8 ("Default: raw propagation"). Q2 is already marked RESOLVED. This leaves 3 genuine open questions (Q3, Q4, Q7, Q9) buried among noise. A plan author scanning §7 for decisions they need to make may waste time confirming defaults or miss the genuinely open items.

**Suggestion:** Remove or collapse settled-default items. Reserve §7 for questions where the plan author faces a real choice. A concise §7 also makes post-merge auditing easier — every listed question had a non-trivial answer.

### [Low] authEndpoint exception is a single dense paragraph

**Location:** §3.3 ("Auth-endpoint exception (`authEndpoint` path)")

Four interacting constraints — (1) no JWT injection, (2) non-throwing transport, (3) shared rate-limiter, (4) zod-on-2xx-only — plus the recursion rationale and 404-short-circuit behavior are packed into one long paragraph with multiple parentheticals. This is the trickiest part of the design (the spec devotes R7 and §7 Q9 to its risks). Future readers (and the plan author) would benefit from a structured comparison:

| | Normal path | `authEndpoint` path |
|---|---|---|
| Transport | `apiFetchJson` (throws on non-2xx) | non-throwing `fetch` |
| JWT | auto-injected via `apiFetch` | none |
| Rate-limit | shared limiter | shared limiter |
| zod | `.parse(json)` always | `.parse(json)` on 2xx only |

**Suggestion:** Replace the paragraph with the table (or a bulleted list) and keep the surrounding prose for rationale. This doesn't change the design — it makes it easier to verify.

### [Nit] CompanyProfile localStorage key enumeration slightly imprecise

**Location:** §3.6 ("delete its localStorage companyProfile/companyProfileHash reads/writes")

CompanyProfile.tsx uses `getUserLocalStorage`/`setUserLocalStorage` with key `"companyProfile"` and `"companyProfileForRefresh"` (both user-scoped via `cacheUtils`). `"companyProfileHash"` appears only in `cacheUtils.ts`'s clear-all list — CompanyProfile doesn't reference it directly. The spec's mention of "companyProfileHash" is close but not what the component actually reads/writes. Not harmful (the plan will audit exact keys), but worth tightening.

### [Nit] §4 DoD item 6 "no new @typescript-eslint/no-explicit-any violations" lacks a baseline mechanism

**Location:** §4 item 6

The intent is clear (zod replaces `UntypedBackendProfile`'s `any`), but "no new violations" requires knowing the current count or having a diff-based check. The preflight chain includes `lint` which would catch new `any`s, so this is implicitly enforceable — but the DoD item could simply say "preflight lint clean" since that covers it.

### [Nit] §3.6 "suggested slice ordering" note is already plan territory

**Location:** §3.6 ("Suggested slice ordering (exact commit boundaries → plan)")

The parenthetical correctly defers to the plan. The one-line ordering note ("shared primitives first, then hooks, then component rewire, then tests") is useful context. No action needed; recorded for completeness.
