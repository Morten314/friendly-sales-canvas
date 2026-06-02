import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { RegulatoryHeader } from "../RegulatoryHeader";

import { TooltipProvider } from "@/components/ui/tooltip";

const baseHandlers = () => ({
  hasEdits: false,
  onToggleEdit: vi.fn(),
  onScoutIconClick: vi.fn(),
});

const renderHeader = (ui: ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe("RegulatoryHeader", () => {
  it("renders the section title", () => {
    renderHeader(<RegulatoryHeader {...baseHandlers()} />);
    expect(screen.getByText("Regulatory & Compliance Highlights")).toBeInTheDocument();
  });

  it("calls onToggleEdit when the Edit button is clicked", () => {
    const handlers = baseHandlers();
    renderHeader(<RegulatoryHeader {...handlers} />);

    // Two buttons: Edit (index 0) and Scout (index 1)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(handlers.onToggleEdit).toHaveBeenCalledTimes(1);
  });

  it("calls onScoutIconClick with 'regulatory-compliance' as first arg when Scout button is clicked", () => {
    const handlers = baseHandlers();
    renderHeader(<RegulatoryHeader {...handlers} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);

    expect(handlers.onScoutIconClick).toHaveBeenCalledWith(
      "regulatory-compliance",
      handlers.hasEdits,
    );
  });
});
