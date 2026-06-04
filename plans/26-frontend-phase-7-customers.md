# Phase 7 — customers feature extraction · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the `/customers` (Profiler-agent) surface — `Customers.tsx`, `SuggestedICPCards.tsx` (2,494 LOC), `LeadStream.tsx`, `ICPIntelligence.tsx`, and the relocated `ProfilerChatWithHistory.tsx` — into `src/features/customers/`, behind the converged per-feature shape (route registry + `<FeatureErrorBoundary>` + TanStack Query data layer + zod contracts + per-component Vitest + locked `index.ts`). Behavior, routes, and visuals are frozen.

**Architecture:** One branch (`phase-7-customers` off `master`), one plan, a staged commit-series with green checkpoints — Phase 6's model, not Phase 5's separately-merged sub-phases. Reads migrate to a zod-validated service layer surfaced through TanStack read hooks; writes migrate to `useMutation` while the `localStorage` optimism stays in the component (parity-first, cache-native deferred to TD-FE). The whole phase merges once, `--no-ff`, only after a green serial `npm run preflight`.

**Tech Stack:** React 18 + Vite + TypeScript, TanStack Query (`@tanstack/react-query`), zod contracts, MSW (`src/test/msw/`), Vitest + RTL, Playwright VR journey `06`. The flexible `/icp` parser, the `localStorage`/`sessionStorage` keys, and the `window`-event bridge are preserved byte-for-behavior.

---

## Conventions & execution rules (read first — these override habits)

- **Branch & merge.** Work on `phase-7-customers`, branched off `master`. The whole phase merges **once**, `--no-ff`, after the stage-5 serial preflight is green. Do **not** merge per-stage. The branch is local/unshared during the phase, so a failed stage may be discarded with `git reset --hard <last-green-checkpoint-commit>` (Spec 26 §7) rather than reverted.
- **Worktree git.** If executing in a `.claude/worktrees/` worktree, run every git op as `git -C <worktree-abs-path> …` — a bare `cd <repo-root>` lands in the main checkout (master), not the worktree.
- **Surgical commits in a shared tree.** Parallel agents may share the working tree. **Never `git add -A`.** Stage only the explicit paths each task names. One logical step = one commit.
- **Commit messages.** `type(scope):` form (`feat(fe):`, `refactor(fe):`, `chore(fe):`, `test(fe):`, `docs(fe):` / `docs:`). No `[N/M]` suffixes. **No `Co-Authored-By` footer.** Body only when the *why* isn't obvious from the diff.
- **Inner loop (per task).** Run `npm run verify` from `frontend/` (= `typecheck && lint && test`). Plus, because `verify` omits `format:check`, run `npx prettier --check <touched files>` on the files you changed — **except** never prettier `docs/TECH_DEBT.md` (it lives outside the FE prettier gate and prettier corrupts its unfenced markdown).
- **Do NOT run `npm run knip` before stage 5.** Stage 2 deliberately creates read hooks before they are consumed (hook-first). `knip --strict` would flag the transient unused exports; the window closes in stage 3. `verify` does not run knip, so per-task gates stay green. `knip` runs only inside the stage-5 serial `preflight`.
- **Shared test infra.** When a task touches `src/test/msw/handlers.ts` or shared fixtures, also run the broader `npm run test` (already part of `verify`) and grep for sibling consumers before changing a handler — MSW collisions surface in other features' tests.
- **Vitest flake.** If the full suite flakes on async `waitFor` tests under CPU contention, rerun with `npm run test -- --no-file-parallelism` (100% green; not a defect). Do not "fix" it by weakening assertions.
- **Stage gate.** At each stage boundary run `npm run verify` **plus** the customers journey + VR: `pkill -f "vite preview" || true` (kill any orphan preview server that would false-green the VR), then `npm run test:e2e -- e2e/journeys/06-customers-page-load.spec.ts`. VR threshold is 2% (`maxDiffPixelRatio: 0.02`); minor bounding-box shifts from added wrappers are acceptable if visually identical.
- **Final merge gate.** The serial `npm run preflight` (`typecheck && lint && format:check && test && build && bundle:check && test:e2e && knip`). Use the **serial** runner, never `preflight:par`, to avoid VR flakes under concurrent load.
- **Parity is the contract.** No behavior or pixel change. If a step would change a rendered loading/error state, a URL, a storage key, or an event name, stop — that's a parity break, not a refactor.
- **Abort / escalation (phase floor).** The per-step parity rule and the per-stage `git reset --hard <last-green-checkpoint>` are the recovery primitives. Above them: if a **single task** fails its stage-gate (verify or VR) **three** times with no clear fix — most likely T11 (the read transport swap, R1) — stop forcing it and escalate to the human controller. If it is unresolved within the session, **suspend the phase** and revisit Spec 26 rather than landing a partial/behavior-changing cut. The branch is local/unshared, so suspension costs nothing but the discarded work. (Matches the pre-launch CTO-autonomy posture; the merge is human-approved regardless — T22.)
- **Parallelizable pairs (subagent mode).** If executing via `subagent-driven-development`, these within-stage task pairs are independent and may run concurrently: **T3 ∥ T4** (query keys / contracts), **T6 ∥ T7** (the two read hooks), **T14 ∥ T15** (accept-save / reject-delete mutations). Serial execution is equally valid; this only flags the available fan-out.

---

## File structure (target — Spec 26 §3)

```
src/features/customers/
├── pages/
│   └── CustomersPage.tsx               # from Customers.tsx; route shell; tabs; window-event bridge
├── components/
│   ├── icp-intelligence/
│   │   ├── ICPIntelligence.tsx          # thin wrapper (profilerRefresh handler)
│   │   ├── SuggestedICPCards.tsx         # decomposed container
│   │   ├── SuggestedICPCard.tsx          # extracted recommended-ICP card cluster (T12)
│   │   ├── CurrentIcpsTable.tsx          # extracted Current-ICPs table (T12)
│   │   ├── icpMapping.ts                 # pure mappers (T9)
│   │   ├── suggestedIcpStorage.ts        # pure localStorage I/O (T10)
│   │   └── __tests__/
│   ├── lead-stream/
│   │   ├── LeadStream.tsx                # mock panel; exports LeadStreamPanel + getLeadCountForICP
│   │   └── __tests__/
│   └── chat/
│       ├── ProfilerChatWithHistory.tsx   # relocated; imports SignalsContextChat via legacy alias
│       └── __tests__/
├── hooks/
│   ├── useCustomerProfile.ts             # useQuery (customer_profile read)
│   ├── useSuggestedIcps.ts               # useQuery (/icp recommendations read)
│   ├── useSaveCustomerProfile.ts         # useMutation (firmographics save)
│   ├── useAcceptSuggestedIcp.ts          # useMutation (from_suggested_icp)
│   ├── useRejectSuggestedIcp.ts          # useMutation (DELETE reject + DELETE current-ICP ×2)
│   └── __tests__/
├── services/
│   └── customers.ts                      # read/write API call layer
├── contracts.ts                          # zod schemas for /icp + customer_profile
├── types.ts                              # ExistingICP, SuggestedICP, ICPCardStatus, ICPAnalysis, …
├── routes.tsx                            # customersRoutes (/customers, FeatureErrorBoundary)
├── index.ts                              # public surface (customersRoutes)
└── README.md
```

Subcomponent names inside `icp-intelligence/` are the **expected seams**, finalized in T12 — not a contract.

---

# Stage 1 — Scaffold + relocate (parity)

Spec 26 §7.1. Mechanically move the five files; convert same-feature alias self-imports to relative; keep permitted legacy imports; wire the route registry. **No logic change.** Two commits (scaffold, then relocate).

## Task 1: Scaffold the `customers` feature skeleton

**Files:**
- Create: `frontend/src/features/customers/types.ts`
- Create: `frontend/src/features/customers/index.ts`
- Create: `frontend/src/features/customers/README.md`

Context: a thin, green skeleton so the relocation in T2 has a home. `types.ts` is populated in T8 (extracted from the monolith); `index.ts` is finalized in T2 (routes) and locked in T18; `README.md` is finalized in T19.

- [ ] **Step 1: Create `types.ts` placeholder.**

```ts
// Feature-local types for `customers`. Populated in stage 3 (T8), extracted
// verbatim from SuggestedICPCards.tsx. Placeholder kept green until then.
export {};
```

- [ ] **Step 2: Create `index.ts` placeholder.**

```ts
// Public surface for the `customers` feature. Finalized in T2 (routes) and
// locked in T18. Cross-feature consumers import from "@/features/customers",
// never a deep path.
export {};
```

- [ ] **Step 3: Create `README.md` placeholder.**

```markdown
# `customers` feature

Placeholder — finalized in T19 (Spec 26 §3, plan 26).
```

- [ ] **Step 4: Verify.** Run from `frontend/`:

```
npm run verify
```
Expected: PASS (typecheck + lint + test). Nothing imports the skeleton yet.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/features/customers/types.ts frontend/src/features/customers/index.ts frontend/src/features/customers/README.md
git commit -m "chore(fe): scaffold customers feature skeleton"
```

## Task 2: Relocate the five files + wire the route registry

**Files:**
- Move → Create: `frontend/src/features/customers/pages/CustomersPage.tsx` (from `src/pages/Customers.tsx`)
- Move → Create: `frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx` (from `src/components/customers/SuggestedICPCards.tsx`)
- Move → Create: `frontend/src/features/customers/components/icp-intelligence/ICPIntelligence.tsx` (from `src/components/customers/ICPIntelligence.tsx`)
- Move → Create: `frontend/src/features/customers/components/lead-stream/LeadStream.tsx` (from `src/components/customers/LeadStream.tsx`)
- Move → Create: `frontend/src/features/customers/components/chat/ProfilerChatWithHistory.tsx` (from `src/components/signals/ProfilerChatWithHistory.tsx`)
- Create: `frontend/src/features/customers/routes.tsx`
- Modify: `frontend/src/features/customers/index.ts`
- Modify: `frontend/src/app/routes.tsx`
- Modify: `frontend/src/App.tsx` (remove the legacy `Customers` import + `/customers` `<Route>`)
- Delete: `src/pages/Customers.tsx`, `src/components/customers/SuggestedICPCards.tsx`, `src/components/customers/ICPIntelligence.tsx`, `src/components/customers/LeadStream.tsx`, `src/components/signals/ProfilerChatWithHistory.tsx`

Context: the five files cross-import, so this is one interconnected move — a single commit keeps the tree green (no half-moved state compiles). Use `git mv` to preserve history, then fix imports. **Do not commit partway through this task** (there is no compiling intermediate). If the import fixes go wrong mid-task, recover with `git checkout -- <moved-paths>` (or `git reset --hard` to the T1 checkpoint) and re-run the move as one pass — re-doing `git mv` loses nothing, since git infers renames at diff time from content similarity, not from the `mv` operation itself.

- [ ] **Step 1: `git mv` each file to its new path.**

```bash
git mv frontend/src/pages/Customers.tsx                              frontend/src/features/customers/pages/CustomersPage.tsx
git mv frontend/src/components/customers/SuggestedICPCards.tsx       frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx
git mv frontend/src/components/customers/ICPIntelligence.tsx         frontend/src/features/customers/components/icp-intelligence/ICPIntelligence.tsx
git mv frontend/src/components/customers/LeadStream.tsx              frontend/src/features/customers/components/lead-stream/LeadStream.tsx
git mv frontend/src/components/signals/ProfilerChatWithHistory.tsx   frontend/src/features/customers/components/chat/ProfilerChatWithHistory.tsx
```

- [ ] **Step 2: Fix `CustomersPage.tsx` imports + rename the component.** Replace the three same-feature/relocated imports; **keep** the legacy-transitional ones (`ErrorBoundary`, `SignalsChatContext` from the substrate, `Layout`, `usePageTitle`, ui/tabs). Then rename `const Customers` → `const CustomersPage` and `export default Customers` → `export default CustomersPage`.

```ts
// REMOVE these three:
//   import { ICPIntelligence } from "@/components/customers/ICPIntelligence";
//   import { LeadStreamPanel } from "@/components/customers/LeadStream";
//   import { ProfilerChatWithHistory } from "@/components/signals/ProfilerChatWithHistory";
// REPLACE with relative paths to the relocated files:
import { ICPIntelligence } from "../components/icp-intelligence/ICPIntelligence";
import { LeadStreamPanel } from "../components/lead-stream/LeadStream";
import { ProfilerChatWithHistory } from "../components/chat/ProfilerChatWithHistory";
// KEEP (legacy substrate stays in src/components/signals/ — Spec 26 §5):
import type { SignalsChatContext } from "@/components/signals/SignalsContextChat";
```

```ts
// bottom of file:
const CustomersPage = () => {
  // …unchanged body…
};

