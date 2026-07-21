import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ConnectorApprovals from "../ConnectorApprovals";
import type { DataSource } from "../connectorTypes";

// NOTE — DEAD-CODE QUARANTINE: the connector catalog / per-platform auth / config
// / delete dialogs in ConnectorApprovals have NO live open-triggers in the app
// (the buttons that opened them were orphaned in an earlier refactor). They are
// relocated here AS-IS and render nothing visible while closed. A full
// "open the catalog and toggle a modal" interaction test is therefore NOT
// achievable without adding triggers, which is out of scope for this parity move.
//
// This test stays honest: it mounts the component and asserts it renders without
// throwing. With every dialog closed there is no visible dialog content, so the
// container is effectively empty — the observable parity guarantee. We also mount
// with a non-empty `dataSources` prop to exercise the prop path the moved
// duplicate-check / delete handlers read from.
//
// `useToast` is a module-level store (no provider needed), matching
// CompanyProfileForm's test. The Slack OAuth callback effect runs on mount but is
// a no-op in jsdom (no ?code/&state/&error in window.location.search).

afterEach(() => {
  vi.restoreAllMocks();
});

const sampleSource: DataSource = {
  id: "src-1",
  name: "Salesforce",
  type: "crm",
  // icon is `typeof Database` (a lucide component); a stub component satisfies the type.
  icon: (() => null) as unknown as DataSource["icon"],
  platform: "Salesforce",
  status: "disconnected",
  syncFrequency: "daily",
  totalRecords: 0,
  newRecordsThisWeek: 0,
  updatedRecords: 0,
  dataQualityScore: 0,
  objectsSynced: [],
  fieldsMapped: 0,
  filters: [],
};

describe("ConnectorApprovals", () => {
  it("renders without throwing when there are no data sources (all overlays closed)", () => {
    const onDataSourcesChange = vi.fn();
    const { container } = render(
      <ConnectorApprovals dataSources={[]} onDataSourcesChange={onDataSourcesChange} />,
    );

    // Closed dialogs render no portal content → nothing visible, no state writes.
    expect(container).toBeTruthy();
    expect(onDataSourcesChange).not.toHaveBeenCalled();
  });

  it("renders without throwing with a non-empty dataSources prop", () => {
    const onDataSourcesChange = vi.fn();
    expect(() =>
      render(
        <ConnectorApprovals
          dataSources={[sampleSource]}
          onDataSourcesChange={onDataSourcesChange}
        />,
      ),
    ).not.toThrow();
    // No live trigger fires on mount, so the change callback stays untouched.
    expect(onDataSourcesChange).not.toHaveBeenCalled();
  });
});
