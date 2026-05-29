# Spec 20 — Frontend Phase 3: API / Data-Layer Consolidation

**Status:** Design — round 4 (rounds 1–3 reviews synthesized at `docs/reviews/20-frontend-phase-3-api-data-layer-design-spec-synthesis-1.md`, `…-synthesis-2.md`, and `…-synthesis-3.md`)
**Date:** 2026-05-29
**Type:** Phase spec (paired plan: `plans/20-frontend-phase-3-api-data-layer.md`, to be written)
**Master plan:** `specs/14-frontend-refactoring-master-plan-design.md` §4 Phase 3

---

## §1 Goal and context

### 1.1 Goal

Make TanStack Query the single source of server-state truth, behind one shared, rate-limited, JWT-injecting fetch path that lives in a new `src/shared/api/`. Define hand-authored **zod** contracts for the endpoints this phase touches, collapse the ad-hoc caching layers for those endpoints into TanStack Query's in-memory cache, and prove the whole pattern end-to-end on a real endpoint (CompanyProfile) before generalizing to the tenant and auth paths.

This is the **infrastructure + proof-of-pattern** phase. It deliberately does **not** migrate every fetch site — per-feature TanStack adoption happens inside each feature's extraction phase (5–10), where context is local (master plan §7 R3). Phase 3 establishes the abstractions those phases inherit.

### 1.2 Starting state (post-Phase-2c, 2026-05-29)

The data layer **as it actually exists in code** (verified 2026-05-29) differs materially from the three-layer `apiFetch → enhancedApi → authenticatedApi` description in master Spec 14 §1.3 and root `CLAUDE.md`. The real shape:

| Element | File | Reality |
|---|---|---|
| Base transport | `frontend/src/lib/api.ts` | `apiFetch(endpoint, options)` / `apiFetchJson(...)` + `buildApiUrl`, `API_BASE_URL`, `ICP_BACKEND_URL`. Injects JWT via dynamic `import("./jwt")`; throws on non-2xx; **no cache, no rate-limit**. **8 direct calls across 6 files**; a much larger bare-`fetch()` population bypasses this transport (and JWT) entirely — see §3.6. |
| JWT manager | `frontend/src/lib/jwt.ts` | `JWTManager` singleton. `generateToken` → `POST /api/auth/token`; `refreshAccessToken` → `POST /api/auth/refresh`; `getAuthHeader` (proactive refresh-if-expired, returns `"Bearer …"` or `""`). Tolerates 404 (JWT optional). Stores `jwt_token` / `refresh_token` in `localStorage`. |
| Rate limiter | `frontend/src/lib/rateLimitManager.ts` | `rateLimitManager` singleton + `executeWithRateLimit(apiCall, name)`. Rolling-window queue, **`maxRequestsPerMinute: 30`** (`:26`, comment "Increased limit for faster processing") — **not 4**. An *explicit wrapper* callers opt into, not middleware. **4 active consumer call sites** (all in `src/components/market-research/`: MarketSize, IndustryTrends, MarketEntry, RegulatoryCompliance). Has Vitest tests in `lib/__tests__/rateLimitManager.test.ts`. |
| Alt client | `frontend/src/services/api.ts` | `ApiService` singleton (`get/post/put/delete` + tenant/data-source helpers). Own JWT + **401 → refresh → retry-once → redirect `/login`**. Does **not** chain through `apiFetch`. **0 consumers — dead code** (nothing in `src/` imports it). This is the entire `src/services/` directory. |
| "5-min cache" | — | **Does not exist as an in-memory map.** The real pattern is manual `localStorage.getItem` → fetch-on-miss → `localStorage.setItem`, **with no TTL enforcement**. |
| TanStack Query | `frontend/src/App.tsx:28,31` | `@tanstack/react-query@^5.56.2`. `QueryClientProvider` **already mounted** (inert) wrapping the whole tree. **Zero** `useQuery`/`useMutation`. |
| Contract types | `frontend/src/lib/types/escape-hatches.ts` | No `src/types/` dir. API responses largely untyped (`unknown`/`any`); `UntypedBackendProfile` etc. are documented `any` escape-hatches from Phase 2a. **No zod in deps.** |

Preflight chain (post-2c) is green and runs: `typecheck → lint → format:check → test → build → bundle:check (advisory) → test:e2e → knip --strict`.

### 1.3 Decisions reached during brainstorming

