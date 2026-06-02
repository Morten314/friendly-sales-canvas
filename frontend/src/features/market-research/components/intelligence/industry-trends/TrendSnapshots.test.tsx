import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { TrendSnapshots } from "./TrendSnapshots";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const sampleSnapshots = [
  { title: "Market Growth", metric: "25% YoY", type: "growth" as const },
  { title: "AI Adoption", metric: "60%", type: "adoption" as const },
  { title: "Performance Index", metric: "92/100", type: "performance" as const },
];

const defaultProps = {
  editing: false,
  deleted: false,
  snapshots: sampleSnapshots,
  draft: sampleSnapshots,
  onChange: vi.fn(),
  onCommit: vi.fn(),
  onDelete: vi.fn(),
};

describe("TrendSnapshots", () => {
  it("read mode renders snapshot titles and metrics", () => {
    renderWithProvider(<TrendSnapshots {...defaultProps} />);
    expect(screen.getByText("Market Growth")).toBeInTheDocument();
    expect(screen.getByText("25% YoY")).toBeInTheDocument();
    expect(screen.getByText("AI Adoption")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("Performance Index")).toBeInTheDocument();
    expect(screen.getByText("92/100")).toBeInTheDocument();
  });

  it("read mode renders the section heading", () => {
    renderWithProvider(<TrendSnapshots {...defaultProps} />);
    expect(screen.getByText("Key Trend Snapshots")).toBeInTheDocument();
  });

  it("read mode renders gradient bars for each snapshot", () => {
    const { container } = renderWithProvider(<TrendSnapshots {...defaultProps} />);
    const bars = container.querySelectorAll(".bg-gradient-to-r");
    expect(bars).toHaveLength(sampleSnapshots.length);
  });

  it("read mode shows empty hint when snapshots is null/undefined", () => {
    renderWithProvider(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <TrendSnapshots {...defaultProps} snapshots={null as any} />,
    );
    expect(screen.getByText("No trend snapshots available")).toBeInTheDocument();
  });

  it("read mode renders even when deleted is true", () => {
    renderWithProvider(<TrendSnapshots {...defaultProps} deleted={true} />);
    expect(screen.getByText("Market Growth")).toBeInTheDocument();
  });

  it("editing + deleted renders nothing", () => {
    const { container } = renderWithProvider(
      <TrendSnapshots {...defaultProps} editing={true} deleted={true} />,
    );
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector(".grid")).toBeNull();
    expect(container.querySelector("h3")).toBeNull();
  });

  it("edit mode renders per-snapshot title and metric inputs", () => {
    renderWithProvider(<TrendSnapshots {...defaultProps} editing={true} />);
    const inputs = screen.getAllByRole("textbox");
    // 2 inputs per snapshot: title + metric
    expect(inputs).toHaveLength(sampleSnapshots.length * 2);
  });

  it("edit mode inputs are pre-filled from draft", () => {
    renderWithProvider(<TrendSnapshots {...defaultProps} editing={true} />);
    expect(screen.getByDisplayValue("Market Growth")).toBeInTheDocument();
    expect(screen.getByDisplayValue("25% YoY")).toBeInTheDocument();
  });

  it("edit mode title change calls onChange with immutably-updated array", () => {
    const handleChange = vi.fn();
    renderWithProvider(<TrendSnapshots {...defaultProps} editing={true} onChange={handleChange} />);
    const titleInput = screen.getByDisplayValue("Market Growth");
    fireEvent.change(titleInput, { target: { value: "Market Surge" } });
    expect(handleChange).toHaveBeenCalledTimes(1);
    const [next] = handleChange.mock.calls[0];
    expect(next[0].title).toBe("Market Surge");
    // Immutability: the other snapshot objects should be unchanged references aren't required,
    // but adjacent entries must be untouched
    expect(next[1]).toEqual(sampleSnapshots[1]);
    expect(next[2]).toEqual(sampleSnapshots[2]);
  });

  it("edit mode metric change calls onChange with immutably-updated array", () => {
    const handleChange = vi.fn();
    renderWithProvider(<TrendSnapshots {...defaultProps} editing={true} onChange={handleChange} />);
    const metricInput = screen.getByDisplayValue("25% YoY");
    fireEvent.change(metricInput, { target: { value: "30% YoY" } });
    expect(handleChange).toHaveBeenCalledTimes(1);
    const [next] = handleChange.mock.calls[0];
    expect(next[0].metric).toBe("30% YoY");
    expect(next[1]).toEqual(sampleSnapshots[1]);
    expect(next[2]).toEqual(sampleSnapshots[2]);
  });

  it("edit mode commit button fires onCommit", () => {
    const handleCommit = vi.fn();
    renderWithProvider(<TrendSnapshots {...defaultProps} editing={true} onCommit={handleCommit} />);
    const buttons = screen.getAllByRole("button");
    // First button is the Check/commit button
    fireEvent.click(buttons[0]);
    expect(handleCommit).toHaveBeenCalledTimes(1);
  });

  it("edit mode delete button fires onDelete", () => {
    const handleDelete = vi.fn();
    renderWithProvider(<TrendSnapshots {...defaultProps} editing={true} onDelete={handleDelete} />);
    const buttons = screen.getAllByRole("button");
    // Second button is the X/delete button
    fireEvent.click(buttons[1]);
    expect(handleDelete).toHaveBeenCalledTimes(1);
  });
});
