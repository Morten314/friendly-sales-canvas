import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useDataSources } from "../useDataSources";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useDataSources", () => {
  it("returns the documents array", async () => {
    server.use(
      http.get("/api/v2/user-documents", () =>
        HttpResponse.json({ items: [{ file_id: "d1" }], total: 1, limit: 500, offset: 0 }),
      ),
    );
    const { result } = renderHook(() => useDataSources("org1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data).toHaveLength(1);
  });

  it("is disabled without orgId", () => {
    const { result } = renderHook(() => useDataSources(""), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
