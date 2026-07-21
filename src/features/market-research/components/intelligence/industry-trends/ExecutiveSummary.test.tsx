import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { ExecutiveSummary } from "./ExecutiveSummary";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("ExecutiveSummary", () => {
  it("read mode renders the summary text", () => {
    renderWithProvider(
      <ExecutiveSummary
        editing={false}
        deleted={false}
        summary="Industry is growing rapidly."
        draft=""
        onChange={vi.fn()}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Industry is growing rapidly.")).toBeInTheDocument();
  });

  it("read mode renders even when deleted is true", () => {
    renderWithProvider(
      <ExecutiveSummary
        editing={false}
        deleted={true}
        summary="Visible in read mode."
        draft=""
        onChange={vi.fn()}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Visible in read mode.")).toBeInTheDocument();
  });

  it("edit mode renders a textarea with the draft value", () => {
    renderWithProvider(
      <ExecutiveSummary
        editing={true}
        deleted={false}
        summary=""
        draft="Draft content here."
        onChange={vi.fn()}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("Draft content here.");
  });

  it("edit mode fires onChange when textarea changes", () => {
    const handleChange = vi.fn();
    renderWithProvider(
      <ExecutiveSummary
        editing={true}
        deleted={false}
        summary=""
        draft="initial"
        onChange={handleChange}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "updated" } });
    expect(handleChange).toHaveBeenCalledWith("updated");
  });

  it("editing + deleted renders nothing", () => {
    const { container } = renderWithProvider(
      <ExecutiveSummary
        editing={true}
        deleted={true}
        summary="should not appear"
        draft="should not appear"
        onChange={vi.fn()}
        onCommit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    // TooltipProvider renders a div wrapper; the ExecutiveSummary itself should produce no output
    expect(container.querySelector("p")).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
  });
});
