import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SignalCard } from "../SignalCard";

import { TooltipProvider } from "@/components/ui/tooltip";

type SignalCardProps = React.ComponentProps<typeof SignalCard>;

const baseSignal = {
  id: "s1",
  agent: "scout",
  timestamp: "2026-06-15T00:00:00Z",
  headline: "Hiring surge",
  snippet: "…",
  description: "…",
  sourceUrl: "https://x",
  sourceLabel: "X",
  nextBestMoves: [],
  contextualSuggestions: [],
} as unknown as SignalCardProps["signal"];

const noop = vi.fn();
const props: SignalCardProps = {
  signal: baseSignal,
  isAccepted: false,
  getAgentBadge: () => null,
  isDescriptionExpanded: false,
  expandedRecommendationIndex: null,
  recommendationAnswers: {},
  recommendationAnswerLoading: null,
  answerExpandedKeys: new Set<string>(),
  onAccept: noop,
  onReject: noop,
  onBotIconClick: noop,
  onNavigateToAgentChat: noop,
  onExpandDescription: noop,
  onCollapseDescription: noop,
  onToggleRecommendation: noop,
  onExpandAnswer: noop,
  onCollapseAnswer: noop,
  matchedLeads: [],
  leadsLoading: false,
  leadsError: false,
  isLeadsExpanded: false,
  onFindMatchedLeads: noop,
  onSaveAsArtefact: noop,
  onRecomputeLeadMap: noop,
  onSaveRecommendationAsArtefact: noop,
  recommendationArtefactGeneratingKey: null,
  recommendationArtefactErrorKey: null,
};

describe("SignalCard — Affects N leads", () => {
  it("shows the count when affectedLeadCount > 0", () => {
    render(
      <TooltipProvider>
        <SignalCard {...props} affectedLeadCount={3} />
      </TooltipProvider>,
    );
    expect(screen.getByText(/Affects/)).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });
  it("renders nothing when count is 0/undefined", () => {
    render(
      <TooltipProvider>
        <SignalCard {...props} />
      </TooltipProvider>,
    );
    expect(screen.queryByText(/Affects/)).toBeNull();
  });
});
