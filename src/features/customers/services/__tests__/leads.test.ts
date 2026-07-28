import { QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { fetchLeads } from "../leads";

import { server } from "@/test/msw/server";

void QueryClient;

describe("fetchLeads", () => {
  it("maps the v2 paginated leads envelope to display rows", async () => {
    server.use(
      http.get("/api/v2/leads", () =>
        HttpResponse.json({
          items: [
            { lead_id: "l1", lead_name: "Tom", company_name: "Acme", source: "apollo" },
            { lead_id: "l2", company: "Beta", source: null },
          ],
          total: 2,
          limit: 50,
          offset: 0,
        }),
      ),
    );
    const { items: rows } = await fetchLeads("org1");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "l1", name: "Tom", company: "Acme", source: "apollo" });
    expect(rows[1]).toMatchObject({ id: "l2", company: "Beta", source: null });
    expect(rows[1].name).toBe("Beta"); // falls back to company when no name
  });

  it("requests the given page offset and surfaces total", async () => {
    let seenUrl = "";
    server.use(
      http.get("/api/v2/leads", ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({ items: [{ lead_id: "l9" }], total: 120, limit: 50, offset: 50 });
      }),
    );
    const page = await fetchLeads("org1", 50);
    expect(seenUrl).toContain("offset=50");
    expect(page.total).toBe(120);
    expect(page.items).toHaveLength(1);
  });
});
