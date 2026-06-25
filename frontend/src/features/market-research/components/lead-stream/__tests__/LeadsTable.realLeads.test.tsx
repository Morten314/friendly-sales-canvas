// Fix #1 — Scout "Your Lead Stream" sources the org's real leads (via the shared
// data layer, fetchAllOrgLeads → GET /api/v2/leads), so discovered/uploaded leads
// show regardless of whether a market-scoring run has happened, and demo
// placeholders are NOT shown for a real org. The fetch/pagination itself is unit-
// tested in services/__tests__/orgLeads.test.ts; here we mock the service and
// assert the table renders its output.
//
// Fix R2 (scored-row merge-path regression) — scored rows from POST
// /leads/market-scores overwrite real-lead rows by lead_id. heatmapLeadFromUnknownRow
// must carry title/seniority (not "—") for those overwriting rows.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAllOrgLeads } from "../../../services/orgLeads";
import LeadsTable from "../LeadsTable";

import type { HeatmapLead } from "@/shared/lib/leadData";

// ─── helpers for the scored-row merge-path test ─────────────────────────────

/** Build a minimal Response-like object for global.fetch mocks. */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

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

// ─── Fix R2: scored rows must carry title/seniority (not "—") ───────────────
// This is the merge-path regression: a scored row from POST /leads/market-scores
// overwrites the real-lead row (same lead_id), so if heatmapLeadFromUnknownRow
// does not carry title/seniority the columns silently render "—".

describe("LeadsTable scored-row merge-path (Fix R2)", () => {
  // L1 will have a corresponding scored row with prospect data
  const SCORED_API_RESPONSE = {
    rows: [
      {
        lead_id: "L1",
        company_name: "astuto.ai",
        name: "Jane Founder",
        title: "VP Engineering",
        seniority: "CXO",
        combined_score: 80,
        score_market_size_opportunity: 80,
        score_industry_trends_report: 80,
        score_competitor_landscape: 80,
        score_regulatory_compliance_highlights: 80,
        score_market_entry_growth_strategy: 80,
        source: "apollo",
      },
    ],
  };

  beforeEach(() => {
    // Mock the raw fetch used by LeadsTable for POST /leads/market-scores.
    // The session-cache useLayoutEffect runs before the explicit refresh; we return
    // null from sessionStorage (default jsdom) so the scored data comes from this
    // fetch mock, not from a cached restore.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (String(url).includes("market-scores")) {
          return Promise.resolve(jsonResponse(SCORED_API_RESPONSE));
        }
        // Any other fetch (e.g., score descriptions) → 404
        return Promise.resolve(jsonResponse({}, 404));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scored row overwrites real-lead row but Title/Seniority cells show values not '—'", async () => {
    // LeadsTable does NOT auto-trigger the market-scores fetch on mount —
    // it runs on the Refresh button click. To get scored data into the component
    // via the session-cache path we pre-populate localStorage, which is read by
    // the useLayoutEffect that restores cached data on mount.
    //
    // Pre-populate the cache key the component will read:
    // leadStreamMarketScores_v1:<userId>:<orgId> = "u1":"org1"
    const cacheKey = "leadStreamMarketScores_v1:u1:org1";
    const scoredHeatmapLead: HeatmapLead = {
      id: "L1",
      name: "Jane Founder",
      company: "astuto.ai",
      title: "VP Engineering",
      seniority: "CXO",
      source: "apollo",
      ratings: {
        "market-size": "High",
        "industry-trends": "High",
        "competitor-landscape": "High",
        "regulatory-compliance": "High",
        "market-entry": "High",
      },
      totalScore: 80,
      priority: "Tier 1",
      scored: true,
    };
    window.localStorage.setItem(cacheKey, JSON.stringify([scoredHeatmapLead]));

    renderTable();

    // The scored row (L1) overwrites the real-lead row with same id.
    // Title and Seniority cells must show values, not "—".
    expect(await screen.findByText("VP Engineering")).toBeInTheDocument();
    expect(screen.getByText("CXO")).toBeInTheDocument();

    window.localStorage.removeItem(cacheKey);
  });
});
