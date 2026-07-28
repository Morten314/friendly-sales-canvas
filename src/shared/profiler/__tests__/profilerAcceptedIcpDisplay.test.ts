import { describe, expect, it } from "vitest";

import {
  buildCustomerProfileSavePayload,
  extractPersistedIcpIdFromSuggestedProfileResponse,
  resolveAcceptedPersistedIcpId,
} from "../profilerAcceptedIcpDisplay";

describe("extractPersistedIcpIdFromSuggestedProfileResponse", () => {
  it("reads the persisted id from the real success shape { data: { icp: { id } } }", () => {
    const res = { success: true, data: { icp: { id: "cp-123", primary_region: "global" } } };
    expect(extractPersistedIcpIdFromSuggestedProfileResponse(res)).toBe("cp-123");
  });

  it("still honors the flatter aliases (data.icp_id)", () => {
    expect(extractPersistedIcpIdFromSuggestedProfileResponse({ data: { icp_id: "cp-9" } })).toBe(
      "cp-9",
    );
  });

  it("returns undefined when no id can be found", () => {
    expect(extractPersistedIcpIdFromSuggestedProfileResponse({ data: {} })).toBeUndefined();
  });
});

describe("buildCustomerProfileSavePayload provenance preservation", () => {
  it("preserves source_suggested_icp_id so the backend dedup guard survives the round-trip", () => {
    const payload = buildCustomerProfileSavePayload(
      [{ id: "cp-1", source_suggested_icp_id: "sugg-1", source_user_id: "u1" }],
      "org1",
    );
    expect(payload.icps[0]).toMatchObject({
      id: "cp-1",
      source_suggested_icp_id: "sugg-1",
      source_user_id: "u1",
    });
  });

  it("omits provenance fields for manually-added rows that never had them", () => {
    const payload = buildCustomerProfileSavePayload([{ id: "cp-2" }], "org1");
    expect("source_suggested_icp_id" in payload.icps[0]).toBe(false);
  });
});

describe("resolveAcceptedPersistedIcpId", () => {
  it("prefers the server-authoritative response id", () => {
    expect(resolveAcceptedPersistedIcpId("cp-x", new Set(["a"]), ["a", "cp-x"], "sugg")).toBe(
      "cp-x",
    );
  });

  it("recovers the single new id via the before/after diff", () => {
    expect(resolveAcceptedPersistedIcpId(undefined, new Set(["a"]), ["a", "cp-new"], "sugg")).toBe(
      "cp-new",
    );
  });

  it("returns undefined (does NOT guess) when the diff is ambiguous, to avoid corrupting another ICP", () => {
    // idsBefore was stale/mock ("existing-1"), so two unrelated ids look "new".
    expect(
      resolveAcceptedPersistedIcpId(
        undefined,
        new Set(["existing-1"]),
        ["real-a", "real-b"],
        "sugg",
      ),
    ).toBeUndefined();
  });
});
