# Apollo Connection Management: Update Key + Disconnect — Design Spec

**Date:** 2026-06-23
**Spec:** 40 (pairs with `plans/40-apollo-connection-management.md`)
**Branch:** `40-apollo-connection-management`
**Status:** Design intent (output of brainstorming)
**Scope:** Frontend only (`frontend/src/features/connectors`)

> Closes a gap left by Spec 35 (`specs/35-apollo-discovery-design.md`), which shipped the Apollo
> connect + warmup + discovery surface but **deferred post-connection key management** (changing or
> removing the key after connecting). The settings/gear → *Update API key* / *Disconnect Apollo*
> affordances trace to the product team's 2026-06-04 Apollo frontend design, which was supplied to
> the author as a **working-tree reference doc that is not committed to the repo** — so it is named
> here for lineage only, not as a locatable source. (The committed
> `specs/2026-06-04-apollo-integration-design.md` is the earlier UC1–UC10 design and does **not**
> contain these key-management affordances.) Every design choice below stands on the verified current
> backend/frontend contract (§3), independent of that reference.

---

## 1. Problem

Once Apollo is connected, a user has **no way to change the key or disconnect**. Concretely, in the
shipped feature (Spec 35, `features/connectors`):

- `ApolloTile.tsx` renders the **"Connect Apollo"** button **only** in the `disconnected` state. In
  every connected state (`locked`, `unlocked`, `running`, `complete*`, `error`) there is no gear, no
  "manage", no way to reopen the connect modal, and no disconnect control.
- `services/apollo.ts` exposes `connectApollo` but **no `disconnectApollo`** — nothing in the
  frontend calls the existing `DELETE /connectors/apollo/connect` route.
- The credential-`error` state is a **dead end**: it reads *"Apollo key error — reconnect to resume
  discovery"* but its button calls `launch("keep")`, which **retries discovery** (futile while the
  key is bad) rather than letting the user fix the key.

So a user who pasted the wrong key, or whose key was rotated/revoked at Apollo, is stuck: their only
escape is a DB edit. This is the gap the attached screenshot highlights.

## 2. Goal

Let a connected user **replace the stored API key** (wrong key / rotated key) and **disconnect Apollo
entirely** (start fresh), from the Apollo tile in Mission Control → Data Sources — reusing the
existing, already-deployed backend.

## 3. Context: grounding against the codebase

### 3.1 What already exists (Spec 35, merged)

`features/connectors/` ships the data layer (`contracts.ts`, `services/apollo.ts`, hooks against
`/connectors/apollo/*`), the `ApolloTile` (mounted by
`features/mission-control/components/data-sources/DataSourcesManager.tsx`), `ApolloConnectModal`,
warmup progress + unlock toast, the discovery flow, tile states (`lib/tileState.ts` →
`deriveApolloTileState`), low-credit warning, and the lead-source filter/badge.

### 3.2 The gap (this spec)

1. No affordance to **update/replace** the key after connecting.
2. No affordance to **disconnect**.
3. The credential-`error` action is mislabeled and wired to discovery-retry, not reconnect.

### 3.3 The backend is already sufficient — no backend work

Verified against local `master` (`backend/app/routers/connectors.py`,
`app/services/connectors/{orchestrator,credentials}.py`) and the live prod OpenAPI (2026-06-19; the
`/connectors/apollo/connect` path is present — POST and DELETE share that path in code):

