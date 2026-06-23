---
artifact: specs/40-apollo-connection-management-design.md
artifact_type: spec
verdict: findings
reviewer_model: glm-5.2
date: 2026-06-22
round: 1
---

## Context

Grounding was checked against `master`: the backend router/service/credentials layer
(`app/routers/connectors.py`, `app/services/connectors/orchestrator.py`,
`app/services/connectors/credentials.py`, `app/models/connectors.py`) and the frontend
data/tile/modal layer (`features/connectors/**`). The load-bearing backend claims (upsert
on connect, idempotent delete, no key material on status, `DisconnectResponse{status,message}`,
the profile gate applying to updates) and the FE wiring claims (the credential-error button
calling `launch("keep")`, the shared `onConnected` handler, `qk.apolloStatus` invalidation)
were all verified accurate — see Observations. Findings below are about provenance,
under-specified coordination, and precision of recommendation, not about the verified
technical core.

## Findings

### [High] Reference-design citation is broken on both named paths and unsourceable

**Location:** Opening blockquote (lines 9-13); §12 "Divergences from the 2026-06-04
reference design (§4)" (lines 248-258); §13 Q1 (lines 262-263).

The spec claims to "Realize §4 ('Apollo Tile States' → settings/gear → *Update API key* /
*Disconnect Apollo*) of the product team's 2026-06-04 frontend design" and attributes it to
`docs/temp/apollo-integration-design-spec.md`, "the same design Spec 35 cited as
`specs/2026-06-04-apollo-integration-design.md`". Neither path holds that content:

- `docs/temp/` does not exist in the repo at all (glob `docs/temp/**` → no files).
- `specs/2026-06-04-apollo-integration-design.md` exists but is the **original** Apollo
  integration design (UC1-UC10, connect + warmup + discovery). A repo-wide search for the
  quoted reference phrases — `3a9f`, `pre-filled masked`, `gear`, `Update API key` /
  `Disconnect Apollo` as a §4 tile-states construct — returns matches **only inside this spec
  itself** (line 250 and the §5/§12/§13 self-quotes). The reference doc has exactly one
  "settings" mention, an unrelated "Where do I find my API key?" helper link (line 50).

So §12's central divergence ("the reference says *pre-filled masked (e.g. `••••••••3a9f`)*;
we diverge") and §13 Q1 lean on quotes from a document that cannot be located. For a
frozen-record-of-intent spec this is a verifiable factual defect: a future reader/agent sent
to "the 2026-06-04 design §4" will find nothing.

The underlying **decision survives on its own merits** — I independently confirmed the
backend returns no key material (`get_apollo_status`, orchestrator.py:71-92, reads only
`connected_at`/`status`/`low_credit`, never `api_key`), so an empty update field is correct
regardless of the reference. Fix: either restore/locate the actual reference doc and correct
both paths, or drop the phantom citation and reframe §12/Q1 on the self-evident "backend
exposes no key material → no masked prefill is possible" rationale that §3.3 already
establishes.

### [Medium] Disconnect-during-running rationale omits the concrete consequence (continued credit spend + post-disconnect ingestion)

**Location:** §9 "Disconnect during a `running` discovery" (lines 216-218); §11
"Run cancellation on disconnect-during-running" (line 245).

The deferral is framed around run non-durability ("in-process `BackgroundTasks`, already
non-durable across restarts") and the harmless UI flip ("status refetch flips the tile to
disconnected"). It does not state the salient ramification a disconnecting user cares about:
`_run_discover` fetches the key once at start (`api_key = credentials.get_api_key(...)`,
orchestrator.py:344) and holds it in memory, so deleting the credential doc does **not** stop
the in-flight run — it keeps revealing/ingesting leads and **keeps spending the user's Apollo
credits** until it completes. (The run's later `set_low_credit`/`set_status` calls are then
silent no-ops on the deleted doc, since both use no-upsert `update_one` — credentials.py:82-93,
so no doc resurrection. That part is safe; the credit spend is the real gap.)

For a user who disconnects specifically to stop using Apollo / control spend, "best-effort,
not guarded" undersells what actually happens. Either state the credit-spend + continued-
ingestion consequence plainly so the MVP deferral is an informed one, or surface it (dialog
copy / a TD-FE entry) — §11 already reserves a slot for hardening this.

### [Low] Tile-local state coordination on disconnect is under-specified

**Location:** §5.5 "Tile state machine — deliberately unchanged" (lines 137-142); §6
`ApolloTile.tsx` row (line 153).

The spec repeatedly asserts "blast radius minimal" and that disconnect "simply flips
`status.connected → false`", but does not enumerate the tile-local side effects the disconnect
success path must perform. Concretely: if a run is in flight when the user disconnects,
`runId` is still set and `useDiscoverStatus` keeps polling every 2.5s after the tile has
flipped to `disconnected` (useDiscoverStatus.ts:19-22, `enabled: !!orgId && !!runId`,
`refetchInterval` while non-terminal) — invisible to the user (the `disconnected` tileState
short-circuits before the running branch) but wasted requests, and on the run's eventual
terminal status it fires an `apolloStatus` invalidation (useDiscoverStatus.ts:30-34) for a
now-disconnected org.

The spec should add a one-liner: on disconnect success, clear discovery-local state —
`setRunId(null)` (and `setPrompt("none")`) — mirroring the existing `launch` clear at
ApolloTile.tsx:61. This is exactly the kind of small wiring the "minimal blast radius"
framing risks hiding.

### [Low] Update-success toast branching on the shared `onConnected` callback is implied, not stated

**Location:** §6 `ApolloTile.tsx` row (line 153); §7 "Update key needs no new hook" (lines
199-200).

The spec says the tile fires "the update-success toast (connect mode keeps today's no-toast
behavior)". But the modal calls a single `onConnected()` for both modes (ApolloConnectModal.tsx:54),
and today's tile `onConnected` handler only closes + refetches status with no toast
(ApolloTile.tsx:188-191). So the mode-aware toast must be decided in the **tile** by reading
its own modal-state value inside that shared callback. This is implementable (the tile owns the
new `modal: "none" | "connect" | "update"` state, §6) but never stated, so an implementer could
just as easily attach the toast to the modal (which has no toast policy) or omit it. Make the
wiring explicit: the shared `onConnected` inspects the tile's current modal mode and toasts only
on `"update"`.

