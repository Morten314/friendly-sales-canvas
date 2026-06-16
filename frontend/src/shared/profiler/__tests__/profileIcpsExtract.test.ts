import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { fetchIcpsRowsForOrg, IcpRowSchema } from "../profileIcpsExtract";

import { server } from "@/test/msw/server";

describe("fetchIcpsRowsForOrg schema", () => {
  it("returns schema-validated rows preserving snake+camel fields", async () => {
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})),
      http.get("/api/customer_profile", () =>
        HttpResponse.json({
          icps: [
            { id: "i1", icp_name: "FinTech", company_size: ["50-200"], fit_confidence: "high" },
            { icpId: "i2", name: "Health", buyerRole: ["CFO"], extra: "kept" },
          ],
        }),
      ),
    );
    const rows = await fetchIcpsRowsForOrg("u1", "org1");
    expect(rows).toHaveLength(2);
    expect(IcpRowSchema.array().safeParse(rows).success).toBe(true);
    expect(rows[1]).toMatchObject({ icpId: "i2", extra: "kept" }); // passthrough kept
  });
});
