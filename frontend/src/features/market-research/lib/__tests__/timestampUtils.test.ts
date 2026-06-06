// Spec 15 §3.3 — characterization for src/lib/timestampUtils.ts.
// Covers all 4 exported functions on representative inputs and edge cases.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentUTCTimestamp,
  isTimestampNewer,
  logTimestampComparison,
  toUTCTimestamp,
} from "../timestampUtils";

describe("toUTCTimestamp", () => {
  it("returns null for null/undefined/0/empty-string inputs", () => {
    expect(toUTCTimestamp(null)).toBeNull();
    expect(toUTCTimestamp(undefined)).toBeNull();
    expect(toUTCTimestamp(0)).toBeNull(); // falsy guard at line 10
    expect(toUTCTimestamp("")).toBeNull();
  });

  it("passes through fully-qualified ISO strings (Z suffix)", () => {
    expect(toUTCTimestamp("2026-05-08T10:00:00.000Z")).toBe("2026-05-08T10:00:00.000Z");
  });

  it("appends Z to naked ISO strings (no timezone marker)", () => {
    // "2026-05-08T10:00:00" → treated as UTC via the appended 'Z' branch
    expect(toUTCTimestamp("2026-05-08T10:00:00")).toBe("2026-05-08T10:00:00.000Z");
  });

  it("respects explicit timezone offsets (does not append Z)", () => {
    // +00:00 is explicit — should NOT be re-interpreted as naked UTC
    expect(toUTCTimestamp("2026-05-08T10:00:00+00:00")).toBe("2026-05-08T10:00:00.000Z");
    // -05:00 → converted to UTC by Date
    expect(toUTCTimestamp("2026-05-08T10:00:00-05:00")).toBe("2026-05-08T15:00:00.000Z");
  });

  it("converts Unix epoch millisecond numbers", () => {
    // Epoch boundary: 0 is falsy (returns null per the guard). 1 ms after epoch.
    expect(toUTCTimestamp(1)).toBe("1970-01-01T00:00:00.001Z");
    expect(toUTCTimestamp(1715169600000)).toBe("2024-05-08T12:00:00.000Z");
  });

  it("handles Date object inputs", () => {
    const d = new Date("2026-05-08T10:00:00.000Z");
    expect(toUTCTimestamp(d)).toBe("2026-05-08T10:00:00.000Z");
  });

  it("returns null and warns on invalid timestamp string", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(toUTCTimestamp("not-a-date")).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith("Invalid timestamp provided:", "not-a-date");
    warnSpy.mockRestore();
  });

  it("survives a DST-adjacent input as a Date (no timezone confusion)", () => {
    // US DST 2024 transition was 2024-03-10T02:00 local — passing a UTC ISO
    // around that date should not shift the wall-clock UTC.
    expect(toUTCTimestamp("2024-03-10T07:00:00.000Z")).toBe("2024-03-10T07:00:00.000Z");
  });
});

describe("isTimestampNewer", () => {
  it("returns true when first is strictly newer", () => {
    expect(isTimestampNewer("2026-05-08T11:00:00Z", "2026-05-08T10:00:00Z")).toBe(true);
  });

  it("returns false when timestamps are equal", () => {
    expect(isTimestampNewer("2026-05-08T10:00:00Z", "2026-05-08T10:00:00Z")).toBe(false);
  });

  it("returns false when first is older", () => {
    expect(isTimestampNewer("2026-05-08T09:00:00Z", "2026-05-08T10:00:00Z")).toBe(false);
  });

  it("returns false when either input is invalid (null/undefined/garbage)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(isTimestampNewer(null, "2026-05-08T10:00:00Z")).toBe(false);
    expect(isTimestampNewer("2026-05-08T10:00:00Z", undefined)).toBe(false);
    expect(isTimestampNewer("garbage", "2026-05-08T10:00:00Z")).toBe(false);
    warnSpy.mockRestore();
  });

  it("compares Unix ms numbers correctly", () => {
    expect(isTimestampNewer(2000, 1000)).toBe(true);
    expect(isTimestampNewer(1000, 2000)).toBe(false);
  });
});

describe("getCurrentUTCTimestamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current time as ISO-Z string", () => {
    expect(getCurrentUTCTimestamp()).toBe("2026-05-08T10:00:00.000Z");
  });

  it("format is ISO 8601 with millisecond + Z suffix", () => {
    vi.setSystemTime(new Date("2026-12-31T23:59:59.999Z"));
    expect(getCurrentUTCTimestamp()).toBe("2026-12-31T23:59:59.999Z");
  });
});

describe("logTimestampComparison", () => {
  it("is a no-op (does not throw, returns undefined)", () => {
    // The function is kept for API compatibility per the source comment at
    // src/lib/timestampUtils.ts:60-68. It must not throw and must not emit
    // any console output (no warn/log/error spies fire).
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      logTimestampComparison("2026-05-08T10:00:00Z", "2026-05-08T11:00:00Z", "TestComponent"),
    ).toBeUndefined();
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });
});
