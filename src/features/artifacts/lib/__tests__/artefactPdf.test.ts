import { describe, expect, it } from "vitest";

import { mockArtefacts } from "../../data/mockArtefacts";
import type { ArtefactItem } from "../../types";
import { buildArtefactPdfBlob, buildArtefactPdfDoc, escapePdfText } from "../artefactPdf";

describe("escapePdfText (ASCII-fold only after jsPDF migration)", () => {
  it("folds typographic offenders to ASCII", () => {
    expect(escapePdfText("A—B")).toBe("A-B");
    expect(escapePdfText("A–B")).toBe("A-B");
    expect(escapePdfText(`“q”`)).toBe('"q"');
    expect(escapePdfText("it's")).toBe("it's");
    expect(escapePdfText("• item")).toBe("- item");
  });

  it("no longer escapes structural ( ) \\ — jsPDF owns encoding now", () => {
    expect(escapePdfText("a (b) c")).toBe("a (b) c");
    expect(escapePdfText("back\\slash")).toBe("back\\slash");
  });
});

const longArtefact = (): ArtefactItem => ({
  ...mockArtefacts[0],
  fullReport: {
    ...mockArtefacts[0].fullReport,
    title: "Acme (Pilot) — rollout",
    executiveSummary: "Para. ".repeat(400), // long enough to overflow one page
    keyFindings: Array.from(
      { length: 30 },
      (_, i) => `Lead ${i} (Relevance: High): long rationale ${"x".repeat(80)}`,
    ),
    analysis: "Analysis. ".repeat(400),
    recommendations: ["Communication Template:\n" + "line\n".repeat(60)],
  },
});

describe("buildArtefactPdf*", () => {
  it("returns a non-empty Blob and does not throw on long, multi-section, paren/dash content", () => {
    // jsdom's Blob lacks .text()/.arrayBuffer() stream methods, so we assert
    // structural validity (non-empty Blob with PDF MIME type) rather than header bytes.
    const blob = buildArtefactPdfBlob(longArtefact());
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe("application/pdf");
  });

  it("produces a valid %PDF header (AC#5) via output()", () => {
    const pdf = buildArtefactPdfDoc(longArtefact()).output();
    expect(pdf.startsWith("%PDF")).toBe(true);
  });

  it("paginates long input to more than one page", () => {
    const doc = buildArtefactPdfDoc(longArtefact());
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it("produces a single page for short input", () => {
    const doc = buildArtefactPdfDoc(mockArtefacts[0]);
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
