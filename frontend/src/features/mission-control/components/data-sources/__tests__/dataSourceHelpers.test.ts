import { describe, expect, it } from "vitest";

import { extractFileIdFromFileKey, getTypeLabel } from "../dataSourceHelpers";

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
