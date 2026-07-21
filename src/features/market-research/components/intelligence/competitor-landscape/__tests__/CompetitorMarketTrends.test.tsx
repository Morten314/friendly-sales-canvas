import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompetitorMarketTrends } from "../CompetitorMarketTrends";
import { generateTrendData } from "../competitorUiComponents";
import type { TrendChart } from "../types";

import { TooltipProvider } from "@/components/ui/tooltip";

const CHARTS: TrendChart[] = [
  { name: "Revenue Growth", xAxis: ["Q1", "Q2", "Q3"] },
  { name: "Market Share", xAxis: ["Jan", "Feb", "Mar"] },
];

function buildProps(overrides: Partial<Parameters<typeof CompetitorMarketTrends>[0]> = {}) {
  return {
    isEditing: false,
    localCharts: CHARTS,
    setLocalCharts: vi.fn(),
    handleSaveMarketTrends: vi.fn(),
    ...overrides,
  };
}

function wrap(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("CompetitorMarketTrends", () => {
  it("(localCharts empty) renders nothing", () => {
    const { container } = wrap(<CompetitorMarketTrends {...buildProps({ localCharts: [] })} />);
    expect(container.firstChild).toBeNull();
  });

  it("(isEditing=false) renders a MiniLineChart per chart — chart titles visible", () => {
    wrap(<CompetitorMarketTrends {...buildProps()} />);
    // MiniLineChart renders title in an h4
    expect(screen.getByText("Revenue Growth")).toBeInTheDocument();
    expect(screen.getByText("Market Share")).toBeInTheDocument();
  });

  it("(isEditing=true) shows chart name inputs", () => {
    wrap(<CompetitorMarketTrends {...buildProps({ isEditing: true })} />);
    expect(screen.getByDisplayValue("Revenue Growth")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Market Share")).toBeInTheDocument();
  });

  it("generateTrendData shaping does not throw on empty xAxis array", () => {
    expect(() => generateTrendData([], 0)).not.toThrow();
    const result = generateTrendData([], 0);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("generateTrendData shaping produces one point per label", () => {
    const data = generateTrendData(["Q1", "Q2", "Q3"], 0);
    expect(data).toHaveLength(3);
    expect(data[0]).toHaveProperty("name", "Q1");
    expect(typeof data[0].value).toBe("number");
  });
});
