// ─── Shared Lead Data & Scoring Logic ────────────────────────────────────────

export type Rating = "High" | "Medium" | "Low";

export interface HeatmapLead {
  id: string;
  name: string;
  company: string;
  source: "HubSpot" | "Prospect List";
  ratings: Record<string, Rating>;
  totalScore: number;
  priority: "Tier 1" | "Tier 2" | "Tier 3";
}

export const REPORT_COLUMNS = [
  { key: "market-size", label: "Market Size & Opportunity", shortLabel: "Market Size" },
  { key: "industry-trends", label: "Industry Trends", shortLabel: "Industry" },
  { key: "competitor-landscape", label: "Competitor Landscape", shortLabel: "Competitor" },
  { key: "regulatory-compliance", label: "Regulatory & Compliance", shortLabel: "Regulatory" },
  { key: "market-entry", label: "Market Entry & Growth Strategy", shortLabel: "Market Entry" },
];

export const RATING_SCORE: Record<Rating, number> = { High: 20, Medium: 12, Low: 5 };

export function computeScore(ratings: Record<string, Rating>): number {
  return REPORT_COLUMNS.reduce((sum, col) => sum + (RATING_SCORE[ratings[col.key]] || 0), 0);
}

export function getPriority(score: number): "Tier 1" | "Tier 2" | "Tier 3" {
  if (score >= 75) return "Tier 1";
  if (score >= 50) return "Tier 2";
  return "Tier 3";
}

function assignRatings(id: string, matchedReports: string[]): Record<string, Rating> {
  const hash = parseInt(id, 10);
  const ratings: Record<string, Rating> = {};
  REPORT_COLUMNS.forEach((col) => {
    const isMatched = matchedReports.includes(col.key);
    if (isMatched) {
      ratings[col.key] = hash % 3 === 0 ? "Medium" : "High";
    } else {
      ratings[col.key] = hash % 2 === 0 ? "Medium" : "Low";
    }
  });
  return ratings;
}

