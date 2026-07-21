import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ComplianceAnalyticsSection } from "../ComplianceAnalyticsSection";
import type { UntypedVisualDataCard } from "../types";

const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const BAR_CARDS: UntypedVisualDataCard[] = [
  { type: "bar-chart", title: "Card A", data: [{ name: "x", value: 50 }] },
  { type: "bar-chart", title: "Card B", data: [{ name: "y", value: 70 }] },
];

const EMPTY_CARDS: UntypedVisualDataCard[] = [];

function buildProps(overrides: Partial<Parameters<typeof ComplianceAnalyticsSection>[0]> = {}) {
  return {
    isEditing: false,
    normalizedDeletedSections: new Set<string>(),
    visualDataCards: BAR_CARDS,
    localVisualDataCards: BAR_CARDS,
    setLocalVisualDataCards: vi.fn(),
    onDeleteSection: vi.fn(),
    onScoutIconClick: vi.fn(),
    ...overrides,
  };
}

describe("ComplianceAnalyticsSection", () => {
  it("(isEditing=false) renders both card titles", () => {
    render(<ComplianceAnalyticsSection {...buildProps({ isEditing: false })} />);
    expect(screen.getByText("Card A")).toBeInTheDocument();
    expect(screen.getByText("Card B")).toBeInTheDocument();
  });

  it("(isEditing=true, not deleted) grid renders with card title inputs", () => {
    render(<ComplianceAnalyticsSection {...buildProps({ isEditing: true })} />);
    // In editing mode, ComplianceVisualCard renders card.title inside an <Input>,
    // so we find it by its form value rather than visible text.
    expect(screen.getByDisplayValue("Card A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Card B")).toBeInTheDocument();
  });

  it("(isEditing=true, not deleted) delete button fires onDeleteSection and onScoutIconClick", () => {
    const onDeleteSection = vi.fn();
    const onScoutIconClick = vi.fn();
    render(
      <ComplianceAnalyticsSection
        {...buildProps({ isEditing: true, onDeleteSection, onScoutIconClick })}
      />,
    );

    // The X button has no accessible label — find by its svg icon container
    // The delete button is opacity-0 group-hover:opacity-100; it's still in the DOM
    const buttons = screen.getAllByRole("button");
    // Second button is the X (delete) button
    const deleteBtn = buttons[1];
    fireEvent.click(deleteBtn);

    expect(onDeleteSection).toHaveBeenCalledWith("compliance-analytics");
    expect(onScoutIconClick).toHaveBeenCalledWith(
      "regulatory-compliance",
      true,
      expect.stringContaining("Compliance Analytics"),
    );
  });

  it("(isEditing=true, compliance-analytics deleted) renders nothing", () => {
    const { container } = render(
      <ComplianceAnalyticsSection
        {...buildProps({
          isEditing: true,
          normalizedDeletedSections: new Set(["compliance-analytics"]),
        })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("(isEditing=true, empty cards) shows fallback message", () => {
    render(
      <ComplianceAnalyticsSection
        {...buildProps({
          isEditing: true,
          visualDataCards: EMPTY_CARDS,
          localVisualDataCards: EMPTY_CARDS,
        })}
      />,
    );
    expect(screen.getByText("No compliance analytics data available")).toBeInTheDocument();
  });
});
