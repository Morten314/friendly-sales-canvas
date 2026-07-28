import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ICP } from "../../../types";
import IcpList from "../IcpList";

function makeIcp(overrides: Partial<ICP> = {}): ICP {
  return {
    id: "icp-1",
    primaryRegion: "Europe",
    location: ["Berlin"],
    industry: ["SaaS"],
    companySize: ["11–50"],
    buyerRole: ["CTO"],
    accountsOnWatchlist: [],
    accountsToAvoid: [],
    fitConfidence: "high",
    additionalContext: "",
    status: "saved",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function renderList(overrides: Partial<React.ComponentProps<typeof IcpList>> = {}) {
  const props = {
    icps: [] as ICP[],
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    isAddingInline: false,
    onStartAdd: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<IcpList {...props} />) };
}

describe("IcpList", () => {
  it("renders the empty state when there are no ICPs and the wizard is closed", () => {
    const { props } = renderList({ icps: [], isAddingInline: false });
    expect(screen.getByText("No ICPs defined yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add ICP/i }));
    expect(props.onStartAdd).toHaveBeenCalledTimes(1);
  });

  it("does not render the empty state while the wizard is open", () => {
    renderList({ icps: [], isAddingInline: true });
    expect(screen.queryByText("No ICPs defined yet")).not.toBeInTheDocument();
  });

  it("renders a row per ICP", () => {
    const icps = [
      makeIcp({ id: "icp-1", primaryRegion: "Europe" }),
      makeIcp({ id: "icp-2", primaryRegion: "NA" }),
    ];
    renderList({ icps });
    expect(screen.getByText("Europe")).toBeInTheDocument();
    expect(screen.getByText("NA")).toBeInTheDocument();
  });

  it("fires onEdit with the row's ICP when its Edit button is clicked", () => {
    const icp = makeIcp({ id: "icp-9", primaryRegion: "APAC" });
    const { props } = renderList({ icps: [icp] });
    const row = screen.getByText("APAC").closest("tr") as HTMLElement;
    const [editBtn] = within(row).getAllByRole("button");
    fireEvent.click(editBtn);
    expect(props.onEdit).toHaveBeenCalledWith(icp);
  });

  it("fires onDelete with the row's id when its Delete button is clicked", () => {
    const icp = makeIcp({ id: "icp-42", primaryRegion: "LATAM" });
    const { props } = renderList({ icps: [icp] });
    const row = screen.getByText("LATAM").closest("tr") as HTMLElement;
    const buttons = within(row).getAllByRole("button");
    // [edit, delete] order in the actions cell.
    fireEvent.click(buttons[1]);
    expect(props.onDelete).toHaveBeenCalledWith("icp-42");
  });

  it("renders the fit-confidence badge text for each row", () => {
    renderList({ icps: [makeIcp({ fitConfidence: "high" })] });
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders no badge for an out-of-union fit confidence", () => {
    renderList({ icps: [makeIcp({ fitConfidence: "unknown" as ICP["fitConfidence"] })] });
    expect(screen.queryByText("High")).not.toBeInTheDocument();
    expect(screen.queryByText("Medium")).not.toBeInTheDocument();
    expect(screen.queryByText("Low")).not.toBeInTheDocument();
  });
});
