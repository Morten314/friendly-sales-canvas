# Apollo ICP-Driven Lead Discovery — Frontend Implementation Plan (35b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the frontend for Apollo ICP-driven lead discovery — connection modal, warmup gate + unlock toast, the discovery flow (guard / keep-replace-download / run + status polling / tile states), and the agent-view source filter + unverified badge — against the live backend contracts shipped in 35a (now on `origin/master`, deployed).

**Architecture:** A new self-contained `features/connectors/` feature owns the Apollo data layer (zod contracts + `apiGet`/`apiPost` services + TanStack Query hooks) and all Apollo UI (tile, connect modal, warmup progress, discovery dialogs, unlock-toast hook). `features/mission-control` mounts the tile in its Data Sources tab via the feature barrel; the app shell mounts the unlock-toast hook. The Scout (`features/market-research`) and Profiler lead tables get a small additive source filter + badge that read each lead row's `source` / `email_status`. No backend changes — 35a is the contract surface.

**Tech Stack:** React 18 + TypeScript + Vite, TanStack Query (server state, 30 req/min limiter), zod (hand-authored contracts), shadcn-ui/Radix primitives (`@/components/ui/*`), react-router, Vitest + Testing Library + MSW (unit/integration), Playwright (e2e/VR). Gate: `npm run preflight`.

---

## Backend contract reference (35a — verify live via `/docs` before coding each)

All under `/connectors/apollo/` (the FE proxies via `/api/...` in dev — see Gotchas). Shapes are the merged Pydantic models in `backend/app/models/connectors.py`.

| Method | Path | Request | Response (fields) |
|---|---|---|---|
| POST | `/connect` | `{org_id, user_id, api_key}` | `{connected: bool, status: str}` — **errors:** `409 {detail, code:"profile_incomplete", missing_section}`, `403 {detail, code:"master_key_required"}`, `400` invalid key |
| GET | `/status?org_id` | — | `{connected, status, connected_at?, credits_consumed_total, last_run_credits, low_credit, last_discovery_at?, last_discovery_icp_fingerprint?, icp_changed_since_last_discovery}` |
| GET | `/warmup?org_id&user_id` | — | `{icp_configured, signals_generated, scout_completed, profiler_analyzed, ready_count, unlocked, missing:[{step,label,deep_link_hint}]}` |
| POST | `/discover` | `{org_id, user_id, icp_id?, mode:"keep"\|"replace", max_leads?}` | `{run_id, status}` — **errors:** `409 {code:"discovery_in_progress"}`, `422 {code:"icp_underspecified"}` |
| GET | `/discover/status?org_id&run_id?` | — | `{run_id, org_id, status, mode, counts:{searched,qualified,selected,revealed,verified,unverified,created,matched,skipped_duplicates,errors:[{stage,message}]}, credits_consumed, progress_percent, icp_fingerprint?, started_at?, finished_at?, message?}` |
| GET | `/leads/export?org_id&format=json\|csv` | — | **raw `Response`** — `application/json` or `text/csv` (NOT a JSON envelope; param name is `format`) |

`status` values: `queued` \| `processing` \| `completed` \| `completed_empty` \| `failed` \| `partial`.

---

## Key decisions & divergences (from spec §6, §9 — treat as locked)

1. **Single control point:** all Apollo controls live in Mission Control → Data Sources. No Apollo controls on agent pages (Scout/Profiler/Signals only get the read-side source filter + badge).
2. **Unverified badge (divergence):** rows with `email_status == "unverified"` show a small "Unverified" badge. This is the one row-level visual distinction (the 2026-06-04 design said "no row difference"; product-approved change).
3. **UC10 low-credit is reactive:** show a persistent warning whenever `status.low_credit == true`. No "remaining credits" number (Apollo exposes none); optionally show `credits_consumed_total` / `last_run_credits` as informational.
4. **Master-key requirement** is surfaced in the connect modal copy ("requires a master API key" + "where do I find it?").
5. **Tile states:** Locked / Unlocked / Running / Complete / Error, with **Complete sub-states** `partial` (interrupted — show landed leads + non-blocking banner, button restored) and `completed_empty` (zero results — widen-ICP deep link). Partial and zero-results are NOT distinct tile states.
6. **`completed_empty`** means `created == 0 AND matched == 0`; an enrich-only run (`matched > 0`) is `completed`.

---

## Constraints & Gotchas (read before starting — these shape several tasks)

- **G1 — `/connect` error parsing.** `apiFetch`/`apiPost` throw a generic `Error("HTTP error! status: 409 - <text>")` and do **not** parse the JSON body. The connect modal must branch on `code` (`profile_incomplete` → deep-link to `missing_section`; `master_key_required`; invalid key). So the connect service does a **raw `apiFetch`** and, on non-ok, parses the response JSON into a typed `ApolloConnectError { status, code, detail, missing_section? }` and throws that. Do NOT route connect through `apiPost`+zod (it would swallow the `code`).
- **G2 — `/leads/export` is not JSON.** It returns a raw `Response` (csv or json bytes). Don't use `apiGet`+zod. Implement `apolloLeadsExportUrl(orgId, format)` using the same dev/prod base rule as `transport.ts` (`/api/...` in dev, `BACKEND_BASE_URL` in prod) and trigger a browser download via a temporary anchor. (The backend doesn't validate JWT, so a plain authenticated-by-nothing URL download works; if that changes, switch to fetch-blob.)
- **G3 — Polling predicates.** `useApolloWarmup` polls (`refetchInterval`) only while Apollo is **connected AND `unlocked == false`**; stops once `unlocked`. `useDiscoverStatus` polls only while the run status is **non-terminal** (`queued`/`processing`); stops on `completed`/`completed_empty`/`failed`/`partial`. Use a `refetchInterval` function returning `false` when the predicate is false.
- **G4 — Unlock toast dedupe.** The Locked→Unlocked toast must fire **once per org**, from the app shell (so it fires wherever the user is), and survive remount/reload. Persist an `apollo_unlock_notified:<orgId>` flag in `localStorage` (consistent with the localStorage state pattern, TD-FE-19 family). The app-shell poll runs only while `connected && !unlocked`.
- **G5 — `[N]` discovery-lead count seam.** The UC5 keep/replace prompt copy says "You have **[N]** Apollo-sourced leads." `/status` has **no** count field. For 35b (FE-only, no backend change), gate the prompt on `status.last_discovery_at != null` (a prior discovery implies leads exist) and render the prompt **without a hard N** (or "your previously discovered leads"). Wiring an exact N requires a lead-count source (the lead-stream data layer) — **documented seam, do not add a backend field here.**
- **G6 — Source filter / badge ride on lead rows.** The Scout/Profiler lead tables are currently mock-backed (`shared/lib/leadData.ts`, hardcoded `source`; TD-FE-63). Build the filter + badge to read `lead.source` (`"apollo"` | `"csv"` | other) and `lead.email_status`; they become fully meaningful once the lead tables are wired to live backend leads. **Documented data-dependency** — the UI affordance is in scope; live-lead wiring is not (tracked separately).
- **G7 — MSW + the `/api` proxy.** In tests, all these endpoints are mocked at `/api/connectors/apollo/*` (dev base is `/api`). No `/icp`-style proxy bypass applies here. Register default handlers in `src/test/msw/handlers.ts`; override per-test with `server.use(...)`.
- **G8 — Contracts stay permissive but typed.** Follow the repo zod convention: model the fields the FE reads with explicit types, `.passthrough()` so extra backend fields don't reject. Coerce nothing the backend already types.
- **G9 — Cross-feature imports via barrels only** (`import-x/no-internal-modules`). Mission-control and the app shell import from `@/features/connectors` (its `index.ts`), never deep paths. Inside the feature use relative imports.
- **G10 — `useAuth` for identity (verified).** `useAuth()` (`@/shared/auth`, `AuthContext`) returns `{ currentUser: User | null, orgId: string | null, ... }`. Use `orgId` and `currentUser?.uid` (the user id) — the established Phase-5+ convention; don't drill props from the page.

---

## Abort & recovery protocol

- **Stop-and-report (abort):** if a task's backend-contract assumption is invalidated by a live `/docs` (or `curl`) check against the deployed 35a backend — an endpoint path, field name, status value, or error `code` differs from the Backend contract table — **stop and report to the operator** before continuing. Don't paper over a contract mismatch.
- **Per-commit recovery:** the TDD steps say "expect FAIL / expect PASS." Before each commit, run the whole feature suite (`npx vitest run src/features/connectors`, plus the touched lead-table tests in Tasks 13–14), not just the task's own test. **If a previously-green test breaks, fix it before committing** — never commit a red feature suite, and never leave the feature non-building (see the empty-barrel rule below).
- **Blocked task:** if an implementer reports BLOCKED (e.g., `DataSourcesManager` proves incompatible with mounting the tile in Task 11), report the specific blocker to the operator rather than forcing a workaround.

---

## File Structure

**New feature — `frontend/src/features/connectors/`:**

```
features/connectors/
├── index.ts                      # barrel — STARTS EMPTY; each task appends its export (T10 tile, T12 toast, T13 leadSource, T14 badge)
├── README.md                     # purpose, public surface, deps
├── types.ts                      # local TS types (TileState union, ApolloConnectErrorShape, prompt-choice)
├── contracts.ts                  # zod: warmup/status/discover/discover-status
├── services/
│   ├── apollo.ts                 # connect (raw+error-parse), status, warmup, discover, discoverStatus, exportUrl
│   └── __tests__/apollo.test.ts
├── lib/
│   ├── tileState.ts              # deriveApolloTileState(...) pure fn
│   ├── discoveryPrompt.ts        # selectDiscoveryPrompt(...) pure fn (UC7 guard vs UC5 prompt)
│   └── __tests__/{tileState,discoveryPrompt}.test.ts
├── hooks/
│   ├── useApolloStatus.ts
│   ├── useApolloWarmup.ts        # poll-while-connected-and-locked
│   ├── useDiscover.ts            # mutation
│   ├── useDiscoverStatus.ts      # poll-while-non-terminal
│   ├── useExportApolloLeads.ts   # triggers download
│   ├── useApolloUnlockToast.ts   # app-shell edge detector + dedupe
│   └── __tests__/*.test.tsx
├── components/
│   ├── ApolloTile.tsx
│   ├── ApolloConnectModal.tsx
│   ├── WarmupProgress.tsx
│   ├── DiscoveryDialogs.tsx      # ReDiscoveryGuard + KeepReplaceDownload prompts
│   ├── LowCreditWarning.tsx
│   └── __tests__/*.test.tsx
```