const RAW_LEADS = [
  { id: "1", name: "Sarah Chen", company: "Acme Corp", source: "HubSpot" as const, matchedReports: ["market-size", "industry-trends"] },
  { id: "2", name: "James Okoro", company: "ScaleUp Inc", source: "HubSpot" as const, matchedReports: ["market-size", "competitor-landscape"] },
  { id: "3", name: "Priya Sharma", company: "NovaTech Solutions", source: "Prospect List" as const, matchedReports: ["industry-trends", "market-entry"] },
  { id: "4", name: "Marcus Liu", company: "DataDriven AI", source: "HubSpot" as const, matchedReports: ["competitor-landscape", "regulatory-compliance"] },
  { id: "5", name: "Elena Vasquez", company: "CloudFirst Systems", source: "Prospect List" as const, matchedReports: ["market-size", "market-entry"] },
  { id: "6", name: "David Park", company: "Momentum Labs", source: "HubSpot" as const, matchedReports: ["regulatory-compliance"] },
  { id: "7", name: "Amara Johnson", company: "RevStack AI", source: "Prospect List" as const, matchedReports: ["market-size", "industry-trends", "competitor-landscape"] },
  { id: "8", name: "Tobias Müller", company: "FinServ Digital", source: "HubSpot" as const, matchedReports: ["regulatory-compliance"] },
  { id: "9", name: "Lily Tran", company: "ShopScale D2C", source: "Prospect List" as const, matchedReports: ["market-entry"] },
  { id: "10", name: "Raj Patel", company: "OpsFlow SaaS", source: "HubSpot" as const, matchedReports: ["industry-trends", "market-entry"] },
  { id: "11", name: "Nina Kozlov", company: "BrightPath Analytics", source: "HubSpot" as const, matchedReports: ["market-size", "competitor-landscape"] },
  { id: "12", name: "Carlos Mendez", company: "GrowthLoop", source: "Prospect List" as const, matchedReports: ["market-size", "market-entry"] },
  { id: "13", name: "Aisha Okafor", company: "NexGen AI", source: "HubSpot" as const, matchedReports: ["market-size", "industry-trends"] },
  { id: "14", name: "Henrik Larsen", company: "NordicSoft AB", source: "Prospect List" as const, matchedReports: ["market-size", "regulatory-compliance"] },
  { id: "15", name: "Maya Tanaka", company: "CloudBridge Japan", source: "HubSpot" as const, matchedReports: ["market-size", "market-entry"] },
  { id: "16", name: "Zach Williams", company: "Pipeline AI", source: "Prospect List" as const, matchedReports: ["market-size", "competitor-landscape"] },
  { id: "17", name: "Fatima Al-Rashid", company: "VentureX MENA", source: "HubSpot" as const, matchedReports: ["market-size", "industry-trends"] },
  { id: "18", name: "Tom Bradley", company: "SaasPro Inc", source: "Prospect List" as const, matchedReports: ["market-size", "competitor-landscape"] },
  { id: "19", name: "Suki Patel", company: "ScaleForce", source: "HubSpot" as const, matchedReports: ["market-size", "market-entry"] },
  { id: "20", name: "Lena Fischer", company: "DataVault EU", source: "Prospect List" as const, matchedReports: ["market-size", "regulatory-compliance"] },
  { id: "21", name: "Ben Adeyemi", company: "TractionHQ", source: "HubSpot" as const, matchedReports: ["market-size", "competitor-landscape"] },
  { id: "22", name: "Clara Rossi", company: "FinCloud Italia", source: "Prospect List" as const, matchedReports: ["market-size", "market-entry"] },
  { id: "23", name: "Derek Ng", company: "QuantumSales SG", source: "HubSpot" as const, matchedReports: ["market-size", "industry-trends"] },
  { id: "24", name: "Rachel Kim", company: "OrbitSaaS", source: "Prospect List" as const, matchedReports: ["market-size"] },
  { id: "25", name: "Oscar Hernandez", company: "RevGrowth LATAM", source: "HubSpot" as const, matchedReports: ["industry-trends", "competitor-landscape"] },
  { id: "26", name: "Ingrid Johansson", company: "TechScale Nordic", source: "Prospect List" as const, matchedReports: ["industry-trends", "market-entry"] },
  { id: "27", name: "Wei Zhang", company: "AI Venture", source: "HubSpot" as const, matchedReports: ["industry-trends", "competitor-landscape"] },
  { id: "28", name: "Sophie Martin", company: "GrowthEngine FR", source: "Prospect List" as const, matchedReports: ["industry-trends", "market-entry"] },
  { id: "29", name: "Alex Petrov", company: "DataOps Sofia", source: "HubSpot" as const, matchedReports: ["industry-trends", "competitor-landscape"] },
  { id: "30", name: "Lisa Chang", company: "RevOps Taiwan", source: "Prospect List" as const, matchedReports: ["industry-trends"] },
  { id: "31", name: "Patrick O'Brien", company: "SaaSBridge", source: "HubSpot" as const, matchedReports: ["competitor-landscape"] },
  { id: "32", name: "Mia Santos", company: "CloudScale Brasil", source: "Prospect List" as const, matchedReports: ["competitor-landscape"] },
  { id: "33", name: "Yuki Yamamoto", company: "NextSaaS Japan", source: "HubSpot" as const, matchedReports: ["competitor-landscape", "regulatory-compliance"] },
  { id: "34", name: "Ahmed Hassan", company: "ScaleUp Cairo", source: "Prospect List" as const, matchedReports: ["competitor-landscape"] },
  { id: "35", name: "Eva Novak", company: "FintechPro CZ", source: "HubSpot" as const, matchedReports: ["competitor-landscape"] },
  { id: "36", name: "Ryan Murphy", company: "GrowthStack AU", source: "Prospect List" as const, matchedReports: ["competitor-landscape"] },
  { id: "37", name: "Anita Desai", company: "RevSync India", source: "HubSpot" as const, matchedReports: ["competitor-landscape"] },
  { id: "38", name: "Lucas Weber", company: "ComplianceIO", source: "Prospect List" as const, matchedReports: ["competitor-landscape"] },
  { id: "39", name: "Grace Lee", company: "MarketPulse SG", source: "HubSpot" as const, matchedReports: ["market-size", "market-entry"] },
  { id: "40", name: "Daniel Costa", company: "RevHub Portugal", source: "Prospect List" as const, matchedReports: ["market-entry", "industry-trends"] },
  { id: "41", name: "Nadia Volkov", company: "SaaSLaunch", source: "HubSpot" as const, matchedReports: ["market-entry"] },
  { id: "42", name: "Chris Taylor", company: "ScalePath Canada", source: "Prospect List" as const, matchedReports: ["market-entry", "market-size"] },
  { id: "43", name: "Priscilla Osei", company: "GrowthWave Africa", source: "HubSpot" as const, matchedReports: ["market-entry"] },
  { id: "44", name: "Kevin Lim", company: "RevScale MY", source: "Prospect List" as const, matchedReports: ["regulatory-compliance"] },
];

