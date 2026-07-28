import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignalsPage from "../SignalsPage";

import { TooltipProvider } from "@/components/ui/tooltip";
import {
  enqueueArtefact,
  generateAndDownloadCsv,
  generateAndDownloadPDF,
} from "@/features/artifacts";

const SIGNAL = {
  id: "sig-1",
  agent: "scout",
  timestamp: "1h ago",
  headline: "Hiring surge",
  snippet: "s",
  description: "Detailed ICP context.",
  sourceUrl: "#",
  sourceLabel: "Press",
  source: [],
  nextBestMoves: [],
  NBAs: [{ nba: "Reach out", prompt: "why-prompt" }],
  contextualSuggestions: [],
};
const LEADS = [{ lead_id: "l1", company: "Acme", relevance: "high", why: "fit" }];

vi.mock("@/shared/auth", () => ({
  useAuth: () => ({ currentUser: { uid: "u1" }, orgId: "org1" }),
  useOrgId: () => "org1",
}));
vi.mock("../../hooks/useSignalLeadMap", () => ({
  useSignalLeadMap: () => ({
    leadsForSignal: (id: string) => (id === "sig-1" ? LEADS : []),
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  }),
}));
vi.mock("../../services/signals", () => ({
  fetchSignals: vi.fn().mockResolvedValue({}),
  generateSignalsBatch: vi.fn().mockResolvedValue({}),
  generateRecommendationArtefact: vi.fn().mockResolvedValue({
    what_to_do: "do",
    strategy: "play",
    how_to_communicate: "warm",
    communication_channel: "email",
    communication_template: "Hi [First Name]",
  }),
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
  useSignalAsk: () => ({ mutateAsync: vi.fn().mockResolvedValue({ answer: "the answer" }) }),
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
});
afterEach(() => localStorage.clear());

/**
 * Expand the card's description + recommendation and wait for the "View Outreach
 * Plan" button to become enabled (its answer has loaded). Returns the card element.
 */
async function openRecommendation() {
  await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());
  const card = screen.getByText("Hiring surge").closest(".bg-white") as HTMLElement;
  fireEvent.click(within(card).getByText("Read more")); // expand description
  fireEvent.click(within(card).getByText("Reach out")); // expand recommendation → fetches answer
  await waitFor(() =>
    expect(
      within(card)
        .getByRole("button", { name: /View Outreach Plan/i })
        .getAttribute("aria-disabled"),
    ).toBe("false"),
  );
  return card;
}

describe("SignalsPage — View Outreach Plan", () => {
  it("generates and shows the plan inline on View, with no auto-download or auto-save", async () => {
    const { generateRecommendationArtefact } = await import("../../services/signals");
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1"]));
    renderPage();
    const card = await openRecommendation();

    fireEvent.click(within(card).getByRole("button", { name: /View Outreach Plan/i }));

    await waitFor(() => expect(within(card).getByText("Outreach Plan")).toBeInTheDocument());
    expect(within(card).getByText("Hi [First Name]")).toBeInTheDocument();
    expect(vi.mocked(generateRecommendationArtefact)).toHaveBeenCalledTimes(1);
    // Viewing must not download or enqueue anything (the whole point of the change).
    expect(generateAndDownloadPDF).not.toHaveBeenCalled();
    expect(generateAndDownloadCsv).not.toHaveBeenCalled();
    expect(enqueueArtefact).not.toHaveBeenCalled();
  });

  it("Save to Library / Download PDF / Download CSV build + deliver from the viewed plan", async () => {
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1"]));
    renderPage();
    const card = await openRecommendation();
    fireEvent.click(within(card).getByRole("button", { name: /View Outreach Plan/i }));
    await waitFor(() =>
      expect(within(card).getByRole("button", { name: /Save to Library/i })).toBeInTheDocument(),
    );

    fireEvent.click(within(card).getByRole("button", { name: /Save to Library/i }));
    expect(enqueueArtefact).toHaveBeenCalledTimes(1);
    const item = vi.mocked(enqueueArtefact).mock.calls[0][0];
    expect(item.type).toBe("playbook");
    expect(item.id).toMatch(/^recommendation-playbook-sig-1-0-\d+$/);

    fireEvent.click(within(card).getByRole("button", { name: /Download PDF/i }));
    expect(generateAndDownloadPDF).toHaveBeenCalledTimes(1);
    fireEvent.click(within(card).getByRole("button", { name: /Download CSV/i }));
    expect(generateAndDownloadCsv).toHaveBeenCalledTimes(1);
  });

  it("caches the plan — collapsing then reopening does not re-call the backend", async () => {
    const { generateRecommendationArtefact } = await import("../../services/signals");
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1"]));
    renderPage();
    const card = await openRecommendation();

    fireEvent.click(within(card).getByRole("button", { name: /View Outreach Plan/i }));
    await waitFor(() =>
      expect(within(card).getByRole("button", { name: /Hide Outreach Plan/i })).toBeInTheDocument(),
    );
    fireEvent.click(within(card).getByRole("button", { name: /Hide Outreach Plan/i })); // collapse
    fireEvent.click(within(card).getByRole("button", { name: /View Outreach Plan/i })); // reopen

    await waitFor(() => expect(within(card).getByText("Outreach Plan")).toBeInTheDocument());
    expect(vi.mocked(generateRecommendationArtefact)).toHaveBeenCalledTimes(1);
  });

  it("shows the panel error with Try again when generation fails, then recovers on retry", async () => {
    const { generateRecommendationArtefact } = await import("../../services/signals");
    vi.mocked(generateRecommendationArtefact).mockRejectedValueOnce(new Error("boom"));
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1"]));
    renderPage();
    const card = await openRecommendation();

    fireEvent.click(within(card).getByRole("button", { name: /View Outreach Plan/i }));
    await waitFor(() =>
      expect(within(card).getByText(/Could not generate outreach plan/i)).toBeInTheDocument(),
    );
    expect(generateAndDownloadPDF).not.toHaveBeenCalled();

    fireEvent.click(within(card).getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(within(card).getByText("Outreach Plan")).toBeInTheDocument());
    expect(vi.mocked(generateRecommendationArtefact)).toHaveBeenCalledTimes(2);
  });

  it("does not double-submit while a plan is already generating", async () => {
    const { generateRecommendationArtefact } = await import("../../services/signals");
    let resolveFirst: () => void = () => {};
    vi.mocked(generateRecommendationArtefact).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = () =>
            resolve({
              what_to_do: "do",
              strategy: "play",
              how_to_communicate: "warm",
              communication_channel: "email",
              communication_template: "Hi [First Name]",
            });
        }),
    );
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1"]));
    renderPage();
    const card = await openRecommendation();

    fireEvent.click(within(card).getByRole("button", { name: /View Outreach Plan/i })); // starts, pending
    await waitFor(() =>
      expect(within(card).getByRole("button", { name: /Generating/i })).toBeInTheDocument(),
    );
    fireEvent.click(within(card).getByRole("button", { name: /Generating/i })); // ignored while in flight
    expect(vi.mocked(generateRecommendationArtefact)).toHaveBeenCalledTimes(1);

    resolveFirst();
    await waitFor(() => expect(within(card).getByText("Outreach Plan")).toBeInTheDocument());
  });
});
