import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ICP } from "../../../types";
import ICPManager from "../ICPManager";

function renderWithQueryClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// Auth so the read hook is enabled and the settle effect has a uid.
vi.mock("@/shared/auth", () => ({
  useAuthToken: () => ({ currentUser: { uid: "u1" }, orgId: "brewra" }),
}));

// Toast is a no-op for these container tests.
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Stable module-scope rows: one raw profiler ICP record. A fresh array identity
// each render would re-run the mapping effect ([icpRows] dep) and loop.
const ICP_ROWS = [
  {
    icp_id: "icp-1",
    primary_region: "Europe",
    location: ["Berlin"],
    industry: ["SaaS"],
    company_size: ["11–50"],
    buyer_role: ["CTO"],
    accounts_on_watchlist: [],
    accounts_to_avoid: [],
    fit_confidence: "high",
    additional_context: "",
    status: "saved",
  },
];

// Mutable holder so individual tests can flip the hook's return without
// re-mocking. Stable references for the empty case too.
const hookState = {
  data: ICP_ROWS as unknown,
  isLoading: false,
  isError: false,
  isSuccess: true,
};

vi.mock("../../../hooks/useICPs", () => ({
  useICPs: () => hookState,
}));

// The shared profiler merge is identity-ish here (it returns the record); keep
// it real-shaped but trivial so the mapping effect produces deterministic rows.
vi.mock("@/shared/profiler", () => ({
  mergeProfilerAcceptedIcpDisplay: (r: Record<string, unknown>) => r,
  removeProfilerAcceptedIcpDisplayMeta: vi.fn(),
  buildCustomerProfileSavePayload: vi.fn(),
  invalidateMissionControlCache: vi.fn(),
  invalidateProfilerCache: vi.fn(),
}));

// Mock the two children so we can assert wiring without their internal DOM.
vi.mock("../IcpList", () => ({
  default: (props: { icps: ICP[]; isAddingInline: boolean }) => (
    <div data-testid="icp-list">{`icps:${props.icps.length} adding:${props.isAddingInline}`}</div>
  ),
}));

vi.mock("../IcpWizard", () => ({
  default: (props: { initial?: ICP }) => (
    <div data-testid="icp-wizard">{`initial:${props.initial?.id ?? "none"}`}</div>
  ),
}));

afterEach(() => {
  vi.clearAllMocks();
  // Reset hook state to the default (populated, settled) case.
  hookState.data = ICP_ROWS;
  hookState.isLoading = false;
  hookState.isError = false;
  hookState.isSuccess = true;
});

describe("ICPManager (container)", () => {
  it("maps the raw ICP rows from useICPs and passes them to IcpList", async () => {
    renderWithQueryClient(<ICPManager />);
    const list = await screen.findByTestId("icp-list");
    expect(list).toHaveTextContent("icps:1");
  });

  it("gates the wizard off in the default (non-adding) state", () => {
    renderWithQueryClient(<ICPManager />);
    expect(screen.queryByTestId("icp-wizard")).not.toBeInTheDocument();
  });

  it("opens the wizard in add mode when the header Add ICP button is clicked", async () => {
    renderWithQueryClient(<ICPManager />);
    await screen.findByTestId("icp-list");
    // The header Add button is shown because there is at least one ICP.
    fireEvent.click(screen.getByRole("button", { name: /Add ICP/i }));
    const wizard = await screen.findByTestId("icp-wizard");
    // Add mode → no seeded initial.
    expect(wizard).toHaveTextContent("initial:none");
  });

  it("fires the load-finished settle event once the read has settled", () => {
    const handler = vi.fn();
    window.addEventListener("icpManagerCustomerProfileLoadFinished", handler);
    renderWithQueryClient(<ICPManager />);
    expect(handler).toHaveBeenCalled();
    window.removeEventListener("icpManagerCustomerProfileLoadFinished", handler);
  });
});
