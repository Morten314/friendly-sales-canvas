import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarketEntry } from "./MarketEntry";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const baseProps = {
  editing: false,
  deleted: false,
  value: "The read-mode market entry text.",
  draft: "The draft text.",
  onChange: vi.fn(),
  onCommit: vi.fn(),
  onDelete: vi.fn(),
};

describe("MarketEntry", () => {
  it("renders nothing when editing and deleted", () => {
    const { container } = renderWithTooltip(
      <MarketEntry {...baseProps} editing={true} deleted={true} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the read value when not editing", () => {
    renderWithTooltip(<MarketEntry {...baseProps} editing={false} />);
    expect(screen.getByText("The read-mode market entry text.")).toBeInTheDocument();
  });

  it("renders the textarea bound to draft when editing", () => {
    renderWithTooltip(<MarketEntry {...baseProps} editing={true} />);
    const textarea = screen.getByPlaceholderText("Enter market entry strategy...");
    expect(textarea).toHaveValue("The draft text.");
  });

  it("fires onChange when the textarea changes", () => {
    const onChange = vi.fn();
    renderWithTooltip(<MarketEntry {...baseProps} editing={true} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Enter market entry strategy..."), {
      target: { value: "updated" },
    });
    expect(onChange).toHaveBeenCalledWith("updated");
  });

  it("fires onCommit when the commit (check) button is clicked", () => {
    const onCommit = vi.fn();
    renderWithTooltip(<MarketEntry {...baseProps} editing={true} onCommit={onCommit} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("fires onDelete when the delete (x) button is clicked", () => {
    const onDelete = vi.fn();
    renderWithTooltip(<MarketEntry {...baseProps} editing={true} onDelete={onDelete} />);
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
