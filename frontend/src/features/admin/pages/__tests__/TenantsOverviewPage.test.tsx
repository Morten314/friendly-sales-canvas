import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import TenantsOverviewPage from "../TenantsOverviewPage";

import { server } from "@/test/msw/server";

function renderPage(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TenantsOverviewPage", () => {
  it("filters the org table by the search box", async () => {
    server.use(
      http.get("/api/admin/orgs", () =>
        HttpResponse.json([
          { org_id: "o1", org_name: "Acme", user_count: 1, user_ids: ["u1"] },
          { org_id: "o2", org_name: "Globex", user_count: 0, user_ids: [] },
        ]),
      ),
    );
    renderPage(<TenantsOverviewPage />);
    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "acme" } });
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.queryByText("Globex")).not.toBeInTheDocument();
  });
});