| Operation | Endpoint | Backend behavior (confirmed) |
|---|---|---|
| Replace/update key | `POST /connectors/apollo/connect` `{org_id,user_id,api_key}` | `orchestrator.connect_apollo` → `credentials.save_credentials` does `update_one(..., upsert=True)` keyed by `(org_id, provider)` → **a new key overwrites the old one.** Same two-check validation (profile-completeness → key validity) as first connect. |
| Disconnect | `DELETE /connectors/apollo/connect?org_id=…` → `DisconnectResponse{status,message}` | `orchestrator.disconnect_apollo` → `credentials.delete_credentials` does `delete_one({org_id, provider})`. Removes **only** the Mongo credential doc; **Apollo-sourced leads in Neo4j are untouched.** Idempotent (a 0-match delete still returns `200`). |
| Read state | `GET /connectors/apollo/status?org_id=…` → `ApolloStatusResponse` | Reports `connected`, `status`, `connected_at`, credit fields, ICP-change flags. **Returns no key material** (only `connected` + metadata) — see §13 decision on the masked field. |

> Grounding caveat: a live DELETE was **not** probed (it would wipe a real org's stored key). The
> contract is taken from code + the static OpenAPI; the plan's verification step should probe against
> a throwaway org if a live check is wanted.

So "replace key" = call `POST /connect` again with the new key; "disconnect" = call `DELETE /connect`.
**Both are pure frontend wiring.**

## 4. Goals / Non-goals

**Goals**
- Gear menu on the connected tile → *Update API key* and *Disconnect Apollo*.
- Update reuses the existing connect path and **all** its existing validation/error branches.
- Disconnect returns the tile to `disconnected` and preserves existing Apollo-sourced leads.
- Fix the credential-`error` state so its primary action opens the update-key flow.

**Non-goals** (see §11)
- No backend changes. No new endpoints, no schema changes.
- No exposing the stored key (no real masked prefill — see §13).
- No OAuth, no key-rotation reminders, no multi-provider connectors.
- No changes to discovery, warmup, import, enrich, export, the tile state machine, or the lead pool.

## 5. UX flow & tile changes

### 5.1 Gear (settings) menu — `ApolloManageMenu.tsx` (new, presentational)

- A gear icon in the tile header row (beside the `Apollo` title / "ICP updated…" note), opening a
  shadcn `DropdownMenu` (`src/components/ui/dropdown-menu.tsx`) with two items:
  **"Update API key"** and **"Disconnect Apollo"** (the latter styled destructive).
- **Shown whenever `connected`** — i.e., in every state **except** `disconnected` (before connecting
  there is nothing to manage). Present in `locked`, `unlocked`, `running`, `complete*`, and `error`.
- Props: `{ onUpdateKey: () => void; onDisconnect: () => void }`. It owns no business state; the tile
  owns the action state and renders the modal/dialog — mirroring how the tile already owns
  `connectOpen` / `prompt` and renders `ApolloConnectModal` / the discovery dialogs.

### 5.2 Update API key — reuse `ApolloConnectModal` with a `mode` prop

`ApolloConnectModal` gains `mode?: "connect" | "update"` (default `"connect"`; current behavior
unchanged). In `"update"`:

- Title **"Update Apollo API key"**; description notes the new key replaces the current one and is
  validated before saving.
- Field starts **empty** (Q1 decision), `type="password"`, placeholder **"Enter new Apollo master
  key"**, with helper text **"A key is already connected."** (We cannot prefill a masked key — the
  backend never returns key material; see §13.)
- Submit button **"Update"** → **"Updating…"** while pending.
- On submit → the **same** `connectApollo({orgId,userId,apiKey})` call (POST `/connect`, which
  upserts). **All existing error branches are reused unchanged**: `profile_incomplete` (deep-link
  button), `master_key_required`, invalid-key, and network/`httpStatus === 0`.
- On success → close, refetch status, toast **"Apollo key updated."**

### 5.3 Disconnect Apollo — `DisconnectApolloDialog.tsx` (new)

- A shadcn `AlertDialog` (`src/components/ui/alert-dialog.tsx`) with:
  - Title **"Disconnect Apollo?"**
  - Body (verbatim from the reference design): **"Existing Apollo-sourced leads will remain in your
    pool, but discovery will be unavailable until you reconnect."**
  - Actions: **Cancel** (no-op) and destructive **Disconnect**.
