---
artifact: 35b-apollo-discovery-fe
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-13
round: 2
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

- Operator-supplied branch `35b-apollo-discovery-fe` has no local ref; the actual git branch is
  `worktree-35b-apollo-discovery-fe`. Diff reviewed: `git diff master...worktree-35b-apollo-discovery-fe`
  (48 files, +2424/-9) — **identical to round 1**. The branch has not changed since round 1 was filed.
- This is round 2. Round 1 (`35b-apollo-discovery-fe-impl-review-1.md` + synthesis-1) already ran.
  - **Two round-1 agreed fixes were NOT applied** and are re-raised below: discovery-mutation error
    surfacing (Medium) and error-state "Retry" behavior (Low).
  - **Round-1 deferred items remain as consciously-accepted TD and are NOT relitigated here:**
    tile run-state not surviving reload (deferred TD, plan-compliant `!!runId` gate); the four
    `as ZodType<T>` service casts (deferred TD); cross-tab race on the unlock dedupe flag (deferred).
  - **Round-1 disagreed items are not re-raised** (confirmed still as decided): connect/export
    raw-`fetch` bypass of the limiter/JWT (deliberate G1/G2, backend doesn't validate JWT);
    unlock-toast "first observed unlocked" semantics (intended G4); Firebase `isSupported()` guard
    (justified ride-along for the app-shell mount).
- Preflight (`npm run preflight`) was **not** run this session; green status is asserted only from
  committed history. Round 2's value-add is one new Medium (post-completion status staleness) and
  two new Lows not caught in round 1.

## Findings

### [Medium] Run completion never refreshes `useApolloStatus` — re-discovery / keep-replace prompts go stale within a session

**Location:** `frontend/src/features/connectors/hooks/useDiscover.ts:11-14`; `frontend/src/features/connectors/hooks/useDiscoverStatus.ts:14-22`; `frontend/src/shared/api/queryClient.ts:9,12`; consumed at `frontend/src/features/connectors/components/ApolloTile.tsx:62-69`.

`useApolloStatus` is invalidated in exactly one place — `useDiscover`'s `onSuccess` — which fires at
**enqueue** (status still `queued`), not when the run **completes**. `useDiscoverStatus` stops polling
once the run reaches a terminal status but invalidates nothing. With the global client set to
`staleTime: 5 * 60_000` and `refetchOnWindowFocus: false`, the cached `status` (carrying
`last_discovery_at` and `icp_changed_since_last_discovery`) stays stale for up to 5 minutes after a
run finishes — within an active session.

Consequence: the *second and subsequent* `onDiscoverClick()` calls compute `selectDiscoveryPrompt()`
from a stale `hasPriorDiscovery` / `icpChanged` (`ApolloTile.tsx:63-66` reads `status?.last_discovery_at`
and `status?.icp_changed_since_last_discovery`). So, within a session after the first discovery:
- UC7's re-discovery guard (ICP unchanged) is skipped — the user can launch a redundant, credit-burning run with no warning.
- UC5's keep/replace/download prompt (ICP changed) is skipped — a user who changed their ICP and wants
  `replace` silently gets the `keep` default, a real user decision bypassed.

It self-heals on full reload (status refetches fresh) or after the 5-min `staleTime`, so it is
session-scoped, not permanent. Distinct from round 1's reload-runId finding (which is about
`runId` being null on mount); this is about `apolloStatus` not refreshing when a run *completes* in an
already-mounted session. Fix: invalidate `qk.apolloStatus(orgId)` when `discoverStatus` transitions to a
terminal status (a `useEffect` on `run?.status`, or an invalidate inside the `refetchInterval` terminal
edge), so `last_discovery_at` / `icp_changed` refresh before the next click.

### [Medium] Discovery mutation errors (409 / 422 / 5xx) still surfaced to nobody — round-1 agreed, unaddressed

**Location:** `frontend/src/features/connectors/components/ApolloTile.tsx:56-60` (`launch()`), `:122` (button `disabled={discover.isPending}` only); `frontend/src/features/connectors/hooks/useDiscover.ts:9-16`.

