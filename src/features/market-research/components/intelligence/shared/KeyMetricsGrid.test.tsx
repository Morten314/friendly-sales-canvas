import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { KeyMetricConfig } from "./KeyMetricsGrid";
import { KeyMetricsGrid } from "./KeyMetricsGrid";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

// Mirrors the industry-trends consumer config: colored edit inputs + the
// pointer-events-auto/z-50 delete-button delta.
function industryTrendsMetrics(overrides?: {
  onAi?: (v: string) => void;
  onCloud?: (v: string) => void;
  onRegulatory?: (v: string) => void;
  aiDraft?: string;
  cloudDraft?: string;
  regulatoryDraft?: string;
}): KeyMetricConfig[] {
  return [
    {
      id: "aiAdoption",
      label: "AI Adoption Rate",
      value: "78%",
      draft: overrides?.aiDraft ?? "",
      onChange: overrides?.onAi ?? vi.fn(),
      placeholder: "e.g., 78%",
      displayCaption: "Enterprise pilots",
      cardClassName: "bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg",
      valueClassName: "text-2xl font-bold text-blue-600",
      editInputClassName: "text-2xl font-bold text-blue-600 border-blue-200 focus:border-blue-400",
    },
    {
      id: "cloudMigration",
      label: "Cloud Migration Increase",
      value: "+45%",
      draft: overrides?.cloudDraft ?? "",
      onChange: overrides?.onCloud ?? vi.fn(),
      placeholder: "e.g., +45%",
      displayCaption: "Year over year",
      cardClassName: "bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg",
      valueClassName: "text-2xl font-bold text-green-600",
      editInputClassName:
        "text-2xl font-bold text-green-600 border-green-200 focus:border-green-400",
    },
    {
      id: "regulatory",
      label: "Regulatory Changes",
      value: "12 new",
      draft: overrides?.regulatoryDraft ?? "",
      onChange: overrides?.onRegulatory ?? vi.fn(),
      placeholder: "e.g., 12 new",
      displayCaption: "Impacting sector",
      cardClassName: "bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg",
      valueClassName: "text-2xl font-bold text-purple-600",
      editInputClassName:
        "text-2xl font-bold text-purple-600 border-purple-200 focus:border-purple-400",
    },
  ];
}

// Mirrors the market-size consumer config: plain (unstyled) edit inputs and no
// extra delete-button classes.
function marketSizeMetrics(onTam?: (v: string) => void): KeyMetricConfig[] {
  return [
    {
      id: "tamValue",
      label: "Total Addressable Market",
      value: "$4.2B",
      draft: "$4.2B",
      onChange: onTam ?? vi.fn(),
      placeholder: "e.g., $4.2B",
      displayCaption: "Growing 15% YoY",
      cardClassName: "bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg",
      valueClassName: "text-2xl font-bold text-blue-600",
    },
    {
      id: "samValue",
      label: "Serviceable Addressable Market",
      value: "$2.1B",
      draft: "$2.1B",
      onChange: vi.fn(),
      placeholder: "e.g., $2.1B",
      displayCaption: "Mid-market focus",
      cardClassName: "bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg",
      valueClassName: "text-2xl font-bold text-green-600",
    },
    {
      id: "GrowthRate",
      label: "Growth Rate",
      value: "25%",
      draft: "25%",
      onChange: vi.fn(),
      placeholder: "e.g., 25%",
      displayCaption: "Fastest growing region",
      cardClassName: "bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg",
      valueClassName: "text-2xl font-bold text-purple-600",
    },
  ];
}

