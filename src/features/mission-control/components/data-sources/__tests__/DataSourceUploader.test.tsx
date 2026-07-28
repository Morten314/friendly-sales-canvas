import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import DataSourceUploader from "../DataSourceUploader";

function renderUploader(overrides: Partial<React.ComponentProps<typeof DataSourceUploader>> = {}) {
  const props = {
    selectedLeadFile: null,
    isDraggingLead: false,
    isUploadingLeads: false,
    leadFileInputRef: createRef<HTMLInputElement>(),
    onClose: vi.fn(),
    onDragOver: vi.fn(),
    onDragLeave: vi.fn(),
    onDrop: vi.fn(),
    onFileInputChange: vi.fn(),
    onUpload: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<DataSourceUploader {...props} />) };
}

describe("DataSourceUploader", () => {
  it("renders the dropzone and labels", () => {
    renderUploader();
    // "Add leads" is the card heading (it also appears on the upload button).
    expect(screen.getByRole("heading", { name: "Add leads" })).toBeInTheDocument();
    expect(
      screen.getByText("Click to browse or drag and drop a CSV, XLSX, or XLS file here"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Lead file/i)).toBeInTheDocument();
  });

  it("shows the selected file name when a file is selected", () => {
    const file = new File(["a,b\n1,2"], "leads.csv", { type: "text/csv" });
    renderUploader({ selectedLeadFile: file });
    expect(screen.getByText("leads.csv")).toBeInTheDocument();
  });

  it("fires onFileInputChange when the file input changes", () => {
    const { props } = renderUploader();
    const input = screen.getByLabelText(/Lead file/i);
    const file = new File(["a,b\n1,2"], "leads.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(props.onFileInputChange).toHaveBeenCalledTimes(1);
  });

  it("fires onUpload when the Add-leads button is clicked", () => {
    const file = new File(["a,b\n1,2"], "leads.csv", { type: "text/csv" });
    const { props } = renderUploader({ selectedLeadFile: file });
    fireEvent.click(screen.getByRole("button", { name: /Add leads/i }));
    expect(props.onUpload).toHaveBeenCalledTimes(1);
  });

  it("disables the upload button when no file is selected", () => {
    renderUploader({ selectedLeadFile: null });
    expect(screen.getByRole("button", { name: /Add leads/i })).toBeDisabled();
  });

  it("fires onClose from both the X and Cancel buttons", () => {
    const { props } = renderUploader();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