Re-raising from round 1 (agreed in synthesis-1, not applied — the branch is unchanged). `launch()` still
passes only `onSuccess` to `discover.mutate(...)`, and the render never reads `discover.isError` /
`discover.error`. The `/discover` endpoint's documented `409 {code:"discovery_in_progress"}` and
`422 {code:"icp_underspecified"}` (plan contract table line 22; spec §5.2/§5.9) are silently swallowed:
the prompt already closed (`setPrompt("none")` before `mutate`), the button silently re-enables, and the
user gets no feedback. This interacts with the previous finding and round 1's reload-runId gap — a
server-side in-progress run (invisible to a freshly-mounted tile) plus an unhandled 409 means a
double-launch attempt produces zero UI response. Note: the *service* throws on 409 (tested at
`services/__tests__/apollo.test.ts`), but no consumer wires it to UI; there is also no tile-level test
for the launch error path. Fix: an `onError` (or reading `discover.isError`) that branches on the error
`code` — at minimum `icp_underspecified` (deep-link "Widen your ICP", mirroring the existing
`completed_empty` affordance) and `discovery_in_progress`, with a generic 5xx/network fallback.

### [Low] `completed_empty` copy conflates "no one matches" with "found but none contactable"

**Location:** `frontend/src/features/connectors/components/ApolloTile.tsx:109-116`.

The `complete_empty` branch always renders "No leads found for your current ICP. Widen your ICP",
ignoring `run.counts.searched`. Spec §5.3 prescribes two distinct messages: `searched == 0` ⇒ "no one in
Apollo matches this ICP — widen it"; `searched > 0` but nothing landed ⇒ "candidates were found but none
were contactable / passed the gate." When `searched > 0`, widening the ICP is the wrong advice (the ICP
*did* match people; the reveal/quality-gate is what failed). The data is already in hand
(`run?.counts.searched`) and unused. (The `ApolloTile.test.tsx` `completed_empty` case uses
`searched: 80`, so the test cannot catch the distinction.)

### [Low] Connect network / non-JSON failure is mislabeled "Invalid key"

**Location:** `frontend/src/features/connectors/components/ApolloConnectModal.tsx:55-60` (catch) and `:112-116` (the `error && !error.code` branch); `frontend/src/features/connectors/services/apollo.ts:112-128`.

`handleConnect` wraps any non-`ApolloConnectError` into `{ httpStatus: 0, detail: "Connection failed" }`
with no `code`. The render's `error && !error.code` arm then shows "Invalid key — please check your
Apollo account." So a network failure, a CORS block, or a backend 400-invalid-key-without-`code` all
produce the identical "Invalid key" message. The `httpStatus === 0` (network) case is genuinely
misleading — the key was never validated. Suggest a distinct fallback for `httpStatus === 0`
("Couldn't reach Apollo — check your connection and try again") vs. an unrecognized server code.

### [Low] Error-state "Retry" still re-runs the full prompt-selection flow — round-1 agreed, unaddressed

**Location:** `frontend/src/features/connectors/components/ApolloTile.tsx:141` (`<Button onClick={onDiscoverClick}>Retry</Button>`).

Re-raising from round 1 (agreed, not applied). The error branch wires `onDiscoverClick`, which re-runs
`selectDiscoveryPrompt(...)`. For a user with a prior discovery and a changed ICP, pressing "Retry"
after a failed run pops the keep/replace/download dialog (or the re-discovery guard) instead of simply
retrying — surprising for an affordance labeled "Retry." Fix: have the error branch call
`launch(lastUsedMode ?? "keep")` directly so "Retry" re-runs non-destructively.

### [Nit] `filterLeadsBySource` is memoized in the Profiler table but not the Scout table

**Location:** `frontend/src/features/market-research/components/lead-stream/LeadsTable.tsx:527-529`
(inline `const filteredLeads = filterLeadsBySource(tierFiltered, sourceFilter)`) vs.
`frontend/src/features/customers/components/lead-stream/LeadStream.tsx:508-511` (wrapped in `useMemo`).

The two source-filter wirings are inconsistent: the Scout `LeadsTable` recomputes the filter on every
render, while the Profiler `LeadStream` memoizes it. Cheap on the current mock-backed lead sets, but
worth aligning (wrap the Scout call in `useMemo`) before live leads land — tracked data-dependency G6.
