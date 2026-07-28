import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useSignalAction, type SignalActionVars } from "../useSignalAction";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const vars: SignalActionVars = {
  orgId: "org1",
  signalId: "sig1",
  action: "accept",
};

describe("useSignalAction", () => {
  it("returns the parsed response on success", async () => {
    server.use(http.post("/api/signal_action", () => HttpResponse.json({ success: true })));
    const { result } = renderHook(() => useSignalAction(), { wrapper });
    result.current.mutate(vars);
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data).toEqual({ success: true });
  });

  it("throws on a non-ok response", async () => {
    server.use(http.post("/api/signal_action", () => new HttpResponse("boom", { status: 500 })));
    const { result } = renderHook(() => useSignalAction(), { wrapper });
    result.current.mutate(vars);
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.error?.message).toContain("signal_action failed: 500");
  });
});
