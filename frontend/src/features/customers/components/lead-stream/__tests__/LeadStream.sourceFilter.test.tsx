import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

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

beforeAll(() => {
  if (!window.HTMLElement.prototype.scrollIntoView)
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  server.use(
    http.get("/api/v2/leads", () =>
      HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
    ),
  );
});

describe("LeadStreamPanel source filter (G6)", () => {
  it("renders the source-filter trigger defaulting to 'All leads'", () => {
    render(<LeadStreamPanel />, { wrapper });
    const trigger = screen.getByRole("combobox", { name: /filter by lead source/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent(/all leads/i);
  });
});
