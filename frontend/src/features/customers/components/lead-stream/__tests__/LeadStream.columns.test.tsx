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
    data: { pages: [{ items: [lead], total: 1 }] },
    isLoading: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}));
vi.mock("@/features/signals", () => ({ useSignalLeadMap: () => ({ signalsForLead: () => [] }) }));
vi.mock("@/shared/auth/AuthContext", () => ({ useAuth: () => ({ orgId: "o1" }) }));
vi.mock("@/shared/tenant", () => ({ useTenant: () => ({ selectedTenant: { id: "o1" } }) }));
vi.mock("@/features/connectors", () => ({
  LEAD_SOURCE_OPTIONS: [{ value: "all", label: "All leads" }],
  LeadSourceBadge: () => null,
  filterLeadsBySource: (l: unknown[]) => l,
}));

describe("Customers LeadStream — Title/Seniority columns", () => {
  it("renders Title + Seniority headers and the lead's values", () => {
    render(<LeadStreamPanel orgId="o1" />);
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Seniority")).toBeInTheDocument();
    expect(screen.getByText("VP Engineering")).toBeInTheDocument();
    expect(screen.getByText("CXO")).toBeInTheDocument();
  });
});
