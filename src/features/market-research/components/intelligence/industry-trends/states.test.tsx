import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorState, LoadingState, NoDataState } from "./states";

// ---------------------------------------------------------------------------
// LoadingState
// ---------------------------------------------------------------------------
describe("LoadingState", () => {
  it("renders the section title", () => {
    render(<LoadingState />);
    expect(screen.getByText("Industry Trends")).toBeInTheDocument();
  });

  it("renders the loading copy", () => {
    render(<LoadingState />);
    expect(screen.getByText("Loading industry trends data...")).toBeInTheDocument();
  });

  it("renders the spinner (animate-spin)", () => {
    const { container } = render(<LoadingState />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ErrorState
// ---------------------------------------------------------------------------
describe("ErrorState", () => {
  it("renders the section title", () => {
    render(<ErrorState message="something broke" onRetry={vi.fn()} />);
    expect(screen.getByText("Industry Trends")).toBeInTheDocument();
  });

  it("renders the error message", () => {
    render(<ErrorState message="network timeout" onRetry={vi.fn()} />);
    expect(screen.getByText(/network timeout/)).toBeInTheDocument();
  });

  it("renders the Retry button", () => {
    render(<ErrorState message="oops" onRetry={vi.fn()} />);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("fires onRetry when the Retry button is clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="oops" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders without a message prop (undefined)", () => {
    render(<ErrorState onRetry={vi.fn()} />);
    expect(screen.getByText("Industry Trends")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NoDataState
// ---------------------------------------------------------------------------
describe("NoDataState", () => {
  it("renders the section title", () => {
    render(<NoDataState onGenerate={vi.fn()} />);
    expect(screen.getByText("Industry Trends")).toBeInTheDocument();
  });

  it("renders the no-data copy", () => {
    render(<NoDataState onGenerate={vi.fn()} />);
    expect(screen.getByText("No industry trends data available")).toBeInTheDocument();
  });

  it("renders the Generate Report button", () => {
    render(<NoDataState onGenerate={vi.fn()} />);
    expect(screen.getByRole("button", { name: /generate report/i })).toBeInTheDocument();
  });

  it("fires onGenerate when the Generate Report button is clicked", () => {
    const onGenerate = vi.fn();
    render(<NoDataState onGenerate={onGenerate} />);
    fireEvent.click(screen.getByRole("button", { name: /generate report/i }));
    expect(onGenerate).toHaveBeenCalledOnce();
  });
});
