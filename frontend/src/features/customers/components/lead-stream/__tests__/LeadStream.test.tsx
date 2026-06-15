import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { LeadStreamPanel } from "../LeadStream";

import { server } from "@/test/msw/server";

vi.mock("@/shared/auth/AuthContext", () => ({
  useAuth: () => ({ orgId: "org1", currentUser: { uid: "u1" } }),
}));
vi.mock("@/shared/tenant", () => ({
  useTenant: () => ({ selectedTenant: null }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("LeadStreamPanel (real leads)", () => {
  it("renders fetched leads with source badges", async () => {
    server.use(
      http.get("/api/v2/leads", () =>
        HttpResponse.json({
          items: [{ lead_id: "l1", lead_name: "Tom", company_name: "Acme", source: "apollo" }],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
    );
    render(<LeadStreamPanel />, { wrapper });
    expect(await screen.findByText("Tom")).toBeTruthy();
    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.getByText("Apollo")).toBeTruthy();
  });

  it("shows the empty state when the org has no leads", async () => {
    server.use(
      http.get("/api/v2/leads", () =>
        HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
      ),
    );
    render(<LeadStreamPanel />, { wrapper });
    await waitFor(() => expect(screen.getByText("No prospect data yet")).toBeTruthy());
  });
});
