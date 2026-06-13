---
artifact: 35b-apollo-discovery-fe
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-13
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

- The operator-supplied branch `35b-apollo-discovery-fe` has no local ref; the actual git
  branch is `worktree-35b-apollo-discovery-fe`. The diff below is `git diff master...worktree-35b-apollo-discovery-fe`.
- This is a static review of the aggregate net change (48 files, +2424/-9). The preflight
  gate (`npm run preflight`) was **not** executed in this session — typecheck/lint/build/test
  passing is asserted only from the committed history, not independently verified.
- Spec = `specs/35-apollo-discovery-design.md` (cross-stack design; this branch is the FE
  half). Plan = `plans/35b-apollo-discovery-frontend.md` (15 tasks). Both loaded for adherence.
- The implementation closely follows the plan (all 15 tasks land: scaffold + contracts,
  services, read/discovery hooks, connect+export, tile-state + prompt logic, connect modal,
  warmup progress, discovery dialogs, tile, Mission Control mount, app-shell unlock toast,
  Scout + Profiler source filters, unverified badge, MSW defaults). Documented seams G5
  (no hard `[N]` lead count) and G6 (source filter rides mock-backed demo leads) are present
  and honestly noted, as expected. AC5 (unlock gate) and AC6 (filter + badge) are satisfied
  on the FE side; AC1–AC4 are backend-enforced (35a).

## Findings

### [Medium] Discovery mutation errors (409 / 422 / 5xx) are surfaced to nobody

**Location:** `frontend/src/features/connectors/components/ApolloTile.tsx` — `launch()` and `onDiscoverClick()`; `useDiscover.ts`.

`launch()` calls `discover.mutate({ orgId, userId, mode }, { onSuccess: (r) => setRunId(r.run_id) })`
with no `onError`, and `discover.error` / `discover.isError` is never read in the render.
The `/discover` endpoint explicitly returns `409 {code:"discovery_in_progress"}` and
`422 {code:"icp_underspecified"}` (plan contract table + spec §5.2/§5.9). On any of these the
prompt has already closed (`setPrompt("none")` runs before `mutate`), the button silently
re-enables, and the user gets zero feedback.

The most consequential case is `422 icp_underspecified` — a *spec-called-out, expected*
condition that must tell the user to widen their ICP (the `completed_empty` zero-results copy
even links to "Widen your ICP"). Here the FE shows nothing instead. A failed run (5xx /
network) is likewise silent. Recommend an `onError` (or reading `discover.isError`) that
branches on the error `code` and surfaces a toast / inline message, at minimum for
`discovery_in_progress` and `icp_underspecified`.

### [Medium] Tile run-state does not survive reload — the "latest run" is not actually tracked

**Location:** `frontend/src/features/connectors/components/ApolloTile.tsx` (`const [runId, setRunId] = useState<string | null>(null)`); `frontend/src/features/connectors/hooks/useDiscoverStatus.ts`.

Spec §6.4 derives the tile states Running / Complete / Complete·empty / Complete·partial / Error
from the **latest run**. The implementation keys `useDiscoverStatus(orgId, runId)` on an
in-memory `runId` that initializes to `null`, and the hook is `enabled: !!orgId && !!runId` —
so on any mount/reload `runId` is null, the hook is disabled, and `deriveApolloTileState`
receives `run === undefined`, collapsing the tile to `unlocked` regardless of backend reality.

Consequences:
- A discovery run in progress (started in another tab/session, or surviving a nav within the
  app after a state reset) is invisible — the tile shows an enabled "Discover Leads" and the
  user can attempt a second launch (caught only by the backend `409` — which is itself then
  swallowed by the previous finding).
- After a refresh, the Complete / `completed_empty` (widen-ICP) / `partial` (interrupted
  banner) messaging is all lost — the user sees a plain "Discover Leads" button with no record
  of the prior result.

The backend supports fetching the latest run by org (`GET /discover/status?org_id` with
`run_id` optional per the contract table), but the FE never requests it on mount. The plan
itself specified the `!!runId` gate, so this is a plan-vs-spec gap rather than an impl slip —
but it materially undercuts the spec's tile-state model. (May be judged acceptable at 0-user
MVP, but it should be a conscious call, not an accident.) Suggestion: seed `runId`/latest-run
from a `useDiscoverStatus(orgId, null)` fetch on mount (or a dedicated "latest run" read) and
persist the in-flight run id across reloads (e.g. `sessionStorage`) so the running state
survives a refresh.