export default CustomersPage;
```

- [ ] **Step 3: Fix `SuggestedICPCards.tsx` imports.** Only the same-feature `LeadStream` import changes to relative (it now lives in the sibling `lead-stream/` folder). **Keep** `@/components/market-research/EditDropdownMenu` — it is a legacy dir not yet migrated (Spec 26 §3.1, transitional; it is `@/components/*`, not `@/features/*`, so the `import-x/no-internal-modules` rule does not flag it). Keep all other `@/…` imports.

```ts
// REMOVE:
//   import { getLeadCountForICP } from "@/components/customers/LeadStream";
// REPLACE with relative (sibling folder under components/):
import { getLeadCountForICP } from "../lead-stream/LeadStream";
```

- [ ] **Step 4: `ICPIntelligence.tsx` — no import change.** Its `import { SuggestedICPCards } from "./SuggestedICPCards";` is already relative and both files moved together into `icp-intelligence/`. Leave as-is.

- [ ] **Step 5: `LeadStream.tsx` — no import change.** Pure mock; imports only `lucide-react`, `react`, and `@/components/ui/*`. Leave as-is.

- [ ] **Step 6: Fix `ProfilerChatWithHistory.tsx` imports.** Its relative `./SignalsContextChat` must become the legacy alias — the substrate stays in `src/components/signals/` (Spec 26 §5, R2).

```ts
// REMOVE these two relative imports:
//   import type { SignalsChatContext, ChatMessage } from "./SignalsContextChat";
//   import { SignalsContextChat } from "./SignalsContextChat";
// REPLACE with the legacy alias path:
import type { SignalsChatContext, ChatMessage } from "@/components/signals/SignalsContextChat";
import { SignalsContextChat } from "@/components/signals/SignalsContextChat";
```

- [ ] **Step 7: Create `routes.tsx`** (mirrors mission-control; wraps `<FeatureErrorBoundary featureName="Customers">` inside `<ProtectedRoute requireTenant>`).

```tsx
import { Route } from "react-router-dom";

import CustomersPage from "./pages/CustomersPage";

import { ProtectedRoute } from "@/features/shell";
import { FeatureErrorBoundary } from "@/shared/components";

/** Customers route surface. Composed (append-only) by `src/app/routes.tsx`. */
export const customersRoutes = [
  <Route
    key="customers"
    path="/customers"
    element={
      <ProtectedRoute requireTenant>
        <FeatureErrorBoundary featureName="Customers">
          <CustomersPage />
        </FeatureErrorBoundary>
      </ProtectedRoute>
    }
  />,
];
```

- [ ] **Step 8: Finalize `index.ts`** (replace the placeholder).

```ts
// Public surface for the `customers` feature.
// Cross-feature consumers import from "@/features/customers", never a deep path.
export { customersRoutes } from "./routes";
```

- [ ] **Step 9: Register in `src/app/routes.tsx`** (append-only).

```ts
import { customersRoutes } from "@/features/customers";
import { marketResearchRoutes } from "@/features/market-research";
import { missionControlRoutes } from "@/features/mission-control";

export const featureRoutes = [
  ...marketResearchRoutes,
  ...missionControlRoutes,
  ...customersRoutes,
];
```

- [ ] **Step 10: Remove the legacy customers wiring from `src/App.tsx`.** Delete the import at line 7 (`import Customers from "./pages/Customers";`) and the entire `<Route path="/customers"> … <Customers /> … </Route>` block (around lines 66–72). The `/customers` URL now resolves through `{featureRoutes}`.

- [ ] **Step 11: Verify.** Run from `frontend/`:

```
npm run verify
npx prettier --check "src/features/customers/**/*.{ts,tsx}" src/app/routes.tsx src/App.tsx
```
Expected: PASS. Typecheck confirms every moved import resolves; lint confirms no `@/features/*` deep-import was introduced.

- [ ] **Step 12: Stage gate — journey + VR.** Run from `frontend/`:

```
pkill -f "vite preview" || true
npm run test:e2e -- e2e/journeys/06-customers-page-load.spec.ts
```
Expected: PASS, VR within 2%. (Confirms `/customers` still renders identically via the registry.)

- [ ] **Step 13: Commit.**

```bash
git add frontend/src/features/customers frontend/src/app/routes.tsx frontend/src/App.tsx
git commit -m "refactor(fe): relocate customers surface into features/customers + route registry"
```

---

# Stage 2 — Read-path data layer (hook-first)

Spec 26 §7.2 / §4. Build `contracts.ts` + `services/customers.ts` (reads) + `useCustomerProfile` / `useSuggestedIcps` + MSW handlers, each unit-tested. The hooks are **created here but consumed in stage 3** — the monolith still runs its raw reads at this checkpoint. Do not run `knip` until stage 5.

## Task 3: Add customers query keys

**Files:** Modify `frontend/src/shared/api/queryKeys.ts`

Context: customers keeps its **own** read cache — it must not share mission-control's `qk.icps(orgId)` (Spec 26 §4 "keep own read"; overlap is TD-FE-42). Add two namespaced keys.

- [ ] **Step 1: Append to the `qk` object** (after `leadStreamStatus`):

```ts
  customersProfile: (userId: string, orgId: string) =>
    ["customers", "profile", userId, orgId] as const,
  customersSuggestedIcps: (userId: string) => ["customers", "suggested-icps", userId] as const,
```

- [ ] **Step 2: Verify + prettier.**

```
npm run verify
npx prettier --check src/shared/api/queryKeys.ts
```
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add frontend/src/shared/api/queryKeys.ts
git commit -m "feat(fe): add customers query keys (own read cache)"
```

## Task 4: zod contracts for `/icp` + `customer_profile`

**Files:** Create `frontend/src/features/customers/contracts.ts`

Context: permissive by design — the backend is suspended/variable (memory: `backend-11kr` 503) and the live parser tolerates many shapes. Every field optional, `.passthrough()`, union of array | wrapped-object. Because nothing is required, `.parse` validates the envelope at the service boundary but never rejects a real response (Spec 26 §4); missing fields fall back to the defaults `mapApiICPToSuggested` already produces.

- [ ] **Step 1: Write `contracts.ts`.**

```ts
import { z } from "zod";

/**
 * A single recommended-ICP item from GET /icp — kept opaque (shape varies).
 * Module-local (not exported): only the response schema below references it, so
 * exporting it would be an unused export under `knip --strict`.
 */
const suggestedIcpItemSchema = z.object({}).passthrough();

/**
 * GET /icp response. The backend may return a bare array, or an object wrapping
 * the list under `data` / `payload` / `result` / `icps` / `suggestedICPs` /
 * `results` / `items` / `recommendations` / `profiles`, or a single root object.
 * All optional + `.passthrough()` so `.parse` never throws on a real response;
 * `normalizeIcpGetResponse` (icpMapping.ts) resolves which shape it actually is.
 */
export const SuggestedIcpsResponseSchema = z.union([
  z.array(suggestedIcpItemSchema),
  z
    .object({
      data: z.unknown().nullish(),
      payload: z.unknown().nullish(),
      result: z.unknown().nullish(),
      icps: z.array(suggestedIcpItemSchema).nullish(),
      suggestedICPs: z.array(suggestedIcpItemSchema).nullish(),
      results: z.array(suggestedIcpItemSchema).nullish(),
      items: z.array(suggestedIcpItemSchema).nullish(),
      recommendations: z.array(suggestedIcpItemSchema).nullish(),
      profiles: z.array(suggestedIcpItemSchema).nullish(),
    })
    .passthrough(),
]);
export type SuggestedIcpsResponse = z.infer<typeof SuggestedIcpsResponseSchema>;

/**
 * GET/POST /api/customer_profile. The row shape varies and is consumed via the
 * shared `@/shared/profiler` extractors; kept opaque + passthrough so `.parse`
 * validates the envelope without constraining rows. Consumed at the boundary by
 * `saveAcceptedIcpFirmographics` (T13) — keep it referenced so it is not a dead
 * export under `knip --strict`.
 */
export const CustomerProfileResponseSchema = z
  .object({
    icps: z.array(z.object({}).passthrough()).nullish(),
    data: z.unknown().nullish(),
  })
  .passthrough();
```

- [ ] **Step 2: Verify + prettier.**

```
npm run verify
npx prettier --check src/features/customers/contracts.ts
```
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add frontend/src/features/customers/contracts.ts
git commit -m "feat(fe): add customers zod contracts (permissive /icp + customer_profile)"
```

## Task 5: Read service layer + MSW baseline handlers

**Files:**
- Create: `frontend/src/features/customers/services/customers.ts`
- Modify: `frontend/src/test/msw/handlers.ts`
- Create: `frontend/src/features/customers/services/__tests__/customers.test.ts`

Context: two reads. `fetchCustomerProfileIcps` mirrors mission-control's `useICPs` (delegates to the shared extractor `fetchIcpsRowsForOrg`, which hits `/api/profile/company` → `/api/customer_profile`). `fetchSuggestedIcps` is **parity-critical**: the live code builds `buildIcpUrl(...)` → the **direct backend host** (`BACKEND_BASE_URL/icp`, NOT the `/api` proxy), so it keeps a raw `fetch` against that exact URL rather than routing through `apiGet` (which would rewrite it to `/api/icp`). The permissive contract `.parse`s the body; normalization stays with the consumer (icpMapping.ts, T9).

- [ ] **Step 1: Write `services/customers.ts` (read functions only).**

```ts
import { SuggestedIcpsResponseSchema, type SuggestedIcpsResponse } from "../contracts";

import { buildIcpUrl } from "@/lib/api";
import { fetchIcpsRowsForOrg } from "@/shared/profiler";

/**
 * Current ICPs read — GET /api/customer_profile via the shared extractor (same
 * source Mission Control uses). Returns RAW rows; the container maps them with
 * `mapCustomerProfileICPToExisting`. Customers keeps its OWN read and does NOT
 * adopt mission-control's `useICPs` (Spec 26 §4; overlap tracked TD-FE-42).
 */
export function fetchCustomerProfileIcps(userId: string, orgId: string): Promise<unknown[]> {
  return fetchIcpsRowsForOrg(userId, orgId);
}

/**
 * Recommended ICPs read — GET /icp. Parity-critical: `buildIcpUrl` resolves to
 * the DIRECT backend host (not the `/api` proxy), so we raw-`fetch` that exact
 * URL. The permissive schema `.parse`s the body at the boundary; the consumer
 * normalizes (`normalizeIcpGetResponse`) + maps (`mapApiICPToSuggested`).
 */
export async function fetchSuggestedIcps(
  userId: string,
  opts: { refresh?: boolean } = {},
): Promise<SuggestedIcpsResponse> {
  const params = new URLSearchParams({ user_id: userId });
  if (opts.refresh) params.set("refresh", "true");
  const res = await fetch(buildIcpUrl(params.toString()), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`GET /icp failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return SuggestedIcpsResponseSchema.parse(json);
}
```

- [ ] **Step 2: Add customers baseline MSW handlers.** Append a clearly-commented block to `src/test/msw/handlers.ts` so component RTL tests (stages 3–4) and the journey have defaults under `onUnhandledRequest: "error"`. Import `BACKEND_BASE_URL` at the top of the file if not already imported. The `/icp` handler must target the **full backend URL** (it is not under `/api`).

```ts
import { BACKEND_BASE_URL } from "@/lib/api"; // add to existing imports if missing

