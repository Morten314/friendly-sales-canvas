import { afterEach, describe, expect, it } from "vitest";

import {
  upsertPendingRecommendedReject,
  readPendingRecommendedRejects,
  removePendingRecommendedReject,
  recordDismissedRecommendedIcp,
  readDismissedRecommendedIds,
  filterDismissedFromSuggested,
  isRecommendedDeleteNotFound,
} from "../suggestedIcpStorage";

afterEach(() => localStorage.clear());

describe("pending recommended rejects", () => {
  it("upserts and reads back by icp_id", () => {
    upsertPendingRecommendedReject("icp1", "u1", 123, { id: "icp1" });
    const items = readPendingRecommendedRejects();
    expect(items).toHaveLength(1);
    expect(items[0].icp_id).toBe("icp1");
  });
  it("upsert replaces a same-id entry (no duplicates)", () => {
    upsertPendingRecommendedReject("icp1", "u1", 1, { id: "icp1" });
    upsertPendingRecommendedReject("icp1", "u1", 2, { id: "icp1" });
    expect(readPendingRecommendedRejects()).toHaveLength(1);
  });
  it("removes by icp_id", () => {
    upsertPendingRecommendedReject("icp1", "u1", 1, {});
    removePendingRecommendedReject("icp1");
    expect(readPendingRecommendedRejects()).toHaveLength(0);
  });
});

describe("dismissed recommended ids", () => {
  it("records per-user and filters suggestions", () => {
    recordDismissedRecommendedIcp("u1", "icpX");
    expect(readDismissedRecommendedIds("u1").has("icpX")).toBe(true);
    const { newSuggestions } = filterDismissedFromSuggested(
      "u1",
      [],
      [{ id: "icpX" }, { id: "icpY" }],
    );
    expect(newSuggestions.map((s) => s.id)).toEqual(["icpY"]);
  });
});

describe("isRecommendedDeleteNotFound", () => {
  it("treats 404 / not found as already-gone", () => {
    expect(isRecommendedDeleteNotFound(new Error("HTTP error! status: 404"))).toBe(true);
    expect(isRecommendedDeleteNotFound(new Error("Not Found"))).toBe(true);
    expect(isRecommendedDeleteNotFound(new Error("500"))).toBe(false);
  });
});
