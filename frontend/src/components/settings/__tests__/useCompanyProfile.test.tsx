import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCompanyProfile, useSaveCompanyProfile } from "../useCompanyProfile";

import { server } from "@/test/msw/server";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("useCompanyProfile", () => {
  it("loads and zod-parses a profile", async () => {
    server.use(
      http.get("/api/profile/company", () =>
        HttpResponse.json({ org_id: "brewra", industry: "saas" }),
      ),
    );
    const { result } = renderHook(() => useCompanyProfile("brewra"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.industry).toBe("saas");
  });

  it("resolves to null (not error) on a non-2xx — preserves empty-form path", async () => {
    server.use(http.get("/api/profile/company", () => new HttpResponse(null, { status: 404 })));
    const { result } = renderHook(() => useCompanyProfile("brewra"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("surfaces a ZodError on a 200 with a drifted shape", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get("/api/profile/company", () => HttpResponse.json({ industry: 42 })));
    const { result } = renderHook(() => useCompanyProfile("brewra"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("save POST invalidates the query and triggers a refetch", async () => {
    let getCount = 0;
    server.use(
      http.get("/api/profile/company", () => {
        getCount += 1;
        return HttpResponse.json({ org_id: "brewra", industry: "saas" });
      }),
      http.post("/api/profile/company", () => HttpResponse.json({ ok: true })),
    );
    const { result } = renderHook(
      () => ({ q: useCompanyProfile("brewra"), m: useSaveCompanyProfile("brewra") }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.q.isSuccess).toBe(true));
    expect(getCount).toBe(1);

    await act(async () => {
      await result.current.m.mutateAsync({ org_id: "brewra", industry: "fintech" });
    });

    // onSuccess → invalidateQueries(qk.companyProfile) → the GET refetches.
    await waitFor(() => expect(getCount).toBe(2));
  });
});