describe("KeyMetricsGrid", () => {
  it("renders nothing when editing and deleted", () => {
    const { container } = renderWithTooltip(
      <KeyMetricsGrid
        editing
        deleted
        metrics={marketSizeMetrics()}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("editing + deleted renders no inputs or grid", () => {
    const { container } = renderWithTooltip(
      <KeyMetricsGrid
        editing
        deleted
        metrics={industryTrendsMetrics()}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector(".grid")).toBeNull();
  });

  it("read mode renders all three metric values", () => {
    renderWithTooltip(
      <KeyMetricsGrid
        editing={false}
        deleted={false}
        metrics={industryTrendsMetrics()}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("78%")).toBeInTheDocument();
    expect(screen.getByText("+45%")).toBeInTheDocument();
    expect(screen.getByText("12 new")).toBeInTheDocument();
  });

  it("read mode renders the metric labels and captions", () => {
    renderWithTooltip(
      <KeyMetricsGrid
        editing={false}
        deleted={false}
        metrics={industryTrendsMetrics()}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("AI Adoption Rate")).toBeInTheDocument();
    expect(screen.getByText("Cloud Migration Increase")).toBeInTheDocument();
    expect(screen.getByText("Regulatory Changes")).toBeInTheDocument();
    expect(screen.getByText("Enterprise pilots")).toBeInTheDocument();
  });

  it("read mode renders even when deleted is true", () => {
    renderWithTooltip(
      <KeyMetricsGrid
        editing={false}
        deleted={true}
        metrics={industryTrendsMetrics()}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("78%")).toBeInTheDocument();
  });

  it("read mode degrades gracefully when values are empty (market-size config)", () => {
    const empty = marketSizeMetrics().map((m) => ({ ...m, value: "" }));
    expect(() =>
      renderWithTooltip(
        <KeyMetricsGrid
          editing={false}
          deleted={false}
          metrics={empty}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      ),
    ).not.toThrow();
    expect(screen.getByText("Total Addressable Market")).toBeInTheDocument();
    expect(screen.getByText("Serviceable Addressable Market")).toBeInTheDocument();
    expect(screen.getByText("Growth Rate")).toBeInTheDocument();
  });

  it("edit mode renders three inputs bound to the draft values", () => {
    renderWithTooltip(
      <KeyMetricsGrid
        editing
        deleted={false}
        metrics={industryTrendsMetrics({
          aiDraft: "80%",
          cloudDraft: "+50%",
          regulatoryDraft: "15 new",
        })}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(3);
    expect(inputs[0]).toHaveValue("80%");
    expect(inputs[1]).toHaveValue("+50%");
    expect(inputs[2]).toHaveValue("15 new");
  });

  it("edit mode binds inputs to drafts via placeholder (market-size config)", () => {
    renderWithTooltip(
      <KeyMetricsGrid
        editing
        deleted={false}
        metrics={marketSizeMetrics()}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("e.g., $4.2B")).toHaveValue("$4.2B");
    expect(screen.getByPlaceholderText("e.g., $2.1B")).toHaveValue("$2.1B");
    expect(screen.getByPlaceholderText("e.g., 25%")).toHaveValue("25%");
  });

  it("edit mode applies colored input classes for the industry-trends config", () => {
    renderWithTooltip(
      <KeyMetricsGrid
        editing
        deleted={false}
        metrics={industryTrendsMetrics()}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const aiInput = screen.getByPlaceholderText("e.g., 78%");
    expect(aiInput).toHaveClass("text-blue-600", "border-blue-200", "focus:border-blue-400");
  });

  it("edit mode leaves inputs unstyled for the market-size config", () => {
    renderWithTooltip(
      <KeyMetricsGrid
        editing
        deleted={false}
        metrics={marketSizeMetrics()}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const tamInput = screen.getByPlaceholderText("e.g., $4.2B");
    expect(tamInput).not.toHaveClass("text-blue-600");
    expect(tamInput).not.toHaveClass("border-blue-200");
  });

  it("edit mode fires the per-field change callback (market-size config)", () => {
    const onTam = vi.fn();
    renderWithTooltip(
      <KeyMetricsGrid
        editing
        deleted={false}
        metrics={marketSizeMetrics(onTam)}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g., $4.2B"), {
      target: { value: "$5B" },
    });
    expect(onTam).toHaveBeenCalledWith("$5B");
  });

  it("edit mode fires per-field change callbacks (industry-trends config)", () => {
    const onAi = vi.fn();
    const onCloud = vi.fn();
    const onRegulatory = vi.fn();
    renderWithTooltip(
      <KeyMetricsGrid
        editing
        deleted={false}
        metrics={industryTrendsMetrics({
          onAi,
          onCloud,
          onRegulatory,
          aiDraft: "80%",
          cloudDraft: "+50%",
          regulatoryDraft: "15 new",
        })}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("80%"), { target: { value: "85%" } });
    expect(onAi).toHaveBeenCalledWith("85%");
    fireEvent.change(screen.getByDisplayValue("+50%"), { target: { value: "+60%" } });
    expect(onCloud).toHaveBeenCalledWith("+60%");
    fireEvent.change(screen.getByDisplayValue("15 new"), { target: { value: "20 new" } });
    expect(onRegulatory).toHaveBeenCalledWith("20 new");
  });

  it("edit mode commit button fires onCommit", () => {
    const handleCommit = vi.fn();
    renderWithTooltip(
      <KeyMetricsGrid
        editing
        deleted={false}
        metrics={industryTrendsMetrics()}
        onCommit={handleCommit}
        onDelete={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(handleCommit).toHaveBeenCalledTimes(1);
  });

  it("edit mode delete button fires onDelete and carries the extra delta classes", () => {
    const handleDelete = vi.fn();
    renderWithTooltip(
      <KeyMetricsGrid
        editing
        deleted={false}
        metrics={industryTrendsMetrics()}
        onCommit={vi.fn()}
        onDelete={handleDelete}
        deleteButtonClassName="pointer-events-auto z-50"
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons[1]).toHaveClass("pointer-events-auto", "z-50");
    fireEvent.click(buttons[1]);
    expect(handleDelete).toHaveBeenCalledTimes(1);
  });

  it("edit mode delete button omits the extra classes when not provided", () => {
    renderWithTooltip(
      <KeyMetricsGrid
        editing
        deleted={false}
        metrics={marketSizeMetrics()}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons[1]).not.toHaveClass("pointer-events-auto");
    expect(buttons[1]).not.toHaveClass("z-50");
  });
});
