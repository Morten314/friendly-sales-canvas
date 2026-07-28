import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useDisconnectApollo } from "../useDisconnectApollo";

import { qk } from "@/shared/api/queryKeys";
import { server } from "@/test/msw/server";

describe("useDisconnectApollo", () => {
  it("DELETEs with org_id, parses the response, and invalidates apolloStatus on success", async () => {
    let seenMethod = "";
    let seenUrl = "";
    server.use(
      http.delete("/api/connectors/apollo/connect", ({ request }) => {
        seenMethod = request.method;
        seenUrl = request.url;
        return HttpResponse.json({ status: "disconnected", message: "removed" });
      }),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDisconnectApollo("o1"), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenMethod).toBe("DELETE");
    expect(seenUrl).toContain("org_id=o1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: qk.apolloStatus("o1") });
  });
});
