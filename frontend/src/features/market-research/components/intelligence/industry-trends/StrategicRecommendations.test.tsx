import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { StrategicRecommendations } from "./StrategicRecommendations";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const defaultRecommendations = {
  primaryFocus: "Focus on AI adoption",
  marketEntry: "Strategic partnerships first",
};

const emptyDraft = { primaryFocus: "", marketEntry: "" };

describe("StrategicRecommendations", () => {
  describe("read mode", () => {
    it("renders Primary Focus and Market Entry values", () => {
      renderWithProvider(
        <StrategicRecommendations
          editing={false}
          deleted={false}
          recommendations={defaultRecommendations}
          draft={emptyDraft}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByText("Primary Focus")).toBeInTheDocument();
      expect(screen.getByText("Focus on AI adoption")).toBeInTheDocument();
      expect(screen.getByText("Market Entry")).toBeInTheDocument();
      expect(screen.getByText("Strategic partnerships first")).toBeInTheDocument();
    });

    it("renders fallback text when recommendations are empty", () => {
      renderWithProvider(
        <StrategicRecommendations
          editing={false}
          deleted={false}
          recommendations={{ primaryFocus: "", marketEntry: "" }}
          draft={emptyDraft}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getAllByText("No recommendations available")).toHaveLength(2);
    });
  });

  describe("edit mode", () => {
    it("renders two textareas for primaryFocus and marketEntry", () => {
      renderWithProvider(
        <StrategicRecommendations
          editing={true}
          deleted={false}
          recommendations={defaultRecommendations}
          draft={{ primaryFocus: "Draft focus", marketEntry: "Draft entry" }}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByLabelText("Primary Focus")).toBeInTheDocument();
      expect(screen.getByLabelText("Market Entry")).toBeInTheDocument();
    });

    it("calls onChange with updated primaryFocus when primaryFocus textarea changes", () => {
      const onChange = vi.fn();
      const draft = { primaryFocus: "Draft focus", marketEntry: "Draft entry" };
      renderWithProvider(
        <StrategicRecommendations
          editing={true}
          deleted={false}
          recommendations={defaultRecommendations}
          draft={draft}
          onChange={onChange}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByLabelText("Primary Focus"), {
        target: { value: "New focus" },
      });
      expect(onChange).toHaveBeenCalledWith({ ...draft, primaryFocus: "New focus" });
    });

    it("calls onChange with updated marketEntry when marketEntry textarea changes", () => {
      const onChange = vi.fn();
      const draft = { primaryFocus: "Draft focus", marketEntry: "Draft entry" };
      renderWithProvider(
        <StrategicRecommendations
          editing={true}
          deleted={false}
          recommendations={defaultRecommendations}
          draft={draft}
          onChange={onChange}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByLabelText("Market Entry"), {
        target: { value: "New entry" },
      });
      expect(onChange).toHaveBeenCalledWith({ ...draft, marketEntry: "New entry" });
    });

    it("calls onCommit when commit button is clicked", () => {
      const onCommit = vi.fn();
      renderWithProvider(
        <StrategicRecommendations
          editing={true}
          deleted={false}
          recommendations={defaultRecommendations}
          draft={{ primaryFocus: "Draft focus", marketEntry: "Draft entry" }}
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
        <StrategicRecommendations
          editing={true}
          deleted={false}
          recommendations={defaultRecommendations}
          draft={{ primaryFocus: "Draft focus", marketEntry: "Draft entry" }}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={onDelete}
        />,
      );
      // The X button has no title, query by role
      const buttons = screen.getAllByRole("button");
      // Second button is the delete (X) button
      fireEvent.click(buttons[1]);
      expect(onDelete).toHaveBeenCalledOnce();
    });
  });

  describe("editing + deleted gate", () => {
    it("renders nothing when editing and deleted", () => {
      const { container } = renderWithProvider(
        <StrategicRecommendations
          editing={true}
          deleted={true}
          recommendations={defaultRecommendations}
          draft={{ primaryFocus: "Draft focus", marketEntry: "Draft entry" }}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
