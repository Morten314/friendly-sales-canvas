import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarketShareRegionsTable } from "../MarketShareRegionsTable";
import type { RegionShare } from "../types";

import { TooltipProvider } from "@/components/ui/tooltip";

const REGIONS: RegionShare[] = [
  { name: "North America", data: { "Acme Corp": "35%", "Beta Inc": "20%" } },
  { name: "Europe", data: { "Gamma Ltd": "45%" } },
];

function buildProps(overrides: Partial<Parameters<typeof MarketShareRegionsTable>[0]> = {}) {
  return {
    isEditing: false,
    localRegions: REGIONS,
    setLocalRegions: vi.fn(),
    handleSaveMarketShareCharts: vi.fn(),
    ...overrides,
  };
}

function wrap(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("MarketShareRegionsTable", () => {
  it("(localRegions empty) renders nothing", () => {
    const { container } = wrap(<MarketShareRegionsTable {...buildProps({ localRegions: [] })} />);
    expect(container.firstChild).toBeNull();
  });

  it("(isEditing=false) renders a row per region with company→share entries", () => {
    wrap(<MarketShareRegionsTable {...buildProps()} />);

    // Region headings
    expect(screen.getByText("North America")).toBeInTheDocument();
    expect(screen.getByText("Europe")).toBeInTheDocument();

    // Company / share entries for North America
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();

    // Company / share entry for Europe
    expect(screen.getByText("Gamma Ltd")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("(isEditing=true) shows input for region name", () => {
    wrap(<MarketShareRegionsTable {...buildProps({ isEditing: true })} />);
    // Region name inputs
    expect(screen.getByDisplayValue("North America")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Europe")).toBeInTheDocument();
  });

  it("(isEditing=true) shows input for company and share values", () => {
    wrap(<MarketShareRegionsTable {...buildProps({ isEditing: true })} />);
    expect(screen.getByDisplayValue("Acme Corp")).toBeInTheDocument();
    expect(screen.getByDisplayValue("35%")).toBeInTheDocument();
  });
});