**Modified (shared / other features):**
- `frontend/src/shared/api/queryKeys.ts` — add `apolloStatus`, `apolloWarmup`, `apolloDiscoverStatus`.
- `frontend/src/app/App.tsx` (or the nearest app-shell component inside `TenantProvider`) — mount `useApolloUnlockToast()`.
- `frontend/src/features/mission-control/.../DataSourcesManager.tsx` (or the Data Sources tab area) — mount `<ApolloTile />` from `@/features/connectors`.
- `frontend/src/features/market-research/components/lead-stream/*` (Scout Lead Stream toolbar + `LeadsTable`) — source filter + unverified badge.
- The Profiler lead table (under `features/customers` or `features/mission-control` — locate at task time) — same source filter + badge.
- `frontend/src/test/msw/handlers.ts` — default handlers for the 6 endpoints.

---

## Task 1: Feature scaffold + query keys + zod contracts

**Files:**
- Create: `frontend/src/features/connectors/{index.ts,README.md,types.ts,contracts.ts}`
- Create: `frontend/src/features/connectors/__tests__/contracts.test.ts`
- Modify: `frontend/src/shared/api/queryKeys.ts`

- [ ] **Step 1: Write failing contract tests**

`frontend/src/features/connectors/__tests__/contracts.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import {
  ApolloStatusSchema,
  ApolloWarmupSchema,
  ApolloDiscoverResponseSchema,
  ApolloDiscoverStatusSchema,
} from "../contracts";

describe("apollo contracts", () => {
  it("parses warmup with missing[] and passes through extras", () => {
    const w = ApolloWarmupSchema.parse({
      icp_configured: true, signals_generated: false, scout_completed: true,
      profiler_analyzed: true, ready_count: 3, unlocked: false,
      missing: [{ step: "signals_generated", label: "Signals — first run", deep_link_hint: "signals" }],
      _extra: "ignored",
    });
    expect(w.unlocked).toBe(false);
    expect(w.missing[0].deep_link_hint).toBe("signals");
  });

  it("defaults warmup.missing to [] when absent", () => {
    const w = ApolloWarmupSchema.parse({
      icp_configured: false, signals_generated: false, scout_completed: false,
      profiler_analyzed: false, ready_count: 0, unlocked: false,
    });
    expect(w.missing).toEqual([]);
  });

  it("parses status with credit + icp-change fields", () => {
    const s = ApolloStatusSchema.parse({
      connected: true, status: "connected", credits_consumed_total: 48,
      last_run_credits: 48, low_credit: false, icp_changed_since_last_discovery: true,
      last_discovery_at: "2026-06-13T00:00:00Z",
    });
    expect(s.icp_changed_since_last_discovery).toBe(true);
    expect(s.last_discovery_at).toBe("2026-06-13T00:00:00Z");
  });

  it("parses discover response and discover-status with counts.errors objects", () => {
    expect(ApolloDiscoverResponseSchema.parse({ run_id: "r1", status: "queued" }).run_id).toBe("r1");
    const st = ApolloDiscoverStatusSchema.parse({
      run_id: "r1", org_id: "o1", status: "partial", mode: "keep",
      counts: { searched: 120, created: 8, matched: 2, errors: [{ stage: "reveal", message: "credit wall" }] },
      credits_consumed: 8, progress_percent: 80,
    });
    expect(st.counts.created).toBe(8);
    expect(st.counts.errors[0].stage).toBe("reveal");
    expect(st.counts.skipped_duplicates).toBe(0); // defaulted
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module not found)**

Run: `cd frontend && npx vitest run src/features/connectors/__tests__/contracts.test.ts`
Expected: FAIL — cannot resolve `../contracts`.

- [ ] **Step 3: Write `contracts.ts`**

`frontend/src/features/connectors/contracts.ts`:
```typescript
import { z } from "zod";

export const WarmupMissingSchema = z.object({
  step: z.string(),
  label: z.string(),
  deep_link_hint: z.string(),
});

export const ApolloWarmupSchema = z
  .object({
    icp_configured: z.boolean(),
    signals_generated: z.boolean(),
    scout_completed: z.boolean(),
    profiler_analyzed: z.boolean(),
    ready_count: z.number(),
    unlocked: z.boolean(),
    missing: z.array(WarmupMissingSchema).default([]),
  })
  .passthrough();
export type ApolloWarmup = z.infer<typeof ApolloWarmupSchema>;

export const ApolloStatusSchema = z
  .object({
    connected: z.boolean(),
    status: z.string(),
    connected_at: z.string().nullish(),
    credits_consumed_total: z.number().default(0),
    last_run_credits: z.number().default(0),
    low_credit: z.boolean().default(false),
    last_discovery_at: z.string().nullish(),
    last_discovery_icp_fingerprint: z.string().nullish(),
    icp_changed_since_last_discovery: z.boolean().default(false),
  })
  .passthrough();
export type ApolloStatus = z.infer<typeof ApolloStatusSchema>;

export const ApolloDiscoverResponseSchema = z
  .object({ run_id: z.string(), status: z.string() })
  .passthrough();
export type ApolloDiscoverResponse = z.infer<typeof ApolloDiscoverResponseSchema>;

export const DiscoveryCountsSchema = z
  .object({
    searched: z.number().default(0),
    qualified: z.number().default(0),
    selected: z.number().default(0),
    revealed: z.number().default(0),
    verified: z.number().default(0),
    unverified: z.number().default(0),
    created: z.number().default(0),
    matched: z.number().default(0),
    skipped_duplicates: z.number().default(0),
    errors: z.array(z.object({ stage: z.string(), message: z.string() }).passthrough()).default([]),
  })
  .passthrough();

export const ApolloDiscoverStatusSchema = z
  .object({
    run_id: z.string(),
    org_id: z.string(),
    status: z.string(),
    mode: z.string(),
    counts: DiscoveryCountsSchema.default({}),
    credits_consumed: z.number().default(0),
    progress_percent: z.number().default(0),
    icp_fingerprint: z.string().nullish(),
    started_at: z.string().nullish(),
    finished_at: z.string().nullish(),
    message: z.string().nullish(),
  })
  .passthrough();
export type ApolloDiscoverStatus = z.infer<typeof ApolloDiscoverStatusSchema>;
```

- [ ] **Step 4: Write `types.ts`, `index.ts`, `README.md`, and query keys**

`frontend/src/features/connectors/types.ts`:
```typescript
export type ApolloTileState =
  | "disconnected"
  | "locked"
  | "unlocked"
  | "running"
  | "complete"
  | "complete_empty"
  | "complete_partial"
  | "error";

export interface ApolloConnectErrorShape {
  httpStatus: number;
  code?: string; // "profile_incomplete" | "master_key_required" | ...
  detail?: string;
  missing_section?: string;
}

export type DiscoveryPromptKind = "none" | "rediscovery_guard" | "keep_replace_download";
export type DiscoverMode = "keep" | "replace";
```

`frontend/src/features/connectors/index.ts` — **starts EMPTY**; each task that creates a public module appends its own export, so every intermediate commit builds (see "Abort & recovery protocol"):
```typescript
// Public surface for the `connectors` feature (Apollo discovery).
// Cross-feature consumers import from "@/features/connectors", never a deep path.
// Exports are added by the task that creates each module:
//   ApolloTile            → Task 10
//   useApolloUnlockToast  → Task 12
//   LEAD_SOURCE_OPTIONS, filterLeadsBySource, LeadSourceFilter → Task 13
//   UnverifiedBadge       → Task 14
export {};
```

`frontend/src/features/connectors/README.md`:
```markdown
# connectors (Apollo discovery)

Owns the Apollo ICP-driven lead discovery frontend: data layer (zod contracts + TanStack Query
hooks against `/connectors/apollo/*`), the Mission Control Data Sources tile + connect modal,
warmup progress + app-wide unlock toast, the discovery flow (re-discovery guard, keep/replace/
download prompt, run + status polling, tile states), and the agent-view lead source filter + badge.

## Public surface (index.ts)
- `ApolloTile` — mounted by mission-control's Data Sources tab.
- `useApolloUnlockToast` — mounted once at the app shell; fires the Locked→Unlocked toast.
- `LEAD_SOURCE_OPTIONS` / `LeadSourceFilter` — for the Scout/Profiler source filter.

## Backend contract
See `plans/35b-apollo-discovery-frontend.md` (contract table). Backend is spec 35a (merged).
```

Add to `frontend/src/shared/api/queryKeys.ts` `qk` object:
```typescript
  apolloStatus: (orgId: string) => ["connectors", "apollo", "status", orgId] as const,
  apolloWarmup: (orgId: string, userId: string) =>
    ["connectors", "apollo", "warmup", orgId, userId] as const,
  apolloDiscoverStatus: (orgId: string, runId: string | null) =>
    ["connectors", "apollo", "discover-status", orgId, runId] as const,
```

- [ ] **Step 5: Run — expect PASS**

Run: `cd frontend && npx vitest run src/features/connectors/__tests__/contracts.test.ts`
Expected: PASS (4 tests).

> The barrel is empty here (`export {}` keeps it a valid module). Each later task adds its own export line and includes `index.ts` in that task's commit — so no intermediate commit references a not-yet-created module.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/connectors frontend/src/shared/api/queryKeys.ts
git commit -m "feat(fe): scaffold connectors feature + apollo zod contracts + query keys"
```

---

## Task 2: Apollo services (status, warmup, discover, discover-status)

**Files:**
- Create: `frontend/src/features/connectors/services/apollo.ts`
- Create: `frontend/src/features/connectors/services/__tests__/apollo.test.ts`

- [ ] **Step 1: Write failing service tests**

