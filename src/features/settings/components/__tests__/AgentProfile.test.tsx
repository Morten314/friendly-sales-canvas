import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AgentProfile } from "../AgentProfile";

import { server } from "@/test/msw/server";

// AuthContext is heavy (Firebase). Mock it to a logged-in user.
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" } }),
}));

function renderWithClient(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("AgentProfile", () => {
  it("renders the agent profile form heading", () => {
    server.use(http.get("/api/profile/agent_name", () => HttpResponse.json({ user_id: "u1" })));
    renderWithClient(<AgentProfile isEditMode={false} onProfileUpdate={vi.fn()} />);
    expect(screen.getByText("Agent Profile Settings")).toBeInTheDocument();
  });
});
