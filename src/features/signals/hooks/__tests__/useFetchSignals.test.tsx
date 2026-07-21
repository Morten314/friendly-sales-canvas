import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useFetchSignals } from "../useFetchSignals";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useFetchSignals", () => {
  it("returns the parsed feed data", async () => {
    server.use(
      http.get("/api/v2/fetch-signals", () =>
        HttpResponse.json({ items: [{ id: "s1" }], total: 1, limit: 10, offset: 0 }),
      ),
    );
    const { result } = renderHook(() => useFetchSignals("u1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data).toEqual({ signals: [{ id: "s1" }], total: 1 });
  });

  it("is disabled without userId", () => {
    const { result } = renderHook(() => useFetchSignals(""), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
