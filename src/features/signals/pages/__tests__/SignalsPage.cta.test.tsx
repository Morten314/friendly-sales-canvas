import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignalsPage from "../SignalsPage";

import { TooltipProvider } from "@/components/ui/tooltip";


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
const SIGNAL_2 = { ...SIGNAL, id: "sig-2", headline: "Funding round" };

const LEADS = [{ lead_id: "l1", company: "Acme", relevance: "high", why: "ICP match" }];

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
}));
vi.mock("@/shared/tenant", () => ({
  useTenant: () => ({ selectedTenant: null }),
}));
vi.mock("../../hooks/useSignalLeadMap", () => ({
  useSignalLeadMap: () => ({
    leadsForSignal: (id: string) => (id === "sig-1" ? LEADS : []),
    isLoading: false,
    isFetching: false,
    isError: false,
    refresh: vi.fn().mockResolvedValue(true),
    retry: vi.fn(),
  }),
}));
vi.mock("../../services/signals", () => ({
  fetchSignals: vi.fn().mockResolvedValue({}),
  generateSignalsBatch: vi.fn().mockResolvedValue({}),
}));
vi.mock("../../components/signalCards", () => ({
  buildSignalCardsFromFetchData: () => [SIGNAL, SIGNAL_2],
  applyRejectedFilterAndSort: (s: unknown[]) => s,
  getFallbackSampleSignals: () => [SIGNAL, SIGNAL_2],
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

// Card order is stable: [sig-1, sig-2]. Header accept/reject buttons carry
// aria-labels (added in Task 5), so they are selected by accessible name — never
// by position. Acceptance is seeded via localStorage so the CTA is active on mount.
function cardFor(headline: string): HTMLElement {
  return screen.getByText(headline).closest(".bg-white") as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => localStorage.clear());

describe("SignalsPage — Find Matched Leads", () => {
  it("opens only one leads section at a time", async () => {
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1", "hash-sig-2"]));
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());

    // "Find matched leads" lives on the resting card — no need to expand first.
    fireEvent.click(
      within(cardFor("Hiring surge")).getByRole("button", { name: /Find Matched Leads/i }),
    );
    expect(within(cardFor("Hiring surge")).getByText("Acme")).toBeInTheDocument();

    fireEvent.click(
      within(cardFor("Funding round")).getByRole("button", { name: /Find Matched Leads/i }),
    );
    // Opening sig-2 closes sig-1; sig-1's rows disappear, sig-2's leads block is open.
    expect(within(cardFor("Hiring surge")).queryByText("Acme")).toBeNull();
    expect(within(cardFor("Funding round")).getByText("Matched leads")).toBeInTheDocument();
  });

  it("collapses an open leads section when its signal is un-accepted", async () => {
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1"]));
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());

    const card = cardFor("Hiring surge");
    fireEvent.click(within(card).getByRole("button", { name: /Find Matched Leads/i }));
    expect(within(card).getByText("Acme")).toBeInTheDocument();

    // Seeded accepted → the accept toggle's accessible name is "Unaccept signal".
    fireEvent.click(within(card).getByRole("button", { name: /Unaccept signal/i }));
    await waitFor(() => expect(within(card).queryByText("Acme")).toBeNull());
  });
});
