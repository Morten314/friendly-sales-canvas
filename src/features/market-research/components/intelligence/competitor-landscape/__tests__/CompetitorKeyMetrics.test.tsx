import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompetitorKeyMetrics } from "../CompetitorKeyMetrics";
import type { Metric } from "../types";

import { TooltipProvider } from "@/components/ui/tooltip";

function buildProps(overrides: Partial<Parameters<typeof CompetitorKeyMetrics>[0]> = {}) {
  return {
    isEditing: false,
    localMetrics: [] as Metric[],
    setLocalMetrics: vi.fn(),
    localTopPlayerShare: "42%",
    setLocalTopPlayerShare: vi.fn(),
    localEmergingPlayers: "12",
    setLocalEmergingPlayers: vi.fn(),
    displayTopPlayerShare: "42%",
    displayEmergingPlayers: "12",
    handleSaveTopPlayerShare: vi.fn(),
    handleSaveEmergingPlayers: vi.fn(),
    ...overrides,
  };
}

function wrap(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("CompetitorKeyMetrics", () => {
  it("(localMetrics non-empty) renders the metrics grid, not the fallback KPIs", () => {
    const metrics: Metric[] = [
      { label: "Market Size", value: "$5B" },
      { label: "Growth Rate", value: "12%" },
    ];
    wrap(<CompetitorKeyMetrics {...buildProps({ localMetrics: metrics })} />);

    // Metrics grid items should be visible
    expect(screen.getByText("$5B")).toBeInTheDocument();
    expect(screen.getByText("Market Size")).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
    expect(screen.getByText("Growth Rate")).toBeInTheDocument();

    // Fallback KPI labels should NOT appear
    expect(screen.queryByText("Top Player Market Share")).not.toBeInTheDocument();
    expect(screen.queryByText("Emerging Players Added")).not.toBeInTheDocument();
  });

  it("(localMetrics empty) renders the Top-Player-Share / Emerging-Players fallback KPIs", () => {
    wrap(
      <CompetitorKeyMetrics
        {...buildProps({
          localMetrics: [],
          displayTopPlayerShare: "42%",
          displayEmergingPlayers: "12",
        })}
      />,
    );

    expect(screen.getByText("Top Player Market Share")).toBeInTheDocument();
    expect(screen.getByText("Emerging Players Added")).toBeInTheDocument();
    // The display values should appear
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("(isEditing=true, localMetrics empty) shows 'No metrics yet' empty-state", () => {
    wrap(<CompetitorKeyMetrics {...buildProps({ isEditing: true, localMetrics: [] })} />);
    expect(screen.getByText(/No metrics yet/)).toBeInTheDocument();
  });

  it("(isEditing=true, localMetrics non-empty) shows input fields for each metric", () => {
    const metrics: Metric[] = [{ label: "Revenue", value: "$1B" }];
    wrap(<CompetitorKeyMetrics {...buildProps({ isEditing: true, localMetrics: metrics })} />);
    expect(screen.getByDisplayValue("$1B")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Revenue")).toBeInTheDocument();
  });
});
