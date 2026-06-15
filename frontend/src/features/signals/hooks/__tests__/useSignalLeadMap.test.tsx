import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
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
});
