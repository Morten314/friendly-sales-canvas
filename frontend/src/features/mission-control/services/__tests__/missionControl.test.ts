import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { fetchDataSources, fetchLeadStreamStatus } from "../missionControl";

import { server } from "@/test/msw/server";

describe("fetchDataSources", () => {
  it("unwraps the documents envelope", async () => {
    server.use(
      http.get("/api/v2/user-documents", () =>
        HttpResponse.json({
          items: [{ file_id: "d1" }, { file_id: "d2" }],
          total: 2,
          limit: 500,
          offset: 0,
        }),
      ),
    );
    expect(await fetchDataSources("org1")).toHaveLength(2);
  });

  it("returns env.items for a single-item envelope", async () => {
    server.use(
      http.get("/api/v2/user-documents", () =>
        HttpResponse.json({ items: [{ file_id: "d1" }], total: 1, limit: 500, offset: 0 }),
      ),
    );
    expect(await fetchDataSources("org1")).toHaveLength(1);
  });
});

describe("fetchLeadStreamStatus", () => {
  it("returns the files array from the envelope", async () => {
    server.use(
      http.get("/api/leads/stream/status", () =>
        HttpResponse.json({ files: [{ file_id: "f1", filename: "leads.csv" }] }),
      ),
    );
    const rows = await fetchLeadStreamStatus("u1", "org1");
    expect(rows[0]?.filename).toBe("leads.csv");
  });
});
