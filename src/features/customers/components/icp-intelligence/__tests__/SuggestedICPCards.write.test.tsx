import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SuggestedICPCards } from "../SuggestedICPCards";
import { PROFILER_DISMISSED_RECOMMENDED_IDS_KEY } from "../suggestedIcpStorage";

import { Toaster } from "@/components/ui/toaster";
import { server } from "@/test/msw/server";

// The container reads currentUser + orgId from @/shared/auth's useAuth — the same
// uid/orgId flow into every mutation hook (useAcceptSuggestedIcp, etc.).
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

// Mount the real <Toaster /> so toast titles/descriptions render into the DOM —
// the accept happy-path asserts the exact "Customer Profile updated." toast.
// fireEvent (sync) is the suite-wide click driver here (no user-event dep).
function renderCards() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
  return render(<SuggestedICPCards refreshTrigger={1} />, { wrapper });
}

describe("SuggestedICPCards writes", () => {
  it("accept routes through the hooks, transitions the card to accepted, and toasts", async () => {
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})),
      // Current ICPs read — empty before accept; populated after accept.
      http.get("/api/customer_profile", () =>
        HttpResponse.json({
          success: true,
          data: {
            icps: [
              {
                id: "persisted-profile-icp-1",
                primary_region: "US",
                industry: ["Financial Services"],
                company_size: ["500-2000 employees"],
                buyer_role: ["Chief Digital Officer"],
                fit_confidence: "medium",
                status: "saved",
              },
            ],
          },
        }),
      ),
      http.get("/api/v2/icp", () =>
        HttpResponse.json({
          items: [{ id: "rec-1", title: "FinTech ICP", industry: "Financial Services" }],
          total: 1,
          limit: 500,
          offset: 0,
        }),
      ),
      // useAcceptSuggestedIcp.mutateAsync(icpId) — POST from_suggested_icp.
      http.post("/api/customer_profile/from_suggested_icp", () =>
        HttpResponse.json({
          success: true,
          data: { icp: { id: "persisted-profile-icp-1" } },
        }),
      ),
      // useSaveCustomerProfile firmographics save (GET full profile + POST) is a
      // best-effort no-op here; the accept toast fires regardless of its result.
      http.post("/api/customer_profile", () => HttpResponse.json({ success: true })),
    );
    renderCards();

    await screen.findByText(/FinTech ICP/i, undefined, { timeout: 5000 });
    // The card-footer "Accept" button opens the confirm dialog (only the card is
    // rendered; the full-report body is collapsed, so this is the sole Accept).
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    // The confirm dialog's action button is labelled "Okay" (AlertDialogAction).
    fireEvent.click(await screen.findByRole("button", { name: /okay/i }));

    // Optimism: the accept toast renders (proves the end-of-try success path ran,
    // i.e. the customerProfileSaved event dispatch + toast block were reached).
    await waitFor(
      () => expect(screen.getByText(/Customer Profile updated\./i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    // Optimism: setCardStatuses(... accepted ...) removed the card from the
    // visible recommended list (visibleRecommendedIcps filters out "accepted"),
    // so the "Recommended ICPs" section header disappears.
    await waitFor(() => expect(screen.queryByText(/Recommended ICPs/i)).not.toBeInTheDocument());
  });

  // REAL timers (not fake): the reject finalize fires the DELETE through apiFetch,
  // which does a dynamic `import("./jwt")` + an MSW-intercepted fetch. Fake timers
  // wedge on that import/MSW microtask interplay (TD-FE-20-style), so we let the
  // real 5s setTimeout elapse and waitFor the dismissed marker (8s budget).
  it("reject persists a dismissed marker after the 5s undo window", async () => {
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})),
      http.get("/api/customer_profile", () => HttpResponse.json({ icps: [] })),
      http.get("/api/v2/icp", () =>
        HttpResponse.json({
          items: [{ id: "rec-1", title: "FinTech ICP" }],
          total: 1,
          limit: 500,
          offset: 0,
        }),
      ),
      // useRejectSuggestedIcp.mutateAsync(icpId) — DELETE recommended.
      http.delete("/api/icp/recommended/:id", () => HttpResponse.json({ success: true })),
    );
    renderCards();
    await screen.findByText(/FinTech ICP/i, undefined, { timeout: 5000 });

    // Reject starts the optimistic 5-second undo window (setTimeout + pending marker).
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    // The pending marker is written synchronously on click.
    expect(localStorage.getItem("profiler_pendingRecommendedRejects") ?? "").toContain("rec-1");

    // Let the real 5s window elapse, then settle the DELETE mutation's microtask.
    await new Promise((resolve) => setTimeout(resolve, 6000));
    await waitFor(() =>
      expect(localStorage.getItem(PROFILER_DISMISSED_RECOMMENDED_IDS_KEY) ?? "").toContain("rec-1"),
    );
  }, 15000);
});
