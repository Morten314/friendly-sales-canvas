// Source-filter on LeadsTable (Task 13 / G6).
//
// The source-filter Select is rendered in the toolbar (render tests below), and the
// filter BEHAVIOR is verified two ways: the pure `filterLeadsBySource` unit tests
// (connectors/lib/__tests__/leadSource.test.ts) and, here, against the ACTUAL demo
// leads the table renders (the G6 data-dependency — all demo leads are the CSV bucket).
// Driving a Radix Select selection reliably in jsdom (pointer-capture + portal
// choreography) is impractical, so the end-to-end click is left to e2e (Playwright).

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import LeadsTable from "../LeadsTable";

import { filterLeadsBySource } from "@/features/connectors";
import { heatmapLeads } from "@/shared/lib/leadData";

// jsdom compat: Radix primitives reference scrollIntoView on mount in some paths.
beforeAll(() => {
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

// Stable mock refs (module-level) — an unstable identity returned per render would
// loop the container's sync-effects.
const STABLE_AUTH = { currentUser: null, orgId: "", fetchOrgId: undefined };
vi.mock("@/shared/auth", () => ({ useAuthToken: () => STABLE_AUTH }));

const STABLE_TENANT = { selectedTenant: null };
vi.mock("@/shared/tenant", () => ({ useTenant: () => STABLE_TENANT }));

const STABLE_TOAST = { toast: vi.fn() };
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => STABLE_TOAST }));

vi.mock("@/shared/auth/jwt", () => ({ default: { getAuthHeader: async () => null } }));

vi.mock("@/shared/api/transport", () => ({
  buildApiUrl: (path: string) => `/api/${path}`,
  apiFetch: vi.fn(),
}));

function renderTable() {
  return render(
    <MemoryRouter>
      <LeadsTable />
    </MemoryRouter>,
  );
}

describe("LeadsTable source filter (G6)", () => {
  it("renders the source-filter trigger defaulting to 'All leads'", () => {
    renderTable();
    const trigger = screen.getByRole("combobox", { name: /filter by lead source/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent(/all leads/i);
  });

  it("shows demo rows initially (default filter = all)", () => {
    renderTable();
    expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    expect(screen.queryByText(/no leads match/i)).not.toBeInTheDocument();
  });

  it("applies G6 source filtering to the actual demo leads the table renders", () => {
    // Every demo lead carries source "HubSpot" | "Prospect List" — the CSV (non-apollo)
    // bucket — so the Apollo filter empties the list while CSV/all keep every row.
    expect(heatmapLeads.length).toBeGreaterThan(0);
    expect(filterLeadsBySource(heatmapLeads, "all")).toHaveLength(heatmapLeads.length);
    expect(filterLeadsBySource(heatmapLeads, "apollo")).toHaveLength(0);
    expect(filterLeadsBySource(heatmapLeads, "csv")).toHaveLength(heatmapLeads.length);
  });
});
