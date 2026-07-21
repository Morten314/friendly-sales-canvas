import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NAMING_MAP, validateName, scaffoldFeature } from "./scaffold-feature";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "scaffold-test-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("validateName", () => {
  it("accepts kebab-case", () => {
    expect(validateName("market-research").ok).toBe(true);
  });
  it("rejects non-kebab", () => {
    const r = validateName("MarketResearch");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("kebab-case");
  });
  it("rejects empty", () => {
    expect(validateName("").ok).toBe(false);
  });
});

describe("NAMING_MAP", () => {
  it("equals exactly the 14 current features", () => {
    const expected = [
      "artifacts",
      "auth",
      "calendar",
      "customers",
      "insights",
      "market-research",
      "mission-control",
      "reports",
      "scout",
      "settings",
      "shell",
      "signals",
      "strategist",
      "tenant",
    ];
    expect(NAMING_MAP).toHaveLength(expected.length);
    expect([...NAMING_MAP].sort()).toEqual([...expected].sort());
  });
});

describe("scaffoldFeature", () => {
  it("creates the three canonical files and no subfolders", async () => {
    const res = await scaffoldFeature("demo-feature", { featuresDir: dir, dryRun: false });
    expect(res.created).toEqual(expect.arrayContaining(["types.ts", "index.ts", "README.md"]));
    expect(existsSync(join(dir, "demo-feature", "types.ts"))).toBe(true);
    expect(existsSync(join(dir, "demo-feature", "index.ts"))).toBe(true);
    expect(existsSync(join(dir, "demo-feature", "README.md"))).toBe(true);
    expect(existsSync(join(dir, "demo-feature", "pages"))).toBe(false);
    const readme = await readFile(join(dir, "demo-feature", "README.md"), "utf8");
    expect(readme).toContain("# `demo-feature` feature");
  });

  it("dry-run writes nothing", async () => {
    const res = await scaffoldFeature("demo-feature", { featuresDir: dir, dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(existsSync(join(dir, "demo-feature"))).toBe(false);
  });

  it("refuses to overwrite an existing feature", async () => {
    await mkdir(join(dir, "demo-feature"), { recursive: true });
    await expect(
      scaffoldFeature("demo-feature", { featuresDir: dir, dryRun: false }),
    ).rejects.toThrow(/already exists/);
  });

  it("rejects an invalid (non-kebab) name passed directly", async () => {
    await expect(scaffoldFeature("BadName", { featuresDir: dir, dryRun: false })).rejects.toThrow(
      /kebab-case/,
    );
  });
});
