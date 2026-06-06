import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { apiGet, authEndpointRequest } from "@/shared/api/client";
import jwtManager from "@/shared/auth/jwt";
import { server } from "@/test/msw/server";

const Health = z.object({ ok: z.boolean() });

afterEach(() => vi.restoreAllMocks());

describe("client.ts — normal path injects JWT", () => {
  it("apiGet routes through apiFetch, which calls getAuthHeader", async () => {
    const spy = vi.spyOn(jwtManager, "getAuthHeader").mockResolvedValue("");
    server.use(http.get("/api/_health", () => HttpResponse.json({ ok: true })));
    const result = await apiGet("_health", Health);
    expect(result).toEqual({ ok: true });
    expect(spy).toHaveBeenCalled();
  });
});

describe("client.ts — authEndpoint path does NOT inject JWT (R7a — no recursion)", () => {
  it("authEndpointRequest never calls getAuthHeader", async () => {
    const spy = vi.spyOn(jwtManager, "getAuthHeader");
    server.use(http.post("/api/auth/refresh", () => HttpResponse.json({ token: "new" })));
    const res = await authEndpointRequest("auth/refresh", z.object({ token: z.string() }), {
      body: { refreshToken: "r" },
    });
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ token: "new" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns ok:false + status without parsing on a non-2xx (no throw)", async () => {
    server.use(http.post("/api/auth/token", () => new HttpResponse(null, { status: 404 })));
    const res = await authEndpointRequest("auth/token", z.object({ token: z.string() }), {
      body: {},
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
    expect(res.data).toBeNull();
  });
});
