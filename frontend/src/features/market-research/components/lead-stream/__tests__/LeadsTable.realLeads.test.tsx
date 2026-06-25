// Fix #1 — Scout "Your Lead Stream" sources the org's real leads (via the shared
// data layer, fetchAllOrgLeads → GET /api/v2/leads), so discovered/uploaded leads
// show regardless of whether a market-scoring run has happened, and demo
// placeholders are NOT shown for a real org. The fetch/pagination itself is unit-
// tested in services/__tests__/orgLeads.test.ts; here we mock the service and
// assert the table renders its output.
//
// Fix R2 (scored-row merge-path regression) — scored rows from POST
// /leads/market-scores overwrite real-lead rows by lead_id, so they must carry
// title/seniority (not "—"). The mapper itself (heatmapLeadFromUnknownRow producing
// title/seniority from a raw row) is unit-tested in marketScoresHeatmap.prospect.test.ts;
// the scored-row test below covers only the merge + render path, injecting a pre-mapped
// scored HeatmapLead via the session cache.

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

// ─── Fix R3: scored rows must inherit Title/Seniority from the real row ───────
// The /leads/market-scores response (typed response_model=LeadMarketScoreRow) carries
// NO title/seniority — FastAPI strips undeclared keys — so a scored row built from it
// has title/seniority=null. The byId merge lets the scored row win, so without a
// lossless merge it overwrites the enriched /v2/leads real row and Title/Seniority
// render "—". This test drives the REAL path: fetchAllOrgLeads returns a real lead WITH
// title/seniority, the market-scores fetch returns a LeadMarketScoreRow-shaped row
// WITHOUT them, and the merged row must still show the real row's prospect values while
// taking the scored row's score.

describe("LeadsTable scored-row merge-path (Fix R3 — lossless)", () => {
  // One real lead, carrying prospect fields (as /v2/leads → heatmapLeadFromV2Lead would).
  const REAL_WITH_PROSPECT: HeatmapLead[] = [
    {
      id: "L1",
      name: "Jane Founder",
      company: "astuto.ai",
      source: "apollo",
      ratings: {},
      totalScore: 0,
      priority: "Tier 3",
      title: "VP Engineering",
      seniority: "CXO",
      scored: false,
    },
  ];

  // Market-scores response shaped like the real LeadMarketScoreRow: lead_name +
  // company_name + scores, and deliberately NO title / seniority keys.
  const SCORED_RESPONSE = {
    org_id: "org1",
    total_leads: 1,
    processing_status: "completed",
    rows: [
      {
        lead_id: "L1",
        org_id: "org1",
        company_name: "astuto.ai",
        lead_name: "Jane Founder",
        score_market_size_opportunity: 80,
        score_industry_trends_report: 80,
        score_competitor_landscape: 80,
        score_regulatory_compliance_highlights: 80,
        score_market_entry_growth_strategy: 80,
        combined_score: 80,
        scoring_status: "completed",
        source: "apollo",
      },
    ],
  };

  beforeEach(() => {
    vi.mocked(fetchAllOrgLeads).mockResolvedValue(REAL_WITH_PROSPECT);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (String(url).includes("market-scores")) {
          return Promise.resolve(jsonResponse(SCORED_RESPONSE));
        }
        return Promise.resolve(jsonResponse({}, 404));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scored row wins the score but Title/Seniority survive from the real row", async () => {
    renderTable();

    // Real lead renders first (unscored).
    expect(await screen.findByText("Jane Founder")).toBeInTheDocument();

    // Trigger the market-scores fetch the way the Scout header Refresh does.
    window.dispatchEvent(new Event("scoutLeadStreamHeatmapRefresh"));

    // After merge: the scored row wins the score (Tier 1) AND the real row's
    // Title/Seniority survive (not "—").
    expect(await screen.findByText("VP Engineering")).toBeInTheDocument();
    expect(screen.getByText("CXO")).toBeInTheDocument();
    // Score won from the scored row (combined 80 → Tier 1). Guards against a merge
    // that kept the real row wholesale and dropped the score.
    expect(await screen.findByText("Tier 1")).toBeInTheDocument();
  });
});
