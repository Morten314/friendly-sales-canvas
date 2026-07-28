import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GrowthProjections } from "./GrowthProjections";

const projections = { "2024": "10", "2025": "14", "2026": "19" };

describe("GrowthProjections", () => {
  it("read mode renders one ordered point per projection", () => {
    const { container } = render(
      <GrowthProjections
        editing={false}
        projections={projections}
        draft={projections}
        onChange={vi.fn()}
      />,
    );
    // projectionsToLineData maps each entry to a <circle> data point.
    const points = container.querySelectorAll("svg circle");
    expect(points).toHaveLength(3);
    // First and last axis labels reflect the ordered keys.
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  it("read mode does not throw on an empty record", () => {
    expect(() =>
      render(<GrowthProjections editing={false} projections={{}} draft={{}} onChange={vi.fn()} />),
    ).not.toThrow();
  });

  it("edit mode renders one row per draft year", () => {
    render(
      <GrowthProjections
        editing={true}
        projections={projections}
        draft={projections}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getAllByPlaceholderText("Year")).toHaveLength(3);
  });

  it("edit mode with an empty draft renders no rows and an Add button, no throw", () => {
    expect(() =>
      render(<GrowthProjections editing={true} projections={{}} draft={{}} onChange={vi.fn()} />),
    ).not.toThrow();
    expect(screen.queryAllByPlaceholderText("Year")).toHaveLength(0);
    expect(screen.getByText("Add Year")).toBeInTheDocument();
  });

  it("edit mode Add Year fires onChange with a new entry", () => {
    const onChange = vi.fn();
    render(<GrowthProjections editing={true} projections={{}} draft={{}} onChange={onChange} />);
    fireEvent.click(screen.getByText("Add Year"));
    expect(onChange).toHaveBeenCalledWith({ "2024": "" });
  });

  it("edit mode removing a year fires onChange without it", () => {
    const onChange = vi.fn();
    const { container } = render(
      <GrowthProjections
        editing={true}
        projections={projections}
        draft={projections}
        onChange={onChange}
      />,
    );
    const deleteButtons = container.querySelectorAll("button.text-red-600");
    fireEvent.click(deleteButtons[0]);
    expect(onChange).toHaveBeenCalledWith({ "2025": "14", "2026": "19" });
  });
});
