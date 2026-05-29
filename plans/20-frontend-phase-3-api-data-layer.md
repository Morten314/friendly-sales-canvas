# Frontend Phase 3 — API / Data-Layer Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Plan — round 3 (rounds 1–2 reviews synthesized at `docs/reviews/20-frontend-phase-3-api-data-layer-plan-synthesis-1.md` and `…-synthesis-2.md`)
**Date:** 2026-05-29
**Spec:** `specs/20-frontend-phase-3-api-data-layer-design.md` (round 4 — converged; syntheses 1–3 in `docs/reviews/`)
**Master plan:** `specs/14-frontend-refactoring-master-plan-design.md` §4 Phase 3
**Branch:** `phase-3-api-data-layer`

**Goal:** Make TanStack Query the single server-state source behind one shared, rate-limited, JWT-injecting fetch path in a new `src/shared/api/`, with hand-authored zod contracts validated at the boundary, proven end-to-end on CompanyProfile and generalized to TenantSelection + auth/Login.

**Architecture:** A new `src/shared/api/` tree holds the one `RateLimiter` instance (logic moved out of `lib/rateLimitManager.ts`, which becomes a re-export shim so the 4 legacy `executeWithRateLimit` sites share one 30/min budget), a configured `QueryClient`, a typed query-key factory, zod contracts, and `client.ts` — a thin wrapper over `apiFetchJson` that adds rate-limit + zod parse (JWT inherited from `apiFetch`). Auth token/refresh POSTs use a dedicated **non-throwing, JWT-free `authEndpoint` path** to preserve 404-tolerance and avoid refresh recursion. Three vertical slices migrate in order: CompanyProfile (flagship: `useQuery` + `useMutation` + invalidation + zod), TenantSelection (`useQuery` over its mock), Auth+Login (`authEndpoint` transport + `useLogin`/`useSignup`). Dead `src/services/api.ts` is deleted.

**Tech Stack:** React 18, TypeScript 5.5, Vite 5, `@tanstack/react-query@^5.56.2` (already installed, inert), `zod@^3.23.8` (added this phase), Vitest 3.2 (jsdom, `globals: false`), MSW 2.14 (already scaffolded at `src/test/`), `@testing-library/react@^14.3.1` (added this phase — only `@testing-library/jest-dom` is currently installed), Playwright 1.59.

---

## §0 Execution conventions

### Recovery policy

On any step failure, the executing agent **stops and reports to the human**, unless the failure is a trivial typo or path correction (fix locally, retry once). A failure on a typecheck, lint, Vitest, build, Playwright, or knip step is substantive and requires a stop. No silent fixing of substantive issues.

### Abort triggers (phase-specific — stop and escalate, do not work around)

1. **Refresh recursion reappears.** If the Task 6 / Task 12 tests show `JWTManager.getAuthHeader` being invoked during an `authEndpoint` call (token mint or refresh), the `authEndpoint` path is wrong — it must use bare `fetch`, never `apiFetch`. Stop; the whole auth migration rests on this (spec R7).
2. **The rate-limiter characterization test goes red after relocation.** `src/lib/__tests__/rateLimitManager.test.ts` must stay green through the move-to-shared + shim refactor. If it can only be made green by changing assertions (not imports/comments), the single-instance invariant is broken (spec R3). Stop.
3. **`knip --strict` flags `zod` as an unused dependency, or flags a new `src/shared/api/` file.** `zod` is added in the same commit that first imports it (Task 5), so this should not happen; new `src/shared/api/*.ts` files are auto-"used" because `knip.json`'s entry glob is `src/**/*.{ts,tsx}!` (every src file is an entry). If knip still flags them, the cause is a `knip.json` change need — out of Phase 3 scope. Stop and request scope guidance.
4. **A live response capture reveals a shape the permissive schema can't safely model.** The contracts default to permissive (`.nullish()` + `.passthrough()`); if a live capture shows a response so variant that even passthrough risks an over-firing `.parse`, keep `.passthrough()`, log `TD-FE-<n>` in `docs/TECH_DEBT.md`, and continue. Do not tighten a schema you can't verify.

### Parallelism guidance

- **Infra (Tasks 2–7)**: Task 2 (rateLimiter), Task 3 (queryClient + App), Task 4 (queryKeys), Task 5 (contracts + zod), Task 7 (README) are mutually independent and may run in parallel. **Task 6 (client.ts) depends on Task 2 + Task 5.**
- **Slice 1 (Tasks 8–10)** depends on Task 6. Sequential: hooks → component rewire → component test.
- **Slice 2 (Task 11)** depends on Task 5 + Task 6, **and on Task 8** (its `useTenants.test.tsx` uses React Testing Library, installed in Task 8 Step 1).
- **Slice 3 (Tasks 12–13)** depends on Task 6 (+ Task 5). Sequential: jwt transport → Login.
- **Task 14 (delete services)**, **Task 15 (amend spec 14)** are independent of the slices.
- **Task 16 (final preflight)** is last.

In subagent-driven execution, dispatch the infra fan-out (2,3,4,5,7) together, barrier, then Task 6, then the slices. In inline execution, run in listed order. **`@testing-library/react` is installed in Task 8 Step 1; every RTL-using test task (Tasks 8, 10, 11) requires it — do not start Task 10 or 11 before Task 8 completes.**

### Behavior-preservation checklist (apply at every bare-`fetch()` → client conversion)

Spec §3.3 caveat + synthesis-3 carry-forward: a bare-`fetch()` site may tolerate non-2xx / network errors (returning a sentinel). `apiFetch` **throws** on non-2xx. For each converted site, identify the current tolerance and preserve it (map error → prior sentinel via the query's `queryFn` try/catch or `select`; or use the non-throwing `authEndpoint` path for auth). This is the single most likely source of silent drift this phase.

---

## File Structure

**Files created:**
- `src/shared/api/rateLimiter.ts` — the one `RateLimiter` class + singleton instance + `RATE_LIMIT_RPM = 30` (logic moved from `lib/rateLimitManager.ts`)
- `src/shared/api/queryClient.ts` — configured `QueryClient`
- `src/shared/api/queryKeys.ts` — typed query-key factory `qk`
- `src/shared/api/client.ts` — `apiRequest`/`apiGet`/`apiPost` (normal path) + `authEndpointRequest` (auth path)
- `src/shared/api/contracts/auth.ts` — token + refresh success-response schemas
- `src/shared/api/contracts/tenant.ts` — tenant schema (matches `TenantContext.Tenant`)
- `src/shared/api/contracts/company-profile.ts` — GET response + save-response schemas
- `src/shared/api/contracts/index.ts` — barrel
- `src/shared/api/README.md` — fetch-path / zod-at-boundary / query-key conventions
- `src/shared/api/__tests__/contracts.test.ts` — zod schema valid/invalid unit tests
- `src/shared/api/__tests__/client.test.ts` — rate-limiter identity (R3) + `authEndpoint`-no-JWT (R7a) + normal-path-injects-JWT
- `src/components/settings/useCompanyProfile.ts` — `useCompanyProfile` + `useSaveCompanyProfile`
- `src/components/settings/__tests__/useCompanyProfile.test.tsx` — hook test (MSW)
- `src/components/settings/__tests__/CompanyProfile.test.tsx` — component test (RTL + MSW)
- `src/pages/useTenants.ts` — `useTenants`
- `src/pages/__tests__/useTenants.test.tsx` — mock-validation test
- `src/pages/useLogin.ts` — `useLogin` + `useSignup`
- `src/pages/__tests__/useLogin.test.tsx` — delegation-order + error test (mocks contexts/firebase)
- `src/lib/__tests__/jwtAuthEndpoint.test.ts` — R7b (404 → `null`) + transport tests

**Files modified:**
- `src/lib/rateLimitManager.ts` — becomes a re-export shim over `@/shared/api/rateLimiter`
- `src/lib/__tests__/rateLimitManager.test.ts` — header comment only (assertions unchanged)
- `src/App.tsx` — import the configured `queryClient` instead of `new QueryClient()`
- `src/lib/jwt.ts` — `generateToken`/`refreshAccessToken` POSTs route through `authEndpointRequest`
- `src/components/settings/CompanyProfile.tsx` — rewired onto the hooks; mount-read fetch-cache retired; cross-component publish + event preserved
- `src/pages/TenantSelection.tsx` — `useTenants` over the mock
- `src/pages/Login.tsx` — `useLogin`/`useSignup` `useMutation`
- `package.json` — add `zod` (Task 5) + `@testing-library/react` dev-dep (Task 8)
- `specs/14-frontend-refactoring-master-plan-design.md` — amendments per spec §3.10 (dedicated commit)
- `docs/TECH_DEBT.md` — append TD-FE-11 (orphaned Settings company-profile fetch; Task 9) + TD-FE-12 (dead `TenantContext.availableTenants`/`setAvailableTenants`; Task 11)

**Files deleted:**
- `src/services/api.ts` — dead code (0 consumers, verified)

---

## Task 1: Create the phase branch

**Files:** none

- [ ] **Step 1: Confirm starting branch is `master` and tree is clean**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status
git rev-parse --abbrev-ref HEAD
```

Expected: branch `master`, working tree clean.

- [ ] **Step 2: Create and check out the phase branch**

```bash
git checkout -b phase-3-api-data-layer
```

Expected: `Switched to a new branch 'phase-3-api-data-layer'`.

---

## Task 2: Relocate the rate limiter to `src/shared/api/rateLimiter.ts` + shim

**Files:**
- Create: `src/shared/api/rateLimiter.ts`
- Modify: `src/lib/rateLimitManager.ts`
- Modify: `src/lib/__tests__/rateLimitManager.test.ts` (header comment only)

The limiter **logic moves** to `shared/api`; `lib/rateLimitManager.ts` re-exports the moved symbols so the 4 market-research `executeWithRateLimit` sites and the characterization test keep working against one instance (spec §3.2, R3).

- [ ] **Step 1: Create `src/shared/api/rateLimiter.ts` with the full class moved from `lib/rateLimitManager.ts`**

**The inlined file below is the authoritative target.** It already contains the `RateLimitConfig`/`QueuedRequest` interfaces and the `RateLimitManager` class body verbatim from the current `src/lib/rateLimitManager.ts`, plus the new export footer (the single instance + `RATE_LIMIT_RPM` + `executeWithRateLimit`). If the live `rateLimitManager.ts` has diverged since the plan was written, reconcile the class body before proceeding — abort trigger #2 (characterization test red) catches a behavioral mismatch. The complete file:

```ts
// The single shared rate limiter for the whole app (spec 20 §3.2).
// Logic moved here from src/lib/rateLimitManager.ts; that module now re-exports
// these symbols as a compatibility shim. Exactly one RateLimiter instance exists
// (this `rateLimiter`); client.ts and the legacy executeWithRateLimit sites both
// draw from it, so legacy + new share one 30/min budget.

interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
}

interface QueuedRequest {
  id: string;
  apiCall: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timestamp: number;
  retryCount: number;
}

/** The throttle value preserved from the existing code (was 30/min; spec corrects master-spec "4/min"). */
export const RATE_LIMIT_RPM = 30;

