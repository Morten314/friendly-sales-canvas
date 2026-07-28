import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useICPs } from "../useICPs";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useICPs", () => {
  it("returns the extracted ICP rows", async () => {
    // fetchIcpsRowsForOrg hits /api/profile/company then /api/customer_profile.
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})),
      http.get("/api/customer_profile", () =>
        HttpResponse.json({ icps: [{ id: "i1" }, { id: "i2" }] }),
      ),
    );
    const { result } = renderHook(() => useICPs("u1", "org1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it("is disabled without userId/orgId", () => {
    const { result } = renderHook(() => useICPs("", "org1"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
