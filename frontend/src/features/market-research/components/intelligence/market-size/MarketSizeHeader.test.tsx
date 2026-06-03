import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarketSizeHeader } from "./MarketSizeHeader";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("MarketSizeHeader", () => {
  const defaultProps = {
    onModify: vi.fn(),
    isSplitView: false,
    onScoutIconClick: vi.fn(),
  };

  it("renders the section title", () => {
    renderWithTooltip(<MarketSizeHeader {...defaultProps} />);
    expect(screen.getByText("Market Size & Opportunity")).toBeInTheDocument();
  });

  it("fires onModify when the edit button is clicked", () => {
    const onModify = vi.fn();
    renderWithTooltip(<MarketSizeHeader {...defaultProps} onModify={onModify} />);
    // first button is the Edit/Modify control
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onModify).toHaveBeenCalledOnce();
  });

  it("renders the Scout button when not in split view and fires onScoutIconClick", () => {
    const onScoutIconClick = vi.fn();
    renderWithTooltip(
      <MarketSizeHeader
        {...defaultProps}
        isSplitView={false}
        onScoutIconClick={onScoutIconClick}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(onScoutIconClick).toHaveBeenCalledWith("market-size");
  });

  it("hides the Scout button in split view", () => {
    renderWithTooltip(<MarketSizeHeader {...defaultProps} isSplitView={true} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
