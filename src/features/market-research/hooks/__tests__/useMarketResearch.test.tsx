import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { RESEARCH_COMPONENTS } from "../../services/marketResearch";
import { useRegenerateResearch, useResearchComponent } from "../useMarketResearch";

import { qk } from "@/shared/api/queryKeys";
import { server } from "@/test/msw/server";

// Each test gets a fresh QueryClient so cache never leaks between tests.
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    client,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

const USER_ID = "u1";
const ORG_ID = "brewra";
const COMPONENT = RESEARCH_COMPONENTS.marketSize; // "market size & opportunity"

describe("useResearchComponent", () => {
  it("fetches and returns parsed data from the MSW handler", async () => {
    // Install a generic round-trip handler for the duration of this test. The shared
    // handler now returns a section-specific rich payload for "market size & opportunity"
    // (5h's useMarketSize fixture); this test only verifies generic fetch+parse, so it
    // owns its response shape — matching the server.use() pattern of the tests below.
    server.use(
      http.post("/api/market-research_claude", () =>
        HttpResponse.json({
          status: "success",
          data: { component_name: COMPONENT, title: "Test", summary: "Test summary" },
        }),
      ),
    );
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useResearchComponent(USER_ID, ORG_ID, COMPONENT), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data?.status).toBe("success");
    expect(result.current.data?.data).toMatchObject({
      component_name: COMPONENT,
      title: "Test",
      summary: "Test summary",
    });
  });

  it("does not fire when userId or orgId is empty", async () => {
    let callCount = 0;
    server.use(
      http.post("/api/market-research_claude", () => {
        callCount += 1;
        return HttpResponse.json({
          status: "success",
          data: { component_name: COMPONENT, title: "T", summary: "S" },
        });
      }),
    );
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useResearchComponent("", ORG_ID, COMPONENT), {
      wrapper: Wrapper,
    });
    // Give React Query a tick to attempt the query (it should not).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(callCount).toBe(0);
  });
});

describe("useRegenerateResearch", () => {
  it("writes mutation result into the component cache via setQueryData (no second POST)", async () => {
    // Track how many POSTs are made to /api/market-research_claude for this component.
    let postCount = 0;
    server.use(
      http.post("/api/market-research_claude", async ({ request }) => {
        postCount += 1;
        const body = (await request.json()) as { component_name?: string; refresh?: boolean };
        return HttpResponse.json({
          status: "success",
          data: {
            component_name: body.component_name ?? COMPONENT,
            title: body.refresh ? "Regenerated" : "Original",
            summary: body.refresh ? "Fresh summary" : "Cached summary",
          },
        });
      }),
    );

    const { client, Wrapper } = wrapper();

    // Mount both hooks together so they share the same QueryClient.
    const { result } = renderHook(
      () => ({
        query: useResearchComponent(USER_ID, ORG_ID, COMPONENT),
        mutation: useRegenerateResearch(USER_ID, ORG_ID),
      }),
      { wrapper: Wrapper },
    );

    // Wait for the initial read to settle (POST #1 — refresh: false).
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true), { timeout: 5000 });
    expect(postCount).toBe(1);
    expect(result.current.query.data?.data).toMatchObject({ title: "Original" });

    // Fire the mutation (POST #2 — refresh: true).
    await act(async () => {
      await result.current.mutation.mutateAsync(COMPONENT);
    });
    expect(postCount).toBe(2); // exactly 2 total — no third background refetch

    // The cache for this key must now hold the mutation result.
    const cached = client.getQueryData(qk.marketResearchComponent(ORG_ID, COMPONENT));
    expect(cached).toMatchObject({
      status: "success",
      data: { title: "Regenerated", summary: "Fresh summary" },
    });

    // Give React Query a tick — confirm no extra POST fires (invalidateQueries would
    // trigger a background refetch that increments postCount to 3).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(postCount).toBe(2); // still 2 — setQueryData, NOT invalidateQueries
  });
});
