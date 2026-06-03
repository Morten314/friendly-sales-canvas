import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KeyMetrics } from "./KeyMetrics";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const baseProps = {
  editing: false,
  deleted: false,
  tamValue: "$4.2B",
  samValue: "$2.1B",
  growthRate: "25%",
  tamDraft: "$4.2B",
  samDraft: "$2.1B",
  growthRateDraft: "25%",
  onTamChange: vi.fn(),
  onSamChange: vi.fn(),
  onGrowthRateChange: vi.fn(),
  onCommit: vi.fn(),
  onDelete: vi.fn(),
};

describe("KeyMetrics", () => {
  it("renders nothing when editing and deleted", () => {
    const { container } = renderWithTooltip(
      <KeyMetrics {...baseProps} editing={true} deleted={true} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("read mode renders the TAM/SAM/growth figures", () => {
    renderWithTooltip(<KeyMetrics {...baseProps} editing={false} />);
    expect(screen.getByText("$4.2B")).toBeInTheDocument();
    expect(screen.getByText("$2.1B")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("read mode degrades gracefully when values are empty", () => {
    expect(() =>
      renderWithTooltip(
        <KeyMetrics {...baseProps} editing={false} tamValue="" samValue="" growthRate="" />,
      ),
    ).not.toThrow();
    // The static labels still render.
    expect(screen.getByText("Total Addressable Market")).toBeInTheDocument();
    expect(screen.getByText("Serviceable Addressable Market")).toBeInTheDocument();
    expect(screen.getByText("Growth Rate")).toBeInTheDocument();
  });

  it("edit mode binds inputs to the drafts", () => {
    renderWithTooltip(<KeyMetrics {...baseProps} editing={true} />);
    expect(screen.getByPlaceholderText("e.g., $4.2B")).toHaveValue("$4.2B");
    expect(screen.getByPlaceholderText("e.g., $2.1B")).toHaveValue("$2.1B");
    expect(screen.getByPlaceholderText("e.g., 25%")).toHaveValue("25%");
  });

  it("edit mode fires the per-field change callbacks", () => {
    const onTamChange = vi.fn();
    renderWithTooltip(<KeyMetrics {...baseProps} editing={true} onTamChange={onTamChange} />);
    fireEvent.change(screen.getByPlaceholderText("e.g., $4.2B"), {
      target: { value: "$5B" },
    });
    expect(onTamChange).toHaveBeenCalledWith("$5B");
  });
});
