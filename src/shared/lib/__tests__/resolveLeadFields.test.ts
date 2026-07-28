import { describe, expect, it } from "vitest";

import { resolveLeadFields } from "../leadData";

describe("resolveLeadFields", () => {
  it("resolves Apollo lowercase keys", () => {
    expect(
      resolveLeadFields({
        name: "Sam Lee",
        company_name: "Globex",
        title: "Owner",
        seniority: "Owner",
      }),
    ).toEqual({ name: "Sam Lee", company: "Globex", title: "Owner", seniority: "Owner" });
  });

  it("resolves CSV TitleCase_underscore keys and composes First+Last", () => {
    expect(
      resolveLeadFields({
        First_Name: "Jane",
        Last_Name: "Doe",
        Company_Name: "Acme",
        Job_Title: "VP Engineering",
        Seniority_Level: "CXO",
      }),
    ).toEqual({ name: "Jane Doe", company: "Acme", title: "VP Engineering", seniority: "CXO" });
  });

  it("returns empty strings when fields are absent", () => {
    expect(resolveLeadFields({ lead_id: "l1" })).toEqual({
      name: "",
      company: "",
      title: "",
      seniority: "",
    });
  });

  it("matches by normalized equality, not substring", () => {
    expect(resolveLeadFields({ Job_Title_X: "nope" }).title).toBe("");
  });

  it("reads a nested `lead` object, top-level winning", () => {
    expect(resolveLeadFields({ lead: { title: "Nested" }, Job_Title: "Top" }).title).toBe("Top");
    expect(resolveLeadFields({ lead: { title: "Nested" } }).title).toBe("Nested");
  });

  it("resolves company from a nested company object", () => {
    const result = resolveLeadFields({ lead_id: "l1", company: { name: "Nested Co" } });
    expect(result.company).toBe("Nested Co");
    // name/title/seniority must be unaffected — the nested object's name does not leak
    expect(result.name).toBe("");
    expect(result.title).toBe("");
    expect(result.seniority).toBe("");
  });

  it("flat company_name / company string still resolves unchanged (no over-reach)", () => {
    expect(resolveLeadFields({ company_name: "Flat Co" }).company).toBe("Flat Co");
    expect(resolveLeadFields({ company: "Flat Co" }).company).toBe("Flat Co");
  });

  it("returns empty company when no company field resolves (never [object Object])", () => {
    const result = resolveLeadFields({ lead_id: "l2" });
    expect(result.company).toBe("");
    expect(result.company).not.toBe("[object Object]");
  });
});
