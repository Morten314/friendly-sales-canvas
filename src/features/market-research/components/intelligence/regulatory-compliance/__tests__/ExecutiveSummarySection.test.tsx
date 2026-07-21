import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExecutiveSummarySection } from "../ExecutiveSummarySection";

describe("ExecutiveSummarySection", () => {
  it("renders the executive summary as static text in read-only mode", () => {
    render(
      <ExecutiveSummarySection
        isEditing={false}
        normalizedDeletedSections={new Set()}
        localExecutiveSummary=""
        setLocalExecutiveSummary={vi.fn()}
        onExecutiveSummaryChange={vi.fn()}
        onDeleteSection={vi.fn()}
        onScoutIconClick={vi.fn()}
        currentExecutiveSummary="My summary text"
      />,
    );

    expect(screen.getByText("My summary text")).toBeInTheDocument();
    // It's a <p>, not an editable textbox.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders a textarea with the local value in editing mode", () => {
    render(
      <ExecutiveSummarySection
        isEditing={true}
        normalizedDeletedSections={new Set()}
        localExecutiveSummary="Draft"
        setLocalExecutiveSummary={vi.fn()}
        onExecutiveSummaryChange={vi.fn()}
        onDeleteSection={vi.fn()}
        onScoutIconClick={vi.fn()}
        currentExecutiveSummary="Draft"
      />,
    );

    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textbox.value).toBe("Draft");
  });

  it("calls both setLocalExecutiveSummary and onExecutiveSummaryChange on change", () => {
    const setLocalExecutiveSummary = vi.fn();
    const onExecutiveSummaryChange = vi.fn();

    render(
      <ExecutiveSummarySection
        isEditing={true}
        normalizedDeletedSections={new Set()}
        localExecutiveSummary="Draft"
        setLocalExecutiveSummary={setLocalExecutiveSummary}
        onExecutiveSummaryChange={onExecutiveSummaryChange}
        onDeleteSection={vi.fn()}
        onScoutIconClick={vi.fn()}
        currentExecutiveSummary="Draft"
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Updated draft" },
    });

    expect(setLocalExecutiveSummary).toHaveBeenCalledWith("Updated draft");
    expect(onExecutiveSummaryChange).toHaveBeenCalledWith("Updated draft");
  });

  it("renders nothing when the section is deleted in editing mode", () => {
    const { container } = render(
      <ExecutiveSummarySection
        isEditing={true}
        normalizedDeletedSections={new Set(["executive-summary"])}
        localExecutiveSummary="Draft"
        setLocalExecutiveSummary={vi.fn()}
        onExecutiveSummaryChange={vi.fn()}
        onDeleteSection={vi.fn()}
        onScoutIconClick={vi.fn()}
        currentExecutiveSummary="Draft"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
