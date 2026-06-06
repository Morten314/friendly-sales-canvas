import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DataSource } from "../../../types";
import ConnectorTable from "../ConnectorTable";

const makeSource = (overrides: Partial<DataSource> = {}): DataSource => ({
  id: "src-1",
  type: "url",
  name: "Example Source",
  url: "https://example.com",
  tags: [],
  status: "active",
  createdAt: new Date("2024-01-01"),
  ...overrides,
});

function renderTable(overrides: Partial<React.ComponentProps<typeof ConnectorTable>> = {}) {
  const props = {
    dataSources: [],
    isAddingInline: false,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<ConnectorTable {...props} />) };
}

describe("ConnectorTable", () => {
  it("renders the column headers", () => {
    renderTable();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders a row for each data source with its name and type label", () => {
    const sources: DataSource[] = [
      makeSource({ id: "src-1", name: "Acme Website", type: "url" }),
      makeSource({ id: "src-2", name: "Q1 Report", type: "file" }),
    ];
    renderTable({ dataSources: sources });

    expect(screen.getByText("Acme Website")).toBeInTheDocument();
    expect(screen.getByText("Q1 Report")).toBeInTheDocument();
    // Type labels
    expect(screen.getByText("URL")).toBeInTheDocument();
    expect(screen.getByText("File")).toBeInTheDocument();
  });

  it("calls onEdit with the correct source when the edit button is clicked", () => {
    const source = makeSource({ id: "src-1", name: "My Source" });
    const { props } = renderTable({ dataSources: [source] });

    // The edit button has an Edit icon (aria role button) — first button in row
    const buttons = screen.getAllByRole("button");
    const editButton = buttons[0];
    fireEvent.click(editButton);

    expect(props.onEdit).toHaveBeenCalledTimes(1);
    expect(props.onEdit).toHaveBeenCalledWith(source);
  });

  it("calls onDelete with the source id when the delete button is clicked", () => {
    const source = makeSource({ id: "src-99", name: "To Delete" });
    const { props } = renderTable({ dataSources: [source] });

    const buttons = screen.getAllByRole("button");
    // Edit button is first, delete button is second
    const deleteButton = buttons[1];
    fireEvent.click(deleteButton);

    expect(props.onDelete).toHaveBeenCalledTimes(1);
    expect(props.onDelete).toHaveBeenCalledWith("src-99");
  });

  it("disables both action buttons when isAddingInline is true", () => {
    const source = makeSource({ id: "src-1" });
    renderTable({ dataSources: [source], isAddingInline: true });

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("renders multiple rows and fires the correct callbacks per row", () => {
    const sources: DataSource[] = [
      makeSource({ id: "src-a", name: "Alpha" }),
      makeSource({ id: "src-b", name: "Beta" }),
    ];
    const { props } = renderTable({ dataSources: sources });

    // 2 sources × 2 buttons = 4 buttons total
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);

    // Click delete on the second row (buttons[3])
    fireEvent.click(buttons[3]);
    expect(props.onDelete).toHaveBeenCalledWith("src-b");
  });

  it("renders the status badge text for an active source", () => {
    const source = makeSource({ status: "active" });
    renderTable({ dataSources: [source] });
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
  });
});
