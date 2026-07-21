import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { VisualCharts } from "./VisualCharts";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const defaultVisualCharts = {
  aiAdoptionTrends: ["Q1 2024", "Q2 2024", "Q3 2024"],
  technologyBudgetAllocation: {
    "AI/ML": "30",
    Cloud: "25",
    Security: "20",
  },
};

const emptyVisualCharts = {
  aiAdoptionTrends: [],
  technologyBudgetAllocation: {},
};

const defaultDraft = {
  aiAdoptionTrends: ["Q1 2024", "Q2 2024"],
  technologyBudgetAllocation: {
    "AI/ML": "30",
    Cloud: "25",
    Security: "20",
  },
};

describe("VisualCharts", () => {
  describe("read mode", () => {
    it("renders AI Adoption Trends heading", () => {
      renderWithProvider(
        <VisualCharts
          editing={false}
          deleted={false}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByText("AI Adoption Trends")).toBeInTheDocument();
    });

    it("renders Technology Budget Allocation heading", () => {
      renderWithProvider(
        <VisualCharts
          editing={false}
          deleted={false}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByText("Technology Budget Allocation")).toBeInTheDocument();
    });

    it("renders MiniLineChart when aiAdoptionTrends are present", () => {
      const { container } = renderWithProvider(
        <VisualCharts
          editing={false}
          deleted={false}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      // MiniLineChart renders a recharts ResponsiveContainer or svg
      // Assert the empty-state hint is NOT shown (chart rendered instead)
      expect(screen.queryByText("No AI adoption trends data available")).not.toBeInTheDocument();
      // Container should have some rendered chart output (recharts injects divs/svgs)
      expect(container.querySelector(".recharts-wrapper, svg, [class*='recharts']")).toBeTruthy();
    });

    it("renders empty hint when aiAdoptionTrends is empty", () => {
      renderWithProvider(
        <VisualCharts
          editing={false}
          deleted={false}
          visualCharts={emptyVisualCharts}
          draft={defaultDraft}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByText("No AI adoption trends data available")).toBeInTheDocument();
    });

    it("renders empty hint when technologyBudgetAllocation is empty", () => {
      renderWithProvider(
        <VisualCharts
          editing={false}
          deleted={false}
          visualCharts={emptyVisualCharts}
          draft={defaultDraft}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByText("No budget allocation data available")).toBeInTheDocument();
    });

    it("renders 'No valid budget allocation data available' when all budget values are zero/NaN", () => {
      renderWithProvider(
        <VisualCharts
          editing={false}
          deleted={false}
          visualCharts={{
            aiAdoptionTrends: [],
            technologyBudgetAllocation: { "AI/ML": "0", Cloud: "NaN", Security: "" },
          }}
          draft={defaultDraft}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByText("No valid budget allocation data available")).toBeInTheDocument();
    });

    it("renders MiniPieChart (no error hint) when budget allocation has valid values", () => {
      renderWithProvider(
        <VisualCharts
          editing={false}
          deleted={false}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.queryByText("No budget allocation data available")).not.toBeInTheDocument();
      expect(
        screen.queryByText("No valid budget allocation data available"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Error loading budget allocation chart")).not.toBeInTheDocument();
    });
  });

  describe("edit mode", () => {
    it("renders trend inputs for each draft trend item", () => {
      renderWithProvider(
        <VisualCharts
          editing={true}
          deleted={false}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      const inputs = screen.getAllByPlaceholderText("Enter trend (e.g., Q1 2024)");
      expect(inputs).toHaveLength(2);
      expect(inputs[0]).toHaveValue("Q1 2024");
      expect(inputs[1]).toHaveValue("Q2 2024");
    });

    it("renders budget inputs for AI/ML, Cloud, Security", () => {
      renderWithProvider(
        <VisualCharts
          editing={true}
          deleted={false}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByPlaceholderText("e.g., 30")).toHaveValue("30");
      expect(screen.getByPlaceholderText("e.g., 25")).toHaveValue("25");
      expect(screen.getByPlaceholderText("e.g., 20")).toHaveValue("20");
    });

    it("calls onChange with updated trend when a trend input changes", () => {
      const onChange = vi.fn();
      renderWithProvider(
        <VisualCharts
          editing={true}
          deleted={false}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
          onChange={onChange}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      const inputs = screen.getAllByPlaceholderText("Enter trend (e.g., Q1 2024)");
      fireEvent.change(inputs[0], { target: { value: "Q1 2025" } });
      expect(onChange).toHaveBeenCalledWith({
        ...defaultDraft,
        aiAdoptionTrends: ["Q1 2025", "Q2 2024"],
      });
    });

    it("calls onChange with updated AI/ML budget when input changes", () => {
      const onChange = vi.fn();
      renderWithProvider(
        <VisualCharts
          editing={true}
          deleted={false}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
          onChange={onChange}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByPlaceholderText("e.g., 30"), { target: { value: "40" } });
      expect(onChange).toHaveBeenCalledWith({
        ...defaultDraft,
        technologyBudgetAllocation: {
          ...defaultDraft.technologyBudgetAllocation,
          "AI/ML": "40",
        },
      });
    });

    it("calls onChange with updated Cloud budget when input changes", () => {
      const onChange = vi.fn();
      renderWithProvider(
        <VisualCharts
          editing={true}
          deleted={false}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
          onChange={onChange}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByPlaceholderText("e.g., 25"), { target: { value: "35" } });
      expect(onChange).toHaveBeenCalledWith({
        ...defaultDraft,
        technologyBudgetAllocation: {
          ...defaultDraft.technologyBudgetAllocation,
          Cloud: "35",
        },
      });
    });

    it("calls onChange with updated Security budget when input changes", () => {
      const onChange = vi.fn();
      renderWithProvider(
        <VisualCharts
          editing={true}
          deleted={false}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
          onChange={onChange}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByPlaceholderText("e.g., 20"), { target: { value: "15" } });
      expect(onChange).toHaveBeenCalledWith({
        ...defaultDraft,
        technologyBudgetAllocation: {
          ...defaultDraft.technologyBudgetAllocation,
          Security: "15",
        },
      });
    });

    it("calls onChange with item removed when remove trend button is clicked", () => {
      const onChange = vi.fn();
      renderWithProvider(
        <VisualCharts
          editing={true}
          deleted={false}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
          onChange={onChange}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      // Find remove buttons (X buttons next to each trend input)
      const removeButtons = screen
        .getAllByRole("button")
        .filter((btn) => btn.className.includes("text-red-600"));
      fireEvent.click(removeButtons[0]);
      expect(onChange).toHaveBeenCalledWith({
        ...defaultDraft,
        aiAdoptionTrends: ["Q2 2024"],
      });
    });

    it("calls onChange with new empty trend when Add Trend is clicked", () => {
      const onChange = vi.fn();
      renderWithProvider(
        <VisualCharts
          editing={true}
          deleted={false}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
          onChange={onChange}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByText("Add Trend"));
      expect(onChange).toHaveBeenCalledWith({
        ...defaultDraft,
        aiAdoptionTrends: ["Q1 2024", "Q2 2024", ""],
      });
    });

    it("calls onCommit when commit button is clicked", () => {
      const onCommit = vi.fn();
      renderWithProvider(
        <VisualCharts
          editing={true}
          deleted={false}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
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
        <VisualCharts
          editing={true}
          deleted={false}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={onDelete}
        />,
      );
      // Second button in the absolute button bar is the delete (X) button
      const buttons = screen.getAllByRole("button");
      // The commit (Check) button is first, delete (X) button is second
      fireEvent.click(buttons[1]);
      expect(onDelete).toHaveBeenCalledOnce();
    });
  });

  describe("editing + deleted gate", () => {
    it("renders nothing when editing and deleted", () => {
      const { container } = renderWithProvider(
        <VisualCharts
          editing={true}
          deleted={true}
          visualCharts={defaultVisualCharts}
          draft={defaultDraft}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
