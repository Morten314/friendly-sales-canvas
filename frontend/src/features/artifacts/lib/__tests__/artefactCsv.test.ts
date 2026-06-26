import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArtefactItem, ArtefactLeadRow } from "../../types";
import { buildLeadsCsv, generateAndDownloadCsv } from "../artefactCsv";

const HEADER = "Name,Title,Seniority,Company,Email,Email status,LinkedIn,Phone,Relevance,Why";

const row = (over: Partial<ArtefactLeadRow> = {}): ArtefactLeadRow => ({
  name: "Jane Doe",
  title: "VP Engineering",
  seniority: "CXO",
  company: "Acme",
  email: "jane@acme.com",
  emailStatus: "verified",
  linkedin: "https://linkedin.com/in/jane",
  phone: "555-0100", // no leading +/-/=/@ so the happy-path row is unguarded
  relevance: "high",
  why: "ICP match",
  ...over,
});

describe("buildLeadsCsv", () => {
  it("emits the fixed header row in column order", () => {
    expect(buildLeadsCsv([])).toBe(HEADER);
  });

  it("emits one CRLF-separated data row per lead, cells in column order", () => {
    const lines = buildLeadsCsv([row()]).split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe(
      "Jane Doe,VP Engineering,CXO,Acme,jane@acme.com,verified,https://linkedin.com/in/jane,555-0100,high,ICP match",
    );
  });

  it("RFC-4180 quotes cells with comma/quote/newline and doubles embedded quotes", () => {
    const lines = buildLeadsCsv([row({ why: 'He said "go", then left\nnext line' })]).split("\r\n");
    // The embedded LF stays inside the quoted field, so splitting on CRLF still
    // yields exactly header + 1 record.
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('"He said ""go"", then left\nnext line"')).toBe(true);
  });

  it("neutralizes formula-injection cells (leading = + - @) with a leading apostrophe", () => {
    const cells = buildLeadsCsv([
      row({ name: "=1+1", title: "+phone", seniority: "-lead", company: "@handle", why: "safe" }),
    ])
      .split("\r\n")[1]
      .split(",");
    expect(cells[0]).toBe("'=1+1"); // Name
    expect(cells[1]).toBe("'+phone"); // Title
    expect(cells[2]).toBe("'-lead"); // Seniority
    expect(cells[3]).toBe("'@handle"); // Company
    expect(cells[9]).toBe("safe"); // Why — untouched
  });

  it("guards a +E.164 phone too — documented data-fidelity tradeoff (plan review r1)", () => {
    // International phones start with '+', so the formula guard prefixes a '.
    // On plain-CSV import some apps show that apostrophe literally — an accepted
    // MVP artifact (see plan Global Constraints). Pinned here so it's intentional.
    const cells = buildLeadsCsv([row({ phone: "+1-555-0100" })]).split("\r\n")[1].split(",");
    expect(cells[7]).toBe("'+1-555-0100"); // Phone column
  });

  it("renders blank cells for empty fields without writing the literal 'undefined'", () => {
    const dataRow = buildLeadsCsv([
      row({
        name: "",
        title: "",
        seniority: "",
        email: "",
        emailStatus: "",
        linkedin: "",
        phone: "",
        why: "",
      }),
    ]).split("\r\n")[1];
    expect(dataRow).toBe(",,,Acme,,,,,high,");
    expect(dataRow).not.toContain("undefined");
  });
});

describe("generateAndDownloadCsv", () => {
  class FakeBlob {
    static lastParts: unknown[] = [];
    static lastOptions: unknown = undefined;
    constructor(parts: unknown[], options?: unknown) {
      FakeBlob.lastParts = parts;
      FakeBlob.lastOptions = options;
    }
  }
  const createObjectURL = vi.fn(() => "blob:fake-url");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    FakeBlob.lastParts = [];
    FakeBlob.lastOptions = undefined;
    vi.stubGlobal("Blob", FakeBlob);
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    // jsdom's anchor.click() would attempt navigation; suppress it.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const artefact = (leadRows?: ArtefactLeadRow[]): ArtefactItem =>
    ({
      fullReport: {
        title: "Hiring Surge!",
        executiveSummary: "",
        keyFindings: [],
        analysis: "",
        recommendations: [],
      },
      leadRows,
    }) as ArtefactItem;

  it("is a no-op when there are no lead rows", () => {
    generateAndDownloadCsv(artefact(undefined));
    generateAndDownloadCsv(artefact([]));
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("prepends a UTF-8 BOM and uses the text/csv mime type", () => {
    generateAndDownloadCsv(artefact([row()]));
    const content = FakeBlob.lastParts[0] as string;
    expect(content.charCodeAt(0)).toBe(0xfeff); // leading UTF-8 BOM
    expect(content.slice(1)).toContain(HEADER);
    expect(FakeBlob.lastOptions).toEqual({ type: "text/csv;charset=utf-8" });
  });

  it("downloads a slugified *-leads-*.csv file and revokes the object URL", () => {
    const appended: HTMLAnchorElement[] = [];
    vi.spyOn(document.body, "appendChild").mockImplementation(((node: Node) => {
      appended.push(node as HTMLAnchorElement);
      return node;
    }) as typeof document.body.appendChild);
    vi.spyOn(document.body, "removeChild").mockImplementation(
      ((node: Node) => node) as typeof document.body.removeChild,
    );

    generateAndDownloadCsv(artefact([row()]));

    expect(appended).toHaveLength(1);
    expect(appended[0].download).toMatch(/^hiring_surge_-leads-\d+\.csv$/);
    expect(appended[0].href).toContain("blob:fake-url");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });
});
