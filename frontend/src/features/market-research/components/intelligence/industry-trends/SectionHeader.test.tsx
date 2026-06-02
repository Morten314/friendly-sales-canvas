import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SectionHeader } from "./SectionHeader";

import { TooltipProvider } from "@/components/ui/tooltip";


function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("SectionHeader", () => {
  const defaultProps = {
    onModify: vi.fn(),
    isSplitView: false,
    onScoutIconClick: vi.fn(),
  };

  it("renders the section title", () => {
    renderWithTooltip(<SectionHeader {...defaultProps} />);
    expect(screen.getByText("Industry Trends")).toBeInTheDocument();
  });

  it("renders the Edit button", () => {
    renderWithTooltip(<SectionHeader {...defaultProps} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("fires onModify when the Edit button is clicked", () => {
    const onModify = vi.fn();
    renderWithTooltip(<SectionHeader {...defaultProps} onModify={onModify} />);
    // Edit button is the first button rendered
    const [editBtn] = screen.getAllByRole("button");
    fireEvent.click(editBtn);
    expect(onModify).toHaveBeenCalledOnce();
  });

  it("shows the Scout button when isSplitView is false", () => {
    renderWithTooltip(<SectionHeader {...defaultProps} isSplitView={false} />);
    // When not in split view, there are two buttons: Edit + Scout
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2);
  });

  it("hides the Scout button when isSplitView is true", () => {
    renderWithTooltip(<SectionHeader {...defaultProps} isSplitView={true} />);
    expect(screen.queryByText("Chat with Scout")).not.toBeInTheDocument();
  });

  it("fires onScoutIconClick with 'industry-trends' when Scout button is clicked", () => {
    const onScoutIconClick = vi.fn();
    renderWithTooltip(
      <SectionHeader {...defaultProps} isSplitView={false} onScoutIconClick={onScoutIconClick} />,
    );
    // Scout button is the second button (after Edit)
    const buttons = screen.getAllByRole("button");
    const scoutBtn = buttons[1];
    fireEvent.click(scoutBtn);
    expect(onScoutIconClick).toHaveBeenCalledWith("industry-trends");
  });
});
