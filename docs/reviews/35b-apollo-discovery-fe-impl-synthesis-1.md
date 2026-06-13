---
synthesizes_review: 35b-apollo-discovery-fe-impl-review-1.md
artifact: 35b-apollo-discovery-fe
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-13
round: 1
---

## Round Recommendation

maybe

Reason: No Critical/High findings. The two Mediums are a plan-compliant deferral (tile run-state across reload) and a spec-desirable enhancement beyond the plan's explicit component scope (discover-error surfacing); everything else is Low/Nit. Whether to run a round 2 is a genuine MVP cost/benefit call — apply the two agreed fixes and re-review, or carry them as documented TD and merge. Operator judges.

## Agreed Findings

- **[Medium] Discovery mutation errors (409/422/5xx) surfaced to nobody** — `ApolloTile.launch()` passes only `onSuccess` to `discover.mutate`, and the render never reads `discover.isError`/`discover.error`. Confirmed against the code. The `/discover` 409 (`discovery_in_progress`) / 422 (`icp_underspecified`) contract is documented in the plan (line 22), and the plan tested that the *service* throws on 409 (line 404) — but it never wired a consumer, so the thrown error is swallowed and the button silently re-enables (`disabled={discover.isPending}` only). Fix: add an `onError` (or read `discover.isError`) that branches on the error `code` and surfaces a toast / inline message — at minimum for `icp_underspecified` (point the user at "Widen your ICP", mirroring the existing `completed_empty` affordance) and `discovery_in_progress`, with a generic fallback for 5xx/network. Note this is an enhancement beyond the plan's explicit component scope, motivated by spec §5.2/§5.9 (see Severity Disagreements for the MVP severity read).
- **[Low] Error-state "Retry" re-runs the full prompt-selection flow** — confirmed: the `error` branch wires `<Button onClick={onDiscoverClick}>Retry</Button>`, and `onDiscoverClick` re-runs `selectDiscoveryPrompt(...)`, so for a user with a prior discovery + changed ICP, "Retry" pops the guard / keep-replace dialog instead of retrying. Fix: have the error branch call `launch("keep")` (or the last-used mode) directly so "Retry" re-runs non-destructively rather than re-opening the decision tree.

## Disagreed Findings

- **[Low] `connectApollo` and the export path bypass the rate limiter and JWT injection** — the raw `fetch` in `connectApollo` is the deliberate **G1** design (route around `apiPost`+zod so the typed error JSON body — `code`/`missing_section` — can be parsed and surfaced as `ApolloConnectError`), and `apolloLeadsExportUrl` is the deliberate **G2** design (raw-bytes endpoint → anchor download, no JSON envelope to validate). Both functions already carry explanatory comments naming G1/G2, so the "add a comment making the bypass explicit" suggestion is already satisfied. The JWT-injection half is YAGNI for this codebase: per CLAUDE.md's "Auth reality check" the backend does not validate the bearer token (every endpoint trusts `org_id`/`user_id` params), and the MVP posture is to neither add nor harden auth at 0 users. No rate-limit exposure at MVP either — connect is bounded by the modal's submit-disable, export is a single user-initiated download. No action.
- **[Nit] Unlock toast fires on "first observed unlocked," not the strict Locked→Unlocked edge** — this is the intended **G4** semantics, not a slip. Plan §G4 specifies "fire once per org … survive remount/reload" via the `apollo_unlock_notified:<orgId>` localStorage flag; the per-org dedupe is precisely what *replaces* cross-mount edge-tracking (which can't survive a reload anyway). The reviewer concedes the test suite encodes this and "it appears deliberate." Not a defect.
- **[Nit] Firebase `isSupported()` guard is out of Apollo scope** — accurate that it's outside spec 35, but it's a justified ride-along: it resolves the pre-existing Firebase-analytics teardown flake (`window is not defined` post-teardown → vitest exit 1 despite all-pass) that the new app-shell `ApolloUnlockWatcher` mount exercises across more test files. It ships in its own commit (hygiene intact) and the reviewer marks it "Acceptable as-is." No action.

## Deferred Findings

- **[Medium] Tile run-state does not survive reload (latest-run not tracked)** — confirmed: `runId` is `useState<string|null>(null)` and `useDiscoverStatus` is `enabled: !!orgId && !!runId`, so on mount/reload `run` is `undefined` and `deriveApolloTileState` collapses to `unlocked`. This is **plan-compliant** — the plan specified the `!!runId` gate (reviewer concurs it's a plan-vs-spec gap, not an impl slip) — but it undercuts spec §6.4's "derive tile state from the latest run" model (a refresh loses Running / `completed_empty` / `partial` messaging; a run started elsewhere is invisible). Deferring as a **conscious call** at 0-user MVP, not an accident: the service layer already supports `fetchApolloDiscoverStatus(orgId, null)` → latest-run, so the fix is small (seed `runId`/latest-run from a mount-time read + persist the in-flight id in `sessionStorage`). Log as a new TD-FE entry; trigger = first real users or routine multi-tab/refresh usage.
- **[Low] zod schemas force-cast `as ZodType<T>`** — the smell is real (the four casts defeat the schema↔`z.infer` compile check), but the reviewer's suggested `satisfies ZodType<T>` remedy most likely **reproduces the exact compile error the cast exists to suppress**: the schemas use `.passthrough()`/`.default()`, whose inferred output type is not structurally assignable to `ZodType<ExactContractType>`, and `satisfies` performs the same assignability check `as` is overriding — so it would fail identically. The genuine fix is to align the hand-authored contract type with the schema's inferred output (let `z.infer` flow through `apiGet<T>`), a small contract refactor. Defer as Low TD; verify the `satisfies`-vs-`as` behavior with a `tsc` check when scheduled.
- **[Nit] Cross-tab race on the unlock dedupe flag** — real but best-effort by design (`localStorage` has no atomic check-and-set, so two simultaneous cold mounts could double-fire). Trivial at MVP where one operator per org is the norm. Defer; trigger = multi-seat-per-org becomes common.

## Severity Disagreements

- **Discovery mutation errors surfaced to nobody — Medium → effectively Low at MVP.** Agreeing it's real and worth fixing, but the severity is softened by two facts: (1) discovery only unlocks *after* the warmup readiness gate, which already requires a sufficiently complete ICP, shrinking the post-unlock `icp_underspecified` (422) surface; and (2) `discovery_in_progress` (409) requires a deliberate double-launch. Neither loses data nor crashes. So this is a UX dead-end on a primary action (worth surfacing) rather than a Medium-grade correctness defect at current scale.

## Open Questions

- **Ship-or-iterate for the two agreed fixes.** Given the branch is already full-preflight-green and the operator has previously deferred the merge, do the discover-error surfacing (agreed Medium) + Retry-behavior (agreed Low) fixes land in a round-2 pass before merge, or get carried as documented fast-follow TD and merged now? This is the operator cost/benefit call that drives the "maybe" recommendation.
- **`satisfies` viability for Finding 4.** The claim that `satisfies ZodType<T>` reproduces the original compile error is reasoned, not compiled — worth a 2-minute `tsc --noEmit` confirmation when the contract-alignment cleanup is actually scheduled.
