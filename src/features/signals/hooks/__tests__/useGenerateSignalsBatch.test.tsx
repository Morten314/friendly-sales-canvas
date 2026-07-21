import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useGenerateSignalsBatch } from "../useGenerateSignalsBatch";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useGenerateSignalsBatch", () => {
  it("posts the batch generate and resolves", async () => {
    server.use(
      http.post("/api/generate-signals-batch_claude", () =>
        HttpResponse.json({ signals: [{ id: "g1" }] }),
      ),
    );
    const { result } = renderHook(() => useGenerateSignalsBatch(), { wrapper });
    await result.current.mutateAsync({ userId: "u1", orgId: null, profile: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data).toEqual({ signals: [{ id: "g1" }] });
  });
});