class RateLimitManager {
  private config: RateLimitConfig;
  private requestQueue: QueuedRequest[] = [];
  private requestHistory: { timestamp: number }[] = [];
  private isProcessing = false;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      maxRequestsPerMinute: RATE_LIMIT_RPM, // Increased limit for faster processing
      maxRetries: 1, // Reduced retries for faster failure handling
      baseDelayMs: 500, // Reduced base delay between requests
      maxDelayMs: 2000, // Reduced max delay for retries
      jitterMs: 100, // Reduced jitter for faster processing
      ...config,
    };
  }

  private cleanupOldRequests() {
    const oneMinuteAgo = Date.now() - 60000;
    this.requestHistory = this.requestHistory.filter((req) => req.timestamp > oneMinuteAgo);
  }

  private canMakeRequest(): boolean {
    this.cleanupOldRequests();
    return this.requestHistory.length < this.config.maxRequestsPerMinute;
  }

  private addRequestToHistory() {
    this.requestHistory.push({ timestamp: Date.now() });
  }

  private calculateDelay(retryCount: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      this.config.baseDelayMs * Math.pow(2, retryCount),
      this.config.maxDelayMs,
    );

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.config.jitterMs;

    return exponentialDelay + jitter;
  }

  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) continue;

      try {
        // Check if we can make a request
        if (!this.canMakeRequest()) {
          // Put the request back at the front of the queue
          this.requestQueue.unshift(request);

          // Wait for the next available slot (but cap at 1 second max for faster processing)
          const waitTime = Math.min(
            60000 - (Date.now() - this.requestHistory[0]?.timestamp || 0),
            1000,
          );
          if (waitTime > 0) {
            console.log(
              `⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s before next request...`,
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
          continue;
        }

        // Add to history and make the request
        this.addRequestToHistory();
        console.log(
          `🚀 Making API request (${this.requestHistory.length}/${this.config.maxRequestsPerMinute} this minute)`,
        );

        const result = await request.apiCall();
        request.resolve(result);
      } catch (error) {
        console.error(`❌ API request failed:`, error);

        // Check if it's a rate limit error
        const isRateLimitError = this.isRateLimitError(error);

        if (isRateLimitError && request.retryCount < this.config.maxRetries) {
          // Put back in queue with increased retry count
          request.retryCount++;
          const delay = this.calculateDelay(request.retryCount);
          console.log(
            `🔄 Rate limit hit. Retrying in ${Math.ceil(delay / 1000)}s (attempt ${request.retryCount}/${this.config.maxRetries})`,
          );

          setTimeout(() => {
            this.requestQueue.unshift(request);
            void this.processQueue();
          }, delay);
        } else {
          // Max retries reached or non-rate-limit error
          request.reject(error);
        }
      }
    }

    this.isProcessing = false;
  }

  private isRateLimitError(error: unknown): boolean {
    if (!error) return false;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorString = errorMessage.toLowerCase();

    return (
      errorString.includes("rate limit") ||
      errorString.includes("429") ||
      errorString.includes("model_rate_limit") ||
      errorString.includes("deepseek-r1-distill-llama-70b-free") ||
      errorString.includes("too many requests") ||
      errorString.includes("quota exceeded") ||
      errorString.includes("throttled") ||
      errorString.includes("rate_limit_exceeded") ||
      errorString.includes("api rate limit") ||
      errorString.includes("request limit") ||
      errorString.includes("concurrent request limit") ||
      errorString.includes("model rate limit exceeded")
    );
  }

  async executeWithRateLimit<T>(
    apiCall: () => Promise<T>,
    componentName: string = "Unknown",
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request: QueuedRequest = {
        id: `${componentName}-${Date.now()}-${Math.random()}`,
        apiCall: apiCall as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        timestamp: Date.now(),
        retryCount: 0,
      };

      this.requestQueue.push(request);
      void this.processQueue();
    });
  }

  // Utility method to check current queue status
  getQueueStatus() {
    return {
      queueLength: this.requestQueue.length,
      requestsThisMinute: this.requestHistory.length,
      maxRequestsPerMinute: this.config.maxRequestsPerMinute,
      isProcessing: this.isProcessing,
    };
  }

  // Method to clear queue (useful for testing or emergency situations)
  clearQueue() {
    this.requestQueue.forEach((request) => {
      request.reject(new Error("Queue cleared"));
    });
    this.requestQueue = [];
  }
}

// The single shared instance.
export const rateLimiter = new RateLimitManager({ maxRequestsPerMinute: RATE_LIMIT_RPM });

// Export the class for testing or custom instances.
export { RateLimitManager };

// Utility function for components to use.
export const executeWithRateLimit = async <T>(
  apiCall: () => Promise<T>,
  componentName: string = "Unknown",
): Promise<T> => {
  return rateLimiter.executeWithRateLimit(apiCall, componentName);
};
```

- [ ] **Step 2: Replace `src/lib/rateLimitManager.ts` with a re-export shim**

Replace the entire file contents with:

```ts
// Compatibility shim. The rate limiter moved to src/shared/api/rateLimiter.ts
// (spec 20 §3.2). The 4 market-research consumers import `executeWithRateLimit`
// from here and keep working; `rateLimitManager` is the SAME single shared
// instance (aliased from `rateLimiter`), so legacy + TanStack paths share one
// 30/min budget. These sites migrate to the shared import in Phase 5.
export {
  RateLimitManager,
  RATE_LIMIT_RPM,
  executeWithRateLimit,
  rateLimiter as rateLimitManager,
} from "@/shared/api/rateLimiter";
```

- [ ] **Step 3: Update the characterization test's header comment (assertions unchanged)**

In `src/lib/__tests__/rateLimitManager.test.ts`, replace the top comment block (the lines beginning `// Spec 15 §3.3 — characterization for src/lib/rateLimitManager.ts.` through the line ending `instance at low cap for clean assertions.`) with:

```ts
// Spec 15 §3.3 — characterization for the shared rate limiter. The implementation
// moved to src/shared/api/rateLimiter.ts (spec 20 §3.2); src/lib/rateLimitManager.ts
// is now a re-export shim. This test still imports from "@/lib/rateLimitManager"
// (the shim) to prove the public surface is unchanged. vi.resetModules() re-imports
// a fresh singleton through the shim (resetting the transitively-imported shared
// module), so requestHistory does not leak between tests.
//
// IMPORTANT: spec 15 §3.3 asserts the cap is "4 req/min." The actual default is
// RATE_LIMIT_RPM = 30 (src/shared/api/rateLimiter.ts). Tests below assert the ACTUAL
// behavior (30 default), and exercise the boundary on a custom-config instance at
// low cap for clean assertions.
```

Do **not** change any `import`, `describe`, `it`, or assertion. They resolve through the shim and remain valid.

- [ ] **Step 4: Run the characterization test + typecheck**

```bash
cd frontend
npm run test -- rateLimitManager
npm run typecheck
```

Expected: all `rateLimitManager` tests PASS; typecheck clean. If any assertion fails, that is **abort trigger #2** — stop.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/shared/api/rateLimiter.ts frontend/src/lib/rateLimitManager.ts frontend/src/lib/__tests__/rateLimitManager.test.ts
git commit -m "refactor(fe): move rate limiter to src/shared/api, leave lib shim"
```

---

## Task 3: Configure the `QueryClient` and wire `App.tsx`

**Files:**
- Create: `src/shared/api/queryClient.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/shared/api/queryClient.ts`**

```ts
import { QueryClient } from "@tanstack/react-query";

// Configured client consumed by App.tsx. Memory-only (no persister) for Phase 3
// (spec 20 §1.3.2). Conservative defaults so refetch/retry don't queue badly
// behind the 30/min limiter (spec 20 §3.4, R6). Values are a starting point.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000, // preserves the old "~5-min" caching intent
      gcTime: 10 * 60_000,
      retry: 1, // conservative: avoid amplifying load behind the 30/min limiter
      refetchOnWindowFocus: false,
    },
  },
});
```

- [ ] **Step 2: Edit `src/App.tsx` to import the configured client**

Change the first import line:

Before:
```ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
```

After:
```ts
import { QueryClientProvider } from "@tanstack/react-query";
```

Add this import alongside the other `@/` imports (after the `import { TooltipProvider } from "@/components/ui/tooltip";` line):
```ts
import { queryClient } from "@/shared/api/queryClient";
```

Remove the inline construction (current line 28):
```ts
const queryClient = new QueryClient();
```

Leave `<QueryClientProvider client={queryClient}>` (line 31) exactly as-is — it now references the imported client.

- [ ] **Step 3: Typecheck**

```bash
cd frontend
npm run typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/shared/api/queryClient.ts frontend/src/App.tsx
git commit -m "feat(fe): configure shared QueryClient and consume it in App"
```

---

## Task 4: Query-key factory

**Files:**
- Create: `src/shared/api/queryKeys.ts`

- [ ] **Step 1: Create `src/shared/api/queryKeys.ts`**

```ts
// Typed query-key factory (spec 20 §3.5). Array-tuple keys (the TanStack
// convention) so invalidation targets are not stringly-typed.
export const qk = {
  companyProfile: (orgId: string) => ["company-profile", orgId] as const,
  tenants: (userId: string | null | undefined) => ["tenants", userId ?? "anon"] as const,
};
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/shared/api/queryKeys.ts
git commit -m "feat(fe): add typed query-key factory"
```

---

## Task 5: zod contracts (+ add `zod` dependency)

**Files:**
- Modify: `package.json` (add `zod`)
- Create: `src/shared/api/contracts/auth.ts`
- Create: `src/shared/api/contracts/tenant.ts`
- Create: `src/shared/api/contracts/company-profile.ts`
- Create: `src/shared/api/contracts/index.ts`
- Create: `src/shared/api/__tests__/contracts.test.ts`

`zod` is added **in this commit** (the first to import it) so `knip --strict` never sees it unused. Schemas are authored permissively from FE evidence (the fields the code reads/writes) and reconciled against a live capture in Task 9 (spec §3.5, R1). zod v3 is pinned (spec R5 bundle estimate; v3 `.passthrough()`/`.nullish()` syntax).

- [ ] **Step 1: Install `zod`**

```bash
cd frontend
npm install zod@^3.23.8
```

Expected: `zod` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Create `src/shared/api/contracts/auth.ts`**

```ts
import { z } from "zod";

// Success (2xx) token-mint response. zod runs ONLY on a 2xx body (spec 20 §3.3);
// a 404 (JWT optional — CLAUDE.md auth reality check) short-circuits before the
// parser, so this is NOT a success|error union. Modeled permissively: JWTManager
// reads `token`/`refreshToken`, while the repo's MSW mock returns
// `access_token`/`expires_in` — accept both, reconcile against the live capture.
export const AuthTokenResponseSchema = z
  .object({
    token: z.string().nullish(),
    refreshToken: z.string().nullish(),
    access_token: z.string().nullish(),
    expires_in: z.union([z.string(), z.number()]).nullish(),
  })
  .passthrough();
export type AuthTokenResponse = z.infer<typeof AuthTokenResponseSchema>;

export const AuthRefreshResponseSchema = z
  .object({
    token: z.string().nullish(),
    access_token: z.string().nullish(),
    expires_in: z.union([z.string(), z.number()]).nullish(),
  })
  .passthrough();
export type AuthRefreshResponse = z.infer<typeof AuthRefreshResponseSchema>;
```

- [ ] **Step 3: Create `src/shared/api/contracts/tenant.ts`**

```ts
import { z } from "zod";

// Matches the Tenant shape declared in src/contexts/TenantContext.tsx.
// Mock-derived (no live endpoint exists — spec 20 §3.7); structural, not a drift
// guard. Phase 10 re-validates against the real endpoint it introduces.
export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().optional(),
  logo: z.string().optional(),
});
export type TenantContract = z.infer<typeof TenantSchema>;

