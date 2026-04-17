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

export function mapMarketScoresRowToHeatmapLead(row: MarketScoresApiRow): HeatmapLead {
  const ratings: Record<string, Rating> = {
    "market-size": scorePercentToRating(row.score_market_size_opportunity),
    "industry-trends": scorePercentToRating(row.score_industry_trends_report),
    "competitor-landscape": scorePercentToRating(row.score_competitor_landscape),
    "regulatory-compliance": scorePercentToRating(row.score_regulatory_compliance_highlights),
    "market-entry": scorePercentToRating(row.score_market_entry_growth_strategy),
  };
  const totalScore = Math.round(Number(row.combined_score) || 0);
  return {
    id: row.lead_id,
    name: row.company_name,
    company: row.company_name,
    source: "Prospect List",
    ratings,
    totalScore,
    priority: getPriority(totalScore),
  };
}
