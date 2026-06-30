import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useSystemHealth } from "../useSystemHealth";

import { server } from "@/test/msw/server";

vi.mock("@/shared/auth/firebase", () => ({ auth: { currentUser: null } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useSystemHealth", () => {
  it("parses the probe list (ok+latency and timeout+detail shapes)", async () => {
    server.use(
      http.get("/api/admin/health", () =>
        HttpResponse.json({
          probes: [
            { name: "mongo", status: "ok", latency_ms: 12.3 },
            { name: "llm", status: "timeout", detail: "probe exceeded 5.0s" },
          ],
        }),
      ),
    );
    const { result } = renderHook(() => useSystemHealth(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const byName = Object.fromEntries((result.current.data?.probes ?? []).map((p) => [p.name, p]));
    expect(byName.mongo.status).toBe("ok");
    expect(byName.mongo.latency_ms).toBe(12.3);
    expect(byName.llm.status).toBe("timeout");
    expect(byName.llm.detail).toContain("exceeded");
  });
});
