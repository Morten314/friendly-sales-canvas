import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { RisksWatchouts } from "./RisksWatchouts";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const defaultRisks = ["Regulatory changes", "Market saturation"];

describe("RisksWatchouts", () => {
  describe("read mode", () => {
    it("renders each risk as a list item", () => {
      renderWithProvider(
        <RisksWatchouts
          editing={false}
          deleted={false}
          risks={defaultRisks}
          draft={[]}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByText("Regulatory changes")).toBeInTheDocument();
      expect(screen.getByText("Market saturation")).toBeInTheDocument();
    });

    it("renders empty-state hint when risks array is empty", () => {
      renderWithProvider(
        <RisksWatchouts
          editing={false}
          deleted={false}
          risks={[]}
          draft={[]}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByText("No risks identified")).toBeInTheDocument();
    });
  });

  describe("edit mode", () => {
    it("renders an input for each draft item", () => {
      renderWithProvider(
        <RisksWatchouts
          editing={true}
          deleted={false}
          risks={defaultRisks}
          draft={["Draft risk 1", "Draft risk 2"]}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      const inputs = screen.getAllByPlaceholderText("Enter risk...");
      expect(inputs).toHaveLength(2);
      expect(inputs[0]).toHaveValue("Draft risk 1");
      expect(inputs[1]).toHaveValue("Draft risk 2");
    });

    it("calls onChange with updated array when an input changes", () => {
      const onChange = vi.fn();
      renderWithProvider(
        <RisksWatchouts
          editing={true}
          deleted={false}
          risks={defaultRisks}
          draft={["Draft risk 1", "Draft risk 2"]}
          onChange={onChange}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      const inputs = screen.getAllByPlaceholderText("Enter risk...");
      fireEvent.change(inputs[0], { target: { value: "Updated risk" } });
      expect(onChange).toHaveBeenCalledWith(["Updated risk", "Draft risk 2"]);
    });

    it("calls onChange with item removed when remove button is clicked", () => {
      const onChange = vi.fn();
      renderWithProvider(
        <RisksWatchouts
          editing={true}
          deleted={false}
          risks={defaultRisks}
          draft={["Draft risk 1", "Draft risk 2"]}
          onChange={onChange}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      // Buttons: [Commit (Check), Delete section (X), remove-0 (X), remove-1 (X), Add Risk]
      // The remove buttons start at index 2
      const buttons = screen.getAllByRole("button");
      // Remove button for first item is index 2
      fireEvent.click(buttons[2]);
      expect(onChange).toHaveBeenCalledWith(["Draft risk 2"]);
    });

    it("calls onChange with new empty item when Add Risk is clicked", () => {
      const onChange = vi.fn();
      renderWithProvider(
        <RisksWatchouts
          editing={true}
          deleted={false}
          risks={defaultRisks}
          draft={["Draft risk 1"]}
          onChange={onChange}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByText("Add Risk"));
      expect(onChange).toHaveBeenCalledWith(["Draft risk 1", ""]);
    });

    it("calls onCommit when commit button is clicked", () => {
      const onCommit = vi.fn();
      renderWithProvider(
        <RisksWatchouts
          editing={true}
          deleted={false}
          risks={defaultRisks}
          draft={["Draft risk 1"]}
          onChange={vi.fn()}
          onCommit={onCommit}
          onDelete={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByTitle("Commit changes"));
      expect(onCommit).toHaveBeenCalledOnce();
    });

    it("calls onDelete when delete button is clicked", () => {
      const onDelete = vi.fn();
      renderWithProvider(
        <RisksWatchouts
          editing={true}
          deleted={false}
          risks={defaultRisks}
          draft={["Draft risk 1"]}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={onDelete}
        />,
      );
      // Second button is the delete section (X) button
      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[1]);
      expect(onDelete).toHaveBeenCalledOnce();
    });
  });

  describe("editing + deleted gate", () => {
    it("renders nothing when editing and deleted", () => {
      const { container } = renderWithProvider(
        <RisksWatchouts
          editing={true}
          deleted={true}
          risks={defaultRisks}
          draft={["Draft risk 1"]}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
