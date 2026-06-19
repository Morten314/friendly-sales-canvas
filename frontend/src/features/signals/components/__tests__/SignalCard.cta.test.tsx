import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SignalLeadMapLead } from "../../contracts";
import type { SignalCard as SignalCardType } from "../../types";
import { SignalCard } from "../SignalCard";

import { TooltipProvider } from "@/components/ui/tooltip";

const signal: SignalCardType = {
  id: "sig-1",
  agent: "scout",
  timestamp: "1h ago",
  headline: "Hiring surge",
  snippet: "…",
  description: "Detailed ICP context paragraph.",
  sourceUrl: "#",
  sourceLabel: "Press",
  source: [],
  nextBestMoves: [],
  NBAs: [],
  contextualSuggestions: [],
};

const leads: SignalLeadMapLead[] = [
  { lead_id: "l1", company: "Acme", relevance: "high", why: "secret rationale" },
  { lead_id: "l2", company: "", relevance: "low", why: "" },
];

function renderCard(overrides: Partial<React.ComponentProps<typeof SignalCard>> = {}) {
  const props: React.ComponentProps<typeof SignalCard> = {
    signal,
    isAccepted: false,
    getAgentBadge: () => <span>From scout</span>,
    isDescriptionExpanded: true, // CTA lives inside the expanded block
    expandedRecommendationIndex: null,
    recommendationAnswers: {},
    recommendationAnswerLoading: null,
    answerExpandedKeys: new Set<string>(),
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onBotIconClick: vi.fn(),
    onNavigateToAgentChat: vi.fn(),
    onExpandDescription: vi.fn(),
    onCollapseDescription: vi.fn(),
    onToggleRecommendation: vi.fn(),
    onExpandAnswer: vi.fn(),
    onCollapseAnswer: vi.fn(),
    matchedLeads: [],
    leadsLoading: false,
    leadsError: false,
    isLeadsExpanded: false,
    onFindMatchedLeads: vi.fn(),
    onSaveAsArtefact: vi.fn(),
    onRecomputeLeadMap: vi.fn(),
    ...overrides,
  };
  render(
    <TooltipProvider>
      <SignalCard {...props} />
    </TooltipProvider>,
  );
  return props;
}

afterEach(() => vi.useRealTimers());

describe("SignalCard — Find Matched Leads CTA", () => {
  it("is styled-disabled yet clickable when not accepted, and shows the lock message", () => {
    const props = renderCard({ isAccepted: false });
    const btn = screen.getByRole("button", { name: /Find Matched Leads/i });
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(btn);
    expect(screen.getByText(/Accept this signal to unlock matched leads/i)).toBeInTheDocument();
    expect(props.onFindMatchedLeads).not.toHaveBeenCalled();
  });

  it("auto-dismisses the lock message after 3 s", () => {
    vi.useFakeTimers();
    renderCard({ isAccepted: false });
    const btn = screen.getByRole("button", { name: /Find Matched Leads/i });
    fireEvent.click(btn);
    expect(screen.getByText(/Accept this signal to unlock matched leads/i)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText(/Accept this signal to unlock matched leads/i)).toBeNull();
  });

  it("calls onFindMatchedLeads when accepted", () => {
    const props = renderCard({ isAccepted: true });
    fireEvent.click(screen.getByRole("button", { name: /Find Matched Leads/i }));
    expect(props.onFindMatchedLeads).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Accept this signal to unlock matched leads/i)).toBeNull();
  });
});

describe("SignalCard — leads section states", () => {
  it("renders a loading affordance, not 'no leads'", () => {
    renderCard({ isAccepted: true, isLeadsExpanded: true, leadsLoading: true });
    expect(screen.getByText(/Finding matched leads/i)).toBeInTheDocument();
    expect(screen.queryByText(/No matched leads/i)).toBeNull();
  });

  it("renders an error line with a recompute action", () => {
    const props = renderCard({ isAccepted: true, isLeadsExpanded: true, leadsError: true });
    fireEvent.click(screen.getByRole("button", { name: /Recompute lead mapping/i }));
    expect(props.onRecomputeLeadMap).toHaveBeenCalledTimes(1);
  });

  it("renders the zero-leads message and hides Save", () => {
    renderCard({ isAccepted: true, isLeadsExpanded: true, matchedLeads: [] });
    expect(screen.getByText(/No matched leads found for this signal yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save as Artefact/i })).toBeNull();
  });

  it("renders rows with title-cased relevance + company fallback, hides why, shows Save", () => {
    const props = renderCard({ isAccepted: true, isLeadsExpanded: true, matchedLeads: leads });
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Unknown company")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    // The per-lead `why` is reserved for the export — never on screen.
    expect(screen.queryByText(/secret rationale/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Save as Artefact/i }));
    expect(props.onSaveAsArtefact).toHaveBeenCalledTimes(1);
  });
});