`frontend/src/features/connectors/services/__tests__/apollo.test.ts`:
```typescript
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import {
  fetchApolloStatus,
  fetchApolloWarmup,
  startApolloDiscover,
  fetchApolloDiscoverStatus,
} from "../apollo";

describe("apollo read/discover services", () => {
  it("fetchApolloStatus parses the status envelope", async () => {
    server.use(
      http.get("/api/connectors/apollo/status", () =>
        HttpResponse.json({ connected: true, status: "connected", credits_consumed_total: 12,
          last_run_credits: 12, low_credit: false, icp_changed_since_last_discovery: false }),
      ),
    );
    const s = await fetchApolloStatus("o1");
    expect(s.connected).toBe(true);
    expect(s.credits_consumed_total).toBe(12);
  });

  it("fetchApolloWarmup parses readiness", async () => {
    server.use(
      http.get("/api/connectors/apollo/warmup", () =>
        HttpResponse.json({ icp_configured: true, signals_generated: true, scout_completed: true,
          profiler_analyzed: true, ready_count: 4, unlocked: true, missing: [] }),
      ),
    );
    const w = await fetchApolloWarmup("o1", "u1");
    expect(w.unlocked).toBe(true);
  });

  it("startApolloDiscover posts the run body and returns run_id", async () => {
    let body: unknown;
    server.use(
      http.post("/api/connectors/apollo/discover", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ run_id: "r9", status: "queued" });
      }),
    );
    const r = await startApolloDiscover({ orgId: "o1", userId: "u1", mode: "replace" });
    expect(r.run_id).toBe("r9");
    expect(body).toMatchObject({ org_id: "o1", user_id: "u1", mode: "replace" });
  });

  it("fetchApolloDiscoverStatus parses counts", async () => {
    server.use(
      http.get("/api/connectors/apollo/discover/status", () =>
        HttpResponse.json({ run_id: "r9", org_id: "o1", status: "completed", mode: "keep",
          counts: { searched: 100, created: 10, matched: 0, errors: [] },
          credits_consumed: 10, progress_percent: 100 }),
      ),
    );
    const st = await fetchApolloDiscoverStatus("o1", "r9");
    expect(st.counts.created).toBe(10);
    expect(st.status).toBe("completed");
  });

  it("startApolloDiscover surfaces a 409 in-progress as an Error", async () => {
    server.use(
      http.post("/api/connectors/apollo/discover", () =>
        HttpResponse.json({ detail: "in progress", code: "discovery_in_progress" }, { status: 409 }),
      ),
    );
    await expect(startApolloDiscover({ orgId: "o1", userId: "u1", mode: "keep" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/connectors/services/__tests__/apollo.test.ts`
Expected: FAIL — cannot resolve `../apollo`.

- [ ] **Step 3: Implement the read/discover services**

`frontend/src/features/connectors/services/apollo.ts`:
```typescript
import { apiGet, apiPost } from "@/shared/api/client";
import {
  ApolloStatusSchema, type ApolloStatus,
  ApolloWarmupSchema, type ApolloWarmup,
  ApolloDiscoverResponseSchema, type ApolloDiscoverResponse,
  ApolloDiscoverStatusSchema, type ApolloDiscoverStatus,
} from "../contracts";
import type { DiscoverMode } from "../types";

export async function fetchApolloStatus(orgId: string): Promise<ApolloStatus> {
  return apiGet(`connectors/apollo/status?org_id=${encodeURIComponent(orgId)}`, ApolloStatusSchema);
}

export async function fetchApolloWarmup(orgId: string, userId: string): Promise<ApolloWarmup> {
  return apiGet(
    `connectors/apollo/warmup?org_id=${encodeURIComponent(orgId)}&user_id=${encodeURIComponent(userId)}`,
    ApolloWarmupSchema,
  );
}

export interface StartDiscoverArgs {
  orgId: string;
  userId: string;
  mode: DiscoverMode;
  icpId?: string;
  maxLeads?: number;
}

export async function startApolloDiscover(args: StartDiscoverArgs): Promise<ApolloDiscoverResponse> {
  const body: Record<string, unknown> = {
    org_id: args.orgId,
    user_id: args.userId,
    mode: args.mode,
  };
  if (args.icpId) body.icp_id = args.icpId;
  if (typeof args.maxLeads === "number") body.max_leads = args.maxLeads;
  return apiPost("connectors/apollo/discover", body, ApolloDiscoverResponseSchema);
}

export async function fetchApolloDiscoverStatus(
  orgId: string,
  runId: string | null,
): Promise<ApolloDiscoverStatus> {
  const q = runId
    ? `org_id=${encodeURIComponent(orgId)}&run_id=${encodeURIComponent(runId)}`
    : `org_id=${encodeURIComponent(orgId)}`;
  return apiGet(`connectors/apollo/discover/status?${q}`, ApolloDiscoverStatusSchema);
}
```

> Confirm `apiGet`/`apiPost` accept `(endpoint, schema)` / `(endpoint, body, schema)` and prefix `/api` in dev — see `@/shared/api/client` (the signals service is the template).

- [ ] **Step 4: Run — expect PASS**

Run: `cd frontend && npx vitest run src/features/connectors/services/__tests__/apollo.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/connectors/services
git commit -m "feat(fe): apollo status/warmup/discover services"
```

---

## Task 3: Connect + export services (G1 error-parse, G2 raw download)

**Files:**
- Modify: `frontend/src/features/connectors/services/apollo.ts`
- Modify: `frontend/src/features/connectors/services/__tests__/apollo.test.ts`

- [ ] **Step 1: Add failing tests for connect + export-url**

Append to `apollo.test.ts`:
```typescript
import { connectApollo, apolloLeadsExportUrl, ApolloConnectError } from "../apollo";

describe("connectApollo (error-body parsing — G1)", () => {
  it("returns the parsed body on success", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json({ connected: true, status: "connected" }),
      ),
    );
    const r = await connectApollo({ orgId: "o1", userId: "u1", apiKey: "k" });
    expect(r.connected).toBe(true);
  });

  it("throws ApolloConnectError with code+missing_section on 409 profile_incomplete", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json({ detail: "incomplete", code: "profile_incomplete", missing_section: "industry" },
          { status: 409 }),
      ),
    );
    await expect(connectApollo({ orgId: "o1", userId: "u1", apiKey: "k" })).rejects.toMatchObject({
      code: "profile_incomplete",
      missing_section: "industry",
      httpStatus: 409,
    });
  });

  it("throws ApolloConnectError with code master_key_required on 403", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json({ detail: "needs master key", code: "master_key_required" }, { status: 403 }),
      ),
    );
    await expect(connectApollo({ orgId: "o1", userId: "u1", apiKey: "k" })).rejects.toMatchObject({
      code: "master_key_required",
    });
  });
});

describe("apolloLeadsExportUrl (G2)", () => {
  it("builds a proxied URL with org_id and format", () => {
    const url = apolloLeadsExportUrl("o1", "csv");
    expect(url).toContain("connectors/apollo/leads/export");
    expect(url).toContain("org_id=o1");
    expect(url).toContain("format=csv");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/connectors/services/__tests__/apollo.test.ts`
Expected: FAIL — `connectApollo` / `apolloLeadsExportUrl` / `ApolloConnectError` not exported.

- [ ] **Step 3: Implement connect (raw + error-parse) and export-url**

Append to `apollo.ts`:
```typescript
import { z } from "zod";
import { buildApiUrl } from "@/shared/api/transport";
import type { ApolloConnectErrorShape } from "../types";

export class ApolloConnectError extends Error implements ApolloConnectErrorShape {
  httpStatus: number;
  code?: string;
  detail?: string;
  missing_section?: string;
  constructor(shape: ApolloConnectErrorShape) {
    super(shape.detail || `Apollo connect failed (${shape.httpStatus})`);
    this.name = "ApolloConnectError";
    this.httpStatus = shape.httpStatus;
    this.code = shape.code;
    this.detail = shape.detail;
    this.missing_section = shape.missing_section;
  }
}

export interface ConnectApolloArgs {
  orgId: string;
  userId: string;
  apiKey: string;
}

export async function connectApollo(
  args: ConnectApolloArgs,
): Promise<{ connected: boolean; status: string }> {
  // Raw fetch (not apiPost) so we can read the JSON {code, missing_section} on error (G1).
  const res = await fetch(buildApiUrl("connectors/apollo/connect"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ org_id: args.orgId, user_id: args.userId, api_key: args.apiKey }),
  });
  if (!res.ok) {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = await res.json();
    } catch {
      /* non-JSON error body */
    }
    throw new ApolloConnectError({
      httpStatus: res.status,
      code: typeof parsed.code === "string" ? parsed.code : undefined,
      detail: typeof parsed.detail === "string" ? parsed.detail : undefined,
      missing_section: typeof parsed.missing_section === "string" ? parsed.missing_section : undefined,
    });
  }
  const ConnectOkSchema = z.object({ connected: z.boolean(), status: z.string() }).passthrough();
  return ConnectOkSchema.parse(await res.json());
}

export function apolloLeadsExportUrl(orgId: string, format: "json" | "csv"): string {
  return buildApiUrl(
    `connectors/apollo/leads/export?org_id=${encodeURIComponent(orgId)}&format=${format}`,
  );
}
```

> `buildApiUrl` is **already exported** from `@/shared/api/transport` (`transport.ts:19`) — import it directly. It encapsulates the dev `/api` vs prod `BACKEND_BASE_URL` rule.

- [ ] **Step 4: Run — expect PASS**