### [Low] `disconnectApollo` transport recommendation is imprecise and mis-motivated

**Location:** §7 Data layer — service code block + transport note (lines 164-175).

The snippet names `apiDelete` (which does not exist in `@/shared/api/client`) and recommends
falling back to "raw `fetch(buildApiUrl(...))` … matching the raw-fetch precedent in
`connectApollo`/`startApolloDiscover`". That precedent exists for a specific, inapplicable
reason: those two use raw fetch so they can parse the error JSON body into typed errors
(`ApolloConnectError`/`ApolloDiscoverError`, G1 — see their docstrings). `disconnectApollo`
branches on no error code (§9 treats any failure as a generic retry toast), so it has no need
for raw-fetch error parsing. The idiomatic shared-client option —
`apiRequest(endpoint, schema, { method: "DELETE" })` (client.ts:12-22, the same primitive
`apiGet`/`apiPost` build on, which routes through the rate limiter and JWT injection) — is the
cleaner choice and is not mentioned. The spec does hedge ("or raw fetch if no apiDelete helper
exists … The plan resolves which"), so this is precision, not correctness: name `apiRequest`
as the preferred path and drop the misleading "match the raw-fetch precedent" motivation.

### [Low] No consolidated acceptance criteria / definition-of-done

**Location:** §4 Goals (lines 77-82); §10 Testing (lines 222-236).

§4 (goals) and §10 (advisory tests) together functionally cover pass/fail, but there is no
single AC list the plan/impl checks against. A short AC block (e.g., "Given connected, when
gear → *Update API key* → enter new key → *Update* → 200, then status refetches, the stored
key is overwritten, and the 'Apollo key updated.' toast fires; gear is absent in
`disconnected`; credential-`error` shows *Update API key* not *Retry*; disconnect confirm
returns the tile to `disconnected` and preserves Apollo-sourced leads") would let §10 tests map
1:1 to behaviors and give the plan an unambiguous exit gate.

## Observations (no action)

- **Verified true** — "replace key = POST /connect again overwrites": `connect_apollo` →
  `save_credentials` does `update_one({org_id,provider}, {$set:{api_key,…}, $setOnInsert:{connected_at}}, upsert=True)` (orchestrator.py:67; credentials.py:44-65). New key overwrites the old.
- **Verified true** — "same two-check validation on update": the profile-completeness gate
  (orchestrator.py:53-56) and master-key probe (orchestrator.py:59-65) run unconditionally on
  every connect, so they apply to updates; the spec's §9/§13 "accepted" stance is accurate.
- **Verified true** — disconnect deletes only the Mongo credential doc and is idempotent 200 on
  0-match (`disconnect_apollo` → `delete_credentials` returns `bool(deleted_count)`, no raise;
  orchestrator.py:116-121, credentials.py:96-98). Neo4j leads untouched.
- **Verified true** — `GET /status` returns no key material (orchestrator.py:71-92); Q1's
  empty-field decision is sound independent of the broken citation.
- **Verified true** — `DisconnectResponse` Pydantic model is `{status: str, message: str}`
  (models/connectors.py:32-34), matching the proposed `DisconnectResponseSchema` exactly.
- **Verified true** — the credential-error fix is well-grounded: the `error` tile already keys
  body copy off `status?.status === "error"` (ApolloTile.tsx:174-176) and the current button
  does call `launch("keep")` (ApolloTile.tsx:179), so §5.4's branch is a minimal, correct change.
- **Verified true** — `DataSourcesManager.apollo.test.tsx` (the §10 mount-point test) exists
  (mission-control/components/data-sources/__tests__/).
- **Verified true** — `index.ts` exports can stay unchanged; all new components are
  `ApolloTile`-internal (index.ts exports only `ApolloTile`, `useApolloUnlockToast`,
  lead-source helpers, and the two badges — none touched).
- **Scope discipline** — the spec is appropriately lean (frontend-only, no backend, no masked
  prefill, no run-cancellation, no OAuth) with well-articulated non-goals (§4) and out-of-scope
  (§11). No overengineering or gold-plating detected.
