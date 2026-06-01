import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import MarketEntryHeader from "../MarketEntryHeader";

import { TooltipProvider } from "@/components/ui/tooltip";

const baseHandlers = () => ({
  onToggleEdit: vi.fn(),
  onEditHistoryOpen: vi.fn(),
  onScoutIconClick: vi.fn(),
});

const renderHeader = (ui: ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe("MarketEntryHeader", () => {
  it("always renders the section title", () => {
    renderHeader(<MarketEntryHeader isSplitView={false} {...baseHandlers()} />);

    expect(screen.getByText("Market Entry & Growth Strategy")).toBeInTheDocument();
  });

  it("renders no action buttons when showActions is omitted (loading view)", () => {
    renderHeader(<MarketEntryHeader isSplitView={false} {...baseHandlers()} />);

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders only the Scout button for the empty view (showActions, no edit/history)", () => {
    renderHeader(<MarketEntryHeader showActions isSplitView={false} {...baseHandlers()} />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("hides the Scout button when in split view", () => {
    renderHeader(<MarketEntryHeader showActions isSplitView={true} {...baseHandlers()} />);

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders Edit + Scout in the populated view without edit history", () => {
    renderHeader(
      <MarketEntryHeader showActions showEditButton isSplitView={false} {...baseHandlers()} />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("renders Edit + Clock + Scout when showEditHistory is true", () => {
    renderHeader(
      <MarketEntryHeader
        showActions
        showEditButton
        showEditHistory
        isSplitView={false}
        {...baseHandlers()}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("fires onToggleEdit when the Edit button is clicked", () => {
    const handlers = baseHandlers();
    renderHeader(<MarketEntryHeader showActions showEditButton isSplitView={true} {...handlers} />);

    fireEvent.click(screen.getByRole("button"));

    expect(handlers.onToggleEdit).toHaveBeenCalledTimes(1);
  });

  it("fires onScoutIconClick with the market-entry context when the Scout button is clicked", () => {
    const handlers = baseHandlers();
    renderHeader(<MarketEntryHeader showActions isSplitView={false} {...handlers} />);

    fireEvent.click(screen.getByRole("button"));

    expect(handlers.onScoutIconClick).toHaveBeenCalledWith("market-entry");
  });
});
