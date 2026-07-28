// Characterization tests for the pure signals card helpers extracted from
// SignalsPage.tsx during Phase 8c-3. Behavior-preserving — these lock in the
// observable contract of the moved functions.
import { describe, expect, it } from "vitest";

import type { SignalCard } from "../../types";
import {
  applyRejectedFilterAndSort,
  buildSignalCardsFromFetchData,
  getSignalContentHash,
  parseTimestamp,
  sanitizeSourceUrl,
} from "../signalCards";

const makeCard = (overrides: Partial<SignalCard> = {}): SignalCard => ({
  id: "x",
  agent: "scout",
  timestamp: "1h ago",
  headline: "Headline",
  snippet: "Snippet",
  description: "Description",
  sourceUrl: "#",
  sourceLabel: "Label",
  nextBestMoves: [],
  contextualSuggestions: [],
  ...overrides,
});

describe("parseTimestamp", () => {
  it("parses ISO 8601 dates to their epoch milliseconds", () => {
    expect(parseTimestamp("2026-05-08T10:00:00.000Z")).toBe(
      new Date("2026-05-08T10:00:00.000Z").getTime(),
    );
  });

  it("returns 0 for an unparseable timestamp", () => {
    expect(parseTimestamp("whenever")).toBe(0);
  });

  it("orders relative timestamps newest-first by numeric value", () => {
    // 1h ago is more recent (larger value) than 3h ago.
    expect(parseTimestamp("1h ago")).toBeGreaterThan(parseTimestamp("3h ago"));
    // minutes-ago is more recent than hours-ago
    expect(parseTimestamp("5m ago")).toBeGreaterThan(parseTimestamp("2h ago"));
    // days-ago is older than hours-ago
    expect(parseTimestamp("2d ago")).toBeLessThan(parseTimestamp("2h ago"));
  });
});

describe("getSignalContentHash", () => {
  it("returns a stable hash for the same content", () => {
    const card = makeCard();
    expect(getSignalContentHash(card)).toBe(getSignalContentHash(card));
  });

  it("returns a different hash when content differs", () => {
    const a = makeCard({ headline: "Alpha" });
    const b = makeCard({ headline: "Beta" });
    expect(getSignalContentHash(a)).not.toBe(getSignalContentHash(b));
  });

  it("derives the hash only from headline/snippet/description/agent (id is ignored)", () => {
    const a = makeCard({ id: "1" });
    const b = makeCard({ id: "2" });
    expect(getSignalContentHash(a)).toBe(getSignalContentHash(b));
  });
});

describe("applyRejectedFilterAndSort", () => {
  it("removes rejected cards and sorts the rest newest-first", () => {
    const keep1 = makeCard({ id: "keep1", headline: "Keep One", timestamp: "1h ago" });
    const keep2 = makeCard({ id: "keep2", headline: "Keep Two", timestamp: "5h ago" });
    const drop = makeCard({ id: "drop", headline: "Drop Me", timestamp: "2h ago" });

    const rejected = new Set<string>([getSignalContentHash(drop)]);
    const result = applyRejectedFilterAndSort([keep2, drop, keep1], rejected);

    expect(result.map((c) => c.id)).toEqual(["keep1", "keep2"]);
  });

  it("returns all cards sorted when nothing is rejected", () => {
    const older = makeCard({ id: "older", headline: "Older", timestamp: "5h ago" });
    const newer = makeCard({ id: "newer", headline: "Newer", timestamp: "1h ago" });

    const result = applyRejectedFilterAndSort([older, newer], new Set());

    expect(result.map((c) => c.id)).toEqual(["newer", "older"]);
  });
});

describe("buildSignalCardsFromFetchData", () => {
  it("returns an empty array when there are no signals", () => {
    expect(buildSignalCardsFromFetchData({})).toEqual([]);
    expect(buildSignalCardsFromFetchData({ signals: [] })).toEqual([]);
  });

  it("maps a minimal backend signal into a card shape", () => {
    const result = buildSignalCardsFromFetchData({
      signals: [
        {
          signal_id: "sig-1",
          headline: "Competitor move",
          snippet: "Pricing change",
          timestamp: "2h ago",
          agent: "scout",
        },
      ],
    });

    expect(result).toHaveLength(1);
    const card = result[0];
    expect(card.id).toBe("sig-1");
    expect(card.headline).toBe("Competitor move");
    expect(card.timestamp).toBe("2h ago");
    // normalized-but-absent fields default to empty
    expect(card.description).toBe("");
    expect(card.source).toEqual([]);
    expect(card.nextBestMoves).toEqual([]);
    expect(card.NBAs).toEqual([]);
    expect(card.contextualSuggestions).toEqual([]);
  });

  it("prefers signal_id over id and derives NBAs from nextBestMoves when NBAs absent", () => {
    const result = buildSignalCardsFromFetchData({
      signals: [
        {
          signal_id: "primary",
          id: "secondary",
          headline: "H",
          nextBestMoves: ["Do thing"],
        },
      ],
    });

    expect(result[0].id).toBe("primary");
    expect(result[0].NBAs).toEqual([{ nba: "Do thing", prompt: "" }]);
  });

  it("sanitizes malformed Tavily API citation URLs from API payloads", () => {
    const result = buildSignalCardsFromFetchData({
      signals: [
        {
          signal_id: "s1",
          headline: "H",
          sourceUrl: "https://api.tavily.com/search')",
          source: [
            { citation: "Gartner", url: "https://api.tavily.com/search')" },
            { citation: "Statista", url: "https://statista.com/topic')" },
          ],
        },
      ],
    });

    expect(result[0].sourceUrl).toBe("https://statista.com/topic");
    expect(result[0].source).toEqual([{ citation: "Statista", url: "https://statista.com/topic" }]);
  });
});

describe("sanitizeSourceUrl", () => {
  it("removes trailing junk and blocks Tavily API hosts", () => {
    expect(sanitizeSourceUrl("https://api.tavily.com/search')")).toBe("");
    expect(sanitizeSourceUrl("https://www.gartner.com/report')")).toBe(
      "https://www.gartner.com/report",
    );
  });

  it("preserves a balanced trailing ')' in the path (e.g. Wikipedia disambiguation links)", () => {
    expect(sanitizeSourceUrl("https://en.wikipedia.org/wiki/Python_(programming_language)")).toBe(
      "https://en.wikipedia.org/wiki/Python_(programming_language)",
    );
  });

  it("strips only the unbalanced wrapping ')' and trailing sentence punctuation", () => {
    expect(sanitizeSourceUrl("https://en.wikipedia.org/wiki/Foo_(bar)).")).toBe(
      "https://en.wikipedia.org/wiki/Foo_(bar)",
    );
  });
});