- Confirm → `useDisconnectApollo(orgId)` mutation (§7) → on success: invalidate the status query;
  **clear discovery-local tile state — `setRunId(null)` and `setPrompt("none")`** (mirror the
  existing `launch` clear at `ApolloTile.tsx:61`; without it, `useDiscoverStatus` keeps polling every
  2.5s for the now-disconnected org and fires a stray `apolloStatus` invalidation on the run's
  terminal tick — `useDiscoverStatus.ts:19,30-34`); the tile flips to `disconnected`; toast
  **"Apollo disconnected."** On error → toast **"Couldn't disconnect Apollo — please try again."**
  and the tile stays connected.

### 5.4 Credential-error state fix

The `error` state already distinguishes credential error (`status?.status === "error"`) from a
failed discovery run. When it is a **credential** error, replace the misleading discovery **"Retry"**
button with **"Update API key"** (opens the update modal, §5.2). For a **discovery-failure** error,
keep **"Retry"** (`launch("keep")`) exactly as today. The header gear is also present in this state,
so the two entry points are consistent.

### 5.5 Tile state machine — deliberately unchanged

`lib/tileState.ts` / `ApolloTileState` are **not** modified. The gear renders off `connected`
(orthogonal to `tileState`), and disconnect simply flips `status.connected → false`, which the
existing machine already maps to `disconnected`. This keeps blast radius minimal and means no new
state, no new test matrix for `deriveApolloTileState`.

## 6. Component changes

All under `frontend/src/features/connectors/`:

