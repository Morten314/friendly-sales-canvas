import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StrategicRecommendationsSection } from "../StrategicRecommendationsSection";
import type { UntypedBackendApiResponse } from "../types";

const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const localFixture: UntypedBackendApiResponse = {
  mitigateRegulatoryRisks: ["X"],
  competitivePositioning: [],
  goToMarketStrategy: [],
};

function buildProps(
  overrides: Partial<Parameters<typeof StrategicRecommendationsSection>[0]> = {},
) {
  return {
    isEditing: false,
    normalizedDeletedSections: new Set<string>(),
    localStrategicRecommendations: localFixture,
    setLocalStrategicRecommendations: vi.fn(),
    regulatoryData: undefined,
    onDeleteSection: vi.fn(),
    onScoutIconClick: vi.fn(),
    ...overrides,
  };
}

describe("StrategicRecommendationsSection", () => {
  it("(isEditing=false) renders backend strategicRecommendations items", () => {
    render(
      <StrategicRecommendationsSection
        {...buildProps({
          isEditing: false,
          localStrategicRecommendations: {},
          regulatoryData: {
            strategicRecommendations: {
              mitigateRegulatoryRisks: ["Risk A"],
              competitivePositioning: ["Pos B"],
              goToMarketStrategy: ["GTM C"],
            },
          },
        })}
      />,
    );
    expect(screen.getByText("• Risk A")).toBeInTheDocument();
    expect(screen.getByText("• Pos B")).toBeInTheDocument();
    expect(screen.getByText("• GTM C")).toBeInTheDocument();
  });

  it("(isEditing=false, regulatoryData undefined) renders hardcoded fallback items", () => {
    render(
      <StrategicRecommendationsSection
        {...buildProps({
          isEditing: false,
          localStrategicRecommendations: {},
          regulatoryData: undefined,
        })}
      />,
    );
    expect(screen.getByText("• Implement privacy by design principles")).toBeInTheDocument();
  });

  it("(isEditing=true) editing an item input calls setLocalStrategicRecommendations", () => {
    const setLocalStrategicRecommendations = vi.fn();
    render(
      <StrategicRecommendationsSection
        {...buildProps({ isEditing: true, setLocalStrategicRecommendations })}
      />,
    );
    const input = screen.getByDisplayValue("X");
    fireEvent.change(input, { target: { value: "Y" } });
    expect(setLocalStrategicRecommendations).toHaveBeenCalled();
  });

  it("(isEditing=true) Add Item button calls setLocalStrategicRecommendations", () => {
    const setLocalStrategicRecommendations = vi.fn();
    render(
      <StrategicRecommendationsSection
        {...buildProps({ isEditing: true, setLocalStrategicRecommendations })}
      />,
    );
    const addButtons = screen.getAllByText("Add Item");
    fireEvent.click(addButtons[0]);
    expect(setLocalStrategicRecommendations).toHaveBeenCalled();
  });

  it("(isEditing=true) delete-section X button fires onDeleteSection + onScoutIconClick", () => {
    const onDeleteSection = vi.fn();
    const onScoutIconClick = vi.fn();
    render(
      <StrategicRecommendationsSection
        {...buildProps({ isEditing: true, onDeleteSection, onScoutIconClick })}
      />,
    );
    // Chrome: first button is Check (commit), second is X (delete section).
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);
    expect(onDeleteSection).toHaveBeenCalledWith("strategic-recommendations");
    expect(onScoutIconClick).toHaveBeenCalledWith(
      "regulatory-compliance",
      true,
      expect.stringContaining("Strategic Recommendations"),
    );
  });

  it("(isEditing=true, strategic-recommendations deleted) renders nothing", () => {
    const { container } = render(
      <StrategicRecommendationsSection
        {...buildProps({
          isEditing: true,
          normalizedDeletedSections: new Set(["strategic-recommendations"]),
        })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows local edits in read-only mode (survives exiting edit)", () => {
    render(
      <StrategicRecommendationsSection
        {...buildProps({
          isEditing: false,
          localStrategicRecommendations: {
            mitigateRegulatoryRisks: ["Edited mitigation step"],
            competitivePositioning: [],
            goToMarketStrategy: [],
          },
          regulatoryData: {
            strategicRecommendations: {
              mitigateRegulatoryRisks: ["API value, should be overridden"],
            },
          },
        })}
      />,
    );
    expect(screen.getByText(/Edited mitigation step/)).toBeInTheDocument();
    expect(screen.queryByText(/API value, should be overridden/)).not.toBeInTheDocument();
  });
});
