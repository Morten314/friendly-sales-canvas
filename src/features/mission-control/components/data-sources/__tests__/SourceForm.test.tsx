import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import SourceForm from "../SourceForm";

function renderForm(overrides: Partial<React.ComponentProps<typeof SourceForm>> = {}) {
  const props = {
    editingId: null,
    selectedType: "url" as const,
    sourceName: "",
    sourceUrl: "",
    selectedFile: null,
    existingFileName: null,
    selectedTags: [],
    customTag: "",
    sourceDescription: "",
    canSave: true,
    fileInputRef: createRef<HTMLInputElement>(),
    formCardRef: createRef<HTMLDivElement>(),
    onTypeSelect: vi.fn(),
    onNameChange: vi.fn(),
    onUrlChange: vi.fn(),
    onFileChange: vi.fn(),
    onTagToggle: vi.fn(),
    onCustomTagChange: vi.fn(),
    onAddCustomTag: vi.fn(),
    onCustomTagKeyDown: vi.fn(),
    onDescriptionChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<SourceForm {...props} />) };
}

describe("SourceForm", () => {
  it("renders the Add title when not editing", () => {
    renderForm();
    // "Add Data Source" appears in the CardTitle (an h3) and on the save button;
    // scope to the heading to disambiguate.
    expect(screen.getByRole("heading", { name: "Add Data Source" })).toBeInTheDocument();
  });

  it("renders the Edit title when editing", () => {
    renderForm({ editingId: "src-1" });
    expect(screen.getByRole("heading", { name: "Edit Data Source" })).toBeInTheDocument();
  });

  it("shows the URL field when the type is url and fires onUrlChange on input", () => {
    const { props } = renderForm({ selectedType: "url" });
    const urlInput = screen.getByLabelText(/Website URL/i);
    fireEvent.change(urlInput, { target: { value: "https://example.com" } });
    expect(props.onUrlChange).toHaveBeenCalledWith("https://example.com");
  });

  it("fires onTagToggle when a suggested tag is clicked", () => {
    const { props } = renderForm();
    fireEvent.click(screen.getByText("Competitor"));
    expect(props.onTagToggle).toHaveBeenCalledWith("Competitor");
  });

  it("fires onSave when the Add button is clicked", () => {
    const { props } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: /Add Data Source/i }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it("disables the save button when canSave is false", () => {
    renderForm({ canSave: false });
    expect(screen.getByRole("button", { name: /Add Data Source/i })).toBeDisabled();
  });

  it("fires onCancel when the Cancel button is clicked", () => {
    const { props } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });
});