export const TenantListSchema = z.array(TenantSchema);
```

- [ ] **Step 4: Create `src/shared/api/contracts/company-profile.ts`**

```ts
import { z } from "zod";

// GET /api/profile/company response. Permissive (every field nullish +
// passthrough) so a "no profile yet" empty body or extra backend fields parse
// cleanly; reconcile against the live capture in the Slice-1 task (spec 20 §3.5,
// R1). Field names are taken from what CompanyProfile.tsx reads/writes today.
export const SocialMediaUrlSchema = z
  .object({
    platform: z.string(),
    url: z.string(),
  })
  .passthrough();

export const CompanyProfileSchema = z
  .object({
    org_id: z.string().nullish(),
    user_id: z.string().nullish(),
    industry: z.string().nullish(),
    companySize: z.string().nullish(),
    companyUrl: z.string().nullish(),
    website: z.string().nullish(),
    strategicGoals: z.string().nullish(),
    primaryGTMModel: z.string().nullish(),
    gtmModel: z.string().nullish(),
    revenueStage: z.string().nullish(),
    keyBuyerPersona: z.string().nullish(),
    targetMarkets: z.array(z.string()).nullish(),
    socialMediaUrls: z.array(SocialMediaUrlSchema).nullish(),
  })
  .passthrough();
export type CompanyProfileResponse = z.infer<typeof CompanyProfileSchema>;

// Save (POST) response is logged but not consumed by the UI today; validate
// loosely so it never over-fires.
export const CompanyProfileSaveResponseSchema = z.object({}).passthrough();
export type CompanyProfileSaveResponse = z.infer<typeof CompanyProfileSaveResponseSchema>;
```

- [ ] **Step 5: Create the barrel `src/shared/api/contracts/index.ts`**

```ts
export * from "./auth";
export * from "./company-profile";
export * from "./tenant";
```

- [ ] **Step 6: Write the schema unit tests**

Create `src/shared/api/__tests__/contracts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  AuthTokenResponseSchema,
  CompanyProfileSchema,
  TenantListSchema,
  TenantSchema,
} from "@/shared/api/contracts";

describe("CompanyProfileSchema", () => {
  it("parses a full profile", () => {
    const parsed = CompanyProfileSchema.parse({
      org_id: "brewra",
      user_id: "u1",
      industry: "saas",
      companySize: "11-50",
      targetMarkets: ["NA", "APAC"],
      socialMediaUrls: [{ platform: "LinkedIn", url: "https://x" }],
    });
    expect(parsed.industry).toBe("saas");
    expect(parsed.targetMarkets).toEqual(["NA", "APAC"]);
  });

  it("parses an empty object (no-profile-yet body)", () => {
    expect(CompanyProfileSchema.parse({})).toEqual({});
  });

  it("passes through unknown backend fields", () => {
    const parsed = CompanyProfileSchema.parse({ industry: "saas", extra_field: 1 }) as Record<
      string,
      unknown
    >;
    expect(parsed.extra_field).toBe(1);
  });

  it("rejects a wrong-typed field", () => {
    expect(() => CompanyProfileSchema.parse({ industry: 42 })).toThrow(ZodError);
  });
});

describe("TenantSchema / TenantListSchema", () => {
  it("parses a tenant with optional domain/logo", () => {
    expect(TenantSchema.parse({ id: "1", name: "Acme" }).name).toBe("Acme");
  });

  it("parses the mock tenant list", () => {
    const list = TenantListSchema.parse([
      { id: "1", name: "Acme Corporation", domain: "acme.com", logo: "🏢" },
    ]);
    expect(list).toHaveLength(1);
  });

  it("rejects a tenant missing required id", () => {
    expect(() => TenantSchema.parse({ name: "Acme" })).toThrow(ZodError);
  });
});

describe("AuthTokenResponseSchema", () => {
  it("accepts the JWTManager-read shape ({ token, refreshToken })", () => {
    const parsed = AuthTokenResponseSchema.parse({ token: "t", refreshToken: "r" });
    expect(parsed.token).toBe("t");
  });

  it("accepts the MSW-mock shape ({ access_token, expires_in })", () => {
    const parsed = AuthTokenResponseSchema.parse({ access_token: "t", expires_in: 3600 });
    expect(parsed.access_token).toBe("t");
  });
});
```

- [ ] **Step 7: Run the tests, typecheck, and confirm knip is clean**

```bash
cd frontend
npm run test -- contracts
npm run typecheck
npx knip --strict --no-progress
```

Expected: contracts tests PASS; typecheck clean; knip reports no unused `zod` and no new issues. If knip flags `zod` unused, a contract import is missing — fix before committing (abort trigger #3 if it's a config issue).

- [ ] **Step 8: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/package.json frontend/package-lock.json frontend/src/shared/api/contracts/ frontend/src/shared/api/__tests__/contracts.test.ts
git commit -m "feat(fe): add zod and hand-authored API contracts (auth, tenant, company-profile)"
```

---

## Task 6: The fetch client — `src/shared/api/client.ts`

**Files:**
- Create: `src/shared/api/client.ts`
- Create: `src/shared/api/__tests__/client.test.ts`

`client.ts` is the single fetch path for this phase. Normal path: `apiFetchJson` (JWT inherited, throws on non-2xx) + shared limiter + zod. Auth path (`authEndpointRequest`): bare non-throwing `fetch` (no JWT, preserves 404-tolerance, avoids refresh recursion) + shared limiter + zod-on-2xx-only (spec §3.3, R7).

- [ ] **Step 1: Create `src/shared/api/client.ts`**

```ts
import type { ZodType } from "zod";

import { apiFetchJson, buildApiUrl, type ApiFetchOptions } from "@/lib/api";

import { rateLimiter } from "./rateLimiter";

// ── Normal path ────────────────────────────────────────────────────────────
// Routes through apiFetchJson, so JWT is injected by apiFetch and a non-2xx
// throws. The shared limiter wraps the call; the response is zod-parsed at the
// boundary (.parse — loud failure is the point). A ZodError, an HTTP error, or a
// rate-limit rejection propagates to the caller (TanStack Query's `error` state)
// distinctly — client.ts does not normalize them (spec 20 §3.3 error taxonomy).
export async function apiRequest<T>(
  endpoint: string,
  schema: ZodType<T>,
  options: ApiFetchOptions = {},
): Promise<T> {
  const json = await rateLimiter.executeWithRateLimit(
    () => apiFetchJson(endpoint, options),
    endpoint,
  );
  return schema.parse(json);
}

export function apiGet<T>(endpoint: string, schema: ZodType<T>): Promise<T> {
  return apiRequest(endpoint, schema, { method: "GET" });
}

export function apiPost<T>(
  endpoint: string,
  body: Record<string, unknown>,
  schema: ZodType<T>,
): Promise<T> {
  return apiRequest(endpoint, schema, { method: "POST", body });
}

// ── Auth-endpoint path ───────────────────────────────────────────────────────
// For /api/auth/token and /api/auth/refresh ONLY. Uses a bare, non-throwing
// fetch (NOT apiFetch): no JWT injection — getAuthHeader refreshes-if-expired via
// refreshAccessToken, so a JWT-injecting auth call would recurse (spec 20 R7).
// Still draws from the shared limiter. zod runs only on a 2xx body; the caller
// branches on `ok`/`status` to preserve each method's status semantics.
export interface AuthEndpointResult<T> {
  ok: boolean;
  status: number;
  data: T | null; // parsed only when ok (2xx)
}

export async function authEndpointRequest<T>(
  endpoint: string,
  schema: ZodType<T>,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<AuthEndpointResult<T>> {
  const url = buildApiUrl(endpoint);
  const response = await rateLimiter.executeWithRateLimit(
    () =>
      fetch(url, {
        method: options.method ?? "POST",
        headers: { "Content-Type": "application/json", ...options.headers },
        body: options.body != null ? JSON.stringify(options.body) : undefined,
      }),
    endpoint,
  );

  if (!response.ok) {
    return { ok: false, status: response.status, data: null };
  }
  const json = await response.json();
  return { ok: true, status: response.status, data: schema.parse(json) };
}
```

- [ ] **Step 2: Write `src/shared/api/__tests__/client.test.ts`**

This test reuses the already-wired MSW server (`src/test/setup.ts` calls `server.listen`). It overrides handlers per-test with `server.use(...)`. It spies on the JWT singleton's `getAuthHeader` to prove the asymmetry (normal path injects; auth path does not — R7a) and the single-instance invariant (R3).

```ts
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import jwtManager from "@/lib/jwt";
import { apiGet, authEndpointRequest } from "@/shared/api/client";
import { rateLimiter } from "@/shared/api/rateLimiter";
import { server } from "@/test/msw/server";

const Health = z.object({ ok: z.boolean() });

afterEach(() => vi.restoreAllMocks());

describe("client.ts — single rate-limiter invariant (R3)", () => {
  it("the lib shim's rateLimitManager IS the shared rateLimiter instance", async () => {
    const { rateLimitManager } = await import("@/lib/rateLimitManager");
    expect(rateLimitManager).toBe(rateLimiter);
  });
});

describe("client.ts — normal path injects JWT", () => {
  it("apiGet routes through apiFetch, which calls getAuthHeader", async () => {
    const spy = vi.spyOn(jwtManager, "getAuthHeader").mockResolvedValue("");
    server.use(http.get("/api/_health", () => HttpResponse.json({ ok: true })));
    const result = await apiGet("_health", Health);
    expect(result).toEqual({ ok: true });
    expect(spy).toHaveBeenCalled();
  });
});

describe("client.ts — authEndpoint path does NOT inject JWT (R7a — no recursion)", () => {
  it("authEndpointRequest never calls getAuthHeader", async () => {
    const spy = vi.spyOn(jwtManager, "getAuthHeader");
    server.use(
      http.post("/api/auth/refresh", () => HttpResponse.json({ token: "new" })),
    );
    const res = await authEndpointRequest("auth/refresh", z.object({ token: z.string() }), {
      body: { refreshToken: "r" },
    });
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ token: "new" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns ok:false + status without parsing on a non-2xx (no throw)", async () => {
    server.use(
      http.post("/api/auth/token", () => new HttpResponse(null, { status: 404 })),
    );
    const res = await authEndpointRequest("auth/token", z.object({ token: z.string() }), {
      body: {},
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
    expect(res.data).toBeNull();
  });
});
```

- [ ] **Step 3: Run the client tests + typecheck**

```bash
cd frontend
npm run test -- client
npm run typecheck
```

Expected: all PASS. If `getAuthHeader` is observed during `authEndpointRequest`, that is **abort trigger #1** — stop.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/shared/api/client.ts frontend/src/shared/api/__tests__/client.test.ts
git commit -m "feat(fe): add shared fetch client (normal + non-throwing authEndpoint paths)"
```

---

## Task 7: `src/shared/api/README.md`

**Files:**
- Create: `src/shared/api/README.md`

- [ ] **Step 1: Write the README**

```markdown
# `src/shared/api/` — the shared data layer

Introduced in Phase 3 (spec 20). Everything a feature needs to talk to the backend
through one rate-limited, JWT-injecting, zod-validated path lives here. The
dependency-rule lint that will enforce `shared/` boundaries arrives in Phase 4;
placement here is by convention until then.

## The fetch path

`client.ts` is the single fetch path for migrated code.

