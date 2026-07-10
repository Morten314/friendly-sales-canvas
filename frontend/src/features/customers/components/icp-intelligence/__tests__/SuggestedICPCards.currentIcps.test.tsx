import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SuggestedICPCards } from "../SuggestedICPCards";

import { getOrgCacheKey } from "@/shared/lib/cacheUtils";
import { server } from "@/test/msw/server";

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

function renderCards() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<SuggestedICPCards refreshTrigger={1} />, { wrapper });
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// Field note (spec 48 WS2): `mapCustomerProfileICPToExisting` (icpMapping.ts) maps a
// cached row's `industry` straight onto `ExistingICP.industry` (joined string;
// `mergeProfilerAcceptedIcpDisplay` is a no-op here — no accept-time display-meta is
// stored for id "old-1"). `CurrentIcpsTable` renders that field verbatim in its own
// cell: `<TableCell>{icp.industry || "—"}</TableCell>`. So a cache fixture of
// `{ id: "old-1", name: "...", industry: "<marker>" }` surfaces `<marker>` in the
// Industry column when (and only when) the stale cache is re-hydrated.
//
// An explicit `name` is included in both fixtures deliberately: when a row has no
// `name`, the mapper synthesizes one from the industry (`"<industry> - Global"`),
// which would make the marker text appear in BOTH the Name and Industry cells and
// break single-element queries (`getByText`/`queryByText` throw on multiple
// matches). Giving each fixture its own explicit `name` keeps the marker text
// confined to the Industry cell, so the assertions are unambiguous.
describe("SuggestedICPCards Current-ICPs empty-vs-error", () => {
  it("on an empty-success profile read, does NOT re-hydrate stale Current ICPs from cache", async () => {
    // Stale cache from a prior session:
    localStorage.setItem(
      getOrgCacheKey("customerProfile", "org1"),
      JSON.stringify([{ id: "old-1", name: "Stale Cached ICP", industry: "Legacy" }]),
    );
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({ icps: [] })), // 2xx empty-success
      http.get("/api/customer_profile", () => HttpResponse.json({ icps: [] })),
      http.get("/api/v2/icp", () =>
        HttpResponse.json({ items: [], total: 0, limit: 500, offset: 0 }),
      ),
    );
    renderCards();
    // Wait for the load to genuinely settle (the loading modal is guaranteed
    // present at mount, so this cannot pass vacuously before the loader's
    // fetch + cache-fallback logic has actually run — unlike asserting the
    // absence of "Legacy" directly in a `waitFor`, which would trivially pass
    // on the very first tick before `existingICPs` is ever populated).
    await waitFor(() => expect(screen.queryByText(/Generating ICPs/i)).not.toBeInTheDocument());
    // The stale "Legacy" ICP must not appear anywhere (empty-success ⇒ empty
    // table). queryAllByText (not queryByText/getByText) so this can't itself
    // throw on an unexpected multi-match — it just asserts the count is zero.
    expect(screen.queryAllByText(/Legacy/i)).toHaveLength(0);
  });

  it("on a read FAILURE (5xx), falls back to the cache (keeps last-known Current ICPs)", async () => {
    localStorage.setItem(
      getOrgCacheKey("customerProfile", "org1"),
      JSON.stringify([
        { id: "old-1", name: "Stale Cached ICP", industry: "CachedIndustry", segment: "Seg" },
      ]),
    );
    server.use(
      http.get("/api/profile/company", () => new HttpResponse(null, { status: 500 })),
      http.get("/api/customer_profile", () => new HttpResponse(null, { status: 500 })),
      http.get("/api/v2/icp", () =>
        HttpResponse.json({ items: [], total: 0, limit: 500, offset: 0 }),
      ),
    );
    renderCards();
    await waitFor(() => expect(screen.getByText(/CachedIndustry/i)).toBeInTheDocument());
  });
});
