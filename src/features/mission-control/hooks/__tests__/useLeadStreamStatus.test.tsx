import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useLeadStreamStatus } from "../useLeadStreamStatus";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useLeadStreamStatus", () => {
  it("returns the files rows", async () => {
    server.use(
      http.get("/api/leads/stream/status", () =>
        HttpResponse.json({ files: [{ file_id: "f1", filename: "leads.csv" }] }),
      ),
    );
    const { result } = renderHook(() => useLeadStreamStatus("u1", "org1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data?.[0]?.filename).toBe("leads.csv");
  });

  it("is disabled without userId/orgId", () => {
    const { result } = renderHook(() => useLeadStreamStatus("", "org1"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
