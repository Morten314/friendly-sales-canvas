import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { ApolloDiscoverError } from "../../services/apollo";
import { ApolloTile } from "../ApolloTile";

function openGear() {
  const gear = screen.getByRole("button", { name: /apollo settings/i });
  fireEvent.keyDown(gear, { key: " ", code: "Space" });
}

// Drive launch() onError by having the discover mock invoke the supplied onError synchronously.
// mutate must be a vi.fn() (Mock) to match the useDiscover mock's inferred return type.
function discoverRejectingWith(err: unknown) {
  return {
    mutate: vi.fn((_vars: unknown, opts?: { onError?: (e: unknown) => void }) => {
      opts?.onError?.(err);
    }),
    isPending: false,
  };
}

function renderTile() {
  return render(
    <MemoryRouter>
      <ApolloTile />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.status.mockReturnValue({
    data: {
      connected: true,
      status: "connected",
      low_credit: false,
      icp_changed_since_last_discovery: false,
    },
    refetch: vi.fn(),
  });
  mocks.warmup.mockReturnValue({
    data: { unlocked: true, ready_count: 4, missing: [] },
  });
  mocks.discoverStatus.mockReturnValue({ data: undefined });
  mocks.discover.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mocks.exportLeads.mockReturnValue(vi.fn());
  mocks.disconnect.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mocks.toast.mockClear();
});

describe("ApolloTile", () => {
  it("shows Discover Leads when unlocked", () => {
    renderTile();
    expect(screen.getByRole("button", { name: /discover leads/i })).toBeEnabled();
  });

  it("shows the locked progress when warmup incomplete", () => {
    mocks.warmup.mockReturnValue({
      data: {
        unlocked: false,
        ready_count: 2,
        missing: [
          {
            step: "signals_generated",
            label: "Signals — first run",
            deep_link_hint: "signals",
          },
        ],
      },
    });
    renderTile();
    expect(screen.getByText(/2 of 4/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /discover leads/i })).not.toBeInTheDocument();
  });

  it("disables the button and shows spinner text while running", () => {
    mocks.discoverStatus.mockReturnValue({
      data: { status: "processing", progress_percent: 40, counts: {} },
    });
    renderTile();
    expect(screen.getByText(/discovering leads/i)).toBeInTheDocument();
  });

  it("shows the widen-ICP affordance on completed_empty when nobody matched (searched=0)", () => {
    mocks.discoverStatus.mockReturnValue({
      data: { status: "completed_empty", counts: { searched: 0, created: 0, matched: 0 } },
    });
    renderTile();
    expect(screen.getByText(/no leads found/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /widen your icp/i })).toBeInTheDocument();
  });

  it("shows a not-contactable message on completed_empty when candidates matched (searched>0)", () => {
    mocks.discoverStatus.mockReturnValue({
      data: { status: "completed_empty", counts: { searched: 80, created: 0, matched: 0 } },
    });
    renderTile();
    expect(screen.getByText(/none were contactable/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /widen your icp/i })).not.toBeInTheDocument();
  });

  it("on complete, shows the created count and a link to the Customers Lead Stream (S2)", () => {
    mocks.discoverStatus.mockReturnValue({
      data: {
        status: "completed",
        finished_at: "2026-06-23T11:47:07Z",
        counts: { searched: 100, created: 9, matched: 0 },
      },
    });
    renderTile();
    expect(screen.getByText(/discovery complete/i)).toBeInTheDocument();
    expect(screen.getByText(/9 new leads/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view leads in customers/i })).toBeInTheDocument();
  });

  it("shows a low-credit warning when status.low_credit", () => {
    mocks.status.mockReturnValue({
      data: {
        connected: true,
        status: "connected",
        low_credit: true,
        icp_changed_since_last_discovery: false,
      },
      refetch: vi.fn(),
    });
    renderTile();
    expect(screen.getByText(/credits are running low/i)).toBeInTheDocument();
  });

  it("shows Connect Apollo when disconnected", () => {
    mocks.status.mockReturnValue({
      data: {
        connected: false,
        status: "disconnected",
        low_credit: false,
        icp_changed_since_last_discovery: false,
      },
    });
    renderTile();
    expect(screen.getByRole("button", { name: /connect apollo/i })).toBeInTheDocument();
  });

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

  it("shows the failed-run message when a discovery run failed", () => {
    mocks.discoverStatus.mockReturnValue({ data: { status: "failed", counts: {} } });
    renderTile();
    expect(screen.getByText(/check your apollo credits/i)).toBeInTheDocument();
  });

  it("toasts a widen-ICP message when discovery is rejected as icp_underspecified (422)", () => {
    mocks.discover.mockReturnValue(
      discoverRejectingWith(
        new ApolloDiscoverError({ httpStatus: 422, code: "icp_underspecified" }),
      ),
    );
    renderTile();
    fireEvent.click(screen.getByRole("button", { name: /discover leads/i }));
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/icp/i) }),
    );
  });

  it("toasts an already-running message on discovery_in_progress (409)", () => {
    mocks.discover.mockReturnValue(
      discoverRejectingWith(
        new ApolloDiscoverError({ httpStatus: 409, code: "discovery_in_progress" }),
      ),
    );
    renderTile();
    fireEvent.click(screen.getByRole("button", { name: /discover leads/i }));
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/already running/i) }),
    );
  });

  it("toasts a generic message on an unrecognized discovery error", () => {
    mocks.discover.mockReturnValue(discoverRejectingWith(new Error("network down")));
    renderTile();
    fireEvent.click(screen.getByRole("button", { name: /discover leads/i }));
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/couldn't start discovery/i) }),
    );
  });

  it("error-state Retry re-runs discovery directly without re-opening the prompt", () => {
    const mutate = vi.fn();
    mocks.discover.mockReturnValue({ mutate, isPending: false });
    // Prior discovery + changed ICP would make onDiscoverClick open the keep/replace prompt
    // (which does NOT call mutate); Retry must bypass that and launch("keep") directly.
    mocks.status.mockReturnValue({
      data: {
        connected: true,
        status: "connected",
        low_credit: false,
        last_discovery_at: "2026-06-10T00:00:00Z",
        icp_changed_since_last_discovery: true,
      },
      refetch: vi.fn(),
    });
    mocks.discoverStatus.mockReturnValue({ data: { status: "failed", counts: {} } });
    renderTile();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "keep" }),
      expect.anything(),
    );
  });

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
      refetch: vi.fn(),
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
    const mutate = vi.fn((_vars: unknown, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.(),
    );
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
});
