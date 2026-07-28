import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SuggestedICPCards } from "../SuggestedICPCards";
import {
  PROFILER_DISMISSED_RECOMMENDED_IDS_KEY,
  PROFILER_PENDING_RECOMMENDED_REJECT_KEY,
} from "../suggestedIcpStorage";

import { Toaster } from "@/components/ui/toaster";
import { server } from "@/test/msw/server";

// The container reads currentUser + orgId from @/shared/auth's useAuth — the same
// uid/orgId flow into every mutation hook (useAcceptSuggestedIcp, etc.).
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));

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

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("SuggestedICPCards reject — non-404 DELETE failure keeps the pending record", () => {
  it("does NOT record a dismissal and keeps the pending record on a 500 DELETE", async () => {
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
      http.delete("/api/icp/recommended/:id", () => new HttpResponse(null, { status: 500 })),
    );
    renderCards();
    await screen.findByText(/FinTech ICP/i, undefined, { timeout: 5000 });

    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    // Positive control: proves the pending key resolves (a wrong key fails HERE,
    // so the later retention assertion cannot pass vacuously).
    expect(localStorage.getItem(PROFILER_PENDING_RECOMMENDED_REJECT_KEY) ?? "").toContain("rec-1");

    // INTENTIONALLY SLOW: real timers + a ~6s wait for the 5s undo window. Fake
    // timers wedge on apiFetch's dynamic import("./jwt") + MSW microtask interplay
    // (see the sibling SuggestedICPCards.write.test.tsx note) — this is not a hang.
    await new Promise((r) => setTimeout(r, 6000));
    await waitFor(() =>
      expect(localStorage.getItem(PROFILER_DISMISSED_RECOMMENDED_IDS_KEY) ?? "").not.toContain(
        "rec-1",
      ),
    );
    // The pending record is retained (re-armed on next mount), not silently dropped.
    expect(localStorage.getItem(PROFILER_PENDING_RECOMMENDED_REJECT_KEY) ?? "").toContain("rec-1");
  }, 15000);
});
