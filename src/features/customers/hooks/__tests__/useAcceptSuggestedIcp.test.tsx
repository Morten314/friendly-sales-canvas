import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useAcceptSuggestedIcp } from "../useAcceptSuggestedIcp";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useAcceptSuggestedIcp", () => {
  it("posts the accept and resolves", async () => {
    server.use(
      http.post("/api/customer_profile/from_suggested_icp", () =>
        HttpResponse.json({ success: true, data: { id: "p1" } }),
      ),
    );
    const { result } = renderHook(() => useAcceptSuggestedIcp("u1", "org1"), { wrapper });
    result.current.mutate("icp1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
  });
});
