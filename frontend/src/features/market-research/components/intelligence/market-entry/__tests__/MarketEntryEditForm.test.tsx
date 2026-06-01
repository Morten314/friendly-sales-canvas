import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MarketEntryEditForm, { type MarketEntryEditFormProps } from "../MarketEntryEditForm";

import { TooltipProvider } from "@/components/ui/tooltip";

const noop = () => {};

function buildProps(overrides: Partial<MarketEntryEditFormProps> = {}): MarketEntryEditFormProps {
  return {
    deletedSections: new Set<string>(),
    editExecutiveSummary: "Summary text",
    setEditExecutiveSummary: vi.fn(),
    editEntryBarriers: ["Barrier one"],
    setEditEntryBarriers: vi.fn(),
    editRecommendedChannel: "Partners",
    setEditRecommendedChannel: vi.fn(),
    editTimeToMarket: "6 months",
    setEditTimeToMarket: vi.fn(),
    editTopBarrier: "Regulation",
    setEditTopBarrier: vi.fn(),
    editCompetitiveDifferentiation: ["Diff one"],
    setEditCompetitiveDifferentiation: vi.fn(),
    editStrategicRecommendations: ["Rec one"],
    setEditStrategicRecommendations: vi.fn(),
    editRiskAssessment: ["Risk one"],
    setEditRiskAssessment: vi.fn(),
    editSwotAnalysis: {
      strengths: ["S1"],
      weaknesses: ["W1"],
      opportunities: ["O1"],
      threats: ["T1"],
    },
    setEditSwotAnalysis: vi.fn(),
    onSave: vi.fn(),
    onCancelEdit: vi.fn(),
    onEditHistoryOpen: vi.fn(),
    onScoutIconClick: vi.fn(),
    onDeleteSection: vi.fn(),
    onExecutiveSummaryChange: vi.fn(),
    onEntryBarriersChange: vi.fn(),
    onRecommendedChannelChange: vi.fn(),
    onTimeToMarketChange: vi.fn(),
    onTopBarrierChange: vi.fn(),
    onCompetitiveDifferentiationChange: vi.fn(),
    onStrategicRecommendationsChange: vi.fn(),
    onRiskAssessmentChange: vi.fn(),
    toast: vi.fn(() => ({ id: "1", dismiss: noop, update: noop })),
    ...overrides,
  };
}

function renderForm(props: MarketEntryEditFormProps) {
  return render(
    <TooltipProvider>
      <MarketEntryEditForm {...props} />
    </TooltipProvider>,
  );
}

describe("MarketEntryEditForm", () => {
  it("seeds inputs from the passed edit values", () => {
    renderForm(buildProps());

    expect(screen.getByDisplayValue("Summary text")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Barrier one")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Partners")).toBeInTheDocument();
    expect(screen.getByDisplayValue("6 months")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Regulation")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Diff one")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Rec one")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Risk one")).toBeInTheDocument();
    // SWOT editor is wired as a child
    expect(screen.getByDisplayValue("S1")).toBeInTheDocument();
  });

  it("fires setEditExecutiveSummary when typing in the executive summary field", () => {
    const setEditExecutiveSummary = vi.fn();
    renderForm(buildProps({ setEditExecutiveSummary }));

    fireEvent.change(screen.getByDisplayValue("Summary text"), {
      target: { value: "New summary" },
    });

    expect(setEditExecutiveSummary).toHaveBeenCalledWith("New summary");
  });

  it("fires setEditRecommendedChannel when typing in the recommended channel field", () => {
    const setEditRecommendedChannel = vi.fn();
    renderForm(buildProps({ setEditRecommendedChannel }));

    fireEvent.change(screen.getByDisplayValue("Partners"), {
      target: { value: "Direct" },
    });

    expect(setEditRecommendedChannel).toHaveBeenCalledWith("Direct");
  });

  it("appends an empty barrier when Add Barrier is clicked", () => {
    const setEditEntryBarriers = vi.fn();
    renderForm(buildProps({ setEditEntryBarriers }));

    fireEvent.click(screen.getByRole("button", { name: "Add Barrier" }));

    expect(setEditEntryBarriers).toHaveBeenCalledWith(["Barrier one", ""]);
  });

  it("fires the save handler when Save Changes is clicked", () => {
    const onSave = vi.fn();
    renderForm(buildProps({ onSave }));

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("fires onCancelEdit when Cancel is clicked", () => {
    const onCancelEdit = vi.fn();
    renderForm(buildProps({ onCancelEdit }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancelEdit).toHaveBeenCalledTimes(1);
  });

  it("hides the SWOT editor when swot-analysis is in deletedSections", () => {
    renderForm(buildProps({ deletedSections: new Set(["swot-analysis"]) }));

    expect(screen.queryByDisplayValue("S1")).not.toBeInTheDocument();
  });
});
