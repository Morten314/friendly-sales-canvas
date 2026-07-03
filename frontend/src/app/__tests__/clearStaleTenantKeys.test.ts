import { beforeEach, describe, expect, it } from "vitest";

import { clearStaleTenantKeys } from "../clearStaleTenantKeys";

describe("clearStaleTenantKeys", () => {
  beforeEach(() => localStorage.clear());

  it("removes selectedTenant_* keys and retains org_* keys", () => {
    localStorage.setItem("selectedTenant_u1", '{"id":"brewra"}');
    localStorage.setItem("selectedTenant_u2", '{"id":"x"}');
    localStorage.setItem("org_id_u1", "b75ce29e");
    localStorage.setItem("org_name_u1", "Brewra AI");
    clearStaleTenantKeys();
    expect(localStorage.getItem("selectedTenant_u1")).toBeNull();
    expect(localStorage.getItem("selectedTenant_u2")).toBeNull();
    expect(localStorage.getItem("org_id_u1")).toBe("b75ce29e");
    expect(localStorage.getItem("org_name_u1")).toBe("Brewra AI");
  });

  it("is idempotent (no throw when nothing matches)", () => {
    expect(() => clearStaleTenantKeys()).not.toThrow();
  });
});
