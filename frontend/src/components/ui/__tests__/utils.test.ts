import { describe, expect, it } from "vitest";

import { cn } from "../utils";

describe("cn", () => {
  it("joins string class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("drops undefined / null / false / empty conditionals", () => {
    expect(cn("foo", undefined, null, false, "", "bar")).toBe("foo bar");
  });

  it("respects conditional classes via object syntax", () => {
    expect(cn("foo", { bar: true, baz: false })).toBe("foo bar");
  });

  it("merges conflicting Tailwind classes — last one wins", () => {
    // twMerge dedupes within the same Tailwind utility group
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("preserves non-conflicting Tailwind classes", () => {
    // px and py are different groups — both retained
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });

  it("returns an empty string when no truthy inputs are provided", () => {
    expect(cn()).toBe("");
    expect(cn(undefined, null, false)).toBe("");
  });

  it("handles arrays of class values (clsx behavior)", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
    expect(cn(["foo", null, "bar"])).toBe("foo bar");
  });
});
