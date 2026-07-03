// Regression test for the org-tenant reunification bug (spec 46). LeadsTable
// used to fold a legacy tenant-selection value read from localStorage (e.g.
// the default "brewra" slug written at login) into org resolution ahead of
// the authenticated org, silently scoping every lead-stream read to the wrong
// org. useOrgId() (spec 46 WS1/WS2) is now the sole resolution path — it
// folds in the authoritative GET /org fetch and never reads any persisted
// tenant state (that state is fully retired — see src/app/clearStaleTenantKeys.ts).

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
  it("resolves org from auth, ignoring any stale legacy tenant-selection localStorage", async () => {
    localStorage.setItem(
      "legacyTenantSelection_u1",
      JSON.stringify({ id: "brewra", name: "Brewra" }),
    );

    renderTable();

    await waitFor(() => expect(fetchAllOrgLeads).toHaveBeenCalled());
    expect(fetchAllOrgLeads).toHaveBeenCalledWith(REAL_ORG_ID);
    expect(fetchAllOrgLeads).not.toHaveBeenCalledWith("brewra");
  });
});
