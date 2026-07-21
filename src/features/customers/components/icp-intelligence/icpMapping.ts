import type { ExistingICP, SuggestedICP, ICPAnalysis } from "../../types";

import { mergeProfilerAcceptedIcpDisplay, PROFILER_ICP_DISPLAY_KEY } from "@/shared/profiler";
import type { UntypedProfilerIcpRecord } from "@/shared/types/escape-hatches";

export const analyzeICP = (icp: ExistingICP): ICPAnalysis => {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const missing: string[] = [];

  if (icp.industry) strengths.push(`Clear industry focus: ${icp.industry}`);
  else missing.push("No industry specified — targeting is too broad");

  if (icp.buyerRole) strengths.push(`Defined buyer role: ${icp.buyerRole}`);
  else missing.push("No buyer role — unclear who to engage");

  if (icp.companySize) strengths.push(`Company size defined: ${icp.companySize}`);
  else missing.push("No company size filter");

  if (icp.geography) strengths.push(`Geographic focus: ${icp.geography}`);
  else weaknesses.push("No geographic focus — could dilute outreach");

  if (icp.fitConfidence === "Low" || icp.fitConfidence === "Medium") {
    weaknesses.push(`Fit confidence is ${icp.fitConfidence} — may need tighter criteria`);
  }

  if (!icp.buyerRole?.includes(",") && !icp.buyerRole?.includes("/")) {
    weaknesses.push("Single buyer role — consider adding secondary decision-makers");
  }

  const broadNarrow =
    strengths.length >= 3 && weaknesses.length <= 1
      ? "Well-balanced targeting scope"
      : weaknesses.length > strengths.length
        ? "Too broad — consider adding more filters to tighten targeting"
        : "Slightly narrow — expanding regions or roles could increase pipeline";

  const confidence: "High" | "Medium" | "Low" =
    strengths.length >= 4 ? "High" : strengths.length >= 2 ? "Medium" : "Low";

  return {
    interpretation: `Profiler sees "${icp.name}" as targeting ${icp.industry || "unspecified industry"} companies (${icp.companySize || "any size"}) in ${icp.geography || "all regions"}, engaging ${icp.buyerRole || "unspecified roles"}.`,
    strengths,
    weaknesses,
    missing,
    broadNarrow,
    confidence,
  };
};

// --- Confidence badge color ---
export const confidenceColor = (c: string) => {
  if (c === "High") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (c === "Medium") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-muted text-muted-foreground border-border";
};

/** Build a Current-ICPs row immediately after accept (before GET catches up). */
export const mapAcceptedSuggestedToExisting = (
  icp: SuggestedICP,
  persistedId: string,
): ExistingICP => ({
  id: persistedId,
  name: icp.name,
  geography: icp.regions?.length ? icp.regions.join(", ") : undefined,
  industry: icp.industry,
  companySize: icp.companySize,
  buyerRole: icp.decisionMakers?.length ? icp.decisionMakers.join(", ") : undefined,
  fitConfidence: icp.confidenceScore || "Medium",
  status: "active",
});

// Map customer profile ICP (Mission Control) to ExistingICP format
export const mapCustomerProfileICPToExisting = (
  icp: UntypedProfilerIcpRecord,
  index: number,
): ExistingICP => {
  const merged = mergeProfilerAcceptedIcpDisplay(icp);
  const industryArr = Array.isArray(merged.industry)
    ? merged.industry
    : [merged.industry].filter(Boolean);
  const companySizeArr = Array.isArray(merged.company_size)
    ? merged.company_size
    : Array.isArray(merged.companySize)
      ? merged.companySize
      : [];
  const buyerRoleArr = Array.isArray(merged.buyer_role)
    ? merged.buyer_role
    : Array.isArray(merged.buyerRole)
      ? merged.buyerRole
      : [];
  const locationArr = Array.isArray(merged.location) ? merged.location : [];
  const primaryRegion = merged.primary_region || merged.primaryRegion || "";
  let name =
    merged.name ||
    (industryArr[0] ? `${industryArr[0]} - ${primaryRegion || "Global"}` : `ICP ${index + 1}`);
  const nameLooksPlaceholder =
    !String(name || "").trim() || String(name).trim().toLowerCase() === "unknown";
  if (nameLooksPlaceholder && merged.id) {
    try {
      const raw = localStorage.getItem(PROFILER_ICP_DISPLAY_KEY(merged.id));
      if (raw) {
        const m = JSON.parse(raw) as { displayName?: string };
        if (m.displayName) name = m.displayName;
      }
    } catch {
      /* ignore */
    }
  }
  return {
    id: String(merged.id || icp?.icp_id || icp?.customer_profile_icp_id || `icp-${index + 1}`),
    name,
    geography: primaryRegion || (locationArr.length > 0 ? locationArr.join(", ") : undefined),
    industry: industryArr.join(", ") || undefined,
    companySize: companySizeArr.join(", ") || undefined,
    buyerRole: buyerRoleArr.join(", ") || undefined,
    fitConfidence: (merged.fit_confidence || merged.fitConfidence || "medium") as string,
    status: (merged.status || "active") as "active" | "inactive",
  };
};

