import type { HeatmapLead, Rating } from "@/components/market-research/lead-stream/leadData";
import { getPriority } from "@/components/market-research/lead-stream/leadData";

export function scorePercentToRating(score: number): Rating {
  if (score >= 75) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

export interface MarketScoresApiRow {
  lead_id: string;
  org_id: string;
  file_id?: string;
  company_name: string;
  score_market_size_opportunity: number;
  score_industry_trends_report: number;
  score_competitor_landscape: number;
  score_regulatory_compliance_highlights: number;
  score_market_entry_growth_strategy: number;
  combined_score: number;
  scoring_status?: string;
  scored_at?: string;
  updated_at?: string;
}

function num(v: unknown): number {
  const x = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : 0;
}

/** Accept snake_case or camelCase; tolerate string numbers from JSON gateways */
export function mapMarketScoresRowToHeatmapLead(row: MarketScoresApiRow): HeatmapLead {
  const ratings: Record<string, Rating> = {
    "market-size": scorePercentToRating(num(row.score_market_size_opportunity)),
    "industry-trends": scorePercentToRating(num(row.score_industry_trends_report)),
    "competitor-landscape": scorePercentToRating(num(row.score_competitor_landscape)),
    "regulatory-compliance": scorePercentToRating(num(row.score_regulatory_compliance_highlights)),
    "market-entry": scorePercentToRating(num(row.score_market_entry_growth_strategy)),
  };
  const combined = num(row.combined_score);
  const totalScore = Math.round(combined * 10) / 10;
  const company =
    String(row.company_name ?? "").trim() || "—";
  return {
    id: String(row.lead_id),
    name: company,
    company,
    source: "Prospect List",
    ratings,
    totalScore,
    priority: getPriority(Math.round(combined)),
  };
}

/**
 * Extract row objects from various backend envelope shapes.
 */
export function extractMarketScoreRowsFromResponse(data: unknown): Record<string, unknown>[] {
  if (data == null || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;

  if (Array.isArray(d.rows)) return d.rows as Record<string, unknown>[];
  if (Array.isArray(d.leads)) return d.leads as Record<string, unknown>[];
  if (Array.isArray(d.results)) return d.results as Record<string, unknown>[];

  const inner = d.data;
  if (Array.isArray(inner)) return inner as Record<string, unknown>[];
  if (inner && typeof inner === "object") {
    const di = inner as Record<string, unknown>;
    if (Array.isArray(di.rows)) return di.rows as Record<string, unknown>[];
    if (Array.isArray(di.leads)) return di.leads as Record<string, unknown>[];
  }

  return [];
}

/**
 * Map one loosely-typed API object to HeatmapLead (never throws).
 */
export function heatmapLeadFromUnknownRow(raw: Record<string, unknown>): HeatmapLead | null {
  const leadId = raw.lead_id ?? raw.leadId;
  if (leadId === undefined || leadId === null || String(leadId).trim() === "") return null;

  const company =
    String(raw.company_name ?? raw.companyName ?? raw.company ?? "").trim() || "—";

  const row: MarketScoresApiRow = {
    lead_id: String(leadId),
    org_id: String(raw.org_id ?? raw.orgId ?? ""),
    company_name: company,
    score_market_size_opportunity: num(raw.score_market_size_opportunity ?? raw.scoreMarketSizeOpportunity),
    score_industry_trends_report: num(raw.score_industry_trends_report ?? raw.scoreIndustryTrendsReport),
    score_competitor_landscape: num(raw.score_competitor_landscape ?? raw.scoreCompetitorLandscape),
    score_regulatory_compliance_highlights: num(
      raw.score_regulatory_compliance_highlights ?? raw.scoreRegulatoryComplianceHighlights
    ),
    score_market_entry_growth_strategy: num(raw.score_market_entry_growth_strategy ?? raw.scoreMarketEntryGrowthStrategy),
    combined_score: num(raw.combined_score ?? raw.combinedScore),
    scoring_status: raw.scoring_status != null ? String(raw.scoring_status) : undefined,
    scored_at: raw.scored_at != null ? String(raw.scored_at) : undefined,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
  };

  return mapMarketScoresRowToHeatmapLead(row);
}
