// Fix #1 — Scout "Your Lead Stream" sources the org's real leads (via the shared
// data layer, fetchAllOrgLeads → GET /api/v2/leads), so discovered/uploaded leads
// show regardless of whether a market-scoring run has happened, and demo
// placeholders are NOT shown for a real org. The fetch/pagination itself is unit-
// tested in services/__tests__/orgLeads.test.ts; here we mock the service and
// assert the table renders its output.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAllOrgLeads } from "../../../services/orgLeads";
import LeadsTable from "../LeadsTable";

import type { HeatmapLead } from "@/shared/lib/leadData";

beforeAll(() => {
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

// An org is present (tenant + auth), so the table loads real leads and never demo.
const STABLE_AUTH = { currentUser: { uid: "u1" }, orgId: "org1", fetchOrgId: undefined };
vi.mock("@/shared/auth", () => ({ useAuthToken: () => STABLE_AUTH }));
const STABLE_TENANT = { selectedTenant: { id: "org1" } };
vi.mock("@/shared/tenant", () => ({ useTenant: () => STABLE_TENANT }));
const STABLE_TOAST = { toast: vi.fn() };
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => STABLE_TOAST }));
vi.mock("@/shared/auth/jwt", () => ({ default: { getAuthHeader: async () => null } }));
vi.mock("@/shared/api/transport", () => ({
  buildApiUrl: (path: string) => `/api/${path}`,
  apiFetch: vi.fn(),
}));
// Keep the signal-lead-map overlay inert in this test (it only adds "relevant signals").
vi.mock("@/features/signals", () => ({ useSignalLeadMap: () => ({ signalsForLead: () => [] }) }));
// The real-leads loader is unit-tested separately; mock it here.
vi.mock("../../../services/orgLeads", () => ({ fetchAllOrgLeads: vi.fn() }));

const REAL_LEADS: HeatmapLead[] = [
  {
    id: "L1",
    name: "Jane Founder",
    company: "astuto.ai",
    source: "apollo",
    ratings: {},
    totalScore: 0,
    priority: "Tier 3",
    email_status: "verified",
    scored: false,
  },
  {
    id: "L2",
    name: "Flowace.ai",
    company: "Flowace.ai",
    source: "apollo",
    ratings: {},
    totalScore: 0,
    priority: "Tier 3",
    scored: false,
  },
];

beforeEach(() => {
  vi.mocked(fetchAllOrgLeads).mockResolvedValue(REAL_LEADS);
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

describe("LeadsTable real leads (Fix #1)", () => {
  it("shows the org's real /v2/leads leads, not demo placeholders", async () => {
    renderTable();
    expect(await screen.findByText("Jane Founder")).toBeInTheDocument();
    expect(await screen.findByText("astuto.ai")).toBeInTheDocument();
    // L2 has no person name, so "Flowace.ai" renders in both the Lead and Company columns.
    expect((await screen.findAllByText("Flowace.ai")).length).toBeGreaterThan(0);
    // ...and the demo placeholder leads do not.
    expect(screen.queryByText("Sarah Chen")).not.toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
  });

  it("labels the data as Live API (not Sample data) once real leads load", async () => {
    renderTable();
    expect(await screen.findByText("astuto.ai")).toBeInTheDocument();
    expect(screen.getByText("Live API")).toBeInTheDocument();
    expect(screen.queryByText("Sample data")).not.toBeInTheDocument();
  });

  it("renders unscored real leads with an Unscored tier badge (no fake score)", async () => {
    renderTable();
    expect(await screen.findByText("astuto.ai")).toBeInTheDocument();
    expect(screen.getAllByText("Unscored").length).toBeGreaterThanOrEqual(2);
  });
});
