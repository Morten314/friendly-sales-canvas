import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CompanyProfile } from "../CompanyProfile";

import { server } from "@/test/msw/server";

// AuthContext is heavy (Firebase). Mock it to a logged-in user with an org.
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "brewra" }),
}));

// The Industry combobox renders a `cmdk` popover; `cmdk` + Radix Popper use
// ResizeObserver and Element.scrollIntoView, which jsdom lacks. Polyfill locally
// (scoped to this file) so the popover mounts — mirrors IcpWizard.test.tsx.
beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

function renderWithClient(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

afterEach(() => vi.restoreAllMocks());

describe("CompanyProfile", () => {
  it("renders the form heading once the query settles", async () => {
    server.use(
      http.get("/api/profile/company", () =>
        HttpResponse.json({ org_id: "brewra", industry: "saas" }),
      ),
    );
    renderWithClient(<CompanyProfile />);
    expect(await screen.findByText("Company Profile Settings")).toBeInTheDocument();
    // Loading banner clears after the query resolves.
    await waitFor(() =>
      expect(screen.queryByText("Loading your company profile...")).not.toBeInTheDocument(),
    );
  });

  it("renders the empty form (no crash) when the profile endpoint 404s", async () => {
    server.use(http.get("/api/profile/company", () => new HttpResponse(null, { status: 404 })));
    renderWithClient(<CompanyProfile />);
    expect(await screen.findByText("Company Profile Settings")).toBeInTheDocument();
    expect(screen.getByText("Save Company Profile")).toBeInTheDocument();
  });

  it("lets the user type a custom industry and saves it in the POST payload", async () => {
    vi.spyOn(window, "alert").mockImplementation(() => {});
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.get("/api/profile/company", () => new HttpResponse(null, { status: 404 })),
      http.post("/api/profile/company", async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ok: true });
      }),
    );

    renderWithClient(<CompanyProfile />);
    await screen.findByText("Company Profile Settings");
    // Wait for the profile query to settle (404 → null) BEFORE interacting:
    // otherwise its seed effect re-runs mid-interaction and resets the form,
    // clobbering the typed value.
    await waitFor(() =>
      expect(screen.queryByText("Loading your company profile...")).not.toBeInTheDocument(),
    );

    // Open the Industry combobox. Its trigger is labelled by the <Label
    // htmlFor="industry">, so its accessible name is "Industry".
    fireEvent.click(screen.getByRole("combobox", { name: "Industry" }));
    // Type a value that is NOT one of the suggestions, then add it via the
    // creatable affordance — the crux of the enhancement.
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "Defense Logistics" },
    });
    fireEvent.click(screen.getByText(/Add "Defense Logistics"/));

    // The custom value is reflected on the trigger…
    expect(screen.getByRole("combobox", { name: "Industry" })).toHaveTextContent(
      "Defense Logistics",
    );

    // …and persisted in the save payload.
    fireEvent.click(screen.getByRole("button", { name: /save company profile/i }));

    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({ industry: "Defense Logistics" });
  });
});
