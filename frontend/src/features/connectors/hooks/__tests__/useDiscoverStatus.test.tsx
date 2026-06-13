import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useDiscoverStatus, isTerminalStatus } from "../useDiscoverStatus";

import { qk } from "@/shared/api/queryKeys";
import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("isTerminalStatus", () => {
  it("treats queued/processing as non-terminal and the rest as terminal", () => {
    expect(isTerminalStatus("queued")).toBe(false);
    expect(isTerminalStatus("processing")).toBe(false);
    expect(isTerminalStatus("completed")).toBe(true);
    expect(isTerminalStatus("completed_empty")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
    expect(isTerminalStatus("partial")).toBe(true);
  });
});

describe("useDiscoverStatus", () => {
  it("fetches when a runId is present", async () => {
    server.use(
      http.get("/api/connectors/apollo/discover/status", () =>
        HttpResponse.json({
          run_id: "r1",
          org_id: "o1",
          status: "completed",
          mode: "keep",
          counts: { created: 5, matched: 0, errors: [] },
          credits_consumed: 5,
          progress_percent: 100,
        }),
      ),
    );
    const { result } = renderHook(() => useDiscoverStatus("o1", "r1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data?.counts.created).toBe(5);
  });

  it("is idle with no runId", () => {
    const { result } = renderHook(() => useDiscoverStatus("o1", null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("invalidates apolloStatus when the run reaches a terminal status", async () => {
    server.use(
      http.get("/api/connectors/apollo/discover/status", () =>
        HttpResponse.json({
          run_id: "r1",
          org_id: "o1",
          status: "completed",
          mode: "keep",
          counts: { created: 5, matched: 0, errors: [] },
          credits_consumed: 5,
          progress_percent: 100,
        }),
      ),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    function localWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    renderHook(() => useDiscoverStatus("o1", "r1"), { wrapper: localWrapper });
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: qk.apolloStatus("o1") }),
    );
  });
});