// ── customers (Phase 7) ──────────────────────────────────────────────────────
// Profiler reads/writes. /icp is on the direct backend host (not /api).
http.get(`${BACKEND_BASE_URL}/icp`, () => HttpResponse.json({ icps: [] })),
http.get("/api/customer_profile", () => HttpResponse.json({ icps: [] })),
http.get("/api/profile/company", () => HttpResponse.json({})),
http.post("/api/customer_profile", () => HttpResponse.json({ success: true })),
http.post("/api/customer_profile/from_suggested_icp", () =>
  HttpResponse.json({ success: true, data: { id: "persisted-1" } }),
),
http.delete("/api/customer_profile/icp/:icpId", () =>
  HttpResponse.json({ success: true, data: { deleted_icp_id: "x", remaining_count: 0 } }),
),
http.delete("/api/icp/recommended/:icpId", () => HttpResponse.json({ success: true })),
```
(Insert these inside the existing `handlers` array. **First `grep -n` `handlers.ts` for each path above.** If any path already exists for another feature, leave the existing one and skip the duplicate; if another feature needs a *different* shape for the same path, do **not** change the shared default — scope the customers shape with `server.use()` inside the customers tests instead. A shared-default shape change can surface as a VR regression on a *sibling* feature's journey, which the stage-gate (customers-only) journey would not catch until the stage-5 serial preflight runs the full e2e suite — so keep shared defaults additive and minimal.)

- [ ] **Step 3: Write the service test** (`services/__tests__/customers.test.ts`).

```ts
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { fetchCustomerProfileIcps, fetchSuggestedIcps } from "../customers";

import { BACKEND_BASE_URL } from "@/lib/api";
import { server } from "@/test/msw/server";

describe("fetchSuggestedIcps", () => {
  it("parses the wrapped { icps: [...] } envelope", async () => {
    server.use(
      http.get(`${BACKEND_BASE_URL}/icp`, () =>
        HttpResponse.json({ icps: [{ id: "r1" }, { id: "r2" }] }),
      ),
    );
    const res = await fetchSuggestedIcps("u1");
    // Permissive passthrough: the envelope round-trips for the consumer to normalize.
    expect(res).toMatchObject({ icps: [{ id: "r1" }, { id: "r2" }] });
  });

  it("parses a bare array response", async () => {
    server.use(http.get(`${BACKEND_BASE_URL}/icp`, () => HttpResponse.json([{ id: "r1" }])));
    const res = await fetchSuggestedIcps("u1");
    expect(Array.isArray(res)).toBe(true);
  });

  it("sends refresh=true when requested", async () => {
    let seenUrl = "";
    server.use(
      http.get(`${BACKEND_BASE_URL}/icp`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json([]);
      }),
    );
    await fetchSuggestedIcps("u1", { refresh: true });
    expect(seenUrl).toContain("refresh=true");
    expect(seenUrl).toContain("user_id=u1");
  });

  it("throws on a non-ok response", async () => {
    server.use(
      http.get(`${BACKEND_BASE_URL}/icp`, () => new HttpResponse(null, { status: 500 })),
    );
    await expect(fetchSuggestedIcps("u1")).rejects.toThrow(/GET \/icp failed: 500/);
  });
});

describe("fetchCustomerProfileIcps", () => {
  it("returns the extracted rows from the shared customer_profile read", async () => {
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})),
      http.get("/api/customer_profile", () =>
        HttpResponse.json({ icps: [{ id: "i1" }, { id: "i2" }] }),
      ),
    );
    const rows = await fetchCustomerProfileIcps("u1", "org1");
    expect(Array.isArray(rows)).toBe(true);
  });
});
```

- [ ] **Step 4: Verify + prettier.**

```
npm run verify
npx prettier --check src/features/customers/services/customers.ts src/features/customers/services/__tests__/customers.test.ts src/test/msw/handlers.ts
```
Expected: PASS. (Confirm the new handler block did not collide with a sibling feature's test — `npm run test` covers the whole suite.)

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/features/customers/services frontend/src/test/msw/handlers.ts
git commit -m "feat(fe): add customers read service layer + MSW handlers"
```

## Task 6: `useCustomerProfile` read hook

**Files:**
- Create: `frontend/src/features/customers/hooks/useCustomerProfile.ts`
- Create: `frontend/src/features/customers/hooks/__tests__/useCustomerProfile.test.tsx`

Context: `retry: false` for strict parity — the raw fetch made a single attempt, but the global `QueryClient` default is `retry: 1` (Spec 26 §4).

- [ ] **Step 1: Write `useCustomerProfile.ts`.**

```ts
import { useQuery } from "@tanstack/react-query";

import { fetchCustomerProfileIcps } from "../services/customers";

import { qk } from "@/shared/api/queryKeys";

/**
 * Current ICPs (GET /api/customer_profile via the shared extractor). Customers
 * keeps its own read — not mission-control's `useICPs` (Spec 26 §4; TD-FE-42).
 * `retry: false` mirrors the single-attempt raw fetch (global default is 1).
 */
export function useCustomerProfile(userId: string, orgId: string, enabled = true) {
  return useQuery({
    queryKey: qk.customersProfile(userId, orgId),
    enabled: enabled && !!userId && !!orgId,
    queryFn: () => fetchCustomerProfileIcps(userId, orgId),
    retry: false,
  });
}
```