Run: `cd frontend && npx vitest run src/features/connectors/services/__tests__/apollo.test.ts`
Expected: PASS (all connect + export tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/connectors/services frontend/src/shared/api/transport.ts
git commit -m "feat(fe): apollo connect (error-body parse) + leads export URL"
```

---

## Task 4: Read hooks — `useApolloStatus`, `useApolloWarmup` (poll-while-locked)

**Files:**
- Create: `frontend/src/features/connectors/hooks/useApolloStatus.ts`
- Create: `frontend/src/features/connectors/hooks/useApolloWarmup.ts`
- Create: `frontend/src/features/connectors/hooks/__tests__/useApolloWarmup.test.tsx`

- [ ] **Step 1: Write failing hook test (polling predicate G3)**

`frontend/src/features/connectors/hooks/__tests__/useApolloWarmup.test.tsx`:
```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { server } from "@/test/msw/server";
import { useApolloWarmup } from "../useApolloWarmup";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useApolloWarmup", () => {
  it("fetches warmup when connected and enabled", async () => {
    server.use(
      http.get("/api/connectors/apollo/warmup", () =>
        HttpResponse.json({ icp_configured: true, signals_generated: false, scout_completed: false,
          profiler_analyzed: false, ready_count: 1, unlocked: false, missing: [] }),
      ),
    );
    const { result } = renderHook(() => useApolloWarmup("o1", "u1", { connected: true }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data?.ready_count).toBe(1);
  });

  it("is disabled when not connected", () => {
    const { result } = renderHook(() => useApolloWarmup("o1", "u1", { connected: false }), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/connectors/hooks/__tests__/useApolloWarmup.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the read hooks**

`frontend/src/features/connectors/hooks/useApolloStatus.ts`:
```typescript
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/shared/api/queryKeys";
import { fetchApolloStatus } from "../services/apollo";

export function useApolloStatus(orgId: string, enabled = true) {
  return useQuery({
    queryKey: qk.apolloStatus(orgId),
    enabled: enabled && !!orgId,
    queryFn: () => fetchApolloStatus(orgId),
    retry: false,
  });
}
```

`frontend/src/features/connectors/hooks/useApolloWarmup.ts`:
```typescript
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/shared/api/queryKeys";
import { fetchApolloWarmup } from "../services/apollo";

const WARMUP_POLL_MS = 30_000; // low-frequency; only while connected-and-locked (G3/G4)

export function useApolloWarmup(
  orgId: string,
  userId: string,
  opts: { connected: boolean } = { connected: true },
) {
  return useQuery({
    queryKey: qk.apolloWarmup(orgId, userId),
    enabled: opts.connected && !!orgId && !!userId,
    queryFn: () => fetchApolloWarmup(orgId, userId),
    retry: false,
    // Poll only until unlocked; once unlocked, stop (predicate evaluated each tick).
    refetchInterval: (query) => (query.state.data?.unlocked ? false : WARMUP_POLL_MS),
  });
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd frontend && npx vitest run src/features/connectors/hooks/__tests__/useApolloWarmup.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/connectors/hooks
git commit -m "feat(fe): useApolloStatus + useApolloWarmup (poll-while-locked)"
```

---

## Task 5: Discovery hooks — `useDiscover`, `useDiscoverStatus`, `useExportApolloLeads`

**Files:**
- Create: `frontend/src/features/connectors/hooks/{useDiscover.ts,useDiscoverStatus.ts,useExportApolloLeads.ts}`
- Create: `frontend/src/features/connectors/hooks/__tests__/useDiscoverStatus.test.tsx`

- [ ] **Step 1: Write failing test (poll stops on terminal — G3)**

`frontend/src/features/connectors/hooks/__tests__/useDiscoverStatus.test.tsx`:
```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { server } from "@/test/msw/server";
import { useDiscoverStatus, isTerminalStatus } from "../useDiscoverStatus";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("isTerminalStatus", () => {
  it("treats queued/processing as non-terminal and the rest as terminal", () => {
    expect(isTerminalStatus("queued")).toBe(false);
    expect(isTerminalStatus("processing")).toBe(false);
    expect(isTerminalStatus("completed")).toBe(true);
    expect(isTerminalStatus("completed_empty")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
    expect(isTerminalStatus("partial")).toBe(true);
  });
});

describe("useDiscoverStatus", () => {
  it("fetches when a runId is present", async () => {
    server.use(
      http.get("/api/connectors/apollo/discover/status", () =>
        HttpResponse.json({ run_id: "r1", org_id: "o1", status: "completed", mode: "keep",
          counts: { created: 5, matched: 0, errors: [] }, credits_consumed: 5, progress_percent: 100 }),
      ),
    );
    const { result } = renderHook(() => useDiscoverStatus("o1", "r1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data?.counts.created).toBe(5);
  });

  it("is idle with no runId", () => {
    const { result } = renderHook(() => useDiscoverStatus("o1", null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/connectors/hooks/__tests__/useDiscoverStatus.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the three hooks**

`frontend/src/features/connectors/hooks/useDiscoverStatus.ts`:
```typescript
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/shared/api/queryKeys";
import { fetchApolloDiscoverStatus } from "../services/apollo";

const STATUS_POLL_MS = 2_500;
const NON_TERMINAL = new Set(["queued", "processing"]);

export function isTerminalStatus(status: string | undefined): boolean {
  return !!status && !NON_TERMINAL.has(status);
}

export function useDiscoverStatus(orgId: string, runId: string | null) {
  return useQuery({
    queryKey: qk.apolloDiscoverStatus(orgId, runId),
    enabled: !!orgId && !!runId,
    queryFn: () => fetchApolloDiscoverStatus(orgId, runId),
    retry: false,
    refetchInterval: (query) => (isTerminalStatus(query.state.data?.status) ? false : STATUS_POLL_MS),
  });
}
```

`frontend/src/features/connectors/hooks/useDiscover.ts`:
```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/shared/api/queryKeys";
import { startApolloDiscover, type StartDiscoverArgs } from "../services/apollo";

export function useDiscover(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: StartDiscoverArgs) => startApolloDiscover(args),
    onSuccess: () => {
      // a queued run changes status; refetch so the tile flips to Running
      queryClient.invalidateQueries({ queryKey: qk.apolloStatus(orgId) });
    },
  });
}
```

`frontend/src/features/connectors/hooks/useExportApolloLeads.ts`:
```typescript
import { useCallback } from "react";
import { apolloLeadsExportUrl } from "../services/apollo";

/** Triggers a browser download of the org's discovery leads (G2). */
export function useExportApolloLeads(orgId: string) {
  return useCallback(
    (format: "json" | "csv" = "csv") => {
      const url = apolloLeadsExportUrl(orgId, format);
      const a = document.createElement("a");
      a.href = url;
      a.download = `apollo-leads.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    [orgId],
  );
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd frontend && npx vitest run src/features/connectors/hooks/__tests__/useDiscoverStatus.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/connectors/hooks
git commit -m "feat(fe): useDiscover + useDiscoverStatus (poll-while-running) + useExportApolloLeads"
```

---

## Task 6: Tile-state derivation (pure logic) + discovery-prompt selection

**Files:**
- Create: `frontend/src/features/connectors/lib/{tileState.ts,discoveryPrompt.ts}`
- Create: `frontend/src/features/connectors/lib/__tests__/{tileState,discoveryPrompt}.test.ts`

- [ ] **Step 1: Write failing logic tests**

`frontend/src/features/connectors/lib/__tests__/tileState.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { deriveApolloTileState } from "../tileState";

const base = { connected: true, credentialError: false };

describe("deriveApolloTileState", () => {
  it("disconnected when not connected", () => {
    expect(deriveApolloTileState({ ...base, connected: false }, undefined, undefined)).toBe("disconnected");
  });
  it("locked when connected but warmup not unlocked", () => {
    expect(deriveApolloTileState(base, { unlocked: false }, undefined)).toBe("locked");
  });
  it("error when credential status is error (UC9), regardless of warmup", () => {
    expect(deriveApolloTileState({ ...base, credentialError: true }, { unlocked: true }, undefined)).toBe("error");
  });
  it("running when latest run is queued/processing", () => {
    expect(deriveApolloTileState(base, { unlocked: true }, { status: "processing" })).toBe("running");
  });
  it("unlocked when ready and no active/finished run", () => {
    expect(deriveApolloTileState(base, { unlocked: true }, undefined)).toBe("unlocked");
  });
  it("complete on a successful run", () => {
    expect(deriveApolloTileState(base, { unlocked: true }, { status: "completed" })).toBe("complete");
  });
  it("complete_empty on completed_empty", () => {
    expect(deriveApolloTileState(base, { unlocked: true }, { status: "completed_empty" })).toBe("complete_empty");
  });
  it("complete_partial on partial", () => {
    expect(deriveApolloTileState(base, { unlocked: true }, { status: "partial" })).toBe("complete_partial");
  });
  it("error on a failed run", () => {
    expect(deriveApolloTileState(base, { unlocked: true }, { status: "failed" })).toBe("error");
  });
});
```

`frontend/src/features/connectors/lib/__tests__/discoveryPrompt.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { selectDiscoveryPrompt } from "../discoveryPrompt";

describe("selectDiscoveryPrompt", () => {
  it("re-discovery guard when ICP unchanged (UC7)", () => {
    expect(selectDiscoveryPrompt({ icpChanged: false, hasPriorDiscovery: true })).toBe("rediscovery_guard");
  });
  it("keep/replace/download when ICP changed and prior discovery exists (UC5)", () => {
    expect(selectDiscoveryPrompt({ icpChanged: true, hasPriorDiscovery: true })).toBe("keep_replace_download");
  });
  it("no prompt when ICP changed but no prior discovery (first run)", () => {
    expect(selectDiscoveryPrompt({ icpChanged: true, hasPriorDiscovery: false })).toBe("none");
  });
  it("guard takes precedence when unchanged even without prior discovery", () => {
    // unchanged + no prior discovery is effectively a first run; no guard needed
    expect(selectDiscoveryPrompt({ icpChanged: false, hasPriorDiscovery: false })).toBe("none");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/connectors/lib`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the pure logic**

`frontend/src/features/connectors/lib/tileState.ts`:
```typescript
import type { ApolloTileState } from "../types";

interface ConnState {
  connected: boolean;
  credentialError: boolean; // status.status === "error" (UC9)
}

export function deriveApolloTileState(
  conn: ConnState,
  warmup: { unlocked: boolean } | undefined,
  latestRun: { status: string } | undefined,
): ApolloTileState {
  if (!conn.connected) return "disconnected";
  if (conn.credentialError) return "error";
  if (!warmup?.unlocked) return "locked";

  switch (latestRun?.status) {
    case "queued":
    case "processing":
      return "running";
    case "completed":
      return "complete";
    case "completed_empty":
      return "complete_empty";
    case "partial":
      return "complete_partial";
    case "failed":
      return "error";
    default:
      return "unlocked";
  }
}
```

`frontend/src/features/connectors/lib/discoveryPrompt.ts`:
```typescript
import type { DiscoveryPromptKind } from "../types";

export function selectDiscoveryPrompt(input: {
  icpChanged: boolean;
  hasPriorDiscovery: boolean; // proxy: status.last_discovery_at != null (G5)
}): DiscoveryPromptKind {
  if (!input.hasPriorDiscovery) return "none";
  // Prior discovery exists:
  if (!input.icpChanged) return "rediscovery_guard"; // UC7
  return "keep_replace_download"; // UC5
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd frontend && npx vitest run src/features/connectors/lib`
Expected: PASS (tileState 9, discoveryPrompt 4).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/connectors/lib
git commit -m "feat(fe): apollo tile-state + discovery-prompt selection logic"
```

---

## Task 7: `ApolloConnectModal` (G1 error branching + deep-link)

**Files:**
- Create: `frontend/src/features/connectors/components/ApolloConnectModal.tsx`
- Create: `frontend/src/features/connectors/components/__tests__/ApolloConnectModal.test.tsx`

- [ ] **Step 1: Write failing component tests**

`frontend/src/features/connectors/components/__tests__/ApolloConnectModal.test.tsx`:
```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { server } from "@/test/msw/server";
import { ApolloConnectModal } from "../ApolloConnectModal";

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("ApolloConnectModal", () => {
  it("connects successfully and calls onConnected", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json({ connected: true, status: "connected" }),
      ),
    );
    const onConnected = vi.fn();
    wrap(<ApolloConnectModal open orgId="o1" userId="u1" onClose={vi.fn()} onConnected={onConnected} onDeepLink={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/api key/i), "master-key");
    await userEvent.click(screen.getByRole("button", { name: /connect/i }));
    await waitFor(() => expect(onConnected).toHaveBeenCalled());
  });

  it("shows a deep-link button on profile_incomplete (UC6)", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json({ detail: "incomplete", code: "profile_incomplete", missing_section: "industry" },
          { status: 409 }),
      ),
    );
    const onDeepLink = vi.fn();
    wrap(<ApolloConnectModal open orgId="o1" userId="u1" onClose={vi.fn()} onConnected={vi.fn()} onDeepLink={onDeepLink} />);
    await userEvent.type(screen.getByLabelText(/api key/i), "k");
    await userEvent.click(screen.getByRole("button", { name: /connect/i }));
    const fix = await screen.findByRole("button", { name: /complete your profile|go to/i });
    await userEvent.click(fix);
    expect(onDeepLink).toHaveBeenCalledWith("industry");
  });

  it("shows a master-key message on 403", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json({ detail: "needs master key", code: "master_key_required" }, { status: 403 }),
      ),
    );
    wrap(<ApolloConnectModal open orgId="o1" userId="u1" onClose={vi.fn()} onConnected={vi.fn()} onDeepLink={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/api key/i), "k");
    await userEvent.click(screen.getByRole("button", { name: /connect/i }));
    expect(await screen.findByText(/master api key/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/ApolloConnectModal.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the modal**

`frontend/src/features/connectors/components/ApolloConnectModal.tsx` (use the repo's shadcn `Dialog`, `Input`, `Button`, `Label`, `Alert`; confirm exact import paths under `@/components/ui/*`):
```tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectApollo, ApolloConnectError } from "../services/apollo";

interface Props {
  open: boolean;
  orgId: string;
  userId: string;
  onClose: () => void;
  onConnected: () => void;
  onDeepLink: (section: string) => void; // navigate to the incomplete profile section
}

const APOLLO_KEY_HELP = "https://docs.apollo.io/docs/create-api-key";

export function ApolloConnectModal({ open, orgId, userId, onClose, onConnected, onDeepLink }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApolloConnectError | null>(null);

  async function handleConnect() {
    setSubmitting(true);
    setError(null);
    try {
      await connectApollo({ orgId, userId, apiKey });
      onConnected();
    } catch (e) {
      setError(e instanceof ApolloConnectError ? e : new ApolloConnectError({ httpStatus: 0, detail: "Connection failed" }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Apollo</DialogTitle>
          <DialogDescription>
            Discover net-new leads from Apollo based on your ICP. Requires a{" "}
            <strong>master API key</strong> with search access.{" "}
            <a href={APOLLO_KEY_HELP} target="_blank" rel="noreferrer" className="underline">
              Where do I find it?
            </a>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="apollo-api-key">API key</Label>
          <Input
            id="apollo-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Apollo master API key"
          />
        </div>

        {error?.code === "profile_incomplete" && (
          <div role="alert" className="text-sm text-destructive">
            Your customer profile is incomplete. Complete the{" "}
            <strong>{error.missing_section}</strong> section first.
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => onDeepLink(error.missing_section ?? "icp")}>
                Complete your profile
              </Button>
            </div>
          </div>
        )}
        {error?.code === "master_key_required" && (
          <p role="alert" className="text-sm text-destructive">
            This key works, but discovery needs a <strong>master API key</strong> with search access.
          </p>
        )}
        {error && !error.code && (
          <p role="alert" className="text-sm text-destructive">
            Invalid key — please check your Apollo account.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConnect} disabled={submitting || !apiKey}>
            {submitting ? "Connecting…" : "Connect"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/ApolloConnectModal.test.tsx`
Expected: PASS (3 tests). Fix import paths for `@/components/ui/*` if any differ.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/connectors/components/ApolloConnectModal.tsx frontend/src/features/connectors/components/__tests__/ApolloConnectModal.test.tsx
git commit -m "feat(fe): apollo connect modal with profile-incomplete + master-key branches"
```

---

## Task 8: `WarmupProgress` component

**Files:**
- Create: `frontend/src/features/connectors/components/WarmupProgress.tsx`
- Create: `frontend/src/features/connectors/components/__tests__/WarmupProgress.test.tsx`

- [ ] **Step 1: Write failing test**

`__tests__/WarmupProgress.test.tsx`:
```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WarmupProgress } from "../WarmupProgress";

const warmup = {
  icp_configured: true, signals_generated: false, scout_completed: false, profiler_analyzed: true,
  ready_count: 2, unlocked: false,
  missing: [
    { step: "signals_generated", label: "Signals — first run", deep_link_hint: "signals" },
    { step: "scout_completed", label: "Scout — first market research", deep_link_hint: "scout" },
  ],
};

describe("WarmupProgress", () => {
  it("renders 'X of 4 agents ready'", () => {
    render(<WarmupProgress warmup={warmup} onDeepLink={vi.fn()} />);
    expect(screen.getByText(/2 of 4/i)).toBeInTheDocument();
  });

  it("lists missing steps with deep links", async () => {
    const onDeepLink = vi.fn();
    render(<WarmupProgress warmup={warmup} onDeepLink={vi.fn()} />);
    expect(screen.getByText(/Signals — first run/)).toBeInTheDocument();
    expect(screen.getByText(/Scout — first market research/)).toBeInTheDocument();
  });

  it("fires onDeepLink with the hint on click", async () => {
    const onDeepLink = vi.fn();
    render(<WarmupProgress warmup={warmup} onDeepLink={onDeepLink} />);
    await userEvent.click(screen.getByRole("button", { name: /Signals — first run/ }));
    expect(onDeepLink).toHaveBeenCalledWith("signals");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/WarmupProgress.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`WarmupProgress.tsx`:
```tsx
import { Button } from "@/components/ui/button";
import type { ApolloWarmup } from "../contracts";

export function WarmupProgress({
  warmup,
  onDeepLink,
}: {
  warmup: Pick<ApolloWarmup, "ready_count" | "missing">;
  onDeepLink: (hint: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{warmup.ready_count} of 4 agents ready</p>
      {warmup.missing.length > 0 && (
        <ul className="space-y-1">
          {warmup.missing.map((m) => (
            <li key={m.step}>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-left"
                onClick={() => onDeepLink(m.deep_link_hint)}
              >
                {m.label}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/WarmupProgress.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/connectors/components/WarmupProgress.tsx frontend/src/features/connectors/components/__tests__/WarmupProgress.test.tsx
git commit -m "feat(fe): warmup progress (X of 4) with missing-step deep links"
```

---

## Task 9: `DiscoveryDialogs` (UC7 guard + UC5 keep/replace/download)

**Files:**
- Create: `frontend/src/features/connectors/components/DiscoveryDialogs.tsx`
- Create: `frontend/src/features/connectors/components/__tests__/DiscoveryDialogs.test.tsx`

- [ ] **Step 1: Write failing test**

`__tests__/DiscoveryDialogs.test.tsx`:
```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReDiscoveryGuard, KeepReplaceDownloadPrompt } from "../DiscoveryDialogs";

describe("ReDiscoveryGuard (UC7)", () => {
  it("confirms to proceed", async () => {
    const onConfirm = vi.fn();
    render(<ReDiscoveryGuard open lastDiscoveryAt="2026-06-10T00:00:00Z" onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /continue anyway|continue/i }));
    expect(onConfirm).toHaveBeenCalled();
  });
});

describe("KeepReplaceDownloadPrompt (UC5)", () => {
  it("returns the chosen mode on continue (keep default)", async () => {
    const onContinue = vi.fn();
    render(<KeepReplaceDownloadPrompt open onContinue={onContinue} onDownload={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledWith("keep");
  });

  it("selecting replace then continue returns replace", async () => {
    const onContinue = vi.fn();
    render(<KeepReplaceDownloadPrompt open onContinue={onContinue} onDownload={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByLabelText(/replace/i));
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledWith("replace");
  });

  it("download option fires onDownload", async () => {
    const onDownload = vi.fn();
    render(<KeepReplaceDownloadPrompt open onContinue={vi.fn()} onDownload={onDownload} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /download/i }));
    expect(onDownload).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/DiscoveryDialogs.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (uses `Dialog`, `Button`, and `RadioGroup`/`RadioGroupItem` from `@/components/ui/*`; G5 — no hard `[N]`)

`DiscoveryDialogs.tsx`:
```tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { DiscoverMode } from "../types";

function formatDate(iso?: string | null) {
  if (!iso) return "your last run";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "your last run" : d.toLocaleDateString();
}

export function ReDiscoveryGuard({
  open, lastDiscoveryAt, onConfirm, onCancel,
}: { open: boolean; lastDiscoveryAt?: string | null; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your ICP hasn’t changed</DialogTitle>
          <DialogDescription>
            Your ICP hasn’t changed since your last discovery on {formatDate(lastDiscoveryAt)}. Running
            again may return the same leads.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>Continue anyway</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function KeepReplaceDownloadPrompt({
  open, onContinue, onDownload, onCancel,
}: {
  open: boolean;
  onContinue: (mode: DiscoverMode) => void;
  onDownload: () => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<DiscoverMode>("keep");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You have Apollo-sourced leads from a previous discovery</DialogTitle>
          <DialogDescription>What would you like to do?</DialogDescription>
        </DialogHeader>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as DiscoverMode)}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="keep" id="mode-keep" />
            <Label htmlFor="mode-keep">Keep existing leads + add new ones</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="replace" id="mode-replace" />
            <Label htmlFor="mode-replace">Replace — remove old and start fresh</Label>
          </div>
        </RadioGroup>
        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={onDownload}>Download existing leads</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button onClick={() => onContinue(mode)}>Continue</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/DiscoveryDialogs.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/connectors/components/DiscoveryDialogs.tsx frontend/src/features/connectors/components/__tests__/DiscoveryDialogs.test.tsx
git commit -m "feat(fe): re-discovery guard + keep/replace/download prompts"
```

---

## Task 10: `LowCreditWarning` + `ApolloTile` (assembles state → UI)

**Files:**
- Create: `frontend/src/features/connectors/components/LowCreditWarning.tsx`
- Create: `frontend/src/features/connectors/components/ApolloTile.tsx`
- Create: `frontend/src/features/connectors/components/__tests__/ApolloTile.test.tsx`

- [ ] **Step 1: Write failing tile tests** (state-driven rendering; mocks the hooks)

`__tests__/ApolloTile.test.tsx`:
```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  warmup: vi.fn(),
  discoverStatus: vi.fn(),
  discover: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  exportLeads: vi.fn(() => vi.fn()),
}));

vi.mock("../../hooks/useApolloStatus", () => ({ useApolloStatus: mocks.status }));
vi.mock("../../hooks/useApolloWarmup", () => ({ useApolloWarmup: mocks.warmup }));
vi.mock("../../hooks/useDiscoverStatus", () => ({
  useDiscoverStatus: mocks.discoverStatus,
  isTerminalStatus: (s: string) => !["queued", "processing"].includes(s),
}));
vi.mock("../../hooks/useDiscover", () => ({ useDiscover: mocks.discover }));
vi.mock("../../hooks/useExportApolloLeads", () => ({ useExportApolloLeads: mocks.exportLeads }));
vi.mock("@/shared/auth", () => ({ useAuth: () => ({ orgId: "o1", currentUser: { uid: "u1" } }) }));

import { ApolloTile } from "../ApolloTile";

beforeEach(() => {
  mocks.status.mockReturnValue({ data: { connected: true, status: "connected", low_credit: false,
    icp_changed_since_last_discovery: false } });
  mocks.warmup.mockReturnValue({ data: { unlocked: true, ready_count: 4, missing: [] } });
  mocks.discoverStatus.mockReturnValue({ data: undefined });
});

describe("ApolloTile", () => {
  it("shows Discover Leads when unlocked", () => {
    render(<ApolloTile />);
    expect(screen.getByRole("button", { name: /discover leads/i })).toBeEnabled();
  });

  it("shows the locked progress when warmup incomplete", () => {
    mocks.warmup.mockReturnValue({ data: { unlocked: false, ready_count: 2,
      missing: [{ step: "signals_generated", label: "Signals — first run", deep_link_hint: "signals" }] } });
    render(<ApolloTile />);
    expect(screen.getByText(/2 of 4/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /discover leads/i })).not.toBeInTheDocument();
  });

  it("disables the button and shows spinner text while running", () => {
    mocks.discoverStatus.mockReturnValue({ data: { status: "processing", progress_percent: 40, counts: {} } });
    render(<ApolloTile />);
    expect(screen.getByText(/discovering leads/i)).toBeInTheDocument();
  });

  it("shows zero-results widen-ICP affordance on completed_empty", () => {
    mocks.discoverStatus.mockReturnValue({ data: { status: "completed_empty", counts: { searched: 80, created: 0, matched: 0 } } });
    render(<ApolloTile />);
    expect(screen.getByText(/no leads found/i)).toBeInTheDocument();
  });

  it("shows a low-credit warning when status.low_credit", () => {
    mocks.status.mockReturnValue({ data: { connected: true, status: "connected", low_credit: true,
      icp_changed_since_last_discovery: false } });
    render(<ApolloTile />);
    expect(screen.getByText(/credits are running low/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/ApolloTile.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `LowCreditWarning` then `ApolloTile`**

`LowCreditWarning.tsx`:
```tsx
export function LowCreditWarning() {
  return (
    <p role="status" className="text-sm text-amber-600">
      Your Apollo credits are running low.
    </p>
  );
}
```

`ApolloTile.tsx` (orchestrates the hooks + dialogs; `useAuth` for identity per G10):
```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/auth";
import { Button } from "@/components/ui/button";
import { useApolloStatus } from "../hooks/useApolloStatus";
import { useApolloWarmup } from "../hooks/useApolloWarmup";
import { useDiscoverStatus } from "../hooks/useDiscoverStatus";
import { useDiscover } from "../hooks/useDiscover";
import { useExportApolloLeads } from "../hooks/useExportApolloLeads";
import { deriveApolloTileState } from "../lib/tileState";
import { selectDiscoveryPrompt } from "../lib/discoveryPrompt";
import { WarmupProgress } from "./WarmupProgress";
import { LowCreditWarning } from "./LowCreditWarning";
import { ApolloConnectModal } from "./ApolloConnectModal";
import { ReDiscoveryGuard, KeepReplaceDownloadPrompt } from "./DiscoveryDialogs";
import type { DiscoverMode } from "../types";

const MC_PATH = "/mission-control";

export function ApolloTile() {
  const { orgId, currentUser } = useAuth();
  const userId = currentUser?.uid ?? "";
  const navigate = useNavigate();

  const statusQ = useApolloStatus(orgId);
  const status = statusQ.data;
  const connected = !!status?.connected;

  const warmupQ = useApolloWarmup(orgId, userId, { connected });
  const warmup = warmupQ.data;

  const [runId, setRunId] = useState<string | null>(null);
  const discoverStatusQ = useDiscoverStatus(orgId, runId);
  const run = discoverStatusQ.data;

  const discover = useDiscover(orgId);
  const exportLeads = useExportApolloLeads(orgId);

  const [connectOpen, setConnectOpen] = useState(false);
  const [prompt, setPrompt] = useState<"none" | "guard" | "keep_replace">("none");

  const tileState = deriveApolloTileState(
    { connected, credentialError: status?.status === "error" },
    warmup,
    run,
  );

  function goDeepLink(hint: string) {
    navigate(`${MC_PATH}?section=${encodeURIComponent(hint)}`);
  }

  function launch(mode: DiscoverMode) {
    setPrompt("none");
    discover.mutate(
      { orgId, userId, mode },
      { onSuccess: (r) => setRunId(r.run_id) },
    );
  }

  function onDiscoverClick() {
    const kind = selectDiscoveryPrompt({
      icpChanged: !!status?.icp_changed_since_last_discovery,
      hasPriorDiscovery: !!status?.last_discovery_at,
    });
    if (kind === "rediscovery_guard") setPrompt("guard");
    else if (kind === "keep_replace_download") setPrompt("keep_replace");
    else launch("keep");
  }

  return (
    <div className="rounded-lg border p-4 space-y-3" data-testid="apollo-tile">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Apollo</h3>
        {status?.icp_changed_since_last_discovery && tileState !== "locked" && (
          <span className="text-xs text-muted-foreground">ICP updated since last discovery</span>
        )}
      </div>

      {tileState === "disconnected" && (
        <Button onClick={() => setConnectOpen(true)}>Connect Apollo</Button>
      )}

      {tileState === "locked" && warmup && (
        <>
          <p className="text-sm text-muted-foreground">
            Lead discovery will unlock once your agents are ready.
          </p>
          <WarmupProgress warmup={warmup} onDeepLink={goDeepLink} />
        </>
      )}

      {(tileState === "unlocked" ||
        tileState === "complete" ||
        tileState === "complete_empty" ||
        tileState === "complete_partial") && (
        <div className="space-y-2">
          {status?.low_credit && <LowCreditWarning />}
          {tileState === "complete" && run?.finished_at && (
            <p className="text-sm">Discovery complete · {new Date(run.finished_at).toLocaleString()}</p>
          )}
          {tileState === "complete_empty" && (
            <p className="text-sm">
              No leads found for your current ICP.{" "}
              <Button variant="link" className="h-auto p-0" onClick={() => goDeepLink("icp")}>
                Widen your ICP
              </Button>
            </p>
          )}
          {tileState === "complete_partial" && (
            <p role="status" className="text-sm text-amber-600">
              Discovery was interrupted — some leads may be missing.
            </p>
          )}
          <Button onClick={onDiscoverClick} disabled={discover.isPending}>
            Discover Leads
          </Button>
        </div>
      )}

      {tileState === "running" && (
        <p className="text-sm text-muted-foreground" role="status">
          Discovering leads… {run?.progress_percent ? `(${Math.round(run.progress_percent)}%)` : ""}
        </p>
      )}

      {tileState === "error" && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            {status?.status === "error"
              ? "Apollo key error — reconnect to resume discovery."
              : "Discovery failed — check your Apollo credits."}
          </p>
          <Button onClick={onDiscoverClick}>Retry</Button>
        </div>
      )}

      <ApolloConnectModal
        open={connectOpen}
        orgId={orgId}
        userId={userId}
        onClose={() => setConnectOpen(false)}
        onConnected={() => {
          setConnectOpen(false);
          statusQ.refetch();
        }}
        onDeepLink={(section) => {
          setConnectOpen(false);
          goDeepLink(section);
        }}
      />
      <ReDiscoveryGuard
        open={prompt === "guard"}
        lastDiscoveryAt={status?.last_discovery_at}
        onConfirm={() => launch("keep")}
        onCancel={() => setPrompt("none")}
      />
      <KeepReplaceDownloadPrompt
        open={prompt === "keep_replace"}
        onContinue={launch}
        onDownload={() => exportLeads("csv")}
        onCancel={() => setPrompt("none")}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/ApolloTile.test.tsx`
Expected: PASS (5 tests). (`useAuth()` returns `{ orgId, currentUser }` — verified, G10; `currentUser?.uid` is the user id.)

- [ ] **Step 4b: Add the barrel's first export**

Add to `frontend/src/features/connectors/index.ts`:
```typescript
export { ApolloTile } from "./components/ApolloTile";
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/connectors/components/{LowCreditWarning.tsx,ApolloTile.tsx} frontend/src/features/connectors/components/__tests__/ApolloTile.test.tsx frontend/src/features/connectors/index.ts
git commit -m "feat(fe): apollo tile assembling states, prompts, connect modal, low-credit"
```

---

## Task 11: Mount the tile in Mission Control → Data Sources

**Files:**
- Modify: `frontend/src/features/connectors/index.ts` (ensure `ApolloTile` exported — done in Task 1)
- Modify: the Data Sources surface — `frontend/src/features/mission-control/components/data-sources/DataSourcesManager.tsx` (confirm exact mount point at task time)
- Create: a render test near the mission-control mount, e.g. `frontend/src/features/mission-control/components/data-sources/__tests__/DataSourcesManager.apollo.test.tsx`

- [ ] **Step 1: Write a failing mount test**

`__tests__/DataSourcesManager.apollo.test.tsx` (assert the tile renders within the manager; mock the connectors barrel to a sentinel to keep this test about wiring, not tile internals):
```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/connectors", () => ({
  ApolloTile: () => <div data-testid="apollo-tile-mounted" />,
}));

// Mock the three data hooks DataSourcesManager consumes so it renders headless —
// match the EXACT import specifiers the manager uses for each:
//   useDataSources       (features/mission-control/hooks/useDataSources)
//   useDocumentSync      (features/mission-control/components/data-sources/useDocumentSync)
//   useLeadStreamStatus  (features/mission-control/hooks/useLeadStreamStatus)
// e.g.: vi.mock("../../../hooks/useLeadStreamStatus", () => ({ useLeadStreamStatus: () => ({ data: [], isLoading: false }) }));

import { DataSourcesManager } from "../DataSourcesManager";

describe("DataSourcesManager — Apollo tile", () => {
  it("mounts the Apollo tile", () => {
    render(<DataSourcesManager /* minimal required props */ />);
    expect(screen.getByTestId("apollo-tile-mounted")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/mission-control/components/data-sources/__tests__/DataSourcesManager.apollo.test.tsx`
Expected: FAIL — tile not mounted (and/or prop shape to fix).

- [ ] **Step 3: Mount `<ApolloTile />`**

In `DataSourcesManager.tsx`, add the import and render the tile in the Data Sources list region:
```tsx
import { ApolloTile } from "@/features/connectors";
// ...
// within the data-sources tab/list JSX:
<ApolloTile />
```
Mock the three hooks `DataSourcesManager` consumes — `useDataSources`, `useDocumentSync`, `useLeadStreamStatus` — matching its actual import specifiers, so it renders headless.

- [ ] **Step 4: Run — expect PASS**

Run: `cd frontend && npx vitest run src/features/mission-control/components/data-sources/__tests__/DataSourcesManager.apollo.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/mission-control/components/data-sources
git commit -m "feat(fe): mount Apollo tile in Mission Control Data Sources"
```

---

## Task 12: App-shell unlock toast (`useApolloUnlockToast`, G4)

**Files:**
- Create: `frontend/src/features/connectors/hooks/useApolloUnlockToast.ts`
- Create: `frontend/src/features/connectors/hooks/__tests__/useApolloUnlockToast.test.tsx`
- Modify: `frontend/src/app/App.tsx` (or nearest shell inside `TenantProvider`) to call the hook once.

- [ ] **Step 1: Write failing test (edge fires once; dedupe persists)**

`__tests__/useApolloUnlockToast.test.tsx`:
```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

const toast = vi.fn();
vi.mock("@/shared/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/shared/auth", () => ({ useAuth: () => ({ orgId: "o1", currentUser: { uid: "u1" } }) }));

const warmupData = { current: { connected: true, unlocked: false } as { connected: boolean; unlocked: boolean } | undefined };
vi.mock("../useApolloStatus", () => ({ useApolloStatus: () => ({ data: { connected: warmupData.current?.connected } }) }));
vi.mock("../useApolloWarmup", () => ({ useApolloWarmup: () => ({ data: warmupData.current ? { unlocked: warmupData.current.unlocked } : undefined }) }));

import { useApolloUnlockToast } from "../useApolloUnlockToast";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  toast.mockClear();
  localStorage.clear();
  warmupData.current = { connected: true, unlocked: false };
});

describe("useApolloUnlockToast", () => {
  it("fires once on the locked→unlocked edge and dedupes via localStorage", async () => {
    const { rerender } = renderHook(() => useApolloUnlockToast(), { wrapper });
    expect(toast).not.toHaveBeenCalled();

    warmupData.current = { connected: true, unlocked: true };
    rerender();
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));

    // A remount must NOT re-fire (persisted flag).
    rerender();
    expect(toast).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("apollo_unlock_notified:o1")).toBe("1");
  });

  it("does not fire if already unlocked-and-notified from a prior session", () => {
    localStorage.setItem("apollo_unlock_notified:o1", "1");
    warmupData.current = { connected: true, unlocked: true };
    renderHook(() => useApolloUnlockToast(), { wrapper });
    expect(toast).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/connectors/hooks/__tests__/useApolloUnlockToast.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

`useApolloUnlockToast.ts`:
```typescript
import { useEffect } from "react";
import { useAuth } from "@/shared/auth";
import { useToast } from "@/shared/hooks/use-toast";
import { useApolloStatus } from "./useApolloStatus";
import { useApolloWarmup } from "./useApolloWarmup";

function flagKey(orgId: string) {
  return `apollo_unlock_notified:${orgId}`;
}

/**
 * Mount ONCE at the app shell. While Apollo is connected-but-locked it lets the
 * warmup poll run; on the locked→unlocked edge it fires a one-time toast (deduped
 * per org via localStorage, G4) and the poll then stops (unlocked predicate).
 */
export function useApolloUnlockToast() {
  const { orgId, currentUser } = useAuth();
  const userId = currentUser?.uid ?? "";
  const { toast } = useToast();

  const status = useApolloStatus(orgId).data;
  const connected = !!status?.connected;
  const warmup = useApolloWarmup(orgId, userId, { connected }).data;

  useEffect(() => {
    if (!orgId || !connected || !warmup?.unlocked) return;
    const key = flagKey(orgId);
    if (localStorage.getItem(key) === "1") return;
    localStorage.setItem(key, "1");
    toast({
      title: "Apollo discovery is now ready",
      description: "Start finding leads in Mission Control.",
    });
  }, [orgId, connected, warmup?.unlocked, toast]);
}
```

> Confirm the toast hook path/shape (`@/shared/hooks/use-toast` → `{ toast }`) against the repo (shadcn's `useToast`). Adjust import if it lives elsewhere.

- [ ] **Step 4: Run — expect PASS**

Run: `cd frontend && npx vitest run src/features/connectors/hooks/__tests__/useApolloUnlockToast.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Mount it in the app shell**

In `frontend/src/app/App.tsx` (inside `TenantProvider`, where `useAuth` resolves), add a small mount component so the hook runs app-wide:
```tsx
import { useApolloUnlockToast } from "@/features/connectors";
function ApolloUnlockWatcher() {
  useApolloUnlockToast();
  return null;
}
// render <ApolloUnlockWatcher /> once inside the authenticated shell tree
```
Add `export { useApolloUnlockToast } from "./hooks/useApolloUnlockToast";` to the feature barrel (`index.ts`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/connectors/hooks/useApolloUnlockToast.ts frontend/src/features/connectors/hooks/__tests__/useApolloUnlockToast.test.tsx frontend/src/app/App.tsx frontend/src/features/connectors/index.ts
git commit -m "feat(fe): app-wide Apollo unlock toast (poll-while-locked, dedupe per org)"
```

---

## Task 13: Lead source filter (Scout Lead Stream) — G6

**Files:**
- Create: `frontend/src/features/connectors/lib/leadSource.ts` (+ test)
- Modify: `frontend/src/features/connectors/index.ts` (export `LEAD_SOURCE_OPTIONS`, `LeadSourceFilter`)
- Modify: the Scout Lead Stream toolbar + `LeadsTable` under `frontend/src/features/market-research/components/lead-stream/` (confirm exact files at task time)
- Create: a filter test next to the toolbar

- [ ] **Step 1: Write failing tests (pure filter + toolbar)**

`frontend/src/features/connectors/lib/__tests__/leadSource.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { filterLeadsBySource, LEAD_SOURCE_OPTIONS } from "../leadSource";

const leads = [
  { id: "1", source: "apollo" },
  { id: "2", source: "csv" },
  { id: "3", source: "HubSpot" },
];

describe("filterLeadsBySource", () => {
  it("returns all for 'all'", () => {
    expect(filterLeadsBySource(leads, "all")).toHaveLength(3);
  });
  it("returns only apollo for 'apollo'", () => {
    expect(filterLeadsBySource(leads, "apollo").map((l) => l.id)).toEqual(["1"]);
  });
  it("treats any non-apollo source as 'csv' bucket (csv | other uploads)", () => {
    expect(filterLeadsBySource(leads, "csv").map((l) => l.id)).toEqual(["2", "3"]);
  });
  it("exposes three options", () => {
    expect(LEAD_SOURCE_OPTIONS.map((o) => o.value)).toEqual(["all", "csv", "apollo"]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/connectors/lib/__tests__/leadSource.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the source-filter lib**

`frontend/src/features/connectors/lib/leadSource.ts`:
```typescript
export type LeadSourceFilter = "all" | "csv" | "apollo";

export const LEAD_SOURCE_OPTIONS: ReadonlyArray<{ value: LeadSourceFilter; label: string }> = [
  { value: "all", label: "All leads" },
  { value: "csv", label: "CSV only" },
  { value: "apollo", label: "Apollo only" },
];

/** Filter on a lead's `source`. Apollo leads carry source==="apollo"; everything
 *  else (csv uploads, legacy "HubSpot"/"Prospect List" mock sources) is the CSV bucket. */
export function filterLeadsBySource<T extends { source?: string | null }>(
  leads: T[],
  filter: LeadSourceFilter,
): T[] {
  if (filter === "all") return leads;
  if (filter === "apollo") return leads.filter((l) => (l.source ?? "").toLowerCase() === "apollo");
  return leads.filter((l) => (l.source ?? "").toLowerCase() !== "apollo");
}
```

Export from `frontend/src/features/connectors/index.ts`:
```typescript
export { LEAD_SOURCE_OPTIONS, filterLeadsBySource, type LeadSourceFilter } from "./lib/leadSource";
```

- [ ] **Step 4: Wire the filter into the Scout Lead Stream toolbar**

In the Scout Lead Stream component (market-research), add a `Select` (from `@/components/ui/select`) bound to a `useState<LeadSourceFilter>("all")`, and run the rendered rows through `filterLeadsBySource(...)`. Add a small interaction test asserting that selecting "Apollo only" reduces the visible rows. (Operates on whatever `source` the lead rows currently carry — G6 data-dependency noted.)

- [ ] **Step 5: Run — expect PASS**

Run: `cd frontend && npx vitest run src/features/connectors/lib/__tests__/leadSource.test.ts && npx vitest run src/features/market-research`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/connectors/lib/leadSource.ts frontend/src/features/connectors/lib/__tests__/leadSource.test.ts frontend/src/features/connectors/index.ts frontend/src/features/market-research
git commit -m "feat(fe): source filter (All/CSV/Apollo) on Scout lead stream"
```

---

## Task 14: Source filter on Profiler lead table + Unverified badge

**Files:**
- Create: `frontend/src/features/connectors/components/UnverifiedBadge.tsx` (+ test)
- Modify: `frontend/src/features/connectors/index.ts` (export `UnverifiedBadge`)
- Modify: the Profiler lead table (locate under `features/customers` or `features/mission-control` at task time) — add the same `Select` + `filterLeadsBySource`
- Modify: the Scout `LeadsTable` + Profiler lead row to render `<UnverifiedBadge />` when `email_status === "unverified"`

- [ ] **Step 1: Write failing badge test**

`frontend/src/features/connectors/components/__tests__/UnverifiedBadge.test.tsx`:
```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnverifiedBadge } from "../UnverifiedBadge";

describe("UnverifiedBadge", () => {
  it("renders for unverified", () => {
    render(<UnverifiedBadge emailStatus="unverified" />);
    expect(screen.getByText(/unverified/i)).toBeInTheDocument();
  });
  it("renders nothing for verified or null", () => {
    const { container: c1 } = render(<UnverifiedBadge emailStatus="verified" />);
    expect(c1).toBeEmptyDOMElement();
    const { container: c2 } = render(<UnverifiedBadge emailStatus={null} />);
    expect(c2).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/UnverifiedBadge.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the badge**

`frontend/src/features/connectors/components/UnverifiedBadge.tsx`:
```tsx
import { Badge } from "@/components/ui/badge";

export function UnverifiedBadge({ emailStatus }: { emailStatus?: string | null }) {
  if (emailStatus !== "unverified") return null;
  return (
    <Badge variant="outline" className="text-amber-600 border-amber-300">
      Unverified
    </Badge>
  );
}
```

Export from the barrel:
```typescript
export { UnverifiedBadge } from "./components/UnverifiedBadge";
```

- [ ] **Step 4: Wire badge + Profiler source filter**

- Render `<UnverifiedBadge emailStatus={lead.email_status} />` next to the email/contact cell in the Scout `LeadsTable` and the Profiler lead row.
- Add the source-filter `Select` to the Profiler lead table toolbar (mirror Task 13). Add an interaction test for the Profiler filter.

- [ ] **Step 5: Run — expect PASS**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/UnverifiedBadge.test.tsx && npx vitest run src/features/customers src/features/market-research`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/connectors/components/UnverifiedBadge.tsx frontend/src/features/connectors/components/__tests__/UnverifiedBadge.test.tsx frontend/src/features/connectors/index.ts frontend/src/features/customers frontend/src/features/market-research
git commit -m "feat(fe): unverified badge + Profiler source filter"
```

---

## Task 15: Default MSW handlers + full preflight gate

**Files:**
- Modify: `frontend/src/test/msw/handlers.ts`
- Run: the full preflight chain.

- [ ] **Step 1: Add default Apollo handlers** (so unrelated tests that mount the app shell / tile don't hit `onUnhandledRequest: "error"`)

Append to the `handlers` array in `frontend/src/test/msw/handlers.ts`:
```typescript
http.get("/api/connectors/apollo/status", () =>
  HttpResponse.json({ connected: false, status: "disconnected", credits_consumed_total: 0,
    last_run_credits: 0, low_credit: false, icp_changed_since_last_discovery: false })),
http.get("/api/connectors/apollo/warmup", () =>
  HttpResponse.json({ icp_configured: false, signals_generated: false, scout_completed: false,
    profiler_analyzed: false, ready_count: 0, unlocked: false, missing: [] })),
http.post("/api/connectors/apollo/connect", () =>
  HttpResponse.json({ connected: true, status: "connected" })),
http.post("/api/connectors/apollo/discover", () =>
  HttpResponse.json({ run_id: "mock-run", status: "queued" })),
http.get("/api/connectors/apollo/discover/status", () =>
  HttpResponse.json({ run_id: "mock-run", org_id: "o1", status: "completed", mode: "keep",
    counts: { searched: 0, created: 0, matched: 0, errors: [] }, credits_consumed: 0, progress_percent: 100 })),
```

- [ ] **Step 2: Run the full unit suite**

Run: `cd frontend && npx vitest run`
Expected: PASS (all new + existing). Fix any handler/import mismatches surfaced.

- [ ] **Step 3: Run the preflight gate**

Run: `cd frontend && npm run preflight`
Expected: typecheck, lint, format:check, vitest, build, bundle:check, e2e/VR, knip all green. Common fixes:
- **knip:** if a hook/export is not yet consumed (e.g., `useExportApolloLeads` only used inside the tile), ensure it's imported where used or exported via the barrel only if part of the public surface. Don't add dead barrel exports — knip --strict will flag them.
- **format:check:** run `npx prettier --write` on the new files.
- **e2e/VR:** if a new visual baseline is needed for the Data Sources tab, generate it deliberately and review the snapshot.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/test/msw/handlers.ts
git commit -m "test(fe): default MSW handlers for apollo endpoints + green preflight"
```

---

## Self-Review (run before handoff)

**1. Spec coverage (§6 + AC):**
- §6.1 data layer (warmup/status/discover/discover-status/export hooks) → Tasks 2–5. ✓
- §6.2 tile + connect modal (master-key copy, profile_incomplete deep link) → Tasks 7, 10, 11. ✓
- §6.3 warmup progress + unlock toast → Tasks 8, 12. ✓
- §6.4 discovery flow + tile-state mapping (incl. partial/zero-results sub-states) → Tasks 6, 9, 10. ✓
- §6.5 source filter + unverified badge → Tasks 13, 14. ✓
- §6.6 low-credit warning → Task 10. ✓
- AC5 (unlock gate) enforced by tile state (locked hides Discover) + backend 409/422; AC6 (filter + badge) Tasks 13–14. ✓
- **Gap noted, intentionally out of scope:** exact `[N]` discovery-lead count (G5) and live-lead wiring for the source filter (G6) — both are documented data-dependency seams, not 35b deliverables.

**AC trace (spec §2):** AC1 (run lands ≥1 lead, or `completed_empty` + counts) → tile Complete / zero-results surfaces (T6/T10) reading discover-status counts. AC2/AC3 (credit accounting) → surfaced via status `credits_consumed_total` / `last_run_credits` (T4/T10); enforced backend-side (35a). AC4 (replace no-loss) → backend; FE exposes `mode:"replace"` via the keep/replace prompt (T9). AC5 (gated on `unlocked` + ICP completeness) → tile hides Discover while `locked` (T6/T10); backend 409/422 enforce. AC6 (source filter + unverified badge) → T13/T14. (AC2–AC4 are backend-enforced and not re-implemented in 35b.)

**2. Placeholder scan:** every code step has complete code; component styling follows existing shadcn primitives. Import paths for `@/components/ui/*`, `@/shared/auth` (`useAuth`), and the toast hook are flagged to confirm against the repo at task time — these are verification notes, not placeholders.

**3. Type consistency:** `ApolloTileState` (types.ts) is produced by `deriveApolloTileState` (Task 6) and consumed by `ApolloTile` (Task 10); `DiscoverMode` flows service→hook→dialogs→tile; `LeadSourceFilter` is defined once (Task 13) and reused (Task 14). Contract types (`ApolloStatus`/`ApolloWarmup`/`ApolloDiscoverStatus`) are the single source consumed by services→hooks→components.

**Cross-task ordering & parallelism:** the `index.ts` barrel starts empty and each task appends its own export (see File Structure), so every intermediate commit builds. Serial order 1→15 is safe; these groups may also run in parallel once their dependency lands: **{T2, T3}** after T1; **{T4, T5}** after T3; **{T7, T8, T9}** after T6; **{T13, T14}** once the Scout/Profiler lead tables are located. Keep **T10 → T11 → T12** serial (tile → mount → app-shell).

---

## Execution Handoff

Plan complete and saved to `plans/35b-apollo-discovery-frontend.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, two-stage review (spec then quality) between tasks, fast iteration. (REQUIRED SUB-SKILL: superpowers:subagent-driven-development.)
2. **Inline Execution** — execute tasks in this session with checkpoints. (REQUIRED SUB-SKILL: superpowers:executing-plans.)

Per the repo flow, the plan should also pass `/review-plan` → `/synthesize-plan-review` before implementation.
