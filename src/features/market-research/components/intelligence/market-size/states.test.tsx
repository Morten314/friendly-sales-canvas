import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorState, LoadingState, NoDataState } from "./states";

// ---------------------------------------------------------------------------
// LoadingState
// ---------------------------------------------------------------------------
describe("LoadingState", () => {
  it("renders the loading copy", () => {
    render(<LoadingState />);
    expect(screen.getByText("Loading market size data...")).toBeInTheDocument();
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
  it("renders the error heading", () => {
    render(<ErrorState message="something broke" onRetry={vi.fn()} />);
    expect(screen.getByText("Error loading data")).toBeInTheDocument();
  });

  it("renders the error message", () => {
    render(<ErrorState message="network timeout" onRetry={vi.fn()} />);
    expect(screen.getByText(/network timeout/)).toBeInTheDocument();
  });

  it("renders the default message when none is provided", () => {
    render(<ErrorState onRetry={vi.fn()} />);
    expect(screen.getByText("Failed to load market size data")).toBeInTheDocument();
  });

  it("fires onRetry when the Retry button is clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="oops" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// NoDataState
// ---------------------------------------------------------------------------
describe("NoDataState", () => {
  it("renders the no-data copy", () => {
    render(<NoDataState onGenerate={vi.fn()} />);
    expect(screen.getByText("No market size data available")).toBeInTheDocument();
  });

  it("renders the Generate Report with Scout button", () => {
    render(<NoDataState onGenerate={vi.fn()} />);
    expect(screen.getByRole("button", { name: /generate report with scout/i })).toBeInTheDocument();
  });

  it("fires onGenerate when the button is clicked", () => {
    const onGenerate = vi.fn();
    render(<NoDataState onGenerate={onGenerate} />);
    fireEvent.click(screen.getByRole("button", { name: /generate report with scout/i }));
    expect(onGenerate).toHaveBeenCalledOnce();
  });
});
