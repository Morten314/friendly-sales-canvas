import type { HeatmapLead, Rating } from "@/shared/lib/leadData";
import { getPriority } from "@/shared/lib/leadData";

export function scorePercentToRating(score: number): Rating {
  if (score >= 75) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

export interface MarketScoresApiRow {
  lead_id: string;
  org_id: string;
  file_id?: string;
  source?: string | null;
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

/** First non-empty string from known keys (snake/camel); also checks one nested `lead` object. */
function pickFirstString(raw: Record<string, unknown>, keys: string[]): string {
  const tryObj = (o: Record<string, unknown>) => {
    for (const k of keys) {
      if (!(k in o)) continue;
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
    return "";
  };
  let s = tryObj(raw);
  if (s) return s;
  const nested = raw.lead;
  if (nested && typeof nested === "object" && nested !== null && !Array.isArray(nested)) {
    s = tryObj(nested as Record<string, unknown>);
  }
  return s || "";
}

/**
 * Company / account label for the "Company" column — backend may use different keys or nest under `company`.
 */
function pickCompanyName(raw: Record<string, unknown>): string {
  const keys = [
    "company_name",
    "companyName",
    "organization_name",
    "organizationName",
    "account_name",
    "accountName",
    "company",
  ];
  let s = pickFirstString(raw, keys);
  if (s) return s;
  const co = raw.company;
  if (co && typeof co === "object" && co !== null && !Array.isArray(co)) {
    const o = co as Record<string, unknown>;
    s = pickFirstString(o, ["name", "company_name", "companyName", "title"]);
  }
  return s || "";
}

/**
 * Contact / lead display name for the "Lead" column — optional; falls back to company when absent.
 */
function pickLeadDisplayName(raw: Record<string, unknown>, companyFallback: string): string {
  const keys = [
    "contact_name",
    "contactName",
    "lead_name",
    "leadName",
    "full_name",
    "fullName",
    "contact_full_name",
    "person_name",
    "name",
  ];
  const s = pickFirstString(raw, keys);
  if (s) return s;
  return companyFallback || "—";
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
  const company = String(row.company_name ?? "").trim() || "—";
  const name = company;
  return {
    id: String(row.lead_id),
    name,
    company,
    source: row.source ?? null,
    ratings,
    totalScore,
    priority: getPriority(Math.round(combined)),
    scored: true,
  };
}

/**
 * Map one raw /api/v2/leads node to an UNscored HeatmapLead. Used so the Scout
 * Lead Stream surfaces an org's real leads (e.g. Apollo-discovered) even before
 * any market-scoring run — the score columns render "—" until scored. Reuses the
 * same loose field-picking as the market-scores mapper. Never throws; returns
 * null when there is no usable lead id.
 */
export function heatmapLeadFromV2Lead(raw: Record<string, unknown>): HeatmapLead | null {
  const leadId =
    raw.lead_id ?? raw.leadId ?? (raw.lead as Record<string, unknown> | undefined)?.lead_id;
  if (leadId === undefined || leadId === null || String(leadId).trim() === "") return null;

  const company = pickCompanyName(raw) || "—";
  const name = pickLeadDisplayName(raw, company);
  const emailStatus =
    typeof raw.email_status === "string"
      ? raw.email_status
      : typeof (raw as { emailStatus?: unknown }).emailStatus === "string"
        ? ((raw as { emailStatus?: string }).emailStatus ?? null)
        : null;

  return {
    id: String(leadId),
    name,
    company,
    source: typeof raw.source === "string" ? raw.source : null,
    ratings: {},
    totalScore: 0,
    // Placeholder tier; the table renders "—" (not this value) for unscored rows.
    priority: "Tier 3",
    email_status: emailStatus,
    scored: false,
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
  const leadId =
    raw.lead_id ?? raw.leadId ?? (raw.lead as Record<string, unknown> | undefined)?.lead_id;
  if (leadId === undefined || leadId === null || String(leadId).trim() === "") return null;

  const company = pickCompanyName(raw) || "—";
  const name = pickLeadDisplayName(raw, company);

  if (import.meta.env.DEV && company === "—") {
    console.warn("[Lead Stream] No company label resolved for row; check API field names.", {
      lead_id: leadId,
      topLevelKeys: Object.keys(raw),
      sample: {
        company_name: raw.company_name,
        companyName: raw.companyName,
        company: raw.company,
        name: raw.name,
      },
    });
  }

  const row: MarketScoresApiRow = {
    lead_id: String(leadId),
    org_id: String(raw.org_id ?? raw.orgId ?? ""),
    company_name: company,
    score_market_size_opportunity: num(
      raw.score_market_size_opportunity ?? raw.scoreMarketSizeOpportunity,
    ),
    score_industry_trends_report: num(
      raw.score_industry_trends_report ?? raw.scoreIndustryTrendsReport,
    ),
    score_competitor_landscape: num(raw.score_competitor_landscape ?? raw.scoreCompetitorLandscape),
    score_regulatory_compliance_highlights: num(
      raw.score_regulatory_compliance_highlights ?? raw.scoreRegulatoryComplianceHighlights,
    ),
    score_market_entry_growth_strategy: num(
      raw.score_market_entry_growth_strategy ?? raw.scoreMarketEntryGrowthStrategy,
    ),
    combined_score: num(raw.combined_score ?? raw.combinedScore),
    source: typeof raw.source === "string" ? raw.source : null,
    scoring_status: raw.scoring_status != null ? String(raw.scoring_status) : undefined,
    scored_at: raw.scored_at != null ? String(raw.scored_at) : undefined,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
  };

  const mapped = mapMarketScoresRowToHeatmapLead(row);
  return { ...mapped, name, company };
}
