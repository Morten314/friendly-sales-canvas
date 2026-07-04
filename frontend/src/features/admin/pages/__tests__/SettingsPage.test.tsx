import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import SettingsPage from "../SettingsPage";

import { server } from "@/test/msw/server";

vi.mock("@/shared/auth/firebase", () => ({ auth: { currentUser: null } }));

function renderPage(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SettingsPage", () => {
  it("loads the current lead_fetch_limit into the input", async () => {
    server.use(http.get("/api/admin/settings", () => HttpResponse.json({ lead_fetch_limit: 250 })));
    renderPage(<SettingsPage />);
    expect(await screen.findByDisplayValue("250")).toBeInTheDocument();
  });

  it("saves an updated value via PUT and confirms success", async () => {
    let putBody: { lead_fetch_limit: number } | null = null;
    server.use(
      http.get("/api/admin/settings", () => HttpResponse.json({ lead_fetch_limit: 250 })),
      http.put("/api/admin/settings", async ({ request }) => {
        putBody = (await request.json()) as { lead_fetch_limit: number };
        return HttpResponse.json(putBody);
      }),
    );
    renderPage(<SettingsPage />);
    const input = await screen.findByDisplayValue("250");
    fireEvent.change(input, { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(putBody).toEqual({ lead_fetch_limit: 400 }));
    expect(await screen.findByText(/saved/i)).toBeInTheDocument();
  });

  it("clears the saved confirmation when the value is edited again", async () => {
    server.use(
      http.get("/api/admin/settings", () => HttpResponse.json({ lead_fetch_limit: 250 })),
      http.put("/api/admin/settings", async ({ request }) =>
        HttpResponse.json((await request.json()) as { lead_fetch_limit: number }),
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
    server.use(http.get("/api/admin/settings", () => HttpResponse.json({ lead_fetch_limit: 250 })));
    renderPage(<SettingsPage />);
    const input = await screen.findByDisplayValue("250");
    fireEvent.change(input, { target: { value: "501" } });

    expect(screen.getByText(/between 1 and 500/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });
});
