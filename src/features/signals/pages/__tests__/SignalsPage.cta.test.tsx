import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignalsPage from "../SignalsPage";

import { TooltipProvider } from "@/components/ui/tooltip";
import { enqueueArtefact, generateAndDownloadPDF } from "@/features/artifacts";

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

// The "Find Matched Leads" button lives inside the expanded description section.
// Click "Read more" first to reveal it.
function expandCard(card: HTMLElement) {
  const readMore = within(card).getByRole("button", { name: /Read more/i });
  fireEvent.click(readMore);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => localStorage.clear());

describe("SignalsPage — Find Matched Leads → Save", () => {
  it("builds, downloads, and enqueues the briefing on Save (no forced nav)", async () => {
    // Seed acceptance so the CTA is active on mount (hash matches the mock above).
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1"]));
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());

    const card = cardFor("Hiring surge");
    // CTA lives in the expanded description section — expand first.
    expandCard(card);
    fireEvent.click(within(card).getByRole("button", { name: /Find Matched Leads/i }));
    fireEvent.click(within(card).getByRole("button", { name: /Save as Artifact/i }));

    expect(generateAndDownloadPDF).toHaveBeenCalledTimes(1);
    expect(enqueueArtefact).toHaveBeenCalledTimes(1);
    const item = vi.mocked(enqueueArtefact).mock.calls[0][0];
    expect(item.id).toMatch(/^signal-briefing-sig-1-\d+$/);
    expect(item.fullReport.keyFindings[0]).toContain("ICP match");
    // Still on the signals feed.
    expect(screen.getByText("Hiring surge")).toBeInTheDocument();
  });

  it("opens only one leads section at a time", async () => {
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1", "hash-sig-2"]));
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());

    // CTA lives in the expanded description section — expand both cards first.
    expandCard(cardFor("Hiring surge"));
    expandCard(cardFor("Funding round"));

    fireEvent.click(
      within(cardFor("Hiring surge")).getByRole("button", { name: /Find Matched Leads/i }),
    );
    expect(within(cardFor("Hiring surge")).getByText("Acme")).toBeInTheDocument();

    fireEvent.click(
      within(cardFor("Funding round")).getByRole("button", { name: /Find Matched Leads/i }),
    );
    // sig-1's section closed; sig-2 has zero leads → its zero-state shows, sig-1's rows gone.
    expect(
      within(cardFor("Funding round")).getByText(/No matched leads found/i),
    ).toBeInTheDocument();
    expect(within(cardFor("Hiring surge")).queryByText("Acme")).toBeNull();
  });

  it("collapses an open leads section when its signal is un-accepted", async () => {
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1"]));
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());

    const card = cardFor("Hiring surge");
    // CTA lives in the expanded description section — expand first.
    expandCard(card);
    fireEvent.click(within(card).getByRole("button", { name: /Find Matched Leads/i }));
    expect(within(card).getByText("Acme")).toBeInTheDocument();

    // Seeded accepted → the accept toggle's accessible name is "Unaccept signal".
    fireEvent.click(within(card).getByRole("button", { name: /Unaccept signal/i }));
    await waitFor(() => expect(within(card).queryByText("Acme")).toBeNull());
  });
});