- **Normal path** — `apiGet` / `apiPost` / `apiRequest`. Wraps `apiFetchJson`
  (`src/lib/api.ts`), so JWT is injected by `apiFetch` and any non-2xx **throws**.
  The call is routed through the shared rate limiter, and the JSON body is
  `schema.parse(...)`-d at the boundary. A `ZodError` (response drift), an HTTP
  error, or a rate-limit rejection each propagates distinctly to the caller —
  the client does not normalize them.
- **Auth-endpoint path** — `authEndpointRequest`, for `/api/auth/token` and
  `/api/auth/refresh` ONLY. Uses a bare, **non-throwing** `fetch` with **no JWT
  injection** (a JWT-injecting auth call would recurse via
  `getAuthHeader → refreshAccessToken → getAuthHeader`). Still draws from the
  shared limiter. zod runs **only on a 2xx body**; the caller branches on
  `ok`/`status` to preserve 404-tolerance.

|              | Normal path                    | `authEndpoint` path        |
| ------------ | ------------------------------ | -------------------------- |
| Transport    | `apiFetchJson` (throws on !2xx) | bare non-throwing `fetch`  |
| JWT          | auto-injected via `apiFetch`   | none                       |
| Rate-limit   | shared limiter                 | shared limiter             |
| zod          | `.parse(json)`                 | `.parse(json)` on 2xx only |

## Rate limiting

`rateLimiter.ts` holds the **one** `RateLimiter` instance (`RATE_LIMIT_RPM = 30`).
`src/lib/rateLimitManager.ts` re-exports it as a shim, so the legacy
`executeWithRateLimit` sites and the TanStack path share one 30/min budget. Never
construct a second instance for production use.

## Contracts (zod)

`contracts/` holds hand-authored zod schemas, the source of truth for the
endpoints this phase touches. Static types come from `z.infer`. Schemas are
authored from captured live responses and default permissive
(`.nullish()`/`.passthrough()`); a drifted response surfaces as a `ZodError` in
the query's `error` state. Extend per endpoint as feature phases (5–10) migrate.

## Query keys

`queryKeys.ts` exports `qk`, a factory returning array-tuple keys
(`qk.companyProfile(orgId)` → `["company-profile", orgId]`). Use it for both the
`useQuery` key and `invalidateQueries`, so targets are not stringly-typed.

## QueryClient

`queryClient.ts` is the configured client `App.tsx` mounts. Memory-only (no
persister) for Phase 3; the repo-wide persistence policy is deferred to an ADR.
```

- [ ] **Step 2: Confirm Prettier accepts it**

```bash
cd frontend
npm run format:check
```

Expected: PASS. If Prettier complains, run `npm run format` and re-stage.

- [ ] **Step 3: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/shared/api/README.md
git commit -m "docs(fe): document the shared api layer conventions"
```

---

## Task 8: Slice 1 — CompanyProfile hooks (`useCompanyProfile`, `useSaveCompanyProfile`)

**Files:**
- Modify: `package.json` (add `@testing-library/react` dev-dep)
- Create: `src/components/settings/useCompanyProfile.ts`
- Create: `src/components/settings/__tests__/useCompanyProfile.test.tsx`

The hooks are co-located with the component (no `src/features/` until Phase 4). The GET `queryFn` preserves CompanyProfile's current non-2xx/error tolerance: a `ZodError` surfaces (drift is loud), but any other fetch error resolves to `null` → empty form (matching `CompanyProfile.tsx:64-74` today). Spec §3.6 + §0 behavior-preservation checklist.

- [ ] **Step 1: Install React Testing Library**

The repo has `@testing-library/jest-dom` (matchers) but **not** `@testing-library/react` (the renderer). The hook + component tests need it. Pin v14 (React-18 compatible; bundles `@testing-library/dom`, so no extra peer dep; includes `renderHook`).

```bash
cd frontend
npm install -D @testing-library/react@^14.3.1
```

Expected: `@testing-library/react` appears under `devDependencies`. (knip recognizes it via the Vitest plugin's test-file entries — same as the existing `@testing-library/jest-dom`/`msw` test-only devDeps — so `knip --strict` won't flag it.)

- [ ] **Step 2: Create `src/components/settings/useCompanyProfile.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ZodError } from "zod";

import { apiGet, apiPost } from "@/shared/api/client";
import {
  CompanyProfileSaveResponseSchema,
  CompanyProfileSchema,
  type CompanyProfileResponse,
} from "@/shared/api/contracts";
import { qk } from "@/shared/api/queryKeys";

/**
 * Reads GET /api/profile/company?org_id=… via the shared client + zod.
 * Tolerance preserved: a ZodError (response drift) surfaces to `error`; any other
 * failure — including HTTP 5xx, network, and CORS errors — resolves to `null` → the
 * component renders the empty form, exactly as the old bare-fetch path did for "no
 * profile yet" (spec 20 §3.6). A genuine server outage is therefore shown as an empty
 * form, not an error state — matching pre-migration behavior.
 */
export function useCompanyProfile(orgId: string, enabled = true) {
  return useQuery<CompanyProfileResponse | null>({
    queryKey: qk.companyProfile(orgId),
    enabled,
    queryFn: async () => {
      try {
        return await apiGet(`profile/company?org_id=${orgId}`, CompanyProfileSchema);
      } catch (e) {
        if (e instanceof ZodError) throw e;
        return null;
      }
    },
  });
}

/**
 * POSTs the save payload via the shared client. onSuccess invalidates the
 * company-profile query so it refetches. The component owns the cross-component
 * side effects (localStorage publish + CustomEvent) — see CompanyProfile.tsx.
 */
export function useSaveCompanyProfile(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost(`profile/company?org_id=${orgId}`, payload, CompanyProfileSaveResponseSchema),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.companyProfile(orgId) });
    },
  });
}
```

- [ ] **Step 3: Write `src/components/settings/__tests__/useCompanyProfile.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { server } from "@/test/msw/server";

import { useCompanyProfile, useSaveCompanyProfile } from "../useCompanyProfile";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("useCompanyProfile", () => {
  it("loads and zod-parses a profile", async () => {
    server.use(
      http.get("/api/profile/company", () =>
        HttpResponse.json({ org_id: "brewra", industry: "saas" }),
      ),
    );
    const { result } = renderHook(() => useCompanyProfile("brewra"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.industry).toBe("saas");
  });

  it("resolves to null (not error) on a non-2xx — preserves empty-form path", async () => {
    server.use(
      http.get("/api/profile/company", () => new HttpResponse(null, { status: 404 })),
    );
    const { result } = renderHook(() => useCompanyProfile("brewra"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("surfaces a ZodError on a 200 with a drifted shape", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({ industry: 42 })),
    );
    const { result } = renderHook(() => useCompanyProfile("brewra"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("save POST invalidates the query and triggers a refetch", async () => {
    let getCount = 0;
    server.use(
      http.get("/api/profile/company", () => {
        getCount += 1;
        return HttpResponse.json({ org_id: "brewra", industry: "saas" });
      }),
      http.post("/api/profile/company", () => HttpResponse.json({ ok: true })),
    );
    const { result } = renderHook(
      () => ({ q: useCompanyProfile("brewra"), m: useSaveCompanyProfile("brewra") }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.q.isSuccess).toBe(true));
    expect(getCount).toBe(1);

    await act(async () => {
      await result.current.m.mutateAsync({ org_id: "brewra", industry: "fintech" });
    });

    // onSuccess → invalidateQueries(qk.companyProfile) → the GET refetches.
    await waitFor(() => expect(getCount).toBe(2));
  });
});
```

- [ ] **Step 4: Run the hook test + typecheck**

```bash
cd frontend
npm run test -- useCompanyProfile
npm run typecheck
```

Expected: all 4 PASS. The 404→`null` test is the load-bearing tolerance assertion; the new save test proves the mutation's `onSuccess` invalidation → refetch (spec §3.6 "save → invalidates → refetch").

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/package.json frontend/package-lock.json frontend/src/components/settings/useCompanyProfile.ts frontend/src/components/settings/__tests__/useCompanyProfile.test.tsx
git commit -m "feat(fe): add useCompanyProfile + useSaveCompanyProfile hooks (+ RTL dev-dep)"
```

---

## Task 9: Slice 1 — capture the live response, then rewire `CompanyProfile.tsx`

**Files:**
- Modify: `src/components/settings/CompanyProfile.tsx`
- Modify: `docs/TECH_DEBT.md` (append TD-FE-11)

**Behavior-preservation note (read before editing).** The `companyProfile` and `companyProfileForRefresh` localStorage keys are **cross-component published state** — `src/pages/MarketResearch.tsx` and `src/pages/MissionControl.tsx` read them, and `companyProfileUpdated` is listened to by `DataSourcesManager`, `MarketResearch`, and `RegulatoryComplianceSection` (verified; none migrate until Phases 5–7). So this task retires only CompanyProfile's **mount-read fetch-cache** (replaced by `useQuery`); the **save-side localStorage writes, the `companyProfileUpdated` flag, and the CustomEvent are preserved** (and query invalidation is *added*, not substituted). This refines spec DoD item 3 / §3.6 — see the §X verification note.

**Two removals in the rewrite below are intentional, not accidental** (call them out in the commit body): (a) the second `useEffect` (original `:235–290`) that overwrote form state from the `profileData` prop is **dropped** — `useCompanyProfile` now supersedes it (spec §3.6), and in practice the prop is never passed a non-null company value worth honoring; (b) the verbose debug `console.log`s in the original `handleSave` are removed (the repo's known console-noise debt). Consequence of (a): `Settings.tsx`'s generic `fetchProfileData("company")` GET (`Settings.tsx:105`, called at `:181`/`:193`, result spread via `commonProps.profileData` at `:218,:224`) is now an orphaned fetch whose result CompanyProfile ignores. `Settings.tsx` is **left unchanged this phase** (the same prop still feeds the non-migrated `UserProfile`/`AgentProfile`); the orphaned fetch is recorded as **TD-FE-11** in Step 3.

- [ ] **Step 1: Capture the live GET response (informs schema tightening)**

```bash
curl -s "https://backend-11kr.onrender.com/profile/company?org_id=brewra" -i | head -40
```

Record the status code and JSON body. **Confirm the "no profile" behavior**: if the backend returns a non-2xx for an org with no saved profile, the Task-8 `queryFn` tolerance (→ `null` → empty form) already handles it; if it returns `200` with an empty/partial body, `CompanyProfileSchema` (`.passthrough()` + all-`nullish`) already accepts it — no change needed either way. If the request is blocked by network policy (HTTP 403) or the backend is cold, capture the shape instead from the browser Network tab during the Task 16 manual smoke, and note it in the commit body. If the live shape shows a field the schema types too narrowly, widen that field in `contracts/company-profile.ts` and re-run `npm run test -- contracts`. Do **not** tighten beyond what the capture proves (abort trigger #4).

- [ ] **Step 2: Replace `CompanyProfile.tsx` lines 1–451 (imports through the end of `handleSave`)**

Replace everything from line 1 up to and including the closing `};` of `handleSave` (the line immediately before `  return (`) with the following. **The JSX return block (original lines 453–684) and the final `}` are left exactly as-is.**

```tsx
// Company profile settings — migrated to TanStack Query (spec 20 §3.6).

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import type { CompanyProfileResponse } from "@/shared/api/contracts";
import { setUserLocalStorage } from "@/utils/cacheUtils";

