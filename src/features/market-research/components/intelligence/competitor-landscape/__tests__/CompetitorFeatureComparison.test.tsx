import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompetitorFeatureComparison } from "../CompetitorFeatureComparison";

import { TooltipProvider } from "@/components/ui/tooltip";

function buildProps(overrides: Partial<Parameters<typeof CompetitorFeatureComparison>[0]> = {}) {
  return {
    isEditing: false,
    localFeatures: [] as string[],
    setLocalFeatures: vi.fn(),
    localTools: {} as Record<string, string[]>,
    setLocalTools: vi.fn(),
    handleSaveFeatureComparison: vi.fn(),
    ...overrides,
  };
}

function wrap(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("CompetitorFeatureComparison", () => {
  it("empty features + empty tools → renders nothing (null)", () => {
    const { container } = wrap(<CompetitorFeatureComparison {...buildProps()} />);
    expect(container.firstChild).toBeNull();
  });

  it("has tools but empty features → renders nothing (null) when tools keys present but features empty", () => {
    // The component's null condition is: !features || !tools || Object.keys(tools).length === 0
    // So with tools present it should render; without it returns null
    const { container } = wrap(
      <CompetitorFeatureComparison
        {...buildProps({
          localFeatures: ["Speed"],
          localTools: {},
        })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("features + tools populated → renders Feature Comparison heading", () => {
    wrap(
      <CompetitorFeatureComparison
        {...buildProps({
          localFeatures: ["Speed", "Accuracy"],
          localTools: { ToolA: ["Fast", "High"], ToolB: ["Slow", "Medium"] },
        })}
      />,
    );
    expect(screen.getByText("Feature Comparison")).toBeInTheDocument();
  });

  it("renders feature names as row headers", () => {
    wrap(
      <CompetitorFeatureComparison
        {...buildProps({
          localFeatures: ["Reliability", "Performance"],
          localTools: { ToolX: ["99.9%", "High"] },
        })}
      />,
    );
    expect(screen.getByText("Reliability")).toBeInTheDocument();
    expect(screen.getByText("Performance")).toBeInTheDocument();
  });

  it("renders tool names as column headers", () => {
    wrap(
      <CompetitorFeatureComparison
        {...buildProps({
          localFeatures: ["Speed"],
          localTools: { Salesforce: ["Fast"], HubSpot: ["Medium"] },
        })}
      />,
    );
    expect(screen.getByText("Salesforce")).toBeInTheDocument();
    expect(screen.getByText("HubSpot")).toBeInTheDocument();
  });

  it("renders tool cell values from localTools", () => {
    wrap(
      <CompetitorFeatureComparison
        {...buildProps({
          localFeatures: ["Integration"],
          localTools: { ToolA: ["Native API"] },
        })}
      />,
    );
    expect(screen.getByText("Native API")).toBeInTheDocument();
  });

  it("missing cell value → renders '-' fallback", () => {
    wrap(
      <CompetitorFeatureComparison
        {...buildProps({
          localFeatures: ["Speed", "Cost"],
          // ToolA only has 1 value, second feature missing
          localTools: { ToolA: ["Fast"] },
        })}
      />,
    );
    // The fallback '-' should appear for the missing cell
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("isEditing=false → no input fields visible", () => {
    wrap(
      <CompetitorFeatureComparison
        {...buildProps({
          localFeatures: ["Speed"],
          localTools: { ToolA: ["Fast"] },
          isEditing: false,
        })}
      />,
    );
    expect(screen.queryByPlaceholderText("Feature name")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Tool name")).not.toBeInTheDocument();
  });

  it("isEditing=true → commit button, feature inputs and tool inputs visible", () => {
    wrap(
      <CompetitorFeatureComparison
        {...buildProps({
          localFeatures: ["Speed"],
          localTools: { ToolA: ["Fast"] },
          isEditing: true,
        })}
      />,
    );
    expect(screen.getByTitle("Commit changes")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Feature name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tool name")).toBeInTheDocument();
  });

  it("isEditing=true → 'Add Feature' and 'Add Tool' buttons visible", () => {
    wrap(
      <CompetitorFeatureComparison
        {...buildProps({
          localFeatures: ["Speed"],
          localTools: { ToolA: ["Fast"] },
          isEditing: true,
        })}
      />,
    );
    expect(screen.getByRole("button", { name: /Add Feature/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Tool/i })).toBeInTheDocument();
  });
});
