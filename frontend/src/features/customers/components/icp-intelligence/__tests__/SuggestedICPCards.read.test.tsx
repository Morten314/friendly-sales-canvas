import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SuggestedICPCards } from "../SuggestedICPCards";

import { BACKEND_BASE_URL } from "@/shared/api/transport";
import { server } from "@/test/msw/server";

// The container reads currentUser + orgId from @/shared/auth's useAuth.
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

describe("SuggestedICPCards reads", () => {
  it("renders recommended ICPs from GET /icp and clears the loading modal", async () => {
    server.use(
      http.get("/api/profile/company", () => HttpResponse.json({})),
      http.get("/api/customer_profile", () => HttpResponse.json({ icps: [] })),
      http.get(`${BACKEND_BASE_URL}/icp`, () =>
        HttpResponse.json({
          icps: [{ id: "rec-1", title: "Enterprise FinTech", industry: "Financial Services" }],
        }),
      ),
    );
    renderCards();
    // The recommended card renders the ICP title (mapApiICPToSuggested.name) as
    // its CardTitle, proving the GET /icp item flowed through the real
    // fetchSuggestedIcps → normalizeIcpGetResponse → mapApiICPToSuggested pipeline.
    await waitFor(() => expect(screen.getByText(/Enterprise FinTech/i)).toBeInTheDocument(), {
      timeout: 5000,
    });
    // Loading modal closes after the reads settle.
    expect(screen.queryByText(/Generating ICPs/i)).not.toBeInTheDocument();
  });
});
