import { describe, expect, it } from "vitest";

import { DataSourceListSchema, LeadStreamStatusSchema } from "../contracts";

describe("mission-control contracts", () => {
  it("LeadStreamStatusSchema accepts the {files} envelope", () => {
    const parsed = LeadStreamStatusSchema.parse({
      files: [{ file_id: "f1", filename: "leads.csv", total_rows: 10 }],
    });
    expect(Array.isArray(parsed) ? parsed : parsed.files).toHaveLength(1);
  });

  it("LeadStreamStatusSchema accepts a bare array", () => {
    const parsed = LeadStreamStatusSchema.parse([{ file_id: "f1", filename: "a.csv" }]);
    expect(parsed).toHaveLength(1);
  });

  it("DataSourceListSchema accepts a bare array and the documents envelope", () => {
    expect(DataSourceListSchema.parse([{ file_id: "d1" }])).toHaveLength(1);
    const env = DataSourceListSchema.parse({ documents: [{ file_id: "d1" }] });
    expect(Array.isArray(env) ? env : env.documents).toHaveLength(1);
  });
});
