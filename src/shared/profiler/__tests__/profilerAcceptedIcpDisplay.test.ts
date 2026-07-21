import { describe, expect, it } from "vitest";

import { extractPersistedIcpIdFromSuggestedProfileResponse } from "../profilerAcceptedIcpDisplay";

describe("extractPersistedIcpIdFromSuggestedProfileResponse", () => {
  it("reads persisted id from data.icp.id (POST from_suggested_icp shape)", () => {
    expect(
      extractPersistedIcpIdFromSuggestedProfileResponse({
        success: true,
        data: {
          icp: {
            id: "profile-icp-uuid",
            primary_region: "US",
          },
        },
      }),
    ).toBe("profile-icp-uuid");
  });

  it("falls back to flat data.id when present", () => {
    expect(
      extractPersistedIcpIdFromSuggestedProfileResponse({
        success: true,
        data: { id: "flat-id" },
      }),
    ).toBe("flat-id");
  });
});
