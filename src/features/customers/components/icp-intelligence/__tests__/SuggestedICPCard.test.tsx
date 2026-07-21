import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SuggestedICP } from "../../../types";
import { RecommendedICPCard } from "../SuggestedICPCard";

const icp: SuggestedICP = {
  id: "rec-1",
  name: "Enterprise FinTech",
  type: "new",
  industry: "Financial Services",
  segment: "FinTech",
  companySize: "500-2000",
  decisionMakers: ["CDO"],
  regions: ["US"],
  keyAttributes: ["API-first"],
  whySuggested: ["High overlap"],
  confidenceScore: "Medium",
};

describe("RecommendedICPCard", () => {
  it("renders the ICP identity and actions", () => {
    render(
      <RecommendedICPCard
        icp={icp}
        leadCount={3}
        status={{ status: "suggested" }}
        isExpanded={false}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onUndo={vi.fn()}
        onToggleReport={vi.fn()}
        onViewProspects={vi.fn()}
      />,
    );
    expect(screen.getByText("Enterprise FinTech")).toBeInTheDocument();
    expect(screen.getByText(/Financial Services/i)).toBeInTheDocument();
    // Suggested status renders the accept/reject + view-report actions.
    expect(screen.getByRole("button", { name: /Accept/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View Full Report/i })).toBeInTheDocument();
  });
});
