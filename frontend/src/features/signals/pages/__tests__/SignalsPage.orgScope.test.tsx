import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignalsPage from "../SignalsPage";

import { TooltipProvider } from "@/components/ui/tooltip";

// Mutable holder so each test can drive the org id useOrgId() resolves to.
const h = vi.hoisted(() => ({
  orgId: null as string | null,
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

// SignalsPage resolves org solely from useOrgId() (spec 46 WS1) — the retired
// tenant-context module (spec 46 WS1 deleted it) is not mocked here because it
// no longer exists.
vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" } }),
  useOrgId: () => h.orgId,
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
  generateAndDownloadCsv: vi.fn(),
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
  h.orgId = null;
  h.leadMapCalls = [];
});
afterEach(() => localStorage.clear());

describe("SignalsPage — org id resolution for matched leads", () => {
  it("resolves org solely from useOrgId, ignoring any stale legacy tenant-selection left in localStorage", async () => {
    // A leftover legacy tenant-selection entry (e.g. the CSV-upload path's old
    // "brewra" default, or a previous session) must never leak into org-scoped
    // reads — useOrgId() (spec 46 WS1/WS2) is the only resolution path now.
    localStorage.setItem(
      "legacyTenantSelection_u1",
      JSON.stringify({ id: "brewra", name: "Brewra" }),
    );
    h.orgId = "org1";
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());
    expect(h.leadMapCalls.at(-1)).toBe("org1");
    expect(h.leadMapCalls).not.toContain("brewra");
  });

  it("passes null through to useSignalLeadMap when useOrgId has not resolved yet", async () => {
    h.orgId = null;
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());
    expect(h.leadMapCalls.at(-1)).toBeNull();
  });
});
