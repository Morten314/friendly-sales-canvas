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
    onSaveRecommendationAsArtefact: vi.fn(),
    recommendationArtefactGeneratingKey: null,
    recommendationArtefactErrorKey: null,
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
    // Lock message must be a polite live region so screen readers announce it.
    expect(screen.getByRole("status")).toHaveTextContent(
      /Accept this signal to unlock matched leads/i,
    );
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

  it("clears the lock message immediately when the signal is accepted", () => {
    const baseProps: React.ComponentProps<typeof SignalCard> = {
      signal,
      isAccepted: false,
      getAgentBadge: () => <span>From scout</span>,
      isDescriptionExpanded: true,
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
      onSaveRecommendationAsArtefact: vi.fn(),
      recommendationArtefactGeneratingKey: null,
      recommendationArtefactErrorKey: null,
    };
    const { rerender } = render(
      <TooltipProvider>
        <SignalCard {...baseProps} />
      </TooltipProvider>,
    );
    // Show the lock message by clicking while not accepted.
    fireEvent.click(screen.getByRole("button", { name: /Find Matched Leads/i }));
    expect(screen.getByText(/Accept this signal to unlock matched leads/i)).toBeInTheDocument();
    // Re-render the same card with isAccepted flipped — lock message must vanish immediately.
    rerender(
      <TooltipProvider>
        <SignalCard {...baseProps} isAccepted={true} />
      </TooltipProvider>,
    );
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

  it("error state offers a Try again action that calls onRetryLeadMap (S5)", () => {
    const onRetryLeadMap = vi.fn();
    renderCard({ isAccepted: true, isLeadsExpanded: true, leadsError: true, onRetryLeadMap });
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetryLeadMap).toHaveBeenCalledTimes(1);
  });

  it("shows the in-flight spinner while recomputing (leadsFetching), not the stale error (S6)", () => {
    renderCard({
      isAccepted: true,
      isLeadsExpanded: true,
      leadsError: true,
      leadsFetching: true,
    });
    expect(screen.getByText(/finding matched leads/i)).toBeInTheDocument();
    expect(screen.queryByText(/could not load matched leads/i)).not.toBeInTheDocument();
  });

  it("renders the zero-leads message and hides Save", () => {
    renderCard({ isAccepted: true, isLeadsExpanded: true, matchedLeads: [] });
    expect(screen.getByText(/No matched leads found for this signal yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save as Artifact/i })).toBeNull();
  });

  it("renders rows with title-cased relevance + company fallback, hides why, shows Save", () => {
    const props = renderCard({ isAccepted: true, isLeadsExpanded: true, matchedLeads: leads });
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Unknown company")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    // The per-lead `why` is reserved for the export — never on screen.
    expect(screen.queryByText(/secret rationale/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Save as Artifact/i }));
    expect(props.onSaveAsArtefact).toHaveBeenCalledTimes(1);
  });
});

describe("SignalCard — recommendation Save as Artifact", () => {
  const withRec = {
    signal: { ...signal, NBAs: [{ nba: "Reach out", prompt: "p1" }] },
    isDescriptionExpanded: true,
    expandedRecommendationIndex: 0,
  };

  it("is greyed and shows the accept hint when not accepted", () => {
    const props = renderCard({
      ...withRec,
      isAccepted: false,
      recommendationAnswers: { "sig-1-0": "ans" },
    });
    const btn = screen.getByRole("button", { name: /Save as Artifact/i });
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(btn);
    expect(screen.getByText(/Accept this signal to save as artifact/i)).toBeInTheDocument();
    expect(props.onSaveRecommendationAsArtefact).not.toHaveBeenCalled();
  });

  it("is greyed and shows the load-answer hint when accepted but no cached answer", () => {
    const props = renderCard({ ...withRec, isAccepted: true, recommendationAnswers: {} });
    fireEvent.click(screen.getByRole("button", { name: /Save as Artifact/i }));
    expect(screen.getByText(/Load the recommendation answer first/i)).toBeInTheDocument();
    expect(props.onSaveRecommendationAsArtefact).not.toHaveBeenCalled();
  });

  it("is active and calls onSaveRecommendationAsArtefact(index) when accepted + cached", () => {
    const props = renderCard({
      ...withRec,
      isAccepted: true,
      recommendationAnswers: { "sig-1-0": "ans" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save as Artifact/i }));
    expect(props.onSaveRecommendationAsArtefact).toHaveBeenCalledWith(0);
  });

  it("shows a generating spinner when the key matches", () => {
    renderCard({
      ...withRec,
      isAccepted: true,
      recommendationAnswers: { "sig-1-0": "ans" },
      recommendationArtefactGeneratingKey: "sig-1-0",
    });
    expect(screen.getByText(/Generating/i)).toBeInTheDocument();
  });

  it("shows an inline error when the error key matches", () => {
    renderCard({
      ...withRec,
      isAccepted: true,
      recommendationAnswers: { "sig-1-0": "ans" },
      recommendationArtefactErrorKey: "sig-1-0",
    });
    expect(screen.getByText(/Could not generate artifact/i)).toBeInTheDocument();
  });

  it("renders the answer action row as justify-between with Chat on the right", () => {
    renderCard({ ...withRec, isAccepted: true, recommendationAnswers: { "sig-1-0": "ans" } });
    // Header bot button + row Chat button both match; assert at least one is present.
    expect(screen.getAllByRole("button", { name: /Chat with Scout/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Save as Artifact/i })).toBeInTheDocument();
    // Assert the row is actually justify-between (not merely that the buttons exist), so a
    // regression to the old single left-aligned flex (D-1) would fail this test.
    const row = screen
      .getByRole("button", { name: /Save as Artifact/i })
      .closest("div.justify-between");
    expect(row).not.toBeNull();
  });
});
