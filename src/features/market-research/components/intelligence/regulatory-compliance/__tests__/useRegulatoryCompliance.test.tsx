import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useRegulatoryCompliance } from "../useRegulatoryCompliance";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useRegulatoryCompliance", () => {
  it("surfaces the regulatory report fields from the 5b hook", async () => {
    const { result } = renderHook(() => useRegulatoryCompliance("user-1", "org-1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.regulatoryData).toBeDefined();
    expect(Object.keys(result.current.regulatoryData ?? {})).toEqual(
      expect.arrayContaining([
        "keyUpdates",
        "visualDataCards",
        "regionalData",
        "strategicRecommendations",
      ]),
    );
  });
  it("exposes refresh() and isRefreshing", () => {
    const { result } = renderHook(() => useRegulatoryCompliance("user-1", "org-1"), { wrapper });
    expect(typeof result.current.refresh).toBe("function");
    expect(typeof result.current.isRefreshing).toBe("boolean");
  });
});