### [Low] `connectApollo` and the export path bypass the shared rate limiter and JWT injection

**Location:** `frontend/src/features/connectors/services/apollo.ts` — `connectApollo()` (raw `fetch(buildApiUrl(...))`), `apolloLeadsExportUrl()`.

Every normal call routes through `apiGet`/`apiPost` → `apiRequest` → `rateLimiter.executeWithRateLimit` + `apiFetch` (JWT-injecting). `connectApollo` uses a bare `fetch` (justified by G1 to parse the
error JSON body) and the export path is a plain anchor download, so neither is rate-limited nor
carries the `Authorization` header. Per AGENTS.md the backend does not validate the JWT today,
so this is functionally correct now; the inconsistency is forward-looking — if/when auth is
enforced, connect/export will silently break while the rest of the app works. The connect path
is partly mitigated by the modal disabling the button while submitting (so spam is bounded).
Worth a code comment making the deliberate bypass explicit, or routing connect through a
non-throwing helper that still injects the JWT + limiter.

### [Low] zod schemas are force-cast `as ZodType<T>` at the service boundary

**Location:** `frontend/src/features/connectors/services/apollo.ts` — four casts:
`ApolloStatusSchema as ZodType<ApolloStatus>`, and the warmup / discover-response /
discover-status analogues.

The `as ZodType<T>` assertions defeat the compiler's schema↔inferred-type check; if a zod
schema drifts from its `z.infer` type (e.g. a field retyped without updating the contract), the
mismatch is hidden rather than caught at compile time. The schemas are correct today, so this
is a maintainability smell, not an active bug. Prefer letting the inferred type flow through
`apiGet<T>(endpoint, schema)` without the cast, or use `schema satisfies ZodType<T>` to keep a
compile-time check while satisfying the signature.

### [Low] Error-state "Retry" re-runs the full prompt-selection flow

**Location:** `frontend/src/features/connectors/components/ApolloTile.tsx` — `tileState === "error"` branch (`<Button onClick={onDiscoverClick}>Retry</Button>`).

The Retry button calls `onDiscoverClick`, which re-runs `selectDiscoveryPrompt(...)`. For a
user with a prior discovery and a changed ICP, pressing "Retry" after a failed run pops the
keep/replace/download dialog (or the re-discovery guard) rather than simply re-running —
slightly surprising for an affordance labelled "Retry". Consider having the error branch call
`launch(...)` with the last-used mode (or a plain keep) directly.

### [Nit] Unlock toast fires on "first observed unlocked," not strictly the Locked→Unlocked edge

**Location:** `frontend/src/features/connectors/hooks/useApolloUnlockToast.ts`.

Spec §6.3 says the toast "fires on the Locked→Unlocked edge." The effect fires whenever
`connected && warmup.unlocked && !localStorage[flag]`, including on a fresh mount while already
unlocked (e.g. a user who returns after warmup completed but before the per-org flag was set).
The localStorage dedupe still caps it to once per org, so behaviour is "notify once per org when
unlock is first observed" — close to intent, not a bug. (The test suite reflects this semantics,
so it appears deliberate.)

### [Nit] Unrelated change: Firebase `isSupported()` guard is outside the Apollo feature scope

**Location:** `frontend/src/shared/auth/firebase.ts`.

The analytics `isSupported()` guard is a test/SSR-environment fix, not part of spec 35. It is a
legitimate small fix (likely surfaced by the new app-shell `ApolloUnlockWatcher` mount being
exercised in more tests) and ships in its own commit, so commit hygiene is intact — flagged only
as scope creep relative to the spec. Acceptable as-is.

### [Nit] Cross-tab race on the unlock dedupe flag

**Location:** `frontend/src/features/connectors/hooks/useApolloUnlockToast.ts`.

Two tabs mounting simultaneously before either writes `apollo_unlock_notified:<orgId>` could
each pass the `getItem` check and both fire the toast; `localStorage` has no cross-tab atomic
check-and-set. Trivial at MVP (one operator per org is the norm); the dedupe is best-effort.
