import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExportOptions } from "./ExportOptions";

describe("ExportOptions", () => {
  const defaultProps = {
    onExportPDF: vi.fn(),
    onSaveToWorkspace: vi.fn(),
    onGenerateShareableLink: vi.fn(),
  };

  it("renders the three export buttons", () => {
    render(<ExportOptions {...defaultProps} />);
    expect(screen.getByRole("button", { name: /save pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save to workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /shareable link/i })).toBeInTheDocument();
  });

  it("fires onExportPDF when Save PDF is clicked", () => {
    const onExportPDF = vi.fn();
    render(<ExportOptions {...defaultProps} onExportPDF={onExportPDF} />);
    fireEvent.click(screen.getByRole("button", { name: /save pdf/i }));
    expect(onExportPDF).toHaveBeenCalledOnce();
  });

  it("fires onSaveToWorkspace when Save to Workspace is clicked", () => {
    const onSaveToWorkspace = vi.fn();
    render(<ExportOptions {...defaultProps} onSaveToWorkspace={onSaveToWorkspace} />);
    fireEvent.click(screen.getByRole("button", { name: /save to workspace/i }));
    expect(onSaveToWorkspace).toHaveBeenCalledOnce();
  });

  it("fires onGenerateShareableLink when Shareable Link is clicked", () => {
    const onGenerateShareableLink = vi.fn();
    render(<ExportOptions {...defaultProps} onGenerateShareableLink={onGenerateShareableLink} />);
    fireEvent.click(screen.getByRole("button", { name: /shareable link/i }));
    expect(onGenerateShareableLink).toHaveBeenCalledOnce();
  });
});
