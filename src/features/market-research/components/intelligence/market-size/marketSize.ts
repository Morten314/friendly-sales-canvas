/**
 * marketSize.ts
 *
 * Pure, render-independent helper functions extracted from MarketSizeSection.
 * No React, no fetch, no localStorage, no toast. Safe to unit-test in isolation.
 *
 * These are verbatim moves of the inline IIFEs that feed <MiniPieChart> and
 * <MiniLineChart> in the read tree — the string-coercion JSON.parse guard and
 * the empty-→defaults behavior are preserved exactly.
 */

/** A single slice of the market-size-by-segment pie chart. */
export interface PieChartEntry {
  name: string;
  value: number;
  color: string;
}

/** A single point on the growth-projections line chart. */
export interface LineChartEntry {
  name: string;
  value: number;
}

// ---------------------------------------------------------------------------
// segmentsToPieData
// ---------------------------------------------------------------------------

/**
 * Converts a `marketSizeBySegment` record into the array expected by
 * `<MiniPieChart>`.
 *
 * Mirrors the inline IIFE in the read tree of MarketSizeSection.tsx:
 *   - Empty / missing input → the 3-slice default fallback.
 *   - A string input is parsed as JSON; on parse failure → the same default fallback.
 *   - An object input maps each entry to a slice, stripping "%" and cycling a 4-color palette.
 */
export function segmentsToPieData(
  segmentsToUse: Record<string, string> | string | null | undefined,
): PieChartEntry[] {
  if (!segmentsToUse || Object.keys(segmentsToUse).length === 0) {
    return [
      { name: "Enterprise", value: 45, color: "#3B82F6" },
      { name: "Mid-Market", value: 35, color: "#10B981" },
      { name: "SMB", value: 20, color: "#8B5CF6" },
    ];
  }

  // If marketSizeBySegment is a string, try to parse it as JSON first
  if (typeof segmentsToUse === "string") {
    try {
      const parsedSegments = JSON.parse(segmentsToUse);
      if (parsedSegments && typeof parsedSegments === "object") {
        return Object.entries(parsedSegments).map(([name, value], index) => ({
          name,
          value: parseInt(String(value).replace("%", "")),
          color: ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B"][index % 4],
        }));
      }
    } catch (_parseError) {
      // intentional: fall through to fallback below
    }

    // Only use fallback data if parsing fails
    return [
      { name: "Enterprise", value: 45, color: "#3B82F6" },
      { name: "Mid-Market", value: 35, color: "#10B981" },
      { name: "SMB", value: 20, color: "#8B5CF6" },
    ];
  }

  // If it's an object, use it directly
  return Object.entries(segmentsToUse).map(([name, value], index) => ({
    name,
    value: parseInt(value.toString().replace("%", "")),
    color: ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B"][index % 4],
  }));
}

// ---------------------------------------------------------------------------
// projectionsToLineData
// ---------------------------------------------------------------------------

/**
 * Converts a `growthProjections` record into the array expected by
 * `<MiniLineChart>`.
 *
 * Mirrors the inline IIFE in the read tree of MarketSizeSection.tsx:
 *   - Empty / missing input → the 4-point default fallback.
 *   - A string input is parsed as JSON; on parse failure → the string-parse-failure fallback.
 *   - An object input maps each entry to a point (numericValue * 100, NaN → 100).
 */
export function projectionsToLineData(
  projectionsToUse: Record<string, string> | string | null | undefined,
): LineChartEntry[] {
  if (!projectionsToUse || Object.keys(projectionsToUse).length === 0) {
    return [
      { name: "2023", value: 100 },
      { name: "2024", value: 115 },
      { name: "2025", value: 132 },
      { name: "2026", value: 152 },
    ];
  }

  // If growthProjections is a string, try to parse it as JSON first
  if (typeof projectionsToUse === "string") {
    try {
      const parsedProjections = JSON.parse(projectionsToUse);
      if (parsedProjections && typeof parsedProjections === "object") {
        return Object.entries(parsedProjections).map(([year, value]) => {
          const numericValue = parseFloat(String(value));
          return {
            name: year,
            value: isNaN(numericValue) ? 100 : numericValue * 100,
          };
        });
      }
    } catch (_parseError) {
      // intentional: fall through to fallback below
    }

    // Only use fallback data if parsing fails
    return [
      { name: "2023", value: 100 },
      { name: "2024", value: 120 },
      { name: "2025", value: 144 },
      { name: "2026", value: 173 },
    ];
  }

  // If it's an object, transform it safely
  return Object.entries(projectionsToUse).map(([year, value]) => {
    const numericValue = parseFloat(value.toString());
    return {
      name: year,
      value: isNaN(numericValue) ? 100 : numericValue * 100,
    };
  });
}
