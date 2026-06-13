---
synthesizes_review: 35b-apollo-discovery-fe-impl-review-2.md
artifact: 35b-apollo-discovery-fe
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-13
round: 2
---

## Round Recommendation

maybe

Reason: No Critical/High. Round 2 re-reviewed identical code (branch unchanged since round 1) and grew the agreed-fix backlog to 2 Medium + 3 Low (+1 deferred Nit); the productive next step is to APPLY the batch and verify once — not file a round 3 on unchanged code. Whether to invest the batch now or carry it as documented TD and merge at MVP is the operator's call.

## Agreed Findings

- **[Medium · NEW · top priority] Run completion never refreshes `useApolloStatus` → stale re-discovery / keep-replace prompts within a session.** Confirmed: `queryClient` sets `staleTime: 5*60_000` + `refetchOnWindowFocus: false` (`shared/api/queryClient.ts:9,12`); `useDiscover` invalidates `apolloStatus` only at *enqueue* `onSuccess` (`useDiscover.ts:11-14`); `useDiscoverStatus` stops polling at terminal but invalidates nothing (`useDiscoverStatus.ts:20-22`); and `selectDiscoveryPrompt` returns `"none"` when `hasPriorDiscovery` is stale-false (`lib/discoveryPrompt.ts:7`). So the 2nd+ in-session `onDiscoverClick` reads stale `last_discovery_at` / `icp_changed_since_last_discovery` and silently skips both the UC7 re-discovery guard (→ redundant **paid-credit** run, no warning) and the UC5 keep/replace prompt (→ user's replace decision defaults to `keep`). Fix: invalidate `qk.apolloStatus(orgId)` when `useDiscoverStatus` reaches a terminal status (a `useEffect` on `run?.status`, or invalidate on the `refetchInterval` terminal edge). Highest-value fix in the batch — one invalidation, protects credits.
- **[Medium · re-raise] Discovery mutation errors (409/422/5xx) surfaced to nobody.** Round-1 agreed, unapplied (branch unchanged). `launch()` passes only `onSuccess`; the render never reads `discover.isError`/`discover.error`; the documented 409 `discovery_in_progress` / 422 `icp_underspecified` are swallowed and the button just re-enables. Fix: `onError` branching on `code` — `icp_underspecified` → "Widen your ICP" (mirror the `completed_empty` affordance), `discovery_in_progress` → "already running", generic 5xx/network fallback. Add the missing tile-level launch-error test alongside.
- **[Low · NEW] `completed_empty` copy conflates "no one matches" with "found but none contactable".** Confirmed: `ApolloTile.tsx:109-116` always renders "No leads found … Widen your ICP" regardless of `run.counts.searched`, but spec §5.3 (line 171) prescribes two messages — `searched == 0` ⇒ widen-ICP (UC8); `searched > 0` ⇒ "candidates found but none were contactable / passed the gate" (widening is the wrong advice there). `counts.searched` is in the contract (`contracts.ts:44`) and unused. Fix: branch the copy on `run?.counts.searched`. (Note: the spec's tile-state *summary table* at line 278 shows only the single message the impl used; §5.3 is the authoritative, more-correct behavior — this is "honor §5.3," not "impl ignored the spec.")
- **[Low · NEW] Connect network / non-JSON failure mislabeled "Invalid key".** Confirmed: `ApolloConnectModal.tsx:55-60` wraps any non-`ApolloConnectError` into `{httpStatus: 0, detail: "Connection failed"}` (no `code`), and the `error && !error.code` arm (`:112-116`) renders "Invalid key — please check your Apollo account." A network failure / CORS block (`httpStatus === 0`) thus claims the key is invalid when it was never validated. Fix: distinct message for `httpStatus === 0` ("Couldn't reach Apollo — check your connection and try again") vs. an unrecognized server code.
- **[Low · re-raise] Error-state "Retry" re-runs the full prompt-selection flow.** Round-1 agreed, unapplied. `ApolloTile.tsx:141` wires `<Button onClick={onDiscoverClick}>Retry</Button>`, which re-runs `selectDiscoveryPrompt` and can pop guard/keep-replace instead of retrying. Fix: error branch calls `launch(lastUsedMode ?? "keep")` directly.

## Disagreed Findings

(None new this round. The reviewer correctly did not re-raise round-1 disagreed items — connect/export raw-`fetch` bypass (G1/G2 + JWT YAGNI), unlock-toast "first observed" semantics (intended G4), Firebase `isSupported()` guard (justified ride-along) — which stand as decided in synthesis-1.)

## Deferred Findings

- **[Nit · NEW] `filterLeadsBySource` memoized in Profiler (`LeadStream.tsx:508`) but inline in Scout (`LeadsTable.tsx:530`).** Confirmed inconsistency, but no current impact — the filter is cheap and both tables run on mock-backed demo leads (the tracked G6 live-data dependency). The reviewer themselves ties the alignment to "before live leads land." Defer to the G6 live-data wiring, where both tables get revisited and memoization actually matters; trigger = live lead rows replace the demo data. (One-line `useMemo` wrap if bundled with the batch instead — author's call.)
- **(Carry-forward)** Round-1 deferrals remain consciously-accepted TD, not relitigated: tile run-state not surviving reload (plan-compliant `!!runId` gate; distinct from Finding 1, which is about `apolloStatus` not refreshing mid-session); the four `as ZodType<T>` service casts; cross-tab race on the unlock dedupe flag.

## Severity Disagreements

- **Discovery mutation errors (re-raise) — Medium → effectively Low at MVP** (carry-forward from synthesis-1): warmup-gating requires a complete ICP before discovery unlocks, shrinking the post-unlock `icp_underspecified` (422) surface, and `discovery_in_progress` (409) needs a deliberate double-launch. Real and worth fixing, but a UX dead-end rather than a Medium-grade correctness defect at current scale.
- **Status staleness (Finding 1) — keeping Medium, flagging as top priority.** Not elevating to High (it self-heals on reload / after the 5-min `staleTime`, requires two discoveries in one session, and the bypassed UC5 default — `keep` — is non-destructive), but it is the highest-value fix in the batch because the bypassed UC7 guard exists specifically to prevent redundant paid-credit burn.

## Open Questions

- **Apply-the-batch vs. merge-with-TD.** Two rounds on unchanged code have produced 2 Medium + 3 Low agreed fixes. Does the operator invest one fix-batch pass (then a single verification review) before merging, or accept the batch as documented fast-follow TD and merge the green branch now? This is the cost/benefit call behind the "maybe."
- **Do not file a round 3 on unchanged code.** If the answer is "merge now," close the loop with a TD entry rather than another review round; if "fix now," re-review once *after* the batch lands. Either way, a third review of the current (identical) diff would add nothing.
