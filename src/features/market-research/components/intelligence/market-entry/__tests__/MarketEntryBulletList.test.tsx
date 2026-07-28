import { render, screen } from "@testing-library/react";
import { AlertTriangle } from "lucide-react";
import { describe, expect, it } from "vitest";

import MarketEntryBulletList from "../MarketEntryBulletList";

describe("MarketEntryBulletList", () => {
  it("renders the title and every item in the bullets variant", () => {
    render(
      <MarketEntryBulletList
        title="Entry Barriers"
        icon={<AlertTriangle className="h-4 w-4 text-orange-600" />}
        variant="bullets"
        accentClassName="text-orange-500 mt-1"
        items={["High capital cost", "Regulatory hurdles"]}
      />,
    );

    expect(screen.getByText("Entry Barriers")).toBeInTheDocument();
    expect(screen.getByText("High capital cost")).toBeInTheDocument();
    expect(screen.getByText("Regulatory hurdles")).toBeInTheDocument();
  });

  it("renders the title and every item in the cards variant", () => {
    render(
      <MarketEntryBulletList
        title="Risk Assessment"
        icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
        variant="cards"
        cardClassName="bg-red-50 p-3 rounded-lg border border-red-200"
        cardTextClassName="text-sm text-red-900"
        items={["Currency volatility"]}
      />,
    );

    expect(screen.getByText("Risk Assessment")).toBeInTheDocument();
    expect(screen.getByText("Currency volatility")).toBeInTheDocument();
  });

  it("renders only the title when items are empty or missing", () => {
    render(
      <MarketEntryBulletList
        title="Entry Barriers"
        icon={<AlertTriangle className="h-4 w-4 text-orange-600" />}
        variant="bullets"
        accentClassName="text-orange-500 mt-1"
        items={[]}
      />,
    );

    expect(screen.getByText("Entry Barriers")).toBeInTheDocument();
    // Empty items render nothing beyond the title (matches the live block,
    // which simply maps over an array and renders no placeholder).
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
