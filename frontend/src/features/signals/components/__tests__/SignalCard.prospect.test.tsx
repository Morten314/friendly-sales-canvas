import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
  description: "ctx",
  sourceUrl: "#",
  sourceLabel: "Press",
  source: [],
  nextBestMoves: [],
  NBAs: [],
  contextualSuggestions: [],
};

const leads: SignalLeadMapLead[] = [
  {
    lead_id: "l1",
    company: "Acme",
    relevance: "high",
    why: "x",
    name: "Jane Doe",
    title: "VP Engineering",
    seniority: "CXO",
  },
  { lead_id: "l2", company: "Globex", relevance: "low", why: "y" }, // no name → company primary
];

function renderCard() {
  render(
    <TooltipProvider>
      <SignalCard
        signal={signal}
        isAccepted
        getAgentBadge={() => <span>scout</span>}
        isDescriptionExpanded
        expandedRecommendationIndex={null}
        recommendationAnswers={{}}
        recommendationAnswerLoading={null}
        answerExpandedKeys={new Set<string>()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onBotIconClick={vi.fn()}
        onNavigateToAgentChat={vi.fn()}
        onExpandDescription={vi.fn()}
        onCollapseDescription={vi.fn()}
        onToggleRecommendation={vi.fn()}
        onExpandAnswer={vi.fn()}
        onCollapseAnswer={vi.fn()}
        matchedLeads={leads}
        leadsLoading={false}
        leadsError={false}
        isLeadsExpanded
        onFindMatchedLeads={vi.fn()}
        onSaveAsArtefact={vi.fn()}
        onRecomputeLeadMap={vi.fn()}
        onSaveRecommendationAsArtefact={vi.fn()}
        recommendationArtefactGeneratingKey={null}
        recommendationArtefactErrorKey={null}
      />
    </TooltipProvider>,
  );
}

describe("SignalCard — prospect fields", () => {
  it("shows name as the primary line and title · seniority · company as the secondary", () => {
    renderCard();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/VP Engineering · CXO · Acme/)).toBeInTheDocument();
  });

  it("falls back to company as the primary line when there is no name", () => {
    renderCard();
    expect(screen.getByText("Globex")).toBeInTheDocument();
  });
});
