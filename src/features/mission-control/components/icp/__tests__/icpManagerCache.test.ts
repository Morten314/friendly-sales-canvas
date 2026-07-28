import { afterEach, describe, expect, it } from "vitest";

import { clearCustomerProfileCaches } from "../ICPManager";

import { getOrgCacheKey } from "@/shared/lib/cacheUtils";

afterEach(() => localStorage.clear());

describe("clearCustomerProfileCaches (zero-ICP save path)", () => {
  it("removes the org customerProfile + pending resilience caches", () => {
    localStorage.setItem(getOrgCacheKey("customerProfile", "org1"), JSON.stringify([{ id: "x" }]));
    localStorage.setItem(
      getOrgCacheKey("customerProfile_pending", "org1"),
      JSON.stringify({ a: 1 }),
    );

    clearCustomerProfileCaches("org1");

    expect(localStorage.getItem(getOrgCacheKey("customerProfile", "org1"))).toBeNull();
    expect(localStorage.getItem(getOrgCacheKey("customerProfile_pending", "org1"))).toBeNull();
  });
});