import { useCompanyProfile, useSaveCompanyProfile } from "./useCompanyProfile";

interface SocialMediaUrl {
  platform: string;
  url: string;
}

interface CompanyProfileProps {
  onProfileUpdate?: () => void;
  isEditMode?: boolean;
  // Retained so Settings' `commonProps` spread stays type-safe, but the form is
  // now driven by useCompanyProfile (the query supersedes the prop — spec 20 §3.6).
  // Re-typed off the `any` escape-hatch onto the zod contract (DoD item 6).
  profileData?: CompanyProfileResponse | null;
}

const EMPTY_FORM = {
  industry: "",
  companySize: "",
  companyUrl: "",
  strategicGoals: "",
  primaryGTMModel: "",
  revenueStage: "",
  keyBuyerPersona: "",
};

export function CompanyProfile(_props: CompanyProfileProps) {
  const { currentUser, orgId } = useAuth();
  const orgIdToUse = orgId || "brewra"; // Fallback to 'brewra' for backward compatibility

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [targetMarkets, setTargetMarkets] = useState<string[]>([""]);
  const [socialMediaUrls, setSocialMediaUrls] = useState<SocialMediaUrl[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");

  const { data: profile, isLoading } = useCompanyProfile(orgIdToUse, !!currentUser?.uid);
  const saveMutation = useSaveCompanyProfile(orgIdToUse);

  // Seed the form from the query result. Replaces the old "read localStorage,
  // then fetch on miss" cache on mount. When the query key changes (org switch)
  // or the user logs out, `profile` resets and the form clears — preserving the
  // old clear-on-user-change behavior.
  useEffect(() => {
    if (!currentUser?.uid || !profile) {
      setFormData(EMPTY_FORM);
      setTargetMarkets([""]);
      setSocialMediaUrls([]);
      return;
    }

    setFormData({
      industry: profile.industry || "",
      companySize: profile.companySize || "",
      companyUrl: profile.companyUrl || "",
      strategicGoals: profile.strategicGoals || "",
      primaryGTMModel: profile.primaryGTMModel || "",
      revenueStage: profile.revenueStage || "",
      keyBuyerPersona: profile.keyBuyerPersona || "",
    });
    setTargetMarkets(
      Array.isArray(profile.targetMarkets) && profile.targetMarkets.length > 0
        ? profile.targetMarkets
        : [""],
    );
    setSocialMediaUrls(Array.isArray(profile.socialMediaUrls) ? profile.socialMediaUrls : []);

    // Cross-component publish (preserved): MarketResearch + MissionControl still
    // read these localStorage keys (not migrated until Phases 5–7), so keep them
    // populated from the query result. Retire when those consumers migrate.
    const profileToSave = JSON.stringify({ ...profile, org_id: orgIdToUse });
    setUserLocalStorage("companyProfile", profileToSave, currentUser.uid);
    setUserLocalStorage("companyProfileForRefresh", profileToSave, currentUser.uid);
  }, [profile, currentUser?.uid, orgIdToUse]);

  const socialPlatforms = [
    { value: "linkedin", label: "LinkedIn" },
    { value: "instagram", label: "Instagram" },
    { value: "twitter", label: "Twitter" },
    { value: "facebook", label: "Facebook" },
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTargetMarketChange = (index: number, value: string) => {
    const newTargetMarkets = [...targetMarkets];
    newTargetMarkets[index] = value;
    setTargetMarkets(newTargetMarkets);
  };

  const addTargetMarket = () => {
    setTargetMarkets([...(Array.isArray(targetMarkets) ? targetMarkets : []), ""]);
  };

  const removeTargetMarket = (index: number) => {
    if (Array.isArray(targetMarkets) && targetMarkets.length > 1) {
      const newTargetMarkets = targetMarkets.filter((_, i) => i !== index);
      setTargetMarkets(newTargetMarkets);
    }
  };

  const addSocialMediaUrl = () => {
    if (selectedPlatform) {
      setSocialMediaUrls([
        ...(Array.isArray(socialMediaUrls) ? socialMediaUrls : []),
        { platform: selectedPlatform, url: "" },
      ]);
      setSelectedPlatform("");
    }
  };

  const removeSocialMediaUrl = (index: number) => {
    if (Array.isArray(socialMediaUrls)) {
      const newSocialMediaUrls = socialMediaUrls.filter((_, i) => i !== index);
      setSocialMediaUrls(newSocialMediaUrls);
    }
  };

  const handleSocialMediaUrlChange = (index: number, value: string) => {
    if (Array.isArray(socialMediaUrls)) {
      const newSocialMediaUrls = [...socialMediaUrls];
      newSocialMediaUrls[index].url = value;
      setSocialMediaUrls(newSocialMediaUrls);
    }
  };

  const getPlatformLabel = (platform: string) => {
    return socialPlatforms.find((p) => p.value === platform)?.label || platform;
  };

  const handleSave = async () => {
    if (!currentUser?.uid) {
      console.error("User not authenticated");
      alert("Please log in to save your company profile");
      return;
    }
    const payload = {
      org_id: orgIdToUse,
      industry: formData.industry,
      companySize: formData.companySize,
      companyUrl: formData.companyUrl,
      website: formData.companyUrl,
      strategicGoals: formData.strategicGoals,
      primaryGTMModel: formData.primaryGTMModel,
      gtmModel: formData.primaryGTMModel,
      revenueStage: formData.revenueStage,
      keyBuyerPersona: formData.keyBuyerPersona,
      targetMarkets: Array.isArray(targetMarkets)
        ? targetMarkets.filter((market) => market.trim() !== "")
        : [],
      socialMediaUrls: Array.isArray(socialMediaUrls)
        ? socialMediaUrls.map((url) => ({
            platform: getPlatformLabel(url.platform),
            url: url.url,
          }))
        : [],
    };

    try {
      // POST via the shared client (throws on non-2xx) + invalidate the query.
      await saveMutation.mutateAsync(payload);
      alert("Company profile saved successfully!");

      // Cross-component publish (preserved — see the note in the seed effect and
      // the listeners in DataSourcesManager / MarketResearch / Regulatory).
      setUserLocalStorage("companyProfile", JSON.stringify(payload), currentUser.uid);
      setUserLocalStorage("companyProfileForRefresh", JSON.stringify(payload), currentUser.uid);
      setUserLocalStorage("companyProfileUpdated", "1", currentUser.uid);

      // Clear the legacy in-memory market data cache.
      if (typeof window !== "undefined") {
        const w = window as unknown as Record<string, unknown>;
        if (w.cachedMarketData) {
          w.cachedMarketData = null;
          w.cacheTimestamp = null;
        }
      }

      // Notify other components.
      const event = new CustomEvent("companyProfileUpdated", {
        detail: {
          profileData: payload,
          timestamp: new Date().toISOString(),
          action: "PROFILE_SAVED",
          triggerICPRefresh: true,
          clearCaches: true,
        },
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error("Error saving company profile:", error);
      alert("Failed to save company profile. Please try again.");
    }
  };
```

- [ ] **Step 3: Record TD-FE-11 (orphaned Settings company-profile fetch)**

Append this entry to `docs/TECH_DEBT.md` (after the existing TD-FE-10 entry, keeping the `---` separators). It records the consequence of dropping the `profileData` override (behavior note above) so a future agent doesn't assume Settings' company fetch is consumed.

```markdown
## TD-FE-11 — Orphaned Settings company-profile fetch after CompanyProfile TanStack migration

**Date logged:** 2026-05-29
**Origin:** Plan 20 Phase 3 (plans/20-frontend-phase-3-api-data-layer.md), Task 9.

**Current state:**
`Settings.tsx` fetches profile data generically via `fetchProfileData(profileType)` (`:105`), called on
profile selection (`:193`) and user change (`:181`), and passes the result to the rendered profile
component via `commonProps.profileData` (`:218,:224`). After Phase 3, `CompanyProfile` reads its data from
`useCompanyProfile` (a TanStack query keyed on `org_id`) and ignores the `profileData` prop, so for the
"company" selection `fetchProfileData("company")` (a `GET /api/profile/company?user_id=…`) still runs but
its result is discarded — a redundant network call. The same generic prop still feeds the non-migrated
`UserProfile`/`AgentProfile`, so `Settings.tsx` is left unchanged.

**Why deferred:**
Removing the company branch / lifting it into the shared query requires `UserProfile` and `AgentProfile` to
also migrate off the shared `profileData` prop — out of Phase 3's stated scope (CompanyProfile/tenant/auth/
Login only). Behavior is correct, only wasteful; at MVP scale (0 users) the cost is negligible.

**Pull-forward trigger:**
Settings extraction (Phase 4), or the phase that migrates `UserProfile`/`AgentProfile` — collapse the
duplicate fetch (Settings `user_id` GET vs CompanyProfile `org_id` GET) into the shared query and drop the
orphaned prop flow then.

**Owner:** TBD.
```

- [ ] **Step 4: Typecheck and lint**

```bash
cd frontend
npm run typecheck
npm run lint
```

Expected: both clean. `isLoading` now comes from the query (the JSX `{isLoading && …}` block is unchanged and still valid). `UntypedBackendProfile`, `useRef`, `getUserLocalStorage`, and `removeUserLocalStorage` are no longer imported — confirm lint reports no unused imports.

- [ ] **Step 5: Commit**

This commit lands the rewire before the component-level test (Task 10, the immediately-following commit) — under subagent-driven execution the between-task review catches a broken rewire at once, and the Task 8 hook tests already cover the data layer. If you prefer every commit independently test-verified, fold Task 10's test into this commit (or run `npm run dev` and eyeball `/settings` → Company Profile before committing).

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/components/settings/CompanyProfile.tsx docs/TECH_DEBT.md
git commit -m "feat(fe): rewire CompanyProfile onto TanStack Query hooks; retire mount fetch-cache"
```

---

## Task 10: Slice 1 — CompanyProfile component test (RTL + MSW)

**Files:**
- Create: `src/components/settings/__tests__/CompanyProfile.test.tsx`

- [ ] **Step 1: Write the component test**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { server } from "@/test/msw/server";

import { CompanyProfile } from "../CompanyProfile";

// AuthContext is heavy (Firebase). Mock it to a logged-in user with an org.
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "brewra" }),
}));

