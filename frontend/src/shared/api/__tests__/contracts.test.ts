import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  AuthTokenResponseSchema,
  CompanyProfileSchema,
  TenantListSchema,
  TenantSchema,
} from "@/shared/api/contracts";

describe("CompanyProfileSchema", () => {
  it("parses a full profile", () => {
    const parsed = CompanyProfileSchema.parse({
      org_id: "brewra",
      user_id: "u1",
      industry: "saas",
      companySize: "11-50",
      targetMarkets: ["NA", "APAC"],
      socialMediaUrls: [{ platform: "LinkedIn", url: "https://x" }],
    });
    expect(parsed.industry).toBe("saas");
    expect(parsed.targetMarkets).toEqual(["NA", "APAC"]);
  });

  it("parses an empty object (no-profile-yet body)", () => {
    expect(CompanyProfileSchema.parse({})).toEqual({});
  });

  it("passes through unknown backend fields", () => {
    const parsed = CompanyProfileSchema.parse({ industry: "saas", extra_field: 1 }) as Record<
      string,
      unknown
    >;
    expect(parsed.extra_field).toBe(1);
  });

  it("rejects a wrong-typed field", () => {
    expect(() => CompanyProfileSchema.parse({ industry: 42 })).toThrow(ZodError);
  });
});

describe("TenantSchema / TenantListSchema", () => {
  it("parses a tenant with optional domain/logo", () => {
    expect(TenantSchema.parse({ id: "1", name: "Acme" }).name).toBe("Acme");
  });

  it("parses the mock tenant list", () => {
    const list = TenantListSchema.parse([
      { id: "1", name: "Acme Corporation", domain: "acme.com", logo: "🏢" },
    ]);
    expect(list).toHaveLength(1);
  });

  it("rejects a tenant missing required id", () => {
    expect(() => TenantSchema.parse({ name: "Acme" })).toThrow(ZodError);
  });
});

describe("AuthTokenResponseSchema", () => {
  it("accepts the JWTManager-read shape ({ token, refreshToken })", () => {
    const parsed = AuthTokenResponseSchema.parse({ token: "t", refreshToken: "r" });
    expect(parsed.token).toBe("t");
  });

  it("accepts the MSW-mock shape ({ access_token, expires_in })", () => {
    const parsed = AuthTokenResponseSchema.parse({ access_token: "t", expires_in: 3600 });
    expect(parsed.access_token).toBe("t");
  });
});
