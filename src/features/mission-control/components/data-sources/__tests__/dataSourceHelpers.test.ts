import { describe, expect, it } from "vitest";

import type { DataSource } from "../../../types";
import {
  encodeFileKeyForStatusUrl,
  extractFileIdFromFileKey,
  getTypeLabel,
  isPendingLocalDataSource,
  isSameDataSourceRow,
  resolveDocumentStatusFileKey,
  shouldMergeFileByFileName,
} from "../dataSourceHelpers";

// ---------------------------------------------------------------------------
// extractFileIdFromFileKey
// ---------------------------------------------------------------------------
describe("extractFileIdFromFileKey", () => {
  const UUID = "550e8400-e29b-41d4-a716-446655440000";

  it("extracts a UUID from the standard {user_id}/{uuid}_{filename} key", () => {
    expect(extractFileIdFromFileKey(`user123/${UUID}_leads.csv`)).toBe(UUID);
  });

  it("extracts a UUID when there is no trailing filename (uuid only after slash)", () => {
    expect(extractFileIdFromFileKey(`user123/${UUID}`)).toBe(UUID);
  });

  it("returns the UUID directly when the whole string is a bare UUID", () => {
    expect(extractFileIdFromFileKey(UUID)).toBe(UUID);
  });

  it("returns the original string when no UUID pattern is found", () => {
    const raw = "not-a-uuid-at-all";
    expect(extractFileIdFromFileKey(raw)).toBe(raw);
  });

  it("returns the original string (falsy passthrough) for an empty key", () => {
    // The guard returns the empty string as-is
    expect(extractFileIdFromFileKey("")).toBe("");
  });

  it("handles a multi-segment path and extracts from the last segment", () => {
    // e.g. org/user/${UUID}_report.xlsx
    expect(extractFileIdFromFileKey(`org/user/${UUID}_report.xlsx`)).toBe(UUID);
  });

  it("is case-insensitive for hexadecimal UUID characters", () => {
    const upperUUID = UUID.toUpperCase();
    expect(extractFileIdFromFileKey(`user/${upperUUID}_data.csv`)).toBe(upperUUID);
  });
});

describe("encodeFileKeyForStatusUrl", () => {
  it("encodes spaces in the filename segment", () => {
    expect(encodeFileKeyForStatusUrl("brewra/uuid_my report.pdf")).toBe(
      "brewra/uuid_my%20report.pdf",
    );
  });
});

describe("isPendingLocalDataSource", () => {
  it("is true only while status is processing", () => {
    const row: DataSource = {
      id: "1",
      type: "file",
      name: "Doc",
      tags: [],
      status: "processing",
      createdAt: new Date(),
    };
    expect(isPendingLocalDataSource(row)).toBe(true);
    expect(isPendingLocalDataSource({ ...row, status: "completed" })).toBe(false);
  });
});

describe("shouldMergeFileByFileName", () => {
  const base = (overrides: Partial<DataSource>): DataSource => ({
    id: "id-1",
    type: "file",
    name: "Doc",
    tags: [],
    status: "processing",
    createdAt: new Date(),
    fileName: "report.pdf",
    fileId: "uuid-1",
    fileKey: "brewra/uuid-1_report.pdf",
    ...overrides,
  });

  it("returns false when re-uploading the same filename with a new fileId", () => {
    const existing = base({
      id: "brewra/old-uuid_report.pdf",
      fileId: "old-uuid",
      fileKey: "brewra/old-uuid_report.pdf",
    });
    const backend = base({
      id: "brewra/new-uuid_report.pdf",
      fileId: "new-uuid",
      fileKey: "brewra/new-uuid_report.pdf",
    });
    expect(shouldMergeFileByFileName(existing, backend)).toBe(false);
  });

  it("returns true when fileId matches", () => {
    const existing = base({});
    const backend = base({ id: "brewra/uuid-1_report.pdf" });
    expect(shouldMergeFileByFileName(existing, backend)).toBe(true);
  });
});

describe("resolveDocumentStatusFileKey", () => {
  it("prefers fileKey over a stale merged id", () => {
    const source: DataSource = {
      id: "stale/old-key",
      fileKey: "brewra/new-uuid_report.pdf",
      type: "file",
      name: "Doc",
      tags: [],
      status: "processing",
      createdAt: new Date(),
    };
    expect(resolveDocumentStatusFileKey(source)).toBe("brewra/new-uuid_report.pdf");
  });
});

describe("isSameDataSourceRow", () => {
  it("matches rows by fileId when ids differ", () => {
    const row: DataSource = {
      id: "stale-id",
      fileId: "uuid-1",
      type: "file",
      name: "Doc",
      tags: [],
      status: "processing",
      createdAt: new Date(),
    };
    const target: DataSource = { ...row, id: "brewra/uuid-1_report.pdf" };
    expect(isSameDataSourceRow(row, target)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTypeLabel
// ---------------------------------------------------------------------------
describe("getTypeLabel", () => {
  it("returns 'URL' for type url", () => {
    expect(getTypeLabel("url")).toBe("URL");
  });

  it("returns 'File' for type file", () => {
    expect(getTypeLabel("file")).toBe("File");
  });

  it("returns 'System' for type system", () => {
    expect(getTypeLabel("system")).toBe("System");
  });
});