/** First non-empty string among candidates (GET /icp may use firmographics vs root). */
const coalesceString = (...vals: unknown[]): string | undefined => {
  for (const v of vals) {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return undefined;
};

/** Keys that belong to the "full report" block when returned on the same object as card fields (GET /icp). */
const REPORT_FIELD_KEYS = [
  "title",
  "is_new",
  "is_agentic",
  "why_suggested",
  "how_it_differs",
  "firmographics",
  "key_decision_makers",
  "pain_points_and_triggers",
  "competitors",
] as const;

const buildFullReportFromRoot = (
  item: UntypedProfilerIcpRecord,
): Record<string, unknown> | undefined => {
  if (item == null || typeof item !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const k of REPORT_FIELD_KEYS) {
    if (item[k] !== undefined && item[k] !== null) out[k] = item[k];
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

/** Nested report object from GET /icp (aliases + optional `data` wrapper), or report fields at root. */
const extractFullReportFromApiItem = (
  item: UntypedProfilerIcpRecord,
): Record<string, unknown> | undefined => {
  const raw =
    item?.report ??
    item?.fullReport ??
    item?.full_report ??
    item?.icp_report ??
    item?.profiler_report ??
    item?.profilerReport;
  if (raw != null && typeof raw === "object") {
    const inner =
      "data" in raw && raw.data != null && typeof raw.data === "object"
        ? (raw as { data: unknown }).data
        : raw;
    if (inner != null && typeof inner === "object") {
      const rec = inner as Record<string, unknown>;
      if (Object.keys(rec).length > 0) return rec;
    }
  }
  return buildFullReportFromRoot(item);
};

/**
 * Normalizes GET /icp JSON to an array of ICP items. Backend may return:
 * - an array; suggestedICPs / icps / results / items; { data: [...] }; { data: { single ICP } }; or a single root object.
 */
export const normalizeIcpGetResponse = (
  icpData: UntypedProfilerIcpRecord,
): UntypedProfilerIcpRecord[] => {
  if (icpData == null) return [];
  if (Array.isArray(icpData)) return icpData;

  const unwrapped =
    icpData.data !== undefined
      ? icpData.data
      : icpData.payload !== undefined
        ? icpData.payload
        : icpData.result !== undefined
          ? icpData.result
          : undefined;

  if (unwrapped !== undefined) {
    if (Array.isArray(unwrapped)) return unwrapped;
    if (unwrapped && typeof unwrapped === "object" && !Array.isArray(unwrapped)) {
      const u = unwrapped as Record<string, unknown>;
      const nestedList = u.icps ?? u.suggestedICPs ?? u.results ?? u.items;
      if (Array.isArray(nestedList) && nestedList.length > 0)
        return nestedList as UntypedProfilerIcpRecord[];
      const looksLikeIcp =
        u.id != null ||
        u.title != null ||
        u.firmographics != null ||
        typeof u.industry === "string" ||
        typeof u.segment === "string";
      if (looksLikeIcp) return [unwrapped];
    }
  }

  const candidates = [
    icpData.suggestedICPs,
    icpData.icps,
    icpData.results,
    icpData.items,
    icpData.recommendations,
    icpData.profiles,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }

  if (typeof icpData === "object") {
    const u = icpData as Record<string, unknown>;
    const looksLikeIcp =
      u.id != null ||
      u.title != null ||
      u.firmographics != null ||
      typeof u.industry === "string" ||
      typeof u.segment === "string";
    if (looksLikeIcp) return [icpData];
  }

  return [];
};

export const hasBackendFullReport = (icp: SuggestedICP) =>
  Boolean(
    icp.fullReport && typeof icp.fullReport === "object" && Object.keys(icp.fullReport).length > 0,
  );

// Map /icp API response item to SuggestedICP format
// API returns: id, industry, segment, companySize, decisionMakers, regions, keyAttributes,
// growthIndicator, whySuggested, confidenceScore, marketSize, growth, topPainPoint, buyingTriggers, competitors,
// and optionally nested report payload (fullReport) for View Full Report
export const mapApiICPToSuggested = (
  item: UntypedProfilerIcpRecord,
  index: number,
  type: "refined" | "new" = "new",
): SuggestedICP => {
  const fullReport = extractFullReportFromApiItem(item);
  const firmo =
    item.firmographics && typeof item.firmographics === "object"
      ? (item.firmographics as Record<string, unknown>)
      : {};

  const industry =
    coalesceString(item.industry, item.Industry, firmo.industry, firmo.Industry) ??
    "Unknown Industry";
  const segment =
    coalesceString(item.segment, item.Segment, item.market_segment, firmo.segment, firmo.Segment) ??
    "Unknown Segment";
  const companySize =
    coalesceString(
      item.companySize,
      item.company_size,
      item.size,
      firmo.company_size,
      firmo.companySize,
    ) ?? "Unknown Size";
  const marketSize = coalesceString(
    item.marketSize,
    item.market_size,
    firmo.market_size,
    firmo.marketSize,
  );

  const name =
    coalesceString(item.title, item.name, item.segment, item.Segment, firmo.segment as string) ||
    `Recommended ICP ${index + 1}`;

  const decisionMakersRaw = Array.isArray(item.decisionMakers)
    ? item.decisionMakers
    : Array.isArray(item.decision_makers)
      ? item.decision_makers
      : Array.isArray(item.key_decision_makers)
        ? item.key_decision_makers
        : typeof item.decisionMakers === "string"
          ? item.decisionMakers.split(",").map((s: string) => s.trim())
          : [];
  const decisionMakers =
    decisionMakersRaw.length > 0 ? decisionMakersRaw : ["CTO", "Head of Engineering"];

  let regions: string[] = [];
  if (Array.isArray(item.regions)) regions = item.regions.map(String);
  else if (Array.isArray(item.target_markets)) regions = item.target_markets.map(String);
  else if (typeof item.regions === "string")
    regions = item.regions
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
  if (regions.length === 0 && !("regions" in item) && !("target_markets" in item)) {
    regions = ["Unknown Region"];
  }

  const whyFromApi = Array.isArray(item.whySuggested)
    ? item.whySuggested
    : Array.isArray(item.why_suggested)
      ? item.why_suggested
      : [];

  const whyFallback =
    fullReport != null
      ? []
      : whyFromApi.length > 0
        ? whyFromApi
        : item.opportunityUnlocked
          ? [item.opportunityUnlocked]
          : ["AI-recommended based on your profile"];

  return {
    id: String(item.id ?? item._id ?? `icp-${Date.now()}-${index}`),
    name,
    type: (item.type === "refined" || item.type === "new" ? item.type : type) as "refined" | "new",
    sourceICPId: item.sourceICPId || item.source_icp_id,
    sourceICPName: item.sourceICPName || item.source_icp_name,
    industry,
    segment,
    companySize,
    decisionMakers,
    regions,
    keyAttributes: Array.isArray(item.keyAttributes)
      ? item.keyAttributes
      : Array.isArray(item.key_attributes)
        ? item.key_attributes
        : typeof item.keyAttributes === "string"
          ? item.keyAttributes.split(",").map((s: string) => s.trim())
          : ["Scalability", "Performance"],
    growthIndicator: item.growthIndicator || item.growth_indicator,
    whySuggested: whyFallback,
    whatChanged: Array.isArray(item.whatChanged)
      ? item.whatChanged
      : Array.isArray(item.what_changed)
        ? item.what_changed
        : undefined,
    opportunityUnlocked: item.opportunityUnlocked || item.opportunity_unlocked,
    confidenceScore: (item.confidenceScore || item.confidence_score || "Medium") as
      | "High"
      | "Medium"
      | "Low",
    marketSize,
    growth: item.growth,
    topPainPoint: item.topPainPoint || item.top_pain_point,
    buyingTriggers: item.buyingTriggers || item.buying_triggers,
    competitors: item.competitors,
    fullReport,
  };
};
