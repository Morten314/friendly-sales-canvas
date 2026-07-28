import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LeadStreamFileApiRow } from "../../../types";
import DataSourcesManager from "../DataSourcesManager";

// Mock auth so the container resolves a userId/orgId (the reads are enabled and
// the lead-stream sync effect runs).
vi.mock("@/shared/auth", () => ({
  useAuthToken: () => ({ currentUser: { uid: "u1" }, orgId: "brewra" }),
}));

// Stub the read hooks: the container maps their `.data` into local state via
// sync-effects. We drive those effects from here without any network.
const leadRows: LeadStreamFileApiRow[] = [
  {
    file_id: "lead-1",
    filename: "leads.csv",
    total_rows: 10,
    created_count: 10,
    processing_status: "completed",
  },
];

// Stable references so the container's sync-effects (which depend on `.data`)
// do not re-run every render — a fresh `[]`/fn identity each render would loop.
const EMPTY_DOCS: unknown[] = [];
const docsRefetch = vi.fn().mockResolvedValue({ data: EMPTY_DOCS });
const leadRefetch = vi.fn().mockResolvedValue({ data: leadRows });

vi.mock("../../../hooks/useDataSources", () => ({
  useDataSources: () => ({
    data: EMPTY_DOCS,
    isFetching: false,
    refetch: docsRefetch,
  }),
}));

vi.mock("../../../hooks/useLeadStreamStatus", () => ({
  useLeadStreamStatus: () => ({
    data: leadRows,
    isFetching: false,
    refetch: leadRefetch,
  }),
}));

// Mock the three extracted children so we can assert the container wires them in
// for the right state, without depending on their internal DOM.
vi.mock("../LeadStreamTable", () => ({
  default: (props: { files: LeadStreamFileApiRow[] }) => (
    <div data-testid="lead-stream-table">{`rows:${props.files.length}`}</div>
  ),
}));

vi.mock("../DataSourceUploader", () => ({
  default: () => <div data-testid="data-source-uploader" />,
}));

vi.mock("../SourceForm", () => ({
  default: (props: { selectedType: string }) => (
    <div data-testid="source-form">{`type:${props.selectedType}`}</div>
  ),
}));

// Stub the Apollo tile: its internals/hooks (incl. useAuth) are covered by its own
// tests; this container test only needs it to render without firing those.
vi.mock("@/features/connectors", () => ({
  ApolloTile: () => <div data-testid="apollo-tile" />,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("DataSourcesManager (container)", () => {
  it("renders LeadStreamTable with the synced lead-stream rows", async () => {
    render(<DataSourcesManager />);
    const table = await screen.findByTestId("lead-stream-table");
    expect(table).toHaveTextContent("rows:1");
  });

  it("gates SourceForm and DataSourceUploader off in the default (non-adding) state", async () => {
    render(<DataSourcesManager />);
    // The lead-stream table is present (rows exist), but the add/edit form and the
    // lead-upload card are conditionally rendered and start closed.
    await screen.findByTestId("lead-stream-table");
    expect(screen.queryByTestId("source-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("data-source-uploader")).not.toBeInTheDocument();
  });

  it("exposes the Add Data Source trigger when there is content", async () => {
    render(<DataSourcesManager />);
    await screen.findByTestId("lead-stream-table");
    // The header trigger is shown because lead-stream rows exist (the gating
    // condition the container computes).
    expect(screen.getByRole("button", { name: /Add Data Source/i })).toBeInTheDocument();
  });

  it("renders the Lead Stream section heading alongside the table", async () => {
    render(<DataSourcesManager />);
    const heading = await screen.findByRole("heading", { name: /Lead Stream/i });
    // The section wraps both the heading and the (mocked) table.
    const section = heading.closest("div")?.parentElement as HTMLElement;
    expect(within(section).getByTestId("lead-stream-table")).toBeInTheDocument();
  });
});
