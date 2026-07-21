import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompetitorSwotAnalysis } from "../CompetitorSwotAnalysis";
import type { SwotEntity } from "../types";

import { TooltipProvider } from "@/components/ui/tooltip";

function buildProps(overrides: Partial<Parameters<typeof CompetitorSwotAnalysis>[0]> = {}) {
  return {
    isEditing: false,
    localEntities: [] as SwotEntity[],
    setLocalEntities: vi.fn(),
    handleSaveSwotAnalysis: vi.fn(),
    ...overrides,
  };
}

function wrap(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("CompetitorSwotAnalysis", () => {
  it("empty localEntities → renders nothing (null)", () => {
    const { container } = wrap(<CompetitorSwotAnalysis {...buildProps({ localEntities: [] })} />);
    expect(container.firstChild).toBeNull();
  });

  it("non-empty entities → renders SWOT Analysis heading", () => {
    const entities: SwotEntity[] = [
      {
        name: "Competitor A",
        strengths: ["Fast", "Cheap"],
        weaknesses: ["Slow support"],
        opportunities: ["Growing market"],
        threats: ["New entrant"],
      },
    ];
    wrap(<CompetitorSwotAnalysis {...buildProps({ localEntities: entities })} />);
    expect(screen.getByText("SWOT Analysis")).toBeInTheDocument();
  });

  it("renders entity name and quadrant data", () => {
    const entities: SwotEntity[] = [
      {
        name: "Acme Corp",
        strengths: ["Brand recognition"],
        weaknesses: ["High cost"],
        opportunities: ["APAC expansion"],
        threats: ["Regulation risk"],
      },
    ];
    wrap(<CompetitorSwotAnalysis {...buildProps({ localEntities: entities })} />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Brand recognition")).toBeInTheDocument();
    expect(screen.getByText("High cost")).toBeInTheDocument();
    expect(screen.getByText("APAC expansion")).toBeInTheDocument();
    expect(screen.getByText("Regulation risk")).toBeInTheDocument();
  });

  it("multiple entities → each entity name is rendered", () => {
    const entities: SwotEntity[] = [
      { name: "Alpha", strengths: ["S1"], weaknesses: ["W1"], opportunities: [], threats: [] },
      { name: "Beta", strengths: [], weaknesses: [], opportunities: ["O1"], threats: ["T1"] },
    ];
    wrap(<CompetitorSwotAnalysis {...buildProps({ localEntities: entities })} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("isEditing=false → no inputs visible", () => {
    const entities: SwotEntity[] = [
      { name: "X", strengths: ["S"], weaknesses: ["W"], opportunities: [], threats: [] },
    ];
    wrap(<CompetitorSwotAnalysis {...buildProps({ localEntities: entities, isEditing: false })} />);
    expect(screen.queryByPlaceholderText("Entity name")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Strength")).not.toBeInTheDocument();
  });

  it("isEditing=true → commit button and inputs are visible", () => {
    const entities: SwotEntity[] = [
      { name: "X", strengths: ["S1"], weaknesses: ["W1"], opportunities: [], threats: [] },
    ];
    wrap(<CompetitorSwotAnalysis {...buildProps({ localEntities: entities, isEditing: true })} />);
    // Commit button title present
    expect(screen.getByTitle("Commit changes")).toBeInTheDocument();
    // Inputs for entity name and strengths
    expect(screen.getByPlaceholderText("Entity name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Strength")).toBeInTheDocument();
  });

  it("isEditing=true → 'Add Entity' button visible", () => {
    const entities: SwotEntity[] = [
      { name: "X", strengths: [], weaknesses: [], opportunities: [], threats: [] },
    ];
    wrap(<CompetitorSwotAnalysis {...buildProps({ localEntities: entities, isEditing: true })} />);
    expect(screen.getByRole("button", { name: /Add Entity/i })).toBeInTheDocument();
  });

  it("empty strengths → 'No data available' fallback shown", () => {
    const entities: SwotEntity[] = [
      { name: "Y", strengths: [], weaknesses: [], opportunities: [], threats: [] },
    ];
    wrap(<CompetitorSwotAnalysis {...buildProps({ localEntities: entities, isEditing: false })} />);
    // Each empty quadrant shows the fallback (multiple instances expected)
    const fallbacks = screen.getAllByText(/No data available/i);
    expect(fallbacks.length).toBeGreaterThan(0);
  });
});