| File | Change |
|---|---|
| `components/ApolloManageMenu.tsx` | **New.** Gear `DropdownMenu`; props `{ onUpdateKey, onDisconnect }`. |
| `components/DisconnectApolloDialog.tsx` | **New.** `AlertDialog` confirm; props `{ open, isPending, onConfirm, onCancel }`. |
| `components/ApolloConnectModal.tsx` | Add `mode?: "connect" \| "update"`; switch title/description/helper/placeholder/submit-label and the success-toast trigger on it. Connect behavior unchanged when `mode` omitted. |
| `components/ApolloTile.tsx` | Render `<ApolloManageMenu>` in the header when `connected`; hold modal/dialog state (extend the existing `connectOpen`/`prompt` pattern, e.g. `modal: "none" \| "connect" \| "update"` + `disconnectOpen`); wire update + disconnect (**on disconnect success clear `runId`/`prompt`** — §5.3); repoint the credential-`error` button to open the update modal; in the shared `onConnected`, read the current `modal` mode and fire the **"Apollo key updated."** toast only on `"update"` (connect keeps today's close+refetch, no toast). |
| `services/apollo.ts` | Add `disconnectApollo(orgId)`. |
| `contracts.ts` | Add `DisconnectResponseSchema`. |
| `hooks/useDisconnectApollo.ts` | **New** mutation hook. |
| `README.md` | One line noting key-update + disconnect now live on the tile. |

`index.ts` exports are **unchanged** — everything is internal to `ApolloTile`.

## 7. Data layer

**Service** (`services/apollo.ts`):
```ts
import { apiRequest } from "@/shared/api/client";

// DELETE /api/connectors/apollo/connect — remove stored Apollo credentials for the org.
export async function disconnectApollo(orgId: string): Promise<DisconnectResponse> {
  return apiRequest(
    `connectors/apollo/connect?org_id=${encodeURIComponent(orgId)}`,
    DisconnectResponseSchema,
    { method: "DELETE" },
  );
}
```
(Transport: use the shared `apiRequest(endpoint, schema, { method })` primitive — the one `apiGet`/
`apiPost` are built on (`client.ts:12-22`) — so the call routes through the rate limiter + JWT
injection and zod-parses the body. There is no `apiDelete` helper. Do **not** copy the raw-fetch
pattern from `connectApollo`/`startApolloDiscover`: that exists solely to parse typed error bodies
(`ApolloConnectError`/`ApolloDiscoverError`), and disconnect branches on no error code (§9), so it
has no such need.)

**Contract** (`contracts.ts`):
```ts
export const DisconnectResponseSchema = z
  .object({ status: z.string(), message: z.string() })
  .passthrough();
export type DisconnectResponse = z.infer<typeof DisconnectResponseSchema>;
```

**Hook** (`hooks/useDisconnectApollo.ts`) — mirrors `useDiscover`:
```ts
export function useDisconnectApollo(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => disconnectApollo(orgId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.apolloStatus(orgId) });
      // warmup is org+user keyed and auto-disables once status reports connected:false.
    },
  });
}
```

**Update key** needs **no new hook**: the modal already calls `connectApollo` directly, and the tile
already refetches status in its `onConnected` handler. The only addition is the mode-aware toast —
and because the modal fires a single `onConnected()` for both modes (`ApolloConnectModal.tsx:54`),
the **tile** owns that decision: its shared `onConnected` reads the current `modal` mode and toasts
only on `"update"`. The toast is tile-side, not modal-side (the modal has no toast policy).

## 8. Backend contract relied upon (unchanged)

`POST /connectors/apollo/connect` (upsert), `DELETE /connectors/apollo/connect`, `GET
/connectors/apollo/status` — exactly as in §3.3. No new fields, no new routes.

## 9. Error handling & edge cases

- **Update — profile incomplete:** because update reuses `POST /connect`, the backend's
  profile-completeness gate also applies to key updates; the modal's existing `profile_incomplete`
  branch deep-links the user to fix it. Accepted behavior, matches the reference (§13).
- **Update — invalid / non-master key:** existing `master_key_required` and invalid-key branches
  render unchanged.
- **Disconnect — failure:** toast + tile stays connected; user can retry.
- **Disconnect — idempotency:** a `200` with `0` matched is treated as success (already disconnected).
- **Disconnect during a `running` discovery:** allowed, but with a consequence the user should
  understand. `_run_discover` reads the key once at run start (`credentials.get_api_key`,
  `orchestrator.py:344`) and holds it in memory, so deleting the credential doc does **not** stop an
  in-flight run — it keeps revealing/ingesting leads and **keeps spending Apollo credits until it
  completes** (the run's later status writes are harmless no-ops on the deleted doc — no
  resurrection, since they use non-upsert `update_one`). We do not add run-cancellation (§11); for
  MVP this deferral is accepted. The disconnect dialog uses the product design's verbatim copy only —
  adding an in-progress-credit-spend sentence was considered and **declined** (review round 1); the
  consequence is documented here, not surfaced in the UI.
- **Cross-tab / stale state:** after either action the status query is invalidated/refetched, so the
  tile reflects the new truth on next render.

## 10. Acceptance criteria & testing

**Acceptance criteria (definition of done):**

1. Connected tile → gear → *Update API key* → enter a new key → *Update* → `200`: the stored key is
   overwritten, status refetches, and the **"Apollo key updated."** toast fires.
2. The gear menu is present in every connected state and **absent** in `disconnected`.
3. The credential-`error` state shows **"Update API key"** (opens the update modal), not discovery
   **"Retry"**; a discovery-failure error still shows **"Retry"**.
4. Gear → *Disconnect Apollo* → confirm → `DELETE` `200`: the tile returns to `disconnected`,
   discovery-local state is cleared (no further discover/status polling), and Apollo-sourced leads
   are preserved (no lead deletion). Cancel is a no-op.
5. Update reuses connect validation: `profile_incomplete` deep-links, invalid/non-master keys surface
   the existing errors, and the field starts empty.
6. No backend change; no change to discovery/warmup/import/enrich/export or the tile state machine.

**Tests (Vitest; advisory e2e/VR not required):**

- `ApolloManageMenu`: renders gear + both items; fires the right callback per item.
- `ApolloTile`: gear visible when connected, **absent** when `disconnected`; "Update API key" opens
  the modal in **update** mode (asserts title/placeholder/helper + empty field); success path
  refetches status and toasts "Apollo key updated"; `profile_incomplete` deep-link still works in
  update mode; "Disconnect Apollo" opens the dialog; **confirm** calls the mutation and the tile
  returns to `disconnected`; **cancel** is a no-op.
- Credential-`error` state shows **"Update API key"** (not discovery "Retry") and opens the update
  modal; a discovery-failure error still shows **"Retry"**.
- `DisconnectApolloDialog`: renders the **verbatim** warning copy.
- `disconnectApollo` service: issues `DELETE` with `org_id` and parses `DisconnectResponse`.
- `useDisconnectApollo`: invalidates `qk.apolloStatus(orgId)` on success.
- Run the connectors suite + `DataSourcesManager.apollo.test.tsx` (the mount point) to catch
  integration regressions; `prettier --check` touched files.

## 11. Out of scope

| Item | Why / where |
|---|---|
| Any backend change | Endpoints already exist and suffice (§3.3). |
| Real masked-key prefill (last-4) | Needs a `key_hint` field on `GET /status`; Q1 chose empty-field instead (§13). |
| Relaxing the profile-completeness gate for key *updates* | Would need a backend `skip_profile_check`; accepted as-is for now (§9, §13). Note as TD if it bites. |
| Run cancellation on disconnect-during-running | Best-effort only (§9). |
| OAuth, rotation reminders, multi-provider, lead cleanup on disconnect | Future / not planned. |

## 12. Relationship to the product design (key-management affordances)

The settings/gear → *Update API key* / *Disconnect Apollo* affordances come from the product team's
2026-06-04 Apollo frontend design (the uncommitted working-tree reference doc noted at the top). Two
points where this spec resolves that design against the actual system, each justified **independently
of the (now unlocatable) source**:

- **No masked-key prefill.** That design envisaged prefilling the existing key, masked. We cannot:
  `GET /connectors/apollo/status` returns **no key material** (§3.3, verified), so the only honest
  options are an empty field or fabricated dots. Per Q1 the update field is **empty, with placeholder
  "Enter new Apollo master key" + "A key is already connected." helper** — no cosmetic dots (would
  mislead) and no new backend `key_hint` field (out of frontend-only scope).
- **Gear visibility rule made explicit.** That design assumed a tile that exists only after
  connection. Our `ApolloTile` also renders the pre-connect `disconnected` state, so the rule is
  stated explicitly: **gear shown in all states except `disconnected`.**

The remaining affordances (gear → Update key / Disconnect; the disconnect confirmation copy; the
same two-check validation on update) are implemented as that design intended.

## 13. Resolved decisions

- **Q1 — Update-key field (resolved):** empty field + helper note. Frontend-only; no key material
  shown; existing connect-validation runs on save.
- **Q2 — Scope (resolved):** connection-management only (update key + disconnect + the
  credential-error fix). The rest of the reference doc is already shipped (Spec 35).
- **Profile gate on update (accepted):** update reuses `POST /connect`, so the profile-completeness
  check applies; matches the reference's "same two-check validation." Revisit only if it annoys.
- **Disconnect dialog copy (resolved, review round 1):** verbatim product copy only; the optional
  in-progress-credit-spend sentence was declined. The credit-spend consequence is documented in §9.

## 14. Dependencies & follow-ups

- Depends only on already-merged Spec 35 frontend + the deployed connector endpoints.
- No new `docs/TECH_DEBT.md` entry required by this work. If the profile-gate-on-update, or the
  best-effort disconnect-during-running (in-flight run keeps spending credits, §9) ever needs
  hardening (e.g. run-cancellation), file a TD-FE entry then.
- Next steps per repo flow: `/review-spec` → `/synthesize-spec-review` (loop to clean) →
  `plans/40-apollo-connection-management.md`.
