import type { SignalLeadMapLead } from "../contracts";

export type RelevanceTier = "high" | "medium" | "low";

/** One touch in a cohort's preview skeleton (no copy — Strategist owns bodies). */
export interface OutreachTouch {
  day: number;
  channel: "email" | "linkedin" | "call";
  action: string;
}

export interface OutreachPlanStep {
  /** Cohort label, e.g. "High relevance · 4 leads". */
  label: string;
  /** When to move on this cohort. */
  timing: string;
  /** How to approach them. */
  move: string;
  /** Relevance tier this cohort represents. */
  relevance: RelevanceTier;
  /** The leads that belong to this cohort (for per-cohort dispatch). */
  leads: SignalLeadMapLead[];
  /** Touch skeleton previewed inline; the full editable plan lives in Strategist. */
  touches: OutreachTouch[];
}

export interface AggregateOutreachPlan {
  /** One-line framing of the whole approach. */
  summary: string;
  steps: OutreachPlanStep[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const TOUCHES: Record<RelevanceTier, OutreachTouch[]> = {
  high: [
    { day: 1, channel: "email", action: "Signal-led opening email" },
    { day: 2, channel: "linkedin", action: "Connection request referencing the signal" },
    { day: 4, channel: "call", action: "Call attempt with a meeting ask" },
    { day: 7, channel: "email", action: "Proof-point follow-up" },
  ],
  medium: [
    { day: 1, channel: "email", action: "Market-context email (no pitch)" },
    { day: 4, channel: "linkedin", action: "Light touch on their recent activity" },
    { day: 9, channel: "email", action: "Relevant resource + soft ask" },
  ],
  low: [
    { day: 1, channel: "email", action: "Add to nurture / newsletter" },
    { day: 30, channel: "email", action: "Quarterly check-in" },
  ],
};

/**
 * Derives a single aggregated outreach plan for a signal from the relevance
 * spread of its matched leads. Display-only: no backend call, deterministic,
 * so the inline table can end with "what to do next" instead of a per-row
 * column. Execution of these steps happens in Strategist.
 */
export function buildAggregateOutreachPlan(
  leads: SignalLeadMapLead[],
  suggestedAction?: string,
): AggregateOutreachPlan | null {
  if (!leads.length) return null;

  const high = leads.filter((l) => l.relevance === "high");
  const medium = leads.filter((l) => l.relevance === "medium");
  const low = leads.filter((l) => l.relevance !== "high" && l.relevance !== "medium");

  const steps: OutreachPlanStep[] = [];
  if (high.length) {
    steps.push({
      label: `High relevance · ${plural(high.length, "lead")}`,
      timing: "Within 48 hours",
      move: "Personalised 1:1 outreach citing this signal directly, then a call ask.",
      relevance: "high",
      leads: high,
      touches: TOUCHES.high,
    });
  }
  if (medium.length) {
    steps.push({
      label: `Medium relevance · ${plural(medium.length, "lead")}`,
      timing: "This week",
      move: "Lightly tailored sequence framing the signal as market context, not a pitch.",
      relevance: "medium",
      leads: medium,
      touches: TOUCHES.medium,
    });
  }
  if (low.length) {
    steps.push({
      label: `Low relevance · ${plural(low.length, "lead")}`,
      timing: "Nurture",
      move: "Add to the newsletter or a quarterly check-in; no direct ask yet.",
      relevance: "low",
      leads: low,
      touches: TOUCHES.low,
    });
  }

  const lead = high.length
    ? `Lead with the ${plural(high.length, "high-relevance lead")} — they carry the strongest fit to this signal.`
    : medium.length
      ? "No high-relevance leads here: run this as a measured, context-first play."
      : "Low-signal cohort: nurture rather than outreach.";

  return {
    summary: suggestedAction?.trim() ? `${lead} ${suggestedAction.trim()}` : lead,
    steps,
  };
}