- [ ] **Step 2: Write the hook test** (QueryClient wrapper + MSW, mirroring `useICPs.test.tsx`).

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useCustomerProfile } from "../useCustomerProfile";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useCustomerProfile", () => {
  it("returns the extracted ICP rows", async () => {
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})),
      http.get("/api/customer_profile", () =>
        HttpResponse.json({ icps: [{ id: "i1" }, { id: "i2" }] }),
      ),
    );
    const { result } = renderHook(() => useCustomerProfile("u1", "org1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it("is disabled without userId/orgId", () => {
    const { result } = renderHook(() => useCustomerProfile("", "org1"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
```

- [ ] **Step 3: Verify + prettier.**

```
npm run verify
npx prettier --check src/features/customers/hooks/useCustomerProfile.ts src/features/customers/hooks/__tests__/useCustomerProfile.test.tsx
```
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/features/customers/hooks/useCustomerProfile.ts frontend/src/features/customers/hooks/__tests__/useCustomerProfile.test.tsx
git commit -m "feat(fe): add useCustomerProfile read hook"
```

## Task 7: `useSuggestedIcps` read hook

**Files:**
- Create: `frontend/src/features/customers/hooks/useSuggestedIcps.ts`
- Create: `frontend/src/features/customers/hooks/__tests__/useSuggestedIcps.test.tsx`

Context: returns the permissively-parsed `/icp` response; the consumer normalizes + maps. `enabled` gates on `userId` (the live code skips GET /icp without a user). `retry: false` mirrors the single raw attempt.

- [ ] **Step 1: Write `useSuggestedIcps.ts`.**

```ts
import { useQuery } from "@tanstack/react-query";

import { fetchSuggestedIcps } from "../services/customers";

import { qk } from "@/shared/api/queryKeys";

/**
 * Recommended ICPs (GET /icp). Returns the raw permissive response; the
 * consumer applies `normalizeIcpGetResponse` + `mapApiICPToSuggested`
 * (icpMapping.ts). `refresh` is forwarded to the service; the consumer calls
 * `refetch()` when the header Refresh fires. `retry: false` for raw-fetch parity.
 */
export function useSuggestedIcps(
  userId: string,
  opts: { refresh?: boolean; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: qk.customersSuggestedIcps(userId),
    enabled: (opts.enabled ?? true) && !!userId,
    queryFn: () => fetchSuggestedIcps(userId, { refresh: opts.refresh }),
    retry: false,
  });
}
```

- [ ] **Step 2: Write the hook test.**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useSuggestedIcps } from "../useSuggestedIcps";

import { BACKEND_BASE_URL } from "@/lib/api";
import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useSuggestedIcps", () => {
  it("returns the parsed /icp envelope", async () => {
    server.use(
      http.get(`${BACKEND_BASE_URL}/icp`, () => HttpResponse.json({ icps: [{ id: "r1" }] })),
    );
    const { result } = renderHook(() => useSuggestedIcps("u1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data).toMatchObject({ icps: [{ id: "r1" }] });
  });

  it("is disabled without userId", () => {
    const { result } = renderHook(() => useSuggestedIcps(""), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
```

- [ ] **Step 3: Verify + prettier.**

```
npm run verify
npx prettier --check src/features/customers/hooks/useSuggestedIcps.ts src/features/customers/hooks/__tests__/useSuggestedIcps.test.tsx
```
Expected: PASS.

- [ ] **Step 4: Stage gate — journey + VR** (the monolith still raw-fetches; this confirms no regression):

```
pkill -f "vite preview" || true
npm run test:e2e -- e2e/journeys/06-customers-page-load.spec.ts
```
Expected: PASS, VR within 2%.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/features/customers/hooks/useSuggestedIcps.ts frontend/src/features/customers/hooks/__tests__/useSuggestedIcps.test.tsx
git commit -m "feat(fe): add useSuggestedIcps read hook"
```

---

# Stage 3 — `SuggestedICPCards` decomposition

Spec 26 §7.3 / §3 purity frame. One extraction per commit, green between each: pure `types.ts` → pure `icpMapping.ts` → pure `suggestedIcpStorage.ts` → swap reads onto the stage-2 hooks (parity audit) → extract card subcomponents. The transient unused-export window from stage 2 closes here.

## Task 8: Extract `types.ts`

**Files:**
- Modify: `frontend/src/features/customers/types.ts` (replace placeholder)
- Modify: `frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx`

Context: move the feature-local types out of the monolith so mappers/cards/hooks can share them. These are cut verbatim from `SuggestedICPCards.tsx`.

- [ ] **Step 1: Populate `types.ts`** with the types currently defined in `SuggestedICPCards.tsx` (verbatim): `ExistingICP`, `SuggestedICP`, `ICPCardStatus`, `ICPAnalysis`, `SuggestedICPCardsProps`, `PendingRecommendedRejectItem`, `DismissedRecommendedStore`. Export each.

```ts
// Feature-local types for `customers`, extracted verbatim from
// SuggestedICPCards.tsx (Spec 26 §3). The escape-hatch `UntypedProfilerIcpRecord`
// retype stays deferred (TD-FE-9/10 posture; Phase 13) — import it from
// "@/lib/types/escape-hatches" where needed.

export interface ExistingICP {
  id: string;
  name: string;
  geography?: string;
  industry?: string;
  companySize?: string;
  buyerRole?: string;
  fitConfidence?: string;
  status?: "active" | "inactive";
}

export interface SuggestedICP {
  id: string;
  name: string;
  type: "refined" | "new";
  sourceICPId?: string;
  sourceICPName?: string;
  industry: string;
  segment: string;
  companySize: string;
  decisionMakers: string[];
  regions: string[];
  keyAttributes: string[];
  growthIndicator?: string;
  whySuggested: string[];
  whatChanged?: string[];
  opportunityUnlocked?: string;
  confidenceScore: "High" | "Medium" | "Low";
  tag?: string;
  marketSize?: string;
  growth?: string;
  topPainPoint?: string;
  buyingTriggers?: string[];
  competitors?: string[];
  /** Full report payload from GET /icp (per card). Shown only after "View Full Report". */
  fullReport?: Record<string, unknown>;
}

export interface ICPCardStatus {
  status: "suggested" | "accepted" | "rejected";
  acceptedAt?: Date;
  rejectedAt?: Date;
}

export interface SuggestedICPCardsProps {
  onICPAccepted?: (icp: SuggestedICP) => void;
  onICPRejected?: (icp: SuggestedICP) => void;
  refreshTrigger?: number;
}

export interface ICPAnalysis {
  interpretation: string;
  strengths: string[];
  weaknesses: string[];
  missing: string[];
  broadNarrow: string;
  confidence: "High" | "Medium" | "Low";
}

export type PendingRecommendedRejectItem = {
  icp_id: string;
  user_id: string;
  expiresAt: number;
  icpSnapshot?: unknown;
};

export type DismissedRecommendedStore = Record<string, string[]>;
```

- [ ] **Step 2: In `SuggestedICPCards.tsx`, delete the now-duplicated type declarations** (the `interface ExistingICP`, `interface SuggestedICP`, `interface ICPCardStatus`, `interface SuggestedICPCardsProps`, `interface ICPAnalysis`, `type PendingRecommendedRejectItem`, `type DismissedRecommendedStore` blocks) and import them instead:

```ts
import type {
  ExistingICP,
  SuggestedICP,
  ICPCardStatus,
  ICPAnalysis,
  SuggestedICPCardsProps,
  PendingRecommendedRejectItem,
  DismissedRecommendedStore,
} from "../../types";
```

- [ ] **Step 3: Verify + prettier.**

```
npm run verify
npx prettier --check src/features/customers/types.ts src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx
```
Expected: PASS (typecheck confirms the moved types are structurally identical).

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/features/customers/types.ts frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx
git commit -m "refactor(fe): extract customers feature-local types"
```

## Task 9: Extract pure `icpMapping.ts` (+ unit test)

**Files:**
- Create: `frontend/src/features/customers/components/icp-intelligence/icpMapping.ts`
- Create: `frontend/src/features/customers/components/icp-intelligence/__tests__/icpMapping.test.ts`
- Modify: `frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx`

Context: the pure ICP mappers/normalizers (no React, no component state). Move verbatim — these are the flexible `/icp` parsers the spec freezes byte-for-behavior. Symbols to move: `analyzeICP`, `confidenceColor`, `mapCustomerProfileICPToExisting`, `coalesceString`, `REPORT_FIELD_KEYS`, `buildFullReportFromRoot`, `extractFullReportFromApiItem`, `normalizeIcpGetResponse`, `hasBackendFullReport`, `mapApiICPToSuggested`.

- [ ] **Step 1: Create `icpMapping.ts`** — cut the ten symbols above verbatim from `SuggestedICPCards.tsx`. Add the imports they need at the top:

```ts
import type { ExistingICP, SuggestedICP, ICPAnalysis } from "../../types";

import type { UntypedProfilerIcpRecord } from "@/lib/types/escape-hatches";
import {
  mergeProfilerAcceptedIcpDisplay,
  PROFILER_ICP_DISPLAY_KEY,
} from "@/shared/profiler";
```
**Export only the externally-consumed symbols** — `analyzeICP`, `confidenceColor`, `mapCustomerProfileICPToExisting`, `normalizeIcpGetResponse`, `hasBackendFullReport`, `mapApiICPToSuggested` (consumed by the container, the card components in T12, and the unit test). Keep `coalesceString`, `REPORT_FIELD_KEYS`, `buildFullReportFromRoot`, and `extractFullReportFromApiItem` as **module-local** (non-exported) — they are referenced only inside `icpMapping.ts`, so exporting them would fail `knip --strict` at the stage-5 gate.

- [ ] **Step 2: In `SuggestedICPCards.tsx`, delete the moved definitions** and import them:

```ts
import {
  analyzeICP,
  confidenceColor,
  mapCustomerProfileICPToExisting,
  normalizeIcpGetResponse,
  hasBackendFullReport,
  mapApiICPToSuggested,
} from "./icpMapping";
```
Remove `mergeProfilerAcceptedIcpDisplay` and `PROFILER_ICP_DISPLAY_KEY` from the monolith's `@/shared/profiler` import **only if** they are no longer referenced anywhere else in the file (they are used by `mapCustomerProfileICPToExisting`, now moved). Leave any `@/shared/profiler` symbol still referenced by the container.

- [ ] **Step 3: Write the unit test** (`__tests__/icpMapping.test.ts`) — cover the shape-flexibility that parity depends on:

```ts
import { describe, expect, it } from "vitest";

import { mapApiICPToSuggested, normalizeIcpGetResponse, analyzeICP } from "../icpMapping";

describe("normalizeIcpGetResponse", () => {
  it("returns a bare array unchanged", () => {
    expect(normalizeIcpGetResponse([{ id: "a" }, { id: "b" }])).toHaveLength(2);
  });
  it("unwraps { data: [...] }", () => {
    expect(normalizeIcpGetResponse({ data: [{ id: "a" }] })).toHaveLength(1);
  });
  it("unwraps nested { data: { icps: [...] } }", () => {
    expect(normalizeIcpGetResponse({ data: { icps: [{ id: "a" }] } })).toHaveLength(1);
  });
  it("wraps a single root ICP object", () => {
    expect(normalizeIcpGetResponse({ id: "solo", industry: "SaaS" })).toHaveLength(1);
  });
  it("returns [] for an empty/garbage payload", () => {
    expect(normalizeIcpGetResponse(null)).toEqual([]);
    expect(normalizeIcpGetResponse({})).toEqual([]);
  });
});

describe("mapApiICPToSuggested", () => {
  it("fills safe defaults for a sparse item", () => {
    const out = mapApiICPToSuggested({ id: "x" }, 0, "new");
    expect(out.id).toBe("x");
    expect(out.industry).toBe("Unknown Industry");
    expect(out.confidenceScore).toBe("Medium");
    expect(out.decisionMakers.length).toBeGreaterThan(0);
  });
  it("reads snake_case + firmographics aliases", () => {
    const out = mapApiICPToSuggested(
      { id: "y", company_size: "200-500", firmographics: { segment: "RevOps" } },
      0,
    );
    expect(out.companySize).toBe("200-500");
    expect(out.segment).toBe("RevOps");
  });
});

describe("analyzeICP", () => {
  it("counts strengths and grades confidence", () => {
    const a = analyzeICP({
      id: "1",
      name: "ICP 1",
      industry: "SaaS",
      buyerRole: "CTO",
      companySize: "100-500",
      geography: "NA",
    });
    expect(a.confidence).toBe("High");
    expect(a.strengths.length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 4: Verify + prettier.**

```
npm run verify
npx prettier --check "src/features/customers/components/icp-intelligence/icpMapping.ts" "src/features/customers/components/icp-intelligence/__tests__/icpMapping.test.ts" "src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx"
```
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/features/customers/components/icp-intelligence/icpMapping.ts frontend/src/features/customers/components/icp-intelligence/__tests__/icpMapping.test.ts frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx
git commit -m "refactor(fe): extract pure icpMapping helpers + unit tests"
```

## Task 10: Extract pure `suggestedIcpStorage.ts` (+ unit test)

**Files:**
- Create: `frontend/src/features/customers/components/icp-intelligence/suggestedIcpStorage.ts`
- Create: `frontend/src/features/customers/components/icp-intelligence/__tests__/suggestedIcpStorage.test.ts`
- Modify: `frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx`

Context: pure `localStorage` I/O — the optimistic-disposition helpers. Move verbatim; the keys are frozen (Spec 26 §2.3). Symbols to move: the two key constants `PROFILER_PENDING_RECOMMENDED_REJECT_KEY` / `PROFILER_DISMISSED_RECOMMENDED_IDS_KEY`, and `readPendingRecommendedRejects`, `writePendingRecommendedRejects`, `upsertPendingRecommendedReject`, `removePendingRecommendedReject`, `readDismissedRecommendedStore`, `readDismissedRecommendedIds`, `recordDismissedRecommendedIcp`, `removeFromProfilerRecommendedCached`, `filterDismissedFromSuggested`, `isRecommendedDeleteNotFound`.

- [ ] **Step 1: Create `suggestedIcpStorage.ts`** — cut the constants + ten functions verbatim. Add the type import:

```ts
import type { PendingRecommendedRejectItem, DismissedRecommendedStore } from "../../types";
```
**Export only what is consumed outside the module** — `readPendingRecommendedRejects`, `upsertPendingRecommendedReject`, `removePendingRecommendedReject`, `readDismissedRecommendedIds`, `recordDismissedRecommendedIcp`, `removeFromProfilerRecommendedCached`, `filterDismissedFromSuggested`, `isRecommendedDeleteNotFound` (used by the container) and `PROFILER_DISMISSED_RECOMMENDED_IDS_KEY` (asserted by the T16 write test). Keep `writePendingRecommendedRejects`, `readDismissedRecommendedStore`, and `PROFILER_PENDING_RECOMMENDED_REJECT_KEY` **module-local** (non-exported) — they are referenced only inside `suggestedIcpStorage.ts`, so exporting them would fail `knip --strict`.

- [ ] **Step 2: In `SuggestedICPCards.tsx`, delete the moved definitions** and import them:

```ts
import {
  readPendingRecommendedRejects,
  upsertPendingRecommendedReject,
  removePendingRecommendedReject,
  readDismissedRecommendedIds,
  recordDismissedRecommendedIcp,
  removeFromProfilerRecommendedCached,
  filterDismissedFromSuggested,
  isRecommendedDeleteNotFound,
} from "./suggestedIcpStorage";
```
(Drop any of these from the import list that the container no longer references after extraction — typecheck will flag unused.)

- [ ] **Step 3: Write the unit test** (`__tests__/suggestedIcpStorage.test.ts`) — uses jsdom `localStorage`, cleared per test:

```ts
import { afterEach, describe, expect, it } from "vitest";

import {
  upsertPendingRecommendedReject,
  readPendingRecommendedRejects,
  removePendingRecommendedReject,
  recordDismissedRecommendedIcp,
  readDismissedRecommendedIds,
  filterDismissedFromSuggested,
  isRecommendedDeleteNotFound,
} from "../suggestedIcpStorage";

afterEach(() => localStorage.clear());

describe("pending recommended rejects", () => {
  it("upserts and reads back by icp_id", () => {
    upsertPendingRecommendedReject("icp1", "u1", 123, { id: "icp1" });
    const items = readPendingRecommendedRejects();
    expect(items).toHaveLength(1);
    expect(items[0].icp_id).toBe("icp1");
  });
  it("upsert replaces a same-id entry (no duplicates)", () => {
    upsertPendingRecommendedReject("icp1", "u1", 1, { id: "icp1" });
    upsertPendingRecommendedReject("icp1", "u1", 2, { id: "icp1" });
    expect(readPendingRecommendedRejects()).toHaveLength(1);
  });
  it("removes by icp_id", () => {
    upsertPendingRecommendedReject("icp1", "u1", 1, {});
    removePendingRecommendedReject("icp1");
    expect(readPendingRecommendedRejects()).toHaveLength(0);
  });
});

describe("dismissed recommended ids", () => {
  it("records per-user and filters suggestions", () => {
    recordDismissedRecommendedIcp("u1", "icpX");
    expect(readDismissedRecommendedIds("u1").has("icpX")).toBe(true);
    const { newSuggestions } = filterDismissedFromSuggested(
      "u1",
      [],
      [{ id: "icpX" }, { id: "icpY" }],
    );
    expect(newSuggestions.map((s) => s.id)).toEqual(["icpY"]);
  });
});

describe("isRecommendedDeleteNotFound", () => {
  it("treats 404 / not found as already-gone", () => {
    expect(isRecommendedDeleteNotFound(new Error("HTTP error! status: 404"))).toBe(true);
    expect(isRecommendedDeleteNotFound(new Error("Not Found"))).toBe(true);
    expect(isRecommendedDeleteNotFound(new Error("500"))).toBe(false);
  });
});
```

- [ ] **Step 4: Verify + prettier.**

```
npm run verify
npx prettier --check "src/features/customers/components/icp-intelligence/suggestedIcpStorage.ts" "src/features/customers/components/icp-intelligence/__tests__/suggestedIcpStorage.test.ts" "src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx"
```
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/features/customers/components/icp-intelligence/suggestedIcpStorage.ts frontend/src/features/customers/components/icp-intelligence/__tests__/suggestedIcpStorage.test.ts frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx
git commit -m "refactor(fe): extract pure suggestedIcpStorage helpers + unit tests"
```

## Task 11: Wire the reads onto the stage-2 hooks (parity audit)

**Files:**
- Modify: `frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx`
- Create: `frontend/src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCards.read.test.tsx`

Context (read this carefully — it is the highest-risk step, R1). The container's read effect (the `loadProfilerPagePayload` loader + the `useEffect` at the bottom of the file) does **two** network reads inline: `fetchIcpsRowsForOrg(uid, orgId)` (current ICPs) and a raw `fetch(buildIcpUrl(...))` (recommended ICPs). This task moves the **transport** onto the stage-2 service/hook layer while preserving the surrounding orchestration **byte-for-behavior**: the `missionProfilerSessionCache` short-circuit, the multi-tier `localStorage` fallbacks, the built-in mock fallback, the `profiler_icp_refresh_{uid}` refresh-dedup, the `profiler_recommendedICPs` cache write, and the loading/toast states all stay. Fully cache-native, in-render consumption (collapsing the imperative loader into the hooks) is **out of scope** and deferred (TD-FE-43).

The seam:
- Mount the read hooks at the top of the component: `const profileQuery = useCustomerProfile(currentUser?.uid ?? "", orgId || "brewra", false)` and `const suggestedQuery = useSuggestedIcps(currentUser?.uid ?? "", { enabled: false })`. They are mounted **disabled** (`enabled: false`) — the imperative loader drives fetching explicitly via the query client / `refetch`, so the hooks provide the cache + the canonical, tested `queryFn` (the service fns) without changing the orchestration's control flow. **Add a comment at the mount site so a future reader (Phase 9) doesn't mistake the disabled hooks for the data flow**, e.g. `// Registered for cache-key ownership + the canonical queryFn; fetching is still driven by the imperative loader below until TD-FE-43 collapses it cache-native.`
- Replace the inline `fetchIcpsRowsForOrg(uid, orgIdToUse)` calls inside `loadProfilerPagePayload` and `refetchCustomerProfileIcps` with `fetchCustomerProfileIcps(uid, orgIdToUse)` (from `../../services/customers`).
- Replace the inline recommended-ICP `fetch(buildIcpUrl(...))` block inside `loadProfilerPagePayload` with `await fetchSuggestedIcps(uid, { refresh: refreshJustIncremented })`, then feed its result through the existing `normalizeIcpGetResponse` → `mapApiICPToSuggested` → `filterDismissedFromSuggested` pipeline (unchanged). Preserve the existing `try/catch` so a non-ok throw still falls through to the `profiler_recommendedICPs` cache and the mock fallback exactly as today (the service throws on non-ok; the existing catch already handles the `console.warn` + toast + cache fallback).
- Remove the now-unused `buildIcpUrl` / `fetchIcpsRowsForOrg` imports from the monolith **iff** no other reference remains (typecheck will confirm).

> **Parity-audit checklist (must all hold before commit):**
> 1. The loading modal (`Dialog open={loading}`) still opens on first load and closes after the reads settle — same as today.
> 2. A non-ok `/icp` response still shows the "Refresh failed … Using cached data" toast (only when `refreshJustIncremented`) and falls back to `profiler_recommendedICPs` then mock — identical strings.
> 3. The header **Refresh** still calls GET /icp with `refresh=true` exactly once per click (the `profiler_icp_refresh_{uid}` dedup is untouched).
> 4. `profiler_recommendedICPs`, `profiler_cardStatuses`, `profiler_existingICPs`, `profiler_showRecommendations` reads/writes are unchanged.
> 5. The `missionProfilerSessionCache` snapshot short-circuit still returns cached state without a network call when valid.

- [ ] **Step 1: Apply the seam edits above** to `SuggestedICPCards.tsx`. Do not alter `loadProfilerPagePayload`'s branching, fallbacks, toasts, or storage writes — only the two transport call sites.

- [ ] **Step 2: Add an RTL read-parity test** (`__tests__/SuggestedICPCards.read.test.tsx`) — renders the container under a real `QueryClientProvider` + the auth context + MSW, and asserts the recommended cards render from the `/icp` response (and the loading modal clears). Mock `useAuth` to supply `currentUser.uid` + `orgId`.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SuggestedICPCards } from "../SuggestedICPCards";

import { BACKEND_BASE_URL } from "@/lib/api";
import { server } from "@/test/msw/server";

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

function renderCards() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<SuggestedICPCards refreshTrigger={1} />, { wrapper });
}

describe("SuggestedICPCards reads", () => {
  it("renders recommended ICPs from GET /icp and clears the loading modal", async () => {
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})),
      http.get("/api/customer_profile", () => HttpResponse.json({ icps: [] })),
      http.get(`${BACKEND_BASE_URL}/icp`, () =>
        HttpResponse.json({ icps: [{ id: "rec-1", title: "Enterprise FinTech", industry: "Financial Services" }] }),
      ),
    );
    renderCards();
    await waitFor(() => expect(screen.getByText(/Enterprise FinTech/i)).toBeInTheDocument(), {
      timeout: 5000,
    });
  });
});
```

- [ ] **Step 3: Verify + prettier.**

```
npm run verify
npx prettier --check "src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx" "src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCards.read.test.tsx"
```
Expected: PASS.

- [ ] **Step 4: Stage-mid VR check.** Run from `frontend/`:

```
pkill -f "vite preview" || true
npm run test:e2e -- e2e/journeys/06-customers-page-load.spec.ts
```
Expected: PASS, VR within 2%. If the page diverges, `git reset --hard` to the T10 checkpoint and re-attempt the seam (do not weaken the test).

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx frontend/src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCards.read.test.tsx
git commit -m "refactor(fe): route customers reads through the TanStack service layer"
```

## Task 12: Extract card subcomponents

**Files:**
- Create: `frontend/src/features/customers/components/icp-intelligence/SuggestedICPCard.tsx`
- Create: `frontend/src/features/customers/components/icp-intelligence/CurrentIcpsTable.tsx`
- Create: `frontend/src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCard.test.tsx`
- Modify: `frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx`

Context: the monolith already contains self-contained, props-driven render units. Extract them so the container becomes a thinner orchestration shell. The enumerated split (Spec 26 §3 — "the plan enumerates it"):
- **`SuggestedICPCard.tsx`** ← the recommended-ICP card cluster: `RecommendedICPCard` (the card) + its dependencies `RecommendedICPReportContent`, `SuggestedICPFullReportBody`, `BackendProfilerReportView`, and the `confidenceColor`/`hasBackendFullReport` helpers it reads (import the latter from `./icpMapping`). These are already module-level consts taking only props — a clean cut.
- **`CurrentIcpsTable.tsx`** ← the "Section 1: Current ICPs (table)" render region (the `existingICPs.map(...)` `<Table>` plus the `analyzeICP` report-row expansion). It receives `existingICPs`, `expandedCurrentICPId`, the setters, `handleDeleteCurrentIcp`, and `getLeadCountForICP` via props.
- The **Accept Confirmation `AlertDialog`** and the **loading `Dialog`** stay inline in the container (small, tightly coupled to `confirmAcceptICP` / `loading` state) — extracting them adds wrappers without reducing complexity.

- [ ] **Step 1: Create `SuggestedICPCard.tsx`** — move `BackendProfilerReportView`, `SuggestedICPFullReportBody`, `RecommendedICPReportContent` (+ its `RecommendedICPReportContentProps`), and `RecommendedICPCard` (+ its `RecommendedICPCardProps`) verbatim. Add imports:

```tsx
import type { SuggestedICP, ICPCardStatus } from "../../types";
import { confidenceColor, hasBackendFullReport } from "./icpMapping";
// + the ui/lucide imports those components reference (Card, Badge, Button, ScrollArea, icons, …)
```
Export `RecommendedICPCard` (and any sibling the container references). Keep the props shapes exactly as they are today.

- [ ] **Step 2: Create `CurrentIcpsTable.tsx`** — move the Section-1 table JSX into a presentational component:

```tsx
import type { ExistingICP } from "../../types";
import { analyzeICP } from "./icpMapping";
import { getLeadCountForICP } from "../lead-stream/LeadStream";
// + ui/lucide imports (Table*, Button, Badge, icons)

interface CurrentIcpsTableProps {
  existingICPs: ExistingICP[];
  expandedCurrentICPId: string | null;
  onToggleExpand: (id: string | null) => void;
  onDelete: (icp: ExistingICP) => void;
}

export const CurrentIcpsTable = ({ … }: CurrentIcpsTableProps) => {
  // the existingICPs.map(...) <Table> + analyzeICP report row, verbatim
};
```

- [ ] **Step 3: In `SuggestedICPCards.tsx`**, replace the inlined Section-1 table JSX with `<CurrentIcpsTable existingICPs={existingICPs} expandedCurrentICPId={expandedCurrentICPId} onToggleExpand={setExpandedCurrentICPId} onDelete={(icp) => void handleDeleteCurrentIcp(icp)} />`, and replace the inlined recommended-card markup in the `visibleRecommendedIcps.map(...)` with `<SuggestedICPCard … />` passing the same props it received inline. Delete the now-moved component definitions. Import the two new components.

- [ ] **Step 4: Add a presentational test** (`__tests__/SuggestedICPCard.test.tsx`) — render `RecommendedICPCard` with a fixture `SuggestedICP` and assert the name/industry/confidence render and the Accept/Reject buttons exist (no network — pure props):

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecommendedICPCard } from "../SuggestedICPCard";

const icp = {
  id: "rec-1",
  name: "Enterprise FinTech",
  type: "new" as const,
  industry: "Financial Services",
  segment: "FinTech",
  companySize: "500-2000",
  decisionMakers: ["CDO"],
  regions: ["US"],
  keyAttributes: ["API-first"],
  whySuggested: ["High overlap"],
  confidenceScore: "Medium" as const,
};

describe("RecommendedICPCard", () => {
  it("renders the ICP identity and actions", () => {
    render(
      <RecommendedICPCard
        icp={icp}
        status={{ status: "suggested" }}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText("Enterprise FinTech")).toBeInTheDocument();
    expect(screen.getByText(/Financial Services/i)).toBeInTheDocument();
  });
});
```
(Adjust the prop names in this test to match the actual `RecommendedICPCardProps` shape as extracted — read the interface at the top of the moved component and pass exactly those props.)

- [ ] **Step 5: Verify + prettier.**

```
npm run verify
npx prettier --check "src/features/customers/components/icp-intelligence/SuggestedICPCard.tsx" "src/features/customers/components/icp-intelligence/CurrentIcpsTable.tsx" "src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCard.test.tsx" "src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx"
```
Expected: PASS.

- [ ] **Step 6: Stage gate — journey + VR.**

```
pkill -f "vite preview" || true
npm run test:e2e -- e2e/journeys/06-customers-page-load.spec.ts
```
Expected: PASS, VR within 2%.

- [ ] **Step 7: Commit.**

```bash
git add frontend/src/features/customers/components/icp-intelligence
git commit -m "refactor(fe): extract SuggestedICPCard + CurrentIcpsTable from the monolith"
```

---

# Stage 4 — Write-path mutations

Spec 26 §7.4 / §4. Add the write service functions + `useMutation` hooks + MSW; wire them into the container while **preserving the existing `localStorage` optimism** (the 5-second undo timer, the pending/dismissed markers, the per-ICP display meta). Cache-native optimism is deferred (TD-FE-41).

## Task 13: Write service functions

**Files:**
- Modify: `frontend/src/features/customers/services/customers.ts`
- Modify: `frontend/src/features/customers/services/__tests__/customers.test.ts`

Context: four writes, ported verbatim from the container's current call sites. `acceptSuggestedIcp` → POST `customer_profile/from_suggested_icp` (`apiFetchJson`). `saveAcceptedIcpFirmographics` → the `persistAcceptedSuggestedIcpToBackend` compound (GET `customer_profile` → merge via shared helpers → POST `customer_profile`). `rejectRecommendedIcp` → DELETE `icp/recommended/{id}?user_id=` (`apiFetch`). `deleteCurrentIcp` → DELETE `customer_profile/icp/{id}?org_id=` (`apiFetch`). These keep using `@/lib/api` (`apiFetch`/`apiFetchJson` → the `/api` proxy with JWT) — there is no `apiDelete` in `@/shared/api/client`, and adding one is out of scope (a shared-infra change).

- [ ] **Step 1: Append the write functions** to `services/customers.ts`. Add the needed imports — `CustomerProfileResponseSchema` from `../contracts` (extend the existing stage-2 contracts import line); `apiFetch`, `apiFetchJson`, `buildApiUrl` from `@/lib/api`; the `@/shared/profiler` merge/extract helpers; `UntypedProfilerIcpRecord` from `@/lib/types/escape-hatches`; `SuggestedIcpCardFields` from `@/shared/profiler`.

```ts
import {
  buildApiUrl,
  apiFetch,
  apiFetchJson,
  buildIcpUrl,
} from "@/lib/api";
import type { UntypedProfilerIcpRecord } from "@/lib/types/escape-hatches";
import {
  fetchIcpsRowsForOrg,
  extractIcpsArrayFromCustomerProfileResponse,
  mergeSuggestedIntoCustomerProfileApiRow,
  buildCustomerProfileSavePayload,
  type SuggestedIcpCardFields,
} from "@/shared/profiler";
```

```ts
/** POST /api/customer_profile/from_suggested_icp — persist an accepted ICP. */
export function acceptSuggestedIcp(
  userId: string,
  orgId: string,
  icpId: string,
): Promise<unknown> {
  return apiFetchJson("customer_profile/from_suggested_icp", {
    method: "POST",
    body: { user_id: userId, org_id: orgId, icp_id: icpId },
  });
}

/**
 * Firmographics save after accept (parity port of
 * `persistAcceptedSuggestedIcpToBackend`): GET full profile → merge suggested
 * fields into the target row → POST the full icps[]. Returns ok/!ok; never throws.
 */
export async function saveAcceptedIcpFirmographics(options: {
  orgId: string;
  suggested: SuggestedIcpCardFields;
  targetIcpId: string;
}): Promise<boolean> {
  const { orgId, suggested, targetIcpId } = options;
  const profileUrl = buildApiUrl(`customer_profile?org_id=${encodeURIComponent(orgId)}`);
  try {
    const profileRes = await fetch(profileUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!profileRes.ok) return false;
    // Parse at the boundary with the permissive customer_profile contract
    // (Spec 26 §4). This is also the consumer that keeps
    // `CustomerProfileResponseSchema` from being a dead export under knip.
    const profileData = CustomerProfileResponseSchema.parse(await profileRes.json());
    const icpsData = extractIcpsArrayFromCustomerProfileResponse(profileData);
    if (!icpsData.length) return false;
    const idx = icpsData.findIndex(
      (row: UntypedProfilerIcpRecord) => String(row.id) === String(targetIcpId),
    );
    if (idx < 0) return false;
    const nextIcps = [...icpsData];
    nextIcps[idx] = mergeSuggestedIntoCustomerProfileApiRow(icpsData[idx], suggested);
    const saveRes = await fetch(profileUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCustomerProfileSavePayload(nextIcps, orgId)),
    });
    return saveRes.ok;
  } catch {
    return false;
  }
}

/** DELETE /api/icp/recommended/{id} — reject/dismiss a recommended ICP. */
export function rejectRecommendedIcp(userId: string, icpId: string): Promise<Response> {
  return apiFetch(
    `icp/recommended/${encodeURIComponent(icpId)}?user_id=${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
}

/** DELETE /api/customer_profile/icp/{id} — delete an accepted/current ICP. */
export function deleteCurrentIcp(orgId: string, icpId: string): Promise<Response> {
  return apiFetch(
    `customer_profile/icp/${encodeURIComponent(icpId)}?org_id=${encodeURIComponent(orgId)}`,
    { method: "DELETE" },
  );
}
```
(`buildIcpUrl` is already imported from the stage-2 reads; keep one import line — do not duplicate.)

- [ ] **Step 2: Add write-path service tests** to `services/__tests__/customers.test.ts`:

```ts
import { acceptSuggestedIcp, rejectRecommendedIcp, deleteCurrentIcp } from "../customers";

describe("write services", () => {
  it("accepts a suggested ICP (POST from_suggested_icp)", async () => {
    let body: unknown;
    server.use(
      http.post("/api/customer_profile/from_suggested_icp", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ success: true, data: { id: "p1" } });
      }),
    );
    await acceptSuggestedIcp("u1", "org1", "icp1");
    expect(body).toMatchObject({ user_id: "u1", org_id: "org1", icp_id: "icp1" });
  });

  it("rejects a recommended ICP (DELETE icp/recommended/:id)", async () => {
    let url = "";
    server.use(
      http.delete("/api/icp/recommended/:icpId", ({ request }) => {
        url = request.url;
        return HttpResponse.json({ success: true });
      }),
    );
    await rejectRecommendedIcp("u1", "icp1");
    expect(url).toContain("/icp/recommended/icp1");
    expect(url).toContain("user_id=u1");
  });

  it("deletes a current ICP (DELETE customer_profile/icp/:id)", async () => {
    let url = "";
    server.use(
      http.delete("/api/customer_profile/icp/:icpId", ({ request }) => {
        url = request.url;
        return HttpResponse.json({ success: true, data: { remaining_count: 0 } });
      }),
    );
    await deleteCurrentIcp("org1", "icp1");
    expect(url).toContain("/customer_profile/icp/icp1");
    expect(url).toContain("org_id=org1");
  });
});
```

- [ ] **Step 3: Verify + prettier.**

```
npm run verify
npx prettier --check src/features/customers/services/customers.ts src/features/customers/services/__tests__/customers.test.ts
```
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/features/customers/services
git commit -m "feat(fe): add customers write service functions + tests"
```

## Task 14: Save + accept mutation hooks

**Files:**
- Create: `frontend/src/features/customers/hooks/useSaveCustomerProfile.ts`
- Create: `frontend/src/features/customers/hooks/useAcceptSuggestedIcp.ts`
- Create: `frontend/src/features/customers/hooks/__tests__/useAcceptSuggestedIcp.test.tsx`

Context: each mutation invalidates the customers profile query on success (the "verify-after-save GET" folds into this invalidation — Spec 26 §4). Optimistic `localStorage`/state stays in the container.

- [ ] **Step 1: Write `useAcceptSuggestedIcp.ts`.**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { acceptSuggestedIcp } from "../services/customers";

import { qk } from "@/shared/api/queryKeys";

/** POST from_suggested_icp, then invalidate the current-ICP read (Spec 26 §4). */
export function useAcceptSuggestedIcp(userId: string, orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (icpId: string) => acceptSuggestedIcp(userId, orgId, icpId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.customersProfile(userId, orgId) });
    },
  });
}
```

- [ ] **Step 2: Write `useSaveCustomerProfile.ts`.**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { saveAcceptedIcpFirmographics } from "../services/customers";

import { qk } from "@/shared/api/queryKeys";
import type { SuggestedIcpCardFields } from "@/shared/profiler";

/** Firmographics save after accept; invalidate the current-ICP read on success. */
export function useSaveCustomerProfile(userId: string, orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { suggested: SuggestedIcpCardFields; targetIcpId: string }) =>
      saveAcceptedIcpFirmographics({ orgId, suggested: vars.suggested, targetIcpId: vars.targetIcpId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.customersProfile(userId, orgId) });
    },
  });
}
```

- [ ] **Step 3: Write the accept-hook test** (`__tests__/useAcceptSuggestedIcp.test.tsx`) — assert the mutation fires the POST and invalidates:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useAcceptSuggestedIcp } from "../useAcceptSuggestedIcp";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useAcceptSuggestedIcp", () => {
  it("posts the accept and resolves", async () => {
    server.use(
      http.post("/api/customer_profile/from_suggested_icp", () =>
        HttpResponse.json({ success: true, data: { id: "p1" } }),
      ),
    );
    const { result } = renderHook(() => useAcceptSuggestedIcp("u1", "org1"), { wrapper });
    result.current.mutate("icp1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
  });
});
```

- [ ] **Step 4: Verify + prettier.**

```
npm run verify
npx prettier --check src/features/customers/hooks/useSaveCustomerProfile.ts src/features/customers/hooks/useAcceptSuggestedIcp.ts src/features/customers/hooks/__tests__/useAcceptSuggestedIcp.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/features/customers/hooks/useSaveCustomerProfile.ts frontend/src/features/customers/hooks/useAcceptSuggestedIcp.ts frontend/src/features/customers/hooks/__tests__/useAcceptSuggestedIcp.test.tsx
git commit -m "feat(fe): add save + accept mutation hooks"
```

## Task 15: Reject + delete-current mutation hooks

**Files:**
- Create: `frontend/src/features/customers/hooks/useRejectSuggestedIcp.ts`
- Create: `frontend/src/features/customers/hooks/__tests__/useRejectSuggestedIcp.test.tsx`

Context: the spec groups the **×2 DELETE** call sites under `useRejectSuggestedIcp` (Spec 26 §4). This file exports both: `useRejectSuggestedIcp` (DELETE `icp/recommended/{id}`, invalidates the suggested-ICP read) and `useDeleteCurrentIcp` (DELETE `customer_profile/icp/{id}`, invalidates the profile read). The 5-second undo timer + dismissed-marker optimism stays in the container.

- [ ] **Step 1: Write `useRejectSuggestedIcp.ts`.**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { rejectRecommendedIcp, deleteCurrentIcp } from "../services/customers";

import { qk } from "@/shared/api/queryKeys";

/** DELETE a recommended ICP (the network half of the optimistic reject flow). */
export function useRejectSuggestedIcp(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (icpId: string) => rejectRecommendedIcp(userId, icpId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.customersSuggestedIcps(userId) });
    },
  });
}

