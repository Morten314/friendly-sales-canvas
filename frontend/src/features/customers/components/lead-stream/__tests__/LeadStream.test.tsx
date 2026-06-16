import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("expands a lead row to show the relevant signal headlines", async () => {
    server.use(
      http.get("/api/v2/leads", () =>
        HttpResponse.json({
          items: [{ lead_id: "l1", lead_name: "Tom", company_name: "Acme", source: "csv" }],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
      http.post("/api/signal-lead-map_claude", () =>
        HttpResponse.json({
          status: "success",
          data: {
            mapping: [
              {
                signal_id: "s1",
                headline: "Hiring surge",
                leads: [{ lead_id: "l1", company: "Acme", relevance: "high", why: "match" }],
              },
            ],
          },
        }),
      ),
    );
    render(<LeadStreamPanel />, { wrapper });
    const toggle = await screen.findByRole("button", { name: /1 signal/ });
    fireEvent.click(toggle);
    expect(await screen.findByText("Hiring surge")).toBeTruthy();
  });

  it("loads the next page when 'Load more' is clicked", async () => {
    server.use(
      http.get("/api/v2/leads", ({ request }) => {
        const offset = new URL(request.url).searchParams.get("offset");
        const row =
          offset === "1"
            ? { lead_id: "l2", lead_name: "Pat", company_name: "Beta", source: "csv" }
            : { lead_id: "l1", lead_name: "Tom", company_name: "Acme", source: "apollo" };
        return HttpResponse.json({ items: [row], total: 2, limit: 1, offset: Number(offset ?? 0) });
      }),
    );
    render(<LeadStreamPanel />, { wrapper });
    expect(await screen.findByText("Tom")).toBeTruthy();
    expect(screen.queryByText("Pat")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(await screen.findByText("Pat")).toBeTruthy();
    expect(screen.getByText("Tom")).toBeTruthy(); // page 1 still shown
  });

  it("shows no 'Load more' button when a single page covers the total", async () => {
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
    expect(screen.queryByRole("button", { name: /load more/i })).toBeNull();
  });
});
