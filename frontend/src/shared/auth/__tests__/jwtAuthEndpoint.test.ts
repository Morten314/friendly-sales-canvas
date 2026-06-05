import type { User } from "firebase/auth";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import jwtManager from "@/shared/auth/jwt";
import { server } from "@/test/msw/server";

const fakeUser = { getIdToken: async () => "firebase-id-token" } as unknown as User;

afterEach(() => {
  vi.restoreAllMocks();
  jwtManager.clearTokens();
});

describe("JWTManager auth transport (spec 20 R7)", () => {
  it("generateToken returns null on a 404 (JWT optional, not a throw)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    server.use(http.post("/api/auth/token", () => new HttpResponse(null, { status: 404 })));
    await expect(jwtManager.generateToken(fakeUser)).resolves.toBeNull();
  });

  it("generateToken does not invoke getAuthHeader (no recursion)", async () => {
    const spy = vi.spyOn(jwtManager, "getAuthHeader");
    server.use(
      http.post("/api/auth/token", () => HttpResponse.json({ token: "jwt", refreshToken: "r" })),
    );
    await jwtManager.generateToken(fakeUser);
    expect(spy).not.toHaveBeenCalled();
  });

  it("generateToken stores the token returned on 2xx", async () => {
    server.use(
      http.post("/api/auth/token", () =>
        HttpResponse.json({ token: "jwt-123", refreshToken: "r-123" }),
      ),
    );
    await expect(jwtManager.generateToken(fakeUser)).resolves.toBe("jwt-123");
    expect(localStorage.getItem("jwt_token")).toBe("jwt-123");
  });
});
