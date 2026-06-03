import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarketDrivers } from "./MarketDrivers";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const baseProps = {
  editing: false,
  deleted: false,
  drivers: ["Cloud adoption", "Regulatory pressure"],
  draft: ["Cloud adoption", "Regulatory pressure"],
  onChange: vi.fn(),
  onCommit: vi.fn(),
  onDelete: vi.fn(),
};

describe("MarketDrivers", () => {
  it("renders nothing when editing and deleted", () => {
    const { container } = renderWithTooltip(
      <MarketDrivers {...baseProps} editing={true} deleted={true} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("read mode renders the driver list", () => {
    renderWithTooltip(<MarketDrivers {...baseProps} editing={false} />);
    expect(screen.getByText("Cloud adoption")).toBeInTheDocument();
    expect(screen.getByText("Regulatory pressure")).toBeInTheDocument();
  });

  it("read mode shows the empty fallback when the list is empty", () => {
    renderWithTooltip(<MarketDrivers {...baseProps} editing={false} drivers={[]} />);
    expect(screen.getByText("No market drivers available")).toBeInTheDocument();
  });

  it("edit mode binds one textarea per draft item", () => {
    renderWithTooltip(<MarketDrivers {...baseProps} editing={true} />);
    expect(screen.getByPlaceholderText("Market driver 1...")).toHaveValue("Cloud adoption");
    expect(screen.getByPlaceholderText("Market driver 2...")).toHaveValue("Regulatory pressure");
  });

  it("edit mode editing an item fires onChange with the mutated draft", () => {
    const onChange = vi.fn();
    renderWithTooltip(<MarketDrivers {...baseProps} editing={true} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Market driver 1..."), {
      target: { value: "AI adoption" },
    });
    expect(onChange).toHaveBeenCalledWith(["AI adoption", "Regulatory pressure"]);
  });

  it("edit mode commit fires onCommit", () => {
    const onCommit = vi.fn();
    renderWithTooltip(<MarketDrivers {...baseProps} editing={true} onCommit={onCommit} />);
    fireEvent.click(screen.getByTitle("Commit changes"));
    expect(onCommit).toHaveBeenCalled();
  });
});