/** DELETE an accepted/current ICP; invalidate the current-ICP read. */
export function useDeleteCurrentIcp(userId: string, orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (icpId: string) => deleteCurrentIcp(orgId, icpId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.customersProfile(userId, orgId) });
    },
  });
}
```

- [ ] **Step 2: Write the test** (`__tests__/useRejectSuggestedIcp.test.tsx`):

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useRejectSuggestedIcp, useDeleteCurrentIcp } from "../useRejectSuggestedIcp";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("reject + delete mutations", () => {
  it("rejects a recommended ICP", async () => {
    server.use(http.delete("/api/icp/recommended/:id", () => HttpResponse.json({ success: true })));
    const { result } = renderHook(() => useRejectSuggestedIcp("u1"), { wrapper });
    result.current.mutate("icp1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
  });

  it("deletes a current ICP", async () => {
    server.use(
      http.delete("/api/customer_profile/icp/:id", () => HttpResponse.json({ success: true })),
    );
    const { result } = renderHook(() => useDeleteCurrentIcp("u1", "org1"), { wrapper });
    result.current.mutate("icp1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
  });
});
```

- [ ] **Step 3: Verify + prettier.**

```
npm run verify
npx prettier --check src/features/customers/hooks/useRejectSuggestedIcp.ts src/features/customers/hooks/__tests__/useRejectSuggestedIcp.test.tsx
```
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/features/customers/hooks/useRejectSuggestedIcp.ts frontend/src/features/customers/hooks/__tests__/useRejectSuggestedIcp.test.tsx
git commit -m "feat(fe): add reject + delete-current mutation hooks"
```

## Task 16: Wire mutations into the container (+ behavioral test)

**Files:**
- Modify: `frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx`
- Create: `frontend/src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCards.write.test.tsx`

Context: swap the container's inline write `fetch`/`apiFetch`/`apiFetchJson` calls for the mutation hooks, **keeping every piece of optimism**: in `handleConfirmAccept` use `useAcceptSuggestedIcp` + `useSaveCustomerProfile` (the `saveProfilerAcceptedIcpDisplayMeta`, `copyProfilerDisplayMetaToProfileId`, `resolveAcceptedPersistedIcpId`, and the `setCardStatuses(... accepted)` optimism stay); in `finalizeRecommendedReject` use `useRejectSuggestedIcp` (the 5-second `setTimeout`, `upsertPendingRecommendedReject`, `recordDismissedRecommendedIcp`, `removeFromProfilerRecommendedCached`, and the `isRecommendedDeleteNotFound` 404-as-success path stay); in `handleDeleteCurrentIcp` use `useDeleteCurrentIcp` (the optimistic `setExistingICPs(filter)` + `removeProfilerAcceptedIcpDisplayMeta` stay). The `customerProfileSaved` window event and all toasts are preserved.

- [ ] **Step 1: Mount the mutation hooks** at the top of `SuggestedICPCards` and replace the three write call sites with `mutateAsync` (so the existing `await` control flow and `try/catch` toasts are preserved unchanged). Do not remove any optimistic state/`localStorage`/timer logic. Remove now-unused `apiFetch`/`apiFetchJson`/`buildApiUrl` imports from the monolith iff no longer referenced (the verify-after-save GET in `handleConfirmAccept` may still use `buildApiUrl` + raw `fetch` — leave whatever the firmographics-verify path needs, or fold it through `saveAcceptedIcpFirmographics`).

- [ ] **Step 2: Add the behavioral test** (`__tests__/SuggestedICPCards.write.test.tsx`) — Spec 26 §8 "behavioral coverage to add": accept → invalidation → card-status transition; reject → `localStorage` marker. Mock `useAuth`; drive via MSW. If the full optimistic edge-case matrix proves out-of-budget, cover accept + reject happy paths here and log the gap (mirrors TD-FE-20).

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SuggestedICPCards } from "../SuggestedICPCards";

import { BACKEND_BASE_URL } from "@/lib/api";
import { server } from "@/test/msw/server";
import { PROFILER_DISMISSED_RECOMMENDED_IDS_KEY } from "../suggestedIcpStorage";

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

afterEach(() => localStorage.clear());

function renderCards() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<SuggestedICPCards refreshTrigger={1} />, { wrapper });
}

describe("SuggestedICPCards writes", () => {
  it("accept transitions the card to accepted", async () => {
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})),
      http.get("/api/customer_profile", () => HttpResponse.json({ icps: [] })),
      http.get(`${BACKEND_BASE_URL}/icp`, () =>
        HttpResponse.json({ icps: [{ id: "rec-1", title: "FinTech ICP", industry: "Financial Services" }] }),
      ),
      http.post("/api/customer_profile/from_suggested_icp", () =>
        HttpResponse.json({ success: true, data: { id: "rec-1" } }),
      ),
    );
    renderCards();
    await screen.findByText(/FinTech ICP/i, undefined, { timeout: 5000 });
    // One recommended card in this fixture (customer_profile icps:[] → no current-ICP rows),
    // so there is exactly one Accept button — no ancestor scoping needed. Align labels to markup.
    await userEvent.click(screen.getByRole("button", { name: /accept/i }));
    await userEvent.click(await screen.findByRole("button", { name: /save to customer profile/i }));
    await waitFor(() =>
      expect(screen.getByText(/Customer Profile updated/i)).toBeInTheDocument(),
    );
  });

  it("reject persists a dismissed marker after the 5s undo window", async () => {
    vi.useFakeTimers();
    // userEvent must be told to drive the fake clock, else click() hangs.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})),
      http.get("/api/customer_profile", () => HttpResponse.json({ icps: [] })),
      http.get(`${BACKEND_BASE_URL}/icp`, () =>
        HttpResponse.json({ icps: [{ id: "rec-1", title: "FinTech ICP" }] }),
      ),
      http.delete("/api/icp/recommended/:id", () => HttpResponse.json({ success: true })),
    );
    renderCards();
    // Pump pending microtasks/0-delay timers so the MSW-backed load resolves under fake timers,
    // then findByText resolves on its first check (no polling needed).
    await vi.advanceTimersByTimeAsync(0);
    await screen.findByText(/FinTech ICP/i, undefined, { timeout: 5000 });
    // Single recommended card → exactly one Reject button.
    await user.click(screen.getByRole("button", { name: /reject/i }));
    // Advance past the 5s undo window so finalizeRecommendedReject() flushes to localStorage.
    await vi.advanceTimersByTimeAsync(5000);
    await waitFor(() =>
      expect(localStorage.getItem(PROFILER_DISMISSED_RECOMMENDED_IDS_KEY) ?? "").toContain("rec-1"),
    );
    vi.useRealTimers();
  });
});
```
(Treat the test selectors as a scaffold — align button names / DOM queries with the actual rendered markup. The assertions that matter: accept shows the "Customer Profile updated" toast and the card leaves the suggested list; reject persists the dismissed id.)

