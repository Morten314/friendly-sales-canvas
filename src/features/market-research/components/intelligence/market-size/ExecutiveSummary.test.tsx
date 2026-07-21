import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExecutiveSummary } from "./ExecutiveSummary";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const baseProps = {
  editing: false,
  deleted: false,
  summary: "The read-mode summary text.",
  draft: "The draft text.",
  onChange: vi.fn(),
  onCommit: vi.fn(),
  onDelete: vi.fn(),
};

describe("ExecutiveSummary", () => {
  it("renders nothing when editing and deleted", () => {
    const { container } = renderWithTooltip(
      <ExecutiveSummary {...baseProps} editing={true} deleted={true} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the read text when not editing", () => {
    renderWithTooltip(<ExecutiveSummary {...baseProps} editing={false} />);
    expect(screen.getByText("The read-mode summary text.")).toBeInTheDocument();
  });

  it("renders the textarea bound to draft when editing", () => {
    renderWithTooltip(<ExecutiveSummary {...baseProps} editing={true} />);
    const textarea = screen.getByPlaceholderText("Enter executive summary...");
    expect(textarea).toHaveValue("The draft text.");
  });

  it("fires onChange when the textarea changes", () => {
    const onChange = vi.fn();
    renderWithTooltip(<ExecutiveSummary {...baseProps} editing={true} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Enter executive summary..."), {
      target: { value: "updated" },
    });
    expect(onChange).toHaveBeenCalledWith("updated");
  });

  it("fires onCommit when the commit (check) button is clicked", () => {
    const onCommit = vi.fn();
    renderWithTooltip(<ExecutiveSummary {...baseProps} editing={true} onCommit={onCommit} />);
    // first button is the commit (Check) control
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("fires onDelete when the delete (x) button is clicked", () => {
    const onDelete = vi.fn();
    renderWithTooltip(<ExecutiveSummary {...baseProps} editing={true} onDelete={onDelete} />);
    // second button is the delete (X) control
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
