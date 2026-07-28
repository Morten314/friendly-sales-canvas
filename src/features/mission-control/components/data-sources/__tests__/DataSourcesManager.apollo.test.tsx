import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the connectors barrel — sentinel only; this test is about wiring, not tile internals.
vi.mock("@/features/connectors", () => ({
  ApolloTile: () => <div data-testid="apollo-tile-mounted" />,
}));

// Mirror the exact mock setup from DataSourcesManager.test.tsx so the component
// renders headless without network or auth.
vi.mock("@/shared/auth", () => ({
  useAuthToken: () => ({ currentUser: { uid: "u1" }, orgId: "brewra" }),
}));

// Stable references so the container's sync-effects (which depend on `.data`
// identity) do not re-run every render — a fresh `[]` each render would loop.
const EMPTY_DOCS: unknown[] = [];
const EMPTY_LEADS: unknown[] = [];
const docsRefetch = vi.fn().mockResolvedValue({ data: EMPTY_DOCS });
const leadRefetch = vi.fn().mockResolvedValue({ data: EMPTY_LEADS });

vi.mock("../../../hooks/useDataSources", () => ({
  useDataSources: () => ({
    data: EMPTY_DOCS,
    isFetching: false,
    refetch: docsRefetch,
  }),
}));

vi.mock("../../../hooks/useLeadStreamStatus", () => ({
  useLeadStreamStatus: () => ({
    data: EMPTY_LEADS,
    isFetching: false,
    refetch: leadRefetch,
  }),
}));

vi.mock("../LeadStreamTable", () => ({
  default: () => <div data-testid="lead-stream-table" />,
}));

vi.mock("../DataSourceUploader", () => ({
  default: () => <div data-testid="data-source-uploader" />,
}));

vi.mock("../SourceForm", () => ({
  default: () => <div data-testid="source-form" />,
}));

import DataSourcesManager from "../DataSourcesManager";

afterEach(() => {
  vi.clearAllMocks();
});

describe("DataSourcesManager — Apollo tile", () => {
  it("mounts the Apollo tile", () => {
    render(<DataSourcesManager />);
    expect(screen.getByTestId("apollo-tile-mounted")).toBeInTheDocument();
  });
});
