import { Satellite, Target } from "lucide-react";

import type { ArtefactItem } from "../types";

// Mock data for demonstration
export const mockArtefacts: ArtefactItem[] = [
  {
    id: "1",
    agentName: "Scout",
    agentIcon: Satellite,
    agentColor: "bg-blue-500",
    taskNumber: "SCT-2024-001",
    timestamp: "2h ago",
    status: "new",
    type: "analysis",
    actionDelegated: "Scout, analyze Competitor X's SMB pricing tier",
    contextRationale:
      "Because your ICP includes Mid-Market SaaS in Healthcare, this action was prioritized",
    systemImpact: "Competitive pricing benchmark updated with new SMB tier recommendations",
    actionPerformed:
      "Researched Competitor X's new SMB pricing model across 12 different SaaS platforms and analyzed pricing structures",
    outputSummary: "Comprehensive pricing analysis revealing 23% pricing gap in mid-market segment",
    fullReport: {
      title: "Competitor X — SMB Pricing Launch: Detailed Impact Analysis",
      executiveSummary:
        "Competitor X launched new SMB pricing tiers targeting mid-market SaaS companies in Healthcare vertical, directly competing with our core ICP segment. Analysis reveals 23% pricing gap in our favor across comparable feature sets.",
      keyFindings: [
        "23% pricing gap identified in our favor across comparable feature sets",
        "Competitor targets same healthcare SaaS segment with 47% feature overlap",
        "Limited geographic reach (US only) vs our global presence advantage",
        "12% of our pipeline directly affected by this competitive move",
      ],
      analysis:
        "The competitive analysis shows Competitor X is aggressively targeting our core market segment. However, our analysis reveals several strategic advantages including global presence, superior feature set, and established market relationships.",
      recommendations: [
        "Implement competitive pricing response within 2 weeks",
        "Enhance enterprise features to justify premium positioning",
        "Accelerate European market expansion to leverage geographic advantage",
        "Develop counter-positioning campaign highlighting our global capabilities",
      ],
    },
  },
  {
    id: "2",
    agentName: "Profiler",
    agentIcon: Target,
    agentColor: "bg-purple-500",
    taskNumber: "PRF-2024-028",
    timestamp: "4h ago",
    status: "viewed",
    type: "enrichment",
    actionDelegated: "Profiler, enrich ICP with EU fintech startup leads",
    contextRationale:
      "Expansion into European markets requires updated ICP profiles for fintech vertical",
    systemImpact: "Added 47 new enriched leads to CRM with automated nurture sequences activated",
    actionPerformed:
      "Enriched 52 raw leads with verified contact details and behavioral data analysis",
    outputSummary: "Successfully enriched 47 qualified leads with 94% contact accuracy",
    fullReport: {
      title: "EU Fintech ICP Enrichment: Lead Intelligence Report",
      executiveSummary:
        "European market expansion requires qualified fintech startup leads with verified contact data and behavioral insights for targeted outreach campaigns. Successfully enriched 47 qualified leads from 52 raw records.",
      keyFindings: [
        "47 qualified leads enriched from 52 raw records (90% success rate)",
        "94% contact accuracy achieved through multi-source verification",
        "73% of leads are Series A-B stage with strong payment infrastructure needs",
        "Average company size: 50-200 employees with $2-10M ARR",
      ],
      analysis:
        "The enrichment process revealed high-quality fintech startups across key European markets, with strong concentration in London, Berlin, and Amsterdam. Most companies show clear payment processing and compliance needs.",
      recommendations: [
        "Prioritize Series A companies for immediate outreach",
        "Focus on companies using Stripe or similar payment processors",
        "Target CTOs and Head of Engineering roles for technical decisions",
        "Develop region-specific compliance messaging for EU market",
      ],
    },
  },
  {
    id: "3",
    agentName: "Scout",
    agentIcon: Satellite,
    agentColor: "bg-blue-500",
    taskNumber: "SCT-2024-045",
    timestamp: "2d ago",
    status: "updated",
    type: "analysis",
    actionDelegated: "Scout, calculate TAM/SAM/SOM for fintech vertical expansion",
    contextRationale: "Required for investor presentations and strategic planning discussions",
    systemImpact:
      "Market analysis integrated into strategic planning dashboard for investor deck preparation",
    actionPerformed:
      "Analyzed addressable market size for fintech vertical with detailed TAM, SAM, and SOM breakdowns",
    outputSummary: "Market analysis showing $47B TAM, $2.3B SAM, and $180M SOM for target segments",
    fullReport: {
      title: "Fintech Vertical Market Sizing: TAM/SAM/SOM Analysis",
      executiveSummary:
        "Comprehensive market sizing analysis for fintech vertical expansion, providing detailed TAM, SAM, and SOM calculations with geographic breakdown and competitive landscape assessment.",
      keyFindings: [
        "Total Addressable Market (TAM): $47B globally",
        "Serviceable Addressable Market (SAM): $2.3B in target regions",
        "Serviceable Obtainable Market (SOM): $180M realistic capture",
        "Payment processing represents 42% of addressable opportunity",
      ],
      analysis:
        "The fintech vertical shows strong growth potential with increasing digitization and regulatory support. Key opportunities lie in payment processing, lending software, and compliance automation.",
      recommendations: [
        "Focus on $180M serviceable obtainable market initially",
        "Prioritize payment processing and lending software segments",
        "Consider geographic expansion to DACH region within 18 months",
        "Develop partnerships with existing fintech infrastructure providers",
      ],
    },
  },
];
