import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useCompetitorLandscape } from "../useCompetitorLandscape";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useCompetitorLandscape", () => {
  it("surfaces the competitor report fields from the 5b hook", async () => {
    const { result } = renderHook(() => useCompetitorLandscape("user-1", "org-1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data?.uiComponents)).toBe(true);
    expect(result.current.data).toEqual(
      expect.objectContaining({ executiveSummary: expect.any(String) }),
    );
    expect(typeof result.current.refresh).toBe("function");
    expect(typeof result.current.isRefreshing).toBe("boolean");
  });

  it("is disabled (not loading) without an orgId", () => {
    const { result } = renderHook(() => useCompetitorLandscape("user-1", ""), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("propagates isError when the research-component query fails", async () => {
    const { result } = renderHook(() => useCompetitorLandscape("competitor-error-user", "org-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
