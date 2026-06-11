import { afterEach, describe, expect, it } from "vitest";

import type { DataSource } from "../../../types";
import {
  getDismissedDataSourceKeys,
  getDismissedLeadStreamFileIds,
  isDataSourceDismissed,
  rememberDismissedDataSource,
  rememberDismissedLeadStreamFile,
} from "../dataSourceDismissals";

const sampleSource = (overrides: Partial<DataSource> = {}): DataSource => ({
  id: "brewra/uuid-1_report.pdf",
  fileId: "uuid-1",
  fileKey: "brewra/uuid-1_report.pdf",
  type: "file",
  name: "report.pdf",
  tags: [],
  status: "completed",
  createdAt: new Date(),
  ...overrides,
});

describe("dataSourceDismissals", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("persists dismissed document keys across reads", () => {
    rememberDismissedDataSource("user-1", sampleSource());
    const dismissed = getDismissedDataSourceKeys("user-1");
    expect(isDataSourceDismissed(sampleSource(), dismissed)).toBe(true);
    expect(
      isDataSourceDismissed(
        sampleSource({
          id: "brewra/other-uuid_other.pdf",
          fileId: "other-uuid",
          fileKey: "brewra/other-uuid_other.pdf",
        }),
        dismissed,
      ),
    ).toBe(false);
  });

  it("persists dismissed lead-stream file ids", () => {
    rememberDismissedLeadStreamFile("user-1", "lead-file-1");
    expect(getDismissedDataSourceKeys("user-1").has("lead-file-1")).toBe(false);
    expect(getDismissedLeadStreamFileIds("user-1").has("lead-file-1")).toBe(true);
  });
});
