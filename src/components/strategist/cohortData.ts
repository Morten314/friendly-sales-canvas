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
  email: string;
  website: string;
  linkedin: string;
}

export interface BriefSection {
  label: string;
  body: string;
}

export interface StrategyCohort {
  id: CohortId;
  emoji: string;
  label: string;
  description: string;
  play: string;
  brief: BriefSection[];
  signalSource: string;
  sources: SourceAgent[];
  confidence: Confidence;
  primaryAction: string;
  leads: CohortLead[];
  isNew?: boolean;
  avgScore: number;
  icpFitAvg: number;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function firstName(name: string): string {
  return name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
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
  const domain = `${slugify(lead.company)}.com`;
  return {
    ...lead,
    icpFit,
    origin,
    email: `${firstName(lead.name)}@${domain}`,
    website: domain,
    linkedin: `linkedin.com/in/${slugify(lead.name)}`,
  };
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
    brief: [
      {
        label: "What I saw",
        body: `Scout picked up competitor pricing changes in the last 14 days, and Profiler scored ${strikeLeads.length} of these leads above 80% on your top ICP.`,
      },
      {
        label: "Why I grouped them",
        body: "They share a fresh buying trigger and your strongest fit profile — the rare overlap where intent meets fit.",
      },
      {
        label: "Why act now",
        body: "Pricing volatility creates a short defection window. Waiting beyond two weeks typically loses ~40% of this urgency.",
      },
    ],
    signalSource: "Scout: pricing signal · Profiler: ICP 1 match",
    sources: sourceBreakdown(strikeLeads),
    confidence: "High",
    primaryAction: "Launch Sequence",
    leads: strikeLeads,
    isNew: true,
    get avgScore() { return Math.round(this.leads.reduce((sum, l) => sum + (l.score || 0), 0) / this.leads.length); },
    get icpFitAvg() { return Math.round(this.leads.reduce((sum, l) => sum + (l.icpFit || 0), 0) / this.leads.length); },
  },
  {
    id: "nurture",
    emoji: "⚡",
    label: "Nurture",
    description: "Medium urgency × strong opportunity — build awareness",
    play: "Trigger-based Education",
    brief: [
      {
        label: "What I saw",
        body: `Scout flagged hiring spikes and content engagement across ${nurtureLeads.length} accounts, with Profiler showing solid but not perfect ICP alignment.`,
      },
      {
        label: "Why I grouped them",
        body: "Real signals are forming, but it's too early for a hard ask — they need warming, not pitching.",
      },
      {
        label: "Why act now",
        body: "Stay top-of-mind with value-led touches so they're ready when the next trigger fires and moves them into Strike Now.",
      },
    ],
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
    brief: [
      {
        label: "What I saw",
        body: `Mission Control flagged these ${educateLeads.length} accounts as part of your expansion thesis, but Scout sees no immediate buying signals.`,
      },
      {
        label: "Why I grouped them",
        body: "Strategically interesting, tactically quiet — they don't deserve outreach today, but they shouldn't be forgotten either.",
      },
      {
        label: "Why act now",
        body: "Light-touch awareness keeps the door open at near-zero cost. Scout will alert you the moment a real signal appears.",
      },
    ],
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
