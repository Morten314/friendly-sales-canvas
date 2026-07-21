import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  AgentConfigForm,
  type AgentConfigValues,
  type AgentConfigChecks,
} from "../AgentConfigForm";

const values: AgentConfigValues = {
  agentName: "",
  assignedTasks: "",
  domain: "",
  generalInstructions: "",
  tone: "",
  autonomyLevel: "",
  frequency: "",
};
const checks: AgentConfigChecks = {
  leadGeneration: false,
  customerSupport: false,
  contentCreation: false,
  dataAnalysis: false,
  reporting: false,
};

function renderForm(overrides = {}) {
  const props = {
    title: "Agent Profile Settings",
    accent: "purple" as const,
    submitLabel: "Save Agent Profile",
    values,
    checks,
    onFieldChange: vi.fn(),
    onCheckChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<AgentConfigForm {...props} />) };
}

describe("AgentConfigForm", () => {
  it("renders the heading and the submit button when editable", () => {
    renderForm({ readOnly: false });
    expect(screen.getByText("Agent Profile Settings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Agent Profile" })).toBeInTheDocument();
  });
  it("hides the submit button in read-only mode", () => {
    renderForm({ readOnly: true });
    expect(screen.queryByRole("button", { name: "Save Agent Profile" })).not.toBeInTheDocument();
  });
  it("shows the agent-name select only when requested", () => {
    const { rerender } = render(
      <AgentConfigForm
        title="t"
        accent="blue"
        submitLabel="Deploy"
        values={values}
        checks={checks}
        onFieldChange={vi.fn()}
        onCheckChange={vi.fn()}
        onSubmit={vi.fn()}
        showAgentNameSelect={false}
      />,
    );
    expect(screen.queryByText("Agent Name")).not.toBeInTheDocument();
    rerender(
      <AgentConfigForm
        title="t"
        accent="purple"
        submitLabel="Save"
        values={values}
        checks={checks}
        onFieldChange={vi.fn()}
        onCheckChange={vi.fn()}
        onSubmit={vi.fn()}
        showAgentNameSelect
      />,
    );
    expect(screen.getByText("Agent Name")).toBeInTheDocument();
  });
  it("fires onFieldChange when the domain input changes", () => {
    const { props } = renderForm({ readOnly: false });
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "fintech" } });
    expect(props.onFieldChange).toHaveBeenCalledWith("domain", "fintech");
  });
});
