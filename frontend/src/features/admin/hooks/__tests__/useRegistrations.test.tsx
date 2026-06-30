import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useRegistrations } from "../useRegistrations";

import { server } from "@/test/msw/server";

vi.mock("@/shared/auth/firebase", () => ({ auth: { currentUser: null } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useRegistrations", () => {
  it("parses the v2 paginated registration envelope", async () => {
    server.use(
      http.get("/api/v2/registration", () =>
        HttpResponse.json({
          items: [
            { id: "r1", name: "Ada", email: "ada@example.com", timestamp: "2026-06-30T00:00:00Z" },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
    );
    const { result } = renderHook(() => useRegistrations(50, 0), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.total).toBe(1);
    expect(result.current.data?.limit).toBe(50);
    expect(result.current.data?.items[0].email).toBe("ada@example.com");
    expect(result.current.data?.items[0].id).toBe("r1");
  });
});
