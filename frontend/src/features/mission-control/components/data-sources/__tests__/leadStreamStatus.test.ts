import { describe, expect, it } from "vitest";

import {
  mapDocumentListStatus,
  mapProcessingStatusToSourceStatus,
  parseDocumentStatusResponse,
} from "../leadStreamStatus";

describe("mapProcessingStatusToSourceStatus", () => {
  it("maps backend terminal states to completed", () => {
    expect(mapProcessingStatusToSourceStatus("completed")).toBe("completed");
    expect(mapProcessingStatusToSourceStatus("success")).toBe("completed");
  });

  it("maps failure states to failed", () => {
    expect(mapProcessingStatusToSourceStatus("failed")).toBe("failed");
    expect(mapProcessingStatusToSourceStatus("error")).toBe("failed");
  });

  it("maps active and unknown states", () => {
    expect(mapProcessingStatusToSourceStatus("active")).toBe("active");
    expect(mapProcessingStatusToSourceStatus("unknown")).toBe("processing");
    expect(mapProcessingStatusToSourceStatus("processing")).toBe("processing");
  });
});

describe("parseDocumentStatusResponse", () => {
  it("reads nested data.status, not the API envelope status", () => {
    expect(
      parseDocumentStatusResponse({
        status: "success",
        data: { status: "processing", chunks_count: 3 },
      }),
    ).toEqual({ status: "processing", chunks_count: 3, timestamps: undefined });
  });

  it("maps completed nested status", () => {
    expect(
      parseDocumentStatusResponse({
        status: "success",
        data: { status: "completed" },
      }).status,
    ).toBe("completed");
  });

  it("maps failed nested status", () => {
    expect(
      parseDocumentStatusResponse({
        status: "success",
        data: { status: "failed" },
      }).status,
    ).toBe("failed");
  });

  it("defaults to processing when only the envelope is present", () => {
    expect(parseDocumentStatusResponse({ status: "success" }).status).toBe("processing");
  });
});

describe("mapDocumentListStatus", () => {
  it("maps file rows via processing status", () => {
    expect(mapDocumentListStatus({ status: "failed" }, "file")).toBe("failed");
    expect(mapDocumentListStatus({ status: "unknown" }, "file")).toBe("processing");
  });

  it("maps completed URL rows to active for the connector table", () => {
    expect(mapDocumentListStatus({ status: "completed", data_source_type: "url" }, "url")).toBe(
      "active",
    );
  });
});
