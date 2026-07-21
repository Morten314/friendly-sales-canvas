// fetchAllOrgLeads — pages GET /api/v2/leads through the shared data layer
// (apiGet) and maps each row to an unscored HeatmapLead. (impl-review-1 F1)

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/client", () => ({ apiGet: vi.fn() }));

import { fetchAllOrgLeads } from "../orgLeads";

import { apiGet } from "@/shared/api/client";

const mockApiGet = vi.mocked(apiGet);

beforeEach(() => mockApiGet.mockReset());

describe("fetchAllOrgLeads", () => {
  it("maps a single page of /v2/leads rows to unscored HeatmapLeads", async () => {
    mockApiGet.mockResolvedValueOnce({
      items: [
        {
          lead_id: "L1",
          company_name: "astuto.ai",
          name: "Jane",
          source: "apollo",
          email_status: "verified",
        },
        { lead_id: "L2", company_name: "Flowace.ai", source: "apollo" },
      ],
      total: 2,
    });
    const leads = await fetchAllOrgLeads("org1");
    expect(leads).toHaveLength(2);
    expect(leads[0]).toMatchObject({
      id: "L1",
      company: "astuto.ai",
      source: "apollo",
      scored: false,
      totalScore: 0,
    });
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    // routed through the data layer with org + pagination params
    expect(String(mockApiGet.mock.calls[0][0])).toContain("v2/leads?org_id=org1");
  });

  it("pages until total is reached (handles >500 leads — the old hand-fetch capped at 500)", async () => {
    const fullPage = Array.from({ length: 500 }, (_, i) => ({ lead_id: `p1-${i}` }));
    mockApiGet
      .mockResolvedValueOnce({ items: fullPage, total: 502 })
      .mockResolvedValueOnce({ items: [{ lead_id: "p2-0" }, { lead_id: "p2-1" }], total: 502 });
    const leads = await fetchAllOrgLeads("org1");
    expect(leads).toHaveLength(502);
    expect(mockApiGet).toHaveBeenCalledTimes(2);
  });

  it("drops rows with no usable lead id", async () => {
    mockApiGet.mockResolvedValueOnce({
      items: [{ company_name: "NoId" }, { lead_id: "L9" }],
      total: 2,
    });
    const leads = await fetchAllOrgLeads("org1");
    expect(leads.map((l) => l.id)).toEqual(["L9"]);
  });
});