- [ ] **Step 3: Verify + prettier.**

```
npm run verify
npx prettier --check "src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx" "src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCards.write.test.tsx"
```
Expected: PASS.

- [ ] **Step 4: Stage gate — journey + VR.**

```
pkill -f "vite preview" || true
npm run test:e2e -- e2e/journeys/06-customers-page-load.spec.ts
```
Expected: PASS, VR within 2%.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/features/customers/components/icp-intelligence/SuggestedICPCards.tsx frontend/src/features/customers/components/icp-intelligence/__tests__/SuggestedICPCards.write.test.tsx
git commit -m "refactor(fe): route customers writes through mutation hooks (optimism preserved)"
```

## Task 17: `LeadStream` + `ProfilerChatWithHistory` tests

**Files:**
- Create: `frontend/src/features/customers/components/lead-stream/__tests__/LeadStream.test.tsx`
- Create: `frontend/src/features/customers/components/chat/__tests__/ProfilerChatWithHistory.test.tsx`

Context: Spec 26 §8 — `LeadStream` (mock) gets a render + `getLeadCountForICP` unit test; the relocated chat gets a smoke render (no fetch; substrate mocked).

- [ ] **Step 1: Write the LeadStream test.**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadStreamPanel, getLeadCountForICP } from "../LeadStream";

describe("LeadStream", () => {
  it("renders the panel", () => {
    const { container } = render(<LeadStreamPanel filterByICP={null} onClearFilter={() => {}} />);
    expect(container).toBeTruthy();
  });

  it("getLeadCountForICP returns a number", () => {
    expect(typeof getLeadCountForICP("ICP 1")).toBe("number");
  });
});
```

