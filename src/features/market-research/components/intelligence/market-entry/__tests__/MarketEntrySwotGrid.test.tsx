import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MarketEntrySwotGrid from "../MarketEntrySwotGrid";

describe("MarketEntrySwotGrid", () => {
  it("renders all four quadrant headings and their items when populated", () => {
    render(
      <MarketEntrySwotGrid
        swot={{
          strengths: ["Strong brand"],
          weaknesses: ["Thin margins"],
          opportunities: ["New region"],
          threats: ["New entrant"],
        }}
      />,
    );

    expect(screen.getByText("Strengths")).toBeInTheDocument();
    expect(screen.getByText("Weaknesses")).toBeInTheDocument();
    expect(screen.getByText("Opportunities")).toBeInTheDocument();
    expect(screen.getByText("Threats")).toBeInTheDocument();

    expect(screen.getByText("• Strong brand")).toBeInTheDocument();
    expect(screen.getByText("• Thin margins")).toBeInTheDocument();
    expect(screen.getByText("• New region")).toBeInTheDocument();
    expect(screen.getByText("• New entrant")).toBeInTheDocument();

    expect(screen.queryByText("No data available")).not.toBeInTheDocument();
  });

  it("shows 'No data available' for an empty quadrant", () => {
    render(
      <MarketEntrySwotGrid
        swot={{
          strengths: ["Strong brand"],
          weaknesses: [],
          opportunities: [],
          threats: [],
        }}
      />,
    );

    expect(screen.getByText("• Strong brand")).toBeInTheDocument();
    // Three empty quadrants (weaknesses, opportunities, threats).
    expect(screen.getAllByText("No data available")).toHaveLength(3);
  });

  it("shows 'No data available' for every quadrant when swot is undefined", () => {
    render(<MarketEntrySwotGrid swot={undefined} />);

    expect(screen.getByText("Strengths")).toBeInTheDocument();
    expect(screen.getByText("Weaknesses")).toBeInTheDocument();
    expect(screen.getByText("Opportunities")).toBeInTheDocument();
    expect(screen.getByText("Threats")).toBeInTheDocument();
    expect(screen.getAllByText("No data available")).toHaveLength(4);
  });
});
