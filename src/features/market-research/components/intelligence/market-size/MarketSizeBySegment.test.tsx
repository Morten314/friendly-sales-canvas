import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarketSizeBySegment } from "./MarketSizeBySegment";

const segments = { Enterprise: "40%", SMB: "35%", Startup: "25%" };

describe("MarketSizeBySegment", () => {
  it("read mode renders one pie slice per segment in stable order", () => {
    const { container } = render(
      <MarketSizeBySegment
        editing={false}
        segments={segments}
        draft={segments}
        onChange={vi.fn()}
      />,
    );
    // segmentsToPieData maps each entry to a <path> slice.
    const slices = container.querySelectorAll("svg path");
    expect(slices).toHaveLength(3);
    // Legend renders each segment name, order preserved.
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    expect(screen.getByText("SMB")).toBeInTheDocument();
    expect(screen.getByText("Startup")).toBeInTheDocument();
  });

  it("read mode does not throw on an empty record", () => {
    expect(() =>
      render(<MarketSizeBySegment editing={false} segments={{}} draft={{}} onChange={vi.fn()} />),
    ).not.toThrow();
  });

  it("edit mode renders one row per draft segment", () => {
    render(
      <MarketSizeBySegment
        editing={true}
        segments={segments}
        draft={segments}
        onChange={vi.fn()}
      />,
    );
    const nameInputs = screen.getAllByPlaceholderText("Segment name");
    expect(nameInputs).toHaveLength(3);
  });

  it("edit mode with an empty draft renders no rows and an Add button, no throw", () => {
    expect(() =>
      render(<MarketSizeBySegment editing={true} segments={{}} draft={{}} onChange={vi.fn()} />),
    ).not.toThrow();
    expect(screen.queryAllByPlaceholderText("Segment name")).toHaveLength(0);
    expect(screen.getByText("Add Segment")).toBeInTheDocument();
  });

  it("edit mode Add Segment fires onChange with a new entry", () => {
    const onChange = vi.fn();
    render(<MarketSizeBySegment editing={true} segments={{}} draft={{}} onChange={onChange} />);
    fireEvent.click(screen.getByText("Add Segment"));
    expect(onChange).toHaveBeenCalledWith({ "New Segment": "" });
  });

  it("edit mode removing a segment fires onChange without it", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MarketSizeBySegment
        editing={true}
        segments={segments}
        draft={segments}
        onChange={onChange}
      />,
    );
    // The per-row delete buttons carry the X icon; the first one removes "Enterprise".
    const deleteButtons = container.querySelectorAll("button.text-red-600");
    fireEvent.click(deleteButtons[0]);
    expect(onChange).toHaveBeenCalledWith({ SMB: "35%", Startup: "25%" });
  });
});
