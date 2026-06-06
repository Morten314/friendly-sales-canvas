import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AddDataSourceMenu from "../AddDataSourceMenu";

// Radix DropdownMenu responds to Space/Enter on the trigger button (onKeyDown).
// pointerDown requires PointerEvent which is not available in this jsdom version.
function openMenu() {
  const trigger = screen.getByRole("button", { name: /Add Data Source/i });
  fireEvent.keyDown(trigger, { key: " ", code: "Space" });
}

// Open the sub-menu (DropdownMenuSubTrigger) using the same keyboard approach.
function openSubMenu() {
  const subTrigger = screen.getByText("Connect to Systems");
  // Click works on DropdownMenuSubTrigger items (they are rendered as div/span in the
  // menu content; Radix wires onClick to open the sub-content).
  fireEvent.click(subTrigger);
}

function renderMenu(overrides: Partial<React.ComponentProps<typeof AddDataSourceMenu>> = {}) {
  const props = {
    onAddUrl: vi.fn(),
    onAddFile: vi.fn(),
    onConnectCRM: vi.fn(),
    onShowLeadUpload: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<AddDataSourceMenu {...props} />) };
}

describe("AddDataSourceMenu", () => {
  it("renders the trigger button", () => {
    renderMenu();
    expect(screen.getByRole("button", { name: /Add Data Source/i })).toBeInTheDocument();
  });

  it("opens the menu and shows Add URL and Upload File items", () => {
    renderMenu();
    openMenu();
    expect(screen.getByText("Add URL")).toBeInTheDocument();
    expect(screen.getByText("Upload File")).toBeInTheDocument();
  });

  it("shows Connect to Systems sub-trigger after menu opens", () => {
    renderMenu();
    openMenu();
    expect(screen.getByText("Connect to Systems")).toBeInTheDocument();
  });

  it("calls onAddUrl when the Add URL item is clicked", () => {
    const { props } = renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Add URL"));
    expect(props.onAddUrl).toHaveBeenCalledTimes(1);
  });

  it("calls onAddFile when the Upload File item is clicked", () => {
    const { props } = renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Upload File"));
    expect(props.onAddFile).toHaveBeenCalledTimes(1);
  });

  it("opens the sub-menu and shows CRM options and Lead stream", () => {
    renderMenu();
    openMenu();
    openSubMenu();
    expect(screen.getByText("Salesforce")).toBeInTheDocument();
    expect(screen.getByText("HubSpot")).toBeInTheDocument();
    expect(screen.getByText("Pipedrive")).toBeInTheDocument();
    expect(screen.getByText("Lead stream")).toBeInTheDocument();
  });

  it("calls onConnectCRM('Salesforce') when Salesforce is clicked", () => {
    const { props } = renderMenu();
    openMenu();
    openSubMenu();
    fireEvent.click(screen.getByText("Salesforce"));
    expect(props.onConnectCRM).toHaveBeenCalledWith("Salesforce");
  });

  it("calls onConnectCRM('HubSpot') when HubSpot is clicked", () => {
    const { props } = renderMenu();
    openMenu();
    openSubMenu();
    fireEvent.click(screen.getByText("HubSpot"));
    expect(props.onConnectCRM).toHaveBeenCalledWith("HubSpot");
  });

  it("calls onShowLeadUpload when Lead stream is clicked", () => {
    const { props } = renderMenu();
    openMenu();
    openSubMenu();
    fireEvent.click(screen.getByText("Lead stream"));
    expect(props.onShowLeadUpload).toHaveBeenCalledTimes(1);
  });
});
