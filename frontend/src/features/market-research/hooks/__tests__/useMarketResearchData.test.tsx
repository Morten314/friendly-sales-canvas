import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMarketResearchData } from "../useMarketResearchData";

// Coarse auth stub — the data layer keys its caches off currentUser.uid / orgId.
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "brewra" }),
}));

// Coarse fetch stub: every data-layer fetch (any of the 9 sites) resolves to one
// canned success envelope. We are smoke-testing shape + non-crashing init, not the
// per-component cascade — so a single stub for all sites is intentional.
const cannedEnvelope = {
  status: "success",
  report: {
    component_name: "market size & opportunity",
    executiveSummary: "",
    timestamp: null,
  },
  data: { component_name: "market size & opportunity", title: "Test", summary: "Test summary" },
};

beforeEach(() => {
  // Fresh Response per call — the hook fires several fetches on mount and each
  // consumes its own body, so a shared Response instance can't be reused.
  vi.spyOn(globalThis, "fetch").mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(cannedEnvelope), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

// The data layer now pushes validated envelopes into the TanStack cache via
// useQueryClient(), so the hook must render under a QueryClientProvider.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Tiny harness: the hook takes a routing-owned activeTab ref (the shell threads it in). */
function useHarness() {
  const activeTabRef = useRef("intelligence");
  return useMarketResearchData(activeTabRef);
}

describe("useMarketResearchData", () => {
  it("returns the data-layer shape and reaches a non-crashing initial state", async () => {
    const { result } = renderHook(() => useHarness(), { wrapper });

    // Core data states are present and start null-or-object (not undefined).
    expect(
      result.current.marketData === null || typeof result.current.marketData === "object",
    ).toBe(true);
    expect(typeof result.current.marketIntelligenceData).toBe("object");

    // Lifecycle + key setters/actions are exposed.
    expect(typeof result.current.isInitialLoading).toBe("boolean");
    expect(typeof result.current.isRefreshing).toBe("boolean");
    expect(typeof result.current.fetchMarketData).toBe("function");
    expect(typeof result.current.handleRefresh).toBe("function");
    expect(typeof result.current.setMarketData).toBe("function");

    // editHistory is the cross-tab record consumed by both trends + intelligence tabs.
    expect(Array.isArray(result.current.editHistory)).toBe(true);

    // Cache readers the shell status banners call.
    expect(typeof result.current.getUserCache).toBe("function");
    expect(typeof result.current.isCacheValid).toBe("function");

    // Settles without throwing once the mount-time fetches resolve.
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
  });
});
