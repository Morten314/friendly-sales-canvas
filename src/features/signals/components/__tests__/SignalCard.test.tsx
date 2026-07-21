import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SignalCard as SignalCardType } from "../../types";
import { SignalCard } from "../SignalCard";

import { TooltipProvider } from "@/components/ui/tooltip";

const signal: SignalCardType = {
  id: "sig-1",
  agent: "scout",
  timestamp: "1h ago",
  headline: "Competitor X launches SMB pricing tier.",
  snippet: "Likely to impact your ICP accounts.",
  description: "Detailed ICP context paragraph.",
  sourceUrl: "#",
  sourceLabel: "Press release link",
  source: [],
  nextBestMoves: [],
  NBAs: [],
  contextualSuggestions: [],
};

// fireEvent (sync) is the suite-wide click driver here (no user-event dep).
// The card header renders accept/reject/bot icon buttons (no accessible name),
// so we drive them by their stable header order: [accept, reject, bot].
function renderCard(overrides: Partial<React.ComponentProps<typeof SignalCard>> = {}) {
  const props = {
    signal,
    isAccepted: false,
    getAgentBadge: (agent: SignalCardType["agent"]) => <span>{`From ${agent}`}</span>,
    isDescriptionExpanded: false,
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

describe("SignalCard", () => {
  it("renders the headline, snippet, and agent badge", () => {
    renderCard();
    expect(screen.getByText("Competitor X launches SMB pricing tier.")).toBeInTheDocument();
    expect(screen.getByText("Likely to impact your ICP accounts.")).toBeInTheDocument();
    expect(screen.getByText("From scout")).toBeInTheDocument();
  });

  it("fires onAccept with the signal id when the accept button is clicked", () => {
    const props = renderCard();
    // Header order: [accept, reject, bot].
    const [acceptBtn] = screen.getAllByRole("button");
    fireEvent.click(acceptBtn);
    expect(props.onAccept).toHaveBeenCalledWith("sig-1");
  });

  it("fires onReject with the signal id when the reject button is clicked", () => {
    const props = renderCard();
    const [, rejectBtn] = screen.getAllByRole("button");
    fireEvent.click(rejectBtn);
    expect(props.onReject).toHaveBeenCalledWith("sig-1");
  });

  it("fires onBotIconClick with the signal when the bot button is clicked", () => {
    const props = renderCard();
    fireEvent.click(screen.getByTitle(/Chat with Scout/i));
    expect(props.onBotIconClick).toHaveBeenCalledWith(signal);
  });

  it("shows the collapsed Read more affordance and fires onExpandDescription", () => {
    const props = renderCard();
    fireEvent.click(screen.getByRole("button", { name: /Read more/i }));
    expect(props.onExpandDescription).toHaveBeenCalledTimes(1);
  });

  it("renders the Accepted badge when isAccepted is true", () => {
    renderCard({ isAccepted: true });
    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });
});
