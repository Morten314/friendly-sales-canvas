import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RegulatoryFooter } from "../RegulatoryFooter";

const baseProps = {
  isEditing: false,
  isExpanded: false,
  isSplitView: false,
  onSave: vi.fn(),
  onCancelEdit: vi.fn(),
  onEditHistoryOpen: vi.fn(),
  onExportPDF: vi.fn(),
  onSaveToWorkspace: vi.fn(),
  onGenerateShareableLink: vi.fn(),
  onExpandToggle: vi.fn(),
};

describe("RegulatoryFooter", () => {
  describe("editing footer (isEditing=true)", () => {
    it("renders Save Changes, Cancel, and Edit History", () => {
      render(<RegulatoryFooter {...baseProps} isEditing={true} />);
      expect(screen.getByText("Save Changes")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText("Edit History")).toBeInTheDocument();
    });

    it("calls onSave when Save Changes is clicked", () => {
      const onSave = vi.fn();
      render(<RegulatoryFooter {...baseProps} isEditing={true} onSave={onSave} />);
      fireEvent.click(screen.getByText("Save Changes"));
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("calls onCancelEdit when Cancel is clicked", () => {
      const onCancelEdit = vi.fn();
      render(<RegulatoryFooter {...baseProps} isEditing={true} onCancelEdit={onCancelEdit} />);
      fireEvent.click(screen.getByText("Cancel"));
      expect(onCancelEdit).toHaveBeenCalledTimes(1);
    });

    it("calls onEditHistoryOpen when Edit History is clicked", () => {
      const onEditHistoryOpen = vi.fn();
      render(
        <RegulatoryFooter {...baseProps} isEditing={true} onEditHistoryOpen={onEditHistoryOpen} />,
      );
      fireEvent.click(screen.getByText("Edit History"));
      expect(onEditHistoryOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe("read-more footer (isEditing=false, isExpanded=false)", () => {
    it("renders Read More", () => {
      render(<RegulatoryFooter {...baseProps} isEditing={false} isExpanded={false} />);
      expect(screen.getByText("Read More")).toBeInTheDocument();
    });

    it("calls onExpandToggle(true) when Read More is clicked", () => {
      const onExpandToggle = vi.fn();
      render(
        <RegulatoryFooter
          {...baseProps}
          isEditing={false}
          isExpanded={false}
          onExpandToggle={onExpandToggle}
        />,
      );
      fireEvent.click(screen.getByText("Read More"));
      expect(onExpandToggle).toHaveBeenCalledWith(true);
    });
  });

  describe("expanded footer (isEditing=false, isExpanded=true, isSplitView=false)", () => {
    it("renders Export Options and Show Less", () => {
      render(
        <RegulatoryFooter {...baseProps} isEditing={false} isExpanded={true} isSplitView={false} />,
      );
      expect(screen.getByText("Save PDF")).toBeInTheDocument();
      expect(screen.getByText("Save to Workspace")).toBeInTheDocument();
      expect(screen.getByText("Shareable Link")).toBeInTheDocument();
      expect(screen.getByText("Show Less")).toBeInTheDocument();
    });

    it("calls export handlers when their buttons are clicked", () => {
      const onExportPDF = vi.fn();
      const onSaveToWorkspace = vi.fn();
      const onGenerateShareableLink = vi.fn();
      render(
        <RegulatoryFooter
          {...baseProps}
          isEditing={false}
          isExpanded={true}
          isSplitView={false}
          onExportPDF={onExportPDF}
          onSaveToWorkspace={onSaveToWorkspace}
          onGenerateShareableLink={onGenerateShareableLink}
        />,
      );
      fireEvent.click(screen.getByText("Save PDF"));
      fireEvent.click(screen.getByText("Save to Workspace"));
      fireEvent.click(screen.getByText("Shareable Link"));
      expect(onExportPDF).toHaveBeenCalledTimes(1);
      expect(onSaveToWorkspace).toHaveBeenCalledTimes(1);
      expect(onGenerateShareableLink).toHaveBeenCalledTimes(1);
    });

    it("calls onExpandToggle(false) when Show Less is clicked", () => {
      const onExpandToggle = vi.fn();
      render(
        <RegulatoryFooter
          {...baseProps}
          isEditing={false}
          isExpanded={true}
          isSplitView={false}
          onExpandToggle={onExpandToggle}
        />,
      );
      fireEvent.click(screen.getByText("Show Less"));
      expect(onExpandToggle).toHaveBeenCalledWith(false);
    });
  });

  describe("expanded footer in split view (isExpanded=true, isSplitView=true)", () => {
    it("does NOT render Show Less", () => {
      render(
        <RegulatoryFooter {...baseProps} isEditing={false} isExpanded={true} isSplitView={true} />,
      );
      expect(screen.queryByText("Show Less")).not.toBeInTheDocument();
    });
  });
});