const ratingOverrides: Record<string, Record<string, Rating>> = {
  "1": { "market-size": "High", "industry-trends": "High", "competitor-landscape": "Medium", "regulatory-compliance": "High", "market-entry": "High" },
  "2": { "market-size": "High", "industry-trends": "High", "competitor-landscape": "High", "regulatory-compliance": "Medium", "market-entry": "Medium" },
  "3": { "market-size": "High", "industry-trends": "High", "competitor-landscape": "Medium", "regulatory-compliance": "Medium", "market-entry": "High" },
  "4": { "market-size": "Low", "industry-trends": "Medium", "competitor-landscape": "High", "regulatory-compliance": "High", "market-entry": "Low" },
  "5": { "market-size": "High", "industry-trends": "Medium", "competitor-landscape": "Low", "regulatory-compliance": "Medium", "market-entry": "High" },
  "6": { "market-size": "Medium", "industry-trends": "Low", "competitor-landscape": "Medium", "regulatory-compliance": "High", "market-entry": "Low" },
  "7": { "market-size": "High", "industry-trends": "High", "competitor-landscape": "High", "regulatory-compliance": "Low", "market-entry": "High" },
  "8": { "market-size": "Low", "industry-trends": "Medium", "competitor-landscape": "Low", "regulatory-compliance": "High", "market-entry": "Low" },
  "9": { "market-size": "Medium", "industry-trends": "Low", "competitor-landscape": "Low", "regulatory-compliance": "Low", "market-entry": "High" },
  "10": { "market-size": "Medium", "industry-trends": "High", "competitor-landscape": "Low", "regulatory-compliance": "Medium", "market-entry": "High" },
};

function buildHeatmapLeads(): HeatmapLead[] {
  return RAW_LEADS.map((lead) => {
    const ratings = ratingOverrides[lead.id] || assignRatings(lead.id, lead.matchedReports);
    const totalScore = computeScore(ratings);
    return {
      id: lead.id,
      name: lead.name,
      company: lead.company,
      source: lead.source,
      ratings,
      totalScore,
      priority: getPriority(totalScore),
    };
  });
}

export const heatmapLeads = buildHeatmapLeads();

// ─── Tier Intelligence Data ──────────────────────────────────────────────────

export interface TierIntelligence {
  label: string;
  fitScore: number;
  whyItFits: string;
  keyRisks: string;
  recommendedAction: string;
}

export const TIER_INTELLIGENCE: Record<string, TierIntelligence> = {
  "Tier 1": {
    label: "Prioritise Now",
    fitScore: 82,
    whyItFits: "Strong alignment with your ICP across firmographics, buying signals, and decision-maker engagement. Matches 4+ report dimensions with high scores.",
    keyRisks: "Competitive pressure from incumbents; longer enterprise sales cycles may delay conversion.",
    recommendedAction: "Prioritise for immediate outreach. Assign dedicated AEs and personalise messaging using Scout intelligence.",
  },
  "Tier 2": {
    label: "Evaluate & Engage",
    fitScore: 58,
    whyItFits: "Partial ICP match — strong in 2–3 report dimensions but gaps in market timing or budget signals. Good potential with nurturing.",
    keyRisks: "Budget constraints or unclear buying timelines; may require longer qualification cycles.",
    recommendedAction: "Add to nurture sequences. Monitor for trigger events and re-score monthly as new intelligence arrives.",
  },
  "Tier 3": {
    label: "Nurture & Monitor",
    fitScore: 28,
    whyItFits: "Limited overlap with current ICP criteria. May match on industry or region but lack key buying signals or decision-maker access.",
    keyRisks: "Low conversion probability; resource investment unlikely to yield near-term ROI.",
    recommendedAction: "Park for now. Revisit if ICP evolves or new market signals emerge. Use for market awareness campaigns only.",
  },
};

// ─── Computed report component scores ────────────────────────────────────────

export interface ReportComponentScore {
  name: string;
  key: string;
  high: number;
  medium: number;
  low: number;
  totalScore: number;
}

export function getReportComponentScores(): ReportComponentScore[] {
  return REPORT_COLUMNS.map((col) => {
    let high = 0, medium = 0, low = 0;
    heatmapLeads.forEach((lead) => {
      const r = lead.ratings[col.key];
      if (r === "High") high++;
      else if (r === "Medium") medium++;
      else low++;
    });
    const totalScore = high * 20 + medium * 12 + low * 5;
    return {
      name: col.shortLabel,
      key: col.key,
      high,
      medium,
      low,
      totalScore,
    };
  }).sort((a, b) => b.totalScore - a.totalScore);
}
