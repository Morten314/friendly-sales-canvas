import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { RegionalHotspots } from "./RegionalHotspots";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const defaultHotspots = { APAC: "60%", Europe: "45%", "North America": "55%" };
const emptyHotspots: Record<string, string> = {};

describe("RegionalHotspots", () => {
  describe("read mode", () => {
    it("renders value/region pairs for each hotspot", () => {
      renderWithProvider(
        <RegionalHotspots
          editing={false}
          deleted={false}
          regionalHotspots={defaultHotspots}
          draft={{ APAC: "", Europe: "", "North America": "" }}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByText("60%")).toBeInTheDocument();
      expect(screen.getByText("APAC")).toBeInTheDocument();
      expect(screen.getByText("45%")).toBeInTheDocument();
      expect(screen.getByText("Europe")).toBeInTheDocument();
      expect(screen.getByText("55%")).toBeInTheDocument();
      expect(screen.getByText("North America")).toBeInTheDocument();
    });

    it("renders empty-state hint when no hotspots", () => {
      renderWithProvider(
        <RegionalHotspots
          editing={false}
          deleted={false}
          regionalHotspots={emptyHotspots}
          draft={{ APAC: "", Europe: "", "North America": "" }}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByText("No regional hotspots data available")).toBeInTheDocument();
    });
  });

  describe("edit mode", () => {
    it("renders inputs for APAC, Europe, North America", () => {
      renderWithProvider(
        <RegionalHotspots
          editing={true}
          deleted={false}
          regionalHotspots={defaultHotspots}
          draft={{ APAC: "60%", Europe: "45%", "North America": "55%" }}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(screen.getByLabelText("APAC")).toBeInTheDocument();
      expect(screen.getByLabelText("Europe")).toBeInTheDocument();
      expect(screen.getByLabelText("North America")).toBeInTheDocument();
    });

    it("calls onChange with updated APAC value when APAC input changes", () => {
      const onChange = vi.fn();
      const draft = { APAC: "60%", Europe: "45%", "North America": "55%" };
      renderWithProvider(
        <RegionalHotspots
          editing={true}
          deleted={false}
          regionalHotspots={defaultHotspots}
          draft={draft}
          onChange={onChange}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByLabelText("APAC"), { target: { value: "70%" } });
      expect(onChange).toHaveBeenCalledWith({ ...draft, APAC: "70%" });
    });

    it("calls onChange with updated Europe value when Europe input changes", () => {
      const onChange = vi.fn();
      const draft = { APAC: "60%", Europe: "45%", "North America": "55%" };
      renderWithProvider(
        <RegionalHotspots
          editing={true}
          deleted={false}
          regionalHotspots={defaultHotspots}
          draft={draft}
          onChange={onChange}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByLabelText("Europe"), { target: { value: "50%" } });
      expect(onChange).toHaveBeenCalledWith({ ...draft, Europe: "50%" });
    });

    it("calls onChange with updated North America value when North America input changes", () => {
      const onChange = vi.fn();
      const draft = { APAC: "60%", Europe: "45%", "North America": "55%" };
      renderWithProvider(
        <RegionalHotspots
          editing={true}
          deleted={false}
          regionalHotspots={defaultHotspots}
          draft={draft}
          onChange={onChange}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByLabelText("North America"), { target: { value: "65%" } });
      expect(onChange).toHaveBeenCalledWith({ ...draft, "North America": "65%" });
    });

    it("calls onCommit when Check button is clicked", () => {
      const onCommit = vi.fn();
      renderWithProvider(
        <RegionalHotspots
          editing={true}
          deleted={false}
          regionalHotspots={defaultHotspots}
          draft={{ APAC: "60%", Europe: "45%", "North America": "55%" }}
          onChange={vi.fn()}
          onCommit={onCommit}
          onDelete={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByTitle("Commit changes"));
      expect(onCommit).toHaveBeenCalledOnce();
    });

    it("calls onDelete when X button is clicked", () => {
      const onDelete = vi.fn();
      renderWithProvider(
        <RegionalHotspots
          editing={true}
          deleted={false}
          regionalHotspots={defaultHotspots}
          draft={{ APAC: "60%", Europe: "45%", "North America": "55%" }}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={onDelete}
        />,
      );
      // The delete button is opacity-0 by default; query by role
      const buttons = screen.getAllByRole("button");
      const deleteBtn = buttons.find((b) => b.querySelector("svg") && b !== buttons[0]);
      expect(deleteBtn).toBeDefined();
      fireEvent.click(deleteBtn!);
      expect(onDelete).toHaveBeenCalledOnce();
    });
  });

  describe("editing + deleted", () => {
    it("renders nothing when editing and deleted", () => {
      const { container } = renderWithProvider(
        <RegionalHotspots
          editing={true}
          deleted={true}
          regionalHotspots={defaultHotspots}
          draft={{ APAC: "60%", Europe: "45%", "North America": "55%" }}
          onChange={vi.fn()}
          onCommit={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
