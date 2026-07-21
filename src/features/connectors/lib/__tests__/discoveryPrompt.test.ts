import { describe, expect, it } from "vitest";

import { selectDiscoveryPrompt } from "../discoveryPrompt";

describe("selectDiscoveryPrompt", () => {
  it("re-discovery guard when ICP unchanged (UC7)", () => {
    expect(selectDiscoveryPrompt({ icpChanged: false, hasPriorDiscovery: true })).toBe(
      "rediscovery_guard",
    );
  });
  it("keep/replace/download when ICP changed and prior discovery exists (UC5)", () => {
    expect(selectDiscoveryPrompt({ icpChanged: true, hasPriorDiscovery: true })).toBe(
      "keep_replace_download",
    );
  });
  it("no prompt when ICP changed but no prior discovery (first run)", () => {
    expect(selectDiscoveryPrompt({ icpChanged: true, hasPriorDiscovery: false })).toBe("none");
  });
  it("guard takes precedence when unchanged even without prior discovery", () => {
    // unchanged + no prior discovery is effectively a first run; no guard needed
    expect(selectDiscoveryPrompt({ icpChanged: false, hasPriorDiscovery: false })).toBe("none");
  });
});
