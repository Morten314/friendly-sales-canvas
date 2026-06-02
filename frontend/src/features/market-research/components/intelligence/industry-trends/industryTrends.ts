/**
 * industryTrends.ts
 *
 * Pure, render-independent helper functions extracted from IndustryTrendsSection.
 * No React, no fetch, no localStorage, no toast. Safe to unit-test in isolation.
 */

import type { IndustryTrendsData, IndustryTrendsRecommendations, TrendSnapshot } from "./types";

// ---------------------------------------------------------------------------
// normalizeDeletedSections
// ---------------------------------------------------------------------------

/**
 * Coerces any runtime shape of `industryTrendsDeletedSections` into a `Set<string>`.
 *
 * Mirrors the `useMemo` at lines 129-146 of IndustryTrendsSection.tsx:
 *   - `Set`            → returned as-is (same reference)
 *   - `string[]`       → `new Set(array)`
 *   - plain object     → `new Set(Object.keys(object))`
 *   - `null`/`undefined` → `new Set<string>()`
 */
export function normalizeDeletedSections(
  input: Set<string> | string[] | Record<string, unknown> | null | undefined,
): Set<string> {
  if (!input) {
    return new Set<string>();
  }
  if (input instanceof Set) {
    return input;
  }
  if (Array.isArray(input)) {
    return new Set(input);
  }
  if (typeof input === "object") {
    return new Set(Object.keys(input));
  }
  return new Set<string>();
}

// ---------------------------------------------------------------------------
// budgetToChartData
// ---------------------------------------------------------------------------

/** A single slice of the budget pie chart. */
export interface BudgetChartEntry {
  name: string;
  value: number;
  color: string;
}

/**
 * Converts a `technologyBudgetAllocation` record into the array expected by
 * `<MiniPieChart>`.
 *
 * Mirrors the inline IIFE at lines 1726-1747 of IndustryTrendsSection.tsx:
 *   - Each entry's value is parsed via `parseInt(String(v).replace("%", ""))`.
 *   - Falsy values produce 0 before parsing.
 *   - NaN results are coerced to 0.
 *   - Entries whose final numeric value is 0 are dropped (`filter(item => item.value > 0)`).
 *   - Colors cycle through an 8-entry palette.
 */
export function budgetToChartData(allocation: Record<string, string>): BudgetChartEntry[] {
  const colors = [
    "#8B5CF6",
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#06B6D4",
    "#84CC16",
    "#EC4899",
  ];

  return Object.entries(allocation)
    .map(([name, value], index) => {
      const numericValue = value ? parseInt(String(value).replace("%", "")) : 0;
      return {
        name: name,
        value: isNaN(numericValue) ? 0 : numericValue,
        color: colors[index % colors.length],
      };
    })
    .filter((item) => item.value > 0);
}

// ---------------------------------------------------------------------------
// buildEditSnapshot
// ---------------------------------------------------------------------------

/** Draft state values collected from the editing form. */
export interface EditDrafts {
  editExecutiveSummary: string;
  editAiAdoption: string;
  editCloudMigration: string;
  editRegulatory: string;
  editTrendSnapshots: TrendSnapshot[];
  editRegionalHotspots: Record<string, string>;
  editStrategicRecommendations: IndustryTrendsRecommendations;
  editRisks: string[];
  editVisualCharts: {
    aiAdoptionTrends: string[];
    technologyBudgetAllocation: Record<string, string>;
  };
}

/** The shaped pair written to localStorage by `handleSaveChanges`. */
export interface EditSnapshot {
  originalData: {
    executiveSummary: string;
    aiAdoption: string;
    cloudMigration: string;
    regulatory: string;
    trendSnapshots: TrendSnapshot[];
    regionalHotspots: Record<string, string>;
    strategicRecommendations: IndustryTrendsRecommendations;
    risks: string[];
    visualCharts: {
      aiAdoptionTrends: string[];
      technologyBudgetAllocation: Record<string, string>;
    };
  };
  modifiedData: {
    executiveSummary: string;
    aiAdoption: string;
    cloudMigration: string;
    regulatory: string;
    trendSnapshots: TrendSnapshot[];
    regionalHotspots: Record<string, string>;
    strategicRecommendations: IndustryTrendsRecommendations;
    risks: string[];
    visualCharts: {
      aiAdoptionTrends: string[];
      technologyBudgetAllocation: Record<string, string>;
    };
  };
}

/**
 * Shapes the "original" and "modified" payloads that `handleSaveChanges` builds
 * (lines 537-570 of IndustryTrendsSection.tsx) — the pure computation only.
 *
 * The caller is responsible for writing to `localStorage`, updating React state,
 * firing parent callbacks, and showing toasts.
 */
export function buildEditSnapshot(
  industryTrendsData: IndustryTrendsData | null | undefined,
  propRegionalHotspots: Record<string, string> | null | undefined,
  propVisualCharts:
    | {
        aiAdoptionTrends: string[];
        technologyBudgetAllocation: Record<string, string>;
      }
    | null
    | undefined,
  propRecommendations: IndustryTrendsRecommendations | null | undefined,
  propRisks: string[] | null | undefined,
  _propTrendSnapshots: TrendSnapshot[] | null | undefined,
  drafts: EditDrafts,
): EditSnapshot {
  const originalData = {
    executiveSummary: industryTrendsData?.executiveSummary || "",
    aiAdoption: industryTrendsData?.aiAdoption || "",
    cloudMigration: industryTrendsData?.cloudMigration || "",
    regulatory: industryTrendsData?.regulatory || "",
    trendSnapshots: industryTrendsData?.trendSnapshots || [],
    regionalHotspots: industryTrendsData?.regionalHotspots || propRegionalHotspots || {},
    strategicRecommendations: industryTrendsData?.strategicRecommendations ||
      industryTrendsData?.recommendations ||
      propRecommendations || {
        primaryFocus: "",
        marketEntry: "",
      },
    risks: industryTrendsData?.risks || propRisks || [],
    visualCharts: industryTrendsData?.visualCharts ||
      propVisualCharts || {
        aiAdoptionTrends: [],
        technologyBudgetAllocation: {},
      },
  };

  const modifiedData = {
    executiveSummary: drafts.editExecutiveSummary,
    aiAdoption: drafts.editAiAdoption,
    cloudMigration: drafts.editCloudMigration,
    regulatory: drafts.editRegulatory,
    trendSnapshots: drafts.editTrendSnapshots,
    regionalHotspots: drafts.editRegionalHotspots,
    strategicRecommendations: drafts.editStrategicRecommendations,
    risks: drafts.editRisks,
    visualCharts: drafts.editVisualCharts,
  };

  return { originalData, modifiedData };
}
