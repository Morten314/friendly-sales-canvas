import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MarketEntryKpiCards from "../MarketEntryKpiCards";

describe("MarketEntryKpiCards", () => {
  it("renders a string recommendedChannel verbatim", () => {
    render(
      <MarketEntryKpiCards
        recommendedChannel="Direct-to-consumer"
        timeToMarket="6 months"
        topBarrier="Distribution"
      />,
    );

    expect(screen.getByText("Direct-to-consumer")).toBeInTheDocument();
  });

  it("renders the .channel value when recommendedChannel is an object with a channel key", () => {
    render(
      <MarketEntryKpiCards
        recommendedChannel={{ channel: "Online marketplaces", confidence: "high" }}
        timeToMarket="6 months"
        topBarrier="Distribution"
      />,
    );

    expect(screen.getByText("Online marketplaces")).toBeInTheDocument();
  });

  it("renders the JSON.stringify of the object when it has no channel key", () => {
    const obj = { foo: "bar", n: 1 };

    render(
      <MarketEntryKpiCards
        recommendedChannel={obj}
        timeToMarket="6 months"
        topBarrier="Distribution"
      />,
    );

    expect(screen.getByText(JSON.stringify(obj))).toBeInTheDocument();
  });

  it("renders timeToMarket and topBarrier values", () => {
    render(
      <MarketEntryKpiCards
        recommendedChannel="Retail"
        timeToMarket="9 months"
        topBarrier="Regulatory approval"
      />,
    );

    expect(screen.getByText("9 months")).toBeInTheDocument();
    expect(screen.getByText("Regulatory approval")).toBeInTheDocument();
  });

  it("renders 'N/A' when recommendedChannel is missing", () => {
    render(<MarketEntryKpiCards timeToMarket="6 months" topBarrier="Distribution" />);

    expect(screen.getByText("N/A")).toBeInTheDocument();
  });
});
