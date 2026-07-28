import { fireEvent, render, screen } from "@testing-library/react";
import { Scale } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { KeyRegulatoryUpdatesSection } from "../KeyRegulatoryUpdatesSection";
import type { RegulatoryKeyDataPoint } from "../types";

const keyDataPoints: RegulatoryKeyDataPoint[] = [
  {
    id: "eu-ai-act",
    icon: Scale,
    title: "EU AI Act",
    value: "Q1 2026",
    badge: "New",
    badgeColor: "bg-blue-100 text-blue-800",
    tooltip: "tip",
  },
  {
    id: "custom-x",
    icon: Scale,
    title: "Custom",
    value: "v",
    badge: "Update",
    badgeColor: "bg-yellow-100 text-yellow-800",
    tooltip: "t2",
  },
];

function baseProps() {
  return {
    isEditing: false as boolean,
    normalizedDeletedSections: new Set<string>(),
    keyDataPoints,
    onDeleteSection: vi.fn(),
    onScoutIconClick: vi.fn(),
    localEuAiActDeadline: "Q1 2026",
    setLocalEuAiActDeadline: vi.fn(),
    onEuAiActDeadlineChange: vi.fn(),
    localGdprCompliance: "",
    setLocalGdprCompliance: vi.fn(),
    onGdprComplianceChange: vi.fn(),
    localPotentialFines: "",
    setLocalPotentialFines: vi.fn(),
    onPotentialFinesChange: vi.fn(),
    localDataLocalization: "",
    setLocalDataLocalization: vi.fn(),
    onDataLocalizationChange: vi.fn(),
    localKeyDataValues: {} as Record<string, string>,
    setLocalKeyDataValues: vi.fn(),
  };
}

describe("KeyRegulatoryUpdatesSection", () => {
  it("renders one read-only card per key data point with title and badge", () => {
    render(<KeyRegulatoryUpdatesSection {...baseProps()} isEditing={false} />);

    expect(screen.getByText("EU AI Act")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Update")).toBeInTheDocument();
    // read-only: no editable textboxes
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders an input per point in editing mode", () => {
    render(<KeyRegulatoryUpdatesSection {...baseProps()} isEditing={true} />);

    const textboxes = screen.getAllByRole("textbox");
    expect(textboxes).toHaveLength(keyDataPoints.length);
  });

  it("fires both setLocalEuAiActDeadline and onEuAiActDeadlineChange for the eu-ai-act input", () => {
    const props = baseProps();
    render(<KeyRegulatoryUpdatesSection {...props} isEditing={true} />);

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    // first input corresponds to the first keyDataPoint (eu-ai-act)
    fireEvent.change(inputs[0], { target: { value: "Q3 2026" } });

    expect(props.setLocalEuAiActDeadline).toHaveBeenCalledWith("Q3 2026");
    expect(props.onEuAiActDeadlineChange).toHaveBeenCalledWith("Q3 2026");
  });

  it("fires setLocalKeyDataValues for a dynamic (custom-x) input", () => {
    const props = baseProps();
    render(<KeyRegulatoryUpdatesSection {...props} isEditing={true} />);

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    fireEvent.change(inputs[1], { target: { value: "new dynamic" } });

    expect(props.setLocalKeyDataValues).toHaveBeenCalled();
  });

  it("fires onDeleteSection and onScoutIconClick when delete button clicked in editing mode", () => {
    const props = baseProps();
    const { container } = render(<KeyRegulatoryUpdatesSection {...props} isEditing={true} />);

    // The chrome buttons are the two <button> elements at the top; the second is delete (X).
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    fireEvent.click(buttons[1]);

    expect(props.onDeleteSection).toHaveBeenCalledWith("key-updates");
    expect(props.onScoutIconClick).toHaveBeenCalledWith(
      "regulatory-compliance",
      true,
      expect.stringContaining("Key Regulatory Updates"),
    );
  });

  it("renders nothing when the section is deleted in editing mode", () => {
    const props = baseProps();
    const { container } = render(
      <KeyRegulatoryUpdatesSection
        {...props}
        isEditing={true}
        normalizedDeletedSections={new Set(["key-updates"])}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
