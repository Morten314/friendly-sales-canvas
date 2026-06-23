import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignalsPage from "../SignalsPage";

import { TooltipProvider } from "@/components/ui/tooltip";

// Mutable holders so each test can drive the org id sources the page reads.
const h = vi.hoisted(() => ({
  authOrgId: null as string | null,
  selectedTenant: null as { id: string; name: string } | null,
  leadMapCalls: [] as (string | null | undefined)[],
}));

const SIGNAL = {
  id: "sig-1",
  agent: "scout",
  timestamp: "1h ago",
  headline: "Hiring surge",
  snippet: "snippet text",
  description: "Detailed ICP context paragraph.",
  sourceUrl: "#",
  sourceLabel: "Press",
  source: [],
  nextBestMoves: ["Reach out"],
  NBAs: [],
  contextualSuggestions: [],
};

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: h.authOrgId }),
}));
vi.mock("@/shared/tenant", () => ({
  useTenant: () => ({ selectedTenant: h.selectedTenant }),
}));
vi.mock("../../hooks/useSignalLeadMap", () => ({
  useSignalLeadMap: (orgId: string | null | undefined) => {
    h.leadMapCalls.push(orgId);
    return {
      leadsForSignal: () => [],
      signalsForLead: () => [],
      isLoading: false,
      isFetching: false,
      isError: false,
      refresh: vi.fn().mockResolvedValue(true),
      retry: vi.fn(),
    };
  },
}));
vi.mock("../../services/signals", () => ({
  fetchSignals: vi.fn().mockResolvedValue({}),
  generateSignalsBatch: vi.fn().mockResolvedValue({}),
}));
vi.mock("../../components/signalCards", () => ({
  buildSignalCardsFromFetchData: () => [SIGNAL],
  applyRejectedFilterAndSort: (s: unknown[]) => s,
  getFallbackSampleSignals: () => [SIGNAL],
  getSignalContentHash: (s: { id: string }) => `hash-${s.id}`,
  sanitizeSourceUrl: (u: string) => u,
}));
vi.mock("@/features/shell", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/shared/company-profile", () => ({
  useCompanyProfile: () => ({ data: null }),
}));
vi.mock("@/shared/chat", () => ({
  writeSessionChatContext: vi.fn(),
}));
vi.mock("@/shared/chat/useSignalAction", () => ({
  useSignalAction: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
}));
vi.mock("@/shared/chat/useSignalAsk", () => ({
  useSignalAsk: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
}));
vi.mock("@/features/artifacts", () => ({
  enqueueArtefact: vi.fn(),
  generateAndDownloadPDF: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <MemoryRouter>{(<SignalsPage />) as ReactNode}</MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  h.authOrgId = null;
  h.selectedTenant = null;
  h.leadMapCalls = [];
});
afterEach(() => localStorage.clear());

describe("SignalsPage — org id resolution for matched leads", () => {
  it("falls back to the selected tenant id when AuthContext orgId is null", async () => {
    // The CSV upload path defaults a missing org to "brewra" (selectedTenant);
    // Find Matched Leads must read leads under the SAME id, not the raw null
    // (which disables useSignalLeadMap and silently shows zero matched leads).
    h.authOrgId = null;
    h.selectedTenant = { id: "brewra", name: "Brewra" };
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());
    expect(h.leadMapCalls.at(-1)).toBe("brewra");
    expect(h.leadMapCalls).not.toContain(null);
  });

  it("prefers the AuthContext orgId when it is present", async () => {
    h.authOrgId = "org1";
    h.selectedTenant = { id: "brewra", name: "Brewra" };
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());
    expect(h.leadMapCalls.at(-1)).toBe("org1");
  });
});
