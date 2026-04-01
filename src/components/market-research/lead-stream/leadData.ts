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

// ─── Per-Component Rating Explanations ──────────────────────────────────────

export interface ComponentExplanations {
  High: string;
  Medium: string;
  Low: string;
}

export const COMPONENT_EXPLANATIONS: Record<string, ComponentExplanations> = {
  "market-size": {
    High: "Operating in a large, expanding TAM with strong demand signals. Company size and revenue trajectory align with high-value segments.",
    Medium: "Addressable market is moderate. Some growth indicators present but TAM may be niche or saturating in their vertical.",
    Low: "Limited market opportunity. Small or contracting TAM with few expansion signals in their sector.",
  },
  "industry-trends": {
    High: "Strongly aligned with current macro trends — digital transformation, AI adoption, or regulatory tailwinds driving demand in their space.",
    Medium: "Partial alignment with industry trends. Some tailwinds present but adoption pace or relevance is moderate.",
    Low: "Weak trend alignment. Operating in a stable or declining segment with few catalysts for near-term growth.",
  },
  "competitor-landscape": {
    High: "Favorable competitive positioning — few dominant incumbents, or clear differentiation opportunity for your solution.",
    Medium: "Moderate competitive density. Incumbents present but switching costs or dissatisfaction create openings.",
    Low: "Highly competitive space with entrenched incumbents. High switching costs and strong vendor lock-in reduce opportunity.",
  },
  "regulatory-compliance": {
    High: "Strong regulatory tailwinds — new compliance mandates or standards creating urgent demand for solutions in their category.",
    Medium: "Some regulatory considerations present. Compliance needs exist but aren't urgent drivers of purchasing decisions.",
    Low: "Minimal regulatory pressure. No imminent compliance requirements driving urgency in this segment.",
  },
  "market-entry": {
    High: "Clear entry path with low barriers, established channels, and strong partner ecosystem. Timing aligns with budget cycles.",
    Medium: "Entry is feasible but requires relationship-building or channel development. Timing is acceptable but not optimal.",
    Low: "Significant barriers to entry — complex procurement, long cycles, or misaligned timing reduce near-term viability.",
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

// ─── Segment Intelligence Data ───────────────────────────────────────────────

export interface LeadSegment {
  industry: string;
  region: string;
  geographies: string[];
  employeeSize: string;
  trends: { title: string; insight: string }[];
  expansionNote: string;
}

const SEGMENT_POOL: Record<string, LeadSegment> = {
  "enterprise-saas-na": {
    industry: "Enterprise SaaS",
    region: "North America",
    geographies: ["San Francisco, CA", "Austin, TX", "Toronto, ON"],
    employeeSize: "500–2,000",
    trends: [
      { title: "AI-Powered Sales Automation", insight: "72% of enterprise SaaS buyers are actively evaluating AI copilot tools for GTM teams." },
      { title: "Platform Consolidation", insight: "Budget holders consolidating vendors — companies with unified platforms see 3x faster deal cycles." },
    ],
    expansionNote: "This segment contains 12 similar accounts in your ICP with matching firmographics and buying signals. Expanding here could yield 8–10 net-new pipeline opportunities.",
  },
  "fintech-eu": {
    industry: "FinTech & Financial Services",
    region: "Europe",
    geographies: ["London, UK", "Frankfurt, DE", "Milan, IT"],
    employeeSize: "200–1,000",
    trends: [
      { title: "Open Banking Regulation (PSD3)", insight: "Upcoming PSD3 mandates driving urgent compliance spend across EU fintech firms." },
      { title: "Embedded Finance Growth", insight: "Embedded finance market growing 28% YoY — creating demand for API-first compliance tools." },
    ],
    expansionNote: "This segment has 9 lookalike accounts with strong regulatory tailwinds. PSD3 timeline creates urgency for 6 of them within the next 2 quarters.",
  },
  "ai-ml-apac": {
    industry: "AI & Machine Learning",
    region: "Asia-Pacific",
    geographies: ["Singapore", "Bengaluru, IN", "Tokyo, JP"],
    employeeSize: "100–500",
    trends: [
      { title: "Sovereign AI Initiatives", insight: "Government-backed AI programs in SG, IN, and JP driving enterprise adoption and local data residency requirements." },
      { title: "MLOps Maturity", insight: "50% of APAC AI firms moving from experimentation to production — creating demand for scalable infrastructure." },
    ],
    expansionNote: "This segment maps to 7 accounts in your pipeline with shared technology stacks and growth trajectories. Regional expansion here aligns with your APAC GTM strategy.",
  },
  "healthtech-na": {
    industry: "HealthTech & Digital Health",
    region: "North America",
    geographies: ["Boston, MA", "Nashville, TN", "Vancouver, BC"],
    employeeSize: "50–300",
    trends: [
      { title: "Interoperability Mandates (TEFCA)", insight: "TEFCA framework pushing health systems toward data exchange — creating urgent integration needs." },
      { title: "Remote Patient Monitoring", insight: "RPM adoption accelerating post-pandemic, with 40% of health systems expanding telehealth infrastructure." },
    ],
    expansionNote: "This segment includes 5 similar accounts actively seeking compliant data solutions. Early movers here gain significant market share before 2026 mandates.",
  },
  "ecommerce-latam": {
    industry: "E-Commerce & D2C",
    region: "Latin America",
    geographies: ["São Paulo, BR", "Mexico City, MX", "Bogotá, CO"],
    employeeSize: "50–500",
    trends: [
      { title: "Cross-Border Commerce Boom", insight: "LATAM cross-border e-commerce growing 35% YoY driven by mobile-first consumers and fintech payment rails." },
      { title: "Social Commerce Adoption", insight: "Social selling now accounts for 22% of D2C revenue in Brazil and Mexico — shifting marketing spend priorities." },
    ],
    expansionNote: "This segment contains 6 high-growth accounts with similar GMV trajectories. Expanding here captures the LATAM digital commerce wave ahead of competitors.",
  },
};

const SEGMENT_ASSIGNMENTS: Record<string, string> = {
  "1": "enterprise-saas-na", "2": "enterprise-saas-na", "5": "enterprise-saas-na", "7": "enterprise-saas-na",
  "11": "enterprise-saas-na", "16": "enterprise-saas-na", "18": "enterprise-saas-na", "19": "enterprise-saas-na",
  "8": "fintech-eu", "14": "fintech-eu", "20": "fintech-eu", "22": "fintech-eu", "35": "fintech-eu",
  "3": "ai-ml-apac", "10": "ai-ml-apac", "15": "ai-ml-apac", "23": "ai-ml-apac", "27": "ai-ml-apac", "33": "ai-ml-apac",
  "4": "healthtech-na", "6": "healthtech-na", "13": "healthtech-na", "31": "healthtech-na",
  "9": "ecommerce-latam", "12": "ecommerce-latam", "25": "ecommerce-latam", "28": "ecommerce-latam", "32": "ecommerce-latam",
};

export function getLeadSegment(leadId: string): LeadSegment | null {
  const segKey = SEGMENT_ASSIGNMENTS[leadId];
  return segKey ? SEGMENT_POOL[segKey] : SEGMENT_POOL["enterprise-saas-na"]; // fallback
}

// ─── Computed report component scores ────────────────────────────────────────

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
