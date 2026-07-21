import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useMarketEntry } from "../useMarketEntry";

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

describe("useMarketEntry", () => {
  it("loads and parses the market-entry component for an org", async () => {
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useMarketEntry(USER_ID, ORG_ID), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeDefined();
    // Behavioral: a real parsed field is present.
    expect(result.current.data?.executiveSummary).toBeDefined();
    expect(Array.isArray(result.current.data?.entryBarriers)).toBe(true);
  });

  it("is disabled (no fetch) when orgId is empty", async () => {
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useMarketEntry(USER_ID, ""), { wrapper: Wrapper });

    // Disabled query never enters loading and yields no data.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("exposes a regenerate function", () => {
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useMarketEntry(USER_ID, ORG_ID), { wrapper: Wrapper });

    expect(typeof result.current.regenerate).toBe("function");
    expect(result.current.isRegenerating).toBe(false);
  });
});
