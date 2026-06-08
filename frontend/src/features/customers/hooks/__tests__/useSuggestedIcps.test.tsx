import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useSuggestedIcps } from "../useSuggestedIcps";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useSuggestedIcps", () => {
  it("returns the parsed /icp envelope", async () => {
    server.use(
      http.get("/api/v2/icp", () =>
        HttpResponse.json({ items: [{ id: "r1" }], total: 1, limit: 500, offset: 0 }),
      ),
    );
    const { result } = renderHook(() => useSuggestedIcps("u1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data).toMatchObject({ suggestedICPs: [{ id: "r1" }] });
  });

  it("is disabled without userId", () => {
    const { result } = renderHook(() => useSuggestedIcps(""), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
