# Apollo Connection Management (Update Key + Disconnect) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL — use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Pairs with:** `specs/40-apollo-connection-management-design.md` (reviewed round 1, recommendation `no`).

**Goal:** Let a connected user replace the stored Apollo API key and disconnect Apollo, from the Apollo tile in Mission Control → Data Sources.

**Architecture:** Frontend-only. The backend already provides everything: `POST /connectors/apollo/connect` upserts the key (= replace), `DELETE /connectors/apollo/connect` removes it (= disconnect, leads preserved), `GET /connectors/apollo/status` reports connection. We add a gear menu (`ApolloManageMenu`) to the connected tile that opens either the existing connect modal in a new `"update"` mode or a destructive `DisconnectApolloDialog`, plus the `disconnectApollo` service + `useDisconnectApollo` hook. The tile state machine (`lib/tileState.ts`) is untouched — the gear renders off `connected`, and disconnect flips the tile to the existing `disconnected` state.

**Tech Stack:** React 18 + TypeScript + Vite, TanStack Query, zod, shadcn-ui (Radix) `DropdownMenu`/`AlertDialog`/`Dialog`, Vitest + React Testing Library + MSW.

## Global Constraints

Every task implicitly includes these (verbatim values from the spec):

- **Frontend-only.** No backend, no new endpoints, no schema change. Run all tooling from `frontend/`.
- **Transport:** use the shared `apiRequest(endpoint, schema, { method })` primitive (`@/shared/api/client`, `client.ts:12-22`). There is **no `apiDelete`**. Do not copy the raw-fetch pattern from `connectApollo`/`startApolloDiscover` (that exists only for typed error-body parsing).
- **Gear visibility:** the gear menu is shown whenever `connected` — i.e., in every state **except** `disconnected`.
- **Update field is empty** — placeholder `"Enter new Apollo master key"`, helper `"A key is already connected."`. No masked prefill (backend returns no key material), no cosmetic dots.
- **Exact copy strings:**
  - Update modal title: `"Update Apollo API key"`; submit button `"Update"` / `"Updating…"`.
  - Update success toast: `"Apollo key updated."`
  - Disconnect dialog title: `"Disconnect Apollo?"`; body (verbatim): `"Existing Apollo-sourced leads will remain in your pool, but discovery will be unavailable until you reconnect."`; confirm `"Disconnect"` / `"Disconnecting…"`; cancel `"Cancel"`.
  - Disconnect success toast: `"Apollo disconnected."`; failure toast: `"Couldn't disconnect Apollo — please try again."`
  - The disconnect dialog carries **no** credit-spend sentence (declined, spec §9/§13).
  - Gear trigger accessible name: `"Apollo settings"`.
- **On disconnect success:** clear discovery-local tile state — `setRunId(null)` and `setPrompt("none")` (spec §5.3) — so `useDiscoverStatus` stops polling the now-disconnected org.
- **Credential-error fix:** when `status.status === "error"`, the error-state action is **"Update API key"** (opens the update modal), not discovery **"Retry"**. A discovery-failure error keeps **"Retry"**.
- **Commit style:** `type(scope):` (e.g. `feat(fe):`); small, frequent commits; **no `Co-Authored-By` footer**; no `[N/M]` suffixes.
- **Per-task gate:** from `frontend/`, run `npm run verify` (typecheck + lint + change-scoped vitest) and `npx prettier --check` on the files you touched (`verify` omits `format:check`). Use `npm run typecheck`, never bare `npx tsc`. The controller runs full `npm run preflight` before merge.

---

## File Structure

**New:**
- `frontend/src/features/connectors/hooks/useDisconnectApollo.ts` — disconnect mutation hook.
- `frontend/src/features/connectors/hooks/__tests__/useDisconnectApollo.test.tsx` — hook + service (DELETE + parse + invalidation) coverage.
- `frontend/src/features/connectors/components/ApolloManageMenu.tsx` — presentational gear `DropdownMenu`.
- `frontend/src/features/connectors/components/__tests__/ApolloManageMenu.test.tsx`
- `frontend/src/features/connectors/components/DisconnectApolloDialog.tsx` — presentational `AlertDialog`.
- `frontend/src/features/connectors/components/__tests__/DisconnectApolloDialog.test.tsx`

**Modify:**
- `frontend/src/features/connectors/contracts.ts` — add `DisconnectResponseSchema` + type.
- `frontend/src/features/connectors/services/apollo.ts` — add `disconnectApollo`.
- `frontend/src/features/connectors/components/ApolloConnectModal.tsx` — add `mode?: "connect" | "update"`.
- `frontend/src/features/connectors/components/__tests__/ApolloConnectModal.test.tsx` — add update-mode tests.
- `frontend/src/features/connectors/components/ApolloTile.tsx` — wire gear menu, update modal, disconnect dialog, error-state fix, mode-aware toast, runId clear.
- `frontend/src/features/connectors/components/__tests__/ApolloTile.test.tsx` — add gear/update/disconnect tests; **modify** the credential-error test.
- `frontend/src/features/connectors/README.md` — one line.

