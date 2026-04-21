// ─── Strategist Cohort Data Layer ────────────────────────────────────────────
// Derives agentic strategy cohorts from upstream Scout/Profiler/Mission Control
// signals. Cohorts are grouped by Urgency × Opportunity into three plays.

import { heatmapLeads, type HeatmapLead } from "@/components/market-research/lead-stream/leadData";

export type CohortId = "strike-now" | "nurture" | "educate";
export type Confidence = "High" | "Medium" | "Low";
export type SourceAgent = "Scout" | "Profiler" | "Mission Control";

export interface CohortLead extends HeatmapLead {
  icpFit?: number;
  origin: SourceAgent;
}

export interface StrategyCohort {
  id: CohortId;
  emoji: string;
  label: string;
  description: string;
  play: string;
  playRationale: string;
  signalSource: string;
  sources: SourceAgent[];
  confidence: Confidence;
  primaryAction: string;
  leads: CohortLead[];
  isNew?: boolean;
}

function enrichLead(lead: HeatmapLead): CohortLead {
  const hash = parseInt(lead.id, 10);
  const icpFit =
    lead.priority === "Tier 1"
      ? 80 + (hash % 15)
      : lead.priority === "Tier 2"
      ? 55 + (hash % 20)
      : 30 + (hash % 20);
  const origin: SourceAgent = hash % 3 === 0 ? "Profiler" : "Scout";
  return { ...lead, icpFit, origin };
}

const enrichedLeads = heatmapLeads.map(enrichLead);

const strikeLeads = enrichedLeads.filter((l) => l.priority === "Tier 1");
const nurtureLeads = enrichedLeads.filter((l) => l.priority === "Tier 2");
const educateLeads = enrichedLeads.filter((l) => l.priority === "Tier 3");

function sourceBreakdown(leads: CohortLead[]): SourceAgent[] {
  const set = new Set<SourceAgent>();
  leads.forEach((l) => set.add(l.origin));
  return Array.from(set);
}

export const strategyCohorts: StrategyCohort[] = [
  {
    id: "strike-now",
    emoji: "🔥",
    label: "Strike Now",
    description: "High urgency × high opportunity — act this week",
    play: "Competitive Displacement",
    playRationale:
      "Scout flagged competitor pricing volatility; Profiler confirms tight ICP fit. Personalised outreach with decision-maker engagement.",
    signalSource: "Scout: pricing signal · Profiler: ICP 1 match",
    sources: sourceBreakdown(strikeLeads),
    confidence: "High",
    primaryAction: "Launch Sequence",
    leads: strikeLeads,
    isNew: true,
  },
  {
    id: "nurture",
    emoji: "⚡",
    label: "Nurture",
    description: "Medium urgency × strong opportunity — build awareness",
    play: "Trigger-based Education",
    playRationale:
      "Mixed-fit accounts with emerging buying signals. Value-driven content + trigger-based follow-ups to warm them into Strike Now.",
    signalSource: "Scout: hiring activity · Profiler: ICP 2 refresh",
    sources: sourceBreakdown(nurtureLeads),
    confidence: "Medium",
    primaryAction: "Build Campaign",
    leads: nurtureLeads,
  },
  {
    id: "educate",
    emoji: "🌱",
    label: "Educate",
    description: "Low urgency × strategic fit — long-horizon awareness",
    play: "Awareness Drip",
    playRationale:
      "Future-fit accounts not ready to buy. Low-touch awareness campaigns; revisit when Scout signals strengthen.",
    signalSource: "Mission Control: market expansion thesis",
    sources: sourceBreakdown(educateLeads),
    confidence: "Low",
    primaryAction: "Queue Awareness",
    leads: educateLeads,
  },
];

export const syncMetadata = {
  lastSyncedMinutesAgo: 2,
  scoutLeads: enrichedLeads.filter((l) => l.origin === "Scout").length,
  profilerICPs: 3,
  missionControlSources: 12,
};

export const whatsNew = {
  newCohortsCount: 1,
  summary:
    "Scout flagged 8 new Tier 1 leads in Competitive Displacement since your last visit.",
};
