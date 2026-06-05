import { describe, expect, it } from "vitest";

import { mockArtefacts } from "../../data/mockArtefacts";
import { createSimplePDF } from "../artefactPdf";

describe("createSimplePDF", () => {
  it("returns a non-trivial PDF document string", () => {
    const pdf = createSimplePDF(mockArtefacts[0]);
    expect(pdf.startsWith("%PDF")).toBe(true);
    expect(pdf.length).toBeGreaterThan(100);
  });
});