- [ ] **Step 2: Write the ProfilerChat smoke test** — mock the legacy substrate so the test stays a pure relocation smoke (no Signals network):

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/signals/SignalsContextChat", () => ({
  SignalsContextChat: () => <div data-testid="signals-context-chat" />,
}));
vi.mock("@/shared/auth", () => ({ useAuth: () => ({ currentUser: { uid: "u1" } }) }));

import { ProfilerChatWithHistory } from "../ProfilerChatWithHistory";

describe("ProfilerChatWithHistory (relocated)", () => {
  it("renders without crashing", () => {
    const { getByTestId } = render(
      <ProfilerChatWithHistory initialContext={null} onClearContext={() => {}} onTabChange={() => {}} />,
    );
    expect(getByTestId("signals-context-chat")).toBeInTheDocument();
  });
});
```
(Match the prop names to `ProfilerChatWithHistory`'s actual signature.)

- [ ] **Step 3: Verify + prettier.**

```
npm run verify
npx prettier --check "src/features/customers/components/lead-stream/__tests__/LeadStream.test.tsx" "src/features/customers/components/chat/__tests__/ProfilerChatWithHistory.test.tsx"
```
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/features/customers/components/lead-stream/__tests__ frontend/src/features/customers/components/chat/__tests__
git commit -m "test(fe): add LeadStream + relocated ProfilerChat coverage"
```

---

# Stage 5 — Finalize

Spec 26 §7.5. All cross-artifact work happens **before** the gate; the serial preflight is the strictly-final action. If an amendment surfaces a contradiction with a Phase-7 decision, resolve it before the gate — never fix forward through it.

## Task 18: Lock the public surface (`index.ts`)

**Files:** Modify `frontend/src/features/customers/index.ts`

Context: nothing cross-feature consumes customers today, so the surface stays `customersRoutes` only (Spec 26 §3 — "Add exports lazily if Phase 9 needs them"). This is the form already set in T2; the task confirms it and that `knip --strict` is clean once everything is consumed.

- [ ] **Step 1: Confirm `index.ts` reads exactly:**

```ts
// Public surface for the `customers` feature.
// Cross-feature consumers import from "@/features/customers", never a deep path.
export { customersRoutes } from "./routes";
```

- [ ] **Step 2: Verify, then run knip** (first knip of the phase — confirms the stage-2 hook-first window is fully closed and no dead exports remain):

```
npm run verify
npm run knip
```
Expected: both PASS. If knip flags an unconsumed hook/service export, it means a stage-3/4 wiring step was missed — fix the consumption (do not delete the export), re-run.

- [ ] **Step 3: Commit** (only if `index.ts` changed from T2; otherwise skip).

```bash
git add frontend/src/features/customers/index.ts
git commit -m "feat(fe): lock customers public surface (customersRoutes)"
```

## Task 19: Write the feature `README.md`

**Files:** Modify `frontend/src/features/customers/README.md`

Context: mirror the mission-control README shape (Purpose / Public surface / Key files / Dependency notes / Pending handoffs / Profiler disposition input).

- [ ] **Step 1: Replace the placeholder** with the full README:

