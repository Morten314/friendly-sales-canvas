import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import SettingsPage from "../SettingsPage";

import { server } from "@/test/msw/server";

vi.mock("@/shared/auth/firebase", () => ({ auth: { currentUser: null } }));

// Full AppSettings shape — the zod contract requires all three fields.
const SETTINGS = {
  lead_fetch_limit: 250,
  signal_lead_map_lead_limit: 100,
  signal_lead_map_batch_size: 15,
};

function renderPage(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SettingsPage", () => {
  it("loads all settings (lead fetch limit + matched-leads tuning) into inputs", async () => {
    server.use(http.get("/api/admin/settings", () => HttpResponse.json(SETTINGS)));
    renderPage(<SettingsPage />);
    expect(await screen.findByDisplayValue("250")).toBeInTheDocument(); // lead_fetch_limit
    expect(screen.getByDisplayValue("100")).toBeInTheDocument(); // signal_lead_map_lead_limit
    expect(screen.getByDisplayValue("15")).toBeInTheDocument(); // signal_lead_map_batch_size
  });

  it("saves the full settings object via PUT and confirms success", async () => {
    let putBody: typeof SETTINGS | null = null;
    server.use(
      http.get("/api/admin/settings", () => HttpResponse.json(SETTINGS)),
      http.put("/api/admin/settings", async ({ request }) => {
        putBody = (await request.json()) as typeof SETTINGS;
        return HttpResponse.json(putBody);
      }),
    );
    renderPage(<SettingsPage />);
    const input = await screen.findByDisplayValue("250");
    fireEvent.change(input, { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    // The PUT carries the FULL object (unchanged fields included), not just the edit.
    await waitFor(() =>
      expect(putBody).toEqual({
        lead_fetch_limit: 400,
        signal_lead_map_lead_limit: 100,
        signal_lead_map_batch_size: 15,
      }),
    );
    expect(await screen.findByText(/saved/i)).toBeInTheDocument();
  });

  it("clears the saved confirmation when a value is edited again", async () => {
    server.use(
      http.get("/api/admin/settings", () => HttpResponse.json(SETTINGS)),
      http.put("/api/admin/settings", async ({ request }) =>
        HttpResponse.json((await request.json()) as typeof SETTINGS),
      ),
    );
    renderPage(<SettingsPage />);
    const input = await screen.findByDisplayValue("250");
    fireEvent.change(input, { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/saved/i)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "300" } });
    expect(screen.queryByText(/saved/i)).not.toBeInTheDocument();
  });

  it("rejects an out-of-range value client-side and disables save", async () => {
    server.use(http.get("/api/admin/settings", () => HttpResponse.json(SETTINGS)));
    renderPage(<SettingsPage />);
    const input = await screen.findByDisplayValue("250");
    fireEvent.change(input, { target: { value: "501" } });

    expect(screen.getByText(/between 1 and 500/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });
});
