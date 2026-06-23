import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { fetchSignals, generateRecommendationArtefact, generateSignalsBatch } from "../signals";

import { server } from "@/test/msw/server";

describe("fetchSignals", () => {
  it("parses and returns the signals envelope", async () => {
    server.use(
      http.get("/api/v2/fetch-signals", () =>
        HttpResponse.json({ items: [{ id: "s1" }, { id: "s2" }], total: 2, limit: 10, offset: 0 }),
      ),
    );
    const res = await fetchSignals("u1");
    expect(res).toMatchObject({ signals: [{ id: "s1" }, { id: "s2" }] });
  });

  it("requests user_id, limit=10 and offset=0", async () => {
    let seenUrl = "";
    server.use(
      http.get("/api/v2/fetch-signals", ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({ items: [], total: 0, limit: 10, offset: 0 });
      }),
    );
    await fetchSignals("u1");
    expect(seenUrl).toContain("user_id=u1");
    expect(seenUrl).toContain("limit=10");
    expect(seenUrl).toContain("offset=0");
  });

  it("throws on a non-ok response", async () => {
    server.use(http.get("/api/v2/fetch-signals", () => new HttpResponse(null, { status: 500 })));
    await expect(fetchSignals("u1")).rejects.toThrow(/HTTP error! status: 500/);
  });

  it("throws when the response is not JSON", async () => {
    server.use(
      http.get(
        "/api/v2/fetch-signals",
        () => new HttpResponse("plain text", { headers: { "content-type": "text/plain" } }),
      ),
    );
    await expect(fetchSignals("u1")).rejects.toThrow(/not valid JSON/);
  });

  it("surfaces total from the v2 envelope", async () => {
    server.use(
      http.get("/api/v2/fetch-signals", () =>
        HttpResponse.json({ items: [{ id: "s1" }, { id: "s2" }], total: 2, limit: 10, offset: 0 }),
      ),
    );
    const res = await fetchSignals("u1");
    expect(res.total).toBe(2);
  });
});

describe("generateSignalsBatch", () => {
  function captureBody() {
    const captured: { body: Record<string, unknown> | null } = { body: null };
    server.use(
      http.post("/api/generate-signals-batch_claude", async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ signals: [] });
      }),
    );
    return captured;
  }

  it("sends the org's real company profile in the data block", async () => {
    const captured = captureBody();
    const res = await generateSignalsBatch("u1", null, {
      industry: "Renewable Energy",
      companySize: "500-1000 employees",
      companyUrl: "https://acme.example",
      strategicGoals: "EU expansion",
      primaryGTMModel: "Partner-led",
      revenueStage: "Scale-up",
      keyBuyerPersona: "VP Engineering",
      targetMarkets: ["DACH", "Nordics"],
    });
    expect(res).toMatchObject({ signals: [] });
    expect(captured.body).toMatchObject({
      user_id: "u1",
      component_name: "test",
      refresh: true,
      data: {
        industry: "Renewable Energy",
        companySize: "500-1000 employees",
        companyUrl: "https://acme.example",
        strategicGoals: "EU expansion",
        primaryGTMModel: "Partner-led",
        revenueStage: "Scale-up",
        keyBuyerPersona: "VP Engineering",
        targetMarkets: ["DACH", "Nordics"],
      },
    });
  });

  it("sends empty firmographics (never dummy placeholders) when no profile exists", async () => {
    const captured = captureBody();
    await generateSignalsBatch("u1", null, null);
    expect(captured.body?.data).toEqual({
      industry: "",
      companySize: "",
      companyUrl: "",
      strategicGoals: "",
      primaryGTMModel: "",
      revenueStage: "",
      keyBuyerPersona: "",
      targetMarkets: [],
    });
  });

  it("falls back to website / gtmModel aliases when the primary fields are absent", async () => {
    const captured = captureBody();
    await generateSignalsBatch("u1", null, { website: "https://w.example", gtmModel: "PLG" });
    expect(captured.body?.data).toMatchObject({
      companyUrl: "https://w.example",
      primaryGTMModel: "PLG",
    });
  });

  it("sends org_id in the body when an org is provided (so the backend can scope tenant retrieval)", async () => {
    const captured = captureBody();
    await generateSignalsBatch("u1", "org-42", null);
    expect(captured.body).toMatchObject({ user_id: "u1", org_id: "org-42" });
  });

  it("omits org_id when no org is available", async () => {
    const captured = captureBody();
    await generateSignalsBatch("u1", null, null);
    expect(captured.body).not.toHaveProperty("org_id");
  });

  it("throws on a non-ok response", async () => {
    server.use(
      http.post(
        "/api/generate-signals-batch_claude",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    await expect(generateSignalsBatch("u1", null, null)).rejects.toThrow(/HTTP error! status: 500/);
  });
});

describe("generateRecommendationArtefact", () => {
  it("generateRecommendationArtefact posts the body and forwards org_id only when present", async () => {
    const seen: Array<Record<string, unknown>> = [];
    server.use(
      http.post("/api/generate-recommendation-artefact_claude", async ({ request }) => {
        seen.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ what_to_do: "do", communication_channel: "email" });
      }),
    );
    const body = {
      signal_headline: "h",
      signal_description: "d",
      signal_sources: ["s"],
      matched_leads: [{ company: "Acme", relevance: "high" as const, why: "fit" }],
      recommendation: "r",
      recommendation_answer: "a",
    };
    const withOrg = await generateRecommendationArtefact("u1", "org1", body);
    expect(withOrg.what_to_do).toBe("do");
    expect(withOrg.strategy).toBe(""); // degraded
    expect(seen[0].org_id).toBe("org1");

    await generateRecommendationArtefact("u1", null, body);
    expect("org_id" in seen[1]).toBe(false); // omitted when null
  });
});
