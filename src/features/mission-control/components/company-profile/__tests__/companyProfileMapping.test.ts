import { describe, expect, it } from "vitest";

import { mapApiDataToCompanyProfileFields } from "../companyProfileMapping";

describe("mapApiDataToCompanyProfileFields", () => {
  it("maps an org profile even when data.user_id differs from the caller (org-owned)", () => {
    const result = mapApiDataToCompanyProfileFields(
      { company_name: "Acme", user_id: "someone-else" },
      "current-user",
    );
    expect(result?.companyName).toBe("Acme");
  });

  it("still returns null for an empty payload", () => {
    expect(mapApiDataToCompanyProfileFields({}, "u1")).toBeNull();
  });
});
