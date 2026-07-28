import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { ICP } from "../../../types";
import IcpWizard from "../IcpWizard";

// Capture toast calls so the validation-failure toast (parity with the legacy
// handleSaveICP) can be asserted.
const toastMock = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

// The Industry/Job-Title comboboxes render a `cmdk` popover when the input is
// typed into; `cmdk` uses ResizeObserver and Element.scrollIntoView, neither of
// which jsdom provides. Polyfill them locally (scoped to this file — not shared
// test setup) so the popover can mount without throwing.
beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

const sampleIcp: ICP = {
  id: "icp-1",
  primaryRegion: "Europe",
  location: ["Berlin"],
  industry: ["SaaS"],
  companySize: ["11–50"],
  buyerRole: ["CTO"],
  accountsOnWatchlist: ["Acme"],
  accountsToAvoid: ["Globex"],
  fitConfidence: "high",
  additionalContext: "context here",
  status: "saved",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
};

function renderWizard(overrides: Partial<React.ComponentProps<typeof IcpWizard>> = {}) {
  const props = {
    initial: undefined,
    onSaved: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<IcpWizard {...props} />) };
}

describe("IcpWizard", () => {
  it("renders the Add title in add mode (no initial)", () => {
    renderWizard();
    expect(screen.getByRole("heading", { name: "Add New ICP" })).toBeInTheDocument();
  });

  it("renders the Edit title and pre-fills fields when given an initial ICP", () => {
    renderWizard({ initial: sampleIcp });
    expect(screen.getByRole("heading", { name: "Edit ICP" })).toBeInTheDocument();
    // Pre-filled tags from the seeded ICP.
    expect(screen.getByText("Berlin ×")).toBeInTheDocument();
    expect(screen.getByText("SaaS ×")).toBeInTheDocument();
    expect(screen.getByText("11–50 ×")).toBeInTheDocument();
    expect(screen.getByText("CTO ×")).toBeInTheDocument();
    expect(screen.getByText("Acme ×")).toBeInTheDocument();
    expect(screen.getByText("Globex ×")).toBeInTheDocument();
  });

  it("fires onCancel when Cancel is clicked", () => {
    const { props } = renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not call onSaved and shows an error + validation toast when required fields are missing", () => {
    toastMock.mockClear();
    const { props } = renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(screen.getByText("Please select a region")).toBeInTheDocument();
    // Parity with legacy handleSaveICP: a destructive validation toast fires.
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Validation Error", variant: "destructive" }),
    );
  });

  it("calls onSaved with the assembled ICP (isEdit=true) when an edit-seeded form is saved", () => {
    // Seeding from `sampleIcp` satisfies every required field, so a click-Save
    // assembles a complete ICP without needing to drive the comboboxes. The
    // assembled shape must carry the seeded values, and isEdit must be true.
    const onSaved = vi.fn();
    render(<IcpWizard initial={sampleIcp} onSaved={onSaved} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));
    expect(onSaved).toHaveBeenCalledTimes(1);
    const [assembled, isEdit] = onSaved.mock.calls[0];
    expect(isEdit).toBe(true);
    expect(assembled.id).toBe("icp-1");
    expect(assembled.primaryRegion).toBe("Europe");
    expect(assembled.industry).toEqual(["SaaS"]);
    expect(assembled.companySize).toEqual(["11–50"]);
    expect(assembled.buyerRole).toEqual(["CTO"]);
    expect(assembled.fitConfidence).toBe("high");
  });

  it("adds an industry tag via the keyboard 'Enter to add' affordance in add mode", () => {
    renderWizard();
    // Both Industry and Job Title use the same "Type or Select" placeholder;
    // the Industry input is the first one.
    const [industryInput] = screen.getAllByPlaceholderText("Type or Select");
    fireEvent.change(industryInput, { target: { value: "Fintech" } });
    fireEvent.keyDown(industryInput, { key: "Enter" });
    expect(screen.getByText("Fintech ×")).toBeInTheDocument();
  });
});
