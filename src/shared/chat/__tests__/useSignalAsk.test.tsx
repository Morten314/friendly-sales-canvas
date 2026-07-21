import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useSignalAsk, type SignalAskBody } from "../useSignalAsk";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const body: SignalAskBody = {
  org_id: "org1",
  user_id: "u1",
  question: "Why this signal?",
  history: [],
};

describe("useSignalAsk", () => {
  it("returns the parsed response on success", async () => {
    server.use(http.post("/api/signal_ask_claude", () => HttpResponse.json({ answer: "hello" })));
    const { result } = renderHook(() => useSignalAsk(), { wrapper });
    result.current.mutate(body);
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data).toEqual({ answer: "hello" });
  });

  it("throws on a non-ok response", async () => {
    server.use(
      http.post("/api/signal_ask_claude", () => new HttpResponse("boom", { status: 500 })),
    );
    const { result } = renderHook(() => useSignalAsk(), { wrapper });
    result.current.mutate(body);
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.error?.message).toContain("signal_ask_claude failed: 500");
  });
});
