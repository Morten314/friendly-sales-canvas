// Phase 5b — service fn tests for fetchResearchComponent.
// MSW server lifecycle is handled globally by src/test/setup.ts (beforeAll/afterEach/afterAll).
// This file only imports `server` for one-off handler overrides.
import { QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import {
  fetchResearchComponent,
  RESEARCH_COMPONENTS,
  syncResearchComponentToQueryCache,
} from "../marketResearch";

import { qk } from "@/shared/api/queryKeys";
import { server } from "@/test/msw/server";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("syncResearchComponentToQueryCache", () => {
  it("writes the legacy fetch response into the TanStack cache for each component", () => {
    const queryClient = new QueryClient();
    const response = {
      status: "success",
      data: { executiveSummary: "Competitor overview", topPlayerShare: "35%" },
    };

    syncResearchComponentToQueryCache(
      queryClient,
      "org-1",
      RESEARCH_COMPONENTS.competitor,
      response,
    );

    expect(
      queryClient.getQueryData(qk.marketResearchComponent("org-1", RESEARCH_COMPONENTS.competitor)),
    ).toEqual(response);
  });
});

describe("fetchResearchComponent", () => {
  it("returns a parsed ResearchComponentResponse from the shipped MSW handler", async () => {
    const result = await fetchResearchComponent("user-abc", RESEARCH_COMPONENTS.marketSize);

    // Response envelope must parse: { status, data }
    expect(result.status).toBe("success");
    expect(result.data).toBeDefined();
    // MSW handler echoes back the component_name we sent
    expect(result.data["component_name"]).toBe(RESEARCH_COMPONENTS.marketSize);
  });

  it("sends optional orgId and refresh flags in the body", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("/api/market-research_claude", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          status: "success",
          data: { component_name: "industry trends report" },
        });
      }),
    );

    await fetchResearchComponent("user-xyz", RESEARCH_COMPONENTS.industryTrends, {
      orgId: "org-999",
      refresh: true,
      data: { region: "APAC" },
    });

    expect(capturedBody).toMatchObject({
      user_id: "user-xyz",
      org_id: "org-999",
      component_name: RESEARCH_COMPONENTS.industryTrends,
      data: { region: "APAC" },
      refresh: true,
    });
  });

  it("defaults data to {} and refresh to false when opts are omitted", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("/api/market-research_claude", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ status: "success", data: {} });
      }),
    );

    await fetchResearchComponent("user-def", RESEARCH_COMPONENTS.regulatory);

    expect(capturedBody).toMatchObject({
      data: {},
      refresh: false,
    });
  });

  it("rejects with a ZodError when the response does not match ResearchComponentSchema (no 'status' field)", async () => {
    server.use(
      http.post("/api/market-research_claude", () =>
        // Junk response — missing required 'status' field
        HttpResponse.json({}),
      ),
    );

    await expect(
      fetchResearchComponent("user-bad", RESEARCH_COMPONENTS.competitor),
    ).rejects.toThrow(ZodError);
  });
});
