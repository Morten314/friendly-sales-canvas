import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useApolloWarmup } from "../useApolloWarmup";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useApolloWarmup", () => {
  it("fetches warmup when connected and enabled", async () => {
    server.use(
      http.get("/api/connectors/apollo/warmup", () =>
        HttpResponse.json({
          icp_configured: true,
          signals_generated: false,
          scout_completed: false,
          profiler_analyzed: false,
          ready_count: 1,
          unlocked: false,
          missing: [],
        }),
      ),
    );
    const { result } = renderHook(() => useApolloWarmup("o1", "u1", { connected: true }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data?.ready_count).toBe(1);
  });

  it("is disabled when not connected", () => {
    const { result } = renderHook(() => useApolloWarmup("o1", "u1", { connected: false }), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
