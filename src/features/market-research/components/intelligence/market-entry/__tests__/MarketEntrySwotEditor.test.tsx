import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MarketEntrySwotEditor, { type MarketEntrySwotEdit } from "../MarketEntrySwotEditor";

const baseValue: MarketEntrySwotEdit = {
  strengths: ["Strong brand"],
  weaknesses: ["Thin margins"],
  opportunities: ["New region"],
  threats: ["New entrant"],
};

describe("MarketEntrySwotEditor", () => {
  it("renders existing items as editable inputs for a populated value", () => {
    render(<MarketEntrySwotEditor value={baseValue} onChange={vi.fn()} />);

    expect(screen.getByDisplayValue("Strong brand")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Thin margins")).toBeInTheDocument();
    expect(screen.getByDisplayValue("New region")).toBeInTheDocument();
    expect(screen.getByDisplayValue("New entrant")).toBeInTheDocument();
  });

  it("calls onChange with the updated array for a quadrant when typing in an item input", () => {
    const onChange = vi.fn();
    render(<MarketEntrySwotEditor value={baseValue} onChange={onChange} />);

    fireEvent.change(screen.getByDisplayValue("Strong brand"), {
      target: { value: "Strong brandX" },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...baseValue,
      strengths: ["Strong brandX"],
    });
  });

  it("appends a trailing empty string to the quadrant array when its Add button is clicked", () => {
    const onChange = vi.fn();
    render(<MarketEntrySwotEditor value={baseValue} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Opportunity" }));

    expect(onChange).toHaveBeenCalledWith({
      ...baseValue,
      opportunities: ["New region", ""],
    });
  });

  it("calls onChange with the item removed when a quadrant remove button is clicked", () => {
    const onChange = vi.fn();
    const value: MarketEntrySwotEdit = {
      ...baseValue,
      threats: ["New entrant", "Substitutes"],
    };
    render(<MarketEntrySwotEditor value={value} onChange={onChange} />);

    // The remove button lives next to each item input; click the one for the
    // first threat item.
    const threatInput = screen.getByDisplayValue("New entrant");
    const removeButton = threatInput.parentElement?.querySelector("button");
    expect(removeButton).toBeTruthy();
    fireEvent.click(removeButton as HTMLButtonElement);

    expect(onChange).toHaveBeenCalledWith({
      ...value,
      threats: ["Substitutes"],
    });
  });
});
