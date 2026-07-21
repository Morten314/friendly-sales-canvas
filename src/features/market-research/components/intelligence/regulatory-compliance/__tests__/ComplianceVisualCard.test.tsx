import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type * as Recharts from "recharts";
import { describe, expect, it, vi } from "vitest";

import { ComplianceVisualCard } from "../ComplianceVisualCard";
import type { UntypedVisualDataCard } from "../types";

// recharts' ResponsiveContainer renders to a zero-size box in jsdom, which
// suppresses the chart SVG. Mock it to a plain div so MiniPieChart/MiniLineChart
// mount deterministically without relying on layout measurement.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof Recharts>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

describe("ComplianceVisualCard", () => {
  it("renders a compact bar-chart card title", () => {
    const card: UntypedVisualDataCard = {
      type: "bar-chart",
      title: "Compliance Adoption Rates",
      data: [{ name: "GDPR", value: 80 }],
    };

    render(
      <ComplianceVisualCard
        card={card}
        cardIndex={0}
        isEditing={false}
        isExpanded={false}
        localVisualDataCards={[card]}
        onVisualDataCardsChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Compliance Adoption Rates")).toBeInTheDocument();
  });

  it("renders an expanded pie-chart card without throwing", () => {
    const card: UntypedVisualDataCard = {
      type: "pie-chart",
      title: "Adoption",
      data: [{ label: "GDPR", value: 80 }],
    };

    render(
      <ComplianceVisualCard
        card={card}
        cardIndex={0}
        isEditing={false}
        isExpanded={true}
        localVisualDataCards={[card]}
        onVisualDataCardsChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Adoption")).toBeInTheDocument();
  });

  it("renders a backend card keyed on chartType (not card.type)", () => {
    const card: UntypedVisualDataCard = {
      chartType: "bar-chart",
      title: "Backend Adoption Rates",
      data: [{ name: "GDPR", value: 80 }],
    };
    render(
      <ComplianceVisualCard
        card={card}
        cardIndex={0}
        isEditing={false}
        isExpanded={false}
        localVisualDataCards={[card]}
        onVisualDataCardsChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Backend Adoption Rates")).toBeInTheDocument();
  });

  it("renders an expanded backend card keyed on chartType (not card.type)", () => {
    const card: UntypedVisualDataCard = {
      chartType: "pie-chart",
      title: "Backend Expanded Adoption",
      data: [{ label: "GDPR", value: 80 }],
    };
    render(
      <ComplianceVisualCard
        card={card}
        cardIndex={0}
        isEditing={false}
        isExpanded={true}
        localVisualDataCards={[card]}
        onVisualDataCardsChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Backend Expanded Adoption")).toBeInTheDocument();
  });
});
