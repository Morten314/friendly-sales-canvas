import { describe, expect, it } from "vitest";

import { sanitizeAnswerText } from "@/shared/lib/sanitizeAnswerText";

describe("sanitizeAnswerText", () => {
  it("returns empty string for empty/null/undefined/non-string input", () => {
    expect(sanitizeAnswerText("")).toBe("");
    // @ts-expect-error — exercising the typeof guard at line 11
    expect(sanitizeAnswerText(null)).toBe("");
    // @ts-expect-error — exercising the typeof guard at line 11
    expect(sanitizeAnswerText(undefined)).toBe("");
    // @ts-expect-error — exercising the typeof guard at line 11
    expect(sanitizeAnswerText(42)).toBe("");
  });

  it("strips *** and ** emphasis markers", () => {
    expect(sanitizeAnswerText("***bold-italic***")).toBe("bold-italic");
    expect(sanitizeAnswerText("**bold**")).toBe("bold");
  });

  it("strips single-asterisk italics with content preserved", () => {
    expect(sanitizeAnswerText("*italic word*")).toBe("italic word");
  });

  it("strips dangling asterisks at line ends", () => {
    expect(sanitizeAnswerText("text *\nnext line")).toBe("text \nnext line");
  });

  it("strips markdown headers", () => {
    expect(sanitizeAnswerText("# Header 1")).toBe("Header 1");
    expect(sanitizeAnswerText("## Header 2")).toBe("Header 2");
    expect(sanitizeAnswerText("### Header 3")).toBe("Header 3");
  });

  it("strips backticks from inline code", () => {
    expect(sanitizeAnswerText("use `myFn` here")).toBe("use myFn here");
    expect(sanitizeAnswerText("```code block```")).toBe("code block");
  });

  it("strips horizontal rules (--- lines)", () => {
    expect(sanitizeAnswerText("top\n---\nbottom")).toBe("top\n\nbottom");
  });

  it("replaces pipe characters with spaces", () => {
    expect(sanitizeAnswerText("col1 | col2")).toBe("col1 col2");
  });

  it('normalizes em-dash, en-dash, and horizontal-bar to " - "', () => {
    expect(sanitizeAnswerText("foo — bar")).toBe("foo - bar"); // U+2014 em-dash
    expect(sanitizeAnswerText("foo – bar")).toBe("foo - bar"); // U+2013 en-dash
    expect(sanitizeAnswerText("foo ― bar")).toBe("foo - bar"); // U+2015 horizontal bar — covered by utils.ts:21 regex [–—―]
  });

  it("normalizes smart quotes to ASCII", () => {
    expect(sanitizeAnswerText("'single'")).toBe("'single'");
    expect(sanitizeAnswerText("“double”")).toBe('"double"');
  });

  it("normalizes ellipsis character to ...", () => {
    expect(sanitizeAnswerText("and then…")).toBe("and then...");
  });

  it("strips check/cross symbols (Unicode 2705/2713/2714/274C/274E)", () => {
    expect(sanitizeAnswerText("done ✅ next")).toBe("done next");
    expect(sanitizeAnswerText("fail ❌ retry")).toBe("fail retry");
  });

  it("strips misc symbol-block characters (U+2600–U+27BF)", () => {
    // U+2600 is the start of the block (sun, weather, arrows, etc.)
    expect(sanitizeAnswerText("a ☀ b")).toBe("a b");
    // U+2192 (→) is outside the range, so it's preserved
    expect(sanitizeAnswerText("arrow → here")).toBe("arrow → here");
  });

  it("strips emoji surrogate pairs", () => {
    expect(sanitizeAnswerText("rocket 🚀 launch")).toBe("rocket launch");
  });

  it("collapses runs of horizontal whitespace to single spaces (preserves newlines)", () => {
    expect(sanitizeAnswerText("foo    bar")).toBe("foo bar");
    expect(sanitizeAnswerText("foo\nbar")).toBe("foo\nbar");
  });

  it("collapses 3+ consecutive newlines to exactly 2", () => {
    expect(sanitizeAnswerText("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("trims leading and trailing whitespace from the final result", () => {
    expect(sanitizeAnswerText("  hello world  ")).toBe("hello world");
  });
});
