import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StrategicRecommendations } from "./StrategicRecommendations";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const baseProps = {
  editing: false,
  deleted: false,
  recommendations: ["Focus on enterprise", "Expand APAC"],
  draft: ["Focus on enterprise", "Expand APAC"],
  onChange: vi.fn(),
  onCommit: vi.fn(),
  onDelete: vi.fn(),
};

describe("StrategicRecommendations", () => {
  it("renders nothing when editing and deleted", () => {
    const { container } = renderWithTooltip(
      <StrategicRecommendations {...baseProps} editing={true} deleted={true} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("read mode renders the recommendation list", () => {
    renderWithTooltip(<StrategicRecommendations {...baseProps} editing={false} />);
    expect(screen.getByText("Focus on enterprise")).toBeInTheDocument();
    expect(screen.getByText("Expand APAC")).toBeInTheDocument();
  });

  it("read mode shows the empty fallback when the list is empty", () => {
    renderWithTooltip(
      <StrategicRecommendations {...baseProps} editing={false} recommendations={[]} />,
    );
    expect(screen.getByText("No strategic recommendations available")).toBeInTheDocument();
  });

  it("edit mode binds one textarea per draft item", () => {
    renderWithTooltip(<StrategicRecommendations {...baseProps} editing={true} />);
    expect(screen.getByPlaceholderText("Strategic recommendation 1...")).toHaveValue(
      "Focus on enterprise",
    );
    expect(screen.getByPlaceholderText("Strategic recommendation 2...")).toHaveValue("Expand APAC");
  });

  it("edit mode editing an item fires onChange with the mutated draft", () => {
    const onChange = vi.fn();
    renderWithTooltip(
      <StrategicRecommendations {...baseProps} editing={true} onChange={onChange} />,
    );
    fireEvent.change(screen.getByPlaceholderText("Strategic recommendation 1..."), {
      target: { value: "Focus on mid-market" },
    });
    expect(onChange).toHaveBeenCalledWith(["Focus on mid-market", "Expand APAC"]);
  });

  it("edit mode commit fires onCommit", () => {
    const onCommit = vi.fn();
    renderWithTooltip(
      <StrategicRecommendations {...baseProps} editing={true} onCommit={onCommit} />,
    );
    fireEvent.click(screen.getByTitle("Commit changes"));
    expect(onCommit).toHaveBeenCalled();
  });
});
