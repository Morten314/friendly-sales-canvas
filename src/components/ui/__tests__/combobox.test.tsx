import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { CreatableCombobox } from "../combobox";

// The combobox renders a `cmdk` popover. `cmdk` uses ResizeObserver and
// Element.scrollIntoView, and Radix's Popper positioning uses ResizeObserver —
// none of which jsdom provides. Polyfill them locally (scoped to this file, not
// the shared test setup) so the popover can mount without throwing. Mirrors the
// convention in IcpWizard.test.tsx.
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

const OPTIONS = ["SaaS", "Fintech", "Healthcare", "Manufacturing"];

/** Controlled host so a committed value flows back into the trigger. */
function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <CreatableCombobox
      id="industry"
      value={value}
      onChange={setValue}
      options={OPTIONS}
      placeholder="Select industry"
    />
  );
}

describe("CreatableCombobox", () => {
  it("shows the placeholder when no value is set", () => {
    render(<Harness />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Select industry");
  });

  it("shows the current value on the trigger", () => {
    render(<Harness initial="Fintech" />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Fintech");
  });

  it("displays the full option list when opened", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("SaaS")).toBeInTheDocument();
    expect(screen.getByText("Manufacturing")).toBeInTheDocument();
  });

  it("filters the options as the user types", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "heal" } });
    expect(screen.getByText("Healthcare")).toBeInTheDocument();
    expect(screen.queryByText("SaaS")).not.toBeInTheDocument();
  });

  it("commits a selected suggestion with its exact casing", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "fin" } });
    fireEvent.click(screen.getByText("Fintech"));
    // Popover closes; the trigger now reflects the committed value verbatim.
    expect(screen.getByRole("combobox")).toHaveTextContent("Fintech");
  });

  it("offers an Add affordance for a value not in the list and commits the typed text", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "Pharmaceutical Distribution" },
    });
    fireEvent.click(screen.getByText(/Add "Pharmaceutical Distribution"/));
    expect(screen.getByRole("combobox")).toHaveTextContent("Pharmaceutical Distribution");
  });

  it("does not offer an Add affordance when the typed text matches an option (case-insensitively)", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "fintech" } });
    expect(screen.queryByText(/Add "fintech"/)).not.toBeInTheDocument();
  });

  it("renders a custom value (not in the option list) on the trigger", () => {
    render(<Harness initial="Quantum Computing" />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Quantum Computing");
  });

  it("invokes onChange with the selected option", () => {
    const onChange = vi.fn();
    render(
      <CreatableCombobox value="" onChange={onChange} options={OPTIONS} placeholder="Select" />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Healthcare"));
    expect(onChange).toHaveBeenCalledWith("Healthcare");
  });

  it("invokes onChange with the typed custom value (not cmdk's internal sentinel)", () => {
    const onChange = vi.fn();
    render(
      <CreatableCombobox value="" onChange={onChange} options={OPTIONS} placeholder="Select" />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "Pharmaceutical Distribution" },
    });
    fireEvent.click(screen.getByText(/Add "Pharmaceutical Distribution"/));
    expect(onChange).toHaveBeenCalledWith("Pharmaceutical Distribution");
  });

  it("trims surrounding whitespace from a custom value before committing", () => {
    const onChange = vi.fn();
    render(
      <CreatableCombobox value="" onChange={onChange} options={OPTIONS} placeholder="Select" />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "  Logistics  " },
    });
    fireEvent.click(screen.getByText(/Add "Logistics"/));
    expect(onChange).toHaveBeenCalledWith("Logistics");
  });
});