```markdown
# `customers` feature

## Purpose

The `/customers` surface — the **Profiler agent** UI (page title `👤 Profiler - Brewra`):
three tabs (ICP Intelligence / Lead Stream / Chat with Profiler). Extracted from
`src/pages/Customers.tsx` + `src/components/customers/*` and the relocated
`ProfilerChatWithHistory` in Phase 7 (master Spec 14 §4; Spec 26 / plan 26). Spec 14's
Phase 7 source list (`ICPSummaryOpportunity`, `SuggestedICPsGallery`) was stale — both were
dead-deleted in Phase 1; Spec 26 is the authority for what moved.

## Public surface

Locked in T18 (`index.ts`). Cross-feature consumers import only via `@/features/customers`,
never a deep path. Today the surface is routes-only; exports are added lazily if Phase 9 needs them.

| Export            | Kind   | Source       | Description                                                                  |
| ----------------- | ------ | ------------ | ---------------------------------------------------------------------------- |
| `customersRoutes` | routes | `routes.tsx` | The `/customers` route array (mounted by `src/app/routes.tsx`), `<FeatureErrorBoundary>`-wrapped. |

## Key files

- `pages/CustomersPage.tsx` — route shell; three tabs; the `window`-event header bridge; inner legacy `<ErrorBoundary>` around tabs (relocated T2).
- `components/icp-intelligence/SuggestedICPCards.tsx` — Profiler ICP container; reads via the service/hook layer (T11), writes via mutation hooks (T16); decomposed T12.
- `components/icp-intelligence/{SuggestedICPCard,CurrentIcpsTable}.tsx` — extracted render units (T12).
- `components/icp-intelligence/icpMapping.ts` — pure flexible-`/icp` mappers/normalizers (T9).
- `components/icp-intelligence/suggestedIcpStorage.ts` — pure optimistic-`localStorage` helpers (T10).
- `components/icp-intelligence/ICPIntelligence.tsx` — thin wrapper; `profilerRefresh` header-event handler.
- `components/lead-stream/LeadStream.tsx` — pure mock panel; exports `LeadStreamPanel` + `getLeadCountForICP`.
- `components/chat/ProfilerChatWithHistory.tsx` — relocated Profiler chat shell; imports the `SignalsContextChat` substrate via the legacy alias (TD-FE-45).
- `contracts.ts` — permissive zod for `/icp` + `customer_profile` (T4).
- `types.ts` — feature-local types (`ExistingICP`, `SuggestedICP`, `ICPCardStatus`, `ICPAnalysis`, …) (T8).
- `hooks/*` — TanStack read (`useCustomerProfile`, `useSuggestedIcps`) + write (`useSaveCustomerProfile`, `useAcceptSuggestedIcp`, `useRejectSuggestedIcp` / `useDeleteCurrentIcp`) hooks.
- `services/customers.ts` — read/write API call layer.
- `routes.tsx` / `index.ts` — route registry + public surface.

## Dependency notes

- May import from: `@/features/customers/*` (self, relative), `@/shared/*`, `@/components/ui/*`, npm.
- May import another feature **only** via its `index.ts` (`@/features/<other>`), never a deep path.
- Transitional (Phases 4b–12) legacy imports retained: `@/lib/api`, `@/lib/types/escape-hatches`, `@/hooks/usePageTitle`, `@/hooks/use-toast`, `@/utils/cacheUtils`, `@/components/common/ErrorBoundary`, `@/components/signals/SignalsContextChat` (chat substrate), and `@/components/market-research/EditDropdownMenu` (legacy dir not yet migrated).
- Keeps its **own** `/icp` + `customer_profile` read — does not adopt mission-control's `useICPs` (TD-FE-42).

## Pending handoffs

| Component(s)                          | Target / resolution                                            | Phase |
| ------------------------------------- | -------------------------------------------------------------- | ----- |
| `SignalsContextChat` substrate         | Stays legacy `src/components/signals/`; imported transitionally. | 8 relocates; 9 finalizes shared chat |
| `ProfilerChatWithHistory` ↔ `ScoutChatWithHistory` dedup | Relocated unchanged; differ by 244 lines.            | 9 dedups |
| Customers vs mission-control ICP read  | Both read `/api/icp` + `customer_profile` independently (TD-FE-42). | 9 may consolidate |

## Deferred (TD-FE-41…45)

Optimism stays in `localStorage` (41); read overlaps `useICPs` (42); `profiler_recommendedICPs`/session-cache read orchestration not cache-native (43); window-event bridge untyped (44); chat substrate via legacy path (45).
```

- [ ] **Step 2: Verify + prettier.**

```
npm run verify
npx prettier --check src/features/customers/README.md
```
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add frontend/src/features/customers/README.md
git commit -m "docs(fe): write customers feature README"
```

## Task 20: Amend the Profiler-disposition coordination artifact

**Files:**
- Modify: `frontend/src/features/mission-control/README.md` (the "Profiler disposition" table)
- Modify: `specs/25-frontend-phase-6-mission-control-design.md` (§6, per the frozen-record convention — apply the Phase-7 resolution row at merge). Paths are repo-root-relative; the git root is `…/brewra-gtm-intelligence`, where `specs/` and `frontend/` are siblings — do **not** prefix with `brewra-gtm-intelligence/`.

Context: Spec 26 §6 — record the customers-side resolutions so Phase 9 inherits them. Add a "Phase-7 resolution" column/rows reflecting: shared profiler cluster unchanged; customers keeps its own read; ProfilerChat relocated; substrate stays legacy; profiler-merge unchanged; escape-hatch unchanged.

- [ ] **Step 1: In `mission-control/README.md`**, append a note under "Profiler disposition" that Phase 7 resolved the customers side: `ProfilerChatWithHistory` is now in `features/customers/components/chat/`; customers reads via its own `useCustomerProfile`/`useSuggestedIcps` (not `useICPs`); the `@/shared/profiler` cluster stays shared; `SignalsContextChat` stays legacy pending Phase 8.

- [ ] **Step 2: In `specs/25-...-design.md` §6**, add the Phase-7 resolution rows (frozen-record amendment). Stage only that file.

- [ ] **Step 3: Verify** (docs only — no code change, but run to be safe):

```
npm run verify
```
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/features/mission-control/README.md specs/25-frontend-phase-6-mission-control-design.md
git commit -m "docs: amend Profiler disposition with Phase 7 customers resolutions"
```

## Task 21: Allocate deferred TD-FE entries

**Files:** Modify `docs/TECH_DEBT.md` (**append surgically — never prettier this file**; it sits outside the FE prettier gate and prettier corrupts its unfenced markdown)

Context: Spec 26 §10 provisional numbers assume the register is unchanged from Phase 6's close at TD-FE-40. Reconcile against the live register first, renumber if anything advanced the counter.

- [ ] **Step 1: Find the current highest TD-FE number.**

```
grep -oE 'TD-FE-[0-9]+' docs/TECH_DEBT.md | sort -t- -k3 -n | tail -1
```
Expected: `TD-FE-40` (provisional 41–45 hold). If higher, shift the five entries below to start at `max+1`.

- [ ] **Step 2: Append the five entries** (one block each, separated by `---`), in the established format (Date logged / Origin / Current state / What it should be / Why we deferred / What we lose by staying as-is / Pull-forward trigger / Owner):

  - **TD-FE-41** — `SuggestedICPCards` accept/reject/dismiss optimism stays in `localStorage`, not modeled in the TanStack cache. *Origin:* Phase 7 (Task 16). *Trigger:* the cache-native optimism pass / Phase 13.
  - **TD-FE-42** — Customers `/icp` + `customer_profile` read overlaps mission-control `useICPs`; two independent read paths with nothing to catch a divergent `/api/icp` shape change. *Origin:* Phase 7 (Tasks 5–7). *Trigger:* Phase 9 consolidation / Phase 13.
  - **TD-FE-43** — The customers read orchestration (the `profiler_recommendedICPs` `localStorage` fetch-cache **and** the `missionProfilerSessionCache` session-cache + multi-tier fallbacks) is retained around the service/hook layer in the imperative loader rather than made cache-native. *Origin:* Phase 7 (Task 11). *Trigger:* the cache-native read pass / Phase 9.
  - **TD-FE-44** — Window-event header→page bridge (`profilerRefresh`/`profilerCreateICP`/`profilerExportData`/`navigateToLeadStream`/`icpAccepted`) is untyped global coupling. *Origin:* Phase 7 (Tasks 2, preserved for parity). *Trigger:* a typed event-bus / header-action redesign.
  - **TD-FE-45** — `ProfilerChatWithHistory` imports the `SignalsContextChat` substrate via the legacy path; Phase 8 relocates the substrate, Phase 9 dedups ProfilerChat↔ScoutChat. *Origin:* Phase 7 (Task 2). *Trigger:* Phase 8 / Phase 9.

  (If the stage-4 behavioral coverage of the optimistic edge cases was trimmed for budget per §8, add a sixth entry mirroring TD-FE-20 for the uncovered cases.)

- [ ] **Step 3: Confirm no accidental reformat.**

```
git diff --stat docs/TECH_DEBT.md
```
Expected: only added lines at the tail.

- [ ] **Step 4: Commit.**

```bash
git add docs/TECH_DEBT.md
git commit -m "docs: allocate Phase 7 deferred TD-FE entries"
```

## Task 22: Final merge gate — serial preflight

**Files:** none (gate only)

Context: the strictly-final action. Everything above must already be committed and green at the per-task level.

- [ ] **Step 1: Kill any orphan preview server** (avoids a false-green VR against a stale build):

```
pkill -f "vite preview" || true
```

- [ ] **Step 2: Run the full serial preflight** from `frontend/`:

```
npm run preflight
```
Expected: PASS — `typecheck && lint && format:check && test && build && bundle:check && test:e2e && knip`. The e2e leg includes journey `06` + its VR snapshot. If a leg fails, report which one; do not merge.

- [ ] **Step 3: Manual smoke sign-off** (Spec 26 §8). Confirm `/customers` renders all three tabs (ICP Intelligence, Lead Stream, Chat with Profiler) and the accept/reject/dismiss + refresh flows behave as before. Record the sign-off.

- [ ] **Step 4: Merge** (controller, human-approved):

```bash
git checkout master
git merge --no-ff phase-7-customers
git push origin master
```

- [ ] **Step 5: Update the master status row.** In `specs/14-…design.md` §4, mark Phase 7 → done and log the §1.2 master-plan delta (the stale `ICPSummaryOpportunity`/`SuggestedICPsGallery` source list — Spec 14 §5.5). Apply per the frozen-record convention. Commit (`docs: mark Spec 14 Phase 7 done`), stage only that file.

---

## Done when (Spec 26 §11)

- `src/features/customers/` populated per §3; `src/pages/Customers.tsx` and `src/components/customers/*` gone; `ProfilerChatWithHistory` moved out of `src/components/signals/`.
- `/customers` resolves via the route registry; no legacy `App.tsx` customers import.
- Route wrapped in `<FeatureErrorBoundary>`; TanStack read+write hooks + zod contracts + MSW in place (optimism caveats per §4/§10).
- `SuggestedICPCards` decomposed (`types.ts` / `icpMapping.ts` / `suggestedIcpStorage.ts` / card subcomponents); per-component Vitest green; `README.md` written; `index.ts` locked.
- Spec 25 §6 + mission-control README disposition amended; TD-FE-41+ allocated.
- Full serial `npm run preflight` green immediately before merge (journey `06` + VR included).

---

## Self-review against the spec (verification)

- **§1.3 starting state (5 files, 3,717 LOC):** all five relocated in T2; `ProfilerChatWithHistory` moved out of `signals/`. ✓
- **§2.1 in scope:** moves (T2), route registry + FeatureErrorBoundary (T2), TanStack + zod + MSW (T3–T7, T13–T15), decomposition (T8–T12), per-component Vitest (throughout), README + locked `index.ts` (T18–T19), Spec 25 §6 amendment (T20). ✓
- **§2.2 out of scope:** no ProfilerChat↔ScoutChat dedup, no substrate promotion, no `useICPs` adoption, no event-bridge redesign, no escape-hatch retype — each preserved + logged TD-FE-41…45 (T21). ✓
- **§2.3 frozen interfaces:** `/customers` URL, `/api/icp` + `customer_profile` shapes, storage/event keys, VR baseline — preserved; parity-audit checklist (T11) + manual smoke (T22). ✓
- **§3 target structure + purity frame:** pure `icpMapping.ts` (T9) / `suggestedIcpStorage.ts` (T10); card seams enumerated (T12). ✓
- **§3.1 dependency posture:** relative same-feature imports (T2/T3); legacy `SignalsContextChat` + `EditDropdownMenu` retained; `index.ts` = `customersRoutes` only. ✓
- **§4 data layer:** every fetch row mapped to a hook; permissive zod `.parse` at the boundary; `buildIcpUrl` direct-host parity preserved; `retry:false`; optimism kept (TD-FE-41/43). ✓
- **§5 chat handling:** ProfilerChat relocated, substrate transitional, inner `<ErrorBoundary>` kept, window-events preserved. ✓
- **§6 disposition amendment:** T20. **§7 five stages:** mapped 1:1 to Stages 1–5. **§8 testing/parity:** journey 06 every stage + per-component Vitest + behavioral accept/reject (T16). **§9 risks:** R1 staged-one-extraction + VR (T8–T12), R2 transitional import (T2), R3 own-read/TD-FE-42, R4 TD-FE-44, R5 permissive zod (T4). **§10 TD-FE:** T21. **§11 done-when:** above. ✓

---

## Execution handoff

Plan complete and saved to `plans/26-frontend-phase-7-customers.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
2. **Inline Execution** — execute tasks in this session with checkpoints. REQUIRED SUB-SKILL: `superpowers:executing-plans`.

Per the repo's spec-driven flow, this plan should next go through `/review-plan` → `/synthesize-plan-review` (loop until nit-or-below) before implementation.
