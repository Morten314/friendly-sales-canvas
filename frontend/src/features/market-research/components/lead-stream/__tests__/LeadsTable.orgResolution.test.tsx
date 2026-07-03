// Regression test for the org-tenant reunification bug (spec 46). LeadsTable
// used to resolve org as `selectedTenant?.id ?? authOrgId ?? ""`, so a stale
// tenant selection persisted in localStorage (e.g. the default "brewra" slug
// written at login) would win the resolution and silently scope every
// lead-stream read to the wrong org. useOrgId() (spec 46 WS1/WS2) is now the
// sole resolution path — it folds in the authoritative GET /org fetch and
// never reads a persisted/stale tenant.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAllOrgLeads } from "../../../services/orgLeads";
import LeadsTable from "../LeadsTable";

beforeAll(() => {
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

// Real org id, as resolved by the authoritative GET /org fetch (useOrgId).
const REAL_ORG_ID = "b75ce29e";

const STABLE_AUTH = { currentUser: { uid: "u1" }, orgId: REAL_ORG_ID, fetchOrgId: undefined };
vi.mock("@/shared/auth", () => ({
  useAuthToken: () => STABLE_AUTH,
  useOrgId: () => REAL_ORG_ID,
}));

// Mocked (not the real TenantProvider-backed module — see LeadsTable.realLeads.test.tsx
// for the same convention) so it reflects whatever a stale tenant selection left in
// localStorage, without requiring a real TenantProvider/Firebase context. This is the
// bug's actual failure mode: a leftover `selectedTenant_<uid>` entry from a previous
// session or the CSV-upload path's "brewra" default.
vi.mock("@/shared/tenant", () => ({
  useTenant: () => {
    const stored = localStorage.getItem("selectedTenant_u1");
    return { selectedTenant: stored ? JSON.parse(stored) : null };
  },
}));

const STABLE_TOAST = { toast: vi.fn() };
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => STABLE_TOAST }));
vi.mock("@/shared/auth/jwt", () => ({ default: { getAuthHeader: async () => null } }));
vi.mock("@/shared/api/transport", () => ({
  buildApiUrl: (path: string) => `/api/${path}`,
  apiFetch: vi.fn(),
}));
vi.mock("@/features/signals", () => ({ useSignalLeadMap: () => ({ signalsForLead: () => [] }) }));
vi.mock("../../../services/orgLeads", () => ({ fetchAllOrgLeads: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(fetchAllOrgLeads).mockResolvedValue([]);
});

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

describe("LeadsTable org resolution (spec 46 — kills the tenant-first bug)", () => {
  it("resolves org from auth, ignoring any stale selectedTenant localStorage", async () => {
    localStorage.setItem("selectedTenant_u1", JSON.stringify({ id: "brewra", name: "Brewra" }));

    renderTable();

    await waitFor(() => expect(fetchAllOrgLeads).toHaveBeenCalled());
    expect(fetchAllOrgLeads).toHaveBeenCalledWith(REAL_ORG_ID);
    expect(fetchAllOrgLeads).not.toHaveBeenCalledWith("brewra");
  });
});
