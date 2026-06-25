import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import LeadsTable from "../LeadsTable";

beforeAll(() => {
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

vi.mock("@/shared/auth", () => ({
  useAuthToken: () => ({ currentUser: { uid: "u1" }, orgId: "o1", fetchOrgId: undefined }),
}));
vi.mock("@/shared/tenant", () => ({ useTenant: () => ({ selectedTenant: { id: "o1" } }) }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/shared/auth/jwt", () => ({ default: { getAuthHeader: async () => null } }));
vi.mock("@/shared/api/transport", () => ({
  buildApiUrl: (path: string) => `/api/${path}`,
  apiFetch: vi.fn(),
}));
vi.mock("@/features/signals", () => ({ useSignalLeadMap: () => ({ signalsForLead: () => [] }) }));
vi.mock("../../../services/orgLeads", () => ({ fetchAllOrgLeads: vi.fn().mockResolvedValue([]) }));

function renderTable() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LeadsTable />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LeadsTable — Title/Seniority columns", () => {
  it("renders Title and Seniority column headers", () => {
    renderTable();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Seniority")).toBeInTheDocument();
  });
});
