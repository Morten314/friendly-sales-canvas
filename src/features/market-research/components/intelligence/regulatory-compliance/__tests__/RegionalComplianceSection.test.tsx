import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RegionalComplianceSection } from "../RegionalComplianceSection";
import type { UntypedRegionData } from "../types";

const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const fixture: UntypedRegionData[] = [
  {
    region: "EU",
    framework: "GDPR",
    deadline: "Q1 2026",
    impact: "High",
    status: "Active",
    requirements: "Data residency",
  },
  {
    region: "US",
    framework: "CCPA",
    deadline: "Q2 2026",
    impact: "Medium",
    status: "Pending",
    requirements: "Opt-out",
  },
];

function buildProps(overrides: Partial<Parameters<typeof RegionalComplianceSection>[0]> = {}) {
  return {
    isEditing: false,
    normalizedDeletedSections: new Set<string>(),
    regionalData: fixture,
    localRegionalData: fixture,
    setLocalRegionalData: vi.fn(),
    onDeleteSection: vi.fn(),
    onScoutIconClick: vi.fn(),
    ...overrides,
  };
}

describe("RegionalComplianceSection", () => {
  it("(isEditing=false) renders one row per region with region/deadline/requirements text", () => {
    render(<RegionalComplianceSection {...buildProps({ isEditing: false })} />);
    expect(screen.getByText("EU")).toBeInTheDocument();
    expect(screen.getByText("US")).toBeInTheDocument();
    expect(screen.getByText("Q1 2026")).toBeInTheDocument();
    expect(screen.getByText("Data residency")).toBeInTheDocument();
    expect(screen.getByText("Opt-out")).toBeInTheDocument();
  });

  it("(isEditing=true) editing a region cell input calls setLocalRegionalData", () => {
    const setLocalRegionalData = vi.fn();
    render(
      <RegionalComplianceSection {...buildProps({ isEditing: true, setLocalRegionalData })} />,
    );
    const regionInput = screen.getByDisplayValue("EU");
    fireEvent.change(regionInput, { target: { value: "EMEA" } });
    expect(setLocalRegionalData).toHaveBeenCalled();
  });

  it("(isEditing=true) Add Region button calls setLocalRegionalData", () => {
    const setLocalRegionalData = vi.fn();
    render(
      <RegionalComplianceSection {...buildProps({ isEditing: true, setLocalRegionalData })} />,
    );
    fireEvent.click(screen.getByText("Add Region"));
    expect(setLocalRegionalData).toHaveBeenCalled();
  });

  it("(isEditing=true) delete-row Trash2 button calls setLocalRegionalData", () => {
    const setLocalRegionalData = vi.fn();
    render(
      <RegionalComplianceSection {...buildProps({ isEditing: true, setLocalRegionalData })} />,
    );
    // Row delete buttons live in the table body. The section chrome buttons
    // (Check / X) are the first two buttons; "Add Region" has visible text.
    // Find row delete buttons as those that are neither chrome nor Add Region.
    const buttons = screen.getAllByRole("button");
    const addRegion = buttons.find((b) => b.textContent === "Add Region");
    const rowDeleteButtons = buttons.slice(2).filter((b) => b !== addRegion);
    expect(rowDeleteButtons.length).toBe(fixture.length);
    fireEvent.click(rowDeleteButtons[0]);
    expect(setLocalRegionalData).toHaveBeenCalled();
  });

  it("(isEditing=true) delete-section X button fires onDeleteSection + onScoutIconClick", () => {
    const onDeleteSection = vi.fn();
    const onScoutIconClick = vi.fn();
    render(
      <RegionalComplianceSection
        {...buildProps({ isEditing: true, onDeleteSection, onScoutIconClick })}
      />,
    );
    // Chrome: first button is Check (commit), second is X (delete section).
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);
    expect(onDeleteSection).toHaveBeenCalledWith("regional-breakdown");
    expect(onScoutIconClick).toHaveBeenCalledWith(
      "regulatory-compliance",
      true,
      expect.stringContaining("Regional Compliance Overview"),
    );
  });

  it("(isEditing=true, regional-breakdown deleted) renders nothing", () => {
    const { container } = render(
      <RegionalComplianceSection
        {...buildProps({
          isEditing: true,
          normalizedDeletedSections: new Set(["regional-breakdown"]),
        })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
