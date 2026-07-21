import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useUserProfile } from "../useUserProfile";

import { server } from "@/test/msw/server";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useUserProfile", () => {
  it("returns the profile when it belongs to the user", async () => {
    server.use(
      http.get("/api/profile/user", () => HttpResponse.json({ user_id: "u1", name: "Ada" })),
    );
    const { result } = renderHook(() => useUserProfile("u1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe("Ada");
  });

  it("is disabled without a userId", () => {
    const { result } = renderHook(() => useUserProfile(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
