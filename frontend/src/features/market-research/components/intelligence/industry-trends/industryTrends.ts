/**
 * industryTrends.ts
 *
 * Pure, render-independent helper functions extracted from IndustryTrendsSection.
 * No React, no fetch, no localStorage, no toast. Safe to unit-test in isolation.
 */

import type { IndustryTrendsRecommendations, TrendSnapshot, VisualChartsData } from "./types";

// ---------------------------------------------------------------------------
// normalizeDeletedSections
// ---------------------------------------------------------------------------

/**
 * Coerces any runtime shape of `industryTrendsDeletedSections` into a `Set<string>`.
 * Used by the `normalizedDeletedSections` useMemo in IndustryTrendsSection.
 *
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
const BUDGET_COLORS = [
  "#8B5CF6",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#06B6D4",
  "#84CC16",
  "#EC4899",
];

export function budgetToChartData(allocation: Record<string, string>): BudgetChartEntry[] {
  return Object.entries(allocation)
    .map(([name, value], index) => {
      const numericValue = value ? parseInt(String(value).replace("%", "")) : 0;
      return {
        name: name,
        value: isNaN(numericValue) ? 0 : numericValue,
        color: BUDGET_COLORS[index % BUDGET_COLORS.length],
      };
    })
    .filter((item) => item.value > 0);
}

// ---------------------------------------------------------------------------
// buildEditSnapshot
// ---------------------------------------------------------------------------

/** The already-normalized display values read from the hook view-model. */
export interface DisplayData {
  executiveSummary: string;
  aiAdoption: string;
  cloudMigration: string;
  regulatory: string;
  trendSnapshots: TrendSnapshot[];
  regionalHotspots: Record<string, string>;
  strategicRecommendations: IndustryTrendsRecommendations;
  risks: string[];
  visualCharts: VisualChartsData;
}

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
  editVisualCharts: VisualChartsData;
}

/** The shaped pair written to localStorage by `handleSaveChanges`. */
export interface EditSnapshot {
  originalData: DisplayData;
  modifiedData: DisplayData;
}

/**
 * Shapes the "original" and "modified" payloads that `handleSaveChanges` writes to
 * localStorage — the pure computation only.
 *
 * `displayData` is the already-normalized hook view-model computed by the container.
 * The caller is responsible for writing to `localStorage`, updating React state,
 * firing parent callbacks, and showing toasts.
 */
export function buildEditSnapshot(displayData: DisplayData, drafts: EditDrafts): EditSnapshot {
  const originalData: DisplayData = {
    executiveSummary: displayData.executiveSummary,
    aiAdoption: displayData.aiAdoption,
    cloudMigration: displayData.cloudMigration,
    regulatory: displayData.regulatory,
    trendSnapshots: displayData.trendSnapshots,
    regionalHotspots: displayData.regionalHotspots,
    strategicRecommendations: displayData.strategicRecommendations,
    risks: displayData.risks,
    visualCharts: displayData.visualCharts,
  };

  const modifiedData: DisplayData = {
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
