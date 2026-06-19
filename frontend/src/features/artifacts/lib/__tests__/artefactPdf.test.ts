import { describe, expect, it } from "vitest";

import { mockArtefacts } from "../../data/mockArtefacts";
import { createSimplePDF, escapePdfText } from "../artefactPdf";

describe("escapePdfText", () => {
  it("escapes PDF structural breakers", () => {
    expect(escapePdfText("a (b) c")).toBe("a \\(b\\) c");
    expect(escapePdfText("back\\slash")).toBe("back\\\\slash");
    expect(escapePdfText("smile :)")).toBe("smile :\\)");
  });

  it("folds common typographic offenders to ASCII", () => {
    expect(escapePdfText("A—B")).toBe("A-B"); // em dash
    expect(escapePdfText("A–B")).toBe("A-B"); // en dash
    expect(escapePdfText("“quoted”")).toBe('"quoted"'); // smart double quotes
    expect(escapePdfText("it’s")).toBe("it's"); // smart apostrophe
    expect(escapePdfText("• item")).toBe("- item"); // bullet
  });
});

describe("createSimplePDF", () => {
  it("returns a non-trivial PDF document string", () => {
    const pdf = createSimplePDF(mockArtefacts[0]);
    expect(pdf.startsWith("%PDF")).toBe(true);
    expect(pdf.length).toBeGreaterThan(100);
  });

  it("keeps parentheses balanced/escaped for free-text inputs", () => {
    const artefact = {
      ...mockArtefacts[0],
      fullReport: {
        ...mockArtefacts[0].fullReport,
        title: "Acme (Pilot) \\ rollout :)",
        keyFindings: ["Lead (A) — strong fit"],
      },
    };
    const pdf = createSimplePDF(artefact);
    // No raw unescaped backslash or smart dash survives into the content stream.
    expect(pdf).toContain("Acme \\(Pilot\\) \\\\ rollout :\\)");
    expect(pdf).toContain("Lead \\(A\\) - strong fit");
  });
});