function renderWithClient(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

afterEach(() => vi.restoreAllMocks());

describe("CompanyProfile", () => {
  it("renders the form heading once the query settles", async () => {
    server.use(
      http.get("/api/profile/company", () =>
        HttpResponse.json({ org_id: "brewra", industry: "saas" }),
      ),
    );
    renderWithClient(<CompanyProfile />);
    expect(await screen.findByText("Company Profile Settings")).toBeInTheDocument();
    // Loading banner clears after the query resolves.
    await waitFor(() =>
      expect(screen.queryByText("Loading your company profile...")).not.toBeInTheDocument(),
    );
  });

  it("renders the empty form (no crash) when the profile endpoint 404s", async () => {
    server.use(
      http.get("/api/profile/company", () => new HttpResponse(null, { status: 404 })),
    );
    renderWithClient(<CompanyProfile />);
    expect(await screen.findByText("Company Profile Settings")).toBeInTheDocument();
    expect(screen.getByText("Save Company Profile")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the Slice-1 CompanyProfile tests**

```bash
cd frontend
npm run test -- CompanyProfile
```

Expected: the filename filter `CompanyProfile` matches **both** `CompanyProfile.test.tsx` (2 tests) and `useCompanyProfile.test.tsx` (4 tests from Task 8) — all **6 PASS**. To run only this file: `npm run test -- settings/__tests__/CompanyProfile.test` (the `settings/__tests__/` prefix anchors past the `use` in `useCompanyProfile`).

- [ ] **Step 3: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/components/settings/__tests__/CompanyProfile.test.tsx
git commit -m "test(fe): CompanyProfile renders via query + tolerates 404 (RTL + MSW)"
```

---

## Task 11: Slice 2 — TenantSelection over `useTenants`

**Files:**
- Create: `src/pages/useTenants.ts`
- Create: `src/pages/__tests__/useTenants.test.tsx`
- Modify: `src/pages/TenantSelection.tsx`
- Modify: `docs/TECH_DEBT.md` (append TD-FE-12)

`useTenants` returns the *current mock* validated against `contracts/tenant.ts` (no backend endpoint exists; spec §3.7). `TenantSelection` is the only reader of `availableTenants` (verified), so it renders from the query data directly. Phase 10 swaps in a real endpoint by editing only the `queryFn`.

- [ ] **Step 1: Create `src/pages/useTenants.ts`**

```ts
import { useQuery } from "@tanstack/react-query";

import { TenantListSchema, type TenantContract } from "@/shared/api/contracts";
import { qk } from "@/shared/api/queryKeys";

// Mock tenant list (no backend endpoint exists). Phase 10 replaces only this
// queryFn body with a real fetch through the shared client.
const MOCK_TENANTS: TenantContract[] = [
  { id: "1", name: "Acme Corporation", domain: "acme.com", logo: "🏢" },
  { id: "2", name: "TechStart Inc", domain: "techstart.io", logo: "🚀" },
  { id: "3", name: "Global Solutions", domain: "globalsolutions.com", logo: "🌍" },
];

export function useTenants(userId: string | null | undefined) {
  return useQuery<TenantContract[]>({
    queryKey: qk.tenants(userId),
    queryFn: async () => TenantListSchema.parse(MOCK_TENANTS),
  });
}
```

- [ ] **Step 2: Write `src/pages/__tests__/useTenants.test.tsx`** (`.tsx` — the wrapper contains JSX)

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useTenants } from "../useTenants";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useTenants", () => {
  it("returns the zod-validated mock tenant list", async () => {
    const { result } = renderHook(() => useTenants("u1"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.[0].name).toBe("Acme Corporation");
  });
});
```

- [ ] **Step 3: Rewire `src/pages/TenantSelection.tsx`**

Replace the imports and the mock `useEffect` so the list comes from `useTenants`. Specifically:

Change the React import (remove `useEffect`, keep `useState`):

Before:
```ts
import React, { useEffect, useState } from "react";
```

After:
```ts
import React, { useState } from "react";
```

Add, after the existing imports:
```ts
import { useTenants } from "./useTenants";
```

Replace the hook destructure + the mock `useEffect` (current lines 12 and 17–41) — i.e. replace:

```ts
  const { availableTenants, selectTenant, setAvailableTenants, clearTenant } = useTenant();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Mock data - replace with actual API call
  useEffect(() => {
    // Simulate fetching user's tenants
    const mockTenants = [
      {
        id: "1",
        name: "Acme Corporation",
        domain: "acme.com",
        logo: "🏢",
      },
      {
        id: "2",
        name: "TechStart Inc",
        domain: "techstart.io",
        logo: "🚀",
      },
      {
        id: "3",
        name: "Global Solutions",
        domain: "globalsolutions.com",
        logo: "🌍",
      },
    ];
    setAvailableTenants(mockTenants);
  }, [setAvailableTenants]);
```

with:

```ts
  const { selectTenant, clearTenant } = useTenant();
  const { logout, currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Tenant list comes from useTenants (over the mock); Phase 10 swaps in a real
  // endpoint by editing only that hook's queryFn (spec 20 §3.7). TenantSelection
  // is the only reader of the old `availableTenants` context state (verified).
  const { data: availableTenants = [] } = useTenants(currentUser?.uid);
```

The JSX `availableTenants.map(...)` block is unchanged (it now maps the query data).

**Record TD-FE-12.** This rewire leaves `TenantContext.availableTenants` + `setAvailableTenants` as dead state — still defined and assigned into the context value (so no lint/knip break), but never populated and never read once TenantSelection stops using them. Append this entry to `docs/TECH_DEBT.md` (after TD-FE-11, keeping the `---` separators):

```markdown
## TD-FE-12 — Dead TenantContext.availableTenants/setAvailableTenants after TenantSelection migration

**Date logged:** 2026-05-29
**Origin:** Plan 20 Phase 3 (plans/20-frontend-phase-3-api-data-layer.md), Task 11.

**Current state:**
`TenantContext` (`src/contexts/TenantContext.tsx`) declares `availableTenants: Tenant[]` state and
`setAvailableTenants`, and exposes both on its context value. After Phase 3, `TenantSelection` (the only
reader/writer) renders from the `useTenants` query instead, so neither is populated or read anymore. They
remain assigned into the context value, so there is no lint/knip break — just permanently dead state.

**Why deferred:**
Removing the field from `TenantContextType` + the provider is a context-API change owned by the shell/auth
phases, not Phase 3 (which only migrates the read pattern). Harmless until then.

**Pull-forward trigger:**
Phase 10 (introduces the real tenant endpoint — it will repopulate `availableTenants` from the API or drop
the field) or Phase 4 (shell extraction). Remove the dead field then.

**Owner:** TBD.
```

- [ ] **Step 4: Typecheck, lint, and run the hook test**

```bash
cd frontend
npm run typecheck
npm run lint
npm run test -- useTenants
```

Expected: all clean/PASS. Lint should report no unused `setAvailableTenants`/`useEffect` (both removed from this file). `useAuth` now also yields `currentUser` (it already exposes it).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/pages/useTenants.ts frontend/src/pages/__tests__/useTenants.test.tsx frontend/src/pages/TenantSelection.tsx docs/TECH_DEBT.md
git commit -m "feat(fe): TenantSelection reads from useTenants query over the mock"
```

---

## Task 12: Slice 3 — route auth token/refresh through the `authEndpoint` path

**Files:**
- Modify: `src/lib/jwt.ts`
- Create: `src/lib/__tests__/jwtAuthEndpoint.test.ts`

`generateToken` / `refreshAccessToken` keep their imperative shape and their distinct status semantics (404→`null` vs throw→`clearTokens`); only the transport moves to `authEndpointRequest` (spec §3.8, R7). Their surrounding `try/catch` (network-error → `null` for generate; → `clearTokens`+rethrow for refresh) is preserved.

- [ ] **Step 1: Add the import to `src/lib/jwt.ts`**

After the existing top import (`import type { User } from "firebase/auth";`), add:

```ts
import { authEndpointRequest } from "@/shared/api/client";
import { AuthRefreshResponseSchema, AuthTokenResponseSchema } from "@/shared/api/contracts";
```

- [ ] **Step 2: Replace the network call inside `generateToken`**

In `generateToken`, replace the exact block below — currently lines 40–72, but **match on the text, not the line numbers** (line numbers throughout this plan are navigation aids; the quoted text is the operative `Edit` anchor).

Before:

```ts
      const response = await fetch(`${getApiBaseUrl()}/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseToken}`,
        },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) {
        // If endpoint doesn't exist (404), JWT is optional - don't fail
        if (response.status === 404) {
          console.warn(
            "⚠️ JWT token endpoint not found (404). JWT authentication is optional - continuing without JWT token.",
          );
          return null;
        }
        throw new Error(`Failed to generate JWT token: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.token = data.token ?? null;
      this.refreshToken = data.refreshToken ?? null;

      // Store in localStorage
      if (this.token) {
        localStorage.setItem("jwt_token", this.token);
      }
      if (this.refreshToken) {
        localStorage.setItem("refresh_token", this.refreshToken);
      }

      return this.token;
```

After:

```ts
      const result = await authEndpointRequest("auth/token", AuthTokenResponseSchema, {
        method: "POST",
        headers: { Authorization: `Bearer ${firebaseToken}` },
        body: { tenantId },
      });

      if (!result.ok) {
        // If endpoint doesn't exist (404), JWT is optional - don't fail
        if (result.status === 404) {
          console.warn(
            "⚠️ JWT token endpoint not found (404). JWT authentication is optional - continuing without JWT token.",
          );
          return null;
        }
        throw new Error(`Failed to generate JWT token: ${result.status}`);
      }

      this.token = result.data?.token ?? null;
      this.refreshToken = result.data?.refreshToken ?? null;

      // Store in localStorage
      if (this.token) {
        localStorage.setItem("jwt_token", this.token);
      }
      if (this.refreshToken) {
        localStorage.setItem("refresh_token", this.refreshToken);
      }

      return this.token;
```

The `try { const firebaseToken = await user.getIdToken(); … } catch (error) { … return null; }` wrapper around this (lines 34–84) is unchanged — it still maps network errors to `null`.

- [ ] **Step 3: Replace the network call inside `refreshAccessToken`**

In `refreshAccessToken`, replace the exact block below — currently lines 128–149, **match on the text**.

Before:

```ts
      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        throw new Error("Failed to refresh token");
      }

      const data = await response.json();
      this.token = data.token ?? null;
      if (this.token) {
        localStorage.setItem("jwt_token", this.token);
      }

      if (!this.token) {
        throw new Error("Refresh response missing token");
      }
      return this.token;
```

After:

```ts
      const result = await authEndpointRequest("auth/refresh", AuthRefreshResponseSchema, {
        method: "POST",
        body: { refreshToken: this.refreshToken },
      });

      if (!result.ok) {
        throw new Error("Failed to refresh token");
      }

      this.token = result.data?.token ?? null;
      if (this.token) {
        localStorage.setItem("jwt_token", this.token);
      }

      if (!this.token) {
        throw new Error("Refresh response missing token");
      }
      return this.token;
```

The `try { … } catch (error) { … this.clearTokens(); throw error; }` wrapper (lines 127–154) is unchanged.

Finally, **remove the now-unused `getApiBaseUrl` helper** at the top of `jwt.ts` (originally lines 3–9). First confirm it has no stray references — it is a module-private `const` (never exported), so this is a quick consistency check (mirroring Task 14's pattern), not a real cross-file risk:

```bash
cd frontend
rg "getApiBaseUrl" src
```

Expected: only the definition in `jwt.ts` plus the two call sites you just replaced (after the Step 2/3 edits, only the definition remains). Both `fetch` calls used it; `authEndpointRequest` now builds the URL via `buildApiUrl` internally, so `getApiBaseUrl` has zero references and would otherwise fail `lint` (`@typescript-eslint/no-unused-vars`). Delete the whole block:

```ts
const getApiBaseUrl = () => {
  const isDev = import.meta.env.DEV;
  const isVercel =
    import.meta.env.VITE_VERCEL ||
    (typeof window !== "undefined" && window.location.hostname.includes("vercel.app"));
  return isDev || isVercel ? "/api" : "https://backend-11kr.onrender.com";
};
```

(`import type { User } from "firebase/auth";` stays — `generateToken`'s signature still uses it.)

- [ ] **Step 4: Write the R7 transport tests**

Create `src/lib/__tests__/jwtAuthEndpoint.test.ts`:

```ts
import type { User } from "firebase/auth";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import jwtManager from "@/lib/jwt";
import { server } from "@/test/msw/server";

const fakeUser = { getIdToken: async () => "firebase-id-token" } as unknown as User;

afterEach(() => {
  vi.restoreAllMocks();
  jwtManager.clearTokens();
});

describe("JWTManager auth transport (spec 20 R7)", () => {
  it("generateToken returns null on a 404 (JWT optional, not a throw)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    server.use(http.post("/api/auth/token", () => new HttpResponse(null, { status: 404 })));
    await expect(jwtManager.generateToken(fakeUser)).resolves.toBeNull();
  });

  it("generateToken does not invoke getAuthHeader (no recursion)", async () => {
    const spy = vi.spyOn(jwtManager, "getAuthHeader");
    server.use(
      http.post("/api/auth/token", () =>
        HttpResponse.json({ token: "jwt", refreshToken: "r" }),
      ),
    );
    await jwtManager.generateToken(fakeUser);
    expect(spy).not.toHaveBeenCalled();
  });

  it("generateToken stores the token returned on 2xx", async () => {
    server.use(
      http.post("/api/auth/token", () =>
        HttpResponse.json({ token: "jwt-123", refreshToken: "r-123" }),
      ),
    );
    await expect(jwtManager.generateToken(fakeUser)).resolves.toBe("jwt-123");
    expect(localStorage.getItem("jwt_token")).toBe("jwt-123");
  });
});
```

- [ ] **Step 5: Run the tests + typecheck**

```bash
cd frontend
npm run test -- jwtAuthEndpoint
npm run typecheck
```

Expected: all PASS. If the no-recursion test fails (getAuthHeader called), that is **abort trigger #1** — stop.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/lib/jwt.ts frontend/src/lib/__tests__/jwtAuthEndpoint.test.ts
git commit -m "feat(fe): route JWT token/refresh through the shared authEndpoint path"
```

---

## Task 13: Slice 3 — Login `useMutation` (`useLogin`, `useSignup`)

**Files:**
- Create: `src/pages/useLogin.ts`
- Create: `src/pages/__tests__/useLogin.test.tsx`
- Modify: `src/pages/Login.tsx`

`useLogin`'s `mutationFn` wraps the **full** post-login sequence (`login → fetchOrgId → selectTenant → pendingFullName`); `onSuccess` navigation stays in the component (`/mission-control`). The wrapper is thin and delegates to `AuthContext`/`TenantContext` — **no AuthContext internals change** (spec §3.8, R4).

- [ ] **Step 1: Create `src/pages/useLogin.ts`**

```ts
import { useMutation } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { auth } from "@/lib/firebase";

// Wraps the existing Login.tsx post-login sequence verbatim. AuthContext is NOT
// restructured (Phase 4/10 owns that); this just gives the component isPending /
// error ergonomics and a relocatable hook (spec 20 §3.8).
export function useLogin() {
  const { login, fetchOrgId } = useAuth();
  const { selectTenant } = useTenant();
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await login(email, password);
      const user = auth.currentUser;
      if (user?.uid) {
        const { orgId: fetchedOrgId, orgName: fetchedOrgName } = await fetchOrgId(user.uid);
        const orgIdToUse = fetchedOrgId || "brewra";
        const orgNameToUse = fetchedOrgName || "Brewra";
        selectTenant({
          id: orgIdToUse,
          name: orgNameToUse,
          domain: `${orgIdToUse}.com`,
        });
        const pendingFullName = localStorage.getItem("pendingFullName");
        if (pendingFullName) {
          localStorage.setItem(`userFullName_${user.uid}`, pendingFullName);
          localStorage.removeItem("pendingFullName");
        }
      }
    },
  });
}

export function useSignup() {
  const { signup } = useAuth();
  return useMutation({
    mutationFn: async ({
      email,
      password,
      fullName,
    }: {
      email: string;
      password: string;
      fullName: string;
    }) => {
      await signup(email, password);
      // Stored temporarily; associated with the user id after they log in.
      localStorage.setItem("pendingFullName", fullName);
    },
  });
}
```

- [ ] **Step 2: Write `src/pages/__tests__/useLogin.test.tsx`**

Mocks `useAuth`/`useTenant`/firebase `auth` (via `vi.hoisted`, so the mock factories can reference the spies), renders the hooks under a `QueryClient`, and asserts the delegation order + error propagation. Additive coverage — the DoD's auth-test requirement (the R7 assertions) is met by Tasks 6 + 12, and the spec's posture for the Login wrapper is manual smoke (R2); this closes the gap cheaply.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { login, signup, fetchOrgId, selectTenant } = vi.hoisted(() => ({
  login: vi.fn(),
  signup: vi.fn(),
  fetchOrgId: vi.fn(),
  selectTenant: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ login, signup, fetchOrgId }) }));
vi.mock("@/contexts/TenantContext", () => ({ useTenant: () => ({ selectTenant }) }));
vi.mock("@/lib/firebase", () => ({ auth: { currentUser: { uid: "u1" } } }));

import { useLogin, useSignup } from "../useLogin";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  login.mockResolvedValue(undefined);
  signup.mockResolvedValue(undefined);
  fetchOrgId.mockResolvedValue({ orgId: "brewra", orgName: "Brewra" });
});
afterEach(() => vi.clearAllMocks());

describe("useLogin", () => {
  it("delegates login → fetchOrgId → selectTenant in order", async () => {
    const { result } = renderHook(() => useLogin(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({ email: "a@b.co", password: "pw" });
    });
    expect(login).toHaveBeenCalledWith("a@b.co", "pw");
    expect(fetchOrgId).toHaveBeenCalledWith("u1");
    expect(selectTenant).toHaveBeenCalledWith({ id: "brewra", name: "Brewra", domain: "brewra.com" });
    expect(login.mock.invocationCallOrder[0]).toBeLessThan(fetchOrgId.mock.invocationCallOrder[0]);
    expect(fetchOrgId.mock.invocationCallOrder[0]).toBeLessThan(
      selectTenant.mock.invocationCallOrder[0],
    );
  });

  it("propagates a login error and does not call fetchOrgId", async () => {
    login.mockRejectedValueOnce(new Error("bad creds"));
    const { result } = renderHook(() => useLogin(), { wrapper: wrapper() });
    await expect(
      act(async () => {
        await result.current.mutateAsync({ email: "a@b.co", password: "pw" });
      }),
    ).rejects.toThrow("bad creds");
    expect(fetchOrgId).not.toHaveBeenCalled();
  });
});

describe("useSignup", () => {
  it("calls signup and stores pendingFullName", async () => {
    const { result } = renderHook(() => useSignup(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync({ email: "a@b.co", password: "pw", fullName: "Ada" });
    });
    expect(signup).toHaveBeenCalledWith("a@b.co", "pw");
    expect(localStorage.getItem("pendingFullName")).toBe("Ada");
  });
});
```

Run it:

```bash
cd frontend
npm run test -- useLogin
```

Expected: 3 PASS. (If the no-recursion-style mock wiring is off, the delegation-order test fails loudly.)

- [ ] **Step 3: Rewire `src/pages/Login.tsx` to use the mutations**

Add, after the existing imports:
```ts
import { useLogin, useSignup } from "./useLogin";
```

Replace the context/hook destructure (current lines 31–34):

Before:
```ts
  const { login, signup, fetchOrgId, loading: authLoading } = useAuth();
  const { selectTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
```

After:
```ts
  const { loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const signupMutation = useSignup();
```

Replace the body of `handleSubmit` from `try {` through its `finally { setLoading(false); }` (current lines 67–115) with:

```ts
    try {
      setError("");
      setLoading(true);

      if (isSignUp) {
        await signupMutation.mutateAsync({ email, password, fullName });
        // After successful signup, show success message and switch to login
        toast({
          title: "Account Created Successfully!",
          description: "Please sign in with your credentials to continue.",
          variant: "default",
        });
        setIsSignUp(false);
        setError("");
        // Clear password and full name fields
        setPassword("");
        setFullName("");
      } else {
        await loginMutation.mutateAsync({ email, password });
        // Navigate to mission control after successful login
        navigate("/mission-control");
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to authenticate");
    } finally {
      setLoading(false);
    }
```

The remaining imports (`useTenant`, `auth`) are now only used by the hook, not `Login.tsx`. Remove the now-unused imports from `Login.tsx`:
- Remove `import { useTenant } from "../contexts/TenantContext";`
- Remove `import { auth } from "../lib/firebase";`

(Keep `useAuth` — it still provides `authLoading`.)

- [ ] **Step 4: Typecheck + lint**

```bash
cd frontend
npm run typecheck
npm run lint
```

Expected: both clean. Lint must report **no unused imports** in `Login.tsx` (confirm `useTenant` and `auth` removals). The `loading` local state still drives the button; `loginMutation.isPending`/`signupMutation.isPending` are available if wanted but are not required for behavior parity.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/pages/useLogin.ts frontend/src/pages/__tests__/useLogin.test.tsx frontend/src/pages/Login.tsx
git commit -m "feat(fe): convert Login to useLogin/useSignup mutations (AuthContext unchanged)"
```

---

## Task 14: Delete dead `src/services/api.ts`

**Files:**
- Delete: `src/services/api.ts`

- [ ] **Step 1: Re-confirm 0 importers**

```bash
cd frontend
rg -l "services/api" src
```

Expected: **no output** (nothing imports it). If anything prints, stop — it is not dead code; re-evaluate.

- [ ] **Step 2: Delete the file (and the now-empty directory)**

```bash
cd frontend
git rm src/services/api.ts
rmdir src/services 2>/dev/null || true
```

- [ ] **Step 3: Confirm typecheck + knip are clean**

```bash
cd frontend
npm run typecheck
npx knip --strict --no-progress
```

Expected: typecheck clean; `knip --strict` reports no unused files/exports introduced by the deletion (and no longer needs to consider `ApiService`).

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A frontend/src/services
git commit -m "chore(fe): delete dead ApiService (0 consumers)"
```

---

## Task 15: Amend master Spec 14 — single dedicated commit

**Files:**
- Modify: `specs/14-frontend-refactoring-master-plan-design.md`

Per spec 20 §3.10, the master-spec amendments land as one commit, separate from code, so the spec evolution is reviewable as a unit. The §4 Status-row flip to "done + merge date" happens at merge time (§5.5), not here.

- [ ] **Step 1: Correct the §1.3 data-layer row (line 32)**

Replace:
```markdown
| Data layer | Manual `fetch` via three-layer client: `apiFetch` → `enhancedApi` (5-min in-memory map, rate-limit) → `authenticatedApi` (JWT). TanStack Query not used. Three caching layers: `localStorage`, `enhancedApi` map, `sessionStorage`. |
```
with:
```markdown
| Data layer | Manual `fetch`. Base transport `apiFetch`/`apiFetchJson` (`src/lib/api.ts`) injects JWT and throws on non-2xx. `rateLimitManager` (30/min) is an opt-in wrapper, not middleware. **No `enhancedApi`/`authenticatedApi` and no 5-min in-memory map exist** (those labels in earlier drafts were aspirational). Caching is manual `localStorage` (no TTL) + `sessionStorage`. TanStack Query installed but inert. (Corrected by Phase 3 — see spec 20 §1.2/§1.4.) |
```

- [ ] **Step 2: Correct the §2.3 frozen rate-limit value (line 107)**

Replace:
```markdown
- Rate-limit boundary value (4 req/min) — implementation moves, value stays
```
with:
```markdown
- Rate-limit boundary value (**30 req/min** — the code is authoritative; the earlier "4 req/min" was inaccurate) — implementation moves, value stays
```

- [ ] **Step 3: Correct the §4 Phase 3 block (lines 330, 331, 333, 339)**

Replace line 330:
```markdown
- Wire `QueryClient` and `QueryClientProvider` at app root.
```
with:
```markdown
- Configure the already-mounted `QueryClient` at app root (`QueryClientProvider` is already present in `App.tsx`; Phase 3 supplies a configured client, it does not mount fresh).
```

Replace line 331:
```markdown
- Replace `enhancedApi`'s 5-min in-memory map with TanStack Query's cache.
```
with:
```markdown
- Collapse the manual `localStorage`-as-fetch-cache (there is no `enhancedApi` map) into TanStack Query's in-memory cache for the migrated endpoints.
```

Replace line 333:
```markdown
- Centralize rate-limit (4 req/min) into a single fetch-middleware layer used by every `useQuery`/`useMutation`.
```
with:
```markdown
- Centralize rate-limit (**30 req/min**) into a single shared `RateLimiter` instance drawn from by both `client.ts` and the legacy `executeWithRateLimit` shim (one budget).
```

Replace line 339:
```markdown
**Done when:** `QueryClientProvider` mounted; `src/shared/api/` exists with contract types and the rate-limited fetcher; auth/tenant/settings paths use TanStack Query.
```
with:
```markdown
**Done when:** the `QueryClient` is configured and consumed; `src/shared/api/` exists with zod contract types and the rate-limited fetcher; CompanyProfile/tenant/auth/Login paths use TanStack Query as the proof-of-pattern.
```

- [ ] **Step 4: Resolve §8 Q4 and Q9 (lines 687, 692)**

Replace line 687:
```markdown
4. **API contract types source** — hand-written, OpenAPI codegen, or zod schemas? → Phase 3 spec
```
with:
```markdown
4. **API contract types source — RESOLVED (Phase 3, 2026-05-29):** hand-authored **zod** schemas (source of truth; static types via `z.infer`; `.parse` at the fetch boundary). No OpenAPI codegen. See spec 20 §1.3.1.
```

Replace line 692:
```markdown
9. **TanStack Query persistence strategy** — `localStorage` plugin or no persistence by default? → Phase 3 spec
```
with:
```markdown
9. **TanStack Query persistence strategy — PARTIALLY RESOLVED (Phase 3, 2026-05-29):** memory-only (no persister) for Phase 3's endpoints. The repo-wide policy (whether to persist expensive results such as market-research output) is deferred to an ADR, expected when Phase 5 migrates that data. See spec 20 §1.3.2.
```

- [ ] **Step 5: Re-read the six edited regions to confirm each reads coherently**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git diff specs/14-frontend-refactoring-master-plan-design.md
```

Expected: exactly the six edits above (§1.3 row, §2.3 value, §4 Phase 3 lines ×4, §8 Q4, §8 Q9), each replacing the stale text. The spec dir is outside `frontend/`, so frontend's `format:check` does not lint it — no Prettier step is needed.

- [ ] **Step 6: Commit the amendments as one dedicated commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add specs/14-frontend-refactoring-master-plan-design.md
git commit -m "docs(spec-14): amend Phase 3 — real data layer, 30/min, zod (Q4), memory-only (Q9)"
```

---

## Task 16: Final preflight + merge prep

**Files:** none

- [ ] **Step 1: Run the full preflight chain**

```bash
cd frontend
npm run preflight
```

Expected: every step exits 0 — `typecheck → lint → format:check → test → build → bundle:check (advisory) → test:e2e → knip --strict --no-progress`. This takes several minutes (build ~35s, Playwright ~50s, Vitest). The advisory `bundle:check` will print a positive delta (zod adds ~12–14 kB gz — spec R5); that is expected and never blocks.

If any step fails, fix it before proceeding. A Playwright visual-regression failure with no intended visual change is a regression — investigate, do not re-baseline (spec R2).

- [ ] **Step 2: Manual smoke sign-off (spec R2)**

Start the dev server and verify the three migrated surfaces by hand:

```bash
cd frontend
npm run dev
```

- **Login → `/mission-control`**: sign in; confirm it lands on mission control (not `/tenant-selection`).
- **`/tenant-selection`**: confirm the three org cards render and selecting one navigates to mission control.
- **`/settings` → Company Profile**: confirm the form loads (empty or populated), a save shows the success alert, and a reload reflects the saved data. (Capture the live GET shape here if Task 9 Step 1 was blocked.)

Record the result in the merge note.

- [ ] **Step 3: Review the branch commits**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log master..phase-3-api-data-layer --oneline
```

Expected: an ordered, focused series — rate-limiter move, QueryClient, query keys, contracts+zod, client, README, CompanyProfile hooks, CompanyProfile rewire, CompanyProfile test, TenantSelection, jwt authEndpoint, Login mutations, delete services, spec-14 amendments.

- [ ] **Step 4: Confirm a clean tree**

```bash
git status
```

Expected: working tree clean.

- [ ] **Step 5: Do NOT merge.** Per master Spec 14 §5.6, the controller merges only after the human approves and after `/review-impl` → `/synthesize-impl-review` converges. Report the branch state and pause for the next step in the cycle.

---

## §X — Verification summary (read before reporting "done")

**Plan-review round 1 applied** (`docs/reviews/20-frontend-phase-3-api-data-layer-plan-synthesis-1.md`, recommendation **no** → proceed): F1 save→invalidate→refetch test (Task 8) + F2 `useLogin` delegation test (Task 13) added; F3/F5 orphaned Settings fetch + dropped `profileData` effect → **TD-FE-11** (Task 9 Step 3); F4 Edit-ready `Before:` blocks + the `getApiBaseUrl` removal it surfaced (Task 12); F6 test-filter wording (Task 10) + F7 RTL install ordering (§0) fixed; F8 (`_props` naming) declined with reasoning.

**Plan-review round 2 applied** (`docs/reviews/20-frontend-phase-3-api-data-layer-plan-synthesis-2.md`, recommendation **no** → converged): F1 dead `TenantContext.availableTenants` → **TD-FE-12** (Task 11); F2 `rg` pre-check before the `getApiBaseUrl` removal (Task 12, downgraded to Low — it's a non-exported `const`); F3 `useTenants` test extension fixed to `.tsx` (Task 11 Files); F4 note on the pre-test Task 9 commit; F5 5xx-silencing made explicit in the hook JSDoc; F6 Task 2 Step 1 "authoritative target" clarified. 0 disagreed-but-real findings; 0 High across both rounds after synthesis.

**Spec coverage (against spec 20 round 4):**

- §2.1 in-scope file list:
  - `src/shared/api/client.ts` ✓ Task 6; `rateLimiter.ts` ✓ Task 2; `queryClient.ts` ✓ Task 3; `queryKeys.ts` ✓ Task 4; `contracts/{auth,tenant,company-profile,index}.ts` ✓ Task 5; `README.md` ✓ Task 7.
  - `lib/rateLimitManager.ts` shim ✓ Task 2.
  - CompanyProfile → hooks + localStorage retire ✓ Tasks 8–10 (with the cross-component refinement below).
  - TenantSelection → `useTenants` ✓ Task 11.
  - `jwt.ts` token/refresh via `client.ts` + `contracts/auth` ✓ Task 12.
  - Login → `useLogin`/`useSignup` ✓ Task 13.
  - Delete `services/api.ts` ✓ Task 14. `App.tsx` configured client ✓ Task 3. `package.json` add zod ✓ Task 5. Spec 14 amendments ✓ Task 15.
- §3.2 single rate-limiter invariant: ✓ Task 2 (move + shim) + Task 6 identity test (R3).
- §3.3 client + `authEndpoint` path + error taxonomy: ✓ Task 6.
- §3.4 QueryClient config: ✓ Task 3.
- §3.5 contracts + live capture + query keys: ✓ Tasks 4, 5, 9 (Step 1 capture).
- §3.6 / §3.7 / §3.8 slices: ✓ Tasks 8–13.
- §3.9 `src/services/` disposition (delete): ✓ Task 14.
- §3.10 master-spec amendments: ✓ Task 15.
- §4 DoD items 1–8: 1 ✓ (Tasks 3–7), 2 ✓ (Task 2 + Task 6 identity test), 3 ✓ (Tasks 8–10; the `useMutation` save→invalidate→refetch test is in Task 8 per plan-review F1), 4 ✓ (`useTenants` Task 11 + auth transport Task 12 + Login Task 13; **authEndpoint unit tests** Task 6 R7a + Task 12 R7b; plus an additive `useLogin` delegation test in Task 13 per plan-review F2), 5 ✓ (Task 14), 6 ✓ (zod used + `lint` clean; company-profile `any` removed in Task 9), 7 ✓ (Task 16 preflight + smoke), 8 ✓ (Task 15).
- §6 risks: R1 permissive schemas + capture (Tasks 5, 9); R2 unit tests + smoke (Tasks 8, 10, 16); R3 identity test (Task 6); R4 thin Login wrapper, AuthContext untouched (Task 13); R5 advisory bundle:check (Task 16); R6 conservative QueryClient defaults (Task 3); R7 non-throwing/no-JWT authEndpoint + tests (Tasks 6, 12).

**Deviations from the spec to surface at review (two):**

- **DoD item 3 / §3.6 "retire its `localStorage` cache keys" is implemented as a *partial* retire.** Planning verified that `companyProfile` and `companyProfileForRefresh` are **cross-component published state** read by `src/pages/MarketResearch.tsx` and `src/pages/MissionControl.tsx`, and `companyProfileUpdated` is listened to by `DataSourcesManager`, `MarketResearch`, and `RegulatoryComplianceSection` — none of which migrate until Phases 5–7. So Task 9 retires only CompanyProfile's **mount-read-as-fetch-cache** (replaced by `useQuery`) and **preserves** the save-side localStorage writes + the `companyProfileUpdated` flag/event, *adding* query invalidation rather than substituting it. A full retire would silently break those non-migrated readers (spec R2). This is the spec's own §3.6 instruction ("the plan checks its listeners and decides") resolved against ground truth; the keys fully retire when their consumers migrate.
- **`profileData` prop override dropped + Settings' company fetch orphaned (plan-review F3/F5).** Task 9 removes CompanyProfile's `profileData`-override `useEffect` (the `useQuery` supersedes it). `Settings.tsx` still runs `fetchProfileData("company")` and spreads the result via `commonProps.profileData`, which CompanyProfile now ignores → an orphaned GET. `Settings.tsx` is left unchanged (the same generic prop feeds the non-migrated `UserProfile`/`AgentProfile`); the orphaned fetch is recorded as **TD-FE-11** (Task 9 Step 3) and collapsed when Settings / those siblings migrate (Phase 4+).

**Out-of-scope deferrals confirmed:** the 4 `executeWithRateLimit` sites (Phase 5), the 8 `apiFetch` consumers (Phases 5–7), market-research/customers/signals localStorage cache keys (Phases 5–8), `AuthContext.fetchOrgId`'s own `/api/org` GET (not in scope; the `useLogin` wrapper calls it but does not route it through `client.ts`), the global cache-persistence ADR (Phase 5), and the now-dead `TenantContext.availableTenants`/`setAvailableTenants` (**TD-FE-12**; removed when Phase 4/10 owns the context API). Any new discovery during implementation is logged `TD-FE-<n>` in `docs/TECH_DEBT.md`, not folded into Phase 3.
