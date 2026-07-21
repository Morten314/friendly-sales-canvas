import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  baseName,
  computeDelta,
  formatBytes,
  formatDelta,
  loadBaseline,
} from "./check-bundle-budget";

const FIXTURE_DIR = resolve(import.meta.dirname, "__fixtures__");

describe("baseName", () => {
  it("strips Vite hash from index-DoZK05uc.js", () => {
    expect(baseName("assets/index-DoZK05uc.js")).toBe("index-*.js");
  });

  it("strips Vite hash with internal hyphen from index-CqIc-MII.css", () => {
    expect(baseName("assets/index-CqIc-MII.css")).toBe("index-*.css");
  });

  it("strips hash from workbox-5ffe50d4.js", () => {
    expect(baseName("workbox-5ffe50d4.js")).toBe("workbox-*.js");
  });

  it("strips trailing hash from workbox-window.prod.es5-B9K5rw8f.js", () => {
    expect(baseName("assets/workbox-window.prod.es5-B9K5rw8f.js")).toBe(
      "workbox-window.prod.es5-*.js",
    );
  });

  it("returns unchanged name when there is no hash segment", () => {
    expect(baseName("sw.js")).toBe("sw.js");
  });

  it("returns unchanged name when path has no dash", () => {
    expect(baseName("assets/main.js")).toBe("main.js");
  });

  it("documents the known over-stripping limitation for hand-named hyphenated files", () => {
    // The current regex assumes every hyphenated filename in `dist/` is
    // Vite-hashed. A hand-named file like `my-component.js` is over-stripped
    // to `my-*.js`. This test asserts the current (incorrect) behavior so a
    // future tightening trips it deliberately. See spec 19 §6 Risk R1.
    expect(baseName("vendor/my-component.js")).toBe("my-*.js");
  });
});

describe("formatBytes", () => {
  it("formats bytes < 1KB as B", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats KB to one decimal", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats MB to two decimals", () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.00 MB");
  });

  it("formats negative bytes with leading minus", () => {
    expect(formatBytes(-1024)).toBe("-1.0 KB");
  });
});

describe("computeDelta", () => {
  it("computes positive delta and percent", () => {
    const d = computeDelta(1000, 1100);
    expect(d.absolute).toBe(100);
    expect(d.percent).toBeCloseTo(10, 5);
  });

  it("computes negative delta and percent", () => {
    const d = computeDelta(1000, 800);
    expect(d.absolute).toBe(-200);
    expect(d.percent).toBeCloseTo(-20, 5);
  });

  it("returns 0 percent when baseline is 0", () => {
    const d = computeDelta(0, 100);
    expect(d.absolute).toBe(100);
    expect(d.percent).toBe(0);
  });
});

describe("formatDelta", () => {
  it("renders positive delta with + sign", () => {
    expect(formatDelta(2048, 0.95)).toBe("+2.0 KB (+0.95%)");
  });

  it("renders negative delta without extra sign", () => {
    expect(formatDelta(-1024, -3.2)).toBe("-1.0 KB (-3.20%)");
  });

  it("renders zero as +0", () => {
    expect(formatDelta(0, 0)).toBe("+0 B (+0.00%)");
  });
});

describe("loadBaseline", () => {
  it("returns ok with parsed baseline for a valid file", async () => {
    const result = await loadBaseline(resolve(FIXTURE_DIR, "baseline-valid.json"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.baseline.total_size_bytes).toBe(2092063);
      expect(result.baseline.chunks).toHaveLength(2);
    }
  });

  it("returns not-ok with actionable reason when file missing", async () => {
    const result = await loadBaseline(resolve(FIXTURE_DIR, "does-not-exist.json"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("baseline not found");
      expect(result.reason).toContain("npm run bundle:rebaseline");
    }
  });

  it("returns not-ok when JSON is malformed", async () => {
    const result = await loadBaseline(resolve(FIXTURE_DIR, "baseline-malformed.json"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("malformed");
    }
  });

  it("returns not-ok when required fields are missing", async () => {
    const result = await loadBaseline(resolve(FIXTURE_DIR, "baseline-missing-fields.json"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("missing expected fields");
    }
  });
});
