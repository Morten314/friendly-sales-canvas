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

export interface CohortAction {
  label: string;
  icon: "mail" | "linkedin" | "list" | "calendar" | "search" | "users";
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
  leadActions: CohortAction[];
  chatActions: { label: string }[];
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

const strikeNowActions: CohortAction[] = [
  { label: "Send Customised Email", icon: "mail" },
  { label: "Connect on LinkedIn", icon: "linkedin" },
  { label: "Add to Sequence", icon: "list" },
  { label: "Book a Meeting", icon: "calendar" },
];

const nurtureActions: CohortAction[] = [
  { label: "Find Latest Activities", icon: "search" },
  { label: "Connect on LinkedIn", icon: "linkedin" },
  { label: "Find Decision Maker", icon: "users" },
  { label: "Send Customised Email", icon: "mail" },
];

const educateActions: CohortAction[] = [
  { label: "Find Latest Activities", icon: "search" },
  { label: "Find Decision Maker", icon: "users" },
  { label: "Add to Sequence", icon: "list" },
];

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
      {
        label: "Channel recommendation",
        body: "Multi-touch: open with a direct email referencing the pricing change, follow up with a LinkedIn connection request the same day. Phone only if email gets opened but no reply within 48 hours.",
      },
      {
        label: "Narrative angle",
        body: "Lead with migration cost — Scout's pricing data shows their current vendor raised mid-contract. Position your platform as the low-friction switch while their renewal window is still open.",
      },
    ],
    signalSource: "Scout: pricing signal · Profiler: ICP 1 match",
    sources: sourceBreakdown(strikeLeads),
    confidence: "High",
    primaryAction: "Plan Next Steps",
    leads: strikeLeads,
    isNew: true,
    get avgScore() { return Math.round(this.leads.reduce((sum, l) => sum + (l.totalScore || 0), 0) / this.leads.length); },
    get icpFitAvg() { return Math.round(this.leads.reduce((sum, l) => sum + (l.icpFit || 0), 0) / this.leads.length); },
    leadActions: strikeNowActions,
    chatActions: [
      { label: "Start Email" },
      { label: "Start LinkedIn Conversation" },
      { label: "Plan a Sequence" },
    ],
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
      {
        label: "Channel recommendation",
        body: "LinkedIn-first: these leads are actively posting and engaging. Email is secondary — use it only for sharing relevant content after a LinkedIn rapport is established.",
      },
      {
        label: "Narrative angle",
        body: "Lead with operational efficiency — Scout flagged hiring spikes suggesting growing pains. Frame your solution as the force multiplier they need as they scale, not another tool to evaluate.",
      },
    ],
    signalSource: "Scout: hiring activity · Profiler: ICP 2 refresh",
    sources: sourceBreakdown(nurtureLeads),
    confidence: "Medium",
    primaryAction: "Plan Next Steps",
    leads: nurtureLeads,
    get avgScore() { return Math.round(this.leads.reduce((sum, l) => sum + (l.totalScore || 0), 0) / this.leads.length); },
    get icpFitAvg() { return Math.round(this.leads.reduce((sum, l) => sum + (l.icpFit || 0), 0) / this.leads.length); },
    leadActions: nurtureActions,
    chatActions: [
      { label: "Build Warmth" },
      { label: "Change Narrative" },
      { label: "Set a Trigger-Based Play" },
    ],
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
      {
        label: "Channel recommendation",
        body: "Drip sequence only: no direct outreach warranted. Automated content drops every 2–3 weeks to stay visible without burning the relationship.",
      },
      {
        label: "Narrative angle",
        body: "Lead with thought leadership — these accounts are in your expansion thesis but show no active pain. Share market insights from Scout that position you as a category expert, not a vendor.",
      },
    ],
    signalSource: "Mission Control: market expansion thesis",
    sources: sourceBreakdown(educateLeads),
    confidence: "Low",
    primaryAction: "Plan Next Steps",
    leads: educateLeads,
    get avgScore() { return Math.round(this.leads.reduce((sum, l) => sum + (l.totalScore || 0), 0) / this.leads.length); },
    get icpFitAvg() { return Math.round(this.leads.reduce((sum, l) => sum + (l.icpFit || 0), 0) / this.leads.length); },
    leadActions: educateActions,
    chatActions: [
      { label: "Build Warmth" },
      { label: "Select a Sequence" },
      { label: "Route to Marketing" },
    ],
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
