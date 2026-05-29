import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CompanyProfile } from "../CompanyProfile";

import { server } from "@/test/msw/server";

// AuthContext is heavy (Firebase). Mock it to a logged-in user with an org.
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "brewra" }),
}));

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
});
