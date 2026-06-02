import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditToolbar } from "./EditToolbar";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const defaultProps = {
  onSave: vi.fn(),
  onCancel: vi.fn(),
  onHistory: vi.fn(),
  historyCount: 1,
  onScout: vi.fn(),
};

describe("EditToolbar", () => {
  it("renders the Save Changes button", () => {
    renderWithTooltip(<EditToolbar {...defaultProps} />);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  it("renders the Cancel button", () => {
    renderWithTooltip(<EditToolbar {...defaultProps} />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("renders the Edit History button", () => {
    renderWithTooltip(<EditToolbar {...defaultProps} />);
    expect(screen.getByRole("button", { name: /edit history/i })).toBeInTheDocument();
  });

  it("fires onSave when Save Changes is clicked", () => {
    const onSave = vi.fn();
    renderWithTooltip(<EditToolbar {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("fires onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    renderWithTooltip(<EditToolbar {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("fires onHistory when Edit History is clicked and historyCount > 0", () => {
    const onHistory = vi.fn();
    renderWithTooltip(<EditToolbar {...defaultProps} historyCount={3} onHistory={onHistory} />);
    fireEvent.click(screen.getByRole("button", { name: /edit history/i }));
    expect(onHistory).toHaveBeenCalledOnce();
  });

  it("Edit History button is disabled when historyCount === 0", () => {
    renderWithTooltip(<EditToolbar {...defaultProps} historyCount={0} />);
    expect(screen.getByRole("button", { name: /edit history/i })).toBeDisabled();
  });

  it("fires onScout when the Scout button is clicked", () => {
    const onScout = vi.fn();
    renderWithTooltip(<EditToolbar {...defaultProps} onScout={onScout} />);
    // Scout button contains the Bot icon — it's the 4th button (Save, Cancel, History, Scout)
    const buttons = screen.getAllByRole("button");
    const scoutBtn = buttons[buttons.length - 1];
    fireEvent.click(scoutBtn);
    expect(onScout).toHaveBeenCalledOnce();
  });
});
