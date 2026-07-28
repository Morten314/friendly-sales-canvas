import { describe, expect, it } from "vitest";

import {
  csvLineHasUnclosedQuote,
  detectDelimiter,
  getLeadImportKind,
  normalizeCsv,
  normalizeCsvAsciiDoubleQuotes,
  normalizeColumnNames,
  parseCsvLine,
  parseCsvLineRelaxed,
  parseErrorMessage,
  sniffExcelBinarySignature,
} from "../csvHelpers";

// ---------------------------------------------------------------------------
// parseCsvLine
// ---------------------------------------------------------------------------
describe("parseCsvLine", () => {
  it("splits a simple comma-separated line", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("strips enclosing double-quotes from a field", () => {
    expect(parseCsvLine('"hello","world"')).toEqual(["hello", "world"]);
  });

  it("preserves a comma inside a quoted field", () => {
    expect(parseCsvLine('"Smith, John",42')).toEqual(["Smith, John", "42"]);
  });

  it("handles an escaped double-quote (RFC 4180 double-quote escape)", () => {
    expect(parseCsvLine('"say ""hi""",ok')).toEqual(['say "hi"', "ok"]);
  });

  it("returns an empty array for an empty / whitespace-only line", () => {
    expect(parseCsvLine("")).toEqual([]);
    expect(parseCsvLine("   ")).toEqual([]);
  });

  it("respects a tab delimiter", () => {
    expect(parseCsvLine("a\tb\tc", "\t")).toEqual(["a", "b", "c"]);
  });

  it("treats a trailing delimiter as an extra empty field", () => {
    const result = parseCsvLine("a,b,");
    // trailing comma produces at least 3 elements; first two are meaningful
    expect(result[0]).toBe("a");
    expect(result[1]).toBe("b");
    expect(result.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// parseCsvLineRelaxed
// ---------------------------------------------------------------------------
describe("parseCsvLineRelaxed", () => {
  it("repairs a backslash-escaped quote before parsing", () => {
    // Input: name,\"quoted value\" (backslash-escape style)
    // repairCsvLineForParsing converts \" -> " making it a valid RFC line
    const result = parseCsvLineRelaxed('name,\\"quoted value\\"');
    expect(result[0]).toBe("name");
    expect(result[1]).toBe("quoted value");
  });

  it("closes an unclosed quote before splitting fields", () => {
    // "open field,next -- the closing " is missing; repairCsvLineForParsing appends it
    const result = parseCsvLineRelaxed('"open field,next');
    // After repair the whole thing is one quoted field
    expect(result[0]).toBe("open field,next");
  });

  it("parses a normal line identically to parseCsvLine", () => {
    expect(parseCsvLineRelaxed("x,y,z")).toEqual(parseCsvLine("x,y,z"));
  });
});

// ---------------------------------------------------------------------------
// csvLineHasUnclosedQuote
// ---------------------------------------------------------------------------
describe("csvLineHasUnclosedQuote", () => {
  it("returns false for a properly closed quoted field", () => {
    expect(csvLineHasUnclosedQuote('"hello",world')).toBe(false);
  });

  it("returns true when a quote is opened but never closed", () => {
    expect(csvLineHasUnclosedQuote('"unclosed,field')).toBe(true);
  });

  it("returns false for a line with no quotes at all", () => {
    expect(csvLineHasUnclosedQuote("a,b,c")).toBe(false);
  });

  it("handles an RFC double-quote-escape (pair counts as closed)", () => {
    // ""hello"" -- two pairs, net balance is closed
    expect(csvLineHasUnclosedQuote('""hello""')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectDelimiter
// ---------------------------------------------------------------------------
describe("detectDelimiter", () => {
  it("detects comma for a standard CSV", () => {
    const csv = "name,email,phone\nAlice,alice@example.com,555-1234\nBob,bob@example.com,555-5678";
    expect(detectDelimiter(csv)).toBe(",");
  });

  it("detects tab for a TSV file", () => {
    const tsv = "name\temail\nAlice\talice@example.com\nBob\tbob@example.com";
    expect(detectDelimiter(tsv)).toBe("\t");
  });

  it("detects semicolon for European-style CSV", () => {
    const csv = "name;email;city\nAlice;alice@example.com;Paris\nBob;bob@example.com;Lyon";
    expect(detectDelimiter(csv)).toBe(";");
  });

  it("falls back to comma for an empty string", () => {
    expect(detectDelimiter("")).toBe(",");
  });
});

// ---------------------------------------------------------------------------
// normalizeCsvAsciiDoubleQuotes
// Unicode escapes are used so the TS source file stays ASCII-safe and avoids
// SWC parsing ambiguity with non-ASCII quote characters.
// U+201C = LEFT DOUBLE QUOTATION MARK
// U+201D = RIGHT DOUBLE QUOTATION MARK
// U+201E = DOUBLE LOW-9 QUOTATION MARK
// U+201F = DOUBLE HIGH REVERSED-9 QUOTATION MARK
// ---------------------------------------------------------------------------
// BUG FOUND (do not commit production fix here):
// normalizeCsvAsciiDoubleQuotes in csvHelpers.ts uses U+201D (RIGHT DOUBLE QUOTATION MARK)
// as the replacement character in its regex, not ASCII U+0022. The replacement string
// `text.replace(/[...]/g, "”")` replaces fancy quotes with another fancy quote.
// Downstream code that looks for ASCII " delimiters will not see them.
// The replacement should be `'"'` (U+0022). Tests that assert the correct post-replacement
// character are skipped until the bug is fixed in production.
describe("normalizeCsvAsciiDoubleQuotes", () => {
  it("replaces U+201C / U+201D curly double-quotes with ASCII quote", () => {
    const input = String.fromCharCode(0x201c) + "hello" + String.fromCharCode(0x201d);
    expect(normalizeCsvAsciiDoubleQuotes(input)).toBe('"hello"');
  });

  it("replaces U+201E / U+201F low-9 double-quotes with ASCII quote", () => {
    const input = String.fromCharCode(0x201e) + "value" + String.fromCharCode(0x201f);
    expect(normalizeCsvAsciiDoubleQuotes(input)).toBe('"value"');
  });

  it("leaves ASCII double-quotes unchanged", () => {
    expect(normalizeCsvAsciiDoubleQuotes('"straight"')).toBe('"straight"');
  });

  it("passes through text without any quotes unchanged", () => {
    expect(normalizeCsvAsciiDoubleQuotes("plain text")).toBe("plain text");
  });
});

// ---------------------------------------------------------------------------
// normalizeCsv
// ---------------------------------------------------------------------------
describe("normalizeCsv", () => {
  it("normalises Windows line endings to LF", () => {
    const result = normalizeCsv("name,email\r\nAlice,alice@x.com\r\n");
    expect(result).not.toContain("\r");
  });

  it("normalises a known column alias in the header row", () => {
    // "Name" is in the columnMapping -> "fullName"
    const result = normalizeCsv("Name,Email\nAlice,alice@x.com");
    expect(result.split("\n")[0]).toContain("fullName");
  });

  it("round-trips a clean CSV without garbling data rows", () => {
    const input = "firstName,email\nAlice,alice@x.com\nBob,bob@x.com";
    const out = normalizeCsv(input);
    const lines = out.split("\n").filter(Boolean);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Alice");
  });
});

// ---------------------------------------------------------------------------
// normalizeColumnNames
// ---------------------------------------------------------------------------
describe("normalizeColumnNames", () => {
  it("maps 'Name' alias to fullName", () => {
    // "Name" is in the columnMapping -> "fullName"
    expect(normalizeColumnNames("Name,Email")).toContain("fullName");
  });

  it("maps 'LinkedIn' alias to linkedInProfile", () => {
    expect(normalizeColumnNames("LinkedIn,Company")).toContain("linkedInProfile");
  });

  it("preserves unrecognised column names unchanged", () => {
    const result = normalizeColumnNames("UnknownColumn,AnotherCol");
    expect(result).toBe("UnknownColumn,AnotherCol");
  });
});

// ---------------------------------------------------------------------------
// parseErrorMessage
// ---------------------------------------------------------------------------
describe("parseErrorMessage", () => {
  it("extracts a detail message from a JSON-wrapped error", () => {
    const raw = '{"detail": "Something went wrong"}';
    expect(parseErrorMessage(raw)).toBe("Something went wrong");
  });

  it("returns a friendly CSV-format message for Expected-fields errors", () => {
    const raw = "Expected 3 fields in line 5, saw 4";
    const result = parseErrorMessage(raw);
    expect(result).toMatch(/CSV format error on line 5/);
    expect(result).toMatch(/Expected 3 column\(s\)/);
    expect(result).toMatch(/found 4/);
  });

  it("returns a friendly encoding message when the error mentions 'codec'", () => {
    const raw = "codec can't decode byte 0xff";
    expect(parseErrorMessage(raw)).toMatch(/encoding error/i);
  });

  it("strips a leading HTTP status code prefix", () => {
    const raw = "422 - Unprocessable Entity";
    expect(parseErrorMessage(raw)).toBe("Unprocessable Entity");
  });

  it("returns a tokenizing-data message with the friendly prefix", () => {
    const raw = "error tokenizing data";
    expect(parseErrorMessage(raw)).toMatch(/CSV parsing error/i);
  });

  it("passes through a plain message with no known pattern unchanged", () => {
    const raw = "Something unexpected happened";
    expect(parseErrorMessage(raw)).toBe("Something unexpected happened");
  });
});

// ---------------------------------------------------------------------------
// getLeadImportKind
// ---------------------------------------------------------------------------
describe("getLeadImportKind", () => {
  it("returns 'csv' for a .csv file regardless of MIME", () => {
    const f = new File(["a,b"], "leads.csv", { type: "application/octet-stream" });
    expect(getLeadImportKind(f)).toBe("csv");
  });

  it("returns 'excel' for a .xlsx file", () => {
    const f = new File([""], "report.xlsx", { type: "application/octet-stream" });
    expect(getLeadImportKind(f)).toBe("excel");
  });

  it("returns 'excel' for a .xls file", () => {
    const f = new File([""], "report.xls", { type: "" });
    expect(getLeadImportKind(f)).toBe("excel");
  });

  it("returns 'excel' when MIME is the ooxml spreadsheet type and no extension", () => {
    const f = new File([""], "spreadsheet", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(getLeadImportKind(f)).toBe("excel");
  });

  it("returns 'csv' when MIME is text/csv and no extension", () => {
    const f = new File(["a,b"], "export", { type: "text/csv" });
    expect(getLeadImportKind(f)).toBe("csv");
  });

  it("returns null when the file has no recognised extension or MIME", () => {
    const f = new File(["data"], "mystery", { type: "application/octet-stream" });
    expect(getLeadImportKind(f)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// sniffExcelBinarySignature
// Blob.slice().arrayBuffer() is not implemented in this jsdom version so the
// byte-sniff cases are infeasible. The size-guard path is exercised here
// because it returns early before any arrayBuffer() call.
// ---------------------------------------------------------------------------
describe("sniffExcelBinarySignature", () => {
  it("returns false immediately for a file smaller than 4 bytes (size guard path)", async () => {
    const f = new File([new Uint8Array([0x50, 0x4b])], "tiny");
    expect(await sniffExcelBinarySignature(f)).toBe(false);
  });
});