1. **Contract source = zod.** Schemas are the single source of truth; static types come from `z.infer`; responses are `.parse`d at the fetch boundary so backend drift surfaces loudly into the query's `error` state. Chosen over hand-written interfaces because there is no OpenAPI client, backend responses are untyped, and `CLAUDE.md` repeatedly warns that response shapes mislead. Introduced **only for this phase's endpoints**; later feature phases extend the pattern. Adds `zod` as a dependency. Resolves master Spec 14 §8 Q4.
2. **Persistence = memory-only for Phase 3; global policy deferred.** Phase 3's endpoints use TanStack Query's in-memory cache (no persister). The **repo-wide** persistence policy (whether to persist expensive results such as market-research LLM output) is deferred to an ADR, expected when Phase 5 migrates that data. Partially resolves master Spec 14 §8 Q9.
3. **Migration scope = broad proof-of-pattern.** CompanyProfile (flagship: `useQuery` + `useMutation` + invalidation + zod + localStorage retire), TenantSelection (`useQuery` over its current mock), auth token/refresh routed through the shared fetcher, **and** Login converted to `useMutation`. The Login mutation is contained at the component level (delegates to `AuthContext.login`); AuthContext internals are **not** restructured (Phase 4/10 owns that).
4. **Approach = vertical-slice-first.** Build only the shared primitives CompanyProfile needs, prove the full pattern on that one real endpoint, then generalize to tenant + auth. De-risks the shared abstraction every later phase depends on.
5. **Security is out of scope (MVP, 0 users).** Phase 3 preserves the existing unvalidated-JWT posture as-is — it neither adds token validation/authz/hardening nor removes the JWT flow (frozen interface, §2.3). zod is a data-shape/drift control here, **not** a security control.

These trigger amendments to master Spec 14 — see §3.10.

### 1.4 Three master-plan divergences corrected by this phase

Recorded here because §3.10 amends the master spec for them:

- **No `enhancedApi` / `authenticatedApi`.** 0 references each (verified). The "three-layer client" and its "5-min in-memory map" are aspirational labels, not code.
- **Rate limit is 30/min, not 4/min.** Master Spec 14 §2.3 lists "4 req/min" as a frozen interface; the code says `maxRequestsPerMinute: 30`. Phase 3 preserves the *actual* behavior (30) and corrects the documentation.
- **`QueryClientProvider` already mounted.** Phase 3 *configures* the client, it does not mount it fresh.

---

## §2 Scope

### 2.1 In scope

- New `src/shared/` tree, with `src/shared/api/` as its first inhabitant:
  - `client.ts` — the single fetch path (wraps `apiFetch` transport with rate-limit + zod parse; JWT inherited from `apiFetch`)
  - `rateLimiter.ts` — the one shared `RateLimiter` instance + `RATE_LIMIT_RPM = 30`
  - `queryClient.ts` — configured `QueryClient` (default `staleTime`/`gcTime`/`retry`), consumed by `App.tsx`
  - `queryKeys.ts` — typed query-key factory
  - `contracts/{auth,tenant,company-profile,index}.ts` — zod schemas + inferred types
  - `README.md` — fetch path, zod-at-boundary convention, query-key conventions
- Refactor `frontend/src/lib/rateLimitManager.ts` to re-export the single shared instance (compatibility shim for the 4 untouched `executeWithRateLimit` sites).
- Migrate the proof-of-pattern sites:
  - `frontend/src/components/settings/CompanyProfile.tsx` → `useCompanyProfile` + `useSaveCompanyProfile`; retire its `localStorage` cache keys.
  - `frontend/src/pages/TenantSelection.tsx` → `useTenants` (over the existing mock).
  - `frontend/src/lib/jwt.ts` token/refresh POSTs → route through `client.ts`; zod-validate via `contracts/auth.ts`.
  - `frontend/src/pages/Login.tsx` → `useLogin` (and `useSignup` if present) `useMutation`, delegating to `AuthContext`.
