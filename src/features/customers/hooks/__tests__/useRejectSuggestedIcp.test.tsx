import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useRejectSuggestedIcp, useDeleteCurrentIcp } from "../useRejectSuggestedIcp";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("reject + delete mutations", () => {
  it("rejects a recommended ICP", async () => {
    server.use(http.delete("/api/icp/recommended/:id", () => HttpResponse.json({ success: true })));
    const { result } = renderHook(() => useRejectSuggestedIcp("u1"), { wrapper });
    result.current.mutate("icp1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
  });

  it("deletes a current ICP", async () => {
    server.use(
      http.delete("/api/customer_profile/icp/:id", () => HttpResponse.json({ success: true })),
    );
    const { result } = renderHook(() => useDeleteCurrentIcp("u1", "org1"), { wrapper });
    result.current.mutate("icp1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
  });
});
