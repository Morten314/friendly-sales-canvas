import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { KeyMetrics } from "./KeyMetrics";

import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const defaultReadProps = {
  editing: false,
  deleted: false,
  aiAdoption: "78%",
  cloudMigration: "+45%",
  regulatory: "12 new",
  aiAdoptionDraft: "",
  cloudMigrationDraft: "",
  regulatoryDraft: "",
  onAiAdoptionChange: vi.fn(),
  onCloudMigrationChange: vi.fn(),
  onRegulatoryChange: vi.fn(),
  onCommit: vi.fn(),
  onDelete: vi.fn(),
};

describe("KeyMetrics", () => {
  it("read mode renders all three metric values", () => {
    renderWithProvider(<KeyMetrics {...defaultReadProps} />);
    expect(screen.getByText("78%")).toBeInTheDocument();
    expect(screen.getByText("+45%")).toBeInTheDocument();
    expect(screen.getByText("12 new")).toBeInTheDocument();
  });

  it("read mode renders the metric labels", () => {
    renderWithProvider(<KeyMetrics {...defaultReadProps} />);
    expect(screen.getByText("AI Adoption Rate")).toBeInTheDocument();
    expect(screen.getByText("Cloud Migration Increase")).toBeInTheDocument();
    expect(screen.getByText("Regulatory Changes")).toBeInTheDocument();
  });

  it("read mode renders even when deleted is true", () => {
    renderWithProvider(<KeyMetrics {...defaultReadProps} deleted={true} />);
    expect(screen.getByText("78%")).toBeInTheDocument();
  });

  it("edit mode renders three inputs with draft values", () => {
    renderWithProvider(
      <KeyMetrics
        {...defaultReadProps}
        editing={true}
        aiAdoptionDraft="80%"
        cloudMigrationDraft="+50%"
        regulatoryDraft="15 new"
      />,
    );
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(3);
    expect(inputs[0]).toHaveValue("80%");
    expect(inputs[1]).toHaveValue("+50%");
    expect(inputs[2]).toHaveValue("15 new");
  });

  it("edit mode fires onAiAdoptionChange when AI Adoption input changes", () => {
    const handleChange = vi.fn();
    renderWithProvider(
      <KeyMetrics
        {...defaultReadProps}
        editing={true}
        aiAdoptionDraft="80%"
        onAiAdoptionChange={handleChange}
      />,
    );
    const aiInput = screen.getByDisplayValue("80%");
    fireEvent.change(aiInput, { target: { value: "85%" } });
    expect(handleChange).toHaveBeenCalledWith("85%");
  });

  it("edit mode fires onCloudMigrationChange when Cloud Migration input changes", () => {
    const handleChange = vi.fn();
    renderWithProvider(
      <KeyMetrics
        {...defaultReadProps}
        editing={true}
        cloudMigrationDraft="+50%"
        onCloudMigrationChange={handleChange}
      />,
    );
    const cloudInput = screen.getByDisplayValue("+50%");
    fireEvent.change(cloudInput, { target: { value: "+60%" } });
    expect(handleChange).toHaveBeenCalledWith("+60%");
  });

  it("edit mode fires onRegulatoryChange when Regulatory input changes", () => {
    const handleChange = vi.fn();
    renderWithProvider(
      <KeyMetrics
        {...defaultReadProps}
        editing={true}
        regulatoryDraft="15 new"
        onRegulatoryChange={handleChange}
      />,
    );
    const regulatoryInput = screen.getByDisplayValue("15 new");
    fireEvent.change(regulatoryInput, { target: { value: "20 new" } });
    expect(handleChange).toHaveBeenCalledWith("20 new");
  });

  it("editing + deleted renders nothing", () => {
    const { container } = renderWithProvider(
      <KeyMetrics {...defaultReadProps} editing={true} deleted={true} />,
    );
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector(".grid")).toBeNull();
  });

  it("edit mode commit button fires onCommit", () => {
    const handleCommit = vi.fn();
    renderWithProvider(<KeyMetrics {...defaultReadProps} editing={true} onCommit={handleCommit} />);
    // The Check button is always visible (no opacity-0 class)
    const buttons = screen.getAllByRole("button");
    // First button is the Check/commit button
    fireEvent.click(buttons[0]);
    expect(handleCommit).toHaveBeenCalledTimes(1);
  });

  it("edit mode delete button fires onDelete", () => {
    const handleDelete = vi.fn();
    renderWithProvider(<KeyMetrics {...defaultReadProps} editing={true} onDelete={handleDelete} />);
    // Second button is the X/delete button
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);
    expect(handleDelete).toHaveBeenCalledTimes(1);
  });
});
