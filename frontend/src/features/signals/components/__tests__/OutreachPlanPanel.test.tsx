import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RecommendationArtefactResponse } from "../../contracts";
import { OutreachPlanPanel } from "../OutreachPlanPanel";

const fullPlan: RecommendationArtefactResponse = {
  what_to_do: "Do the thing",
  strategy: "The strategy",
  how_to_communicate: "Warmly",
  communication_channel: "Email",
  communication_template: "Hi {name}, quick note …",
};

function renderPanel(overrides: Partial<React.ComponentProps<typeof OutreachPlanPanel>> = {}) {
  const props: React.ComponentProps<typeof OutreachPlanPanel> = {
    plan: fullPlan,
    isGenerating: false,
    isError: false,
    hasLeads: true,
    onRetry: vi.fn(),
    onSaveToLibrary: vi.fn(),
    onDownloadPdf: vi.fn(),
    onDownloadCsv: vi.fn(),
    ...overrides,
  };
  render(<OutreachPlanPanel {...props} />);
  return props;
}

afterEach(() => vi.restoreAllMocks());

describe("OutreachPlanPanel", () => {
  it("shows a loading state while generating and no sections yet", () => {
    renderPanel({ isGenerating: true, plan: null });
    expect(screen.getByText(/Generating outreach plan/i)).toBeInTheDocument();
    expect(screen.queryByText("What to do")).toBeNull();
  });

  it("shows an error with a Try again action that calls onRetry", () => {
    const props = renderPanel({ isError: true, plan: null });
    expect(screen.getByText(/Could not generate outreach plan/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders each non-empty plan section and its value", () => {
    renderPanel();
    expect(screen.getByText("What to do")).toBeInTheDocument();
    expect(screen.getByText("Do the thing")).toBeInTheDocument();
    expect(screen.getByText("Strategy")).toBeInTheDocument();
    expect(screen.getByText("How to communicate")).toBeInTheDocument();
    expect(screen.getByText("Channel")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Message template")).toBeInTheDocument();
    expect(screen.getByText(/Hi \{name\}/)).toBeInTheDocument();
  });

  it("omits sections whose field is empty", () => {
    renderPanel({ plan: { ...fullPlan, strategy: "", how_to_communicate: "" } });
    expect(screen.queryByText("Strategy")).toBeNull();
    expect(screen.queryByText("How to communicate")).toBeNull();
    expect(screen.getByText("What to do")).toBeInTheDocument();
  });

  it("shows the fallback note when every field is empty", () => {
    renderPanel({
      plan: {
        what_to_do: "",
        strategy: "",
        how_to_communicate: "",
        communication_channel: "",
        communication_template: "",
      },
    });
    expect(screen.getByText(/No plan content returned/i)).toBeInTheDocument();
  });

  it("hides Download CSV when there are no matched leads, keeps PDF + Save", () => {
    renderPanel({ hasLeads: false });
    expect(screen.queryByRole("button", { name: /Download CSV/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Download PDF/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save to Library/i })).toBeInTheDocument();
  });

  it("calls the delivery handlers from the footer buttons", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Save to Library/i }));
    fireEvent.click(screen.getByRole("button", { name: /Download PDF/i }));
    fireEvent.click(screen.getByRole("button", { name: /Download CSV/i }));
    expect(props.onSaveToLibrary).toHaveBeenCalledTimes(1);
    expect(props.onDownloadPdf).toHaveBeenCalledTimes(1);
    expect(props.onDownloadCsv).toHaveBeenCalledTimes(1);
  });

  it("copies the message template to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /^Copy$/i }));
    expect(writeText).toHaveBeenCalledWith("Hi {name}, quick note …");
    expect(await screen.findByText(/Copied/i)).toBeInTheDocument();
  });
});
