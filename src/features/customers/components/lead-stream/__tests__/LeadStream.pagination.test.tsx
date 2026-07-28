import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LeadStreamPanel } from "../LeadStream";

const lead = {
  id: "l1",
  name: "Jane Doe",
  company: "Acme",
  title: "VP Engineering",
  seniority: "CXO",
  source: null,
  emailStatus: null,
};

vi.mock("../../../hooks/useLeads", () => ({
  useLeads: () => ({
    // A populated first page, mid-pagination: isLoading is settled (false),
    // but isFetching is true — this is the shape both `fetchNextPage()`
    // ("Load more") and a background refetch report while leads already exist.
    data: { pages: [{ items: [lead], total: 2 }] },
    isLoading: false,
    isFetching: true,
    hasNextPage: true,
    isFetchingNextPage: true,
    fetchNextPage: vi.fn(),
  }),
}));
vi.mock("@/features/signals", () => ({ useSignalLeadMap: () => ({ signalsForLead: () => [] }) }));
vi.mock("@/shared/auth/AuthContext", () => ({ useAuth: () => ({ orgId: "o1" }) }));
vi.mock("@/shared/auth", () => ({ useOrgId: () => "o1" }));
vi.mock("@/features/connectors", () => ({
  LEAD_SOURCE_OPTIONS: [{ value: "all", label: "All leads" }],
  LeadSourceBadge: () => null,
  filterLeadsBySource: (l: unknown[]) => l,
}));

describe("Customers LeadStream — populated table during pagination/background refetch", () => {
  it("keeps the table visible (not the full-panel spinner) while isFetching is true and leads are already loaded", () => {
    render(<LeadStreamPanel orgId="o1" />);

    // Regression guard: isFetching:true with leads already present (Load-more /
    // background refetch) must NOT blank the populated table behind the
    // full-panel spinner — the table, and the Load-more button's own
    // "Loading…" state, must stay visible instead.
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.queryByText("No prospect data yet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /loading/i })).toBeInTheDocument();
  });
});
