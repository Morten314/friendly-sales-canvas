import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useIndustryTrends } from "./useIndustryTrends";

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

describe("useIndustryTrends", () => {
  it("fetches and returns parsed industry-trends data from the MSW handler", async () => {
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useIndustryTrends("user-1", "org-1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });

    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.executiveSummary).toBe(
      "AI adoption accelerating across enterprise verticals.",
    );
    expect(result.current.data?.aiAdoption).toBeDefined();
    expect(result.current.data?.risks).toBeInstanceOf(Array);
    expect(result.current.data?.trendSnapshots).toBeInstanceOf(Array);
  });

  it("exposes regenerate as a synchronous thunk", () => {
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useIndustryTrends("user-1", "org-1"), {
      wrapper: Wrapper,
    });

    // regenerate is a synchronous thunk — no waitFor needed
    expect(typeof result.current.regenerate).toBe("function");
  });
});
