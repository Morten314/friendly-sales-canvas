import { describe, expect, it } from "vitest";
import { z } from "zod";

import { firstPageParams, paginatedSchema } from "../pagination";

describe("paginatedSchema", () => {
  it("parses a well-formed v2 envelope and extracts items", () => {
    const env = paginatedSchema(z.unknown()).parse({
      items: [{ a: 1 }, { a: 2 }],
      total: 7,
      limit: 50,
      offset: 0,
    });
    expect(env.items).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("defaults items to [] when absent", () => {
    const env = paginatedSchema(z.unknown()).parse({ total: 0, limit: 50, offset: 0 });
    expect(env.items).toEqual([]);
  });

  it("rejects a non-array items field", () => {
    expect(() => paginatedSchema(z.unknown()).parse({ items: "nope" })).toThrow();
  });

  it("passes extra envelope keys through (total/limit/offset retained at runtime)", () => {
    const env = paginatedSchema(z.unknown()).parse({
      items: [],
      total: 99,
      limit: 10,
      offset: 0,
    }) as Record<string, unknown>;
    expect(env.total).toBe(99);
  });
});

describe("firstPageParams", () => {
  it("formats limit with offset=0", () => {
    expect(firstPageParams(500)).toBe("limit=500&offset=0");
    expect(firstPageParams(10)).toBe("limit=10&offset=0");
  });
});