`index.ts` exports are unchanged (all new components are `ApolloTile`-internal).

---

## Execution notes

- **Task dependency graph:** Tasks 1–4 touch disjoint files (Task 1: `contracts.ts` / `services/apollo.ts` / new `useDisconnectApollo.ts`; Task 2: `ApolloConnectModal.tsx`; Task 3: new `ApolloManageMenu.tsx`; Task 4: new `DisconnectApolloDialog.tsx`) and may be run in parallel. **Task 5** is the join — it consumes Tasks 1–4 — and **Task 6** follows Task 5. If 1–4 run concurrently in one working tree, serialize their `npm run verify` invocations (the connectors vitest suite has a known parallel-contention flake under sandbox CPU load).
- **Per-task stop:** a red `npm run verify` or `prettier --check` halts that task — fix before moving on; never commit a red task.
- **One external assumption:** the `DELETE /connectors/apollo/connect` contract (`{status, message}`, idempotent 200-on-0-match) is verified against backend code (`response_model=DisconnectResponse`), not live-probed — spec §3.3 left a live check optional. The MSW mocks encode that contract; if an executor probes live and the shape or idempotency differs from the assumption, stop and report before relying on the mocked contract.

---

## Setup

- [ ] **Create the feature branch off `master`.**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master && git pull --ff-only
git checkout -b 40-apollo-connection-management
```

---

## Task 1: Disconnect data layer (contract + service + hook)

**Files:**
- Modify: `frontend/src/features/connectors/contracts.ts`
- Modify: `frontend/src/features/connectors/services/apollo.ts`
- Create: `frontend/src/features/connectors/hooks/useDisconnectApollo.ts`
- Test: `frontend/src/features/connectors/hooks/__tests__/useDisconnectApollo.test.tsx`

**Interfaces:**
- Consumes: `apiRequest` (`@/shared/api/client`), `qk.apolloStatus` (`@/shared/api/queryKeys`).
- Produces: `DisconnectResponseSchema` + `DisconnectResponse` (`{status: string; message: string}`); `disconnectApollo(orgId: string): Promise<DisconnectResponse>`; `useDisconnectApollo(orgId: string)` → TanStack mutation (`.mutate()`, `.isPending`).

- [ ] **Step 1: Write the failing test** `hooks/__tests__/useDisconnectApollo.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useDisconnectApollo } from "../useDisconnectApollo";

import { qk } from "@/shared/api/queryKeys";
import { server } from "@/test/msw/server";

