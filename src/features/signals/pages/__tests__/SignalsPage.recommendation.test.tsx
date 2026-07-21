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
}));
vi.mock("@/shared/tenant", () => ({
  useTenant: () => ({ selectedTenant: null }),
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

describe("SignalsPage — Save recommendation as Artifact", () => {
  it("builds, downloads, and enqueues a playbook on Save", async () => {
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1"]));
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());
    const card = screen.getByText("Hiring surge").closest(".bg-white") as HTMLElement;

    fireEvent.click(within(card).getByText("Read more")); // expand description
    fireEvent.click(within(card).getByText("Reach out")); // expand recommendation → fetches answer
    await waitFor(() =>
      expect(
        within(card)
          .getByRole("button", { name: /Save as Artifact/i })
          .getAttribute("aria-disabled"),
      ).toBe("false"),
    );
    fireEvent.click(within(card).getByRole("button", { name: /Save as Artifact/i }));

    await waitFor(() => expect(generateAndDownloadPDF).toHaveBeenCalledTimes(1));
    expect(enqueueArtefact).toHaveBeenCalledTimes(1);
    const item = vi.mocked(enqueueArtefact).mock.calls[0][0];
    expect(item.type).toBe("playbook");
    expect(item.id).toMatch(/^recommendation-playbook-sig-1-0-\d+$/);
  });

  it("shows the inline error and skips delivery when the backend rejects", async () => {
    const { generateRecommendationArtefact } = await import("../../services/signals");
    vi.mocked(generateRecommendationArtefact).mockRejectedValueOnce(new Error("boom"));
    localStorage.setItem("signals_u1_accepted", JSON.stringify(["hash-sig-1"]));
    renderPage();
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());
    const card = screen.getByText("Hiring surge").closest(".bg-white") as HTMLElement;
    fireEvent.click(within(card).getByText("Read more"));
    fireEvent.click(within(card).getByText("Reach out"));
    await waitFor(() =>
      expect(
        within(card)
          .getByRole("button", { name: /Save as Artifact/i })
          .getAttribute("aria-disabled"),
      ).toBe("false"),
    );
    fireEvent.click(within(card).getByRole("button", { name: /Save as Artifact/i }));
    // The destructive toast also carries this copy; within(card) scopes to the inline-below-row <p>.
    await waitFor(() =>
      expect(within(card).getByText(/Could not generate artifact/i)).toBeInTheDocument(),
    );
    expect(generateAndDownloadPDF).not.toHaveBeenCalled();
  });

  it("does not double-submit while a playbook is already generating", async () => {
    const { generateRecommendationArtefact } = await import("../../services/signals");
    // Hold the first call open so the generating state stays active across a 2nd click.
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
    await waitFor(() => expect(screen.getByText("Hiring surge")).toBeInTheDocument());
    const card = screen.getByText("Hiring surge").closest(".bg-white") as HTMLElement;

    fireEvent.click(within(card).getByText("Read more"));
    fireEvent.click(within(card).getByText("Reach out"));
    await waitFor(() =>
      expect(
        within(card)
          .getByRole("button", { name: /Save as Artifact/i })
          .getAttribute("aria-disabled"),
      ).toBe("false"),
    );

    const saveBtn = within(card).getByRole("button", { name: /Save as Artifact/i });
    fireEvent.click(saveBtn); // 1st click → generating starts, service call left pending
    await waitFor(() => expect(within(card).getByText(/Generating/i)).toBeInTheDocument());
    fireEvent.click(saveBtn); // 2nd click while generating → must be ignored

    // Despite two clicks, the service is called exactly once.
    expect(vi.mocked(generateRecommendationArtefact)).toHaveBeenCalledTimes(1);

    // Resolve the in-flight call; exactly one delivery + enqueue occurs.
    resolveFirst();
    await waitFor(() => expect(generateAndDownloadPDF).toHaveBeenCalledTimes(1));
    expect(enqueueArtefact).toHaveBeenCalledTimes(1);
  });
});
