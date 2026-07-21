import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LeadStreamFileApiRow } from "../../../types";
import LeadStreamTable from "../LeadStreamTable";

const rows: LeadStreamFileApiRow[] = [
  {
    file_id: "file-1",
    filename: "leads-q1.csv",
    total_rows: 100,
    created_count: 100,
    processing_status: "completed",
  },
  {
    file_id: "file-2",
    filename: "leads-q2.csv",
    total_rows: 50,
    created_count: 40,
    error_count: 2,
    processing_status: "processing",
  },
];

describe("LeadStreamTable", () => {
  it("renders nothing when there are no files", () => {
    const { container } = render(
      <LeadStreamTable
        files={[]}
        deletingFileId={null}
        showLeadUpload={false}
        onDeleteFile={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a row per file with its filename", () => {
    render(
      <LeadStreamTable
        files={rows}
        deletingFileId={null}
        showLeadUpload={false}
        onDeleteFile={vi.fn()}
      />,
    );

    expect(screen.getByText("leads-q1.csv")).toBeInTheDocument();
    expect(screen.getByText("leads-q2.csv")).toBeInTheDocument();
  });

  it("calls onDeleteFile with the row's file_id when its delete button is clicked", () => {
    const onDeleteFile = vi.fn();
    render(
      <LeadStreamTable
        files={rows}
        deletingFileId={null}
        showLeadUpload={false}
        onDeleteFile={onDeleteFile}
      />,
    );

    // Each row's only button is the delete button.
    const deleteButtons = screen.getAllByRole("button");
    expect(deleteButtons).toHaveLength(rows.length);

    fireEvent.click(deleteButtons[1]);
    expect(onDeleteFile).toHaveBeenCalledTimes(1);
    expect(onDeleteFile).toHaveBeenCalledWith("file-2");
  });

  it("disables delete buttons while a delete is in flight", () => {
    render(
      <LeadStreamTable
        files={rows}
        deletingFileId="file-1"
        showLeadUpload={false}
        onDeleteFile={vi.fn()}
      />,
    );

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});
