import { fireEvent, render, screen } from "@testing-library/react";
import { BarChart3, Zap } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { IntelligenceSectionHeader } from "./IntelligenceSectionHeader";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

// Mirrors the industry-trends consumer config.
const industryTrendsConfig = {
  icon: Zap,
  title: "Industry Trends",
  scoutContext: "industry-trends" as const,
  iconClassName: "h-5 w-5 text-purple-600",
  editButtonClassName: "text-purple-800 hover:text-purple-900",
  scoutButtonClassName:
    "text-purple-600 hover:text-purple-700 transition-all duration-200 relative",
  scoutGradientClassName:
    "absolute inset-0 rounded-md bg-gradient-to-r from-purple-400/20 to-blue-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300",
};

// Mirrors the market-size consumer config.
const marketSizeConfig = {
  icon: BarChart3,
  title: "Market Size & Opportunity",
  scoutContext: "market-size" as const,
  iconClassName: "h-5 w-5 text-blue-600",
  editButtonClassName: "text-blue-800 hover:text-blue-900",
  scoutButtonClassName: "text-blue-600 hover:text-blue-700 transition-all duration-200 relative",
  scoutGradientClassName:
    "absolute inset-0 rounded-md bg-gradient-to-r from-blue-400/20 to-green-400/20 animate-pulse opacity-0 hover:opacity-100 transition-opacity duration-300",
};

describe("IntelligenceSectionHeader", () => {
  const baseProps = {
    onModify: vi.fn(),
    isSplitView: false,
    onScoutIconClick: vi.fn(),
  };

  it("renders the industry-trends title", () => {
    renderWithTooltip(<IntelligenceSectionHeader {...baseProps} {...industryTrendsConfig} />);
    expect(screen.getByText("Industry Trends")).toBeInTheDocument();
  });

  it("renders the market-size title", () => {
    renderWithTooltip(<IntelligenceSectionHeader {...baseProps} {...marketSizeConfig} />);
    expect(screen.getByText("Market Size & Opportunity")).toBeInTheDocument();
  });

  it("fires onModify when the Edit button is clicked", () => {
    const onModify = vi.fn();
    renderWithTooltip(
      <IntelligenceSectionHeader {...baseProps} {...industryTrendsConfig} onModify={onModify} />,
    );
    const [editBtn] = screen.getAllByRole("button");
    fireEvent.click(editBtn);
    expect(onModify).toHaveBeenCalledOnce();
  });

  it("shows the Scout button (Edit + Scout) when isSplitView is false", () => {
    renderWithTooltip(
      <IntelligenceSectionHeader {...baseProps} {...industryTrendsConfig} isSplitView={false} />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("hides the Scout button when isSplitView is true", () => {
    renderWithTooltip(
      <IntelligenceSectionHeader {...baseProps} {...industryTrendsConfig} isSplitView={true} />,
    );
    expect(screen.queryByText("Chat with Scout")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("fires onScoutIconClick with 'industry-trends' for the industry-trends config", () => {
    const onScoutIconClick = vi.fn();
    renderWithTooltip(
      <IntelligenceSectionHeader
        {...baseProps}
        {...industryTrendsConfig}
        isSplitView={false}
        onScoutIconClick={onScoutIconClick}
      />,
    );
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onScoutIconClick).toHaveBeenCalledWith("industry-trends");
  });

  it("fires onScoutIconClick with 'market-size' for the market-size config", () => {
    const onScoutIconClick = vi.fn();
    renderWithTooltip(
      <IntelligenceSectionHeader
        {...baseProps}
        {...marketSizeConfig}
        isSplitView={false}
        onScoutIconClick={onScoutIconClick}
      />,
    );
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onScoutIconClick).toHaveBeenCalledWith("market-size");
  });

  it("applies the accent gradient and edit-button classes per config", () => {
    const { container } = renderWithTooltip(
      <IntelligenceSectionHeader {...baseProps} {...industryTrendsConfig} />,
    );
    const editBtn = screen.getAllByRole("button")[0];
    expect(editBtn).toHaveClass("text-purple-800", "hover:text-purple-900");
    const gradient = container.querySelector(".bg-gradient-to-r");
    expect(gradient).toHaveClass("from-purple-400/20", "to-blue-400/20", "animate-pulse");
  });

  it("applies the blue accent gradient for the market-size config", () => {
    const { container } = renderWithTooltip(
      <IntelligenceSectionHeader {...baseProps} {...marketSizeConfig} />,
    );
    const editBtn = screen.getAllByRole("button")[0];
    expect(editBtn).toHaveClass("text-blue-800", "hover:text-blue-900");
    const gradient = container.querySelector(".bg-gradient-to-r");
    expect(gradient).toHaveClass("from-blue-400/20", "to-green-400/20", "animate-pulse");
  });
});