- **Delete** `frontend/src/services/api.ts` (`ApiService`) — it is dead code (0 consumers): verify-unused, then remove. No migration (§3.9).
- `frontend/src/App.tsx` — replace the bare `new QueryClient()` with the configured client.
- `frontend/package.json` — add `zod`; preflight chain unchanged in structure (zod's bundle delta shows in the advisory `bundle:check`).
- `specs/14-frontend-refactoring-master-plan-design.md` — amendments per §3.10.

### 2.2 Out of scope (deferred; log discoveries as `TD-FE-<n>`)

- **The 4 legacy `executeWithRateLimit` consumer sites** (all in `src/components/market-research/`). Not migrated. They keep working through the shared-limiter shim and convert in **Phase 5** (market-research).
- **Other `apiFetch`/`apiFetchJson` consumers** — the 8 direct calls live in `SuggestedICPCards.tsx` (×3 → Phase 7), `ICPManager.tsx` (×1 → Phase 6), and the 4 market-research components above (×1 each → Phase 5). None migrate in Phase 3; each converts with its feature.
- **market-research / customers / signals `localStorage` response-cache keys** (`marketIntelligenceData`, `competitorData`, `regulatoryData`, `industryTrendsData`, `marketEntryData`, `marketSizeData`, `profilerCache`, etc.). Retired in their feature phases (5–8).
- **`sessionStorage.strategistContext`** (Strategist primary state) and **Sidebar UI `sessionStorage`** (`aiTeamDropdownOpen`, etc.) — these are state, not cache.
- **`selectedTenant_{userId}` and `jwt_token`/`refresh_token` in `localStorage`** — genuine persistent state/credentials, left as-is.
- **Global cache-persistence policy** — deferred to an ADR (likely Phase 5).
- **Backend changes** — the tenant endpoint stays a frontend mock; no new `/api/tenants` is added.
- **AuthContext restructuring / Firebase changes** — Phase 4 (shell) / Phase 10 (auth) own this.
- **Security hardening of any kind** (token validation, authz, CORS, injection) — MVP, 0 users.
- **OpenAPI / codegen** — hand-authored zod only.
- **`src/features/` skeleton, dependency-rule lint** — Phase 4 territory. `src/shared/api/` placement here is by convention; the lint that enforces it lands in Phase 4.

### 2.3 Frozen interfaces (must not change behaviorally)

- **HTTP API contract** with the backend (request/response shapes, headers, status codes). zod schemas *describe* it; they do not change it.
- **Routes** (`/`, `/login`, `/tenant-selection`, `/your-ai-team/scout/*`, `/your-ai-team/strategist/:tab`, `/mission-control`, `/customers`, `/settings`, `/signals`, …) — module imports behind them may move; URLs do not.
- **Auth flow** (Firebase email/password → JWT → tenant selection → protected routes), including the JWT-optional / 404-tolerant behavior. Preserved as-is; only the *transport* of the token/refresh POSTs moves into `client.ts`.
- **Effective request-throttle behavior** — the real current value (**30 req/min**) is preserved. ("Implementation moves, value stays"; the value that stays is 30, and master Spec 14's "4 req/min" text is corrected — §3.10.)
- **Existing E2E Playwright suite + visual-regression snapshots** must stay green; no visual change is expected from this phase.
- **`localStorage` keys that are genuine state** (`jwt_token`, `refresh_token`, `selectedTenant_{userId}`) keep their keys and semantics.

---

## §3 Design

### 3.1 Target structure — `src/shared/api/`

Phase 3 creates `src/shared/` for the first time. Master Spec 14 §4 Phase 3 explicitly endorses this: "API infrastructure is unambiguously shared (every feature consumes it)." The dependency-rule lint that will enforce `shared/` boundaries does not exist until Phase 4, so placement is by convention now.

```
src/shared/
└── api/
    ├── client.ts          # single fetch path: apiFetch transport (JWT) + rate-limit + zod parse
    ├── rateLimiter.ts     # THE shared RateLimiter instance; RATE_LIMIT_RPM = 30
    ├── queryClient.ts     # configured QueryClient (staleTime/gcTime/retry)
    ├── queryKeys.ts       # typed query-key factory
    ├── contracts/
    │   ├── auth.ts            # token + refresh request/response schemas
    │   ├── tenant.ts          # tenant list schema (matches TenantContext's Tenant shape)
    │   ├── company-profile.ts # GET response + save payload schemas
    │   └── index.ts          # barrel
    └── README.md
```

Path alias: the repo already resolves `@/…` to `src/…` (Vite/tsconfig), so imports are `@/shared/api/...`.

### 3.2 The single rate-limiter (the critical invariant)

**Problem:** if the new TanStack path and the 4 legacy `executeWithRateLimit` sites each own a 30/min budget, the effective throttle becomes ~60/min. The phase's "centralize rate-limit" goal requires **one budget**.

**Design:**
- `apiFetch`/`apiFetchJson` in `lib/api.ts` keep their current behavior (transport + their existing JWT injection); **the limiter is not baked into them**. (This avoids double-limiting: a legacy site does `executeWithRateLimit(() => apiFetchJson(...))`; if `apiFetch` *also* limited, that path would limit twice.)
- The limiter logic moves into `src/shared/api/rateLimiter.ts` as a **single exported instance** (`RATE_LIMIT_RPM = 30` named constant).
- `lib/rateLimitManager.ts` is refactored so its `rateLimitManager` singleton **is** (re-exports) that shared instance, and `executeWithRateLimit` delegates to it. The 4 call sites are untouched and now consume the same budget.
- `client.ts` applies the same shared instance.

Net: exactly one `RateLimiter` object; exactly one layer limits per call path; one 30/min budget across legacy + new. The existing `rateLimitManager.test.ts` is updated to point at the relocated instance and must stay green.

### 3.3 The fetch client — `client.ts`

A small wrapper over `apiFetchJson` that every `useQuery`/`useMutation` in this phase calls. It adds the two things `apiFetch` lacks; **JWT injection is inherited from `apiFetch`** (the transport already calls `getAuthHeader`), so `client.ts` does not re-inject. Sites currently on bare `fetch()` (e.g. CompanyProfile — §3.6) are first converted to `apiFetchJson`, gaining JWT injection, before `client.ts` wraps them. **Behavior-preservation caveat:** a bare-`fetch()` site may tolerate non-2xx or network errors (e.g. returning `null` for "not found"); since `apiFetch` *throws* on non-2xx, each such site's current tolerance must be audited and preserved during conversion — map the error to the prior sentinel via the query's `select`/error handling, or (for the auth endpoints) use the non-throwing `authEndpoint` path. Same root issue as R7. Responsibilities:

1. **Rate-limit:** route the call through the shared limiter (§3.2).
2. **zod parse at the boundary:** accept a zod schema and return `schema.parse(json)` so a drifted response throws a typed error that lands in the query's `error` state. (`.parse`, not `.safeParse` — loud failure is the point; the exact placement — generic in `client.ts` vs per-hook — is a §7 plan question.)

**Auth-endpoint exception (`authEndpoint` path).** `/api/auth/token` and `/api/auth/refresh` are handled by a dedicated `client.ts` path gated by an **`authEndpoint` flag** (positive naming — it marks a restricted-purpose auth-management call, not a general bypass; the plan finalizes the exact name). How it differs from the normal path:

| | Normal path | `authEndpoint` path |
|---|---|---|
| Transport | `apiFetchJson` (throws on non-2xx) | non-throwing `fetch` |
| JWT | auto-injected via `apiFetch` | none |
| Rate-limit | shared limiter | shared limiter |
| zod | `.parse(json)` | `.parse(json)` on 2xx only |

Both differences preserve current behavior: **no JWT injection** because `getAuthHeader` refreshes-if-expired via `refreshAccessToken`, so a JWT-injecting refresh call would recurse; **non-throwing transport** because `generateToken` must tolerate 404 (JWT optional) and `apiFetch` throws on any non-2xx (`api.ts:73`) — a 404 short-circuits before the parser. See §3.8 and R7.

**Auth decision — keep proactive refresh, no reactive 401-retry.** The backend does not validate the JWT (`CLAUDE.md` "auth reality check" — endpoints read `user_id`/`org_id` from params), and the only code that ever implemented 401 → refresh → retry → redirect (`ApiService`) is unreached dead code being deleted (§3.9). `client.ts` therefore keeps only the proactive behavior `JWTManager` already implements and adds **no** reactive 401 handling. Unauthorized/session-expiry concerns remain with `AuthContext` + `ProtectedRoute`, unchanged. This is a behavior-preserving simplification, not a security change (§1.3.5).

**Error taxonomy (what reaches the query's `error` state).** `client.ts` does **not** swallow or normalize errors — three distinct, catchable types propagate to TanStack Query: (1) **rate-limit timeout/rejection** from the shared limiter, (2) **HTTP non-2xx** thrown by `apiFetch`, and (3) **`ZodError`** from boundary parsing. Hooks/UI can branch on type (e.g. `instanceof ZodError`) without a custom wrapper. Whether to add a unifying `ApiError` wrapper is a §7 plan question; the default is raw propagation of the three distinct types.

### 3.4 QueryClient configuration — `queryClient.ts`

Replace `App.tsx`'s bare `new QueryClient()` with a configured, exported client:

```ts
// src/shared/api/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,   // preserves the old "~5-min" caching intent
      gcTime:   10 * 60_000,
      retry: 1,                // conservative: avoid amplifying load behind the 30/min limiter
      refetchOnWindowFocus: false,
    },
  },
});
```

Memory-only (no persister), per §1.3.2. Exact `staleTime`/`gcTime`/`retry` values are a §7 plan question; the defaults above are the starting point. `App.tsx` imports this instead of constructing inline (≤2 LOC change).

### 3.5 Contracts (zod) + query keys

- **Schemas authored from live responses.** Per `CLAUDE.md` ("verify the response shape with a live call … use `/docs` or `curl` against a running backend"), each schema is written against a captured real response, not inferred from FE assumptions. The plan records the capture for `GET /api/profile/company`, `POST /api/auth/token`, `POST /api/auth/refresh`.
- `contracts/company-profile.ts` replaces the `UntypedBackendProfile` `any` (`lib/types/escape-hatches.ts`) for this endpoint — a `@typescript-eslint/no-explicit-any` net improvement.
- `contracts/tenant.ts` matches the `Tenant` shape already declared in `TenantContext.tsx` (`{ id, name, domain?, logo? }`).
- `contracts/auth.ts` models **only the success (2xx) token + refresh response** and is parsed solely on 2xx — a 404 / JWT-optional response short-circuits before zod (§3.8), so it is *not* a success|error union.
- `queryKeys.ts` exposes a typed factory (e.g. `qk.companyProfile(orgId)`, `qk.tenants(userId)`) returning **array-tuple keys** (the TanStack convention, e.g. `["company-profile", orgId]`), so invalidation targets are not stringly-typed.

### 3.6 Slice 1 — CompanyProfile (flagship; built first, end-to-end)

`components/settings/CompanyProfile.tsx` today: bare `fetch(GET /api/profile/company?org_id=…)` in `useEffect`, `formData` state, untyped (`UntypedBackendProfile`), and `localStorage` caching via `cacheUtils` (`companyProfile`, `companyProfileHash`).

Target:
- `useCompanyProfile(orgId)` — `useQuery` that fetches via `client.ts`. CompanyProfile's current bare `fetch()` (`CompanyProfile.tsx:57` GET, `:387–393` save) is replaced by `apiFetchJson` under `client.ts` — the conversion that brings it onto the JWT-injecting transport. Response `.parse`d with the company-profile schema.
- **GET non-2xx/error tolerance (behavior preservation).** Today `CompanyProfile.tsx:64-74` returns `null` → *empty form* on `!response.ok` **and** on a caught network error (the "no saved profile yet" path for new users). Because `apiFetch` throws on non-2xx, the migration must preserve this: during the §3.5 live-capture, confirm the backend's status for "no profile", and map the query's not-found/error to empty-form (via `select`, an error→`null` handler, or treating error+no-data as empty) rather than surfacing an error state. Per the §3.3 caveat.
- `useSaveCompanyProfile()` — `useMutation` (POST), `onSuccess` → `queryClient.invalidateQueries(qk.companyProfile(orgId))` → automatic refetch.
- Rewire the component off `useEffect`/`formData`-from-fetch onto the hooks; **retire its `localStorage` response-cache reads/writes** — the keys CompanyProfile actually uses are `companyProfile` and `companyProfileForRefresh` (user-scoped via `cacheUtils`; not `companyProfileHash`, which only appears in `cacheUtils`'s clear-all). (`cacheUtils.ts` itself stays — other features still use it.) `companyProfileUpdated` is a cross-component *event signal* (CustomEvent + flag), **not** cache — the plan checks its listeners and decides whether query invalidation replaces it.
- **`profileData` prop interaction.** `CompanyProfile` also takes a `profileData?` prop (`:33`) with a secondary `useEffect` (~`:236-290`) that overwrites local state when the prop changes. The plan resolves how this interacts with `useQuery`: query supersedes the prop, the prop still drives an override, or a parent's duplicate fetch collapses into the shared query.
- **Test:** Vitest + RTL + MSW — query loads → renders; save → invalidates → refetch; plus zod schema valid/invalid unit tests.

Only the primitives this slice needs are built here (`client.ts`, `rateLimiter.ts`, `queryClient.ts`, `queryKeys.ts`, `contracts/company-profile.ts`). By the end of Slice 1 the shared abstraction is validated against a real endpoint.

**Suggested slice ordering** (exact commit boundaries → plan): shared primitives (`client`/`rateLimiter`/`queryClient`/`queryKeys`) first, then the company-profile schema, then the hooks, then the component rewire (retiring localStorage), then tests — each step leaving preflight green.

### 3.7 Slice 2 — TenantSelection (generalize the read pattern)

`pages/TenantSelection.tsx` builds its tenant list from a hardcoded mock in `useEffect` (no backend endpoint exists). Target:
- `useTenants(userId)` — `useQuery` whose `queryFn` returns the *current mock*, validated against `contracts/tenant.ts`. **`contracts/tenant.ts` is explicitly mock-derived** — there is no live endpoint to capture (§3.5), so its zod layer is structural (proves the pattern), not a drift guard. Phase 10 re-validates it against the real endpoint it introduces.
- This establishes the read pattern with zero backend change. **Phase 10 swaps in a real endpoint by editing only the `queryFn`.**
- `selectedTenant_{userId}` (TenantContext persistence) is untouched.

### 3.8 Slice 3 — Auth + Login (generalize the write/mutation path)

- **Transport:** `JWTManager.generateToken` / `refreshAccessToken` POSTs (`/api/auth/token`, `/api/auth/refresh`) route through `client.ts`'s **`authEndpoint`** path (§3.3) — sharing the rate-limiter and zod-validating the *success* token response (`contracts/auth.ts`), but **not** through `apiFetch`'s throw-on-non-2xx and **not** JWT-injected. The `authEndpoint` path uses a non-throwing fetch that returns status to the caller, so each method's existing status semantics are preserved exactly: `generateToken` maps 404→`null` (JWT optional; `jwt.ts:49-56`), `refreshAccessToken` throws on any non-2xx then `clearTokens()` (`jwt.ts:136-154`). zod runs **only on a 2xx body**; a 404 never reaches the parser. They stay **imperative** inside `JWTManager` (not hooks).
- **Login:** the actual post-login sequence (`Login.tsx:88-109`) is `await login(email,password)` → `fetchOrgId(uid)` → `selectTenant({...})` → `pendingFullName` handling → `navigate("/mission-control")`. `useLogin()`'s `mutationFn` wraps that whole sequence (not just `AuthContext.login`); `onSuccess` navigates to **`/mission-control`** — preserving current behavior (the §2.3 frozen auth flow *auto-selects* the tenant via `selectTenant`; it does not route through `/tenant-selection` on login). Signup is a separate `useSignup()` (`signup()` → set `pendingFullName` → toast → switch to login; no navigation). Both give `isPending`/`error` ergonomics. **AuthContext internals are not restructured**; the mutations travel with the Login component when Phase 4/10 extracts it — the plan keeps the wrapper thin so the `fetchOrgId`/`selectTenant` coupling stays relocatable. Firebase SDK calls stay Firebase; only the JWT HTTP calls go through `client.ts`.

### 3.9 `src/services/` disposition

The entire `src/services/` directory is one file, `api.ts` (`ApiService`), and **it has 0 consumers** (verified — nothing in `src/` imports it).

| File | Classification | Disposition |
|---|---|---|
| `src/services/api.ts` | **Dead code** (0 consumers) | Verify no `src/` file imports it, then **delete**. No migration and nothing to absorb — `ApiService`'s `get/post/put/delete` + 401-retry never run. `knip --strict` confirms clean. |

No feature-local services exist to defer. This satisfies master Spec 14 §4 Phase 3's "`src/services/` disposition" deliverable in full.

### 3.10 Master Spec 14 amendments

In a dedicated commit on the phase branch (e.g. `docs(spec-14): amend Phase 3 — …`; exact message per plan), before merge:

- **§1.3 starting-state table & §4 Phase 3 block:** correct the `enhancedApi`/`authenticatedApi`/"5-min in-memory map" description to the real layers (§1.2 of this spec); reframe "wire `QueryClient` at app root" → "configure the already-mounted `QueryClient`."
- **§2.3 frozen interfaces:** change "Rate-limit boundary value (4 req/min)" → **30 req/min**, noting the code is authoritative and the original "4" was inaccurate.
- **§8 open questions:** mark **Q4 RESOLVED** (zod); mark **Q9 PARTIALLY RESOLVED** (memory-only for Phase 3 endpoints; global persistence policy deferred to an ADR).
- **§4 Status table:** Phase 3 → done + merge date (at merge, per §5.5 mechanism).

Amendment is its own commit, not mixed with code, so the spec evolution is reviewable as one unit (mirrors Spec 19 §3.4 precedent).

### 3.11 Files touched

| File | Change |
|---|---|
| `src/shared/api/client.ts` | New — wraps `apiFetch` transport with rate-limit + zod parse (JWT inherited) |
| `src/shared/api/rateLimiter.ts` | New — single `RateLimiter` instance + `RATE_LIMIT_RPM = 30` (logic moved from `lib/rateLimitManager.ts`) |
| `src/shared/api/queryClient.ts` | New — configured `QueryClient` |
| `src/shared/api/queryKeys.ts` | New — typed key factory |
| `src/shared/api/contracts/{auth,tenant,company-profile,index}.ts` | New — zod schemas + inferred types |
| `src/shared/api/README.md` | New — conventions |
| `src/lib/rateLimitManager.ts` | Refactor → re-export shared instance (shim); `lib/__tests__/rateLimitManager.test.ts` updated |
| `src/lib/jwt.ts` | token/refresh POSTs routed through `client.ts`; behavior preserved |
| `src/services/api.ts` | **Deleted** (dead code, 0 consumers) |
| `src/components/settings/CompanyProfile.tsx` | Rewired onto hooks; localStorage cache keys retired |
| `src/pages/TenantSelection.tsx` | `useTenants` over mock |
| `src/pages/Login.tsx` | `useLogin`/`useSignup` `useMutation` |
| `src/App.tsx` | Import configured `queryClient` instead of inline `new QueryClient()` |
| `package.json` | Add `zod` |
| `specs/14-frontend-refactoring-master-plan-design.md` | Amendments per §3.10 |
| New Vitest/RTL/MSW tests | CompanyProfile component + hooks; zod schema tests |

---

## §4 Definition of done

1. `src/shared/api/` exists with: configured `QueryClient` (consumed by `App.tsx`), the single rate-limited + JWT-injecting fetch client, zod contracts for auth/tenant/company-profile, the query-key factory, and `README.md`.
2. **One** shared `RateLimiter` instance (`RATE_LIMIT_RPM = 30`); `lib/rateLimitManager.ts` re-exports it; the 4 legacy `executeWithRateLimit` sites are unchanged and share the one budget; `rateLimitManager.test.ts` green.
3. CompanyProfile uses `useQuery` + `useMutation`, zod-validated, with its `localStorage` cache keys retired and a Vitest + RTL + MSW test.
4. TenantSelection uses `useTenants` (over the mock); auth token/refresh POSTs route through the shared `authEndpoint` path and zod-validate; Login uses `useMutation`. **Passing unit tests for the `authEndpoint` path** — at minimum the two R7 assertions (refresh does not invoke `getAuthHeader`; a 404 to `generateToken` yields `null`, not a throw).
5. `src/services/api.ts` deleted (dead code, 0 consumers verified); `knip --strict` clean.
6. `zod` added to deps and used; **preflight `lint` clean** (it enforces no-new-`@typescript-eslint/no-explicit-any`; zod removes at least the company-profile `any`).
7. `npm run preflight` green on the phase branch immediately before merge — the Phase 2c canonical chain (Spec 19 §3.3; advisory `bundle:check` never blocks). Manual smoke sign-off per §6 R2.
8. Master Spec 14 amendments per §3.10 merged in the same branch as a dedicated `docs(spec-14): …` commit.

---

## §5 Per-phase workflow

Standard master Spec 14 §5 cycle:

1. Brainstorm → this spec
2. `/review-spec` → `docs/reviews/20-frontend-phase-3-api-data-layer-design-spec-review-N.md`
3. `/synthesize-spec-review` → `docs/reviews/20-…-design-spec-synthesis-N.md` → loop until nit-or-below
4. `/writing-plans` → `plans/20-frontend-phase-3-api-data-layer.md`
5. `/review-plan` → `/synthesize-plan-review` → loop until clean
6. `/executing-plans` (or subagent-driven-development), vertical-slice order (§3.6 → §3.7 → §3.8)
7. `/review-impl` → `/synthesize-impl-review` → loop until clean
8. Human approves merge → controller runs `npm run preflight` locally → green → `git merge` + `git push origin master`

Branch: `phase-3-api-data-layer`. No sub-split anticipated (the slices are commit series within one phase); if the plan author judges otherwise, 3a/3b/3c by slice is the natural cut.

---

## §6 Risks

### R1 — zod `.parse` over-fires on a backend response that's looser than the schema
A schema authored too tightly (e.g., a field that's sometimes `null`, an optional key) turns a working screen into an error state.
**Mitigation:** schemas are authored from **captured live responses** (§3.5), not assumptions; default to permissive (`.nullable()`/`.optional()`/`.passthrough()` where the live capture shows variance). The plan records the capture per endpoint. Behavioral E2E + visual regression catch a screen that breaks. If a response is too chaotic to model safely, that endpoint's schema uses `.passthrough()` and is logged `TD-FE-<n>` for tightening in its feature phase.

### R2 — Behavior drift in the migrated paths (the safety net is the guard)
Moving CompanyProfile/tenant/Login off their current code paths could subtly change behavior (loading states, error handling, cache freshness).
**Mitigation:** Vitest + RTL + MSW unit tests for the migrated hooks/components; existing Playwright journeys + visual regression stay green; **manual smoke sign-off** of the migrated surfaces (login → `/mission-control`, the tenant-selection page, and settings/company-profile) before merge.

### R3 — Double-limiting or split rate-limit budgets
If `apiFetch` were given a limiter while legacy sites still wrap it in `executeWithRateLimit`, requests would be limited twice; if the new and legacy paths used different instances, the effective rate would double.
**Mitigation:** §3.2's invariant — `apiFetch` stays pure transport; exactly one shared `RateLimiter` instance; legacy shim re-exports it; one layer limits per path. A focused test asserts both paths draw from the same instance.

### R4 — Login `useMutation` bleeds into AuthContext refactor scope
Wrapping Login in `useMutation` could tempt restructuring AuthContext, which Phase 4/10 owns.
**Mitigation:** §3.8 constraint — the `mutationFn` *delegates* to `AuthContext.login`; no AuthContext internals change. Review checks that the diff touches `Login.tsx` (+ a hook) only, not `AuthContext.tsx` internals.

### R5 — zod's bundle cost
Adding `zod` grows the bundle (~12–14 kB gz for zod v3, min+gzip; the advisory `bundle:check` reports the actual delta at impl).
**Mitigation:** the Phase 2c `bundle:check` is advisory — it prints the delta, never blocks. The cost is expected and justified by runtime contract validation at the untyped boundary. Recorded so the delta isn't mistaken for a regression.

### R6 — `staleTime`/`retry` defaults interact badly with the 30/min limiter
Aggressive refetch + retries could queue behind the limiter and feel slow.
**Mitigation:** conservative defaults (`retry: 1`, `refetchOnWindowFocus: false`, `staleTime` 5 min) — §3.4. Plan finalizes values; only 4 endpoints exercise them this phase, so the blast radius is small.

### R7 — Routing auth token/refresh through the shared client risks refresh recursion
`getAuthHeader` refreshes-if-expired by calling `refreshAccessToken`; if that refresh call itself flows through a JWT-injecting path, it re-enters `getAuthHeader` → infinite recursion. The current bare-`fetch` implementation avoids this by never calling `getAuthHeader`.
**Mitigation:** §3.3's auth-endpoint exception — the `authEndpoint` path applies rate-limit + zod-on-2xx but uses a non-throwing fetch (not `apiFetch`) with **no JWT injection**. Unit tests assert (a) a refresh call does not invoke `getAuthHeader`, and (b) a 404 to `generateToken` yields `null`, not a thrown error.

---

## §7 Open questions deferred to plan

1. **`useSignup` separate or folded into `useLogin`** — depends on `Login.tsx`'s signup branch (`pendingFullName`). → plan
2. **`QueryClient` defaults** — exact `staleTime`/`gcTime`/`retry` (starting point in §3.4). → plan
3. **`authEndpoint` flag name** — exact parameter name (approach + behavior fixed in §3.3). → plan
4. **Unifying `ApiError` wrapper vs raw propagation** of the three error types (§3.3). Default: raw. → plan
5. **Auth transport asymmetry** — confirm the `authEndpoint` helper preserves `generateToken` (404→`null`) vs `refreshAccessToken` (throw→`clearTokens`); don't flatten them. → plan
6. **CompanyProfile GET "no profile" mapping** — how the query maps the backend's not-found/error response to empty-form (§3.6). → plan

**Defaults the plan applies unless it finds reason otherwise** (listed for traceability, not open): zod schema passed as an arg to the client helper (parse location); `.parse` not `.safeParse`; `useTenants` keeps its mock inline. **Resolved:** query keys are array-tuple (§3.5).

---

## §8 Companion documents

- `specs/14-frontend-refactoring-master-plan-design.md` — master plan; this phase amends §1.3, §2.3, §4 Phase 3 block, §4 Status, §8 (Q4, Q9)
- `specs/19-frontend-phase-2c-preflight-bundle-design.md` — predecessor phase; left the preflight chain in the §1.2 state
- `frontend/src/lib/{api,jwt,rateLimitManager}.ts`, `frontend/src/services/api.ts` — the current data layer this phase consolidates
- `frontend/src/components/settings/CompanyProfile.tsx`, `frontend/src/pages/{TenantSelection,Login}.tsx` — the migration targets
- root `CLAUDE.md` — "Auth reality check" (JWT unvalidated) and "Polyglot Repo Practices" (verify response shape with a live call) ground §3.3 and §3.5
