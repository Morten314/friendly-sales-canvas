import { describe, expect, it } from "vitest";

import { featureRoutes } from "@/app/routes";

describe("Phase 12 routes are registered in featureRoutes", () => {
  it.each(["/calendar", "/insights", "/reports", "/artifacts"])("registers %s", (path) => {
    const found = featureRoutes.some(
      (el) => (el as { props?: { path?: string } }).props?.path === path,
    );
    expect(found).toBe(true);
  });
});
