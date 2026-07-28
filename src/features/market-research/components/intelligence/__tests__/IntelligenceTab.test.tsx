import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import IntelligenceTab, { type IntelligenceTabProps } from "../IntelligenceTab";

/**
 * Smoke test for the structurally-extracted IntelligenceTab container. The component
 * is a pure presentational container fed entirely by props; this drives the
 * marketData-null branch (the "Load Data" CTA), which renders without any of the
 * heavy section data and exercises that the prop wiring mounts cleanly.
 */

// Minimal prop bag: the marketData-null branch only reads `marketData` and
// `fetchMarketData`. Everything else is supplied as a no-op/empty stub so the
// typed prop surface is satisfied without standing up the full data layer.
const noop = () => {};

function buildProps(overrides: Partial<IntelligenceTabProps> = {}): IntelligenceTabProps {
  const base = {
    scoutDeploymentData: null,
    onViewOpportunityLeads: noop,
    marketData: null,
    fetchMarketData: vi.fn(),
  } as unknown as IntelligenceTabProps;
  return { ...base, ...overrides };
}

function renderTab(props: IntelligenceTabProps) {
  return render(
    <MemoryRouter>
      <IntelligenceTab {...props} />
    </MemoryRouter>,
  );
}

describe("IntelligenceTab", () => {
  it("renders the Load Data CTA when marketData is null", () => {
    renderTab(buildProps());

    expect(screen.getByText("No market data available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load data/i })).toBeInTheDocument();
  });

  it("invokes fetchMarketData when the Load Data button is clicked", () => {
    const fetchMarketData = vi.fn();
    renderTab(buildProps({ fetchMarketData }));

    screen.getByRole("button", { name: /load data/i }).click();

    expect(fetchMarketData).toHaveBeenCalledTimes(1);
  });
});
