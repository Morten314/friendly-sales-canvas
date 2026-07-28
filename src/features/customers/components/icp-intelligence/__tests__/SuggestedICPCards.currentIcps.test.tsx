import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExistingICP, SuggestedICP } from "../../../types";
import { SuggestedICPCards } from "../SuggestedICPCards";

import { getOrgCacheKey } from "@/shared/lib/cacheUtils";
import { commitProfilerSnapshot, invalidateProfilerCache } from "@/shared/profiler";
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
  // Task 7 review: the profiler session snapshot is a module-level singleton
  // (missionProfilerSessionCache.ts) that survives across tests sharing the
  // same uid/org — every test in this file uses "u1"/"org1". Without this, a
  // snapshot committed or primed by one test (see the describe block below)
  // can leak into the next and silently change which code path it exercises.
  invalidateProfilerCache("u1", "org1");
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

// Task 7 review gap (spec 48 WS2): the two tests above cover
// `loadProfilerPagePayload`'s empty-vs-error branch (the LOADER path), but two
// more Task-7 changes to SuggestedICPCards.tsx are only reachable through the
// SNAPSHOT short-circuit in the `useEffect` (the `isProfilerCacheValid` branch),
// which those fixtures never enter — their GET /icp responses are empty, which
// trips the "skip snapshot when recommendations are empty" guard:
//   (A) `refetchCustomerProfileIcps`'s empty branch purges the stale
//       `customerProfile` org cache via `removeOrgLocalStorage`.
//   (B) the short-circuit fires `void refetchCustomerProfileIcps()` so Current
//       ICPs reconcile against the authoritative read instead of staying
//       frozen at the fast-paint snapshot forever.
// This test primes a valid, non-empty profiler snapshot (so the short-circuit
// is actually entered) and drives both (A) and (B) through one empty-success read.
describe("SuggestedICPCards Profiler snapshot short-circuit (reconcile + cache purge)", () => {
  const SESSION_REFRESH_KEY = "profiler_icp_refresh_u1";

  afterEach(() => {
    // Scoped to this describe: this test deterministically seeds
    // sessionStorage (see below) so it must not leak into tests declared
    // after it in this file.
    sessionStorage.removeItem(SESSION_REFRESH_KEY);
  });

  it("reconciles Current ICPs and purges the org cache when the authoritative read is empty-success", async () => {
    // SuggestedICPCards.tsx only takes the snapshot short-circuit when
    // `!refreshJustIncremented`, which compares `refreshTrigger` (1, from
    // `renderCards()`) against sessionStorage's last-stored value for this
    // uid. Seed it explicitly so the branch is reachable deterministically —
    // relying on an earlier test in this file to have left the "right" value
    // behind would make this test's outcome depend on execution order.
    sessionStorage.setItem(SESSION_REFRESH_KEY, "1");

    const staleExistingIcp: ExistingICP = {
      id: "snap-existing-1",
      name: "Snapshot Current ICP",
      industry: "SnapshotStale",
    };
    const snapshotRecommendedIcp: SuggestedICP = {
      id: "snap-rec-1",
      name: "Snapshot Recommended ICP",
      type: "new",
      industry: "Manufacturing",
      segment: "SMB",
      companySize: "50-200",
      decisionMakers: ["CTO"],
      regions: ["North America"],
      keyAttributes: ["Scalability"],
      whySuggested: ["Snapshot fast-paint fixture"],
      confidenceScore: "Medium",
    };

    // Prime a VALID profiler session snapshot (the missionProfilerSessionCache.ts
    // module singleton) with a non-empty recommendation, so
    // `snapNew.length > 0 || snapRefined.length > 0` holds and the component
    // takes the snapshot short-circuit instead of the loader path exercised
    // above. Its `existingICPs` carries a STALE Current ICP the reconcile must
    // remove — this is set directly via `setExistingICPs(snap.existingICPs)`
    // with no `mapCustomerProfileICPToExisting` mapping, so the raw
    // `ExistingICP` shape (not the API row shape) is what the table renders.
    commitProfilerSnapshot("u1", "org1", {
      existingICPs: [staleExistingIcp],
      refinedICPs: [],
      newICPs: [snapshotRecommendedIcp],
      cardStatuses: {},
    });

    // Seed the org-scoped `customerProfile` cache (the same key
    // loadProfilerPagePayload/refetchCustomerProfileIcps read and purge) with
    // its own, differently-named stale row, so (A) and (B) can't be confused
    // with each other in the assertions below.
    const cacheKey = getOrgCacheKey("customerProfile", "org1");
    localStorage.setItem(
      cacheKey,
      JSON.stringify([{ id: "cache-1", name: "Cached Stale ICP", industry: "CacheStale" }]),
    );
    // Sanity: localStorage.setItem is synchronous, so the key genuinely
    // exists before render — the `.toBeNull()` assertion at the end therefore
    // proves an actual removal, not "it was never there".
    expect(localStorage.getItem(cacheKey)).not.toBeNull();

    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})), // 2xx empty-success
      http.get("/api/customer_profile", () => HttpResponse.json({ icps: [] })),
      http.get("/api/v2/icp", () =>
        HttpResponse.json({ items: [], total: 0, limit: 500, offset: 0 }),
      ),
    );

    renderCards();

    // Provisional paint: the short-circuit sets state from the snapshot and
    // calls `setLoading(false)` synchronously, before the reconcile's fetch
    // (`void refetchCustomerProfileIcps()`) has any chance to resolve — so
    // this is present in the DOM as soon as `render()` returns. Asserting it
    // here (not inside a `waitFor`) proves the short-circuit was actually
    // entered: if the sessionStorage precondition above were wrong (or the
    // primed snapshot's recommendations were empty), "SnapshotStale" would
    // never render at all, and the disappearance assertion below would then
    // pass vacuously instead of proving a real reconcile.
    expect(screen.getByText(/SnapshotStale/i)).toBeInTheDocument();

    // (B) reconcile: `void refetchCustomerProfileIcps()` performs the
    // authoritative read; empty-success ⇒ `setExistingICPs([])`, so the
    // snapshot-provided stale ICP must disappear once that resolves.
    // queryAllByText (not queryByText/getByText) so this can't itself throw
    // on an unexpected multi-match — it just asserts the count is zero.
    await waitFor(() => expect(screen.queryAllByText(/SnapshotStale/i)).toHaveLength(0));

    // (A) purge: the same empty-success branch in `refetchCustomerProfileIcps`
    // removes the org-scoped `customerProfile` cache key via
    // `removeOrgLocalStorage`. Without that fix, this key would still hold
    // "Cached Stale ICP" from the seed above. By the time the DOM update
    // above is observable, this removal (which precedes `setExistingICPs`'s
    // effect on the DOM only by microtasks, not by an `await`) has already run.
    expect(localStorage.getItem(cacheKey)).toBeNull();
  });
});
