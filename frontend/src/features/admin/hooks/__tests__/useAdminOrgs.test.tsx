import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useAdminOrgs } from "../useAdminOrgs";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useAdminOrgs", () => {
  it("fetches and parses the org list", async () => {
    server.use(
      http.get("/api/admin/orgs", () =>
        HttpResponse.json([
          { org_id: "o1", org_name: "Acme", user_count: 2, user_ids: ["u1", "u2"] },
        ]),
      ),
    );
    const { result } = renderHook(() => useAdminOrgs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].org_name).toBe("Acme");
  });
});