describe("useDisconnectApollo", () => {
  it("DELETEs with org_id, parses the response, and invalidates apolloStatus on success", async () => {
    let seenMethod = "";
    let seenUrl = "";
    server.use(
      http.delete("/api/connectors/apollo/connect", ({ request }) => {
        seenMethod = request.method;
        seenUrl = request.url;
        return HttpResponse.json({ status: "disconnected", message: "removed" });
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDisconnectApollo("o1"), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenMethod).toBe("DELETE");
    expect(seenUrl).toContain("org_id=o1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: qk.apolloStatus("o1") });
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `cd frontend && npx vitest run src/features/connectors/hooks/__tests__/useDisconnectApollo.test.tsx`
Expected: FAIL with "Cannot find module '../useDisconnectApollo'" (the hook, service, and contract don't exist yet).

- [ ] **Step 3: Add the contract.** In `contracts.ts`, append:

```ts
export const DisconnectResponseSchema = z
  .object({ status: z.string(), message: z.string() })
  .passthrough();
export type DisconnectResponse = z.infer<typeof DisconnectResponseSchema>;
```

- [ ] **Step 4: Add the service.** In `services/apollo.ts`, widen the client import and the contracts import, then add the function. Change line 16 `import { apiGet } from "@/shared/api/client";` to:

```ts
import { apiGet, apiRequest } from "@/shared/api/client";
```

Add `DisconnectResponseSchema` + `DisconnectResponse` to the existing `../contracts` import block, then add at the end of the file:

```ts
/** DELETE /api/connectors/apollo/connect — remove stored Apollo credentials for the org. */
export async function disconnectApollo(orgId: string): Promise<DisconnectResponse> {
  return apiRequest(
    `connectors/apollo/connect?org_id=${encodeURIComponent(orgId)}`,
    DisconnectResponseSchema,
    { method: "DELETE" },
  );
}
```

- [ ] **Step 5: Create the hook** `hooks/useDisconnectApollo.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { disconnectApollo } from "../services/apollo";

import { qk } from "@/shared/api/queryKeys";

/** DELETE the org's Apollo credentials, then refresh connection status.
 * Mirrors useDiscover: success invalidates apolloStatus so the tile re-reads `connected`. */
export function useDisconnectApollo(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => disconnectApollo(orgId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.apolloStatus(orgId) });
    },
  });
}
```

- [ ] **Step 6: Run the test to verify it passes.**

Run: `cd frontend && npx vitest run src/features/connectors/hooks/__tests__/useDisconnectApollo.test.tsx`
Expected: PASS. If it still FAILS on a missing export, fix the import wiring from steps 3–5.

- [ ] **Step 7: Gate + commit.**

```bash
cd frontend && npm run verify && npx prettier --check \
  src/features/connectors/contracts.ts \
  src/features/connectors/services/apollo.ts \
  src/features/connectors/hooks/useDisconnectApollo.ts \
  src/features/connectors/hooks/__tests__/useDisconnectApollo.test.tsx
git add src/features/connectors/contracts.ts src/features/connectors/services/apollo.ts \
  src/features/connectors/hooks/useDisconnectApollo.ts \
  src/features/connectors/hooks/__tests__/useDisconnectApollo.test.tsx
git commit -m "feat(fe): add Apollo disconnect data layer (service, contract, hook)"
```

---

## Task 2: ApolloConnectModal — `mode` prop (connect | update)

**Files:**
- Modify: `frontend/src/features/connectors/components/ApolloConnectModal.tsx`
- Test: `frontend/src/features/connectors/components/__tests__/ApolloConnectModal.test.tsx`

**Interfaces:**
- Produces: `ApolloConnectModal` now accepts `mode?: "connect" | "update"` (default `"connect"`). Behavior, props, and the success callback name (`onConnected`) are unchanged; only copy varies by mode. The submit still calls `connectApollo` (POST `/connect`, which upserts).

- [ ] **Step 1: Add the failing tests** to `__tests__/ApolloConnectModal.test.tsx` (append inside the `describe`):

```tsx
  it("renders update-mode copy with an empty field", () => {
    wrap(
      <ApolloConnectModal
        open
        mode="update"
        orgId="o1"
        userId="u1"
        onClose={vi.fn()}
        onConnected={vi.fn()}
        onDeepLink={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: /update apollo api key/i })).toBeInTheDocument();
    expect(screen.getByText(/a key is already connected/i)).toBeInTheDocument();
    const input = screen.getByLabelText(/api key/i) as HTMLInputElement;
    expect(input.value).toBe("");
    expect(input).toHaveAttribute("placeholder", "Enter new Apollo master key");
    expect(screen.getByRole("button", { name: /^update$/i })).toBeInTheDocument();
  });

  it("update mode still posts to /connect and calls onConnected", async () => {
    server.use(
      http.post("/api/connectors/apollo/connect", () =>
        HttpResponse.json({ connected: true, status: "connected" }),
      ),
    );
    const onConnected = vi.fn();
    wrap(
      <ApolloConnectModal
        open
        mode="update"
        orgId="o1"
        userId="u1"
        onClose={vi.fn()}
        onConnected={onConnected}
        onDeepLink={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: "rotated-key" } });
    fireEvent.click(screen.getByRole("button", { name: /^update$/i }));
    await waitFor(() => expect(onConnected).toHaveBeenCalled());
  });
```

- [ ] **Step 2: Run to verify they fail.**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/ApolloConnectModal.test.tsx`
Expected: FAIL (no update title / `^update$` button yet).

- [ ] **Step 3: Implement the `mode` prop.** In `ApolloConnectModal.tsx`:

Add to the `Props` interface:

```ts
  /** "connect" (default) for first connect; "update" to replace an existing key. */
  mode?: "connect" | "update";
```

Add `mode = "connect"` to the destructured params, then derive copy at the top of the component body (after the `useState`/`useEffect` block):

```ts
  const isUpdate = mode === "update";
```

Replace the `<DialogTitle>` / `<DialogDescription>` block with:

```tsx
          <DialogTitle>{isUpdate ? "Update Apollo API key" : "Connect Apollo"}</DialogTitle>
          <DialogDescription>
            {isUpdate ? (
              <>
                Enter a new Apollo <strong>master API key</strong>. It replaces the current key and is
                validated before saving.{" "}
              </>
            ) : (
              <>
                Discover net-new leads from Apollo based on your ICP. Requires a{" "}
                <strong>master API key</strong> with search access.{" "}
              </>
            )}
            <a href={APOLLO_KEY_HELP} target="_blank" rel="noreferrer" className="underline">
              Where do I find it?
            </a>
          </DialogDescription>
```

Change the input's `placeholder` to be mode-aware, and add helper text after the `<Input>`:

```tsx
          <Input
            id="apollo-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={isUpdate ? "Enter new Apollo master key" : "Apollo master key"}
          />
          {isUpdate && (
            <p className="text-xs text-muted-foreground">A key is already connected.</p>
          )}
```

Change the submit button label:

```tsx
          <Button onClick={handleConnect} disabled={submitting || !apiKey}>
            {submitting
              ? isUpdate
                ? "Updating…"
                : "Connecting…"
              : isUpdate
                ? "Update"
                : "Connect"}
          </Button>
```

(The `useEffect` that resets `apiKey`/`error` on `open` already guarantees the empty field in both modes — leave it as is.)

- [ ] **Step 4: Run to verify they pass.**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/ApolloConnectModal.test.tsx`
Expected: PASS (all original + the two new cases).

- [ ] **Step 5: Gate + commit.**

```bash
cd frontend && npm run verify && npx prettier --check \
  src/features/connectors/components/ApolloConnectModal.tsx \
  src/features/connectors/components/__tests__/ApolloConnectModal.test.tsx
git add src/features/connectors/components/ApolloConnectModal.tsx \
  src/features/connectors/components/__tests__/ApolloConnectModal.test.tsx
git commit -m "feat(fe): add update mode to ApolloConnectModal"
```

---

## Task 3: ApolloManageMenu (gear dropdown)

**Files:**
- Create: `frontend/src/features/connectors/components/ApolloManageMenu.tsx`
- Test: `frontend/src/features/connectors/components/__tests__/ApolloManageMenu.test.tsx`

**Interfaces:**
- Produces: `ApolloManageMenu({ onUpdateKey, onDisconnect }: { onUpdateKey: () => void; onDisconnect: () => void })` — a gear `Button` (aria-label `"Apollo settings"`) opening a `DropdownMenu` with items `"Update API key"` → `onUpdateKey` and `"Disconnect Apollo"` → `onDisconnect`.

- [ ] **Step 1: Write the failing test** `__tests__/ApolloManageMenu.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ApolloManageMenu } from "../ApolloManageMenu";

// Radix DropdownMenu uses pointer-capture / scrollIntoView, which jsdom lacks.
// Stub them so the menu opens under fireEvent (the repo has no user-event dep).
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

function openMenu() {
  const trigger = screen.getByRole("button", { name: /apollo settings/i });
  fireEvent.pointerDown(trigger);
  fireEvent.click(trigger);
}

describe("ApolloManageMenu", () => {
  it("renders a gear trigger", () => {
    render(<ApolloManageMenu onUpdateKey={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /apollo settings/i })).toBeInTheDocument();
  });

  it("fires onUpdateKey when 'Update API key' is chosen", async () => {
    const onUpdateKey = vi.fn();
    render(<ApolloManageMenu onUpdateKey={onUpdateKey} onDisconnect={vi.fn()} />);
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /update api key/i }));
    expect(onUpdateKey).toHaveBeenCalled();
  });

  it("fires onDisconnect when 'Disconnect Apollo' is chosen", async () => {
    const onDisconnect = vi.fn();
    render(<ApolloManageMenu onUpdateKey={vi.fn()} onDisconnect={onDisconnect} />);
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /disconnect apollo/i }));
    expect(onDisconnect).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/ApolloManageMenu.test.tsx`
Expected: FAIL with "Cannot find module '../ApolloManageMenu'".

- [ ] **Step 3: Implement** `ApolloManageMenu.tsx`:

```tsx
import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  onUpdateKey: () => void;
  onDisconnect: () => void;
}

/** Gear menu on a connected Apollo tile: Update API key / Disconnect Apollo (spec 40 §5.1). */
export function ApolloManageMenu({ onUpdateKey, onDisconnect }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Apollo settings">
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onUpdateKey}>Update API key</DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDisconnect}
          className="text-destructive focus:text-destructive"
        >
          Disconnect Apollo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/ApolloManageMenu.test.tsx`
Expected: PASS. (If a menuitem isn't found, confirm the `beforeAll` pointer stubs are present — without them Radix won't open in jsdom.)

- [ ] **Step 5: Gate + commit.**

```bash
cd frontend && npm run verify && npx prettier --check \
  src/features/connectors/components/ApolloManageMenu.tsx \
  src/features/connectors/components/__tests__/ApolloManageMenu.test.tsx
git add src/features/connectors/components/ApolloManageMenu.tsx \
  src/features/connectors/components/__tests__/ApolloManageMenu.test.tsx
git commit -m "feat(fe): add ApolloManageMenu gear menu for the Apollo tile"
```

---

## Task 4: DisconnectApolloDialog (confirm)

**Files:**
- Create: `frontend/src/features/connectors/components/DisconnectApolloDialog.tsx`
- Test: `frontend/src/features/connectors/components/__tests__/DisconnectApolloDialog.test.tsx`

**Interfaces:**
- Produces: `DisconnectApolloDialog({ open, isPending?, onConfirm, onCancel })` — an `AlertDialog` with the verbatim leads-preserved warning; `Disconnect` → `onConfirm`, `Cancel` → `onCancel`.

- [ ] **Step 1: Write the failing test** `__tests__/DisconnectApolloDialog.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DisconnectApolloDialog } from "../DisconnectApolloDialog";

describe("DisconnectApolloDialog", () => {
  it("shows the leads-preserved warning verbatim when open", () => {
    render(<DisconnectApolloDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(
      screen.getByText(
        /Existing Apollo-sourced leads will remain in your pool, but discovery will be unavailable until you reconnect\./i,
      ),
    ).toBeInTheDocument();
  });

  it("calls onConfirm on Disconnect and onCancel on Cancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<DisconnectApolloDialog open onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /^disconnect$/i }));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/DisconnectApolloDialog.test.tsx`
Expected: FAIL with "Cannot find module '../DisconnectApolloDialog'".

- [ ] **Step 3: Implement** `DisconnectApolloDialog.tsx`:

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Destructive confirm for disconnecting Apollo. Only credentials are removed; leads are preserved
 * (spec 40 §5.3). No credit-spend sentence (declined, §9). */
export function DisconnectApolloDialog({ open, isPending = false, onConfirm, onCancel }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Apollo?</AlertDialogTitle>
          <AlertDialogDescription>
            Existing Apollo-sourced leads will remain in your pool, but discovery will be unavailable
            until you reconnect.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending ? "Disconnecting…" : "Disconnect"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/DisconnectApolloDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Gate + commit.**

```bash
cd frontend && npm run verify && npx prettier --check \
  src/features/connectors/components/DisconnectApolloDialog.tsx \
  src/features/connectors/components/__tests__/DisconnectApolloDialog.test.tsx
git add src/features/connectors/components/DisconnectApolloDialog.tsx \
  src/features/connectors/components/__tests__/DisconnectApolloDialog.test.tsx
git commit -m "feat(fe): add DisconnectApolloDialog confirm"
```

---

## Task 5: Wire key update + disconnect into ApolloTile

**Files:**
- Modify: `frontend/src/features/connectors/components/ApolloTile.tsx`
- Test: `frontend/src/features/connectors/components/__tests__/ApolloTile.test.tsx`

**Interfaces:**
- Consumes: `ApolloManageMenu` (Task 3), `DisconnectApolloDialog` (Task 4), `useDisconnectApollo` (Task 1), `ApolloConnectModal` with `mode` (Task 2).
- Produces: no new exports; `ApolloTile`'s external surface is unchanged.

- [ ] **Step 1: Update the test file's mocks + add the new tests.** In `__tests__/ApolloTile.test.tsx`:

**Replace** the existing hoisted-mocks block (`const mocks = vi.hoisted(...)`) and the `vi.mock(...)` group at the top of the file (real lines 5–25) with the version below. The only changes vs. the current file are the added `disconnect` mock value, the new `useDisconnectApollo` mock, and the new `ApolloConnectModal` mock — every other line is identical to what's there. Do **not** paste this _below_ the existing block; that would redeclare `const mocks` (a compile error).

```tsx
const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  warmup: vi.fn(),
  discoverStatus: vi.fn(),
  discover: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  exportLeads: vi.fn(() => vi.fn()),
  disconnect: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  toast: vi.fn(),
}));

vi.mock("../../hooks/useApolloStatus", () => ({ useApolloStatus: mocks.status }));
vi.mock("../../hooks/useApolloWarmup", () => ({ useApolloWarmup: mocks.warmup }));
vi.mock("../../hooks/useDiscoverStatus", () => ({
  useDiscoverStatus: mocks.discoverStatus,
  isTerminalStatus: (s: string) => !["queued", "processing"].includes(s),
}));
vi.mock("../../hooks/useDiscover", () => ({ useDiscover: mocks.discover }));
vi.mock("../../hooks/useExportApolloLeads", () => ({ useExportApolloLeads: mocks.exportLeads }));
vi.mock("../../hooks/useDisconnectApollo", () => ({ useDisconnectApollo: mocks.disconnect }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ orgId: "o1", currentUser: { uid: "u1" } }),
}));

// The modal has its own MSW-backed tests; here we stub it to expose its mode + a success trigger,
// so the tile's wiring (mode routing + mode-aware toast) is tested without the network.
vi.mock("../ApolloConnectModal", () => ({
  ApolloConnectModal: ({
    open,
    mode,
    onConnected,
  }: {
    open: boolean;
    mode?: string;
    onConnected: () => void;
  }) =>
    open ? (
      <div>
        <span>modal-mode:{mode ?? "connect"}</span>
        <button onClick={onConnected}>mock-connected</button>
      </div>
    ) : null,
}));
```

Add the pointer stubs and a gear-open helper (after the imports, before `renderTile`):

```tsx
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

function openGear() {
  const gear = screen.getByRole("button", { name: /apollo settings/i });
  fireEvent.pointerDown(gear);
  fireEvent.click(gear);
}
```

Add `disconnect` to `beforeEach`:

```tsx
  mocks.disconnect.mockReturnValue({ mutate: vi.fn(), isPending: false });
```

**Modify** the existing credential-error test (currently asserts `Retry`) to assert the new behavior:

```tsx
  it("credential-error shows 'Update API key' (not Retry) and opens the update modal", () => {
    mocks.status.mockReturnValue({
      data: {
        connected: true,
        status: "error",
        low_credit: false,
        icp_changed_since_last_discovery: false,
      },
      refetch: vi.fn(),
    });
    renderTile();
    expect(screen.getByText(/reconnect to resume discovery/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^retry$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /update api key/i }));
    expect(screen.getByText("modal-mode:update")).toBeInTheDocument();
  });
```

Append the new tests inside the `describe`:

```tsx
  it("shows the gear menu when connected and hides it when disconnected", () => {
    renderTile();
    expect(screen.getByRole("button", { name: /apollo settings/i })).toBeInTheDocument();
    mocks.status.mockReturnValue({
      data: { connected: false, status: "disconnected", low_credit: false },
    });
    cleanup();
    renderTile();
    expect(screen.queryByRole("button", { name: /apollo settings/i })).not.toBeInTheDocument();
  });

  it("gear → Update API key opens the modal in update mode", async () => {
    renderTile();
    openGear();
    fireEvent.click(await screen.findByRole("menuitem", { name: /update api key/i }));
    expect(screen.getByText("modal-mode:update")).toBeInTheDocument();
  });

  it("toasts 'Apollo key updated.' after a successful update, but not after a plain connect", async () => {
    renderTile();
    openGear();
    fireEvent.click(await screen.findByRole("menuitem", { name: /update api key/i }));
    fireEvent.click(screen.getByRole("button", { name: /mock-connected/i }));
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/key updated/i) }),
    );

    // connect mode must NOT toast "key updated"
    mocks.toast.mockClear();
    mocks.status.mockReturnValue({
      data: { connected: false, status: "disconnected", low_credit: false },
    });
    cleanup();
    renderTile();
    fireEvent.click(screen.getByRole("button", { name: /connect apollo/i }));
    fireEvent.click(screen.getByRole("button", { name: /mock-connected/i }));
    expect(mocks.toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/key updated/i) }),
    );
  });

  it("gear → Disconnect opens the confirm dialog with the leads-preserved warning", async () => {
    renderTile();
    openGear();
    fireEvent.click(await screen.findByRole("menuitem", { name: /disconnect apollo/i }));
    expect(screen.getByText(/leads will remain in your pool/i)).toBeInTheDocument();
  });

  it("confirming disconnect calls the mutation and toasts 'Apollo disconnected.'", async () => {
    const mutate = vi.fn((_vars: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    mocks.disconnect.mockReturnValue({ mutate, isPending: false });
    renderTile();
    openGear();
    fireEvent.click(await screen.findByRole("menuitem", { name: /disconnect apollo/i }));
    fireEvent.click(screen.getByRole("button", { name: /^disconnect$/i }));
    expect(mutate).toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/apollo disconnected/i) }),
    );
  });

  it("toasts the failure message and stays connected when disconnect fails", async () => {
    const mutate = vi.fn((_vars: unknown, opts?: { onError?: (e: unknown) => void }) =>
      opts?.onError?.(new Error("network")),
    );
    mocks.disconnect.mockReturnValue({ mutate, isPending: false });
    renderTile();
    openGear();
    fireEvent.click(await screen.findByRole("menuitem", { name: /disconnect apollo/i }));
    fireEvent.click(screen.getByRole("button", { name: /^disconnect$/i }));
    expect(mutate).toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/couldn't disconnect apollo/i),
        variant: "destructive",
      }),
    );
    // failure must NOT also fire the success toast, and the tile stays connected (gear present)
    expect(mocks.toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/apollo disconnected/i) }),
    );
    expect(screen.getByRole("button", { name: /apollo settings/i })).toBeInTheDocument();
  });
```

Update the imports at the top of the test file to include `beforeAll`, `cleanup`, and `waitFor`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
```

(Add an `afterEach(cleanup)` if not already implied — the global `src/test/setup.ts` already calls `cleanup()` in its `afterEach`, but the two tests above call `cleanup()` mid-test to re-render with new mock state, which is supported.)

- [ ] **Step 2: Run to verify the new/changed tests fail.**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/ApolloTile.test.tsx`
Expected: FAIL (no gear, no `modal-mode` stub wiring, credential-error still shows Retry).

- [ ] **Step 3: Implement the tile changes** in `ApolloTile.tsx`.

Add imports:

```tsx
import { useApolloStatus } from "../hooks/useApolloStatus";
import { useApolloWarmup } from "../hooks/useApolloWarmup";
import { useDisconnectApollo } from "../hooks/useDisconnectApollo";
import { useDiscover } from "../hooks/useDiscover";
import { useDiscoverStatus } from "../hooks/useDiscoverStatus";
import { useExportApolloLeads } from "../hooks/useExportApolloLeads";
import { selectDiscoveryPrompt } from "../lib/discoveryPrompt";
import { deriveApolloTileState } from "../lib/tileState";
import { ApolloDiscoverError } from "../services/apollo";
import type { DiscoverMode } from "../types";

import { ApolloConnectModal } from "./ApolloConnectModal";
import { ApolloManageMenu } from "./ApolloManageMenu";
import { DisconnectApolloDialog } from "./DisconnectApolloDialog";
import { ReDiscoveryGuard, KeepReplaceDownloadPrompt } from "./DiscoveryDialogs";
import { LowCreditWarning } from "./LowCreditWarning";
import { WarmupProgress } from "./WarmupProgress";
```

Replace the `connectOpen` state with the modal/disconnect state and add the disconnect mutation. Change:

```tsx
  const [connectOpen, setConnectOpen] = useState(false);
  const [prompt, setPrompt] = useState<"none" | "guard" | "keep_replace">("none");
```

to:

```tsx
  const [modal, setModal] = useState<"none" | "connect" | "update">("none");
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [prompt, setPrompt] = useState<"none" | "guard" | "keep_replace">("none");

  const disconnect = useDisconnectApollo(orgId);

  function onConfirmDisconnect() {
    disconnect.mutate(undefined, {
      onSuccess: () => {
        setDisconnectOpen(false);
        // Clear discovery-local state so useDiscoverStatus stops polling the now-disconnected org
        // (spec §5.3; mirrors the launch() clear). Status invalidation in the hook flips the tile.
        setRunId(null);
        setPrompt("none");
        toast({ title: "Apollo disconnected." });
      },
      onError: () => {
        setDisconnectOpen(false);
        toast({
          title: "Couldn't disconnect Apollo — please try again.",
          variant: "destructive",
        });
      },
    });
  }
```

Replace the header block:

```tsx
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Apollo</h3>
        {status?.icp_changed_since_last_discovery && tileState !== "locked" && (
          <span className="text-xs text-muted-foreground">ICP updated since last discovery</span>
        )}
      </div>
```

with:

```tsx
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Apollo</h3>
        <div className="flex items-center gap-2">
          {status?.icp_changed_since_last_discovery && tileState !== "locked" && (
            <span className="text-xs text-muted-foreground">ICP updated since last discovery</span>
          )}
          {connected && (
            <ApolloManageMenu
              onUpdateKey={() => setModal("update")}
              onDisconnect={() => setDisconnectOpen(true)}
            />
          )}
        </div>
      </div>
```

Change the `disconnected` button to open connect mode:

```tsx
      {tileState === "disconnected" && (
        <Button onClick={() => setModal("connect")}>Connect Apollo</Button>
      )}
```

Replace the `error`-state action (the single Retry button) so credential errors open the update flow:

```tsx
      {tileState === "error" && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            {status?.status === "error"
              ? "Apollo key error — reconnect to resume discovery."
              : "Discovery failed — check your Apollo credits."}
          </p>
          {status?.status === "error" ? (
            // Credential error: the fix is a new key, not a discovery retry.
            <Button onClick={() => setModal("update")}>Update API key</Button>
          ) : (
            // Discovery failure: retry re-runs directly (keep), bypassing the keep/replace prompt.
            <Button onClick={() => launch("keep")}>Retry</Button>
          )}
        </div>
      )}
```

Replace the `ApolloConnectModal` render and add the disconnect dialog. Change:

```tsx
      <ApolloConnectModal
        open={connectOpen}
        orgId={orgId}
        userId={userId}
        onClose={() => setConnectOpen(false)}
        onConnected={() => {
          setConnectOpen(false);
          void statusQ.refetch();
        }}
        onDeepLink={(section) => {
          setConnectOpen(false);
          goDeepLink(section);
        }}
      />
```

to:

```tsx
      <ApolloConnectModal
        open={modal !== "none"}
        mode={modal === "update" ? "update" : "connect"}
        orgId={orgId}
        userId={userId}
        onClose={() => setModal("none")}
        onConnected={() => {
          const wasUpdate = modal === "update";
          setModal("none");
          void statusQ.refetch();
          if (wasUpdate) toast({ title: "Apollo key updated." });
        }}
        onDeepLink={(section) => {
          setModal("none");
          goDeepLink(section);
        }}
      />
      <DisconnectApolloDialog
        open={disconnectOpen}
        isPending={disconnect.isPending}
        onConfirm={onConfirmDisconnect}
        onCancel={() => setDisconnectOpen(false)}
      />
```

- [ ] **Step 4: Run to verify the suite passes.**

Run: `cd frontend && npx vitest run src/features/connectors/components/__tests__/ApolloTile.test.tsx`
Expected: PASS (all original behavior + the new gear/update/disconnect tests + the modified credential-error test).

- [ ] **Step 5: Gate + commit.**

```bash
cd frontend && npm run verify && npx prettier --check \
  src/features/connectors/components/ApolloTile.tsx \
  src/features/connectors/components/__tests__/ApolloTile.test.tsx
git add src/features/connectors/components/ApolloTile.tsx \
  src/features/connectors/components/__tests__/ApolloTile.test.tsx
git commit -m "feat(fe): wire key update + disconnect into ApolloTile"
```

---

## Task 6: README + full-feature verification

**Files:**
- Modify: `frontend/src/features/connectors/README.md`

- [ ] **Step 1: Update the README.** In `src/features/connectors/README.md`, extend the feature description line so it mentions connection management. Change the opening paragraph's "the Mission Control Data Sources tile + connect modal," to:

```
the Mission Control Data Sources tile + connect modal (with post-connection key
update + disconnect via the tile's gear menu),
```

- [ ] **Step 2: Run the whole feature suite + the mount-point test.**

Run: `cd frontend && npx vitest run src/features/connectors src/features/mission-control/components/data-sources/__tests__/DataSourcesManager.apollo.test.tsx`
Expected: PASS. (Confirms the tile changes didn't break the Data Sources mount point.)

- [ ] **Step 3: Prettier + typecheck across touched files.**

```bash
cd frontend && npm run typecheck && npx prettier --check src/features/connectors
```
Expected: no type errors; prettier clean.

- [ ] **Step 4: Commit.**

```bash
cd frontend && git add src/features/connectors/README.md
git commit -m "docs(fe): note Apollo key-management on the connectors tile"
```

- [ ] **Step 5: Hand off for the merge gate.** Report to the controller that the branch is ready; the controller runs full `npm run preflight` from `frontend/` before `git merge --no-ff` into `master`. If preflight is red, report which check failed; do not merge.

---

## Self-Review (author)

- **Spec coverage:** §5.1 gear menu → Task 3 + Task 5 (header). §5.2 update modal → Task 2 + Task 5 (mode routing + toast). §5.3 disconnect → Task 1 + Task 4 + Task 5 (`onConfirmDisconnect` clears `runId`/`prompt`). §5.4 credential-error fix → Task 5 (modified test + branch). §6 file list → Tasks 1–6. §7 data layer → Task 1. §10 ACs → mapped: AC1 (Task 5 update toast + Task 2 success), AC2 (Task 5 gear visible/absent), AC3 (Task 5 credential-error), AC4 (Task 5 disconnect confirm + runId clear; Task 1 hook invalidation), AC5 (Task 2 update reuses connect validation), AC6 (no backend — enforced by Global Constraints).
- **Placeholders:** none — every step has full code/commands.
- **Type consistency:** `disconnectApollo(orgId) → Promise<DisconnectResponse>`, `useDisconnectApollo(orgId)`, `ApolloManageMenu({onUpdateKey,onDisconnect})`, `DisconnectApolloDialog({open,isPending,onConfirm,onCancel})`, `ApolloConnectModal` `mode?: "connect"|"update"` — names match across tasks.
- **Known test note:** Radix `DropdownMenu` needs the `beforeAll` pointer/scroll stubs to open under `fireEvent` (no `user-event` dep in this repo); applied in Task 3 and Task 5. The `runId`-clear (§5.3) is implemented in `onConfirmDisconnect` and verified by inspection — not asserted via a brittle internal-state test (intentional; Low-severity wiring).
- **Disconnect branches both tested:** Task 5 covers the success path (`onSuccess` → "Apollo disconnected." + `runId`/`prompt` clear) **and** the failure path (`onError` → destructive "Couldn't disconnect Apollo…" toast, no success toast, tile stays connected).
- **TDD ordering:** all tasks are red-green (failing test first → run expecting FAIL → implement → run expecting PASS), Task 1 included.
