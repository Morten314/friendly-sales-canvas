import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useSignalLeadMap } from "../useSignalLeadMap";

import { qk } from "@/shared/api/queryKeys";
import { server } from "@/test/msw/server";

vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" } }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const RESPONSE = {
  status: "success",
  data: {
    mapping: [
      {
        signal_id: "s1",
        headline: "Hiring surge",
        leads: [{ lead_id: "l1", company: "Acme", relevance: "high", why: "match" }],
      },
      {
        signal_id: "s2",
        headline: "Funding",
        leads: [{ lead_id: "l1", company: "Acme", relevance: "low", why: "weak" }],
      },
    ],
  },
};

describe("useSignalLeadMap", () => {
  it("inverts the mapping for both directions", async () => {
    server.use(http.post("/api/signal-lead-map_claude", () => HttpResponse.json(RESPONSE)));
    const { result } = renderHook(() => useSignalLeadMap("org1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(result.current.leadsForSignal("s1")).toHaveLength(1);
    expect(result.current.signalsForLead("l1").map((s) => s.signal_id)).toEqual(["s1", "s2"]);
    expect(result.current.signalsForLead("l1")[0].relevance).toBe("high");
  });

  it("returns empty selectors when disabled (no orgId)", () => {
    const { result } = renderHook(() => useSignalLeadMap(""), { wrapper });
    expect(result.current.leadsForSignal("s1")).toEqual([]);
    expect(result.current.signalsForLead("l1")).toEqual([]);
  });

  it("keys the cache by both orgId and userId (spec §8)", () => {
    expect(qk.signalLeadMap("org1", "u1")).toEqual(["signals", "lead-map", "org1", "u1"]);
  });

  it("sends refresh:true when refresh() is invoked", async () => {
    let lastBody: unknown;
    server.use(
      http.post("/api/signal-lead-map_claude", async ({ request }) => {
        lastBody = await request.json();
        return HttpResponse.json({ data: { mapping: [] } });
      }),
    );
    const { result } = renderHook(() => useSignalLeadMap("org1"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.refresh();
    });
    expect(lastBody).toMatchObject({ refresh: true });
  });

  it("auto-retries a transient failure and recovers without surfacing an error (S5)", async () => {
    let calls = 0;
    server.use(
      http.post("/api/signal-lead-map_claude", () => {
        calls += 1;
        // First attempt 502s (cold start), the retry succeeds.
        if (calls === 1) return new HttpResponse(null, { status: 502 });
        return HttpResponse.json(RESPONSE);
      }),
    );
    const { result } = renderHook(() => useSignalLeadMap("org1"), { wrapper });
    await waitFor(() => expect(result.current.leadsForSignal("s1")).toHaveLength(1), {
      timeout: 5000,
    });
    expect(result.current.isError).toBe(false);
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it("recompute exits the error state on a successful refetch", async () => {
    let calls = 0;
    server.use(
      http.post("/api/signal-lead-map_claude", () => {
        calls += 1;
        // Initial load fails across all retry attempts (retry: 2 → 3 attempts);
        // the explicit recompute (calls > 3) then succeeds.
        if (calls <= 3) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json(RESPONSE);
      }),
    );
    const { result } = renderHook(() => useSignalLeadMap("org1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.isError).toBe(false), { timeout: 5000 });
    expect(result.current.leadsForSignal("s1")).toHaveLength(1);
  });

  it("recompute surfaces the error state when the refetch fails (old setQueryData path swallowed it)", async () => {
    let calls = 0;
    server.use(
      http.post("/api/signal-lead-map_claude", () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json(RESPONSE);
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const { result } = renderHook(() => useSignalLeadMap("org1"), { wrapper });
    // initial load succeeds
    await waitFor(() => expect(result.current.leadsForSignal("s1")).toHaveLength(1), {
      timeout: 5000,
    });
    expect(result.current.isError).toBe(false);
    // recompute hits 500 — fetchQuery propagates the error into the query state
    await act(async () => {
      await result.current.refresh();
    });
    // fetchQuery drives the query into error state; setQueryData would have left isError=false
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
  });
});
