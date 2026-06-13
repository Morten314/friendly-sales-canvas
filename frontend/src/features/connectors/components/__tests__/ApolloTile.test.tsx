import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ orgId: "o1", currentUser: { uid: "u1" } }),
}));

import { ApolloTile } from "../ApolloTile";

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

  it("shows zero-results widen-ICP affordance on completed_empty", () => {
    mocks.discoverStatus.mockReturnValue({
      data: { status: "completed_empty", counts: { searched: 80, created: 0, matched: 0 } },
    });
    renderTile();
    expect(screen.getByText(/no leads found/i)).toBeInTheDocument();
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
});
