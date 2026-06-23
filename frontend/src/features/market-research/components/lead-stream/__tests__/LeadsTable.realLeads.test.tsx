// Fix #1 — Scout "Your Lead Stream" sources the org's real leads from
// GET /api/v2/leads (the same source the Customers Lead Stream uses), so
// discovered/uploaded leads show regardless of whether a market-scoring run
// has happened, and demo placeholders are NOT shown for a real org.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import LeadsTable from "../LeadsTable";

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

const V2_LEADS = {
  items: [
    {
      lead_id: "L1",
      company_name: "astuto.ai",
      name: "Jane Founder",
      source: "apollo",
      email_status: "verified",
    },
    { lead_id: "L2", company_name: "Flowace.ai", source: "apollo" },
  ],
  total: 2,
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("v2/leads")) {
        return { ok: true, status: 200, json: async () => V2_LEADS } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
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
    // Real leads from /v2/leads appear (L2 has no person name, so "Flowace.ai"
    // renders in both the Lead and Company columns → use findAllByText).
    expect(await screen.findByText("Jane Founder")).toBeInTheDocument();
    expect(await screen.findByText("astuto.ai")).toBeInTheDocument();
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
    // Both real leads are unscored (no market-scoring run) → Unscored badges.
    expect(screen.getAllByText("Unscored").length).toBeGreaterThanOrEqual(2);
  });
});
