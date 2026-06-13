import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  warmup: vi.fn(),
  discoverStatus: vi.fn(),
  discover: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  exportLeads: vi.fn(() => vi.fn()),
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
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ orgId: "o1", currentUser: { uid: "u1" } }),
}));

import { ApolloDiscoverError } from "../../services/apollo";
import { ApolloTile } from "../ApolloTile";

// Drive launch() onError by having the discover mock invoke the supplied onError synchronously.
function discoverRejectingWith(err: unknown) {
  return {
    mutate: (_vars: unknown, opts?: { onError?: (e: unknown) => void }) => opts?.onError?.(err),
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

  it("shows the key-error message + Retry when credentials errored", () => {
    mocks.status.mockReturnValue({
      data: {
        connected: true,
        status: "error",
        low_credit: false,
        icp_changed_since_last_discovery: false,
      },
    });
    renderTile();
    expect(screen.getByText(/reconnect to resume discovery/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
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
});
